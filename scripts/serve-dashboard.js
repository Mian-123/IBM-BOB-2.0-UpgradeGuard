#!/usr/bin/env node
/**
 * UpgradeGuard local control panel server.
 *
 * Serves dashboard.html and reports/*.json as static files, AND exposes
 * three POST endpoints that run the existing scripts as real child
 * processes, STREAMING their console output back to the browser as it
 * happens (not buffered until the whole thing finishes). This matters:
 * `rehearse.js` on 6 dependencies can genuinely take a few minutes (each
 * one is a real `npm install` + real test run), and a page that shows
 * nothing for minutes reads as broken even when it's working correctly.
 *
 *   POST /api/scan               -> streams `node scripts/scan.js`
 *   POST /api/rehearse           -> streams `node scripts/rehearse.js` (all deps)
 *   POST /api/rehearse?name=expr -> streams `node scripts/rehearse.js express`
 *   POST /api/merge              -> streams `node scripts/merge-reports.js`
 *
 * Only one action runs at a time (a simple in-memory lock) to avoid two
 * rehearsals fighting over the same git worktree.
 *
 * Usage: node scripts/serve-dashboard.js [port]
 * Then open http://localhost:<port>/dashboard.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : 8080;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
};

let busy = false;

function streamScript(scriptRelPath, args, res) {
  if (busy) {
    res.writeHead(409, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Another action is already running -- wait for it to finish, then try again.');
  }
  busy = true;

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });

  const child = spawn(process.execPath, [path.join(ROOT, scriptRelPath), ...args], { cwd: ROOT });

  child.stdout.on('data', (chunk) => res.write(chunk));
  child.stderr.on('data', (chunk) => res.write(chunk));

  child.on('close', (code) => {
    busy = false;
    res.write(`\n\n[finished, exit code ${code}]`);
    res.end();
  });

  child.on('error', (err) => {
    busy = false;
    res.write('\n\nFailed to start script: ' + err.message);
    res.end();
  });

  // If the browser tab closes mid-run, don't leave an orphaned process.
  res.req.on('close', () => {
    if (!res.writableEnded) {
      child.kill();
      busy = false;
    }
  });
}

function serveStatic(req, res, pathname) {
  let urlPath = pathname === '/' ? '/dashboard.html' : pathname;
  const filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found: ' + urlPath);
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // WHATWG URL API instead of the deprecated url.parse().
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsed.pathname);

  if (req.method === 'POST' && pathname === '/api/scan') {
    return streamScript('scripts/scan.js', [], res);
  }
  if (req.method === 'POST' && pathname === '/api/rehearse') {
    const name = parsed.searchParams.get('name');
    return streamScript('scripts/rehearse.js', name ? [name] : [], res);
  }
  if (req.method === 'POST' && pathname === '/api/merge') {
    return streamScript('scripts/merge-reports.js', [], res);
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`UpgradeGuard control panel running at http://localhost:${PORT}/dashboard.html`);
});
