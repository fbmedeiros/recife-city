import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// só no servidor de desenvolvimento: POST /__shot?name=x grava public/intro/x.jpg (fotos da intro tiradas do próprio jogo)
const introShots = {
  name: 'intro-shots',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      const name = new URL(req.url, 'http://x').searchParams.get('name') || '';
      if (req.method !== 'POST' || !/^[a-z0-9-]{1,40}$/.test(name)) { res.statusCode = 400; res.end('nome inválido'); return; }
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const dir = path.resolve('public/intro'); fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, name + '.jpg'), Buffer.concat(chunks));
        res.end('ok');
      });
    });
  },
};
export default defineConfig({ build: { target: 'es2022' }, server: { port: 5188 }, plugins: [introShots] });
