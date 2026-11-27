// Cantoria de repente na frente da Casa da Cultura (das 9h ao fim da tarde): dois violeiros sentados em tamborete,
// viola no colo, chapéu de couro, e uma rodinha de gente ouvindo. Mestre Zé Pajeú desafia quem chegar. A pé, perto
// dele, B aceita a peleja: abre a tela da cantoria. São 5 estrofes; em cada uma o mestre canta dois versos e você
// completa o seu escolhendo a palavra do fim, que tem que rimar e fazer sentido (10 s pra decidir). Acertando 4 ou
// mais, a plateia joga moeda no chapéu (R$ 20) e conta o troféu. Todos os versos são inventados pro jogo.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { addMoney } from './save.js';
import { conta } from './trofeus.js';

const LUGARES = [/^Casa da Cultura/, /^Mercado de Casa Amarela$/, /^Mercado da Boa Vista$/];
const N = 5, TEMPO = 10, PREMIO = 20;
// m: versos do mestre; v: os seus, o último termina em "___"; c: a palavra certa; e: duas que não rimam
export const ESTROFES = [
  { m: ['Eu venho do Pajeú,', 'trago o repente na mão.'], v: ['E eu sou do Recife, mestre,', 'cresci no meio do ___'], c: 'calçadão', e: ['mangue', 'asfalto'] },
  { m: ['Tu é novo na peleja,', 'ainda vai apanhar.'], v: ['Quem cresceu na beira-rio', 'não tem medo de ___'], c: 'remar', e: ['ladeira', 'cachorro'] },
  { m: ['Teu verso é fraco, menino,', 'parece caldo de cana.'], v: ['Pois caldo de cana é doce', 'e adoça a tua ___'], c: 'semana', e: ['vida', 'cabeça'] },
  { m: ['Já cantei em Boa Viagem', 'com o pé dentro do mar.'], v: ['E o tubarão saiu da água', 'só pra me ouvir ___'], c: 'cantar', e: ['dormindo', 'na praia'] },
  { m: ['Esse calor do Recife', 'derrete qualquer cantor.'], v: ['Mas eu sou feito de brasa,', 'quanto mais quente, ___'], c: 'melhor', e: ['mais suado', 'sei lá'] },
  { m: ['Vou te dar um nó na língua', 'que tu não desata, não.'], v: ['Desato com uma mão só', 'e ainda toco ___'], c: 'violão', e: ['pandeiro', 'zabumba'] },
  { m: ['Teu sotaque é de quem chega,', 'tu não é daqui, rapaz.'], v: ['Sou do Alto José do Pinho,', 'pernambucano ___'], c: 'demais', e: ['de verdade', 'da gema'] },
  { m: ['Na ponte Maurício de Nassau', 'eu parei pra descansar.'], v: ['E eu atravessei a nado', 'o Capibaribe a ___'], c: 'cantar', e: ['pé', 'correndo'] },
  { m: ['Teu repente é de padaria,', 'já nasce todo amassado.'], v: ['Mas pão do Recife é quente,', 'sai do forno ___'], c: 'dourado', e: ['cedinho', 'redondo'] },
  { m: ['Quando chove no Recife', 'a cidade vira rio.'], v: ['E eu de bote na Agamenon', 'cantando sem ___'], c: 'desvio', e: ['parar', 'chinelo'] },
];
const BOM = ['Ê, menino bom de rima!', 'Rimou bonito, a plateia gostou!', 'Arretado! Esse tem futuro.'];
const RUIM = ['Rimou não, visse! Ha ha!', 'Caraí, tropeçou no verso!', 'Esse verso ficou manco.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
const MADEIRA = mat('#8a6a45'), COURO = mat('#7a4a22');
const embaralha = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class Repente {
  constructor({ scene, world, hud, player, day }) {
    Object.assign(this, { scene, world, hud, player, day });
    this.poi = null; for (const re of LUGARES) { this.poi = world.pois.find((p) => re.test(p.name)); if (this.poi) break; }
    this.g = null; this.sem = false; this.S = null; this.el = null; this.falaT = 5; this.vitorias = 0;
    this.tecla = (e) => { if (!this.S) return; const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code]; if (e.code === 'Escape') this.fecha(); else if (k != null) this.escolhe(k); e.stopImmediatePropagation(); };
  }

  get ativo() { return this.day.hours >= 9; }
  get aberto() { return !!this.S; }
  get perto() { if (!this.g || this.S || this.player.vehicle) return false; const P = this.player.pos; return Math.hypot(this.mestre.x - P.x, this.mestre.z - P.z) < 4; }
  get hint() { return this.perto ? 'B — aceitar a peleja de repente com Mestre Zé Pajeú' : ''; }

  b() {
    if (!this.perto) return false;
    this.S = { ordem: embaralha(ESTROFES).slice(0, N), i: 0, pontos: 0, t: TEMPO, opcoes: null, resp: null, fim: false };
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'repente'; document.body.appendChild(this.el); this.el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); if (b.dataset.o != null) this.escolhe(+b.dataset.o); else if (b.dataset.sair != null) this.fecha(); }); }
    this.el.classList.remove('hidden');
    addEventListener('keydown', this.tecla, true);
    this.hud.say(this.mestre.p, 'Chegou um desafiante! Afina a garganta, menino.', 3);
    this.estrofe();
    return true;
  }

  estrofe() {
    const S = this.S, E = S.ordem[S.i];
    S.opcoes = embaralha([E.c, ...E.e]); S.resp = null; S.t = TEMPO;
    this.desenha();
  }

  escolhe(k) {
    const S = this.S; if (!S) return;
    if (S.fim) return this.fecha();
    if (S.resp != null) return;
    const E = S.ordem[S.i], ok = k >= 0 && S.opcoes[k] === E.c;
    S.resp = k; if (ok) S.pontos++;
    S.fala = ok ? pick(BOM) : k < 0 ? 'Calou! O tempo passou, menino.' : pick(RUIM);
    this.desenha();
    clearTimeout(this.tm);
    this.tm = setTimeout(() => { if (this.S !== S) return; S.i++; if (S.i >= N) this.termina(); else this.estrofe(); }, 1600);
  }

  termina() {
    const S = this.S; S.fim = true;
    if (S.pontos >= 4) { addMoney(PREMIO); conta('repente'); this.vitorias++; S.fala = `Você ganhou a peleja! ${S.pontos} de ${N} versos certos. A plateia jogou R$ ${PREMIO} no chapéu.`; this.hud.say(this.mestre.p, 'Esse aí me venceu! Volta amanhã pra revanche.', 4); }
    else if (S.pontos === 3) S.fala = `Empatou: ${S.pontos} de ${N}. O mestre disse que a revanche fica pra outro dia.`;
    else S.fala = `O mestre venceu: você acertou ${S.pontos} de ${N}. Treina mais e volta!`;
    this.desenha();
  }

  fecha() {
    clearTimeout(this.tm); removeEventListener('keydown', this.tecla, true);
    this.el?.classList.add('hidden');
    if (this.S && !this.S.fim) this.hud.flash('Saiu da peleja no meio. O mestre riu: "Correu, foi?"');
    this.S = null;
  }

  desenha() {
    const S = this.S, E = S.ordem[S.i];
    const verso = (l) => l.replace('___', S.resp != null ? `<u>${S.opcoes[S.resp] ?? '…'}</u>` : '<span class="rp-vazio">___</span>');
    const ops = S.fim ? '' : S.opcoes.map((o, i) => { const cls = S.resp == null ? '' : o === E.c ? ' certo' : i === S.resp ? ' errado' : ''; return `<button data-o="${i}" class="rp-o${cls}" ${S.resp != null ? 'disabled' : ''}><kbd>${i + 1}</kbd> ${o}</button>`; }).join('');
    const tempo = !S.fim && S.resp == null ? `<div class="rp-t"><i style="width:${(S.t / TEMPO) * 100}%"></i></div>` : '';
    this.el.innerHTML = `<div class="rp-cx"><div class="rp-top"><b>Cantoria de repente · ${this.poi?.name || ''}</b><button data-sair class="rp-x">Sair ✕</button></div>
      ${S.fim ? '' : `<div class="rp-n">Estrofe ${S.i + 1} de ${N} · ${S.pontos} certa${S.pontos === 1 ? '' : 's'}</div>
      <div class="rp-m"><small>Mestre Zé Pajeú</small>${E.m.join('<br>')}</div>
      <div class="rp-v"><small>Você</small>${E.v.map(verso).join('<br>')}</div>${tempo}<div class="rp-ops">${ops}</div>`}
      <div class="rp-fala">${S.fala && (S.resp != null || S.fim) ? S.fala : 'Escolhe a palavra que rima e fecha o verso.'}</div>
      ${S.fim ? '<div class="rp-ops"><button data-sair class="rp-o">Agradecer e sair</button></div>' : ''}</div>`;
  }

  update(dt, t, cam) {
    const S = this.S;
    if (S && !S.fim && S.resp == null) {
      S.t -= dt; const bar = this.el?.querySelector('.rp-t i'); if (bar) bar.style.width = `${Math.max(0, S.t / TEMPO) * 100}%`;
      if (S.t <= 0) this.escolhe(-1);
    }
    if (S && (this.player.vehicle)) this.fecha();
    if (!this.poi || this.sem) return;
    const d = Math.hypot(this.poi.x - cam.x, this.poi.z - cam.z);
    if (this.g && (d > 260 || !this.ativo)) this.desmonta();
    if (!this.g && (d > 220 || !this.ativo)) return;
    if (!this.g && !this.monta()) return;
    // os dois violeiros pontilhando a viola, balançando a cabeça
    for (const [i, c] of this.cantores.entries()) {
      const u = c.p.userData, s = Math.sin(t * (S ? 9 : 6) + i * 1.7);
      if (u.armR) u.armR.rotation.x = -0.9 + s * 0.12;
      if (u.head) u.head.rotation.z = Math.sin(t * 1.3 + i) * 0.12;
    }
    const P = this.player.pos;
    if (!S && (this.falaT -= dt) <= 0) { this.falaT = 10 + Math.random() * 6; if (Math.hypot(this.mestre.x - P.x, this.mestre.z - P.z) < 20) this.hud.say(this.mestre.p, pick(['Quem tem coragem de pelejar comigo?', 'Chega, cantador! A viola tá afinada.', 'Um verso por uma moeda, freguesia!']), 3); }
  }

  monta() {
    const W = this.world, livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z) && !(W.ocupados || []).some(([ox, oz, r, key]) => key !== 'repente' && Math.hypot(ox - x, oz - z) < r + 1);
    let at = null;
    for (let r = 8; r < 70 && !at; r += 3) for (let a = 0; a < 6.28 && !at; a += 0.3) {
      const x = this.poi.x + Math.cos(a) * r, z = this.poi.z + Math.sin(a) * r;
      let ok = true; for (let i = 0; i < 8 && ok; i++) for (const rr of [0, 2, 4]) { const b = (i / 8) * 6.28; if (!livre(x + Math.cos(b) * rr, z + Math.sin(b) * rr)) { ok = false; break; } }
      if (ok) at = [x, z];
    }
    if (!at) { this.sem = true; return false; }
    const [x, z] = at, y = W.groundY(x, z), g = new THREE.Group(); g.position.set(x, y, z);
    g.rotation.y = Math.atan2(this.poi.x - x, this.poi.z - z) + Math.PI; // de costas pro prédio
    this.cantores = [];
    for (const [i, sx] of [[0, -0.9], [1, 0.9]].entries()) {
      const tam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 8), MADEIRA); tam.position.set(sx[1], 0.22, 0); g.add(tam);
      const p = makePerson({ tipo: 'idoso', shirt: i ? '#f4f1ea' : '#d8cbb0', bottom: 'calca', pants: '#4a3a2a', shoes: '#5a3a1e' });
      const u = p.userData; u.seated = true; p.userData.semCorpo = true;
      if (u.legL) { u.legL.rotation.x = u.legR.rotation.x = -1.45; u.kneeL.rotation.x = u.kneeR.rotation.x = 1.45; }
      if (u.armL) { u.armL.rotation.set(-0.9, 0, 0.25); u.elbowL.rotation.x = -0.4; u.elbowR.rotation.x = -1.2; }
      p.position.set(sx[1], -0.03, 0); p.rotation.y = sx[1] < 0 ? 0.5 : -0.5; g.add(p);
      // chapéu de couro (aba larga) e viola no colo
      const cab = u.head || p;
      const aba = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 14), COURO); aba.position.set(0, 0.16, 0); cab.add(aba);
      const copa = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.14, 10), COURO); copa.position.set(0, 0.24, 0); cab.add(copa);
      const vio = new THREE.Group(); vio.position.set(0.05, 0.78, 0.25); vio.rotation.set(0, 0, 1.15); p.add(vio);
      const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), mat('#b5793a')); corpo.rotation.x = Math.PI / 2; vio.add(corpo);
      const braco = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), MADEIRA); braco.position.y = 0.4; vio.add(braco);
      this.cantores.push({ p, x: 0, z: 0 });
    }
    // rodinha de gente ouvindo, de frente pros cantadores
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.36, r = 3.4 + (i % 2) * 0.6;
      const p = makePerson({ tipo: i % 3 ? 'homem' : 'mulher', shirt: ['#e63946', '#3a86ff', '#ffd166', '#06d6a0', '#f4f1ea', '#8338ec'][i] });
      p.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); p.rotation.y = a + Math.PI; g.add(p);
    }
    const chapeu = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.1, 12), COURO); chapeu.position.set(0, 0.05, 1.1); g.add(chapeu);
    this.scene.add(g); g.updateMatrixWorld(true);
    for (const c of this.cantores) { const w = new THREE.Vector3(); c.p.getWorldPosition(w); c.x = w.x; c.z = w.z; }
    this.mestre = this.cantores[0];
    (W.ocupados ||= []).push([x, z, 4.5, 'repente']);
    this.g = g; this.c = [x, z];
    return true;
  }

  desmonta() {
    if (!this.g) return;
    for (const c of this.cantores) this.hud.forget(c.p);
    this.scene.remove(this.g); this.g = null;
    this.world.ocupados = (this.world.ocupados || []).filter((o) => o[3] !== 'repente');
  }
}
