// api/auth.js
const path = require('path');
const fs   = require('fs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// Vercel の関数は /api/auth で実行されるため、
// 実際のファイル名とリクエストパスのマッピングを定義
const ALLOWED_FILES = {
  '/':           'index.html', // ルートパスは index.html を返す
  '/index.html': 'index.html',
  '/app.js':     'app.js',
  '/data.json':  'data.json',
};

export default function handler(req, res) {
  const AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
  const AUTH_PASS = process.env.BASIC_AUTH_PASS || 'password123';

  // ── Basic 認証チェック ────────────────────────────────
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

  // ── 認証成功：ファイルを返す ─────────────────────────
  // req.url は /app.js や /data.json のようになる
  const reqPath  = req.url.split('?')[0];
  const fileName = ALLOWED_FILES[reqPath];

  if (!fileName) {
    res.status(404).send('Not Found');
    return;
  }

  // ファイルは api/auth.js と同じディレクトリにあると想定
  const filePath = path.join(__dirname, fileName); // __dirname は /var/task/api
  const ext      = path.extname(fileName);
  const mimeType = MIME[ext] || 'text/plain';

  console.log('[auth] serving:', filePath);

  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', mimeType);
    if (fileName === 'data.json') {
      res.setHeader('Cache-Control', 'no-store'); // data.json はキャッシュしない
    } else {
      // その他の静的ファイルもキャッシュさせない方がデバッグしやすい
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