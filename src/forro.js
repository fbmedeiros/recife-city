// Forró pé-de-serra no pátio do Mercado da Boa Vista, de tarde (a feira de manhã sai às 13h, o forró começa):
// trio nordestino (sanfona, zabumba e triângulo) num canto e quatro casais dançando xote agarradinho, rodando
// devagar. Som próprio (sanfona, zabumba e triângulo, melodia composta pro jogo) pela distância. Assistir de perto
// (a pé, até 10 m) por 30 s conta pro troféu. Só monta com a câmera a menos de 200 m.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { conta } from './trofeus.js';

const GRITOS = ['Arrasta o pé, minha gente!', 'Ô xote bom!', 'Segura o fole, sanfoneiro!', 'Forró de verdade é pé-de-serra!', 'Dança comigo, morena?'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const COURO = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.8 });
const MADEIRA = new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.7 });
const METAL = new THREE.MeshStandardMaterial({ color: '#c9c9c9', metalness: 0.8, roughness: 0.3 });
const SANFONA = new THREE.MeshStandardMaterial({ color: '#b3202c', roughness: 0.4 });
const ABRE = 13;

// passo de xote: dois pra lá, dois pra cá, um de frente pro outro, braço no ombro e mão dada
function xote(p, t, lado, ph) {
  const u = p.userData; if (!u.legL) return;
  const w = t * 4.4 + ph, s = Math.sin(w), c = Math.cos(w * 0.5);
  u.legL.rotation.set(Math.max(0, s) * 0.3, 0, -0.06 + c * 0.1); u.legR.rotation.set(Math.max(0, -s) * 0.3, 0, 0.06 + c * 0.1);
  u.kneeL.rotation.x = 0.15 + Math.max(0, s) * 0.4; u.kneeR.rotation.x = 0.15 + Math.max(0, -s) * 0.4;
  u.armL.rotation.set(-1.3, 0, lado * 0.2); u.elbowL.rotation.x = -0.6; // mão dada / no ombro
  u.armR.rotation.set(-0.9, 0, -0.5); u.elbowR.rotation.x = -1.0;       // abraço
  u.upper.position.y = Math.abs(s) * 0.025; u.upper.rotation.set(0.08, c * 0.15, s * 0.05);
}

export class Forro {
  constructor({ scene, world, hud, player, day }) {
    Object.assign(this, { scene, world, hud, player, day });
    const p = world.pois.find((q) => q.name === 'Pátio do Mercado da Boa Vista') || world.pois.find((q) => q.name === 'Mercado da Boa Vista');
    this.m = p ? { x: p.x, z: p.z } : null; this.g = null; this.sem = false;
  }

  get aberto() { return this.day.hours >= ABRE; }

  update(dt, t, cam) {
    if (!this.m || this.sem) return;
    const d = Math.hypot(this.m.x - cam.x, this.m.z - cam.z);
    if (this.g && (d > 230 || !this.aberto)) this.desmonta();
    if (d > 200 || !this.aberto) return;
    if (!this.g && !this.monta()) return;
    const [cx, cz] = this.local, P = this.player;
    // casais rodando devagar no salão
    for (const C of this.casais) {
      C.a += dt * 0.25; C.giro += dt * 0.8;
      const x = cx + Math.cos(C.a) * C.r, z = cz + Math.sin(C.a) * C.r;
      C.par.forEach((p, i) => {
        const lado = i ? 1 : -1, ox = Math.cos(C.giro) * 0.22 * lado, oz = Math.sin(C.giro) * 0.22 * lado;
        p.position.set(x + ox, C.y, z + oz); p.rotation.y = Math.atan2(-ox, -oz);
        xote(p, t, lado, C.ph);
      });
    }
    // trio: fole abrindo e fechando, baqueta da zabumba, triângulo
    const fole = 1 + Math.sin(t * 2.2) * 0.35;
    this.trio.sanfona.scale.x = fole;
    this.trio.zab.userData.armR.rotation.x = -1.0 + Math.max(0, Math.sin(t * 8.8)) * 0.6;
    this.trio.tri.userData.armR.rotation.x = -1.3 + Math.sin(t * 17.6) * 0.15;
    const dj = Math.hypot(cx - P.pos.x, cz - P.pos.z), assistindo = !P.vehicle && dj < 10;
    if ((this.grito -= dt) <= 0) { this.grito = 7 + Math.random() * 6; if (dj < 25) this.hud.say(this.trio.sanf, pick(GRITOS), 2.5); }
    this.assistiu = assistindo ? this.assistiu + dt : 0;
    if (this.assistiu > 30) { this.assistiu = -1e9; conta('forro'); this.hud.flash('Arrasta-pé no Mercado da Boa Vista!'); }
  }

  vol(cam) {
    if (!this.g) return 0;
    const d = Math.hypot(this.local[0] - cam.x, this.local[1] - cam.z);
    return d < 110 ? 0.5 * (1 - d / 110) ** 2 : 0;
  }

  monta() {
    const W = this.world, livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z);
    let cx = null, cz = null;
    // salão: o pátio do mercado (ou um largo livre perto) com pelo menos 2 m livres em volta
    for (let r = 0; r < 70 && cx == null; r += 2) for (let a = 0; a < 6.28; a += 0.3) {
      const x = this.m.x + Math.cos(a) * r, z = this.m.z + Math.sin(a) * r;
      let ok = livre(x, z); for (let k = 0; k < 8 && ok; k++) { const b = (k * Math.PI) / 4; if (!livre(x + Math.cos(b) * 2, z + Math.sin(b) * 2)) ok = false; }
      if (ok) { cx = x; cz = z; break; }
      if (r === 0) break;
    }
    if (cx == null) { this.sem = true; return false; }
    // quanto de chão livre tem em cada direção (até 8 m): o trio vai pro lado mais comprido, os casais cabem no menor
    const raio = (b) => { let d = 0; while (d < 8 && livre(cx + Math.cos(b) * (d + 0.5), cz + Math.sin(b) * (d + 0.5))) d += 0.5; return d; };
    let bmax = 0, dmax = 0, dmin = 8; for (let k = 0; k < 16; k++) { const b = (k * Math.PI) / 8, d = raio(b); if (d > dmax) { dmax = d; bmax = b; } dmin = Math.min(dmin, d); }
    const g = new THREE.Group(), y = W.groundY(cx, cz);
    this.casais = [];
    for (let i = 0; i < 4; i++) {
      const par = [makePerson({ tipo: 'homem', hat: Math.random() < 0.4 ? 'bone' : undefined }), makePerson({ tipo: 'mulher' })];
      for (const p of par) { p.userData.seated = true; g.add(p); }
      this.casais.push({ par, a: (i / 4) * 6.28, r: Math.max(0.8, Math.min(1.6 + (i % 2) * 1.2, dmin - 0.6)), giro: Math.random() * 6, ph: Math.random() * 6, y });
    }
    // trio num canto do salão
    const dt = Math.max(1.5, Math.min(4, dmax - 0.8)), tx = cx + Math.cos(bmax) * dt, tz = cz + Math.sin(bmax) * dt, olha = Math.atan2(cx - tx, cz - tz), lx = Math.cos(olha), lz = -Math.sin(olha);
    const musico = (d, opts) => { const p = makePerson({ tipo: 'homem', ...opts }); p.position.set(tx + lx * d, y, tz + lz * d); p.rotation.y = olha; g.add(p); return p; };
    const sanf = musico(0, { hat: 'bone', shirt: '#e8c26a', longSleeve: true });
    const s = sanf.userData; s.armL.rotation.set(-1.1, 0, -0.5); s.armR.rotation.set(-1.1, 0, 0.5); s.elbowL.rotation.x = s.elbowR.rotation.x = -1.2;
    const sanfona = new THREE.Group(); sanfona.position.set(0, 1.05, 0.3); sanf.add(sanfona);
    const fole = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.18), SANFONA); sanfona.add(fole);
    for (const sx of [-0.19, 0.19]) { const tampa = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.2), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.3 })); tampa.position.x = sx; sanfona.add(tampa); }
    const zab = musico(-1.1, { shirt: '#2a6fb5' });
    const zabumba = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 16), MADEIRA); zabumba.rotation.z = Math.PI / 2; zabumba.position.set(0, 0.95, 0.3); zab.add(zabumba);
    for (const sx of [-0.13, 0.13]) { const pele = new THREE.Mesh(new THREE.CircleGeometry(0.27, 16), COURO); pele.position.set(sx, 0.95, 0.3); pele.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; zab.add(pele); }
    zab.userData.armL.rotation.x = -0.9; zab.userData.armR.rotation.x = -1.0;
    const tri = musico(1.1, { shirt: '#2a9d58' });
    const triangulo = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 4, 3), METAL); triangulo.position.set(-0.1, 1.45, 0.35); tri.add(triangulo);
    tri.userData.armL.rotation.x = -2.2; tri.userData.armR.rotation.x = -1.3;
    this.trio = { sanf, sanfona, zab, tri };
    this.scene.add(g); this.g = g; this.local = [cx, cz]; this.grito = 2; this.assistiu = 0;
    return true;
  }

  desmonta() {
    if (!this.g) return;
    this.hud.forget(this.trio.sanf);
    this.scene.remove(this.g); this.g = null;
  }
}
