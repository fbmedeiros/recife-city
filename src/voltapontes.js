// Volta das Pontes: desafio contra o relógio pelas pontes do Centro (Maurício de Nassau, Buarque de Macedo, Santa
// Isabel, Boa Vista, Duarte Coelho, Princesa Isabel, Giratória, 12 de Setembro — as que existirem no mapa). Largada
// no Marco Zero (marca azul): de carro ou moto, parado nela, B começa. Passa por cada ponte na ordem (a marca azul
// mostra a próxima, raio de 14 m) e volta pro Marco Zero. O tempo vale recorde no save; a primeira volta paga
// R$ 50, bater o recorde paga R$ 20, e abaixo do tempo de ouro dá troféu.
import * as THREE from 'three';
import { save, addMoney, persist } from './save.js';
import { conta } from './trofeus.js';

const PONTES = [/^Ponte Maurício de Nassau$/, /^Ponte Buarque de Macedo$/, /^Ponte Santa Isabel$/, /^Ponte da Boa Vista$/, /^Ponte Duarte Coelho$/, /^Ponte Princesa Isabel$/, /^Ponte Giratória$/, /^Ponte 12 de Setembro$/];
const R = 14;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')},${Math.floor((s % 1) * 10)}`;

export class VoltaPontes {
  constructor({ scene, world, hud, player, missions }) {
    Object.assign(this, { scene, world, hud, player, missions });
    const mz = world.pois.find((p) => p.name === 'Marco Zero');
    const ps = PONTES.map((re) => world.pois.find((q) => re.test(q.name))).filter(Boolean);
    this.ok = !!mz && ps.length >= 3;
    if (!this.ok) return;
    // largada na rua mais perto do Marco Zero (onde dá pra parar o carro)
    this.largada = this.naRua(mz.x, mz.z);
    // ordem: vizinho mais perto a partir da largada
    const rota = [], resto = ps.map((p) => ({ x: p.x, z: p.z, nome: p.name }));
    let cur = this.largada;
    while (resto.length) { let bi = 0, bd = Infinity; resto.forEach((p, i) => { const d = Math.hypot(p.x - cur.x, p.z - cur.z); if (d < bd) { bd = d; bi = i; } }); cur = resto.splice(bi, 1)[0]; rota.push(cur); }
    this.rota = [...rota, { ...this.largada, nome: 'Marco Zero (chegada)' }];
    this.dist = this.rota.reduce((s, p, i) => s + Math.hypot(p.x - (i ? this.rota[i - 1].x : this.largada.x), p.z - (i ? this.rota[i - 1].z : this.largada.z)), 0);
    this.ouro = Math.round(this.dist / 11 + 15); // ~40 km/h de média, com folga pros sinais
    this.marca = marcador();
    this.marca.position.set(this.largada.x, this.world.groundY(this.largada.x, this.largada.z), this.largada.z);
    scene.add(this.marca);
    this.corrida = null;
    save.voltaPontes ||= { recorde: null, voltas: 0 };
  }

  naRua(x, z) {
    const W = this.world;
    for (let r = 0; r < 120; r += 3) for (let a = 0; a < 6.28; a += 0.3) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (W.isDrive(px, pz) && !W.isWater(px, pz)) return { x: px, z: pz }; }
    return { x, z };
  }

  recordeTxt() { const r = save.voltaPontes?.recorde; return r ? fmt(r) : ''; }

  get noVeiculo() { const v = this.player.vehicle; return v && !v.boat ? v : null; }

  get hint() {
    if (!this.ok || this.corrida || this.missions?.active || !this.noVeiculo) return '';
    const L = this.largada, P = this.player.pos;
    if (Math.hypot(L.x - P.x, L.z - P.z) > R) return '';
    const rec = save.voltaPontes.recorde;
    return `B — Volta das Pontes (${this.rota.length - 1} pontes${rec ? ', recorde ' + fmt(rec) : ''})`;
  }

  comeca() {
    if (!this.hint) return false;
    this.corrida = { i: 0, t: 0 };
    this.hud.banner('Volta das Pontes', `Passa pelas ${this.rota.length - 1} pontes e volta pro Marco Zero. Valendo!`, 3);
    this.aponta();
    return true;
  }

  aponta() {
    const p = this.rota[this.corrida.i];
    this.marca.position.set(p.x, this.world.groundY(p.x, p.z), p.z);
    this.hud.target = { x: p.x, z: p.z };
  }

  cancela(msg) {
    if (!this.corrida) return;
    this.corrida = null; this.hud.target = null; this.hud.objective(null);
    this.marca.position.set(this.largada.x, this.world.groundY(this.largada.x, this.largada.z), this.largada.z);
    if (msg) this.hud.flash(msg);
  }

  update(dt, t) {
    if (!this.ok) return;
    this.marca.userData.ring.rotation.y += dt;
    this.marca.userData.beam.material.opacity = 0.2 + Math.sin(t * 4) * 0.07;
    const C = this.corrida;
    // a marca de largada só aparece de carro, sem bico rolando
    this.marca.visible = !!C || (!!this.noVeiculo && !this.missions?.active);
    if (!C) return;
    if (!this.noVeiculo) return this.cancela('Saiu do carro: a Volta das Pontes foi cancelada.');
    if (this.missions?.active) return this.cancela();
    C.t += dt;
    const p = this.rota[C.i], P = this.player.pos, d = Math.hypot(p.x - P.x, p.z - P.z);
    if (C.t > 600) return this.cancela('Demorou demais: a Volta das Pontes foi cancelada.');
    if (d < R) {
      C.i++;
      if (C.i >= this.rota.length) return this.chega(C.t);
      this.hud.flash(`${p.nome} ✓  ${fmt(C.t)}`);
      this.aponta();
    }
    const q = this.rota[C.i];
    this.hud.objective(`Volta das Pontes ${Math.min(C.i + 1, this.rota.length - 1)}/${this.rota.length - 1} · ${q.nome} · ⏱ ${fmt(C.t)}`, null, Math.hypot(q.x - P.x, q.z - P.z));
  }

  chega(t) {
    const S = save.voltaPontes, ant = S.recorde, primeira = !S.voltas;
    S.voltas++;
    let premio = 0, msg = `Tempo: ${fmt(t)}`;
    if (primeira) premio += 50;
    if (ant == null || t < ant) { S.recorde = t; if (ant != null) { premio += 20; msg += ` — recorde novo! (era ${fmt(ant)})`; } }
    else msg += ` — recorde: ${fmt(ant)}`;
    if (premio) addMoney(premio);
    persist();
    this.cancela();
    this.hud.banner('Chegou no Marco Zero!', msg + (premio ? ` · +R$ ${premio}` : ''), 4);
    conta('volta_pontes');
    if (t <= this.ouro) conta('volta_pontes_ouro');
    this.ultimo = t;
  }
}

function marcador() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 70, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.y = 35;
  const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.9, R, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4cc9f0', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
  ring.position.y = 0.25;
  g.add(beam, ring); g.userData = { beam, ring }; g.renderOrder = 5; g.visible = false;
  return g;
}
