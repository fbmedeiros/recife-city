// Natal no Marco Zero (de 15 de novembro ao Dia de Reis, pela data do computador): árvore de Natal gigante de
// argolas verdes com luzinhas piscando e a estrela em cima, e um Papai Noel de roupa vermelha completa, suando no
// calor do Recife e se abanando com o gorro. A pé, perto dele, B tira foto com o Bom Velhinho (R$ 10) e faz um pedido.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { spend } from './save.js';
import { conta } from './trofeus.js';

const PRECO = 10, H = 16, R = 5.2;
const FALA = ['Ho ho ho! Que calor da gota!', 'Esse gorro é de lã, visse? Tô derretendo.', 'Alguém tem um picolé aí pro Papai Noel?', 'Ano que vem eu venho de bermuda.', 'As renas foram tomar banho em Boa Viagem.', 'Ho ho ho! Quem foi menino bom esse ano?'];
const PEDIDOS = [
  'um ar-condicionado que não pinga',
  'que a Agamenon não alague nunca mais',
  'um busão vazio às 18h',
  'que o Trio de Ferro ganhe tudo (os três, pra não brigar)',
  'uma vaga pra estacionar no Recife Antigo',
  'um dia de 25 graus, só unzinho',
  'bolo de rolo infinito',
  'que o vizinho baixe o som do paredão',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const mat = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...(e ? { emissive: c, emissiveIntensity: e } : {}) });
const CORES = ['#ff3b3b', '#ffd23f', '#3bceac', '#4d96ff', '#ff6bd6', '#ffffff'];

export function epocaDeNatal(d = new Date()) {
  const m = d.getMonth(), dia = d.getDate();
  return m === 11 || (m === 10 && dia >= 15) || (m === 0 && dia <= 6);
}

export class Natal {
  constructor({ scene, world, hud, player }) {
    Object.assign(this, { scene, world, hud, player });
    this.mz = world.pois.find((p) => p.name === 'Marco Zero') || null;
    this.forca = null; // true/false força a época (testes)
    this.g = null; this.sem = false; this.fotos = 0; this.falaT = 6;
  }

  get ativo() { return this.forca ?? epocaDeNatal(); }

  get perto() {
    if (!this.g || this.player.vehicle) return false;
    const P = this.player.pos; return Math.hypot(this.noel.x - P.x, this.noel.z - P.z) < 3.5;
  }
  get hint() { return this.perto ? `B — tirar foto com o Papai Noel e fazer um pedido (R$ ${PRECO})` : ''; }

  b() {
    if (!this.perto) return false;
    const n = this.noel.p;
    if (!spend(PRECO)) { this.hud.say(n, 'Ho ho ho! Sem dinheiro? Então só um abraço, visse?', 3); return true; }
    const pedido = pick(PEDIDOS);
    this.fotos++;
    this.pose = 2.5;
    this.hud.say(n, `Ho ho ho! Pediu ${pedido}? Vou ver com as renas.`, 4);
    this.hud.banner('Foto com o Papai Noel', `Pedido: ${pedido}. −R$ ${PRECO}`, 4);
    conta('noel');
    return true;
  }

  update(dt, t, cam) {
    if (!this.mz || this.sem) return;
    const d = Math.hypot(this.mz.x - cam.x, this.mz.z - cam.z);
    if (this.g && (d > 320 || !this.ativo)) this.desmonta();
    if (!this.g && (d > 280 || !this.ativo)) return;
    if (!this.g && !this.monta()) return;
    // luzinhas piscando em três grupos alternados
    const k = Math.floor(t * 2.5);
    this.luzes.forEach((m, i) => { m.emissiveIntensity = (k + i) % 3 === 0 ? 0.15 : 1.4; });
    this.estrela.rotation.y = t * 0.8;
    // Papai Noel se abanando com o gorro (ou fazendo pose pra foto)
    const u = this.noel.p.userData;
    if (this.pose > 0) { this.pose -= dt; u.armR.rotation.x = -2.6; u.armL.rotation.x = -2.6; u.armR.rotation.z = 0.3; u.armL.rotation.z = -0.3; }
    else { u.armL.rotation.x = 0; u.armL.rotation.z = 0; u.armR.rotation.z = 0; u.armR.rotation.x = -1.6 + Math.sin(t * 9) * 0.35; if (u.elbowR) u.elbowR.rotation.x = -1.0; }
    const P = this.player.pos;
    if ((this.falaT -= dt) <= 0) { this.falaT = 9 + Math.random() * 6; if (Math.hypot(this.noel.x - P.x, this.noel.z - P.z) < 25) this.hud.say(this.noel.p, pick(FALA), 3); }
  }

  monta() {
    const W = this.world, livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z) && !(W.ocupados || []).some(([ox, oz, r, key]) => key !== 'natal' && Math.hypot(ox - x, oz - z) < r + 1);
    let at = null;
    for (let r = 18; r < 120 && !at; r += 3) for (let a = 0; a < 6.28 && !at; a += 0.2) {
      const x = this.mz.x + Math.cos(a) * r, z = this.mz.z + Math.sin(a) * r;
      let ok = true;
      for (let i = 0; i < 12 && ok; i++) for (const rr of [0, 3.5, R + 1.5]) { const b = (i / 12) * 6.28; if (!livre(x + Math.cos(b) * rr, z + Math.sin(b) * rr)) { ok = false; break; } }
      if (ok) at = [x, z];
    }
    if (!at) { this.sem = true; return false; }
    const [x, z] = at, y = W.groundY(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); g.add(o); return o; };
    // base vermelha e tronco
    add(new THREE.CylinderGeometry(R * 0.55, R * 0.6, 0.8, 20), mat('#b3001b'), 0, 0.4, 0);
    add(new THREE.CylinderGeometry(0.5, 0.6, 2, 10), mat('#5a3a1e'), 0, 1.6, 0);
    // argolas verdes empilhadas, cada vez menores
    const VERDE = mat('#1f7a3a'), N = 9;
    this.luzes = [0, 1, 2].map((i) => mat(CORES[i * 2], 1.2));
    const extra = [mat(CORES[1], 1.2), mat(CORES[3], 1.2), mat(CORES[5], 1.2)];
    const bola = new THREE.SphereGeometry(0.13, 6, 5);
    for (let i = 0; i < N; i++) {
      const f = 1 - i / N, rr = R * f, yy = 2.4 + i * ((H - 3.5) / N);
      const c = add(new THREE.ConeGeometry(rr, (H - 3.5) / N + 1.0, 18, 1, true), VERDE, 0, yy + 0.5, 0); c.material.side = THREE.DoubleSide; c.castShadow = true;
      const n = Math.max(6, Math.round(rr * 4));
      for (let j = 0; j < n; j++) {
        const b = (j / n) * 6.28 + i * 0.4, m = (j + i) % 2 ? this.luzes[(j + i) % 3] : extra[(j + i) % 3];
        add(bola, m, Math.cos(b) * rr * 0.98, yy, Math.sin(b) * rr * 0.98);
      }
    }
    this.luzes.push(...extra);
    // estrela no topo
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28 + Math.PI / 2, r = i % 2 ? 0.45 : 1.1; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    this.estrela = add(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }), mat('#ffd23f', 1.0), 0, H + 0.4, 0);
    // presentes no pé
    for (let i = 0; i < 7; i++) { const b = i * 0.9 + 0.3, r = R * 0.62 + (i % 2) * 0.5, sz = 0.5 + (i % 3) * 0.2; const p = add(new THREE.BoxGeometry(sz, sz, sz), mat(CORES[i % CORES.length]), Math.cos(b) * r, sz / 2, Math.sin(b) * r); p.rotation.y = i; }
    // Papai Noel na frente da árvore, virado pra fora (pro lado do Marco Zero)
    const fora = Math.atan2(this.mz.x - x, this.mz.z - z);
    const nx = x + Math.sin(fora) * (R + 1.2), nz = z + Math.cos(fora) * (R + 1.2);
    const p = makePerson({ tipo: 'homem', shirt: '#c1121f', pants: '#c1121f', longSleeve: true, bottom: 'calca', shoes: '#111111' });
    p.position.set(nx - x, 0, nz - z); p.rotation.y = fora; p.userData.semCorpo = true; g.add(p);
    const cab = p.userData.head || p.userData.upper || p;
    const barba = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.1), mat('#f6f6f6')); barba.position.set(0, -0.1, 0.09); cab.add(barba);
    const gorro = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 10), mat('#c1121f')); gorro.position.set(0, 0.24, -0.02); gorro.rotation.x = -0.35; cab.add(gorro);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#f6f6f6')); pom.position.set(0, 0.42, -0.1); cab.add(pom);
    const cinto = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.26), mat('#111111')); cinto.position.set(0, 0.98, 0); p.add(cinto);
    this.noel = { p, x: nx, z: nz };
    (W.ocupados ||= []).push([x, z, R + 1, 'natal']);
    this.scene.add(g); this.g = g; this.c = [x, z];
    return true;
  }

  desmonta() {
    if (!this.g) return;
    this.hud.forget(this.noel.p); this.scene.remove(this.g); this.g = null;
    this.world.ocupados = (this.world.ocupados || []).filter((o) => o[3] !== 'natal');
  }
}
