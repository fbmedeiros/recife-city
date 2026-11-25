// Preenchimento da cidade: o OpenStreetMap do Recife só tem parte das construções desenhadas, então muitos
// quarteirões ficavam vazios (terra bege) onde, no satélite, está tudo construído. Aqui:
// - infillCity(data): antes da grade de colisão, anda pelas ruas de carro e põe lotes (casas e prédios) na frente,
//   dos dois lados, onde não há prédio, rua, água, praça, areia nem aeroporto. Fica tudo marcado como gerado.
// - buildMangue(group, data, env): mangue nas margens de rio e maré onde a terra ficou pelada.
// JavaScript puro (sem DOM) para dar pra testar no Node.
import * as THREE from 'three';
import { HILLS, heightAt } from './terrain.js';
import { COB } from './cobertura.js';

// morros que são mata ou parque (não casario): Guabiraba, Dois Irmãos, Pau-Ferro, Sítio dos Pintos
const MATA = new Set(['Guabiraba', 'Dois Irmãos', 'Pau-Ferro', 'Sítio dos Pintos']);
const VIVID = ['#e63946', '#2a9d8f', '#3a86ff', '#ffbe0b', '#8338ec', '#fb5607', '#06d6a0', '#f4a6c6', '#9ad1d4', '#f2e3a0', '#e9c46a', '#f1f1ee', '#c9b9a3', '#c9b9a3'];

const RES = 4; // metros por célula da grade de ocupação
const DRIVE = new Set(['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street', 'trunk']);
const W = { trunk: 13, primary: 12, secondary: 10, tertiary: 8.5, unclassified: 7, residential: 7, living_street: 6, service: 4.5, pedestrian: 6, footway: 2.6, path: 2, steps: 2.5, cycleway: 2.4, track: 3 };

// chave numérica da grade de segmentos de rua (células de 60 m; o município cabe folgado em ±60 km)
const VIZ = [3, 0, -3, 0, 0, 3, 0, -3]; // vizinhos a 3 m (quintal livre em volta)
const segKey = (i, j) => (i + 1024) * 2048 + (j + 1024), NONE = [];
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296); }

// grade de ocupação: 1 = ocupado (prédio, rua, água, parque, aeroporto)
function occupancy(data) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const r of data.roads) for (const [x, z] of r.p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  x0 -= 50; z0 -= 50; x1 += 50; z1 += 50;
  const GW = Math.ceil((x1 - x0) / RES), GH = Math.ceil((z1 - z0) / RES), g = new Uint8Array(GW * GH);
  // varredura por linha da grade. Polígono grande (água, parque, área sem casario) usa lista de arestas ativas em vez de
  // testar todas as arestas em cada linha; o cálculo do x de cada cruzamento é o mesmo, então a grade sai igual.
  const xs = [];
  const fillPoly = (ring, v = 1) => {
    if (!ring || ring.length < 3) return;
    const N = ring.length;
    let a = Infinity, b = -Infinity; for (let i = 0; i < N; i++) { const q = ring[i][1]; if (q < a) a = q; if (q > b) b = q; }
    const r0 = Math.max(0, Math.floor((a - z0) / RES)), r1 = Math.min(GH - 1, Math.floor((b - z0) / RES));
    if (r1 < r0) return;
    const span = (r) => {
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) { const c0 = Math.max(0, Math.ceil((xs[k] - x0) / RES - 0.5)), c1 = Math.min(GW - 1, Math.floor((xs[k + 1] - x0) / RES - 0.5)); if (c1 >= c0) g.fill(v, r * GW + c0, r * GW + c1 + 1); }
    };
    if (N <= 24) {
      for (let r = r0; r <= r1; r++) {
        const z = z0 + (r + 0.5) * RES; xs.length = 0;
        for (let i = 0, j = N - 1; i < N; j = i++) { const P = ring[i], Q = ring[j], ax = P[0], az = P[1], bx = Q[0], bz = Q[1]; if ((az > z) !== (bz > z)) xs.push(ax + ((z - az) * (bx - ax)) / (bz - az)); }
        span(r);
      }
      return;
    }
    // arestas (i, j = anterior) em ordem de z mínimo; uma aresta corta a linha z quando min ≤ z < max
    const E = [];
    for (let i = 0, j = N - 1; i < N; j = i++) { const az = ring[i][1], bz = ring[j][1]; if (az !== bz) E.push(i, j, Math.min(az, bz), Math.max(az, bz)); }
    const ord = Array.from({ length: E.length / 4 }, (_, k) => k).sort((p, q) => E[p * 4 + 2] - E[q * 4 + 2]);
    let next = 0; const act = [];
    for (let r = r0; r <= r1; r++) {
      const z = z0 + (r + 0.5) * RES;
      while (next < ord.length && E[ord[next] * 4 + 2] <= z) act.push(ord[next++]);
      let w = 0; for (let k = 0; k < act.length; k++) if (E[act[k] * 4 + 3] > z) act[w++] = act[k]; act.length = w;
      xs.length = 0;
      for (let k = 0; k < w; k++) { const e = act[k] * 4, P = ring[E[e]], Q = ring[E[e + 1]], ax = P[0], az = P[1], bx = Q[0], bz = Q[1]; xs.push(ax + ((z - az) * (bx - ax)) / (bz - az)); }
      span(r);
    }
  };
  const disc = (x, z, rad) => { const c0 = Math.floor((x - rad - x0) / RES), c1 = Math.floor((x + rad - x0) / RES), r0 = Math.floor((z - rad - z0) / RES), r1 = Math.floor((z + rad - z0) / RES); for (let r = Math.max(0, r0); r <= Math.min(GH - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(GW - 1, c1); c++) { const cx = x0 + (c + 0.5) * RES, cz = z0 + (r + 0.5) * RES; if ((cx - x) ** 2 + (cz - z) ** 2 <= rad * rad) g[r * GW + c] = 1; } };
  const band = (x, z, rad) => { const c0 = Math.floor((x - rad - x0) / RES), c1 = Math.floor((x + rad - x0) / RES), r0 = Math.floor((z - rad - z0) / RES), r1 = Math.floor((z + rad - z0) / RES); for (let r = Math.max(0, r0); r <= Math.min(GH - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(GW - 1, c1); c++) { const k = r * GW + c; if (g[k]) continue; const cx = x0 + (c + 0.5) * RES, cz = z0 + (r + 0.5) * RES; if ((cx - x) ** 2 + (cz - z) ** 2 <= rad * rad) g[k] = 4; } };
  const line = (p, rad) => { for (let i = 0; i < p.length - 1; i++) { const [ax, az] = p[i], [bx, bz] = p[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 2)); for (let j = 0; j <= n; j++) disc(ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n, rad); } };
  // 1 = rua/parque/aeroporto, 2 = prédio (conta como bairro), 3 = água, 4 = beira d'água (mangue, sem casa gerada)
  for (const w of data.water || []) fillPoly(w, 3);
  for (const w of data.water || []) { let per = 0; for (let i = 1; i < w.length; i++) per += Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]); if (per < 150) continue;
    for (let i = 0; i < w.length - 1; i++) { const [ax, az] = w[i], [bx, bz] = w[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 6)); for (let j = 0; j <= n; j++) band(ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n, 30); } }
  for (const p of data.parks || []) fillPoly(p.p);
  for (const b of data.buildings) fillPoly(b.p, 2);
  for (const a of data.aeroway || []) { if (a.k === 'apron' || a.k === 'aerodrome') fillPoly(a.p); else line(a.p, (a.w || 30) / 2 + 8); }
  for (const r of data.roads) line(r.p, (W[r.k] || 4) / 2 + (DRIVE.has(r.k) ? 2.2 : 1));
  for (const ring of data.noInfill || []) fillPoly(ring); // áreas abertas de propósito (praças refeitas, frente dos estádios)
  // estacionamento, aeroporto, porto, indústria, comércio, ferrovia, quartel, cemitério (scripts/areas-sem-casario.py):
  // o que tem de prédio ali vem do OSM e da Microsoft; casa gerada não
  for (const ring of data.semCasario || []) fillPoly(ring);
  return { g, GW, GH, x0, z0 };
}

export function infillCity(data, max = 230000, rows = 2) {
  if (data.infilled) return 0;
  data.infilled = true;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const O = occupancy(data), { g, GW, GH, x0, z0 } = O;
  const tOcc = performance.now() - t0;
  // densidade só dos prédios do OSM (antes de gerar qualquer coisa), numa grade de 16 m: diz onde o OSM já desenhou o bairro
  const K0 = 4, CW0 = Math.ceil(GW / K0), CH0 = Math.ceil(GH / K0), osmCnt = new Uint16Array(CW0 * CH0);
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) if (g[r * GW + c] === 2) osmCnt[((r / K0) | 0) * CW0 + ((c / K0) | 0)]++;
  const osmDense = (x, z, th = 0.14) => {
    const ci = Math.floor((x - x0) / RES / K0), cj = Math.floor((z - z0) / RES / K0); let occ = 0, tot = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const a = ci + i, b = cj + j; if (a < 0 || b < 0 || a >= CW0 || b >= CH0) continue; tot += K0 * K0; occ += osmCnt[b * CW0 + a]; }
    return tot && occ / tot > th;
  };
  const cell = (x, z) => { const c = Math.floor((x - x0) / RES), r = Math.floor((z - z0) / RES); return c < 0 || r < 0 || c >= GW || r >= GH ? -1 : r * GW + c; };
  // retângulo livre? (amostra a cada 2 m)
  const rect = (cx, cz, ux, uz, w, d, mark) => {
    for (let a = -w / 2 + 0.6; a <= w / 2 - 0.6; a += 2) for (let b = -d / 2 + 0.6; b <= d / 2 - 0.6; b += 2) {
      const x = cx + ux * a - uz * b, z = cz + uz * a + ux * b, i = cell(x, z);
      if (mark) { if (i >= 0) g[i] = 2; } else if (i < 0 || g[i]) return false;
    }
    return true;
  };
  const R = rng(1730);
  let n = 0;
  // orla de Boa Viagem/Pina: x da avenida beira-mar por faixa de 50 m de z (o mesmo do orlaIndex do world.js, que é
  // montado depois). Do lado do mar não se gera nada (é areia); a até 160 m da avenida, a primeira fila é de torres:
  // o lote cresce pra ≥ ~300 m² e a regra de altura do world.js faz o resto
  const OB = 50, orlaX = new Map();
  for (const r of data.roads) {
    if (!r.n || !/^Avenida (Boa Viagem|Herculano Bandeira)/.test(r.n)) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], st = Math.max(1, Math.ceil(Math.abs(bz - az) / 20));
      for (let k = 0; k <= st; k++) { const x = ax + ((bx - ax) * k) / st, z = az + ((bz - az) * k) / st, b = Math.floor(z / OB); if (!(orlaX.get(b) >= x)) orlaX.set(b, x); }
    }
  }
  const inland = (x, z) => { const ox = orlaX.get(Math.floor(z / OB)); return ox == null ? NaN : ox - x; };
  const add = (cx, cz, ux, uz, w, d) => {
    const io = inland(cx, cz);
    // só a faixa de areia de Boa Viagem: até 150 m do lado do mar e do começo da avenida pro sul (z > −700); mais a
    // leste e mais ao norte é Pina e Brasília Teimosa, que têm casa de verdade
    const praia = io > -150 && cz > -700;
    if (praia && io < 8) return; // lado do mar da avenida (e o canteiro): areia, sem casa gerada
    if (praia && io < 160 && w * d < 300) { const nw = Math.max(w, 16), nd = Math.max(d, 19); if (!rect(cx, cz, ux, uz, nw, nd, false)) return; w = nw; d = nd; }
    rect(cx, cz, ux, uz, w, d, true);
    const hw = w / 2, hd = d / 2, P = (a, b) => [Math.round((cx + ux * a - uz * b) * 10) / 10, Math.round((cz + uz * a + ux * b) * 10) / 10];
    data.buildings.push({ p: [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)], h: null, t: 'yes', gen: true, infill: true, cx, cz });
    n++;
  };
  // cobertura do solo (WorldCover): lote no meio da mata, do brejo ou do mangue fica vazio
  const cob = data.cobertura;
  const forest = (x, z) => { if (!cob) return false; const k = cob.at(x, z); return k === COB.AGUA || k === COB.BREJO || k === COB.MANGUE || cob.frac(x, z, COB.ARVORE, 22) > 0.8; }; // a classe do ponto (barata) antes da fração no raio
  // ruas mais largas primeiro (avenida tem prédio mais alto na frente)
  const order = data.roads.filter((r) => DRIVE.has(r.k) && !r.b && !r.tu && r.p.length >= 2).sort((a, b) => (W[b.k] || 0) - (W[a.k] || 0));
  for (const r of order) {
    const half = (W[r.k] || 7) / 2, big = (W[r.k] || 7) >= 10;
    for (let i = 0; i < r.p.length - 1 && n < max; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 10) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (const s of [1, -1]) {
        let t = 3 + R() * 3;
        while (t < L - 4 && n < max) {
          const w = big ? 12 + R() * 14 : 7 + R() * 7, d = big ? 16 + R() * 14 : 11 + R() * 10;
          const off = half + 2.6 + d / 2, mx = ax + ux * (t + w / 2), mz = az + uz * (t + w / 2);
          const cx = mx - uz * s * off, cz = mz + ux * s * off;
          if (t + w <= L && rect(cx, cz, ux, uz, w, d, false) && !forest(cx, cz)) {
            add(cx, cz, ux, uz, w, d);
            // fundo do lote: uma segunda casa atrás (miolo de quarteirão), quando cabe
            if (rows > 1) { const d2 = 9 + R() * 8, o2 = off + d / 2 + 1.2 + d2 / 2, c2x = mx - uz * s * o2, c2z = mz + ux * s * o2; if (rect(c2x, c2z, ux, uz, w * 0.9, d2, false)) add(c2x, c2z, ux, uz, w * 0.9, d2); }
            t += w + (R() < 0.7 ? 0.2 : 1.5);
          } else t += 3;
        }
      }
    }
  }
  // miolo de quarteirão: casas em grade, alinhadas com a rua mais perto, só onde a vizinhança já é construída
  const SEG = new Map(), SC = 60;
  for (const r of data.roads) if (DRIVE.has(r.k) || r.k === 'service') for (let i = 0; i < r.p.length - 1; i++) { const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 2) continue; const k = segKey(Math.floor((ax + bx) / 2 / SC), Math.floor((az + bz) / 2 / SC)); if (!SEG.has(k)) SEG.set(k, []); SEG.get(k).push([ax, az, (bx - ax) / L, (bz - az) / L, L]); }
  const dirAt = (x, z) => { // distância ao quadrado (sem raiz por segmento)
    let best = null, bd = Infinity; const cx = Math.floor(x / SC), cz = Math.floor(z / SC);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const L = SEG.get(segKey(cx + i, cz + j)); if (!L) continue;
      for (let k = 0; k < L.length; k++) { const sg = L[k], t = Math.max(0, Math.min(sg[4], (x - sg[0]) * sg[2] + (z - sg[1]) * sg[3])), ex = sg[0] + sg[2] * t - x, ez = sg[1] + sg[3] * t - z, d = ex * ex + ez * ez; if (d < bd) { bd = d; best = sg; } } }
    return best && bd < 16900 ? [best[2], best[3]] : null;
  };
  // densidade de prédio numa grade grossa (16 m), calculada uma vez: "bairro" = vizinhança de ~48 m com 22% ou mais de
  // prédio (antes era uma amostra de 121 células por candidato, lenta demais no mapa do Recife inteiro)
  const K = 4, CW = Math.ceil(GW / K), CH = Math.ceil(GH / K), cnt = new Uint16Array(CW * CH);
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) if (g[r * GW + c] === 2) cnt[((r / K) | 0) * CW + ((c / K) | 0)]++;
  const dense = (x, z) => {
    const ci = Math.floor((x - x0) / RES / K), cj = Math.floor((z - z0) / RES / K); let occ = 0, tot = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const a = ci + i, b = cj + j; if (a < 0 || b < 0 || a >= CW || b >= CH) continue; tot += K * K; occ += cnt[b * CW + a]; }
    return tot && occ / tot > 0.14;
  };
  for (let z = z0 + 8; z < z0 + GH * RES - 8 && n < max; z += 11) for (let x = x0 + 8; x < x0 + GW * RES - 8 && n < max; x += 11) {
    const i = cell(x, z); if (i < 0 || g[i]) continue;
    if (!dense(x, z)) continue;
    const dir = dirAt(x, z); if (!dir) continue;
    const w = 7 + R() * 5, d = 8 + R() * 6, jx = x + (R() - 0.5) * 3, jz = z + (R() - 0.5) * 3;
    if (rect(jx, jz, dir[0], dir[1], w, d, false)) add(jx, jz, dir[0], dir[1], w, d);
  }
  // morros habitados: o OSM quase não tem as casas de Nova Descoberta, Passarinho, Dois Unidos… (no satélite é tudo
  // casario autoconstruído, colado, subindo a encosta). Aqui não se exige vizinhança densa: casinhas pequenas e coloridas
  // alinhadas com a rua, escadaria ou beco mais perto, com uma folga aqui e ali para quintal e árvore.
  const SEG2 = new Map();
  for (const r of data.roads) for (let i = 0; i < r.p.length - 1; i++) { const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 2) continue; const k = segKey(Math.floor((ax + bx) / 2 / SC), Math.floor((az + bz) / 2 / SC)); if (!SEG2.has(k)) SEG2.set(k, []); SEG2.get(k).push([ax, az, (bx - ax) / L, (bz - az) / L, L]); }
  const dirAny = (x, z) => { // distância ao quadrado (sem raiz por segmento)
    let best = null, bd = Infinity; const cx = Math.floor(x / SC), cz = Math.floor(z / SC);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const L = SEG2.get(segKey(cx + i, cz + j)); if (!L) continue;
      for (let k = 0; k < L.length; k++) { const sg = L[k], t = Math.max(0, Math.min(sg[4], (x - sg[0]) * sg[2] + (z - sg[1]) * sg[3])), ex = sg[0] + sg[2] * t - x, ez = sg[1] + sg[3] * t - z, d = ex * ex + ez * ez; if (d < bd) { bd = d; best = sg; } } }
    return best && bd < 16900 ? [best[2], best[3], Math.sqrt(bd)] : null;
  };
  const morros = [];
  for (const [name, [H, Rh]] of Object.entries(HILLS)) { if (MATA.has(name)) continue; const b = (data.bairros || []).find((q) => q.name === name); if (b) morros.push({ x: b.x, z: b.z, R: Rh * 0.85, H }); }
  let nm = 0;
  for (const M of morros) {
    for (let z = M.z - M.R; z < M.z + M.R; z += 8.5) for (let x = M.x - M.R; x < M.x + M.R; x += 8.5) {
      if (Math.hypot(x - M.x, z - M.z) > M.R * (0.8 + 0.25 * R())) continue;
      if (R() < 0.12) continue; // quintal, mato, campinho
      const i = cell(x, z); if (i < 0 || g[i]) continue;
      const dir = dirAny(x, z); if (!dir || dir[2] > 90) continue;
      const w = 5 + R() * 3.5, d = 6 + R() * 3.5, jx = x + (R() - 0.5) * 2, jz = z + (R() - 0.5) * 2;
      if (!rect(jx, jz, dir[0], dir[1], w, d, false)) continue;
      add(jx, jz, dir[0], dir[1], w, d);
      const b = data.buildings[data.buildings.length - 1], floors = 1 + (R() < 0.55 ? 1 : 0) + (R() < 0.15 ? 1 : 0);
      b.h = floors * 3 + R() * 0.3; b.style = 'comunidade'; b.c = VIVID[Math.floor(R() * VIVID.length)]; b.morro = true;
      if (R() < 0.75) b.tank = [(R() - 0.5) * 2, (R() - 0.5) * 2];
      nm++;
    }
  }
  // o que o passe da beira da rua já tinha posto dentro do morro também vira casa de comunidade (nada de prédio de 6
  // andares no alto de Nova Descoberta)
  for (const b of data.buildings) {
    if (!b.infill || b.morro) continue;
    if (!morros.some((M) => Math.hypot(b.cx - M.x, b.cz - M.z) < M.R)) continue;
    const floors = 1 + (R() < 0.55 ? 1 : 0) + (R() < 0.2 ? 1 : 0);
    b.h = floors * 3 + R() * 0.3; b.style = 'comunidade'; b.c = VIVID[Math.floor(R() * VIVID.length)]; b.morro = true;
    if (R() < 0.75) b.tank = [(R() - 0.5) * 2, (R() - 0.5) * 2];
  }
  data.morroCount = nm;
  // bairro que o satélite mostra construído e o OSM deixou vazio (Ibura, Jordão Alto, Monte Verde, Totó, Beberibe…):
  // casario baixo e colado, alinhado com a rua, beco ou escadaria mais perto
  let nc = 0, lastDir = [1, 0, 0];
  // dentro do município? (meta.limit, rasterizado a 50 m uma vez; sem limite, tudo vale)
  const LIM = data.meta?.limit, LS = 50, lw = Math.ceil((GW * RES) / LS), lh = Math.ceil((GH * RES) / LS), lim = LIM ? new Uint8Array(lw * lh) : null;
  if (lim) for (let r = 0; r < lh; r++) {
    const z = z0 + (r + 0.5) * LS, xs = [];
    for (const ring of LIM) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[i], [bx, bz] = ring[j]; if ((az > z) !== (bz > z)) xs.push(ax + ((z - az) * (bx - ax)) / (bz - az)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let c = Math.max(0, Math.ceil((xs[k] - x0) / LS - 0.5)); c <= Math.min(lw - 1, Math.floor((xs[k + 1] - x0) / LS - 0.5)); c++) lim[r * lw + c] = 1;
  }
  const inCity = (x, z) => !lim || lim[Math.floor((z - z0) / LS) * lw + Math.floor((x - x0) / LS)] === 1;
  if (cob) for (let z = z0 + 8; z < z0 + GH * RES - 8; z += 8.5) for (let x = x0 + 8; x < x0 + GW * RES - 8; x += 8.5) {
    const i = cell(x, z); if (i < 0 || g[i] || osmDense(x, z) || !inCity(x, z)) continue;
    if (cob.at(x, z) !== COB.CONSTRUIDO || cob.frac(x, z, COB.CONSTRUIDO, 18) < 0.55) continue;
    if (R() < 0.1) continue;
    // os becos dessas áreas quase nunca estão no OSM: sem rua perto, a casa segue a última direção usada
    const dir = dirAny(x, z) || lastDir; lastDir = dir;
    // lote menor que a grade (8,5 m); girada pela rua, a casa pode não caber: tenta menor antes de desistir
    let w = 5 + R() * 2.3, d = 5.8 + R() * 1.8; const jx = x + (R() - 0.5) * 1, jz = z + (R() - 0.5) * 1;
    let ok = rect(jx, jz, dir[0], dir[1], w, d, false);
    for (let k = 0; k < 2 && !ok; k++) { w *= 0.8; d *= 0.8; ok = w > 3.6 && rect(jx, jz, dir[0], dir[1], w, d, false); }
    if (!ok) continue;
    add(jx, jz, dir[0], dir[1], w, d);
    const b = data.buildings[data.buildings.length - 1], floors = 1 + (R() < 0.5 ? 1 : 0) + (R() < 0.12 ? 1 : 0);
    b.h = floors * 3 + R() * 0.3; b.style = 'comunidade'; b.c = VIVID[Math.floor(R() * VIVID.length)]; b.cob = true;
    if (R() < 0.7) b.tank = [(R() - 0.5) * 2, (R() - 0.5) * 2];
    nc++;
  }
  data.cobCount = nc;
  // o que sobrou livre no meio do bairro vira quintal com árvore (no satélite é tudo copa verde)
  // sorteio uniforme (reservatório): com o mapa grande, o limite não acaba só no norte
  const yards = (data.yardTrees = []), YMAX = 120000; let seen = 0;
  for (let z = z0 + 6; z < z0 + GH * RES - 6; z += 9) for (let x = x0 + 6; x < x0 + GW * RES - 6; x += 9) {
    const jx = x + (R() - 0.5) * 5, jz = z + (R() - 0.5) * 5, i = cell(jx, jz); if (i < 0 || g[i]) continue;
    let ok = true; for (let q = 0; q < 8 && ok; q += 2) { const k = cell(jx + VIZ[q], jz + VIZ[q + 1]); if (k < 0 || g[k]) ok = false; }
    if (!ok || (cob ? cob.at(jx, jz) !== COB.ARVORE : !dense(jx, jz))) continue;
    const t = [jx, jz, 0.7 + R() * 0.7, R() * 6]; seen++;
    if (yards.length < YMAX) yards.push(t); else { const r = Math.floor(R() * seen); if (r < YMAX) yards[r] = t; }
  }
  data.infillMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  data.infillCount = n;
  data.infillOccMs = Math.round(tOcc);
  return n;
}

// mangue: árvores baixas e cerradas na terra livre perto da água (margens de rio e da maré)
export function buildMangue(group, data, env) {
  const anim = [];
  const pts = [], R = rng(99);
  const water = data.water || [];
  for (const w of water) {
    let per = 0; for (let i = 1; i < w.length; i++) per += Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]);
    if (per < 150) continue; // laguinhos e piscinas não
    for (let i = 0; i < w.length - 1; i++) {
      const [ax, az] = w[i], [bx, bz] = w[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let t = 0; t < L; t += 5) {
        const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L;
        for (let k = 0; k < 3; k++) {
          const a = R() * Math.PI * 2, r = 4 + R() * 26, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
          if (env.isWater(px, pz) || env.isSolid(px, pz) || env.isRoad?.(px, pz)) continue;
          // longe de rua e de prédio (terreno de margem, não quintal)
          let ok = true; for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) if (env.isRoad?.(px + dx, pz + dz) || env.isSolid(px + dx, pz + dz)) ok = false;
          if (ok) pts.push([px, pz, 0.7 + R() * 0.8, R() * 6]);
        }
      }
    }
  }
  // quintais: mangueira, jaqueira, cajueiro… copa redonda mais alta que o mangue
  for (const [x, z, sc, yaw] of data.yardTrees || []) if (!env.isSolid(x, z) && !env.isRoad?.(x, z) && !env.isWater(x, z)) pts.push([x, z, sc * 1.25, yaw, 1]);
  // mata atlântica: copas largas a cada ~12 m que se fecham num dossel só. Vem da cobertura do WorldCover quando ela
  // existe; senão, das matas do OSM (data.matas), por varredura de linhas em cada polígono. O que cai fora do
  // município, em rua, prédio ou água fica de fora
  const mata = [], MMAX = 400000; let mseen = 0;
  const cob = data.cobertura, push = (t) => { mseen++; if (mata.length < MMAX) mata.push(t); else { const r = Math.floor(R() * mseen); if (r < MMAX) mata[r] = t; } };
  // com a cobertura do WorldCover, a mata vem dela (copa fechada de verdade, não só o que o OSM desenhou)
  // parques e praças urbanos do OSM (não mata): Jaqueira, Tamarineira, 13 de Maio… lá a copa do satélite é de árvores
  // grandes soltas no gramado, não mata fechada. Grade de 10 m marcando o que é parque.
  // densidade por parque: a Jaqueira é quase mata fechada nas fotos; os outros, árvore solta no gramado
  // (os parques não têm nome no mapa: vale o polígono que contém o ponto do lugar)
  const DENSO = [['Parque da Jaqueira', 0.85]].map(([n, f]) => { const q = (data.pois || []).find((o) => o.name === n); return q && { x: q.x, z: q.z, f }; }).filter(Boolean);
  const dentro = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[i], [bx, bz] = ring[j]; if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) c = !c; } return c; };
  const PK = 10, parkCells = new Map();
  for (const pk of data.parks || []) {
    if (pk.mata || pk.k !== 'green') continue;
    const ring = pk.p; let za = Infinity, zb = -Infinity; for (const q of ring) { if (q[1] < za) za = q[1]; if (q[1] > zb) zb = q[1]; }
    for (let z = Math.floor(za / PK) * PK + PK / 2; z < zb; z += PK) {
      const xs = []; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[i], [bx, bz] = ring[j]; if ((az > z) !== (bz > z)) xs.push(ax + ((z - az) * (bx - ax)) / (bz - az)); }
      xs.sort((a, b) => a - b);
      const dens = DENSO.find((q) => dentro(ring, q.x, q.z))?.f ?? 0.27;
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.floor(xs[k] / PK) * PK + PK / 2; x < xs[k + 1]; x += PK) parkCells.set(Math.floor(x / PK) + ',' + Math.floor(z / PK), dens);
    }
  }
  const inPark = (x, z) => parkCells.get(Math.floor(x / PK) + ',' + Math.floor(z / PK)); // fração de copa que fica (ou undefined)
  if (cob) {
    let xa = Infinity, xb = -Infinity, za = Infinity, zb = -Infinity;
    for (const r of data.roads) for (const [x, z] of r.p) { if (x < xa) xa = x; if (x > xb) xb = x; if (z < za) za = z; if (z > zb) zb = z; }
    for (let z = za; z < zb; z += 13) for (let x = xa; x < xb; x += 13) {
      const px = x + (R() - 0.5) * 10, pz = z + (R() - 0.5) * 10, k = cob.at(px, pz);
      if (k !== COB.ARVORE && k !== COB.MANGUE) continue;
      if (k === COB.ARVORE && cob.frac(px, pz, COB.ARVORE, 22) < 0.6) continue; // árvore solta de rua não vira mata
      if (env.isSolid(px, pz) || env.isWater(px, pz) || env.isRoad?.(px, pz)) continue;
      // no parque: uma árvore grande a cada ~4 pontos, de copa redonda (árvore de praça), com gramado em volta
      const fp = inPark(px, pz);
      if (fp != null) { if (R() < fp) push([px, pz, 1.4 + R() * 0.6, R() * 6, fp > 0.5 ? 2 : 1]); continue; }
      push(k === COB.MANGUE ? [px, pz, 1 + R() * 0.7, R() * 6] : [px, pz, 1.9 + R() * 0.9, R() * 6, 2]);
    }
  }
  for (const M of cob ? [] : data.matas || []) {
    const ring = M.p; let za = Infinity, zb = -Infinity; for (const q of ring) { if (q[1] < za) za = q[1]; if (q[1] > zb) zb = q[1]; }
    for (let z = za + 6; z < zb; z += 12) {
      const xs = [];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[i], [bx, bz] = ring[j]; if ((az > z) !== (bz > z)) xs.push(ax + ((z - az) * (bx - ax)) / (bz - az)); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = xs[k] + 6; x < xs[k + 1]; x += 12) {
        const px = x + (R() - 0.5) * 9, pz = z + (R() - 0.5) * 9;
        if (env.isSolid(px, pz) || env.isWater(px, pz) || env.isRoad?.(px, pz)) continue;
        push([px, pz, 1.9 + R() * 0.9, R() * 6, 2]);
      }
    }
  }
  for (const t of mata) pts.push(t);
  data.mataCount = mata.length; data.mataSeen = mseen;
  if (!pts.length) return anim;
  const crown = new THREE.IcosahedronGeometry(1, 1); crown.scale(2.6, 1.5, 2.6); crown.translate(0, 3.2, 0);
  const roots = new THREE.CylinderGeometry(0.15, 0.5, 2.4, 6); roots.translate(0, 1.2, 0);
  const matC = new THREE.MeshStandardMaterial({ color: '#3d6b35', roughness: 0.9, emissive: '#1f3a17', emissiveIntensity: 0.45 }) /* sem isso, de baixo a copa fica preta contra o céu */, matR = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 1 });
  // blocos de 800 m. Guardados compactos (5 números por árvore); a malha só existe perto da câmera e é desmontada
  // longe: com ~500 mil árvores, manter tudo montado segurava ~70 MB de matrizes que nunca iam para a tela
  crown.computeBoundingSphere(); roots.computeBoundingSphere();
  const CH = 800, chunks = new Map();
  for (const p of pts) { const k = Math.floor(p[0] / CH) + ',' + Math.floor(p[1] / CH); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(p); }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color();
  const list = [];
  for (const [k, arr] of chunks) {
    const f = new Float32Array(arr.length * 5);
    arr.forEach(([x, z, sc, yaw, yard], i) => { f.set([x, z, sc, yaw, yard || 0], i * 5); });
    const [cx, cz] = k.split(',').map((t) => (Number(t) + 0.5) * CH);
    list.push({ cx, cz, f, ms: null });
  }
  const montar = (L) => {
    const n = L.f.length / 5, ic = new THREE.InstancedMesh(crown, matC, n), ir = new THREE.InstancedMesh(roots, matR, n);
    for (let i = 0; i < n; i++) {
      const x = L.f[i * 5], z = L.f[i * 5 + 1], sc = L.f[i * 5 + 2], yaw = L.f[i * 5 + 3], yard = L.f[i * 5 + 4];
      // yard: 1 = árvore de quintal, 2 = mata (mais alta e escura); o chão dos morros sobe (heightAt)
      m.compose(v.set(x, heightAt(x, z) - 0.2, z), q.setFromEuler(e.set(0, yaw, 0)), s.set(sc, yard === 2 ? sc * (0.9 + (i % 4) * 0.12) : sc * (yard ? 1.6 : 0.8 + (i % 3) * 0.15), sc)); ic.setMatrixAt(i, m); ir.setMatrixAt(i, m);
      ic.setColorAt(i, c.set(yard === 2 ? ['#3f7535', '#4d8a3c', '#36682f', '#5a9446', '#447d38'][i % 5] : yard ? ['#5f8f3f', '#6f9d48', '#4e7a37', '#7fae55'][i % 4] : ['#3d6b35', '#4a7a3c', '#355f2f', '#567f40'][i % 4]));
    }
    const drop = function () { this.array = null; }; // depois de ir para a placa de vídeo, a cópia do JS sai
    for (const im of [ic, ir]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); im.instanceMatrix.onUpload(drop); im.instanceColor?.onUpload(drop); group.add(im); }
    L.ms = [ic, ir];
  };
  const desmontar = (L) => { for (const im of L.ms) { group.remove(im); im.dispose(); } L.ms = null; };
  // perto (< 1,5 km) monta, longe (> 1,9 km) desmonta; no máximo 2 blocos montados por quadro para não engasgar
  anim.push((t, cam) => {
    if (!cam) return;
    let built = 0;
    for (const L of list) {
      const d = Math.hypot(L.cx - cam.x, L.cz - cam.z);
      if (d < 1500 && !L.ms && built < 2) { montar(L); built++; } else if (d > 1900 && L.ms) desmontar(L);
    }
  });
  data.mangueCount = pts.length;
  data.yardTrees = []; data.matas = []; // já viraram blocos compactos acima
  // as listas de trabalho ficam presas no escopo enquanto a animação dos blocos viver (o `push` usa `mata`): esvazia
  mata.length = 0; pts.length = 0; chunks.clear();
  return anim;
}
