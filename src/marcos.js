// Prédios refeitos a partir de fotos: Museu do Homem do Nordeste, Fundação Joaquim Nabuco, Biblioteca Pública,
// hospitais (Restauração, Santa Joana, Memorial São José, Real Hospital Português), fachadas dos shoppings RioMar e
// Recife, o mastro da Ponte Estaiada da Via Mangue e o canal arborizado no meio da Av. Agamenon Magalhães.
// As fachadas são texturas desenhadas em canvas (uma "célula" de janela que se repete por andar e por vão).
import * as THREE from 'three';
import { Kit, obb, ringOf, inside } from './classics.js';
import { stampDisc } from './collide.js';
import { leafyTree } from './trees.js';
import { pruneEstadios } from './estadios.js';
import { infillCity } from './infill.js';

const BX = new THREE.BoxGeometry(1, 1, 1);

// nomes que deixam de ser caixa genérica (o modelo vem daqui)
export const MARCOS = ['Museu do Homem do Nordeste', 'Fundação Joaquim Nabuco', 'Biblioteca Pública do Estado de Pernambuco', 'Hospital da Restauração', 'Hospital Santa Joana Recife', 'Hospital Memorial São José', 'Real Hospital Português', 'Ponte Estaiada', 'Prefeitura da Cidade do Recife', 'Fórum Desembargador Rodolfo Aureliano', 'Shopping RioMar', 'Edificio Garagem do Shopping Riomar', 'Shopping Recife', 'Edificio Garagem - Shopping Recife', 'Museu Instituto Ricardo Brennand', 'Oficina Brennand', 'Accademia', 'Templo do Sacrificío', 'Terminal de Passageiros', 'Torre de Controle'];

// ---------------------------------------------------------------- antes dos prédios
// Praça do Arsenal: o quarteirão entre a R. Barão Rodrigues Mendes (frente do Paço do Frevo), a R. do Bom Jesus,
// a R. do Observatório e a R. da Guia (cantos tirados do traçado do OSM), puxado 6 m pra dentro por causa das pistas
const ARSENAL = [[3071, -4007], [3100, -3995], [3130, -3982], [3136, -4009], [3143, -4038], [3142, -4067], [3114, -4071], [3093, -4075], [3082, -4042], [3076, -4020]];
// antes da grade de colisão: tira as caixas de prédio que o OSM/gerador pôs dentro da Praça do Arsenal (é tudo praça)
export function pruneMarcos(data) {
  pruneEstadios(data); // largo de entrada dos estádios
  // Rua do Bom Jesus: paralelepípedo de parede a parede, sem calçada alta (como nas fotos). `cobble` faz o chão ser
  // de pedra (world.js) e a montagem da calçada pular a rua (rua.js)
  for (const rd of data.roads) if (rd.n === 'Rua do Bom Jesus') rd.cobble = 1;
  const r = ARSENAL, inside = (x, z) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [ax, az] = r[i], [bx, bz] = r[j]; if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) c = !c; } return c; };
  data.buildings = data.buildings.filter((b) => { if (b.n) return true; const cx = b.p.reduce((s, q) => s + q[0], 0) / b.p.length, cz = b.p.reduce((s, q) => s + q[1], 0) / b.p.length; return !inside(cx, cz); });
  // quarteirões que o OSM deixou vazios recebem casas e prédios gerados (uma vez só, antes da colisão)
  // ?semgerados na URL desliga (para medir o custo)
  const off = typeof location !== 'undefined' && new URLSearchParams(location.search).has('semgerados');
  if (!data.infilled && !off) {
    (data.noInfill ||= []).push(ARSENAL);
    // Instituto Ricardo Brennand: fica num parque de mata e gramado (sem casario gerado em volta)
    const bb = data.buildings.filter((b) => b.n === 'Museu Instituto Ricardo Brennand');
    if (bb.length) { const pts = bb.flatMap((b) => b.p), cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
      data.brennandC = [cx, cz]; data.noInfill.push(Array.from({ length: 24 }, (_, i) => [cx + Math.cos((i / 24) * Math.PI * 2) * 260, cz + Math.sin((i / 24) * Math.PI * 2) * 260])); }
    // Oficina Brennand: muralhas e pátio no meio da mata; nada de casa gerada nem de caixa sem nome lá dentro e em volta
    const of = data.buildings.find((b) => b.n === 'Oficina Brennand');
    if (of) { const q = obb(ringOf(of)), R = Math.max(q.len, q.wid) / 2 + 60;
      data.buildings = data.buildings.filter((b) => { if (b.n) return true; const cx = b.cx ?? b.p.reduce((a, p) => a + p[0], 0) / b.p.length, cz = b.cz ?? b.p.reduce((a, p) => a + p[1], 0) / b.p.length; return Math.hypot(cx - q.cx, cz - q.cz) > R; });
      data.noInfill.push(Array.from({ length: 24 }, (_, i) => [q.cx + Math.cos((i / 24) * Math.PI * 2) * (R + 80), q.cz + Math.sin((i / 24) * Math.PI * 2) * (R + 80)])); }
    infillCity(data);
  }
}
export function prepareMarcos(data) {
  pruneMarcos(data); // de novo: o casario gerado entra depois da grade de colisão
  { const cx = ARSENAL.reduce((s, p) => s + p[0], 0) / ARSENAL.length, cz = ARSENAL.reduce((s, p) => s + p[1], 0) / ARSENAL.length;
    data.arsenal = ARSENAL.map(([x, z]) => { const d = Math.hypot(x - cx, z - cz); return [x + ((cx - x) / d) * 7, z + ((cz - z) / d) * 7]; }); data.arsenalC = [cx, cz]; }
  const area = (b) => { const o = obb(ringOf(b)); return o.len * o.wid; };
  // hospitais que no OSM são só um ponto: pega a construção (a maior perto, ou a mais perto)
  const claim = (poi, name, R, pick) => {
    const p = data.pois.find((q) => q.name === poi); if (!p || data.buildings.some((b) => b.n === name)) return;
    let best = null, bv = -Infinity;
    for (const b of data.buildings) {
      if (b.n || b.p.length < 4 || Math.abs(b.cx - p.x) > R || Math.abs(b.cz - p.z) > R) continue;
      const d = Math.hypot(b.cx - p.x, b.cz - p.z); if (d > R) continue;
      const v = pick === 'largest' ? area(b) : -d;
      if (v > bv) { bv = v; best = b; }
    }
    if (best) best.n = name;
  };
  claim('Hospital da Restauração', 'Hospital da Restauração', 30, 'largest');
  claim('Hospital Memorial São José', 'Hospital Memorial São José', 30, 'largest');
  claim('Hospital Santa Joana Recife', 'Hospital Santa Joana Recife', 30, 'nearest');
  // Fórum Joana Bezerra (Fórum Des. Rodolfo Aureliano): o bloco grande ao lado do ponto do endereço
  if (!data.buildings.some((b) => b.n === 'Fórum Desembargador Rodolfo Aureliano')) {
    let best = null; for (const b of data.buildings) { if (b.n || Math.hypot(b.cx - 540, b.cz + 2990) > 90) continue; const a = area(b); if (a > 6000 && (!best || a > best.a)) best = { b, a }; }
    if (best) { best.b.n = 'Fórum Desembargador Rodolfo Aureliano'; data.pois.push({ name: 'Fórum Joana Bezerra', kind: 'courthouse', x: best.b.cx, z: best.b.cz }); }
  }
  // torres do RioMar Trade Center (os shoppings em si são extrudados lisos em buildMarcos)
  for (const b of data.buildings) {
    if (/^Riomar Trade Center [45]$/.test(b.n || '')) { b.h = 135; b.c = '#3f5868'; b.style = 'tower'; }
    if (/^RioMar Trade Center - Torre/.test(b.n || '')) { b.h = 95; b.c = '#4d6b7c'; b.style = 'tower'; }
  }
}

// ---------------------------------------------------------------- utilidades
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
// plano 1x1 com o UV multiplicado (a textura repete rx vezes na largura e ry na altura)
function plane(rx = 1, ry = 1) {
  const g = new THREE.PlaneGeometry(1, 1), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry);
  return g;
}
function signTex(text, bg, fg, w = 1024, h = 128, font = 'bold 84px Arial') {
  return canvasTex(w, h, (g) => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4); });
}
// barra de a até b (pilar inclinado, estai)
function strut(k, m, a, b, t, t2 = t) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz), hz = Math.hypot(dx, dz);
  k.add(m, BX, [t, L, t2], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [Math.atan2(hz, dy), Math.atan2(dx, dz), 0], 'YXZ');
}
// reveste as quatro faces de uma caixa W (x) por L (z), de y0 até y0+H, com a textura m (bay m de vão, fl m de andar)
function skin(k, m, W, L, y0, H, bay, fl, faces = [1, 1, 1, 1], x0 = 0, z0 = 0) {
  const ry = H / fl, y = y0 + H / 2, e = 0.04;
  if (faces[0]) k.add(m, plane(L / bay, ry), [L, H, 1], [x0 + W / 2 + e, y, z0], [0, Math.PI / 2, 0]);
  if (faces[1]) k.add(m, plane(L / bay, ry), [L, H, 1], [x0 - W / 2 - e, y, z0], [0, -Math.PI / 2, 0]);
  if (faces[2]) k.add(m, plane(W / bay, ry), [W, H, 1], [x0, y, z0 + L / 2 + e], [0, 0, 0]);
  if (faces[3]) k.add(m, plane(W / bay, ry), [W, H, 1], [x0, y, z0 - L / 2 - e], [0, Math.PI, 0]);
}
// placa plana virada para +x, centrada em (x, y, z)
function signX(k, tex, w, h, x, y, z, emissive = 0.15) {
  k.add(new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, roughness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: emissive }), plane(), [w, h, 1], [x, y, z], [0, Math.PI / 2, 0]);
}
function palm(k, mat, x, z, h = 14) {
  const trunk = mat('#b9b2a2', { roughness: 0.95 }), frond = mat('#3c7a35', { side: THREE.DoubleSide });
  k.add(trunk, new THREE.CylinderGeometry(0.22, 0.34, h, 7), [1, 1, 1], [x, h / 2, z]);
  k.add(mat('#6f8a4a'), new THREE.CylinderGeometry(0.3, 0.24, 1.6, 7), [1, 1, 1], [x, h + 0.6, z]);
  for (let f = 0; f < 8; f++) k.add(frond, new THREE.ConeGeometry(0.5, 4.2, 4, 1).rotateX(Math.PI / 2).scale(1, 0.18, 1).translate(0, 0, 2.1), [1, 1, 1], [x, h + 1.3, z], [0.55, (f / 8) * Math.PI * 2, 0], 'YXZ');
}

// contorno extrudado com parede lisa (shopping não tem janela de prédio de apartamento)
function extrude(group, b, h, m, roofM) {
  const r = ringOf(b), sh = new THREE.Shape(r.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, [roofM, m]); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
}
const painel = (bg, line, every, dark) => canvasTex(128, 128, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 128, 128); g.fillStyle = line; for (let x = 0; x < 128; x += every) g.fillRect(x, 0, 1, 128); g.fillRect(0, 0, 128, 1); if (dark) { g.fillStyle = dark; g.fillRect(0, 40, 128, 56); } });

// referencial do prédio: z local no eixo comprido, +x é a face que dá pra rua
function frameOf(b, env, flip = false) {
  const o = obb(ringOf(b)), W = o.wid, L = o.len;
  const nx = o.uz, nz = -o.ux; // +x local no mundo (perpendicular ao eixo comprido)
  const road = (s) => { let n = 0; for (let d = W / 2 + 4; d < W / 2 + 40; d += 3) for (const t of [-L / 4, 0, L / 4]) if (env.isRoad?.(o.cx + nx * s * d + o.ux * t, o.cz + nz * s * d + o.uz * t)) n++; return n; };
  const s = (road(1) >= road(-1) ? 1 : -1) * (flip ? -1 : 1);
  const rot = Math.atan2(o.ux, o.uz) + (s < 0 ? Math.PI : 0);
  // local -> mundo
  const c = Math.cos(rot), sn = Math.sin(rot);
  const world = (x, z) => [o.cx + x * c + z * sn, o.cz - x * sn + z * c];
  return { o, W, L, rot, world, build: (k, group, shadow = true, collide = true) => k.build(group, o.cx, o.cz, rot, shadow, collide) };
}

// ---------------------------------------------------------------- texturas de fachada
function pedraBlocos(g, w, h) {
  g.fillStyle = '#a8977a'; g.fillRect(0, 0, w, h);
  let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0, row = 0; y < h; y += 16, row++) for (let x = row % 2 ? -12 : 0; x < w; ) {
    const bw = 18 + r() * 16, v = 150 + r() * 45;
    g.fillStyle = `rgb(${v + 12},${v},${v - 22})`; g.fillRect(x + 1, y + 1, bw - 2, 14); x += bw;
  }
  g.fillStyle = 'rgba(60,50,35,0.18)'; for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 4);
}
const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const T = {
    // Restauração: grelha de concreto branco com o vidro recuado e a faixa azul do peitoril
    restauracao: () => canvasTex(128, 128, (g) => {
      g.fillStyle = '#f1f1ec'; g.fillRect(0, 0, 128, 128);
      const gr = g.createLinearGradient(0, 14, 0, 110); gr.addColorStop(0, '#2b363e'); gr.addColorStop(1, '#4b5a63'); g.fillStyle = gr; g.fillRect(14, 12, 100, 96);
      g.fillStyle = '#1d5fb0'; g.fillRect(14, 92, 100, 16);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(14, 12, 100, 8); g.fillRect(14, 12, 8, 96);
      g.fillStyle = '#d9d9d2'; g.fillRect(0, 120, 128, 8);
    }),
    // pele de vidro espelhado: céu em cima, verde das árvores embaixo, montantes finos
    espelho: () => canvasTex(128, 128, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#a9c2d2'); gr.addColorStop(0.55, '#6f8c96'); gr.addColorStop(1, '#3d5a48'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#c9d0d4'; g.fillRect(0, 0, 3, 128); g.fillRect(0, 0, 128, 3);
    }),
    // vidro escuro com a laje branca (Santa Joana)
    faixas: () => canvasTex(128, 128, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 100); gr.addColorStop(0, '#5a7480'); gr.addColorStop(1, '#22323b'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#9fb0b8'; g.fillRect(0, 0, 2, 100);
      g.fillStyle = '#f1f1ed'; g.fillRect(0, 100, 128, 28); g.fillStyle = '#c9cac4'; g.fillRect(0, 124, 128, 4);
    }),
    // vidro cinza escuro com faixa clara (torre do Português)
    torre: () => canvasTex(128, 128, (g) => {
      g.fillStyle = '#3b444b'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#566069'; g.fillRect(4, 6, 120, 90);
      g.fillStyle = '#a8adb1'; g.fillRect(0, 108, 128, 20); g.fillStyle = '#2a3036'; g.fillRect(0, 0, 3, 108);
    }),
    // bloco branco com janelas em fenda vertical (Português, "desde 1855")
    fenda: () => canvasTex(128, 128, (g) => {
      g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(0,0,0,0.05)'; for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 1);
      g.fillStyle = '#2b3036'; g.fillRect(52, 10, 24, 108);
    }),
    // brises verticais de alumínio (Biblioteca Pública)
    brise: () => canvasTex(64, 64, (g) => {
      g.fillStyle = '#8f989c'; g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 8) { g.fillStyle = '#eef1f2'; g.fillRect(x, 0, 5, 64); g.fillStyle = '#c4cacd'; g.fillRect(x + 5, 0, 1, 64); }
    }),
    // aletas horizontais de alumínio (embasamento do Memorial)
    aleta: () => canvasTex(128, 64, (g) => {
      g.fillStyle = '#c3c6c8'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#eceeef'; g.fillRect(0, 0, 128, 6);
      g.fillStyle = '#7b8185'; g.fillRect(0, 50, 128, 14); g.fillStyle = '#a5aaad'; g.fillRect(0, 0, 1, 64);
    }),
    // brises verticais claros bem juntinhos (lâmina da Prefeitura)
    prefeitura: () => canvasTex(64, 128, (g) => {
      g.fillStyle = '#2d3640'; g.fillRect(0, 0, 64, 128);
      for (let x = 0; x < 64; x += 16) { g.fillStyle = '#e9e9e4'; g.fillRect(x, 0, 9, 128); g.fillStyle = '#c9c9c2'; g.fillRect(x + 9, 0, 2, 128); }
      g.fillStyle = '#dcdcd6'; g.fillRect(0, 118, 64, 10);
    }),
    // vidro escuro entre os pilarões do Fórum
    forum: () => canvasTex(128, 128, (g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#5a6a72'); gr.addColorStop(1, '#2a3238'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = '#7a6058'; g.fillRect(0, 118, 128, 10); g.fillStyle = '#3d4a52'; g.fillRect(62, 0, 4, 118); }),
    // térreo envidraçado (recuado, escuro)
    vitrine: () => canvasTex(128, 128, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#41545c'); gr.addColorStop(1, '#1c2529'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#d8dad8'; g.fillRect(0, 0, 4, 128); g.fillRect(0, 0, 128, 6); g.fillRect(0, 60, 128, 3);
    }),
    // faixa de vidro do andar de cima do Museu do Homem do Nordeste (montantes brancos)
    faixaMuseu: () => canvasTex(128, 128, (g) => {
      g.fillStyle = '#2f3b40'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#4d5f66'; g.fillRect(0, 0, 128, 50);
      g.fillStyle = '#e9e9e4'; g.fillRect(0, 0, 6, 128); g.fillRect(62, 0, 3, 128); g.fillRect(0, 50, 128, 3);
    }),
    // parede laranja com janelinhas
    laranja: () => canvasTex(128, 128, (g) => { g.fillStyle = '#d8673f'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#5a3326'; g.fillRect(40, 30, 22, 26); g.fillRect(74, 30, 22, 26); }),
    // painel de azulejo/cerâmica do museu: fundo terracota, arcos verdes, faixas de pastilhas
    mural: () => canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#b5583b'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(80,30,20,0.35)'; g.lineWidth = 1; for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      const arch = (x0, ww, c) => { g.strokeStyle = c; g.lineWidth = 14; g.beginPath(); g.moveTo(x0, h); g.lineTo(x0, 90); g.quadraticCurveTo(x0 + ww / 2, -10, x0 + ww, 90); g.lineTo(x0 + ww, h); g.stroke(); };
      arch(24, 90, '#5c9a58'); arch(44, 50, '#e8e1c8'); arch(200, 110, '#5c9a58'); arch(222, 66, '#2f6f3f'); arch(380, 100, '#5c9a58'); arch(402, 56, '#e8e1c8');
      for (let y = 30; y < h; y += 22) for (const x of [150, 340, 490]) { g.fillStyle = ['#f2d16b', '#e8e1c8', '#2f6f3f'][(y / 22) % 3 | 0]; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
    }),
    // tijolinho vermelho com o painel redondo (Biblioteca)
    tijolo: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#8a3a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#6f2c20';
      for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) g.fillRect(x, y, 1, 8);
      for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1);
      g.lineWidth = 10; for (const [r, c] of [[100, '#3a3a36'], [80, '#c9b48a'], [58, '#3a3a36'], [36, '#c9b48a']]) { g.strokeStyle = c; g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
      g.strokeStyle = '#3a3a36'; g.lineWidth = 6; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 36, 128 + Math.sin(a) * 36); g.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); g.stroke(); }
    }),
    // azulejo português azul e branco (muro do palacete da Fundaj)
    azulejo: () => canvasTex(64, 64, (g) => {
      g.fillStyle = '#eef0f2'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#2d4f8a'; g.lineWidth = 3;
      g.beginPath(); g.arc(32, 32, 14, 0, Math.PI * 2); g.stroke(); for (const [x, y] of [[0, 0], [64, 0], [0, 64], [64, 64]]) { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#2d4f8a'; g.fillRect(30, 30, 4, 4); g.fillStyle = '#c9ccd2'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64);
    }),
    // janela de palacete: moldura branca, venezianas azuis (laterais da Fundaj)
    palacete: () => canvasTex(128, 128, (g) => {
      g.fillStyle = '#c4d0da'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#f7f6f1'; g.fillRect(34, 20, 60, 92); g.fillStyle = '#2f4e74'; g.fillRect(42, 28, 44, 78);
      g.fillStyle = '#26405f'; for (let y = 32; y < 104; y += 6) g.fillRect(42, y, 44, 2); g.fillStyle = '#f7f6f1'; g.fillRect(63, 28, 2, 78);
      g.fillStyle = '#f7f6f1'; g.fillRect(28, 14, 72, 6);
    }),
    // pedra do castelo do Brennand: blocos ocre-acinzentados irregulares (4 m x 4 m por célula)
    pedra: () => canvasTex(128, 128, (g) => pedraBlocos(g, 128, 128)),
    // a mesma pedra com uma janela ogival estreita (vitral escuro com caixilho de chumbo)
    ogiva: () => canvasTex(128, 128, (g) => {
      pedraBlocos(g, 128, 128);
      g.fillStyle = '#8f8068'; g.beginPath(); g.moveTo(46, 112); g.lineTo(46, 52); g.quadraticCurveTo(64, 12, 82, 52); g.lineTo(82, 112); g.closePath(); g.fill();
      g.fillStyle = '#1f2a33'; g.beginPath(); g.moveTo(51, 108); g.lineTo(51, 54); g.quadraticCurveTo(64, 22, 77, 54); g.lineTo(77, 108); g.closePath(); g.fill();
      g.strokeStyle = '#4a4232'; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 30); g.lineTo(64, 108); for (let y = 60; y < 108; y += 14) { g.moveTo(51, y); g.lineTo(77, y); } g.stroke();
      g.fillStyle = '#7a6d58'; g.fillRect(42, 110, 44, 6);
    }),
  }[name];
  return (TEX[name] = T());
}

// ---------------------------------------------------------------- construção
export function buildMarcos(group, data, env, mat) {
  const byName = (n) => data.buildings.filter((b) => b.n === n);
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z) && !env.isRoad?.(x, z);
  const label = (name, x, z) => { if (!data.pois.some((p) => p.name === name)) data.pois.push({ name, kind: 'attraction', x, z }); };
  const T = (name, o = {}) => new THREE.MeshStandardMaterial({ map: tex(name), roughness: 0.6, ...o });

  // ------------------------------------------------ Museu do Homem do Nordeste (Casa Forte)
  // Bloco modernista de dois andares: térreo envidraçado com pilotis, faixa de vidro em cima, laje branca em balanço,
  // painel de cerâmica terracota com arcos verdes numa ponta e parede laranja na outra. Placa de concreto no gramado.
  for (const b of byName('Museu do Homem do Nordeste').slice(0, 1)) {
    const f = frameOf(b, env, true), W = Math.min(f.W, 22), L = Math.max(40, f.L), k = new Kit(); // a frente dá pro jardim, não pra rua
    const white = mat('#f2f1ec', { roughness: 0.7 }), conc = mat('#d9d6cf', { roughness: 0.9 });
    const zm = -L / 2 + L * 0.24, zo = L * 0.22; // fim do painel; começo da parede laranja
    k.box(conc, W - 3, 3.6, L - 2, -1.5, 1.8, 0); // térreo recuado
    skin(k, T('vitrine', { roughness: 0.25, metalness: 0.3 }), W - 3, L - 2, 0, 3.6, 3.2, 3.6, [1, 1, 0, 0], -1.5, 0);
    for (let z = zm + 2; z < L / 2 - 1; z += 5) k.box(white, 0.5, 3.6, 0.5, W / 2 - 0.6, 1.8, z); // pilotis
    k.box(conc, W, 4.2, L - (zm + L / 2), 0, 5.7, (zm + L / 2) / 2); // andar de cima
    skin(k, T('faixaMuseu', { roughness: 0.3, metalness: 0.3 }), W, zo - zm, 3.6, 4.2, 3, 4.2, [1, 1, 0, 0], 0, (zm + zo) / 2);
    skin(k, T('laranja'), W, L / 2 - zo, 3.6, 4.2, 3, 4.2, [1, 1, 1, 0], 0, (zo + L / 2) / 2);
    k.box(white, W + 1.6, 0.7, L + 1.2, 0, 8.15, 0); // laje em balanço
    // painel de cerâmica (alto, na ponta)
    k.box(mat('#9c4a32'), W * 0.9, 7.6, L * 0.24, 0, 3.8, -L / 2 + L * 0.12);
    k.add(T('mural', { roughness: 0.8 }), plane(), [L * 0.24, 7.4, 1], [W * 0.45 + 0.05, 3.8, -L / 2 + L * 0.12], [0, Math.PI / 2, 0]);
    k.add(T('mural', { roughness: 0.8 }), plane(), [W * 0.9, 7.4, 1], [0, 3.8, -L / 2 - 0.05], [0, Math.PI, 0]);
    // placa de concreto "MUSEU DO HOMEM DO NORDESTE" no gramado
    const sx = W / 2 + 16;
    k.box(mat('#e2ded5', { roughness: 0.95 }), 0.5, 1.5, 11, sx, 1.4, 4).box(conc, 0.3, 0.7, 0.3, sx, 0.35, 0).box(conc, 0.3, 0.7, 0.3, sx, 0.35, 8);
    signX(k, signTex('MUSEU DO HOMEM DO NORDESTE', null, '#1d1d1d', 1024, 128, 'bold 64px Arial'), 10.6, 1.3, sx + 0.27, 1.4, 4, 0);
    // a maria-fumaça do jardim
    const lx = W / 2 + 12, lz = L / 2 - 6, black = mat('#1b1b1b', { roughness: 0.5, metalness: 0.4 }), red = mat('#a3241c');
    k.add(black, new THREE.CylinderGeometry(0.75, 0.75, 4, 14), [1, 1, 1], [lx, 1.6, lz], [Math.PI / 2, 0, 0]).box(black, 1.8, 2.2, 1.8, lx, 2.0, lz + 2.6).box(black, 2.0, 0.15, 2.2, lx, 3.15, lz + 2.6);
    k.add(black, new THREE.CylinderGeometry(0.22, 0.3, 1.1, 10), [1, 1, 1], [lx, 2.8, lz - 1.4]);
    for (const z of [-1.2, 0.2, 1.6]) for (const s of [-1, 1]) k.add(red, new THREE.CylinderGeometry(0.5, 0.5, 0.15, 14), [1, 1, 1], [lx + s * 0.8, 0.55, lz + z], [0, 0, Math.PI / 2]);
    palm(k, mat, W / 2 + 7, -L / 2 - 4);
    f.build(k, group);
  }

  // ------------------------------------------------ Fundação Joaquim Nabuco (palacete de Casa Forte)
  // Palacete eclético de dois andares, cinza-azulado com pilastras e frisos brancos, venezianas azuis, porta e janela
  // centrais em arco com sacada, platibanda com ameias e brasão, muro de azulejo e escadaria na frente.
  for (const b of byName('Fundação Joaquim Nabuco').slice(0, 1)) {
    const f = frameOf(b, env), W = Math.min(f.W, 20), L = Math.min(f.L, 28), k = new Kit();
    const wall = mat('#c4d0da', { roughness: 0.85 }), white = mat('#f7f6f1', { roughness: 0.6 }), blue = mat('#2f4e74', { roughness: 0.5 });
    k.box(wall, W, 11, L, 0, 5.5 + 1.2, 0).box(white, W, 1.2, L, 0, 0.6, 0); // corpo sobre o porão alto
    skin(k, T('palacete'), W, L, 1.4, 4.8, 3.4, 4.8, [1, 1, 1, 1]); skin(k, T('palacete'), W, L, 6.6, 5.0, 3.4, 5.0, [1, 1, 1, 1]);
    // frisos e cornija
    for (const y of [6.4, 11.6]) k.box(white, W + 0.6, 0.4, L + 0.6, 0, y, 0);
    // pilastras na fachada
    for (const z of [-L / 2 + 0.3, -3.2, 3.2, L / 2 - 0.3]) k.box(white, 0.3, 10.4, 0.8, W / 2 + 0.2, 6.6, z);
    // corpo central: porta em arco, janela em arco e sacada
    k.box(white, 0.3, 3.4, 2.4, W / 2 + 0.25, 3.1, 0).box(blue, 0.32, 3.0, 1.7, W / 2 + 0.3, 3.0, 0);
    k.add(blue, new THREE.CylinderGeometry(0.85, 0.85, 0.32, 16, 1, false, 0, Math.PI), [1, 1, 1], [W / 2 + 0.3, 4.5, 0], [0, 0, Math.PI / 2]);
    k.box(blue, 0.32, 3.2, 1.7, W / 2 + 0.3, 8.6, 0); k.add(blue, new THREE.CylinderGeometry(0.85, 0.85, 0.32, 16, 1, false, 0, Math.PI), [1, 1, 1], [W / 2 + 0.3, 10.2, 0], [0, 0, Math.PI / 2]);
    k.box(mat('#3a3a3a', { metalness: 0.6 }), 1.2, 1.0, 3.4, W / 2 + 0.8, 7.4, 0).box(white, 1.4, 0.2, 3.6, W / 2 + 0.8, 6.85, 0); // sacada de ferro
    // platibanda com ameias e brasão
    k.box(white, W + 0.3, 1.0, L + 0.3, 0, 12.3, 0);
    for (let z = -L / 2 + 0.6; z <= L / 2 - 0.6; z += 1.6) k.box(white, 0.5, 0.6, 0.8, W / 2, 13.1, z);
    k.box(white, 0.6, 2.0, 4.0, W / 2, 13.6, 0); k.add(white, new THREE.CylinderGeometry(0.8, 0.8, 0.2, 18), [1, 1, 1], [W / 2 + 0.3, 13.6, 0], [0, 0, Math.PI / 2]);
    // escadaria e muro de azulejo
    for (let i = 0; i < 6; i++) k.box(mat('#e7e4dc'), 1.0, 0.2 * (6 - i), 4, W / 2 + 0.5 + i, 0.1 * (6 - i), 0);
    const az = T('azulejo', { roughness: 0.4 });
    for (const s of [-1, 1]) { const len = L / 2 - 2.5, zc = s * (2.5 + len / 2); k.box(white, 0.4, 1.2, len, W / 2 + 6, 0.6, zc); k.add(az, plane(len / 0.6, 2), [len, 1.1, 1], [W / 2 + 6.21, 0.6, zc], [0, Math.PI / 2, 0]); }
    palm(k, mat, W / 2 + 4, -L / 2 + 1, 15); palm(k, mat, W / 2 + 4, L / 2 - 1, 16);
    f.build(k, group);
  }

  // ------------------------------------------------ Biblioteca Pública do Estado (Rua João Lira, Santo Amaro)
  // Caixa grande com brises verticais de alumínio, faixa de concreto em cima, térreo de vidro, parede de tijolinho com
  // o painel redondo, escadaria, totem com o emblema e duas palmeiras imperiais.
  for (const b of byName('Biblioteca Pública do Estado de Pernambuco').slice(0, 1)) {
    const f = frameOf(b, env), W = f.W, L = f.L, k = new Kit();
    const beige = mat('#cfc6b2', { roughness: 0.9 });
    k.box(beige, W - 2, 4.2, L - 2, -1, 2.1, 0);
    skin(k, T('vitrine', { roughness: 0.25, metalness: 0.3 }), W - 2, L - 2, 0, 4.2, 3, 4.2, [1, 1, 1, 1], -1, 0);
    k.box(beige, W, 11, L, 0, 4.2 + 5.5, 0);
    skin(k, T('brise', { roughness: 0.4, metalness: 0.3 }), W, L, 4.6, 9.4, 1.2, 9.4);
    k.box(beige, W + 0.4, 1.2, L + 0.4, 0, 15.6, 0).box(beige, W + 1.2, 0.5, L + 1.2, 0, 4.4, 0);
    // tijolinho com o painel redondo, à esquerda da entrada
    k.box(mat('#8a3a2a'), 1.0, 8, 12, W / 2 + 0.5, 4, -L / 2 + 9);
    k.add(T('tijolo', { roughness: 0.9 }), plane(), [12, 8, 1], [W / 2 + 1.02, 4, -L / 2 + 9], [0, Math.PI / 2, 0]);
    // escadaria
    for (let i = 0; i < 5; i++) k.box(mat('#9a6a4f', { roughness: 0.9 }), 1.0, 0.25 * (5 - i), 14, W / 2 + 0.5 + i, 0.125 * (5 - i), L / 4);
    // totem com o emblema
    const tx = W / 2 + 9, tz = L / 4 + 10;
    k.box(mat('#2b2b2b', { roughness: 0.4, metalness: 0.3 }), 1.0, 9, 1.6, tx, 4.5, tz);
    k.add(mat('#d9dcdc', { metalness: 0.6, roughness: 0.3 }), new THREE.CylinderGeometry(1.4, 1.4, 0.25, 28), [1, 1, 1], [tx, 9.8, tz], [0, 0, Math.PI / 2]);
    signX(k, signTex('BIBLIOTECA PÚBLICA DO ESTADO', null, '#e8e8e8', 1024, 96, 'bold 52px Arial'), 0.01 + 7.6, 0.7, tx + 0.52, 4.6, tz, 0.1);
    palm(k, mat, W / 2 + 8, -L / 2 + 2, 18); palm(k, mat, W / 2 + 10, -L / 2 + 8, 20);
    f.build(k, group);
  }

  // ------------------------------------------------ Hospital da Restauração (Av. Agamenon Magalhães, Derby)
  // A lâmina comprida de 12 andares com a grelha de concreto branco e as faixas azuis, letreiro azul no topo.
  for (const b of byName('Hospital da Restauração').slice(0, 1)) {
    const f = frameOf(b, env), W = Math.min(f.W, 28), L = f.L, H = 42, k = new Kit();
    const white = mat('#f1f1ec', { roughness: 0.8 });
    k.box(white, W, H, L, 0, H / 2, 0);
    skin(k, T('restauracao', { roughness: 0.5 }), W, L, 4, H - 7, 2.8, 3.25);
    skin(k, T('vitrine', { roughness: 0.3, metalness: 0.3 }), W, L, 0, 4, 3.5, 4);
    k.box(white, W + 0.6, 3, L + 0.6, 0, H - 1.5, 0); // platibanda
    signX(k, signTex('HOSPITAL DA RESTAURAÇÃO', null, '#1d4f9c', 1024, 96, 'bold 64px Arial'), L * 0.45, 2.2, W / 2 + 0.36, H - 1.5, -L * 0.08, 0.2);
    k.add(mat('#1d5fb0', { roughness: 0.4 }), plane(), [3, 2.2, 1], [W / 2 + 0.36, H - 1.5, L * 0.2], [0, Math.PI / 2, 0]);
    signX(k, signTex('HR', null, '#ffffff', 256, 128, 'bold 96px Arial'), 3, 2.0, W / 2 + 0.38, H - 1.5, L * 0.2, 0.2);
    k.box(mat('#1d5fb0'), W * 0.4, 2.4, 6, 0, H + 1.2, L / 2 - 6); // caixas d'água azuis
    f.build(k, group);
  }

  // ------------------------------------------------ Hospital Santa Joana (Av. Agamenon Magalhães, Espinheiro)
  // Faixas de vidro escuro entre lajes brancas, a torre de pedra escura com o "SJ" e o heliponto pintado no topo.
  for (const b of byName('Hospital Santa Joana Recife').slice(0, 1)) {
    const f = frameOf(b, env), W = f.W, L = f.L, H = 30, k = new Kit();
    const white = mat('#f1f1ed', { roughness: 0.7 }), stone = mat('#4a4f52', { roughness: 0.8 });
    k.box(mat('#2a3a45'), W, H, L, 0, H / 2, 0);
    skin(k, T('faixas', { roughness: 0.2, metalness: 0.5 }), W, L, 0, H, 4, 3.75);
    for (let y = 3.75; y <= H; y += 3.75) k.box(white, W + 1.2, 0.35, L + 1.2, 0, y, 0); // lajes saltadas
    k.box(stone, 4, H + 4, 5, W / 2 - 1, (H + 4) / 2, L / 2 - 4);
    signX(k, signTex('SJ', null, '#f2f2f0', 256, 256, 'bold 170px Georgia'), 3.2, 3.2, W / 2 + 1.03, H - 3, L / 2 - 4, 0.3);
    // heliponto
    k.add(mat('#7fa9c9', { roughness: 0.8 }), new THREE.CylinderGeometry(Math.min(W, L) * 0.42, Math.min(W, L) * 0.42, 0.4, 32), [1, 1, 1], [0, H + 1.2, 0]);
    const heli = canvasTex(256, 256, (g) => { g.fillStyle = '#7fa9c9'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#e0627a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(128, 128, 90, 30, (i * Math.PI) / 6, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(128, 128, 26, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke(); });
    const r = Math.min(W, L) * 0.42; k.add(new THREE.MeshStandardMaterial({ map: heli, roughness: 0.8 }), new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), [1, 1, 1], [0, H + 1.42, 0]);
    for (let i = 0; i < 6; i++) k.box(mat('#d9d9d4'), 0.3, 1.2, 0.3, Math.cos(i) * r * 0.9, H + 0.6, Math.sin(i) * r * 0.9);
    f.build(k, group);
  }

  // ------------------------------------------------ Hospital Memorial São José (Av. Agamenon Magalhães, Derby)
  // Embasamento com aletas de alumínio, caixa de vidro espelhado presa num pórtico prateado com a estrela e o "S",
  // marquise branca com o letreiro azul na entrada.
  for (const b of byName('Hospital Memorial São José').slice(0, 1)) {
    const f = frameOf(b, env), W = Math.min(f.W, 36), L = f.L, H = 54, P = 14, k = new Kit();
    const silver = mat('#c9ccce', { roughness: 0.35, metalness: 0.6 });
    k.box(silver, W, P, L, 0, P / 2, 0);
    skin(k, T('aleta', { roughness: 0.4, metalness: 0.5 }), W, L, 1, P - 1, 4, 2.4);
    skin(k, T('vitrine', { roughness: 0.3, metalness: 0.3 }), W, L, 0, 3.2, 3.5, 3.2, [1, 0, 0, 0]);
    const Lg = L - 12; // vidro entre as duas pernas do pórtico
    k.box(mat('#56707a', { roughness: 0.1, metalness: 0.8 }), W - 4, H - P - 2, Lg, -1, P + (H - P - 2) / 2, 0);
    skin(k, T('espelho', { roughness: 0.08, metalness: 0.75 }), W - 4, Lg, P, H - P - 2, 3, 3.6, [1, 1, 0, 0], -1, 0);
    for (let y = P + 4; y < H - 4; y += 7.2) k.box(silver, 1.0, 0.25, Lg, W / 2 - 2.5, y, 0); // brises de vidro
    for (const s of [-1, 1]) k.box(silver, W, H, 6, 0, H / 2, s * (L / 2 - 3)); // pernas do pórtico
    k.box(silver, W, 2.2, L, 0, H + 1.1, 0); // viga de cima
    k.add(mat('#b8925a', { metalness: 0.6, roughness: 0.4 }), new THREE.CylinderGeometry(1.2, 1.2, 0.2, 5), [1, 1, 1], [W / 2 + 0.1, H - 10, L / 2 - 3.6], [0, 0, Math.PI / 2]);
    signX(k, signTex('ʃ', null, '#b8925a', 256, 512, '400px Georgia'), 2.6, 7, W / 2 + 0.1, H - 13, L / 2 - 2, 0.1);
    // marquise com o letreiro
    k.box(mat('#f7f7f5'), 6, 0.6, 22, W / 2 + 3, 4.2, 0).box(mat('#f7f7f5'), 0.3, 2.0, 22, W / 2 + 6, 5.4, 0);
    signX(k, signTex('MEMORIAL SÃO JOSÉ', null, '#1e3a9c', 1024, 128, 'bold 80px Arial'), 18, 1.8, W / 2 + 6.18, 5.4, 0, 0.25);
    f.build(k, group);
  }

  // ------------------------------------------------ Real Hospital Português (Av. Portugal, Paissandu)
  // A torre de vidro cinza com faixas e o coroamento com o brasão, e o bloco branco de janelas em fenda com o
  // "DESDE 1855" no topo; marquise marrom do "Acesso de Pedestres".
  const rhp = byName('Real Hospital Português').sort((a, b) => (b.h || 0) - (a.h || 0));
  if (rhp[0]) {
    const f = frameOf(rhp[0], env), W = f.W, L = f.L, H = 49, k = new Kit();
    k.box(mat('#3b444b'), W, H, L, 0, H / 2, 0);
    skin(k, T('torre', { roughness: 0.2, metalness: 0.5 }), W, L, 0, H - 5, 3, 3.6);
    k.box(mat('#e6e3dc'), W * 0.7, 5, L * 0.7, -W * 0.1, H + 2.5, 0);
    k.add(mat('#c8102e'), new THREE.CylinderGeometry(1.4, 1.4, 0.2, 24), [1, 1, 1], [W * 0.25 + 0.1, H + 2.6, 0], [0, 0, Math.PI / 2]);
    k.add(mat('#2f7a3a'), new THREE.CylinderGeometry(1.0, 1.0, 0.2, 24), [1, 1, 1], [W * 0.25 + 0.2, H + 2.6, 0], [0, 0, Math.PI / 2]);
    f.build(k, group);
  }
  if (rhp[1]) {
    const f = frameOf(rhp[1], env), W = f.W, L = f.L, H = 32, k = new Kit();
    k.box(mat('#f2f1ec'), W, H, L, 0, H / 2, 0);
    skin(k, T('fenda', { roughness: 0.6 }), W, L, 4, H - 8, 2.6, 3.4);
    k.box(mat('#3a3d40'), W + 0.4, 4, L + 0.4, 0, H - 2, 0);
    signX(k, signTex('DESDE 1855', null, '#f2f2f0', 512, 96, '58px Georgia'), 7, 1.4, W / 2 + 0.22, H - 2, -L / 4, 0.2);
    k.box(mat('#6a4e3a'), 8, 1.4, 16, W / 2 + 4, 4.3, 0).box(mat('#6a4e3a'), 0.6, 3.6, 0.6, W / 2 + 7.6, 1.8, -7.5).box(mat('#6a4e3a'), 0.6, 3.6, 0.6, W / 2 + 7.6, 1.8, 7.5); // marquise
    signX(k, signTex('Acesso de Pedestres', null, '#e8dcc8', 1024, 128, '64px Georgia'), 12, 1.2, W / 2 + 8.02, 4.3, 0, 0.1);
    k.box(mat('#d4d0c6'), 8, 1.6, 0.4, W / 2 + 4, 0.8, L * 0.3);
    f.build(k, group);
  }

  // ------------------------------------------------ Prefeitura do Recife (Cais do Apolo)
  // Lâmina alta coberta de brises verticais claros, empenas brancas lisas, o painel/mural colorido numa empena e o
  // embasamento baixo de dois andares com faixa de janelas e o letreiro "PREFEITURA DO RECIFE".
  const prefs = byName('Prefeitura da Cidade do Recife').sort((a, b) => (b.h || 0) - (a.h || 0));
  if (prefs[0]) {
    const f = frameOf(prefs[0], env), W = Math.min(f.W, 22), L = f.L, H = 72, k = new Kit();
    const white = mat('#f1f0eb', { roughness: 0.75 });
    k.box(white, W, H, L, 0, H / 2, 0);
    skin(k, T('prefeitura', { roughness: 0.6 }), W, L, 4, H - 7, 1.2, 3.4, [1, 1, 0, 0]);
    k.box(white, W + 0.6, 3, L + 0.6, 0, H - 1.5, 0); k.box(mat('#d9d8d2'), W * 0.5, 4, L * 0.3, 0, H + 2, 0);
    // mural colorido numa empena
    const mural = canvasTex(256, 1024, (g) => {
      g.fillStyle = '#e9dfc8'; g.fillRect(0, 0, 256, 1024);
      const cols = ['#e63946', '#f4a261', '#2a9d8f', '#1d3557', '#e9c46a', '#8338ec', '#ff6b6b', '#3a86ff'];
      for (let i = 0; i < 40; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse((i * 53) % 256, (i * 97) % 1024, 30 + (i % 4) * 18, 60 + (i % 5) * 30, (i % 7) * 0.4, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#1d1d1d'; for (let y = 120; y < 1000; y += 260) { g.beginPath(); g.arc(128, y, 40, 0, Math.PI * 2); g.fill(); g.fillRect(98, y + 40, 60, 140); }
    });
    k.add(new THREE.MeshStandardMaterial({ map: mural, roughness: 0.7 }), plane(), [W * 0.8, H * 0.85, 1], [0, H * 0.48, L / 2 + 0.06]);
    // embasamento na frente, com o letreiro
    const BW = 14, BL = L * 1.25, BH = 8;
    k.box(white, BW, BH, BL, W / 2 + BW / 2, BH / 2, 0);
    k.add(T('vitrine', { roughness: 0.3, metalness: 0.3 }), plane(BL / 3, 1), [BL, 2.6, 1], [W / 2 + BW + 0.05, 5.4, 0], [0, Math.PI / 2, 0]);
    k.add(T('vitrine', { roughness: 0.3, metalness: 0.3 }), plane(BL / 3, 1), [BL, 2.2, 1], [W / 2 + BW + 0.05, 1.5, 0], [0, Math.PI / 2, 0]);
    signX(k, signTex('PREFEITURA DO RECIFE', null, '#1d3f8f', 1024, 96, 'bold 64px Arial'), 22, 1.6, W / 2 + BW + 0.08, 3.4, -BL * 0.2, 0.15);
    k.box(mat('#e2e0da'), BW + 2, 0.4, BL + 2, W / 2 + BW / 2, BH + 0.2, 0);
    for (const s2 of [-1, 1]) palm(k, mat, W / 2 + BW + 6, s2 * BL * 0.35, 13);
    f.build(k, group);
  }

  // ------------------------------------------------ Fórum Joana Bezerra (Fórum Des. Rodolfo Aureliano)
  // Bloco monumental de granito marrom-rosado, pilarões de altura total na frente do vidro escuro, viga no alto com o
  // nome do fórum, embasamento escuro e palmeiras na frente.
  for (const b of byName('Fórum Desembargador Rodolfo Aureliano').slice(0, 1)) {
    const f = frameOf(b, env), W = f.W, L = f.L, H = 30, k = new Kit();
    const granite = mat('#8a6d65', { roughness: 0.8 }), dark = mat('#5b4842', { roughness: 0.85 });
    k.box(mat('#3a4248'), W - 4, H - 3, L - 4, 0, (H - 3) / 2, 0);
    skin(k, T('forum', { roughness: 0.2, metalness: 0.4 }), W - 4, L - 4, 0, H - 3, 4, 3.6, [1, 1, 1, 1]);
    k.box(granite, W + 0.6, 3.2, L + 0.6, 0, H - 1.6, 0).box(dark, W + 0.4, 1.2, L + 0.4, 0, 0.6, 0);
    // pilarões nas quatro faces
    for (let z = -L / 2 + 2; z <= L / 2 - 2; z += 7.5) for (const s2 of [1, -1]) k.box(granite, 2.2, H - 1, 1.6, s2 * (W / 2 - 0.6), (H - 1) / 2, z);
    for (let x = -W / 2 + 2; x <= W / 2 - 2; x += 7.5) for (const s2 of [1, -1]) k.box(granite, 1.6, H - 1, 2.2, x, (H - 1) / 2, s2 * (L / 2 - 0.6));
    signX(k, signTex('FÓRUM DES. RODOLFO AURELIANO', null, '#f1e6d6', 1024, 96, 'bold 56px Georgia'), Math.min(60, L * 0.6), 2.2, W / 2 + 0.32, H - 1.6, 0, 0.1);
    // escadaria e palmeiras na frente
    for (let i = 0; i < 4; i++) k.box(mat('#9a8a80'), 1.2, 0.2 * (4 - i), 30, W / 2 + 1 + i * 1.1, 0.1 * (4 - i), 0);
    for (const z of [-20, -8, 8, 20]) palm(k, mat, W / 2 + 9, z, 12);
    f.build(k, group);
  }

  // ------------------------------------------------ shoppings e edifícios-garagem: volumes brancos lisos
  const roofG = mat('#a9aba8', { roughness: 0.9 });
  const wallT = (t, sx, sy) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(sx, sy); return new THREE.MeshStandardMaterial({ map: c, roughness: 0.7 }); };
  const shopTex = painel('#f3f2ee', '#dcdad3', 32), garTex = painel('#eeece6', '#d6d3cb', 128, '#4a4e52');
  for (const [n, h, t, sx, sy] of [['Shopping RioMar', 22, shopTex, 1 / 6, 1 / 6], ['Shopping Recife', 16, shopTex, 1 / 6, 1 / 6], ['Edificio Garagem do Shopping Riomar', 15, garTex, 1 / 8, 1 / 3], ['Edificio Garagem - Shopping Recife', 13.8, garTex, 1 / 8, 1 / 3]]) for (const b of byName(n)) extrude(group, b, h, wallT(t, sx, sy), roofG);

  // ------------------------------------------------ Shopping RioMar: fachada da entrada principal
  const rm = byName('Shopping RioMar')[0], praca = data.pois.find((p) => p.name === 'Praça do RioMar Shopping');
  if (rm && praca) {
    const e = edgeToward(ringOf(rm), praca.x, praca.z);
    if (e) {
      const k = new Kit(), white = mat('#f4f4f1', { roughness: 0.5 }), brown = mat('#7a4b35', { roughness: 0.6 });
      const glass = T('espelho', { roughness: 0.1, metalness: 0.35 });
      // bloco de vidro saltado com as palhetas marrons nas laterais e o chapéu branco
      k.box(mat('#5f7f8a', { roughness: 0.1, metalness: 0.7 }), 34, 24, 12, 0, 12, 5);
      k.add(glass, plane(34 / 3, 24 / 3), [34, 24, 1], [0, 12, 11.05], [0, 0, 0]);
      for (const s of [-1, 1]) for (let y = 3; y < 24; y += 1.6) k.box(brown, 0.5, 0.35, 12, s * 17.3, y, 5);
      k.box(white, 42, 2.4, 20, 0, 26, 5).box(white, 44, 0.6, 22, 0, 24.8, 5);
      k.box(white, 34, 1.4, 1.2, 0, 13, 11.5); // marquise da faixa do meio
      k.add(new THREE.MeshStandardMaterial({ map: signTex('JCPM', null, '#cfcfcf', 512, 128, 'bold 90px Arial'), transparent: true, alphaTest: 0.1 }), plane(), [6, 1.4, 1], [0, 13, 12.15]);
      // letreiro RioMar (logo das ondas azul e verde) na parede branca, à esquerda do bloco de vidro
      const logo = canvasTex(1024, 256, (g) => { g.fillStyle = '#1f5fae'; g.font = 'bold 150px Arial'; g.textBaseline = 'middle'; g.fillText('RioMar', 300, 136); g.fillStyle = '#1f8fd4'; g.beginPath(); g.ellipse(150, 150, 120, 50, -0.2, 0, Math.PI); g.fill(); g.fillStyle = '#4cb848'; g.beginPath(); g.ellipse(170, 100, 90, 34, -0.3, Math.PI, Math.PI * 2); g.fill(); });
      k.add(new THREE.MeshStandardMaterial({ map: logo, transparent: true, alphaTest: 0.1, emissive: '#ffffff', emissiveMap: logo, emissiveIntensity: 0.15 }), plane(), [24, 6, 1], [-34, 15, 1.2]);
      k.box(white, 30, 22, 1.2, -34, 11, 0.4); // painel branco liso atrás do letreiro
      // marquise de vidro da entrada
      k.box(mat('#9ec3cf', { transparent: true, opacity: 0.5, roughness: 0.1 }), 10, 0.2, 10, 0, 5, 16).box(white, 0.3, 5, 0.3, -4.5, 2.5, 20).box(white, 0.3, 5, 0.3, 4.5, 2.5, 20);
      // cúpula de vidro verde no telhado
      k.add(mat('#3f8f88', { roughness: 0.15, metalness: 0.5 }), new THREE.SphereGeometry(12, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), [1, 0.45, 1], [0, 22, -40]);
      k.add(white, new THREE.CylinderGeometry(12.5, 12.5, 2, 24), [1, 1, 1], [0, 22, -40]);
      k.build(group, e.x, e.z, e.yaw, true, true);
    }
  }

  // ------------------------------------------------ Shopping Recife: entrada com letreiro, silo e casas de máquinas
  const sr = byName('Shopping Recife')[0];
  if (sr) {
    const r = ringOf(sr), cx = r.reduce((s, p) => s + p[0], 0) / r.length, cz = r.reduce((s, p) => s + p[1], 0) / r.length;
    // entrada na face que dá pra rua mais movimentada (Rua Padre Carapuceiro / Av. Domingos Ferreira)
    const road = data.roads.filter((q) => /Padre Carapuceiro|Domingos Ferreira/.test(q.n || '')).flatMap((q) => q.p);
    let tgt = null; for (const p of road) { const d = Math.hypot(p[0] - cx, p[1] - cz); if (!tgt || d < tgt.d) tgt = { x: p[0], z: p[1], d }; }
    const e = tgt && edgeToward(r, tgt.x, tgt.z);
    if (e) {
      const k = new Kit(), white = mat('#f4f4f1'), red = mat('#c8102e', { roughness: 0.5 });
      k.box(mat('#5f7f8a', { roughness: 0.1, metalness: 0.6 }), 24, 14, 6, 0, 7, 2).box(white, 28, 2, 8, 0, 15, 2);
      k.add(T('espelho', { roughness: 0.08, metalness: 0.7 }), plane(8, 4), [24, 14, 1], [0, 7, 5.05]);
      k.add(new THREE.MeshStandardMaterial({ map: signTex('Shopping Recife', null, '#c8102e', 1024, 128, 'bold 88px Arial'), transparent: true, alphaTest: 0.1, emissive: '#ffffff', emissiveMap: signTex('Shopping Recife', null, '#c8102e', 1024, 128, 'bold 88px Arial'), emissiveIntensity: 0.15 }), plane(), [20, 2.4, 1], [0, 15, 6.05]);
      k.box(white, 1.2, 18, 1.2, 18, 9, 10); k.add(red, new THREE.CylinderGeometry(2.4, 2.4, 0.3, 28), [1, 1, 1], [18, 18.5, 10], [Math.PI / 2, 0, 0]); // totem com o disco vermelho
      k.build(group, e.x, e.z, e.yaw, true, true);
    }
    // silo branco e casas de máquinas cinzentas no telhado
    const k2 = new Kit(), grey = mat('#9a9c9c', { roughness: 0.8 });
    k2.add(mat('#f1efe9'), new THREE.CylinderGeometry(9, 9, 10, 28), [1, 1, 1], [cx + 40, 21, cz - 20]).add(grey, new THREE.CylinderGeometry(9.2, 9.2, 1, 28), [1, 1, 1], [cx + 40, 26.5, cz - 20]);
    for (const [dx, dz, w, d] of [[-60, 10, 30, 18], [-10, 30, 22, 14], [70, 30, 26, 16], [-90, -20, 20, 20]]) k2.box(grey, w, 3, d, cx + dx, 17.5, cz + dz);
    k2.build(group, 0, 0, 0, true, false);
  }

  // ------------------------------------------------ Ponte Estaiada da Via Mangue
  // Mastro de concreto em forma de "A" que vira um fuste só e se abre em duas pontas lá em cima; leque de estais
  // brancos descendo até a pista curva do viaduto em volta.
  for (const b of byName('Ponte Estaiada').slice(0, 1)) {
    const o = obb(ringOf(b)), k = new Kit(), conc = mat('#c9c6be', { roughness: 0.8 }), grass = mat('#5a9a4a', { roughness: 0.95 });
    const rot = Math.atan2(o.ux, o.uz);
    k.box(grass, Math.min(o.wid, 18), 0.25, o.len, 0, 0.12, 0).box(conc, 6, 1.2, 22, 0, 0.6, 0);
    const Hb = 30, Hs = 56, Ht = 76;
    for (const sz of [-1, 1]) strut(k, conc, [0, 0, sz * 10], [0, Hb, sz * 1.3], 2.6, 2.2); // pernas do "A"
    k.box(conc, 2.8, 2, 4, 0, 12, 0); // travessa
    k.box(conc, 2.8, Hs - Hb, 3.0, 0, (Hb + Hs) / 2, 0); // fuste
    for (const sz of [-1, 1]) k.add(conc, new THREE.CylinderGeometry(0.35, 1.3, Ht - Hs, 10), [1, 1, 1], [0, (Hs + Ht) / 2, sz * 1.9], [sz * 0.09, 0, 0]); // as duas pontas
    k.build(group, o.cx, o.cz, rot, true, true);
    // estais até a pista
    const deck = data.roads.filter((r) => /Via Mangue/.test(r.n || '')).flatMap((r) => densify(r.p, 4)).filter((p) => { const d = Math.hypot(p[0] - o.cx, p[1] - o.cz); return d > 22 && d < 120; });
    const kc = new Kit(), cab = mat('#f4f4f2', { roughness: 0.4, metalness: 0.3 }); kc.keepOnRoad = true;
    const seen = new Set();
    for (const [x, z] of deck) {
      const key = Math.round(x / 7) + ',' + Math.round(z / 7); if (seen.has(key)) continue; seen.add(key);
      const d = Math.hypot(x - o.cx, z - o.cz), ya = Hb + 4 + ((d - 22) / 98) * (Hs - Hb - 6);
      const ax = o.cx + ((x - o.cx) / d) * 1.4, az = o.cz + ((z - o.cz) / d) * 1.4; // ancoragem no fuste, do lado da pista
      strut(kc, cab, [ax, ya, az], [x, 1.2, z], 0.2);
    }
    kc.build(group, 0, 0, 0, false, false);
    label('Ponte Estaiada', o.cx, o.cz);
  }

  // ------------------------------------------------ Instituto Ricardo Brennand (Várzea)
  buildBrennand(group, data, env, mat, T, label);

  // ------------------------------------------------ Oficina Brennand (Várzea) e Aeroporto dos Guararapes (Imbiribeira)
  buildOficina(group, data, env, mat, label);
  buildAeroporto(group, data, env, mat, label);

  // ------------------------------------------------ Praça do Arsenal (reforma recente, como nas fotos)
  buildArsenal(group, data, env, mat);

  // ------------------------------------------------ Canal da Av. Agamenon Magalhães
  buildCanalAgamenon(group, data, env, mat, free);
}

// Instituto Ricardo Brennand: o Castelo São João (museu de armas) de pedra, com torres quadradas ameadas, a torre de
// menagem no meio, janelas ogivais e o portão em arco; a Pinacoteca ao lado no mesmo estilo; alameda de palmeiras
// imperiais na chegada e esculturas de bronze no gramado. No OSM são dois contornos com o mesmo nome.
function buildBrennand(group, data, env, mat, T, label) {
  const list = data.buildings.filter((b) => b.n === 'Museu Instituto Ricardo Brennand').map((b) => ({ b, o: obb(ringOf(b)) })).sort((a, b) => b.o.len * b.o.wid - a.o.len * a.o.wid);
  if (!list.length) return;
  const stone = T('pedra', { roughness: 0.9 }), ogiva = T('ogiva', { roughness: 0.85 }), plain = mat('#b3a284', { roughness: 0.92 }), cap = mat('#9c8b6e', { roughness: 0.92 });
  const roof = mat('#7d7464', { roughness: 0.9 }), dark = mat('#1d1a16', { roughness: 0.8 }), wood = mat('#5a3a22', { roughness: 0.8 });
  // ameias no alto de uma parede (W na direção x, L na z), à altura y
  const merlons = (k, W, L, y, x0 = 0, z0 = 0) => {
    k.box(cap, W + 0.6, 0.5, L + 0.6, x0, y + 0.25, z0);
    for (const [len, along, fixed, s] of [[L, 'z', W, 1], [L, 'z', W, -1], [W, 'x', L, 1], [W, 'x', L, -1]]) {
      const n = Math.max(2, Math.floor(len / 2.2));
      for (let i = 0; i < n; i++) { const t = -len / 2 + (i + 0.5) * (len / n); if (i % 2) continue;
        if (along === 'z') k.box(plain, 0.7, 1.3, len / n, x0 + s * (fixed / 2), y + 1.15, z0 + t); else k.box(plain, len / n, 1.3, 0.7, x0 + t, y + 1.15, z0 + s * (fixed / 2)); }
    }
  };
  const tower = (k, x, z, w, h) => { k.box(stone, w, h, w, x, h / 2, z); skin(k, ogiva, w, w, h * 0.45, h * 0.5, 4, 4, [1, 1, 1, 1], x, z); merlons(k, w, w, h, x, z); };
  // ----- castelo (o contorno maior)
  {
    const f = frameOf(list[0].b, env), W = Math.min(f.W, 40), L = Math.min(f.L, 110), H = 13, k = new Kit();
    k.box(stone, W - 2, H, L - 2, 0, H / 2, 0); k.box(roof, W - 3, 0.4, L - 3, 0, H + 0.2, 0);
    skin(k, ogiva, W - 2, L - 2, 1.2, H - 2.4, 4.5, H - 2.4, [1, 1, 1, 1]);
    merlons(k, W - 2, L - 2, H);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(k, sx * (W / 2 - 3), sz * (L / 2 - 3), 8, 21);
    tower(k, 0, -L / 2 + L * 0.3, 7, 18); tower(k, 0, L / 2 - L * 0.3, 7, 18);
    // torre de menagem no meio, mais alta, com guarita redonda
    tower(k, -2, 0, 12, 31);
    k.add(plain, new THREE.CylinderGeometry(1.6, 1.6, 6, 12), [1, 1, 1], [-6.5, 33, -4.5]).add(roof, new THREE.ConeGeometry(2, 3.5, 12), [1, 1, 1], [-6.5, 37.7, -4.5]);
    // portão em arco ogival na frente (+x), porta de madeira e o letreiro
    const gx = W / 2 - 1 + 0.6;
    k.box(cap, 1.4, 9, 9, gx, 4.5, 0);
    k.add(dark, new THREE.CylinderGeometry(2.6, 2.6, 1.5, 16, 1, false, 0, Math.PI), [1, 1, 1], [gx + 0.1, 4.6, 0], [0, 0, Math.PI / 2]);
    k.box(dark, 1.5, 4.6, 5.2, gx + 0.1, 2.3, 0).box(wood, 0.3, 4.4, 4.6, gx + 0.8, 2.2, 0);
    signX(k, signTex('INSTITUTO RICARDO BRENNAND', null, '#2a2116', 1024, 96, 'bold 60px Georgia'), 16, 1.5, gx + 0.75, 10.2, 0, 0);
    // escadaria e a alameda de palmeiras imperiais até o portão
    for (let i = 0; i < 4; i++) k.box(plain, 1.1, 0.22 * (4 - i), 12, gx + 1 + i * 1.1, 0.11 * (4 - i), 0);
    k.box(mat('#cdbf9f', { roughness: 1 }), 50, 0.06, 8, gx + 30, 0.03, 0);
    for (let x = gx + 9; x < gx + 55; x += 9) for (const s of [-1, 1]) palm(k, mat, x, s * 6.5, 18);
    // esculturas de bronze no gramado (figuras em pedestal)
    const bronze = mat('#5d4a2c', { roughness: 0.45, metalness: 0.7 });
    for (const [x, z] of [[gx + 14, -18], [gx + 14, 18], [gx + 28, -20], [gx + 28, 20]]) {
      k.box(plain, 1.6, 1.4, 1.6, x, 0.7, z);
      k.add(bronze, new THREE.CylinderGeometry(0.32, 0.42, 1.6, 8), [1, 1, 1], [x, 2.2, z]).add(bronze, new THREE.SphereGeometry(0.28, 10, 8), [1, 1, 1], [x, 3.25, z]);
      k.box(bronze, 0.2, 0.9, 0.2, x + 0.4, 2.6, z, [0, 0, 0.6]).box(bronze, 0.2, 0.9, 0.2, x - 0.4, 2.6, z, [0, 0, -0.6]);
    }
    f.build(k, group);
    label('Castelo São João · Instituto Ricardo Brennand', ...f.world(gx + 4, 0));
    // mata e gramado do parque em volta (fora do castelo e da alameda)
    const C = data.brennandC || [f.o.cx, f.o.cz], a0 = f.world(gx, 0), a1 = f.world(gx + 60, 0), kt = new Kit();
    const segD = (x, z) => { const dx = a1[0] - a0[0], dz = a1[1] - a0[1], t = Math.max(0, Math.min(1, ((x - a0[0]) * dx + (z - a0[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(a0[0] + dx * t - x, a0[1] + dz * t - z); };
    let s = 77, nt = 0; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900 && nt < 220; i++) {
      const ang = r() * Math.PI * 2, d = 75 + r() * 180, x = C[0] + Math.cos(ang) * d, z = C[1] + Math.sin(ang) * d;
      if (segD(x, z) < 16 || env.isSolid(x, z) || env.isWater(x, z) || env.isRoad?.(x, z)) continue;
      leafyTree(kt, x, z, 1.1 + r() * 0.6, ['#4e7a37', '#5f8f3f', '#3f6b30'][nt % 3], nt % 3 ? 'round' : 'wide'); stampDisc(x, z, 0.5); nt++;
    }
    kt.build(group, 0, 0, 0, true, false);
  }
  // ----- Pinacoteca (o outro contorno)
  if (list[1]) {
    const f = frameOf(list[1].b, env), W = Math.min(f.W, 42), L = Math.min(f.L, 42), H = 12, k = new Kit();
    k.box(stone, W - 2, H, L - 2, 0, H / 2, 0); k.box(roof, W - 3, 0.4, L - 3, 0, H + 0.2, 0);
    skin(k, ogiva, W - 2, L - 2, 1, H - 2, 4.5, H - 2, [1, 1, 1, 1]);
    merlons(k, W - 2, L - 2, H);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(k, sx * (W / 2 - 2.5), sz * (L / 2 - 2.5), 6, 17);
    // galeria central com teto de duas águas
    k.add(roof, new THREE.CylinderGeometry(0.01, 7, 4, 4, 1).rotateY(Math.PI / 4).scale(1, 1, (L - 12) / 10), [1, 1, 1], [0, H + 2.2, 0]);
    const gx = W / 2 - 1 + 0.6;
    k.add(dark, new THREE.CylinderGeometry(1.8, 1.8, 1.2, 16, 1, false, 0, Math.PI), [1, 1, 1], [gx, 3.4, 0], [0, 0, Math.PI / 2]).box(dark, 1.2, 3.4, 3.6, gx, 1.7, 0);
    signX(k, signTex('PINACOTECA', null, '#2a2116', 1024, 128, 'bold 84px Georgia'), 9, 1.2, gx + 0.65, 7.5, 0, 0);
    f.build(k, group);
    label('Pinacoteca · Instituto Ricardo Brennand', ...f.world(gx + 4, 0));
  }
}

// Oficina Brennand: muralhas compridas de tijolo escuro com arcadas, esculturas de cerâmica em fila no alto do muro,
// pátio de lajota com totens e ovos de cerâmica, o Templo do Sacrifício com a cúpula de azulejo azul e a Accademia.
function buildOficina(group, data, env, mat, label) {
  const ofi = data.buildings.find((b) => b.n === 'Oficina Brennand'); if (!ofi) return;
  const k = new Kit(), brick = mat('#6e4a36', { roughness: 0.95 }), brickD = mat('#553828', { roughness: 0.95 }), arch = mat('#2a1d16', { roughness: 0.9 });
  const ceram = [mat('#8a5a3a', { roughness: 0.7 }), mat('#b88a5c', { roughness: 0.6 }), mat('#d8cbb0', { roughness: 0.5 }), mat('#5a4434', { roughness: 0.7 })];
  const H = 8.5, ring = ringOf(ofi);
  // muralha ao longo do contorno: parede, pilastras, nichos em arco nas duas faces e uma escultura a cada pilastra
  let n = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 3) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, rot = Math.atan2(ux, uz), nx = uz, nz = -ux;
    k.box(brick, 1.2, H, L, (a[0] + b[0]) / 2, H / 2, (a[1] + b[1]) / 2, [0, rot, 0]);
    for (let t = 2.5; t < L - 1.5; t += 4.2) {
      const x = a[0] + ux * t, z = a[1] + uz * t;
      k.box(brickD, 1.8, H + 0.6, 0.8, x, (H + 0.6) / 2, z, [0, rot, 0]); // pilastra
      for (const s of [1, -1]) { // nicho em arco (vão escuro com topo redondo)
        const ax = x + ux * 2.1 + nx * s * 0.62, az = z + uz * 2.1 + nz * s * 0.62;
        k.box(arch, 0.08, 4.2, 1.9, ax, 2.4, az, [0, rot, 0]);
        k.add(arch, new THREE.CylinderGeometry(0.95, 0.95, 0.08, 12, 1, false, 0, Math.PI), [1, 1, 1], [ax, 4.5, az], [Math.PI / 2, rot + Math.PI / 2, 0], 'YXZ');
      }
      // escultura no alto da pilastra: fuste de cerâmica com cabeça (as figuras em fila do muro)
      const m = ceram[n++ % ceram.length], hh = 1.4 + (n % 3) * 0.5;
      k.add(m, new THREE.CylinderGeometry(0.28, 0.4, hh, 8), [1, 1, 1], [x, H + 0.6 + hh / 2, z]).add(m, new THREE.SphereGeometry(0.36, 8, 6), [1, 1.3, 1], [x, H + 0.6 + hh + 0.3, z]);
    }
  }
  // pátio: totens e ovos de cerâmica espalhados pelo miolo livre do contorno
  const o = obb(ring); let placed = 0;
  for (let i = 0; i < 400 && placed < 60; i++) {
    const u = (Math.random() - 0.5) * o.len * 0.8, v = (Math.random() - 0.5) * o.wid * 0.8, x = o.cx + o.ux * u - o.uz * v, z = o.cz + o.uz * u + o.ux * v;
    if (!inside(ring, x, z)) continue;
    const m = ceram[placed % ceram.length];
    if (placed % 3 === 0) k.add(m, new THREE.SphereGeometry(0.9, 12, 10), [1, 1.35, 1], [x, 1.2, z]); // ovo
    else { const hh = 2.5 + (placed % 4) * 0.9; k.add(m, new THREE.CylinderGeometry(0.35, 0.5, hh, 8), [1, 1, 1], [x, hh / 2, z]).add(ceram[(placed + 1) % 4], new THREE.SphereGeometry(0.45, 8, 6), [1, 1.2, 1], [x, hh + 0.35, z]); }
    placed++;
  }
  // Templo do Sacrifício: pavilhão de tijolo com arco na frente e cúpula de azulejo azul, figura no topo
  const tp = data.buildings.find((b) => b.n === 'Templo do Sacrificío');
  if (tp) {
    const q = obb(ringOf(tp)), rot = Math.atan2(q.ux, q.uz), W = q.wid, L = q.len, blue = mat('#2c5d9c', { roughness: 0.3, metalness: 0.2 });
    const kt = new Kit();
    kt.box(brickD, W, 9, L, 0, 4.5, 0).box(arch, W + 0.1, 5, 3, 0, 2.5, 0);
    kt.add(mat('#c9c2b0'), new THREE.CylinderGeometry(W * 0.36, W * 0.4, 1.4, 16), [1, 1, 1], [0, 9.7, 0]);
    kt.add(blue, new THREE.SphereGeometry(W * 0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), [1, 1.15, 1], [0, 10.4, 0]);
    kt.add(ceram[0], new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8), [1, 1, 1], [0, 10.4 + W * 0.42 + 1.1, 0]).add(ceram[2], new THREE.SphereGeometry(0.4, 8, 6), [1, 1, 1], [0, 10.4 + W * 0.42 + 2.5, 0]);
    for (const s of [-1, 1]) kt.add(brick, new THREE.CylinderGeometry(0.8, 0.9, 11, 8), [1, 1, 1], [s * (W / 2), 5.5, L / 2]).add(blue, new THREE.SphereGeometry(0.9, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), [1, 1, 1], [s * (W / 2), 11, L / 2]);
    kt.build(group, q.cx, q.cz, rot);
  }
  // Accademia: bloco de tijolo com arcadas altas
  const ac = data.buildings.find((b) => b.n === 'Accademia');
  if (ac) { const f = frameOf(ac, env), ka = new Kit(); ka.box(brick, f.W, 10, f.L, 0, 5, 0); for (let z = -f.L / 2 + 3; z < f.L / 2 - 2; z += 4.5) for (const s of [1, -1]) ka.box(arch, 0.1, 6, 2.2, s * (f.W / 2 + 0.05), 3.5, z); ka.box(brickD, f.W + 0.6, 0.8, f.L + 0.6, 0, 10.2, 0); f.build(ka, group); }
  // palmeiras imperiais na alameda de entrada
  const en = data.buildings.find((b) => b.n === 'Entrada do Oficina Brennand');
  if (en) { const r = ringOf(en), cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[1], 0) / r.length; for (let i = 1; i <= 6; i++) for (const s of [-1, 1]) palm(k, mat, cx - 14 * i * 0.3 + s * 6, cz + 9 * i, 16); }
  k.build(group, 0, 0, 0, true, false);
  label('Oficina Francisco Brennand', o.cx, o.cz);
}

// Aeroporto Internacional do Recife/Guararapes – Gilberto Freyre: o salão comprido de vidro escuro debaixo da grande
// cobertura branca curva, com "RECIFE" na borda, as treliças brancas em arco por cima da via de embarque e as pontes
// de embarque envidraçadas do lado da pista. A torre de controle fica do outro lado do pátio.
function buildAeroporto(group, data, env, mat, label) {
  const t = data.buildings.find((b) => b.n === 'Terminal de Passageiros' && b.t === 'transportation');
  if (t) {
    // o salão principal é o trecho reto e comprido do contorno (os píeres saem dele)
    const ring = ringOf(t), o0 = obb(ring);
    const hall = ring.filter((p) => { const u = (p[0] - o0.cx) * o0.ux + (p[1] - o0.cz) * o0.uz; return Math.abs(u) < o0.len * 0.32; });
    const f = frameOf({ p: hall.length > 4 ? hall : ring }, env), W = Math.max(40, Math.min(f.W, 80)), L = Math.min(f.L, 300), k = new Kit();
    const glass = mat('#1f2a33', { roughness: 0.15, metalness: 0.6 }), white = mat('#f4f5f2', { roughness: 0.5 }), steel = mat('#e8eaea', { roughness: 0.4, metalness: 0.3 }), conc = mat('#c9c6bd', { roughness: 0.9 });
    k.box(conc, W, 1, L, 0, 0.5, 0).box(glass, W - 2, 13, L - 2, 0, 7.5, 0);
    // cobertura: casca curva (gomo de cilindro) deitada no eixo comprido, com balanço de 12 m sobre a via
    const R = (W + 24) * 0.9, ang = 2 * Math.asin((W + 24) / 2 / R), roof = new THREE.CylinderGeometry(R, R, L + 20, 40, 1, true, Math.PI - ang / 2, ang);
    roof.rotateX(Math.PI / 2); // eixo do cilindro ao longo de z; o gomo fica por cima (abóbada)
    const top = 19, cy = top - R;
    k.add(mat('#f6f6f3', { roughness: 0.45, side: THREE.DoubleSide }), roof, [1, 1, 1], [3, cy, 0], [0, 0, 0]);
    // borda escura da cobertura com o letreiro, do lado da via (+x)
    const edgeY = cy + Math.cos(ang / 2) * R;
    k.box(mat('#2a2f33', { roughness: 0.6 }), 0.6, 2.4, L + 20, 3 + (W + 24) / 2, edgeY - 0.9, 0);
    signX(k, signTex('RECIFE', null, '#f4f4f0', 1024, 160, 'bold 120px Arial'), 26, 3.4, 3 + (W + 24) / 2 + 0.35, edgeY - 0.9, 0, 0.2);
    for (let z = -L / 2 + 6; z < L / 2; z += 12) k.box(steel, 0.8, top - 1, 0.8, W / 2 + 13, (top - 1) / 2, z); // pilares da marquise
    // treliças brancas em arco sobre a via de embarque
    for (let z = -L / 2 + 15; z < L / 2 - 10; z += 24) k.add(steel, new THREE.TorusGeometry(9, 0.45, 6, 18, Math.PI), [1, 1, 1], [W / 2 + 24, 0.5, z]); // arco no plano x-y, atravessando a via
    // pontes de embarque do lado da pista (-x)
    for (let z = -L / 2 + 25; z < L / 2 - 15; z += 40) { k.box(glass, 26, 3.2, 3.4, -W / 2 - 13, 5.5, z).box(conc, 1.2, 4, 1.2, -W / 2 - 22, 2, z); }
    f.build(k, group);
    label('Aeroporto Internacional do Recife – Gilberto Freyre', f.o.cx, f.o.cz);
  }
  const tc = data.buildings.find((b) => b.n === 'Torre de Controle');
  if (tc) {
    const q = obb(ringOf(tc)), k = new Kit(), conc = mat('#d9d6ce', { roughness: 0.85 });
    k.add(conc, new THREE.CylinderGeometry(2.4, 3.2, 36, 12), [1, 1, 1], [0, 18, 0]).add(conc, new THREE.CylinderGeometry(5.2, 3, 3, 12), [1, 1, 1], [0, 37.5, 0]);
    k.add(mat('#2c3a44', { roughness: 0.1, metalness: 0.6 }), new THREE.CylinderGeometry(5, 5.2, 4, 12), [1, 1, 1], [0, 41, 0]).add(mat('#e9e9e4'), new THREE.CylinderGeometry(5.8, 5.8, 0.8, 12), [1, 1, 1], [0, 43.4, 0]);
    k.add(mat('#a32020'), new THREE.CylinderGeometry(0.15, 0.15, 6, 6), [1, 1, 1], [0, 46.8, 0]);
    k.build(group, q.cx, q.cz, 0);
  }
}

// ponto do contorno mais perto de (tx, tz), com a rotação que aponta +z local pra fora (normal da corda de ~30 m
// em volta do ponto, que funciona também nas fachadas curvas feitas de muitas arestas curtas)
function edgeToward(r, tx, tz) {
  const cx = r.reduce((s, p) => s + p[0], 0) / r.length, cz = r.reduce((s, p) => s + p[1], 0) / r.length;
  const pts = densify([...r, r[0]], 2), n = pts.length;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < n; i++) { const d = Math.hypot(pts[i][0] - tx, pts[i][1] - tz); if (d < bd) { bd = d; bi = i; } }
  const a = pts[(bi - 8 + n) % n], b = pts[(bi + 8) % n], [x, z] = pts[bi];
  let nx = -(b[1] - a[1]), nz = b[0] - a[0];
  if (nx * (x - cx) + nz * (z - cz) < 0) { nx = -nx; nz = -nz; }
  return { x, z, d: bd, yaw: Math.atan2(nx, nz) };
}
function densify(p, step) {
  const out = [];
  for (let i = 0; i < p.length - 1; i++) { const [ax, az] = p[i], [bx, bz] = p[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step)); for (let j = 0; j < n; j++) out.push([ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n]); }
  if (p.length) out.push(p.at(-1));
  return out;
}

// O Canal Derby-Tacaruna corre no meio da Agamenon, entre as duas pistas. O canal já vem do mapa; aqui entram as
// fileiras de árvores das duas margens, no canteiro entre a água e as pistas (fora da ciclovia).
function buildCanalAgamenon(group, data, env, mat, free) {
  const segs = [];
  for (const r of data.roads) {
    if (!/Agamenon Magalh/.test(r.n || '') || /link/.test(r.k)) continue;
    const w = Math.max(2, r.l || 2) * 3.3;
    for (let i = 0; i < r.p.length - 1; i++) { const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L > 1) segs.push({ ax, az, bx, bz, ux: (bx - ax) / L, uz: (bz - az) / L, L, w }); }
  }
  const hit = (px, pz, dx, dz, q) => { // raio p + d*t contra o segmento q
    const ex = q.bx - q.ax, ez = q.bz - q.az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-6) return null;
    const t = ((q.ax - px) * ez - (q.az - pz) * ex) / den, u = ((q.ax - px) * dz - (q.az - pz) * dx) / den;
    return u >= 0 && u <= 1 && t > 0 ? t : null;
  };
  const cells = new Map();
  for (const s of segs) for (let d = 4; d < s.L; d += 8) {
    const px = s.ax + s.ux * d, pz = s.az + s.uz * d;
    let best = null;
    for (const side of [1, -1]) {
      const nx = -s.uz * side, nz = s.ux * side;
      for (const q of segs) { if (q === s || s.ux * q.ux + s.uz * q.uz > -0.85) continue; const t = hit(px, pz, nx, nz, q); if (t && t > 14 && t < 70 && (!best || t < best.t)) best = { t, nx, nz, w: (s.w + q.w) / 2 }; }
    }
    if (!best) continue;
    const mx = px + best.nx * best.t / 2, mz = pz + best.nz * best.t / 2, key = Math.round(mx / 7) + ',' + Math.round(mz / 7);
    if (!cells.has(key)) cells.set(key, { x: mx, z: mz, ux: s.ux, uz: s.uz, gap: best.t, w: best.w });
  }
  const kt = new Kit();
  const trunk = mat('#6b5440', { roughness: 0.95 }), leaf = [mat('#3f7f35', { roughness: 0.9 }), mat('#4d8f3c', { roughness: 0.9 }), mat('#356f2e', { roughness: 0.9 })];
  const crown = new THREE.IcosahedronGeometry(1, 1);
  let n = 0;
  for (const c of cells.values()) {
    const nx = -c.uz, nz = c.ux, half = (c.gap - c.w) / 2 - 1.5;
    if (half < 3) continue;
    // de cada lado: anda do meio pra fora até sair da água e planta na margem (fora da ciclovia e da pista)
    for (const s of [-1, 1]) {
      let wet = false, spot = null;
      for (let d = 0; d <= half; d += 0.75) {
        const x = c.x + nx * s * d, z = c.z + nz * s * d;
        if (env.isWater(x, z)) { wet = true; continue; }
        if (wet || d > 2) { const tx = x + nx * s * 1.2, tz = z + nz * s * 1.2; if (d + 1.2 <= half && free(tx, tz)) spot = [tx, tz]; break; }
      }
      if (!spot || (n + (s > 0 ? 1 : 0)) % 2) continue;
      const [tx, tz] = spot, h = 5 + ((n * 7 + (s > 0 ? 3 : 0)) % 5) * 0.7;
      leafyTree(kt, tx, tz, h / 5.5, ['#5f8f3f', '#6f9d48', '#4e7a37'][(n + (s > 0 ? 1 : 0)) % 3], n % 3 ? 'round' : 'wide');
      stampDisc(tx, tz, 0.3);
    }
    n++;
  }
  if (n) kt.build(group, 0, 0, 0, true, false);
}

// Praça do Arsenal: piso de placas brancas de concreto com juntas de grama, gramado no meio com o canteiro redondo
// de mureta branca e agaves, palmeiras imperiais altas, amendoeiras na borda, pufes brancos e postes pretos.
function buildArsenal(group, data, env, mat) {
  const poly = data.arsenal; if (!poly) return;
  const [cx, cz] = data.arsenalC;
  const inside = (x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, az] = poly[i], [bx, bz] = poly[j]; if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) c = !c; } return c; };
  const ok = (x, z) => inside(x, z) && !env.isSolid(x, z) && !env.isDrive?.(x, z);
  // piso: placas de 1,2 m com junta de grama (textura em metros do mundo)
  const tex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#6f9a4a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 228 + ((i * 7 + j * 3) % 5) * 4; g.fillStyle = `rgb(${v},${v},${v - 6})`; g.fillRect(i * 64 + 4, j * 64 + 4, 56, 56); }
  });
  tex.repeat.set(1 / 4.8, 1 / 4.8);
  const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  floor.position.y = 0.07; floor.receiveShadow = true; group.add(floor);
  const k = new Kit();
  const grass = mat('#5f9a3e', { roughness: 0.95 }), white = mat('#f1f0ea', { roughness: 0.6 }), soil = mat('#5a4636', { roughness: 1 });
  // gramado retangular no meio (orientado pelo lado mais comprido do quarteirão)
  const yaw = Math.atan2(poly[2][0] - poly[0][0], poly[2][1] - poly[0][1]) + Math.PI / 2;
  k.box(grass, 30, 0.06, 22, cx, 0.09, cz, [0, yaw, 0]);
  // canteiro redondo de mureta branca com agaves
  k.add(white, new THREE.CylinderGeometry(7.2, 7.2, 0.5, 48, 1, true), [1, 1, 1], [cx, 0.3, cz]).add(white, new THREE.TorusGeometry(7.0, 0.32, 6, 48).rotateX(Math.PI / 2), [1, 1, 0.6], [cx, 0.55, cz]);
  k.add(soil, new THREE.CylinderGeometry(6.8, 6.8, 0.1, 40), [1, 1, 1], [cx, 0.3, cz]);
  const agave = mat('#4f8a5a', { roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 1 + (i % 6) * 0.95, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; for (let l = 0; l < 6; l++) k.add(agave, new THREE.ConeGeometry(0.12, 1.1, 3), [1, 1, 1], [x, 0.85, z], [0.6, l * 1.05, 0], 'YXZ'); }
  // palmeiras imperiais
  const trunk = mat('#c9c2b4', { roughness: 0.9 }), frond = mat('#3f7f35', { side: THREE.DoubleSide, roughness: 0.8 });
  const palms = [[0.55, 11], [1.3, 12], [2.1, 10.5], [2.9, 13], [3.7, 11.5], [4.6, 12.5], [5.4, 10], [6.0, 14]];
  for (const [a, r] of palms) {
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, h = 16 + (r % 3) * 2; if (!ok(x, z)) continue;
    k.add(trunk, new THREE.CylinderGeometry(0.2, 0.32, h, 8), [1, 1, 1], [x, h / 2, z]).add(mat('#7a9a52'), new THREE.CylinderGeometry(0.3, 0.24, 1.8, 8), [1, 1, 1], [x, h + 0.7, z]);
    for (let f = 0; f < 9; f++) k.add(frond, new THREE.ConeGeometry(0.55, 4.6, 4, 1).rotateX(Math.PI / 2).scale(1, 0.15, 1).translate(0, 0, 2.3), [1, 1, 1], [x, h + 1.5, z], [0.45 + (f % 2) * 0.25, (f / 9) * Math.PI * 2, 0], 'YXZ');
    stampDisc(x, z, 0.35);
  }
  // amendoeiras (copa larga) e postes pretos na borda; pufes brancos no piso
  const leafs = [mat('#4a8a3a', { roughness: 0.9 }), mat('#3b7a30', { roughness: 0.9 }), mat('#5b9a42', { roughness: 0.9 })], bark = mat('#6b5440', { roughness: 0.95 });
  const crown = new THREE.IcosahedronGeometry(1, 2), black = mat('#1c1c1c', { metalness: 0.5, roughness: 0.4 }), glow = mat('#fff4d6', { emissive: '#fff0c8', emissiveIntensity: 0.3 });
  let n = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az);
    for (let d = 4; d < L - 3; d += 9) {
      const t = d / L, ex = ax + (bx - ax) * t, ez = az + (bz - az) * t, ix = ex + (cx - ex) * 0.12, iz = ez + (cz - ez) * 0.12;
      if (!ok(ix, iz)) continue;
      if (n % 2 === 0) { leafyTree(k, ix, iz, 1.15 + (n % 3) * 0.1, ['#5f8f3f', '#6f9d48', '#557f39'][n % 3]); stampDisc(ix, iz, 0.4); }
      else { k.add(black, new THREE.CylinderGeometry(0.06, 0.09, 4.2, 8), [1, 1, 1], [ix, 2.1, iz]).add(black, new THREE.CylinderGeometry(0.22, 0.12, 0.5, 8), [1, 1, 1], [ix, 4.4, iz]).add(glow, new THREE.CylinderGeometry(0.16, 0.16, 0.25, 8), [1, 1, 1], [ix, 4.2, iz]); stampDisc(ix, iz, 0.15); }
      // pufe branco um pouco pra dentro
      const px = ex + (cx - ex) * 0.3, pz = ez + (cz - ez) * 0.3;
      if (ok(px, pz) && Math.hypot(px - cx, pz - cz) > 12) { k.add(white, new THREE.CapsuleGeometry(0.3, 0.7, 4, 8).rotateZ(Math.PI / 2), [1, 0.8, 1.2], [px, 0.3, pz], [0, Math.atan2(bx - ax, bz - az), 0]); stampDisc(px, pz, 0.5); }
      n++;
    }
  }
  k.build(group, 0, 0, 0, true, false);
  stampDisc(cx, cz, 7.3);
}
