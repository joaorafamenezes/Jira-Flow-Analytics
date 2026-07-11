import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = __dirname;
const backendOrigin = 'http://localhost:3000';
const port = 4173;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function serveStatic(req, res) {
  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const normalizedPath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(frontendRoot, normalizedPath);

  if (!filePath.startsWith(frontendRoot)) {
    sendJson(res, 403, { message: 'Forbidden' });
    return;
  }

  if (!existsSync(filePath)) {
    sendJson(res, 404, { message: 'Not found' });
    return;
  }

  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) {
    sendJson(res, 404, { message: 'Not found' });
    return;
  }

  const extension = path.extname(filePath);
  res.writeHead(200, {
    'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  createReadStream(filePath).pipe(res);
}

function proxyApi(req, res) {
  const target = new URL(req.url.replace(/^\/api/, ''), backendOrigin);
  const proxyRequest = http.request(target, {
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:3000'
    }
  }, (proxyResponse) => {
    res.writeHead(proxyResponse.statusCode ?? 500, proxyResponse.headers);
    proxyResponse.pipe(res);
  });

  proxyRequest.on('error', (error) => {
    sendJson(res, 502, {
      message: 'Failed to reach backend API',
      details: error.message
    });
  });

  req.pipe(proxyRequest);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { message: 'Invalid request' });
    return;
  }

  if (req.url.startsWith('/api/')) {
    proxyApi(req, res);
    return;
  }

  try {
    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, {
      message: 'Failed to serve frontend',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

server.listen(port, () => {
  console.log(`Frontend running at http://localhost:${port}`);
});
