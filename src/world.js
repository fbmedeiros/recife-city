import * as THREE from 'three';
import { buildLandmarks, OVERRIDES } from './landmarks.js';
import { prepareClassics, setDriveFilter } from './classics.js';
import { pruneMarcos } from './marcos.js';
import { preparePlaces, buildPlaces, infillHouses } from './places.js';
import { prepareCommunities, buildCulture } from './culture.js';
import { buildRio } from './rio.js';
import { buildOlinda, buildPiedade } from './olinda.js';
import { facadeAtlas, roadSet, roofSet, releaseOnUpload } from './textures.js';
import { TBN_GLSL } from './photos.js';
import { COLL, stampDisc } from './collide.js';
import { initTerrain, heightAt, inHills, terrainGeometry, setDeck, deckAt } from './terrain.js';
import { roadIndex, buildSidewalks, buildCrosswalks, buildShopfronts, buildFurniture, buildBusCorridor, curbHeight, busy, streetLazy } from './rua.js';

export const ROAD_W = {
  motorway: 14, trunk: 13, primary: 12, secondary: 10, tertiary: 8.5, unclassified: 7, residential: 7,
  living_street: 6, service: 4.5, motorway_link: 7, trunk_link: 7, primary_link: 7, secondary_link: 7,
  tertiary_link: 6.5, pedestrian: 6, footway: 2.6, path: 2, steps: 2.5, cycleway: 2.4, track: 3,
};
const FOOT = new Set(['pedestrian', 'footway', 'path', 'steps', 'cycleway', 'track']);

// paleta dos sobrados coloridos do Recife Antigo / São José
const PASTEL = ['#e8b04a', '#d9624b', '#4f9fbf', '#79b77a', '#e7d7b5', '#c97b9b', '#f2e3a0', '#8fb8de', '#e98d5a', '#f5f0e6', '#b3d4a8', '#e26d6d', '#f0c987', '#6fc2b4'];
// torres (Boa Viagem, Casa Forte, Graças…): nas fotos são de reboco branco ou creme, quase nunca cinza
// torres de apartamento: a maioria branca e creme, uma parte bege, salmão claro e cinza-azulado (nas fotos de Boa
// Viagem, Graças e Casa Forte nem toda torre é branca)
const TOWER = ['#f6f4ef', '#f3efe6', '#efe8da', '#f7f3ea', '#ebe6dc', '#f1ede4', '#e8e1d2', '#eadbc4', '#e9d4bd', '#f0dcc8', '#dfe3e4', '#e3d6c0', '#d9dfe2', '#ecd9c6'];
const MODERN = ['#ece9e2', '#d8d4cc', '#c4c9cc', '#aab6bf', '#efe6d6', '#cbc4b4', '#b9c3c7', '#e4dccb', '#9fb0bd'];
const ROOF_TILE = ['#a5553a', '#9a4b33', '#b0613f', '#8f4630'];

// bits da grade de colisão (1 célula = RES metros). RES é 1,5 m enquanto a grade couber em ~80 milhões de
// células; num mapa maior (o município inteiro) a célula cresce. Os outros módulos leem grid.RES.
export let RES = 1.5;
const MAX_CELLS = 80e6;
const WATER = 1, ROAD = 2, SOLID = 4, LAND = 8, COAST = 16, SEA = 32, STAIRS = 64, DRIVE = 128; // DRIVE: pista de carro (sem calçadão, ciclovia e escadaria)
// depois de consolidar a grade, o bit 16 (COAST) fica livre e passa a marcar terra fora do município (meta.limit)
const OUT = 16;

function hash(x, z) {
  let h = Math.imul(Math.round(x * 10) ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(Math.round(z * 10), 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const bboxOf = (pts) => {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
  return [x0, z0, x1, z1];
};

// 'MSB1' | N | P | pontos por prédio (uint16) | primeiro ponto (int32, dm) | passos (int16, dm) → { b: [[x0,z0,x1,z1,…], …] }
function decodeMs(buf) {
  if (!buf || buf.byteLength < 12) return null;
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x3142534d) return null; // 'MSB1'
  const N = dv.getUint32(4, true), P = dv.getUint32(8, true);
  const cnt = new Uint16Array(buf, 12, N);
  let o = (12 + N * 2 + 3) & ~3;
  const first = new Int32Array(buf, o, 2 * N); o += 8 * N;
  const step = new Int16Array(buf, o, 2 * (P - N));
  const b = new Array(N);
  for (let i = 0, k = 0; i < N; i++) {
    const n = cnt[i], f = new Array(n * 2);
    let x = first[2 * i], z = first[2 * i + 1];
    f[0] = x / 10; f[1] = z / 10;
    for (let j = 1; j < n; j++, k += 2) { x += step[k]; z += step[k + 1]; f[2 * j] = x / 10; f[2 * j + 1] = z / 10; }
    b[i] = f;
  }
  return { b };
}

export async function loadWorld(scene, renderer, progress, photos) {
  progress('Baixando o mapa…');
  // o download pode já ter começado em main.js, junto com as fotos
  // contornos reais que faltam no OSM (Microsoft, ODbL; scripts/ms-predios.py). Opcional; ?semms desliga
  // prédios da Microsoft em binário (formato em scripts/ms-predios.py): 2,4 MB comprimido no lugar de 4,3 MB em JSON
  const msP = new URLSearchParams(location.search).has('semms') ? Promise.resolve(null) : fetch('/data/predios-ms.bin').then((r) => (r.ok ? r.arrayBuffer() : null)).then(decodeMs).catch(() => null);
  const estP = /semestacionamento/.test(location.search) ? Promise.resolve(null) : fetch('/data/estacionamentos.json').then((r) => (r.ok ? r.json() : null)).catch(() => null); // opcional
  const alturaP = fetch('/data/altura-ghsl.json').then((r) => (r.ok ? r.json() : null)).catch(() => null); // opcional
  const data = await (window.__mapData || fetch('/data/recife.json').then((r) => r.json()));
  const m = data.meta;
  const xmin = (m.bbox.w - m.lon0) * m.mLon, xmax = (m.bbox.e - m.lon0) * m.mLon;
  const zmin = -(m.bbox.n - m.lat0) * m.mLat, zmax = -(m.bbox.s - m.lat0) * m.mLat;
  RES = Math.max(1.5, Math.ceil(Math.sqrt(((xmax - xmin) * (zmax - zmin)) / MAX_CELLS) * 10) / 10);
  const GW = Math.ceil((xmax - xmin) / RES), GH = Math.ceil((zmax - zmin) / RES);
  const mask = new Uint8Array(GW * GH);
  // centro de cada prédio, calculado uma vez (várias etapas procuram 'o prédio mais perto de um ponto')
  for (const b of data.buildings) { let x = 0, z = 0; for (const q of b.p) { x += q[0]; z += q[1]; } b.cx = x / b.p.length; b.cz = z / b.p.length; }
  initTerrain(data); // relevo dos morros da zona norte
  await tick();

  // ---------- rasterização em blocos ----------
  progress('Desenhando o chão…');
  const gt = (window.gradeTimes = {}); let gt0 = performance.now(); const glap = (k) => { const t = performance.now(); gt[k] = Math.round(t - gt0); gt0 = t; };
  const TILE = 2048;
  const tcan = document.createElement('canvas');
  tcan.width = tcan.height = TILE;
  const tc = tcan.getContext('2d', { willReadFrequently: true });
  const path = (g, ring) => { g.beginPath(); for (let i = 0; i < ring.length; i++) (i ? g.lineTo(ring[i][0], ring[i][1]) : g.moveTo(ring[i][0], ring[i][1])); };
  const withBB = (list, get = (x) => x) => list.map((it) => ({ it, bb: bboxOf(get(it)) }));
  // Até três camadas por passada, uma em cada canal de cor (vermelho, verde, azul), somadas com 'lighter':
  // cada bloco é desenhado e lido de volta uma vez só, em vez de uma vez por camada.
  function rasterLayers(layers, margin = 20, coarse = null) {
    if (layers.length > 3) throw new Error('rasterLayers: no máximo 3 camadas por passada');
    const COL = ['#ff0000', '#00ff00', '#0000ff'];
    for (let ty = 0; ty < GH; ty += TILE) for (let tx = 0; tx < GW; tx += TILE) {
      const wx0 = xmin + tx * RES, wz0 = zmin + ty * RES, wx1 = wx0 + TILE * RES, wz1 = wz0 + TILE * RES;
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, TILE, TILE);
      tc.setTransform(1 / RES, 0, 0, 1 / RES, -wx0 / RES, -wz0 / RES);
      tc.globalCompositeOperation = 'lighter'; tc.lineCap = 'round'; tc.lineJoin = 'round';
      const used = [false, false, false];
      layers.forEach((L, ch) => {
        tc.fillStyle = COL[ch]; tc.strokeStyle = COL[ch];
        for (const { it, bb } of L.items) {
          if (bb[2] < wx0 - margin || bb[0] > wx1 + margin || bb[3] < wz0 - margin || bb[1] > wz1 + margin) continue;
          L.draw(tc, it); used[ch] = true;
        }
      });
      if (!used.some(Boolean)) continue;
      const w = Math.min(TILE, GW - tx), h = Math.min(TILE, GH - ty);
      const d32 = new Uint32Array(tc.getImageData(0, 0, w, h).data.buffer); // RGBA → 0xAABBGGRR
      const b0 = layers[0]?.bit || 0, b1 = layers[1]?.bit || 0, b2 = layers[2]?.bit || 0;
      for (let y = 0; y < h; y++) {
        const row = (ty + y) * GW + tx, src = y * w;
        for (let x = 0; x < w; x++) {
          const p = d32[src + x]; if (!p) continue;
          let v = 0;
          if ((p & 0xff) > 110) v |= b0;
          if (((p >>> 8) & 0xff) > 110) v |= b1;
          if (((p >>> 16) & 0xff) > 110) v |= b2;
          if (v) { mask[row + x] |= v; if (coarse && v & coarse.bit) coarse.arr[((ty + y) >> 1) * coarse.w + ((tx + x) >> 1)] = 1; }
        }
      }
    }
    tc.globalCompositeOperation = 'source-over';
  }

  // molhes, píeres e arrecifes viram chão firme
  const landItems = [
    ...data.piers.map((p) => ({ p: p.p, w: p.k === 'breakwater' ? 12 : 5, fill: p.closed })),
    ...data.reefs.map((r) => ({ p: r, w: 3, fill: true })),
    // praias: no OSM do Recife a linha de costa passa no lado de dentro da areia
    ...data.parks.filter((p) => p.k === 'sand').map((p) => ({ p: p.p, w: 26, fill: true })),
  ];
  // Linha de costa com ponta solta (o extrato do município corta a costa em Olinda e em Jaboatão, longe da
  // borda do mapa): o mar dava a volta pela ponta e alagava o interior. Cada ponta solta é esticada na
  // direção do último ~1 km de costa até sair do mapa, e a costa volta a separar terra de mar.
  const coastLines = data.coastline.slice();
  {
    const key = (p) => Math.round(p[0]) + ',' + Math.round(p[1]);
    const ends = new Map();
    for (const l of data.coastline) { if (l.length < 2 || key(l[0]) === key(l[l.length - 1])) continue; for (const p of [l[0], l[l.length - 1]]) ends.set(key(p), (ends.get(key(p)) || 0) + 1); }
    const far = 2 * Math.hypot(xmax - xmin, zmax - zmin);
    for (const l of data.coastline) {
      if (l.length < 2 || key(l[0]) === key(l[l.length - 1])) continue;
      let len = 0; for (let i = 1; i < l.length; i++) len += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
      if (len < 300) continue; // pedacinho solto (pedra, ilhota) não divide nada
      for (const tail of [true, false]) {
        const e = tail ? l[l.length - 1] : l[0];
        if (ends.get(key(e)) !== 1) continue;
        if (e[0] - xmin < 50 || xmax - e[0] < 50 || e[1] - zmin < 50 || zmax - e[1] < 50) continue; // já encosta na borda
        let back = e, d = 0;
        for (let i = 1; i < l.length && d < 1000; i++) { back = tail ? l[l.length - 1 - i] : l[i]; d = Math.hypot(e[0] - back[0], e[1] - back[1]); }
        const dx = e[0] - back[0], dz = e[1] - back[1], dl = Math.hypot(dx, dz) || 1;
        const ext = [e[0] + (dx / dl) * far, e[1] + (dz / dl) * far];
        coastLines.push(tail ? [e, ext] : [ext, e]); // mesmo sentido da costa: terra à esquerda
      }
    }
  }
  // grade de 2x2 células para o voto do mar, marcada já na leitura do canvas (sem varrer a grade inteira de novo)
  const CWd = Math.ceil(GW / 2), CHd = Math.ceil(GH / 2); let coastC = new Uint8Array(CWd * CHd);
  rasterLayers([
    { items: withBB(data.water), draw: (g, r) => { path(g, r); g.fill(); }, bit: WATER },
    { items: withBB(coastLines), draw: (g, l) => { g.lineWidth = Math.max(2.5, RES * 1.5); /* grade grossa: linha fina deixava furo na diagonal */ path(g, l); g.stroke(); }, bit: COAST },
    { items: withBB(landItems, (x) => x.p), draw: (g, it) => { g.lineWidth = it.w; path(g, it.p); g.stroke(); if (it.fill) g.fill(); }, bit: LAND },
  ], 20, { bit: COAST, arr: coastC, w: CWd });
  glap('agua_costa');
  await tick();
  // mar: cada região separada pela linha de costa vota. No OSM a terra fica à esquerda da linha
  // e o mar à direita; uma região vira mar se a maioria dos trechos vizinhos diz que ela está à direita.
  // (Votar evita que um trecho com orientação errada alague a cidade inteira.)
  // (feito numa grade de 3 m: 4x menos células; a linha de costa engrossada não deixa vazar)
  let labels = new Uint16Array(CWd * CHd); const votes = [0];
  {
    const coast = coastC;
    const stack = [];
    const fill = (start) => {
      if (votes.length >= 65535) return;
      const id = votes.length;
      votes.push(0);
      stack.push(start);
      while (stack.length) {
        const i = stack.pop();
        if (labels[i] || coast[i]) continue;
        labels[i] = id;
        const x = i % CWd;
        if (x > 0) stack.push(i - 1);
        if (x < CWd - 1) stack.push(i + 1);
        if (i >= CWd) stack.push(i - CWd);
        if (i < CWd * (CHd - 1)) stack.push(i + CWd);
      }
    };
    for (const line of coastLines) for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
      for (const side of [1, -1]) {
        const sx = Math.floor(((ax + bx) / 2 - (dz / len) * 5 * side - xmin) / (RES * 2));
        const sz = Math.floor(((az + bz) / 2 + (dx / len) * 5 * side - zmin) / (RES * 2));
        if (sx < 0 || sz < 0 || sx >= CWd || sz >= CHd) continue;
        const c = sz * CWd + sx;
        if (coast[c]) continue;
        if (!labels[c]) fill(c);
        if (labels[c]) votes[labels[c]] += side * len;
      }
    }
  }
  // as regiões que votaram mar viram SEA na consolidação (mais abaixo), numa passada só pela grade
  let seaL = new Uint8Array(votes.length); for (let l = 1; l < votes.length; l++) seaL[l] = votes[l] > 0 ? 1 : 0;
  glap('mar');
  progress('Marcando ruas e quarteirões…');
  await tick();
  // Prédios reais da base da Microsoft entram antes do casario gerado: o gerado só ocupa o que sobrar.
  // Ficam com b.ms: ganham loja e calçada colada quando dão para a pista (MS_SHOPS), contam como prédio de
  // verdade para as comunidades (culture.js) e para a altura (defaultHeight + GHSL).
  const ms = await msP;
  gt0 = performance.now();
  if (ms?.b && !data.msAdded) {
    data.msAdded = true;
    for (const f of ms.b) {
      const p = []; let cx = 0, cz = 0;
      for (let i = 0; i < f.length; i += 2) { if (f[i] < xmin || f[i] > xmax || f[i + 1] < zmin || f[i + 1] > zmax) { p.length = 0; break; } p.push([f[i], f[i + 1]]); cx += f[i]; cz += f[i + 1]; }
      if (p.length < 3) continue;
      data.buildings.push({ p, h: null, t: 'yes', ms: true, cx: cx / p.length, cz: cz / p.length });
    }
  }
  glap('predios_ms');
  pruneMarcos(data); // Praça do Arsenal sem prédio no meio
  glap('pruneMarcos');
  const solidBuildings = data.buildings.filter((b) => !['roof', 'construction', 'carport'].includes(b.t));
  rasterLayers([
    { items: withBB(data.roads.filter((r) => !r.tu), (r) => r.p), draw: (g, r) => { g.lineWidth = ROAD_W[r.k] || 4; path(g, r.p); g.stroke(); }, bit: ROAD },
    { items: withBB(data.roads.filter((r) => !r.tu && !FOOT.has(r.k) && !/^(Rampa|Passarela)/.test(r.n || '')), (r) => r.p), draw: (g, r) => { g.lineWidth = (ROAD_W[r.k] || 4) - 0.6; path(g, r.p); g.stroke(); }, bit: DRIVE },
    { items: withBB(data.aeroway.filter((a) => a.k !== 'apron'), (a) => a.p), draw: (g, a) => { g.lineWidth = a.w; path(g, a.p); g.stroke(); }, bit: ROAD },
  ]);
  // prédios numa passada própria: rasterLayers só tem 3 canais de cor (com 4 camadas, a quarta nunca era marcada
  // e quase nenhum prédio ficava sólido na colisão)
  glap('ruas');
  // Prédios direto na grade, por varredura de linhas (célula marcada quando o centro dela cai dentro do contorno),
  // sem passar pelo canvas: desenhar 380 mil contornos e ler o mapa inteiro de volta custava ~0,6 s.
  // ?predioscanvas volta ao caminho antigo, para comparar.
  if (new URLSearchParams(location.search).has('predioscanvas')) rasterLayers([{ items: withBB(solidBuildings, (b) => b.p), draw: (g, b) => { path(g, b.p); g.fill(); }, bit: SOLID }]);
  else {
    // Margem E: o canvas antigo marcava também a borda meio coberta (antisserrilhado), deixando a parede ~1 célula
    // mais grossa que o contorno; a margem imita isso (fileiras a mais em cima e embaixo, intervalos alargados dos
    // lados), para os becos, a calçada e os pedestres continuarem como estavam.
    const E = Number(new URLSearchParams(location.search).get('margem') ?? 0.75) * RES, xs = [];
    for (const b of solidBuildings) {
      const ring = b.p, n = ring.length; if (n < 3) continue;
      let z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < n; i++) { const z = ring[i][1]; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      if (z1 - z0 < 2e-3) continue;
      const r0 = Math.max(0, Math.ceil((z0 - E - zmin) / RES - 0.5)), r1 = Math.min(GH - 1, Math.floor((z1 + E - zmin) / RES - 0.5));
      for (let r = r0; r <= r1; r++) {
        const z = Math.min(Math.max(zmin + (r + 0.5) * RES, z0 + 1e-3), z1 - 1e-3); xs.length = 0;
        for (let i = 0, j = n - 1; i < n; j = i++) { const az = ring[i][1], bz = ring[j][1]; if ((az > z) !== (bz > z)) xs.push(ring[i][0] + ((z - az) * (ring[j][0] - ring[i][0])) / (bz - az)); }
        if (xs.length > 2) xs.sort((a, b) => a - b); else if (xs.length === 2 && xs[0] > xs[1]) { const t = xs[0]; xs[0] = xs[1]; xs[1] = t; }
        const row = r * GW;
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const c0 = Math.max(0, Math.ceil((xs[k] - E - xmin) / RES - 0.5)), c1 = Math.min(GW - 1, Math.floor((xs[k + 1] + E - xmin) / RES - 0.5));
          for (let c = c0; c <= c1; c++) mask[row + c] |= SOLID;
        }
      }
    }
  }
  if (new URLSearchParams(location.search).has('contarsolido')) { let s = 0; for (let i = 0; i < mask.length; i++) if (mask[i] & SOLID) s++; gt.celulas_solidas = s; }
  glap('predios_grade');
  // ?limiteteste: contorno de mentira (círculo de 3 km em volta do Marco Zero) para testar o caminho do mapa grande
  if (!m.limit && new URLSearchParams(location.search).has('limiteteste')) {
    const mz = data.pois.find((p) => p.name === 'Marco Zero') || { x: 0, z: 0 };
    m.limit = [Array.from({ length: 64 }, (_, i) => [mz.x + Math.cos((i / 64) * Math.PI * 2) * 3000, mz.z + Math.sin((i / 64) * Math.PI * 2) * 3000])];
  }
  // contorno do município (meta.limit, anéis em metros do jogo): rasterizado a 8 m por pixel, só para saber o que fica fora
  let outside = null;
  if (m.limit?.length) {
    const LS = 8, lw = Math.ceil((xmax - xmin) / LS), lh = Math.ceil((zmax - zmin) / LS);
    const lc = document.createElement('canvas'); lc.width = lw; lc.height = lh;
    const lg = lc.getContext('2d', { willReadFrequently: true });
    lg.setTransform(1 / LS, 0, 0, 1 / LS, -xmin / LS, -zmin / LS);
    lg.beginPath();
    for (const ring of m.limit) for (let i = 0; i < ring.length; i++) (i ? lg.lineTo(ring[i][0], ring[i][1]) : lg.moveTo(ring[i][0], ring[i][1]));
    lg.fillStyle = '#fff'; lg.fill('evenodd');
    const ld = lg.getImageData(0, 0, lw, lh).data;
    outside = { lw, lh, LS, d: ld };
  }
  glap('limite');
  // vizinhos no horizonte (olinda.js: Olinda e Piedade): guarda o "fora do município" (o contorno some da memória
  // depois que os vizinhos são montados, mais adiante, quando já há índice de ruas para não pôr casa em cima de rua)
  let vizFora = null;
  if (outside && !/semolinda/.test(location.search)) {
    const o = outside;
    vizFora = (x, z) => {
      const i = Math.floor((x - xmin) / o.LS), j = Math.floor((z - zmin) / o.LS);
      return i < 0 || j < 0 || i >= o.lw || j >= o.lh || o.d[(j * o.lw + i) * 4 + 3] < 128;
    };
  }
  // consolida: água = (polígono ou mar) e não chão firme; terra fora do município vira OUT (não se anda lá)
  const lcol = outside ? Int32Array.from({ length: GW }, (_, ix) => Math.min(outside.lw - 1, Math.floor(((ix + 0.5) * RES) / outside.LS))) : null;
  // "fora do município" de uma fileira inteira de uma vez (a grade de 8 m só muda a cada ~3 fileiras): o laço de dentro
  // lê tudo em sequência, sem pular pela imagem do contorno
  const outRow = new Uint8Array(GW); let lastL = -1;
  for (let iz = 0, i = 0; iz < GH; iz++) {
    const lrow = outside ? Math.min(outside.lh - 1, Math.floor((iz + 0.5) * RES / outside.LS)) * outside.lw : 0, crow = (iz >> 1) * CWd;
    if (outside && lrow !== lastL) { lastL = lrow; const d = outside.d; for (let ix = 0; ix < GW; ix++) outRow[ix] = d[(lrow + lcol[ix]) * 4 + 3] < 128 ? OUT : 0; }
    for (let ix = 0; ix < GW; ix++, i++) {
      const v = mask[i];
      const water = (v & LAND) === 0 && ((v & WATER) !== 0 || ((v & COAST) === 0 && seaL[labels[crow + (ix >> 1)]] === 1));
      mask[i] = water ? WATER | (v & (ROAD | SOLID | DRIVE)) : (v & (ROAD | SOLID | DRIVE)) | ((v & (ROAD | DRIVE)) ? 0 : outRow[ix]);
    }
  }
  if (new URLSearchParams(location.search).has('hashgrade')) { let h = 2166136261; for (let i = 0; i < mask.length; i++) h = Math.imul(h ^ mask[i], 16777619); gt.hash = h >>> 0; }
  // Solta as grades de trabalho: elas aparecem dentro de funções internas, e o escopo do loadWorld fica vivo enquanto o
  // jogo roda (isSolid, update…). Sem isso, ~90 MB (rótulos do mar e contorno do município) ficavam presos.
  // Mapa de cor da água (células de 16 × 16 da grade, ~40 m): mar raso perto da praia é verde-turquesa, mar fundo é
  // azul, e rio e canal (Capibaribe, Beberibe) são verde-barrento, como nas fotos. Feito aqui porque é o último ponto
  // em que ainda se sabe o que é mar (as regiões que votaram mar) e o que é rio.
  const waterTint = (() => {
    const T = 16, tw = Math.ceil(GW / T), th = Math.ceil(GH / T), cls = new Uint8Array(tw * th); // 0 terra, 1 rio, 2 mar
    for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
      const iz = Math.min(GH - 1, j * T + (T >> 1)), ix = Math.min(GW - 1, i * T + (T >> 1)), v = mask[iz * GW + ix];
      if (!(v & WATER)) continue;
      cls[j * tw + i] = 2; // água (o rio se liga ao mar e, no OSM do Recife, a linha de costa sobe pelos rios)
    }
    // busca em largura sobre a grade de cor: distância de cada célula até as fontes, andando só por água
    const bfs = (src, cap) => {
      const dist = new Uint8Array(tw * th).fill(255), q = [];
      for (let k = 0; k < cls.length; k++) if (src(k)) { dist[k] = 0; q.push(k); }
      for (let h = 0; h < q.length; h++) {
        const k = q[h], d = dist[k]; if (d >= cap) continue;
        const i = k % tw;
        for (const n of [i > 0 ? k - 1 : -1, i < tw - 1 ? k + 1 : -1, k - tw, k + tw]) if (n >= 0 && n < cls.length && dist[n] === 255 && cls[n]) { dist[n] = d + 1; q.push(n); }
      }
      return dist;
    };
    // distância até a terra (fundura do mar) e, a partir dela, o mar aberto (mais de ~550 m de qualquer terra);
    // rio e bacia ficam longe do mar aberto, ligados a ele só por passagens estreitas
    const dLand = bfs((k) => cls[k] === 0, 20);
    const dOpen = bfs((k) => cls[k] && dLand[k] >= 14, 40);
    const img = new Uint8Array(tw * th * 4);
    const mix = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
    const RIO = [62, 96, 78], RASO = [64, 168, 160], FUNDO = [29, 90, 110];
    for (let k = 0; k < cls.length; k++) {
      const sea = mix(RASO, FUNDO, Math.min(1, Math.max(0, (Math.min(dLand[k], 12) - 2) / 8)));
      const rio = Math.min(1, Math.max(0, (Math.min(dOpen[k], 40) - 8) / 14)); // a ~300 m do mar aberto já é rio
      const c = cls[k] ? mix(sea, RIO, rio) : RIO;
      img.set([c[0], c[1], c[2], 255], k * 4);
    }
    const t = new THREE.DataTexture(img, tw, th, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    return { tex: t, x0: xmin, z0: zmin, w: tw * T * RES, h: th * T * RES };
  })();
  coastC = labels = seaL = outside = null;
  glap('consolida');
  await tick();

  // ---------- textura do chão (até 4096 px; no mapa com mais de 16 km o lado maior vai a 6144 px, se a placa aguentar) ----------
  const TMAX = renderer.capabilities.maxTextureSize >= 8192 && Math.max(xmax - xmin, zmax - zmin) > 16000 ? 6144 : 4096; // só no mapa grande (município inteiro)
  const GS = Math.min(4096 / Math.min(xmax - xmin, zmax - zmin), TMAX / Math.max(xmax - xmin, zmax - zmin)); // px por metro
  const gcan = document.createElement('canvas');
  gcan.width = Math.ceil((xmax - xmin) * GS); gcan.height = Math.ceil((zmax - zmin) * GS);
  const gc = gcan.getContext('2d', { willReadFrequently: true });
  // chão dos bairros: cinza urbano levemente quente (cimento, quintal, laje), como no satélite
  gc.fillStyle = '#b9b4aa'; gc.fillRect(0, 0, gcan.width, gcan.height);
  gc.setTransform(GS, 0, 0, GS, -xmin * GS, -zmin * GS);
  // fora do município: chão neutro de mato baixo, sem cidade (a água por cima fica transparente depois)
  if (m.limit?.length) {
    gc.save();
    gc.beginPath(); gc.rect(xmin, zmin, xmax - xmin, zmax - zmin);
    for (const ring of m.limit) for (let i = 0; i < ring.length; i++) (i ? gc.lineTo(ring[i][0], ring[i][1]) : gc.moveTo(ring[i][0], ring[i][1]));
    gc.fillStyle = '#979b8c'; gc.fill('evenodd');
    gc.restore();
  }
  // Cobertura do solo (ESA WorldCover 10 m, data.cobertura, vem de main.js): mata, campo, terra, brejo e mangue
  // pintados onde eles existem de verdade, mesmo sem polígono no OSM. Amostrada numa grade de 9 m e esticada
  // com suavização (bordas macias). Sem a cobertura, ficam as manchas e o mangue de antes.
  const cob = data.cobertura;
  if (cob?.at) {
    const CS = 9, cw = Math.ceil((xmax - xmin) / CS), ch = Math.ceil((zmax - zmin) / CS);
    const ccan = document.createElement('canvas'); ccan.width = cw; ccan.height = ch;
    const cctx = ccan.getContext('2d'), cim = cctx.createImageData(cw, ch), cd32 = new Uint32Array(cim.data.buffer);
    // 0xAABBGGRR por classe (0 = transparente: construído, água, sem dado)
    const rgba = (r, g, bl, a) => ((Math.round(a * 255) << 24) | (bl << 16) | (g << 8) | r) >>> 0;
    const PAL = [0, rgba(72, 108, 50, 0.92), rgba(132, 150, 84, 0.8), 0, rgba(176, 152, 116, 0.55), 0, rgba(96, 126, 72, 0.85), rgba(62, 92, 50, 0.92)];
    for (let j = 0; j < ch; j++) { const z = zmin + (j + 0.5) * CS; const mrow = Math.min(GH - 1, Math.floor((z - zmin) / RES)) * GW;
      for (let i = 0; i < cw; i++) { const x = xmin + (i + 0.5) * CS; if (mask[mrow + Math.min(GW - 1, Math.floor((x - xmin) / RES))] & WATER) continue; cd32[j * cw + i] = PAL[cob.at(x, z)] || 0; } } // nada de mata pintada no mar
    cctx.putImageData(cim, 0, 0);
    gc.save(); gc.imageSmoothingEnabled = true; gc.drawImage(ccan, xmin, zmin, cw * CS, ch * CS); gc.restore();
    ccan.width = ccan.height = 0;
  } else {
    // manchas verdes suaves de árvore de quintal (~1 a cada 5 mil m²)
    {
      let sd = 1234; const rr = () => ((sd = (sd * 1103515245 + 12345) >>> 0) / 4294967296);
      const n = Math.round(((xmax - xmin) * (zmax - zmin)) / 5000);
      for (let i = 0; i < n; i++) {
        const x = xmin + rr() * (xmax - xmin), z = zmin + rr() * (zmax - zmin), r = 12 + rr() * 28;
        const g = gc.createRadialGradient(x, z, 0, x, z, r);
        g.addColorStop(0, 'rgba(88,128,58,0.85)'); g.addColorStop(0.55, 'rgba(88,128,58,0.45)'); g.addColorStop(1, 'rgba(88,128,58,0)');
        gc.fillStyle = g; gc.beginPath(); gc.arc(x, z, r, 0, Math.PI * 2); gc.fill();
      }
    }
    // mangue verde-escuro na beira de rio e de maré (~30 m da água); a água por cima fica transparente depois
    gc.strokeStyle = 'rgba(66,96,52,0.85)'; gc.lineJoin = 'round'; gc.lineCap = 'round';
    gc.lineWidth = 60;
    for (const w of data.water) { if (w.length < 3) continue; path(gc, w); gc.closePath(); gc.stroke(); }
    gc.lineWidth = 30; gc.strokeStyle = 'rgba(66,96,52,0.6)';
    for (const w of data.water) { if (w.length < 3) continue; path(gc, w); gc.closePath(); gc.stroke(); }
  }
  const parkColor = { green: '#6f9a4f', plaza: '#cdbf9f', sand: '#ecd08a' };
  for (const k of ['plaza', 'green', 'sand']) {
    gc.fillStyle = parkColor[k]; gc.strokeStyle = parkColor[k]; gc.lineWidth = 26; gc.lineJoin = 'round';
    data.parks.filter((p) => p.k === k).forEach((p) => { path(gc, p.p); gc.fill(); if (k === 'sand') gc.stroke(); });
  }
  gc.fillStyle = '#a7a39b';
  data.aeroway.filter((a) => a.k === 'apron').forEach((a) => { path(gc, a.p); gc.fill(); });
  gc.strokeStyle = '#9d958a'; gc.fillStyle = '#9d958a'; gc.lineCap = 'round';
  for (const p of data.piers) { gc.lineWidth = p.k === 'breakwater' ? 12 : 5; path(gc, p.p); gc.stroke(); if (p.closed) gc.fill(); }
  gc.fillStyle = '#6d6458'; gc.strokeStyle = '#6d6458';
  for (const r of data.reefs) { gc.lineWidth = 3; path(gc, r); gc.stroke(); gc.fill(); }
  gc.setTransform(1, 0, 0, 1, 0, 0);
  let img = gc.getImageData(0, 0, gcan.width, gcan.height);
  let seed = 7;
  // um pixel por palavra (0xAABBGGRR), sem passar byte a byte; o ruído de ±5 vem de uma tabela já arredondada e
  // limitada a 0..255 (tab[v*16 + n] = v + n), como fazia o Uint8ClampedArray
  const p32 = new Uint32Array(img.data.buffer), W = gcan.width;
  const clampT = new Uint8Array(256 * 16); for (let v = 0; v < 256; v++) for (let k = 0; k < 16; k++) clampT[v * 16 + k] = Math.max(0, Math.min(255, v + k - 5));
  const colX = new Int32Array(W); for (let x = 0; x < W; x++) colX[x] = Math.min(GW - 1, Math.floor((x + 0.5) / GS / RES));
  for (let y = 0; y < gcan.height; y++) {
    const row = Math.min(GH - 1, Math.floor((y + 0.5) / GS / RES)) * GW, o = y * W;
    for (let x = 0; x < W; x++) {
      if (mask[row + colX[x]] & WATER) { p32[o + x] = 0; continue; }
      seed = (seed * 1103515245 + 12345) >>> 0; const n = Math.round(((seed >>> 16) / 65536 - 0.5) * 10) + 5; // 0..10
      const p = p32[o + x];
      p32[o + x] = (p & 0xff000000) | (clampT[((p >>> 16) & 255) * 16 + n] << 16) | (clampT[((p >>> 8) & 255) * 16 + n] << 8) | clampT[(p & 255) * 16 + n];
    }
  }
  gc.putImageData(img, 0, 0);
  img = null; // ~100 MB no mapa grande
  const groundTex = new THREE.CanvasTexture(gcan);
  releaseOnUpload(groundTex); // o minimapa usa uma cópia própria (mapCanvas)
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const groundGeo = new THREE.PlaneGeometry(xmax - xmin, zmax - zmin);
  groundGeo.rotateX(-Math.PI / 2);
  glap('textura_chao');
  // casario gerado onde o OSM não tem casas (Casa Forte e Poço da Panela); entra na grade antes do chão e do mapa
  const infill = infillHouses(data, { GW, GH, xmin, zmin, RES, mask });
  glap('casario_gerado');
  console.info('casario gerado:', infill.added, 'casas em', infill.sparse.length, 'bairros', JSON.stringify(infill.count));
  progress('Pintando calçadas, fachadas e asfalto…');
  await tick();
  const roofTx = roofSet();
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, alphaTest: 0.5, roughness: 0.95 });
  groundMat.onBeforeCompile = groundShader(photos, roofTx.map);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set((xmin + xmax) / 2, 0, (zmin + zmax) / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  // chão dos morros: malha com relevo, mesma textura do chão plano (fica um pouco acima dele)
  const tgeo = terrainGeometry(THREE, { xmin, xmax, zmin, zmax });
  if (tgeo) { const hills = new THREE.Mesh(tgeo, groundMat); hills.receiveShadow = true; hills.castShadow = true; scene.add(hills); }

  const mapCanvas = buildMapCanvas(gcan, data, { xmin, zmin, xmax });
  scene.add(buildWater(waterTint));
  await tick();

  // ---------- grade de colisão ----------
  const grid = { GW, GH, xmin, zmin, RES, mask };
  COLL.grid = grid; // modelos feitos por código carimbam a colisão aqui
  const cellOf = (x, z) => {
    const ix = Math.floor((x - xmin) / RES), iz = Math.floor((z - zmin) / RES);
    if (ix < 0 || iz < 0 || ix >= GW || iz >= GH) return -1;
    return iz * GW + ix;
  };
  const blocked = (x, z) => {
    const i = cellOf(x, z);
    if (i < 0) return true;
    const v = mask[i];
    return (v & (SOLID | OUT)) !== 0 || ((v & WATER) !== 0 && (v & ROAD) === 0);
  };
  const isSolid = (x, z) => { const i = cellOf(x, z); return i < 0 || (mask[i] & (SOLID | OUT)) !== 0; };
  const isWater = (x, z) => { const i = cellOf(x, z); return i < 0 || (mask[i] & WATER) !== 0; };
  const isDrive = (x, z) => { const i = cellOf(x, z); return i >= 0 && (mask[i] & DRIVE) !== 0; };
  setDriveFilter(isDrive); // nada de banco, árvore ou barraca no meio da pista (Kit.build descarta)
  const isStairs = (x, z) => { const i = cellOf(x, z); return i >= 0 && (mask[i] & STAIRS) !== 0; };
  // tabuleiro das pontes acima do rio (terrain.js/heightAt): antes de tudo que pergunta a altura do chão
  const decks = /semtabuleiro/.test(location.search) ? null : buildDecks(data.roads, isWater, { xmin, zmin, xmax, zmax });

  // ---------- prédios ----------
  progress('Levantando os prédios…');
  await tick();
  // tempo de cada parte desta etapa (window.predioTimes, ms), para achar o que pesa
  const pt = {}; let t0 = performance.now(); const lap = (k) => { const n = performance.now(); pt[k] = Math.round(n - t0); t0 = n; };
  const orla = orlaIndex(data.roads, zmin, zmax);
  // pontos clássicos com modelo próprio: o prédio genérico do OSM dá lugar a eles
  lap('orla');
  preparePlaces(data); // casario colorido da Rua da Aurora e alturas de prédios famosos
  lap('lugares');
  prepareCommunities(data, { GW, GH, xmin, zmin, RES, mask }); // casario autoconstruído de Brasília Teimosa, Coque e Ilha de Deus
  lap('comunidades');
  const classic = prepareClassics(data);
  lap('classicos');
  for (const n of classic.skip) OVERRIDES[n] = { ...(OVERRIDES[n] || {}), skip: true };
  for (const [n, o] of Object.entries(classic.overrides)) OVERRIDES[n] = { ...(OVERRIDES[n] || {}), ...o };
  const named = {};
  for (const b of data.buildings) if (b.n) (named[b.n] ||= []).push(b);
  const fronts = []; // paredes viradas para uma pista: podem virar loja no térreo (rua.js)
  GHSL = await alturaP;
  const chunks = buildBuildings(data.buildings, OVERRIDES, orla, roofTx, photos, fronts, isDrive);
  lap('predios');
  pt.fachadas = fronts.length; pt.fachadasMs = fronts.filter((f) => f.b.ms).length; pt.ms = data.buildings.filter((b) => b.ms).length;
  scene.add(chunks.group);
  const nearRoad = roadIndex(data.roads);
  if (vizFora) {
    // o extrato do OSM pega algumas ruas e prédios logo depois do limite: ali o casario dos vizinhos não entra
    const occ = new Set(), ck = (x, z) => Math.floor(x / 20) * 65536 + Math.floor(z / 20);
    for (const b of data.buildings) {
      const q = b.p[0]; if (!q || !(q[1] < -4800 || q[1] > 5000)) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [x, z] of b.p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      if (!vizFora((x0 + x1) / 2, (z0 + z1) / 2)) continue;
      for (let x = x0 - 6; x <= x1 + 6; x += 10) for (let z = z0 - 6; z <= z1 + 6; z += 10) occ.add(ck(x, z));
    }
    const ocupado = (x, z) => occ.has(ck(x, z)) || !!nearRoad(x, z, 9);
    const viz = new THREE.Group(); viz.name = 'vizinhos';
    viz.add(buildOlinda(m, vizFora, ocupado), buildPiedade(m, vizFora, ocupado)); // Olinda ao norte, Piedade e Candeias ao sul
    scene.add(viz);
    vizFora = null;
    lap('vizinhos');
  }
  lap('indiceRuas');
  pt.qtdPredios = data.buildings.length; pt.gerados = data.buildings.filter((b) => b.infill || b.gen).length;
  window.predioTimes = pt;

  progress('Asfaltando as ruas…');
  await tick();
  scene.add(buildRoads(data.roads, data.aeroway, photos, decks));
  if (!/semcais/.test(location.search)) scene.add(buildQuays(data.roads, isWater, isSolid));
  { const est = await estP; if (est?.lotes?.length) scene.add(buildParking(est.lotes)); }
  // Detalhe de rua (meio-fio, calçada de pedra, faixa de pedestre, térreo comercial): monta depois que o jogo
  // abre, em fatias de ~8 ms entre os quadros, para não pesar no carregamento. Começa no primeiro update().
  const street = new THREE.Group();
  scene.add(street);
  const streetChunks = []; // fiação dos postes (some com a distância)
  const ruaBlocos = streetLazy(); // detalhe de rua: blocos montados só perto da câmera (rua.js)
  const busStations = []; // estações do corredor de ônibus no canteiro (rua.js): { x, z, dx, dz, len, w }
  let shops = null, furniture = null, night = 0, streetStarted = false;
  const buildStreet = async () => {
    const t0 = performance.now();
    busy.ms = 0;
    const walks = await buildSidewalks(street, data.roads, { isDrive, isWater, roadW: ROAD_W, photos });
    ruaBlocos.add(walks.lazy);
    const zebras = await buildCrosswalks(street, data.roads, { isDrive, roadW: ROAD_W, photos });
    ruaBlocos.add(zebras.lazy);
    furniture = await buildFurniture(street, data.roads, { signals: zebras.signals, corners: zebras.corners, isDrive, isSolid, isWater, roadW: ROAD_W });
    ruaBlocos.add(furniture.lazy);
    const corredor = await buildBusCorridor(street, data.roads, { roadW: ROAD_W, nearRoad }); // Conde da Boa Vista
    ruaBlocos.add(corredor.lazy);
    busStations.push(...corredor.stations);
    shops = await buildShopfronts(street, fronts, { isDrive, isSolid, nearRoad, roadW: ROAD_W, pois: data.pois });
    ruaBlocos.add(shops.lazy);
    shops.setNight(night);
    fronts.length = 0; // as fachadas que desenham alguma coisa ficam guardadas nos blocos da rua
    window.ruaTimes = { trabalho: Math.round(busy.ms), total: Math.round(performance.now() - t0) }; // ms (trabalho = só o tempo de CPU das fatias)
    // ?hashgrade: hash da grade de colisão já com tudo carimbado e a contagem da rua (para ver se duas cargas dão a mesma cidade)
    if (new URLSearchParams(location.search).has('hashgrade')) { let h = 2166136261; for (let i = 0; i < mask.length; i++) h = Math.imul(h ^ mask[i], 16777619); window.cidadeHash = { grade: h >>> 0, rua: [walks.segs, zebras.count, shops.shops, shops.tables, shops.reliefs, shops.strips, furniture.signals, furniture.plates, furniture.stops].join(',') }; }
    console.info('rua:', walks.segs, 'trechos de calçada,', zebras.count, 'faixas,', shops.shops, 'lojas,', shops.tables, 'mesas,', shops.reliefs, 'fachadas com relevo,', shops.strips, 'calçadas coladas na fachada,', furniture.signals, 'semáforos,', furniture.plates, 'placas de rua,', furniture.stops, 'pontos de ônibus,', lights.wires, 'vãos de fiação', JSON.stringify(window.ruaTimes));
  };
  const curbAt = curbHeight(nearRoad, isDrive, ROAD_W);
  const groundY = (x, z) => heightAt(x, z) + curbAt(x, z); // chão com a calçada (gente anda em cima do meio-fio)
  // semáforo fechado à frente? (distância até a linha de parada, ou null; null também antes de montar a rua)
  const stopAhead = (x, z, fx, fz) => furniture ? furniture.stopAhead(x, z, fx, fz) : null;
  // escadarias dos morros: degraus, espelho pintado e corrimão; a célula vira "escada" (carro não passa)
  scene.add(buildStairs(data.roads, (x, z) => { const i = cellOf(x, z); if (i >= 0) mask[i] |= STAIRS; }));
  const lights = buildStreetLights(data.roads, blocked);
  streetChunks.push(...lights.wireChunks); // a fiação dos postes também some com a distância
  scene.add(lights.group);

  progress('Erguendo igrejas, pontes e praças…');
  await tick();
  const isRoad = (x, z) => { const i = cellOf(x, z); return i >= 0 && (mask[i] & ROAD) !== 0; };
  const landmarks = buildLandmarks(scene, data, named, { isSolid, isWater, isRoad, isDrive, orla, photos, grid });
  progress('Pendurando placas de lojas, escolas e restaurantes…');
  await tick();
  const placesGroup = new THREE.Group();
  const places = buildPlaces(placesGroup, data, { isSolid, isWater });
  scene.add(placesGroup);
  // comunidades: paredão de brega, roda de passinho, terreiro, pelada e beira-mar
  const cultureGroup = new THREE.Group();
  const culture = buildCulture(cultureGroup, data, { isSolid, isWater, isRoad, grid });
  scene.add(cultureGroup);
  // rio do Marco Zero: barqueiros, flesheiros e o Galo da Madrugada
  const rio = buildRio(cultureGroup, data, { isSolid, isWater });

  // POIs nomeados (para o HUD e o mapa)
  const pois = data.pois.slice();
  for (const [name, list] of Object.entries(named)) {
    const p = list[0].p;
    const cx = p.reduce((s, q) => s + q[0], 0) / p.length, cz = p.reduce((s, q) => s + q[1], 0) / p.length;
    if (/igreja|basílica|teatro|mercado|museu|paço|torre|palácio|forte|casa da cultura|sinagoga|capela|estação|caixa cultural|embaixada|shopping|aeroporto|terminal/i.test(name)) pois.push({ name, kind: 'building', x: cx, z: cz });
  }

  // esconde os quarteirões fora do alcance da neblina
  const update = (cam, t = 0) => {
    if (!streetStarted) { streetStarted = true; if (!new URLSearchParams(location.search).has('semrua')) setTimeout(buildStreet, 0); } // ?semrua: sem o detalhe de rua (para comparar)
    furniture?.update(t); // ciclo dos semáforos
    landmarks.update?.(t, cam); // roda-gigante, barco pirata, carrossel, show do Dokas
    culture.update(t, cam);
    rio.update(t, cam, culture.bodies);
    chunks.update(cam); // monta os blocos de prédio perto, desmonta os longe
    ruaBlocos.update(cam);
    for (const c of streetChunks) {
      const dx = c.cx - cam.x, dz = c.cz - cam.z, v = dx * dx + dz * dz < c.cull * c.cull;
      for (const mesh of c.meshes) mesh.visible = v;
    }
  };

  const setNight = (n) => {
    landmarks.setNight?.(n);
    places.setNight(n);
    night = n; shops?.setNight(n);
    culture.setNight(n);
    rio.setNight(n);
    for (const k of ['colonial', 'modern', 'tower', 'casa', 'comunidade']) chunks.mats[k].emissiveIntensity = n * 1.1;
    lights.lamp.emissiveIntensity = n * 6;
    lights.glow.opacity = n * 0.9;
    lights.glowMesh.visible = n > 0.02;
  };

  return { data, grid, blocked, isWater, isSolid, isRoad, isDrive, groundY, stopAhead, busStations, bounds: { xmin, xmax, zmin, zmax }, mapCanvas, pois, landmarks, culture, rio, isStairs, update, setNight };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// x da Av. Boa Viagem / Herculano Bandeira por faixa de z, para saber o que é "orla"
function orlaIndex(roads, zmin, zmax) {
  const BAND = 50;
  const n = Math.ceil((zmax - zmin) / BAND);
  const xs = new Float32Array(n).fill(NaN);
  for (const r of roads) {
    if (!r.n || !/^Avenida (Boa Viagem|Herculano Bandeira)/.test(r.n)) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1];
      const steps = Math.max(1, Math.ceil(Math.abs(bz - az) / 20));
      for (let k = 0; k <= steps; k++) {
        const x = ax + ((bx - ax) * k) / steps, z = az + ((bz - az) * k) / steps;
        const b = Math.floor((z - zmin) / BAND);
        if (b >= 0 && b < n && !(xs[b] >= x)) xs[b] = x;
      }
    }
  }
  return {
    // distância a oeste da avenida beira-mar (negativo = lado da praia); NaN se não há orla nessa altura
    inland(x, z) { const b = Math.floor((z - zmin) / BAND); return b >= 0 && b < n ? xs[b] - x : NaN; },
    xs, zmin, BAND,
  };
}

// ---------------------------------------------------------------------------- geometria

function dropArray() { this.array = null; }
const QUANT = typeof location === 'undefined' || !new URLSearchParams(location.search).has('semquant'); // ?semquant: blocos de prédio em Float32 (para comparar)

class Acc {
  constructor(uv = true) { this.cap = 4096; this.n = 0; this.ni = 0; this.hasUv = uv; this.alloc(); this.idx = new Uint32Array(8192); }
  alloc() {
    const grow = (a, k) => { const b = new (a ? a.constructor : Float32Array)(this.cap * k); if (a) b.set(a); return b; };
    this.pos = grow(this.pos, 3); this.nor = grow(this.nor, 3);
    this.col = this.col ? (() => { const b = new Uint8Array(this.cap * 3); b.set(this.col); return b; })() : new Uint8Array(this.cap * 3);
    if (this.hasUv) this.uv = grow(this.uv, 2);
  }
  v(x, y, z, nx, ny, nz, u, w, r, g, b) {
    if (this.n >= this.cap) { this.cap *= 2; this.alloc(); }
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.nor[i * 3] = nx; this.nor[i * 3 + 1] = ny; this.nor[i * 3 + 2] = nz;
    if (this.hasUv) { this.uv[i * 2] = u; this.uv[i * 2 + 1] = w; }
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    return i;
  }
  t(a, b, c) {
    if (this.ni + 3 > this.idx.length) { const n = new Uint32Array(this.idx.length * 2); n.set(this.idx); this.idx = n; }
    this.idx[this.ni++] = a; this.idx[this.ni++] = b; this.idx[this.ni++] = c;
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, this.n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, this.n * 3), 3));
    if (this.hasUv) g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, this.n * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, this.n * 3), 3, true));
    g.setIndex(new THREE.BufferAttribute(this.idx.slice(0, this.ni), 1));
    g.computeBoundingSphere();
    // depois de ir para a placa de vídeo, os vértices não são mais usados no JS (colisão usa a grade)
    for (const at of [...Object.values(g.attributes), g.index]) at.onUpload(dropArray);
    return g;
  }
  // Versão compacta (blocos de prédios): posição em Int16 relativa à caixa do bloco, normal em Int8, cor em Uint8,
  // índice em Uint16 quando cabe. ~2x menos memória, e a maioria dos blocos do município nunca vai para a placa
  // (o array fica no JS até lá). Devolve também o centro e a escala para pôr no Mesh.
  geoQ() {
    const n = this.n, P = this.pos, N = this.nor;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < n * 3; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], sc = [Math.max(0.5, (x1 - x0) / 2), Math.max(0.5, (y1 - y0) / 2), Math.max(0.5, (z1 - z0) / 2)];
    const q = new Int16Array(n * 3), qn = new Int8Array(n * 3);
    for (let i = 0; i < n * 3; i += 3) {
      for (let k = 0; k < 3; k++) q[i + k] = Math.round(((P[i + k] - c[k]) / sc[k]) * 32767);
      // a normal no espaço do objeto é S·n (o normalMatrix desfaz a escala)
      const a = N[i] * sc[0], b = N[i + 1] * sc[1], d = N[i + 2] * sc[2], l = Math.hypot(a, b, d) || 1;
      qn[i] = Math.round((a / l) * 127); qn[i + 1] = Math.round((b / l) * 127); qn[i + 2] = Math.round((d / l) * 127);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(q, 3, true));
    g.setAttribute('normal', new THREE.BufferAttribute(qn, 3, true));
    if (this.hasUv) g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, n * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, n * 3), 3, true));
    g.setIndex(new THREE.BufferAttribute(n < 65536 ? Uint16Array.from(this.idx.subarray(0, this.ni)) : this.idx.slice(0, this.ni), 1));
    g.computeBoundingSphere();
    for (const at of [...Object.values(g.attributes), g.index]) at.onUpload(dropArray);
    this.pos = this.nor = this.uv = this.col = this.idx = null; // o acumulador não é mais usado
    return { g, c, sc };
  }
}

const NOT_TALL = new Set(['house', 'church', 'garage', 'garages', 'shed', 'kiosk']);
// altura média dos prédios em células de 100 m (GHSL GHS-BUILT-H 2018, Comissão Europeia, CC BY 4.0),
// gerada por scripts/ghsl-altura.py em public/data/altura-ghsl.json. -1 = sem dado. Mesma origem dos dois mapas.
let GHSL = null;
const LOW_SHAPE = new Set(['school', 'university', 'hospital', 'industrial', 'warehouse', 'retail', 'supermarket', 'public', 'stadium', 'sports_centre', 'hangar', 'train_station']);
// Altura típica do lugar pelo próprio OSM: onde há 8 ou mais prédios com altura marcada em volta (células de 100 m,
// 3 × 3), vale o 75º percentil deles. No Bairro do Recife a GHSL diz 26 m de média, mas os 111 prédios marcados no OSM
// ficam em 13 m (sobrado alto de 3 a 4 andares): sem isso, toda planta de 300 a 2.500 m² sem altura virava torre.
// Fora do centro quase ninguém marca altura, e a regra nem entra.
let OSMH = null;
function osmHeights(buildings) {
  const cells = new Map();
  for (const b of buildings) {
    if (!(b.h > 0) || b.infill || b.gen || b.ms) continue;
    const p = b.p; let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } x /= p.length; z /= p.length;
    const k = Math.floor(x / 100) * 65536 + Math.floor(z / 100);
    let l = cells.get(k); if (!l) cells.set(k, (l = [])); l.push(b.h);
  }
  OSMH = { cells, cache: new Map() };
}
function localHeight(x, z) {
  if (!OSMH) return -1;
  const i = Math.floor(x / 100), j = Math.floor(z / 100), key = i * 65536 + j;
  let v = OSMH.cache.get(key);
  if (v === undefined) {
    const a = [];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const l = OSMH.cells.get((i + di) * 65536 + j + dj); if (l) a.push(...l); }
    if (a.length >= 8) { a.sort((p, q) => p - q); v = a[Math.floor(a.length * 0.75)]; } else v = -1;
    OSMH.cache.set(key, v);
  }
  return v;
}
function areaHeight(x, z) { // maior altura média entre a célula e as 8 vizinhas (a torre puxa a média do quarteirão)
  const L = localHeight(x, z);
  const g = GHSL; if (!g) return L;
  const i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell);
  if (i < 1 || j < 1 || i >= g.w - 1 || j >= g.h - 1 || g.v[j * g.w + i] < 0) return L;
  let m = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) m = Math.max(m, g.v[(j + dj) * g.w + i + di]);
  return L >= 0 ? Math.min(m * g.scale, L) : m * g.scale;
}
const NO_SHOP = new Set(['house', 'church', 'cathedral', 'garage', 'garages', 'shed', 'school', 'hospital']);
// Altura de prédio sem altura no OSM. Onde a GHSL diz que o lugar é baixo (média < 10 m), nada passa de
// ~1,5 vez a média (mínimo 7 m): o chute por tipo e área não cria prédio de 8 andares no meio do casario.
// Igreja fica de fora (torre), a orla também (regra própria), e o morro também (lá a GHSL lê a ladeira como altura).
function defaultHeight(b, area, r, x, z, orla) {
  const h = guessHeight(b, area, r, x, z, orla);
  if (b.t === 'church' || b.t === 'cathedral' || inHills(x, z)) return h;
  const d = orla.inland(x, z); if (d > -80 && d < 1500) return h; // orla de Pina e Boa Viagem tem regra própria
  const H = areaHeight(x, z);
  let out = H >= 0 && H < 10 ? Math.min(h, Math.max(7, H * 1.5)) : h;
  // onde o OSM diz a altura típica, nada sem altura passa de 1,6 vez ela (mínimo 12 m): no Bairro do Recife, 21 m
  const L = localHeight(x, z);
  if (L >= 0 && out > Math.max(12, L * 1.6)) { out = Math.max(12, L * 1.6); if (typeof window !== 'undefined') window.alturaOSM = (window.alturaOSM || 0) + 1; }
  return out;
}
function guessHeight(b, area, r, x, z, orla) {
  const t = b.t;
  // Pina e Boa Viagem: paredão de prédios na beira-mar e muitos espigões nas quadras de trás
  const d = orla.inland(x, z);
  if (d > -80 && d < 1500 && area > 280 && !NOT_TALL.has(t)) {
    if (d < 160) return 45 + r * 75;
    if (r > 0.25) return 18 + r * 70;
  }
  // Espigões fora da orla: onde a GHSL diz que a média do lugar é alta, prédio de planta grande vira torre.
  // No morro a GHSL confunde ladeira com altura (Alto José Bonifácio dá 24 m), então lá não vale.
  if (!NOT_TALL.has(t) && !LOW_SHAPE.has(t) && !inHills(x, z)) {
    const H = areaHeight(x, z);
    // Bairro de torres (Graças, Jaqueira, Aflitos, Parnamirim, Casa Forte, Boa Vista: média da GHSL de 12 m ou mais):
    // planta de prédio residencial é torre de apartamento de 10 a 40 andares. A média da GHSL fica baixa porque mistura
    // as torres com as casas em volta (Jaqueira: 13 a 16 m, com um anel de torres de 25 a 40 andares nas fotos).
    // Torre fina de 300 a 500 m² é comum no Recife: metade delas vira torre.
    const resid = t === 'yes' || t === 'residential' || t === 'apartments';
    if (H >= 12 && resid && area <= 2500 && (area >= 500 || (area >= 300 && r > 0.5))) return Math.min(120, 30 + (H - 12) * 3 + r * 50);
    if (H >= 12 && area >= 300 && area <= 2500) return Math.min(110, Math.max(15, H * (0.9 + r * 0.8)));
    if (H >= 12 && area >= 160 && area < 300 && r > 0.55) return 9 + r * 6; // prediozinho de 3 a 4 andares
    // bairro misto (Casa Forte, Poço, Parnamirim, ~10 a 12 m de média): planta grande de prédio residencial
    // é quase sempre edifício de apartamentos. Abaixo de 10 m (Várzea, ~8 m) é casario: planta grande ali é
    // igreja, convento, escola ou galpão, não torre.
    if (H >= 10 && area >= 500 && area <= 2500 && (t === 'yes' || t === 'residential' || t === 'apartments')) return 18 + (H - 10) * 4 + r * 24;
  }
  if (t === 'house' || (t === 'residential' && area < 120)) return 5.5 + r * 3;
  if (t === 'church' || t === 'cathedral') return 14 + r * 6;
  if (t === 'industrial' || t === 'warehouse' || t === 'hangar') return 8 + r * 4;
  if (t === 'apartments') return 15 + r * 45;
  if (t === 'commercial' || t === 'office') return area > 600 ? 12 + r * 30 : 8 + r * 12;
  if (area > 2500) return 10 + r * 12;
  if (area < 90) return 4 + r * 3.5;
  return 7 + Math.floor(r * 3.99) * 3.2;
}

const KINDS = ['colonial', 'modern', 'tower', 'casa', 'comunidade'];
// prédios reais da Microsoft (b.ms) também ganham loja, toldo e calçada colada quando dão para a pista; ?semlojams desliga
const MS_SHOPS = typeof location === 'undefined' || !new URLSearchParams(location.search).has('semlojams');
const REC = 20; // números por prédio guardado (ver ch.rec.push)
function buildBuildings(buildings, overrides, orla, roofTx, photos, fronts, isDrive) {
  const CH = 400;
  osmHeights(buildings);
  const chunks = new Map();
  const col = new THREE.Color(), roof = new THREE.Color();
  // cores convertidas uma vez só (são poucas, repetidas em ~190 mil prédios)
  const colCache = new Map();
  const setCol = (c, s) => { let v = colCache.get(s); if (!v) colCache.set(s, (v = new THREE.Color(s))); c.copy(v); };
  for (const b of buildings) {
    let ring = b.p.slice();
    if (!b.infill) { // o casario gerado já vem limpo: retângulo de 4 cantos, sem ponto repetido
      if (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
      ring = ring.filter((p, i) => i === 0 || p[0] !== ring[i - 1][0] || p[1] !== ring[i - 1][1]);
    }
    if (ring.length < 3) continue;
    let A = 0, cx = 0, cz = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      A += p[0] * q[1] - q[0] * p[1];
      cx += p[0]; cz += p[1];
    }
    A /= 2; cx /= ring.length; cz /= ring.length;
    if (A > 0) ring.reverse();
    const area = Math.abs(A);
    if (area < 6) continue;
    const r = hash(cx, cz);
    const ov = (b.n && overrides[b.n]) || {};
    if (ov.skip) continue;
    // nada sem nome na faixa de areia da Av. Boa Viagem: na foto apareciam sobrados em cima da praia (contorno da
    // Microsoft ou sem tipo no OSM). Só de 8 a 150 m do lado do mar e do começo da avenida para o sul: mais para dentro
    // do mar, no Pina, ficam Brasília Teimosa e o Pina, que estão a leste da avenida e não podem sumir.
    // Postos de salva-vidas e quiosques com nome ficam.
    if (!b.n && (b.ms || b.gen || b.t === 'yes') && cz > -700) { const d = orla.inland(cx, cz); if (d < -8 && d > -150) { if (typeof window !== 'undefined') window.praiaSemPredio = (window.praiaSemPredio || 0) + 1; continue; } }
    let h = ov.h ?? b.h ?? defaultHeight(b, area, r, cx, cz, orla);
    const flatRoof = b.t === 'roof' || b.t === 'carport';
    if (flatRoof) h = 4.5;
    // Torre de apartamento (varanda, reboco claro): na orla a partir de 30 m; nos outros bairros, prédio residencial de
    // 8 andares para cima (Casa Forte, Graças, Aflitos têm torres de apartamento, não prédio de escritório). No centro
    // antigo (onde o OSM marca alturas: localHeight) os prédios altos são comerciais e continuam "modern".
    const resid = !b.t || b.t === 'yes' || b.t === 'residential' || b.t === 'apartments';
    // Centro comercial antigo (Recife Antigo, Santo Antônio, São José e o miolo da Boa Vista): prédio alto ali é
    // escritório modernista. Fora dele, prédio residencial alto é torre de apartamento, mesmo onde o OSM marca alturas
    // (Graças e Aflitos têm algumas, e lá as torres saíam com fachada de escritório)
    const centro = Math.hypot(cx - 2300, cz + 3700) < 1300 && localHeight(cx, cz) >= 0;
    const kind = b.style || (h <= 16.5 ? 'colonial' : (h >= 30 && orla.inland(cx, cz) < 1500) || (resid && h >= 24 && !b.n && !centro) ? 'tower' : 'modern');
    // no morro: parede desce até o ponto mais baixo do terreno e o prédio assenta no mais alto
    let gLo = 0, gHi = 0;
    if (inHills(cx, cz)) { gLo = Infinity; gHi = -Infinity; for (const p of ring) { const y = heightAt(p[0], p[1]); gLo = Math.min(gLo, y); gHi = Math.max(gHi, y); } gLo = gHi > 0.05 ? gLo - 0.3 : 0; }
    const top = gHi + h;
    const palette = kind === 'colonial' ? PASTEL : kind === 'tower' ? TOWER : MODERN;
    setCol(col, ov.color || (b.c && /^(#[0-9a-f]{3}([0-9a-f]{3})?|[a-z]+)$/i.test(b.c) ? b.c : null) || palette[Math.floor(hash(cz, cx) * palette.length)]);
    setCol(roof, flatRoof ? '#7a7f84' : kind === 'colonial' ? ROOF_TILE[Math.floor(r * ROOF_TILE.length)] : '#8d8d8a');
    const cr = col.r * 255, cg = col.g * 255, cb = col.b * 255;

    const key = Math.floor(cx / CH) * 100003 + Math.floor(cz / CH); // número, não texto
    let ch = chunks.get(key);
    if (!ch) chunks.set(key, (ch = { cx: (Math.floor(cx / CH) + 0.5) * CH, cz: (Math.floor(cz / CH) + 0.5) * CH, rec: [], pts: [] }));
    const floorH = kind === 'colonial' ? 3.6 : 3.0;
    const winW = kind === 'tower' ? 6 : 4;
    const variant = Math.floor(hash(cx * 1.37 + 11, cz * 0.71 - 5) * 4) * 1000; // qual das 4 fachadas do atlas
    // b.infill / b.gen: casario de enchimento (infill.js), só a caixa com textura: sem loja, relevo nem teste de fachada
    const shopOk = !b.infill && !b.gen && (!b.ms || MS_SHOPS) && !flatRoof && !b.n && !ov.style && gLo === 0 && gHi === 0 && h >= 4.5 && (kind === 'colonial' || kind === 'modern' || kind === 'casa') && !NO_SHOP.has(b.t);
    if (shopOk) {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
        if (len < 3.5) continue;
        const nx = -dz / len, nz = dx / len;
        const nWin = Math.max(1, Math.round(len / winW)), floors = Math.max(1, Math.round(h / floorH));
        // de frente para a pista? (primeira célula de pista entre 2 e 9 m da parede)
        const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
        for (let d = 2; d <= 9; d += 1.5) if (isDrive(mx + nx * d, mz + nz * d)) { fronts.push({ p, q, nx, nz, len, nWin, kind, h, b, dHit: d, variant: variant / 1000, floors }); break; }
      }
    }
    // a geometria só é montada quando a câmera chega perto (makeChunk): aqui fica só o necessário, em números
    const rh = (kind === 'colonial' && !flatRoof && area > 40 ? h - 0.6 : h) + gHi; // casas coloniais: telhado 0,6 m abaixo do topo (platibanda)
    const t = b.tank;
    ch.rec.push(ch.pts.length, ring.length, Math.max(0, KINDS.indexOf(kind)), flatRoof ? 1 : 0, gLo, top, rh, h, cr, cg, cb, roof.r * 255, roof.g * 255, roof.b * 255, variant, t ? t[0] : NaN, t ? t[1] : NaN, area, cx, cz);
    for (const q of ring) ch.pts.push(q[0], q[1]);
  }

  const mats = {
    colonial: facadeMaterial('colonial', roofTx.map, photos),
    modern: facadeMaterial('modern', roofTx.map, photos),
    tower: facadeMaterial('tower', roofTx.map, photos),
    casa: facadeMaterial('casa', roofTx.map, photos),
    comunidade: facadeMaterial('comunidade', roofTx.map, photos),
    roof: roofMaterial(photos),
  };
  const group = new THREE.Group();
  const list = [];
  for (const ch of chunks.values()) list.push({ cx: ch.cx, cz: ch.cz, meshes: [], rec: Float32Array.from(ch.rec), pts: Float32Array.from(ch.pts), built: false });
  chunks.clear();

  // monta os vértices de um bloco a partir dos números guardados
  const makeChunk = (e) => {
    const acc = {}; for (const k of [...KINDS, 'roof']) acc[k] = new Acc();
    const R = e.rec, P = e.pts, rf = acc.roof;
    for (let o = 0; o < R.length; o += REC) {
      const off = R[o], n = R[o + 1], kind = KINDS[R[o + 2]], flatRoof = R[o + 3] === 1, gLo = R[o + 4], top = R[o + 5], rh = R[o + 6], h = R[o + 7];
      const cr = R[o + 8], cg = R[o + 9], cb = R[o + 10], rr = R[o + 11], rg = R[o + 12], rb = R[o + 13], variant = R[o + 14], tx = R[o + 15], tz = R[o + 16], area = R[o + 17], cx = R[o + 18], cz = R[o + 19];
      const wall = acc[kind], floorH = kind === 'colonial' ? 3.6 : 3.0, winW = kind === 'tower' ? 6 : 4;
      if (!flatRoof) {
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, px = P[off + i * 2], pz = P[off + i * 2 + 1], qx = P[off + j * 2], qz = P[off + j * 2 + 1];
          const dx = qx - px, dz = qz - pz, len = Math.hypot(dx, dz);
          if (len < 0.05) continue;
          const nx = -dz / len, nz = dx / len;
          const nWin = Math.max(1, Math.round(len / winW)), floors = Math.max(1, Math.round(h / floorH));
          const a = wall.v(px, gLo, pz, nx, 0, nz, variant, 0, cr, cg, cb);
          wall.v(qx, gLo, qz, nx, 0, nz, variant + nWin, 0, cr, cg, cb);
          wall.v(qx, top, qz, nx, 0, nz, variant + nWin, floors, cr, cg, cb);
          wall.v(px, top, pz, nx, 0, nz, variant, floors, cr, cg, cb);
          wall.t(a, a + 1, a + 2); wall.t(a, a + 2, a + 3);
        }
      }
      let tris;
      // quatro cantos (a maioria, incluindo todo o casario gerado): leque direto; senão, triangulação completa
      if (n === 4) tris = [[0, 1, 2], [0, 2, 3]];
      else try { const v = []; for (let i = 0; i < n; i++) v.push(new THREE.Vector2(P[off + i * 2], P[off + i * 2 + 1])); tris = THREE.ShapeUtils.triangulateShape(v, []); } catch { continue; }
      const base = rf.n;
      for (let i = 0; i < n; i++) { const x = P[off + i * 2], z = P[off + i * 2 + 1]; rf.v(x, rh, z, 0, 1, 0, x / 8, z / 8, rr, rg, rb); }
      for (const [a, bb, c] of tris) {
        const ax = P[off + a * 2], az = P[off + a * 2 + 1], bx = P[off + bb * 2], bz = P[off + bb * 2 + 1], qx = P[off + c * 2], qz = P[off + c * 2 + 1];
        const cy = (bz - az) * (qx - ax) - (bx - ax) * (qz - az);
        if (cy >= 0) rf.t(base + a, base + bb, base + c); else rf.t(base + a, base + c, base + bb);
      }
      // caixa d'água azul na laje das casas geradas
      if (!Number.isNaN(tx)) { box(rf, cx + tx, cz + tz, 1.3, 1.3, top, top + 1.1, 47, 109, 181); box(rf, cx + tx, cz + tz, 1.45, 1.45, top + 1.1, top + 1.25, 40, 92, 160); }
      // casa de máquinas e caixa d'água em cima dos prédios altos. Torre de apartamento varia o topo: só a casa de
      // máquinas, cobertura recuada (o duplex do último andar, na cor da torre) ou coroa de pilares com laje vazada
      if (h >= 22 && !flatRoof && area > 150) {
        // eixo da torre pelo lado mais comprido (as caixas seguem a planta, não o norte)
        let ux = 1, uz = 0, best = 0;
        for (let i = 0; i < n; i++) { const j = (i + 1) % n, ex = P[off + j * 2] - P[off + i * 2], ez = P[off + j * 2 + 1] - P[off + i * 2 + 1], l = Math.hypot(ex, ez); if (l > best) { best = l; ux = ex / l; uz = ez / l; } }
        const s0 = Math.sqrt(area), sz = Math.max(3, Math.min(8, s0 * 0.3));
        const crown = kind === 'tower' ? Math.floor(hash(cx * 0.7 + 3, cz * 1.3) * 3) : 0;
        let y = top;
        if (crown === 1) { // cobertura recuada
          const w = s0 * 0.62, d = s0 * 0.5;
          obox(rf, cx, cz, ux, uz, w + 0.6, d + 0.6, y, y + 0.35, cr, cg, cb);       // laje da cobertura
          obox(rf, cx, cz, ux, uz, w, d, y + 0.35, y + 3.1, cr * 0.92, cg * 0.92, cb * 0.92);
          obox(rf, cx, cz, ux, uz, w + 1.2, d + 1.2, y + 3.1, y + 3.4, cr, cg, cb);  // beiral
          y += 3.4;
        } else if (crown === 2) { // coroa: quatro pilares e a laje vazada em cima
          const w = s0 * 0.7, d = s0 * 0.55, nx = -uz, nz = ux;
          for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) obox(rf, cx + ux * a * w / 2 + nx * c * d / 2, cz + uz * a * w / 2 + nz * c * d / 2, ux, uz, 0.6, 0.6, y, y + 4.2, cr, cg, cb);
          for (const c of [-1, 1]) { obox(rf, cx + nx * c * d / 2, cz + nz * c * d / 2, ux, uz, w + 0.6, 0.6, y + 4.2, y + 4.8, cr, cg, cb); obox(rf, cx + ux * c * w / 2, cz + uz * c * w / 2, ux, uz, 0.6, d + 0.6, y + 4.2, y + 4.8, cr, cg, cb); }
        }
        obox(rf, cx, cz, ux, uz, sz, sz * 0.8, y, y + 3.2, 215, 212, 205);
        obox(rf, cx + ux * sz * 0.15, cz + uz * sz * 0.15, ux, uz, sz * 0.6, sz * 0.5, y + 3.2, y + 4.8, 200, 198, 192);
      }
    }
    for (const k of [...KINDS, 'roof']) {
      if (!acc[k].ni) continue;
      let mesh;
      if (QUANT) { const { g, c, sc } = acc[k].geoQ(); mesh = new THREE.Mesh(g, mats[k]); mesh.position.set(c[0], c[1], c[2]); mesh.scale.set(sc[0], sc[1], sc[2]); }
      else mesh = new THREE.Mesh(acc[k].geo(), mats[k]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      e.meshes.push(mesh);
    }
    e.built = true;
  };
  const dropChunk = (e) => { for (const m of e.meshes) { group.remove(m); m.geometry.dispose(); } e.meshes.length = 0; e.built = false; };
  // Perto da câmera (menos de 1,7 km) o bloco é montado; longe (mais de 2,2 km), desmontado. Monta os mais
  // perto primeiro, até ~6 ms por quadro (pelo menos um). ?todosblocos monta tudo de uma vez (para comparar).
  const ALL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('todosblocos');
  if (ALL) for (const e of list) makeChunk(e);
  const update = (cam) => {
    const want = [];
    for (const e of list) {
      const d = Math.hypot(e.cx - cam.x, e.cz - cam.z);
      if (!e.built && d < 1700) want.push([d, e]);
      else if (e.built && d > 2200 && !ALL) dropChunk(e);
      const v = d < 1550;
      for (const m of e.meshes) m.visible = v;
    }
    if (!want.length) return;
    want.sort((x, y) => x[0] - y[0]);
    const t0 = performance.now();
    for (const [d, e] of want) { makeChunk(e); for (const m of e.meshes) m.visible = d < 1550; if (performance.now() - t0 > 6) break; }
  };
  return { group, list, mats, update, makeChunk };
}

// postes nas avenidas e ruas principais, com a mancha de luz no chão
function buildStreetLights(roads, blocked) {
  // postes em quase toda rua (mais juntos nas avenidas); nas pontes e viadutos ficam na borda da pista.
  // As pontes com nome que já ganharam lampiões próprios (classics.js) ficam de fora.
  const KINDS = { trunk: 26, primary: 26, secondary: 28, tertiary: 32, residential: 40, unclassified: 42, living_street: 40, pedestrian: 30, service: 60 };
  const spots = [];
  // fiação: dois fios com barriga entre postes seguidos do mesmo lado da rua (fora das pontes), em blocos de 400 m
  const wires = new Map();
  let nWires = 0;
  const wire = (A, B) => {
    const key = Math.floor((A[0] + B[0]) / 800) + ',' + Math.floor((A[1] + B[1]) / 800);
    let arr = wires.get(key); if (!arr) wires.set(key, (arr = []));
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]), sag = 0.25 + L * 0.012;
    for (const h of [7.05, 6.55]) for (let k = 0; k < 6; k++) {
      for (const t of [k / 6, (k + 1) / 6]) arr.push(A[0] + (B[0] - A[0]) * t, A[2] + (B[2] - A[2]) * t + h - sag * 4 * t * (1 - t), A[1] + (B[1] - A[1]) * t);
    }
    nWires++;
  };
  for (const r of roads) {
    const step = KINDS[r.k];
    if (!step || r.tu) continue;
    const bridge = !!r.b;
    if (bridge && /^Ponte /.test(r.n || '') && !/Doze de Setembro/.test(r.n)) continue;
    const w = ROAD_W[r.k];
    // primeiro poste sorteado pela posição da rua (não por Math.random): o poste entra na colisão, e com sorteio
    // a cada carga a cidade mudava um pouco (lojas e mesas caíam em outro lugar)
    const hh = Math.sin(r.p[0][0] * 12.9898 + r.p[0][1] * 78.233) * 43758.5453;
    let acc = (hh - Math.floor(hh)) * step, side = 1;
    const last = { 1: null, '-1': null };
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.1) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      for (; acc < len; acc += step) {
        const off = bridge ? w / 2 - 0.35 : w / 2 + 0.7;
        const x = ax + dx * acc - dz * off * side, z = az + dz * acc + dx * off * side;
        if (bridge || !blocked(x, z)) {
          spots.push([x, z, Math.atan2(-dx * side, -dz * side)]); stampDisc(x, z, 0.15); // poste é obstáculo
          const P = [x, z, heightAt(x, z)];
          if (!bridge && last[side] && Math.hypot(x - last[side][0], z - last[side][1]) < 95) wire(last[side], P);
          last[side] = bridge ? null : P;
        } else last[side] = null;
        if (!r.o) side = -side;
      }
      acc -= len;
    }
  }
  const group = new THREE.Group();
  const N = spots.length;
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 7.5, 6).translate(0, 3.75, 0);
  const armGeo = new THREE.BoxGeometry(1.6, 0.08, 0.08).translate(-0.8, 7.4, 0);
  const headGeo = new THREE.BoxGeometry(0.6, 0.12, 0.3).translate(-1.5, 7.32, 0);
  const pole = new THREE.MeshStandardMaterial({ color: '#5d6266', metalness: 0.5, roughness: 0.5 });
  const lamp = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffcf7a', emissiveIntensity: 0 });
  const poles = new THREE.InstancedMesh(mergeBoxes(poleGeo, armGeo), pole, N);
  const heads = new THREE.InstancedMesh(headGeo, lamp, N);
  const gtex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(0.45, 'rgba(255,190,110,0.45)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const glow = new THREE.MeshBasicMaterial({ map: gtex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const glowMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(22, 22).rotateX(-Math.PI / 2), glow, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  spots.forEach(([x, z, a], i) => {
    // o braço (-x local) aponta para o meio da rua
    q.setFromAxisAngle(up, a);
    const gy = heightAt(x, z);
    m.compose(p.set(x, gy, z), q, one);
    poles.setMatrixAt(i, m); heads.setMatrixAt(i, m);
    m.compose(p.set(x - Math.cos(a) * 2.5, heightAt(x - Math.cos(a) * 2.5, z + Math.sin(a) * 2.5) + 0.19 + (gy ? 0.15 : 0), z + Math.sin(a) * 2.5), q, one);
    glowMesh.setMatrixAt(i, m);
  });
  for (const im of [poles, heads, glowMesh]) { im.computeBoundingSphere(); group.add(im); }
  poles.castShadow = true;
  glowMesh.visible = false;
  const wireMat = new THREE.LineBasicMaterial({ color: '#1c1c1c' });
  const wireChunks = [];
  for (const [key, arr] of wires) {
    const [kx, kz] = key.split(',').map(Number);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeBoundingSphere();
    const ls = new THREE.LineSegments(g, wireMat); ls.matrixAutoUpdate = false; group.add(ls);
    wireChunks.push({ cx: (kx + 0.5) * 400, cz: (kz + 0.5) * 400, cull: 600, meshes: [ls] });
  }
  return { group, lamp, glow, glowMesh, count: N, wires: nWires, wireChunks };
}

function mergeBoxes(a, b) {
  const g = new THREE.BufferGeometry();
  const pa = a.toNonIndexed(), pb = b.toNonIndexed();
  for (const name of ['position', 'normal']) {
    const A = pa.getAttribute(name).array, B = pb.getAttribute(name).array;
    const out = new Float32Array(A.length + B.length); out.set(A); out.set(B, A.length);
    g.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  return g;
}

const ROAD_RANK = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, unclassified: 4, residential: 4, living_street: 3, service: 2 };

function buildRoads(roads, aeroway, photos, decks = null) {
  const kinds = ['marked', 'plain', 'stone', 'foot', 'cycle', 'runway', 'taxi', 'skirt', 'arch'];
  const accs = Object.fromEntries(kinds.map((k) => [k, new Acc()]));
  for (const r of roads) {
    if (r.tu || r.p.length < 2) continue;
    if (r.k === 'steps' && r.p.some((q) => inHills(q[0], q[1]))) continue; // nos morros vira escadaria de verdade (buildStairs)
    // rua de pedra (Bom Jesus, Poço da Panela) não tem calçada alta: a pedra vai de parede a parede, então a faixa
    // ganha a largura das duas calçadas que ela teria (~2,2 m de cada lado)
    const w = (ROAD_W[r.k] || 4) + (r.cobble ? 4.4 : 0);
    let kind;
    if (r.k === 'pedestrian' || r.k === 'steps' || r.cobble) kind = 'stone'; // r.cobble: paralelepípedo (Poço da Panela)
    else if (r.k === 'cycleway') kind = 'cycle';
    else if (FOOT.has(r.k)) kind = 'foot';
    else kind = !r.o && w >= 7 ? 'marked' : 'plain';
    const y = FOOT.has(r.k) ? 0.03 : 0.04 + (ROAD_RANK[r.k] || 1) * 0.003;
    const deck = r.b && decks?.byRoad.get(r);
    ribbon(accs[kind], deck ? deck.pts : densify(r.p), w, y, r.b ? accs.skirt : null, 8, r.b && /^Ponte /.test(r.n || '') ? 0.06 : 1, deck);
  }
  if (decks) for (const d of decks.ways) bridgeSupports(accs.skirt, accs.arch, d);
  for (const a of aeroway) {
    if (a.k === 'apron' || a.p.length < 2) continue;
    ribbon(a.k === 'runway' ? accs.runway : accs.taxi, a.p, a.w, a.k === 'runway' ? 0.025 : 0.02, null, a.k === 'runway' ? 60 : 12);
  }
  const group = new THREE.Group();
  for (const k of kinds) {
    const acc = accs[k];
    if (!acc.ni) continue;
    const mat = k === 'skirt' ? new THREE.MeshStandardMaterial({ color: '#b7b2a8', roughness: 0.9 })
      : k === 'arch' ? new THREE.MeshStandardMaterial({ color: '#e6dfcf', roughness: 0.8 }) // arcos de pedra clara (Nassau, Duarte Coelho)
      : roadMaterial(k, photos);
    mat.side = k === 'skirt' || k === 'arch' ? THREE.DoubleSide : THREE.FrontSide;
    const mesh = new THREE.Mesh(acc.geo(), mat);
    mesh.receiveShadow = true;
    if (k === 'skirt' || k === 'arch') mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

// ---------------------------------------------------------------- escadarias dos morros
// Um degrau a cada 0,6 m de caminho, com a altura do terreno; piso de concreto, espelho pintado (cada escadaria
// com sua sequência de cores) e corrimão dos dois lados. Tudo numa malha só.
const STAIR_COLORS = [['#e63946', '#ffbe0b', '#2a9d8f', '#3a86ff', '#8338ec'], ['#f4f1ea', '#3a86ff'], ['#ffbe0b', '#e63946'], ['#06d6a0', '#ffd166', '#ef476f', '#118ab2'], ['#f4f1ea', '#e63946'], ['#ff006e', '#ffbe0b', '#3a86ff']];
function buildStairs(roads, mark) {
  const pos = [], nor = [], col = [], idx = [];
  const C = new THREE.Color();
  const quad = (a, b, c, d, n, color) => {
    const k = pos.length / 3; C.set(color);
    for (const v of [a, b, c, d]) { pos.push(v[0], v[1], v[2]); nor.push(n[0], n[1], n[2]); col.push(C.r, C.g, C.b); }
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  const TREAD = 0.6, W = 2.4, TOP = '#b7b2a8';
  let sn = 0;
  for (const r of roads) {
    if (r.k !== 'steps' || !r.p.some((q) => inHills(q[0], q[1]))) continue;
    const pal = STAIR_COLORS[sn++ % STAIR_COLORS.length];
    // amostras ao longo do caminho
    const S = [];
    let next = 0, acc = 0; // distância acumulada no caminho e a do próximo degrau
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      while (next <= acc + L) { const t = next - acc; S.push([ax + ux * t, az + uz * t, ux, uz]); next += TREAD; }
      acc += L;
    }
    let prevY = null, k = 0;
    for (const [x, z, ux, uz] of S) {
      const nx = -uz, nz = ux, y = heightAt(x, z) + 0.12, hw = W / 2, ht = TREAD / 2;
      const P = (s, f, yy) => [x + nx * s + ux * f, yy, z + nz * s + uz * f];
      quad(P(-hw, -ht, y), P(hw, -ht, y), P(hw, ht, y), P(-hw, ht, y), [0, 1, 0], TOP); // piso
      if (prevY != null && Math.abs(y - prevY) > 0.02) {
        // espelho na divisa com o degrau anterior, virado para o lado mais baixo
        const lo = Math.min(y, prevY), hi = Math.max(y, prevY), up = y > prevY;
        const n = up ? [-ux, 0, -uz] : [ux, 0, uz];
        const a = P(-hw, -ht, lo), b = P(hw, -ht, lo), c = P(hw, -ht, hi), d = P(-hw, -ht, hi);
        if (up) quad(b, a, d, c, n, pal[k % pal.length]); else quad(a, b, c, d, n, pal[k % pal.length]);
      }
      // corrimão dos dois lados: uma faixa a cada 3 degraus e um poste a cada 6 (o material é de dois lados)
      if (k % 3 === 0) for (const sgn of [-1, 1]) {
        const s0 = sgn * (hw + 0.05), L3 = TREAD * 3;
        const yb = heightAt(x + ux * L3, z + uz * L3) + 0.12;
        quad(P(s0, -ht, y + 0.9), P(s0, -ht + L3, yb + 0.9), P(s0, -ht + L3, yb + 0.97), P(s0, -ht, y + 0.97), [nx * sgn, 0, nz * sgn], '#2b2f33');
        if (k % 6 === 0) quad(P(s0 - 0.03, 0, y), P(s0 + 0.03, 0, y), P(s0 + 0.03, 0, y + 0.95), P(s0 - 0.03, 0, y + 0.95), [ux, 0, uz], '#2b2f33');
      }
      for (let s2 = -hw; s2 <= hw; s2 += 0.75) mark(x + nx * s2, z + nz * s2);
      prevY = y; k++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true; m.name = 'escadarias';
  return m;
}

// nos morros, pontos a cada 5 m para a rua seguir o relevo
function densify(pts) {
  if (!pts.some((p) => inHills(p[0], p[1]))) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(L / 5);
    for (let k = 1; k <= n; k++) { const t = k / (n + 1); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    out.push(b);
  }
  return out;
}

function ribbon(acc, pts, w, y, skirt, vScale, top = 1, deck = null) {
  const n = pts.length;
  const L = [], R = [], vs = [];
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;
    let scale = 1;
    if (i > 0 && i < n - 1) {
      const sx = p[0] - pts[i - 1][0], sz = p[1] - pts[i - 1][1], sl = Math.hypot(sx, sz) || 1;
      scale = 1 / Math.max(0.5, nx * (-sz / sl) + nz * (sx / sl));
    }
    if (i > 0) dist += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const hw = (w / 2) * scale;
    L.push([p[0] + nx * hw, p[1] + nz * hw]);
    R.push([p[0] - nx * hw, p[1] - nz * hw]);
    vs.push(dist / vScale);
  }
  const base = acc.n;
  for (let i = 0; i < n; i++) {
    // no morro a rua acompanha o terreno (um pouco acima, para não sumir dentro da malha)
    const hl = heightAt(L[i][0], L[i][1]), hr = heightAt(R[i][0], R[i][1]), lift = hl || hr ? 0.15 : 0;
    acc.v(L[i][0], y + hl + lift, L[i][1], 0, 1, 0, 0, vs[i], 255, 255, 255);
    acc.v(R[i][0], y + hr + lift, R[i][1], 0, 1, 0, 1, vs[i], 255, 255, 255);
    // ordem anti-horária vista de cima: a face aponta para cima (normal +y)
    if (i < n - 1) { const a = base + i * 2; acc.t(a, a + 2, a + 1); acc.t(a + 1, a + 2, a + 3); }
  }
  if (skirt) {
    // lateral da laje. Na ponte que sobe (deck), em cima d'água a laje tem ~1 m de espessura e fica aberta embaixo
    // (aparecem os pilares e os arcos); na rampa em terra é aterro até o chão
    const hOf = (i) => (deck ? deck.pts[i][2] : 0), bot = (i) => (deck && deck.pts[i][3] && hOf(i) > 0.4 ? hOf(i) - 1.0 : -2);
    for (const side of [L, R]) for (let i = 0; i < n - 1; i++) {
      const p = side[i], q = side[i + 1];
      const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l, nz = dx / l;
      const s = skirt.v(p[0], bot(i), p[1], nx, 0, nz, 0, 0, 255, 255, 255);
      skirt.v(q[0], bot(i + 1), q[1], nx, 0, nz, 0, 0, 255, 255, 255);
      skirt.v(q[0], top + hOf(i + 1), q[1], nx, 0, nz, 0, 0, 255, 255, 255);
      skirt.v(p[0], top + hOf(i), p[1], nx, 0, nz, 0, 0, 255, 255, 255);
      skirt.t(s, s + 1, s + 2); skirt.t(s, s + 2, s + 3);
    }
    // fundo da laje (visto do barco, debaixo da ponte)
    if (deck) for (let i = 0; i < n - 1; i++) {
      if (bot(i) < -1 && bot(i + 1) < -1) continue;
      const s = skirt.v(L[i][0], bot(i), L[i][1], 0, -1, 0, 0, 0, 255, 255, 255);
      skirt.v(R[i][0], bot(i), R[i][1], 0, -1, 0, 0, 0, 255, 255, 255);
      skirt.v(R[i + 1][0], bot(i + 1), R[i + 1][1], 0, -1, 0, 0, 0, 255, 255, 255);
      skirt.v(L[i + 1][0], bot(i + 1), L[i + 1][1], 0, -1, 0, 0, 0, 255, 255, 255);
      skirt.t(s, s + 1, s + 2); skirt.t(s, s + 2, s + 3);
    }
  }
}

// ---------------------------------------------------------------- estacionamentos
// O mapa do jogo não tinha os estacionamentos (só as pistas de serviço entre as vagas): o chão ali saía com a grama
// da cobertura do solo, e o estacionamento do Shopping Recife virava faixas verdes. public/data/estacionamentos.json
// tem os contornos de superfície do OSM (amenity=parking, sem garagem coberta nem subsolo; 859 lotes, ~212 ha).
// Cada lote vira asfalto com as vagas pintadas: fileiras de 5 m dos dois lados de um corredor de 6 m, vaga de 2,5 m,
// alinhadas pelo lado mais comprido do lote. Fica logo abaixo das ruas (as pistas de serviço continuam por cima).
function parkingTexture() {
  const W = 256, H = 80, c = document.createElement('canvas'); c.width = W; c.height = H; // 16 m × 5 m
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let i = 0; i < W * H; i++) { const n = (Math.sin(i * 12.9898) * 43758.5453) % 1, v = 74 + Math.abs(n) * 14; d[i * 4] = v; d[i * 4 + 1] = v + 1; d[i * 4 + 2] = v + 4; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#e4e3dc';
  const m = W / 16; // px por metro
  for (const [u0, u1] of [[0, 5], [11, 16]]) {
    for (const v of [0, 2.5]) g.fillRect(u0 * m, v * m * (H / (5 * m)), (u1 - u0) * m, 0.12 * m);   // divisória entre vagas
  }
  g.fillRect(5 * m - 1, 0, 2, H); g.fillRect(11 * m - 1, 0, 2, H); // fim da vaga (frente do carro)
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function buildParking(lotes) {
  const pos = [], uv = [], idx = [];
  for (const L of lotes) {
    const p = L.p, n = p.length; if (n < 3) continue;
    let ux = 1, uz = 0, best = 0;
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > best) { best = l; ux = (b[0] - a[0]) / l; uz = (b[1] - a[1]) / l; } }
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(p.map((q) => new THREE.Vector2(q[0], q[1])), []); } catch { continue; }
    const base = pos.length / 3;
    for (const [x, z] of p) {
      pos.push(x, 0.035 + heightAt(x, z), z);
      uv.push((x * -uz + z * ux) / 16, (x * ux + z * uz) / 5); // u: através das fileiras, v: ao longo delas
    }
    for (const [a, b, c] of tris) {
      const A = p[a], B = p[b], C = p[c], cy = (B[1] - A[1]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[1] - A[1]);
      if (cy >= 0) idx.push(base + a, base + b, base + c); else idx.push(base + a, base + c, base + b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: parkingTexture(), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  mesh.receiveShadow = true; mesh.name = 'estacionamentos';
  if (typeof window !== 'undefined') window.estacionamentos = { lotes: lotes.length, tri: idx.length / 3 };
  return mesh;
}

// ---------------------------------------------------------------- cais de pedra do Centro
// Rua da Aurora, Rua do Sol, Martins de Barros e os cais (Santa Rita, Apolo, Alfândega): o Capibaribe corre entre
// muros de pedra, com calçada de pedra por cima e mureta branca na beira. A margem sai da grade: de cada ponto da
// rua anda para o lado até achar água (sem prédio no caminho) e a margem suavizada vira o cais.
const QUAY_ROADS = /^(Rua da Aurora|Rua do Sol|Avenida Martins de Barros|Cais .*|Avenida Cais .*)$/;
function buildQuays(roads, isWater, isSolid) {
  const acc = new Acc(false), lines = [];
  for (const r of roads) {
    if (!QUAY_ROADS.test(r.n || '') || FOOT.has(r.k) || r.b || r.p.length < 2) continue;
    const hw = (ROAD_W[r.k] || 6) / 2;
    for (const sd of [-1, 1]) {
      let cur = null;
      const flush = () => { if (cur && cur.length >= 4) lines.push(cur); cur = null; };
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
        const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz * sd, nz = ux * sd;
        for (let d = 0; d < L; d += 2) {
          const x = a[0] + ux * d, z = a[1] + uz * d;
          let bank = -1;
          for (let o = hw + 1; o < 90; o += 0.75) {
            const px = x + nx * o, pz = z + nz * o;
            if (isWater(px, pz)) { bank = o; break; }
            if (isSolid(px, pz)) break;
          }
          if (bank < 0) { flush(); continue; }
          const q = [x + nx * bank, z + nz * bank, nx, nz];
          if (cur && Math.hypot(q[0] - cur.at(-1)[0], q[1] - cur.at(-1)[1]) > 6) flush();
          (cur ||= []).push(q);
        }
      }
      flush();
    }
  }
  const quad = (a, b, c, d, n, col) => { const k = acc.v(...a, ...n, 0, 0, ...col); acc.v(...b, ...n, 0, 0, ...col); acc.v(...c, ...n, 0, 0, ...col); acc.v(...d, ...n, 0, 0, ...col); acc.t(k, k + 1, k + 2); acc.t(k, k + 2, k + 3); };
  const STONE = [104, 102, 96], MOSS = [62, 70, 54], TOPS = [170, 163, 150], WALL = [236, 233, 226], CAP = [214, 210, 200];
  let len = 0;
  for (const L0 of lines) {
    // margem suavizada (a grade tem degraus de 2,5 m) e um pouco para dentro da água (o muro fica na linha d'água)
    const P = L0.map((_, i) => {
      let x = 0, z = 0, n = 0; for (let k = Math.max(0, i - 3); k <= Math.min(L0.length - 1, i + 3); k++) { x += L0[k][0]; z += L0[k][1]; n++; }
      return [x / n + L0[i][2] * 0.6, z / n + L0[i][3] * 0.6];
    });
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.3 || l > 6) continue;
      len += l;
      // normal para o lado do rio (o mesmo da busca)
      let nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
      if (nx * L0[i][2] + nz * L0[i][3] < 0) { nx = -nx; nz = -nz; }
      const off = (p, o, y) => [p[0] + nx * o, y, p[1] + nz * o];
      // muro de pedra até dentro d'água, com a faixa escura de limo perto da linha d'água
      quad(off(a, 0, -0.45), off(b, 0, -0.45), off(b, 0, 0.02), off(a, 0, 0.02), [nx, 0, nz], STONE);
      quad(off(a, 0, -2.2), off(b, 0, -2.2), off(b, 0, -0.45), off(a, 0, -0.45), [nx, 0, nz], MOSS);
      // calçada de pedra do cais (cobre a faixa de areia do mapa)
      quad(off(a, -3.2, 0.035), off(a, 0, 0.035), off(b, 0, 0.035), off(b, -3.2, 0.035), [0, 1, 0], TOPS);
      // mureta branca com capeamento
      const t = 0.28;
      quad(off(a, -t, 0.035), off(b, -t, 0.035), off(b, -t, 0.72), off(a, -t, 0.72), [-nx, 0, -nz], WALL);
      quad(off(a, 0, 0.02), off(b, 0, 0.02), off(b, 0, 0.72), off(a, 0, 0.72), [nx, 0, nz], WALL);
      quad(off(a, -t - 0.05, 0.8), off(a, 0.05, 0.8), off(b, 0.05, 0.8), off(b, -t - 0.05, 0.8), [0, 1, 0], CAP);
      quad(off(a, -t - 0.05, 0.72), off(b, -t - 0.05, 0.72), off(b, -t - 0.05, 0.8), off(a, -t - 0.05, 0.8), [-nx, 0, -nz], CAP);
      quad(off(a, 0.05, 0.72), off(b, 0.05, 0.72), off(b, 0.05, 0.8), off(a, 0.05, 0.8), [nx, 0, nz], CAP);
    }
  }
  window.cais = { trechos: lines.length, metros: Math.round(len) };
  const mesh = new THREE.Mesh(acc.geo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
  mesh.receiveShadow = true; mesh.castShadow = true; mesh.name = 'cais';
  return mesh;
}

// ---------------------------------------------------------------- tabuleiro das pontes
// No Recife as pontes do Centro ficam uns 3 m acima do rio, com arcos e pilares de talha-mar à vista. O traçado do
// OSM é plano; aqui cada ponte sobre a água ganha uma altura ao longo do caminho: cheia no trecho molhado, rampa de
// 10% nas cabeceiras em terra e os primeiros 14 m da ponta em terra no nível da rua (o cruzamento com a avenida da
// margem continua plano). A grade (células de 2 m, só onde há ponte) vai para terrain.js: heightAt passa a somar o
// tabuleiro, e carro, gente, câmera, poste e guarda-corpo sobem juntos.
const DECK_SLOPE = 0.1, DECK_FLAT = 14;
function buildDecks(roads, isWater, { xmin, zmin, xmax, zmax }) {
  const S = 2, x0 = xmin - 10, z0 = zmin - 10, cells = new Map(), ways = [], byRoad = new Map();
  for (const r of roads) {
    if (!r.b || r.tu || r.p.length < 2) continue;
    // amostras a cada ~3 m com a distância percorrida
    const pts = [[r.p[0][0], r.p[0][1]]];
    for (let i = 1; i < r.p.length; i++) {
      const a = r.p[i - 1], b = r.p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / 3));
      for (let j = 1; j <= k; j++) pts.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
    }
    const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const wet = pts.map((q) => isWater(q[0], q[1]));
    const first = wet.indexOf(true); if (first < 0) continue; // viaduto: fica como está
    const last = wet.lastIndexOf(true), Lt = s.at(-1);
    const big = /^Ponte /.test(r.n || '') || (ROAD_RANK[r.k] || 0) >= 5, foot = FOOT.has(r.k);
    const H = big ? 2.6 : foot && !r.n ? 1.4 : 2.0;
    // ponta da ponte que cai no meio d'água (o OSM cortou a ponte em dois trechos) não desce
    const e0 = wet[0] ? -1e9 : DECK_FLAT, e1 = wet.at(-1) ? -1e9 : DECK_FLAT;
    for (let i = 0; i < pts.length; i++) {
      const out = Math.max(0, s[first] - s[i], s[i] - s[last]);
      const h = Math.max(0, Math.min(H, H - DECK_SLOPE * out, DECK_SLOPE * (s[i] - e0), DECK_SLOPE * (Lt - s[i] - e1)));
      pts[i].push(h, wet[i] ? 1 : 0, s[i]);
    }
    if (!pts.some((q) => q[2] > 0.05)) continue;
    const w = (ROAD_W[r.k] || 4), R = w / 2 + 2.5;
    for (const [x, z, h] of pts) {
      if (h <= 0) continue;
      const i0 = Math.floor((x - R - x0) / S), i1 = Math.ceil((x + R - x0) / S), j0 = Math.floor((z - R - z0) / S), j1 = Math.ceil((z + R - z0) / S);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        if (Math.hypot(x0 + i * S - x, z0 + j * S - z) > R) continue;
        const key = i * 65536 + j; if ((cells.get(key) || 0) < h) cells.set(key, h);
      }
    }
    const d = { r, pts, w, H, arco: /Nassau|Duarte Coelho|Princesa Isabel|Velha|Santa Isabel/.test(r.n || '') && !foot };
    ways.push(d); byRoad.set(r, d);
  }
  const deck = { S, x0, z0, x1: xmax + 10, z1: zmax + 10, cells };
  setDeck(deck);
  window.tabuleiro = { pontes: ways.length, celulas: cells.size };
  return { ways, byRoad };
}

// pilares com talha-mar (proa dos dois lados, contra a corrente) e, nas pontes antigas do Centro, arcos de pedra
// entre um pilar e outro. Pilar a cada ~20 m do trecho molhado; nas pontas o encontro é a margem.
function bridgeSupports(pier, arch, d) {
  const { pts, w } = d, hw = w / 2, BOT = -2.6;
  const quad = (acc, a, b, c, e, n) => {
    // a ordem dos cantos segue a normal (face de trás com normal invertida sai preta no DoubleSide)
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    if ((uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] < 0) [b, e] = [e, b];
    const k = acc.v(...a, ...n, 0, 0, 255, 255, 255); acc.v(...b, ...n, 0, 0, 255, 255, 255); acc.v(...c, ...n, 0, 0, 255, 255, 255); acc.v(...e, ...n, 0, 0, 255, 255, 255); acc.t(k, k + 1, k + 2); acc.t(k, k + 2, k + 3); };
  // ponto do eixo na distância s (com tangente e altura)
  const at = (sv) => {
    let i = 1; while (i < pts.length - 1 && pts[i][4] < sv) i++;
    const a = pts[i - 1], b = pts[i], t = Math.max(0, Math.min(1, (sv - a[4]) / (b[4] - a[4] || 1))), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, h: a[2] + (b[2] - a[2]) * t, ux: (b[0] - a[0]) / L, uz: (b[1] - a[1]) / L };
  };
  // caixa orientada: centro, eixo u (comprimento lu), normal (largura ln), de y0 a y1
  const box = (acc, c, ux, uz, lu, ln, y0, y1) => {
    const nx = -uz, nz = ux, P = (a, b, y) => [c.x + ux * a + nx * b, y, c.z + uz * a + nz * b];
    const A = lu / 2, Bn = ln / 2;
    quad(acc, P(-A, -Bn, y0), P(A, -Bn, y0), P(A, -Bn, y1), P(-A, -Bn, y1), [-nx, 0, -nz]);
    quad(acc, P(A, Bn, y0), P(-A, Bn, y0), P(-A, Bn, y1), P(A, Bn, y1), [nx, 0, nz]);
    quad(acc, P(A, -Bn, y0), P(A, Bn, y0), P(A, Bn, y1), P(A, -Bn, y1), [ux, 0, uz]);
    quad(acc, P(-A, Bn, y0), P(-A, -Bn, y0), P(-A, -Bn, y1), P(-A, Bn, y1), [-ux, 0, -uz]);
  };
  // trechos molhados seguidos
  const runs = []; let a0 = -1;
  for (let i = 0; i < pts.length; i++) { const wt = pts[i][3] && pts[i][2] > 0.4; if (wt && a0 < 0) a0 = i; if ((!wt || i === pts.length - 1) && a0 >= 0) { runs.push([pts[a0][4], pts[wt ? i : i - 1][4]]); a0 = -1; } }
  for (const [sa, sb] of runs) {
    const len = sb - sa; if (len < 6) continue;
    const n = Math.max(1, Math.round(len / 20)), sup = [];
    for (let i = 0; i <= n; i++) sup.push(sa + (len * i) / n);
    for (let i = 1; i < n; i++) {
      const c = at(sup[i]), top = c.h - 1.0;
      box(pier, c, c.ux, c.uz, 1.8, w + 0.8, BOT, top);
      // talha-mar: proa em ponta nas duas faces que a correnteza bate (fora da largura da ponte)
      for (const sd of [-1, 1]) {
        const tip = { x: c.x + -c.uz * sd * (hw + 0.4 + 0.9), z: c.z + c.ux * sd * (hw + 0.4 + 0.9) };
        const q = Math.SQRT1_2; box(pier, tip, c.ux * q - c.uz * q, c.uz * q + c.ux * q, 1.27, 1.27, BOT, Math.min(top, -0.1));
      }
    }
    if (!d.arco) continue;
    // arco abatido entre apoios: intradorso (o "teto" curvo, de um lado ao outro da ponte) e o tímpano nas duas faces
    for (let i = 0; i < n; i++) {
      const s0 = sup[i] + (i ? 0.9 : 0), s1 = sup[i + 1] - (i < n - 1 ? 0.9 : 0), span = s1 - s0; if (span < 4) continue;
      const mid = at((s0 + s1) / 2), crown = mid.h - 1.0, rise = Math.min(span * 0.22, crown + 0.9);
      if (rise < 0.6) continue;
      const K = 12, curve = (t) => crown - rise + rise * (1 - (2 * t - 1) ** 2);
      for (let k = 0; k < K; k++) {
        const t0 = k / K, t1 = (k + 1) / K, A = at(s0 + span * t0), B = at(s0 + span * t1), ya = curve(t0), yb = curve(t1);
        const nxA = -A.uz, nzA = A.ux, nxB = -B.uz, nzB = B.ux;
        const pa = (sd, y) => [A.x + nxA * hw * sd, y, A.z + nzA * hw * sd], pb = (sd, y) => [B.x + nxB * hw * sd, y, B.z + nzB * hw * sd];
        quad(arch, pa(-1, ya), pb(-1, yb), pb(1, yb), pa(1, ya), [0, -1, 0]); // intradorso
        for (const sd of [-1, 1]) {
          quad(arch, pa(sd, ya), pb(sd, yb), pb(sd, B.h - 1.0), pa(sd, A.h - 1.0), [nxA * sd, 0, nzA * sd]); // tímpano
          // aduelas: faixa um pouco saliente acompanhando o arco
          const o = sd * (hw + 0.12);
          quad(arch, [A.x + nxA * o, ya - 0.05, A.z + nzA * o], [B.x + nxB * o, yb - 0.05, B.z + nzB * o], [B.x + nxB * o, yb + 0.45, B.z + nzB * o], [A.x + nxA * o, ya + 0.45, A.z + nzA * o], [nxA * sd, 0, nzA * sd]);
        }
      }
    }
  }
}

function buildWater(tint) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const a = (x / 256) * Math.PI * 2, b = (y / 256) * Math.PI * 2;
    const dx = Math.cos(a * 3 + b * 2) * 0.5 + Math.cos(a * 7 - b * 5) * 0.25 + Math.cos(a * 13 + b * 11) * 0.12;
    const dy = Math.cos(b * 4 - a * 1) * 0.5 + Math.cos(b * 6 + a * 8) * 0.25 + Math.cos(b * 12 - a * 9) * 0.12;
    const i = (y * 256 + x) * 4;
    img.data[i] = 128 + dx * 60; img.data[i + 1] = 128 + dy * 60; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const normal = new THREE.CanvasTexture(c);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(900, 900);
  const geo = new THREE.PlaneGeometry(24000, 24000);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#1d5a6e', roughness: 0.12, metalness: 0.35, normalMap: normal, normalScale: new THREE.Vector2(0.35, 0.35) });
  // cor por lugar (mar raso, mar fundo, rio): ver waterTint em loadWorld
  if (tint) mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { wTint: { value: tint.tex }, wBox: { value: new THREE.Vector4(tint.x0, tint.z0, tint.w, tint.h) } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D wTint; uniform vec4 wBox; varying vec2 vWXZ;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  { vec2 tu = (vWXZ - wBox.xy) / wBox.zw;
    if (tu.x > 0.0 && tu.y > 0.0 && tu.x < 1.0 && tu.y < 1.0) diffuseColor.rgb = texture2D(wTint, tu).rgb; }`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.7;
  mesh.receiveShadow = true;
  mesh.userData.update = (t) => { normal.offset.set(t * 0.004, t * 0.0025); };
  mesh.name = 'water';
  return mesh;
}

function buildMapCanvas(groundCanvas, data, { xmin, zmin, xmax }) {
  const S = 1500 / (xmax - xmin);
  const c = document.createElement('canvas');
  c.width = 1500; c.height = Math.round((groundCanvas.height / groundCanvas.width) * 1500);
  const g = c.getContext('2d');
  g.fillStyle = '#1f5f7a'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(groundCanvas, 0, 0, c.width, c.height);
  g.setTransform(S, 0, 0, S, -xmin * S, -zmin * S);
  g.fillStyle = '#8e877b';
  for (const b of data.buildings) { g.beginPath(); b.p.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.fill(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const r of data.roads) {
    if (FOOT.has(r.k) || r.k === 'service') continue;
    g.strokeStyle = ROAD_RANK[r.k] >= 5 ? '#fff6d8' : '#f2f2f2';
    g.lineWidth = Math.max((ROAD_W[r.k] || 4) * 1.2, (ROAD_RANK[r.k] >= 5 ? 2.2 : 1.2) / S);
    g.beginPath(); r.p.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  }
  g.strokeStyle = '#d9d6cf';
  for (const a of data.aeroway) { if (a.k === 'apron') continue; g.lineWidth = a.w; g.beginPath(); a.p.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  c.userData = { S, xmin, zmin };
  return c;
}

// ---------------------------------------------------------------- materiais com shader próprio

// caixa girada: eixo (ux, uz) com comprimento w, de largura d na perpendicular
function obox(acc, x, z, ux, uz, w, d, y0, y1, r, g, b) {
  const nx = -uz, nz = ux, P = (a, c, y) => [x + ux * a * w / 2 + nx * c * d / 2, y, z + uz * a * w / 2 + nz * c * d / 2];
  const quad = (pts, n) => {
    const k = acc.n;
    for (const q of pts) acc.v(q[0], q[1], q[2], n[0], n[1], n[2], n[1] ? q[0] / 8 : (q[0] + q[2]) / 8, n[1] ? q[2] / 8 : q[1] / 8, r, g, b);
    // ordem pela normal (vista de fora, anti-horária)
    const A = pts[0], B = pts[1], C = pts[2], cxp = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), cyp = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), czp = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (cxp * n[0] + cyp * n[1] + czp * n[2] >= 0) { acc.t(k, k + 1, k + 2); acc.t(k, k + 2, k + 3); } else { acc.t(k, k + 2, k + 1); acc.t(k, k + 3, k + 2); }
  };
  quad([P(-1, -1, y1), P(1, -1, y1), P(1, 1, y1), P(-1, 1, y1)], [0, 1, 0]);
  quad([P(-1, -1, y0), P(1, -1, y0), P(1, -1, y1), P(-1, -1, y1)], [-nx, 0, -nz]);
  quad([P(1, 1, y0), P(-1, 1, y0), P(-1, 1, y1), P(1, 1, y1)], [nx, 0, nz]);
  quad([P(1, -1, y0), P(1, 1, y0), P(1, 1, y1), P(1, -1, y1)], [ux, 0, uz]);
  quad([P(-1, 1, y0), P(-1, -1, y0), P(-1, -1, y1), P(-1, 1, y1)], [-ux, 0, -uz]);
}
function box(acc, x, z, w, d, y0, y1, r, g, b) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const quad = (pts, n) => {
    const a = acc.n;
    for (const q of pts) acc.v(q[0], q[1], q[2], n[0], n[1], n[2], n[1] ? q[0] / 8 : (q[0] + q[2]) / 8, n[1] ? q[2] / 8 : q[1] / 8, r, g, b);
    acc.t(a, a + 1, a + 2); acc.t(a, a + 2, a + 3);
  };
  quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]);
  quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  quad([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]);
  quad([[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [0, 0, 1]);
  quad([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]);
}

// Fachada: escolhe a célula do atlas pela coordenada (vão, andar) e pela variante gravada em u (variante × 1000).
// O térreo usa a linha de baixo do atlas. Vidro reflete o céu; à noite cada janela sorteia se está acesa.
function facadeMaterial(kind, grime, photos) {
  const fx = facadeAtlas(kind);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { fMap: { value: fx.map }, fRM: { value: fx.rm }, fNormal: { value: fx.normal }, fGrime: { value: grime }, fSt: { value: photos.stucco.map }, fStN: { value: photos.stucco.normal }, fStAvg: { value: photos.stucco.avg } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFUv; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFUv = uv; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D fMap, fRM, fNormal, fGrime, fSt, fStN; uniform vec3 fStAvg;
varying vec2 vFUv; varying vec3 vWP;
${TBN_GLSL}`)
      .replace('#include <map_fragment>', `
  vec2 fc = vFUv; float variant = floor(fc.x / 1000.0); fc.x -= variant * 1000.0;
  float row = fc.y < 1.0 ? 0.0 : 1.0;
  vec2 loc = fract(fc);
  vec2 auv = (vec2(variant, row) + loc * 0.98 + 0.01) / vec2(4.0, 2.0);
  vec2 gdx = dFdx(fc) * vec2(0.245, 0.49), gdy = dFdy(fc) * vec2(0.245, 0.49);
  vec4 fcol = textureGrad(fMap, auv, gdx, gdy);
  vec4 rmS = textureGrad(fRM, auv, gdx, gdy);
  float gm = texture2D(fGrime, vec2(vWP.x + vWP.z, vWP.y) / 37.0).r;
  // reboco de verdade (foto) nas partes de parede, amostrado no mundo para não repetir por janela
  vec2 suv = vec2(vWP.x + vWP.z, vWP.y) / 2.2;
  float st = dot(texture2D(fSt, suv).rgb / fStAvg, vec3(0.333));
  diffuseColor.rgb *= fcol.rgb * mix(vec3(1.0), vColor, rmS.b) * mix(1.0, clamp(st, 0.6, 1.4), rmS.b * 0.85) * mix(0.8, 1.05, gm) * mix(0.78, 1.0, smoothstep(0.0, 2.2, vWP.y))${kind === 'tower' ? ' * 1.12' : ''};`)
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rmS.g;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = rmS.r * 0.92;')
      .replace('#include <normal_fragment_maps>', `{
    vec3 mapN = textureGrad(fNormal, auv, gdx, gdy).xyz * 2.0 - 1.0;
    vec3 n0 = normal;
    normal = normalize(fTBN(-vViewPosition, n0, fc) * mapN);
    vec3 sn = nrm(fStN, suv); sn.xy *= 1.3;
    normal = normalize(mix(normal, fTBN(-vViewPosition, n0, suv) * sn, rmS.b * 0.6));
  }`)
      .replace('#include <emissivemap_fragment>', `{
    vec2 cid = floor(fc) + vec2(variant * 7.0, 0.0) + floor(vWP.xz / 50.0) * 3.1;
    float hs = fract(sin(dot(cid, vec2(12.9898, 78.233))) * 43758.5453);
    float lit = step(hs, row < 0.5 ? 0.55 : 0.34);
    vec3 lc = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.92, 0.78), fract(hs * 7.31));
    if (fract(hs * 13.7) > 0.86) lc = vec3(0.7, 0.82, 1.0);
    // luz de teto: mais forte em cima da janela, e a cortina/caixilho aparecem por cima
    float shade = (0.3 + 0.7 * smoothstep(0.05, 0.95, loc.y)) * (0.45 + 0.55 * smoothstep(0.15, 0.6, fcol.b));
    totalEmissiveRadiance *= rmS.r * lit * lc * shade * (0.35 + 0.45 * fract(hs * 3.71));
  }`);
  };
  return m;
}

// Chão: a textura grande (2,6 m por pixel) só diz o que é cada lugar (calçada, grama, areia);
// a cor e o relevo vêm das fotos, amostradas em coordenadas do mundo.
function groundShader(ph, grime) {
  return (sh) => {
    Object.assign(sh.uniforms, {
      gPv: { value: ph.pave.map }, gPvN: { value: ph.pave.normal }, gPvA: { value: ph.pave.avg },
      gGr: { value: ph.grass.map }, gGrN: { value: ph.grass.normal }, gGrA: { value: ph.grass.avg },
      gSd: { value: ph.sand.map }, gSdN: { value: ph.sand.normal },
      gGrime: { value: grime },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D gPv, gPvN, gGr, gGrN, gSd, gSdN, gGrime; uniform vec3 gPvA, gGrA; varying vec3 vWP;
${TBN_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 gb = diffuseColor.rgb;
  float green = smoothstep(0.04, 0.12, gb.g - max(gb.r, gb.b));
  float sand = smoothstep(0.38, 0.5, gb.r - gb.b) * (1.0 - green);
  float macro = texture2D(gGrime, vWP.xz / 160.0).r;
  vec2 uPv = vWP.xz / 3.0, uGr = vWP.xz / 3.5, uGr2 = vec2(vWP.z, -vWP.x) / 9.0, uSd = vWP.xz / 4.0;
  {
    // calçada: foto tingida com a cor do lugar (praça, pátio, pista...)
    vec3 pt = texture2D(gPv, uPv).rgb / gPvA;
    vec3 pv = gb * mix(vec3(dot(pt, vec3(0.333))), pt, 0.3) * 0.92;
    // grama: duas escalas misturadas para não ver a repetição, com manchas secas
    vec3 gt = mix(texture2D(gGr, uGr).rgb, texture2D(gGr, uGr2).rgb, 0.4) / gGrA;
    vec3 gr = gb * vec3(0.95, 1.05, 0.9) * mix(vec3(dot(gt, vec3(0.333))), gt, 0.25);
    gr = mix(gr, gr * vec3(1.35, 1.1, 0.65), smoothstep(0.55, 0.85, macro) * 0.55);
    vec3 sd = texture2D(gSd, uSd).rgb * vec3(1.08, 1.0, 0.86);
    diffuseColor.rgb = mix(mix(pv, gr, green), sd, sand) * mix(0.86, 1.08, macro);
  }`)
      .replace('#include <normal_fragment_maps>', `{
    vec3 n0 = normal, p = -vViewPosition;
    vec3 nP = fTBN(p, n0, uPv) * nrm(gPvN, uPv);
    vec3 nG = fTBN(p, n0, uGr) * nrm(gGrN, uGr);
    vec3 nS = fTBN(p, n0, uSd) * nrm(gSdN, uSd);
    normal = normalize(mix(mix(nP, nG, green), nS, sand));
  }`);
  };
}

// Ruas: asfalto (foto) amostrado no mundo; faixas, sarjeta e trilho de pneu vêm da textura desenhada.
// Calçadão = paralelepípedo, calçada = placas de concreto, ciclovia = asfalto avermelhado.
function roadMaterial(kind, ph) {
  const t = roadSet(kind);
  const photo = kind === 'stone' ? ph.cobble : kind === 'foot' ? ph.pave : ph.asphalt;
  const scale = kind === 'stone' ? 2.5 : kind === 'foot' ? 3.0 : 5.0;
  const m = new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { rPh: { value: photo.map }, rPhN: { value: photo.normal }, rAvg: { value: photo.avg }, rScale: { value: scale } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D rPh, rPhN; uniform vec3 rAvg; uniform float rScale; varying vec3 vWP;
${TBN_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec2 ruv = vWP.xz / rScale;
  {
    vec3 ph = texture2D(rPh, ruv).rgb;
    vec3 pc = diffuseColor.rgb;
    float lum = dot(pc, vec3(0.299, 0.587, 0.114));
    ${kind === 'stone' || kind === 'foot'
    ? 'diffuseColor.rgb = ph * 1.05;'
    : kind === 'cycle'
      ? 'diffuseColor.rgb = ph / max(dot(rAvg, vec3(0.333)), 0.01) * vec3(0.32, 0.1, 0.09);'
      : `float paint = smoothstep(0.2, 0.42, lum);
    float wear = clamp(lum / 0.105, 0.65, 1.25); // trilho de pneu e sarjeta da textura desenhada
    vec3 asph = ph / max(dot(rAvg, vec3(0.333)), 0.01) * 0.12 * wear;
    diffuseColor.rgb = mix(asph, pc * (0.75 + 0.35 * dot(ph / rAvg, vec3(0.333))), paint);`}
  }`)
      .replace('#include <normal_fragment_maps>', `{
    vec3 pn = nrm(rPhN, ruv); pn.xy *= ${kind === 'stone' ? '1.4' : '1.0'};
    normal = normalize(fTBN(-vViewPosition, normal, ruv) * pn);
  }`);
  };
  return m;
}

// Telhado: telha de barro (foto) nos sobrados, laje de concreto gasto nos prédios.
function roofMaterial(ph) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      tCl: { value: ph.clay.map }, tClN: { value: ph.clay.normal }, tClA: { value: ph.clay.avg },
      tSl: { value: ph.slab.map }, tSlN: { value: ph.slab.normal }, tSlA: { value: ph.slab.avg },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRUv = uv * 8.0;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tCl, tClN, tSl, tSlN; uniform vec3 tClA, tSlA; varying vec2 vRUv;
${TBN_GLSL}`)
      .replace('#include <color_fragment>', `
  float clay = step(vColor.g * 1.8, vColor.r);
  vec2 cuv = vRUv / 2.2, suv = vRUv / 4.0;
  {
    vec3 c = texture2D(tCl, cuv).rgb * mix(vec3(1.0), vColor / tClA * 0.55, 0.3);
    vec3 s = texture2D(tSl, suv).rgb / max(dot(tSlA, vec3(0.333)), 0.01) * vColor;
    diffuseColor.rgb *= mix(s, c, clay);
  }`)
      .replace('#include <normal_fragment_maps>', `{
    vec3 n0 = normal, p = -vViewPosition;
    normal = normalize(mix(fTBN(p, n0, suv) * nrm(tSlN, suv), fTBN(p, n0, cuv) * nrm(tClN, cuv), clay));
  }`);
  };
  return m;
}

export { heightAt };
