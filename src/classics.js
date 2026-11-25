// Pontos clássicos do Recife modelados por código, no lugar exato do OSM:
// igrejas barrocas, prédios neoclássicos, Mercado de São José, fortes, pontes, Cinema São Luiz, Casa da Cultura,
// Praça do Arsenal, Rua do Bom Jesus, Bonecos Gigantes, Parque das Esculturas e a praia de Boa Viagem.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makePerson } from './models.js';
import { stampBox, stampMesh, stampDisc, stampHull } from './collide.js';
import { heightAt } from './terrain.js';
import { buildLugares } from './lugares.js';
import { prepareOrla } from './orla.js';
import { prepareMarcos, MARCOS } from './marcos.js';
import { prepareMarcoZero, MZ_SKIP } from './marcozero.js';

const B = new THREE.BoxGeometry(1, 1, 1);
const SOLID = 4;

// ---------------------------------------------------------------- utilidades
function bake(items) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  return mergeGeometries(items.map(([geo, sc, ps, rt, order]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    m.compose(new THREE.Vector3(...ps), q.setFromEuler(e.set(...(rt || [0, 0, 0]), order || 'XYZ')), new THREE.Vector3(...sc));
    return g.applyMatrix4(m);
  }));
}
let DRIVE_F = null;
const insideRing = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [ax, az] = r[i], [bx, bz] = r[j]; if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) c = !c; } return c; };
export function setDriveFilter(f) { DRIVE_F = f; }
// junta peças por material e cria um grupo posicionado no mundo
export class Kit {
  constructor() { this.parts = new Map(); }
  add(mat, geo, s, p, r, order) { if (!this.parts.has(mat)) this.parts.set(mat, []); this.parts.get(mat).push([geo, s, p, r, order]); return this; }
  box(mat, sx, sy, sz, x, y, z, r) { return this.add(mat, B, [sx, sy, sz], [x, y, z], r); }
  // collide: carimba na grade a projeção de cada peça (não do conjunto inteiro, que pode ser uma rua toda)
  build(parent, x = 0, z = 0, rotY = 0, shadow = true, collide = true) {
    // peça pequena e baixa (banco, árvore, barraca, mesa, poste…) com o centro na pista de carro: não entra
    if (DRIVE_F && !this.keepOnRoad) {
      const c = Math.cos(rotY), s = Math.sin(rotY);
      for (const [m, list] of this.parts) {
        const keep = list.filter(([geo, sc, ps]) => {
          if (!geo.boundingBox) geo.computeBoundingBox();
          const bb = geo.boundingBox, S = sc || [1, 1, 1];
          const bottom = ps[1] + bb.min.y * S[1], ext = Math.max((bb.max.x - bb.min.x) * S[0], (bb.max.z - bb.min.z) * S[2]);
          if (bottom > 3 || ext > 12) return true;
          const wx = x + ps[0] * c + ps[2] * s, wz = z - ps[0] * s + ps[2] * c;
          return !DRIVE_F(wx, wz);
        });
        if (keep.length) this.parts.set(m, keep); else this.parts.delete(m);
      }
    }
    const g = new THREE.Group();
    for (const [m, list] of this.parts) { const mesh = new THREE.Mesh(bake(list), m); mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh); }
    g.position.set(x, 0, z); g.rotation.y = rotY;
    parent.add(g);
    if (collide) {
      g.updateWorldMatrix(true, false);
      const im = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), M = new THREE.Matrix4();
      for (const list of this.parts.values()) for (const [geo, sc, ps, rt, order] of list) {
        if (!geo.boundingBox) geo.computeBoundingBox();
        im.compose(new THREE.Vector3(...ps), q.setFromEuler(e.set(...(rt || [0, 0, 0]), order || 'XYZ')), new THREE.Vector3(...sc));
        stampBox(geo.boundingBox, M.multiplyMatrices(g.matrixWorld, im));
      }
    }
    return g;
  }
}
const prism = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); };
const halfDisc = (r) => new THREE.CylinderGeometry(r, r, 1, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2); // meio-disco de pé (arco para cima)

// menor retângulo que cobre o contorno (testa a direção de cada aresta)
export function obb(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of ring) { const u = p[0] * ux + p[1] * uz, v = -p[0] * uz + p[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      best = { area, cx: cu * ux - cv * uz, cz: cu * uz + cv * ux, ux, uz, du: u1 - u0, dv: v1 - v0 };
    }
  }
  // eixo longo
  if (best.dv > best.du) { const { ux, uz } = best; Object.assign(best, { ux: -uz, uz: ux, du: best.dv, dv: best.du }); }
  return { cx: best.cx, cz: best.cz, ux: best.ux, uz: best.uz, len: best.du, wid: best.dv };
}
export const ringOf = (b) => { const r = b.p.slice(); if (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop(); return r; };
export const inside = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

// ---------------------------------------------------------------- catálogo
const CHURCHES = {
  'Igreja da Madre de Deus': { towers: 2, wall: '#f4f0e6', trim: '#a89f8f' },
  'Basílica do Carmo': { towers: 1, tall: 1.25, wall: '#f3efe4', trim: '#9c9384' },
  'Concatedral de São Pedro dos Clérigos': { towers: 2, tall: 1.2, wall: '#f2eee5', trim: '#8f877a' },
  'Igreja Nossa Senhora do Livramento': { towers: 1, wall: '#f5efe0', trim: '#b49a5e' },
  'Igreja Matriz do Santíssimo Sacramento de Santo Antônio': { towers: 2, wall: '#f6efdc', trim: '#c8a24a' },
  'Igreja de Nossa Senhora da Conceição dos Militares': { towers: 1, wall: '#f3eee2', trim: '#a39a8a' },
  'Igreja de Nossa Senhora do Rosário dos Homens Pretos': { towers: 1, wall: '#f1e3b8', trim: '#f6f2e8' },
  'Igreja do Divino Espírito Santo': { towers: 2, wall: '#f2eee5', trim: '#9e9686' },
  'Convento e Igreja de Santo Antônio': { towers: 1, wall: '#f4f0e6', trim: '#a39b8b' },
  'Igreja de São José': { towers: 2, wall: '#f3efe6', trim: '#b0a690' },
  'Igreja São José': { skipOnly: true },
  'Igreja de Santa Rita': { towers: 1, wall: '#f4efe2', trim: '#a5a091' },
  'Igreja de Nossa Senhora do Pilar': { towers: 1, wall: '#f3efe6', trim: '#d7b75c' },
  'Igreja de Nossa Senhora do Terço': { towers: 1, wall: '#f5f0e3', trim: '#a39a8a' },
  'Igreja de Santa Tereza da Ordem Terceira do Carmo': { towers: 1, wall: '#f2eee4', trim: '#9b9282' },
  'Igreja de São José do Ribamar': { towers: 1, wall: '#f4f0e6', trim: '#b9a46e' },
  'Igreja de Santa Cruz': { towers: 2, wall: '#f3efe6', trim: '#a39a8a' },
  'Basílica de Nossa Senhora da Penha': { towers: 2, dome: true, tall: 1.15, wall: '#efe8d8', trim: '#a0988a' },
  'Igreja da Soledade': { towers: 1, wall: '#f4efe2', trim: '#a8a090' },
  'Igreja Nossa Senhora das Graças': { towers: 1, wall: '#f4efe6', trim: '#8aa0b8' },
  'Igreja Matriz de Casa forte': { towers: 2, wall: '#f6f1e2', trim: '#c9a24a' },
  'Igreja da Torre': { towers: 1, wall: '#f3eee4', trim: '#9e9686' },
  'Igreja de Nossa Senhora da Saúde': { towers: 1, wall: '#f7f4ee', trim: '#d8b04a' },
  'Paróquia da Madalena': { towers: 2, wall: '#f5f0e2', trim: '#b49a5e' },
  'Igreja Santa Edwirges': { towers: 1, wall: '#f3efe6', trim: '#7a8fa3' },
  // Capela Dourada (Ordem Terceira de São Francisco), ao lado do Convento de Santo Antônio
  'Igreja da Ordem Terceira de São Francisciso': { towers: 1, wall: '#f5f1e6', trim: '#c9a24a' },
  'Basílica Sagrado Coração de Jesus': { towers: 2, tall: 1.3, wall: '#efe9de', trim: '#9a9384' },
  'Igreja Nossa Senhora de Fátima': { towers: 1, wall: '#f6f3ec', trim: '#6f8fb8' },
  // Matriz da Várzea (Paróquia N. S. do Rosário): creme com frisos brancos, uma torre de agulha e frontão curvo
  'Matriz da Várzea - Paróquia Nossa Senhora do Rosário': { towers: 1, towerSide: -1, wall: '#eedfbd', trim: '#f7f4ec' },
};
const NEOCLASSIC = {
  'Teatro Santa Isabel': { wall: '#f3eee4', trim: '#ffffff', h: 15, columns: 6 },
  'Palácio do Campo das Princesas': { wall: '#f1ede2', trim: '#c9c2b2', h: 14, columns: 4 },
  'Estação Ferroviária Central (Capibaribe)': { wall: '#e8c165', trim: '#f8f4ea', h: 12, columns: 0 },
  'Escola de Referencia em Ensino Medio Ginasio Pernambucano (Aurora)': { wall: '#f0e1b0', trim: '#f8f4ea', h: 13, columns: 4 },
  'Palácio da Justiça': { wall: '#efe9dd', trim: '#f8f6f0', h: 18, columns: 6, dome: true },
  'Faculdade de Direito do Recife - UFPE': { wall: '#eadfc4', trim: '#fbf8f0', h: 17, columns: 6, dome: true },
  'Assembleia Legislativa do Estado de Pernambuco': { wall: '#f3efe6', trim: '#ffffff', h: 14, columns: 6 },
  'Museu do Estado': { wall: '#f2e2d8', trim: '#fbf8f2', h: 12, columns: 4 },
  // Recife Antigo
  'Paço do Frevo': { wall: '#f4efe4', trim: '#d7263d', h: 16, columns: 0 },
  'Paço Alfândega': { wall: '#efe2c4', trim: '#fbf8f0', h: 13, columns: 0 },
  // prédios históricos que eram caixas genéricas
  'Câmara Municipal do Recife': { wall: '#efe6d2', trim: '#ffffff', h: 13, columns: 4 },
  'Convento do Carmo': { wall: '#f4f0e6', trim: '#a39b8b', h: 12, columns: 0 },
};
// mercados públicos de ferro (o mesmo desenho do Mercado de São José, que serviu de modelo para os outros)
const MARKETS = ['Mercado de São José', 'Mercado da Encruzilhada', 'Mercado da Madalena', 'Mercado de Afogados', 'Mercado do Cordeiro', 'Mercado de Areias', 'Mercado de Casa Amarela'];
const FORTS = ['Forte das Cinco Pontas', 'Forte do Brum'];

// marca o que vira modelo próprio (o prédio genérico do OSM some) — roda antes de levantar os prédios
export function prepareClassics(data) {
  // o Palácio da Justiça não tem nome no contorno; acha pelo ponto de interesse
  const pj = data.pois.find((p) => p.name === 'Palácio da Justiça');
  if (pj) for (const b of data.buildings) if (!b.n && inside(ringOf(b), pj.x, pj.z)) { b.n = 'Palácio da Justiça'; break; }
  // Museu do Estado (Graças): o ponto fica no jardim; pega o casarão mais perto
  const me = data.pois.find((p) => p.name === 'Museu do Estado');
  if (me) {
    let best = null, bd = 50;
    for (const b of data.buildings) {
      const r = b.p, cx = b.cx, cz = b.cz, d = Math.hypot(cx - me.x, cz - me.z);
      if (d < bd && !b.n && r.length > 3) { bd = d; best = b; }
    }
    if (best) best.n = 'Museu do Estado';
  }
  // Igreja de Nossa Senhora da Saúde (Poço da Panela): o ponto do OSM é um nó; pega a construção mais perto
  const ns = data.pois.find((p) => p.name === 'Nossa Senhora da Saúde');
  if (ns && !data.buildings.some((b) => b.n === 'Igreja de Nossa Senhora da Saúde')) {
    let best = null, bd = 45;
    for (const b of data.buildings) {
      const r = b.p, cx = b.cx, cz = b.cz, d = Math.hypot(cx - ns.x, cz - ns.z);
      if (d < bd && !b.n && r.length > 3) { bd = d; best = b; }
    }
    if (best) best.n = 'Igreja de Nossa Senhora da Saúde';
  }
  // igrejas e museu que no OSM são só um ponto: pega a construção mais perto
  const nameNearest = (poi, name, maxD = 45) => {
    const p = data.pois.find((q) => q.name === poi); if (!p || data.buildings.some((b) => b.n === name)) return;
    let best = null, bd = maxD;
    for (const b of data.buildings) { const r = b.p, cx = b.cx, cz = b.cz, d = Math.hypot(cx - p.x, cz - p.z); if (d < bd && !b.n && r.length > 3 && !b.gen) { bd = d; best = b; } }
    if (best) best.n = name;
  };
  nameNearest('Paroquia da Madalena', 'Paróquia da Madalena');
  nameNearest('Igreja Santa Edwirges', 'Igreja Santa Edwirges');
  nameNearest('Museu da Abolição', 'Museu da Abolição', 60);
  // mercados e o Clube Vassourinhas viram lugares (placa, HUD e mapa)
  for (const b of data.buildings) {
    if (!b.n || !/^(Mercado (da|de|do) |Clube Vassourinhas$)/.test(b.n) || data.pois.some((p) => p.name === b.n)) continue;
    const r = b.p; data.pois.push({ name: b.n, kind: /^Mercado/.test(b.n) ? 'marketplace' : 'theatre', x: r.reduce((s, q) => s + q[0], 0) / r.length, z: r.reduce((s, q) => s + q[1], 0) / r.length });
  }
  const ilha = data.buildings.find((b) => b.n === 'Estádio Adelmar da Costa Carvalho');
  if (ilha && !data.pois.some((p) => p.name === 'Ilha do Retiro (Sport)')) { const r = ilha.p; data.pois.push({ name: 'Ilha do Retiro (Sport)', kind: 'attraction', x: r.reduce((s, q) => s + q[0], 0) / r.length, z: r.reduce((s, q) => s + q[1], 0) / r.length }); }
  // nome popular do estádio do Náutico, para o HUD e o mapa
  const est = data.buildings.find((b) => b.n === 'Estádio Eládio de Barros Carvalho');
  if (est && !data.pois.some((p) => p.name === 'Estádio dos Aflitos')) {
    const r = est.p; data.pois.push({ name: 'Estádio dos Aflitos', kind: 'attraction', x: r.reduce((s, p) => s + p[0], 0) / r.length, z: r.reduce((s, p) => s + p[1], 0) / r.length });
  }
  // Dokas (Rua do Brum, 27-A, 1º andar): sobrado de térreo e primeiro andar logo no começo da rua, que vira modelo próprio
  const brum = data.roads.filter((r) => r.n === 'Rua do Brum').flatMap((r) => r.p).sort((a, b) => b[1] - a[1]);
  if (brum.length > 2) {
    const [ax, az] = brum[0], [bx, bz] = brum[1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
    const near = data.buildings.filter((b) => !b.n && Math.abs(b.cx - ax) < 90 && Math.abs(b.cz - az) < 90);
    let best = null;
    for (const d of [14, 22, 30, 38]) for (const sd of [-1, 1]) for (let t = 3; t < 14 && !(best && best.d <= d); t += 0.5) {
      const x = ax + ux * d + nx * sd * t, z = az + uz * d + nz * sd * t, b = near.find((q) => inside(ringOf(q), x, z));
      if (b) { if (!best || d < best.d || t < best.t) best = { b, d, t, fnx: -nx * sd, fnz: -nz * sd }; break; }
    }
    if (best) { best.b.n = 'Dokas'; best.b.h = 7.4; data.dokas = { b: best.b, fnx: best.fnx, fnz: best.fnz }; }
  }
  prepareOrla(data);
  prepareMarcos(data);
  prepareMarcoZero(data);
  // Quartel do Derby: planta irregular com pátios; fica o contorno real, pintado de amarelo (a torre vem em lugares.js)
  for (const b of data.buildings) if (b.n === 'Quartel do Derby do Comando Geral da Polícia Militar') { b.h = 12; b.c = '#e9c46a'; b.style = 'colonial'; }
  const skip = [...MARCOS, ...MZ_SKIP, 'Dokas', 'Estádio José do Rêgo Maciel - Arruda', 'Edifício Acaiaca', ...Object.keys(CHURCHES), ...Object.keys(NEOCLASSIC), ...FORTS, ...MARKETS, 'Mercado da Boa Vista', 'Geraldão - Ginásio de Esportes Geraldo Magalhães', 'Museu Cais do Sertão', 'Estádio Eládio de Barros Carvalho', 'Estádio Adelmar da Costa Carvalho', 'Chaminé do Antigo Engenho (depois Olaria) da Torre'];
  return { skip, overrides: { 'Casa da Cultura': { color: '#efd9a0', h: 12 }, 'Cinema São Luiz': { color: '#ebe4d4', h: 14 }, 'Museu da Abolição': { color: '#f2e6c4', h: 10 } } };
}

// ---------------------------------------------------------------- construção
export function buildClassics(group, data, named, env) {
  const ph = env.photos;
  const stucco = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, map: ph?.stucco.map || null });
  const M = new Map();
  const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o })); return M.get(k); };
  const dark = mat('#231d18', { roughness: 0.9 });
  const clay = new THREE.MeshStandardMaterial({ color: '#c46a45', roughness: 0.85, map: ph?.clay.map || null });
  const night = [];

  // pontos de rua (para virar a fachada para o lado da rua)
  const roadPts = new Map();
  for (const r of data.roads) for (let i = 0; i < r.p.length - 1; i++) {
    const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d <= L; d += 4) {
      const x = ax + ((bx - ax) * d) / (L || 1), z = az + ((bz - az) * d) / (L || 1), k = Math.floor(x / 50) + ',' + Math.floor(z / 50);
      if (!roadPts.has(k)) roadPts.set(k, []);
      roadPts.get(k).push(x, z);
    }
  }
  const roadDist = (x, z) => {
    let best = 1e9;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = roadPts.get((Math.floor(x / 50) + i) + ',' + (Math.floor(z / 50) + j)); if (!a) continue;
      for (let k = 0; k < a.length; k += 2) best = Math.min(best, Math.hypot(a[k] - x, a[k + 1] - z));
    }
    return best;
  };
  // frente = ponta do eixo longo mais perto da rua
  // frente = ponta do eixo longo com mais espaço livre adiante (igreja olha para o largo/praça); empate: rua mais perto
  const openness = (o, s) => {
    let n = 0;
    const ex = o.cx + o.ux * s * o.len / 2, ez = o.cz + o.uz * s * o.len / 2, px = -o.uz, pz = o.ux;
    for (let d = 2; d <= 26; d += 3) for (let w = -o.wid / 2; w <= o.wid / 2 + 0.01; w += 2.5) {
      const x = ex + o.ux * s * d + px * w, z = ez + o.uz * s * d + pz * w;
      if (env.isSolid(x, z) || env.isWater(x, z)) { if (d < 8) n -= 2; } else n++;
    }
    return n - roadDist(ex, ez) * 0.15;
  };
  const place = (ring) => {
    const o = obb(ring);
    const f = openness(o, 1) >= openness(o, -1) ? 1 : -1;
    return { ...o, rot: Math.atan2(o.ux * f, o.uz * f) };
  };

  // ---------- igreja barroca: nave, frontão com volutas, torres com coruchéu
  function church(o, st) {
    const W = THREE.MathUtils.clamp(o.wid * 0.85, 9, 22), L = THREE.MathUtils.clamp(o.len * 0.9, 16, 60), H = THREE.MathUtils.clamp(W * 0.75, 8, 14) * (st.tall || 1);
    const k = new Kit(), wall = stucco(st.wall), trim = mat(st.trim, { roughness: 0.6 });
    const fz = L / 2;
    k.box(wall, W * 0.92, H, L - 1, 0, H / 2, -0.5);
    k.add(clay, prism(W, W * 0.32), [1, 1, L - 1.5], [0, H, -L / 2 + 0.2]);
    // frontão barroco
    const s = new THREE.Shape(), w2 = W / 2, top = H + W * 0.42;
    s.moveTo(-w2, 0); s.lineTo(w2, 0); s.lineTo(w2, H);
    s.bezierCurveTo(w2 * 0.75, H + 0.2, w2 * 0.6, H + W * 0.06, w2 * 0.45, H + W * 0.16);
    s.bezierCurveTo(w2 * 0.38, H + W * 0.3, w2 * 0.2, top, 0, top);
    s.bezierCurveTo(-w2 * 0.2, top, -w2 * 0.38, H + W * 0.3, -w2 * 0.45, H + W * 0.16);
    s.bezierCurveTo(-w2 * 0.6, H + W * 0.06, -w2 * 0.75, H + 0.2, -w2, H); s.closePath();
    k.add(wall, new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 8 }), [1, 1, 1.1], [0, 0, fz - 1.1]);
    k.box(trim, W + 0.5, 0.55, 1.5, 0, H, fz - 0.55);                                     // cornija
    for (const x of [-w2 + 0.35, w2 - 0.35, -W * 0.17, W * 0.17]) k.box(trim, 0.7, H, 1.3, x, H / 2, fz - 0.5); // pilastras
    k.box(trim, 0.6, 0.6, 0.6, 0, top + 0.3, fz - 0.6); k.box(trim, 0.15, 1.4, 0.15, 0, top + 1.2, fz - 0.6); k.box(trim, 0.7, 0.15, 0.15, 0, top + 1.4, fz - 0.6); // cruz
    // porta em arco, janelas e óculo
    k.box(trim, 3.2, 5.0, 0.3, 0, 2.5, fz + 0.02); k.add(trim, halfDisc(1.6), [1, 1, 0.3], [0, 5.0, fz + 0.02]);
    k.box(dark, 2.4, 4.6, 0.32, 0, 2.3, fz + 0.04); k.add(dark, halfDisc(1.2), [1, 1, 0.32], [0, 4.6, fz + 0.04]);
    for (const x of [-W * 0.32, W * 0.32]) { k.box(trim, 1.6, 2.8, 0.25, x, H * 0.62, fz + 0.02); k.box(dark, 1.1, 2.3, 0.28, x, H * 0.62, fz + 0.03); }
    for (const x of [-W * 0.32, 0, W * 0.32]) if (x) { k.box(trim, 1.4, 2.4, 0.25, x, 2.2, fz + 0.02); k.box(dark, 0.95, 1.9, 0.28, x, 2.2, fz + 0.03); }
    k.add(trim, new THREE.CylinderGeometry(1.0, 1.0, 0.25, 20).rotateX(Math.PI / 2), [1, 1, 1], [0, H + W * 0.2, fz + 0.02]);
    k.add(dark, new THREE.CylinderGeometry(0.7, 0.7, 0.28, 20).rotateX(Math.PI / 2), [1, 1, 1], [0, H + W * 0.2, fz + 0.03]);
    // janelas laterais da nave
    for (let z = fz - 5; z > -L / 2 + 3; z -= 4.5) for (const sx of [-1, 1]) { k.box(trim, 0.25, 2.6, 1.5, sx * W * 0.46, H * 0.62, z); k.box(dark, 0.27, 2.1, 1.0, sx * W * 0.46, H * 0.62, z); }
    // torres sineiras
    const tw = THREE.MathUtils.clamp(W * 0.24, 3, 5), th = H * 1.7;
    const xs = st.towers === 2 ? [-1, 1] : st.towers === 1 ? [st.towerSide || 1] : []; // towerSide −1: torre única à esquerda de quem olha a fachada
    for (const sx of xs) {
      const x = sx * (w2 + tw / 2 - 0.3), z = fz - tw / 2;
      k.box(wall, tw, th, tw, x, th / 2, z);
      for (const y of [H, th]) k.box(trim, tw + 0.4, 0.45, tw + 0.4, x, y, z);
      k.box(dark, tw * 0.45, 2.4, tw + 0.04, x, th - 1.8, z); k.box(dark, tw + 0.04, 2.4, tw * 0.45, x, th - 1.8, z); // sineira
      k.add(trim, new THREE.ConeGeometry(tw * 0.68, tw * 1.5, 4), [1, 1, 1], [x, th + tw * 0.75 + 0.2, z], [0, Math.PI / 4, 0]);
      k.add(trim, new THREE.SphereGeometry(0.3, 8, 6), [1, 1, 1], [x, th + tw * 1.55, z]);
    }
    if (st.dome) {
      const r = W * 0.3, z = -L * 0.2;
      k.add(wall, new THREE.CylinderGeometry(r, r, 3, 20), [1, 1, 1], [0, H + W * 0.32 + 1.5, z]);
      k.add(mat('#7fa395', { roughness: 0.5, metalness: 0.3 }), new THREE.SphereGeometry(r * 1.02, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), [1, 1.15, 1], [0, H + W * 0.32 + 3, z]);
      k.add(trim, new THREE.CylinderGeometry(0.8, 0.8, 2, 10), [1, 1, 1], [0, H + W * 0.32 + 3 + r * 1.15 + 1, z]);
    }
    return k;
  }

  // ---------- neoclássico: bloco com janelas ritmadas, cornija, platibanda e pórtico com frontão
  function neoclassic(o, st) {
    const W = THREE.MathUtils.clamp(o.wid, 14, 60), L = THREE.MathUtils.clamp(o.len, 14, 90), H = st.h;
    const k = new Kit(), wall = stucco(st.wall), trim = mat(st.trim, { roughness: 0.6 }), glass = mat('#2f3a40', { roughness: 0.2, metalness: 0.5 });
    k.box(wall, W, H, L, 0, H / 2, 0);
    k.box(trim, W + 0.8, 0.8, L + 0.8, 0, H - 0.2, 0);
    k.add(mat('#8f8a82', { roughness: 0.8 }), new THREE.CylinderGeometry(0.5, Math.SQRT2 / 2, 1, 4, 1), [W - 1, 2.2, L - 1], [0, H + 1.1, 0], [0, Math.PI / 4, 0]); // telhado de quatro águas baixo
    k.box(trim, W + 0.4, 0.6, L + 0.4, 0, 0.3, 0);
    for (const [sx, sz, w, d] of [[0, 1, W, 0.4], [0, -1, W, 0.4], [1, 0, 0.4, L], [-1, 0, 0.4, L]]) k.box(trim, w, 1.1, d, sx * W / 2, H + 0.55, sz * L / 2); // platibanda
    const floors = Math.max(1, Math.round(H / 5.5)), fh = H / floors;
    const windows = (len, put) => { for (let a = -len / 2 + 2.5; a <= len / 2 - 2.5; a += 3.6) for (let f = 0; f < floors; f++) put(a, f * fh + fh * 0.48); };
    windows(L, (a, y) => { for (const sx of [-1, 1]) { k.box(trim, 0.2, 3.0, 1.7, sx * (W / 2 + 0.05), y, a); k.box(glass, 0.22, 2.5, 1.2, sx * (W / 2 + 0.07), y, a); k.box(trim, 0.4, 0.3, 2.0, sx * (W / 2 + 0.1), y + 1.7, a); } });
    windows(W, (a, y) => { if (Math.abs(a) < W * 0.3 && st.columns) return; for (const sz of [-1, 1]) { k.box(trim, 1.7, 3.0, 0.2, a, y, sz * (L / 2 + 0.05)); k.box(glass, 1.2, 2.5, 0.22, a, y, sz * (L / 2 + 0.07)); } });
    if (st.columns) {
      const pw = W * 0.55, z = L / 2 + 2.6, ch = H * 0.82;
      k.box(trim, pw + 1, 0.9, 5.4, 0, 0.45, L / 2 + 2.6);
      for (let i = 0; i < st.columns; i++) {
        const x = -pw / 2 + (pw * i) / (st.columns - 1);
        k.add(trim, new THREE.CylinderGeometry(0.45, 0.55, ch - 0.9, 14), [1, 1, 1], [x, 0.9 + (ch - 0.9) / 2, z + 1.6]);
      }
      k.box(trim, pw + 1, 1.3, 4.6, 0, ch + 0.65, z + 0.4);
      k.add(trim, prism(pw + 1.2, 3.2), [1, 1, 4.6], [0, ch + 1.3, z - 1.9]);
      k.box(dark, 2.2, 3.6, 0.3, 0, 2.7, L / 2 + 0.05);
    }
    if (st.dome) {
      const r = Math.min(W, L) * 0.22;
      k.add(wall, new THREE.CylinderGeometry(r, r, 4, 24), [1, 1, 1], [0, H + 2, 0]);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.box(glass, 0.2, 2.2, 1.1, Math.sin(a) * (r + 0.05), H + 2, Math.cos(a) * (r + 0.05), [0, a, 0]); }
      k.add(mat('#6f9486', { roughness: 0.45, metalness: 0.35 }), new THREE.SphereGeometry(r * 1.04, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), [1, 0.9, 1], [0, H + 4, 0]);
      k.add(trim, new THREE.CylinderGeometry(0.9, 0.9, 2.2, 10), [1, 1, 1], [0, H + 4 + r * 0.94 + 1.1, 0]);
    }
    return k;
  }

  // ---------- Mercado de São José: estrutura de ferro verde, paredes brancas e lanternim no telhado
  function market(o) {
    const W = o.wid, L = o.len, H = 8.5, k = new Kit(), green = mat('#2f6b4f', { roughness: 0.5, metalness: 0.4 }), white = stucco('#f4f1ea'), glass = mat('#6f8a86', { roughness: 0.25, metalness: 0.3 });
    k.box(white, W, H * 0.55, L, 0, H * 0.275, 0);
    k.box(glass, W - 0.2, H * 0.32, L - 0.2, 0, H * 0.71, 0);
    k.box(green, W + 0.3, 0.35, L + 0.3, 0, H * 0.55, 0); k.box(green, W + 0.3, 0.35, L + 0.3, 0, H * 0.87, 0);
    for (let z = -L / 2; z <= L / 2; z += 3) for (const sx of [-1, 1]) k.box(green, 0.25, H * 0.9, 0.25, sx * (W / 2 + 0.05), H * 0.45, z);
    for (let x = -W / 2; x <= W / 2; x += 3) for (const sz of [-1, 1]) k.box(green, 0.25, H * 0.9, 0.25, x, H * 0.45, sz * (L / 2 + 0.05));
    for (const sz of [-1, 1]) for (let x = -W / 2 + 1.5; x < W / 2; x += 3) k.add(dark, halfDisc(1.0), [1, 1.6, 0.3], [x, 0, sz * (L / 2 + 0.06)]); // portas em arco
    const roof = mat('#b4bab8', { roughness: 0.5, metalness: 0.35 });
    const rh = Math.min(W * 0.22, 4.5); // mercado grande não vira hangar
    k.add(roof, prism(W + 1, rh), [1, 1, L + 1], [0, H * 0.9, -L / 2 - 0.5]);
    k.box(glass, Math.min(W * 0.28, 8), 2.0, L * 0.92, 0, H * 0.9 + rh * 0.9 + 0.6, 0);
    k.add(roof, prism(Math.min(W * 0.34, 9.5), 1.2), [1, 1, L * 0.92], [0, H * 0.9 + rh * 0.9 + 1.6, -L * 0.46]);
    return k;
  }

  // ---------- forte: muralhas inclinadas seguindo o contorno, baluartes nos cantos
  function fort(ring, parent, opt = {}) {
    const geo = [], push = (...v) => geo.push(...v);
    let A = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; A += a[0] * b[1] - b[0] * a[1]; }
    const sgn = A > 0 ? 1 : -1, H = opt.H || 7, bat = opt.bat || 1.4, top = opt.top || 5;
    const quad = (p, q, r, s) => push(...p, ...q, ...r, ...p, ...r, ...s);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
      const nx = (sgn * (b[1] - a[1])) / L, nz = (-sgn * (b[0] - a[0])) / L; // para dentro
      const P = (pt, d, y) => [pt[0] + nx * d, y, pt[1] + nz * d];
      quad(P(a, 0, 0), P(a, bat, H), P(b, bat, H), P(b, 0, 0));
      quad(P(a, bat, H), P(a, bat + top, H), P(b, bat + top, H), P(b, bat, H));
      quad(P(a, bat + top, H), P(a, bat + top, 0), P(b, bat + top, 0), P(b, bat + top, H));
      quad(P(a, 0, H), P(a, 0, H + 1.1), P(b, 0, H + 1.1), P(b, 0, H)); // parapeito
      if (opt.stamp) stampHull([[a[0], a[1]], [b[0], b[1]], [P(a, bat + top, 0)[0], P(a, bat + top, 0)[2]], [P(b, bat + top, 0)[0], P(b, bat + top, 0)[2]]]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(geo, 3));
    const uv = []; for (let i = 0; i < geo.length; i += 3) uv.push((geo[i] + geo[i + 2]) / 4, geo[i + 1] / 4);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: opt.color || '#b9aa8c', roughness: 0.95, side: THREE.DoubleSide }));
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    const k = new Kit(), stone = mat('#a99a7c', { roughness: 0.95 });
    if (opt.posts !== false) for (const p of ring) k.box(stone, 3.2, H + 1.6, 3.2, p[0], (H + 1.6) / 2, p[1]); // guaritas/baluartes
    k.build(parent);
  }

  // ---------- montagem por nome
  for (const [name, st] of Object.entries(CHURCHES)) {
    if (st.skipOnly) continue;
    for (const b of named[name] || []) { const o = place(ringOf(b)); church(o, st).build(group, o.cx, o.cz, o.rot); }
  }
  for (const [name, st] of Object.entries(NEOCLASSIC)) {
    const list = named[name] || data.buildings.filter((b) => b.n === name);
    for (const b of list) { const o = place(ringOf(b)); neoclassic(o, st).build(group, o.cx, o.cz, o.rot); }
  }
  for (const name of MARKETS) for (const b of named[name] || data.buildings.filter((q) => q.n === name)) { const o = place(ringOf(b)); market(o).build(group, o.cx, o.cz, Math.atan2(o.ux, o.uz)); }
  for (const name of FORTS) for (const b of named[name] || []) fort(ringOf(b), group);

  // Estádio dos Aflitos (Náutico): gramado, arquibancadas em degraus com listras vermelhas e brancas, cobertura e refletores
  const stadium = (b, c1, c2) => {
    const o = obb(ringOf(b)), L = o.len, W = o.wid, k = new Kit();
    const c = document.createElement('canvas'); c.width = 1024; c.height = 660;
    const g = c.getContext('2d');
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3f8f3a' : '#47a042'; g.fillRect((i * 1024) / 12, 0, 1024 / 12 + 1, 660); }
    g.strokeStyle = '#f4f4f0'; g.lineWidth = 6;
    g.strokeRect(20, 20, 984, 620); g.beginPath(); g.moveTo(512, 20); g.lineTo(512, 640); g.stroke();
    g.beginPath(); g.arc(512, 330, 90, 0, Math.PI * 2); g.stroke();
    for (const x of [20, 1004 - 160]) { g.strokeRect(x, 150, 160, 360); g.strokeRect(x === 20 ? 20 : 1004 - 55, 245, 55, 170); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const pl = Math.min(L - 40, 105), pw = Math.min(W - 36, 68);
    k.add(new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), new THREE.PlaneGeometry(pl + 8, pw + 8).rotateX(-Math.PI / 2), [1, 1, 1], [0, 0.12, 0]);
    const red = mat(c1, { roughness: 0.7 }), white = mat(c2, { roughness: 0.7 }), conc = mat('#b9b4aa', { roughness: 0.9 });
    // quatro lados de arquibancada: 6 degraus subindo para fora
    const sides = [[0, (pw + 8) / 2, pl + 8, 0], [0, -(pw + 8) / 2, pl + 8, Math.PI], [(pl + 8) / 2, 0, pw + 8, Math.PI / 2], [-(pl + 8) / 2, 0, pw + 8, -Math.PI / 2]];
    for (const [sx, sz, len, rot] of sides) {
      const fx = Math.sin(rot), fz = Math.cos(rot);
      for (let st = 0; st < 6; st++) {
        const d = 2 + st * 2.2, y = 1.2 + st * 1.6;
        const m = st % 2 ? red : white;
        k.box(m, len + st * 4.4 * (Math.abs(fx) > 0.5 ? 1 : 1), 1.6, 2.2, sz * 0 + sx + fx * d, y - 0.8, sz + fz * d, [0, rot, 0]);
      }
      k.box(conc, len + 30, 12, 1.2, sx + fx * 15.5, 6, sz + fz * 15.5, [0, rot, 0]);
    }
    // cobertura da arquibancada principal
    k.box(white, pl + 20, 0.6, 16, 0, 14.5, (pw + 8) / 2 + 9);
    for (let x = -pl / 2; x <= pl / 2; x += 15) k.box(conc, 0.6, 14, 0.6, x, 7, (pw + 8) / 2 + 16.5);
    // refletores nos cantos
    const lamp = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff3c4', emissiveIntensity: 0.2 });
    night.push((n) => (lamp.emissiveIntensity = 0.2 + n * 6));
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = cx * (pl / 2 + 18), z = cz * (pw / 2 + 18);
      k.box(conc, 0.8, 32, 0.8, x, 16, z);
      k.box(lamp, 5, 2.4, 0.6, x, 32.5, z, [0, Math.atan2(-x, -z), 0]);
    }
    k.build(group, o.cx, o.cz, Math.atan2(-o.uz, o.ux)); // eixo x local = eixo longo do estádio
  };
  // (Aflitos e Ilha do Retiro agora vêm de estadios.js, refeitos pelas fotos)
  void stadium;

  // Capela de Nossa Senhora da Conceição, dentro do Parque da Jaqueira
  const jq = data.pois.find((p) => p.name === 'Parque da Jaqueira');
  if (jq) {
    const parks = data.parks.filter((q) => inside(q.p, jq.x, jq.z));
    let spot = null, best = -1;
    for (let r = 0; r <= 90; r += 4) for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const x = jq.x + Math.cos(a) * r, z = jq.z + Math.sin(a) * r;
      if (parks.length && !parks.some((q) => inside(q.p, x, z))) continue;
      let ok = true;
      for (let dx = -12; dx <= 12 && ok; dx += 3) for (let dz = -9; dz <= 9 && ok; dz += 3) if (env.isSolid(x + dx, z + dz) || env.isWater(x + dx, z + dz)) ok = false;
      if (ok) { const sc = 100 - r; if (sc > best) { best = sc; spot = [x, z]; } }
    }
    if (spot) {
      church({ wid: 8, len: 15 }, { towers: 1, wall: '#f2d872', trim: '#fbf6ea' }).build(group, spot[0], spot[1], Math.PI);
      const gr = env.grid;
      if (gr) for (let dx = -6; dx <= 6; dx += 1.5) for (let dz = -9; dz <= 9; dz += 1.5) {
        const ix = Math.floor((spot[0] + dx - gr.xmin) / gr.RES), iz = Math.floor((spot[1] + dz - gr.zmin) / gr.RES);
        if (ix >= 0 && iz >= 0 && ix < gr.GW && iz < gr.GH) gr.mask[iz * gr.GW + ix] |= SOLID;
      }
    }
  }

  // Praça de Casa Forte: jardim de Burle Marx com espelho d'água de vitórias-régias e palmeiras imperiais
  const cf = data.pois.filter((p) => p.name === 'Praça de Casa Forte');
  if (cf.length) {
    const pts = cf.map((p) => [p.x, p.z]);
    let a = pts[0], b = pts[0], far = 0;
    for (const p of pts) for (const q of pts) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > far) { far = d; a = p; b = q; } }
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const len = Math.max(far, 60), rot = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const k = new Kit(), stone = mat('#d9d2c2', { roughness: 0.85 }), water = mat('#2f6f7a', { roughness: 0.08, metalness: 0.25, emissive: '#06191d' });
    const lily = mat('#3f8a3a', { roughness: 0.6 }), flower = mat('#f4a6c6', { roughness: 0.5 }), trunk = mat('#b9b2a2', { roughness: 0.8 }), frond = mat('#3c7a35', { roughness: 0.7, side: THREE.DoubleSide });
    // lagos: um retangular no meio e dois redondos nas pontas
    const pools = [[0, 0, 'rect'], [0, len * 0.36, 'round'], [0, -len * 0.36, 'round']];
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [px, pz, kind] of pools) {
      if (kind === 'rect') { k.box(stone, 14, 0.5, 34, px, 0.25, pz); k.box(water, 12.6, 0.1, 32.6, px, 0.48, pz); }
      else { k.add(stone, new THREE.CylinderGeometry(8, 8.3, 0.5, 32), [1, 1, 1], [px, 0.25, pz]); k.add(water, new THREE.CylinderGeometry(7.3, 7.3, 0.1, 32), [1, 1, 1], [px, 0.48, pz]); }
      for (let i = 0; i < (kind === 'rect' ? 22 : 12); i++) {
        const x = px + (kind === 'rect' ? (rnd() - 0.5) * 11 : Math.cos(i * 2.4) * rnd() * 6.2), z = pz + (kind === 'rect' ? (rnd() - 0.5) * 31 : Math.sin(i * 2.4) * rnd() * 6.2);
        const r = 0.6 + rnd() * 0.7;
        k.add(lily, new THREE.CylinderGeometry(r, r, 0.04, 16), [1, 1, 1], [x, 0.56, z]);       // vitória-régia
        k.add(lily, new THREE.TorusGeometry(r, 0.05, 4, 16), [1, 1, 1], [x, 0.58, z], [Math.PI / 2, 0, 0]);
        if (rnd() < 0.3) k.add(flower, new THREE.SphereGeometry(0.18, 8, 6), [1, 0.7, 1], [x + 0.2, 0.66, z]);
      }
    }
    // alamedas de palmeiras imperiais dos dois lados
    for (let z = -len * 0.48; z <= len * 0.48; z += 8) for (const sx of [-8.5, 8.5]) {
      const wx = cx + sx * Math.cos(rot) + z * Math.sin(rot), wz = cz - sx * Math.sin(rot) + z * Math.cos(rot);
      if (env.isRoad?.(wx, wz) || env.isRoad?.(wx + 1.5, wz) || env.isRoad?.(wx - 1.5, wz) || env.isSolid(wx, wz)) continue; // nada de palmeira em cima da rua
      k.add(trunk, new THREE.CylinderGeometry(0.22, 0.32, 18, 8), [1, 1, 1], [sx, 9, z]);
      k.add(trunk, new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8), [1, 1, 1], [sx, 18.6, z]);
      for (let f = 0; f < 8; f++) {
        const ang = (f / 8) * Math.PI * 2;
        k.add(frond, new THREE.ConeGeometry(0.45, 4.2, 4, 1).rotateX(Math.PI / 2).scale(1, 0.18, 1).translate(0, 0, 2.1), [1, 1, 1], [sx, 19.3, z], [0.5, ang, 0], 'YXZ');
      }
    }
    k.build(group, cx, cz, rot);
    const gr = env.grid; // o lago não é chão: entra na colisão
    if (gr) for (const [px, pz, kind] of pools) for (let dx = -8; dx <= 8; dx += 1.2) for (let dz = (kind === 'rect' ? -17 : -8); dz <= (kind === 'rect' ? 17 : 8); dz += 1.2) {
      if (kind !== 'rect' && Math.hypot(dx, dz) > 8) continue;
      if (kind === 'rect' && Math.abs(dx) > 7) continue;
      const lx = px + dx, lz = pz + dz, x = cx + lx * Math.cos(rot) + lz * Math.sin(rot), z = cz - lx * Math.sin(rot) + lz * Math.cos(rot);
      const ix = Math.floor((x - gr.xmin) / gr.RES), iz = Math.floor((z - gr.zmin) / gr.RES);
      if (ix >= 0 && iz >= 0 && ix < gr.GW && iz < gr.GH) gr.mask[iz * gr.GW + ix] |= SOLID;
    }
  }

  // Largo do Poço da Panela: mangueiras enormes, bancos e postes coloniais
  const lp = data.pois.find((p) => p.name === 'Praça Poço da Panela');
  if (lp) {
    const k = new Kit(), bark = mat('#5a4636', { roughness: 0.9 }), leaf = mat('#3d6e2e', { roughness: 0.8 }), wood = mat('#6b4a33'), iron = mat('#1d2024', { metalness: 0.5 });
    const lampM = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffcf7a', emissiveIntensity: 0.1 });
    night.push((n) => (lampM.emissiveIntensity = 0.1 + n * 5));
    const spots = [];
    for (let r = 4; r < 34 && spots.length < 9; r += 5) for (let a = 0; a < Math.PI * 2 && spots.length < 9; a += 0.9) {
      const x = lp.x + Math.cos(a) * r, z = lp.z + Math.sin(a) * r;
      if (!env.isSolid(x, z) && !env.isWater(x, z) && spots.every((s) => Math.hypot(s[0] - x, s[1] - z) > 9)) spots.push([x, z]);
    }
    spots.forEach(([x, z], i) => {
      if (i % 3 === 0) { // mangueira
        k.add(bark, new THREE.CylinderGeometry(0.5, 0.8, 5, 8), [1, 1, 1], [x, 2.5, z]);
        for (const [dx, dy, dz, r] of [[0, 7, 0, 4.6], [2.6, 6, 1, 3.4], [-2.4, 6.2, -1, 3.6], [0.5, 8.6, -0.5, 3.2]]) k.add(leaf, new THREE.IcosahedronGeometry(r, 1), [1, 0.8, 1], [x + dx, dy, z + dz]);
      } else if (i % 3 === 1) { k.box(wood, 2.0, 0.1, 0.5, x, 0.5, z); k.box(wood, 2.0, 0.45, 0.08, x, 0.8, z - 0.24); k.box(iron, 0.08, 0.5, 0.5, x - 0.9, 0.25, z); k.box(iron, 0.08, 0.5, 0.5, x + 0.9, 0.25, z); }
      else { k.add(iron, new THREE.CylinderGeometry(0.08, 0.12, 3.6, 8), [1, 1, 1], [x, 1.8, z]); k.add(lampM, new THREE.SphereGeometry(0.3, 10, 8), [1, 1.2, 1], [x, 3.8, z]); }
    });
    k.build(group);
  }

  // Cais do Sertão (Brasil Arquitetura, no antigo Armazém 10): concreto pigmentado ocre, cor do chão do agreste,
  // e por cima uma "renda" branca de concreto vazado que virou o símbolo do museu; grande vão em balanço sobre a praça
  for (const b of named['Museu Cais do Sertão'] || []) {
    const o = place(ringOf(b));
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
      g.beginPath(); g.ellipse(x + 16, y + 16, 11, 6, ((x + y) / 32) % 2 ? 0 : Math.PI / 2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.len / 7, 2.2); t.colorSpace = THREE.SRGBColorSpace;
    const lace = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    const ochre = mat('#c98a3c', { roughness: 0.85 }), dark = mat('#2f3a40', { roughness: 0.2, metalness: 0.5 });
    const k = new Kit(), W = o.wid, L = o.len;
    k.box(ochre, W * 0.62, 4.2, L * 0.82, 0, 2.1, 0);                 // térreo de concreto ocre, recuado
    k.box(dark, W * 0.6, 3.4, 0.2, 0, 2.0, L * 0.41 + 0.12);           // vidro da entrada
    k.box(ochre, W + 2, 8.6, L + 4, 0, 9.3, 2);                         // volume de cima, ocre
    k.box(lace, W + 2.6, 9.2, L + 4.6, 0, 9.3, 2);                      // renda branca por fora
    k.box(ochre, W + 2.8, 0.5, L + 4.8, 0, 13.95, 2);                   // laje de cobertura
    k.build(group, o.cx, o.cz, o.rot);
  }

  // Casa da Cultura (antiga Casa de Detenção): torre octogonal no centro da cruz
  for (const b of named['Casa da Cultura'] || []) {
    const r = ringOf(b), cx = r.reduce((s, p) => s + p[0], 0) / r.length, cz = r.reduce((s, p) => s + p[1], 0) / r.length;
    const k = new Kit(), wall = stucco('#efd9a0'), trim = mat('#f8f3e6');
    k.add(wall, new THREE.CylinderGeometry(5, 5, 17, 8), [1, 1, 1], [0, 8.5, 0]);
    k.add(trim, new THREE.CylinderGeometry(5.4, 5.4, 0.6, 8), [1, 1, 1], [0, 12.3, 0]);
    k.add(mat('#8a9a94', { metalness: 0.4, roughness: 0.4 }), new THREE.SphereGeometry(5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), [1, 0.7, 1], [0, 17, 0]);
    k.add(trim, new THREE.CylinderGeometry(0.8, 0.8, 2.4, 8), [1, 1, 1], [0, 21.5, 0]);
    k.build(group, cx, cz);
  }

  // Cinema São Luiz: letreiro vertical em neon vermelho na fachada
  for (const b of named['Cinema São Luiz'] || []) {
    const o = place(ringOf(b));
    const c = document.createElement('canvas'); c.width = 64; c.height = 512;
    const g = c.getContext('2d'); g.fillStyle = '#120808'; g.fillRect(0, 0, 64, 512);
    g.fillStyle = '#ff3b3b'; g.font = 'bold 52px Arial'; g.textAlign = 'center';
    [...'SÃOLUIZ'].forEach((ch, i) => g.fillText(ch, 32, 62 + i * 66));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.4, roughness: 0.4 });
    night.push((n) => (sign.emissiveIntensity = 0.4 + n * 3.5));
    const k = new Kit();
    k.box(mat('#1a1414'), 0.5, 8, 1.6, 0, 9, 0);
    k.add(sign, new THREE.PlaneGeometry(1.4, 7.6), [1, 1, 1], [0.26, 9, 0], [0, Math.PI / 2, 0]);
    k.add(sign, new THREE.PlaneGeometry(1.4, 7.6), [1, 1, 1], [-0.26, 9, 0], [0, -Math.PI / 2, 0]);
    // na fachada (lado da rua), perto de uma das quinas
    const fx = Math.sin(o.rot), fz = Math.cos(o.rot), side = o.wid * 0.3;
    k.build(group, o.cx + fx * (o.len / 2 + 0.6) + fz * side, o.cz + fz * (o.len / 2 + 0.6) - fx * side, o.rot + Math.PI / 2);
  }

  buildBridges(group, data, mat, night, env);
  const centroAnim = buildCentro(group, data, env, { mat, named, place, ringOf });
  buildSquares(group, data, env, mat, dark);
  buildBrennand(group, data, mat);
  buildBeach(group, data, env, mat, stucco, clay, church, Kit);

  const anim = buildBairros(group, data, env, { Kit, mat, named, ringOf, place, fort, night, roadDist });
  anim.push(...centroAnim);
  anim.push(...buildLugares(group, data, env, { mat, named, place, night }));
  // os pontos de rua (a cada 4 m da cidade inteira) só servem pra montar: as funções daqui de dentro seguravam o
  // mapa enquanto a animação vivesse. Se alguém chamar roadDist depois, recebe "rua longe".
  roadPts.clear();
  return { setNight(n) { for (const f of night) f(n); }, update(t, cam) { for (const f of anim) f(t, cam); } };
}

// ---------------------------------------------------------------- pontes do centro
// Laje com cornija e pilares com talha-mar dentro do rio; em cima, o guarda-corpo de cada ponte:
// balaústres brancos com pilastras e lampiões de ferro (Maurício de Nassau, Duarte Coelho, Princesa Isabel),
// gradil de ferro e treliça (Boa Vista), vigas de aço (Doze de Setembro, a Giratória) e mureta de concreto com tubo nas outras.
const ROAD_HALF = { primary: 6, secondary: 5, trunk: 6.5, tertiary: 4.25, footway: 1.3, cycleway: 1.2, path: 1 };
function buildBridges(group, data, mat, night = [], env = null) {
  const k = new Kit(), truss = new Kit(), statues = [], balusters = [], bars = [], lamps = [];
  k.keepOnRoad = truss.keepOnRoad = true; // a ponte É a pista
  // o tabuleiro sobe sobre o rio (world.js/buildDecks, heightAt): cada peça vai junto com a altura da ponte ali
  for (const kit of [k, truss]) { const add = kit.add.bind(kit); kit.add = (m, g, sc, p, r, o) => add(m, g, sc, p && [p[0], p[1] + heightAt(p[0], p[2]), p[2]], r, o); }
  const stone = mat('#e9e3d6', { roughness: 0.75 }), concrete = mat('#bdb7ab', { roughness: 0.9 }), cornice = mat('#d8d1c2', { roughness: 0.8 });
  const iron = mat('#2f4a44', { roughness: 0.45, metalness: 0.55 }), steel = mat('#4f6f8f', { roughness: 0.45, metalness: 0.5 }), pier = mat('#8f877a', { roughness: 0.95 });
  const glass = new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffd890', emissiveIntensity: 0.05, roughness: 0.3 });
  night.push((n) => (glass.emissiveIntensity = 0.05 + n * 4));
  const ways = data.roads.filter((r) => r.n && /^Ponte /.test(r.n) && r.p.length >= 2);
  const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  // tem outra pista da mesma ponte desse lado? (pistas duplas e calçadas separadas não ganham guarda-corpo no meio)
  const covered = (r, x, z) => ways.some((o) => o !== r && o.n === r.n && o.p.some((q, i) => i < o.p.length - 1 && segDist(x, z, q, o.p[i + 1]) < (ROAD_HALF[o.k] || 4) + 0.6));
  for (const r of ways) {
    const half = (ROAD_HALF[r.k] || 4), name = r.n;
    const style = /Boa Vista/.test(name) ? 'ferro' : /Doze de Setembro/.test(name) ? 'aco' : /Nassau|Duarte Coelho|Princesa Isabel|Velha/.test(name) ? 'balaustre' : 'mureta';
    let run = 0;
    // o traçado da ponte no OSM continua por terra até o cruzamento: guarda-corpo, pilar e lampião só onde há água
    // embaixo (ou logo do lado), senão a grade atravessa a avenida da margem
    const P = [];
    for (let i = 0; i < r.p.length - 1; i++) { const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4)); for (let j = 0; j < n; j++) P.push([ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n]); }
    P.push(r.p.at(-1));
    const wetAt = (x, z, nx, nz) => !env || [0, half + 2.5, -(half + 2.5)].some((o) => env.isWater(x + nx * o, z + nz * o));
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, yaw = Math.atan2(ux, uz);
      if (!wetAt((ax + bx) / 2, (az + bz) / 2, nx, nz)) { run += L; continue; }
      for (const s of [-1, 1]) {
        const e = half - 0.2, mx = (ax + bx) / 2 + nx * e * s, mz = (az + bz) / 2 + nz * e * s;
        if (covered(r, (ax + bx) / 2 + nx * (half + 1.2) * s, (az + bz) / 2 + nz * (half + 1.2) * s)) continue;
        // cornija na borda da laje
        k.box(cornice, 0.45, 0.32, L, (ax + bx) / 2 + nx * (half + 0.12) * s, -0.06, (az + bz) / 2 + nz * (half + 0.12) * s, [0, yaw, 0]);
        k.box(concrete, 0.3, 0.5, L, (ax + bx) / 2 + nx * (half + 0.05) * s, -0.45, (az + bz) / 2 + nz * (half + 0.05) * s, [0, yaw, 0]);
        const at = (d, o = 0) => [ax + ux * d + nx * (e + o) * s, az + uz * d + nz * (e + o) * s];
        if (style === 'balaustre') {
          k.box(stone, 0.42, 0.26, L, mx, 0.19, mz, [0, yaw, 0]);           // rodapé
          k.box(stone, 0.34, 0.14, L, mx, 1.0, mz, [0, yaw, 0]);            // corrimão
          for (let d = 0.2; d < L; d += 0.38) balusters.push([...at(d), yaw]);
          for (let d = (7 - run % 7) % 7; d < L; d += 7) { const [x, z] = at(d); k.box(stone, 0.55, 1.12, 0.55, x, 0.62, z, [0, yaw, 0]).box(stone, 0.66, 0.1, 0.66, x, 1.22, z, [0, yaw, 0]); }
        } else if (style === 'ferro') {
          k.box(stone, 0.4, 0.24, L, mx, 0.18, mz, [0, yaw, 0]);
          k.box(iron, 0.12, 0.08, L, mx, 1.02, mz, [0, yaw, 0]).box(iron, 0.1, 0.06, L, mx, 0.62, mz, [0, yaw, 0]);
          for (let d = 0.1; d < L; d += 0.2) bars.push([...at(d), yaw]);
          // treliça de ferro da Boa Vista
          const th = 4.2, sp = 4, tx = (ax + bx) / 2 + nx * (half + 0.3) * s, tz = (az + bz) / 2 + nz * (half + 0.3) * s;
          truss.box(iron, 0.3, 0.3, L, tx, th, tz, [0, yaw, 0]);
          for (let d = 0; d <= L; d += sp) {
            const x = ax + ux * d + nx * (half + 0.3) * s, z = az + uz * d + nz * (half + 0.3) * s;
            truss.box(iron, 0.25, th, 0.25, x, th / 2, z);
            if (d + sp <= L) for (const t of [-1, 1]) truss.add(iron, B, [0.14, 0.14, Math.hypot(sp, th)], [x + ux * sp / 2, th / 2, z + uz * sp / 2], [t * Math.atan2(th, sp), yaw, 0], 'YXZ');
          }
        } else if (style === 'aco') {
          // viga de aço alta, com nervuras
          k.box(steel, 0.25, 1.35, L, mx, 0.68, mz, [0, yaw, 0]).box(steel, 0.5, 0.12, L, mx, 1.38, mz, [0, yaw, 0]);
          for (let d = 0.6; d < L; d += 2) { const [x, z] = at(d, -0.18 * s); k.box(steel, 0.12, 1.3, 0.12, x, 0.68, z, [0, yaw, 0]); }
        } else {
          k.box(concrete, 0.3, 0.65, L, mx, 0.36, mz, [0, yaw, 0]);
          k.box(mat('#9aa3a8', { metalness: 0.7, roughness: 0.3 }), 0.08, 0.08, L, mx, 1.0, mz, [0, yaw, 0]);
          for (let d = 1; d < L; d += 2.5) { const [x, z] = at(d); k.box(mat('#9aa3a8', { metalness: 0.7, roughness: 0.3 }), 0.06, 0.4, 0.06, x, 0.85, z); }
        }
        // (pilares com talha-mar e arcos: world.js/bridgeSupports, embaixo do tabuleiro)
        // lampiões
        const passo = /Maurício de Nassau/.test(name) ? 14 : 28; // a Nassau tem poste ornamentado bem mais perto um do outro
        if (style !== 'aco') for (let d = (passo - run % passo) % passo + 3; d < L; d += passo) lamps.push([...at(d), yaw, style]);
      }
      run += L;
    }
    if (/Maurício de Nassau/.test(name) && P.length >= 2) {
      // estátuas nas cabeceiras: na ponta molhada do traçado (não no meio da avenida da margem)
      const wet = P.filter((q, i) => i < P.length - 1 && wetAt(q[0], q[1], 0, 0));
      const ends = wet.length >= 2 ? [wet[0], wet.at(-1)] : [];
      for (const end of ends) {
        const nb = end === wet[0] ? wet[1] : wet.at(-2), L = Math.hypot(nb[0] - end[0], nb[1] - end[1]) || 1;
        const ux = (nb[0] - end[0]) / L, uz = (nb[1] - end[1]) / L;
        for (const s of [-1, 1]) statues.push([end[0] + ux * 3 - uz * (half + 1.6) * s, end[1] + uz * 3 + ux * (half + 1.6) * s, Math.atan2(-ux, -uz)]);
      }
    }
  }
  // lampião de ferro fundido: base, coluna, braço duplo e duas lanternas
  for (const [x, z, yaw, st] of lamps) {
    const c = st === 'ferro' ? iron : mat('#1f2a26', { roughness: 0.4, metalness: 0.6 });
    k.box(c, 0.36, 0.5, 0.36, x, 1.45, z, [0, yaw, 0]);
    k.add(c, new THREE.CylinderGeometry(0.07, 0.11, 3.6, 8), [1, 1, 1], [x, 3.4, z]);
    k.box(c, 1.3, 0.07, 0.07, x, 5.0, z, [0, yaw + Math.PI / 2, 0]);
    for (const a of [-0.6, 0.6]) {
      const lx = x + Math.cos(yaw) * a, lz = z - Math.sin(yaw) * a;
      k.add(glass, new THREE.SphereGeometry(0.22, 10, 8), [1, 1.3, 1], [lx, 5.25, lz]);
      k.add(c, new THREE.ConeGeometry(0.24, 0.22, 8), [1, 1, 1], [lx, 5.62, lz]);
    }
  }
  k.build(group, 0, 0, 0, true, false); // sobre a água: a água já bloqueia
  truss.build(group, 0, 0, 0, true, false);
  const put = (list, geo, m) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, m, list.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    list.forEach(([x, z, yaw], i) => im.setMatrixAt(i, M.compose(p.set(x, heightAt(x, z), z), q.setFromEuler(e.set(0, yaw, 0)), one)));
    im.castShadow = true; im.receiveShadow = true; group.add(im);
  };
  // balaústre torneado
  const prof = [[0.075, 0.3], [0.075, 0.36], [0.045, 0.4], [0.038, 0.5], [0.08, 0.66], [0.045, 0.82], [0.035, 0.88], [0.065, 0.9], [0.065, 0.94], [0, 0.94]].map(([r, y]) => new THREE.Vector2(r, y));
  put(balusters, new THREE.LatheGeometry([new THREE.Vector2(0, 0.3), ...prof], 6), stone);
  put(bars, new THREE.BoxGeometry(0.035, 0.72, 0.035).translate(0, 0.66, 0), iron);
  // guarda-corpo bloqueia a borda da laje (pessoas e carros não atravessam)
  for (const [x, z] of [...balusters.filter((_, i) => i % 3 === 0), ...bars.filter((_, i) => i % 5 === 0)]) stampDisc(x, z, 0.2);
  // quatro estátuas de bronze nas cabeceiras da Ponte Maurício de Nassau
  const bronze = new THREE.MeshStandardMaterial({ color: '#6b4f2e', metalness: 0.8, roughness: 0.35 });
  for (const [x, z, yaw] of statues.slice(0, 4)) {
    const hy = heightAt(x, z), ped = new THREE.Mesh(B, stone); ped.scale.set(1.6, 2.6, 1.6); ped.position.set(x, 1.3 + hy, z); ped.castShadow = true; group.add(ped); stampMesh(ped);
    const p = makePerson({ player: true, hair: 'short' });
    p.traverse((o) => { if (o.isMesh) o.material = bronze; });
    p.scale.setScalar(1.35); p.position.set(x, 2.6 + hy, z); p.rotation.y = yaw;
    p.userData.armR.rotation.x = -2.4; p.userData.armR.rotation.z = 0.3;
    group.add(p);
  }
}

// ---------------------------------------------------------------- detalhes do centro histórico
// Paço do Frevo com sombrinhas gigantes, Palácio do Campo das Princesas com jardim de palmeiras e bandeiras,
// Prefeitura com bandeiras, feirinha de artesanato na Praça do Arsenal.
function frevoUmbrella(k, mat, x, y, z, r, tilt = 0, yaw = 0) {
  const C = ['#ffd23f', '#d7263d', '#2a9d58', '#1d5fa8'].map((c) => mat(c, { roughness: 0.5, side: THREE.DoubleSide }));
  for (let i = 0; i < 4; i++) k.add(C[i], new THREE.ConeGeometry(r, r * 0.45, 12, 1, true, (i * Math.PI) / 2, Math.PI / 2), [1, 1, 1], [x, y, z], [tilt, yaw, 0]);
  k.add(mat('#222'), new THREE.CylinderGeometry(r * 0.03, r * 0.03, r * 1.4, 5), [1, 1, 1], [x, y - r * 0.55, z], [tilt, yaw, 0]);
}
export function flagTexture(kind) {
  const c = document.createElement('canvas'); c.width = 140; c.height = 98; const g = c.getContext('2d');
  if (kind === 'br') {
    g.fillStyle = '#009c3b'; g.fillRect(0, 0, 140, 98);
    g.fillStyle = '#ffdf00'; g.beginPath(); g.moveTo(70, 8); g.lineTo(132, 49); g.lineTo(70, 90); g.lineTo(8, 49); g.closePath(); g.fill();
    g.fillStyle = '#002776'; g.beginPath(); g.arc(70, 49, 22, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(70, 72, 34, -2.4, -0.75); g.stroke();
  } else {
    // Pernambuco: azul em cima com arco-íris, estrela e sol; branco embaixo com a cruz vermelha
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 140, 98);
    g.fillStyle = '#0b3d91'; g.fillRect(0, 0, 140, 59);
    g.lineWidth = 4; ['#d7263d', '#ffd23f', '#2a9d58'].forEach((col, i) => { g.strokeStyle = col; g.beginPath(); g.arc(70, 46, 26 - i * 4, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); });
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(70, 46, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(70 + Math.cos(a) * r, 18 + Math.sin(a) * r); } g.fill();
    g.fillStyle = '#d7263d'; g.fillRect(66, 64, 8, 30); g.fillRect(56, 72, 28, 7);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildCentro(group, data, env, { mat, named, place, ringOf }) {
  const anim = [];
  const list = (n) => named[n] || data.buildings.filter((b) => b.n === n);
  const front = (b, d) => { const o = place(ringOf(b)), fx = Math.sin(o.rot), fz = Math.cos(o.rot); return { o, fx, fz, x: o.cx + fx * (o.len / 2 + d), z: o.cz + fz * (o.len / 2 + d) }; };
  const pole = mat('#d9d9d9', { metalness: 0.7, roughness: 0.3 });
  const flags = (k, x, z, fx, fz, kinds) => kinds.forEach((kind, i) => {
    const off = (i - (kinds.length - 1) / 2) * 3.2, px = x + fz * off, pz = z - fx * off;
    k.add(pole, new THREE.CylinderGeometry(0.07, 0.09, 9, 8), [1, 1, 1], [px, 4.5, pz]);
    const fm = new THREE.MeshStandardMaterial({ map: flagTexture(kind), roughness: 0.8, side: THREE.DoubleSide });
    k.add(fm, new THREE.PlaneGeometry(2.4, 1.68), [1, 1, 1], [px + fz * 1.25, 8.0, pz - fx * 1.25], [0, Math.atan2(fx, fz), 0]);
  });
  const palm = (k, x, z, h = 12) => {
    const trunk = mat('#bdb6a6', { roughness: 0.9 }), leaf = mat('#3f7d3a', { roughness: 0.7, side: THREE.DoubleSide });
    k.add(trunk, new THREE.CylinderGeometry(0.22, 0.32, h, 8), [1, 1, 1], [x, h / 2, z]);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.add(leaf, new THREE.PlaneGeometry(0.7, 3.6), [1, 1, 1], [x + Math.sin(a) * 1.5, h - 0.3, z + Math.cos(a) * 1.5], [1.1, a, 0], 'YXZ'); }
  };
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z);

  // Paço do Frevo: sombrinhas gigantes na fachada e uma bem grande no telhado
  for (const b of list('Paço do Frevo').slice(0, 1)) {
    const { o, fx, fz, x, z } = front(b, 0.9), k = new Kit(), px = fz, pz = -fx, W = Math.min(o.wid, 26);
    for (let i = -2; i <= 2; i++) frevoUmbrella(k, mat, x + px * i * W * 0.18, 8.5 + (i % 2 ? 0.8 : 0), z + pz * i * W * 0.18, 1.1, -0.6, Math.atan2(fx, fz));
    frevoUmbrella(k, mat, o.cx, 16 + 4.5, o.cz, 4.2);
    k.build(group, 0, 0, 0, true, false);
  }
  // Palácio do Campo das Princesas (sede do governo): jardim com palmeiras imperiais e bandeiras
  for (const b of list('Palácio do Campo das Princesas').slice(0, 1)) {
    const { fx, fz, x, z } = front(b, 6), k = new Kit();
    flags(k, x, z, fx, fz, ['br', 'pe']);
    for (const s of [-1, 1]) for (const d of [2, 9, 16]) { const px = x + fz * s * 9 + fx * d, pz = z - fx * s * 9 + fz * d; if (free(px, pz)) palm(k, px, pz, 13); }
    k.build(group, 0, 0, 0, true, true);
  }
  // Prefeitura do Recife (Cais do Apolo): bandeiras na frente
  const pref = list('Prefeitura da Cidade do Recife').sort((a, b) => (b.h || 0) - (a.h || 0))[0];
  if (pref) { const { fx, fz, x, z } = front(pref, 5), k = new Kit(); flags(k, x, z, fx, fz, ['br', 'pe', 'pe']); k.build(group, 0, 0, 0, true, true); }

  if (data.dokas) anim.push(buildDokas(group, data, mat));

  // feirinha de artesanato na Praça do Arsenal (em volta da Torre Malakoff)
  const tm = list('Torre Malakoff')[0];
  if (tm) {
    const cx = tm.cx ?? tm.p[0][0], cz = tm.cz ?? tm.p[0][1], k = new Kit();
    const tops = ['#d7263d', '#ffd23f', '#2a9d58', '#1d5fa8', '#ff7b1c', '#8338ec'].map((c) => mat(c, { roughness: 0.7 }));
    const wood = mat('#8a6a48', { roughness: 0.9 }), goods = ['#c8102e', '#f2b705', '#2a9d8f', '#e05297', '#7b5a3a', '#f4f1ea'].map((c) => mat(c));
    let n = 0;
    for (let r = 18; r <= 46 && n < 10; r += 7) for (let a = 0; a < Math.PI * 2 && n < 10; a += 0.55) {
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (![[0, 0], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]].every(([dx, dz]) => free(x + dx, z + dz))) continue;
      if (env.isRoad?.(x, z)) continue;
      if (data.arsenal && insideRing(data.arsenal, x, z)) continue; // não invade a praça
      const yaw = Math.atan2(cx - x, cz - z);
      k.box(wood, 2.4, 0.9, 1.2, x, 0.45, z, [0, yaw, 0]);
      for (let i = 0; i < 4; i++) k.box(goods[(n + i) % goods.length], 0.4, 0.25, 0.4, x + Math.cos(yaw) * (i - 1.5) * 0.55, 1.05, z - Math.sin(yaw) * (i - 1.5) * 0.55);
      for (const [a2, b2] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) k.box(wood, 0.07, 2.3, 0.07, x + Math.cos(yaw) * a2 + Math.sin(yaw) * b2, 1.15, z - Math.sin(yaw) * a2 + Math.cos(yaw) * b2);
      k.add(tops[n % tops.length], new THREE.ConeGeometry(1.9, 0.7, 4), [1, 1, 0.75], [x, 2.6, z], [0, yaw + Math.PI / 4, 0]);
      n++;
    }
    k.build(group);
    if (n) data.pois.push({ name: 'Feirinha da Praça do Arsenal', kind: 'attraction', x: cx, z: cz + 20 });
  }
  return anim;
}

// ---------------------------------------------------------------- Dokas
// Casa de show de rock da Rua do Brum (punk, hardcore e metal): sobrado de térreo e primeiro andar. Lá em cima,
// pelas janelas abertas, rola o show (banda no palco, luzes piscando e a galera pulando); embaixo, fila na porta.
function buildDokas(group, data, mat) {
  const { b, fnx, fnz } = data.dokas, ring = ringOf(b), o = obb(ring);
  const along = Math.abs(o.ux * fnx + o.uz * fnz) > 0.7;
  const D = THREE.MathUtils.clamp(along ? o.len : o.wid, 9, 24), W = THREE.MathUtils.clamp(along ? o.wid : o.len, 7, 16);
  const rot = Math.atan2(fnx, fnz), H0 = 3.4, H1 = 7.0, k = new Kit();
  const wall = mat('#bfae92', { roughness: 0.95 }), trim = mat('#e9e2d4', { roughness: 0.8 }), black = mat('#121212', { roughness: 0.8 }), inner = mat('#2a1a36', { roughness: 0.95, emissive: '#3a1550', emissiveIntensity: 0.5 });
  // térreo fechado, com duas portas
  k.box(wall, W, H0, D, 0, H0 / 2, 0);
  k.box(black, 1.5, 2.6, 0.1, -W * 0.22, 1.3, D / 2 + 0.03).box(mat('#5a2a1a'), 1.5, 2.6, 0.1, W * 0.22, 1.3, D / 2 + 0.03);
  k.box(trim, W + 0.3, 0.3, D + 0.3, 0, H0, 0);
  // lambe-lambes de show colados no térreo
  const POST = ['#f2f2f0', '#ffd23f', '#e63946', '#111111', '#7cff6b', '#ff4fa3'].map((c) => mat(c, { roughness: 0.9 }));
  for (let i = 0; i < 9; i++) k.box(POST[(i * 5) % POST.length], 0.55, 0.75, 0.03, -W * 0.05 + (i - 4) * 0.62 + (i % 2) * 0.1, 1.5 + (i % 3) * 0.35, D / 2 + 0.02);
  // primeiro andar: paredes do fundo e dos lados, frente com três janelões abertos
  k.box(wall, W, H1 - H0, 0.3, 0, (H0 + H1) / 2, -D / 2 + 0.15);
  for (const sx of [-1, 1]) k.box(wall, 0.3, H1 - H0, D, sx * (W / 2 - 0.15), (H0 + H1) / 2, 0);
  k.box(inner, W - 0.62, H1 - H0, 0.05, 0, (H0 + H1) / 2, -D / 2 + 0.33);
  for (const sx of [-1, 1]) k.box(inner, 0.05, H1 - H0, D - 0.6, sx * (W / 2 - 0.33), (H0 + H1) / 2, 0);
  k.box(mat('#2a1d14', { roughness: 0.9 }), W - 0.6, 0.06, D - 0.6, 0, H0 + 0.18, 0); // piso de tábua
  const win = 1.7, gap = (W - 3 * win) / 4;
  k.box(wall, W, 0.6, 0.3, 0, H0 + 0.3, D / 2 - 0.15);       // peitoril
  k.box(wall, W, H1 - 6.3, 0.3, 0, (6.3 + H1) / 2, D / 2 - 0.15); // verga
  for (let i = 0; i < 4; i++) { const x = -W / 2 + gap / 2 + i * (gap + win); k.box(wall, gap, 6.3 - H0 - 0.6, 0.3, x, (H0 + 0.6 + 6.3) / 2, D / 2 - 0.15); }
  for (let i = 0; i < 3; i++) { const x = -W / 2 + gap + win / 2 + i * (gap + win); k.box(mat('#20262a', { metalness: 0.6 }), win + 0.3, 0.06, 0.06, x, H0 + 1.5, D / 2 + 0.35); for (let j = -3; j <= 3; j++) k.box(mat('#20262a', { metalness: 0.6 }), 0.03, 0.9, 0.03, x + j * 0.27, H0 + 1.05, D / 2 + 0.35); k.box(trim, win + 0.4, 0.1, 0.6, x, H0 + 0.6, D / 2 + 0.15); }
  k.box(wall, W, 0.2, D, 0, H1, 0).box(trim, W + 0.3, 0.7, 0.3, 0, H1 + 0.35, D / 2 - 0.1); // laje e platibanda
  // palco no fundo, caixas de som e bateria
  const stZ = -D / 2 + 1.9;
  k.box(mat('#2b2b2b'), W - 1.2, 0.45, 2.6, 0, H0 + 0.4, stZ);
  for (const sx of [-1, 1]) k.box(black, 0.9, 1.6, 0.7, sx * (W / 2 - 1.2), H0 + 1.4, stZ - 0.2);
  const shell = mat('#7a1018', { metalness: 0.4, roughness: 0.4 }), chrome = mat('#cfd3d6', { metalness: 1, roughness: 0.25 });
  k.add(shell, new THREE.CylinderGeometry(0.32, 0.32, 0.45, 14), [1, 1, 1], [0, H0 + 0.95, stZ - 0.6], [Math.PI / 2, 0, 0]);
  for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3]]) k.add(shell, new THREE.CylinderGeometry(0.17, 0.17, 0.2, 12), [1, 1, 1], [x, H0 + 1.25, stZ + z]);
  for (const x of [-0.75, 0.75]) { k.add(chrome, new THREE.CylinderGeometry(0.02, 0.02, 1.2, 5), [1, 1, 1], [x, H0 + 1.2, stZ - 0.9]); k.add(mat('#c9a227', { metalness: 0.9, roughness: 0.3 }), new THREE.CylinderGeometry(0.3, 0.3, 0.02, 14), [1, 1, 1], [x, H0 + 1.8, stZ - 0.9]); }
  k.add(chrome, new THREE.CylinderGeometry(0.015, 0.015, 1.5, 5), [1, 1, 1], [0, H0 + 1.4, stZ + 1.1]); // pedestal do microfone
  const g = k.build(group, o.cx, o.cz, rot);
  // luzes: painéis no teto e fachos coloridos que piscam no tempo
  const lights = ['#ff2a6d', '#05d9e8', '#f9f871', '#7cff6b'].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1 }));
  const beams = lights.map((m) => new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  for (let i = 0; i < 4; i++) {
    const x = -W / 2 + 1.2 + i * ((W - 2.4) / 3);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.3), lights[i]); lamp.position.set(x, H1 - 0.3, stZ + 2.2); g.add(lamp);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, H1 - H0 - 0.6, 12, 1, true), beams[i]); beam.position.set(x * 0.6, (H0 + H1) / 2, stZ + 1.2); beam.rotation.x = -0.35; g.add(beam);
  }
  const people = [], fl = H0 + 0.21;
  const punk = (o = {}) => {
    const p = makePerson({ shirt: o.shirt || ['#151515', '#151515', '#2b2b2b', '#7a1018', '#f2f2f0'][Math.floor(Math.random() * 5)], pants: ['#1a1a1a', '#2b3e5c', '#3b5b84'][Math.floor(Math.random() * 3)], longSleeve: false, shoes: '#111111', hair: o.hair || ['buzz', 'short', 'long', 'curly'][Math.floor(Math.random() * 4)], ...o });
    if (o.mohawk || Math.random() < 0.3) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.26), mat(['#e63946', '#7cff6b', '#ff4fa3', '#1d1d1d'][Math.floor(Math.random() * 4)])); m.position.set(0, 0.17, -0.02); p.userData.head?.add(m); }
    return p;
  };
  const guitar = (p, c) => { const gb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.06), mat(c, { roughness: 0.3, metalness: 0.2 })); gb.position.set(0.05, 0.98, 0.18); gb.rotation.z = 0.5; p.userData.upper.add(gb); const nk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.03), mat('#3a2a1a')); nk.position.set(-0.22, 1.25, 0.18); nk.rotation.z = 1.05; p.userData.upper.add(nk); };
  // banda: guitarra, vocal, baixo e bateria
  const band = [[-W * 0.28, 'guitar', '#e8e8e8'], [0, 'vocal'], [W * 0.28, 'guitar', '#1d5fa8'], [0, 'drums']].map(([x, role, c]) => {
    const p = punk({ mohawk: role === 'vocal' });
    if (role === 'guitar') guitar(p, c);
    if (role === 'drums') { const u = p.userData; u.seated = true; u.legL.rotation.x = u.legR.rotation.x = -1.4; u.kneeL.rotation.x = u.kneeR.rotation.x = 1.4; p.position.set(0, fl + 0.45 - 0.4, stZ - 1.1); }
    else p.position.set(x, fl + 0.45, stZ + (role === 'vocal' ? 0.9 : 0.5));
    g.add(p); return { p, role };
  });
  // galera pulando na frente do palco (pogo)
  const crowd = [];
  for (let i = 0; i < 14; i++) {
    const p = punk(); const x = (Math.random() - 0.5) * (W - 1.8), z = stZ + 2.2 + Math.random() * (D - 5.5);
    p.position.set(x, fl, z); p.rotation.y = Math.PI + (Math.random() - 0.5) * 0.6; g.add(p); crowd.push({ p, ph: Math.random() * 6, x, z });
  }
  // fila na calçada, ao longo da fachada, e o segurança na porta
  const queue = [];
  const fx = Math.sin(rot), fz = Math.cos(rot), px = Math.cos(rot), pz = -Math.sin(rot);
  const door = [o.cx + fx * (D / 2 + 0.8) + px * -W * 0.22, o.cz + fz * (D / 2 + 0.8) + pz * -W * 0.22];
  const sec = makePerson({ shirt: '#0d0d0d', pants: '#0d0d0d', longSleeve: true, hair: 'buzz' }); sec.scale.setScalar(1.12);
  sec.position.set(door[0] + fx * 0.3, 0, door[1] + fz * 0.3); sec.rotation.y = rot; sec.userData.armL.rotation.set(-0.5, 0, 0.5); sec.userData.armR.rotation.set(-0.5, 0, -0.5); group.add(sec); stampDisc(sec.position.x, sec.position.z, 0.35);
  for (let i = 0; i < 12; i++) {
    const p = punk(), d = 1.4 + i * 0.75;
    const x = door[0] + px * d + fx * (0.3 + (i % 2) * 0.25), z = door[1] + pz * d + fz * (0.3 + (i % 2) * 0.25);
    p.position.set(x, 0, z); p.rotation.y = Math.atan2(-px, -pz) + (Math.random() - 0.5) * 0.8; group.add(p); stampDisc(x, z, 0.3); queue.push({ p, ph: Math.random() * 6 });
  }
  data.pois.push({ name: 'Dokas', kind: 'attraction', x: door[0], z: door[1] });
  data.dokas.door = door;
  const all = [g, sec, ...queue.map((q) => q.p)];
  return (t, cam) => {
    const vis = !cam || Math.hypot(o.cx - cam.x, o.cz - cam.z) < 160;
    for (const m of all) m.visible = vis;
    if (!vis) return;
    const beat = t * 3, f = beat % 1, hit = Math.pow(1 - f, 3), n = Math.floor(beat); // 180 BPM
    lights.forEach((m, i) => (m.emissiveIntensity = (n + i) % 4 < 2 ? 0.4 + hit * 4 : 0.2));
    beams.forEach((m, i) => (m.opacity = (n + i) % 4 < 2 ? 0.08 + hit * 0.25 : 0.03));
    for (const { p, ph } of crowd) {
      const u = p.userData, j = Math.max(0, Math.sin(t * Math.PI * 3 + ph));
      p.position.y = fl + j * 0.35;
      u.armL.rotation.x = u.armR.rotation.x = -2.3 - j * 0.6; u.elbowL.rotation.x = u.elbowR.rotation.x = -0.3;
      u.legL.rotation.x = u.legR.rotation.x = -j * 0.4; u.kneeL.rotation.x = u.kneeR.rotation.x = j * 0.8;
      u.upper.rotation.x = Math.sin(t * Math.PI * 3 + ph) * 0.2;
    }
    for (const { p, role } of band) {
      const u = p.userData, s = Math.sin(t * Math.PI * 6);
      if (role === 'drums') { u.armL.rotation.x = -1.0 + s * 0.5; u.armR.rotation.x = -1.0 - s * 0.5; u.elbowL.rotation.x = u.elbowR.rotation.x = -1.0; }
      else if (role === 'vocal') { u.armR.rotation.x = -1.6; u.elbowR.rotation.x = -1.4; u.armL.rotation.set(-0.4 - Math.max(0, s) * 1.6, 0, -0.3); u.upper.rotation.x = 0.15 + hit * 0.25; }
      else { u.armL.rotation.x = -1.0; u.elbowL.rotation.x = -0.8; u.armR.rotation.x = -0.7 + s * 0.25; u.elbowR.rotation.x = -1.2; u.upper.rotation.x = 0.2 + hit * 0.45; u.legL.rotation.z = -0.2; u.legR.rotation.z = 0.2; } // bate-cabeça
      if (u.head) u.head.rotation.x = role === 'drums' ? 0 : hit * 0.4;
    }
    for (const { p, ph } of queue) { const u = p.userData; u.upper.rotation.y = Math.sin(t * 0.7 + ph) * 0.15; u.armR.rotation.x = Math.sin(t * 0.4 + ph) > 0.6 ? -1.2 : 0; u.elbowR.rotation.x = Math.sin(t * 0.4 + ph) > 0.6 ? -1.3 : -0.2; }
  };
}

// ---------------------------------------------------------------- praças: Arsenal (chafariz), Rua do Bom Jesus (bandeirinhas e mesinhas), Bonecos Gigantes
function buildSquares(group, data, env, mat, dark) {
  const poi = (re) => data.pois.find((p) => re.test(p.name));
  const freeNear = (x, z, R = 40) => {
    for (let r = 0; r <= R; r += 3) for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      let ok = true;
      for (const [dx, dz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) if (env.isSolid(px + dx, pz + dz) || env.isWater(px + dx, pz + dz)) ok = false;
      if (ok) return [px, pz];
    }
    return null;
  };
  // (o chafariz que ficava aqui saiu: a Praça do Arsenal de hoje é gramado, palmeiras e canteiro redondo, em marcos.js)
  const tm = null; // (chafariz desligado)
  if (tm) {
    const spot = freeNear(tm.x, tm.z + 25, 50);
    if (spot) {
      const k = new Kit(), stone = mat('#d9d2c2', { roughness: 0.8 }), water = mat('#3f8fb0', { roughness: 0.05, metalness: 0.3, emissive: '#0d2f3c' });
      k.add(stone, new THREE.CylinderGeometry(4.2, 4.4, 0.7, 32), [1, 1, 1], [0, 0.35, 0]);
      k.add(water, new THREE.CylinderGeometry(3.8, 3.8, 0.1, 32), [1, 1, 1], [0, 0.68, 0]);
      k.add(stone, new THREE.CylinderGeometry(0.35, 0.5, 2.2, 12), [1, 1, 1], [0, 1.4, 0]);
      k.add(stone, new THREE.CylinderGeometry(1.3, 0.4, 0.4, 20), [1, 1, 1], [0, 2.5, 0]);
      k.add(water, new THREE.CylinderGeometry(0.12, 0.35, 1.4, 8), [1, 1, 1], [0, 3.3, 0]);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.box(mat('#6b4a33'), 2.2, 0.12, 0.6, Math.cos(a) * 7.5, 0.5, Math.sin(a) * 7.5, [0, -a + Math.PI / 2, 0]); k.box(mat('#3b3b3b'), 0.12, 0.5, 0.5, Math.cos(a) * 7.5, 0.25, Math.sin(a) * 7.5, [0, -a + Math.PI / 2, 0]); }
      k.build(group, spot[0], spot[1]);
    }
  }
  // Rua do Bom Jesus: bandeirinhas cruzando a rua e mesinhas com guarda-sol
  const bj = data.roads.filter((r) => r.n === 'Rua do Bom Jesus');
  // outras ruas perto (para não pôr mesa no meio de uma rua que cruza)
  const near = [];
  if (bj.length) {
    const xs = bj.flatMap((r) => r.p.map((q) => q[0])), zs = bj.flatMap((r) => r.p.map((q) => q[1]));
    const x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 40, z0 = Math.min(...zs) - 40, z1 = Math.max(...zs) + 40;
    for (const r of data.roads) if (r.n !== 'Rua do Bom Jesus' && !['footway', 'path', 'steps'].includes(r.k)) for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      if (Math.max(a[0], b[0]) > x0 && Math.min(a[0], b[0]) < x1 && Math.max(a[1], b[1]) > z0 && Math.min(a[1], b[1]) < z1) near.push([a, b]);
    }
  }
  const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const clearOfRoads = (x, z) => near.every(([a, b]) => segDist(x, z, a, b) > 6.5);
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.18, 0, 0), new THREE.Vector3(0.18, 0, 0), new THREE.Vector3(0, -0.4, 0)]); flagGeo.computeVertexNormals();
  const flags = [], strings = new Kit(), cafe = new Kit(), umb = [];
  const strM = mat('#2a2a2a'), table = mat('#f2f0ea'), chairM = mat('#f7f7f4', { roughness: 0.5 });
  for (const r of bj) for (let i = 0; i < r.p.length - 1; i++) {
    const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, span = 13;
    for (let d = 3; d < L; d += 7) {
      const cx = ax + ux * d, cz = az + uz * d;
      if (!clearOfRoads(cx, cz)) continue;
      strings.box(strM, 0.03, 0.03, span, cx, 5.6, cz, [0, Math.atan2(nx, nz), 0]);
      for (let t = -span / 2 + 0.4; t < span / 2; t += 0.55) flags.push([cx + nx * t, 5.6 - Math.cos((t / span) * Math.PI) * 0.0 - (1 - (2 * t / span) ** 2) * 0.5, cz + nz * t, Math.atan2(ux, uz)]);
    }
    for (let d = 5; d < L; d += 11) for (const s of [-1, 1]) {
      const x = ax + ux * d + nx * 4.8 * s, z = az + uz * d + nz * 4.8 * s;
      if (env.isSolid(x, z) || env.isSolid(x + nx * s * 1.2, z + nz * s * 1.2) || !clearOfRoads(x, z)) continue;
      cafe.add(table, new THREE.CylinderGeometry(0.45, 0.45, 0.05, 14), [1, 1, 1], [x, 0.75, z]); cafe.box(dark, 0.06, 0.75, 0.06, x, 0.37, z);
      for (const c of [-1, 1]) { cafe.box(chairM, 0.45, 0.06, 0.45, x + ux * 0.75 * c, 0.45, z + uz * 0.75 * c); cafe.box(chairM, 0.45, 0.45, 0.06, x + ux * 0.98 * c, 0.68, z + uz * 0.98 * c, [0, Math.atan2(ux, uz), 0]); }
      cafe.box(dark, 0.05, 2.3, 0.05, x, 1.15, z); umb.push([x, z]);
    }
  }
  strings.build(group, 0, 0, 0, false); cafe.build(group);
  const FLAG = ['#e63946', '#ffd166', '#2a9d8f', '#3a86ff', '#ff7b3a', '#8338ec', '#06d6a0', '#ff006e'].map((c) => new THREE.Color(c));
  if (flags.length) {
    const im = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), flags.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    flags.forEach(([x, y, z, yaw], i) => { m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, yaw, 0)), one); im.setMatrixAt(i, m); im.setColorAt(i, FLAG[i % FLAG.length]); });
    group.add(im);
  }
  if (umb.length) {
    const im = new THREE.InstancedMesh(new THREE.ConeGeometry(1.25, 0.5, 8).translate(0, 2.4, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), umb.length);
    const m = new THREE.Matrix4(), cs = ['#c8102e', '#f2b705', '#1d5fa8', '#2a9d58', '#f2f2f0'].map((c) => new THREE.Color(c));
    umb.forEach(([x, z], i) => { im.setMatrixAt(i, m.makeTranslation(x, 0, z)); im.setColorAt(i, cs[i % cs.length]); stampDisc(x, z, 0.5); });
    im.castShadow = true; group.add(im);
  }
  // Bonecos Gigantes de Olinda na porta da Embaixada: Homem da Meia-Noite, Mulher do Dia e Menino da Tarde
  const emb = poi(/Bonecos Gigantes de Olinda/);
  const spot = emb && freeNear(emb.x, emb.z, 30);
  if (spot) {
    // virados para o lado livre (a rua)
    let face = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.3) { let ok = true; for (let d = 2; d <= 12; d += 2) if (env.isSolid(spot[0] + Math.sin(a) * d, spot[1] + Math.cos(a) * d)) ok = false; if (ok) { face = a; break; } }
    const dolls = [
      { robe: '#141414', skin: '#6e4630', hat: true, trim: '#2a9d58' },
      { robe: '#f4f1ea', skin: '#f0c9a4', hair: '#2b1a10', trim: '#e9c46a' },
      { robe: '#2b5fa8', skin: '#c48a60', hair: '#1b1209', trim: '#ffd166' },
    ];
    dolls.forEach((d, i) => {
      const k = new Kit(), robe = mat(d.robe, { roughness: 0.8 }), skin = mat(d.skin, { roughness: 0.6 }), trim = mat(d.trim);
      k.add(robe, new THREE.CylinderGeometry(0.45, 1.0, 2.8, 16), [1, 1, 1], [0, 1.4, 0]);
      k.add(trim, new THREE.CylinderGeometry(1.02, 1.02, 0.18, 16), [1, 1, 1], [0, 0.2, 0]);
      k.add(robe, new THREE.SphereGeometry(0.55, 14, 10), [1.25, 0.6, 0.9], [0, 2.85, 0]);
      for (const s of [-1, 1]) { k.add(robe, new THREE.CylinderGeometry(0.16, 0.2, 1.6, 8), [1, 1, 1], [s * 0.72, 2.0, 0], [0, 0, s * 0.18]); k.add(skin, new THREE.SphereGeometry(0.16, 8, 6), [1, 1, 1], [s * 0.86, 1.15, 0]); }
      k.add(skin, new THREE.SphereGeometry(0.62, 18, 14), [0.95, 1.1, 1], [0, 3.6, 0]);
      for (const s of [-1, 1]) { k.add(mat('#ffffff'), new THREE.SphereGeometry(0.11, 8, 6), [1, 1, 0.5], [s * 0.21, 3.72, 0.55]); k.add(dark, new THREE.SphereGeometry(0.06, 8, 6), [1, 1, 0.5], [s * 0.21, 3.72, 0.6]); }
      k.add(mat('#9c2f2f'), new THREE.SphereGeometry(0.16, 8, 6), [1.4, 0.4, 0.5], [0, 3.35, 0.57]);
      if (d.hat) { k.add(dark, new THREE.CylinderGeometry(0.42, 0.42, 0.7, 16), [1, 1, 1], [0, 4.5, 0]); k.add(dark, new THREE.CylinderGeometry(0.75, 0.75, 0.06, 18), [1, 1, 1], [0, 4.15, 0]); }
      else k.add(mat(d.hair, { roughness: 0.8 }), new THREE.SphereGeometry(0.66, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), [0.97, 1.1, 1.02], [0, 3.68, -0.04], [-0.3, 0, 0]);
      const sx = Math.cos(face), sz = -Math.sin(face); // lado a lado, perpendicular à frente
      k.build(group, spot[0] + sx * (i - 1) * 2.6, spot[1] + sz * (i - 1) * 2.6, face + (i - 1) * 0.2);
    });
  }
}

// ---------------------------------------------------------------- Parque das Esculturas Francisco Brennand, no molhe
function buildBrennand(group, data, mat) {
  const pk = data.pois.find((p) => /Parque das Esculturas/.test(p.name)); if (!pk) return;
  const pts = [];
  for (const p of data.piers) for (let i = 0; i < p.p.length - 1; i++) {
    const [ax, az] = p.p[i], [bx, bz] = p.p[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d < L; d += 16) { const x = ax + ((bx - ax) * d) / L, z = az + ((bz - az) * d) / L; if (Math.hypot(x - pk.x, z - pk.z) < 330) pts.push([x, z]); }
  }
  const terra = mat('#b5653a', { roughness: 0.75 }), cream = mat('#e9dcc3', { roughness: 0.6 }), brown = mat('#5a3826', { roughness: 0.7 });
  const k = new Kit();
  pts.forEach(([x, z], i) => {
    const t = i % 4;
    if (t === 0) { k.add(cream, new THREE.SphereGeometry(0.9, 18, 14), [1, 1.6, 1], [x, 1.8, z]); k.add(terra, new THREE.CylinderGeometry(0.9, 1.0, 0.5, 14), [1, 1, 1], [x, 0.25, z]); }      // ovo
    else if (t === 1) { for (let j = 0; j < 4; j++) k.add(j % 2 ? cream : terra, new THREE.CylinderGeometry(0.55 - j * 0.06, 0.6 - j * 0.06, 1.1, 14), [1, 1, 1], [x, 0.55 + j * 1.1, z]); k.add(terra, new THREE.SphereGeometry(0.5, 12, 8), [1, 1, 1], [x, 4.7, z]); } // totem
    else if (t === 2) { k.add(brown, new THREE.ConeGeometry(0.5, 2.6, 12), [1, 1, 1], [x, 1.3, z]); k.add(terra, new THREE.SphereGeometry(0.55, 12, 10), [1.6, 0.8, 0.9], [x, 2.8, z]); k.add(terra, new THREE.ConeGeometry(0.15, 0.7, 6), [1, 1, 1], [x + 0.9, 2.85, z], [0, 0, -Math.PI / 2]); } // pássaro
    else { k.add(cream, new THREE.CylinderGeometry(0.4, 0.5, 3.6, 12), [1, 1, 1], [x, 1.8, z]); k.add(terra, new THREE.TorusGeometry(0.7, 0.18, 8, 18), [1, 1, 1], [x, 3.9, z]); } // coluna com anel
  });
  k.build(group);
}

// ---------------------------------------------------------------- Boa Viagem: barracas de coco, guarda-sóis, jangadas e a igrejinha da praça
function buildBeach(group, data, env, mat, stucco, clay, church) {
  const av = [];
  for (const r of data.roads) {
    if (!r.n || !/^Avenida (Boa Viagem|Herculano Bandeira)/.test(r.n)) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < L; d += 20) av.push([ax + ((bx - ax) * d) / L, az + ((bz - az) * d) / L]);
    }
  }
  av.sort((a, b) => a[1] - b[1]);
  const kiosk = new Kit(), umbrellas = [], chairs = [], jangadas = new Kit();
  const white = mat('#f4f2ec'), green = mat('#2f8f4e'), thatch = mat('#b99a5b', { roughness: 0.95 }), coco = mat('#4f8a2a', { roughness: 0.6 });
  const wood = mat('#8a6a48', { roughness: 0.9 }), sailM = new THREE.MeshStandardMaterial({ color: '#f6f1e3', side: THREE.DoubleSide, roughness: 0.8 });
  let lastK = -1e9, lastJ = -1e9;
  for (const [x, z] of av) {
    // primeira areia e beira d'água para o leste da avenida
    let sand = null, sea = null;
    for (let d = 10; d < 140; d += 2) {
      if (env.isWater(x + d, z)) { sea = x + d; break; }
      if (!sand && !env.isSolid(x + d, z) && d > 22) sand = x + d;
    }
    if (!sand || !sea || sea - sand < 12) continue;
    if (Math.abs(z - lastK) > 170) {
      lastK = z; const kx = x + 15, kz = z;
      if (!env.isSolid(kx, kz)) {
        kiosk.box(white, 2.6, 2.2, 2.0, kx, 1.1, kz).box(green, 2.7, 0.35, 2.1, kx, 2.35, kz);
        kiosk.add(thatch, new THREE.ConeGeometry(2.4, 1.3, 4), [1, 1, 1], [kx, 3.1, kz], [0, Math.PI / 4, 0]);
        for (let c = 0; c < 6; c++) kiosk.add(coco, new THREE.SphereGeometry(0.17, 8, 6), [1, 1.1, 1], [kx + 1.45, 0.2 + (c % 2) * 0.28, kz - 0.6 + Math.floor(c / 2) * 0.4]);
      }
    }
    // guarda-sóis e cadeiras na faixa de areia seca
    for (let k = 0; k < 4; k++) {
      const ux = sand + 4 + Math.random() * Math.max(2, sea - sand - 12), uz = z + (Math.random() - 0.5) * 16;
      if (env.isWater(ux, uz) || env.isSolid(ux, uz)) continue;
      umbrellas.push([ux, uz]); chairs.push([ux - 1.0, uz + 0.9], [ux + 1.0, uz + 0.9]);
    }
    // jangada de vela triangular na beira-mar
    if (Math.abs(z - lastJ) > 380) {
      lastJ = z; const jx = sea - 4, jz = z;
      jangadas.box(wood, 1.5, 0.35, 5.2, jx, 0.25, jz).box(wood, 0.12, 6, 0.12, jx, 3.2, jz + 1);
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 5.4); sh.lineTo(-3.2, 0.4); sh.closePath();
      jangadas.add(sailM, new THREE.ShapeGeometry(sh), [1, 1, 1], [jx, 0.7, jz + 1], [0, Math.PI / 2, 0]);
    }
  }
  kiosk.build(group); jangadas.build(group);
  const cs = ['#e63946', '#f2b705', '#1d5fa8', '#2a9d58', '#ff7b3a', '#f2f2f0', '#e05297'].map((c) => new THREE.Color(c));
  if (umbrellas.length) {
    const top = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 0.55, 10).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), umbrellas.length);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6).translate(0, 1.15, 0), mat('#dcdcdc', { metalness: 0.5 }), umbrellas.length);
    const m = new THREE.Matrix4();
    umbrellas.forEach(([x, z], i) => { m.makeTranslation(x, 0, z); top.setMatrixAt(i, m); pole.setMatrixAt(i, m); top.setColorAt(i, cs[i % cs.length]); stampDisc(x, z, 0.2); });
    top.castShadow = true; group.add(top, pole);
  }
  if (chairs.length) {
    const g = bake([[B, [0.55, 0.06, 1.3], [0, 0.32, 0]], [B, [0.55, 0.7, 0.06], [0, 0.6, -0.68], [0.5, 0, 0]], [B, [0.05, 0.3, 0.05], [0.25, 0.15, 0.5]], [B, [0.05, 0.3, 0.05], [-0.25, 0.15, 0.5]]]);
    const im = new THREE.InstancedMesh(g, mat('#f4f4f0', { roughness: 0.5 }), chairs.length);
    const m = new THREE.Matrix4();
    chairs.forEach(([x, z], i) => im.setMatrixAt(i, m.makeRotationY(-Math.PI / 2).setPosition(x, 0, z)));
    group.add(im);
  }
  // Igreja de Nossa Senhora da Boa Viagem, na pracinha, de frente para o mar
  const pb = data.pois.find((p) => p.name === 'Praça Boa Viagem');
  if (pb) {
    // o ponto da praça mais longe de prédios, com a igreja (26 × 14 m, comprida no eixo x) e uma folga de 4 m
    let spot = null, bestScore = -1;
    const fits = (x, z) => {
      for (let dx = -17; dx <= 17; dx += 2.5) for (let dz = -11; dz <= 11; dz += 2.5) if (env.isSolid(x + dx, z + dz) || env.isWater(x + dx, z + dz)) return false;
      return true;
    };
    const clearance = (x, z) => {
      let m = 60;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) for (let d = 6; d < m; d += 2) if (env.isSolid(x + Math.cos(a) * d, z + Math.sin(a) * d)) { m = d; break; }
      return m;
    };
    // só dentro das praças (polígonos de parque/largo do OSM) em volta do ponto
    const squares = data.parks.filter((q) => q.p.some((v) => Math.hypot(v[0] - pb.x, v[1] - pb.z) < 120));
    const inSquare = (x, z) => !squares.length || squares.some((q) => inside(q.p, x, z));
    for (let r = 0; r <= 80; r += 3) for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const x = pb.x + Math.cos(a) * r, z = pb.z + Math.sin(a) * r;
      if (!inSquare(x, z) || !fits(x, z)) continue;
      const sc = clearance(x, z) - r * 0.15;
      if (sc > bestScore) { bestScore = sc; spot = [x, z]; }
    }
    if (spot) {
      church({ wid: 11, len: 22 }, { towers: 1, wall: '#f6f4ee', trim: '#3d6fb0' }).build(group, spot[0], spot[1], Math.PI / 2);
      const g = env.grid;
      if (g) for (let dx = -12; dx <= 12; dx += 1.5) for (let dz = -6; dz <= 6; dz += 1.5) {
        const ix = Math.floor((spot[0] + dx - g.xmin) / g.RES), iz = Math.floor((spot[1] + dz - g.zmin) / g.RES);
        if (ix >= 0 && iz >= 0 && ix < g.GW && iz < g.GH) g.mask[iz * g.GW + ix] |= SOLID;
      }
    }
  }
}

// ---------------------------------------------------------------- bairros da zona oeste e norte
// Torre do Zeppelin (Jiquiá), Parque de Exposições do Cordeiro com o Cavalo Branco, Cavalo Dourado (Prado),
// Arraial Novo do Bom Jesus (forte de terra), Jardim do Baobá, Chaminé do Engenho da Torre e a Mirabilândia
// (parque de diversões de Campo Grande, com roda-gigante e barco que se mexem).
function buildBairros(group, data, env, { Kit, mat, named, ringOf, place, fort, night }) {
  const anim = [];
  const poi = (n) => data.pois.find((p) => p.name === n);
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z) && !env.isRoad?.(x, z);
  const spotNear = (x, z, w = 6, d = 6, R = 40) => {
    for (let r = 0; r <= R; r += 2) for (let a = 0; a < Math.PI * 2; a += 0.45) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      let ok = true;
      for (let dx = -w / 2; dx <= w / 2 && ok; dx += 1.5) for (let dz = -d / 2; dz <= d / 2 && ok; dz += 1.5) if (!free(px + dx, pz + dz)) ok = false;
      if (ok) return [px, pz];
    }
    return null;
  };
  // viga cilíndrica entre dois pontos
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), e = new THREE.Euler();
  const beam = (k, m, a, b, r) => {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = dir.length();
    q.setFromUnitVectors(up, dir.normalize()); e.setFromQuaternion(q, 'XYZ');
    k.add(m, new THREE.CylinderGeometry(r, r, L, 6), [1, 1, 1], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [e.x, e.y, e.z], 'XYZ');
  };
  // cavalo em pedestal
  const horse = (x, z, yaw, coat, s = 1) => {
    const k = new Kit(), m = coat, stone = mat('#d8d0bf', { roughness: 0.8 });
    k.box(stone, 2.2 * s, 1.6, 4.2 * s, 0, 0.8, 0);
    const y = 1.6;
    k.add(m, new THREE.SphereGeometry(0.75 * s, 16, 12), [1, 0.85, 1.9], [0, y + 1.9 * s, 0]);
    for (const [lx, lz] of [[-0.35, 0.95], [0.35, 0.95], [-0.35, -0.95], [0.35, -0.95]]) k.add(m, new THREE.CylinderGeometry(0.13 * s, 0.1 * s, 1.55 * s, 8), [1, 1, 1], [lx * s, y + 0.8 * s, lz * s]);
    k.add(m, new THREE.CylinderGeometry(0.28 * s, 0.38 * s, 1.3 * s, 10), [1, 1, 1], [0, y + 2.65 * s, 1.35 * s], [0.6, 0, 0]);
    k.add(m, new THREE.SphereGeometry(0.3 * s, 12, 10), [0.9, 0.9, 1.9], [0, y + 3.2 * s, 1.85 * s], [0.4, 0, 0]);
    k.add(m, new THREE.CylinderGeometry(0.06 * s, 0.14 * s, 1.1 * s, 6), [1, 1, 1], [0, y + 1.6 * s, -1.6 * s], [-0.5, 0, 0]);
    k.build(group, x, z, yaw);
  };

  // Torre do Zeppelin (Jiquiá): torre de treliça de aço onde atracavam os zepelins, única que resta no mundo
  const tz = poi('Torre do Zeppelin');
  if (tz) {
    const k = new Kit(), steel = mat('#5e6b6f', { metalness: 0.6, roughness: 0.5 }), H = 26, b0 = 5, b1 = 1.3;
    const C = (h) => { const s = b0 + (b1 - b0) * (h / H); return [[-s, h, -s], [s, h, -s], [s, h, s], [-s, h, s]]; };
    const base = C(0), top = C(H);
    for (let i = 0; i < 4; i++) beam(k, steel, base[i], top[i], 0.22);
    for (let h = 0; h < H; h += 3.25) {
      const lo = C(h), hi = C(Math.min(H, h + 3.25));
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; beam(k, steel, lo[i], lo[j], 0.1); beam(k, steel, lo[i], hi[j], 0.07); beam(k, steel, lo[j], hi[i], 0.07); }
    }
    k.box(steel, 4, 0.3, 4, 0, H + 0.15, 0);
    for (const [x, zz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) k.box(steel, x ? 0.08 : 4, 1, zz ? 0.08 : 4, x, H + 0.8, zz);
    k.add(steel, new THREE.ConeGeometry(0.5, 3, 8), [1, 1, 1], [0, H + 1.8, 0]);
    k.add(mat('#c8102e', { emissive: '#ff2020', emissiveIntensity: 1 }), new THREE.SphereGeometry(0.25, 8, 6), [1, 1, 1], [0, H + 3.4, 0]);
    k.build(group, tz.x, tz.z);
  }

  // Parque de Exposições do Cordeiro: galpões de feira e o Cavalo Branco
  const pe = poi('Parque de Exposições do Cordeiro');
  if (pe) {
    for (let i = 0; i < 3; i++) {
      const s = spotNear(pe.x + (i - 1) * 45, pe.z, 20, 42, 60); if (!s) continue;
      const k = new Kit(), roof = mat('#b9c0c2', { metalness: 0.5, roughness: 0.4 }), post = mat('#4f5a5e', { metalness: 0.4 });
      for (let z = -19; z <= 19; z += 6.3) for (const x of [-8.5, 8.5]) k.box(post, 0.35, 5, 0.35, x, 2.5, z);
      k.add(roof, new THREE.CylinderGeometry(9.5, 9.5, 40, 20, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), [1, 0.38, 1], [0, 5, 0]);
      k.build(group, s[0], s[1], 0);
    }
  }
  const wh = poi('White Horse');
  if (wh) { const s = spotNear(wh.x, wh.z, 3, 5, 25); if (s) horse(s[0], s[1], 0.6, mat('#f2f0ea', { roughness: 0.4 })); }
  // Cavalo Dourado (Praça Carlos Gomes, Prado)
  const cd = poi('Praça Carlos Gomes/ do Cavalo Dourado');
  if (cd) { const s = spotNear(cd.x, cd.z, 3, 5, 25); if (s) horse(s[0], s[1], -0.8, mat('#d4a73a', { metalness: 0.9, roughness: 0.25 }), 1.15); }

  // Arraial Novo do Bom Jesus: forte de terra com baluartes em ponta, coberto de grama, e um marco
  const ar = poi('Parque Forte do Arraial Novo do Bom Jesus');
  if (ar) {
    const s = spotNear(ar.x, ar.z, 30, 30, 50);
    if (s) {
      const [cx, cz] = s, R = 18, ring = [];
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; ring.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); ring.push([cx + Math.cos(a + Math.PI / 4) * R * 0.62, cz + Math.sin(a + Math.PI / 4) * R * 0.62]); }
      fort(ring, group, { H: 2.6, bat: 2.2, top: 2.5, color: '#6f9a4f', posts: false, stamp: true });
      const k = new Kit(); k.box(mat('#d8d0bf'), 1.2, 1, 1.2, cx, 0.5, cz); k.add(mat('#d8d0bf'), new THREE.CylinderGeometry(0.3, 0.55, 6, 4), [1, 1, 1], [cx, 4, cz], [0, Math.PI / 4, 0]);
      k.build(group);
    }
  }

  // Jardim do Baobá (Torre): baobá gigante de tronco grosso
  const bb = poi('Jardim do Baobá');
  if (bb) {
    const s = spotNear(bb.x, bb.z, 8, 8, 30);
    if (s) {
      const k = new Kit(), bark = mat('#8c7a66', { roughness: 0.95 }), leaf = mat('#5b8a3a', { roughness: 0.8 });
      k.add(bark, new THREE.CylinderGeometry(2.2, 3.2, 10, 14), [1, 1, 1], [0, 5, 0]);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; beam(k, bark, [Math.cos(a) * 1.2, 9.5, Math.sin(a) * 1.2], [Math.cos(a) * 5.5, 13 + (i % 2) * 1.5, Math.sin(a) * 5.5], 0.45); k.add(leaf, new THREE.IcosahedronGeometry(2.6, 1), [1, 0.6, 1], [Math.cos(a) * 5.8, 13.8 + (i % 2) * 1.5, Math.sin(a) * 5.8]); }
      k.add(leaf, new THREE.IcosahedronGeometry(3.2, 1), [1, 0.55, 1], [0, 14.5, 0]);
      k.build(group, s[0], s[1]);
    }
  }

  // Chaminé do Antigo Engenho (depois Olaria) da Torre: chaminé de tijolo
  for (const b of named['Chaminé do Antigo Engenho (depois Olaria) da Torre'] || []) {
    const r = ringOf(b), cx = r.reduce((s, p) => s + p[0], 0) / r.length, cz = r.reduce((s, p) => s + p[1], 0) / r.length;
    const k = new Kit(), brick = mat('#a4532f', { roughness: 0.9 });
    k.box(brick, 3.2, 2.5, 3.2, 0, 1.25, 0);
    k.add(brick, new THREE.CylinderGeometry(0.95, 1.5, 20, 12), [1, 1, 1], [0, 12.5, 0]);
    k.add(mat('#7d3d22'), new THREE.CylinderGeometry(1.15, 1.0, 0.8, 12), [1, 1, 1], [0, 22.6, 0]);
    k.build(group, cx, cz);
  }

  // Mirabilândia (Campo Grande): roda-gigante, barco pirata, carrossel e tobogã
  const mb = poi('Mirabilândia');
  const rides = data.pois.filter((p) => p.kind === 'attraction' && mb && Math.hypot(p.x - mb.x, p.z - mb.z) < 250);
  if (mb) {
    const at = (name, w, d) => { const p = rides.find((r) => r.name === name) || mb; return spotNear(p.x, p.z, w, d, 45) || spotNear(mb.x, mb.z, w, d, 110) || spotNear(p.x, p.z, w * 0.7, d * 0.7, 90); };
    const steel = mat('#d8dcde', { metalness: 0.6, roughness: 0.35 }), red = mat('#e63946'), yellow = mat('#ffd166'), blue = mat('#3a86ff'), green = mat('#2a9d58');
    const bulbs = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0.3 });
    // roda-gigante: rodas e cadeirinhas giram
    const s1 = at('Ranger', 6, 28);
    if (s1) {
      const R = 15, k = new Kit();
      for (const z of [-1.6, 1.6]) for (const sx of [-1, 1]) beam(k, steel, [sx * 7, 0, z * 2.2], [0, R + 2, z], 0.25);
      k.box(steel, 0.4, 0.4, 3.6, 0, R + 2, 0);
      k.build(group, s1[0], s1[1], Math.PI / 2);
      const wheel = new Kit();
      for (const z of [-1.4, 1.4]) { wheel.add(steel, new THREE.TorusGeometry(R, 0.18, 6, 48), [1, 1, 1], [0, 0, z]); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; beam(wheel, steel, [0, 0, z], [Math.cos(a) * R, Math.sin(a) * R, z], 0.07); } }
      for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; wheel.add(bulbs, new THREE.SphereGeometry(0.18, 6, 4), [1, 1, 1], [Math.cos(a) * R, Math.sin(a) * R, 1.6]); }
      const wg = wheel.build(group, 0, 0, 0, true, false);
      wg.position.set(s1[0], R + 2, s1[1]); wg.rotation.y = Math.PI / 2;
      const cars = [], cols = [red, yellow, blue, green];
      for (let i = 0; i < 12; i++) {
        const c = new Kit(); c.box(cols[i % 4], 1.6, 1.4, 1.8, 0, -1.0, 0); c.box(steel, 0.08, 0.6, 0.08, 0, -0.1, 0);
        const cg = c.build(group, 0, 0, 0, true, false); cars.push(cg);
      }
      anim.push((t) => {
        const w = t * 0.12; wg.rotation.z = 0; wg.children.forEach((m) => (m.rotation.z = w));
        cars.forEach((cg, i) => {
          const a = w + (i / 12) * Math.PI * 2;
          const lx = Math.cos(a) * R, ly = Math.sin(a) * R; // plano da roda (local) → mundo (roda girada 90° em y)
          cg.position.set(s1[0], R + 2 + ly, s1[1] - lx); cg.rotation.y = Math.PI / 2;
        });
      });
      night.push((n) => (bulbs.emissiveIntensity = 0.3 + n * 4));
    }
    // barco pirata (Dragão do Mar): balança
    const s2 = at('Dragão do Mar', 8, 16);
    if (s2) {
      const k = new Kit();
      for (const sx of [-1, 1]) for (const z of [-3, 3]) beam(k, steel, [sx * 4.5, 0, z], [0, 11, z * 0.2], 0.25);
      k.box(steel, 0.4, 0.4, 3, 0, 11, 0);
      k.build(group, s2[0], s2[1], 0);
      const ship = new Kit(), wood = mat('#7a4a2a', { roughness: 0.8 });
      ship.box(wood, 3.2, 1.6, 12, 0, -8.5, 0); ship.add(wood, new THREE.ConeGeometry(1.6, 2.4, 4), [1, 1, 1], [0, -8.5, 7.2], [Math.PI / 2, Math.PI / 4, 0]);
      ship.add(mat('#c8102e'), new THREE.ConeGeometry(0.9, 2.5, 3), [1, 1, 1], [0, -6.3, 6.6], [Math.PI / 2, 0, 0]);
      for (const z of [-2.5, 2.5]) beam(ship, steel, [0, 0, 0], [0, -8, z], 0.12);
      const sg = ship.build(group, 0, 0, 0, true, false); sg.position.set(s2[0], 11, s2[1]);
      anim.push((t) => { sg.rotation.x = Math.sin(t * 0.9) * 0.9; });
    }
    // carrossel: gira
    const s3 = at('Saltamontes', 14, 14);
    if (s3) {
      const k = new Kit();
      k.add(mat('#f4f1ea'), new THREE.CylinderGeometry(6.5, 6.5, 0.5, 24), [1, 1, 1], [0, 0.25, 0]);
      k.add(red, new THREE.ConeGeometry(7.2, 2.6, 24), [1, 1, 1], [0, 5.6, 0]);
      k.add(steel, new THREE.CylinderGeometry(0.4, 0.4, 4.4, 10), [1, 1, 1], [0, 2.6, 0]);
      k.build(group, s3[0], s3[1]);
      const ring = new Kit();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ring.box(i % 2 ? yellow : blue, 0.5, 0.9, 1.4, Math.cos(a) * 5, 1.6, Math.sin(a) * 5, [0, -a, 0]); beam(ring, steel, [Math.cos(a) * 5, 0.5, Math.sin(a) * 5], [Math.cos(a) * 5, 4.3, Math.sin(a) * 5], 0.05); }
      const rg = ring.build(group, s3[0], s3[1], 0, true, false);
      anim.push((t) => (rg.rotation.y = t * 0.5));
    }
    // tobogã: torre e rampa ondulada
    const s4 = at('Tobogã', 8, 26);
    if (s4) {
      const k = new Kit();
      k.box(yellow, 3, 9, 3, 0, 4.5, -10);
      for (let i = 0; i < 10; i++) { const z0 = -8.5 + i * 2, y0 = 9 * (1 - i / 10) + Math.sin(i * 1.3) * 0.5; k.box(i % 2 ? blue : red, 2.4, 0.25, 2.1, 0, Math.max(0.3, y0), z0, [-0.42, 0, 0]); }
      k.build(group, s4[0], s4[1], 0.4);
    }
  }
  return anim;
}
