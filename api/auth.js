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
  '/logbook.js': 'logbook.js',
  '/hunting.js': 'hunting.js',
  '/web.js':     'web.js',
  '/data.json':  'data.json',
};

export default async function handler(req, res) {
  const AUTH_USER   = process.env.BASIC_AUTH_USER || 'admin';
  const AUTH_PASS   = process.env.BASIC_AUTH_PASS || 'password123';
  const GH_TOKEN    = process.env.GITHUB_TOKEN;
  const GH_OWNER    = process.env.GITHUB_OWNER;
  const GH_REPO     = process.env.GITHUB_REPO;
  const GH_BRANCH   = process.env.GITHUB_BRANCH || 'main';

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

  // ── POST /save → GitHub API で data.json を更新 ──────
  if (req.method === 'POST') {
    const rawPath = req.headers['x-matched-path'] || req.headers['x-invoke-path'] || req.url;
    const reqPath = rawPath.split('?')[0].replace(/^\/api\/auth/, '') || '/';

    if (reqPath === '/save') {
      if (!GH_TOKEN || !GH_OWNER || !GH_REPO) {
        res.status(500).json({ error: 'GitHub env vars not configured' });
        return;
      }

      try {
        const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

        // 現在のファイルのSHAを取得（更新に必要）
        const getRes = await fetch(
          `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/data.json?ref=${GH_BRANCH}`,
          { headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
        );
        if (!getRes.ok) {
          const err = await getRes.text();
          res.status(500).json({ error: 'GitHub GET failed', detail: err });
          return;
        }
        const fileInfo = await getRes.json();
        const sha = fileInfo.sha;

        // data.json を更新コミット
        const content = Buffer.from(body, 'utf8').toString('base64');
        const putRes  = await fetch(
          `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/data.json`,
          {
            method: 'PUT',
            headers: {
              Authorization: `token ${GH_TOKEN}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `chore: update data.json via app [${new Date().toISOString()}]`,
              content,
              sha,
              branch: GH_BRANCH,
            }),
          }
        );
        if (!putRes.ok) {
          const err = await putRes.text();
          res.status(500).json({ error: 'GitHub PUT failed', detail: err });
          return;
        }
        const putData = await putRes.json();
        res.status(200).json({ ok: true, commit: putData.commit?.sha });
        return;
      } catch (err) {
        res.status(500).json({ error: err.message });
        return;
      }
    }

    res.status(404).send('Not Found');
    return;
  }

  // ── GET /latest → GitHub API から最新 data.json を返す ──
  {
    const rawPathL = req.headers['x-matched-path'] || req.headers['x-invoke-path'] || req.url;
    const reqPathL = rawPathL.split('?')[0].replace(/^\/api\/auth/, '') || '/';
    if (reqPathL === '/latest') {
      if (!GH_TOKEN || !GH_OWNER || !GH_REPO) {
        res.status(500).json({ error: 'GitHub env vars not configured' });
        return;
      }
      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/data.json?ref=${GH_BRANCH}`,
          { headers: { Authorization: `token ${GH_TOKEN}`, Accept: 'application/vnd.github.v3.raw' } }
        );
        if (!ghRes.ok) {
          const err = await ghRes.text();
          res.status(502).json({ error: 'GitHub GET failed', detail: err });
          return;
        }
        const raw = await ghRes.text();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).send(raw);
        return;
      } catch (err) {
        res.status(502).json({ error: err.message });
        return;
      }
    }
  }

  // ── GET: ファイルを返す ──────────────────────────────
  const rawPath  = req.headers['x-matched-path'] || req.headers['x-invoke-path'] || req.url;
  const reqPath  = rawPath.split('?')[0].replace(/^\/api\/auth/, '') || '/';
  const fileName = ALLOWED_FILES[reqPath];

  if (!fileName) {
    res.status(404).send('Not Found');
    return;
  }

  // ★ __dirname は /var/task/api なので .. で一つ上へ
  const filePath = path.join(__dirname, '..', fileName);
  const ext      = path.extname(fileName);
  const mimeType = MIME[ext] || 'text/plain';

  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(fileData);
  } catch (err) {
    console.error('[auth] error:', err.message, 'path:', filePath);
    res.status(500).send('Error: ' + err.message);
  }
}
