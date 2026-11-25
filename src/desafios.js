// Desafios do dia: a cada dia novo do jogo (quando o relógio volta das 17h pras 6h), três desafios sorteados de uma
// lista de coisas pra fazer na cidade (pescar, gol na praia, catamarã, Volta das Pontes, bicos, feira, artistas…).
// O progresso vem dos mesmos contadores dos troféus (conta/onConta); completar paga na hora e completar os três
// dá um bônus. Aparecem no topo da aba Agenda e o Zap/flash avisa quando um sai.
import { save, addMoney, persist } from './save.js';
import { onConta } from './trofeus.js';

const POOL = [
  { k: 'peixe', n: 2, txt: 'Pesca 2 peixes no cais', premio: 30 },
  { k: 'gol_praia', n: 1, txt: 'Faz um gol na pelada da praia', premio: 30 },
  { k: 'catamara', n: 1, txt: 'Faz o passeio de catamarã até o fim', premio: 30 },
  { k: 'volta_pontes', n: 1, txt: 'Completa a Volta das Pontes', premio: 40 },
  { k: 'corrida', n: 2, txt: 'Faz 2 corridas de bico', premio: 40 },
  { k: 'entrega', n: 2, txt: 'Faz 2 entregas de bico', premio: 40 },
  { k: 'moto', n: 1, txt: 'Faz uma corrida de mototáxi', premio: 25 },
  { k: 'onibus', n: 1, txt: 'Dirige uma linha de ônibus', premio: 30 },
  { k: 'feira', n: 2, txt: 'Compra 2 vezes na feira livre', premio: 15 },
  { k: 'artista', n: 2, txt: 'Joga 2 moedas pros artistas de rua', premio: 15 },
  { k: 'malabarista', n: 1, txt: 'Dá uma moeda pro malabarista do sinal', premio: 10 },
  { k: 'sinal', n: 2, txt: 'Compra 2 vezes do ambulante no sinal', premio: 15 },
  { k: 'praia', n: 2, txt: 'Compra 2 vezes dos vendedores da praia', premio: 15 },
  { k: 'passageiro', n: 1, txt: 'Anda de ônibus no corredor da Conde da Boa Vista', premio: 15 },
  { k: 'bike_aluguel', n: 1, txt: 'Aluga uma bicicleta compartilhada', premio: 15 },
  { k: 'domino', n: 1, txt: 'Assiste uma partida de dominó na praça', premio: 15 },
  { k: 'capoeira', n: 1, txt: 'Assiste a roda de capoeira no Marco Zero', premio: 15 },
  { k: 'forro', n: 1, txt: 'Curte o forró no Mercado da Boa Vista', premio: 15 },
  { k: 'pipa', n: 1, txt: 'Apara uma pipa no morro', premio: 20 },
  { k: 'caranguejo', n: 1, txt: 'Compra uma corda de caranguejo no mangue', premio: 15 },
];
const BONUS = 50;

export class Desafios {
  constructor({ day, hud }) {
    Object.assign(this, { day, hud });
    const D = save.desafios;
    if (!D || !Array.isArray(D.lista) || !D.lista.length) this.novoDia(true);
    this.h0 = day.hours;
    onConta((k, v) => this.contou(k, v));
  }

  get lista() { return save.desafios.lista; }

  novoDia(primeiro = false) {
    const ant = save.desafios?.lista?.map((d) => d.k) || [];
    // sorteia 3 diferentes, evitando repetir os de ontem
    const cand = POOL.filter((p) => !ant.includes(p.k)), lista = [];
    while (lista.length < 3 && cand.length) lista.push({ ...cand.splice(Math.floor(Math.random() * cand.length), 1)[0], prog: 0, feito: false });
    save.desafios = { dia: (save.desafios?.dia || 0) + 1, lista, bonus: false };
    persist();
    if (!primeiro) this.hud.flash('☀️ Dia novo! Desafios novos na Agenda do celular.');
  }

  contou(k, v = 1) {
    const D = save.desafios; if (!D) return;
    for (const d of D.lista) {
      if (d.feito || d.k !== k) continue;
      d.prog = Math.min(d.n, d.prog + v);
      if (d.prog >= d.n) {
        d.feito = true; addMoney(d.premio);
        this.hud.flash(`✅ Desafio do dia: ${d.txt}! +R$ ${d.premio}`);
      }
    }
    if (!D.bonus && D.lista.every((d) => d.feito)) { D.bonus = true; addMoney(BONUS); this.hud.banner('Desafios do dia completos!', `Fez os três. Bônus de R$ ${BONUS}!`, 4); }
    persist();
  }

  update() {
    const h = this.day.hours;
    if (h + 1 < this.h0) this.novoDia(); // o relógio voltou das 17h pras 6h
    this.h0 = h;
  }

  // bloco no topo da aba Agenda
  html() {
    const D = save.desafios, feitos = D.lista.filter((d) => d.feito).length;
    return `<div class="offer album" style="cursor:default"><span class="app" style="background:#8ee07a">DESAFIOS DO DIA ${D.dia}</span>
      <h4>${feitos}/3 feitos${D.bonus ? ' · bônus pago' : ` · os três dão +R$ ${BONUS}`}</h4>
      ${D.lista.map((d) => `<p>${d.feito ? '✅' : '⬜'} ${d.txt} <small>(${d.prog}/${d.n} · R$ ${d.premio})</small></p>`).join('')}</div>`;
  }
}
