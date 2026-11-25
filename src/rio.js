// O rio em frente ao Marco Zero: barqueiros que levam a galera até o Parque das Esculturas de Brennand, os meninos
// que dão flesheiros (mergulhos com mortal, parafuso e bomba) do cais e da Ponte Maurício de Nassau, e o Galo da
// Madrugada na beira da Ponte Duarte Coelho.
import * as THREE from 'three';
import { comSemente } from './semente.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makePerson } from './models.js';
import { stampDisc } from './collide.js';
import { heightAt } from './terrain.js';

const WATER_Y = -0.7;
const SKINS = ['#6e4630', '#8a5a3c', '#a8714b', '#c48a60', '#5a3a28'];
const BERMUDA = ['#1d5fa8', '#e63946', '#2a9d58', '#ffbe0b', '#222222', '#f2f2f0', '#ff7b3a'];

// junta peças por material (poucas chamadas de desenho)
class Batch {
  constructor() { this.m = new Map(); }
  add(mat, geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scl)));
    if (!this.m.has(mat)) this.m.set(mat, []);
    this.m.get(mat).push(g);
    return this;
  }
  build(parent, shadow = true) {
    const g = new THREE.Group();
    for (const [mat, list] of this.m) { const mesh = new THREE.Mesh(mergeGeometries(list), mat); mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh); }
    parent.add(g);
    return g;
  }
}

// mesma cidade a cada carga: o que esta montagem sorteia vem de uma semente fixa (semente.js)
export function buildRio(group, data, env) { return comSemente(3303, () => buildRioSem(group, data, env)); }
function buildRioSem(group, data, env) {
  const M = new Map();
  const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o })); return M.get(k); };
  const glowMats = [];
  const poi = (re) => data.pois.find((p) => re.test(p.name));
  let seed = 777; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const out = { boats: [], docks: [], divers: [], bodies: [], onDive: null };

  // ---------------------------------------------------------------- barqueiros do Marco Zero
  const mz = poi(/^Marco Zero$/), pk = poi(/Coluna de Cristal/) || poi(/Parque das Esculturas/);
  if (mz && pk) {
    const L = Math.hypot(pk.x - mz.x, pk.z - mz.z), ux = (pk.x - mz.x) / L, uz = (pk.z - mz.z) / L, px = -uz, pz = ux;
    // onde o cais acaba (primeira água) e onde o molhe começa (última água)
    let da = null, db = null;
    for (let d = 0; d < L; d += 0.5) { const w = env.isWater(mz.x + ux * d, mz.z + uz * d); if (w && da === null) da = d; if (w) db = d; }
    if (da !== null && db - da > 40) {
      const at = (d, o) => [mz.x + ux * d + px * o, mz.z + uz * d + pz * o];
      const landAt = (d0, step, o) => { for (let k = 0; k < 16; k++) { const [x, z] = at(d0 + step * k * 0.5, o); if (!env.isWater(x, z) && !env.isSolid(x, z)) return [x, z]; } return at(d0, o); };
      // trapiche de madeira em cada lado
      const wood = mat('#7a5a3a', { roughness: 0.9 }), dark = mat('#3b2a1c', { roughness: 0.9 });
      const tr = new Batch(), B = new THREE.BoxGeometry(1, 1, 1), yawU = Math.atan2(ux, uz);
      for (const [d0, s] of [[da, 1], [db, -1]]) for (const o of [-7, 7]) {
        // trapiche comprido: no Marco Zero a rosa dos ventos avança sobre a água
        const [x, z] = at(d0 + s * 4.5, o);
        tr.add(wood, B, [x, -0.05, z], [0, yawU, 0], [2.2, 0.16, 10]);
        for (const a of [-1, 1]) for (const b of [-4.8, -1.6, 1.6, 4.8]) { const qx = x + px * a * 1.0 + ux * b, qz = z + pz * a * 1.0 + uz * b; tr.add(dark, new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), [qx, -0.98, qz]); }
        // pneus de atracação
        for (const b of [3.0, 4.6]) tr.add(mat('#151515', { roughness: 0.95 }), new THREE.TorusGeometry(0.3, 0.12, 6, 12), [x + px * 1.15 * Math.sign(o) + ux * b * s, -0.25, z + pz * 1.15 * Math.sign(o) + uz * b * s], [0, yawU + Math.PI / 2, 0]);
      }
      tr.build(group);
      [-7, 7].forEach((off, i) => {
        const boat = makeBoat(mat, rnd, pick, i);
        group.add(boat.g);
        const A = at(da + 9.5 + 3.7, off), Bp = at(db - 9.5 - 3.7, off);
        const b = {
          ...boat, A, B: Bp, landA: landAt(da - 1.2, -1, off), landB: landAt(db + 1.2, 1, off),
          off: i * 55, side: i ? 1 : -1, yaw: yawU + Math.PI, state: 'A', speed: 0, rider: null,
        };
        out.boats.push(b);
      });
      data.pois.push({ name: 'Barqueiros do Marco Zero', kind: 'attraction', x: at(da - 2, 0)[0], z: at(da - 2, 0)[1] });

      // ---------------------------------------------------------------- flesheiros no cais
      for (const o of [-46, -32, -19, 21, 34]) {
        let e = null;
        for (let d = Math.max(0, da - 25); d < da + 25; d += 0.5) { const [x, z] = at(d, o); if (env.isWater(x, z)) { e = d; break; } }
        if (e === null) continue;
        const [x, z] = at(e - 0.45, o);
        if (env.isSolid(x, z)) continue;
        out.divers.push(makeDiver(group, rnd, pick, x, 0, z, yawU, false));
        // um amigo sentado na beira, torcendo
        if (rnd() < 0.6) {
          const [fx, fz] = at(e - 0.6, o + 1.4), f = kid(rnd, pick);
          sit(f); f.position.set(fx, 0.05, fz); f.rotation.y = yawU; group.add(f);
          out.divers.at(-1).fan = f;
        }
      }
    }
  }
  // flesheiros na Ponte Maurício de Nassau: sobem no guarda-corpo e pulam pro rio
  const nassau = data.roads.filter((r) => /^Ponte (Conde )?Maurício de Nassau/.test(r.n || '') && r.p.length >= 2);
  let best = null;
  for (const r of nassau) for (let i = 0; i < r.p.length - 1; i++) { const a = r.p[i], b = r.p[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || l > best.l) best = { a, b, l }; }
  if (best) {
    const { a, b, l } = best, ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l, nx = -uz, nz = ux, half = 5 - 0.2; // em cima do guarda-corpo
    for (const [t, s] of [[0.38, 1], [0.62, -1]]) {
      const x = a[0] + ux * l * t + nx * half * s, z = a[1] + uz * l * t + nz * half * s;
      out.divers.push(makeDiver(group, rnd, pick, x, 1.12 + heightAt(x, z), z, Math.atan2(nx * s, nz * s), true)); // em cima do guarda-corpo (o tabuleiro sobe: heightAt)
    }
  }

  // ---------------------------------------------------------------- Galo da Madrugada, ao lado da Ponte Duarte Coelho
  const dc = data.roads.filter((r) => /^Ponte Duarte Coelho/.test(r.n || '') && r.k !== 'footway');
  if (dc.length) {
    const pts = dc.flatMap((r) => r.p), cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    let seg = null;
    for (const r of dc) for (let i = 0; i < r.p.length - 1; i++) { const a = r.p[i], b = r.p[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!seg || l > seg.l) seg = { a, b, l }; }
    const ux = (seg.b[0] - seg.a[0]) / seg.l, uz = (seg.b[1] - seg.a[1]) / seg.l, nx = -uz, nz = ux;
    // lado com mais água livre
    let side = 1, bestW = -1;
    for (const s of [1, -1]) { let w = 0; for (let d = 14; d <= 34; d += 2) if (env.isWater(cx + nx * s * d, cz + nz * s * d)) w++; if (w > bestW) { bestW = w; side = s; } }
    const gx = cx + nx * side * 22, gz = cz + nz * side * 22;
    buildGalo(group, mat, glowMats, gx, gz, Math.atan2(-nx * side, -nz * side));
    stampDisc(gx, gz, 6.5);
    data.pois.push({ name: 'Galo da Madrugada', kind: 'attraction', x: gx, z: gz });
  }

  // ---------------------------------------------------------------- animação
  let last = 0;
  out.update = (t, cam, bodies) => {
    const dt = Math.min(0.1, Math.max(0, t - last)); last = t;
    for (const b of out.boats) updateBoat(b, t, dt);
    for (const d of out.divers) {
      const near = Math.hypot(d.x - cam.x, d.z - cam.z) < 220;
      d.piv.visible = near; if (d.fan) d.fan.visible = near;
      if (near) updateDiver(d, t, dt, out);
      if (d.state === 'wait' && bodies) bodies.push([d.x, d.z]);
    }
    const k = 0.6 + 0.4 * Math.sin(t * 3);
    for (const m of glowMats) m.emissiveIntensity = m.userData.base * (out.night || 0) * (0.7 + 0.3 * k) + 0.15;
  };
  out.setNight = (n) => { out.night = n; for (const b of out.boats) b.lamp.material.emissiveIntensity = n * 3; };
  // jogador perto de um barco atracado: qual barco e de que lado
  out.boardable = (x, z) => {
    for (const b of out.boats) {
      if (b.state !== 'A' && b.state !== 'B' || b.rider) continue;
      const l = b.state === 'A' ? b.landA : b.landB;
      if (Math.hypot(l[0] - x, l[1] - z) < 7) return b;
    }
    return null;
  };
  return out;
}

// ---------------------------------------------------------------- barco de madeira com toldo, barqueiro e passageiros
function makeBoat(mat, rnd, pick, i) {
  const g = new THREE.Group();
  const hullC = ['#1d5fa8', '#c8102e', '#2a9d58'][i % 3], trim = ['#f4f1ea', '#ffd166', '#f4f1ea'][i % 3];
  const outline = (s) => { const p = new THREE.Shape(); p.moveTo(-1 * s, -3.5); p.lineTo(1 * s, -3.5); p.lineTo(1.05 * s, 1.2); p.quadraticCurveTo(0.9 * s, 2.8, 0, 3.6); p.quadraticCurveTo(-0.9 * s, 2.8, -1.05 * s, 1.2); p.closePath(); return p; };
  const wall = (s0, s1, depth, y, color) => {
    const sh = outline(s0); sh.holes.push(outline(s1)); // contorno com furo: só as paredes do casco
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 6 });
    geo.rotateX(Math.PI / 2); geo.translate(0, y + depth, 0);
    const m = new THREE.Mesh(geo, mat(color, { roughness: 0.6 })); m.castShadow = true; m.receiveShadow = true; return m;
  };
  g.add(wall(1, 0.9, 0.9, 0, hullC), wall(1.02, 0.95, 0.14, 0.62, trim));
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(outline(0.92)).rotateX(-Math.PI / 2), mat('#8a6a48', { roughness: 0.9 })); floor.position.y = 0.32; g.add(floor);
  const wood = mat('#9a7a52', { roughness: 0.85 });
  for (const z of [-1.9, -0.4, 1.0]) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 0.4), wood); s.position.set(0, 0.62, z); s.castShadow = true; g.add(s); }
  // motor de popa
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.45), mat('#1a1a1a', { roughness: 0.4 })); motor.position.set(0, 1.0, -3.7); g.add(motor);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), mat('#333')); shaft.position.set(0, 0.45, -3.75); g.add(shaft);
  // toldo listrado
  const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d');
  for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#f4f1ea' : ['#e63946', '#1d5fa8', '#f2b705'][i % 3]; x.fillRect(k * 8, 0, 8, 8); }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 3.6), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8 })); roof.position.set(0, 2.25, -0.5); roof.castShadow = true; g.add(roof);
  for (const a of [-0.95, 0.95]) for (const b of [-2.25, 1.25]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.65, 5), mat('#d8d8d8', { metalness: 0.6 })); p.position.set(a, 1.45, b); g.add(p); }
  // boias laranja
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 14), mat('#ff6a13')); r.position.set(s * 1.05, 0.55, -1.2); r.rotation.y = Math.PI / 2; g.add(r); }
  // lanterna na proa (acende à noite)
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff2c4', emissive: '#ffd27a', emissiveIntensity: 0 })); lamp.position.set(0, 1.2, 3.0); g.add(lamp);
  // esteira: rastro branco na água atrás do barco
  const wk = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -3.4), new THREE.Vector3(-3.2, 0, -16), new THREE.Vector3(3.2, 0, -16)]);
  wk.setIndex([0, 2, 1]); wk.computeVertexNormals();
  const wake = new THREE.Mesh(wk, new THREE.MeshBasicMaterial({ color: '#e8f4f8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  // barqueiro em pé na popa, com a mão no motor
  const pilot = makePerson({ skin: pick(SKINS), shirt: pick(['#f2f2f0', '#ff6a13', '#2a9d58']), longSleeve: false, hat: 'bone', pants: '#2b3e5c' });
  pilot.position.set(0, 0.32, -3.0); pilot.userData.armL.rotation.set(-0.5, 0, -0.1); pilot.userData.elbowL.rotation.x = -0.4; pilot.userData.armR.rotation.set(-0.3, 0, 0.15);
  g.add(pilot);
  // passageiros sentados (de colete laranja)
  const seats = [];
  for (const z of [-1.9, -0.4, 1.0]) for (const xx of [-0.5, 0.5]) seats.push([xx, z]);
  const pax = [];
  seats.forEach(([sx, sz], k) => {
    if (k === 2) return; // um lugar livre pro jogador
    if (rnd() < 0.3) return;
    const p = makePerson({ skin: pick(SKINS) });
    sit(p); p.position.set(sx, 0.3, sz); g.add(p); pax.push(p);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.28), mat('#ff6a13', { roughness: 0.6 }));
    vest.position.y = 1.18; p.userData.upper.add(vest);
  });
  return { g, wake, lamp, pax, seat: [seats[2][0], 0.3, seats[2][1]] };
}

function sit(p) {
  const u = p.userData; u.seated = true;
  u.legL.rotation.x = -1.45; u.legR.rotation.x = -1.45; u.kneeL.rotation.x = 1.45; u.kneeR.rotation.x = 1.45;
  u.armL.rotation.set(-0.3, 0, -0.1); u.armR.rotation.set(-0.3, 0, 0.1); u.elbowL.rotation.x = -0.6; u.elbowR.rotation.x = -0.6;
}

// 110 s por volta: 10 s no cais, 45 s atravessando, 10 s no molhe, 45 s voltando
function updateBoat(b, t, dt) {
  if (!b.g.parent?.children.includes(b.wake)) b.g.parent?.add(b.wake);
  const T = (t + b.off) % 110;
  let x, z, moving = false, from, to, s = 0;
  if (T < 10) { b.state = 'A'; [x, z] = b.A; }
  else if (T < 55) { b.state = 'move'; from = b.A; to = b.B; s = (T - 10) / 45; moving = true; b.dir = 'AB'; }
  else if (T < 65) { b.state = 'B'; [x, z] = b.B; }
  else { b.state = 'move'; from = b.B; to = b.A; s = (T - 65) / 45; moving = true; b.dir = 'BA'; }
  if (moving) {
    const e = s * s * (3 - 2 * s), dx = to[0] - from[0], dz = to[1] - from[1], L = Math.hypot(dx, dz), arc = Math.sin(Math.PI * e) * 12 * b.side;
    x = from[0] + dx * e - (dz / L) * arc; z = from[1] + dz * e + (dx / L) * arc;
  }
  const px = b.g.position.x, pz = b.g.position.z, v = dt > 0 ? Math.hypot(x - px, z - pz) / dt : 0;
  if (v > 0.3 && v < 30) {
    const want = Math.atan2(x - px, z - pz); let d = want - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    b.yaw += d * Math.min(1, dt * 1.6);
  }
  b.speed = v < 30 ? v : 0;
  b.g.position.set(x, WATER_Y - 0.25 + Math.sin(t * 1.7 + b.off) * 0.05, z);
  b.g.rotation.set(Math.sin(t * 1.3 + b.off) * 0.02, b.yaw, Math.sin(t * 1.1 + b.off) * 0.03, 'YXZ');
  b.wake.position.set(x, WATER_Y + 0.02, z); b.wake.rotation.y = b.yaw;
  b.wake.material.opacity = Math.min(0.45, b.speed * 0.09);
}

// ---------------------------------------------------------------- flesheiros
function kid(rnd, pick) {
  const skin = pick(SKINS);
  const p = makePerson({ skin, shirt: skin, longSleeve: false, pants: pick(BERMUDA), shoes: skin, hair: pick(['short', 'buzz', 'short']) });
  p.scale.setScalar(0.88 + rnd() * 0.1);
  return p;
}
const TRICKS = [
  { name: 'Mortal pra trás', flip: -1, n: 1, tuck: 1 },
  { name: 'Mortal pra frente', flip: 1, n: 1, tuck: 1 },
  { name: 'Mortal duplo', flip: -1, n: 2, tuck: 1, vy: 6.2 },
  { name: 'Parafuso', flip: -1, n: 1, twist: 1, tuck: 0.3 },
  { name: 'Bomba', flip: 0, n: 0, tuck: 1, bomb: true },
  { name: 'Anjo', flip: 1, n: 0.45, tuck: 0, angel: true },
  { name: 'Carpado', flip: 1, n: 1, pike: true },
];
function makeDiver(group, rnd, pick, x, y, z, yaw, bridge) {
  const p = kid(rnd, pick), piv = new THREE.Group();
  p.position.y = -1.0; piv.add(p);
  piv.position.set(x, y + 1.0, z); piv.rotation.order = 'YXZ'; piv.rotation.y = yaw;
  group.add(piv);
  // borrifo: coroa d'água e anel
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 1, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 0, depthWrite: false }));
  group.add(crown, ring);
  return { p, piv, crown, ring, x, z, y0: y, yaw, bridge, state: 'wait', timer: 1 + rnd() * 6, rnd, trick: TRICKS[0], fx: [0, 0], splashT: 99 };
}
function updateDiver(d, t, dt, out) {
  const u = d.p.userData, fx = Math.sin(d.yaw), fz = Math.cos(d.yaw);
  d.timer -= dt;
  const pose = (lx, lk, rx, rk, al, ar, el, er, alz = -0.1, arz = 0.1) => {
    u.legL.rotation.set(lx, 0, -0.05); u.legR.rotation.set(rx, 0, 0.05); u.kneeL.rotation.x = lk; u.kneeR.rotation.x = rk;
    u.armL.rotation.set(al, 0, alz); u.armR.rotation.set(ar, 0, arz); u.elbowL.rotation.x = el; u.elbowR.rotation.x = er;
  };
  if (d.state === 'wait') {
    // na beira, se balançando e animando a galera
    const s = Math.sin(t * 4 + d.x);
    pose(0, 0.05, 0, 0.05, -0.2, s > 0.6 ? -2.6 : -0.2, -0.3, s > 0.6 ? -0.2 : -0.3);
    d.piv.position.set(d.x, d.y0 + 1.0 + Math.abs(Math.sin(t * 3)) * 0.02, d.z); d.piv.rotation.set(0, d.yaw, 0);
    if (d.timer <= 0) { d.state = 'prep'; d.timer = 0.45; d.trick = TRICKS[Math.floor(d.rnd() * TRICKS.length)]; }
  } else if (d.state === 'prep') {
    // agacha e joga os braços pra trás
    const k = 1 - d.timer / 0.45;
    pose(-0.6 * k, 1.1 * k, -0.6 * k, 1.1 * k, 0.9 * k, 0.9 * k, -0.2, -0.2);
    d.piv.position.y = d.y0 + 1.0 - 0.25 * k;
    if (d.timer <= 0) {
      const tr = d.trick;
      d.state = 'air'; d.vy = tr.vy || 5.0; d.vh = d.bridge ? 1.6 : 2.4; d.air = 0;
      d.airT = (d.vy + Math.sqrt(d.vy * d.vy + 2 * 9.8 * (d.y0 + 1.0 - WATER_Y))) / 9.8; // tempo até o centro do corpo chegar na água
      out.onDive?.(d, tr);
    }
  } else if (d.state === 'air') {
    const tr = d.trick; d.air += dt;
    const p = Math.min(1, d.air / d.airT);
    d.piv.position.x = d.x + fx * d.vh * d.air; d.piv.position.z = d.z + fz * d.vh * d.air;
    d.piv.position.y = d.y0 + 1.0 + d.vy * d.air - 4.9 * d.air * d.air;
    // gira no meio do voo e abre o corpo pra entrar na água
    const spin = THREE.MathUtils.smoothstep(p, 0.08, 0.85);
    d.piv.rotation.x = tr.flip * Math.PI * 2 * tr.n * spin + (tr.angel ? Math.PI * 0.55 * p : 0);
    d.piv.rotation.y = d.yaw + (tr.twist ? Math.PI * 2 * spin : 0);
    const tk = (tr.tuck || 0) * Math.sin(Math.PI * Math.min(1, p * 1.15));
    if (tr.angel) pose(0, 0, 0, 0, -0.2 - p * 2.6, -0.2 - p * 2.6, 0, 0, -1.4 * (1 - p), 1.4 * (1 - p));
    else if (tr.pike) { const k = Math.sin(Math.PI * Math.min(1, p * 1.1)); pose(-1.5 * k, 0, -1.5 * k, 0, -1.6 * k, -1.6 * k, 0, 0); }
    else if (tr.bomb) pose(-1.7 * tk, 2.3 * tk, -1.7 * tk, 2.3 * tk, -1.2 * tk, -1.2 * tk, -1.6 * tk, -1.6 * tk, 0.3, -0.3);
    else pose(-1.6 * tk, 2.2 * tk, -1.6 * tk, 2.2 * tk, -1.0 * tk - 0.3, -1.0 * tk - 0.3, -1.4 * tk, -1.4 * tk);
    if (p >= 1) {
      d.state = 'under'; d.timer = 0.8; d.fx = [d.piv.position.x, d.piv.position.z]; d.splashT = 0; d.big = tr.bomb ? 1.8 : tr.angel ? 0.6 : 1;
    }
  } else if (d.state === 'under') {
    d.piv.position.y = Math.max(WATER_Y - 1.6, d.piv.position.y - dt * 3);
    if (d.timer <= 0) { d.state = 'swim'; d.piv.rotation.set(0, d.yaw + Math.PI, 0); }
  } else if (d.state === 'swim') {
    // nada de volta até a beira, só a cabeça pra fora
    const tx = d.x + fx * 0.6, tz = d.z + fz * 0.6, dx = tx - d.piv.position.x, dz = tz - d.piv.position.z, L = Math.hypot(dx, dz);
    d.piv.position.y += ((WATER_Y - 0.45) - d.piv.position.y) * Math.min(1, dt * 3);
    if (L > 0.3) { d.piv.position.x += (dx / L) * 1.3 * dt; d.piv.position.z += (dz / L) * 1.3 * dt; d.piv.rotation.set(0, Math.atan2(dx, dz), 0); }
    const s = Math.sin(t * 5);
    pose(0.3 * s, 0.4, -0.3 * s, 0.4, -1.6 + s * 1.2, -1.6 - s * 1.2, -0.3, -0.3, -0.5, 0.5);
    if (L <= 0.3) { d.state = 'climb'; d.timer = 1.4; d.cy = d.piv.position.y; }
  } else if (d.state === 'climb') {
    // sobe pela escadinha / pela pilastra da ponte
    const k = 1 - Math.max(0, d.timer) / 1.4, top = d.y0 + 1.0;
    d.piv.position.y = d.cy + (top - d.cy) * k;
    d.piv.rotation.set(0, d.yaw + Math.PI, 0);
    const s = Math.sin(t * 8);
    pose(-0.8 * Math.max(0, s), 1.0 * Math.max(0, s), -0.8 * Math.max(0, -s), 1.0 * Math.max(0, -s), -2.6 + s * 0.4, -2.6 - s * 0.4, -0.4, -0.4);
    if (d.timer <= 0) { d.state = 'wait'; d.timer = 3 + d.rnd() * 7; }
  }
  // borrifo
  if (d.splashT < 1.2) {
    d.splashT += dt;
    const k = d.splashT / 1.2, big = d.big || 1;
    d.crown.position.set(d.fx[0], WATER_Y + 0.5 * big * Math.sin(Math.PI * Math.min(1, k * 1.6)), d.fx[1]);
    d.crown.scale.set(0.6 + k * 1.6 * big, 0.2 + 1.6 * big * Math.sin(Math.PI * Math.min(1, k * 1.4)), 0.6 + k * 1.6 * big);
    d.crown.material.opacity = 0.85 * (1 - k);
    d.ring.position.set(d.fx[0], WATER_Y + 0.03, d.fx[1]); d.ring.scale.setScalar(1 + k * 3.5 * big); d.ring.material.opacity = 0.6 * (1 - k);
  } else { d.crown.material.opacity = 0; d.ring.material.opacity = 0; }
  if (d.fan) { const s = Math.sin(t * 7 + d.x); d.fan.userData.armL.rotation.x = d.state === 'air' ? -2.6 : -0.3; d.fan.userData.armR.rotation.x = d.state === 'air' ? -2.6 + s * 0.2 : -0.3; }
}

// ---------------------------------------------------------------- Galo da Madrugada
// O maior bloco de carnaval do mundo tem um galo gigante na ponte. Aqui ele fica de vez, sobre uma base no rio:
// corpo dourado, peito vermelho, asas azuis e verdes, crista enorme e um leque de penas nas cores do frevo.
function buildGalo(group, mat, glowMats, x, z, yaw) {
  const k = new Batch();
  const S = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
  const gold = mat('#f2c14e', { metalness: 0.45, roughness: 0.35 }), red = mat('#d7263d', { roughness: 0.45 }), yellow = mat('#ffd23f', { roughness: 0.5 });
  const blue = mat('#1d5fa8', { metalness: 0.3, roughness: 0.4 }), green = mat('#2a9d58', { metalness: 0.3, roughness: 0.4 }), orange = mat('#ff7b1c', { roughness: 0.5 });
  const white = mat('#fbf8f0'), black = mat('#111111', { roughness: 0.3 });
  // base redonda listrada nas cores do frevo
  const FREVO = [red, yellow, green, blue];
  for (let i = 0; i < 4; i++) k.add(FREVO[i], new THREE.CylinderGeometry(6.2 - i * 0.15, 6.3 - i * 0.15, 0.5, 32), [0, -0.9 + i * 0.5, 0]);
  k.add(white, new THREE.CylinderGeometry(5.2, 5.6, 0.4, 32), [0, 1.3, 0]);
  // pernas e pés
  for (const s of [-1, 1]) {
    k.add(orange, new THREE.CylinderGeometry(0.55, 0.7, 6, 12), [s * 1.7, 4.4, 0.3]);
    k.add(orange, new THREE.CylinderGeometry(0.9, 0.6, 1.2, 12), [s * 1.7, 7.6, 0.3]);
    for (const a of [-0.5, 0, 0.5]) k.add(orange, new THREE.ConeGeometry(0.28, 2.0, 8), [s * 1.7 + Math.sin(a) * 1.0, 1.75, 0.3 + Math.cos(a) * 1.0], [Math.PI / 2, a, 0]);
  }
  // corpo, peito e asas
  k.add(gold, S(4.2, 28, 20), [0, 11.5, -0.4], [0.2, 0, 0], [1.05, 0.95, 1.45]);
  k.add(red, S(3.0), [0, 11.4, 3.2], [0, 0, 0], [1.05, 1.15, 0.8]);
  for (const s of [-1, 1]) {
    k.add(blue, S(2.6), [s * 3.6, 12.2, -0.8], [0.3, s * 0.15, 0], [0.45, 1.0, 1.6]);
    k.add(green, S(2.0), [s * 3.95, 11.4, -1.6], [0.45, s * 0.15, 0], [0.38, 0.85, 1.5]);
    k.add(yellow, S(1.4), [s * 4.15, 10.6, -2.5], [0.6, s * 0.15, 0], [0.3, 0.7, 1.4]);
  }
  // pescoço e cabeça
  k.add(gold, new THREE.CylinderGeometry(1.5, 2.4, 6, 18), [0, 16.2, 3.0], [0.35, 0, 0]);
  for (let i = 0; i < 5; i++) k.add(i % 2 ? orange : red, S(0.9 + i * 0.05, 10, 8), [0, 14.0 + i * 0.95, 4.2 - i * 0.35], [0, 0, 0], [2.3, 0.6, 1.2]); // golinha de penas
  k.add(gold, S(2.2, 22, 16), [0, 20.0, 4.4]);
  // crista
  for (let i = 0; i < 6; i++) { const a = -1.1 + i * 0.44; k.add(red, S(1, 14, 10), [0, 21.6 + Math.cos(a) * 1.4, 4.2 + Math.sin(a) * 2.4], [-a * 0.6, 0, 0], [0.5, 1.5 + Math.cos(a) * 0.5, 0.75]); }
  // bico, barbela e olhos
  k.add(yellow, new THREE.ConeGeometry(0.7, 2.4, 12), [0, 20.0, 7.3], [Math.PI / 2, 0, 0]);
  k.add(orange, new THREE.ConeGeometry(0.5, 1.6, 10), [0, 19.4, 6.8], [Math.PI / 2 + 0.35, 0, 0]);
  for (const s of [-1, 1]) k.add(red, S(0.7, 12, 10), [s * 0.45, 18.2, 6.0], [0, 0, 0], [0.7, 1.5, 0.8]);
  for (const s of [-1, 1]) { k.add(white, S(0.55, 12, 10), [s * 1.75, 20.5, 5.3]); k.add(black, S(0.3, 10, 8), [s * 2.08, 20.55, 5.55]); }
  // leque de penas do rabo (frevo: vermelho, amarelo, verde, azul, roxo, laranja, rosa)
  const FEATHER = ['#d7263d', '#ffd23f', '#2a9d58', '#1d5fa8', '#8338ec', '#ff7b1c', '#ff4fa3'].map((c) => mat(c, { metalness: 0.35, roughness: 0.35 }));
  const tips = [];
  for (let i = 0; i < 13; i++) {
    const a = -1.25 + (i / 12) * 2.5, len = 9 + Math.cos(a) * 3;
    // cada pena sai das costas e abre em leque, inclinada pra trás
    const dir = new THREE.Vector3(Math.sin(a), Math.cos(a), -0.55).normalize(), base = new THREE.Vector3(0, 13.5, -5.4);
    const c = base.clone().addScaledVector(dir, len / 2);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), e = new THREE.Euler().setFromQuaternion(q);
    k.add(FEATHER[i % FEATHER.length], S(1, 14, 12), [c.x, c.y, c.z], [e.x, e.y, e.z], [0.95, len / 2, 0.3]);
    tips.push(base.clone().addScaledVector(dir, len * 0.92));
  }
  const g = k.build(group);
  // luzinhas nas pontas das penas e na base (brilham à noite)
  const glow = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0.15 }); glow.userData.base = 3; glowMats.push(glow);
  const pts = [...tips];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 5.0, 1.6, Math.sin(a) * 5.0)); }
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), glow, pts.length), m = new THREE.Matrix4();
  pts.forEach((p, i) => im.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
  g.add(im);
  g.position.set(x, 0, z); g.rotation.y = yaw;
  return g;
}
