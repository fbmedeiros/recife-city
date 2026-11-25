// Lugares pedidos pela galera: estádio do Arruda (Santa Cruz), colégios (portal, letreiro e mastros), pista de
// caminhada e quiosques do Parque da Jaqueira. Posições do OSM; o que não está no OSM vem do endereço pesquisado.
import * as THREE from 'three';
import { Kit, obb, ringOf, inside, flagTexture } from './classics.js';
import { stampPoint, stampDisc, clearBox } from './collide.js';
import { buildOrla } from './orla.js';
import { buildMarcos } from './marcos.js';
import { buildBoemia } from './boemia.js';
import { buildMarcoZero } from './marcozero.js';
import { buildEstadios } from './estadios.js';
import { buildMangue } from './infill.js';

export function buildLugares(group, data, env, { mat }) {
  buildEstadios(group, data, env); // Arruda, Aflitos e Ilha do Retiro (estadios.js)
  buildColegios(group, data, env, mat);
  buildJaqueira(group, data, env, mat);
  buildPredios(group, data, env, mat);
  buildMarcos(group, data, env, mat);
  buildMarcoZero(group, data, env, mat);
  return [...buildOrla(group, data, env, mat), ...buildBoemia(group, data, env, mat), ...buildMangue(group, data, env)];
}

// ---------------------------------------------------------------- Arruda (Estádio José do Rêgo Maciel, 1972)
// O "Mundão do Arruda": tigela oval de concreto com arquibancada inferior inteira e o anel superior em três quartos
// do estádio, nas cores do Santa Cruz (vermelho, branco e preto), gramado no meio e quatro torres de refletores.
function buildArruda(group, data, mat) {
  const b = data.buildings.find((q) => q.n === 'Estádio José do Rêgo Maciel - Arruda'); if (!b) return;
  const o = obb(ringOf(b)), A = o.len / 2, Bw = o.wid / 2, rot = Math.atan2(-o.uz, o.ux); // eixo x local = eixo longo
  const k = new Kit();
  const COL = [mat('#c8102e', { roughness: 0.7 }), mat('#f2f0ea', { roughness: 0.7 }), mat('#151515', { roughness: 0.7 })];
  const conc = mat('#bdb6a8', { roughness: 0.95 });
  // perfil em degraus (raio relativo, altura), girado em volta do campo e esticado na elipse
  const steps = (r0, r1, y0, y1, n) => { const pts = [new THREE.Vector2(r0, y0)]; for (let i = 0; i < n; i++) { const r = r0 + ((r1 - r0) * (i + 1)) / n, y = y0 + ((y1 - y0) * (i + 1)) / n; pts.push(new THREE.Vector2(r - (r1 - r0) / n, y), new THREE.Vector2(r, y)); } pts.push(new THREE.Vector2(r1, 0)); return pts; };
  const lower = steps(0.66, 0.9, 0.5, 13, 9), upper = steps(0.9, 1.0, 15, 27, 7);
  const SECT = 24;
  for (let i = 0; i < SECT; i++) {
    const a0 = (i / SECT) * Math.PI * 2, da = (Math.PI * 2) / SECT, m = COL[i % 3];
    k.add(m, new THREE.LatheGeometry(lower, 3, a0, da), [A, 1, Bw], [0, 0, 0]);
    if (i < SECT * 0.75) k.add(COL[(i + 1) % 3], new THREE.LatheGeometry(upper, 3, a0, da), [A, 1, Bw], [0, 0, 0]);
  }
  // fachada de concreto com pilares
  // (alta onde tem o anel superior, baixa no quarto aberto)
  k.add(conc, new THREE.CylinderGeometry(1.0, 1.0, 28, 36, 1, true, 0, Math.PI * 1.5), [A * 1.01, 1, Bw * 1.01], [0, 14, 0]);
  k.add(conc, new THREE.CylinderGeometry(1.0, 1.0, 14, 12, 1, true, Math.PI * 1.5, Math.PI * 0.5), [A * 1.01, 1, Bw * 1.01], [0, 7, 0]);
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, h = a < Math.PI * 1.5 ? 28 : 14; k.box(conc, 1.2, h, 1.2, Math.sin(a) * A * 1.03, h / 2, Math.cos(a) * Bw * 1.03, [0, a, 0]); }
  // gramado com as linhas do campo
  const c = document.createElement('canvas'); c.width = 1024; c.height = 660; const g = c.getContext('2d');
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3f8f3a' : '#47a042'; g.fillRect((i * 1024) / 12, 0, 1024 / 12 + 1, 660); }
  g.strokeStyle = '#f4f4f0'; g.lineWidth = 6; g.strokeRect(20, 20, 984, 620); g.beginPath(); g.moveTo(512, 20); g.lineTo(512, 640); g.stroke();
  g.beginPath(); g.arc(512, 330, 90, 0, Math.PI * 2); g.stroke(); for (const x of [20, 844]) g.strokeRect(x, 150, 160, 360);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  k.add(new THREE.MeshStandardMaterial({ color: '#4c9a44', roughness: 0.95 }), new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), [A * 0.67, 1, Bw * 0.67], [0, 0.08, 0]);
  k.add(new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 }), new THREE.PlaneGeometry(Math.min(110, A * 1.05), Math.min(72, Bw * 0.95)).rotateX(-Math.PI / 2), [1, 1, 1], [0, 0.12, 0]);
  // refletores
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = sx * A * 0.8, z = sz * Bw * 0.8;
    k.box(conc, 1, 44, 1, x, 22, z).box(mat('#fffbe8', { emissive: '#fff3c4', emissiveIntensity: 0.2 }), 6, 3, 0.6, x, 44, z, [0, Math.atan2(-x, -z), 0]);
  }
  k.build(group, o.cx, o.cz, rot, true, false);
  // colisão só no anel (o campo fica livre)
  const c0 = Math.cos(rot), s0 = Math.sin(rot);
  for (let a = 0; a < Math.PI * 2; a += 0.01) for (let r = 0.66; r <= 1.04; r += 0.03) {
    const lx = Math.cos(a) * A * r, lz = Math.sin(a) * Bw * r;
    stampPoint(o.cx + lx * c0 + lz * s0, o.cz - lx * s0 + lz * c0);
  }
  if (!data.pois.some((p) => p.name === 'Arruda (Santa Cruz)')) data.pois.push({ name: 'Arruda (Santa Cruz)', kind: 'attraction', x: o.cx, z: o.cz });
}

// ---------------------------------------------------------------- colégios
// Portal de entrada com o nome, três mastros (Brasil, Pernambuco e a bandeira do colégio) e, quando cabe,
// uma quadra coberta do lado. Cada um com as cores do colégio.
const COLEGIOS = [
  { poi: 'Colégio Damas', name: 'Colégio Damas', c: '#1d3f8f' },
  { poi: 'Colégio Marista São Luís', name: 'Colégio Marista São Luís', c: '#0b4fa0' },
  { poi: 'Colégio Agnes', name: 'Colégio Agnes Erskine', c: '#1f6b3a' },
  { poi: 'Colégio Boa Viagem', name: 'Colégio Boa Viagem', c: '#c8102e' },
  { poi: 'Colégio Boa Viagem- Jaqueira', name: 'Colégio Boa Viagem · Jaqueira', c: '#c8102e' },
  { poi: 'Colégio Santa Maria', name: 'Colégio Santa Maria', c: '#1d5fa8' },
  // fora do OSM: endereço pesquisado
  { poi: 'Colégio NAP', name: 'Colégio NAP', c: '#e76f2a', near: 'Praça de Casa Forte', street: /^Praça de Casa Forte$|Casa Forte/ },
  { poi: 'Colégio Apoio', name: 'Colégio Apoio', c: '#2a9d8f', road: 'Rua Conselheiro Nabuco' },
];
function buildColegios(group, data, env, mat) {
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z);
  for (const s of COLEGIOS) {
    let p = data.pois.find((q) => q.name === s.poi);
    if (!p && s.near) { const n = data.pois.find((q) => q.name === s.near); if (n) p = spotOnEdge(n.x, n.z, 40, 70, env); }
    if (!p && s.road) { const r = data.roads.filter((q) => q.n === s.road).flatMap((q) => q.p).sort((a, b) => b[0] - a[0]); if (r.length) p = spotOnEdge(r[0][0], r[0][1], 8, 30, env); } // número baixo: começo da rua
    if (!p) continue;
    if (!data.pois.some((q) => q.name === s.poi)) data.pois.push({ name: s.poi, kind: 'school', x: p.x, z: p.z });
    // terreno vazio no mapa (o OSM não tem o prédio): levanta um campus
    let open = 0; for (let dx = -30; dx <= 30; dx += 6) for (let dz = -30; dz <= 30; dz += 6) if (free(p.x + dx, p.z + dz)) open++;
    if (open >= 110) { campus(group, data, env, mat, p, s); continue; }
    // prédio do colégio e a frente dele (lado da rua mais perto)
    let b = null, bd = 60;
    for (const q of data.buildings) { if (Math.abs(q.cx - p.x) > 80 || Math.abs(q.cz - p.z) > 80) continue; const d = Math.hypot(q.cx - p.x, q.cz - p.z); if (inside(ringOf(q), p.x, p.z)) { b = q; break; } if (d < bd) { bd = d; b = q; } }
    if (!b) continue;
    let gate = null;
    for (let r = 4; r < 40 && !gate; r += 2) for (let a = 0; a < Math.PI * 2; a += 0.25) {
      const x = b.cx + Math.cos(a) * r, z = b.cz + Math.sin(a) * r;
      if (free(x, z) && env.isRoad?.(x + Math.cos(a) * 6, z + Math.sin(a) * 6) && !env.isRoad(x, z)) { gate = { x, z, a }; break; }
    }
    if (!gate) continue;
    const k = new Kit(), col = mat(s.c, { roughness: 0.5 }), white = mat('#f4f2ec', { roughness: 0.6 });
    const yaw = Math.atan2(Math.cos(gate.a), Math.sin(gate.a)); // placa virada pra rua
    const ox = Math.cos(yaw), oz = -Math.sin(yaw);
    // portal: dois pilares e a viga com o nome
    for (const sd of [-1, 1]) k.box(white, 0.7, 4.2, 0.7, gate.x + ox * sd * 2.6, 2.1, gate.z + oz * sd * 2.6);
    k.box(col, 6.2, 1.0, 0.5, gate.x, 4.6, gate.z, [0, yaw, 0]);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 80; const g = cv.getContext('2d');
    g.fillStyle = s.c; g.fillRect(0, 0, 512, 80); g.fillStyle = '#ffffff'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(s.name.length > 22 ? s.name.replace('Colégio ', '') : s.name, 256, 42);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const sd of [1, -1]) k.add(sign, new THREE.PlaneGeometry(6, 0.94), [1, 1, 1], [gate.x + fx * 0.26 * sd, 4.6, gate.z + fz * 0.26 * sd], [0, yaw + (sd < 0 ? Math.PI : 0), 0]);
    // mastros
    const pole = mat('#d9d9d9', { metalness: 0.7, roughness: 0.3 });
    const flagC = document.createElement('canvas'); flagC.width = 140; flagC.height = 98; const fg = flagC.getContext('2d'); fg.fillStyle = s.c; fg.fillRect(0, 0, 140, 98); fg.fillStyle = '#fff'; fg.beginPath(); fg.arc(70, 49, 26, 0, Math.PI * 2); fg.fill();
    const fl = new THREE.CanvasTexture(flagC); fl.colorSpace = THREE.SRGBColorSpace;
    const flags = [flagTexture('br'), flagTexture('pe'), fl];
    flags.forEach((tex, i) => {
      const d = 4.2 + i * 1.6, x = gate.x + ox * d, z = gate.z + oz * d;
      if (!free(x, z)) return;
      k.add(pole, new THREE.CylinderGeometry(0.05, 0.07, 7, 8), [1, 1, 1], [x, 3.5, z]);
      k.add(new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }), new THREE.PlaneGeometry(1.5, 1.05), [1, 1, 1], [x + ox * 0.78, 6.3, z + oz * 0.78], [0, yaw, 0]);
      stampDisc(x, z, 0.15);
    });
    k.build(group, 0, 0, 0, true, true);
  }
}
// campus gerado: prédio em U de três andares em volta do pátio, quadra coberta no fundo e portal na frente
function campus(group, data, env, mat, p, s) {
  // alinha com a rua mais perto
  let best = null;
  for (const r of data.roads) for (let i = 0; i < r.p.length - 1; i++) {
    const a = r.p[i], b = r.p[i + 1]; if (Math.abs(a[0] - p.x) > 150 || Math.abs(a[1] - p.z) > 150) continue;
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / l2));
    const d = Math.hypot(a[0] + dx * t - p.x, a[1] + dz * t - p.z);
    if (!best || d < best.d) best = { d, qx: a[0] + dx * t, qz: a[1] + dz * t };
  }
  if (!best) return;
  const fx = (best.qx - p.x) / (best.d || 1), fz = (best.qz - p.z) / (best.d || 1), yaw = Math.atan2(fx, fz); // +z local = rumo à rua
  const free = (lx, lz) => { const x = p.x + lz * fx + lx * fz, z = p.z + lz * fz - lx * fx; return !env.isSolid(x, z) && !env.isWater(x, z) && !env.isRoad?.(x, z); };
  // cabe quanto? encolhe até não invadir nada
  let S = 1;
  for (; S > 0.4; S -= 0.1) { let ok = true; for (let lx = -32; lx <= 32 && ok; lx += 4) for (let lz = -34; lz <= 22 && ok; lz += 4) if (!free(lx * S, lz * S)) ok = false; if (ok) break; }
  const k = new Kit(), wall = mat('#f4f2ec', { roughness: 0.7 }), band = mat(s.c, { roughness: 0.5 }), glass = mat('#2f3a40', { roughness: 0.2, metalness: 0.5 });
  const wing = (w, d, x, z, along) => {
    k.box(wall, w, 11, d, x, 5.5, z);
    for (let f = 0; f < 3; f++) k.box(band, w + 0.1, 0.35, d + 0.1, x, 3.6 * f + 3.4, z);
    // janelas em fita nas faces compridas
    for (let f = 0; f < 3; f++) for (const sd of [-1, 1]) {
      if (along) k.box(glass, w - 2, 1.4, 0.1, x, 3.6 * f + 1.9, z + sd * (d / 2 + 0.02));
      else k.box(glass, 0.1, 1.4, d - 2, x + sd * (w / 2 + 0.02), 3.6 * f + 1.9, z);
    }
  };
  wing(60 * S, 12, 0, 14 * S, true);
  wing(12, 30 * S, -24 * S, -3 * S, false);
  wing(12, 30 * S, 24 * S, -3 * S, false);
  // entrada principal com marquise
  k.box(band, 10, 0.4, 4, 0, 3.3, 14 * S + 8).box(wall, 0.4, 3.3, 0.4, -4.6, 1.65, 14 * S + 9.6).box(wall, 0.4, 3.3, 0.4, 4.6, 1.65, 14 * S + 9.6);
  // quadra coberta
  const qz = -28 * S;
  k.box(mat('#2a6db0', { roughness: 0.8 }), 26 * S, 0.06, 16 * S, 0, 0.05, qz).box(mat('#f2efe6'), 26 * S - 2, 0.07, 0.12, 0, 0.06, qz);
  k.box(mat('#9aa3a8', { metalness: 0.5, roughness: 0.4 }), 30 * S, 0.3, 20 * S, 0, 9, qz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(mat('#9aa3a8', { metalness: 0.5 }), 0.4, 9, 0.4, sx * 14.5 * S, 4.5, qz + sz * 9.5 * S);
  k.build(group, p.x, p.z, yaw);
  // portal com o nome na calçada
  const gd = Math.max(14 * S + 9, Math.min(best.d - 6, 14 * S + 12)), g = { x: p.x + fx * gd, z: p.z + fz * gd };
  const kp = new Kit(), white = mat('#f4f2ec', { roughness: 0.6 });
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 80; const c = cv.getContext('2d');
  c.fillStyle = s.c; c.fillRect(0, 0, 512, 80); c.fillStyle = '#fff'; c.font = 'bold 40px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.name, 256, 42);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  for (const sd of [-1, 1]) kp.box(white, 0.7, 4.2, 0.7, sd * 3.2, 2.1, 0);
  kp.box(mat(s.c), 7.2, 1.0, 0.5, 0, 4.6, 0);
  kp.add(new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), new THREE.PlaneGeometry(7, 0.94), [1, 1, 1], [0, 4.6, 0.26]);
  for (let i = 0; i < 3; i++) { kp.add(mat('#d9d9d9', { metalness: 0.7 }), new THREE.CylinderGeometry(0.05, 0.07, 7, 8), [1, 1, 1], [5 + i * 1.6, 3.5, -1]); kp.add(new THREE.MeshStandardMaterial({ map: i === 2 ? null : flagTexture(i ? 'pe' : 'br'), color: i === 2 ? s.c : '#ffffff', side: THREE.DoubleSide }), new THREE.PlaneGeometry(1.5, 1.05), [1, 1, 1], [5.8 + i * 1.6, 6.3, -1]); }
  kp.build(group, g.x, g.z, yaw);
}

// ponto livre na calçada perto de (x, z), entre r0 e r1 metros, encostado num prédio
function spotOnEdge(x, z, r0, r1, env) {
  for (let r = r0; r <= r1; r += 3) for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (env.isSolid(px, pz) && !env.isWater(px, pz)) return { x: px, z: pz };
  }
  return null;
}

// ---------------------------------------------------------------- Parque da Jaqueira: pista de caminhada e quiosques
function buildJaqueira(group, data, env, mat) {
  const jq = data.pois.find((p) => p.name === 'Parque da Jaqueira'); if (!jq) return;
  const park = data.parks.filter((q) => inside(q.p, jq.x, jq.z)).sort((a, b) => b.p.length - a.p.length)[0]; if (!park) return;
  const r = park.p, cx = r.reduce((s, p) => s + p[0], 0) / r.length, cz = r.reduce((s, p) => s + p[1], 0) / r.length;
  // pista: o contorno do parque puxado 12 m pra dentro
  const ring = r.map(([x, z]) => { const d = Math.hypot(x - cx, z - cz) || 1, k = Math.max(0.5, (d - 12) / d); return [cx + (x - cx) * k, cz + (z - cz) * k]; });
  const k = new Kit(), track = mat('#b0563d', { roughness: 0.95 }), line = mat('#f2efe6', { roughness: 0.8 });
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
    const yaw = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (env.isSolid(mx, mz) || env.isWater(mx, mz)) continue;
    k.box(track, 3.2, 0.05, L + 1.6, mx, 0.06, mz, [0, yaw, 0]);
    k.box(line, 0.08, 0.052, L, mx, 0.065, mz, [0, yaw, 0]);
  }
  // quiosques de coco e tapioca em volta da pista
  const roof = mat('#2a7a4a', { roughness: 0.7 }), wall = mat('#f4f1ea'), wood = mat('#8a6a48');
  let n = 0;
  for (let i = 0; i < ring.length && n < 4; i += Math.max(1, Math.floor(ring.length / 4))) {
    const [x0, z0] = ring[i], x = x0 + (cx - x0) * 0.06, z = z0 + (cz - z0) * 0.06;
    if (!env.isSolid(x, z) && !env.isWater(x, z)) { k.box(wall, 2.4, 2.1, 2.4, x, 1.05, z).box(wood, 2.8, 0.1, 0.8, x, 1.1, z + 1.5); k.add(roof, new THREE.ConeGeometry(2.4, 1.2, 4), [1, 1, 1], [x, 2.7, z], [0, Math.PI / 4, 0]); stampDisc(x, z, 1.3); n++; }
  }
  k.build(group, 0, 0, 0, false, false);
}

// ---------------------------------------------------------------- prédios que eram caixas genéricas
function buildPredios(group, data, env, mat) {
  const byName = (n) => data.buildings.filter((b) => b.n === n);
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z);
  const clear = (x, z, r) => { for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) if (!free(x + dx, z + dz) || env.isRoad?.(x + dx, z + dz)) return false; return true; };
  const findClear = (x, z, r, R = 80) => { for (let d = 0; d <= R; d += 3) for (let a = 0; a < Math.PI * 2; a += 0.3) { const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (clear(px, pz, r)) return [px, pz]; } return null; };

  // Quartel do Derby (1924): o casarão amarelo do comando da PM ganha torre central com relógio e cúpula
  for (const b of byName('Quartel do Derby do Comando Geral da Polícia Militar').slice(0, 1)) {
    const o = obb(ringOf(b)), k = new Kit(), wall = mat('#e9c46a', { roughness: 0.85 }), trim = mat('#fbf8f0', { roughness: 0.6 });
    // ponto do contorno mais perto da Praça do Derby, puxado 4 m pra dentro
    const pd = data.pois.find((p) => p.name === 'Praça do Derby'), r = ringOf(b);
    if (pd) { let best = r[0]; for (const q of r) if (Math.hypot(q[0] - pd.x, q[1] - pd.z) < Math.hypot(best[0] - pd.x, best[1] - pd.z)) best = q; const d = Math.hypot(o.cx - best[0], o.cz - best[1]) || 1; o.cx = best[0] + (o.cx - best[0]) / d * 4; o.cz = best[1] + (o.cz - best[1]) / d * 4; }
    k.box(wall, 7, 22, 7, 0, 11, 0).box(trim, 7.8, 0.6, 7.8, 0, 12.3, 0).box(trim, 7.8, 0.6, 7.8, 0, 22, 0);
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; k.add(mat('#fbf8f0', { emissive: '#2a2618', emissiveIntensity: 0.3 }), new THREE.CircleGeometry(1.5, 24), [1, 1, 1], [Math.sin(a) * 3.52, 18, Math.cos(a) * 3.52], [0, a, 0]); }
    k.add(mat('#6f8a8f', { metalness: 0.4, roughness: 0.4 }), new THREE.SphereGeometry(3.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), [1, 1.2, 1], [0, 22.3, 0]);
    k.add(trim, new THREE.CylinderGeometry(0.3, 0.3, 3, 8), [1, 1, 1], [0, 27.5, 0]);
    k.build(group, o.cx, o.cz, Math.atan2(o.ux, o.uz));
  }

  // Mercado da Boa Vista: casa térrea em volta de um pátio aberto, com arcadas pra dentro e pra fora; bares no pátio
  for (const b of byName('Mercado da Boa Vista').slice(0, 1)) {
    const o = obb(ringOf(b)), W = Math.max(18, o.wid), L = Math.max(24, o.len), T = 6, H = 6.5;
    const k = new Kit(), wall = mat('#f1e4c3', { roughness: 0.9 }), trim = mat('#2f6b4f', { roughness: 0.6 }), roof = mat('#b4603f', { roughness: 0.9 }), dark = mat('#2a1f18');
    for (const [w, d, x, z] of [[W, T, 0, L / 2 - T / 2], [W, T, 0, -L / 2 + T / 2], [T, L - 2 * T, W / 2 - T / 2, 0], [T, L - 2 * T, -W / 2 + T / 2, 0]]) {
      k.box(wall, w, H, d, x, H / 2, z).box(roof, w + 0.6, 0.5, d + 0.6, x, H + 0.25, z).box(trim, w + 0.2, 0.3, d + 0.2, x, H - 0.4, z);
    }
    // arcos (portas verdes em arco) nas faces de fora e do pátio
    const arch = (x, z, yaw) => { k.box(dark, 2.0, 3.2, 0.12, x, 1.6, z, [0, yaw, 0]); k.add(dark, new THREE.CylinderGeometry(1.0, 1.0, 0.12, 14, 1, false, -Math.PI / 2, Math.PI), [1, 1, 1], [x, 3.2, z], [Math.PI / 2, yaw, 0], 'YXZ'); };
    for (let x = -W / 2 + 2.5; x <= W / 2 - 2.5; x += 3.4) for (const sz of [1, -1]) { arch(x, sz * (L / 2 + 0.07), 0); arch(x, sz * (L / 2 - T - 0.07), 0); }
    for (let z = -L / 2 + T + 2; z <= L / 2 - T - 2; z += 3.4) for (const sx of [1, -1]) { arch(sx * (W / 2 + 0.07), z, Math.PI / 2); arch(sx * (W / 2 - T - 0.07), z, Math.PI / 2); }
    // mesas no pátio
    const cols = ['#c8102e', '#f2b705', '#1d5fa8'];
    for (let x = -W / 2 + T + 2; x <= W / 2 - T - 2; x += 3) for (let z = -L / 2 + T + 2; z <= L / 2 - T - 2; z += 3) { if (Math.hypot(x, z) < 5) continue; /* salão do forró no meio */ const m = mat(cols[Math.abs(Math.round(x + z)) % 3], { roughness: 0.5 }); k.add(m, new THREE.CylinderGeometry(0.45, 0.45, 0.04, 12), [1, 1, 1], [x, 0.72, z]); k.box(m, 0.06, 0.72, 0.06, x, 0.36, z); }
    k.build(group, o.cx, o.cz, Math.atan2(o.ux, o.uz));
    // o pátio é aberto: tira a colisão de dentro e abre uma passagem pelo arco do meio de cada lado comprido
    // (eixo z local = u do prédio; eixo x local = (uz, -ux))
    const vx = o.uz, vz = -o.ux, ax = -W / 2 + 2.5 + 3.4 * Math.round((W / 2 - 2.5) / 3.4);
    clearBox(o.cx, o.cz, o.ux, o.uz, L / 2 - T - 0.3, W / 2 - T - 0.3);
    for (const sz of [1, -1]) { const lz = sz * (L / 2 - T / 2); clearBox(o.cx + vx * ax + o.ux * lz, o.cz + vz * ax + o.uz * lz, o.ux, o.uz, T / 2 + 0.6, 0.9); }
    // as mesas dos bares continuam sólidas (a colisão delas foi junto com a do pátio)
    for (let x = -W / 2 + T + 2; x <= W / 2 - T - 2; x += 3) for (let z = -L / 2 + T + 2; z <= L / 2 - T - 2; z += 3) if (Math.hypot(x, z) >= 5) stampDisc(o.cx + vx * x + o.ux * z, o.cz + vz * x + o.uz * z, 0.45);
    if (!data.pois.some((p) => p.name === 'Pátio do Mercado da Boa Vista')) data.pois.push({ name: 'Pátio do Mercado da Boa Vista', kind: 'attraction', x: o.cx, z: o.cz });
  }

  // Geraldão (Ícaro de Castro Mello, 1970): ginásio redondo de concreto com cúpula baixa e nervuras
  for (const b of byName('Geraldão - Ginásio de Esportes Geraldo Magalhães').slice(0, 1)) {
    const o = obb(ringOf(b)), A = o.len / 2, Bw = o.wid / 2, k = new Kit(), conc = mat('#d6d1c6', { roughness: 0.9 }), glass = mat('#2f3a40', { roughness: 0.2, metalness: 0.5 });
    k.add(conc, new THREE.CylinderGeometry(1, 1.04, 12, 48), [A * 0.96, 1, Bw * 0.96], [0, 6, 0]);
    k.add(glass, new THREE.CylinderGeometry(1.002, 1.002, 2.2, 48, 1, true), [A * 0.96, 1, Bw * 0.96], [0, 9.5, 0]);
    k.add(mat('#e9e6df', { roughness: 0.6 }), new THREE.SphereGeometry(1, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), [A * 0.98, 7, Bw * 0.98], [0, 12, 0]);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; k.box(conc, 1.2, 13, 1.6, Math.cos(a) * A * 0.99, 6.5, Math.sin(a) * Bw * 0.99, [0, -a, 0]); }
    k.build(group, o.cx, o.cz, Math.atan2(-o.uz, o.ux));
    if (!data.pois.some((p) => p.name === 'Geraldão')) data.pois.push({ name: 'Geraldão', kind: 'attraction', x: o.cx, z: o.cz });
  }

  // Parque 13 de Maio: lago com pontinha em arco e coreto
  const p13 = data.pois.find((p) => p.name === 'Parque 13 de Maio');
  if (p13) {
    const c = findClear(p13.x, p13.z, 12, 120);
    if (c) {
      const k = new Kit(), stone = mat('#d9d2c2'), water = mat('#2f6f7a', { roughness: 0.08, metalness: 0.25, emissive: '#06191d' }), white = mat('#f4f2ec'), roofG = mat('#2f6b4f');
      k.add(stone, new THREE.CylinderGeometry(9, 9.3, 0.5, 40), [1.4, 1, 1], [c[0], 0.25, c[1]]); k.add(water, new THREE.CylinderGeometry(8.4, 8.4, 0.1, 40), [1.4, 1, 1], [c[0], 0.48, c[1]]);
      for (let i = 0; i <= 12; i++) { const t = i / 12, y = 0.6 + Math.sin(Math.PI * t) * 1.2; k.box(mat('#8a6a48'), 1.8, 0.15, 1.6, c[0], y, c[1] - 9.5 + t * 19); } // pontinha em arco atravessando o lago
      // coreto do lado do lago
      const cx = c[0] + 18, cz = c[1];
      if (clear(cx, cz, 5)) {
        k.add(stone, new THREE.CylinderGeometry(4.2, 4.4, 0.9, 8), [1, 1, 1], [cx, 0.45, cz]);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.add(white, new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), [1, 1, 1], [cx + Math.cos(a) * 3.8, 2.5, cz + Math.sin(a) * 3.8]); }
        k.add(roofG, new THREE.ConeGeometry(4.8, 2.2, 8), [1, 1, 1], [cx, 5.2, cz]);
      }
      k.build(group, 0, 0, 0, true, true);
    }
  }
  // Parque das Graças: deque de madeira na beira do Capibaribe, bancos e quiosque
  const pg = data.pois.find((p) => p.name === 'Parque das Graças');
  if (pg) {
    let edge = null;
    for (let d = 0; d < 90 && !edge; d += 2) for (let a = 0; a < Math.PI * 2; a += 0.25) { const x = pg.x + Math.cos(a) * d, z = pg.z + Math.sin(a) * d; if (env.isWater(x, z)) { edge = { x: x - Math.cos(a) * 3, z: z - Math.sin(a) * 3, a }; break; } }
    if (edge) {
      const k = new Kit(), wood = mat('#8a6a48', { roughness: 0.9 }), rail = mat('#3a3a3a', { metalness: 0.5 });
      const ux = -Math.sin(edge.a), uz = Math.cos(edge.a), yaw = Math.atan2(ux, uz);
      k.box(wood, 4, 0.2, 40, edge.x, 0.1, edge.z, [0, yaw, 0]);
      k.box(rail, 0.06, 0.06, 40, edge.x + Math.cos(edge.a) * 2, 1.0, edge.z + Math.sin(edge.a) * 2, [0, yaw, 0]);
      for (let t = -18; t <= 18; t += 6) { const x = edge.x + ux * t - Math.cos(edge.a) * 3.2, z = edge.z + uz * t - Math.sin(edge.a) * 3.2; if (free(x, z)) k.box(wood, 2.0, 0.1, 0.5, x, 0.5, z, [0, yaw + Math.PI / 2, 0]).box(wood, 2.0, 0.45, 0.08, x - Math.cos(edge.a) * 0.25, 0.8, z - Math.sin(edge.a) * 0.25, [0, yaw + Math.PI / 2, 0]); }
      k.build(group, 0, 0, 0, true, false);
    }
  }
  // Praça do Derby: lago com ilhota e palmeiras
  const pd = data.pois.find((p) => p.name === 'Praça do Derby');
  if (pd) {
    const c = findClear(pd.x, pd.z, 10, 90);
    if (c) {
      const k = new Kit(), stone = mat('#d9d2c2'), water = mat('#2f6f7a', { roughness: 0.08, metalness: 0.25, emissive: '#06191d' }), grass = mat('#4f8f3e'), trunk = mat('#b9b2a2'), frond = mat('#3c7a35', { side: THREE.DoubleSide });
      k.add(stone, new THREE.CylinderGeometry(9, 9.3, 0.5, 40), [1, 1, 1], [c[0], 0.25, c[1]]); k.add(water, new THREE.CylinderGeometry(8.4, 8.4, 0.1, 40), [1, 1, 1], [c[0], 0.48, c[1]]);
      k.add(grass, new THREE.CylinderGeometry(2.6, 3, 0.6, 20), [1, 1, 1], [c[0], 0.5, c[1]]);
      for (let i = 0; i < 3; i++) { const a = i * 2.1, x = c[0] + Math.cos(a) * 1.2, z = c[1] + Math.sin(a) * 1.2; k.add(trunk, new THREE.CylinderGeometry(0.18, 0.26, 9, 7), [1, 1, 1], [x, 5, z]); for (let f = 0; f < 7; f++) k.add(frond, new THREE.ConeGeometry(0.4, 3.4, 4, 1).rotateX(Math.PI / 2).scale(1, 0.18, 1).translate(0, 0, 1.7), [1, 1, 1], [x, 9.4, z], [0.6, (f / 7) * Math.PI * 2, 0], 'YXZ'); }
      k.build(group, 0, 0, 0, true, true);
    }
  }
}
