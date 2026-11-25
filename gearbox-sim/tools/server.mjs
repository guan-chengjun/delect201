// 零依赖本地静态服务器：npm start 后访问 http://localhost:8214
// ES Module + GLB 必须通过 http(s) 提供，file:// 直接打开会被浏览器 CORS 拦截
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8214;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    // 仅取路径部分，去掉查询串；统一用 posix 分隔符后再规范化，兼容 Windows
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const rel = normalize(urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
    const filePath = resolve(root, rel);

    // 防目录穿越：规范化后的绝对路径必须仍在项目根目录内
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}).listen(PORT, () => {
  console.log(`齿轮减速箱仿真已启动：http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止服务');
});
