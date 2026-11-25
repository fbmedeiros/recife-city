// Mede a memória do jogo num Chrome sem janela, com coleta de lixo forçada (o painel do navegador não deixa medir
// direito: o jogo segue alocando e o coletor não roda na hora).
// Uso (com o servidor de desenvolvimento no ar): node scripts/medir-memoria.mjs "" "?semcobertura" "?semms"
// Para cada variante: tempo de carregamento e heap de JS depois do gc() (MB).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.URL || 'http://localhost:5188/';
const PORT = 9333;
const variants = process.argv.slice(2).length ? process.argv.slice(2) : [''];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function medir(v) {
const dir = mkdtempSync(join(tmpdir(), 'hellcife-mem-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--js-flags=--expose-gc', '--enable-precise-memory-info',
  '--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
try {
  let tabs = null;
  for (let i = 0; i < 50 && !tabs; i++) { await sleep(200); tabs = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => null); }
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const wait = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await send('Runtime.enable');
  const amostrar = process.env.AMOSTRA; // AMOSTRA=1: quem segura a memória (amostragem do heap por função)
  if (amostrar) { await send('HeapProfiler.enable'); await send('HeapProfiler.startSampling', { samplingInterval: 65536, includeObjectsCollectedByMajorGC: false, includeObjectsCollectedByMinorGC: false }); }
  await send('Page.navigate', { url: BASE + v });
  const t0 = Date.now(); let ok = false;
  while (Date.now() - t0 < 180000) { await sleep(1000); ok = await ev('!!(window.game?.player && (window.loadTimes||[]).length >= 12)'); if (ok) break; }
  await sleep(15000); // detalhes de rua montam aos poucos depois que o jogo abre
  const mem = await ev('(async () => { for (let i = 0; i < 3; i++) { gc(); await new Promise(r => setTimeout(r, 300)); } return Math.round(performance.memory.usedJSHeapSize / 1e6); })()');
  const lt = await ev('(window.loadTimes||[]).reduce((a, b) => a + b[1], 0)');
  const hu = (await send('Runtime.getHeapUsage')).result; if (hu) console.log('heap de JS', Math.round(hu.usedSize / 1e6), 'MB · total', Math.round(hu.totalSize / 1e6), 'MB · buffers (ArrayBuffer)', Math.round((hu.backingStorageSize || 0) / 1e6), 'MB · embutido', Math.round((hu.embedderHeapUsedSize || 0) / 1e6), 'MB');
  console.log(JSON.stringify({ variante: v || '(padrão)', abriu: ok, carregamento_ms: lt, heap_MB: mem }));
  if (process.env.EXTRA) console.log(JSON.stringify(await ev(process.env.EXTRA), null, 1));
  if (amostrar) {
    const prof = (await send('HeapProfiler.getSamplingProfile')).result.profile;
    const by = new Map();
    const walk = (n, stack) => {
      const f = n.callFrame, here = f.url ? `${f.functionName || '(anônima)'} ${f.url.replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${f.lineNumber + 1}` : null;
      const st = here ? [...stack, here] : stack;
      if (n.selfSize) { const own = st.filter((s) => s.includes('src/')).pop() || st[st.length - 1] || '(nativo)'; by.set(own, (by.get(own) || 0) + n.selfSize); }
      for (const c of n.children || []) walk(c, st);
    };
    walk(prof.head, []);
    const top = [...by].sort((a, b) => b[1] - a[1]).slice(0, 25);
    for (const [k, b] of top) console.log(String(Math.round(b / 1e6)).padStart(6) + ' MB  ' + k);
  }
  ws.close();
} finally {
  chrome.kill(); await sleep(800); rmSync(dir, { recursive: true, force: true });
}
}
for (const v of variants) await medir(v);
