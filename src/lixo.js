// Caminhão de lixo: de vez em quando (uns 4 min) sai um caminhão compactador verde e branco numa rua perto do
// jogador, andando devagar no trânsito. Dois garis de laranja correm atrás; nos sacos de lixo da calçada à frente,
// um corre, pega o saco e joga na caçamba. Some quando fica longe ou depois de uns 3 minutos.
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';

const VERDE = new THREE.MeshStandardMaterial({ color: '#2f7d4f', roughness: 0.6 });
const BRANCO = new THREE.MeshStandardMaterial({ color: '#eeeeea', roughness: 0.5 });
const PRETO = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 });
const VIDRO = new THREE.MeshStandardMaterial({ color: '#2b3a44', roughness: 0.2, metalness: 0.4 });
const SACO = new THREE.MeshStandardMaterial({ color: '#16181a', roughness: 0.4 });
const LARANJA = '#ff7a1a';
const GRITO = ['Bora, bora!', 'Segura aí, motorista!', 'Opa, esse aqui também!'];

function caminhao() {
  const g = new THREE.Group(), add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(2.4, 2.1, 2.2), BRANCO, 0, 1.55, 2.6);          // cabine
  add(new THREE.BoxGeometry(2.3, 0.8, 0.05), VIDRO, 0, 1.95, 3.72);         // para-brisa
  add(new THREE.BoxGeometry(2.45, 2.7, 5.2), VERDE, 0, 1.85, -1.3);         // caçamba compactadora
  add(new THREE.BoxGeometry(2.5, 0.25, 5.3), BRANCO, 0, 1.2, -1.3);         // faixa
  add(new THREE.BoxGeometry(2.3, 2.2, 0.6), VERDE, 0, 1.7, -4.2);           // boca de trás
  add(new THREE.BoxGeometry(1.8, 0.1, 0.5), PRETO, 0, 0.55, -4.6);          // estribo dos garis
  for (const [x, z] of [[-1.1, 2.6], [1.1, 2.6], [-1.1, -0.6], [1.1, -0.6], [-1.1, -2.4], [1.1, -2.4]]) { const r = add(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), PRETO, x, 0.5, z); r.rotation.z = Math.PI / 2; }
  g.userData = { kind: 'truck', L: 9, W: 2.5 };
  return g;
}

export class Lixo {
  constructor({ scene, world, traffic, hud, player }) {
    Object.assign(this, { scene, world, traffic, hud, player });
    this.c = null; this.espera = 60 + Math.random() * 90;
  }

  update(dt, t) {
    const T = this.traffic, P = this.player.pos;
    if (!this.c) {
      if ((this.espera -= dt) > 0) return;
      this.espera = 240 + Math.random() * 90;
      this.sai(P);
      return;
    }
    const C = this.c, m = C.car.mesh;
    C.t += dt;
    if (!T.cars.includes(C.car) || C.t > 180 || Math.hypot(m.position.x - P.x, m.position.z - P.z) > 400) { this.some(); return; }
    const h = m.rotation.y, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    // sacos na calçada à frente do caminhão (um a cada ~25 m, do lado direito)
    C.prox -= Math.max(0, C.car.v) * dt;
    if (C.prox <= 0 && C.sacos.length < 4) {
      C.prox = 20 + Math.random() * 15;
      const x = m.position.x + fx * 22 + rx * 4.2, z = m.position.z + fz * 22 + rz * 4.2;
      if (!this.world.isWater(x, z) && !this.world.isDrive(x, z)) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6).scale(1, 1.2, 1), SACO); s.position.set(x, this.world.groundY(x, z) + 0.3, z); this.scene.add(s); C.sacos.push(s); }
    }
    // garis: no estribo de trás, correndo junto; o livre vai buscar o saco que o caminhão está passando
    C.garis.forEach((G, i) => {
      const p = G.p;
      if (!G.saco) { const s = C.sacos.find((q) => !C.garis.some((o) => o.saco === q) && Math.hypot(q.position.x - m.position.x, q.position.z - m.position.z) < 7); if (s && i === C.vez) { G.saco = s; C.vez = 1 - C.vez; } }
      let tx, tz;
      if (G.saco) { tx = G.saco.position.x; tz = G.saco.position.z; }
      else { tx = m.position.x - fx * 5.6 + rx * (i ? 0.6 : -0.6); tz = m.position.z - fz * 5.6 + rz * (i ? 0.6 : -0.6); }
      const dx = tx - p.position.x, dz = tz - p.position.z, d = Math.hypot(dx, dz), v = d > 0.3 ? Math.min(d * 4, 6) : 0;
      if (v) { p.position.x += (dx / d) * v * dt; p.position.z += (dz / d) * v * dt; p.rotation.y = Math.atan2(dx, dz); } else p.rotation.y = h;
      p.position.y = this.world.groundY(p.position.x, p.position.z);
      animatePerson(p, v, dt);
      if (G.saco && d < 0.6) { this.scene.remove(G.saco); C.sacos.splice(C.sacos.indexOf(G.saco), 1); G.saco = null; C.pegos++; if (Math.hypot(p.position.x - P.x, p.position.z - P.z) < 30 && Math.random() < 0.4) this.hud.say(p, GRITO[Math.floor(Math.random() * GRITO.length)], 1.5); }
    });
    // saco que ficou pra trás longe some
    for (let i = C.sacos.length - 1; i >= 0; i--) { const s = C.sacos[i]; if (Math.hypot(s.position.x - m.position.x, s.position.z - m.position.z) > 60 && !C.garis.some((G) => G.saco === s)) { this.scene.remove(s); C.sacos.splice(i, 1); } }
  }

  sai(P) {
    const T = this.traffic, e = T.randomEdge(T.drive, P.x, P.z, 60, 180);
    if (!e) return false;
    const mesh = caminhao(); this.scene.add(mesh);
    const car = { mesh, v: 0, stuck: 0, ghost: 0, side: 0, lento: 3.2 };
    T.place(car, T.drive, e, Math.random() * e.len);
    T.cars.push(car);
    const garis = [0, 1].map(() => { const p = makePerson({ tipo: 'homem', shirt: LARANJA, pants: LARANJA, longSleeve: true, bottom: 'calca', hat: 'bone' }); p.position.copy(mesh.position); this.scene.add(p); return { p, saco: null }; });
    this.c = { car, garis, sacos: [], prox: 8, vez: 0, t: 0, pegos: 0 };
    return true;
  }

  some() {
    const C = this.c; if (!C) return;
    const T = this.traffic, i = T.cars.indexOf(C.car);
    if (i >= 0) T.cars.splice(i, 1);
    if (this.player.vehicle?.mesh !== C.car.mesh) this.scene.remove(C.car.mesh); // roubado: fica com o jogador
    for (const G of C.garis) { this.hud.forget(G.p); this.scene.remove(G.p); }
    for (const s of C.sacos) this.scene.remove(s);
    this.c = null;
  }
}
