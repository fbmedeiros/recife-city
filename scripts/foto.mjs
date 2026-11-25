// Foto de teste do jogo num Chrome sem janela (não depende do painel do navegador estar visível).
// Uso: node scripts/foto.mjs saida.png "<JS que prepara a cena, roda depois do jogo abrir>" [url]
// O JS pode usar window.game (teleport, camFree, tick). Ex.:
//   node scripts/foto.mjs /tmp/a.png "game.teleport(0,0); game.camFree={pos:[0,80,100],look:[0,0,0]}; game.tick(3)"
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [out, setup = '', url = 'http://localhost:5188/'] = process.argv.slice(2);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = mkdtempSync(join(tmpdir(), 'hellcife-foto-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
try {
  let tabs = null;
  for (let i = 0; i < 50 && !tabs; i++) { await sleep(200); tabs = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => null); }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const wait = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) console.error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
  await send('Runtime.enable');
  await send('Page.navigate', { url });
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) { await sleep(1000); if (await ev('!!(window.game?.player && (window.loadTimes||[]).length >= 12)')) break; }
  await ev("[...document.querySelectorAll('button')].find((b) => /JOGAR/.test(b.textContent))?.click()");
  await sleep(1500);
  const res = await ev(`(async () => { const game = window.game; ${setup}; await new Promise((r) => setTimeout(r, 1500)); return 'ok'; })()`);
  await sleep(500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  const saida = await ev('window.__saida'); // o JS da cena pode deixar um resultado aqui
  console.log(res, '->', out, saida !== undefined ? JSON.stringify(saida) : '');
  ws.close();
} finally {
  chrome.kill(); await sleep(500); rmSync(dir, { recursive: true, force: true });
}
