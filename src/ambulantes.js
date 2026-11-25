// Ambulante no sinal: com o carro parado no vermelho, chega alguém na janela vendendo água, pipoca, amendoim,
// chiclete ou carregador. B compra. Abriu o sinal (ou o carro andou), a pessoa volta pra calçada e some.
// O sinal vem do world.stopAhead (semáforo fechado à frente, a até 30 m).
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { spend } from './save.js';
import { conta } from './trofeus.js';

const PRODUTOS = [
  { nome: 'uma água mineral gelada', preco: 2, fala: 'Água, água gelada! Dois real!', cor: '#7fc8f8', fim: 'Tomou uma água gelada. Refrescou!' },
  { nome: 'um saco de pipoca doce', preco: 3, fala: 'Olha a pipoca doce! Três real!', cor: '#f28ab2', fim: 'Pipoca doce no carro. Vai ficar farelo pra todo lado.' },
  { nome: 'um amendoim torradinho', preco: 3, fala: 'Amendoim torradinho, quentinho! Três real!', cor: '#c98b4a', fim: 'Amendoim torradinho. Arretado!' },
  { nome: 'um chiclete', preco: 1, fala: 'Chiclete, bala, pirulito! Um real!', cor: '#f2c230', fim: 'Chiclete de hortelã. Hálito garantido.' },
  { nome: 'um carregador de celular', preco: 10, fala: 'Carregador, cabo, suporte! Dez real, patrão!', cor: '#222222', fim: 'Carregador novo. Vamo ver quanto tempo dura…' },
];
const TCHAU = ['Vai com Deus, patrão!', 'Fica pra próxima, visse!', 'Boa viagem aí!'];
const VALEU = ['Valeu, patrão! Deus te abençoe!', 'Obrigado, visse! Bom trabalho!', 'Tu é o ouro, meu rei!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Ambulantes {
  constructor({ scene, world, hud, player }) {
    Object.assign(this, { scene, world, hud, player });
    this.v = null;        // ambulante atual { mesh, prod, estado: 'vem' | 'janela' | 'vai', alvo, t }
    this.parado = 0;      // tempo parado no vermelho
    this.espera = 0;      // intervalo até o próximo ambulante
  }

  get hint() { const v = this.v; return v && v.estado === 'janela' && !v.comprou ? `B — comprar ${v.prod.nome.replace(/^um[a]? /, '')} (R$ ${v.prod.preco})` : ''; }

  comprar() {
    const v = this.v;
    if (!v || v.estado !== 'janela' || v.comprou) return false;
    if (!spend(v.prod.preco)) { this.hud.say(v.mesh, 'Tá liso, é? Fica pra próxima!', 2.5); v.comprou = true; return true; }
    v.comprou = true;
    this.hud.say(v.mesh, pick(VALEU), 2.5);
    this.hud.flash(`${v.prod.fim} −R$ ${v.prod.preco}`);
    conta('sinal');
    return true;
  }

  update(dt) {
    const car = this.player.vehicle, v = this.v;
    this.espera -= dt;
    if (car && !v) {
      const m = car.mesh, h = m.rotation.y, fx = Math.sin(h), fz = Math.cos(h);
      const vermelho = Math.abs(car.speed) < 0.5 && this.world.stopAhead?.(m.position.x, m.position.z, fx, fz) != null;
      this.parado = vermelho ? this.parado + dt : 0;
      if (this.parado > 1.2 && this.espera <= 0 && m.userData.kind !== 'bike') this.chega(m, h);
    }
    if (!v) return;
    const p = v.mesh;
    if (v.estado !== 'vai') {
      const m = car?.mesh;
      const saiu = !m || Math.abs(car.speed) > 1.5 || p.position.distanceTo(m.position) > 12;
      if (saiu) { v.estado = 'vai'; v.t = 0; if (m) this.hud.say(p, pick(TCHAU), 2); const h = m ? m.rotation.y : 0; v.alvo = new THREE.Vector3(p.position.x + Math.cos(h) * 6, 0, p.position.z - Math.sin(h) * 6); }
      else v.alvo.set(m.position.x + Math.cos(m.rotation.y) * v.lado * 1.7, 0, m.position.z - Math.sin(m.rotation.y) * v.lado * 1.7); // janela acompanha o carro
    }
    const dx = v.alvo.x - p.position.x, dz = v.alvo.z - p.position.z, d = Math.hypot(dx, dz);
    if (d > 0.3) {
      const sp = Math.min(d, 1.6 * dt);
      p.position.x += (dx / d) * sp; p.position.z += (dz / d) * sp;
      p.rotation.y = Math.atan2(dx, dz);
      animatePerson(p, 1.6, dt);
    } else {
      animatePerson(p, 0, dt);
      if (v.estado === 'vem') { v.estado = 'janela'; this.hud.say(p, v.prod.fala, 3.5); }
      if (v.estado === 'janela' && car) p.rotation.y = Math.atan2(car.mesh.position.x - p.position.x, car.mesh.position.z - p.position.z);
    }
    p.position.y = this.world.groundY(p.position.x, p.position.z);
    if (v.estado === 'vai' && (v.t += dt) > 4) { this.scene.remove(p); this.hud.forget(p); this.v = null; this.espera = 25; }
  }

  chega(m, h) {
    const prod = pick(PRODUTOS), lado = Math.random() < 0.5 ? 1 : -1;
    const mesh = makePerson({ longSleeve: Math.random() < 0.4, hat: Math.random() < 0.6 ? 'bone' : undefined });
    // isopor ou bandeja com o produto na mão
    const caixa = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: prod.preco === 2 ? '#f4f4f0' : prod.cor, roughness: 0.6 }));
    caixa.position.set(0.05, 1.0, 0.32); mesh.add(caixa);
    // vem de uns 7 m à frente, pelo lado da janela
    const x = m.position.x + Math.sin(h) * 7 + Math.cos(h) * lado * 2.4, z = m.position.z + Math.cos(h) * 7 - Math.sin(h) * lado * 2.4;
    mesh.position.set(x, this.world.groundY(x, z), z);
    this.scene.add(mesh);
    this.v = { mesh, prod, lado, estado: 'vem', alvo: new THREE.Vector3(), t: 0, comprou: false };
  }
}
