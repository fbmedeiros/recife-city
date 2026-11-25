// Gente da rua: flanelinhas do Recife Antigo chamando os carros pra estacionar ("Bora, dotô! Uma vaguinha?"),
// gente correndo e caminhando no calçadão de Boa Viagem e barracas de coco e de açaí na beira da areia.
import * as THREE from 'three';
import { Kit } from './classics.js';
import { makePerson, animatePerson } from './models.js';
import { stampDisc } from './collide.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#5c3a1e', '#a0662f', '#f1c27d'];
const FLANELA = ['Bora, dotô! Uma vaguinha?', 'Bora, dotô! Uma vaguinha?', 'Bora, dotô! Uma vaguinha?', 'Vem, vem, vem… Bora, dotô! Uma vaguinha?', 'Pode deixar que eu tomo conta, dotô!'];
// ruas do Recife Antigo onde tem carro estacionando
const RUAS = ['Avenida Marquês de Olinda', 'Avenida Alfredo Lisboa', 'Rua do Apolo', 'Rua Madre de Deus', 'Rua Vigário Tenório', 'Rua do Bom Jesus', 'Rua da Guia', 'Rua Mariz e Barros', 'Rua Tomazina'];

export class GenteDaRua {
  constructor({ scene, world, hud, player }) {
    Object.assign(this, { scene, world, hud, player });
    const isRoad = (x, z) => world.isRoad(x, z), free = (x, z) => !world.isSolid(x, z) && !world.isWater(x, z) && !isRoad(x, z);
    this.free = free;
    this.flanelas = []; this.runners = [];
    const mats = new Map(), mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o })); return mats.get(k); };

    // ---------------- flanelinhas: na calçada, encostados no meio-fio de ruas com carro
    for (const n of RUAS) {
      const segs = world.data.roads.filter((r) => r.n === n && !['pedestrian', 'footway'].includes(r.k));
      let placed = 0;
      for (const r of segs) for (let i = 0; i < r.p.length - 1 && placed < 2; i++) {
        const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 25) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2;
        for (const s of [1, -1]) {
          let spot = null; for (let o = 3; o < 9 && !spot; o += 0.5) { const x = mx - uz * s * o, z = mz + ux * s * o; if (free(x, z)) spot = [x, z, Math.atan2(uz * s, -ux * s)]; }
          if (!spot) continue;
          const p = makePerson({ skin: pick(SKIN), shirt: pick(['#ff6a13', '#f2b705', '#2a9d58', '#d7263d', '#1d5fa8']), longSleeve: false, hat: Math.random() < 0.5 ? 'bone' : undefined });
          const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.3), mat('#c8102e')); cloth.position.set(0, -0.28, 0.05); p.userData.elbowR.add(cloth); // a flanela na mão
          p.position.set(spot[0], 0, spot[1]); p.rotation.y = spot[2]; scene.add(p); stampDisc(spot[0], spot[1], 0.3);
          this.flanelas.push({ p, yaw: spot[2], cd: Math.random() * 4, ph: Math.random() * 6 });
          placed++; break;
        }
      }
    }

    // ---------------- calçadão de Boa Viagem: corredores e quem caminha, indo e voltando
    const calc = world.data.roads.filter((r) => r.n === 'Calçadão de Boa Viagem').map((r) => r.p).filter((p) => p.length > 4);
    for (const line of calc) {
      const acc = [0]; for (let i = 1; i < line.length; i++) acc.push(acc[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
      const L = acc.at(-1); if (L < 200) continue;
      const path = { line, acc, L };
      const N = Math.min(26, Math.floor(L / 140));
      for (let i = 0; i < N; i++) {
        const run = i % 3 !== 2; // dois terços correndo, um terço caminhando
        const p = makePerson({ skin: pick(SKIN), shirt: pick(['#ff3b6b', '#1d5fa8', '#f2f2ee', '#2a9d58', '#111111', '#ffd166', '#8338ec']), pants: pick(['#111111', '#2b3e5c', '#555555']), longSleeve: false, hat: Math.random() < 0.3 ? 'bone' : undefined });
        scene.add(p);
        this.runners.push({ p, path, d: Math.random() * L, dir: Math.random() < 0.5 ? 1 : -1, v: run ? 3.2 + Math.random() * 1.6 : 1.3 + Math.random() * 0.4, lane: (Math.random() - 0.5) * 3.2 });
      }
      // barracas de coco e de açaí na beira da areia, alternando, a cada ~260 m
      const k = new Kit();
      let n = 0;
      for (let d = 120; d < L; d += 260) {
        const [x, z, ux, uz] = this.at(path, d);
        // lado do mar: o que tiver água mais perto
        let side = 1; for (let o = 8; o < 200; o += 6) { if (world.isWater(x - uz * o, z + ux * o)) { side = 1; break; } if (world.isWater(x + uz * o, z - ux * o)) { side = -1; break; } }
        let spot = null; for (let o = 4.5; o < 12 && !spot; o += 0.5) { const px = x - uz * side * o, pz = z + ux * side * o; if (free(px, pz) && free(px + ux * 1.5, pz + uz * 1.5) && free(px - ux * 1.5, pz - uz * 1.5)) spot = [px, pz]; }
        if (!spot) continue;
        const yaw = Math.atan2(uz * side, -ux * side) + Math.PI; // de frente pro calçadão
        if (n % 2 === 0) this.coco(k, mat, spot[0], spot[1], yaw); else this.acai(k, mat, spot[0], spot[1], yaw);
        const v = makePerson({ skin: pick(SKIN), shirt: n % 2 ? '#6a1b9a' : '#f2f2ee', longSleeve: false, hat: 'bone' });
        v.position.set(spot[0] - Math.sin(yaw) * 1.3, 0, spot[1] - Math.cos(yaw) * 1.3); v.rotation.y = yaw; scene.add(v);
        this.runners.push({ p: v, still: true });
        stampDisc(spot[0], spot[1], 1.2);
        n++;
      }
      k.build(scene, 0, 0, 0, true, false);
    }
  }

  // posição e direção a d metros do começo da linha
  at(path, d) {
    const { line, acc } = path; let i = 1; while (i < acc.length - 1 && acc[i] < d) i++;
    const t = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1), [ax, az] = line[i - 1], [bx, bz] = line[i], L = Math.hypot(bx - ax, bz - az) || 1;
    return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / L, (bz - az) / L];
  }

  // carrinho de coco verde: pilha de cocos, facão, guarda-sol e plaquinha
  coco(k, mat, x, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    k.box(mat('#2a7a4a'), 1.8, 0.9, 1.0, x, 0.55, z, [0, yaw, 0]).box(mat('#f2f2ee'), 1.9, 0.08, 1.1, x, 1.02, z, [0, yaw, 0]);
    for (let i = 0; i < 14; i++) { const [px, pz] = at(-0.7 + (i % 5) * 0.35, -0.25 + Math.floor(i / 5) * 0.25); k.add(mat('#5e9c2f', { roughness: 0.6 }), new THREE.SphereGeometry(0.15, 10, 8), [1, 1.15, 1], [px, 1.18 + Math.floor(i / 5) * 0.12, pz]); }
    for (const [lx, lz] of [[-0.8, 0.5], [0.8, 0.5]]) { const [px, pz] = at(lx, lz); k.add(mat('#222'), new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), [1, 1, 1], [px, 0.2, pz], [Math.PI / 2, yaw, 0], 'YXZ'); }
    const [ux, uz] = at(0, -0.6); k.box(mat('#bbb', { metalness: 0.5 }), 0.05, 2.4, 0.05, ux, 1.2, uz); k.add(mat('#f2b705'), new THREE.ConeGeometry(1.5, 0.6, 10, 1, true), [1, 1, 1], [ux, 2.5, uz]);
    this.sign(k, at(0, 0.53), yaw, 'Água de coco', '#2a7a4a', '#ffffff');
  }
  // quiosque de açaí: roxo, freezer e copos
  acai(k, mat, x, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    k.box(mat('#5b1a7a'), 2.0, 1.0, 1.1, x, 0.5, z, [0, yaw, 0]).box(mat('#e9e2f2'), 1.6, 0.4, 0.8, x, 1.2, z, [0, yaw, 0]);
    for (let i = 0; i < 5; i++) { const [px, pz] = at(-0.6 + i * 0.3, 0.2); k.add(mat('#7b2d8e'), new THREE.CylinderGeometry(0.07, 0.05, 0.16, 10), [1, 1, 1], [px, 1.48, pz]); }
    const [ux, uz] = at(0, -0.6); k.box(mat('#bbb', { metalness: 0.5 }), 0.05, 2.4, 0.05, ux, 1.2, uz); k.add(mat('#8338ec'), new THREE.ConeGeometry(1.5, 0.6, 10, 1, true), [1, 1, 1], [ux, 2.5, uz]);
    this.sign(k, at(0, 0.58), yaw, 'Açaí', '#7b2d8e', '#ffd166');
  }
  sign(k, [x, z], yaw, text, bg, fg) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 64); g.fillStyle = fg; g.font = 'bold 38px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    k.add(new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), new THREE.PlaneGeometry(1.4, 0.35), [1, 1, 1], [x, 0.62, z], [0, yaw, 0]);
  }

  update(dt, t) {
    const P = this.player.pos, cam2 = 140 * 140;
    // flanelinhas: balançam a flanela, viram pro carro do jogador e chamam pra vaga
    for (const f of this.flanelas) {
      const dx = P.x - f.p.position.x, dz = P.z - f.p.position.z, d2 = dx * dx + dz * dz;
      f.p.visible = d2 < cam2; if (!f.p.visible) continue;
      const u = f.p.userData; f.ph += dt;
      u.armR.rotation.x = -1.6 + Math.sin(f.ph * 6) * 0.5; u.armR.rotation.z = 0.3; u.elbowR.rotation.x = -0.4 + Math.sin(f.ph * 6 + 1) * 0.4;
      u.armL.rotation.x = -0.5 + Math.sin(f.ph * 3) * 0.3;
      f.cd -= dt;
      if (d2 < 30 * 30) {
        f.p.rotation.y = Math.atan2(dx, dz);
        if (f.cd <= 0 && (this.player.vehicle || d2 < 12 * 12)) { this.hud.say(f.p, pick(FLANELA), 2.8); f.cd = 7 + Math.random() * 3; }
      } else f.p.rotation.y = f.yaw;
    }
    // corredores do calçadão
    for (const r of this.runners) {
      if (r.still) { r.p.visible = (r.p.position.x - P.x) ** 2 + (r.p.position.z - P.z) ** 2 < cam2; continue; }
      r.d += r.dir * r.v * dt;
      if (r.d < 0 || r.d > r.path.L) { r.dir *= -1; r.d = Math.max(0, Math.min(r.path.L, r.d)); }
      const [x, z, ux, uz] = this.at(r.path, r.d), lx = -uz * r.lane, lz = ux * r.lane;
      r.p.position.set(x + lx, 0, z + lz);
      const vis = (r.p.position.x - P.x) ** 2 + (r.p.position.z - P.z) ** 2 < cam2; r.p.visible = vis; if (!vis) continue;
      r.p.rotation.y = Math.atan2(ux * r.dir, uz * r.dir);
      animatePerson(r.p, r.v * (r.v > 2.5 ? 1.9 : 1), dt);
    }
  }
}
