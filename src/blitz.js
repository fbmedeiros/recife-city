// Blitz de trânsito: de vez em quando (3–6 min) a polícia monta uma blitz numa avenida perto do jogador, com cones
// estreitando a pista e dois guardas de colete. Passar de carro devagar (até ~30 km/h) libera; furar em velocidade
// dá uma estrela. Desmonta depois de 3 minutos ou quando o jogador se afasta.
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { conta } from './trofeus.js';

const COLETE = new THREE.MeshStandardMaterial({ color: '#d7f25a', emissive: '#7a8f12', emissiveIntensity: 0.25, roughness: 0.6 });
const CONE = new THREE.MeshStandardMaterial({ color: '#ff6a13', roughness: 0.6 });
const FAIXA = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.5 });
const coneGeo = new THREE.ConeGeometry(0.22, 0.7, 10).translate(0, 0.35, 0), faixaGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.1, 10).translate(0, 0.42, 0);

export class Blitz {
  constructor({ scene, world, traffic, hud, player, police }) {
    Object.assign(this, { scene, world, traffic, hud, player, police });
    this.b = null; this.t = 200 + Math.random() * 120;
  }

  update(dt, t) {
    const B = this.b, P = this.player;
    if (!B) { if ((this.t -= dt) <= 0) this.monta(); return; }
    const d = Math.hypot(B.x - P.pos.x, B.z - P.pos.z);
    if ((B.vida += dt) > 180 || d > 650) return this.desmonta();
    // guardas acenando pra quem chega
    for (const g of B.guardas) { animatePerson(g, 0, dt); g.userData.armR.rotation.z = 2.2 + Math.sin(t * 3) * 0.5; }
    // passou pela blitz de carro: devagar libera, rápido fura
    const v = P.vehicle;
    if (v && d < 9 && !B.passou) {
      B.passou = true;
      const kmh = Math.abs(v.speed) * 3.6;
      if (kmh > 32) { this.police.crime(1, 'Furou a blitz'); this.hud.say(B.guardas[0], 'Ei! Para aí! Volta aqui!', 3); }
      else { this.hud.say(B.guardas[0], 'Boa tarde! Documento em dia, pode seguir. Bom trabalho!', 3.5); this.hud.flash('🚔 Blitz: tudo certo, pode seguir'); conta('blitz'); }
    }
    if (d > 30) B.passou = false;
  }

  monta() {
    this.t = 200 + Math.random() * 160;
    const T = this.traffic, P = this.player.pos;
    let e = null;
    for (let k = 0; k < 20 && !e; k++) { const q = T.randomEdge(T.drive, P.x, P.z, 160, 380); if (q && ['primary', 'secondary', 'trunk'].includes(q.k) && q.len > 40) e = q; }
    if (!e) return;
    const g = new THREE.Group(), W = this.world, tm = e.len / 2, cx = e.a.x + e.dx * tm, cz = e.a.z + e.dz * tm;
    const nx = -e.dz, nz = e.dx, meia = (e.w || 7) / 2;
    // cones em diagonal fechando a faixa da direita, num trecho de ~14 m
    for (let i = 0; i < 6; i++) {
      const ao = -7 + i * 2.6, lado = meia - 0.4 - i * 0.45;
      const x = cx + e.dx * ao + nx * lado, z = cz + e.dz * ao + nz * lado;
      const c = new THREE.Mesh(coneGeo, CONE), f = new THREE.Mesh(faixaGeo, FAIXA);
      c.position.set(x, W.groundY(x, z), z); f.position.copy(c.position); g.add(c, f);
    }
    // dois guardas na calçada do lado da blitz, de colete
    const guardas = [];
    for (const ao of [2, 5]) {
      const x = cx + e.dx * ao + nx * (meia + 1.2), z = cz + e.dz * ao + nz * (meia + 1.2);
      const p = makePerson({ shirt: '#26324a', pants: '#26324a', longSleeve: true, hat: 'bone' });
      const colete = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.3), COLETE); colete.position.set(0, 1.25, 0); p.add(colete);
      p.position.set(x, W.groundY(x, z), z); p.rotation.y = Math.atan2(-nx, -nz); g.add(p); guardas.push(p);
    }
    this.scene.add(g);
    this.b = { g, guardas, x: cx, z: cz, vida: 0, passou: false, rua: e.name || null };
    const rua = e.name ? ` na ${e.name}` : '';
    this.hud.flash(`🚔 Blitz${rua}! Passa devagar.`);
  }

  desmonta() {
    for (const p of this.b.guardas) this.hud.forget(p);
    this.scene.remove(this.b.g);
    this.b = null;
  }
}
