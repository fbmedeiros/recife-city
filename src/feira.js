// Feira livre na frente dos mercados de bairro (Casa Amarela, Encruzilhada, Madalena, Afogados, Torre, São José,
// Boa Vista), das 6h às 13h. Barracas de lona colorida com montes de fruta e verdura e um feirante em cada uma,
// gritando o pregão quando o jogador passa. A pé, perto de uma barraca, B compra. Só monta com a câmera a menos de
// 300 m; de tarde a feira some.
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { spend } from './save.js';
import { conta } from './trofeus.js';

const MERCADOS = ['Mercado de Casa Amarela', 'Mercado da Encruzilhada', 'Mercado da Madalena', 'Mercado de Afogados', 'Mercado da Torre', 'Mercado de São José', 'Mercado da Boa Vista'];
const BARRACAS = [
  { nome: 'manga espada', preco: 5, cores: ['#f2b705', '#e07a1f', '#7fae55'], fala: 'Olha a manga espada, docinha, cinco real o quilo!' },
  { nome: 'caju', preco: 4, cores: ['#e8343f', '#f2b705'], fala: 'Caju! Pra suco, pra doce, pra cachaça!' },
  { nome: 'macaxeira', preco: 6, cores: ['#8a5a2b', '#6b4422'], fala: 'Macaxeira boa, que cozinha rapidinho!' },
  { nome: 'banana', preco: 3, cores: ['#f2d22e', '#d8b81f'], fala: 'Banana prata, banana comprida, três real a palma!' },
  { nome: 'pitomba', preco: 5, cores: ['#b07a3a', '#c98b4a'], fala: 'Pitomba! Olha a pitomba, é da época!' },
  { nome: 'coentro e cebolinha', preco: 2, cores: ['#2e8b57', '#3f9f4a'], fala: 'Coentro e cebolinha, dois real o molho!' },
  { nome: 'abacaxi', preco: 7, cores: ['#d9a521', '#4f7a2a'], fala: 'Abacaxi doce feito mel, freguesa!' },
  { nome: 'tapioca de goma', preco: 8, cores: ['#f6f4ee', '#ece6d6'], fala: 'Goma fresquinha pra tapioca!' },
];
const LONAS = ['#d7263d', '#1d5fa8', '#f2b705', '#2a9d58', '#f4f1ea', '#e07a1f'];
const VALEU = ['Valeu, freguês! Deus abençoe!', 'Leva mais um que eu faço desconto!', 'Volta sempre, meu querido!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ABRE = 6, FECHA = 13;

export class Feira {
  constructor({ scene, world, hud, player, day }) {
    Object.assign(this, { scene, world, hud, player, day });
    this.feiras = MERCADOS.map((n) => world.pois.find((p) => p.name === n)).filter(Boolean).map((p) => ({ x: p.x, z: p.z, nome: p.name, g: null, barracas: [] }));
  }

  get aberta() { return this.day.hours >= ABRE && this.day.hours < FECHA; }

  get perto() {
    if (this.player.vehicle) return null;
    let best = null, bd = 3.5;
    for (const F of this.feiras) for (const b of F.barracas) { const d = Math.hypot(b.x - this.player.pos.x, b.z - this.player.pos.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  get hint() { const b = this.perto; return b ? `B — comprar ${b.prod.nome} (R$ ${b.prod.preco})` : ''; }

  comprar() {
    const b = this.perto;
    if (!b) return false;
    if (!spend(b.prod.preco)) { this.hud.say(b.p, 'Tá liso, é? Leva fiado não, viu!', 2.5); return true; }
    this.hud.say(b.p, pick(VALEU), 2.5);
    this.hud.flash(`Comprou ${b.prod.nome} na feira. −R$ ${b.prod.preco}`);
    conta('feira');
    return true;
  }

  update(dt, t, cam) {
    const aberta = this.aberta;
    for (const F of this.feiras) {
      const d = Math.hypot(F.x - cam.x, F.z - cam.z);
      if (F.g && (!aberta || d > 340)) { for (const b of F.barracas) this.hud.forget(b.p); this.scene.remove(F.g); F.g = null; F.barracas = []; }
      if (!aberta || d > 300) continue;
      if (!F.g) this.monta(F);
      for (const b of F.barracas) {
        animatePerson(b.p, 0, dt);
        b.p.userData.armR.rotation.z = 1.2 + Math.max(0, Math.sin(t * 2 + b.ph)) * 0.8; // chamando o freguês
        const dj = Math.hypot(b.x - this.player.pos.x, b.z - this.player.pos.z);
        if ((b.grito -= dt) < 0 && dj < 25) { b.grito = 10 + Math.random() * 10; this.hud.say(b.p, b.prod.fala, 3); }
      }
    }
  }

  monta(F) {
    const g = new THREE.Group(), W = this.world;
    // barracas em duas fileiras na rua de pedestre / calçada em frente ao mercado, onde houver lugar livre
    const livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z);
    let tent = 0;
    while (F.barracas.length < 10 && tent++ < 400) {
      const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 30, x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r;
      if (!livre(x, z) || !livre(x + 1.6, z) || !livre(x - 1.6, z) || F.barracas.some((b) => Math.hypot(b.x - x, b.z - z) < 4.2)) continue;
      const prod = BARRACAS[F.barracas.length % BARRACAS.length], yaw = Math.atan2(F.x - x, F.z - z);
      const B = new THREE.Group(), y = W.groundY(x, z);
      const lona = new THREE.MeshStandardMaterial({ color: pick(LONAS), roughness: 0.8, side: THREE.DoubleSide });
      const pau = new THREE.MeshStandardMaterial({ color: '#7a6a55', roughness: 0.9 });
      const mesa = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.2), new THREE.MeshStandardMaterial({ color: '#9b7b52', roughness: 0.9 })); mesa.position.y = 0.85; B.add(mesa);
      for (const [px, pz] of [[-1.25, -0.55], [1.25, -0.55], [-1.25, 0.55], [1.25, 0.55]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 5), pau); p.position.set(px, 1.15, pz); B.add(p); }
      const teto = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.7), lona); teto.rotation.x = -Math.PI / 2 + 0.15; teto.position.y = 2.3; B.add(teto);
      // montes de fruta: bolinhas nas cores do produto
      for (let k = 0; k < 18; k++) {
        const c = prod.cores[k % prod.cores.length], m = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.04, 6, 5), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
        m.position.set(-1.1 + (k % 9) * 0.27, 0.95 + Math.floor(k / 9) * 0.1, 0.25 - Math.floor(k / 9) * 0.25 + (Math.random() - 0.5) * 0.08); B.add(m);
      }
      B.position.set(x, y, z); B.rotation.y = yaw; g.add(B);
      // feirante atrás da mesa
      const p = makePerson({ hat: Math.random() < 0.5 ? 'bone' : undefined, longSleeve: false });
      const bx = x - Math.sin(yaw) * 0.9, bz = z - Math.cos(yaw) * 0.9;
      p.position.set(bx, W.groundY(bx, bz), bz); p.rotation.y = yaw; g.add(p);
      F.barracas.push({ x, z, prod, p, grito: Math.random() * 6, ph: Math.random() * 6 });
    }
    this.scene.add(g); F.g = g;
  }
}
