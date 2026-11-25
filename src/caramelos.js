// Cachorros caramelo (vira-lata), o patrimônio das ruas: ficam deitados ou farejando na calçada e, de vez em quando,
// atravessam a rua no trotezinho, sem pressa. Os carros freiam pra eles (entram como obstáculo no trânsito) e, se o
// jogador vier rápido demais, o caramelo dá um pinote pro lado e escapa.
import * as THREE from 'three';

const COATS = [['#c98a3c', '#e8c48e'], ['#b8752e', '#e3b77c'], ['#d39a4c', '#f0d2a0'], ['#a8682a', '#d9a868']];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function makeDog() {
  const [coat, light] = pick(COATS), M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const fur = M(coat), belly = M(light), dark = M('#2a1d14');
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 4, 10), fur); torso.rotation.x = Math.PI / 2; torso.position.y = 0.48; body.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), belly); chest.position.set(0, 0.43, 0.26); chest.scale.set(1, 1, 0.7); body.add(chest);
  const head = new THREE.Group(); head.position.set(0, 0.66, 0.4); body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), fur); head.add(skull);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.16), belly); snout.position.set(0, -0.04, 0.13); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), dark); nose.position.set(0, -0.01, 0.22); head.add(nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), dark); eye.position.set(s * 0.06, 0.03, 0.1); head.add(eye);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), fur); ear.position.set(s * 0.08, 0.12, -0.02); ear.rotation.z = -s * 0.5; ear.rotation.x = 0.3; head.add(ear); // orelha meio caída
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.55, -0.32); body.add(tail);
  const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.3, 6), fur); tailM.position.y = 0.13; tail.add(tailM); tail.rotation.x = -0.6; // rabo pra cima, enroladinho
  const legs = [];
  for (const [x, z] of [[-0.09, 0.22], [0.09, 0.22], [-0.09, -0.22], [0.09, -0.22]]) {
    const hip = new THREE.Group(); hip.position.set(x, 0.38, z); body.add(hip);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.36, 6), fur); leg.position.y = -0.18; hip.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), belly); paw.position.y = -0.36; hip.add(paw);
    legs.push(hip);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { body, head, tail, legs, L: 0.9, W: 0.4, dog: true };
  return g;
}

export class Caramelos {
  constructor({ scene, world, traffic, player, hud }) {
    Object.assign(this, { scene, world, traffic, player, hud });
    this.dogs = []; this.max = 9;
  }
  // um ponto de calçada na beira de uma rua de carro, com o outro lado também livre
  spot(px, pz) {
    const W = this.world;
    for (let tries = 0; tries < 20; tries++) {
      const e = this.traffic.randomEdge(this.traffic.drive, px, pz, 25, 140); if (!e) return null;
      const t = Math.random() * e.len, cx = e.a.x + e.dx * t, cz = e.a.z + e.dz * t, nx = -e.dz, nz = e.dx;
      let a = null, b = null;
      for (let o = 3; o < 14 && !a; o += 0.5) if (!W.isDrive(cx + nx * o, cz + nz * o) && !W.blocked(cx + nx * o, cz + nz * o)) a = [cx + nx * o, cz + nz * o];
      for (let o = 3; o < 14 && !b; o += 0.5) if (!W.isDrive(cx - nx * o, cz - nz * o) && !W.blocked(cx - nx * o, cz - nz * o)) b = [cx - nx * o, cz - nz * o];
      if (a && b) return Math.random() < 0.5 ? [a, b] : [b, a];
    }
    return null;
  }
  spawn() {
    const P = this.player.pos, s = this.spot(P.x, P.z); if (!s) return;
    const m = makeDog(); m.position.set(s[0][0], 0, s[0][1]); m.rotation.y = Math.random() * 6; this.scene.add(m);
    const d = { mesh: m, from: s[0], to: s[1], state: Math.random() < 0.5 ? 'deitado' : 'cheirando', timer: 3 + Math.random() * 10, ph: Math.random() * 6, v: 0 };
    this.dogs.push(d); this.traffic.extraObstacles.push(d);
  }
  remove(d) {
    this.scene.remove(d.mesh); this.dogs.splice(this.dogs.indexOf(d), 1);
    const i = this.traffic.extraObstacles.indexOf(d); if (i >= 0) this.traffic.extraObstacles.splice(i, 1);
  }

  update(dt, t) {
    const P = this.player.pos;
    for (let i = this.dogs.length - 1; i >= 0; i--) if (Math.hypot(this.dogs[i].mesh.position.x - P.x, this.dogs[i].mesh.position.z - P.z) > 200) this.remove(this.dogs[i]);
    if (this.dogs.length < this.max && Math.random() < dt * 2) this.spawn();
    const pv = this.player.vehicle;
    for (const d of this.dogs) {
      const m = d.mesh, u = m.userData;
      d.ph += dt; d.timer -= dt;
      // carro do jogador vindo rápido: pinote pro lado
      if (pv && Math.abs(pv.speed) > 4) {
        const dx = m.position.x - pv.mesh.position.x, dz = m.position.z - pv.mesh.position.z, dist = Math.hypot(dx, dz);
        if (dist < 4) { m.position.x += (dx / dist) * 3; m.position.z += (dz / dist) * 3; d.state = 'corre'; d.timer = 1.2; if (Math.random() < 0.5) this.hud.say(m, 'Au! Au!', 1.5); }
      }
      if (d.state === 'deitado') {
        u.body.position.y = -0.3; u.legs.forEach((l, k) => (l.rotation.x = k < 2 ? -1.4 : 1.4)); u.head.rotation.x = 0.2 + Math.sin(d.ph * 0.5) * 0.05; u.tail.rotation.z = Math.sin(d.ph * 2) * 0.2;
        if (d.timer <= 0) { d.state = 'atravessa'; u.body.position.y = 0; }
      } else if (d.state === 'cheirando') {
        u.body.position.y = 0; u.head.rotation.x = 0.5 + Math.sin(d.ph * 6) * 0.1; u.tail.rotation.z = Math.sin(d.ph * 9) * 0.5;
        u.legs.forEach((l) => (l.rotation.x = 0));
        if (d.timer <= 0) d.state = 'atravessa';
      } else {
        // atravessa a rua no trote (ou corre, depois do susto) até a calçada do outro lado
        const v = d.state === 'corre' ? 5 : 1.6, tx = d.to[0] - m.position.x, tz = d.to[1] - m.position.z, dist = Math.hypot(tx, tz);
        if (dist < 0.4) { const f = d.from; d.from = d.to; d.to = f; d.state = Math.random() < 0.5 ? 'deitado' : 'cheirando'; d.timer = 6 + Math.random() * 14; continue; }
        // espera carro passando bem na frente
        let wait = false;
        if (d.state !== 'corre') for (const c of this.traffic.cars) { const cx = c.mesh.position.x - m.position.x, cz = c.mesh.position.z - m.position.z; if (cx * cx + cz * cz < 49) wait = true; }
        if (!wait) { m.position.x += (tx / dist) * v * dt; m.position.z += (tz / dist) * v * dt; }
        let dh = Math.atan2(tx, tz) - m.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); m.rotation.y += dh * Math.min(1, dt * 6);
        const sw = wait ? 0 : Math.sin(d.ph * (v * 5)) * 0.6;
        u.legs[0].rotation.x = sw; u.legs[3].rotation.x = sw; u.legs[1].rotation.x = -sw; u.legs[2].rotation.x = -sw;
        u.body.position.y = wait ? 0 : Math.abs(Math.sin(d.ph * v * 5)) * 0.03; u.head.rotation.x = 0; u.tail.rotation.z = Math.sin(d.ph * 8) * 0.4;
        if (d.state === 'corre' && d.timer <= 0) d.state = 'atravessa';
      }
    }
  }
}
