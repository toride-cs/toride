const path = require('path');
const fs   = require('fs');

// ── MIME TYPE MAP ─────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// ── 許可するファイルの明示的なホワイトリスト ──────────────
const ALLOWED = {
  '/':           'index.html',
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

  const [user, pass] = Buffer.from(authHeader.split(' ')[1], 'base64')
    .toString()
    .split(':');

  if (user !== AUTH_USER || pass !== AUTH_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
    res.status(401).send('Unauthorized');
    return;
  }

  // ── 認証成功：リクエストパスに応じてファイルを返す ─────
  const reqPath  = req.url.split('?')[0]; // クエリ除去
  const fileName = ALLOWED[reqPath];

  if (!fileName) {
    res.status(404).send('Not Found');
    return;
  }

  const filePath = path.join(process.cwd(), fileName);
  const ext      = path.extname(fileName);
  const mimeType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Error loading file');
      return;
    }
    res.setHeader('Content-Type', mimeType);
    // data.json はキャッシュさせない（編集後すぐ反映させるため）
    if (fileName === 'data.json') {
      res.setHeader('Cache-Control', 'no-store');
    }
    res.status(200).send(data);
  });
}
