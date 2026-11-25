// Boemia e comida de rua do Recife: botecos históricos (placa na fachada, mesas de plástico na calçada, gente sentada,
// roda de chorinho ou samba), a estátua de Chico Science na Rua da Moeda, o frevo da Praça do Arsenal, a feirinha e
// as tapiocas da Pracinha de Boa Viagem, o quiosque de tapioca na orla, as barracas da Rua Nova, o Parque da Rua da
// Aurora, a Lagoa do Araçá e o peixe frito na areia de Brasília Teimosa.
// Posição: o ponto do OSM quando existe; senão a rua do endereço (aproximado).
import * as THREE from 'three';
import { Kit } from './classics.js';
import { makePerson } from './models.js';
import { frevoPose } from './frevo.js';
import { stampDisc } from './collide.js';

const DIRS = Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * Math.PI * 2), Math.sin((i / 16) * Math.PI * 2)]);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#5c3a1e', '#a0662f', '#f1c27d'];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const signTex = (text, bg, fg, font = 'bold 60px Georgia', w = 512, h = 128) => canvasTex(w, h, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = parseInt(/(\d+)px/.exec(font)[1], 10); while (g.measureText(text).width > w - 40 && size > 20) { size -= 4; g.font = font.replace(/\d+px/, size + 'px'); }
  g.fillText(text, w / 2, h / 2 + 3);
});

export function buildBoemia(group, data, env, mat) {
  const anim = [], people = [], dancers = [];
  const isRoad = (x, z) => !!env.isRoad?.(x, z);
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z) && !isRoad(x, z);
  const label = (name, x, z, kind = 'bar') => { if (!data.pois.some((p) => p.name === name)) data.pois.push({ name, kind, x, z }); };
  const poi = (re) => data.pois.find((p) => (re instanceof RegExp ? re.test(p.name) : p.name === re));
  const road = (n) => data.roads.filter((r) => r.n === n).flatMap((r) => r.p);
  const mid = (pts) => pts.length ? pts[Math.floor(pts.length / 2)] : null;
  const seatPose = (p) => { const u = p.userData; u.legL.rotation.x = u.legR.rotation.x = -1.45; u.kneeL.rotation.x = u.kneeR.rotation.x = 1.45; u.armL.rotation.set(-0.5, 0, -0.1); u.elbowL.rotation.x = -1.2; };
  const person = (x, z, yaw, opts = {}, seated = false) => {
    const p = makePerson({ skin: pick(SKIN), ...opts }); if (seated) { seatPose(p); p.position.set(x, -0.01, z); } else p.position.set(x, 0, z);
    p.rotation.y = yaw; group.add(p); people.push(p); return p;
  };

  // calçada em frente a uma fachada: ponto livre com prédio de um lado e rua do outro
  const frontSpot = (x, z, R = 50) => {
    for (let r = 0; r <= R; r += 2) for (let a = 0; a < 24; a++) {
      const px = x + Math.cos((a / 24) * Math.PI * 2) * r, pz = z + Math.sin((a / 24) * Math.PI * 2) * r;
      if (!free(px, pz)) continue;
      for (const [dx, dz] of DIRS) {
        let wall = 0; for (let k = 1; k <= 5; k++) if (env.isSolid(px + dx * k, pz + dz * k)) { wall = k; break; }
        if (!wall) continue;
        let st = 0; for (let k = 2; k <= 14; k += 1) if (isRoad(px - dx * k, pz - dz * k)) { st = k; break; }
        if (!st) continue;
        // passo pra perto da parede e devolve: d = direção da parede, face = olhando pra rua
        return { x: px + dx * (wall - 1.2), z: pz + dz * (wall - 1.2), dx, dz, wall: 1.2, street: st + wall - 1.2, face: Math.atan2(-dx, -dz) };
      }
    }
    return null;
  };
  // mesa de plástico com quatro cadeiras e gente sentada
  const TABLE_COLS = ['#d7263d', '#f2b705', '#1d5fa8', '#f2f2ee'];
  const table = (k, x, z, col, who) => {
    const m = mat(col, { roughness: 0.5 });
    k.add(m, new THREE.CylinderGeometry(0.42, 0.42, 0.04, 14), [1, 1, 1], [x, 0.72, z]); k.box(m, 0.06, 0.72, 0.06, x, 0.36, z);
    k.add(mat('#c9a227', { roughness: 0.3 }), new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8), [1, 1, 1], [x + 0.1, 0.87, z]); // garrafa
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4, cx = x + Math.cos(a) * 0.72, cz = z + Math.sin(a) * 0.72;
      k.box(m, 0.42, 0.05, 0.42, cx, 0.44, cz).box(m, 0.42, 0.42, 0.05, cx + Math.cos(a) * 0.2, 0.66, cz + Math.sin(a) * 0.2, [0, -a + Math.PI / 2, 0]);
      if (i < who) person(cx, cz, Math.atan2(x - cx, z - cz), {}, true);
    }
    stampDisc(x, z, 0.5);
  };
  // boteco: placa na fachada, toldo, mesas na calçada e o que mais vier (música, fila)
  const boteco = (name, at, { bg = '#2b1d14', fg = '#f2d16b', font, awning = '#c8102e', tables = 4, extra, near = 50 } = {}) => {
    if (!at) return null;
    const s = frontSpot(at[0], at[1], near); if (!s) return null;
    const k = new Kit(), tx = -s.dz, tz = s.dx; // tangente da fachada
    const wx = s.x + s.dx * (s.wall - 0.06), wz = s.z + s.dz * (s.wall - 0.06);
    const sign = signTex(name, bg, fg, font);
    k.add(new THREE.MeshStandardMaterial({ map: sign, roughness: 0.6, emissive: '#ffffff', emissiveMap: sign, emissiveIntensity: 0.12 }), new THREE.PlaneGeometry(4.6, 1.15), [1, 1, 1], [wx, 3.5, wz], [0, s.face, 0]);
    // toldo listrado inclinado
    const aw = canvasTex(64, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : awning; g.fillRect(i * 8, 0, 8, 64); } });
    aw.wrapS = THREE.RepeatWrapping;
    const ag = new THREE.PlaneGeometry(5, 1.6); const uv = ag.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 3);
    k.add(new THREE.MeshStandardMaterial({ map: aw, side: THREE.DoubleSide, roughness: 0.8 }), ag, [1, 1, 1], [wx - s.dx * 0.7, 2.75, wz - s.dz * 0.7], [-1.05, s.face, 0], 'YXZ');
    // mesas na calçada (só onde não é rua)
    const n = Math.min(tables, 6);
    for (let i = 0; i < n; i++) {
      const along = (i - (n - 1) / 2) * 2.1, out = 1.3 + (i % 2) * 1.6;
      const x = s.x - s.dx * out + tx * along, z = s.z - s.dz * out + tz * along;
      if (!free(x, z) || out > s.street - 1.2) continue;
      table(k, x, z, TABLE_COLS[i % TABLE_COLS.length], 1 + ((i * 7) % 3));
    }
    extra?.(k, s, tx, tz);
    k.build(group, 0, 0, 0, true, false);
    label(name, s.x, s.z);
    return s;
  };
  // músicos de roda (chorinho, samba, forró): sentados em volta de uma mesinha, balançando
  const roda = (k, s, tx, tz, kinds = ['violão', 'pandeiro', 'cavaquinho']) => {
    const cx = s.x - s.dx * 2.2 + tx * 5.2, cz = s.z - s.dz * 2.2 + tz * 5.2; if (!free(cx, cz)) return;
    k.add(mat('#8a6a48'), new THREE.CylinderGeometry(0.4, 0.4, 0.05, 12), [1, 1, 1], [cx, 0.7, cz]);
    kinds.forEach((kind, i) => {
      const a = (i / kinds.length) * Math.PI * 2, x = cx + Math.cos(a) * 0.95, z = cz + Math.sin(a) * 0.95;
      k.box(mat('#6b4a33'), 0.42, 0.05, 0.42, x, 0.44, z);
      const p = person(x, z, Math.atan2(cx - x, cz - z), { longSleeve: false }, true);
      const ins = kind === 'pandeiro' ? new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14), mat('#e9dcc0')) : new THREE.Mesh(new THREE.BoxGeometry(kind === 'violão' ? 0.32 : 0.2, 0.08, kind === 'violão' ? 0.75 : 0.5), mat('#8a5a2b'));
      ins.position.set(0, 1.0, 0.25); ins.rotation.set(kind === 'pandeiro' ? 1.2 : 0.2, 0, kind === 'pandeiro' ? 0 : 1.0); p.add(ins);
      dancers.push({ p, style: 'toca', ph: i * 1.3 });
    });
  };
  // fila na porta
  const fila = (k, s, tx, tz, n = 8) => { for (let i = 0; i < n; i++) { const x = s.x - s.dx * 0.6 - tx * (3.4 + i * 0.8), z = s.z - s.dz * 0.6 - tz * (3.4 + i * 0.8); if (free(x, z)) person(x, z, Math.atan2(tx, tz)); } };
  // barraca de feira: lona colorida sobre quatro pés, bancada com mercadoria
  const barraca = (k, x, z, yaw, lona, goods, sign) => {
    const c = Math.cos(yaw), sn = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
    for (const [lx, lz] of [[-1.1, -0.8], [1.1, -0.8], [-1.1, 0.8], [1.1, 0.8]]) { const [px, pz] = at(lx, lz); k.box(mat('#cfcfca', { metalness: 0.5 }), 0.06, 2.3, 0.06, px, 1.15, pz); }
    k.box(mat(lona, { roughness: 0.8 }), 2.6, 0.08, 2.0, x, 2.32, z, [0, yaw, 0]);
    k.box(mat('#8a6a48'), 2.2, 0.08, 0.9, ...((p) => [p[0], 0.9, p[1]])(at(0, 0.3)), [0, yaw, 0]);
    for (let i = 0; i < 5; i++) { const [px, pz] = at(-0.85 + i * 0.42, 0.3); k.box(mat(goods[i % goods.length], { roughness: 0.6 }), 0.32, 0.2, 0.32, px, 1.04, pz); }
    if (sign) { const [px, pz] = at(0, -0.95); const t = signTex(sign, '#fff7e0', '#b5361f', 'bold 64px Arial', 512, 96); k.add(new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), new THREE.PlaneGeometry(2.2, 0.42), [1, 1, 1], [px, 2.05, pz], [0, yaw + Math.PI, 0]); }
    const [vx, vz] = at(0, 1.4); person(vx, vz, yaw + Math.PI, { longSleeve: false });
    stampDisc(x, z, 1.2);
  };
  // pontos livres em volta de um centro (pra espalhar barracas)
  const spread = (x, z, n, r0, r1, step = 6) => {
    const out = [];
    for (let r = r0; r <= r1 && out.length < n; r += 3) for (let a = 0; a < 20 && out.length < n; a++) {
      const px = x + Math.cos(a * 0.9 + r) * r, pz = z + Math.sin(a * 0.9 + r) * r;
      let ok = true; for (const [dx, dz] of [[0, 0], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) if (!free(px + dx, pz + dz)) ok = false;
      if (ok && out.every((q) => Math.hypot(q[0] - px, q[1] - pz) > step)) out.push([px, pz]);
    }
    return out;
  };

  // ------------------------------------------------ Recife Antigo
  // Bodega de Véio (R. Mariz e Barros): armazém antigo com música ao vivo
  boteco('Bodega de Véio', (() => { const p = poi('Bodega de Velo'); return p ? [p.x, p.z] : mid(road('Rua Mariz e Barros')); })(), {
    bg: '#5a3a1e', fg: '#f3e2b3', font: 'bold 62px Georgia', awning: '#7a4b2a', tables: 5,
    extra: (k, s, tx, tz) => roda(k, s, tx, tz, ['violão', 'sanfona', 'pandeiro']),
  });
  // Boteco da Moeda (R. da Moeda), ao lado da estátua de Chico Science
  const chico = poi('Chico Science');
  boteco('Boteco da Moeda', chico ? [chico.x + 6, chico.z + 6] : mid(road('Rua da Moeda')), { bg: '#1d3b2a', fg: '#f2d16b', awning: '#2a7a4a', tables: 5 });
  if (chico) {
    // Chico Science em bronze, de chapéu e óculos escuros, em pé no chão da rua (no lugar do boneco genérico)
    const p = makePerson({ glasses: true, hat: 'bone', longSleeve: false, player: true });
    const bronze = new THREE.MeshStandardMaterial({ color: '#6b5332', metalness: 0.65, roughness: 0.4 });
    p.traverse((o) => { if (o.isMesh) { o.material = bronze; o.castShadow = true; } });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 20), bronze); brim.position.y = 1.83;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.13, 16), bronze); crown.position.y = 1.9;
    p.userData.upper.add(brim, crown);
    p.userData.armR.rotation.set(-0.4, 0, 0.5); p.userData.elbowR.rotation.x = -1.4; p.userData.legL.rotation.x = 0.15; p.userData.legR.rotation.x = -0.12;
    p.position.set(chico.x, 0, chico.z); p.rotation.y = Math.random() * 6; p.scale.setScalar(1.1);
    group.add(p); stampDisc(chico.x, chico.z, 0.5);
    data.chicoStatue = true;
  }
  // Bar Zero Um (R. Tomazina): botequim de calçada
  boteco('Bar Zero Um', mid(road('Rua Tomazina')), { bg: '#f2f2ee', fg: '#c8102e', font: 'bold 70px Arial', awning: '#c8102e', tables: 6 });
  // Teatro Mamulengo (R. da Guia): bar cultural com chorinho e samba
  boteco('Teatro Mamulengo', mid(road('Rua da Guia')), { bg: '#6a1b4d', fg: '#ffd166', font: 'bold 56px Georgia', awning: '#6a1b4d', tables: 4, extra: (k, s, tx, tz) => roda(k, s, tx, tz) });

  // ------------------------------------------------ Boa Vista e Zona Norte
  const lis = poi('Lisbela & prisioneiros');
  boteco('Lisbela e Prisioneiros', lis && [lis.x, lis.z], { bg: '#f4e3c1', fg: '#7a1f1f', font: 'italic bold 52px Georgia', awning: '#7a1f1f', tables: 5,
    extra: (k, s, tx, tz) => { // vitrola de discotecagem na calçada
      const x = s.x - s.dx * 1.0 + tx * 4.6, z = s.z - s.dz * 1.0 + tz * 4.6; if (!free(x, z)) return;
      k.box(mat('#3a2a1e'), 1.0, 0.9, 0.6, x, 0.45, z, [0, s.face, 0]); k.add(mat('#111'), new THREE.CylinderGeometry(0.22, 0.22, 0.02, 20), [1, 1, 1], [x, 0.92, z]);
      dancers.push({ p: person(x - s.dx * 0.7, z - s.dz * 0.7, s.face + Math.PI, { hat: 'bone' }), style: 'dj', ph: 0 });
    } });
  // Bar do Tonhão (R. Amaro Coutinho, Encruzilhada): o ponto do OSM que fica mais perto da rua do endereço
  const amaro = road('Rua Amaro Coutinho');
  const ton = data.pois.filter((p) => p.name === 'Bar do Tonhão').sort((a, b) => Math.min(...amaro.map((q) => Math.hypot(q[0] - a.x, q[1] - a.z))) - Math.min(...amaro.map((q) => Math.hypot(q[0] - b.x, q[1] - b.z))))[0];
  boteco('Bar do Tonhão', ton ? [ton.x, ton.z] : mid(amaro), { bg: '#1d5fa8', fg: '#ffffff', font: 'bold 64px Arial', awning: '#1d5fa8', tables: 6 });
  // Real Botequim (Av. 17 de Agosto, Casa Forte): chope e roda de chorinho
  const rb = poi('Real Botequim');
  boteco('Real Botequim', rb && [rb.x, rb.z], { bg: '#0f3b2e', fg: '#e8d29a', font: 'bold 60px Georgia', awning: '#0f3b2e', tables: 6, extra: (k, s, tx, tz) => roda(k, s, tx, tz, ['violão', 'cavaquinho', 'pandeiro', 'flauta']) });
  // Boteco do Bêu (R. da Regeneração, Água Fria): roda de samba e fila na porta
  boteco('Boteco do Bêu', mid(road('Rua da Regeneração')), { bg: '#f2b705', fg: '#2b1d14', font: 'bold 62px Arial', awning: '#f2b705', tables: 6,
    extra: (k, s, tx, tz) => { roda(k, s, tx, tz, ['pandeiro', 'cavaquinho', 'violão', 'tantã']); fila(k, s, tx, tz, 7); } });
  // Tatu Bola (Av. Herculano Bandeira, Pina): bar grande de samba e pagode
  boteco('Tatu Bola', mid(road('Avenida Herculano Bandeira')), { bg: '#2a9d8f', fg: '#ffffff', font: 'bold 70px Arial', awning: '#2a9d8f', tables: 6, extra: (k, s, tx, tz) => roda(k, s, tx, tz, ['pandeiro', 'cavaquinho', 'violão', 'tantã', 'repique']) });
  // Parraxaxá (Boa Viagem e Casa Forte): cactos, carro de boi e chapéus de couro na entrada
  for (const p of data.pois.filter((q) => q.name === 'Parraxaxá')) {
    const s = frontSpot(p.x, p.z, 40); if (!s) continue;
    const k = new Kit(), tx = -s.dz, tz = s.dx;
    for (const t of [-3, 3]) { const x = s.x - s.dx * 1.2 + tx * t, z = s.z - s.dz * 1.2 + tz * t; if (!free(x, z)) continue; k.add(mat('#3f7f45'), new THREE.CylinderGeometry(0.2, 0.25, 2.2, 8), [1, 1, 1], [x, 1.1, z]); for (const a of [-1, 1]) k.add(mat('#3f7f45'), new THREE.CylinderGeometry(0.13, 0.15, 0.9, 8), [1, 1, 1], [x + tx * a * 0.35, 1.4, z + tz * a * 0.35]); stampDisc(x, z, 0.4); }
    const x = s.x - s.dx * 1.6, z = s.z - s.dz * 1.6;
    if (free(x, z)) { k.add(mat('#6b4423'), new THREE.TorusGeometry(0.7, 0.07, 6, 16), [1, 1, 1], [x, 0.75, z], [0, s.face + Math.PI / 2, 0]); for (let i = 0; i < 4; i++) k.box(mat('#6b4423'), 0.06, 1.4, 0.06, x, 0.75, z, [i * 0.785, s.face + Math.PI / 2, 0], 'YXZ'); }
    k.build(group, 0, 0, 0, true, false);
  }

  // ------------------------------------------------ Frevo na Praça do Arsenal (fins de semana o ano todo)
  const ars = poi(/^Praça do Arsenal/) || poi('Paço do Frevo');
  if (ars) {
    const pts = spread(ars.x, ars.z, 10, 6, 60, 8).filter(([x, z]) => DIRS.every(([dx, dz]) => free(x + dx * 5.5, z + dz * 5.5)));
    if (pts[0]) {
      const [cx, cz] = pts[0], k = new Kit();
      // orquestra em meia-lua: metais (trompete, trombone, sax) e percussão
      const FREVO_COLS = ['#d7263d', '#f2b705', '#1d5fa8', '#2a9d58'];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.15 + (i / 5) * 0.7), x = cx + Math.cos(a) * 5, z = cz + Math.sin(a) * 5;
        if (!free(x, z)) continue; // músico nunca na rua
        const p = person(x, z, Math.atan2(cx - x, cz - z), { shirt: '#f2f2ee', pants: '#1d1d1d', longSleeve: false });
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#d4a73a', metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
        horn.position.set(0, 1.62, 0.38); horn.rotation.x = -Math.PI / 2 + 0.2; p.add(horn);
        p.userData.armL.rotation.x = p.userData.armR.rotation.x = -1.2; p.userData.elbowL.rotation.x = p.userData.elbowR.rotation.x = -0.9;
        dancers.push({ p, style: 'toca', ph: i });
      }
      // passistas com sombrinha
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2, x = cx + Math.cos(a) * 1.8, z = cz - 1 + Math.sin(a) * 1.8;
        if (!free(x, z)) continue;
        const p = person(x, z, Math.random() * 6, { hand: 'sombrinha', shirt: FREVO_COLS[i % 4], longSleeve: false });
        dancers.push({ p, style: 'frevo', ph: i * 0.7, x, z });
      }
      k.build(group, 0, 0, 0);
      label('Frevo na Praça do Arsenal', cx, cz, 'attraction');
    }
  }

  // ------------------------------------------------ Pracinha de Boa Viagem: feirinha de artesanato e tapioca molhada
  const pbv = poi('Praça Boa Viagem');
  if (pbv) {
    const k = new Kit(), pts = spread(pbv.x, pbv.z, 9, 6, 45, 5.5);
    const LONAS = ['#f4f1ea', '#f2b705', '#d7263d', '#2a9d8f', '#1d5fa8'];
    pts.forEach(([x, z], i) => {
      const yaw = Math.atan2(pbv.x - x, pbv.z - z);
      if (i < 3) barraca(k, x, z, yaw, '#f4f1ea', ['#f7f2dc', '#f4f1ea', '#e9d9a8'], i === 2 ? 'Caldinho' : 'Tapioca molhada');
      else barraca(k, x, z, yaw, LONAS[i % LONAS.length], ['#c8102e', '#f2b705', '#2a9d8f', '#8a5a2b', '#6a1b4d'], i === 3 ? 'Artesanato' : null);
    });
    k.build(group, 0, 0, 0, true, false);
    label('Pracinha de Boa Viagem · tapioca e feirinha', pbv.x, pbv.z, 'attraction');
  }
  // Tapioca Rendada do Damião: quiosque na calçada da orla, um pouco ao norte da Pracinha
  const orla = data.roads.filter((r) => r.n === 'Avenida Boa Viagem').flatMap((r) => r.p);
  if (orla.length && pbv) {
    const ref = orla.filter((p) => p[1] < pbv.z - 300 && p[1] > pbv.z - 600).sort((a, b) => a[1] - b[1])[0];
    if (ref) {
      const sea = (() => { for (const [dx, dz] of DIRS) for (let k = 10; k < 120; k += 4) if (env.isWater(ref[0] + dx * k, ref[1] + dz * k)) return [dx, dz]; return [1, 0]; })();
      let spot = null; for (let k = 8; k < 30 && !spot; k += 1.5) { const x = ref[0] + sea[0] * k, z = ref[1] + sea[1] * k; if (free(x, z) && free(x + 2, z) && free(x - 2, z)) spot = [x, z]; }
      if (spot) {
        const k = new Kit(), yaw = Math.atan2(-sea[0], -sea[1]);
        barraca(k, spot[0], spot[1], yaw, '#2a9d8f', ['#f7f2dc', '#e9d9a8'], 'Tapioca Rendada');
        k.build(group, 0, 0, 0, true, false);
        label('Tapioca Rendada do Damião', spot[0], spot[1], 'restaurant');
      }
    }
  }

  // ------------------------------------------------ Rua Nova: barracas de fruta e roupa e artista de rua com caixa de som
  const rn = road('Rua Nova');
  if (rn.length) {
    const k = new Kit(); let n = 0;
    for (let i = 0; i < rn.length - 1 && n < 8; i++) {
      const [ax, az] = rn[i], [bx, bz] = rn[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 6) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let d = 3; d < L && n < 8; d += 9) for (const sd of [1, -1]) {
        const x = ax + ux * d - uz * sd * 6, z = az + uz * d + ux * sd * 6;
        if (!free(x, z) || !free(x + ux * 1.4, z + uz * 1.4) || !free(x - ux * 1.4, z - uz * 1.4)) continue;
        barraca(k, x, z, Math.atan2(uz * sd, -ux * sd), pick(['#d7263d', '#2a9d8f', '#f2b705', '#1d5fa8']), n % 2 ? ['#f2b705', '#7fb03a', '#e76f2a'] : ['#d7263d', '#1d5fa8', '#f2f2ee'], n % 2 ? 'Fruta' : 'Roupa');
        n++; break;
      }
    }
    // artista de rua com caixa de som
    const [x, z] = rn[Math.floor(rn.length / 2)];
    for (const [dx, dz] of DIRS) { const px = x + dx * 6, pz = z + dz * 6; if (!free(px, pz)) continue; k.box(mat('#1a1a1a'), 0.5, 0.8, 0.45, px + 0.8, 0.4, pz); dancers.push({ p: person(px, pz, Math.random() * 6, { hat: 'bone' }), style: 'frevo', ph: 1, x: px, z: pz }); break; }
    k.build(group, 0, 0, 0, true, false);
    label('Comércio da Rua Nova', x, z, 'attraction');
  }

  // ------------------------------------------------ Parque da Rua da Aurora: skatistas e feirinha criativa à beira do Capibaribe
  const pra = poi('da Rua da Aurora');
  if (pra) {
    const k = new Kit(), pts = spread(pra.x, pra.z, 4, 4, 40, 6);
    pts.forEach(([x, z], i) => barraca(k, x, z, Math.random() * 6, pick(['#f2b705', '#e76f2a', '#2a9d8f', '#6a1b4d']), ['#f4f1ea', '#c8102e', '#1d5fa8'], i === 0 ? 'Feirinha' : null));
    // skatistas indo e voltando
    const sk = spread(pra.x, pra.z, 2, 8, 50, 12);
    for (const [x, z] of sk) {
      const p = person(x, z, 0, { hat: 'bone', longSleeve: false });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.8), mat('#e63946')); board.position.y = 0.08; p.add(board);
      p.userData.legL.rotation.x = 0.25; p.userData.legR.rotation.x = -0.25; p.userData.armL.rotation.z = -0.8; p.userData.armR.rotation.z = 0.8;
      dancers.push({ p, style: 'skate', ph: Math.random() * 6, x, z, len: 7 });
    }
    k.build(group, 0, 0, 0, true, false);
    label('Parque da Rua da Aurora', pra.x, pra.z, 'park');
  }

  // ------------------------------------------------ Lagoa do Araçá (Imbiribeira): barracas de espetinho e caldinho na volta da lagoa
  const lpp = data.buildings.find((b) => b.n === 'Posto de Policiamento Comunitário Lagoa do Araçá');
  if (lpp) {
    // maior espelho d'água perto: a lagoa
    let best = null;
    for (const w of data.water) { let cx = 0, cz = 0; for (const p of w) { cx += p[0]; cz += p[1]; } cx /= w.length; cz /= w.length; const d = Math.hypot(cx - lpp.cx, cz - lpp.cz); if (d < 400 && (!best || w.length > best.n)) best = { cx, cz, n: w.length, w }; }
    if (best) {
      const k = new Kit(); let n = 0;
      for (let i = 0; i < best.w.length && n < 5; i += Math.max(1, Math.floor(best.w.length / 6))) {
        const [px, pz] = best.w[i], d = Math.hypot(px - best.cx, pz - best.cz) || 1, ox = (px - best.cx) / d, oz = (pz - best.cz) / d;
        for (let r = 5; r < 25; r += 2) { const x = px + ox * r, z = pz + oz * r; if (free(x, z) && free(x + ox * 1.5, z + oz * 1.5) && free(x - oz * 1.5, z + ox * 1.5)) { barraca(k, x, z, Math.atan2(-ox, -oz), pick(['#d7263d', '#f2b705', '#2a9d8f']), ['#8a5a2b', '#f2d16b', '#c8102e'], n % 2 ? 'Caldinho' : 'Espetinho'); if (free(x + ox * 3.5, z + oz * 3.5)) table(k, x + ox * 3.5, z + oz * 3.5, TABLE_COLS[n % 4], 2); n++; break; } }
      }
      k.build(group, 0, 0, 0, true, false);
      label('Lagoa do Araçá', best.cx, best.cz, 'park');
    }
  }

  // ------------------------------------------------ Brasília Teimosa (Buraco da Velha): peixe frito e agulhinha na areia
  const bt = data.bairros.find((b) => b.name === 'Brasília Teimosa');
  if (bt) {
    const k = new Kit(); let n = 0;
    for (let r = 50; r < 600 && n < 4; r += 25) for (let a = 0; a < 24 && n < 4; a++) {
      const x = bt.x + Math.cos(a / 24 * Math.PI * 2) * r, z = bt.z + Math.sin(a / 24 * Math.PI * 2) * r;
      if (!free(x, z)) continue;
      let sea = null; for (const [dx, dz] of DIRS) if (env.isWater(x + dx * 12, z + dz * 12)) { sea = [dx, dz]; break; }
      if (!sea || !free(x - sea[0] * 3, z - sea[1] * 3)) continue;
      barraca(k, x - sea[0] * 3, z - sea[1] * 3, Math.atan2(sea[0], sea[1]), '#e9d9a8', ['#c97b3a', '#f2d16b', '#d7263d'], n % 2 ? 'Agulhinha frita' : 'Peixe frito');
      if (free(x + sea[0] * 1.5, z + sea[1] * 1.5)) table(k, x + sea[0] * 1.5, z + sea[1] * 1.5, TABLE_COLS[n % 4], 3);
      n++;
    }
    k.build(group, 0, 0, 0, true, false);
    if (n) label('Peixe frito do Buraco da Velha', bt.x, bt.z, 'restaurant');
  }

  // animação: músicos balançando, passistas de frevo agachando e pulando, skatistas indo e voltando
  anim.push((t, cam) => {
    if (!cam) return;
    for (const p of people) p.visible = p.position.distanceToSquared(cam) < 150 * 150;
    for (const d of dancers) {
      const u = d.p.userData; if (!d.p.visible) continue;
      if (d.style === 'toca') { d.p.rotation.z = Math.sin(t * 6 + d.ph) * 0.05; u.head.rotation.x = Math.sin(t * 6 + d.ph) * 0.15; }
      else if (d.style === 'dj') { u.head.rotation.x = Math.sin(t * 8) * 0.2; u.armR.rotation.x = -0.9 + Math.sin(t * 4) * 0.2; }
      else if (d.style === 'frevo') {
        const f = frevoPose(d.p, t, d.ph); // tesoura, ferrolho, dobradiça, parafuso e salto (frevo.js)
        d.yaw0 ??= d.p.rotation.y; d.p.position.y = (d.y0 ??= d.p.position.y) + f.y; d.p.rotation.y = d.yaw0 + t * 0.15 + f.yaw;
      } else if (d.style === 'skate') {
        const s = Math.sin(t * 0.6 + d.ph); d.p.position.x = d.x + s * d.len; d.p.rotation.y = Math.cos(t * 0.6 + d.ph) > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
  });
  return anim;
}
