import { makeVehicle } from './models.js';
import { save, persist, spend, zerarSave } from './save.js';

export const CARROS = [
  { id: 'popular', name: 'Carro popular', desc: 'Econômico e valente. Pega em qualquer lugar.', price: 400, kind: 'car', color: '#2f5d9c' },
  { id: 'suv', name: 'SUV', desc: 'Alto e pesado, aguenta pancada.', price: 900, kind: 'suv', color: '#1c1c1e' },
  { id: 'buggy', name: 'Buggy de praia', desc: 'Leve e esperto nas curvas, pra rodar na orla.', price: 1500, kind: 'buggy', color: '#f2c94c' },
  { id: 'bike', name: 'Bicicleta', desc: 'Pra pedalar na ciclovia da orla sem gastar gasolina.', price: 150, kind: 'bike', color: '#2a9d8f' },
  { id: 'moto160', name: 'Moto 160', desc: 'Corta o trânsito e serve pro MOTOXE.', price: 600, kind: 'moto', color: '#c8102e' },
  { id: 'esportivo', name: 'Esportivo', desc: 'Quase 200 km/h. Pra fazer bonito no racha da beira-mar.', price: 3500, kind: 'sport', color: '#d62828' },
];

// negócios: rendem por hora cheia do jogo (negocios.js paga); comprados na aba Serviços
export const NEGOCIOS = [
  { id: 'carrinho', name: 'Carrinho de queijo coalho', desc: 'Um rapaz vende pra tu na areia de Boa Viagem.', price: 800, renda: 15 },
  { id: 'tapiocaria', name: 'Barraca de tapioca na orla', desc: 'Tapioca de coco, de queijo, de charque. Fila no fim de tarde.', price: 2500, renda: 45 },
  { id: 'bar', name: 'Bar no Recife Antigo', desc: 'Mesa na calçada da Rua da Moeda, cerveja gelada e caldinho.', price: 8000, renda: 150 },
];

export const ROUPAS = [
  { id: 'rubronegra', name: 'Camisa rubro-negra', price: 80, slot: 'shirt', value: ['#c8102e', '#111111'] },
  { id: 'alvirrubra', name: 'Camisa alvirrubra', price: 80, slot: 'shirt', value: ['#c8102e', '#f4f4f4'] },
  { id: 'tricolor', name: 'Camisa tricolor', price: 80, slot: 'shirt', value: ['#c8102e', '#f4f4f4', '#111111'] },
  { id: 'frevo', name: 'Camisa de frevo', price: 120, slot: 'shirt', value: ['#e63946', '#ffd166', '#2a9d8f', '#3a86ff'] },
  { id: 'bone', name: 'Boné', price: 40, slot: 'hat', value: 'bone' },
  { id: 'cangaceiro', name: 'Chapéu de cangaceiro', price: 150, slot: 'hat', value: 'cangaceiro' },
  { id: 'oculos', name: 'Óculos escuros', price: 30, slot: 'glasses', value: true },
  { id: 'sombrinha', name: 'Sombrinha de frevo', price: 200, slot: 'hand', value: 'sombrinha' },
];

const fmt = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');

export class Shop {
  constructor({ scene, traffic, police, hud, player, applyOutfit, teleport }) {
    Object.assign(this, { scene, traffic, police, hud, player, applyOutfit, teleport });
    this.called = null; // carro próprio chamado por último
  }

  // ---------------------------------------------------------------- listas por aba

  items(tab) {
    const owned = (id) => save.items.includes(id) || save.cars.includes(id);
    if (tab === 'garagem') {
      return CARROS.map((c) => ({
        title: c.name, desc: c.desc, price: c.price,
        state: owned(c.id) ? 'Chamar' : 'Comprar',
        act: () => (owned(c.id) ? this.callCar(c) : this.buy(c.price, () => { save.cars.push(c.id); this.callCar(c); }, `${c.name} na garagem! Já mandei aí pra tu.`)),
      }));
    }
    if (tab === 'loja') {
      return ROUPAS.map((r) => {
        const worn = JSON.stringify(save.outfit[r.slot]) === JSON.stringify(r.value);
        return {
          title: r.name, desc: r.slot === 'shirt' ? 'Camisa listrada.' : r.slot === 'hand' ? 'Pra fazer o passo pela rua.' : 'Acessório.', price: r.price,
          state: owned(r.id) ? (worn ? 'Tirar' : 'Vestir') : 'Comprar',
          act: () => {
            if (!owned(r.id)) return this.buy(r.price, () => { save.items.push(r.id); this.wear(r, true); }, `Comprou ${r.name.toLowerCase()}!`);
            this.wear(r, !worn);
          },
        };
      });
    }
    // serviços
    const lvl = this.police.level;
    const list = [
      {
        title: 'Advogado', desc: lvl ? `Zera as ${lvl} estrela${lvl > 1 ? 's' : ''} da tua ficha na hora.` : 'Tua ficha tá limpa. Volta quando precisar.',
        price: 250 * Math.max(1, lvl), state: lvl ? 'Contratar' : '—', disabled: !lvl,
        act: () => this.buy(250 * lvl, () => { this.police.clear(); }, 'O advogado resolveu. Ficha limpa!'),
      },
      {
        title: 'Turbo na oficina', desc: 'Mais 20% de velocidade e arranque em todos os teus carros.',
        price: 1200, state: save.turbo ? 'Instalado' : 'Comprar', disabled: save.turbo,
        act: () => this.buy(1200, () => { save.turbo = true; this.applyTurbo(this.player.vehicle?.mesh); this.applyTurbo(this.called?.mesh); }, 'Turbo instalado. Segura!'),
      },
      {
        title: 'Apê em Boa Viagem', desc: 'Teu canto na beira-mar. Depois de preso, tu volta pra casa em vez do Marco Zero.',
        price: 6000, state: save.home ? 'É teu' : 'Comprar', disabled: !!save.home,
        act: () => this.buy(6000, () => { save.home = this.homeSpot(); }, 'Parabéns pelo apê na beira-mar!'),
      },
      {
        title: 'Táxi pra casa', desc: save.home ? 'Te leva pro apê em Boa Viagem.' : 'Te deixa no Marco Zero.',
        price: 25, state: 'Chamar', disabled: !!this.player.vehicle || lvl > 0,
        act: () => this.buy(25, () => { const h = save.home || this.marcoZero; this.teleport(h.x, h.z); }, 'Chegou!'),
      },
    ];
    // trocar de personagem (avatar.js): cada toque passa pro próximo
    if (this.avatar) {
      const A = this.avatar.atual, todos = this.avatar.todos, prox = todos[(todos.indexOf(A) + 1) % todos.length];
      list.push({ title: `Personagem: ${A.nome}`, desc: `${A.sub} Toca pra virar ${prox.nome}. (Também dá pra escolher na tela de início.)`, price: 0, state: 'Trocar', disabled: !!this.player.vehicle,
        act: () => { this.avatar.escolhe(prox.id); this.hud.flash(`Agora tu é ${prox.nome}!`); } });
    }
    // negócios que rendem por hora de jogo
    for (const n of NEGOCIOS) {
      const tem = (save.negocios || []).includes(n.id);
      list.push({
        title: n.name, desc: `${n.desc} Rende R$ ${n.renda} por hora.`, price: n.price, state: tem ? 'É teu' : 'Comprar', disabled: tem,
        act: () => this.buy(n.price, () => { (save.negocios ||= []).push(n.id); }, `${n.name}: agora é teu! Rende R$ ${n.renda} por hora.`),
      });
    }
    // apagar tudo: o primeiro toque arma, o segundo (em até 8 s) confirma
    const armado = this.zerarAte > performance.now();
    list.push({
      title: armado ? 'Tem certeza? Toca de novo' : 'Recomeçar do zero',
      desc: armado ? 'Apaga dinheiro, carros, roupa, apê, álbum, troféus, roteiro e Zap. Não dá pra desfazer.' : 'Apaga todo o progresso e começa um Recife novinho. Pede confirmação.',
      price: 0, state: armado ? 'Apagar tudo' : 'Recomeçar', disabled: false,
      act: () => { if (this.zerarAte > performance.now()) zerarSave(); else { this.zerarAte = performance.now() + 8000; this.hud.flash('Toca de novo pra apagar tudo'); } },
    });
    if (lvl > 0) list[3].desc += ' (Não com a polícia atrás.)';
    return list;
  }

  render(tab, el) {
    const list = this.items(tab);
    el.innerHTML = list.map((it, i) => `
      <div class="offer shop${it.disabled ? ' disabled' : ''}" data-i="${i}">
        <span class="k">${i + 1}</span><h4>${it.title}</h4><p>${it.desc}</p>
        <div class="pay">${it.state === 'Comprar' || it.state === 'Contratar' || it.state === 'Chamar' && it.price === 25 ? fmt(it.price) : ''}
          <span class="btn">${it.state}</span></div>
      </div>`).join('');
    el.querySelectorAll('.offer[data-i]').forEach((d) => (d.onclick = () => { this.act(tab, Number(d.dataset.i)); this.render(tab, el); }));
  }

  act(tab, i) {
    const it = this.items(tab)[i];
    if (!it || it.disabled) return;
    it.act();
  }

  buy(price, then, msg) {
    if (!spend(price)) { this.hud.flash(`Falta ${fmt(price - save.money)}. Bora fazer uns bicos!`); return; }
    then();
    persist();
    this.hud.flash(msg);
  }

  // ---------------------------------------------------------------- efeitos

  wear(r, on) {
    save.outfit[r.slot] = on ? r.value : r.slot === 'glasses' ? false : null;
    persist();
    this.applyOutfit();
  }

  applyTurbo(mesh) {
    if (!mesh?.userData.owned || mesh.userData.turbo || !save.turbo) return;
    mesh.userData.turbo = true;
    mesh.userData.stats.vmax *= 1.2;
    mesh.userData.stats.accel *= 1.2;
  }

  callCar(c) {
    const p = this.player;
    if (p.vehicle?.mesh.userData.ownedId === c.id) { this.hud.flash('Tu já tá nele!'); return; }
    // tira o anterior, se ninguém estiver dentro
    if (this.called && this.called.mesh !== p.vehicle?.mesh) {
      this.scene.remove(this.called.mesh);
      const i = this.traffic.parked.indexOf(this.called);
      if (i >= 0) this.traffic.parked.splice(i, 1);
    }
    const n = this.traffic.nearestEdge(this.traffic.drive, p.pos.x, p.pos.z);
    if (!n) return;
    const t = Math.min(n.e.len, n.t + 8);
    const pos = this.traffic.posOn(n.e, t);
    const mesh = makeVehicle(c.kind, c.color);
    if (mesh.userData.rider) mesh.userData.rider.visible = false; // moto e bike chegam sem piloto
    mesh.position.set(pos.x, 0, pos.z);
    mesh.rotation.y = Math.atan2(n.e.dx, n.e.dz);
    mesh.userData.owned = true;
    mesh.userData.ownedId = c.id;
    this.applyTurbo(mesh);
    this.scene.add(mesh);
    this.called = { mesh, v: 0 };
    this.traffic.parked.push(this.called);
    this.hud.target = { x: pos.x, z: pos.z };
    setTimeout(() => { if (this.hud.target?.x === pos.x) this.hud.target = null; }, 15000);
    this.hud.flash(`${c.name} tá te esperando ali na rua (${document.body.classList.contains('touch') ? '🚗' : 'F'} pra entrar)`);
  }

  homeSpot() {
    // um ponto na calçada da Av. Boa Viagem, perto do Parque Dona Lindu ou no meio da orla
    const n = this.traffic.nearestEdge(this.traffic.foot, this.bvx ?? 0, this.bvz ?? 2600);
    const p = this.traffic.posOn(n.e, n.t);
    return { x: p.x, z: p.z };
  }
}
