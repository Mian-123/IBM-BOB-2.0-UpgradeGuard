#!/usr/bin/env node
/**
 * Zero-dependency static file server for viewing dashboard.html and the
 * reports/ folder locally -- no need to install http-server, serve, etc.
 *
 * Usage: node scripts/serve-dashboard.js [port]
 * Then open http://localhost:<port>/dashboard.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : 8080;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
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
});

server.listen(PORT, () => {
  console.log(`UpgradeGuard dashboard running at http://localhost:${PORT}/dashboard.html`);
});
