// Marco Zero (Praça Rio Branco) e entorno, a partir de fotos: piso cor-de-rosa/terracota, a Rosa dos Ventos de
// Cícero Dias colorida no chão, o medalhão de bronze, coqueiros nas laterais, barquinhos no cais, carrinhos coloridos;
// os prédios em volta (torre redonda de vidro, Associação Comercial com as torrinhas de cúpula, Caixa Cultural amarela
// com cúpulas douradas, o prédio verde, o Centro de Artesanato e o galpão do cais) e, do outro lado, o Parque das
// Esculturas de Brennand com a Torre de Cristal, os arcos de tijolo e os totens.
import * as THREE from 'three';
import { Kit, obb, ringOf } from './classics.js';
import { stampDisc } from './collide.js';
import { pisoElevado } from './rua.js';

const BX = new THREE.BoxGeometry(1, 1, 1);
// prédios do OSM sem nome, achados pelo centro do contorno
const PICK = [
  ['Torre Redonda do Marco Zero', 3075, -3768],
  ['Associação Comercial de Pernambuco', 3075, -3834],
  ['Prédio Verde do Marco Zero', 3061, -3803],
  ['Galpão do Cais do Marco Zero', 3085, -3699],
];
export const MZ_SKIP = ['Torre Redonda do Marco Zero', 'Associação Comercial de Pernambuco', 'Caixa Cultural', 'Centro de Artesanato de Pernambuco', 'Galpão do Cais do Marco Zero', 'Coluna de Cristal'];

export function prepareMarcoZero(data) {
  for (const [name, x, z] of PICK) {
    let best = null, bd = 6;
    for (const b of data.buildings) { if (b.n) continue; const d = Math.hypot(b.cx - x, b.cz - z); if (d < bd) { bd = d; best = b; } }
    if (best) best.n = name;
  }
  // o prédio verde fica com o contorno genérico, só pintado e mais alto (a cúpula vem em buildMarcoZero)
  for (const b of data.buildings) if (b.n === 'Prédio Verde do Marco Zero') { b.c = '#5fbf98'; b.h = 17; b.style = 'colonial'; }
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// Rosa dos Ventos de Cícero Dias: anel claro com a linha azul, miolo de triângulos coloridos, medalhão no centro
function rosaTex() {
  return canvasTex(1024, 1024, (g, W) => {
    const c = W / 2, R = W / 2 - 4;
    g.fillStyle = '#e9b9a6'; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();                 // anel rosa claro
    g.strokeStyle = '#3f8fd0'; g.lineWidth = 16; g.beginPath(); g.arc(c, c, R - 10, 0, Math.PI * 2); g.stroke(); // linha azul
    g.strokeStyle = 'rgba(120,60,40,.25)'; g.lineWidth = 2; for (let r = 60; r < R - 30; r += 34) { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
    const r1 = R * 0.56;
    g.fillStyle = '#f5ece0'; g.beginPath(); g.arc(c, c, r1 + 12, 0, Math.PI * 2); g.fill();          // aro branco
    const COLS = ['#f2c230', '#4fb06a', '#3f8fd0', '#e9707f', '#f08a3c', '#7fc6d8', '#d8483f', '#9bc75a'];
    // estrela de 16 pontas com triângulos coloridos (metade clara, metade escura de cada ponta)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2, a1 = a - Math.PI / 16, a2 = a + Math.PI / 16, long = i % 2 === 0 ? r1 : r1 * 0.7, ri = r1 * 0.22;
      for (const [aa, col] of [[a1, COLS[i % 8]], [a2, COLS[(i + 3) % 8]]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * long, c + Math.sin(a) * long); g.lineTo(c + Math.cos(aa) * ri * 1.6, c + Math.sin(aa) * ri * 1.6); g.closePath(); g.fill();
      }
    }
    g.fillStyle = '#e8d9c2'; g.beginPath(); g.arc(c, c, r1 * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(c, c, r1 * 0.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2a1a'; g.font = 'bold 38px Georgia'; g.textAlign = 'center';
    for (const [t, a] of [['N', -Math.PI / 2], ['L', 0], ['S', Math.PI / 2], ['O', Math.PI]]) g.fillText(t, c + Math.cos(a) * (R - 60), c + Math.sin(a) * (R - 60) + 13);
  });
}
// medalhão de bronze "Marco Zero · Recife · Pernambuco"
function medalTex() {
  return canvasTex(512, 512, (g) => {
    const gr = g.createRadialGradient(256, 230, 40, 256, 256, 250); gr.addColorStop(0, '#d4b06a'); gr.addColorStop(1, '#7a5a2a');
    g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#5a4020'; g.lineWidth = 8; for (const r of [244, 170, 110]) { g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#4a3418'; g.font = 'bold 40px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ring = (txt, r, start) => { const n = txt.length; for (let i = 0; i < n; i++) { const a = start + (i / n) * Math.PI * 1.7; g.save(); g.translate(256 + Math.cos(a) * r, 256 + Math.sin(a) * r); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, 0); g.restore(); } };
    ring('MARCO ZERO · RECIFE · PERNAMBUCO ·', 205, -Math.PI * 1.35);
    g.font = 'bold 54px Georgia'; g.fillText('0', 256, 260);
  });
}

export function buildMarcoZero(group, data, env, mat) {
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z) && !env.isRoad?.(x, z);
  const byName = (n) => data.buildings.find((b) => b.n === n);
  const rosa = data.pois.find((p) => p.name === 'Rosa dos Ventos');
  const plaza = data.parks.filter((p) => p.k === 'plaza' && rosa && insideRing(p.p, rosa.x, rosa.z)).sort((a, b) => b.p.length - a.p.length)[0];

  // ---------------- piso da praça: cor-de-rosa/terracota em placas
  if (plaza) {
    const tex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#c99482'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const v = (i * 13 + j * 7) % 5; g.fillStyle = `rgba(${150 + v * 8},${95 + v * 6},${80 + v * 5},.35)`; g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1 / 8, 1 / 8);
    const sh = new THREE.Shape(plaza.p.map(([x, z]) => new THREE.Vector2(x, -z)));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.position.y = 0.075; m.receiveShadow = true; group.add(m);
    pisoElevado({ p: plaza.p }, 0.075); // quem anda sobe no piso (rua.js/curbHeight), senão o pé afunda
  }
  // ---------------- Rosa dos Ventos e medalhão
  if (rosa) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(18, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rosaTex(), roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
    disc.position.set(rosa.x, 0.1, rosa.z); disc.receiveShadow = true; group.add(disc);
    pisoElevado({ x: rosa.x, z: rosa.z, r: 18 }, 0.1);
    const mz = data.pois.find((p) => p.name === 'Marco Zero') || rosa;
    let mx = mz.x, mzz = mz.z; if (Math.hypot(mx - rosa.x, mzz - rosa.z) < 19) { mx = rosa.x - 22; mzz = rosa.z; }
    const med = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: medalTex(), metalness: 0.7, roughness: 0.35 }));
    med.position.set(mx, 0.12, mzz); group.add(med);
    const ring = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e6d8c0', roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    ring.position.set(mx, 0.105, mzz); group.add(ring);
  }
  // ---------------- coqueiros nas laterais, barquinhos no cais, carrinhos coloridos
  if (plaza && rosa) {
    const k = new Kit(), trunk = mat('#b9ab92', { roughness: 0.9 }), frond = mat('#3f7f35', { side: THREE.DoubleSide, roughness: 0.8 });
    let n = 0;
    for (let i = 0; i < plaza.p.length; i++) {
      const [x, z] = plaza.p[i], dx = x - rosa.x, dz = z - rosa.z, d = Math.hypot(dx, dz);
      if (d < 26) continue;
      const px = x - (dx / d) * 4, pz = z - (dz / d) * 4; if (!free(px, pz) || i % 2) continue;
      const h = 9 + (n % 3) * 1.5;
      k.add(trunk, new THREE.CylinderGeometry(0.17, 0.27, h, 7), [1, 1, 1], [px, h / 2, pz], [(n % 2 - 0.5) * 0.12, 0, 0.06]);
      for (let f = 0; f < 8; f++) k.add(frond, new THREE.ConeGeometry(0.5, 4.0, 4, 1).rotateX(Math.PI / 2).scale(1, 0.15, 1).translate(0, 0, 2.0), [1, 1, 1], [px, h + 0.2, pz], [0.5 + (f % 2) * 0.2, (f / 8) * Math.PI * 2, 0], 'YXZ');
      stampDisc(px, pz, 0.3); n++;
    }
    // barquinhos coloridos atracados no cais (lado do rio)
    const COLS = ['#d7263d', '#f2f2ee', '#2a9d8f', '#f2b705', '#1d5fa8'];
    let b = 0;
    for (let i = 0; i < plaza.p.length && b < 7; i += 2) {
      const [x, z] = plaza.p[i], dx = x - rosa.x, dz = z - rosa.z, d = Math.hypot(dx, dz) || 1;
      const wx = x + (dx / d) * 6, wz = z + (dz / d) * 6; if (!env.isWater(wx, wz)) continue;
      const yaw = Math.atan2(-dz, dx); // de lado pro cais
      k.add(mat(COLS[b % 5], { roughness: 0.6 }), new THREE.CylinderGeometry(0.75, 0.55, 5, 10, 1, false, 0, Math.PI), [1, 1, 1], [wx, 0.35, wz], [0, yaw, Math.PI / 2], 'YXZ');
      k.box(mat('#8a6a48'), 0.15, 0.1, 1.3, wx, 0.5, wz, [0, yaw + Math.PI / 2, 0]);
      b++;
    }
    // carrinhos coloridos (artesanato, picolé) na praça
    for (const [ox, oz, cs] of [[-12, 14, ['#ff6a13', '#2a9d8f', '#f2b705']], [10, -15, ['#e05297', '#1d5fa8', '#f2c230']]]) {
      const x = rosa.x + ox, z = rosa.z + oz; if (!free(x, z)) continue;
      for (let i = 0; i < 3; i++) k.box(mat(cs[i]), 0.9, 1.2, 0.9, x + i * 1.0, 0.6, z).box(mat('#f2f2ee'), 1.0, 0.1, 1.0, x + i * 1.0, 1.25, z);
      stampDisc(x + 1, z, 1.6);
    }
    k.build(group, 0, 0, 0, true, false);
  }

  // ---------------- prédios em volta
  // gira o prédio num dos quatro lados do contorno, o que mais encara a praça; devolve as medidas certas de x e z
  const front = (o, tx, tz) => {
    const want = Math.atan2(tx - o.cx, tz - o.cz), base = Math.atan2(o.ux, o.uz);
    let best = 0, bd = Infinity;
    for (let q = 0; q < 4; q++) { const a = base + (q * Math.PI) / 2, d = Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want))); if (d < bd) { bd = d; best = q; } }
    const yaw = base + (best * Math.PI) / 2, odd = best % 2 === 1;
    return [o.cx, o.cz, yaw, odd ? o.len : o.wid, odd ? o.wid : o.len];
  };
  const face = rosa ? [rosa.x, rosa.z] : [3128, -3798];

  // torre redonda de vidro escuro, com lajes brancas
  const tr = byName('Torre Redonda do Marco Zero');
  if (tr) {
    const o = obb(ringOf(tr)), R = Math.min(o.len, o.wid) / 2 - 0.3, H = 44, k = new Kit();
    const glassTex = canvasTex(128, 128, (g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#3b4e5a'); gr.addColorStop(1, '#1b252c'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = '#5d7280'; g.fillRect(0, 0, 3, 128); });
    glassTex.wrapS = glassTex.wrapT = THREE.RepeatWrapping; glassTex.repeat.set(24, H / 3.3);
    k.add(new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.15, metalness: 0.6 }), new THREE.CylinderGeometry(R, R, H, 40), [1, 1, 1], [0, H / 2, 0]);
    for (let y = 4; y < H; y += 3.3) k.add(mat('#e9e9e4'), new THREE.CylinderGeometry(R + 0.25, R + 0.25, 0.35, 40), [1, 1, 1], [0, y, 0]);
    k.add(mat('#e9e9e4'), new THREE.CylinderGeometry(R + 0.4, R + 0.4, 2.2, 40), [1, 1, 1], [0, H + 1.1, 0]);
    k.add(mat('#2a3338'), new THREE.CylinderGeometry(R + 0.1, R + 0.1, 4, 40), [1, 1, 1], [0, 2, 0]);
    k.build(group, o.cx, o.cz, 0);
  }
  // Associação Comercial de Pernambuco: eclético creme, duas torrinhas redondas com cúpula cinza, frontão e porta em arco
  const ac = byName('Associação Comercial de Pernambuco');
  if (ac) {
    const o = obb(ringOf(ac)), [cx, cz, yaw, W, D] = front(o, ...face), H = 17, k = new Kit();
    const cream = mat('#efe2c0', { roughness: 0.8 }), white = mat('#f8f4ea', { roughness: 0.6 }), dome = mat('#8f9aa0', { metalness: 0.5, roughness: 0.4 }), red = mat('#8a2f22', { roughness: 0.6 }), win = mat('#6b2a20', { roughness: 0.5 });
    k.box(cream, W, H, D, 0, H / 2, 0);
    for (const y of [5.5, 11.2, H]) k.box(white, W + 0.5, 0.5, D + 0.5, 0, y, 0);
    // janelas em arco da fachada (lado +z = frente)
    for (let x = -W / 2 + 3.5; x <= W / 2 - 3.5; x += 2.6) for (const y of [2.6, 8.2, 13.8]) { if (Math.abs(x) < 3 && y < 6) continue; k.box(win, 1.1, 2.2, 0.12, x, y, D / 2 + 0.05); k.add(win, new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12, 1, false, -Math.PI / 2, Math.PI), [1, 1, 1], [x, y + 1.1, D / 2 + 0.05], [Math.PI / 2, 0, 0]); }
    // porta grande em arco, vermelha
    k.box(red, 3.4, 4.2, 0.2, 0, 2.1, D / 2 + 0.06).add(red, new THREE.CylinderGeometry(1.7, 1.7, 0.2, 16, 1, false, -Math.PI / 2, Math.PI), [1, 1, 1], [0, 4.2, D / 2 + 0.06], [Math.PI / 2, 0, 0]);
    k.box(white, 6, 0.4, 0.8, 0, 6.6, D / 2 + 0.3); // sacada
    // frontão curvo no meio, com ornamento
    k.add(cream, new THREE.CylinderGeometry(4.2, 4.2, 0.8, 24, 1, false, -Math.PI / 2, Math.PI), [1, 0.7, 1], [0, H, D / 2 - 0.4], [Math.PI / 2, 0, 0]).box(white, 0.5, 2, 0.5, 0, H + 3.2, D / 2 - 0.4);
    // escadaria
    for (let i = 0; i < 4; i++) k.box(mat('#d8d0c0'), 7 - i * 0.6, 0.18, 1.2, 0, 0.09 + i * 0.18, D / 2 + 1.6 - i * 0.3);
    // torrinhas redondas nos cantos da frente
    for (const sx of [-1, 1]) {
      const tx = sx * (W / 2 - 1.6), tz = D / 2 - 1.6;
      k.add(cream, new THREE.CylinderGeometry(2.4, 2.4, H + 3, 20), [1, 1, 1], [tx, (H + 3) / 2, tz]);
      for (const y of [5.5, 11.2, H + 3]) k.add(white, new THREE.CylinderGeometry(2.65, 2.65, 0.45, 20), [1, 1, 1], [tx, y, tz]);
      k.add(dome, new THREE.SphereGeometry(2.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), [1, 1.5, 1], [tx, H + 3.2, tz]);
      k.add(white, new THREE.CylinderGeometry(0.06, 0.12, 2.4, 6), [1, 1, 1], [tx, H + 7.6, tz]);
    }
    k.build(group, cx, cz, yaw);
  }
  // Caixa Cultural (antiga Bolsa de Valores): amarela, frisos brancos, torres redondas de quina com cúpula dourada
  const cc = byName('Caixa Cultural');
  if (cc) {
    const o = obb(ringOf(cc)), [cx, cz, yaw, W, D] = front(o, ...face), H = 18, k = new Kit();
    const yel = mat('#f0c64a', { roughness: 0.8 }), white = mat('#f8f4ea', { roughness: 0.6 }), gold = mat('#c8a24e', { metalness: 0.75, roughness: 0.3 }), win = mat('#5f6f62', { roughness: 0.4 }), base = mat('#e8e4dc', { roughness: 0.7 });
    k.box(yel, W, H, D, 0, H / 2, 0).box(base, W + 0.2, 3.2, D + 0.2, 0, 1.6, 0);
    for (const y of [3.3, 9.5, H]) k.box(white, W + 0.5, 0.45, D + 0.5, 0, y, 0);
    for (const [fx, fz, len, rot] of [[0, D / 2 + 0.05, W, 0], [W / 2 + 0.05, 0, D, Math.PI / 2], [-W / 2 - 0.05, 0, D, -Math.PI / 2]]) {
      for (let t = -len / 2 + 3; t <= len / 2 - 3; t += 2.4) {
        const x = fx + Math.cos(rot) * t, z = fz - Math.sin(rot) * t;
        k.box(win, 1.0, 2.3, 0.12, x, 1.5, z, [0, rot, 0]).box(win, 1.0, 2.0, 0.12, x, 6.5, z, [0, rot, 0]).box(win, 1.0, 2.0, 0.12, x, 12.5, z, [0, rot, 0]);
      }
    }
    k.box(mat('#d9d2a8'), 2.8, 3.4, 0.2, 0, 1.7, D / 2 + 0.08).add(white, new THREE.CylinderGeometry(1.6, 1.6, 0.3, 16, 1, false, -Math.PI / 2, Math.PI), [1, 1, 1], [0, 3.5, D / 2 + 0.1], [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
      const tx = sx * (W / 2 - 2.2), tz = D / 2 - 2.2;
      k.add(yel, new THREE.CylinderGeometry(3.2, 3.2, H + 2, 22), [1, 1, 1], [tx, (H + 2) / 2, tz]);
      for (const y of [3.3, 9.5, H + 2]) k.add(white, new THREE.CylinderGeometry(3.45, 3.45, 0.45, 22), [1, 1, 1], [tx, y, tz]);
      k.add(gold, new THREE.CylinderGeometry(2.7, 2.7, 1.4, 22), [1, 1, 1], [tx, H + 2.9, tz]); // tambor com as grades
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; k.box(mat('#5a4a2a'), 0.12, 1.1, 0.06, tx + Math.cos(a) * 2.72, H + 2.9, tz + Math.sin(a) * 2.72, [0, -a, 0]); }
      k.add(gold, new THREE.SphereGeometry(2.7, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), [1, 1.05, 1], [tx, H + 3.6, tz]);
      k.add(mat('#6b6b6b', { metalness: 0.6 }), new THREE.CylinderGeometry(0.05, 0.08, 4, 6), [1, 1, 1], [tx, H + 8, tz]);
    }
    // estandartes coloridos na fachada
    [['#d7263d', -W / 4], ['#1d3f8f', W / 4]].forEach(([c, x]) => k.box(mat(c), 0.9, 4.5, 0.08, x, 11.5, D / 2 + 0.6));
    k.build(group, cx, cz, yaw);
  }
  // prédio verde: cupulazinha na quina
  const pv = byName('Prédio Verde do Marco Zero');
  if (pv) {
    const o = obb(ringOf(pv)), [cx, cz, yaw, W, D] = front(o, ...face), k = new Kit(), g = mat('#5fbf98'), w = mat('#f4f1ea');
    const tx = W / 2 - 2, tz = D / 2 - 2;
    k.add(g, new THREE.CylinderGeometry(2, 2, 3, 16), [1, 1, 1], [tx, 18.5, tz]).add(w, new THREE.CylinderGeometry(2.2, 2.2, 0.4, 16), [1, 1, 1], [tx, 17.2, tz]).add(mat('#c8a24e', { metalness: 0.7, roughness: 0.3 }), new THREE.SphereGeometry(2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), [1, 1.3, 1], [tx, 20, tz]);
    k.build(group, cx, cz, yaw, true, false);
  }
  // galpões do cais: Centro de Artesanato (bege, pórtico com o letreiro colorido) e o galpão amarelo de telhado laranja
  const galpao = (b, wallC, roofC, sign) => {
    if (!b) return;
    const o = obb(ringOf(b)), L = o.len, W = o.wid, H = 8, k = new Kit();
    const rot = Math.atan2(o.ux, o.uz); // z local no eixo comprido
    k.box(mat(wallC, { roughness: 0.85 }), W, H, L, 0, H / 2, 0);
    const sh = new THREE.Shape(); sh.moveTo(-W / 2 - 0.6, 0); sh.lineTo(W / 2 + 0.6, 0); sh.lineTo(0, W * 0.28); sh.closePath();
    k.add(mat(roofC, { roughness: 0.75 }), new THREE.ExtrudeGeometry(sh, { depth: L + 1.2, bevelEnabled: false }).translate(0, 0, -(L + 1.2) / 2), [1, 1, 1], [0, H, 0]);
    for (let z = -L / 2 + 4; z < L / 2 - 3; z += 6) for (const s of [1, -1]) k.box(mat('#7a4b30'), 0.12, 3.6, 2.4, s * (W / 2 + 0.05), 1.8, z);
    if (sign) {
      // ponta que dá pra praça: pórtico e o painel colorido
      const toward = rosa ? Math.sign((rosa.x - o.cx) * o.ux + (rosa.z - o.cz) * o.uz) || 1 : 1, ez = toward * (L / 2 + 0.6);
      k.box(mat('#e2d3b6'), W + 1.6, H + 2, 1.2, 0, (H + 2) / 2, ez);
      const t = canvasTex(512, 512, (g) => {
        g.fillStyle = '#efe4cd'; g.fillRect(0, 0, 512, 512);
        const cols = ['#e63946', '#2a9d8f', '#f4a261', '#e9c46a', '#8338ec', '#1d5fa8'];
        g.font = 'bold 70px Arial Black, Arial'; g.textAlign = 'center';
        g.fillStyle = '#2b1d14'; g.font = 'bold 34px Arial'; g.fillText('ARTESANATO DE', 256, 110);
        g.font = 'bold 92px Arial Black, Arial'; const word = 'PERNAMBUCO'; let x = 40;
        [['PER', 230], ['NAM', 330], ['BUCO', 430]].forEach(([w, y], j) => { for (let i = 0; i < w.length; i++) { g.fillStyle = cols[(i + j * 2) % cols.length]; g.fillText(w[i], 140 + i * 82, y); } });
        void word; void x;
        g.fillStyle = '#2b1d14'; g.font = 'bold 28px Arial'; g.fillText('UNIDADE RECIFE', 256, 480);
      });
      k.add(new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), new THREE.PlaneGeometry(W * 0.45, H * 0.9), [1, 1, 1], [-W * 0.22, H * 0.5, ez + toward * 0.62], [0, toward > 0 ? 0 : Math.PI, 0]);
      k.box(mat('#9fb8c2', { roughness: 0.1, metalness: 0.5 }), W * 0.4, H * 0.55, 0.1, W * 0.22, H * 0.3, ez + toward * 0.62);
    }
    k.build(group, o.cx, o.cz, rot);
  };
  galpao(byName('Centro de Artesanato de Pernambuco'), '#e6d6b8', '#cfc5b4', true);
  galpao(byName('Galpão do Cais do Marco Zero'), '#f0c64a', '#e0702c', false);

  // ---------------- Parque das Esculturas: Torre de Cristal, arcos de tijolo e totens
  const col = byName('Coluna de Cristal') || data.pois.find((p) => /Coluna de Cristal/.test(p.name));
  if (col) {
    const cx = col.cx ?? col.x, cz = col.cz ?? col.z, k = new Kit();
    const brick = mat('#a4553a', { roughness: 0.95 }), steel = mat('#8f979c', { metalness: 0.6, roughness: 0.35 }), dark = mat('#3b4246', { roughness: 0.5 }), terra = mat('#b5683f', { roughness: 0.9 }), cream = mat('#ece3d0', { roughness: 0.7 });
    // base de tijolo
    k.box(brick, 5, 3, 5, cx, 1.5, cz).box(mat('#8a4530'), 5.4, 0.3, 5.4, cx, 3.1, cz);
    // fuste: miolo escuro + treliça clara vazada (anéis ovais) e duas bandas
    const H0 = 3.2, H1 = 30;
    k.add(dark, new THREE.CylinderGeometry(1.0, 1.15, H1 - H0, 14), [1, 1, 1], [cx, (H0 + H1) / 2, cz]);
    const lat = canvasTex(256, 512, (g) => { g.fillStyle = '#9aa2a6'; g.fillRect(0, 0, 256, 512); g.globalCompositeOperation = 'destination-out'; for (let y = 20; y < 512; y += 64) for (let x = (y / 64) % 2 ? 0 : 64; x < 256; x += 128) { g.beginPath(); g.ellipse(x + 32, y + 12, 34, 26, 0, 0, Math.PI * 2); g.fill(); } });
    lat.wrapS = lat.wrapT = THREE.RepeatWrapping; lat.repeat.set(2, 5);
    k.add(new THREE.MeshStandardMaterial({ map: lat, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 }), new THREE.CylinderGeometry(1.45, 1.6, H1 - H0, 20, 1, true), [1, 1, 1], [cx, (H0 + H1) / 2, cz]);
    for (const y of [H0 + 1, 17, H1 - 0.5]) k.add(steel, new THREE.CylinderGeometry(1.75, 1.75, 0.6, 20), [1, 1, 1], [cx, y, cz]);
    // braços em cruz (embaixo e em cima) com cabecinhas
    for (const y of [H0 + 2.5, H1 - 2]) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; k.box(dark, 3.4, 0.25, 0.25, cx + Math.cos(a) * 2.2, y, cz + Math.sin(a) * 2.2, [0, -a, 0]); k.add(cream, new THREE.SphereGeometry(0.28, 8, 6), [1, 1, 1], [cx + Math.cos(a) * 3.9, y + 0.15, cz + Math.sin(a) * 3.9]); }
    // pinha espinhenta no topo
    k.add(steel, new THREE.SphereGeometry(1.6, 16, 12), [1, 1.6, 1], [cx, H1 + 2, cz]);
    for (let i = 0; i < 30; i++) { const a = i * 2.4, yy = H1 + 0.6 + (i % 6) * 0.55, rr = 1.55 * Math.sin(Math.PI * ((i % 6) + 1) / 7); k.add(steel, new THREE.ConeGeometry(0.16, 0.6, 5), [1, 1, 1], [cx + Math.cos(a) * rr, yy, cz + Math.sin(a) * rr], [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2]); }
    k.add(steel, new THREE.ConeGeometry(0.4, 1.6, 8), [1, 1, 1], [cx, H1 + 5, cz]);
    stampDisc(cx, cz, 2.6);
    // arcos de tijolo com pinha e totens de terracota com cabeças, ao longo do molhe
    let placed = 0;
    for (let r = 10; r < 140 && placed < 10; r += 9) for (const a of [0, Math.PI, Math.PI / 2, -Math.PI / 2, 0.8, -0.8, 2.3, -2.3]) {
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (!free(x, z) || !free(x + 1.5, z) || !free(x - 1.5, z)) continue;
      if (placed % 2 === 0) {
        k.box(brick, 0.9, 5, 0.9, x - 1.6, 2.5, z).box(brick, 0.9, 5, 0.9, x + 1.6, 2.5, z).add(brick, new THREE.TorusGeometry(1.6, 0.45, 6, 12, Math.PI), [1, 1, 1], [x, 5, z]);
        for (const sx of [-1.6, 1.6]) k.add(mat('#4b5257', { metalness: 0.4 }), new THREE.SphereGeometry(0.45, 10, 8), [1, 1.4, 1], [x + sx, 5.8, z]);
      } else {
        for (let j = 0; j < 5; j++) k.add(j % 2 ? cream : terra, new THREE.CylinderGeometry(0.42, 0.46, 1.1, 14), [1, 1, 1], [x, 0.55 + j * 1.1, z]);
        k.add(cream, new THREE.SphereGeometry(0.42, 12, 10), [1, 1.3, 1], [x, 6.1, z]).add(cream, new THREE.ConeGeometry(0.35, 0.6, 10), [1, 1, 1], [x, 6.8, z]);
      }
      stampDisc(x, z, 1); placed++; break;
    }
    k.build(group, 0, 0, 0, true, false);
  }
}

function insideRing(r, x, z) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [ax, az] = r[i], [bx, bz] = r[j]; if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) c = !c; } return c; }
void BX;
