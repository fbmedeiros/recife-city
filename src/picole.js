// Bico de picolé na praia de Boa Viagem. Na areia, perto da câmera, tem guarda-sol colorido com banhista sentado na
// canga (sempre os mesmos em cada trecho). No calçadão, uns 250 m ao sul da Dona Lindu, fica o quiosque "Picolé
// Arretado": a pé, B pega o isopor com 12 picolés. Andando pela areia, banhista levanta a mão e grita "Ô do picolé!";
// perto dele, B vende (R$ 4, às vezes com gorjeta). Sem freguês perto, B grita o pregão e chama quem está em volta.
// Em 4 minutos o resto derrete; entrar em carro ou sair da praia larga o isopor.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { addMoney } from './save.js';
import { conta } from './trofeus.js';

const N = 12, PRECO = 4, TEMPO = 240, PASSO = 14, RAIO = 260;
const SABORES = ['coco', 'graviola', 'cajá', 'tapioca', 'milho verde', 'maracujá', 'umbu', 'açaí'];
const CHAMA = ['Ô do picolé!', 'Ei, picolé! Aqui!', 'Moço do picolé, vem cá!', 'Picolé! Picolé!'];
const OBRIGADO = ['Salvou do calor, visse!', 'Arretado! Tava precisando.', 'Geladinho, do jeito que eu gosto.', 'Valeu! Bom trabalho aí.'];
const PREGAO = ['Olha o picolé! Coco, graviola, cajá!', 'Picolé geladinho, quatro real!', 'Olha o picolé, freguesia!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const CORES = ['#e63946', '#f4a261', '#2a9d8f', '#ffd166', '#4361ee', '#f72585', '#06d6a0'];
const CANGAS = ['#ff8fab', '#80ed99', '#ffd60a', '#90e0ef', '#c77dff', '#ff9f1c'];
const TOPS = ['#e63946', '#1d3557', '#ffb703', '#2a9d8f', '#f72585', '#ffffff', '#3a86ff'];
// sorteio fixo por trecho (o mesmo guarda-sol volta sempre no mesmo lugar)
const rnd = (k, i) => { const s = Math.sin(k * 12.9898 + i * 78.233) * 43758.5453; return s - Math.floor(s); };
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
const ISO = mat('#f4f7fb'), TAMPA = mat('#2a6fb5'), MASTRO = mat('#d9d9d9');

function placa() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#2a6fb5'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#ffd166'; g.font = 'bold 60px sans-serif'; g.textAlign = 'center';
  g.fillText('PICOLÉ ARRETADO', 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t });
}

export class Picole {
  constructor({ scene, world, hud, player, praia, corrida, sharks }) {
    Object.assign(this, { scene, world, hud, player, praia, corrida, sharks });
    this.slots = new Map(); // chave do trecho → { g, gente: [{ p, k, servido }] }
    this.servidos = new Set();
    this.q = null; this.S = null; this.box = null; this.fora = 0;
    const L = world.pois.find((q) => q.name === 'Dona Lindu');
    for (const dz of [250, -600, 600]) {
      const z = L ? L.z + dz : null;
      if (z == null || sharks?.avX?.(z) == null || praia.meioAreia(z) == null) continue;
      const x = corrida?.lane?.(z); if (x == null) continue;
      this.k = { x, z }; break;
    }
  }

  get vendendo() { return !!this.S; }
  get pertoQuiosque() { if (!this.k || !this.q || this.player.vehicle) return false; const P = this.player.pos; return Math.hypot(this.k.x - P.x, this.k.z - P.z) < 4; }
  freguesPerto() {
    if (!this.S || this.player.vehicle) return null;
    const P = this.player.pos; let best = null, bd = 3.2;
    for (const s of this.slots.values()) for (const b of s.gente) if (b.chamando) { const d = Math.hypot(b.x - P.x, b.z - P.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  get perto() { return this.pertoQuiosque || !!(this.S && !this.player.vehicle); }

  get hint() {
    if (this.player.vehicle) return '';
    if (this.S) { const f = this.freguesPerto(); return f ? `B — vender um picolé (R$ ${PRECO})` : 'B — gritar o pregão'; }
    if (this.pertoQuiosque) return `B — pegar o isopor com ${N} picolés pra vender na areia`;
    return '';
  }

  b() {
    if (this.player.vehicle) return false;
    if (this.S) {
      const f = this.freguesPerto();
      if (f) return this.vende(f), true;
      this.grita(); return true;
    }
    if (!this.pertoQuiosque) return false;
    this.S = { resta: N, vendidos: 0, ganho: 0, t: TEMPO };
    this.fora = 0;
    this.hud.say(this.dono, 'Toma o isopor! Vende tudo antes de derreter, visse?', 3);
    this.hud.banner('Bico: picolé na areia', `${N} picolés, R$ ${PRECO} cada. Banhista que levantar a mão quer comprar.`, 4);
    this.poeIsopor(true);
    return true;
  }

  vende(f) {
    const S = this.S, sabor = pick(SABORES), gorjeta = Math.random() < 0.3 ? 2 : 0;
    f.chamando = false; f.servido = true; this.servidos.add(f.k); this.braco(f, false);
    S.resta--; S.vendidos++; S.ganho += PRECO + gorjeta;
    addMoney(PRECO + gorjeta);
    conta('picole_venda');
    this.hud.say(f.p, `Picolé de ${sabor}! ${pick(OBRIGADO)}${gorjeta ? ' Fica com o troco.' : ''}`, 2.5);
    this.hud.flash(`Vendeu picolé de ${sabor}: +R$ ${PRECO + gorjeta}${gorjeta ? ' (com gorjeta)' : ''}`);
    if (S.resta <= 0) this.fim('tudo');
  }

  grita() {
    this.hud.say(this.player.mesh, pick(PREGAO), 2);
    const P = this.player.pos; let n = 0;
    for (const s of this.slots.values()) for (const b of s.gente) if (!b.servido && !b.chamando && n < 2 && Math.hypot(b.x - P.x, b.z - P.z) < 28 && Math.random() < 0.6) { this.chama(b); n++; }
  }

  chama(b) { b.chamando = true; this.braco(b, true); this.hud.say(b.p, pick(CHAMA), 3); }
  braco(b, on) { const u = b.p.userData; if (!u.armR) return; u.armR.rotation.x = on ? -2.9 : -0.3; if (u.elbowR) u.elbowR.rotation.x = on ? -0.2 : -0.6; }

  fim(como) {
    const S = this.S; if (!S) return;
    this.S = null; this.poeIsopor(false);
    for (const s of this.slots.values()) for (const b of s.gente) if (b.chamando) { b.chamando = false; this.braco(b, false); this.hud.forget(b.p); }
    this.hud.objective(null);
    if (como === 'tudo') { conta('picole'); this.hud.banner('Vendeu o isopor todinho!', `${S.vendidos} picolés, R$ ${S.ganho} no bolso.`, 4); }
    else if (como === 'derreteu') this.hud.banner('O resto derreteu!', `Picolé de cajá virou suco. Vendeu ${S.vendidos}, R$ ${S.ganho} no bolso.`, 4);
    else this.hud.banner('Largou o isopor', `Vendeu ${S.vendidos} picolés, R$ ${S.ganho} no bolso.`, 3.5);
  }

  poeIsopor(on) {
    const m = this.player.mesh; if (!m) return;
    if (on && !this.box) {
      const g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.28), ISO); g.add(c);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.3), TAMPA); t.position.y = 0.17; g.add(t);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.03), TAMPA); a.position.set(-0.1, 0.45, 0); a.rotation.z = 0.5; g.add(a);
      g.position.set(0.36, 0.82, 0.05);
      this.box = g;
    }
    if (this.box) { if (on) m.add(this.box); else m.remove(this.box); }
  }

  update(dt, t, cam) {
    this.areia(cam);
    this.quiosque(cam);
    const S = this.S; if (!S) return;
    S.t -= dt;
    const P = this.player.pos, mz = this.praia.meioAreia(P.z);
    const naPraia = !this.player.vehicle && mz != null && Math.abs(P.x - mz) < 130;
    this.fora = naPraia ? 0 : this.fora + dt;
    if (this.player.vehicle || this.fora > 12) { this.fim('largou'); return; }
    if (S.t <= 0) { this.fim('derreteu'); return; }
    // de vez em quando um banhista perto chama sozinho
    S.prox = (S.prox ?? 3) - dt;
    if (S.prox <= 0) {
      S.prox = 4 + Math.random() * 4;
      const cand = [];
      for (const s of this.slots.values()) for (const b of s.gente) if (!b.servido && !b.chamando) { const d = Math.hypot(b.x - P.x, b.z - P.z); if (d < 40) cand.push(b); }
      if (cand.length && [...this.slots.values()].flatMap((s) => s.gente).filter((b) => b.chamando).length < 3) this.chama(pick(cand));
    }
    const m = Math.floor(Math.max(0, S.t) / 60), s = Math.floor(Math.max(0, S.t) % 60);
    this.hud.objective(`Picolés: ${S.resta} no isopor · R$ ${S.ganho} · derrete em ${m}:${String(s).padStart(2, '0')}`);
  }

  // guarda-sóis com banhista: trechos de PASSO m em volta da câmera, montados e desmontados conforme ela anda
  areia(cam) {
    const mc = this.praia.meioAreia(cam.z), longe = mc == null || Math.abs(cam.x - mc) > 320;
    const quer = new Set();
    if (!longe) for (let z = Math.floor((cam.z - RAIO) / PASSO) * PASSO; z <= cam.z + RAIO; z += PASSO) quer.add(z);
    for (const [k, s] of this.slots) if (!quer.has(k)) { for (const b of s.gente) this.hud.forget(b.p); this.scene.remove(s.g); this.slots.delete(k); if (this.S) for (const b of s.gente) b.chamando = false; }
    let novos = 0;
    for (const k of quer) { if (this.slots.has(k)) continue; if (novos++ > 4) break; this.slots.set(k, this.monta(k)); }
  }

  monta(k) {
    const g = new THREE.Group(), gente = [], W = this.world;
    const ax = this.sharks.avX(k), m = this.praia.meioAreia(k);
    if (ax == null || m == null) return { g, gente };
    const meia = m - (ax + 14), n = rnd(k, 0) < 0.25 ? 0 : rnd(k, 1) < 0.55 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const x = m + (rnd(k, 2 + i) - 0.5) * 1.3 * meia, z = k + (rnd(k, 5 + i) - 0.5) * PASSO * 0.7;
      if (W.isWater(x, z) || W.isWater(x + 3, z) || W.blocked(x, z)) continue;
      if (Math.hypot(x - (this.k?.x ?? 1e9), z - (this.k?.z ?? 1e9)) < 6) continue;
      if (gente.some((o) => Math.hypot(o.x - x, o.z - z) < 4.5)) continue;
      const y = W.groundY(x, z), q = new THREE.Group(); q.position.set(x, y, z); q.rotation.y = Math.PI / 2 + (rnd(k, 8 + i) - 0.5) * 0.8; g.add(q);
      const cor = CORES[Math.floor(rnd(k, 11 + i) * CORES.length)];
      const pau = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), MASTRO); pau.position.set(-1.05, 1.15, -0.3); pau.rotation.z = 0.12; q.add(pau);
      const sol = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.45, 10, 1, true), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, side: THREE.DoubleSide })); sol.position.set(-1.2, 2.3, -0.3); sol.rotation.z = 0.12; sol.castShadow = true; q.add(sol);
      const canga = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.01, 1.7), mat(CANGAS[Math.floor(rnd(k, 14 + i) * CANGAS.length)])); canga.position.set(0, 0.01, 0.3); q.add(canga);
      const fem = rnd(k, 17 + i) < 0.5, top = TOPS[Math.floor(rnd(k, 20 + i) * TOPS.length)];
      const p = makePerson(fem ? { tipo: 'mulher', top: 'regata', shirt: top, bottom: 'bermuda', pants: top } : { tipo: 'homem', top: 'regata', shirt: top, bottom: 'bermuda', pants: TOPS[Math.floor(rnd(k, 23 + i) * TOPS.length)] });
      // sentado na canga, pernas esticadas pra frente (pro mar)
      p.position.set(0, -0.8, -0.1); const u = p.userData;
      if (u.legL) { u.legL.rotation.x = -1.45; u.legR.rotation.x = -1.4; u.kneeL.rotation.x = 0.1; u.kneeR.rotation.x = 0.15; }
      if (u.armL) { u.armL.rotation.x = 0.5; u.armR.rotation.x = -0.3; }
      q.add(p);
      const b = { p, x, z, k: k + ':' + i, servido: this.servidos.has(k + ':' + i), chamando: false };
      gente.push(b);
    }
    this.scene.add(g);
    return { g, gente };
  }

  quiosque(cam) {
    if (!this.k) return;
    const d = Math.hypot(this.k.x - cam.x, this.k.z - cam.z);
    if (this.q && d > 260) { this.hud.forget(this.dono); this.scene.remove(this.q); this.q = null; this.world.ocupados = (this.world.ocupados || []).filter((o) => o[3] !== 'picole'); }
    if (this.q || d > 220) return;
    const { x, z } = this.k, W = this.world, y = W.groundY(x, z), g = new THREE.Group(), ax = this.sharks.avX(z);
    g.position.set(x, y, z); g.rotation.y = ax != null && ax < x ? -Math.PI / 2 : Math.PI / 2; // frente pra avenida
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
    add(new THREE.BoxGeometry(2.2, 1.0, 1.0), ISO, 0, 0.5, 0.6);              // balcão-freezer
    add(new THREE.BoxGeometry(2.3, 0.08, 1.1), TAMPA, 0, 1.04, 0.6);          // tampa
    for (const sx of [-1.05, 1.05]) add(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), MASTRO, sx, 1.25, 1.05);
    add(new THREE.BoxGeometry(2.6, 0.1, 1.8), mat('#ffd166'), 0, 2.5, 0.4);   // toldo
    add(new THREE.BoxGeometry(2.4, 0.5, 0.05), placa(), 0, 2.2, 1.12);        // letreiro
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.4, 0.3, 0.28), ISO, -0.8 + i * 0.5, 1.23, 0.4); // isopores
    const dono = makePerson({ tipo: 'homem', shirt: '#ffd166', bottom: 'bermuda', pants: '#2a6fb5', hat: 'bone' });
    dono.position.set(0, 0, -0.1); g.add(dono);
    (W.ocupados ||= []).push([x, z, 2, 'picole']);
    this.scene.add(g); this.q = g; this.dono = dono;
  }
}
