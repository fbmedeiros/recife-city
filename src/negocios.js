// Rendimento dos negócios (comprados na aba Serviços): a cada hora cheia do jogo, cada negócio rende o seu valor.
// Quando o relógio volta das 17h pras 6h (outro dia), não paga a "hora" da virada.
import { save, addMoney } from './save.js';
import { NEGOCIOS } from './shop.js';
import { conta } from './trofeus.js';

export class Negocios {
  constructor({ day, hud }) { Object.assign(this, { day, hud }); this.hora = Math.floor(day.hours); }

  get renda() { return NEGOCIOS.filter((n) => (save.negocios || []).includes(n.id)).reduce((a, n) => a + n.renda, 0); }

  update() {
    const h = Math.floor(this.day.hours);
    if (h === this.hora) return;
    const virou = h > this.hora;
    this.hora = h;
    const r = this.renda;
    if (!virou || !r) return;
    addMoney(r);
    conta('renda', r);
    this.hud.flash(`💼 Teus negócios renderam R$ ${r}`);
  }
}
