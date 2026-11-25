// GPS no estilo Waze / Google Maps: o jogador busca um destino (lugares, bairros), a rota sai pelo grafo de ruas
// (de carro respeita mão única; a pé usa calçada e ruas de pedestre), setas azuis aparecem no chão mostrando o
// caminho, um painel em cima diz a próxima manobra e a rota aparece no minimapa. Saiu da rota, recalcula.
import * as THREE from 'three';
import { heightAt } from './terrain.js';

const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmt = (m) => (m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.max(10, Math.round(m / 10) * 10) + ' m');

// fila de prioridade (heap binário) para o A*
class Heap {
  constructor() { this.a = []; }
  push(n, f) { const a = this.a; a.push([f, n]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top[1]; }
  get size() { return this.a.length; }
}

export class GPS {
  constructor({ scene, world, traffic, hud, player }) {
    Object.assign(this, { scene, world, traffic, hud, player });
    this.dest = null; this.route = null; this.idx = 0; this.recalc = 0;
    // destinos: lugares com nome (sem repetir) e bairros
    const seen = new Set();
    this.places = [];
    const add = (name, x, z, kind) => { const k = norm(name); if (!name || seen.has(k)) return; seen.add(k); this.places.push({ name, x, z, kind, k }); };
    for (const p of hud.labels || []) add(p.name, p.x, p.z, 'destaque');
    for (const b of world.data.bairros) add(b.name, b.x, b.z, 'bairro');
    for (const p of world.data.pois) if (p.name && p.name.length > 2) add(p.name, p.x, p.z, p.kind);
    this.buildUI();
    // setas no chão: chevrons azuis com borda branca (instanciados)
    const sh = new THREE.Shape(); sh.moveTo(0, 1.1); sh.lineTo(1.1, -0.2); sh.lineTo(0.6, -0.6); sh.lineTo(0, 0.1); sh.lineTo(-0.6, -0.6); sh.lineTo(-1.1, -0.2); sh.closePath();
    const geo = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2);
    const out = new THREE.ShapeGeometry(sh).scale(1.25, 1.25, 1).rotateX(-Math.PI / 2);
    const MAX = 60;
    this.arrows = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#1a73e8', transparent: true, opacity: 0.95, depthWrite: false }), MAX);
    this.border = new THREE.InstancedMesh(out, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }), MAX);
    for (const m of [this.border, this.arrows]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 5; scene.add(m); }
    this.arrows.renderOrder = 6;
    this.tmp = new THREE.Object3D();
  }

  // ---------------------------------------------------------------- interface
  buildUI() {
    const css = document.createElement('style');
    css.textContent = `
#gps{position:fixed;left:50%;top:70px;transform:translateX(-50%);width:min(420px,92vw);background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.45);z-index:40;font-family:Inter,system-ui,sans-serif;color:#1d1d1f;overflow:hidden}
#gps.hidden,#gps-nav.hidden{display:none}
#gps .gps-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#1a73e8;color:#fff;font-weight:800}
#gps .gps-head span{flex:1}
#gps .gps-head button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}
#gps input{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid #e5e5ea;padding:14px 16px;font-size:16px;outline:none}
#gps ul{list-style:none;margin:0;padding:0;max-height:46vh;overflow:auto}
#gps li{padding:10px 16px;cursor:pointer;display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #f2f2f5}
#gps li.on,#gps li:hover{background:#e8f0fe}
#gps li small{color:#6e6e73;white-space:nowrap}
#gps .gps-foot{padding:9px 16px;font-size:12px;color:#6e6e73;background:#f7f7f9}
#gps-nav{position:fixed;left:50%;top:14px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;background:#1a73e8;color:#fff;border-radius:14px;padding:10px 16px;box-shadow:0 6px 22px rgba(0,0,0,.35);z-index:30;font-family:Inter,system-ui,sans-serif;min-width:260px;max-width:92vw}
#gps-nav .ico{font-size:34px;line-height:1;width:40px;text-align:center}
#gps-nav .d{font-size:22px;font-weight:900}
#gps-nav .s{font-size:14px;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:56vw}
#gps-btn{position:fixed;left:50%;bottom:72px;transform:translateX(calc(-100% - 5px));z-index:25;background:#1a73e8;color:#fff;border:0;border-radius:999px;padding:10px 18px;font:700 14px Inter,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;max-width:80vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gps-btn.hidden{display:none}
#gps-arrive{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:41;background:#fff;color:#1d1d1f;border-radius:16px;box-shadow:0 10px 36px rgba(0,0,0,.4);padding:16px 18px;font-family:Inter,system-ui,sans-serif;text-align:center;width:min(380px,92vw);animation:gpsin .35s ease-out}
#gps-arrive.hidden{display:none}
#gps-arrive .t{font-size:20px;font-weight:900}#gps-arrive .s{font-size:14px;color:#55555a;margin:4px 0 12px}
#gps-arrive button{font:700 14px Inter,sans-serif;border:0;border-radius:999px;padding:9px 16px;margin:0 4px;cursor:pointer}
#gps-arrive .go{background:#1a73e8;color:#fff}#gps-arrive .no{background:#eef0f3;color:#333}
@keyframes gpsin{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}
body.touch #gps-btn{bottom:auto;top:calc(env(safe-area-inset-top) + 64px)}
@media (max-width:700px){#gps-btn{max-width:46vw}}
#gps-nav .eta{margin-left:auto;font-size:12px;text-align:right;opacity:.9;white-space:nowrap}`;
    document.head.appendChild(css);
    const el = (this.el = document.createElement('div'));
    el.id = 'gps'; el.className = 'hidden';
    el.innerHTML = `<div class="gps-head">🧭 <span>Pra onde, boy?</span><button title="Fechar">✕</button></div>
<input placeholder="Busque um lugar ou bairro (ex.: Marco Zero, RioMar, Casa Forte)" autocomplete="off" spellcheck="false">
<ul></ul><div class="gps-foot"><b>Enter</b> escolhe · <b>↑↓</b> navega · <b>N</b>/<b>Esc</b> fecha · <b>Shift+N</b> cancela a rota</div>`;
    document.body.appendChild(el);
    this.input = el.querySelector('input'); this.list = el.querySelector('ul');
    el.querySelector('button').onclick = () => this.close();
    this.input.addEventListener('input', () => { this.sel = 0; this.idle = 0; this.renderList(); });
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // o jogo não pode andar enquanto digita
      this.idle = 0;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowDown') { this.sel = Math.min(this.sel + 1, this.hits.length - 1); this.renderList(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this.sel = Math.max(this.sel - 1, 0); this.renderList(); e.preventDefault(); }
      else if (e.key === 'Enter' && this.hits[this.sel]) this.pick(this.hits[this.sel]);
    });
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
    const nav = (this.nav = document.createElement('div'));
    nav.id = 'gps-nav'; nav.className = 'hidden';
    nav.innerHTML = '<div class="ico">⬆️</div><div><div class="d"></div><div class="s"></div></div><div class="eta"></div>';
    document.body.appendChild(nav);
    // botão que fica embaixo quando o painel recolhe: abre de novo pra escolher ou trocar o destino
    const btn = (this.btn = document.createElement('button'));
    btn.id = 'gps-btn'; btn.className = 'hidden';
    btn.onclick = () => { document.exitPointerLock?.(); this.open(); };
    document.body.appendChild(btn);
    // aviso de chegada: reconhece que chegou e oferece escolher outro destino
    const arr = (this.arrEl = document.createElement('div'));
    arr.id = 'gps-arrive'; arr.className = 'hidden';
    arr.innerHTML = '<div class="t"></div><div class="s">Quer ir pra outro canto?</div><button class="go">🧭 Escolher novo destino</button><button class="no">Agora não</button>';
    document.body.appendChild(arr);
    arr.querySelector('.go').onclick = () => { arr.classList.add('hidden'); document.exitPointerLock?.(); this.open(); };
    arr.querySelector('.no').onclick = () => { arr.classList.add('hidden'); this.onClose?.(); };
  }
  arrived(name) {
    const a = this.arrEl; a.querySelector('.t').textContent = `📍 Chegou em ${name}!`;
    a.querySelector('.s').textContent = pickOne(['É o ouro, visse! Quer ir pra outro canto?', 'Chegou, boy! Bora pra outro lugar?', 'Destino na mão. Partiu outro rolê?']);
    a.classList.remove('hidden'); document.exitPointerLock?.();
    clearTimeout(this.arrT); this.arrT = setTimeout(() => a.classList.add('hidden'), 15000);
  }
  // atualiza o texto do botão do GPS
  refreshBtn() {
    const t = this.dest ? `🧭 ${this.dest.name} · trocar destino` : '🧭 Pra onde, boy? Toca aqui pro GPS';
    if (t !== this.btnText) { this.btn.textContent = t; this.btnText = t; }
    this.btn.classList.toggle('hidden', this.isOpen);
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.arrEl?.classList.add('hidden'); this.idle = 0; this.el.classList.remove('hidden'); this.btn.classList.add('hidden'); this.input.value = ''; this.sel = 0; this.renderList(); setTimeout(() => this.input.focus(), 0); }
  close() { this.el.classList.add('hidden'); this.input.blur(); this.refreshBtn(); this.onClose?.(); }
  // 10 s sem digitar nada: o painel some e vira o botão lá embaixo
  collapse() { this.el.classList.add('hidden'); this.input.blur(); this.refreshBtn(); }
  renderList() {
    const raw = this.input.value.trim(), q = norm(raw), px = this.player.pos.x, pz = this.player.pos.z;
    let hits;
    if (!q) hits = this.places.filter((p) => p.kind === 'destaque').sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
    else {
      const words = q.split(/\s+/);
      hits = this.places.filter((p) => words.every((w) => p.k.includes(w)))
        .map((p) => ({ p, s: (p.k.startsWith(q) ? 0 : 1) + (p.kind === 'destaque' ? 0 : p.kind === 'bairro' ? 0.3 : 0.6) + Math.hypot(p.x - px, p.z - pz) / 40000 }))
        .sort((a, b) => a.s - b.s).map((o) => o.p);
    }
    // endereços de verdade (rua e número) vindos da busca do OpenStreetMap entram por cima
    const web = q && this.web?.q === q ? this.web.items : [];
    this.hits = [...web, ...hits].slice(0, 12);
    const busy = q.length >= 4 && this.web?.q !== q;
    this.list.innerHTML = this.hits.map((p, i) => `<li class="${i === this.sel ? 'on' : ''}" data-i="${i}"><span>${p.kind === 'endereço' ? '📍 ' : ''}${p.name}</span><small>${p.kind === 'bairro' ? 'bairro · ' : ''}${fmt(Math.hypot(p.x - px, p.z - pz))}</small></li>`).join('')
      + (busy ? '<li class="wait"><span>🌐 Procurando o endereço no mapa…</span></li>' : '') + (!this.hits.length && !busy ? '<li><span>Nada achado, visse? Tenta rua e número, ou outro nome.</span></li>' : '');
    this.list.querySelectorAll('li[data-i]').forEach((li) => (li.onclick = () => this.pick(this.hits[+li.dataset.i])));
    if (busy) { clearTimeout(this.webT); this.webT = setTimeout(() => this.geocode(raw, q), 650); }
  }
  // geocodificação: Nominatim (OpenStreetMap), só dentro do retângulo do mapa; no máximo 1 busca por segundo
  async geocode(raw, q) {
    if (norm(this.input.value.trim()) !== q) return;
    const wait = 1100 - (performance.now() - (this.lastWeb || 0)); if (wait > 0) { this.webT = setTimeout(() => this.geocode(raw, q), wait); return; }
    this.lastWeb = performance.now();
    const M = this.world.data.meta, bb = M.bbox;
    const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
      q: /recife/i.test(raw) ? raw : raw + ', Recife', format: 'jsonv2', limit: '6', bounded: '1', countrycodes: 'br', 'accept-language': 'pt-BR',
      viewbox: `${bb.w},${bb.n},${bb.e},${bb.s}`,
    });
    let items = [];
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) items = (await res.json()).map((r) => {
        const parts = r.display_name.split(',').map((s) => s.trim()).filter((s) => !/^(Recife|Pernambuco|Brasil|Região .*|Microrregião.*|Região Metropolitana.*|\d{5}-\d{3})$/.test(s));
        return { name: parts.slice(0, 3).join(', '), x: (Number(r.lon) - M.lon0) * M.mLon, z: -(Number(r.lat) - M.lat0) * M.mLat, kind: 'endereço' };
      });
    } catch { /* sem internet: fica só a busca local */ }
    this.web = { q, items };
    if (this.isOpen && norm(this.input.value.trim()) === q) this.renderList();
  }
  pick(p) { this.close(); this.setDest(p.x, p.z, p.name); }

  // ---------------------------------------------------------------- rota
  setDest(x, z, name = 'Destino') {
    this.dest = { x, z, name };
    this.route = null; this.recalc = 0; this.mode = null; this.refreshBtn();
    this.hud.flash(`🧭 Rota pra ${name}. Segue as setas azuis, visse!`);
  }
  clear(msg) {
    this.dest = null; this.btnText = null; setTimeout(() => this.refreshBtn(), 0); this.route = null; this.hud.gpsRoute = null; this.arrows.count = this.border.count = 0;
    this.nav.classList.add('hidden');
    if (msg) this.hud.flash(msg);
  }
  graph() { return this.player.vehicle ? this.traffic.drive : this.traffic.foot; }
  // componente conexo (sem olhar a mão) de cada nó; o maior é a malha principal da cidade
  comps(g) {
    if (g.comp) return g.comp;
    const comp = new Int32Array(g.nodes.size).fill(-1), byId = []; for (const n of g.nodes.values()) byId[n.id] = n;
    const size = []; let c = 0;
    for (const n0 of byId) {
      if (comp[n0.id] >= 0) continue;
      let cnt = 0; const st = [n0]; comp[n0.id] = c;
      while (st.length) { const n = st.pop(); cnt++; for (const i of n.out) { const m = g.edges[i].b; if (comp[m.id] < 0) { comp[m.id] = c; st.push(m); } } for (const i of n.in) { const m = g.edges[i].a; if (comp[m.id] < 0) { comp[m.id] = c; st.push(m); } } }
      size.push(cnt); c++;
    }
    g.comp = comp; g.main = size.indexOf(Math.max(...size));
    return comp;
  }
  // aresta mais perto que está na malha principal
  nearestMain(g, x, z) {
    const comp = this.comps(g), C = 100;
    let best = null, bd = Infinity;
    for (let ring = 0; ring < 25; ring++) {
      const cx = Math.floor(x / C), cz = Math.floor(z / C);
      for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        for (const e of g.cells.get(cx + i + ',' + (cz + j)) || []) {
          if (comp[e.a.id] !== g.main) continue;
          const t = Math.max(0, Math.min(e.len, (x - e.a.x) * e.dx + (z - e.a.z) * e.dz)), d = Math.hypot(e.a.x + e.dx * t - x, e.a.z + e.dz * t - z);
          if (d < bd) { bd = d; best = { e, t, d }; }
        }
      }
      if (best && bd < (ring - 1) * C) return best;
    }
    return best;
  }
  plan() {
    const g = this.graph(), px = this.player.pos.x, pz = this.player.pos.z;
    const s = this.nearestMain(g, px, pz), t = this.nearestMain(g, this.dest.x, this.dest.z);
    if (!s || !t) return null;
    // A* até os nós da aresta do destino; contramão só como último recurso (custo 5x)
    const goal = new Set([t.e.a.id, t.e.b.id]), gx = this.dest.x, gz = this.dest.z;
    const dist = new Map(), prev = new Map(), heap = new Heap(), done = new Set();
    for (const [n, d] of [[s.e.b, s.e.len - s.t], [s.e.a, s.t * (this.player.vehicle ? 5 : 1)]]) { if (d < (dist.get(n.id) ?? Infinity)) { dist.set(n.id, d); prev.set(n.id, null); heap.push(n, d + Math.hypot(n.x - gx, n.z - gz)); } }
    let end = null, it = 0;
    const relax = (n, m, cost, name) => { const nd = dist.get(n.id) + cost; if (nd < (dist.get(m.id) ?? Infinity)) { dist.set(m.id, nd); prev.set(m.id, [n, name]); heap.push(m, nd + Math.hypot(m.x - gx, m.z - gz)); } };
    while (heap.size && it++ < 500000) {
      const n = heap.pop(); if (done.has(n.id)) continue; done.add(n.id);
      if (goal.has(n.id)) { end = n; break; }
      for (const i of n.out) { const e = g.edges[i]; relax(n, e.b, e.len, e.name); }
      for (const i of n.in) { const e = g.edges[i]; if (!e.b.out.some((j) => g.edges[j].b === n)) relax(n, e.a, e.len * 5, e.name); }
    }
    if (!end) return null;
    const chain = [];
    for (let n = end; prev.get(n.id); n = prev.get(n.id)[0]) chain.unshift({ x: n.x, z: n.z, n: prev.get(n.id)[1] });
    let first = end; while (prev.get(first.id)) first = prev.get(first.id)[0];
    // polilinha: jogador → ponto na rua → nós → ponto do destino na rua → destino; cada ponto leva o nome da rua
    const pts = [{ x: px, z: pz, n: s.e.name }, { x: s.e.a.x + s.e.dx * s.t, z: s.e.a.z + s.e.dz * s.t, n: s.e.name }, { x: first.x, z: first.z, n: s.e.name }, ...chain];
    pts.push({ x: t.e.a.x + t.e.dx * t.t, z: t.e.a.z + t.e.dz * t.t, n: t.e.name }, { x: gx, z: gz, n: null });
    const P = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.5);
    let acc = 0; P.forEach((p, i) => { if (i) acc += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z); p.d = acc; });
    return P;
  }

  update(dt) {
    if (this.isOpen && !this.input.value.trim() && (this.idle += dt) > 10) this.collapse();
    if (!this.started) { this.started = true; this.refreshBtn(); } // o botão aparece quando o jogo começa
    if (!this.dest) return;
    const px = this.player.pos.x, pz = this.player.pos.z;
    const left = Math.hypot(this.dest.x - px, this.dest.z - pz);
    // chegou: no ponto, ou no fim da rota na rua (o centro de bairro do OSM às vezes cai num terreno sem rua, longe)
    const end = this.route && this.route.length > 1 ? this.route[this.route.length - 2] : null;
    if (left < 18 || (end && Math.hypot(end.x - px, end.z - pz) < 15)) { const n = this.dest.name; this.clear(`📍 Chegou em ${n}!`); this.arrived(n); return; }
    const mode = this.player.vehicle ? 'carro' : 'pe';
    this.recalc -= dt;
    // posição na rota (procura perto do último trecho)
    let off = Infinity;
    if (this.route) {
      const R = this.route; let best = this.idx;
      for (let i = Math.max(0, this.idx - 2); i < Math.min(R.length - 1, this.idx + 40); i++) {
        const a = R[i], b = R[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / l2)), d = Math.hypot(a.x + dx * t - px, a.z + dz * t - pz);
        if (d < off) { off = d; best = i; this.along = a.d + Math.sqrt(l2) * t; }
      }
      this.idx = best;
    }
    if ((!this.route || off > 28 || mode !== this.mode) && this.recalc <= 0) {
      const again = !!this.route && mode === this.mode;
      this.route = this.plan(); this.idx = 0; this.along = 0; this.mode = mode; this.recalc = 2;
      if (!this.route) { this.hud.flash('🧭 Não achei caminho daqui, tenta de outro canto.'); this.recalc = 4; return; }
      if (again) this.hud.flash('🧭 Recalculando a rota…');
    }
    if (!this.route) return;
    this.hud.gpsRoute = this.route; this.hud.gpsDest = this.dest;
    this.placeArrows();
    this.instruction(left);
  }

  // setas a cada 7 m nos próximos ~200 m
  placeArrows() {
    const R = this.route, o = this.tmp; let n = 0;
    const start = this.along + 6, end = this.along + 210;
    for (let d = Math.ceil(start / 7) * 7; d < end && n < this.arrows.instanceMatrix.count; d += 7) {
      let i = this.idx; while (i < R.length - 2 && R[i + 1].d < d) i++;
      const a = R[i], b = R[i + 1]; if (!b || d > R.at(-1).d) break;
      const L = b.d - a.d || 1, t = (d - a.d) / L, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      o.position.set(x, heightAt(x, z) + 0.14, z); o.rotation.set(0, Math.atan2(-(b.x - a.x), -(b.z - a.z)), 0); o.scale.setScalar(1.15);
      o.updateMatrix(); this.arrows.setMatrixAt(n, o.matrix);
      o.position.y -= 0.01; o.updateMatrix(); this.border.setMatrixAt(n, o.matrix);
      n++;
    }
    this.arrows.count = this.border.count = n;
    this.arrows.instanceMatrix.needsUpdate = this.border.instanceMatrix.needsUpdate = true;
  }

  // próxima manobra: primeira curva de mais de 35° depois da posição atual
  instruction(left) {
    const R = this.route, dir = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
    let turn = null;
    for (let i = this.idx + 1; i < R.length - 2; i++) {
      if (R[i].d < this.along + 3) continue;
      // direção que chega (últimos ~12 m) e que sai (próximos ~12 m)
      let j = i; while (j > 0 && R[i].d - R[j].d < 12) j--;
      let k = i; while (k < R.length - 1 && R[k].d - R[i].d < 12) k++;
      let a = dir(R[j], R[i]) - dir(R[i], R[k]); a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) > 0.6) { turn = { i, a, d: R[i].d - this.along, name: R[i + 1].n }; break; }
    }
    const nav = this.nav, set = (ico, d, s) => {
      const html = `<div class="ico">${ico}</div><div><div class="d">${d}</div><div class="s">${s}</div></div><div class="eta">${this.dest.name}<br>${fmt(R.at(-1).d - this.along)} · ${this.player.vehicle ? Math.max(1, Math.round((R.at(-1).d - this.along) / 9 / 60)) + ' min' : Math.max(1, Math.round((R.at(-1).d - this.along) / 1.6 / 60)) + ' min a pé'}</div>`;
      if (html !== this.navHtml) { nav.innerHTML = html; this.navHtml = html; }
    };
    nav.classList.remove('hidden');
    if (!turn) { set('🏁', fmt(left), `Segue em frente até ${this.dest.name}`); return; }
    // a > 0: a direção girou no sentido de +x para +z… no mapa (z cresce pro sul) isso é virar à direita
    const right = turn.a > 0, sharp = Math.abs(turn.a) > 2.2;
    const icoNice = sharp ? '↩️' : right ? '➡️' : '⬅️';
    const verb = sharp ? 'Faz o retorno' : right ? 'Vira à direita' : 'Vira à esquerda';
    set(icoNice, fmt(turn.d), turn.name ? `${verb} na ${turn.name}` : verb);
  }
}
