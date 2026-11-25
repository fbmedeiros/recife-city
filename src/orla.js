// Orla de Boa Viagem, Pina e centro: Pátio de São Pedro, Soparia, Edifício Holiday, Edifício Acaiaca, Primeiro, Segundo
// e Terceiro Jardim, rampa helicoidal e passarela do RioMar e os armazéns do Cais José Estelita.
// Posições do OSM; o que não está no OSM foi posto pelo endereço pesquisado (aproximado).
import * as THREE from 'three';
import { Kit, ringOf } from './classics.js';
import { makePerson } from './models.js';
import { stampDisc } from './collide.js';

const PASTEL = ['#e8b04a', '#d9624b', '#4f9fbf', '#79b77a', '#f2e3a0', '#c97b9b', '#8fb8de', '#e98d5a', '#6fc2b4', '#f4efe4'];
const avBoaViagem = (data) => data.roads.filter((r) => r.n === 'Avenida Boa Viagem').flatMap((r) => r.p).sort((a, b) => a[1] - b[1]);
// ponto a "m" metros do começo da avenida (no Pina), seguindo para o sul
function alongAv(pts, m) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (L + d >= m) { const t = (m - L) / (d || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; } L += d; }
  return pts.at(-1);
}

// ---------------------------------------------------------------- antes dos prédios
export function prepareOrla(data) {
  // Pátio de São Pedro: casario de térreos e sobrados coloridos em volta da igreja
  const sp = data.pois.find((p) => /São Pedro dos Clérigos/.test(p.name));
  if (sp) {
    let i = 0;
    for (const b of data.buildings) if (!b.n && Math.hypot(b.cx - sp.x, b.cz - sp.z) < 75) { b.style = 'colonial'; b.c = PASTEL[i++ % PASTEL.length]; b.h = [6.5, 9.5, 9.5, 12.5][i % 4]; }
  }
  // Shopping Recife: caixa branca grande
  for (const b of data.buildings) if (b.n === 'Shopping Recife') { b.h = 18; b.c = '#f1efe9'; }
  // Edifício Acaiaca (Delfim Amorim, 1958): lâmina horizontal de 11 andares na beira-mar; o OSM não marca qual é,
  // então vira modelo próprio o prédio da Av. Boa Viagem mais perto do ponto escolhido
  const pts = avBoaViagem(data);
  if (pts.length > 2) {
    const [x, z] = alongAv(pts, 2050);
    let best = null;
    for (const b of data.buildings) {
      if (b.n || Math.abs(b.cx - x) > 120 || Math.abs(b.cz - z) > 120) continue;
      const r = ringOf(b); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const [px, pz] of r) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); }
      const area = (x1 - x0) * (z1 - z0), d = Math.hypot(b.cx - x, b.cz - z);
      if (area > 250 && area < 2500 && (!best || d < best.d)) best = { b, d };
    }
    if (best) { best.b.n = 'Edifício Acaiaca'; data.acaiaca = best.b; }
  }
}

export function buildOrla(group, data, env, mat) {
  const anim = [];
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z);
  const clear = (x, z, r) => { for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) if (!free(x + dx, z + dz) || env.isRoad?.(x + dx, z + dz)) return false; return true; };
  const findClear = (x, z, r, R = 60) => { for (let d = 0; d <= R; d += 3) for (let a = 0; a < Math.PI * 2; a += 0.35) { const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (clear(px, pz, r)) return [px, pz]; } return null; };
  const people = [];
  const seat = (p) => { const u = p.userData; u.seated = true; u.legL.rotation.x = u.legR.rotation.x = -1.45; u.kneeL.rotation.x = u.kneeR.rotation.x = 1.45; u.armL.rotation.set(-0.5, 0, -0.1); u.elbowL.rotation.x = -1.2; };
  const label = (name, x, z) => { if (!data.pois.some((p) => p.name === name)) data.pois.push({ name, kind: 'attraction', x, z }); };
  const signTex = (text, bg, fg, w = 512, h = 96, font = 'bold 64px Arial') => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  // mesa de bar de plástico com quatro cadeiras (e às vezes gente sentada)
  const barTable = (k, x, z, col, who = 0) => {
    const m = mat(col, { roughness: 0.5 });
    k.add(m, new THREE.CylinderGeometry(0.45, 0.45, 0.04, 14), [1, 1, 1], [x, 0.72, z]); k.box(m, 0.06, 0.72, 0.06, x, 0.36, z);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2, cx = x + Math.cos(a) * 0.75, cz = z + Math.sin(a) * 0.75; k.box(m, 0.42, 0.05, 0.42, cx, 0.44, cz).box(m, 0.42, 0.42, 0.05, cx + Math.cos(a) * 0.2, 0.66, cz + Math.sin(a) * 0.2, [0, -a + Math.PI / 2, 0]);
      if (i < who) { const p = makePerson(); seat(p); p.position.set(cx, 0.44 - 0.45, cz); p.rotation.y = Math.atan2(x - cx, z - cz); group.add(p); people.push(p); } }
    k.add(mat('#3b7a2a', { roughness: 0.3, metalness: 0.1 }), new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8), [1, 1, 1], [x + 0.1, 0.87, z]); // garrafa
    stampDisc(x, z, 0.6);
  };

  // ---------------------------------------------------------------- Pátio de São Pedro
  const sp = data.pois.find((p) => /São Pedro dos Clérigos/.test(p.name));
  if (sp) {
    const c = findClear(sp.x, sp.z, 6, 70);
    if (c) {
      const k = new Kit(), cols = ['#c8102e', '#f2b705', '#1d5fa8', '#f2f2f0'];
      let n = 0;
      for (let dx = -10; dx <= 10; dx += 3.4) for (let dz = -8; dz <= 8; dz += 3.4) { const x = c[0] + dx, z = c[1] + dz; if (free(x, z) && !env.isRoad?.(x, z)) barTable(k, x, z, cols[n % 4], n % 3 === 0 ? 2 : n % 5 === 0 ? 1 : 0), n++; }
      // bandeirolas cruzando o pátio
      const flagM = ['#e63946', '#ffd166', '#2a9d8f', '#3a86ff', '#ff7b3a'].map((cc) => mat(cc, { side: THREE.DoubleSide }));
      for (let s = -12; s <= 12; s += 6) { k.box(mat('#222'), 26, 0.03, 0.03, c[0], 5.2, c[1] + s); for (let t = -12.5; t <= 12.5; t += 0.7) k.add(flagM[Math.abs(Math.round(t / 0.7)) % 5], new THREE.PlaneGeometry(0.35, 0.45), [1, 1, 1], [c[0] + t, 4.95 - (1 - (t / 13) ** 2) * 0.4, c[1] + s]); }
      k.build(group, 0, 0, 0, true, false);
      label('Pátio de São Pedro', c[0], c[1]);
    }
  }

  // ---------------------------------------------------------------- Soparia (Pina, 1992–1999): o bar do manguebeat
  // Boteco de Roger de Renor onde se juntavam Chico Science & Nação Zumbi e Mundo Livre S/A. O endereço exato não foi
  // achado; fica perto do Polo Pina (Av. Herculano Bandeira).
  {
    const c = findClear(1600, -930, 7, 90);
    if (c) {
      const k = new Kit(), wall = mat('#d9a441', { roughness: 0.9 }), dark = mat('#1d1d1d');
      k.box(wall, 10, 3.6, 7, c[0], 1.8, c[1] - 4.5).box(mat('#7a3b1d'), 10.6, 0.3, 7.6, c[0], 3.75, c[1] - 4.5);
      k.box(dark, 2, 2.6, 0.1, c[0] - 2.5, 1.3, c[1] - 0.95);
      // letreiro pintado e um caranguejo (o mangue) na parede
      k.add(new THREE.MeshStandardMaterial({ map: signTex('SOPARIA', '#d9a441', '#7a1d10', 512, 96, 'bold 70px Georgia') }), new THREE.PlaneGeometry(4.6, 0.86), [1, 1, 1], [c[0] + 1.6, 3.0, c[1] - 0.94]);
      const crab = mat('#c8102e', { roughness: 0.6 });
      k.add(crab, new THREE.SphereGeometry(0.5, 12, 8), [1.3, 0.35, 1], [c[0] + 1.6, 1.6, c[1] - 0.94], [Math.PI / 2, 0, 0]);
      for (const s of [-1, 1]) { k.box(crab, 0.5, 0.08, 0.04, c[0] + 1.6 + s * 0.85, 1.85, c[1] - 0.92, [0, 0, s * 0.6]); for (let i = 0; i < 3; i++) k.box(crab, 0.45, 0.06, 0.04, c[0] + 1.6 + s * 0.75, 1.5 - i * 0.14, c[1] - 0.92, [0, 0, -s * 0.4]); }
      // palquinho na calçada: alfaias e guitarra
      k.box(mat('#3a2a1a'), 4, 0.3, 2.4, c[0] - 3, 0.15, c[1] + 2.5);
      const band = [];
      for (let i = 0; i < 3; i++) {
        const p = makePerson({ longSleeve: false }); p.position.set(c[0] - 4.2 + i * 1.2, 0.3, c[1] + 2.4); p.rotation.y = Math.PI; group.add(p); band.push(p); people.push(p);
        if (i < 2) { const al = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 14), mat('#8a5a2a')); al.rotation.z = Math.PI / 2; al.position.set(0, 0.95, 0.3); p.userData.upper.add(al); }
      }
      for (let i = 0; i < 6; i++) barTable(k, c[0] + 0.5 + (i % 3) * 2.2, c[1] + 1.5 + Math.floor(i / 3) * 2.2, ['#c8102e', '#f2b705'][i % 2], i % 2 ? 2 : 1);
      k.build(group, 0, 0, 0, true, true);
      anim.push((t) => band.forEach((p, i) => { const u = p.userData, s = Math.sin(t * 9 + i); if (i < 2) { u.armL.rotation.x = -1.2 + s * 0.6; u.armR.rotation.x = -1.2 - s * 0.6; } else { u.armR.rotation.x = -0.8 + s * 0.3; u.upper.rotation.x = 0.1 + Math.abs(s) * 0.2; } }));
      label('Soparia', c[0], c[1]);
    }
  }

  // ---------------------------------------------------------------- Edifício Holiday (1957): 17 andares em curva, faixas horizontais
  const hol = data.buildings.find((b) => b.n === 'Edifício Holiday');
  if (hol) {
    const r = ringOf(hol), k = new Kit(), band = mat('#efe6d2', { roughness: 0.8 }), H = hol.h || 55;
    const cx = hol.cx, cz = hol.cz, AWN = ['#c8102e', '#1d5fa8', '#2a9d58', '#f2b705', '#e76f2a'];
    for (let i = 0; i < r.length; i++) {
      const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
      let nx = -(bz - az) / L, nz = (bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
      const yaw = Math.atan2(bx - ax, bz - az);
      for (let f = 1; f < 17; f++) k.box(band, 0.5, 0.35, L + 0.5, mx + nx * 0.45, f * (H / 17), mz + nz * 0.45, [0, yaw, 0]); // peitoris corridos
      if (L > 3) k.box(mat(AWN[i % AWN.length], { roughness: 0.7 }), 1.4, 0.1, L - 0.6, mx + nx * 0.9, 3.0, mz + nz * 0.9, [0.3 * 0, yaw, 0]); // toldos das lojas
    }
    // letreiro HOLIDAY no topo
    const t = signTex('HOLIDAY', '#f4f1ea', '#1d3f8f', 512, 110, 'bold 92px Arial');
    const sm = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.6 });
    const o = obbLong(r);
    k.add(sm, new THREE.PlaneGeometry(14, 3), [1, 1, 1], [cx, H + 2.4, cz], [0, Math.atan2(o.ux, o.uz) + Math.PI / 2, 0]);
    k.box(mat('#888'), 0.2, 2.4, 0.2, cx + o.ux * 6, H + 1.2, cz + o.uz * 6).box(mat('#888'), 0.2, 2.4, 0.2, cx - o.ux * 6, H + 1.2, cz - o.uz * 6);
    k.build(group, 0, 0, 0, true, false);
    label('Edifício Holiday', cx, cz);
  }

  // ---------------------------------------------------------------- Edifício Acaiaca: lâmina sobre pilotis, empenas de azulejo
  if (data.acaiaca) {
    const b = data.acaiaca, r = ringOf(b), o = obbLong(r), pts = avBoaViagem(data);
    // frente = lado da avenida (mar)
    let best = null; for (const p of pts) { const d = Math.hypot(p[0] - b.cx, p[1] - b.cz); if (!best || d < best.d) best = { d, p }; }
    let fx = best.p[0] - b.cx, fz = best.p[1] - b.cz; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const W = Math.min(48, Math.max(36, o.len)), D = Math.min(14, Math.max(10, o.wid)), H = 11 * 3.0 + 4;
    const k = new Kit(), white = mat('#f3f1ea', { roughness: 0.7 }), glass = mat('#2f3a40', { roughness: 0.2, metalness: 0.5 });
    // azulejo azul e branco das empenas
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#f4f6f8' : '#2f6fb0'; g.fillRect(x * 16, y * 16, 16, 16); g.fillStyle = (x + y) % 2 ? '#2f6fb0' : '#f4f6f8'; g.beginPath(); g.arc(x * 16 + 8, y * 16 + 8, 4, 0, Math.PI * 2); g.fill(); }
    const tt = new THREE.CanvasTexture(c); tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(D / 2, H / 2); tt.colorSpace = THREE.SRGBColorSpace;
    const tile = new THREE.MeshStandardMaterial({ map: tt, roughness: 0.35 });
    // pilotis no térreo
    for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) k.add(white, new THREE.CylinderGeometry(0.35, 0.35, 4, 10), [1, 1, 1], [i * (W / 7), 2, s * D * 0.3]);
    k.box(glass, W * 0.4, 3, D * 0.4, 0, 1.5, 0);
    k.box(white, W, H - 4, D, 0, 4 + (H - 4) / 2, 0);
    for (const s of [-1, 1]) k.box(tile, 0.2, H - 4, D, s * (W / 2 + 0.1), 4 + (H - 4) / 2, 0);
    // varandas corridas e peitoris ventilados na frente; janelas em fita atrás
    for (let f = 0; f < 11; f++) { const y = 4 + f * 3; k.box(glass, W - 1, 1.9, 0.1, 0, y + 1.5, D / 2 + 0.05).box(white, W, 0.25, 1.2, 0, y + 0.05, D / 2 + 0.6).box(mat('#cfc8b8'), W, 0.9, 0.12, 0, y + 0.55, D / 2 + 1.15); k.box(glass, W - 1, 1.2, 0.1, 0, y + 1.6, -D / 2 - 0.05); }
    k.build(group, b.cx, b.cz, Math.atan2(fx, fz));
    label('Edifício Acaiaca', b.cx, b.cz);
  }

  // ---------------------------------------------------------------- Primeiro, Segundo e Terceiro Jardim de Boa Viagem
  const pts = avBoaViagem(data);
  if (pts.length > 2) {
    const j3 = data.pois.find((p) => p.name === 'Praça 3º jardim de Boa Viagem');
    const spots = [['Primeiro Jardim', alongAv(pts, 700)], ['Segundo Jardim', alongAv(pts, 1590)], ['Terceiro Jardim', j3 ? [j3.x, j3.z] : alongAv(pts, 2680)]];
    for (const [name, [x, z]] of spots) {
      const c = findClear(x, z, 8, 90); if (!c) continue;
      const k = new Kit(), grass = mat('#4f8f3e', { roughness: 0.95 }), trunk = mat('#a89a80', { roughness: 0.9 }), frond = mat('#3c7a35', { roughness: 0.7, side: THREE.DoubleSide });
      k.box(grass, 18, 0.08, 18, c[0], 0.05, c[1]);
      for (let i = 0; i < 6; i++) { // coqueiros
        const a = (i / 6) * Math.PI * 2, px = c[0] + Math.cos(a) * 7.5, pz = c[1] + Math.sin(a) * 7.5, h = 8 + (i % 3);
        k.add(trunk, new THREE.CylinderGeometry(0.16, 0.24, h, 7), [1, 1, 1], [px, h / 2, pz], [0.06 * Math.cos(a), 0, 0.06 * Math.sin(a)]);
        for (let f = 0; f < 7; f++) { const fa = (f / 7) * Math.PI * 2; k.add(frond, new THREE.ConeGeometry(0.4, 3.4, 4, 1).rotateX(Math.PI / 2).scale(1, 0.18, 1).translate(0, 0, 1.7), [1, 1, 1], [px, h, pz], [0.6, fa, 0], 'YXZ'); }
        stampDisc(px, pz, 0.25);
      }
      // parquinho colorido, academia ao ar livre e bancos
      const PLAY = ['#e63946', '#ffd166', '#2a9d8f', '#3a86ff'].map((cc) => mat(cc, { roughness: 0.5 }));
      k.box(PLAY[0], 0.15, 2.4, 0.15, c[0] - 3, 1.2, c[1] - 2).box(PLAY[0], 0.15, 2.4, 0.15, c[0] - 1, 1.2, c[1] - 2).box(PLAY[1], 2.2, 0.15, 0.15, c[0] - 2, 2.4, c[1] - 2);
      k.box(PLAY[2], 0.5, 0.06, 0.25, c[0] - 2.5, 0.9, c[1] - 2).box(PLAY[3], 0.5, 0.06, 0.25, c[0] - 1.5, 0.9, c[1] - 2);
      k.box(PLAY[3], 0.9, 0.08, 3.2, c[0] + 2.5, 0.9, c[1] - 2, [0.45, 0, 0]).box(PLAY[1], 0.9, 1.6, 0.9, c[0] + 2.5, 0.8, c[1] - 3.6);
      for (let i = 0; i < 3; i++) k.box(mat('#9aa3a8', { metalness: 0.6 }), 0.1, 1.8, 0.1, c[0] - 3 + i * 3, 0.9, c[1] + 3).box(mat('#9aa3a8', { metalness: 0.6 }), 1.2, 0.08, 0.08, c[0] - 3 + i * 3, 1.8, c[1] + 3);
      for (const s of [-1, 1]) k.box(mat('#6b4a33'), 2.2, 0.1, 0.5, c[0] + s * 5, 0.5, c[1] + 6).box(mat('#6b4a33'), 2.2, 0.45, 0.08, c[0] + s * 5, 0.8, c[1] + 6.25);
      k.build(group, 0, 0, 0, true, true);
      label(name + ' de Boa Viagem', c[0], c[1]);
    }
  }

  // ---------------------------------------------------------------- RioMar: rampa helicoidal e passarela
  const ramp = data.roads.filter((r) => r.n === 'Rampa Helicoidal RioMar').flatMap((r) => r.p);
  if (ramp.length > 4) {
    const cx = ramp.reduce((s, p) => s + p[0], 0) / ramp.length, cz = ramp.reduce((s, p) => s + p[1], 0) / ramp.length;
    const R = Math.max(5, ramp.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cz), 0) / ramp.length);
    const k = new Kit(), deck = mat('#e9e6df', { roughness: 0.7 }), rail = mat('#f7f7f4', { metalness: 0.4, roughness: 0.3 }); k.keepOnRoad = true;
    const turns = 2, rise = 7.5, N = 64;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * turns * Math.PI * 2, a1 = ((i + 1) / N) * turns * Math.PI * 2, y0 = (i / N) * rise, y1 = ((i + 1) / N) * rise;
      const am = (a0 + a1) / 2, ym = (y0 + y1) / 2, len = R * (a1 - a0);
      const x = cx + Math.cos(am) * R, z = cz + Math.sin(am) * R, yaw = -am, slope = Math.atan2(y1 - y0, len);
      k.add(deck, new THREE.BoxGeometry(2.6, 0.3, len + 0.1), [1, 1, 1], [x, ym, z], [slope, yaw, 0], 'YXZ');
      k.add(rail, new THREE.BoxGeometry(0.08, 0.08, len + 0.1), [1, 1, 1], [cx + Math.cos(am) * (R + 1.3), ym + 1.1, cz + Math.sin(am) * (R + 1.3)], [slope, yaw, 0], 'YXZ');
      if (i % 4 === 0) k.box(mat('#cfcac0'), 0.35, ym, 0.35, cx + Math.cos(am) * R, ym / 2, cz + Math.sin(am) * R);
    }
    k.add(mat('#cfcac0'), new THREE.CylinderGeometry(0.8, 0.8, rise + 1, 16), [1, 1, 1], [cx, (rise + 1) / 2, cz]);
    k.build(group, 0, 0, 0, true, false);
    stampDisc(cx, cz, R + 1.4);
    label('Rampa Helicoidal do RioMar', cx, cz);
  }
  for (const r of data.roads.filter((q) => q.n === 'Passarela Riomar')) {
    const [a, b] = [r.p[0], r.p.at(-1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L, k = new Kit(), white = mat('#f7f7f4', { metalness: 0.4, roughness: 0.3 }); k.keepOnRoad = true;
    // dois arcos brancos sobre a passarela, com tirantes
    for (const s of [-1, 1]) for (let i = 0; i <= 16; i++) {
      const t0 = i / 16, t1 = (i + 1) / 16; if (i === 16) break;
      const y0 = Math.sin(Math.PI * t0) * 6, y1 = Math.sin(Math.PI * t1) * 6, x0 = a[0] + (b[0] - a[0]) * t0 + nx * 1.6 * s, z0 = a[1] + (b[1] - a[1]) * t0 + nz * 1.6 * s;
      const seg = Math.hypot(L / 16, y1 - y0), sl = Math.atan2(y1 - y0, L / 16);
      k.add(white, new THREE.BoxGeometry(0.3, 0.3, seg), [1, 1, 1], [x0 + (b[0] - a[0]) / 32, (y0 + y1) / 2 + 1, z0 + (b[1] - a[1]) / 32], [-sl, yaw, 0], 'YXZ');
      if (i % 2 === 0 && i) k.box(white, 0.05, y0, 0.05, x0, y0 / 2 + 1, z0);
    }
    k.build(group, 0, 0, 0, true, false);
  }

  // ---------------------------------------------------------------- Cais José Estelita: armazéns de açúcar à beira d'água
  // Os galpões do antigo pátio ferroviário (símbolo do Ocupe Estelita), entre a avenida e a Bacia do Pina.
  const est = data.roads.filter((r) => r.n === 'Avenida Engenheiro José Estelita').flatMap((r) => r.p).sort((a, b) => a[0] - b[0]);
  if (est.length > 4) {
    const k = new Kit(), brick = mat('#b5704a', { roughness: 0.95 }), roofM = mat('#7b7f82', { metalness: 0.4, roughness: 0.6 }), door = mat('#4a3a2a');
    let placed = 0, first = null;
    for (let i = 0; i < est.length - 1 && placed < 10; i++) {
      const [ax, az] = est[i], [bx, bz] = est[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 20) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let d = 12; d < L - 12 && placed < 10; d += 30) {
        for (const s of [-1, 1]) {
          const nx = -uz * s, nz = ux * s, x = ax + ux * d + nx * 20, z = az + uz * d + nz * 20;
          if (!env.isWater(ax + ux * d + nx * 45, az + uz * d + nz * 45)) continue; // lado da água
          let ok = true; for (let a = -12; a <= 12 && ok; a += 4) for (let b2 = -7; b2 <= 7 && ok; b2 += 3.5) { const px = x + ux * a + nx * b2, pz = z + uz * a + nz * b2; if (!free(px, pz) || env.isRoad?.(px, pz)) ok = false; }
          if (!ok) continue;
          const yaw = Math.atan2(ux, uz), g = new Kit();
          g.box(brick, 14, 6, 26, 0, 3, 0);
          g.add(roofM, new THREE.CylinderGeometry(7.6, 7.6, 26.4, 3, 1, false), [1, 0.35, 1], [0, 6.0, 0], [Math.PI / 2, 0, 0]); // telhado de duas águas
          for (let j = -2; j <= 2; j++) g.box(door, 0.1, 3.4, 2.6, 7.02, 1.7, j * 5).box(door, 0.1, 3.4, 2.6, -7.02, 1.7, j * 5);
          g.build(group, x, z, yaw);
          if (!first) first = [x, z];
          placed++; break;
        }
      }
    }
    if (first) label('Armazéns do Cais José Estelita', first[0], first[1]);
    void k;
  }

  const all = people;
  anim.push((t, cam) => { if (!cam) return; for (const p of all) p.visible = p.position.distanceToSquared(cam) < 140 * 140; });
  return anim;
}

// eixo longo do contorno
function obbLong(r) {
  let best = null;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of r) { const u = p[0] * ux + p[1] * uz, v = -p[0] * uz + p[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = (u1 - u0) >= (v1 - v0) ? { area, ux, uz, len: u1 - u0, wid: v1 - v0 } : { area, ux: -uz, uz: ux, len: v1 - v0, wid: u1 - u0 };
  }
  return best;
}
