// Bicicleta compartilhada: estações de bicicleta laranja de aluguel nos parques e praças (Marco Zero, Jaqueira,
// 13 de Maio, Casa Forte, Dona Lindu, Segundo Jardim e Praça de Boa Viagem — as que existirem no mapa). Cada uma tem
// o totem e cinco bicicletas na trava. A pé, perto, B aluga uma (R$ 5) e já sai pedalando. Descer da bicicleta
// alugada perto de qualquer estação devolve; longe, ela fica estacionada onde parou. Só monta com a câmera a
// menos de 220 m.
import * as THREE from 'three';
import { makeVehicle } from './models.js';
import { spend } from './save.js';
import { conta } from './trofeus.js';

const LUGARES = [/^Marco Zero$/, /^Parque da Jaqueira$/, /^Parque 13 de Maio$/, /^Praça de Casa Forte$/, /^Parque Dona Lindu$|^Dona Lindu$/, /^Segundo Jardim de Boa Viagem$/, /^Praça Boa Viagem$/];
const LARANJA = '#ff6a13', PRECO = 5;
const TOTEM = new THREE.MeshStandardMaterial({ color: LARANJA, roughness: 0.5 });
const CINZA = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.4, metalness: 0.6 });
const TELA = new THREE.MeshStandardMaterial({ color: '#1b2b3a', emissive: '#2a6fb5', emissiveIntensity: 0.6 });

// bicicleta sem a bag de entregador (a de aluguel é de passeio)
function bike() {
  const m = makeVehicle('bike', LARANJA), r = m.userData.rider;
  const up = r?.userData.upper;
  if (up) for (const c of [...up.children]) if (c.isMesh && Math.abs(c.position.y - 1.25) < 0.01 && Math.abs(c.position.z + 0.3) < 0.01) up.remove(c);
  m.userData.aluguel = true;
  return m;
}

export class Bicicletas {
  constructor({ scene, world, hud, player, traffic }) {
    Object.assign(this, { scene, world, hud, player, traffic });
    this.es = [];
    for (const re of LUGARES) { const p = world.pois.find((q) => re.test(q.name)); if (p) this.es.push({ x: p.x, z: p.z, nome: p.name, g: null, sem: false }); }
  }

  get perto() {
    if (this.player.vehicle) return null;
    const P = this.player.pos;
    return this.es.find((E) => E.g && Math.hypot(E.local[0] - P.x, E.local[1] - P.z) < 4) || null;
  }

  get hint() { return this.perto ? `B — alugar uma bicicleta (R$ ${PRECO})` : ''; }

  aluga() {
    const E = this.perto; if (!E) return false;
    if (!spend(PRECO)) { this.hud.flash('Sem saldo pra alugar a bicicleta.'); return true; }
    const m = bike(), [x, z] = E.local, h = E.yaw + Math.PI / 2;
    m.position.set(x + Math.sin(h) * 1.6, 0, z + Math.cos(h) * 1.6); m.rotation.y = h;
    this.scene.add(m);
    const P = this.player;
    P.vehicle = { mesh: m, speed: 0, steer: 0 };
    m.userData.rider.visible = true; P.mesh.visible = false;
    this.hud.flash(`Alugou uma bicicleta. −R$ ${PRECO}. Pra devolver, desce perto de uma estação.`);
    conta('bike_aluguel');
    return true;
  }

  // chamado quando o jogador desce de um veículo: bicicleta alugada perto de estação é devolvida
  desceu(mesh) {
    if (!mesh?.userData.aluguel) return;
    const E = this.es.find((q) => Math.hypot(q.x - mesh.position.x, q.z - mesh.position.z) < 60 || (q.local && Math.hypot(q.local[0] - mesh.position.x, q.local[1] - mesh.position.z) < 15));
    if (!E) return;
    const i = this.traffic.parked.findIndex((c) => c.mesh === mesh);
    if (i >= 0) this.traffic.parked.splice(i, 1);
    this.scene.remove(mesh);
    this.hud.flash('Devolveu a bicicleta na estação.');
  }

  update(dt, t, cam) {
    for (const E of this.es) {
      if (E.sem) continue;
      const d = Math.hypot(E.x - cam.x, E.z - cam.z);
      if (E.g && d > 250) { this.scene.remove(E.g); E.g = null; }
      if (d > 220 || E.g) continue;
      this.monta(E);
    }
  }

  monta(E) {
    const W = this.world, livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z) && !(W.ocupados || []).some(([ox, oz, r]) => Math.hypot(ox - x, oz - z) < r + 1.5);
    // calçada livre de ~5 m perto do ponto, com rua do lado (a estação fica na beira da calçada)
    let at = null;
    if (W.ocupados) W.ocupados = W.ocupados.filter((o) => o[3] !== 'bike:' + E.nome);
    // a partir de 14 m: perto do ponto ficam o dominó e a capoeira
    for (let r = 14; r < 90 && !at; r += 3) for (let a = 0; a < 6.28 && !at; a += 0.25) {
      const x = E.x + Math.cos(a) * r, z = E.z + Math.sin(a) * r;
      for (let b = 0; b < 6.28; b += 0.5) {
        const ux = Math.cos(b), uz = Math.sin(b);
        if ([-2.5, -1.2, 0, 1.2, 2.5].every((s) => livre(x + ux * s, z + uz * s)) && livre(x - uz * 1.6, z + ux * 1.6)) { at = [x, z, Math.atan2(ux, uz)]; break; }
      }
    }
    if (!at) { E.sem = true; return; }
    const [x, z, yaw] = at, g = new THREE.Group(), y = W.groundY(x, z);
    const base = new THREE.Group(); base.position.set(x, y, z); base.rotation.y = yaw; g.add(base);
    const totem = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, 0.3), TOTEM); totem.position.set(0, 0.8, -3.1); base.add(totem);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), TELA); tela.position.set(0, 1.25, -2.94); base.add(tela);
    const barra = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 5.4), CINZA); barra.position.set(-0.3, 0.45, 0); base.add(barra);
    for (let i = 0; i < 5; i++) {
      const b = bike(); b.userData.rider.visible = false;
      b.position.set(0.3, 0, -2.2 + i * 1.1); b.rotation.y = Math.PI / 2; base.add(b);
      const trava = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), CINZA); trava.position.set(-0.3, 0.25, -2.2 + i * 1.1); base.add(trava);
    }
    (W.ocupados ||= []).push([x, z, 3.5, 'bike:' + E.nome]); // a estação inteira (5,4 m de trava)
    this.scene.add(g); E.g = g; E.local = [x, z]; E.yaw = yaw;
  }
}
