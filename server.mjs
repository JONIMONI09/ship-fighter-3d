/* Zero-dependency static dev server (ESM). Run: npm start */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};
const PORT = process.env.PORT || 8123;

createServer(async (req, res) => {
  try {
    const url = req.url.split('?')[0];
    const file = url === '/' ? '/index.html' : url;
    const data = await readFile(path.join(ROOT, file));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
