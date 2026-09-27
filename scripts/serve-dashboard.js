#!/usr/bin/env node
/**
 * UpgradeGuard local control panel server.
 *
 * Serves dashboard.html and reports/*.json exactly like a plain static
 * server, AND exposes three POST endpoints that run the existing scripts
 * as real child processes -- so the whole free (non-Bob) part of the
 * workflow can be operated entirely by clicking buttons in the browser,
 * with the actual script's console output shown back in real time:
 *
 *   POST /api/scan               -> runs `node scripts/scan.js`
 *   POST /api/rehearse           -> runs `node scripts/rehearse.js` (all deps)
 *   POST /api/rehearse?name=expr -> runs `node scripts/rehearse.js express`
 *   POST /api/merge              -> runs `node scripts/merge-reports.js`
 *
 * Each returns { ok: boolean, output: string } with the script's real
 * stdout/stderr -- this is not a fake progress bar, it is the actual
 * script's actual output.
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
const url = require('url');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : 8080;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
};

let busy = false;

function runScript(scriptRelPath, args, res) {
  if (busy) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, output: 'Another action is already running -- wait for it to finish.' }));
  }
  busy = true;
  execFile(
    process.execPath,
    [path.join(ROOT, scriptRelPath), ...args],
    { cwd: ROOT, timeout: 10 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
    (error, stdout, stderr) => {
      busy = false;
      const output = (stdout || '') + (stderr ? '\n' + stderr : '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: !error, output }));
    }
  );
}

function serveStatic(req, res, urlPath) {
  if (urlPath === '/') urlPath = '/dashboard.html';
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
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  if (req.method === 'POST' && pathname === '/api/scan') {
    return runScript('scripts/scan.js', [], res);
  }
  if (req.method === 'POST' && pathname === '/api/rehearse') {
    const name = parsed.query.name;
    return runScript('scripts/rehearse.js', name ? [String(name)] : [], res);
  }
  if (req.method === 'POST' && pathname === '/api/merge') {
    return runScript('scripts/merge-reports.js', [], res);
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`UpgradeGuard control panel running at http://localhost:${PORT}/dashboard.html`);
});
