// Corrida da Orla: de manhã (6h às 10h), no calçadão de Boa Viagem, a largada fica no Parque Dona Lindu com o
// pórtico inflável e os corredores numerados esperando. A pé, B na largada faz a inscrição (R$ 10) e a corrida sai
// depois da contagem: 2 km pelo calçadão rumo ao norte, com mesa de água no meio do caminho e a chegada lá na
// frente. Correr (Shift) é 8 m/s; os mais rápidos do pelotão andam quase isso. Chegou: posição, tempo e prêmio
// pros três primeiros. Uma corrida por dia; sair da orla ou pegar carro desclassifica. A corrida é inventada.
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { save, spend, addMoney, persist } from './save.js';
import { conta } from './trofeus.js';

const DIST = 2000, N = 14, INSCRICAO = 10, PREMIO = [150, 80, 50];
const INICIO = 6, FIM = 10;
const CORES = ['#ff5d8f', '#2ec4b6', '#ffd166', '#118ab2', '#ef476f', '#8ac926', '#f77f00', '#6a4c93', '#e9ecef', '#1982c4'];
const TORCIDA = ['Vai, vai, vai!', 'Bora que tá chegando!', 'Força, meu rei!', 'Água aqui, água!', 'Corre, visse!', 'Tá voando, boy!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const tempo = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const tex = (txt, fundo, cor, w = 512, h = 96, f = 60) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = fundo; g.fillRect(0, 0, w, h); g.fillStyle = cor; g.font = `bold ${f}px sans-serif`; g.textAlign = 'center'; g.fillText(txt, w / 2, h * 0.7); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const MESA = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.6 });
const COPO = new THREE.MeshStandardMaterial({ color: '#d8eef7', roughness: 0.2, transparent: true, opacity: 0.8 });

export class Corrida {
  constructor({ scene, world, hud, player, day, sharks }) {
    Object.assign(this, { scene, world, hud, player, day, sharks });
    this.faixa = new Map();
    const L = world.pois.find((q) => q.name === 'Dona Lindu');
    const z0 = L ? L.z : null;
    this.ok = z0 != null && sharks?.avX?.(z0) != null && sharks.avX(z0 - DIST) != null && this.lane(z0) != null && this.lane(z0 - DIST) != null;
    if (this.ok) { this.z0 = z0; this.z1 = z0 - DIST; this.largada = { x: this.lane(z0), z: z0 }; this.chegada = { x: this.lane(this.z1), z: this.z1 }; }
    this.g = null; this.estado = null; this.feitaHoje = false; this.h0 = day.hours;
  }

  // x do meio do calçadão na altura z (entre a avenida e a areia), em cache
  lane(z) {
    const k = Math.round(z / 10) * 10;
    if (this.faixa.has(k)) return this.faixa.get(k);
    const W = this.world, ax = this.sharks.avX(k);
    let r = null;
    // fim da pista (e da ciclofaixa) saindo da avenida pro mar; o meio do calçadão fica uns 5 m depois
    let borda = null; if (ax != null) for (let x = ax; x < ax + 40; x += 0.5) if (!W.isDrive(x, k)) { borda = x; break; }
    if (borda != null) for (const o of [5, 4, 6, 3, 7, 2]) { const x = borda + o; if (!W.blocked(x, k) && !W.isWater(x, k) && !W.isDrive(x, k)) { r = x; break; } }
    if (r == null && ax != null) r = ax + 8;
    this.faixa.set(k, r);
    return r;
  }
  laneAt(z) { const a = Math.floor(z / 10) * 10, b = a + 10, t = (z - a) / 10; return this.lane(a) * (1 - t) + this.lane(b) * t; }

  get janela() { const h = this.day.hours; return h >= INICIO && h < FIM; }
  get ativa() { return this.estado === 'conta' || this.estado === 'corre'; }

  get perto() {
    if (!this.ok || !this.g || this.player.vehicle || this.ativa) return false;
    const P = this.player.pos; return Math.hypot(this.largada.x - P.x, this.largada.z - P.z) < 8;
  }

  get hint() {
    if (this.ativa) return '';
    if (!this.perto) return '';
    if (this.feitaHoje) return 'Corrida da Orla: a de hoje já foi. Amanhã cedo tem outra!';
    return `B — se inscrever na Corrida da Orla, 2 km (R$ ${INSCRICAO})`;
  }

  b() {
    if (!this.perto) return false;
    if (this.feitaHoje) { this.hud.flash('A Corrida da Orla de hoje já foi. Volta amanhã de manhã!'); return true; }
    if (!spend(INSCRICAO)) { this.hud.flash(`Inscrição é R$ ${INSCRICAO}. Faz um bico e volta!`); return true; }
    const P = this.player.pos;
    P.x = this.largada.x; P.z = this.largada.z + 2; // na linha, atrás do pórtico
    this.estado = 'conta'; this.t = 0; this.cont = 4;
    this.hud.banner('Corrida da Orla', 'Peito nº 1. Segura Shift pra correr. Chegada a 2 km, rumo ao norte!', 3);
    return true;
  }

  // posição atual do jogador no pelotão
  posicao() { const pz = this.player.pos.z; return 1 + this.rs.filter((r) => r.z < pz || r.chegou).length; }

  update(dt, t, cam) {
    if (!this.ok) return;
    const h = this.day.hours;
    if (h + 1 < this.h0) this.feitaHoje = false; // virou o dia
    this.h0 = h;
    const P = this.player.pos;
    const dc = Math.min(Math.hypot(this.largada.x - cam.x, this.largada.z - cam.z), Math.hypot(this.chegada.x - cam.x, this.chegada.z - cam.z));
    if (!this.ativa) {
      if (this.g && (dc > 450 || (!this.janela && this.estado !== 'fim'))) this.desmonta();
      if (this.estado === 'fim' && (this.t += dt) > 40) { this.estado = null; if (dc > 150 || !this.janela) this.desmonta(); }
      if (!this.g && this.janela && dc < 300) this.monta();
      if (!this.g) return;
    }
    if (this.estado === 'conta') {
      this.t += dt;
      const n = Math.ceil(this.cont - this.t);
      if (n !== this.ult) { this.ult = n; this.hud.objective(n > 0 ? `🏁 Corrida da Orla: ${n}...` : '🏁 VAI!'); }
      P.z = Math.max(P.z, this.z0 - 0.5); // ninguém queima a largada
      if (this.t >= this.cont) { this.estado = 'corre'; this.t = 0; this.hud.flash('Largou! Bora, bora!'); }
    } else if (this.estado === 'corre') {
      this.t += dt;
      const falta = Math.max(0, P.z - this.z1), pos = this.posicao();
      this.hud.objective(`🏃 Corrida da Orla · ${pos}º de ${N + 1} · ${tempo(this.t)}`, null, falta);
      const fora = Math.abs(P.x - this.laneAt(Math.min(this.z0, Math.max(this.z1, P.z)))) > 70 || P.z > this.z0 + 60;
      if (this.player.vehicle || fora || this.t > 900) this.acaba(null);
      else if (P.z <= this.z1) this.acaba(pos);
    }
    // corredores
    for (const r of this.rs) {
      let v = 0;
      if (this.estado === 'corre' && !r.chegou) {
        v = r.v * (1 + Math.sin(this.t * 0.07 + r.ph) * 0.05) * Math.min(1, 0.4 + this.t * 0.3);
        r.z -= v * dt;
        if (r.z <= this.z1) { r.chegou = true; r.tf = this.t; }
      } else if (r.chegou && r.z > this.z1 - 25) { v = 1.3; r.z -= v * dt; }
      const x = this.laneAt(Math.min(this.z0 + 5, Math.max(this.z1 - 30, r.z))) + r.lat;
      r.p.position.set(x, this.world.groundY(x, r.z), r.z);
      r.p.rotation.y = Math.PI;
      animatePerson(r.p, v, dt);
    }
    // torcida e mesa de água
    if ((this.fala -= dt) <= 0) {
      this.fala = 4 + Math.random() * 4;
      if (this.estado === 'corre') { const q = Math.abs(P.z - this.agua.z) < 40 ? this.agua.p : Math.abs(P.z - this.z1) < 60 ? this.locutorC : null; if (q) this.hud.say(q, pick(TORCIDA), 2); }
      else if (!this.ativa && Math.hypot(this.largada.x - P.x, this.largada.z - P.z) < 30 && !this.feitaHoje) this.hud.say(this.locutorL, 'Inscrição aberta! Corrida da Orla, 2 km!', 2.5);
    }
  }

  acaba(pos) {
    this.tJog = this.t; this.estado = 'fim'; this.t = 0; this.feitaHoje = true;
    this.hud.objective('');
    if (pos == null) { this.hud.flash('Desclassificado! Corrida é a pé e pelo calçadão.'); return; }
    const premio = PREMIO[pos - 1] || 0;
    if (premio) addMoney(premio);
    const tt = tempo(this.tJog || 0);
    save.corridaOrla = Math.min(save.corridaOrla || 1e9, this.tJog || 1e9); persist();
    conta('corrida_orla');
    if (pos <= 3) conta('corrida_podio');
    if (pos === 1) conta('corrida_vitoria');
    this.hud.banner(pos <= 3 ? `${pos}º lugar no pódio!` : `Chegou em ${pos}º`, `${tt} nos 2 km.${premio ? ` Prêmio de R$ ${premio}.` : ' Ganhou a medalha de participação.'}`, 4);
    if (this.locutorC) this.hud.say(this.locutorC, pos === 1 ? 'É campeão! Recife em primeiro!' : `Chegando o peito nº 1, ${pos}º lugar!`, 3);
  }

  recordeTxt() { return save.corridaOrla && save.corridaOrla < 1e9 ? tempo(save.corridaOrla) : null; }

  monta() {
    const W = this.world, g = new THREE.Group();
    const portico = (z, txt, cor) => {
      const x = this.lane(z), y = W.groundY(x, z), p = new THREE.Group(); p.position.set(x, y, z);
      const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6 });
      const arco = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.45, 10, 28, Math.PI), m); p.add(arco);
      const faixa = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshBasicMaterial({ map: tex(txt, cor, '#ffffff'), side: THREE.DoubleSide })); faixa.position.set(0, 3.4, 0); p.add(faixa);
      arco.rotation.y = 0; p.rotation.y = 0;
      const loc = makePerson({ tipo: 'homem', shirt: '#ffd166', hat: 'bone' }); loc.position.set(x + 4.4, y, z); loc.rotation.y = -Math.PI / 2; g.add(loc);
      g.add(p);
      (W.ocupados ||= []).push([x, z, 4.5, 'corrida:' + txt]);
      return loc;
    };
    if (W.ocupados) W.ocupados = W.ocupados.filter((o) => !String(o[3]).startsWith('corrida:'));
    this.locutorL = portico(this.z0, 'LARGADA', '#e63946');
    this.locutorC = portico(this.z1, 'CHEGADA', '#118ab2');
    // mesa de água no meio
    const za = this.z0 - DIST / 2, xa = this.lane(za) + 3, ya = W.groundY(xa, za);
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, 2.2), MESA); mesa.position.set(xa, ya + 0.375, za); g.add(mesa);
    for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.1, 8), COPO); c.position.set(xa + (i % 2 ? 0.15 : -0.15), ya + 0.8, za - 0.9 + Math.floor(i / 2) * 0.55); g.add(c); }
    const vol = makePerson({ tipo: 'mulher', shirt: '#2ec4b6' }); vol.position.set(xa + 0.9, ya, za); vol.rotation.y = -Math.PI / 2; g.add(vol);
    this.agua = { p: vol, z: za };
    // pelotão alinhado atrás da largada, com número no peito
    this.rs = [];
    for (let i = 0; i < N; i++) {
      const p = makePerson({ tipo: i % 3 ? 'homem' : 'mulher', shirt: CORES[i % CORES.length], longSleeve: false, bottom: 'bermuda' });
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshBasicMaterial({ map: tex(String(100 + i * 7), '#ffffff', '#111111', 128, 96, 64) }));
      num.position.set(0, 1.2, 0.17); p.add(num); g.add(p);
      this.rs.push({ p, z: this.z0 + 2 + Math.floor(i / 5) * 1.4, lat: ((i % 5) - 2) * 0.9, v: 5.4 + Math.random() * 2.1 + (i === 0 ? 0.45 : 0), ph: Math.random() * 6, chegou: false });
    }
    this.scene.add(g); this.g = g; this.fala = 1;
  }

  desmonta() {
    if (!this.g) return;
    for (const r of this.rs) this.hud.forget(r.p);
    for (const q of [this.locutorL, this.locutorC, this.agua?.p]) if (q) this.hud.forget(q);
    if (this.world.ocupados) this.world.ocupados = this.world.ocupados.filter((o) => !String(o[3]).startsWith('corrida:'));
    this.scene.remove(this.g); this.g = null; this.rs = [];
    if (this.estado === 'fim') this.estado = null;
  }
}
