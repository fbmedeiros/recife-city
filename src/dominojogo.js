// Partida de dominó na mesa da praça: você senta com os senhores e joga de dupla (você + Seu Severino, sentado na
// sua frente) contra os outros dois. 28 pedras, 7 pra cada; quem tem a carroça de sena (6|6) começa. Na sua vez,
// toca numa pedra que encaixe; se ela servir nas duas pontas, escolhe o lado. Sem pedra que sirva, passa sozinho.
// Bateu (acabou a mão) ganha a dupla; trancou (quatro passes seguidos), ganha a dupla com menos pontos na mão.
// Ganhar: R$ 15 e a conta do troféu; perder: paga o café (R$ 5). Esc ou "Levantar" larga a partida.
import { addMoney, spend } from './save.js';
import { conta } from './trofeus.js';

const NOMES = ['Você', 'Seu Biu', 'Seu Severino', 'Seu Tonho'];
const PASSA = ['Passo.', 'Tô fora dessa.', 'Passo, visse?', 'Num tenho, não.'];
const JOGA = ['Toma!', 'Essa é minha.', 'Vai aí.', 'Segura essa!', 'Hum... essa.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const PIPS = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

export function pedraSVG(a, b, w = 64) {
  const meia = (n, ox) => PIPS[n].map((i) => `<circle cx="${ox + 8 + (i % 3) * 8}" cy="${8 + Math.floor(i / 3) * 8}" r="2.6"/>`).join('');
  return `<svg viewBox="0 0 64 32" width="${w}" height="${w / 2}" aria-label="${a} e ${b}"><rect x="1" y="1" width="62" height="30" rx="5" fill="#f4f1ea" stroke="#3a2a1a" stroke-width="1.5"/><line x1="32" y1="5" x2="32" y2="27" stroke="#3a2a1a" stroke-width="1.5"/><g fill="#1b0f0a">${meia(a, 0)}${meia(b, 32)}</g></svg>`;
}

// regras puras (sem DOM), pra dar pra testar
export class Partida {
  constructor(rnd = Math.random) {
    const todas = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) todas.push([a, b]);
    for (let i = todas.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [todas[i], todas[j]] = [todas[j], todas[i]]; }
    this.maos = [0, 1, 2, 3].map((i) => todas.slice(i * 7, i * 7 + 7));
    this.mesa = []; this.passes = 0; this.fim = null;
    this.vez = this.maos.findIndex((m) => m.some(([a, b]) => a === 6 && b === 6));
  }
  get L() { return this.mesa.length ? this.mesa[0][0] : null; }
  get R() { return this.mesa.length ? this.mesa[this.mesa.length - 1][1] : null; }
  lados(p) {
    if (!this.mesa.length) return (p[0] === 6 && p[1] === 6) ? ['R'] : []; // abre com a carroça de sena
    const s = []; if (p.includes(this.L)) s.push('L'); if (p.includes(this.R)) s.push('R'); return s;
  }
  jogaveis(i) { return this.maos[i].filter((p) => this.lados(p).length); }
  joga(i, p, lado) {
    const m = this.maos[i], k = m.indexOf(p); if (k < 0 || i !== this.vez || this.fim) return false;
    const ls = this.lados(p); if (!ls.length) return false; lado = ls.includes(lado) ? lado : ls[0];
    m.splice(k, 1); this.passes = 0;
    if (!this.mesa.length) this.mesa.push([p[0], p[1]]);
    else if (lado === 'L') this.mesa.unshift(p[1] === this.L ? [p[0], p[1]] : [p[1], p[0]]);
    else this.mesa.push(p[0] === this.R ? [p[0], p[1]] : [p[1], p[0]]);
    if (!m.length) this.fim = { como: 'bateu', quem: i, dupla: i % 2 };
    else this.vez = (i + 1) % 4;
    return true;
  }
  passa(i) {
    if (i !== this.vez || this.fim || this.jogaveis(i).length) return false;
    this.passes++;
    if (this.passes >= 4) {
      const pts = [0, 1].map((d) => [d, d + 2].reduce((s, j) => s + this.maos[j].reduce((t, [a, b]) => t + a + b, 0), 0));
      this.fim = { como: 'trancou', pts, dupla: pts[0] === pts[1] ? null : pts[0] < pts[1] ? 0 : 1 };
    } else this.vez = (i + 1) % 4;
    return true;
  }
  // computador: joga a pedra mais pesada (carroça primeiro no empate); escolhe a ponta que deixa mais pedras dele servindo
  ia(i) {
    const js = this.jogaveis(i); if (!js.length) return this.passa(i), null;
    js.sort((x, y) => (y[0] + y[1]) - (x[0] + x[1]) || (y[0] === y[1]) - (x[0] === x[1]));
    const p = js[0], ls = this.lados(p);
    let lado = ls[0];
    if (ls.length > 1) {
      const resto = this.maos[i].filter((q) => q !== p);
      const nota = (l) => { const ponta = l === 'L' ? (p[1] === this.L ? p[0] : p[1]) : (p[0] === this.R ? p[1] : p[0]); return resto.filter((q) => q.includes(ponta)).length; };
      lado = nota('L') > nota('R') ? 'L' : 'R';
    }
    this.joga(i, p, lado); return p;
  }
}

export class JogoDomino {
  constructor({ hud }) {
    this.hud = hud; this.P = null; this.el = null; this.t = null; this.onFim = null;
    this.tecla = (e) => { if (!this.P) return; if (e.code === 'Escape') this.fecha(); e.stopImmediatePropagation(); };
  }
  get aberto() { return !!this.P; }

  abre(mesa) {
    this.P = new Partida(); this.mesa = mesa; this.escolha = null; this.log = `${NOMES[this.P.vez]} tem a carroça de sena e começa.`;
    if (!this.el) {
      this.el = document.createElement('div'); this.el.id = 'domino'; document.body.appendChild(this.el);
      this.el.addEventListener('click', (e) => this.clique(e));
    }
    this.el.classList.remove('hidden');
    addEventListener('keydown', this.tecla, true);
    this.desenha(); this.proximo();
  }

  fecha(msg) {
    clearTimeout(this.t); this.t = null;
    removeEventListener('keydown', this.tecla, true);
    this.el?.classList.add('hidden'); const P = this.P; this.P = null;
    if (msg !== false && P && !P.fim) this.hud.flash('Levantou da mesa no meio da partida. Os senhores continuam sem você.');
  }

  proximo() {
    const P = this.P; if (!P) return;
    clearTimeout(this.t);
    if (P.fim) return this.termina();
    if (P.vez === 0) {
      if (!P.jogaveis(0).length) { this.log = 'Você não tem pedra que sirva: passou.'; this.desenha(); this.t = setTimeout(() => { P.passa(0); this.proximo(); }, 1100); }
      else { this.log = P.mesa.length ? 'Sua vez: toca numa pedra que sirva.' : 'Você tem a carroça de sena: abre o jogo!'; this.desenha(); }
      return;
    }
    this.desenha();
    this.t = setTimeout(() => {
      if (!this.P) return;
      const i = P.vez, p = P.ia(i);
      this.log = `${NOMES[i]}: ${p ? pick(JOGA) : pick(PASSA)}`;
      this.proximo();
    }, 750);
  }

  clique(e) {
    const b = e.target.closest('button'); if (!b || !this.P) return;
    e.stopPropagation();
    const P = this.P;
    if (b.dataset.sair != null) return this.fecha();
    if (b.dataset.ok != null) return this.fecha(false);
    if (b.dataset.lado && this.escolha) { const p = this.escolha; this.escolha = null; P.joga(0, p, b.dataset.lado); this.log = 'Você: ' + pick(JOGA); return this.proximo(); }
    if (b.dataset.i != null && P.vez === 0 && !P.fim) {
      const p = P.maos[0][+b.dataset.i], ls = P.lados(p); if (!ls.length) return;
      if (ls.length > 1 && P.L !== P.R) { this.escolha = p; this.log = 'Essa serve nas duas pontas: escolhe o lado.'; return this.desenha(); }
      P.joga(0, p, ls[0]); this.log = 'Você: ' + pick(JOGA); this.proximo();
    }
  }

  termina() {
    const F = this.P.fim, nossa = F.dupla === 0;
    let tit, sub;
    if (F.como === 'bateu') tit = F.quem === 0 ? 'Bateu! Lá-e-lô!' : `${NOMES[F.quem]} bateu!`;
    else tit = `Trancou! ${F.pts[0]} a ${F.pts[1]} nos pontos`;
    if (F.dupla == null) sub = 'Empatou. Ninguém paga o café hoje.';
    else if (nossa) { addMoney(15); conta('domino_vitoria'); sub = 'Sua dupla ganhou: +R$ 15. Seu Severino: "Tá vendo? Parceria é tudo!"'; }
    else { const pagou = spend(5); sub = pagou ? 'Perdeu: pagou o café dos senhores (R$ 5).' : 'Perdeu, e tá liso: os senhores perdoaram o café.'; }
    this.log = sub; this.resultado = tit;
    this.desenha();
    this.onFim?.(nossa, F);
  }

  desenha() {
    const P = this.P; if (!P) return;
    const outros = [1, 2, 3].map((i) => `<div class="dm-op${P.vez === i && !P.fim ? ' vez' : ''}"><b>${NOMES[i]}</b>${i === 2 ? ' <i>(parceiro)</i>' : ''}<span>${'▮'.repeat(P.maos[i].length)}</span></div>`).join('');
    const mesa = P.mesa.length ? P.mesa.map(([a, b]) => pedraSVG(a, b, 46)).join('') : '<em>mesa vazia</em>';
    const mao = P.maos[0].map((p, i) => { const ok = P.vez === 0 && !P.fim && P.lados(p).length; return `<button class="dm-p${ok ? ' ok' : ''}${this.escolha === p ? ' sel' : ''}" data-i="${i}" ${ok ? '' : 'disabled'}>${pedraSVG(p[0], p[1], 60)}</button>`; }).join('');
    const lados = this.escolha ? `<div class="dm-lados"><button data-lado="L">← ponta do ${P.L}</button><button data-lado="R">ponta do ${P.R} →</button></div>` : '';
    const fim = P.fim ? `<div class="dm-fim"><b>${this.resultado}</b><button data-ok>Levantar da mesa</button></div>` : '';
    this.el.innerHTML = `<div class="dm-cx"><div class="dm-top"><b>Dominó · ${this.mesa || 'praça'}</b><button data-sair class="dm-x">Levantar ✕</button></div>
      <div class="dm-ops">${outros}</div>
      <div class="dm-mesa">${mesa}</div>
      <div class="dm-log">${this.log || ''}</div>${lados}${fim}
      <div class="dm-mao${P.vez === 0 && !P.fim ? ' vez' : ''}">${mao}</div></div>`;
  }
}
