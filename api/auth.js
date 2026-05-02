const path = require('path');
const fs = require('fs');

export default function handler(req, res) {
  // 環境変数からBasic認証のユーザー名とパスワードを取得
  const AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
  const AUTH_PASS = process.env.BASIC_AUTH_PASS || 'password123';

  // Authorization ヘッダーの確認
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
    res.status(401).send('Unauthorized');
    return;
  }

  // Base64デコード処理
  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const user = auth[0];
  const pass = auth[1];

  // 認証情報の照合
  if (user === AUTH_USER && pass === AUTH_PASS) {
    // 認証成功時、index.html を読み込んで返す
    const filePath = path.join(process.cwd(), 'index.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.status(500).send('Error loading page');
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(data);
    });
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
    res.status(401).send('Unauthorized');
  }
}
