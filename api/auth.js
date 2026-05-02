// api/auth.js
const path = require('path');
const fs   = require('fs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const ALLOWED_FILES = {
  '/':           'index.html',
  '/index.html': 'index.html',
  '/app.js':     'app.js',
  '/data.json':  'data.json',
};

export default function handler(req, res) {
  const AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
  const AUTH_PASS = process.env.BASIC_AUTH_PASS || 'password123';

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
    res.status(401).send('Unauthorized');
    return;
  }

  const decoded  = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const colonIdx = decoded.indexOf(':');
  const user     = decoded.slice(0, colonIdx);
  const pass     = decoded.slice(colonIdx + 1);

  if (user !== AUTH_USER || pass !== AUTH_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
    res.status(401).send('Unauthorized');
    return;
  }

  // Vercel リライト後でも元のパスを取得する
  const rawPath  = req.headers['x-matched-path'] || req.headers['x-invoke-path'] || req.url;
  const reqPath  = rawPath.split('?')[0].replace(/^\/api\/auth/, '') || '/';
  const fileName = ALLOWED_FILES[reqPath] || ALLOWED_FILES['/'];

  if (!fileName) {
    res.status(404).send('Not Found');
    return;
  }

  // ★ ここを修正: __dirname は /var/task/api なので .. で一つ上へ
  const filePath = path.join(__dirname, '..', fileName);
  const ext      = path.extname(fileName);
  const mimeType = MIME[ext] || 'text/plain';

  console.log('[auth] serving:', filePath);

  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', mimeType);
    if (fileName === 'data.json') {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    res.status(200).send(fileData);
  } catch (err) {
    console.error('[auth] error:', err.message, 'path:', filePath);
    res.status(500).send('Error: ' + err.message);
  }
}