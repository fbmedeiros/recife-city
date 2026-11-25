// Roda de capoeira no Marco Zero (das 10h ao fim da tarde): uns doze em roda batendo palma, a bateria de um lado
// (três berimbaus, pandeiro e atabaque) e dois no meio jogando — ginga, meia-lua de frente, cocorinha, esquiva —
// trocando de dupla a cada ~25 s. Som próprio (berimbau, pandeiro, agogô) pela distância. Ficar assistindo de
// perto (a pé, até 9 m) uma troca de dupla conta pro troféu. Só monta com a câmera a menos de 220 m.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { conta } from './trofeus.js';

const GRITOS = ['Iê!', 'Joga bonito, camará!', 'Olha a meia-lua!', 'Volta ao mundo!', 'Ê, capoeira!', 'Segura o jogo, menino!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ABADA = '#f4f1ea';
const PAU = new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 0.9 });
const CABACA = new THREE.MeshStandardMaterial({ color: '#c99a4a', roughness: 0.7 });
const COURO = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.8 });

// ginga e golpes: fase w avança sempre, golpe escolhido por ciclo
function joga(p, t, ph, golpe) {
  const u = p.userData; if (!u.legL) return;
  const w = t * 2.6 + ph, s = Math.sin(w), c = Math.cos(w);
  // ginga: base larga, perna de trás vai e volta, braço da frente protegendo o rosto
  u.legL.rotation.set(-0.35 + s * 0.45, 0, -0.35); u.legR.rotation.set(-0.35 - s * 0.45, 0, 0.35);
  u.kneeL.rotation.x = 0.7 + Math.max(0, s) * 0.5; u.kneeR.rotation.x = 0.7 + Math.max(0, -s) * 0.5;
  u.armL.rotation.set(-1.4 + s * 0.3, 0, -0.3); u.armR.rotation.set(-0.5 - s * 0.3, 0, 0.5);
  u.elbowL.rotation.x = -1.3; u.elbowR.rotation.x = -0.4;
  u.upper.position.y = -0.28; u.upper.rotation.set(0.35, s * 0.35, 0);
  const g = (w / (Math.PI * 2)) % 4; // a cada 4 gingas um golpe no último quarto
  if (g > 3) {
    const k = Math.sin((g - 3) * Math.PI); // 0 → 1 → 0
    if (golpe === 0) { u.legR.rotation.set(-0.3, 0, 0.35 + k * 1.3); u.kneeR.rotation.x = 0.1; u.upper.rotation.set(0.35 - k * 0.3, k * 1.8, -k * 0.3); } // meia-lua de frente
    else if (golpe === 1) { u.legL.rotation.x = u.legR.rotation.x = -1.4 * k - 0.3; u.kneeL.rotation.x = u.kneeR.rotation.x = 0.7 + k * 1.4; u.upper.position.y = -0.28 - k * 0.45; u.upper.rotation.x = 0.35 + k * 0.4; } // cocorinha
    else { u.upper.rotation.set(0.35 + k * 0.5, 0, k * 0.7); u.armR.rotation.set(-0.3, 0, 0.5 + k * 1.2); } // esquiva lateral
  }
  void c;
}

export class Capoeira {
  constructor({ scene, world, hud, player, day }) {
    Object.assign(this, { scene, world, hud, player, day });
    const mz = world.pois.find((p) => p.name === 'Marco Zero');
    this.mz = mz || null; this.g = null; this.local = null; this.som = null;
  }

  get ativa() { return this.day.hours >= 10; }

  update(dt, t, cam) {
    if (!this.mz) return;
    const d = Math.hypot(this.mz.x - cam.x, this.mz.z - cam.z);
    if (this.g && (d > 250 || !this.ativa)) this.desmonta();
    if (d > 220 || !this.ativa) return;
    if (!this.g && !this.monta()) return;
    const [cx, cz] = this.local, P = this.player;
    for (const r of this.roda) {
      const u = r.p.userData;
      if (r.tipo === 'palma') { const b = Math.max(0, Math.sin(t * 7.5 + r.ph)); u.armL.rotation.set(-1.2, 0, -0.25 + b * 0.35); u.armR.rotation.set(-1.2, 0, 0.25 - b * 0.35); u.elbowL.rotation.x = u.elbowR.rotation.x = -0.9; }
      else if (r.tipo === 'berimbau') u.armR.rotation.x = -0.9 + Math.max(0, Math.sin(t * 7.5 + r.ph)) * 0.25;
      else if (r.tipo === 'pandeiro') u.armR.rotation.x = -1.1 + Math.abs(Math.sin(t * 7.5)) * 0.4;
    }
    // os dois do meio giram devagar em volta do centro, um de frente pro outro
    this.ang += dt * 0.35;
    this.jogo.forEach((j, i) => {
      const a = this.ang + i * Math.PI, rr = 1.3 + Math.sin(t * 0.8) * 0.25;
      j.p.position.set(cx + Math.cos(a) * rr, j.y, cz + Math.sin(a) * rr);
      j.p.rotation.y = Math.atan2(cx - j.p.position.x, cz - j.p.position.z);
      joga(j.p, t, i * 1.6, j.golpe);
      if (Math.sin(t * 2.6 / 4 + i) > 0.999) j.golpe = Math.floor(Math.random() * 3);
    });
    const dj = Math.hypot(cx - P.pos.x, cz - P.pos.z), assistindo = !P.vehicle && dj < 9;
    if ((this.grito -= dt) <= 0) { this.grito = 6 + Math.random() * 6; if (dj < 25) this.hud.say(pick(this.roda).p, pick(GRITOS), 2); }
    // troca de dupla: um da roda entra no lugar de quem estava jogando
    if ((this.troca -= dt) <= 0) {
      this.troca = 22 + Math.random() * 8;
      if (this.viu) conta('capoeira');
      this.viu = assistindo;
      for (const j of this.jogo) j.golpe = Math.floor(Math.random() * 3);
      this.jogo.forEach((j) => j.p.traverse((o) => { if (o.isMesh && o.material?.userData?.corda) o.material.color.set(pick(['#f2b705', '#2a9d58', '#3a86ff', '#e63946', '#8338ec'])); }));
    }
    if (!assistindo) this.viu = false;
  }

  monta() {
    const W = this.world, M = this.mz;
    // largo livre de uns 9 m perto do Marco Zero (no piso da praça, longe da pista)
    const livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z) && !(W.ocupados || []).some(([ox, oz, r]) => Math.hypot(ox - x, oz - z) < r);
    let cx = null, cz = null;
    if (W.ocupados) W.ocupados = W.ocupados.filter((o) => o[3] !== 'capoeira');
    for (let r = 14; r < 80 && cx == null; r += 4) for (let a = 0; a < 6.28; a += 0.3) {
      const x = M.x + Math.cos(a) * r, z = M.z + Math.sin(a) * r;
      let ok = true; for (let k = 0; k < 8 && ok; k++) { const b = (k * Math.PI) / 4; if (!livre(x + Math.cos(b) * 4.5, z + Math.sin(b) * 4.5)) ok = false; }
      if (ok && livre(x, z)) { cx = x; cz = z; break; }
    }
    if (cx == null) { this.mz = null; return false; }
    const g = new THREE.Group(), y = W.groundY(cx, cz);
    this.roda = []; this.jogo = [];
    const N = 15;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, x = cx + Math.cos(a) * 3.6, z = cz + Math.sin(a) * 3.6;
      const tipo = i < 3 ? 'berimbau' : i === 3 ? 'pandeiro' : i === 4 ? 'atabaque' : 'palma';
      const p = makePerson({ shirt: ABADA, pants: ABADA, bottom: 'calca', longSleeve: false });
      p.position.set(x, y, z); p.rotation.y = Math.atan2(cx - x, cz - z); g.add(p);
      const u = p.userData;
      if (tipo === 'berimbau') {
        // verga de pau com a cabaça embaixo, segurada na mão esquerda
        const b = new THREE.Group(), verga = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.5, 5), PAU); verga.position.y = 0.6; b.add(verga);
        const cab = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), CABACA); cab.position.y = 0.05; b.add(cab);
        b.position.set(0, -0.55, 0.08); u.elbowL.add(b); u.armL.rotation.set(-0.7, 0, -0.1); u.elbowL.rotation.x = -1.1;
      } else if (tipo === 'pandeiro') {
        const pd = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 14), COURO); pd.rotation.x = Math.PI / 2; pd.position.set(0, -0.35, 0.1); u.elbowL.add(pd); u.armL.rotation.set(-1.3, 0, -0.1); u.elbowL.rotation.x = -0.8;
      } else if (tipo === 'atabaque') {
        const at = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.9, 12), PAU); at.position.set(x + (cx - x) * 0.12, y + 0.45, z + (cz - z) * 0.12); g.add(at);
        u.armL.rotation.x = u.armR.rotation.x = -0.9;
      }
      this.roda.push({ p, tipo, ph: Math.random() * 0.3 });
    }
    for (let i = 0; i < 2; i++) {
      const p = makePerson({ shirt: ABADA, pants: ABADA, bottom: 'calca', top: 'regata' });
      // corda (cordão da graduação) na cintura
      const corda = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 5, 14), new THREE.MeshStandardMaterial({ color: pick(['#f2b705', '#2a9d58', '#3a86ff']), roughness: 0.7 }));
      corda.material.userData.corda = true; corda.rotation.x = Math.PI / 2; corda.position.y = 0.95; p.add(corda);
      p.userData.seated = true; // animação própria (não deixa o andar mexer)
      g.add(p); this.jogo.push({ p, y, golpe: i });
    }
    (W.ocupados ||= []).push([cx, cz, 5, 'capoeira']);
    this.scene.add(g); this.g = g; this.local = [cx, cz]; this.ang = 0; this.grito = 2; this.troca = 25; this.viu = false;
    return true;
  }

  desmonta() {
    if (!this.g) return;
    for (const r of this.roda) this.hud.forget(r.p);
    this.scene.remove(this.g); this.g = null; this.local = null;
  }

  // som da roda pela distância (main.js mistura com os outros loops)
  vol(cam) {
    if (!this.g || !this.local) return 0;
    const d = Math.hypot(this.local[0] - cam.x, this.local[1] - cam.z);
    return d < 120 ? 0.5 * (1 - d / 120) ** 2 : 0;
  }
}
