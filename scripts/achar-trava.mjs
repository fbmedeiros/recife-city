// Acha travada do jogo: abre num Chrome sem janela, clica JOGAR, anda um pouco e testa a página a cada 2 s.
// Se ela não responder em 5 s, pausa o depurador e imprime a pilha (onde o JS está preso). Repete N vezes.
// Uso (servidor no ar): node scripts/achar-trava.mjs [vezes=3] [segundos por vez=90]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const VEZES = +process.argv[2] || 3, SEG = +process.argv[3] || 90;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uma(n) {
  const PORT = 9340 + n, dir = mkdtempSync(join(tmpdir(), 'hellcife-trava-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
  try {
    let tabs = null;
    for (let i = 0; i < 50 && !tabs; i++) { await sleep(200); tabs = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => null); }
    const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0; const wait = new Map(); let pausa = null;
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } if (m.method === 'Debugger.paused') pausa = m.params; });
    const send = (method, params = {}, ms = 0) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); if (ms) setTimeout(() => { if (wait.delete(i)) r(null); }, ms); });
    const ev = async (expr, ms = 5000) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, ms))?.result?.result?.value;
    await send('Runtime.enable'); await send('Debugger.enable');
    await send('Page.navigate', { url: 'http://localhost:5188/' });
    const t0 = Date.now();
    while (Date.now() - t0 < 180000) { await sleep(1000); if (await ev('!!(window.game?.player && (window.loadTimes||[]).length >= 12)', 3000)) break; }
    await ev("[...document.querySelectorAll('button')].find((b) => /JOGAR/.test(b.textContent))?.click(); game.keys.KeyW = true; setTimeout(() => game.keys.KeyW = false, 4000); true");
    const t1 = Date.now();
    while (Date.now() - t1 < SEG * 1000) {
      await sleep(2000);
      const r = await ev('performance.now()', 5000);
      if (r == null) {
        await send('Debugger.pause', {}, 5000);
        for (let k = 0; k < 20 && !pausa; k++) await sleep(250);
        console.log(`#${n} TRAVOU ${((Date.now() - t1) / 1000).toFixed(0)} s depois de JOGAR. Pilha:`);
        for (const f of (pausa?.callFrames || []).slice(0, 14)) console.log(`   ${f.functionName || '(anônima)'}  ${f.url.replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${f.location.lineNumber + 1}`);
        if (!pausa) console.log('   (não deu pra pausar)');
        return true;
      }
    }
    console.log(`#${n} ok: ${SEG} s sem travar`);
    return false;
  } finally { chrome.kill(); await sleep(500); rmSync(dir, { recursive: true, force: true }); }
}
for (let n = 1; n <= VEZES; n++) await uma(n);
