// Dominó na praça: mesinha de madeira com quatro senhores sentados em banquinhos, batendo as pedras na mesa
// (o "tac" seco). Cada partida dura uns 40 s: um bate e ri, outro reclama, embaralham e começa de novo. Ficar
// assistindo de perto (a pé, até 6 m) uma partida inteira conta pro troféu. Praças de bairro (Casa Forte, Derby,
// Jaqueira, Maciel Pinheiro, Sérgio Loreto, Boa Viagem, Hipódromo, Arsenal); só monta com a câmera a menos de 200 m.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { conta } from './trofeus.js';

const PRACAS = [/^Praça de Casa Forte$/, /^Praça do Derby$/, /^Parque da Jaqueira$/, /^Praça Maciel Pinheiro$/, /^Praça Sérgio Loreto$/, /^Praça Boa Viagem$/, /^Praça do Hipódromo$/, /^Praça do Arsenal/, /^Praça da Independência$/, /^Praça de Afogados$/, /^Praça do Entroncamento$/];
const JOGO = ['Passo.', 'Toma essa!', 'Tá trancado, visse?', 'Joga, homi, que tá demorando!', 'Essa eu sabia...', 'Quem tem o seis?'];
const BATEU = ['Bati! Pode embaralhar.', 'Bati de carroça! Carroça, rapaz!', 'Bati! Quem perdeu paga o café.', 'Lá-e-lô! Bati dos dois lados!'];
const PERDEU = ['Caraí, de novo?', 'Tu tá com sorte hoje, viu?', 'Embaralha direito dessa vez!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const MADEIRA = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.85 });
const PEDRA = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.4 });
const pedraGeo = new THREE.BoxGeometry(0.05, 0.02, 0.1);

export class Domino {
  constructor({ scene, world, hud, player, audio }) {
    Object.assign(this, { scene, world, hud, player, audio });
    this.mesas = [];
    for (const re of PRACAS) {
      const p = world.pois.find((q) => re.test(q.name));
      if (p) this.mesas.push({ x: p.x, z: p.z, nome: p.name, g: null, local: null });
    }
  }

  update(dt, t, cam) {
    const P = this.player;
    for (const M of this.mesas) {
      const d = Math.hypot(M.x - cam.x, M.z - cam.z);
      if (M.g && d > 230) { for (const s of M.velhos) this.hud.forget?.(s); this.scene.remove(M.g); M.g = null; }
      if (d > 200) continue;
      if (!M.g && !this.monta(M)) continue;
      // jogada: a cada 2–4 s um bate a pedra; no fim da partida alguém bate e o jogo recomeça
      M.joga -= dt;
      const dj = Math.hypot(M.local[0] - P.pos.x, M.local[1] - P.pos.z), assistindo = !P.vehicle && dj < 6;
      if (M.joga <= 0) {
        M.joga = 2 + Math.random() * 2; M.vez = (M.vez + 1) % 4; M.n++;
        const s = M.velhos[M.vez];
        s.userData.armR.rotation.x = -1.1; M.bate = 0.25;
        if (dj < 30) this.audio.tac?.(1 - dj / 30);
        if (M.n % 3 === 0 && dj < 15) this.hud.say(s, pick(JOGO), 2);
        if (M.pecas < M.pedras.length) M.pedras[M.pecas++].visible = true;
        if (M.n >= 14) {
          // fim da partida
          if (dj < 15) { this.hud.say(s, pick(BATEU), 3); setTimeout(() => M.g && this.hud.say(M.velhos[(M.vez + 1) % 4], pick(PERDEU), 2.5), 1500); }
          if (M.viu) conta('domino');
          M.n = 0; M.pecas = 0; M.viu = assistindo; M.joga = 5;
          for (const p of M.pedras) p.visible = false;
        }
      }
      if (!assistindo) M.viu = false;
      if (M.bate > 0 && (M.bate -= dt) <= 0) M.velhos[M.vez].userData.armR.rotation.x = -0.7;
    }
  }

  monta(M) {
    const W = this.world;
    // lugar livre de calçada/praça perto do ponto
    let x = null, z = null;
    if (W.ocupados) W.ocupados = W.ocupados.filter((o) => o[3] !== 'domino:' + M.nome); // a marca antiga é dela mesma
    for (let r = 4; r < 40 && x == null; r += 3) for (let a = 0; a < 6.28; a += 0.5) {
      const px = M.x + Math.cos(a) * r, pz = M.z + Math.sin(a) * r;
      let ok = !(W.ocupados || []).some(([ox, oz, r]) => Math.hypot(ox - px, oz - pz) < r + 3); if (ok) for (const [ox, oz] of [[0, 0], [1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]]) if (W.blocked(px + ox, pz + oz) || W.isWater(px + ox, pz + oz) || W.isDrive(px + ox, pz + oz)) { ok = false; break; }
      if (ok) { x = px; z = pz; break; }
    }
    if (x == null) { M.x = 1e9; return false; } // sem lugar: essa praça fica sem dominó
    const g = new THREE.Group(), y = W.groundY(x, z), mesa = new THREE.Group(); mesa.position.set(x, y, z); g.add(mesa);
    const tampo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), MADEIRA); tampo.position.y = 0.72; mesa.add(tampo);
    const pe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), MADEIRA); pe.position.y = 0.35; mesa.add(pe);
    // pedras na mesa: aparecem uma a uma na fila do jogo
    const pedras = [];
    for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(pedraGeo, PEDRA); p.position.set(-0.35 + (i % 7) * 0.11, 0.755, i < 7 ? -0.05 : 0.08); p.rotation.y = i % 3 ? 0 : Math.PI / 2; p.visible = false; mesa.add(p); pedras.push(p); }
    const velhos = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, sx = Math.sin(a) * 0.75, sz = Math.cos(a) * 0.75;
      const banco = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 8), MADEIRA); banco.position.set(sx, 0.21, sz); mesa.add(banco);
      const v = makePerson({ tipo: 'idoso', fem: false, hat: Math.random() < 0.4 ? 'bone' : undefined });
      const u = v.userData; u.seated = true;
      u.legL.rotation.x = u.legR.rotation.x = -1.45; u.kneeL.rotation.x = u.kneeR.rotation.x = 1.45;
      u.armL.rotation.set(-1.0, 0, 0.1); u.elbowL.rotation.x = -0.6; u.armR.rotation.x = -0.7; u.elbowR.rotation.x = -0.6;
      v.position.set(x + sx, y - 0.03, z + sz); v.rotation.y = a + Math.PI; g.add(v); velhos.push(v); // no mundo (o balão de fala usa a posição)
    }
    this.scene.add(g);
    (W.ocupados ||= []).push([x, z, 2.5, 'domino:' + M.nome]); // outros módulos desviam da mesa
    Object.assign(M, { g, velhos, pedras, local: [x, z], joga: 1 + Math.random() * 2, vez: 0, n: 0, pecas: 0, bate: 0, viu: false });
    return true;
  }
}
