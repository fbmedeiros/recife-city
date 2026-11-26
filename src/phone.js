import { save } from './save.js';
import { renderTrofeus, contagem } from './trofeus.js';

const TABS = [
  { id: 'bicos', title: 'Bicos', sub: 'Faz uns corres e junta uns trocados' },
  { id: 'lendas', title: 'Lendas', sub: 'Objetivo: acha as 10 lendas do Recife' },
  { id: 'agenda', title: 'Agenda', sub: 'O que tem pra fazer no Recife agora' },
  { id: 'garagem', title: 'Garagem', sub: 'Auto Oxe: carro novo entregue onde tu tiver' },
  { id: 'loja', title: 'Loja', sub: 'Feira de São José: roupa e acessório' },
  { id: 'servicos', title: 'Serviços', sub: 'Advogado, oficina, imóvel e táxi' },
  { id: 'album', title: 'Álbum', sub: 'Lugares do Recife que tu já fotografou' },
  { id: 'trofeus', title: 'Troféus', sub: 'O que tu já aprontou pela cidade' },
  { id: 'zap', title: 'Zap', sub: 'Mensagens de quem te conhece' },
];

const touchUI = () => document.body.classList.contains('touch');

export class Phone {
  constructor(hud, missions, shop) {
    Object.assign(this, { hud, missions, shop });
    this.el = document.getElementById('phone');
    this.tabsEl = document.getElementById('phone-tabs');
    this.listEl = document.getElementById('offers');
    this.titleEl = document.querySelector('.phone-title');
    this.subEl = document.querySelector('.phone-sub');
    this.footEl = document.querySelector('.phone-foot');
    this.tab = 'bicos';
    // a missão fecha o celular sozinha quando aceita um bico
    missions.phoneEl = this.el;
  }

  get open() { return !this.el.classList.contains('hidden'); }

  toggle(player) {
    if (this.open) { this.el.classList.add('hidden'); return false; }
    this.player = player;
    this.render();
    this.el.classList.remove('hidden');
    return true;
  }

  switch(dir) {
    const i = TABS.findIndex((t) => t.id === this.tab);
    this.tab = TABS[(i + dir + TABS.length) % TABS.length].id;
    this.render();
  }

  render() {
    const t = TABS.find((x) => x.id === this.tab);
    document.getElementById('phone-clock').textContent = this.hud.clockText || '';
    this.tabsEl.innerHTML = TABS.map((x) => `<button data-t="${x.id}" class="${x.id === this.tab ? 'on' : ''}">${x.title}${x.id === 'zap' && this.zap?.naoLidas && this.tab !== 'zap' ? ` <i>${this.zap.naoLidas}</i>` : ''}</button>`).join('');
    this.tabsEl.querySelectorAll('button').forEach((b) => (b.onclick = () => { this.tab = b.dataset.t; this.render(); }));
    this.titleEl.textContent = t.title;
    this.subEl.textContent = `${t.sub} · saldo R$ ${save.money.toLocaleString('pt-BR')}`;
    if (this.tab === 'bicos') {
      this.missions.prepare(this.player);
      this.missions.renderPhone(this.player);
      if (touchUI()) {
        this.footEl.innerHTML = this.missions.active ? '<button class="foot-btn">Cancelar bico</button>' : 'Toque num bico pra aceitar';
        const b = this.footEl.querySelector('button');
        if (b) b.onclick = () => { this.missions.cancel(); this.render(); };
      } else this.footEl.innerHTML = '<b>1–4</b> aceitar · <b>X</b> cancelar bico · <b>Q/E</b> abas · <b>P</b> fechar';
    } else if (this.tab === 'zap') {
      this.zap.render(this.listEl);
      this.footEl.innerHTML = touchUI() ? '' : '<b>Q/E</b> abas · <b>P</b> fechar';
    } else if (this.tab === 'trofeus') {
      this.subEl.textContent = `${contagem()} troféus · saldo R$ ${save.money.toLocaleString('pt-BR')}`;
      renderTrofeus(this.listEl);
      this.footEl.innerHTML = touchUI() ? '' : '<b>Q/E</b> abas · <b>P</b> fechar';
    } else if (this.tab === 'lendas' && this.lendas) {
      this.lendas.render(this.listEl);
      this.footEl.innerHTML = touchUI() ? 'Toque numa lenda pra comprar a dica do bairro' : '<b>1–9, 0</b> dica do bairro · <b>Q/E</b> abas · <b>P</b> fechar';
    } else if (this.tab === 'agenda' && this.agenda) {
      this.agenda.render(this.listEl, this.player);
      this.footEl.innerHTML = touchUI() ? 'Toque num lugar pra traçar a rota' : '<b>1–9</b> / clique traça a rota · <b>Q/E</b> abas · <b>P</b> fechar';
    } else if (this.tab === 'album') {
      this.subEl.textContent = `${this.album.count} lugares fotografados · chega perto de um marco pra tirar a foto`;
      this.album.render(this.listEl, this.player);
      this.footEl.innerHTML = touchUI() ? 'Toque num lugar pra traçar a rota' : '<b>1–9</b> / clique traça a rota · <b>Q/E</b> abas · <b>P</b> fechar';
    } else {
      this.shop.render(this.tab, this.listEl);
      this.footEl.innerHTML = touchUI() ? 'Toque num item pra escolher' : '<b>1–9</b> / clique escolhe · <b>Q/E</b> abas · <b>P</b> fechar';
    }
  }

  // devolve true quando a tecla foi usada pelo celular
  key(code) {
    if (code === 'KeyQ' || code === 'ArrowLeft') { this.switch(-1); return true; }
    if (code === 'KeyE' || code === 'ArrowRight') { this.switch(1); return true; }
    const n = /^Digit([1-9])$/.exec(code);
    if (this.tab === 'bicos') {
      if (n) { this.missions.accept(Number(n[1]) - 1, this.player); return true; }
      if (code === 'KeyX') { this.missions.cancel(); this.render(); return true; }
      return false;
    }
    if (this.tab === 'trofeus' || this.tab === 'zap') return false;
    if (this.tab === 'album') { if (n) this.album.act(Number(n[1]) - 1); return !!n; }
    if (this.tab === 'agenda') { if (n) this.agenda?.act(Number(n[1]) - 1); return !!n; }
    if (this.tab === 'lendas') return !!this.lendas?.key(code);
    if (n) { this.shop.act(this.tab, Number(n[1]) - 1); this.render(); return true; }
    return false;
  }
}
