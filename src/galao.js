// Bico de entrega de galão de água em Casa Amarela. Na calçada perto do centro do bairro fica o "Depósito Água Boa",
// com a pilha de galões azuis e Seu Didi no balcão. A pé, B pega um galão de 20 litros no ombro e o GPS marca a casa
// da freguesa, a umas quadras dali. Com o galão você anda mais devagar e não corre. Chegando, a freguesa aparece na
// porta; B entrega (R$ 10 + até R$ 6 de gorjeta, quanto mais rápido melhor). Entrar em carro deixa o galão no chão;
// demorar demais faz a freguesa pedir noutro depósito.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { addMoney } from './save.js';
import { conta } from './trofeus.js';

const PAGA = 10, BONUS = 6, LENTO = 0.62;
const BAIRROS = ['Casa Amarela', 'Encruzilhada', 'Tamarineira', 'Torre'];
const NOMES = ['Dona Cida', 'Dona Socorro', 'Seu Zé Carlos', 'Dona Lourdes', 'Neide', 'Seu Bartolomeu', 'Dona Fátima', 'Rosinete'];
const CHEGOU = ['Graças a Deus! O filtro já tava seco.', 'Ô, meu filho, deixa aqui na cozinha mesmo.', 'Chegou rapidinho, visse! Toma.', 'Arretado! Já ia beber água da torneira.'];
const DIDI = ['Galão saindo! Cuidado na ladeira.', 'Leva esse que tá geladinho.', 'Vai, que a freguesa tá esperando!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
const AZUL = mat('#3b8fd9', { transparent: true, opacity: 0.85 }), TAMPA = mat('#1d4f91'), BALCAO = mat('#e9e4d8');

function galaoMesh() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 14), AZUL); g.add(c);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.1, 10), AZUL); o.position.y = 0.26; g.add(o);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), TAMPA); t.position.y = 0.33; g.add(t);
  return g;
}

function placa() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1d4f91'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#ffffff'; g.font = 'bold 50px sans-serif'; g.textAlign = 'center';
  g.fillText('ÁGUA BOA', 256, 70); g.font = 'bold 30px sans-serif'; g.fillStyle = '#9fd3ff'; g.fillText('galão 20 L · entrega', 256, 108);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t });
}

export class Galao {
  constructor({ scene, world, hud, player, traffic, gps }) {
    Object.assign(this, { scene, world, hud, player, traffic, gps });
    this.k = null; this.g = null; this.S = null; this.carga = null; this.freg = null;
    const B = BAIRROS.map((n) => world.data.bairros.find((b) => b.name === n)).find(Boolean);
    if (B && traffic.foot) {
      // ponto de calçada mais perto do centro do bairro (sempre o mesmo)
      for (const dx of [0, 30, -30, 60, -60]) {
        const n = traffic.nearestEdge(traffic.foot, B.x + dx, B.z); if (!n) continue;
        const p = traffic.pedPos(n.e, n.t);
        if (!p || world.blocked(p.x, p.z) || world.isWater(p.x, p.z)) continue;
        this.k = { x: p.x, z: p.z, bairro: B.name, e: n.e }; break;
      }
    }
  }

  get carregando() { return !!this.S; }
  get pertoDeposito() { if (!this.k || this.player.vehicle) return false; const P = this.player.pos; return Math.hypot(this.k.x - P.x, this.k.z - P.z) < 3.5; }
  get pertoFreguesa() { if (!this.S || this.player.vehicle) return false; const P = this.player.pos; return Math.hypot(this.S.x - P.x, this.S.z - P.z) < 3.5; }
  get hint() {
    if (this.player.vehicle) return '';
    if (this.pertoFreguesa) return `B — entregar o galão pra ${this.S.nome}`;
    if (!this.S && this.pertoDeposito) return 'B — pegar um galão de 20 L pra entregar';
    return '';
  }

  b() {
    if (this.player.vehicle) return false;
    if (this.pertoFreguesa) return this.entrega(), true;
    if (this.S || !this.pertoDeposito) return false;
    const dest = this.destino(); if (!dest) { this.hud.say(this.dono, 'Hoje ninguém pediu, não. Volta daqui a pouco!', 3); return true; }
    const d = Math.hypot(dest.x - this.k.x, dest.z - this.k.z);
    this.S = { ...dest, nome: pick(NOMES), t: Math.round(d / 2.2 + 45), t0: 0, total: 0 };
    this.S.total = this.S.t;
    this.poeGalao(true);
    this.hud.say(this.dono, pick(DIDI), 3);
    this.hud.banner('Bico: galão de água', `Leva o galão pra ${this.S.nome}${dest.street ? ', ' + dest.street : ''}. Com peso no ombro não dá pra correr.`, 4);
    this.gps?.setDest(dest.x, dest.z, `${this.S.nome} (galão)`);
    return true;
  }

  // casa da freguesa: calçada a 120–380 m do depósito
  destino() {
    for (let i = 0; i < 40; i++) {
      const e = this.traffic.randomEdge(this.traffic.foot, this.k.x, this.k.z, 120, 380);
      if (!e || e.len < 8) continue;
      const p = this.traffic.pedPos(e, e.len * (0.3 + Math.random() * 0.4));
      if (!p || this.world.blocked(p.x, p.z) || this.world.isWater(p.x, p.z)) continue;
      const d = Math.hypot(p.x - this.k.x, p.z - this.k.z); if (d < 100) continue;
      return { x: p.x, z: p.z, street: e.name ? (e.name.startsWith('Rua') || e.name.startsWith('Av') ? 'na ' : 'em ') + e.name : '' };
    }
    return null;
  }

  entrega() {
    const S = this.S, rapido = Math.max(0, S.t / S.total), gorjeta = Math.round(BONUS * rapido);
    addMoney(PAGA + gorjeta);
    conta('galao');
    if (this.freg) this.hud.say(this.freg, pick(CHEGOU), 3);
    this.hud.banner('Galão entregue!', `+R$ ${PAGA}${gorjeta ? ` e R$ ${gorjeta} de gorjeta por chegar ligeiro` : ''}. Tem mais no depósito.`, 4);
    this.fim(true);
  }

  fim(ok, msg) {
    if (!this.S) return;
    this.S = null; this.poeGalao(false);
    if (this.gps?.dest?.name?.includes('(galão)')) this.gps.clear();
    this.hud.objective(null);
    if (this.freg) { const f = this.freg; this.freg = null; setTimeout(() => { this.hud.forget(f); this.scene.remove(f); }, ok ? 3000 : 0); }
    if (!ok && msg) this.hud.banner('Entrega perdida', msg, 3.5);
  }

  poeGalao(on) {
    const m = this.player.mesh; if (!m) return;
    if (on && !this.carga) { this.carga = galaoMesh(); this.carga.position.set(0.2, 1.62, -0.02); this.carga.rotation.z = Math.PI / 2 + 0.25; }
    if (this.carga) { if (on) m.add(this.carga); else m.remove(this.carga); }
  }

  update(dt, t, cam) {
    this.deposito(cam);
    const S = this.S; if (!S) return;
    if (this.player.vehicle) { this.fim(false, 'O galão ficou no chão da calçada. Bico de galão é a pé, visse?'); return; }
    S.t -= dt;
    if (S.t <= 0) { this.fim(false, `${S.nome} cansou de esperar e pediu noutro depósito.`); return; }
    const P = this.player.pos, d = Math.hypot(S.x - P.x, S.z - P.z);
    // freguesa aparece na porta quando você chega perto
    if (!this.freg && d < 70) {
      const f = makePerson({ tipo: Math.random() < 0.7 ? 'mulher' : 'homem', shirt: pick(['#ff8fab', '#ffd60a', '#80ed99', '#90e0ef']), bottom: 'bermuda' });
      f.position.set(S.x, this.world.groundY(S.x, S.z), S.z); f.rotation.y = Math.atan2(P.x - S.x, P.z - S.z);
      this.scene.add(f); this.freg = f; this.hud.say(f, 'Aqui, moço da água!', 3);
    }
    if (this.freg) { this.freg.rotation.y = Math.atan2(P.x - S.x, P.z - S.z); const u = this.freg.userData; if (u.armR && d > 4) u.armR.rotation.x = -2.6 + Math.sin(t * 6) * 0.3; else if (u.armR) u.armR.rotation.x = 0; }
    const m = Math.floor(S.t / 60), s = Math.floor(S.t % 60);
    this.hud.objective(`Galão pra ${S.nome} · ${Math.round(d)} m · ${m}:${String(s).padStart(2, '0')}`);
  }

  deposito(cam) {
    if (!this.k) return;
    const d = Math.hypot(this.k.x - cam.x, this.k.z - cam.z);
    if (this.g && d > 260) { this.hud.forget(this.dono); this.scene.remove(this.g); this.g = null; this.world.ocupados = (this.world.ocupados || []).filter((o) => o[3] !== 'galao'); }
    if (this.g || d > 220) return;
    const { x, z, e } = this.k, W = this.world, y = W.groundY(x, z), g = new THREE.Group();
    g.position.set(x, y, z);
    // de costas pra rua: frente virada pro meio da pista
    const cx = e.a.x + e.dx * ((x - e.a.x) * e.dx + (z - e.a.z) * e.dz), cz = e.a.z + e.dz * ((x - e.a.x) * e.dx + (z - e.a.z) * e.dz);
    g.rotation.y = Math.atan2(cx - x, cz - z);
    const add = (o, px, py, pz) => { o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
    add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 0.6), BALCAO), 0, 0.48, -0.5);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.06), placa()), 0, 2.15, -0.95);
    for (const sx of [-1.05, 1.05]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), mat('#cfcfcf')), sx, 1.2, -0.95);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.6), mat('#1d4f91')), 0, 2.45, -0.4);
    // pilha de galões: 3 + 2 + 1
    let i = 0;
    for (const [n, yy] of [[3, 0.22], [2, 0.66], [1, 1.1]]) for (let j = 0; j < n; j++) { const q = galaoMesh(); q.position.set(-1.6 + (j - (n - 1) / 2) * 0.32, yy, -0.4); g.add(q); i++; }
    const dono = makePerson({ tipo: 'homem', shirt: '#1d4f91', bottom: 'bermuda', pants: '#5a5a5a', hat: 'bone' });
    dono.position.set(0, 0, -1.0); g.add(dono);
    (W.ocupados ||= []).push([x, z, 1.8, 'galao']);
    this.scene.add(g); this.g = g; this.dono = dono;
  }
}
