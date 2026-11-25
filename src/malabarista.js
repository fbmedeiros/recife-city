// Malabarista no sinal: parado no vermelho (de carro ou moto), às vezes um artista de rua entra na faixa na frente
// do carro e joga três clavas coloridas pro alto. Antes de abrir o sinal ele passa na janela pedindo uma moedinha:
// B dá R$ 2. Abriu o sinal, ele volta pra calçada e some.
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { spend } from './save.js';
import { conta } from './trofeus.js';

const CORES = ['#e63946', '#f2b705', '#2a9d8f'];
const PEDE = ['Uma moedinha pro artista, patrão?', 'Ajuda o malabarista, meu rei!', 'Qualquer trocado ajuda, visse!'];
const VALEU = ['Valeu, patrão! Deus abençoe!', 'Obrigado! Boa viagem!', 'Tu é massa, visse!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Malabarista {
  constructor({ scene, world, hud, player, ambulantes }) {
    Object.assign(this, { scene, world, hud, player, ambulantes });
    this.m = null; this.parado = 0; this.espera = 20;
  }

  get hint() { const M = this.m; return M && M.estado === 'janela' && !M.deu ? 'B — dar uma moeda pro malabarista (R$ 2)' : ''; }

  moeda() {
    const M = this.m; if (!M || M.estado !== 'janela' || M.deu) return false;
    M.deu = true;
    if (!spend(2)) { this.hud.say(M.p, 'Tranquilo, fica pra próxima!', 2); return true; }
    this.hud.say(M.p, pick(VALEU), 2.5); this.hud.flash('Deu uma moeda pro malabarista. −R$ 2');
    conta('malabarista');
    return true;
  }

  update(dt, t) {
    const car = this.player.vehicle, M = this.m;
    this.espera -= dt;
    if (car && !M) {
      const m = car.mesh, h = m.rotation.y, fx = Math.sin(h), fz = Math.cos(h);
      const vermelho = Math.abs(car.speed) < 0.5 && this.world.stopAhead?.(m.position.x, m.position.z, fx, fz) != null;
      this.parado = vermelho ? this.parado + dt : 0;
      if (this.parado > 0.8 && this.espera <= 0 && m.userData.kind !== 'bike' && m.userData.kind !== 'bus') {
        this.espera = 25;
        if (Math.random() < 0.5) this.chega(m);
      }
    }
    if (!this.m) return;
    const S = this.m, p = S.p, m = car?.mesh;
    const saiu = !m || Math.abs(car.speed) > 1.5 || Math.hypot(p.position.x - m.position.x, p.position.z - m.position.z) > 14;
    if (saiu && S.estado !== 'vai') { S.estado = 'vai'; S.alvo = [p.position.x + Math.cos(S.h) * 7, p.position.z - Math.sin(S.h) * 7]; this.limpa(S, true); }
    S.t += dt;
    if (S.estado === 'show') {
      // de frente pro carro, jogando as clavas em cascata
      for (let i = 0; i < 3; i++) {
        const fase = ((t * 1.6 + i / 3) % 1), lado = Math.floor(t * 1.6 + i / 3) % 2 ? 1 : -1;
        S.clavas[i].visible = true;
        S.clavas[i].position.set(p.position.x + Math.cos(S.h) * lado * (0.35 - fase * 0.7), p.position.y + 1.3 + Math.sin(fase * Math.PI) * 1.4, p.position.z - Math.sin(S.h) * lado * (0.35 - fase * 0.7));
        S.clavas[i].rotation.x = t * 12 + i;
      }
      const u = p.userData; u.armL.rotation.x = -1.2 + Math.sin(t * 10) * 0.3; u.armR.rotation.x = -1.2 - Math.sin(t * 10) * 0.3;
      if (S.t > 7) { S.estado = 'janela'; this.limpa(S); this.hud.say(p, pick(PEDE), 3); }
    } else {
      const alvo = S.estado === 'janela' ? [m.position.x + Math.cos(m.rotation.y) * 1.7, m.position.z - Math.sin(m.rotation.y) * 1.7] : S.alvo;
      const dx = alvo[0] - p.position.x, dz = alvo[1] - p.position.z, d = Math.hypot(dx, dz), v = d > 0.3 ? Math.min(d * 3, 1.8) : 0;
      if (v) { p.position.x += (dx / d) * v * dt; p.position.z += (dz / d) * v * dt; p.rotation.y = Math.atan2(dx, dz); }
      animatePerson(p, v, dt);
      if (S.estado === 'vai' && d < 0.5) { this.hud.forget(p); this.scene.remove(S.g); this.m = null; return; }
    }
    p.position.y = this.world.groundY(p.position.x, p.position.z);
  }

  chega(car) {
    const h = car.rotation.y, fx = Math.sin(h), fz = Math.cos(h);
    const x = car.position.x + fx * 5, z = car.position.z + fz * 5, g = new THREE.Group();
    const p = makePerson({ top: 'regata', bottom: 'calca', shirt: pick(['#f2b705', '#2a9d8f', '#e63946']) });
    p.position.set(x, this.world.groundY(x, z), z); p.rotation.y = h + Math.PI; g.add(p);
    const clavas = CORES.map((c) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.42, 8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })); k.visible = false; g.add(k); return k; });
    this.scene.add(g);
    this.m = { g, p, clavas, h, estado: 'show', t: 0, deu: false };
  }

  limpa(S, tchau = false) { for (const k of S.clavas) k.visible = false; if (tchau) { const u = S.p.userData; u.armL.rotation.x = u.armR.rotation.x = 0; } }
}
