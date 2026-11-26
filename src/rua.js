// Detalhe de rua: meio-fio, calçada (pedra portuguesa, cimentado, ladrilho e cerâmica), faixas de pedestre
// nos cruzamentos e térreo comercial (toldo, letreiro e mesinhas na calçada).
// Tudo em blocos de 400 m que somem com a distância, para não pesar a cena.
import * as THREE from 'three';
import { TBN_GLSL } from './photos.js';
import { releaseOnUpload } from './textures.js';
import { inHills } from './terrain.js';

export const CURB_H = 0.15; // altura do meio-fio e da calçada
let walkMat = null; // material da calçada (buildSidewalks), reaproveitado na calçada colada na fachada
// faixas de calçada coladas em fachada que encosta na pista, por célula de 40 m (para groundY)
const strips = new Map();
const platforms = new Map(); // estações do corredor de ônibus (buildBusCorridor), para curbHeight
// pisos elevados de praça (ex.: o piso cor-de-rosa e a Rosa dos Ventos do Marco Zero, 7,5 e 10 cm acima do chão):
// quem anda sobe neles, senão o pé afunda no piso. pisoElevado({ p: [[x, z]…] } | { x, z, r }, altura)
const pisos = [];
export function pisoElevado(forma, h) {
  const p = forma.p, b = p ? p.reduce((a, [x, z]) => [Math.min(a[0], x), Math.min(a[1], z), Math.max(a[2], x), Math.max(a[3], z)], [Infinity, Infinity, -Infinity, -Infinity]) : [forma.x - forma.r, forma.z - forma.r, forma.x + forma.r, forma.z + forma.r];
  pisos.push({ ...forma, h, b });
}
function pisoAt(x, z) {
  let h = 0;
  for (const P of pisos) {
    if (x < P.b[0] || x > P.b[2] || z < P.b[1] || z > P.b[3] || P.h <= h) continue;
    if (P.p) { let c = false; const q = P.p; for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i][1] > z) !== (q[j][1] > z) && x < ((q[j][0] - q[i][0]) * (z - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c; if (c) h = P.h; }
    else if ((x - P.x) ** 2 + (z - P.z) ** 2 <= P.r * P.r) h = P.h;
  }
  return h;
}
const CURB_W = 0.22;
// largura da calçada (m) por tipo de via; via de serviço, acesso e ponte não ganham
const SIDEWALK = { trunk: 3.6, primary: 3.4, secondary: 3.0, tertiary: 2.6, unclassified: 2.2, residential: 2.2, living_street: 1.8 };
const RANK = { trunk: 8, primary: 7, secondary: 6, tertiary: 5, unclassified: 4, residential: 4, living_street: 3 };
const CH = 400;

// trabalho em fatias de ~8 ms, devolvendo a vez ao jogo entre elas (monta depois que o jogo abre)
export const busy = { ms: 0 };
function slicer() {
  let t = performance.now();
  return async () => {
    const now = performance.now();
    if (now - t < 8) return;
    busy.ms += now - t;
    await new Promise((r) => setTimeout(r, 0));
    t = performance.now();
  };
}

function dropArray() { this.array = null; }

// ---------------------------------------------------------------- acumulador de malha (posição, normal, uv, cor)
// Arrays tipados que crescem (dobrando), em vez de arrays JS de números: na montagem da rua do município inteiro
// os arrays JS chegavam a ~400 MB de pico.
const grow = (a, need) => { if (need <= a.length) return a; const b = new a.constructor(Math.max(need, a.length * 2)); b.set(a); return b; };
// ?semquantrua: rua sem compactar (Float32), para comparar
const QUANT_RUA = typeof location === 'undefined' || !new URLSearchParams(location.search).has('semquantrua');
class Mesh {
  constructor() { this.p = new Float32Array(192); this.n = new Float32Array(192); this.u = new Float32Array(128); this.c = new Uint8Array(192); this.i = new Uint32Array(192); this.nv = 0; this.ni = 0; }
  v(x, y, z, nx, ny, nz, u, w, r = 255, g = 255, b = 255) {
    const k = this.nv, k3 = k * 3, k2 = k * 2;
    if (k3 + 3 > this.p.length) { this.p = grow(this.p, k3 + 3); this.n = grow(this.n, k3 + 3); this.c = grow(this.c, k3 + 3); this.u = grow(this.u, k2 + 2); }
    this.p[k3] = x; this.p[k3 + 1] = y; this.p[k3 + 2] = z;
    this.n[k3] = nx; this.n[k3 + 1] = ny; this.n[k3 + 2] = nz;
    this.u[k2] = u; this.u[k2 + 1] = w;
    this.c[k3] = r; this.c[k3 + 1] = g; this.c[k3 + 2] = b;
    return this.nv++;
  }
  t(a, b, c) { if (this.ni + 3 > this.i.length) this.i = grow(this.i, this.ni + 3); this.i[this.ni++] = a; this.i[this.ni++] = b; this.i[this.ni++] = c; }
  q(a, b, c, d) { this.t(a, b, c); this.t(a, c, d); }
  // Devolve { g, c, sc }: com QUANT_RUA, posição em Int16 relativa à caixa da malha (o Mesh leva centro c e escala sc),
  // normal em Int8 (guardada como S·n: o normalMatrix desfaz a escala), uv em Uint16 quando cabe em 0..1, cor em Uint8.
  // Quase toda a rua do município nunca chega perto da câmera, então o array fica no JS: ~20 em vez de 35 bytes por vértice.
  geo() {
    const n = this.nv, P = this.p, N = this.n, U = this.u, g = new THREE.BufferGeometry();
    let c = [0, 0, 0], sc = [1, 1, 1];
    if (QUANT_RUA) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let i = 0; i < n * 3; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]; sc = [Math.max(0.5, (x1 - x0) / 2), Math.max(0.5, (y1 - y0) / 2), Math.max(0.5, (z1 - z0) / 2)];
      const q = new Int16Array(n * 3), qn = new Int8Array(n * 3);
      for (let i = 0; i < n * 3; i += 3) {
        for (let k = 0; k < 3; k++) q[i + k] = Math.round(((P[i + k] - c[k]) / sc[k]) * 32767);
        const a = N[i] * sc[0], b = N[i + 1] * sc[1], d = N[i + 2] * sc[2], l = Math.hypot(a, b, d) || 1;
        qn[i] = Math.round((a / l) * 127); qn[i + 1] = Math.round((b / l) * 127); qn[i + 2] = Math.round((d / l) * 127);
      }
      g.setAttribute('position', new THREE.BufferAttribute(q, 3, true));
      g.setAttribute('normal', new THREE.BufferAttribute(qn, 3, true));
      let unit = true; for (let i = 0; i < n * 2; i++) { const v = U[i]; if (!(v >= 0 && v <= 1)) { unit = false; break; } }
      if (unit) { const qu = new Uint16Array(n * 2); for (let i = 0; i < n * 2; i++) qu[i] = Math.round(U[i] * 65535); g.setAttribute('uv', new THREE.BufferAttribute(qu, 2, true)); }
      else g.setAttribute('uv', new THREE.BufferAttribute(U.slice(0, n * 2), 2));
    } else {
      g.setAttribute('position', new THREE.BufferAttribute(P.slice(0, n * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N.slice(0, n * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(U.slice(0, n * 2), 2));
    }
    g.setAttribute('color', new THREE.BufferAttribute(this.c.slice(0, n * 3), 3, true));
    g.setIndex(new THREE.BufferAttribute(n < 65536 ? Uint16Array.from(this.i.subarray(0, this.ni)) : this.i.slice(0, this.ni), 1));
    g.computeBoundingSphere();
    // depois de ir para a placa de vídeo, os vértices não são mais usados no JS
    for (const at of [...Object.values(g.attributes), g.index]) at.onUpload(dropArray);
    this.p = this.n = this.u = this.c = this.i = null; // o acumulador não é mais usado
    return { g, c, sc };
  }
  // caixa alinhada a uma direção (ux, uz) no chão: largura w ao longo de u, profundidade d ao longo da frente
  box(cx, cz, ux, uz, w, d, y0, y1, uvF, uvO, col, back = true) {
    const nx = -uz, nz = ux; // frente: u × y (mesma convenção das paredes de buildBuildings)
    const hw = w / 2, hd = d / 2;
    const P = (a, b, y) => [cx + ux * a + nx * b, y, cz + uz * a + nz * b];
    const face = (pts, n, uv) => {
      const k = this.nv;
      pts.forEach((pt, i) => this.v(pt[0], pt[1], pt[2], n[0], n[1], n[2], uv[i][0], uv[i][1], ...col));
      this.q(k, k + 1, k + 2, k + 3);
    };
    const corners = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const O = corners(...uvO), F = uvF ? corners(...uvF) : O;
    face([P(-hw, hd, y0), P(hw, hd, y0), P(hw, hd, y1), P(-hw, hd, y1)], [nx, 0, nz], F); // frente
    if (back) face([P(hw, -hd, y0), P(-hw, -hd, y0), P(-hw, -hd, y1), P(hw, -hd, y1)], [-nx, 0, -nz], O);
    face([P(-hw, -hd, y0), P(-hw, hd, y0), P(-hw, hd, y1), P(-hw, -hd, y1)], [-ux, 0, -uz], O);
    face([P(hw, hd, y0), P(hw, -hd, y0), P(hw, -hd, y1), P(hw, hd, y1)], [ux, 0, uz], O);
    face([P(-hw, hd, y1), P(hw, hd, y1), P(hw, -hd, y1), P(-hw, -hd, y1)], [0, 1, 0], O);
  }
}

// Acumulador que joga fora (contagem de vértices certa, nada guardado): o desenho que cai em outro bloco
class Sink { constructor() { this.nv = 0; } v() { return this.nv++; } t() {} q() {} }
Sink.prototype.box = Mesh.prototype.box;

// Blocos de 400 m montados só perto da câmera. Na primeira passada (rec) cada gerador roda inteiro, faz os efeitos
// de uma vez só (semáforos, calçadas coladas, contadores) e só anota quais objetos desenham em cada bloco, sem guardar
// vértice. Para montar um bloco, roda de novo só os objetos dele; o que eles desenham em outro bloco vai para o Sink.
// Os sorteios da rua vêm da posição (hashf), então o bloco sai sempre igual.
function lazyChunks(kinds) {
  const chunks = new Map(), sink = Object.fromEntries(kinds.map((k) => [k, new Sink()]));
  let rec = true, cur = null, target = 0, accs = null;
  return {
    chunks,
    get rec() { return rec; },
    item(o) { cur = o; },
    at(x, z) {
      const kx = Math.floor(x / CH), kz = Math.floor(z / CH), key = kx * 65536 + kz;
      if (rec) {
        let c = chunks.get(key);
        if (!c) chunks.set(key, (c = { cx: (kx + 0.5) * CH, cz: (kz + 0.5) * CH, objs: [], meshes: null }));
        if (c.objs[c.objs.length - 1] !== cur) c.objs.push(cur);
        if (RUA_CHECK) return (c.full ||= Object.fromEntries(kinds.map((k) => [k, new Mesh()])));
        return sink;
      }
      return key === target ? accs : sink;
    },
    // gerador pronto: body(objeto) desenha um objeto; mats, distância de corte e sombra por tipo de malha
    done(body, group, mats, cull, shadow = {}) {
      rec = false;
      // montagem em três partes, para o gerenciador poder fatiar entre quadros: begin, run (um objeto), finish
      const begin = (key) => { target = key; accs = Object.fromEntries(kinds.map((k) => [k, new Mesh()])); };
      const abort = () => { accs = null; };
      const finish = (c) => {
        c.meshes = [];
        for (const k of kinds) {
          if (!accs[k].nv) continue;
          const { g, c: o, sc } = accs[k].geo(), m = new THREE.Mesh(g, mats[k]);
          m.position.set(o[0], o[1], o[2]); m.scale.set(sc[0], sc[1], sc[2]);
          m.receiveShadow = true; m.castShadow = !!shadow[k];
          m.matrixAutoUpdate = false; m.updateMatrix();
          group.add(m); c.meshes.push(m);
        }
        accs = null;
      };
      const make = (key, c) => { begin(key); for (const o of c.objs) body(o); finish(c); };
      const drop = (c) => { for (const m of c.meshes) { group.remove(m); m.geometry.dispose(); } c.meshes = null; };
      if (RUA_CHECK) {
        const R = (window.ruaCheck ||= { blocos: 0, iguais: 0, diferentes: [] });
        for (const [key, c] of chunks) {
          target = key; accs = Object.fromEntries(kinds.map((k) => [k, new Mesh()]));
          for (const o of c.objs) body(o);
          for (const k of kinds) {
            R.blocos++;
            const a = c.full[k], b = accs[k];
            if (a.nv === b.nv && a.ni === b.ni && accHash(a) === accHash(b)) R.iguais++;
            else if (R.diferentes.length < 20) R.diferentes.push([k, c.cx, c.cz, a.nv, b.nv]);
          }
          c.full = null; accs = null;
        }
      }
      return { chunks, cull, make, drop, kinds, begin, run: body, finish, abort };
    },
  };
}

// Monta os blocos de rua que chegam a menos do corte (+150 m), os mais perto primeiro, e solta os que passam do
// corte + 500 m. A montagem é fatiada: um bloco de cada vez, alguns objetos por quadro, até ~4 ms por quadro
// (bloco de lojas no centro leva dezenas de ms inteiro). ?ruatoda monta tudo de uma vez (para comparar).
const RUA_TODA = typeof location !== 'undefined' && new URLSearchParams(location.search).has('ruatoda');
// ?ruacheck: na primeira passada guarda também o desenho de cada bloco do jeito antigo (tudo numa passada só) e,
// depois, confere bloco a bloco se remontar dá exatamente os mesmos vértices (window.ruaCheck)
const RUA_CHECK = typeof location !== 'undefined' && new URLSearchParams(location.search).has('ruacheck');
const accHash = (m) => { let h = 2166136261; for (const a of [m.p.subarray(0, m.nv * 3), m.n.subarray(0, m.nv * 3), m.u.subarray(0, m.nv * 2), m.c.subarray(0, m.nv * 3), m.i.subarray(0, m.ni)]) { const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619); } return h >>> 0; };
export function streetLazy() {
  const gens = [], stats = { montados: 0, soltos: 0, quadroMax: 0 };
  let job = null; // { g, key, c, i }
  const BUDGET = 4;
  if (typeof window !== 'undefined') { window.ruaBlocos = stats; if (location.search.includes('ruatempos')) stats.quadros = []; } // ms por quadro
  const show = (g, c, cam) => { const dx = c.cx - cam.x, dz = c.cz - cam.z, v = dx * dx + dz * dz < g.cull * g.cull; for (const m of c.meshes) m.visible = v; };
  return {
    add(g) {
      gens.push(g);
      if (RUA_TODA) for (const [key, c] of g.chunks) g.make(key, c);
    },
    update(cam) {
      const t0 = performance.now();
      let best = null, bd = Infinity;
      for (const g of gens) {
        const c2 = g.cull * g.cull, near2 = (g.cull + 150) ** 2, far2 = (g.cull + 500) ** 2;
        for (const [key, c] of g.chunks) {
          const dx = c.cx - cam.x, dz = c.cz - cam.z, d2 = dx * dx + dz * dz;
          if (c.meshes) {
            if (d2 > far2 && !RUA_TODA) { g.drop(c); stats.soltos++; continue; }
            const v = d2 < c2; for (const m of c.meshes) m.visible = v;
          } else if (d2 < near2 && d2 < bd && (!job || job.c !== c)) { bd = d2; best = { g, key, c }; }
        }
      }
      // bloco em montagem que ficou longe (teletransporte): desiste
      if (job) { const dx = job.c.cx - cam.x, dz = job.c.cz - cam.z; if (dx * dx + dz * dz > (job.g.cull + 500) ** 2) { job.g.abort(); job = null; } }
      while (performance.now() - t0 < BUDGET) {
        if (!job) { if (!best) break; job = { ...best, i: 0 }; best = null; job.g.begin(job.key); }
        const { g, c } = job, objs = c.objs;
        while (job.i < objs.length && performance.now() - t0 < BUDGET) g.run(objs[job.i++]);
        if (job.i < objs.length) break;
        g.finish(c); show(g, c, cam); stats.montados++; job = null;
      }
      const ms = performance.now() - t0;
      if (ms > stats.quadroMax) stats.quadroMax = Math.round(ms * 10) / 10;
      if (stats.quadros && ms > 0.5) stats.quadros.push(Math.round(ms * 10) / 10);
    },
  };
}

// ---------------------------------------------------------------- índice das pistas (trecho mais perto de um ponto)
export function roadIndex(roads) {
  // células de 20 m; cada trecho entra nas células por onde passa (amostrado a cada 5 m).
  // Busca nas 3 × 3 vizinhas: vale para distâncias até ~15 m.
  const G = 20, cells = new Map();
  const segs = [];
  for (const r of roads) {
    if (r.tu || !RANK[r.k.replace('_link', '')]) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1], s = segs.length;
      segs.push([a, b, r]);
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
      let last = NaN;
      for (let k = 0; k <= n; k++) {
        const key = Math.floor((a[0] + (b[0] - a[0]) * k / n) / G) * 100003 + Math.floor((a[1] + (b[1] - a[1]) * k / n) / G);
        if (key === last) continue;
        last = key;
        let l = cells.get(key); if (!l) cells.set(key, (l = []));
        if (l[l.length - 1] !== s) l.push(s);
      }
    }
  }
  return (x, z, maxD = 15) => {
    let best = null, bd = maxD;
    const cx = Math.floor(x / G), cz = Math.floor(z / G);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of cells.get((cx + i) * 100003 + cz + j) || []) {
      const [a, b, r] = segs[s];
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
      const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
      if (d < bd) { bd = d; best = { r, d, ux: dx / Math.sqrt(l2), uz: dz / Math.sqrt(l2) }; }
    }
    return best;
  };
}

// altura da calçada num ponto (0 na pista, fora dela ou no morro): para o boneco subir no meio-fio
export function curbHeight(nearRoad, isDrive, roadW) {
  return (x, z) => {
    const ph = pisos.length ? pisoAt(x, z) : 0; if (ph) return ph;
    // plataforma das estações do corredor: quem anda sobe nela (0,35 m)
    for (const pl of platforms.get(Math.floor(x / 40) * 100003 + Math.floor(z / 40)) || []) {
      const rx = x - pl.x, rz = z - pl.z, a = rx * pl.dx + rz * pl.dz, o = -rx * pl.dz + rz * pl.dx;
      if (Math.abs(a) <= pl.len / 2 && Math.abs(o) <= pl.w / 2) return 0.35;
    }
    for (const st of strips.get(Math.floor(x / 40) * 100003 + Math.floor(z / 40)) || []) {
      const rx = x - st.x, rz = z - st.z, a = rx * st.ux + rz * st.uz, o = rx * st.nx + rz * st.nz;
      if (a >= 0 && a <= st.len && o >= -0.1 && o <= st.w) return CURB_H;
    }
    if (isDrive(x, z) || inHills(x, z)) return 0;
    const n = nearRoad(x, z, 9);
    if (!n || n.r.b || n.r.cobble) return 0;
    const sw = SIDEWALK[n.r.k]; if (!sw) return 0;
    const hw = (roadW[n.r.k] || 7) / 2;
    return n.d >= hw && n.d <= hw + CURB_W + sw ? CURB_H : 0;
  };
}

// ---------------------------------------------------------------- textura da pedra portuguesa (2 m × 2 m)
function stoneTexture() {
  const N = 512, C = 40, cs = N / C;
  const fx = new Float32Array(C * C), fz = new Float32Array(C * C), tone = new Float32Array(C * C);
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < C * C; i++) { fx[i] = 0.15 + rnd() * 0.7; fz[i] = 0.15 + rnd() * 0.7; const k = rnd(); tone[i] = k < 0.07 ? 0.5 + rnd() * 0.12 : 0.88 + rnd() * 0.12; }
  const col = document.createElement('canvas'); col.width = col.height = N;
  const nor = document.createElement('canvas'); nor.width = nor.height = N;
  const ci = col.getContext('2d').createImageData(N, N), ni = nor.getContext('2d').createImageData(N, N);
  const hgt = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gx = Math.floor(x / cs), gy = Math.floor(y / cs);
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = (gx + i + C) % C, cy = (gy + j + C) % C, c = cy * C + cx;
      const px = (gx + i + fx[c]) * cs, py = (gy + j + fz[c]) * cs;
      const ex = px - x - 0.5, ey = py - y - 0.5, d = ex * ex + ey * ey;
      if (d < d1) { d2 = d1; d1 = d; id = c; } else if (d < d2) d2 = d;
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1); // distância até a junta
    const h = Math.min(1, Math.max(0, (edge - 0.8) / 3.2));
    hgt[y * N + x] = Math.sqrt(h);
    const t = h > 0 ? tone[id] * (0.9 + 0.1 * h) : 0.62;
    const i4 = (y * N + x) * 4;
    ci.data[i4] = t * 238; ci.data[i4 + 1] = t * 232; ci.data[i4 + 2] = t * 219; ci.data[i4 + 3] = 255;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const hx = hgt[y * N + ((x + 1) % N)] - hgt[y * N + ((x + N - 1) % N)];
    const hy = hgt[((y + 1) % N) * N + x] - hgt[((y + N - 1) % N) * N + x];
    const nx = -hx * 2.2, ny = hy * 2.2, l = Math.hypot(nx, ny, 1), i4 = (y * N + x) * 4;
    ni.data[i4] = (nx / l * 0.5 + 0.5) * 255; ni.data[i4 + 1] = (ny / l * 0.5 + 0.5) * 255; ni.data[i4 + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[i4 + 3] = 255;
  }
  col.getContext('2d').putImageData(ci, 0, 0); nor.getContext('2d').putImageData(ni, 0, 0);
  const mk = (c, srgb) => { const t = releaseOnUpload(new THREE.CanvasTexture(c)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: mk(col, true), normal: mk(nor, false) };
}

// Calçada: uv.x = tipo (1 pedra portuguesa, 2 meio-fio, 3 cada lote com o seu piso) + semente na fração;
// uv.y = metros ao longo da rua (para trocar o piso de lote em lote). A textura vem do mundo (xz).
function sidewalkMaterial(ph, stone) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { sPv: { value: ph.pave.map }, sPvN: { value: ph.pave.normal }, sPvA: { value: ph.pave.avg }, sSt: { value: stone.map }, sStN: { value: stone.normal } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec2 vSW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vSW = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D sPv, sPvN, sSt, sStN; uniform vec3 sPvA; varying vec3 vWP; varying vec2 vSW;
${TBN_GLSL}
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }`)
      .replace('#include <map_fragment>', `
  float kind = floor(vSW.x + 0.001), seed = fract(vSW.x);
  // na face do meio-fio (vertical) a altura entra na coordenada, senão a textura vira risco
  vec2 wuv = vWP.xz + vWP.y * 3.0;
  vec3 pv = texture2D(sPv, wuv / 3.0).rgb / max(dot(sPvA, vec3(0.333)), 0.01);
  float pl = dot(pv, vec3(0.333));
  vec3 st = texture2D(sSt, vWP.xz / 2.0).rgb;
  float tileMode = 0.0; // 0 cimentado, 1 pedra, 2 ladrilho vermelho, 3 cerâmica bege, 4 meio-fio
  if (kind > 2.5) {
    float lot = floor(vSW.y / 9.0 + seed * 37.0), hh = h11(lot + seed * 91.0);
    tileMode = hh < 0.3 ? 2.0 : hh < 0.62 ? 0.0 : hh < 0.82 ? 3.0 : 1.0;
  } else tileMode = kind > 1.5 ? 4.0 : kind;
  vec3 c;
  if (tileMode < 0.5) c = vec3(0.58, 0.56, 0.52) * mix(vec3(pl), pv, 0.35);
  else if (tileMode < 1.5) c = st * vec3(0.78, 0.76, 0.72);
  else if (tileMode < 3.5) {
    float sz = tileMode < 2.5 ? 0.25 : 0.4;
    vec2 g = vWP.xz / sz, f = fract(g); vec2 id = floor(g);
    float grout = step(f.x, 0.06) + step(f.y, 0.06);
    float var = 0.85 + 0.25 * h11(id.x * 17.0 + id.y * 131.0);
    vec3 base = tileMode < 2.5 ? vec3(0.42, 0.13, 0.08) : vec3(0.62, 0.52, 0.4);
    c = mix(base * var * mix(1.0, pl, 0.4), vec3(0.3, 0.29, 0.27), clamp(grout, 0.0, 1.0));
  } else c = vec3(0.72, 0.71, 0.68) * mix(1.0, pl, 0.6);
  diffuseColor.rgb = c * vColor;`)
      .replace('#include <color_fragment>', '')
      .replace('#include <normal_fragment_maps>', `{
    vec2 nuv = tileMode > 0.5 && tileMode < 1.5 ? vWP.xz / 2.0 : wuv / 3.0;
    vec3 nn = tileMode > 0.5 && tileMode < 1.5 ? nrm(sStN, nuv) : nrm(sPvN, nuv);
    if (abs(normal.y) < 0.5 || tileMode > 1.5) nn.xy *= 0.35;
    normal = normalize(fTBN(-vViewPosition, normal, nuv) * nn);
  }`);
  };
  return m;
}

// ---------------------------------------------------------------- meio-fio e calçada
export async function buildSidewalks(group, roads, { isDrive, isWater, roadW, photos }) {
  const yieldNow = slicer();
  const ck = lazyChunks(['walk']);
  const stone = stoneTexture();
  let segsOut = 0;
  const STEP = 2.0;
  const body = (r) => {
    const sw0 = SIDEWALK[r.k];
    if (!sw0 || r.tu || r.b || r.p.length < 2 || r.cobble) return;
    if (r.p.some((q) => inHills(q[0], q[1]))) return;
    const w = roadW[r.k] || 7, hw = w / 2;
    // pontos: os do OSM mais um a cada 2 m (só para testar; vértice só sai onde precisa)
    const P = [];
    for (let i = 0; i < r.p.length; i++) {
      const a = r.p[i];
      P.push({ x: a[0], z: a[1], o: true, i });
      if (i < r.p.length - 1) {
        const b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(L / STEP);
        for (let k = 1; k < n; k++) { const t = k / n; P.push({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, o: false, i }); }
      }
    }
    // normal com meia-esquadria nos vértices do OSM; nos pontos de meio, a do trecho
    let s = 0;
    for (let k = 0; k < P.length; k++) {
      const p = P[k];
      if (k) s += Math.hypot(p.x - P[k - 1].x, p.z - P[k - 1].z);
      p.s = s;
      const ia = p.o ? Math.max(0, p.i - 1) : p.i, ib = p.o ? Math.min(r.p.length - 1, p.i + 1) : p.i + 1;
      const a = r.p[ia], b = r.p[ib];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      p.nx = -tz; p.nz = tx; p.sc = 1;
      if (p.o && p.i > 0 && p.i < r.p.length - 1) {
        const q = r.p[p.i - 1], sx = p.x - q[0], sz = p.z - q[1], sl = Math.hypot(sx, sz) || 1;
        p.sc = 1 / Math.max(0.5, p.nx * (-sz / sl) + p.nz * (sx / sl));
      }
    }
    const seed = (Math.abs(Math.sin(P[0].x * 12.9898 + P[0].z * 78.233)) * 43758.5453) % 1;
    const central = RANK[r.k] >= 6;
    for (const side of [1, -1]) {
      // calçada existe se o meio dela não cai em outra pista nem na água
      const ok = P.map((p) => {
        const ex = p.x + p.nx * side * (hw + 1.3) * p.sc, ez = p.z + p.nz * side * (hw + 1.3) * p.sc;
        if (isDrive(ex, ez) || isWater(ex, ez)) return 0;
        const fx = p.x + p.nx * side * (hw + sw0 - 0.3) * p.sc, fz = p.z + p.nz * side * (hw + sw0 - 0.3) * p.sc;
        return isDrive(fx, fz) || isWater(fx, fz) ? 1 : 2; // 1 = estreita (canteiro entre pistas)
      });
      const type = (central ? 1 : 3) + (side > 0 ? seed : (seed + 0.5) % 1) * 0.98;
      const emit = (pts) => {
        const acc = ck.at(pts[0].x, pts[0].z).walk;
        let prev = null;
        for (const p of pts) {
          const wid = p.ok === 1 ? 1.1 : sw0;
          const off = (d) => [p.x + p.nx * side * d * p.sc, p.z + p.nz * side * d * p.sc];
          const [ax, az] = off(hw), [bx, bz] = off(hw + CURB_W), [cx, cz] = off(hw + CURB_W + wid);
          const fnx = -p.nx * side, fnz = -p.nz * side; // face do meio-fio olha para a pista
          const k = acc.nv;
          acc.v(ax, 0.0, az, fnx, 0, fnz, 2.0, p.s); // face: embaixo
          acc.v(ax, CURB_H, az, fnx, 0, fnz, 2.0, p.s); // face: em cima
          acc.v(ax, CURB_H, az, 0, 1, 0, 2.0, p.s);
          acc.v(bx, CURB_H, bz, 0, 1, 0, 2.0, p.s);
          acc.v(bx, CURB_H, bz, 0, 1, 0, type, p.s);
          acc.v(cx, CURB_H, cz, 0, 1, 0, type, p.s);
          if (prev !== null) {
            // ordem dos vértices conforme o lado, para a face apontar para fora
            if (side > 0) { acc.q(prev, prev + 1, k + 1, k); acc.q(prev + 2, prev + 3, k + 3, k + 2); acc.q(prev + 4, prev + 5, k + 5, k + 4); }
            else { acc.q(prev, k, k + 1, prev + 1); acc.q(prev + 2, k + 2, k + 3, prev + 3); acc.q(prev + 4, k + 4, k + 5, prev + 5); }
            if (ck.rec) segsOut++;
          }
          prev = k;
        }
      };
      let run = null;
      const flush = () => { if (run && run.length >= 2) emit(run); run = null; };
      for (let k = 0; k < P.length; k++) {
        const p = P[k], st = ok[k];
        if (!st) { flush(); continue; }
        const changed = run && run.at(-1).ok !== st;
        const keep = p.o || !run || changed || k === P.length - 1 || !ok[k + 1] || ok[k + 1] !== st;
        if (!run) run = [];
        if (keep) { p.ok = st; run.push(p); }
      }
      flush();
    }
  };
  for (const r of roads) { await yieldNow(); ck.item(r); body(r); }
  walkMat = sidewalkMaterial(photos, stone);
  return { lazy: ck.done(body, group, { walk: walkMat }, 1100), segs: segsOut };
}

// ---------------------------------------------------------------- faixas de pedestre
export async function buildCrosswalks(group, roads, { isDrive, roadW, photos }) {
  const yieldNow = slicer();
  const ck = lazyChunks(['zebra']);
  // nós compartilhados pelas pistas (coordenadas iguais no OSM)
  const nodes = new Map();
  const key = (p) => Math.round(p[0] * 10) * 1048576 + Math.round(p[1] * 10); // número, não texto: bem mais rápido
  for (const r of roads) {
    if (r.tu || r.b || !RANK[r.k.replace('_link', '')] || r.p.length < 2) continue;
    r.p.forEach((p, i) => {
      const k = key(p); let n = nodes.get(k);
      if (!n) nodes.set(k, (n = { x: p[0], z: p[1], arms: [] }));
      if (i > 0) n.arms.push({ r, dir: -1, i });
      if (i < r.p.length - 1) n.arms.push({ r, dir: 1, i });
    });
  }
  let count = 0;
  const signals = [], corners = [];
  const body = (n) => {
    if (new Set(n.arms.map((a) => a.r)).size < 2) return;
    const top = Math.max(...n.arms.map((a) => RANK[a.r.k.replace('_link', '')] || 0));
    if (top < 5) return; // só onde chega uma rua de verdade (terciária para cima)
    const maxW = Math.max(...n.arms.map((a) => roadW[a.r.k] || 7));
    if (ck.rec) corners.push(n);
    for (const a of n.arms) {
      const w = roadW[a.r.k] || 7;
      if (w < 6 || a.r.k.endsWith('_link')) continue;
      // anda pela pista a partir do cruzamento
      const pts = a.r.p, j = a.i + a.dir;
      let tx = pts[j][0] - pts[a.i][0], tz = pts[j][1] - pts[a.i][1];
      const L = Math.hypot(tx, tz); if (L < 1) continue;
      tx /= L; tz /= L;
      const nx = -tz, nz = tx;
      for (let d = maxW / 2 + 1.8; d < Math.min(L - 1.5, maxW / 2 + 9); d += 1.5) {
        const cx = n.x + tx * d, cz = n.z + tz * d;
        // a faixa liga duas calçadas: as pontas não podem cair em outra pista
        const e1 = isDrive(cx + nx * (w / 2 + 1.4), cz + nz * (w / 2 + 1.4)), e2 = isDrive(cx - nx * (w / 2 + 1.4), cz - nz * (w / 2 + 1.4));
        if (e1 || e2) continue;
        const acc = ck.at(cx, cz).zebra;
        const y = 0.04 + (RANK[a.r.k] || 1) * 0.003 + 0.012;
        const across = w - 0.6, len = 3.0;
        for (let o = -across / 2 + 0.25; o <= across / 2 - 0.25; o += 0.9) {
          const sx = cx + nx * o, sz = cz + nz * o;
          const P = (u, v) => [sx + nx * u + tx * v, sz + nz * u + tz * v];
          const c0 = P(-0.25, -len / 2), c1 = P(0.25, -len / 2), c2 = P(0.25, len / 2), c3 = P(-0.25, len / 2);
          const k = acc.nv;
          for (const c of [c0, c1, c2, c3]) acc.v(c[0], y, c[1], 0, 1, 0, 0, 0);
          // anti-horária vista de cima
          const cross = (c1[0] - c0[0]) * (c2[1] - c0[1]) - (c1[1] - c0[1]) * (c2[0] - c0[0]);
          if (cross < 0) acc.q(k, k + 1, k + 2, k + 3); else acc.q(k, k + 3, k + 2, k + 1);
        }
        if (ck.rec) count++;
        // semáforo (avenida): antes da faixa para quem chega, do lado direito
        if (top >= 6 && ck.rec) signals.push({ x: cx + tx * (len / 2 + 0.9) - nx * (w / 2 + 0.55), z: cz + tz * (len / 2 + 0.9) - nz * (w / 2 + 0.55), tx, tz, w, axis: Math.abs(tx) > Math.abs(tz) ? 0 : 1, sx: cx + tx * (len / 2 + 0.6), sz: cz + tz * (len / 2 + 0.6) });
        break;
      }
    }
  };
  for (const n of nodes.values()) { if (n.arms.length < 3) continue; await yieldNow(); ck.item(n); body(n); }
  nodes.clear(); // os cruzamentos que desenham ficam nos blocos (e em corners); o resto pode ir embora
  // tinta branca gasta: a foto do asfalto aparece por baixo onde o pneu passa
  const m = new THREE.MeshStandardMaterial({ color: '#e4e2da', roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.zA = { value: photos.asphalt.map };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D zA; varying vec3 vWP;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  { float wr = dot(texture2D(zA, vWP.xz / 5.0).rgb, vec3(0.333)); float wr2 = dot(texture2D(zA, vWP.xz / 1.3).rgb, vec3(0.333));
    diffuseColor.rgb *= mix(0.55, 1.05, smoothstep(0.12, 0.5, wr * 0.6 + wr2 * 0.6)); }`);
  };
  return { lazy: ck.done(body, group, { zebra: m }, 700), count, signals, corners };
}

// ---------------------------------------------------------------- térreo comercial
const TYPES = [
  // [nome, come-e-bebe (mesinha na calçada)]
  ['Mercadinho', 0], ['Padaria', 1], ['Lanchonete', 1], ['Bar', 1], ['Farmácia', 0], ['Armarinho', 0], ['Ótica', 0], ['Salão', 0],
  ['Açougue', 0], ['Papelaria', 0], ['Sapataria', 0], ['Pastelaria', 1], ['Tapiocaria', 1], ['Restaurante', 1], ['Bazar', 0], ['Espetinho', 1],
  ['Açaí', 1], ['Material de Construção', 0], ['Conserto de Celular', 0], ['Loja de Variedades', 0], ['Cuscuzeria', 1], ['Bodega', 1], ['Peixaria', 0], ['Barbearia', 0],
];
const NAMES = ['do Galego', 'da Neide', 'Boa Vista', 'Capibaribe', 'do Povo', 'São João', 'da Esquina', 'Frevo', 'Maracatu', 'Avenida', 'Recife', 'Nordeste',
  'Pernambuco', 'Bom Jesus', 'do Sertão', 'Mangue', 'Três Irmãos', 'Santa Luzia', 'Sol Nascente', 'Primavera', 'Estrela', 'Aurora', 'Popular', 'Central',
  'do Seu Zé', 'da Tia Lu', 'Arretado', 'Massa', 'Beberibe', 'Ciranda', 'Caboclinho', 'Ponte Velha'];
const SLOGANS = ['Aberto todo dia', 'Preço bom é aqui', 'Desde 1987', 'Entregamos em casa', 'Volte sempre', 'Promoção hoje', 'Atendimento de primeira'];
const FOOD_SLOGANS = ['Tem cuscuz', 'Cafezinho na hora', 'Caldinho todo dia', 'Tem tapioca', 'Aberto todo dia', 'Desde 1987'];
const SIGN_BG = ['#c8102e', '#1d5fa8', '#2a9d58', '#e76f2a', '#7b2d8b', '#0b6e75', '#b5651d', '#2b2b2b', '#f2b705', '#f4f1ea', '#e63946', '#14532d'];
const AWN = [['#c8102e', '#f4f1ea'], ['#1d5fa8', '#f4f1ea'], ['#2a9d58', '#f4f1ea'], ['#f2b705', '#e76f2a'], ['#7b2d8b', '#f4f1ea'], ['#0b6e75', '#f2e3a0'], ['#c8102e', '#c8102e'], ['#1d5fa8', '#1d5fa8']];
const PLASTIC = [[214, 38, 38], [242, 183, 5], [245, 245, 240], [29, 95, 168], [214, 38, 38], [242, 183, 5]];

function shopAtlas() {
  // 2048 × 1024: 8 × 14 letreiros (256 × 64) e, embaixo, 8 toldos listrados + uma célula branca
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const g = c.getContext('2d');
  const signs = [];
  let s = 99; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 112; i++) {
    const col = i % 8, row = Math.floor(i / 8), x = col * 256, y = row * 64;
    const t = TYPES[i % TYPES.length], name = t[0] + ' ' + NAMES[Math.floor(rnd() * NAMES.length)];
    const bg = SIGN_BG[Math.floor(rnd() * SIGN_BG.length)], light = bg === '#f4f1ea' || bg === '#f2b705';
    const fg = light ? '#1a1a1a' : rnd() < 0.3 ? '#ffd166' : '#ffffff';
    g.fillStyle = bg; g.fillRect(x, y, 256, 64);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + 58, 256, 6);
    g.strokeStyle = fg; g.globalAlpha = 0.45; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, 248, 52); g.globalAlpha = 1;
    let size = 30; g.font = `900 ${size}px Inter, Arial, sans-serif`;
    while (g.measureText(name).width > 236 && size > 12) { size--; g.font = `900 ${size}px Inter, Arial, sans-serif`; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const sl = rnd() < 0.6;
    g.fillText(name, x + 128, y + (sl ? 25 : 31));
    if (sl) { g.font = '600 12px Inter, Arial, sans-serif'; g.globalAlpha = 0.85; const SL = t[1] ? FOOD_SLOGANS : SLOGANS; g.fillText(SL[Math.floor(rnd() * SL.length)], x + 128, y + 48); g.globalAlpha = 1; }
    signs.push({ u0: x / 2048, v0: 1 - (y + 64) / 1024, u1: (x + 256) / 2048, v1: 1 - y / 1024, food: t[1] });
  }
  const awn = [];
  AWN.forEach(([a, b], i) => {
    const x = i * 256, y = 896;
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? b : a; g.fillRect(x + k * 32, y, 32, 64); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + 56, 256, 8);
    awn.push({ u0: x / 2048, v0: 1 - (y + 64) / 1024, u1: (x + 256) / 2048, v1: 1 - y / 1024 });
  });
  g.fillStyle = '#ffffff'; g.fillRect(0, 960, 256, 64);
  const white = [8 / 2048, 1 - 1016 / 1024, 248 / 2048, 1 - 968 / 1024];
  // grade de sacada (fundo transparente): corrimão, travessa de baixo e balaústres
  g.fillStyle = '#2a2c2e';
  g.fillRect(256, 960, 256, 7); g.fillRect(256, 1015, 256, 6);
  for (let x = 256; x < 512; x += 16) g.fillRect(x + 6, 960, 4, 64);
  const rail = [256 / 2048, 1 - 1022 / 1024, 512 / 2048, 1 - 960 / 1024];
  const t = releaseOnUpload(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, signs, awn, white, rail };
}

const hashf = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

// fachadas candidatas vêm de buildBuildings: { p, q, nx, nz, len, nWin, kind, h, b }
export async function buildShopfronts(group, fronts, { isDrive, isSolid, nearRoad, roadW, pois }) {
  const yieldNow = slicer();
  const ck = lazyChunks(['shop', 'sign', 'relief', 'strip']);
  const A = shopAtlas();
  const W = A.white;
  const PROB = { trunk: 0.75, primary: 0.85, secondary: 0.8, tertiary: 0.6, unclassified: 0.25, residential: 0.12, living_street: 0.25 };
  // lugares com placa própria (places.js) ficam de fora
  const poiCells = new Map();
  for (const p of pois) { const k = Math.floor(p.x / 30) * 100003 + Math.floor(p.z / 30); let l = poiCells.get(k); if (!l) poiCells.set(k, (l = [])); l.push(p); }
  const nearPoi = (x, z) => { const cx = Math.floor(x / 30), cz = Math.floor(z / 30); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of poiCells.get((cx + i) * 100003 + cz + j) || []) if (Math.hypot(p.x - x, p.z - z) < 14) return true; return false; };
  let shops = 0, tables = 0, reliefs = 0, nStrips = 0;
  const spots = [], bal = []; // amostras para depuração (window.__lojas, window.__sacadas)
  const poiChecked = new Map();
  const body = (f) => {
    const mx = (f.p[0] + f.q[0]) / 2, mz = (f.p[1] + f.q[1]) / 2, dHit = f.dHit;
    if (isSolid(mx + f.nx * 1.7, mz + f.nz * 1.7)) return;
    const near = nearRoad(mx + f.nx * dHit, mz + f.nz * dHit, 8);
    if (!near) return;
    if (Math.abs(near.ux * f.nx + near.uz * f.nz) > 0.45) return; // fachada de lado para a rua
    const k = near.r.k.replace('_link', '');
    let shop = !f.b.placa && hashf(mx * 0.37, mz * 1.13) <= (PROB[k] ?? 0); // places.js já pôs placa e toldo em b.placa
    if (shop) {
      let poi = poiChecked.get(f.b);
      if (poi === undefined) { poi = nearPoi(f.b.cx, f.b.cz); poiChecked.set(f.b, poi); }
      if (poi) shop = false;
    }
    // relevo da fachada nas avenidas (secundária para cima) e em toda loja
    if (RANK[k] >= 6 || shop) { relief(ck.at(mx, mz).relief, f, shop || f.b.placa, W, A.rail); if (ck.rec) reliefs++; }
    // calçada colada na fachada quando o prédio do OSM encosta na pista (ou entra nela): 1,6 m com meio-fio
    // (rua de pedra, como a do Bom Jesus e as do Poço da Panela, é calçada de parede a parede: sem faixa)
    const wallD = nearRoad(mx, mz, 15);
    if (wallD && walkMat && !wallD.r.cobble && (RANK[k] >= 5 || shop) && wallD.d < (roadW[wallD.r.k] || 7) / 2 + 0.6) { stripAlong(ck.at(mx, mz).strip, f, RANK[k] >= 6 ? 1 : 3 + hashf(mx, mz) * 0.98, ck.rec); if (ck.rec) nStrips++; }
    if (ck.rec && f.kind === 'colonial' && (f.variant | 0) === 1 && f.floors > 1 && bal.length < 200) bal.push([mx, mz, f.nx, f.nz, near.r.n || near.r.k]);
    if (!shop) return;
    if (ck.rec && spots.length < 4000) spots.push([mx, mz, f.nx, f.nz, near.r.n || near.r.k]);
    const acc = ck.at(mx, mz);
    const ux = (f.q[0] - f.p[0]) / f.len, uz = (f.q[1] - f.p[1]) / f.len;
    const bw = f.len / f.nWin;
    const yA = f.kind === 'colonial' ? 3.2 : 2.75; // altura do toldo junto da parede
    let bay = 0;
    while (bay < f.nWin) {
      const r = hashf(mx + bay * 3.1, mz - bay * 1.7);
      const nb = Math.min(f.nWin - bay, r < 0.55 || bw > 5 ? 1 : 2);
      const s0 = bay * bw, s1 = (bay + nb) * bw, sw = s1 - s0;
      bay += nb;
      if (sw < 2.5) continue;
      const sc = (s0 + s1) / 2, cx = f.p[0] + ux * sc, cz = f.p[1] + uz * sc;
      const sign = A.signs[Math.floor(hashf(cx * 1.7, cz * 0.3) * A.signs.length)];
      const ww = sw - 0.35;
      // letreiro: caixa rasa com a face da frente impressa
      const sh = f.kind === 'colonial' ? 0.75 : 0.62;
      const sy0 = yA + 0.12, sy1 = sy0 + sh;
      if (sy1 < f.h - 0.2) {
        acc.sign.box(cx + f.nx * 0.09, cz + f.nz * 0.09, ux, uz, ww, 0.16, sy0, sy1, [sign.u0, sign.v0, sign.u1, sign.v1], W, [255, 255, 255]);
        if (ck.rec) shops++;
      }
      // toldo inclinado + bandô na frente (nem toda loja tem)
      if (r > 0.18) {
        const aw = A.awn[Math.floor(hashf(cx * 0.9, cz * 2.3) * A.awn.length)];
        const depth = 1.15 + (r * 7 % 1) * 0.45, drop = 0.5;
        const a = acc.shop;
        const L = (o, d, y) => [cx + ux * o + f.nx * d, y, cz + uz * o + f.nz * d];
        const hwid = ww / 2;
        const p0 = L(-hwid, 0.02, yA), p1 = L(hwid, 0.02, yA), p2 = L(hwid, depth, yA - drop), p3 = L(-hwid, depth, yA - drop);
        // normal do plano inclinado
        const ny = depth / Math.hypot(depth, drop), nh = drop / Math.hypot(depth, drop);
        let b0 = a.nv;
        a.v(...p0, f.nx * nh, ny, f.nz * nh, aw.u0, aw.v1); a.v(...p1, f.nx * nh, ny, f.nz * nh, aw.u1, aw.v1);
        a.v(...p2, f.nx * nh, ny, f.nz * nh, aw.u1, aw.v0 + 0.01); a.v(...p3, f.nx * nh, ny, f.nz * nh, aw.u0, aw.v0 + 0.01);
        a.q(b0, b0 + 3, b0 + 2, b0 + 1); a.q(b0, b0 + 1, b0 + 2, b0 + 3); // dos dois lados
        // bandô
        const q0 = L(-hwid, depth, yA - drop), q1 = L(hwid, depth, yA - drop), q2 = L(hwid, depth, yA - drop - 0.28), q3 = L(-hwid, depth, yA - drop - 0.28);
        b0 = a.nv;
        a.v(...q0, f.nx, 0, f.nz, aw.u0, aw.v1); a.v(...q1, f.nx, 0, f.nz, aw.u1, aw.v1); a.v(...q2, f.nx, 0, f.nz, aw.u1, aw.v0); a.v(...q3, f.nx, 0, f.nz, aw.u0, aw.v0);
        a.q(b0, b0 + 3, b0 + 2, b0 + 1); a.q(b0, b0 + 1, b0 + 2, b0 + 3);
        // laterais (triângulos)
        for (const sgn of [-1, 1]) {
          const t0 = L(sgn * hwid, 0.02, yA), t1 = L(sgn * hwid, depth, yA - drop), t2 = L(sgn * hwid, depth, yA - drop - 0.28);
          b0 = a.nv;
          a.v(...t0, ux * sgn, 0, uz * sgn, aw.u0, aw.v1); a.v(...t1, ux * sgn, 0, uz * sgn, aw.u0 + 0.01, aw.v1); a.v(...t2, ux * sgn, 0, uz * sgn, aw.u0 + 0.01, aw.v0);
          a.t(b0, b0 + 1, b0 + 2); a.t(b0, b0 + 2, b0 + 1);
        }
      }
      // mesinhas de plástico na calçada (bar, lanchonete, padaria...)
      if (sign.food && sw >= 3 && (PROB[k] >= 0.6 || r > 0.6)) {
        const n = sw >= 6 && r > 0.5 ? 2 : 1;
        for (let t = 0; t < n; t++) {
          const o = n === 1 ? 0 : (t - 0.5) * sw * 0.5, dd = 1.9;
          const tx = cx + ux * o + f.nx * dd, tz = cz + uz * o + f.nz * dd;
          if (isDrive(tx, tz) || isDrive(tx + f.nx * 1.0, tz + f.nz * 1.0) || isSolid(tx, tz)) continue;
          const nr = nearRoad(tx, tz, 12), on = nr && nr.d - (roadW[nr.r.k] || 7) / 2 < CURB_W + (SIDEWALK[nr.r.k.replace('_link', '')] || 0);
          const y = on ? CURB_H : 0; // em cima da calçada ou no chão
          table(acc.shop, tx, tz, ux, uz, y, PLASTIC[Math.floor(hashf(tx, tz) * PLASTIC.length)], W, hashf(tz, tx) < 0.35);
          if (ck.rec) tables++;
        }
      }
    }
  };
  for (const f of fronts) { await yieldNow(); ck.item(f); body(f); }
  const sm = new THREE.MeshStandardMaterial({ map: A.tex, vertexColors: true, roughness: 0.7 });
  const gm = new THREE.MeshStandardMaterial({ map: A.tex, emissiveMap: A.tex, emissive: '#ffffff', emissiveIntensity: 0.04, roughness: 0.45 });
  const rm = new THREE.MeshStandardMaterial({ map: A.tex, vertexColors: true, roughness: 0.85, alphaTest: 0.5 });
  const lazy = ck.done(body, group, { shop: sm, sign: gm, relief: rm, strip: walkMat }, 650, { shop: true, sign: true, relief: true });
  window.__lojas = spots; window.__sacadas = bal;
  return { lazy, shops, tables, reliefs, strips: nStrips, setNight(n) { gm.emissiveIntensity = 0.04 + n * 0.75; } };
}

// mesa de plástico com quatro cadeiras (e, às vezes, guarda-sol)
function table(a, x, z, ux, uz, y, col, W, umbrella) {
  const U = [W[0], W[1], W[2], W[3]], dark = col.map((v) => v * 0.82);
  a.box(x, z, ux, uz, 0.78, 0.78, y + 0.68, y + 0.72, U, U, col); // tampo
  a.box(x, z, ux, uz, 0.12, 0.12, y, y + 0.68, U, U, dark); // pé
  const nx = -uz, nz = ux;
  for (const [dx, dz] of [[ux, uz], [-ux, -uz], [nx, nz], [-nx, -nz]]) {
    const cx = x + dx * 0.62, cz = z + dz * 0.62;
    a.box(cx, cz, dz, -dx, 0.42, 0.4, y, y + 0.46, U, U, col); // assento e pernas num bloco só
    a.box(cx + dx * 0.21, cz + dz * 0.21, dz, -dx, 0.44, 0.04, y + 0.46, y + 0.9, U, U, col); // encosto do lado de fora
  }
  if (umbrella) {
    a.box(x, z, ux, uz, 0.05, 0.05, y + 0.72, y + 2.3, U, U, [230, 230, 225]);
    const k = a.nv, R = 1.25, top = y + 2.45, rim = y + 2.05;
    a.v(x, top, z, 0, 1, 0, U[0], U[1], ...col);
    for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; a.v(x + Math.cos(t) * R, rim, z + Math.sin(t) * R, Math.cos(t) * 0.3, 0.95, Math.sin(t) * 0.3, U[0], U[1], ...(i % 2 ? [245, 245, 240] : col)); }
    for (let i = 0; i < 8; i++) { const b = k + 1 + i, c = k + 1 + ((i + 1) % 8); a.t(k, c, b); a.t(k, b, c); }
  }
}

// ---------------------------------------------------------------- relevo da fachada
// Peças coladas na parede, alinhadas com o que o atlas pinta em cada variante (textures.js, DESIGNS):
// peitoril embaixo das janelas, cornija entre andares e platibanda no topo (sobrado), sacada com grade
// (porta-balcão do sobrado e varandinha da casa), laje saliente e ar-condicionado de janela (prédio moderno)
// e marquise de concreto sobre o térreo quando não há loja. Medidas do atlas: vão de 4 m, andar de 3,6 m
// (sobrado) ou 3 m; aqui reescaladas para o vão e o andar reais da parede.
const TRIM = [236, 230, 216], CONCRETE = [205, 202, 194], IRON = [40, 42, 44], AC = [226, 226, 220];
const WIN = {
  // [x0, x1, y do peitoril] por variante (andar de cima), em metros do atlas
  colonial: [[[1.1, 2.9, 0.54]], null, [[1.1, 2.9, 0.54]], [[1.1, 2.9, 0.66]]],
  modern: [[[0.05, 3.95, 0.92]], [[0.45, 1.75, 0.97], [2.25, 3.55, 0.97]], [[0.95, 3.05, 0.97]], null],
  casa: [[[0.75, 2.45, 0.97]], [[0.45, 1.55, 1.17], [2.45, 3.35, 1.47]], null, [[1.55, 2.45, 1.77]]],
};
function relief(a, f, shop, W, R) {
  const U = [W[0], W[1], W[2], W[3]];
  const FH = f.kind === 'colonial' ? 3.6 : 3.0, fh = f.h / f.floors, sy = fh / FH;
  const bw = f.len / f.nWin, sx = bw / 4;
  const ux = (f.q[0] - f.p[0]) / f.len, uz = (f.q[1] - f.p[1]) / f.len, nx = f.nx, nz = f.nz;
  // peça encostada: s ao longo da parede (m), profundidade d, de y0 a y1
  const piece = (s0, s1, d, y0, y1, col) => {
    const c = (s0 + s1) / 2, x = f.p[0] + ux * c + nx * (d / 2 + 0.005), z = f.p[1] + uz * c + nz * (d / 2 + 0.005);
    a.box(x, z, ux, uz, s1 - s0, d, y0, y1, U, U, col, false);
  };
  const top = Math.min(f.floors, 12), detail = Math.min(f.floors, 7); // detalhe por janela só até o 6º andar
  const v = f.variant | 0;
  // faixas entre andares e no topo (a mesma peça corre a parede inteira)
  if (f.kind === 'colonial') {
    for (let fl = 1; fl < top; fl++) piece(0, f.len, 0.12, fl * fh - 0.3 * sy, fl * fh - 0.02, TRIM);
    piece(-0.05, f.len + 0.05, 0.3, f.h - 0.32, f.h, TRIM); // platibanda
    piece(-0.05, f.len + 0.05, 0.4, f.h - 0.42, f.h - 0.3, TRIM); // cornija
  } else if (f.kind === 'modern') {
    for (let fl = 1; fl < top; fl++) piece(0, f.len, 0.22, fl * fh - 0.02, fl * fh + 0.2 * sy, CONCRETE); // laje saliente
    piece(-0.05, f.len + 0.05, 0.12, f.h - 0.25, f.h + 0.25, CONCRETE); // platibanda
  } else {
    piece(-0.05, f.len + 0.05, 0.1, f.h - 0.2, f.h + 0.15, TRIM);
  }
  // marquise sobre o térreo (prédio moderno sem loja)
  if (!shop && f.kind === 'modern' && f.floors >= 3) piece(0, f.len, 1.1, fh - 0.12, fh + 0.06, CONCRETE);
  const wins = WIN[f.kind]?.[v];
  for (let bay = 0; bay < f.nWin; bay++) {
    const s0 = bay * bw;
    for (let fl = 1; fl < detail; fl++) {
      const y = fl * fh;
      const h = hashf(f.p[0] + bay * 7.1 + fl * 1.3, f.p[1] - fl * 3.7);
      if (wins) for (const [x0, x1, ys] of wins) {
        piece(s0 + x0 * sx, s0 + x1 * sx, 0.13, y + ys * sy - 0.07, y + ys * sy, TRIM); // peitoril
        // ar-condicionado de janela (caixa saindo da parede) em parte das janelas dos prédios
        if (f.kind === 'modern' && h < 0.25 && (x1 - x0) > 1) {
          const c = s0 + (x0 + 0.35 + h * ((x1 - x0) - 0.7) * 2.5) * sx;
          piece(c - 0.36, c + 0.36, 0.5, y + ys * sy - 0.5, y + ys * sy - 0.08, AC);
        }
      }
      // sacada: porta-balcão do sobrado e varandinha da casa
      const bal = f.kind === 'colonial' && v === 1 ? [0.9, 3.1, 0.12, 1.25] : f.kind === 'casa' && v === 2 ? [0.4, 3.6, 0.18, 1.15] : null;
      if (bal) {
        const [x0, x1, yb, yr] = bal, b0 = s0 + x0 * sx, b1 = s0 + x1 * sx, d = 0.55, yy = y + yb * sy;
        piece(b0, b1, d, yy, yy + 0.14, TRIM); // laje da sacada
        // grade: um painel na frente e um em cada lado, com a textura de balaústres (fundo transparente)
        const rt = yy + (yr - yb) * sy, y0 = yy + 0.14, dd = d - 0.03;
        const P = (sAlong, dOut) => [f.p[0] + ux * sAlong + nx * dOut, f.p[1] + uz * sAlong + nz * dOut];
        const panel = (A0, A1, n0, n1, nrm) => {
          // atlas não repete: o painel usa a célula inteira (16 balaústres) e a parte proporcional nos lados
          const k = a.nv, part = Math.min(1, Math.hypot(A1[0] - A0[0], A1[1] - A0[1]) / 2.2), u1 = R[0] + (R[2] - R[0]) * part;
          a.v(A0[0], y0, A0[1], ...nrm, R[0], R[1]); a.v(A1[0], y0, A1[1], ...nrm, u1, R[1]);
          a.v(A1[0], rt, A1[1], ...nrm, u1, R[3]); a.v(A0[0], rt, A0[1], ...nrm, R[0], R[3]);
          a.q(k, k + 1, k + 2, k + 3); a.q(k, k + 3, k + 2, k + 1); // dos dois lados
        };
        panel(P(b0, dd), P(b1, dd), 0, 0, [nx, 0, nz]);
        panel(P(b0, 0.02), P(b0, dd), 0, 0, [-ux, 0, -uz]);
        panel(P(b1, dd), P(b1, 0.02), 0, 0, [ux, 0, uz]);
      }
    }
  }
}

// ---------------------------------------------------------------- mobiliário urbano
// Semáforo nas avenidas (com ciclo de verde, amarelo e vermelho), placa azul com o nome da rua nas esquinas,
// ponto de ônibus com abrigo nas avenidas e lixeira laranja ao lado.
const FLAT = [0, 0, 0, 0]; // peça lisa: sem textura, só a cor do vértice
const abbrev = (n) => n.replace(/^Avenida /, 'Av. ').replace(/^Rua /, 'R. ').replace(/^Travessa /, 'Tv. ').replace(/^Praça /, 'Pç. ').replace(/^Estrada /, 'Estr. ').replace(/^Largo /, 'Lg. ').toUpperCase();
function nameAtlas(roads) {
  // 2048 × 2048, células de 256 × 32: 511 nomes (primárias primeiro) + a placa do ponto de ônibus
  const best = new Map();
  for (const r of roads) if (r.n && RANK[r.k] >= 5) best.set(r.n, Math.max(best.get(r.n) || 0, RANK[r.k]));
  const names = [...best.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 511).map((e) => e[0]);
  const c = document.createElement('canvas'); c.width = 2048; c.height = 2048;
  const g = c.getContext('2d');
  const cell = new Map();
  const draw = (i, text, bg, fg) => {
    const x = (i % 8) * 256, y = Math.floor(i / 8) * 32;
    g.fillStyle = bg; g.fillRect(x, y, 256, 32);
    g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, 250, 26);
    let size = 19; g.font = `800 ${size}px Inter, Arial, sans-serif`;
    while (g.measureText(text).width > 236 && size > 9) { size--; g.font = `800 ${size}px Inter, Arial, sans-serif`; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + 128, y + 17);
    return [x / 2048, 1 - (y + 32) / 2048, (x + 256) / 2048, 1 - y / 2048];
  };
  names.forEach((n, i) => cell.set(n, draw(i, abbrev(n), '#1d4f9c', '#ffffff')));
  const bus = draw(511, 'PARADA DE ÔNIBUS', '#f2b705', '#1a1a1a');
  const t = releaseOnUpload(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, cell, bus };
}

export async function buildFurniture(group, roads, { signals, corners, isDrive, isSolid, isWater, roadW }) {
  const yieldNow = slicer();
  const ck = lazyChunks(['furn', 'plate', 'luzA', 'luzB']);
  const N = nameAtlas(roads);
  const POLE = [70, 74, 72], BLACK = [28, 28, 30], ROOF = [190, 192, 190], GLASS = [120, 150, 160], ORANGE = [235, 110, 20];
  const flat = (acc, x, z, ux, uz, w, d, y0, y1, col) => acc.box(x, z, ux, uz, w, d, y0, y1, null, FLAT, col);
  let nSig = 0, nPlate = 0, nBus = 0;
  const built = new Map(); // semáforos montados, por célula de 40 m (o trânsito consulta)
  const dbg = { placas: [], paradas: [] }; // amostras para depuração (window.__mobilia)

  // semáforos
  const signal = (s) => {
    if (isSolid(s.x, s.z) || isDrive(s.x, s.z)) return;
    const acc = ck.at(s.x, s.z), y = CURB_H;
    const nx = -s.tz, nz = s.tx; // de lado: aponta para o meio da pista
    const reach = Math.min(s.w / 4 + 0.55, 4.2); // a cabeça fica em cima da faixa da direita
    flat(acc.furn, s.x, s.z, s.tx, s.tz, 0.16, 0.16, y, y + 5.6, POLE);
    // braço até em cima da faixa da direita
    const ax = s.x + nx * reach / 2, az = s.z + nz * reach / 2;
    flat(acc.furn, ax, az, nx, nz, reach, 0.1, y + 5.35, y + 5.45, POLE);
    // grupo focal virado para quem chega (+t), pendurado na ponta do braço
    for (const [hx, hz, hy] of [[s.x + nx * reach, s.z + nz * reach, y + 4.25]]) {
      flat(acc.furn, hx, hz, nx, nz, 0.36, 0.3, hy, hy + 1.05, BLACK);
      const L = s.axis ? acc.luzB : acc.luzA;
      [[255, 40, 30], [255, 180, 0], [40, 230, 90]].forEach((c, k) => {
        L.box(hx + s.tx * 0.16, hz + s.tz * 0.16, nx, nz, 0.22, 0.04, hy + 0.78 - k * 0.32, hy + 0.98 - k * 0.32, null, FLAT, c);
      });
    }
    if (!ck.rec) return;
    nSig++;
    const key = Math.floor(s.sx / 40) * 100003 + Math.floor(s.sz / 40);
    let l = built.get(key); if (!l) built.set(key, (l = [])); l.push(s);
  };

  // placas de rua: uma por esquina, com os nomes das duas ruas que se cruzam
  const plate = (n) => {
    const named = [];
    for (const a of n.arms) if (a.r.n && N.cell.has(a.r.n) && !named.some((b) => b.r.n === a.r.n)) named.push(a);
    if (!named.length) return;
    const arms = n.arms.filter((a) => !a.r.k.endsWith('_link'));
    if (arms.length < 2) return;
    // direção de cada braço saindo do nó
    const dir = (a) => { const p = a.r.p, j = a.i + a.dir; const dx = p[j][0] - p[a.i][0], dz = p[j][1] - p[a.i][1], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; };
    const a1 = arms[0], a2 = arms.find((a) => a.r !== a1.r && Math.abs(dir(a)[0] * dir(a1)[0] + dir(a)[1] * dir(a1)[1]) < 0.7);
    if (!a2) return;
    const d1 = dir(a1), d2 = dir(a2), w1 = roadW[a1.r.k] || 7, w2 = roadW[a2.r.k] || 7;
    const x = n.x + d1[0] * (w2 / 2 + 1.0) + d2[0] * (w1 / 2 + 1.0), z = n.z + d1[1] * (w2 / 2 + 1.0) + d2[1] * (w1 / 2 + 1.0);
    if (isDrive(x, z) || isSolid(x, z) || isWater(x, z)) return;
    const acc = ck.at(x, z), y = CURB_H;
    flat(acc.furn, x, z, d1[0], d1[1], 0.07, 0.07, y, y + 2.9, POLE);
    // cada placa corre paralela à rua que ela nomeia
    let k = 0;
    for (const a of [a1, a2]) {
      const uv = a.r.n && N.cell.get(a.r.n);
      if (!uv) continue;
      const d = a === a1 ? d1 : d2;
      const yy = y + 2.55 - k * 0.3;
      acc.plate.box(x + d[0] * 0.5, z + d[1] * 0.5, d[0], d[1], 1.0, 0.03, yy, yy + 0.25, uv, uv, [255, 255, 255]);
      k++;
    }
    if (!ck.rec) return;
    nPlate++;
    if (dbg.placas.length < 300) dbg.placas.push([x, z, a1.r.n, a2.r.n]);
  };

  // pontos de ônibus nas avenidas, a cada ~380 m, alternando o lado
  const stops = (r) => {
    const hw = (roadW[r.k] || 7) / 2;
    let carry = 60 + hashf(r.p[0][0], r.p[0][1]) * 300, side = 1;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1) continue;
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      while (carry < L) {
        const t = carry; carry += 380;
        if (t < 8 || t > L - 8) continue;
        const sd = r.o ? 1 : side; side = -side;
        const nx = (-uz) * sd, nz = ux * sd; // para fora da pista
        const off = hw + CURB_W + 1.55;
        const x = a[0] + ux * t + nx * off, z = a[1] + uz * t + nz * off;
        const ok = [[0, 0], [2, 0], [-2, 0], [0, 0.9]].every(([s, o]) => {
          const px = x + ux * s + nx * o, pz = z + uz * s + nz * o;
          return !isDrive(px, pz) && !isSolid(px, pz) && !isWater(px, pz);
        });
        if (!ok || isDrive(x, z) || isSolid(x, z) || isSolid(x + nx * 0.9, z + nz * 0.9) || isSolid(x + ux * 2, z + uz * 2) || isSolid(x - ux * 2, z - uz * 2) || isDrive(x + ux * 2, z + uz * 2) || isDrive(x - ux * 2, z - uz * 2)) continue;
        busStop(ck.at(x, z), x, z, ux * sd, uz * sd, nx, nz, N.bus, flat, { POLE, ROOF, GLASS, ORANGE, BLACK });
        if (ck.rec) { nBus++; if (dbg.paradas.length < 300) dbg.paradas.push([x, z, nx, nz, r.n]); }
      }
      carry -= L;
    }
  };
  // um corpo só para remontar o bloco: semáforo tem eixo, esquina tem braços, o resto é rua
  const body = (o) => ('axis' in o ? signal(o) : o.arms ? plate(o) : stops(o));
  for (const s of signals) { await yieldNow(); ck.item(s); signal(s); }
  for (const n of corners) { await yieldNow(); ck.item(n); plate(n); }
  for (const r of roads) {
    if (!(r.k === 'primary' || r.k === 'secondary' || r.k === 'trunk') || r.tu || r.b || r.p.length < 2) continue;
    if (r.p.some((q) => inHills(q[0], q[1]))) continue;
    await yieldNow(); ck.item(r); stops(r);
  }

  // luzes do semáforo: a cor do vértice diz qual lâmpada é; o ciclo liga uma por vez
  const onA = { value: new THREE.Vector3(0, 0, 1) }, onB = { value: new THREE.Vector3(1, 0, 0) };
  const lightMat = (on) => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: '#ffffff' });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uOn = on;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uOn;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    float isR = step(0.5, vColor.r) * step(vColor.g, 0.4), isY = step(0.5, vColor.r) * step(0.5, vColor.g), isG = step(vColor.r, 0.4) * step(0.5, vColor.g);
    float lit = dot(vec3(isR, isY, isG), uOn);
    totalEmissiveRadiance = vColor * lit * 3.0;
    diffuseColor.rgb *= 0.25 + 0.75 * lit;
  }`);
    };
    return m;
  };
  const furnMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const plateMat = new THREE.MeshStandardMaterial({ map: N.tex, roughness: 0.4 });
  const lazy = ck.done(body, group, { furn: furnMat, plate: plateMat, luzA: lightMat(onA), luzB: lightMat(onB) }, 500, { furn: true });
  dbg.sinais = built; // semáforos montados, por célula de 40 m
  window.__mobilia = dbg;
  // fase de cada eixo: 0 verde, 1 amarelo, 2 vermelho
  let cyc = 0;
  const phase = (axis) => axis === 0 ? (cyc < 12 ? 0 : cyc < 15 ? 1 : 2) : (cyc < 15 ? 2 : cyc < 27 ? 0 : 1);
  dbg.fase = (axis) => phase(axis);
  return {
    lazy, signals: nSig, plates: nPlate, stops: nBus,
    // Distância até a linha de parada de um semáforo fechado à frente (ou null). Para o trânsito:
    // quem vem na direção da faixa (rumo ao cruzamento), dentro da pista, a até 30 m.
    // No amarelo, quem já está a menos de 9 m passa.
    stopAhead(x, z, fx, fz) {
      const cx = Math.floor(x / 40), cz = Math.floor(z / 40);
      let best = null;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of built.get((cx + i) * 100003 + cz + j) || []) {
        if (fx * -s.tx + fz * -s.tz < 0.75) continue; // não está indo para este cruzamento por este braço
        const rx = s.sx - x, rz = s.sz - z, ahead = rx * fx + rz * fz;
        if (ahead < -0.5 || ahead > 30) continue;
        if (Math.abs(rx * fz - rz * fx) > s.w / 2 + 0.5) continue;
        const ph = phase(s.axis);
        if (ph === 0 || (ph === 1 && ahead < 9)) continue;
        if (best === null || ahead < best) best = ahead;
      }
      return best;
    },
    // ciclo de 30 s: eixo A verde 12 s, amarelo 3 s, vermelho 15 s; eixo B ao contrário
    update(t) {
      const c = t % 30;
      cyc = c;
      onA.value.set(c >= 15 ? 1 : 0, c >= 12 && c < 15 ? 1 : 0, c < 12 ? 1 : 0);
      onB.value.set(c < 15 ? 1 : 0, c >= 27 ? 1 : 0, c >= 15 && c < 27 ? 1 : 0);
    },
  };
}

// abrigo de ônibus: duas colunas atrás, cobertura, painel de fundo, banco, totem com a placa e lixeira
function busStop(acc, x, z, ux, uz, nx, nz, busUv, flat, C) {
  const y = CURB_H, a = acc.furn;
  const back = (o) => [x + nx * o, z + nz * o];
  // u da caixa = ao longo da rua; a frente da caixa (−uz, ux) aponta para um dos lados: tanto faz para peças lisas
  for (const s of [-1.6, 1.6]) { const [px, pz] = back(0.55); flat(a, px + ux * s, pz + uz * s, ux, uz, 0.1, 0.1, y, y + 2.55, C.POLE); }
  { const [px, pz] = back(0.05); flat(a, px, pz, ux, uz, 3.6, 1.7, y + 2.55, y + 2.67, C.ROOF); }
  { const [px, pz] = back(0.58); flat(a, px, pz, ux, uz, 3.2, 0.04, y + 0.35, y + 2.3, C.GLASS); }
  { const [px, pz] = back(0.25); flat(a, px, pz, ux, uz, 2.4, 0.42, y + 0.42, y + 0.48, [150, 110, 70]); flat(a, px, pz, ux, uz, 2.2, 0.2, y, y + 0.42, C.POLE); }
  // totem com a placa amarela, na beira da calçada
  { const [px, pz] = back(-1.0); const tx = px + ux * 2.4, tz = pz + uz * 2.4;
    flat(a, tx, tz, ux, uz, 0.08, 0.08, y, y + 2.6, C.POLE);
    acc.plate.box(tx, tz, nx, nz, 1.0, 0.03, y + 2.2, y + 2.45, busUv, busUv, [255, 255, 255]); }
  // lixeira laranja presa num pé
  { const [px, pz] = back(0.3); const lx = px - ux * 2.4, lz = pz - uz * 2.4;
    flat(a, lx, lz, ux, uz, 0.06, 0.06, y, y + 0.6, C.POLE);
    flat(a, lx, lz, ux, uz, 0.42, 0.36, y + 0.55, y + 1.1, C.ORANGE); }
}

// faixa de calçada ao longo da parede (largura 1,6 m) e a face do meio-fio na borda de fora
function stripAlong(a, f, type, reg = true) {
  const W = 1.6, ux = (f.q[0] - f.p[0]) / f.len, uz = (f.q[1] - f.p[1]) / f.len, nx = f.nx, nz = f.nz;
  const p0 = [f.p[0] - ux * 0.3, f.p[1] - uz * 0.3], len = f.len + 0.6; // passa um pouco das quinas
  const P = (s, o) => [p0[0] + ux * s + nx * o, p0[1] + uz * s + nz * o];
  const A0 = P(0, 0.02), A1 = P(len, 0.02), B0 = P(0, W), B1 = P(len, W);
  let k = a.nv;
  a.v(A0[0], CURB_H, A0[1], 0, 1, 0, type, 0); a.v(A1[0], CURB_H, A1[1], 0, 1, 0, type, len);
  a.v(B1[0], CURB_H, B1[1], 0, 1, 0, type, len); a.v(B0[0], CURB_H, B0[1], 0, 1, 0, type, 0);
  // anti-horária vista de cima
  const cr = (A1[0] - A0[0]) * (B1[1] - A0[1]) - (A1[1] - A0[1]) * (B1[0] - A0[0]);
  if (cr < 0) a.q(k, k + 1, k + 2, k + 3); else a.q(k, k + 3, k + 2, k + 1);
  // meio-fio: tampo claro e face voltada para a pista
  const C0 = P(0, W + 0.22), C1 = P(len, W + 0.22);
  k = a.nv;
  a.v(B0[0], CURB_H, B0[1], 0, 1, 0, 2, 0); a.v(B1[0], CURB_H, B1[1], 0, 1, 0, 2, len); a.v(C1[0], CURB_H, C1[1], 0, 1, 0, 2, len); a.v(C0[0], CURB_H, C0[1], 0, 1, 0, 2, 0);
  if (cr < 0) a.q(k, k + 1, k + 2, k + 3); else a.q(k, k + 3, k + 2, k + 1);
  k = a.nv;
  a.v(C0[0], 0, C0[1], nx, 0, nz, 2, 0); a.v(C1[0], 0, C1[1], nx, 0, nz, 2, len); a.v(C1[0], CURB_H, C1[1], nx, 0, nz, 2, len); a.v(C0[0], CURB_H, C0[1], nx, 0, nz, 2, 0);
  a.q(k, k + 1, k + 2, k + 3); a.q(k, k + 3, k + 2, k + 1);
  if (!reg) return; // ao remontar o bloco: a faixa já está registrada
  const st = { x: p0[0], z: p0[1], ux, uz, nx, nz, len, w: W + 0.22 };
  const key = Math.floor((p0[0] + ux * len / 2) / 40) * 100003 + Math.floor((p0[1] + uz * len / 2) / 40);
  // registra em todas as células que a faixa toca (as pontas e o meio)
  for (const s of [0, len / 2, len]) { const q = P(s, W / 2), kk = Math.floor(q[0] / 40) * 100003 + Math.floor(q[1] / 40); let l = strips.get(kk); if (!l) strips.set(kk, (l = [])); if (!l.includes(st)) l.push(st); }
}

// ---------------------------------------------------------------- corredor de ônibus da Conde da Boa Vista
// Como nas fotos: a faixa de dentro de cada pista (a do lado do canteiro) é só de ônibus, em concreto claro, com linha
// branca contínua separando e "ÔNIBUS" pintado no chão a cada 60 m; no canteiro, estações cobertas a cada ~420 m
// (plataforma elevada, cobertura sobre colunas com a faixa azul do Grande Recife, vidro no meio e banco dos dois lados).
// Fica de fora dos cruzamentos. As estações vão em window.__corredor (e em world.busStations) para o trânsito.
const CORREDOR = /^Avenida Conde da Boa Vista$/;
function onibusTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 512);
  g.fillStyle = '#f2f1ea'; g.font = '900 120px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  // letras esticadas no sentido da pista (como a pintura de chão), lidas por quem vem de baixo
  g.save(); g.translate(128, 256); g.scale(0.62, 3.2); g.fillText('ÔNIBUS', 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export async function buildBusCorridor(group, roads, { roadW, nearRoad }) {
  const yieldNow = slicer();
  const ck = lazyChunks(['lane', 'paint', 'station', 'glass']);
  const carr = roads.filter((r) => r.n && CORREDOR.test(r.n) && !r.k.endsWith('_link') && !r.tu && r.p.length >= 2);
  const segs = []; carr.forEach((r) => { for (let i = 0; i < r.p.length - 1; i++) segs.push([r.p[i], r.p[i + 1], r]); });
  const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return [Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t), a[0] + dx * t, a[1] + dz * t]; };
  // a outra pista mais perto (o canteiro fica do lado dela): [distância, ponto]
  const other = (x, z, r) => { let best = [1e9, 0, 0]; for (const [a, b, q] of segs) if (q !== r) { const d = segD(x, z, a, b); if (d[0] < best[0]) best = d; } return best; };
  // lado do canteiro de cada pista (+1 = esquerda de quem anda no sentido da pista), pelo meio de cada trecho
  const side = new Map();
  for (const r of carr) {
    let s = 0;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, [d, ox, oz] = other(mx, mz, r);
      if (d > 20) continue;
      const tx = b[0] - a[0], tz = b[1] - a[1];
      // esquerda de quem anda no sentido (tx, tz) é (tz, −tx) no plano x-z (z para o sul): a outra pista está desse lado?
      s += Math.sign((ox - mx) * tz - (oz - mz) * tx) * Math.hypot(tx, tz);
    }
    side.set(r, s >= 0 ? 1 : -1);
  }
  const LANE = [128, 126, 120], LINE = [235, 235, 228]; // concreto cinza (no sol, o claro demais virava branco)
  const FLATUV = [0, 0, 0, 0];
  const quad = (acc, P, n = [0, 1, 0], col = [255, 255, 255], uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) => {
    const k = acc.nv; P.forEach((p, i) => acc.v(p[0], p[1], p[2], n[0], n[1], n[2], uv[i][0], uv[i][1], col[0], col[1], col[2])); acc.q(k, k + 1, k + 2, k + 3); acc.q(k, k + 3, k + 2, k + 1);
  };
  let nPaint = 0;
  // faixa exclusiva de uma pista: concreto claro, linha branca e a palavra ÔNIBUS
  const lane = (r) => {
    const s = side.get(r), hw = (roadW[r.k] || 10) / 2, y = 0.075;
    let carry = 30;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
      const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
      // normal para o lado do canteiro: a esquerda de quem anda é (tz, -tx) no plano x-z (z para o sul)
      const nx = tz * s, nz = -tx * s;
      const [d] = other((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, r); if (d > 20) { carry -= L; continue; } // sem a outra pista ao lado: sem corredor
      const P = (u, o, yy) => [a[0] + tx * u + nx * o, yy, a[1] + tz * u + nz * o];
      const acc = ck.at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      quad(acc.lane, [P(-0.05, 0.12, y), P(L + 0.05, 0.12, y), P(L + 0.05, hw - 0.35, y), P(-0.05, hw - 0.35, y)], [0, 1, 0], LANE);
      quad(acc.lane, [P(-0.05, -0.02, y + 0.004), P(L + 0.05, -0.02, y + 0.004), P(L + 0.05, 0.2, y + 0.004), P(-0.05, 0.2, y + 0.004)], [0, 1, 0], LINE);
      while (carry < L - 3) {
        const u = carry, mid = (0.12 + hw - 0.35) / 2, half = Math.min(1.3, (hw - 0.47) / 2);
        // texto: u da textura vai da esquerda para a direita de quem dirige, v no sentido da pista. O deslocamento cresce
        // para o lado do canteiro (n = esquerda × s), então a borda esquerda de quem dirige é mid + half·s
        // (conferido na foto, de dentro da própria faixa: lida de frente, sem espelhar)
        const L0 = mid + half * s, R0 = mid - half * s;
        const c0 = P(u - 3, L0, y + 0.008), c1 = P(u - 3, R0, y + 0.008), c2 = P(u + 3, R0, y + 0.008), c3 = P(u + 3, L0, y + 0.008);
        // v da textura: 0 perto de quem dirige, 1 longe (conferido na foto ampliada: o acento do Ô fica em cima)
        quad(ck.at(c0[0], c0[2]).paint, [c0, c1, c2, c3], [0, 1, 0], [255, 255, 255], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        if (ck.rec) nPaint++;
        carry += 60;
      }
      carry -= L;
    }
  };
  // estações no canteiro: ponto do meio entre as pistas, a cada ~420 m, fora dos cruzamentos
  const stations = [];
  {
    const base = carr.slice().sort((p, q) => q.p.length - p.p.length);
    const seen = [];
    for (const r of carr) {
      let carry = 140;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
        const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
        while (carry < L) {
          const x = a[0] + tx * carry, z = a[1] + tz * carry; carry += 420;
          const [d, ox, oz] = other(x, z, r); if (d < 8 || d > 16) continue; // precisa de canteiro
          const cx = (x + ox) / 2, cz = (z + oz) / 2;
          if (seen.some((s) => Math.hypot(s.x - cx, s.z - cz) < 300)) continue; // a outra pista já pôs uma aqui perto
          // fora de cruzamento: nas pontas e no meio, a pista mais perto tem que ser a própria avenida
          if ([-14, 0, 14].some((o) => { const n = nearRoad(cx + tx * o, cz + tz * o, 9); return n && !(n.r.n && CORREDOR.test(n.r.n)); })) continue;
          const s = { x: cx, z: cz, dx: tx, dz: tz, len: 24, w: 3 };
          seen.push(s); stations.push(s);
        }
        carry -= L;
      }
    }
  }
  const POST = [70, 74, 78], ROOF = [226, 228, 226], AZUL = [29, 95, 168], PLAT = [178, 172, 160], BANCO = [120, 92, 64], AMARELO = [242, 183, 5];
  const station = (s) => {
    const acc = ck.at(s.x, s.z), ux = s.dx, uz = s.dz, y0 = 0.35;
    const flat = (a, ox, w, d, ya, yb, col, oz = 0) => a.box(s.x + ux * ox - uz * oz, s.z + uz * ox + ux * oz, ux, uz, w, d, ya, yb, null, FLATUV, col);
    flat(acc.station, 0, s.len, s.w, 0, y0, PLAT); // plataforma
    flat(acc.station, 0, s.len, 0.12, y0, y0 + 0.01, AMARELO, s.w / 2 - 0.1); flat(acc.station, 0, s.len, 0.12, y0, y0 + 0.01, AMARELO, -(s.w / 2 - 0.1)); // faixa tátil amarela na beira
    for (let o = -s.len / 2 + 1.5; o <= s.len / 2 - 1.4; o += 5.25) flat(acc.station, o, 0.18, 0.18, y0, 3.35, POST); // colunas no meio
    flat(acc.station, 0, s.len + 0.6, s.w + 1.0, 3.35, 3.5, ROOF); // cobertura
    flat(acc.station, 0, s.len + 0.6, 0.06, 3.15, 3.5, AZUL, (s.w + 1.0) / 2); flat(acc.station, 0, s.len + 0.6, 0.06, 3.15, 3.5, AZUL, -(s.w + 1.0) / 2); // faixa azul
    flat(acc.glass, 0, s.len - 3, 0.05, y0 + 0.5, y0 + 2.4, [170, 200, 210]); // vidro no meio
    for (const sd of [-1, 1]) flat(acc.station, 0, s.len - 6, 0.45, y0 + 0.42, y0 + 0.5, BANCO, sd * 0.4); // bancos
  };
  for (const r of carr) { await yieldNow(); ck.item(r); lane(r); }
  for (const s of stations) {
    ck.item(s); station(s);
    // a plataforma é piso (curbHeight). O vidro e as colunas não entram na grade: com células de 2,5 m, carimbar
    // o meio travaria a plataforma inteira (3 m de largura)
    for (const o of [-s.len / 2, 0, s.len / 2]) for (const w of [-s.w / 2, s.w / 2]) {
      const kk = Math.floor((s.x + s.dx * o - s.dz * w) / 40) * 100003 + Math.floor((s.z + s.dz * o + s.dx * w) / 40);
      let l = platforms.get(kk); if (!l) platforms.set(kk, (l = [])); if (!l.includes(s)) l.push(s);
    }
  }
  const body = (o) => (o.len ? station(o) : lane(o));
  const tex = onibusTexture();
  const mats = {
    lane: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    paint: new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }),
    station: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.35 }),
  };
  if (typeof window !== 'undefined') window.__corredor = { estacoes: stations.map((s) => ({ x: s.x, z: s.z, dx: s.dx, dz: s.dz })), pinturas: nPaint, pistas: carr.length };
  return { lazy: ck.done(body, group, mats, 700, { station: true }), stations, paints: nPaint };
}
