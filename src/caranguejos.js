// Mangue vivo: caranguejos andando de lado na lama do mangue (onde a cobertura do solo diz MANGUE) e, em alguns
// trechos, um catador com o balde. Chegou perto (6 m), o caranguejo corre pra toca e some uns segundos. A pé, perto
// do catador, B compra uma corda de caranguejo pra caranguejada. Tudo só existe com a câmera a menos de ~120 m de
// um mangue, ~300 m (o Recife é a cidade do mangue: Chico Science e o manguebeat vêm daí).
import * as THREE from 'three';
import { COB } from './cobertura.js';
import { makePerson, animatePerson } from './models.js';
import { spend } from './save.js';
import { conta } from './trofeus.js';

const CASCO = new THREE.MeshStandardMaterial({ color: '#b5472a', roughness: 0.6 }), PATA = new THREE.MeshStandardMaterial({ color: '#8f3a22', roughness: 0.7 });
const cascoGeo = new THREE.SphereGeometry(0.11, 8, 5).scale(1.3, 0.45, 1);
const pataGeo = new THREE.BoxGeometry(0.16, 0.02, 0.02).translate(0.08, 0, 0);
const garraGeo = new THREE.SphereGeometry(0.045, 6, 4).scale(1.3, 0.8, 1);
const N = 40;

export class Caranguejos {
  constructor({ scene, world, hud, player }) {
    Object.assign(this, { scene, world, hud, player });
    this.cob = world.data.cobertura || null;
    this.grupo = null; this.cs = []; this.catador = null; this.t = 0; this.centro = null;
  }

  // ponto de mangue perto (procura em anéis a partir da câmera)
  acha(x, z) {
    const C = this.cob; if (!C) return null;
    for (let r = 0; r <= 300; r += 12) for (let a = 0; a < 6.28; a += 0.35) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (C.at(px, pz) === COB.MANGUE && !this.world.isWater(px, pz)) return [px, pz]; }
    return null;
  }

  get perto() {
    const c = this.catador; if (!c || this.player.vehicle) return null;
    return Math.hypot(c.p.position.x - this.player.pos.x, c.p.position.z - this.player.pos.z) < 4 ? c : null;
  }

  get hint() { return this.perto ? 'B — comprar uma corda de caranguejo (R$ 25)' : ''; }

  comprar() {
    const c = this.perto; if (!c) return false;
    if (!spend(25)) { this.hud.say(c.p, 'Tá liso, é? Caranguejo bom custa, visse!', 2.5); return true; }
    this.hud.say(c.p, 'Tá aqui, uma corda com dez, tudo vivinho! Bom de caranguejada.', 3);
    this.hud.flash('Comprou uma corda de caranguejo. −R$ 25');
    conta('caranguejo');
    return true;
  }

  update(dt, t, cam) {
    if (!this.cob) return;
    if ((this.t -= dt) <= 0) {
      this.t = 1.5;
      const longe = !this.centro || Math.hypot(this.centro[0] - cam.x, this.centro[1] - cam.z) >  350;
      if (longe) { this.desmonta(); const c = this.acha(cam.x, cam.z); if (c) this.monta(c); }
    }
    if (!this.grupo) return;
    const P = this.player.pos;
    for (const k of this.cs) {
      const g = k.g, dj = Math.hypot(g.position.x - P.x, g.position.z - P.z);
      if (k.toca > 0) { k.toca -= dt; g.visible = k.toca <= 0; continue; }
      if (dj < 6) { k.toca = 4 + Math.random() * 5; g.visible = false; continue; } // correu pra toca
      // anda de lado, para, muda de direção
      k.para -= dt;
      if (k.para <= 0) { k.para = 0.6 + Math.random() * 2; k.dir = Math.random() < 0.5 ? 1 : -1; k.vel = Math.random() < 0.4 ? 0 : 0.6 + Math.random() * 0.8; }
      if (k.vel) {
        const ex = Math.cos(g.rotation.y) * k.dir * k.vel * dt, ez = -Math.sin(g.rotation.y) * k.dir * k.vel * dt;
        const nx = g.position.x + ex, nz = g.position.z + ez;
        if (this.cob.at(nx, nz) === COB.MANGUE && !this.world.isWater(nx, nz)) { g.position.x = nx; g.position.z = nz; } else k.dir = -k.dir;
        for (let i = 0; i < k.patas.length; i++) k.patas[i].rotation.y = k.patas[i].userData.y0 + Math.sin(t * 18 + i) * 0.25; // perninhas
      }
      g.position.y = this.world.groundY(g.position.x, g.position.z) + 0.04;
    }
    if (this.catador) {
      const c = this.catador;
      animatePerson(c.p, 0, dt);
      c.p.userData.upper && (c.p.userData.upper.rotation.x = 0.5 + Math.sin(t * 0.8) * 0.15); // curvado, procurando na lama
      if ((c.grito -= dt) < 0 && Math.hypot(c.p.position.x - P.x, c.p.position.z - P.z) < 20) { c.grito = 14; this.hud.say(c.p, 'Olha o caranguejo! Corda com dez, vinte e cinco real!', 3); }
    }
  }

  monta([cx, cz]) {
    const g = new THREE.Group(), C = this.cob;
    for (let i = 0, tent = 0; i < N && tent < 600; tent++) {
      const a = Math.random() * 6.28, r = Math.random() * 45, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (C.at(x, z) !== COB.MANGUE || this.world.isWater(x, z)) continue;
      const k = new THREE.Group(), patas = [];
      k.add(new THREE.Mesh(cascoGeo, CASCO));
      for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { const p = new THREE.Mesh(pataGeo, PATA); p.position.set(0.06 * s, -0.01, -0.04 + j * 0.04); p.userData.y0 = s > 0 ? -0.3 + j * 0.3 : Math.PI + 0.3 - j * 0.3; p.rotation.y = p.userData.y0; k.add(p); patas.push(p); }
      for (const s of [-1, 1]) { const m = new THREE.Mesh(garraGeo, CASCO); m.position.set(0.08 * s, 0.02, 0.12); k.add(m); }
      k.position.set(x, this.world.groundY(x, z) + 0.04, z); k.rotation.y = Math.random() * 6.28;
      g.add(k); this.cs.push({ g: k, patas, dir: 1, vel: 0, para: Math.random() * 2, toca: 0 }); i++;
    }
    // catador de caranguejo numa ponta do mangue, de chapéu e balde
    const p = makePerson({ hat: 'bone', longSleeve: true, bottom: 'bermuda', shirt: '#c9b98f' });
    const balde = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.3, 10), new THREE.MeshStandardMaterial({ color: '#2a6fb5', roughness: 0.6 })); balde.position.set(0.45, 0.15, 0.1); p.add(balde);
    p.position.set(cx, this.world.groundY(cx, cz), cz); p.rotation.y = Math.random() * 6.28; g.add(p);
    this.catador = { p, grito: 2 };
    this.scene.add(g); this.grupo = g; this.centro = [cx, cz];
  }

  desmonta() {
    if (!this.grupo) return;
    if (this.catador) this.hud.forget(this.catador.p);
    this.scene.remove(this.grupo); this.grupo = null; this.cs = []; this.catador = null; this.centro = null;
  }
}
