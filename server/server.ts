// One process, one port: serves the display + remote pages and relays commands over /ws.
// Dev mode uses Vite middleware; `--prod` serves the built dist/ folder.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { PORT } from '../src/config';

const prod = process.argv.includes('--prod');
const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');

let pages: http.RequestListener = serveStatic;
const server = http.createServer((req, res) => {
  if (req.url === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ remoteUrls: remoteUrls() }));
    return;
  }
  pages(req, res);
});

if (!prod) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    server: { middlewareMode: true, hmr: { server } },
    appType: 'mpa',
  });
  pages = vite.middlewares;
}

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  // Vite's HMR socket shares this server and handles its own upgrades.
  if (req.url !== '/ws') return;
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  console.log(`[ws] client connected from ${req.socket.remoteAddress} (${wss.clients.size} total)`);
  ws.on('message', (data) => {
    const text = data.toString();
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) client.send(text);
    }
  });
  ws.on('close', () => console.log(`[ws] client left (${wss.clients.size} total)`));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nWizard ${prod ? 'show' : 'dev'} server on port ${PORT}`);
  console.log(`  Display (this Mac):  http://localhost:${PORT}/`);
  remoteUrls().forEach((url, i) => console.log(`  ${i === 0 ? 'Phone remote:      ' : '                   '}  ${url}`));
});

/** The .local name first (survives DHCP changes), then each LAN IPv4 address. */
function remoteUrls(): string[] {
  const host = os.hostname().replace(/\.local$/, '');
  const urls = [`http://${host}.local:${PORT}/remote.html`];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${PORT}/remote.html`);
    }
  }
  return urls;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const file = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(distDir + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  });
}
