// Pipas no céu das comunidades: na comunidade mais perto da câmera (até ~700 m), sete crianças empinam pipa de
// papel de seda colorido com rabiola, a 25–45 m de altura, linha esticada até a mão, balançando com o vento. De vez
// em quando uma linha arrebenta e a pipa sai voando solta, descendo devagar a favor do vento até cair no chão: a pé,
// chegar nela (2,5 m) apara a pipa (troféu). Sem chuva: com toró a molecada recolhe as pipas.
import * as THREE from 'three';
import { COMMUNITIES } from './culture.js';
import { makePerson } from './models.js';
import { conta } from './trofeus.js';

const CORES = ['#e63946', '#ffbe0b', '#3a86ff', '#06d6a0', '#8338ec', '#fb5607', '#f4f1ea', '#2a9d58'];
const VENTO = [0.8, -0.6]; // brisa do mar (vem de sudeste, empurra pra noroeste)
const N = 7;
const pipaGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 0.55); s.lineTo(0.42, 0); s.lineTo(0, -0.75); s.lineTo(-0.42, 0); s.closePath(); return new THREE.ShapeGeometry(s); })();
const varetaGeo = new THREE.BoxGeometry(0.03, 1.3, 0.03);
const rabGeo = new THREE.PlaneGeometry(0.12, 0.5);
const VARETA = new THREE.MeshStandardMaterial({ color: '#c8a46a', roughness: 0.9 });
const LINHA = new THREE.LineBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.55 });
const FALAS = ['Aparou! Essa é tua, visse?', 'Caraí, pegou a pipa no ar!', 'Ê, aparou bonito!'];

export class Pipas {
  constructor({ scene, world, hud, player, weather }) {
    Object.assign(this, { scene, world, hud, player, weather });
    this.comms = COMMUNITIES; this.c = null; this.g = null; this.ps = []; this.t = 0; this.corte = 30 + Math.random() * 30; this.solta = null;
  }

  // comunidade mais perto da câmera (a que tem centro calculado)
  perto(cam) {
    let best = null, bd = 700;
    for (const c of COMMUNITIES) { if (c.x == null) continue; const d = Math.hypot(c.x - cam.x, c.z - cam.z) - (c.R || 300) * 0.5; if (d < bd) { bd = d; best = c; } }
    return best;
  }

  update(dt, t, cam) {
    const chuva = (this.weather?.r || 0) > 0.3;
    if ((this.t -= dt) <= 0) {
      this.t = 2;
      const c = chuva ? null : this.perto(cam);
      if (c !== this.c) { this.desmonta(); if (c) this.monta(c); }
    }
    if (!this.g) return;
    const W = this.world;
    for (const P of this.ps) {
      if (P.livre) continue;
      // figura de oito no alto, a favor do vento, com uma pipa ou outra dando "embicada"
      const sw = Math.sin(t * 0.7 + P.ph), sw2 = Math.sin(t * 1.4 + P.ph * 2);
      const kx = P.ax + VENTO[0] * P.dist + sw * 5, kz = P.az + VENTO[1] * P.dist + sw2 * 3, ky = P.y0 + P.alt + Math.sin(t * 0.9 + P.ph) * 3;
      P.k.position.set(kx, ky, kz);
      P.k.lookAt(P.ax, P.y0 + 1.4, P.az); P.k.rotateZ(sw * 0.5);
      this.balancaRabiola(P, t);
      const a = P.line.geometry.attributes.position; a.setXYZ(0, P.ax, P.y0 + 1.5, P.az); a.setXYZ(1, kx, ky, kz); a.needsUpdate = true;
      P.kid.lookAt(kx, P.kid.position.y, kz);
      P.kid.userData.armR.rotation.x = -2.2 + Math.sin(t * 3 + P.ph) * 0.25; // puxando a linha
      P.kid.userData.armL.rotation.x = -1.6;
    }
    // linha arrebentou: uma pipa sai voando solta
    if (!this.solta && (this.corte -= dt) <= 0) this.arrebenta();
    const S = this.solta;
    if (S) {
      const k = S.P.k, pl = this.player;
      if (k.position.y > S.chao + 0.15) {
        S.vx += (VENTO[0] * 4 - S.vx) * dt * 0.3; S.vz += (VENTO[1] * 4 - S.vz) * dt * 0.3;
        k.position.x += S.vx * dt; k.position.z += S.vz * dt; k.position.y -= 1.6 * dt;
        k.rotation.z += dt * 1.8; k.rotation.x = Math.sin(t * 3) * 0.6;
        S.chao = W.isWater(k.position.x, k.position.z) ? -99 : W.groundY(k.position.x, k.position.z);
        this.balancaRabiola(S.P, t);
      } else { k.rotation.set(-Math.PI / 2, 0, k.rotation.z); S.noChao += dt; }
      if (k.position.y < -5 || S.noChao > 90) this.devolve();
      else if (!pl.vehicle && k.position.y < S.chao + 3 && Math.hypot(k.position.x - pl.pos.x, k.position.z - pl.pos.z) < 2.5) {
        this.hud.flash(FALAS[Math.floor(Math.random() * FALAS.length)]);
        conta('pipa');
        this.devolve();
      }
    }
  }

  balancaRabiola(P, t) { P.rab.forEach((r, i) => { r.rotation.x = Math.sin(t * 5 + i * 0.8 + P.ph) * 0.5; }); }

  arrebenta() {
    const vivas = this.ps.filter((p) => !p.livre);
    if (!vivas.length) return;
    const P = vivas[Math.floor(Math.random() * vivas.length)];
    P.livre = true; P.line.visible = false;
    this.solta = { P, vx: VENTO[0] * 3, vz: VENTO[1] * 3, chao: this.world.groundY(P.k.position.x, P.k.position.z), noChao: 0 };
    this.hud.say?.(P.kid, 'Ê, a linha arrebentou! Apara a pipa!', 3);
  }

  // pipa aparada ou perdida: a criança bota outra no alto daqui a pouco
  devolve() {
    const S = this.solta; if (!S) return;
    S.P.livre = false; S.P.line.visible = true; this.solta = null; this.corte = 40 + Math.random() * 50;
  }

  monta(c) {
    const g = new THREE.Group(), W = this.world, R = (c.R || 300) * 0.6;
    for (let i = 0, tent = 0; i < N && tent < 300; tent++) {
      const a = Math.random() * 6.28, r = 20 + Math.random() * R, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (W.blocked(x, z) || W.isWater(x, z)) continue;
      const y0 = W.groundY(x, z);
      const kid = makePerson({ tipo: Math.random() < 0.6 ? 'homem' : 'mulher', bottom: 'bermuda' }); kid.scale.multiplyScalar(0.78);
      kid.position.set(x, y0, z); g.add(kid);
      const k = new THREE.Group(), cor = CORES[i % CORES.length];
      k.add(new THREE.Mesh(pipaGeo, new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, side: THREE.DoubleSide, emissive: cor, emissiveIntensity: 0.15 })));
      const v1 = new THREE.Mesh(varetaGeo, VARETA); v1.position.y = -0.1; k.add(v1);
      const v2 = new THREE.Mesh(varetaGeo, VARETA); v2.rotation.z = Math.PI / 2; v2.scale.y = 0.65; k.add(v2);
      // rabiola: tirinhas penduradas uma embaixo da outra
      const rab = [], rm = new THREE.MeshStandardMaterial({ color: CORES[(i + 3) % CORES.length], side: THREE.DoubleSide });
      let pai = k, y = -0.75;
      for (let j = 0; j < 5; j++) { const piv = new THREE.Group(); piv.position.y = y; const m = new THREE.Mesh(rabGeo, rm); m.position.y = -0.25; piv.add(m); pai.add(piv); rab.push(piv); pai = piv; y = -0.5; }
      k.scale.setScalar(2.3); g.add(k); // maior que a real pra se ver lá de baixo
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(lg, LINHA); line.frustumCulled = false; g.add(line);
      this.ps.push({ kid, k, rab, line, ax: x, az: z, y0, dist: 25 + Math.random() * 25, alt: 25 + Math.random() * 20, ph: Math.random() * 6, livre: false });
      i++;
    }
    this.scene.add(g); this.g = g; this.c = c;
  }

  desmonta() {
    if (this.g) { for (const P of this.ps) this.hud.forget?.(P.kid); this.scene.remove(this.g); }
    this.g = null; this.ps = []; this.c = null; this.solta = null;
  }
}
