import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts }));
  return mats.get(key);
}
function part(geo, material, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const CAR_COLORS = ['#c9302c', '#f2f2f0', '#1c1c1e', '#9aa3ab', '#2f5d9c', '#e3b12f', '#3d7a4a', '#7b2b3a', '#d8d4cb', '#5a5f66'];
const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2);

// pneu arredondado (perfil girado) e aro com raios; raio 1, escalados por roda
const tireGeo = new THREE.LatheGeometry(
  [[0.62, -0.13], [0.86, -0.13], [0.97, -0.1], [1, 0], [0.97, 0.1], [0.86, 0.13], [0.62, 0.13]].map(([r, y]) => new THREE.Vector2(r, y)), 20,
).rotateZ(Math.PI / 2);
const rimGeo = (() => {
  const parts = [new THREE.CylinderGeometry(0.64, 0.64, 0.06, 20).rotateZ(Math.PI / 2)];
  for (let i = 0; i < 5; i++) { const sp = new THREE.BoxGeometry(0.05, 1.1, 0.12); sp.rotateX((i / 5) * Math.PI); parts.push(sp.translate(0.04, 0, 0)); }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
})();
const plateGeo = new THREE.PlaneGeometry(0.4, 0.13);
let plateM;
function plateMat() {
  // placa Mercosul: branca com faixa azul
  if (plateM) return plateM;
  const c = document.createElement('canvas'); c.width = 128; c.height = 42;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 128, 42);
  g.fillStyle = '#1d4fa0'; g.fillRect(0, 0, 128, 10);
  g.fillStyle = '#111'; g.font = 'bold 24px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('PEX1C23', 64, 36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (plateM = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }));
}
const glassMat = new THREE.MeshStandardMaterial({ color: '#566673', metalness: 0.8, roughness: 0.06 });
const trim = new THREE.MeshStandardMaterial({ color: '#202224', roughness: 0.7 });

// carroceria: perfil lateral (z para frente, y para cima) extrudado na largura, com quinas arredondadas
const bodyCache = new Map();
function extrudeSide(pts, width, bevel) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) sh.quadraticCurveTo(p[0], p[1], p[2], p[3]); else sh.lineTo(p[0], p[1]);
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 });
  geo.rotateY(-Math.PI / 2);
  geo.translate((width - bevel * 2) / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}
// junta várias peças (geometria + escala/posição/rotação) numa geometria só: uma chamada de desenho por material
function bake(items) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  return mergeGeometries(items.map(([geo, sc, ps, rt]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    m.compose(new THREE.Vector3(...ps), q.setFromEuler(e.set(...(rt || [0, 0, 0]))), new THREE.Vector3(...sc));
    return g.applyMatrix4(m);
  }));
}
const archGeo = new THREE.TorusGeometry(1, 0.045, 6, 14, Math.PI).rotateY(Math.PI / 2);
const tankGeo = new THREE.SphereGeometry(1, 12, 8);

function bodyGeos(type, L, W, wr) {
  if (bodyCache.has(type)) return bodyCache.get(type);
  const h = L / 2, suv = type === 'suv', sedan = type === 'sedan';
  const lift = suv ? 0.08 : 0, belt = (suv ? 1.08 : 0.95);
  // embaixo, o perfil sobe em arco em volta de cada roda (caixa de roda)
  const R = wr + 0.07, wz = L * 0.31, arch = (zc) => {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = Math.PI - (k / 8) * Math.PI; pts.push([zc + Math.cos(t) * R, wr + Math.sin(t) * R]); }
    return [[zc - R, 0.3 + lift], ...pts, [zc + R, 0.3 + lift]];
  };
  const body = extrudeSide([
    [-h + 0.05, 0.3 + lift], ...arch(-wz), ...arch(wz), [h - 0.12, 0.3 + lift], [h + 0.02, 0.32 + lift, h + 0.04, 0.55 + lift], [h + 0.04, 0.68 + lift, h - 0.12, 0.82 + lift],
    [h - 0.95, belt], [-h + 0.5, belt + 0.02], [-h + 0.02, belt, -h + 0.0, 0.75 + lift], [-h - 0.02, 0.4 + lift, -h + 0.05, 0.3 + lift],
  ], W, 0.1);
  // fundo escuro da caixa de roda, para não ver através do carro
  const wellItems = [-1, 1].map((sz) => [new THREE.CylinderGeometry(R - 0.02, R - 0.02, W - 0.3, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), [1, 1, 1], [0, wr, sz * wz]]);
  const cabH = suv ? 0.62 : 0.5, front = suv ? h - 1.25 : h - 1.15, back = suv ? -h + 0.25 : sedan ? -h + 0.95 : -h + 0.55;
  const top = belt + cabH;
  // sedã: vidro traseiro bem inclinado até a tampa do porta-malas
  const rr = suv ? 0.15 : sedan ? 0.75 : 0.45, rr2 = suv ? 0.02 : sedan ? 0.3 : 0.15;
  const cabin = extrudeSide([
    [front, belt - 0.02], [front - 0.62, top - 0.04, front - 0.78, top], [back + rr, top],
    [back + rr2, top - 0.03, back, belt + (suv ? 0.05 : 0.0)], [back, belt - 0.02],
  ], W * 0.9, 0.06);
  const roofGeo = extrudeSide([
    [front - 0.74, top - 0.01], [back + rr - 0.03, top - 0.01], [back + rr - 0.03, top + 0.045], [front - 0.74, top + 0.045],
  ], W * 0.9, 0.03);
  const bP = (front + back) / 2 + 0.1, sideX = W / 2 + 0.004;
  const paintG = bake([
    [body, [1, 1, 1], [0, 0, 0]], [roofGeo, [1, 1, 1], [0, 0, 0]],
    [box, [W * 0.885, cabH * 0.92, 0.12], [0, belt + cabH * 0.46, bP]],                          // coluna B
    ...[-1, 1].map((s) => [box, [0.16, 0.11, 0.08], [s * (W / 2 + 0.06), belt + 0.06, front - 0.1]]), // retrovisores
    // colunas A (do para-brisa) e C (do vidro de trás): o vidro deixa de ser um bloco só
    ...[-1, 1].flatMap((s) => [
      [box, [0.075, Math.hypot(0.74, cabH), 0.11], [s * (W * 0.45 - 0.03), belt + cabH / 2, front - 0.35], [Math.atan2(-0.74, cabH), 0, 0]],
      [box, [0.075, Math.hypot(rr, cabH), suv ? 0.16 : 0.13], [s * (W * 0.45 - 0.03), belt + cabH / 2, back + rr / 2 + 0.04], [Math.atan2(rr, cabH), 0, 0]],
    ]),
  ]);
  const trimItems = [
    ...wellItems,
    [box, [W * 0.98, 0.2, 0.16], [0, 0.42 + lift, h - 0.02]], [box, [W * 0.98, 0.2, 0.16], [0, 0.42 + lift, -h + 0.02]], // para-choques
    [box, [W * 0.5, 0.15, 0.05], [0, 0.66 + lift, h + 0.03]],                                                             // grade
  ];
  for (const s of [-1, 1]) {
    trimItems.push([box, [0.05, 0.1, L * 0.36], [s * (W / 2 - 0.005), 0.34 + lift, 0]]);                                  // saia lateral
    trimItems.push([box, [0.03, 0.05, front - back - 0.3], [s * (W * 0.45 + 0.005), belt + 0.03, (front + back) / 2]]);  // friso da janela
    for (const z of [wz, -wz]) trimItems.push([archGeo, [1, R + 0.01, R + 0.01], [s * (W / 2 - 0.02), wr, z]]); // borda do para-lama
    for (const z of [front + 0.02, bP, back + 0.12]) trimItems.push([box, [0.012, belt - 0.4 - lift, 0.014], [s * sideX, (belt + 0.4 + lift) / 2, z]]); // frestas das portas
  }
  const chromeItems = [];
  for (const y of [0.62, 0.66, 0.7]) chromeItems.push([box, [W * 0.46, 0.012, 0.02], [0, y + lift, h + 0.06]]);
  for (const s of [-1, 1]) {
    chromeItems.push([box, [0.44, 0.16, 0.04], [s * W * 0.33, 0.72 + lift, h - 0.015]]);                                  // moldura do farol
    for (const z of [bP + 0.35, bP - 0.45]) chromeItems.push([box, [0.03, 0.03, 0.16], [s * (W / 2 + 0.018), belt - 0.15, z]]); // maçanetas
  }
  const headG = bake([-1, 1].map((s) => [box, [0.38, 0.12, 0.06], [s * W * 0.33, 0.72 + lift, h]]));
  const tailItems = [-1, 1].map((s) => [box, [0.34, 0.14, 0.06], [s * W * 0.36, 0.82 + lift, -h]]);
  if (sedan) tailItems.push([box, [W * 0.4, 0.04, 0.05], [0, 0.85 + lift, -h - 0.005]]); // filete de luz ligando as lanternas
  const plates = bake([[plateGeo, [1, 1, 1], [0, 0.5 + lift, h + 0.11]], [plateGeo, [1, 1, 1], [0, 0.5 + lift, -h - 0.11], [0, Math.PI, 0]]]);
  const G = {
    paint: paintG, cabin, trim: bake(trimItems), chrome: bake(chromeItems), head: headG, tail: bake(tailItems), plates,
    beltY: belt, cabH, roofMid: (front - 0.74 + back + 0.3) / 2, lift,
  };
  bodyCache.set(type, G);
  return G;
}

// ônibus urbano: perfil com caixas de roda e frente arredondada, janelas com colunas, para-brisa inclinado,
// portas do lado direito (-x), letreiro de destino em LED e ar-condicionado no teto
let busCache = null;
function busGeos(L, W, wr) {
  if (busCache) return busCache;
  const h = L / 2, R = wr + 0.08, wz = L * 0.31, base = 0.42;
  // o bisel de 0,12 m engorda o perfil: desenha-se 0,12 m para dentro (e o arco da roda 0,12 m maior)
  const e = 0.12, hb = h - e, bb = base + e, Rp = R + e;
  const arch = (zc) => {
    const pts = [];
    for (let k = 0; k <= 10; k++) { const t = Math.PI - (k / 10) * Math.PI; pts.push([zc + Math.cos(t) * Rp, wr + Math.sin(t) * Rp]); }
    return [[zc - Rp, bb], ...pts, [zc + Rp, bb]];
  };
  const shell = extrudeSide([
    [-hb + 0.1, bb], ...arch(-wz), ...arch(wz), [hb - 0.1, bb], [hb, bb + 0.1], [hb, 1.2],
    [hb - 0.12, 2.88 - e], [hb - 0.14, 3.1 - e, hb - 0.4, 3.1 - e], [-hb + 0.3, 3.1 - e], [-hb, 3.1 - e, -hb, 2.85 - e], [-hb, bb + 0.1], [-hb + 0.1, bb],
  ], W, e);
  const winY0 = 1.72, winY1 = 2.72, wy = (winY0 + winY1) / 2, wh = winY1 - winY0, sx = W / 2 + 0.006;
  const white = [[shell, [1, 1, 1], [0, 0, 0]]];
  const glass = [], dark = [];
  for (const s of [-1, 1]) {
    glass.push([box, [0.02, wh, L - 1.6], [s * sx, wy, -0.35]]);
    for (let z = -h + 0.55; z <= h - 1.1; z += 1.55) white.push([box, [0.04, wh + 0.02, 0.13], [s * (sx + 0.01), wy, z]]); // colunas
    dark.push([box, [0.03, 0.05, L - 1.5], [s * (sx + 0.005), winY0 - 0.03, -0.35]], [box, [0.03, 0.05, L - 1.5], [s * (sx + 0.005), winY1 + 0.03, -0.35]]);
    // caixa de roda escura (não ver através) e para-lama de borracha
    for (const z of [-wz, wz]) dark.push([archGeo, [1.3, R + 0.02, R + 0.02], [s * (W / 2 - 0.03), wr, z]]);
  }
  for (const z of [-wz, wz]) dark.push([new THREE.CylinderGeometry(R - 0.02, R - 0.02, W - 0.35, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), [1, 1, 1], [0, wr, z]]);
  // portas do lado direito (frente e meio), com vidro e borracha
  for (const z of [h - 1.0, 0.6]) {
    dark.push([box, [0.03, 2.3, 1.22], [-(sx + 0.004), 0.42 + 1.15, z]]);
    glass.push([box, [0.025, 1.9, 0.5], [-(sx + 0.02), 1.6, z - 0.29]], [box, [0.025, 1.9, 0.5], [-(sx + 0.02), 1.6, z + 0.29]]);
  }
  // janela do motorista e para-brisa inclinado
  glass.push([box, [0.02, 1.25, 0.95], [sx, 2.1, h - 0.7]]);
  glass.push([box, [W * 0.9, 1.62, 0.03], [0, 2.05, h - 0.03], [-0.072, 0, 0]]);
  dark.push([box, [W * 0.92, 0.1, 0.05], [0, 1.22, h + 0.01]], [box, [0.05, 0.3, 0.05], [0, 1.37, h - 0.05]]); // borracha e limpador
  // para-choques, grade do motor atrás, espelhos e ar-condicionado
  dark.push([box, [W * 1.0, 0.32, 0.18], [0, 0.6, h + 0.02]], [box, [W * 1.0, 0.32, 0.18], [0, 0.6, -h - 0.02]]);
  dark.push([box, [W * 0.7, 0.55, 0.04], [0, 1.25, -h - 0.01]]);
  for (const s of [-1, 1]) dark.push([box, [0.05, 0.05, 0.5], [s * (W / 2 + 0.05), 2.75, h + 0.2]], [box, [0.12, 0.38, 0.06], [s * (W / 2 + 0.07), 2.5, h + 0.45]]);
  white.push([box, [W * 0.72, 0.26, 2.4], [0, 3.22, -1.2]]);
  dark.push([box, [W * 0.6, 0.04, 2.0], [0, 3.36, -1.2]]);
  // faixas da empresa
  const band = [], stripe = [];
  for (const s of [-1, 1]) { band.push([box, [0.02, 0.38, L - 0.6], [s * (sx + 0.002), 1.08, 0]]); stripe.push([box, [0.02, 0.08, L - 0.6], [s * (sx + 0.003), 1.33, 0]]); }
  band.push([box, [W * 0.96, 0.38, 0.02], [0, 1.08, -h - 0.004]]);
  // pintura nova do convencional (laranja): a saia inteira até embaixo das janelas, na frente embaixo do
  // para-brisa e atrás em volta da grade (as portas e as caixas de roda escuras ficam por cima)
  const saia = [];
  for (const s of [-1, 1]) saia.push([box, [0.02, 1.08, L - 0.5], [s * (sx + 0.001), 0.42 + 0.54 + 0.1, 0]]);
  saia.push([box, [W * 0.96, 0.62, 0.02], [0, 0.95, h + 0.003]], [box, [W * 0.96, 1.1, 0.02], [0, 1.05, -h - 0.003]]);
  const head = [-1, 1].map((s) => [box, [0.42, 0.16, 0.05], [s * W * 0.34, 0.95, h + 0.02]]);
  const tail = [-1, 1].flatMap((s) => [[box, [0.18, 0.5, 0.05], [s * W * 0.42, 1.0, -h - 0.02]], [box, [0.14, 0.14, 0.05], [s * W * 0.42, 2.85, -h - 0.02]]]);
  const sign = bake([[new THREE.PlaneGeometry(W * 0.82, 0.3), [1, 1, 1], [0, 2.94, h - 0.11], [-0.07, 0, 0]], [new THREE.PlaneGeometry(W * 0.5, 0.22), [1, 1, 1], [0, 2.75, -h - 0.02], [0, Math.PI, 0]]]);
  const plates = bake([[plateGeo, [1, 1, 1], [0, 0.6, h + 0.12]], [plateGeo, [1, 1, 1], [0, 0.6, -h - 0.12], [0, Math.PI, 0]]]);
  return (busCache = { white: bake(white), glass: bake(glass), dark: bake(dark), band: bake(band), stripe: bake(stripe), saia: bake(saia), head: bake(head), tail: bake(tail), sign, plates });
}
// letreiro de LED âmbar: cada ônibus sorteia um destino (lugares de verdade da cidade)
const DESTINOS = ['TI JOANA BEZERRA', 'BOA VIAGEM', 'CONDE DA BOA VISTA', 'TI CAXANGÁ', 'CASA AMARELA', 'AFOGADOS', 'DERBY', 'CAIS DE SANTA RITA', 'MACAXEIRA', 'IBURA', 'TI PE-15', 'RECIFE ANTIGO'];
const destMats = [];
function destMat() {
  if (!destMats.length) for (const d of DESTINOS) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#ffb21a'; g.font = 'bold 22px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(100 + destMats.length * 37 % 900).slice(0, 3) + ' ' + d, 128, 17);
    // pontinhos do LED
    g.fillStyle = 'rgba(0,0,0,0.45)'; for (let x = 0; x < 256; x += 3) g.fillRect(x, 0, 1, 32); for (let y = 0; y < 32; y += 3) g.fillRect(0, y, 256, 1);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    destMats.push(new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.3 }));
  }
  return destMats[Math.floor(Math.random() * destMats.length)];
}

const CHROME = new THREE.MeshStandardMaterial({ color: '#d5d8db', metalness: 1, roughness: 0.22 });
const solid = (geo, m, shadow = true) => { const x = new THREE.Mesh(geo, m); x.castShadow = shadow; x.receiveShadow = true; return x; };

// Veículo voltado para +z. kind: car | suv | bus | buggy
export function makeVehicle(kind = 'car', color) {
  const g = new THREE.Group(), pedida = color;
  if (kind === 'police') color = '#f4f4f2';
  color ||= CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const paint = mat(color, { metalness: 0.5, roughness: 0.35 });
  const glass = mat('#1d2730', { metalness: 0.6, roughness: 0.15 });
  const dark = mat('#141414', { roughness: 0.9 });
  const head = HEAD, tail = TAIL;
  let L, Wd, wr;
  if (kind === 'bus') {
    L = 12; Wd = 2.55; wr = 0.5;
    const B = busGeos(L, Wd, wr);
    // frota do Grande Recife: a maior parte já com a pintura laranja do convencional; o resto é a frota antiga,
    // branca com a faixa da empresa
    const novo = !pedida && Math.random() < 0.6;
    if (novo) g.add(solid(B.saia, mat('#ee6a1f', { roughness: 0.45, metalness: 0.1 })));
    g.add(solid(B.white, mat('#f1efe8', { roughness: 0.45, metalness: 0.1 })), solid(novo ? B.stripe : B.band, novo ? mat('#f1efe8', { roughness: 0.5 }) : paint), ...(novo ? [] : [solid(B.stripe, mat('#f2b705', { roughness: 0.5 }))]),
      solid(B.glass, glassMat), solid(B.dark, trim), solid(B.head, head, false), solid(B.tail, tail, false), solid(B.sign, destMat(), false), solid(B.plates, plateMat(), false));
  } else if (kind === 'sport') {
    // esportivo: baixo, largo, cabine curta e aerofólio
    L = 4.4; Wd = 1.98; wr = 0.34;
    const by = wr + 0.22;
    g.add(part(box, paint, Wd, 0.5, L, 0, by, 0));
    g.add(part(box, paint, Wd * 0.96, 0.18, L * 0.34, 0, by + 0.3, L * 0.26));            // capô
    g.add(part(box, glass, Wd * 0.84, 0.42, L * 0.36, 0, by + 0.45, -0.25));
    g.add(part(box, paint, Wd * 0.82, 0.06, L * 0.3, 0, by + 0.68, -0.3));
    g.add(part(box, dark, Wd * 0.9, 0.06, 0.32, 0, by + 0.62, -L / 2 + 0.2));             // aerofólio
    for (const sx of [-0.7, 0.7]) g.add(part(box, dark, 0.06, 0.3, 0.1, sx, by + 0.42, -L / 2 + 0.2));
    g.add(part(box, dark, Wd + 0.04, 0.16, 0.18, 0, wr + 0.02, L / 2));
    for (const s of [-1, 1]) {
      g.add(part(box, head, 0.46, 0.1, 0.06, s * Wd * 0.33, by + 0.12, L / 2 + 0.01));
      g.add(part(box, tail, 0.5, 0.1, 0.06, s * Wd * 0.3, by + 0.15, -L / 2 - 0.01));
    }
  } else if (kind === 'buggy') {
    // buggy de praia: banheira aberta, santantônio e rodão
    L = 3.6; Wd = 1.8; wr = 0.42;
    const by = wr + 0.25;
    g.add(part(box, paint, Wd * 0.92, 0.45, L * 0.82, 0, by, 0));
    g.add(part(box, paint, Wd * 0.8, 0.25, L * 0.3, 0, by + 0.3, L * 0.3));
    g.add(part(box, mat('#3b2a1e', { roughness: 0.8 }), Wd * 0.7, 0.35, 0.5, 0, by + 0.35, -0.35));  // bancos
    const bar = mat('#d8d8d8', { metalness: 0.8, roughness: 0.3 });
    for (const sx of [-1, 1]) g.add(part(box, bar, 0.07, 1.0, 0.07, sx * Wd * 0.4, by + 0.7, -0.75));
    g.add(part(box, bar, Wd * 0.87, 0.07, 0.07, 0, by + 1.2, -0.75));
    g.add(part(box, glass, Wd * 0.75, 0.32, 0.04, 0, by + 0.55, 0.45));                      // para-brisa
    for (const s of [-1, 1]) {
      g.add(part(box, head, 0.22, 0.22, 0.06, s * Wd * 0.3, by + 0.2, L * 0.41 + 0.01));
      g.add(part(box, tail, 0.2, 0.12, 0.06, s * Wd * 0.33, by + 0.1, -L * 0.41 - 0.01));
    }
  } else if (kind === 'moto') {
    // moto 160 com piloto de capacete; metade é motoboy com baú de entrega
    L = 2.0; Wd = 0.78; wr = 0.3;
    const blackM = mat('#151515', { roughness: 0.6 });
    g.add(solid(bake([
      [box, [0.26, 0.24, 0.55], [0, 0.78, 0.12]], [box, [0.2, 0.2, 0.5], [0, 0.6, -0.3]],
      [tankGeo, [0.17, 0.12, 0.27], [0, 0.97, 0.3]],                                         // tanque arredondado
      [box, [0.3, 0.3, 0.08], [0, 1.02, 0.7], [-0.45, 0, 0]],                               // carenagem do farol
      [box, [0.12, 0.025, 0.42], [0, 0.66, 0.74], [0.25, 0, 0]],                            // para-lama da frente
      [box, [0.15, 0.025, 0.36], [0, 0.66, -0.66], [-0.35, 0, 0]],                          // para-lama de trás
      [box, [0.27, 0.15, 0.32], [0, 0.82, -0.28]],                                           // tampas laterais
    ]), paint));
    g.add(solid(bake([
      [box, [0.24, 0.1, 0.62], [0, 0.92, -0.2]],                                             // banco
      [box, [0.12, 0.35, 0.3], [0, 0.48, 0.0]],                                              // motor
      [box, [0.62, 0.04, 0.04], [0, 1.12, 0.62]], [box, [0.06, 0.12, 0.06], [0, 1.05, 0.62]], // guidão
    ]), blackM));
    g.add(solid(bake([
      [box, [0.04, 0.62, 0.04], [0.09, 0.62, 0.72], [-0.3, 0, 0]], [box, [0.04, 0.62, 0.04], [-0.09, 0.62, 0.72], [-0.3, 0, 0]], // garfo
      [box, [0.07, 0.07, 0.6], [0.16, 0.42, -0.35], [0.12, 0, 0]],                          // escapamento
    ]), CHROME));
    g.add(part(box, head, 0.16, 0.12, 0.05, 0, 1.0, 0.78));
    g.add(part(box, tail, 0.14, 0.06, 0.04, 0, 0.82, -0.62));
    if (Math.random() < 0.5) {
      const bau = mat(['#e63946', '#2a9d8f', '#f2b705', '#1d3557'][Math.floor(Math.random() * 4)], { roughness: 0.5 });
      g.add(part(box, bau, 0.45, 0.4, 0.42, 0, 1.2, -0.52));
    }
    const rider = makePerson({ helmet: true });
    rider.position.set(0, 0.07, -0.16); // quadril na altura do banco
    const u = rider.userData;
    u.legL.rotation.set(-1.45, 0, 0.12); u.legR.rotation.set(-1.45, 0, -0.12);
    u.kneeL.rotation.x = 1.5; u.kneeR.rotation.x = 1.5;
    u.armL.rotation.x = -1.05; u.armR.rotation.x = -1.05; u.elbowL.rotation.x = -0.35; u.elbowR.rotation.x = -0.35;
    u.seated = true;
    g.add(rider);
    g.userData.rider = rider;
  } else if (kind === 'bike') {
    // bicicleta de entregador: quadro fino, guidão, banco e entregador com a bag térmica nas costas
    L = 1.75; Wd = 0.6; wr = 0.34;
    const frame = mat(color, { metalness: 0.4, roughness: 0.4 }), blackM = mat('#151515', { roughness: 0.6 });
    g.add(solid(bake([
      [box, [0.05, 0.05, 0.72], [0, 0.72, 0.08], [0.18, 0, 0]],      // tubo de cima
      [box, [0.05, 0.05, 0.78], [0, 0.52, 0.12], [-0.62, 0, 0]],     // tubo de baixo
      [box, [0.05, 0.6, 0.05], [0, 0.6, -0.2], [-0.25, 0, 0]],       // tubo do banco
      [box, [0.04, 0.04, 0.55], [0.06, 0.36, -0.42]], [box, [0.04, 0.04, 0.55], [-0.06, 0.36, -0.42]], // garfo de trás
      [box, [0.04, 0.6, 0.04], [0, 0.64, 0.6], [-0.3, 0, 0]],        // garfo da frente
    ]), frame));
    g.add(solid(bake([
      [box, [0.16, 0.06, 0.26], [0, 0.95, -0.27]],                   // banco
      [box, [0.56, 0.035, 0.035], [0, 1.02, 0.66]],                  // guidão
      [box, [0.2, 0.2, 0.05], [0, 0.34, -0.02]],                     // coroa
    ]), blackM));
    const rider = makePerson({ helmet: Math.random() < 0.5, longSleeve: false, shirt: pick(['#e63946', '#f2b705', '#2a9d8f', '#1d3557', '#ff6a13']) });
    rider.position.set(0, 0.12, -0.2);
    const u = rider.userData;
    u.legL.rotation.set(-1.0, 0, 0.08); u.legR.rotation.set(-1.0, 0, -0.08); u.kneeL.rotation.x = 1.2; u.kneeR.rotation.x = 1.2;
    u.armL.rotation.x = -1.15; u.armR.rotation.x = -1.15; u.elbowL.rotation.x = -0.3; u.elbowR.rotation.x = -0.3;
    u.upper.rotation.x = 0.35; u.seated = true;
    // bag térmica de entrega nas costas
    const bag = new THREE.Mesh(box, mat(pick(['#e63946', '#f2b705', '#2a9d8f', '#ff6a13', '#1d3557']), { roughness: 0.55 }));
    bag.scale.set(0.42, 0.42, 0.3); bag.position.set(0, 1.25, -0.3); bag.castShadow = true; u.upper.add(bag);
    g.add(rider);
    g.userData.rider = rider;
  } else {
    const suv = kind === 'suv' || kind === 'police';
    const type = suv ? 'suv' : Math.random() < 0.5 ? 'sedan' : 'car';
    L = suv ? 4.6 : type === 'sedan' ? 4.4 : 4.2; Wd = suv ? 1.95 : 1.8; wr = suv ? 0.38 : 0.33;
    const G = bodyGeos(type, L, Wd, wr);
    g.add(solid(G.paint, paint), solid(G.cabin, glassMat), solid(G.trim, trim), solid(G.chrome, CHROME, false),
      solid(G.head, head, false), solid(G.tail, tail, false), solid(G.plates, plateMat(), false));
    if (kind === 'police') {
      // faixa azul, "POLÍCIA" nas portas e giroflex
      g.add(part(box, mat('#1b3a8a', { roughness: 0.4 }), Wd + 0.03, 0.18, L * 0.86, 0, 0.78, 0));
      const roofY = G.beltY + G.cabH + 0.06;
      g.add(part(box, dark, 1.3, 0.1, 0.32, 0, roofY + 0.05, G.roofMid));
      g.add(part(box, SIREN.red, 0.6, 0.16, 0.3, -0.33, roofY + 0.17, G.roofMid));
      g.add(part(box, SIREN.blue, 0.6, 0.16, 0.3, 0.33, roofY + 0.17, G.roofMid));
      for (const s of [-1, 1]) {
        const label = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.38), policeLabel());
        label.position.set(s * (Wd / 2 + 0.03), 0.6, 0.1);
        label.rotation.y = s * Math.PI / 2;
        g.add(label);
      }
    }
  }
  const wheels = [];
  const tire = mat('#1a1a1a', { roughness: 0.95 });
  const rim = mat('#c9ccd0', { metalness: 0.9, roughness: 0.3 });
  const moto = kind === 'moto' || kind === 'bike';
  for (const sz of [1, -1]) for (const sx of moto ? [1] : [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(moto ? 0 : sx * (Wd / 2 - 0.13), wr, sz * L * (moto ? 0.36 : 0.31));
    const w = new THREE.Group();
    w.scale.set(1, wr, wr);
    const t = new THREE.Mesh(tireGeo, tire); t.castShadow = true;
    const r = new THREE.Mesh(rimGeo, rim); r.position.x = sx * 0.1;
    w.add(t, r);
    if (moto) { w.scale.x = kind === 'bike' ? 0.22 : 0.45; const r2 = new THREE.Mesh(rimGeo, rim); r2.position.x = -0.1; w.add(r2); }
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, w, front: sz === 1 });
  }
  g.userData = { ...g.userData, model: true, L, W: Wd, wheels, kind, spin: 0, stats: { ...(STATS[kind] || STATS.car) } };
  return g;
}

// desempenho de cada tipo: velocidade máxima (m/s), aceleração e esterço
export const STATS = {
  car: { vmax: 36, accel: 9.5, turn: 1 },
  suv: { vmax: 34, accel: 8.5, turn: 0.95 },
  police: { vmax: 40, accel: 11, turn: 1 },
  bus: { vmax: 20, accel: 4, turn: 0.6 },
  sport: { vmax: 54, accel: 15, turn: 1.1 },
  buggy: { vmax: 33, accel: 12, turn: 1.3 },
  moto: { vmax: 38, accel: 13, turn: 1.25 },
  bike: { vmax: 11, accel: 5, turn: 1.45 },
};

// faróis e lanternas compartilhados: acendem à noite
const HEAD = mat('#fffbe8', { emissive: '#fff3c4', emissiveIntensity: 0.6 });
const TAIL = mat('#b3121b', { emissive: '#ff1020', emissiveIntensity: 0.4 });
export function setVehicleLights(n) {
  HEAD.emissiveIntensity = 0.6 + n * 5;
  TAIL.emissiveIntensity = 0.4 + n * 2.5;
}

// materiais do giroflex são compartilhados: todas as viaturas piscam juntas
export const SIREN = {
  red: new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff0000', emissiveIntensity: 0 }),
  blue: new THREE.MeshStandardMaterial({ color: '#2a5bff', emissive: '#0040ff', emissiveIntensity: 0 }),
  update(t, on) {
    const phase = Math.floor(t * 6) % 2;
    this.red.emissiveIntensity = on && phase === 0 ? 4 : 0.1;
    this.blue.emissiveIntensity = on && phase === 1 ? 4 : 0.1;
  },
};
let labelMat;
function policeLabel() {
  if (labelMat) return labelMat;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 52;
  const g = c.getContext('2d');
  g.fillStyle = '#1b3a8a'; g.fillRect(0, 0, 256, 52);
  g.fillStyle = '#fff'; g.font = 'bold 34px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('POLÍCIA', 128, 28);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (labelMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
}

export function animateVehicle(v, speed, steer, dt) {
  const u = v.userData;
  // veículo sem rodas (modelo de outro módulo, ou userData trocado): só não gira roda nenhuma
  const wheels = u.wheels || [];
  u.spin = (u.spin || 0) + (speed * dt) / (wheels[0]?.w.scale.y || 0.33);
  for (const wh of wheels) {
    wh.w.rotation.x = u.spin;
    if (wh.front) wh.pivot.rotation.y = steer * 0.45;
  }
  if (u.kind === 'bike' && u.rider) {
    // pedalando: as pernas giram com a roda (rodam mais devagar que a roda)
    const r = u.rider.userData, a = u.spin * 0.45;
    r.legL.rotation.x = -1.0 + Math.sin(a) * 0.35; r.legR.rotation.x = -1.0 - Math.sin(a) * 0.35;
    r.kneeL.rotation.x = 1.2 - Math.cos(a) * 0.35; r.kneeR.rotation.x = 1.2 + Math.cos(a) * 0.35;
  }
  if (u.kind === 'moto' || u.kind === 'bike') { const lean = steer * 0.35 * Math.min(1, Math.abs(speed) / 8); v.rotation.z += (lean - v.rotation.z) * Math.min(1, dt * 6); }
}

const SKIN = ['#f3cfae', '#e0ad86', '#c48a60', '#9a6542', '#6e4630', '#4a2f22', '#e8bb93'];
const SHIRT = ['#e63946', '#1d3557', '#f4a261', '#2a9d8f', '#f4f4f2', '#1a1a1a', '#e9c46a', '#6c757d', '#ff006e', '#3a86ff', '#c1121f', '#06d6a0', '#b5838d', '#9aa5b1'];
const PANTS = ['#2b3e5c', '#34495e', '#1f1f22', '#5b4a3a', '#cfc6b6', '#3b5b84', '#4a4e57'];
const HAIR = ['#1b1209', '#2e1d10', '#0d0d0d', '#5a3a1e', '#a77b4f', '#2a1a12'];
const SHOES = ['#f2f2f0', '#1c1c1c', '#3a3a3a', '#c1121f', '#1d3557', '#f2f2f0'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ----- corpo humano: perfis torneados (raio, altura) girados em volta do eixo, depois achatados
const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const torsoGeo = (() => {
  const t = lathe([[0, 0.93], [0.15, 0.935], [0.162, 1.0], [0.152, 1.1], [0.166, 1.22], [0.186, 1.34], [0.194, 1.42], [0.165, 1.49], [0.075, 1.545], [0, 1.55]], 18);
  t.scale(1.05, 1, 0.64);
  const caps = [-1, 1].map((sx) => new THREE.SphereGeometry(0.06, 10, 8).scale(1, 0.95, 0.9).translate(sx * 0.19, 1.45, 0));
  return bake([[t, [1, 1, 1], [0, 0, 0]], ...caps.map((c) => [c, [1, 1, 1], [0, 0, 0]])]);
})();
const hipGeo = (() => { const t = lathe([[0, 0.855], [0.15, 0.86], [0.165, 0.93], [0.158, 1.02], [0, 1.03]], 16); t.scale(1.1, 1, 0.72); return t; })();
// corpo de mulher: ombro mais estreito, cintura marcada e quadril mais largo
const torsoFemGeo = (() => {
  const t = lathe([[0, 0.93], [0.158, 0.935], [0.158, 1.0], [0.13, 1.12], [0.15, 1.24], [0.165, 1.33], [0.17, 1.42], [0.15, 1.49], [0.07, 1.545], [0, 1.55]], 18);
  t.scale(1.05, 1, 0.66);
  const caps = [-1, 1].map((sx) => new THREE.SphereGeometry(0.052, 10, 8).scale(1, 0.95, 0.9).translate(sx * 0.172, 1.45, 0));
  return bake([[t, [1, 1, 1], [0, 0, 0]], ...caps.map((c) => [c, [1, 1, 1], [0, 0, 0]])]);
})();
const hipFemGeo = (() => { const t = lathe([[0, 0.855], [0.165, 0.86], [0.185, 0.93], [0.165, 1.02], [0, 1.03]], 16); t.scale(1.1, 1, 0.78); return t; })();
// saia (do quadril até o joelho) e pé descalço do chinelo
const skirtGeo = new THREE.CylinderGeometry(0.175, 0.255, 0.44, 16, 1, true).scale(1.05, 1, 0.8).translate(0, 0.72, 0);
const footGeo = (() => { const t = new THREE.CapsuleGeometry(0.042, 0.13, 4, 8); t.rotateX(Math.PI / 2); t.scale(1.05, 0.55, 1); return t; })();
const flipSoleGeo = new THREE.BoxGeometry(0.1, 0.018, 0.25);
const strapGeo = new THREE.TorusGeometry(0.035, 0.007, 4, 10, Math.PI).rotateX(-Math.PI / 2 + 0.3);
const thighGeo = lathe([[0, 0.02], [0.074, 0], [0.087, -0.07], [0.079, -0.2], [0.063, -0.4], [0.056, -0.44], [0, -0.46]]);
const shinGeo = lathe([[0, 0.02], [0.056, 0], [0.064, -0.1], [0.052, -0.26], [0.04, -0.38], [0, -0.41]]);
const upperArmGeo = lathe([[0, 0.03], [0.05, 0], [0.054, -0.08], [0.044, -0.27], [0, -0.3]], 12);
const foreArmGeo = lathe([[0, 0.02], [0.043, 0], [0.045, -0.06], [0.032, -0.24], [0, -0.26]], 12);
const handGeo = bake([
  [new THREE.SphereGeometry(1, 10, 8), [0.04, 0.062, 0.022], [0, -0.035, 0]],
  [new THREE.SphereGeometry(1, 8, 6), [0.014, 0.03, 0.014], [0.036, -0.02, 0.012], [0, 0, -0.5]],
]);
const hoodGeo = new THREE.TorusGeometry(0.1, 0.045, 8, 16, Math.PI * 1.25).rotateX(Math.PI / 2 + 0.25).rotateY(Math.PI * 0.125 + Math.PI / 2).scale(1.15, 1, 0.9).translate(0, 1.53, -0.04);
const pocketGeo = new THREE.BoxGeometry(0.22, 0.12, 0.014).translate(0, 1.1, 0.098);
const shoeGeo = (() => { const t = new THREE.CapsuleGeometry(0.052, 0.15, 4, 10); t.rotateX(Math.PI / 2); t.scale(1.15, 0.85, 1); return t; })();
const soleGeo = new THREE.BoxGeometry(0.115, 0.03, 0.27);
// cabeça: crânio + queixo + orelhas + nariz + pescoço numa peça só (cor de pele)
const headSkinGeo = bake([
  [new THREE.SphereGeometry(0.104, 20, 16), [0.95, 1.1, 1.0], [0, 0.01, 0]],
  [new THREE.SphereGeometry(0.08, 14, 10), [0.88, 0.8, 0.95], [0, -0.05, 0.022]],
  [new THREE.SphereGeometry(0.03, 8, 6), [0.32, 0.6, 0.5], [-0.099, -0.005, -0.005]],
  [new THREE.SphereGeometry(0.03, 8, 6), [0.32, 0.6, 0.5], [0.099, -0.005, -0.005]],
  [new THREE.SphereGeometry(0.022, 8, 6), [0.55, 0.85, 0.75], [0, -0.012, 0.1]],
  [new THREE.CylinderGeometry(0.045, 0.052, 0.13, 10), [1, 1, 1], [0, -0.14, -0.01]],
]);
// olhos (branco + íris) e sobrancelhas, com cor por vértice
const faceGeo = (() => {
  const parts = [];
  const col = (geo, c) => { const g = geo.toNonIndexed(); const n = g.attributes.position.count, a = new Float32Array(n * 3); const cc = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([cc.r, cc.g, cc.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
  for (const sx of [-1, 1]) {
    parts.push(col(new THREE.SphereGeometry(0.015, 8, 6).scale(1.2, 0.8, 0.6).translate(sx * 0.037, 0.016, 0.092), '#f4f1ea'));
    parts.push(col(new THREE.SphereGeometry(0.0085, 8, 6).scale(1, 1, 0.5).translate(sx * 0.037, 0.016, 0.1), '#2a1b12'));
    parts.push(col(new THREE.BoxGeometry(0.036, 0.008, 0.01).rotateZ(sx * -0.12).translate(sx * 0.038, 0.042, 0.097), '#1d140e'));
  }
  parts.push(col(new THREE.BoxGeometry(0.034, 0.006, 0.008).translate(0, -0.052, 0.094), '#8a4a3e')); // boca
  return mergeGeometries(parts);
})();
const faceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
// cabelos (centro = centro da cabeça)
const HAIRS = {
  short: () => bake([[new THREE.SphereGeometry(0.108, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), [0.98, 1.06, 1.05], [0, 0.02, -0.012], [-0.38, 0, 0]],
    [new THREE.SphereGeometry(0.1, 14, 8), [0.95, 0.75, 0.6], [0, -0.01, -0.05]]]),
  buzz: () => bake([[new THREE.SphereGeometry(0.105, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), [0.97, 1.05, 1.03], [0, 0.016, -0.008], [-0.4, 0, 0]]]),
  curly: () => {
    const items = [[new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), [1, 1.08, 1.05], [0, 0.022, -0.014], [-0.35, 0, 0]]];
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2 * 2.3, el = 0.25 + (k % 5) * 0.16;
      const z = Math.sin(a) * Math.cos(el) * 0.11 - 0.01; if (z > 0.06 && el < 0.6) continue;
      items.push([new THREE.SphereGeometry(0.04, 8, 6), [1, 1, 1], [Math.cos(a) * Math.cos(el) * 0.11, 0.03 + Math.sin(el) * 0.1, z]]);
    }
    return bake(items);
  },
  long: () => bake([[new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), [1, 1.07, 1.06], [0, 0.02, -0.012], [-0.35, 0, 0]],
    [new THREE.CapsuleGeometry(0.075, 0.2, 4, 10), [1.35, 1, 0.55], [0, -0.1, -0.06]]]),
  bun: () => bake([[new THREE.SphereGeometry(0.108, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), [0.98, 1.06, 1.05], [0, 0.02, -0.012], [-0.38, 0, 0]],
    [new THREE.SphereGeometry(0.045, 10, 8), [1, 1, 1], [0, 0.1, -0.075]]]),
  // black power: volume redondo em volta da cabeça, deixando o rosto livre
  afro: () => bake([[new THREE.SphereGeometry(0.15, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), [1.02, 0.95, 0.95], [0, 0.035, -0.04], [-0.5, 0, 0]],
    [new THREE.SphereGeometry(0.12, 14, 10), [1.1, 0.9, 0.7], [0, 0.0, -0.085]]]),
  // tranças: touca rente e várias tranças finas caindo nas costas
  trancas: () => {
    const items = [[new THREE.SphereGeometry(0.108, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), [0.99, 1.06, 1.05], [0, 0.02, -0.012], [-0.38, 0, 0]]];
    for (let k = 0; k < 13; k++) { const a = Math.PI * (0.15 + (k / 12) * 0.7); items.push([new THREE.CylinderGeometry(0.011, 0.008, 0.34, 5), [1, 1, 1], [Math.cos(a) * 0.095, -0.12, -Math.sin(a) * 0.07 - 0.03], [0.12, 0, (Math.cos(a)) * 0.15]]); }
    return bake(items);
  },
  // rabo de cavalo
  rabo: () => bake([[new THREE.SphereGeometry(0.108, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), [0.99, 1.06, 1.05], [0, 0.02, -0.012], [-0.38, 0, 0]],
    [new THREE.SphereGeometry(0.03, 8, 6), [1, 1, 1], [0, 0.04, -0.105]], [new THREE.CapsuleGeometry(0.035, 0.16, 4, 8), [1, 1, 0.8], [0, -0.06, -0.125], [0.25, 0, 0]]]),
};
// barba (mesma cor do cabelo), centro = centro da cabeça
const beardGeo = bake([[new THREE.SphereGeometry(0.085, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), [0.92, 0.9, 0.98], [0, -0.035, 0.024]]]);
const hairCache = {};
const hairGeo = (k) => (hairCache[k] ||= HAIRS[k]());
// jeans: sarja azul com ruído
let denimTex;
function denim() {
  if (denimTex) return denimTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = ((x + y) % 4 < 2 ? 0.88 : 1) - Math.random() * 0.12;
    g.fillStyle = `rgba(0,0,0,${1 - v})`; g.fillRect(x, y, 1, 1);
  }
  denimTex = new THREE.CanvasTexture(c); denimTex.wrapS = denimTex.wrapT = THREE.RepeatWrapping; denimTex.repeat.set(4, 6); denimTex.colorSpace = THREE.SRGBColorSpace;
  return denimTex;
}
const clothMats = new Map();
function cloth(color, jeans) {
  const k = color + (jeans ? 'j' : '');
  if (!clothMats.has(k)) clothMats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.9, map: jeans ? denim() : null }));
  return clothMats.get(k);
}
const stripeMats = new Map();
function stripedMat(colors, vertical = false) {
  const key = colors.join(',') + (vertical ? '|v' : '');
  if (!stripeMats.has(key)) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 64;
    const g = c.getContext('2d');
    const bands = colors.length * 3;
    if (vertical) { c.width = 64; c.height = 16; for (let i = 0; i < bands * 2; i++) { g.fillStyle = colors[i % colors.length]; g.fillRect((i * 64) / (bands * 2), 0, 64 / (bands * 2) + 1, 16); } }
    else for (let i = 0; i < bands; i++) { g.fillStyle = colors[i % colors.length]; g.fillRect(0, (i * 64) / bands, 16, 64 / bands + 1); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    stripeMats.set(key, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
  }
  return stripeMats.get(key);
}

// Pessoa. Sem opções, sorteia um recifense comum: homem, mulher ou idoso; camisa, regata, camisa de time (Sport,
// Náutico, Santa Cruz) ou moletom; calça, bermuda, saia ou vestido; tênis ou chinelo de dedo; cabelo de vários tipos.
// Quem passa roupa (uniforme, frevo, flanelinha…) fica com ela: o sorteio só preenche o que não veio.
// opts.player: figura fixa/jogador (corpo padrão, sem sorteio de roupa).
const TIMES = [['#c8102e', '#111111'], ['#c8102e', '#f4f4f2', 'v'], ['#111111', '#f4f4f2', '#c8102e']]; // Sport, Náutico, Santa Cruz
const CHINELO = ['#1d5fa8', '#f2c230', '#2a9d58', '#e63946', '#f4f4f2', '#111111'];
const roll = (w) => { let t = Math.random() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) if ((t -= v) < 0) return k; return Object.keys(w)[0]; };
export function makePerson(opts = {}) {
  const g = new THREE.Group();
  const fixed = !!opts.player;
  const tipo = opts.tipo || (fixed ? 'homem' : roll({ homem: 46, mulher: 44, idoso: 10 }));
  const fem = tipo === 'mulher' || (tipo === 'idoso' && (opts.fem ?? Math.random() < 0.5));
  const skin = mat(opts.skin || pick(SKIN), { roughness: 0.55 });
  // parte de cima
  const top = opts.top || (opts.stripes || opts.shirt || fixed ? 'camisa' : opts.longSleeve ? 'manga' : roll({ camisa: 46, regata: 20, time: 14, ...(opts.longSleeve === false ? {} : { manga: 10 }), ...(fem ? { vestido: 14 } : {}) }));
  const time = top === 'time' ? (opts.time != null ? TIMES[opts.time] : pick(TIMES)) : null; // opts.time: 0 Sport, 1 Náutico, 2 Santa Cruz
  const shirt = opts.stripes ? stripedMat(opts.stripes) : time ? stripedMat(time.filter((c) => c !== 'v'), time.includes('v')) : cloth(opts.shirt || pick(SHIRT));
  // parte de baixo
  const bottom = top === 'vestido' ? 'vestido' : opts.bottom || (opts.pants || fixed ? 'calca' : roll({ calca: 40, bermuda: 40, ...(fem ? { saia: 22 } : {}) }));
  const pc = opts.pants || pick(PANTS);
  const pants = cloth(pc, opts.jeans ?? (/^#(2b3e5c|3b5b84|34495e)$/.test(pc)));
  const longSleeve = top === 'manga' || (opts.longSleeve ?? false);
  const chinelo = !opts.shoes && !fixed && !opts.helmet && Math.random() < (bottom === 'calca' ? 0.12 : 0.45);
  const shoeM = mat(opts.shoes || pick(SHOES), { roughness: 0.55 }), soleM = mat('#ecebe6', { roughness: 0.8 });
  const mesh = (geo, m, y = 0, shadow = true) => { const x = new THREE.Mesh(geo, m); x.position.y = y; x.castShadow = shadow; return x; };
  // membro de dois segmentos: pivô de cima (quadril/ombro) com o de baixo (joelho/cotovelo) pendurado
  const limb = (parent, x, y, g1, m1, len, g2, m2, end) => {
    const top = new THREE.Group(); top.position.set(x, y, 0);
    const mid = new THREE.Group(); mid.position.y = -len;
    top.add(mesh(g1, m1)); mid.add(mesh(g2, m2));
    if (end) for (const e of end) mid.add(e);
    top.add(mid); parent.add(top);
    return [top, mid];
  };
  const foot = () => {
    if (chinelo) { // chinelo de dedo: pé de fora, sola colorida fininha e a tira
      const sm = mat(pick(CHINELO), { roughness: 0.7 });
      const ft = mesh(footGeo, skin, 0, false); ft.position.set(0, -0.392, 0.04);
      const so = mesh(flipSoleGeo, sm, 0, false); so.position.set(0, -0.422, 0.045);
      const st = mesh(strapGeo, sm, 0, false); st.position.set(0, -0.395, 0.08);
      return [ft, so, st];
    }
    const sh = mesh(shoeGeo, shoeM, 0, false); sh.position.set(0, -0.385, 0.045);
    const so = mesh(soleGeo, soleM, 0, false); so.position.set(0, -0.415, 0.045);
    return [sh, so];
  };
  const hand = () => { const h = mesh(handGeo, skin, -0.26, false); return [h]; };
  // pernas: calça cobre tudo; bermuda deixa a canela de fora; saia e vestido deixam a perna de fora
  const dress = top === 'vestido' ? cloth(opts.shirt || pick(['#e63946', '#f4a261', '#2a9d8f', '#ffd166', '#f4f4f2', '#8338ec', '#ff006e', '#3a86ff'])) : null;
  const thighM = bottom === 'calca' || bottom === 'bermuda' ? pants : skin, shinM = bottom === 'calca' ? pants : skin;
  const [legL, kneeL] = limb(g, -0.095, 0.92, thighGeo, thighM, 0.44, shinGeo, shinM, foot());
  const [legR, kneeR] = limb(g, 0.095, 0.92, thighGeo, thighM, 0.44, shinGeo, shinM, foot());
  const skirtM = bottom === 'vestido' ? dress : bottom === 'saia' ? cloth(pick(['#1f1f22', '#2b3e5c', '#5b4a3a', '#c1121f', '#cfc6b6', '#6c757d'])) : null;
  g.add(mesh(fem ? hipFemGeo : hipGeo, skirtM || pants));
  if (skirtM) g.add(mesh(skirtGeo, skirtM));
  // tronco pra cima num grupo só: balança e sobe/desce no passo
  const upper = new THREE.Group();
  g.add(upper);
  const topM = dress || shirt;
  upper.add(mesh(fem ? torsoFemGeo : torsoGeo, topM));
  const fore = longSleeve ? shirt : skin;
  if (longSleeve && !opts.stripes && !time) upper.add(mesh(hoodGeo, shirt), mesh(pocketGeo, shirt, 0, false)); // moletom: capuz e bolso canguru
  const sleeve = top === 'regata' || top === 'vestido' ? skin : shirt; // regata e vestido: braço de fora
  const sx = fem ? 0.178 : 0.195;
  const [armL, elbowL] = limb(upper, -sx, 1.45, upperArmGeo, sleeve, 0.29, foreArmGeo, fore, hand());
  const [armR, elbowR] = limb(upper, sx, 1.45, upperArmGeo, sleeve, 0.29, foreArmGeo, fore, hand());
  armL.rotation.z = -0.07; armR.rotation.z = 0.07;
  const head = new THREE.Group(); head.position.y = 1.69;
  head.add(mesh(headSkinGeo, skin), mesh(faceGeo, faceMat, 0, false));
  // cabelo: idoso grisalho; mulher e homem com estilos diferentes
  const hairC = opts.hairColor || (tipo === 'idoso' ? pick(['#bdbab3', '#d9d6cf', '#8c8a85', '#efece6']) : pick(HAIR));
  const hairK = opts.hair || (fem ? roll({ long: 26, bun: 16, rabo: 18, trancas: 14, afro: 12, curly: 14 }) : roll({ short: 34, buzz: 24, curly: 14, afro: 8, careca: tipo === 'idoso' ? 30 : 8 }));
  if (opts.helmet) {
    head.add(part(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(pick(['#111111', '#c8102e', '#f2f2f0', '#1d3557']), { metalness: 0.3, roughness: 0.25 }), 1, 1.05, 1.08, 0, -0.01, -0.005));
    head.add(part(box, mat('#1a2229', { metalness: 0.7, roughness: 0.1 }), 0.2, 0.08, 0.04, 0, 0.0, 0.135));
  } else if (!opts.hat) {
    if (hairK !== 'careca') head.add(mesh(hairGeo(hairK), mat(hairC, { roughness: 0.75 })));
  } else head.add(mesh(hairGeo('buzz'), mat(hairC, { roughness: 0.75 })));
  if (!fem && !opts.helmet && !fixed && Math.random() < (tipo === 'idoso' ? 0.35 : 0.2)) head.add(mesh(beardGeo, mat(hairC, { roughness: 0.85 }), 0, false));
  upper.add(head);
  if (opts.hat) upper.add(makeHat(opts.hat));
  if (opts.glasses) upper.add(part(box, mat('#0c0c0c', { metalness: 0.6, roughness: 0.2 }), 0.2, 0.04, 0.02, 0, 1.706, 0.112));
  if (opts.hand === 'sombrinha') upper.add(makeSombrinha());
  // cada pessoa um pouco diferente na altura e no porte (mulher um pouco mais baixa; idoso um pouco curvado)
  const hgt = fixed ? 1 : (fem ? 0.9 : 0.95) + Math.random() * 0.11, build = fixed ? 1 : (fem ? 0.9 : 0.94) + Math.random() * 0.18;
  g.scale.set(build * hgt, hgt, Math.min(1.1, build) * hgt);
  g.userData = { model: true, legL, legR, kneeL, kneeR, armL, armR, elbowL, elbowR, upper, head, phase: Math.random() * 6, tipo, stoop: tipo === 'idoso' ? 0.12 : 0 };
  if (tipo === 'idoso') upper.rotation.x = 0.12;
  return g;
}

function makeHat(kind) {
  const h = new THREE.Group();
  if (kind === 'bone') {
    const c = mat('#1d3557');
    h.add(part(new THREE.SphereGeometry(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), c, 1, 0.8, 1, 0, 1.75, 0));
    h.add(part(box, c, 0.22, 0.02, 0.14, 0, 1.76, 0.17));
  } else if (kind === 'cangaceiro') {
    // chapéu de couro em meia-lua com a estrela de seis pontas em metal na frente
    const leather = mat('#6b4423', { roughness: 0.8 });
    h.add(part(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), leather, 1, 0.9, 1, 0, 1.76, 0));
    const moon = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 24, 1, false, -Math.PI / 2, Math.PI), leather);
    moon.rotation.x = Math.PI / 2;
    moon.position.set(0, 1.74, 0.11);
    moon.castShadow = true;
    h.add(moon);
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.06, 6), mat('#d4a73a', { metalness: 0.9, roughness: 0.25 }));
    star.position.set(0, 1.9, 0.135);
    h.add(star);
    h.add(part(box, mat('#d4a73a', { metalness: 0.9, roughness: 0.25 }), 0.5, 0.025, 0.045, 0, 1.76, 0.12));
  }
  return h;
}

function makeSombrinha() {
  // sombrinha de frevo: pequena e com gomos coloridos
  const cols = ['#e63946', '#ffd166', '#2a9d8f', '#3a86ff', '#ff7b3a', '#8338ec', '#06d6a0', '#ff006e'].map((c) => new THREE.Color(c));
  const geo = new THREE.ConeGeometry(0.42, 0.16, 8, 1, true).toNonIndexed();
  const colors = new Float32Array(geo.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length / 9; i++) {
    const c = cols[i % 8];
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i * 3 + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const top = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }));
  top.position.y = 0.55;
  top.castShadow = true;
  g.add(top, part(box, mat('#333'), 0.02, 0.6, 0.02, 0, 0.25, 0));
  g.position.set(0.3, 1.45, 0.12);
  g.rotation.z = -0.25;
  return g;
}

// passo: coxa balança, joelho dobra quando a perna vem pra frente, braço oposto, tronco sobe e gira
export function animatePerson(p, speed, dt) {
  const u = p.userData;
  if (u.seated) return;
  u.phase += speed * dt * (speed > 6 ? 2.0 : 2.6);
  const run = Math.min(1, Math.max(0, (speed - 4.5) / 3));
  const amp = Math.min(0.6 + run * 0.35, speed * 0.26);
  const ph = u.phase, s = Math.sin(ph), c = Math.cos(ph);
  u.legL.rotation.x = s * amp; u.legR.rotation.x = -s * amp;
  u.kneeL.rotation.x = amp * (0.25 + 1.1 * Math.max(0, -c)) * (0.8 + run);
  u.kneeR.rotation.x = amp * (0.25 + 1.1 * Math.max(0, c)) * (0.8 + run);
  u.armL.rotation.x = -s * amp * 0.85; u.armR.rotation.x = s * amp * 0.85;
  u.elbowL.rotation.x = -(0.2 + amp * 0.5 + run * 0.9); u.elbowR.rotation.x = -(0.2 + amp * 0.5 + run * 0.9);
  u.upper.position.y = Math.abs(Math.sin(ph)) * 0.035 * amp - amp * 0.02;
  u.upper.rotation.y = s * 0.12 * amp;
  u.upper.rotation.x = run * 0.12 + (u.stoop || 0);
  if (u.head) u.head.rotation.y = -u.upper.rotation.y * 0.8; // a cabeça olha pra frente
}
