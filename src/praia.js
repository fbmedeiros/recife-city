// Vendedores da praia de Boa Viagem: andam devagar pela areia, entre o calçadão e a água, gritando o pregão.
// Queijo coalho no espeto com o fogareiro soltando fumaça, picolé no isopor, castanha e amendoim no balde.
// A pé e a até 4 m de um deles, B compra. Só existem perto da câmera (6 vendedores num trecho de ~800 m de praia).
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { spend } from './save.js';
import { conta } from './trofeus.js';

const PRODUTOS = [
  { nome: 'queijo coalho', preco: 6, fala: ['Olha o queijo coalho! Com mel de engenho ou orégano?', 'Queijo coalho assadinho na brasa!'], fim: 'Queijo coalho com mel de engenho. Arretado!', tipo: 'brasa' },
  { nome: 'picolé', preco: 4, fala: ['Picolé! Tem de coco, de graviola, de cajá!', 'Olha o picolé geladinho!'], fim: 'Picolé de cajá. Salvou do calor!', tipo: 'isopor' },
  { nome: 'castanha', preco: 5, fala: ['Castanha de caju torradinha!', 'Olha a castanha, freguês!'], fim: 'Castanha de caju torradinha. Ô coisa boa!', tipo: 'balde' },
  { nome: 'amendoim', preco: 3, fala: ['Amendoim cozido, quentinho!', 'Olha o amendoim, três real!'], fim: 'Amendoim cozido na praia. Clássico.', tipo: 'balde' },
];
const VALEU = ['Valeu, freguês! Volta sempre!', 'Obrigado, visse! Bom banho de mar!', 'Tu é o ouro! Cuidado com o tubarão, viu?'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const N = 6, TRECHO = 400;

export class Praia {
  constructor({ scene, world, hud, player, sharks }) {
    Object.assign(this, { scene, world, hud, player, sharks });
    this.areia = new Map(); // z arredondado → x do meio da areia
    this.vend = [];
    this.fumaca = new THREE.MeshBasicMaterial({ color: '#d9d4cc', transparent: true, opacity: 0.18, depthWrite: false });
    this.fumGeo = new THREE.SphereGeometry(0.1, 6, 5);
  }

  // meio da faixa de areia na altura z (null fora da orla): do fim do calçadão (~12 m depois da avenida) até a água
  meioAreia(z) {
    const k = Math.round(z / 5) * 5;
    if (this.areia.has(k)) return this.areia.get(k);
    const ax = this.sharks?.avX?.(k);
    let r = null;
    if (ax != null) for (let x = ax + 12; x < ax + 220; x += 2) if (this.world.isWater(x, k)) { if (x - ax > 30) r = (ax + 14 + x - 4) / 2; break; }
    this.areia.set(k, r);
    return r;
  }

  get perto() {
    if (this.player.vehicle) return null;
    let best = null, bd = 4;
    for (const v of this.vend) { const d = Math.hypot(v.p.position.x - this.player.pos.x, v.p.position.z - this.player.pos.z); if (d < bd) { bd = d; best = v; } }
    return best;
  }

  get hint() { const v = this.perto; return v ? `B — comprar ${v.prod.nome} (R$ ${v.prod.preco})` : ''; }

  comprar() {
    const v = this.perto;
    if (!v) return false;
    if (!spend(v.prod.preco)) { this.hud.say(v.p, 'Tá liso, é? Fica pra próxima!', 2.5); return true; }
    this.hud.say(v.p, pick(VALEU), 2.5);
    this.hud.flash(`${v.prod.fim} −R$ ${v.prod.preco}`);
    conta('praia');
    return true;
  }

  update(dt, t, cam) {
    const zc = cam.z, xc = this.meioAreia(zc);
    const naOrla = xc != null && Math.abs(cam.x - xc) < 500;
    // longe da orla: todo mundo vai embora
    for (let i = this.vend.length - 1; i >= 0; i--) {
      const v = this.vend[i];
      if (!naOrla || Math.abs(v.p.position.z - zc) > TRECHO + 150) { this.scene.remove(v.p); this.hud.forget(v.p); for (const f of v.fum) this.scene.remove(f.m); this.vend.splice(i, 1); }
    }
    if (!naOrla) return;
    while (this.vend.length < N) if (!this.cria(zc + (Math.random() * 2 - 1) * TRECHO)) break;
    for (const v of this.vend) {
      const p = v.p, z = p.position.z + v.dir * 0.7 * dt, x = this.meioAreia(z);
      if (x == null) { v.dir = -v.dir; continue; }
      const xx = x + v.off;
      p.rotation.y = Math.atan2(xx - p.position.x, z - p.position.z);
      p.position.set(xx, this.world.groundY(xx, z), z);
      animatePerson(p, 0.7, dt);
      if ((v.virar -= dt) < 0) { v.dir = -v.dir; v.virar = 40 + Math.random() * 60; }
      // pregão quando o jogador passa perto
      const d = Math.hypot(p.position.x - this.player.pos.x, p.position.z - this.player.pos.z);
      if ((v.grito -= dt) < 0 && d < 30) { v.grito = 9 + Math.random() * 8; this.hud.say(p, pick(v.prod.fala), 3); }
      // fumaça do fogareiro do queijo coalho
      for (const f of v.fum) {
        f.t += dt; if (f.t > 2.2) { f.t = 0; f.m.position.copy(p.position).add(v.brasa); }
        f.m.position.y += dt * 0.55; f.m.position.x -= dt * 0.35; // o vento da praia vem do mar (leste) e leva a fumaça pra terra
        f.m.scale.setScalar(0.5 + f.t * 0.6);
      }
    }
  }

  cria(z) {
    const x = this.meioAreia(z);
    if (x == null) return false;
    const prod = pick(PRODUTOS), p = makePerson({ top: Math.random() < 0.5 ? 'regata' : 'camisa', bottom: 'bermuda', chinelo: true, hat: 'bone' });
    const v = { p, prod, dir: Math.random() < 0.5 ? 1 : -1, off: (Math.random() - 0.5) * 12, virar: 30 + Math.random() * 60, grito: Math.random() * 6, fum: [], brasa: new THREE.Vector3(0.35, 0.95, 0.3) };
    if (prod.tipo === 'brasa') { // fogareiro de lata com brasa e os espetos
      const lata = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.28, 10), new THREE.MeshStandardMaterial({ color: '#8a8f94', metalness: 0.6, roughness: 0.4 }));
      lata.position.set(0.35, 0.8, 0.3); p.add(lata);
      const brasa = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff4a00', emissiveIntensity: 1.4 }));
      brasa.position.set(0.35, 0.95, 0.3); p.add(brasa);
      for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(this.fumGeo, this.fumaca); this.scene.add(m); v.fum.push({ m, t: k * 0.55 }); }
    } else {
      const cor = prod.tipo === 'isopor' ? '#f4f4f0' : '#2a6fb5';
      const caixa = new THREE.Mesh(prod.tipo === 'isopor' ? new THREE.BoxGeometry(0.45, 0.3, 0.32) : new THREE.CylinderGeometry(0.16, 0.13, 0.26, 10), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6 }));
      caixa.position.set(0.35, 0.85, 0.15); p.add(caixa);
    }
    p.position.set(x + v.off, this.world.groundY(x, z), z);
    this.scene.add(p);
    this.vend.push(v);
    return true;
  }
}
