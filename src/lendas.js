// Caçada às Lendas do Recife: o objetivo do jogo. Dez lendas soltas pela cidade (quatro assombrações do folclore
// recifense, contadas com humor, e seis figuras inventadas que todo recifense reconhece). Na aba Lendas do
// celular o jogador começa a caçada: o cronômetro corre enquanto ele joga, cada lenda tem uma charada de dica e,
// por R$ 20, o bairro. Achou (a pé, chegando perto), ela solta a fala e vira figurinha na aba. As dez fecham o
// tempo, que entra no ranking local (os 5 melhores, salvos no aparelho). Os personagens inventados não são
// pessoas reais; as assombrações são do folclore (Perna Cabeluda, Papa-Figo, Emparedada da Rua Nova, Comadre
// Fulozinha).
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { save, spend, addMoney, persist } from './save.js';
import { conta } from './trofeus.js';

const DICA = 20, PREMIO = 300, PERTO = 5;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const tempoTxt = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}h${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
const placaTex = (linhas, fundo = '#fff8e1', cor = '#222') => { const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d'); g.fillStyle = fundo; g.fillRect(0, 0, 256, 160); g.fillStyle = cor; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; linhas.forEach((l, i) => g.fillText(l, 128, 50 + i * 42)); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }); };
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

// onde: { poi: /regex/ } | { rua: 'nome', perto: [x, z] } (o Recife tem várias ruas com o mesmo nome: pega o ponto da rua mais perto) | { orla: z } | { areia: z } | { xz: [x, z] } (em ordem de tentativa)
export const LENDAS = [
  { id: 'perna', icon: '🦵', nome: 'Perna Cabeluda', tipo: 'Assombração', onde: [{ rua: 'Rua da Aurora', perto: [2218, -4308] }],
    dica: 'Pula num pé só na beira do Capibaribe, na rua que tem nome de nascer do sol.',
    teaser: ['*tum* … *tum* … *tum*', 'Cheiro de canela sem hidratante…'],
    fala: 'TUM! Levou uma bicuda da Perna Cabeluda. Desde 1975 assustando o Recife, e ainda sem depilar.',
    legenda: 'Assombra o Centro desde os anos 70. Nunca foi vista de bermuda comprida.' },
  { id: 'papafigo', icon: '🧺', nome: 'Papa-Figo aposentado', tipo: 'Assombração', onde: [{ poi: /^Mercado de São José$/ }],
    dica: 'O velho do saco largou a vida de susto e agora só quer figo. Procura no mercado de ferro mais antigo do Brasil.',
    teaser: ['Figo, figo… só figo agora, visse?', 'Tô de dieta, menino, pode passar.'],
    fala: 'Oxe, assustar criança? Aposentei, boy. Agora é só figo com queijo coalho, ordem da nutricionista.',
    legenda: 'Ex-terror das mães do Recife Velho. Hoje discute preço de figo na banca.' },
  { id: 'emparedada', icon: '👻', nome: 'Emparedada da Rua Nova', tipo: 'Assombração', onde: [{ rua: 'Rua Nova', perto: [2111, -3700] }],
    dica: 'Ficou presa na parede de um sobrado na rua que, de nova, só tem o nome.',
    teaser: ['Psiu… aqui na parede…', 'Alguém aí tem um martelo?'],
    fala: 'Séculos emparedada e o camelô ainda gritando "três é dez" na minha janela. Me tira daqui não, que lá fora tá mais quente.',
    legenda: 'Lenda do Recife antigo. Reclama do barulho dos camelôs desde o século XIX.' },
  { id: 'fulozinha', icon: '🌿', nome: 'Comadre Fulozinha', tipo: 'Assombração', onde: [{ poi: /^Jardim Secreto do Poço da Panela$/ }, { poi: /^Sítio da Trindade$/ }],
    dica: 'Guardiã do mato, assobia num jardim escondido do Poço da Panela. Leva fumo e mel, senão ela dá nó no teu cabelo.',
    teaser: ['Fiu-fiuuu…', '*assobio vindo do mato*'],
    fala: 'Fiuuu! Chegou sem fumo e sem mel? Pronto, teu cabelo vai amanhecer cheio de nó. Brincadeira… ou não.',
    legenda: 'Protetora das matas. Dá nó no cabelo de quem entra sem pedir licença.' },
  { id: 'guia', icon: '🧭', nome: 'Guia Autodeclarado do Marco Zero', tipo: 'Figura', onde: [{ poi: /^Marco Zero$/ }],
    dica: 'Ninguém contratou, mas ele explica tudo no ponto de onde se contam as distâncias de Pernambuco.',
    teaser: ['Excursão! Excursão grátis! Gorjeta opcional, mas recomendada!', 'Essa rosa dos ventos foi o vento que desenhou, visse?'],
    fala: 'Tá vendo aquele navio? Foi Nassau que deixou estacionado ali. Quinze reais o passeio, mas pra tu eu faço dez.',
    legenda: 'Guia sem crachá, sem curso e sem compromisso com a História. Cinco estrelas no boca a boca.' },
  { id: 'profeta', icon: '🚌', nome: 'Profeta do Corredor', tipo: 'Figura', onde: [{ rua: 'Avenida Conde da Boa Vista', perto: [1225, -4326] }],
    dica: 'Prevê a chegada do ônibus na avenida mais famosa do Centro. Nunca acertou, mas a fé continua.',
    teaser: ['Ele vem! Em dois minutos ele vem!', 'Eu vi em sonho: o ônibus vazio!'],
    fala: 'Escreve aí: o próximo passa em dois minutos e com ar-condicionado funcionando. Faço essa profecia desde 2009.',
    legenda: 'Acertou a hora do ônibus uma vez, em 2014. Vive dessa fama até hoje.' },
  { id: 'coach', icon: '🧘', nome: 'Coach Quântico da Orla', tipo: 'Figura', onde: [{ orla: 1200 }],
    dica: 'Vende curso de mentalidade no calçadão, perto do terceiro jardim de Boa Viagem.',
    teaser: ['O calor é um estado de espírito!', 'Mentalidade 40 graus, vibração de ar-condicionado!'],
    fala: 'Tu não tá suando, tu tá manifestando! Meu curso "Sobreviva ao Verão Recifense com Mindset" sai em 12x de 99.',
    legenda: 'Ensina a não sentir calor. Usa ventilador portátil no pescoço o dia inteiro.' },
  { id: 'galego', icon: '🦈', nome: 'Galego Amigo do Tubarão', tipo: 'Figura', onde: [{ areia: 300 }, { areia: 1800 }],
    dica: 'Torrado de sol na areia do Pina, jura que é amigo íntimo de um morador do mar.',
    teaser: ['Bruninho! Ô Bruninho! (é o tubarão)', 'Ele é manso, só tá com fome.'],
    fala: 'O nome dele é Bruninho, a gente se conhece desde pequeno. Entra comigo não, que ele tem ciúme.',
    legenda: 'Diz que é amigo do tubarão. Nunca passou da canela na água.' },
  { id: 'tia', icon: '🌹', nome: 'Tia do Bom Dia', tipo: 'Figura', onde: [{ poi: /^Mercado da Encruzilhada$/ }],
    dica: 'Manda rosa animada no zap às 5h40. Faz a feira no mercado do bairro que tem nome de cruzamento.',
    teaser: ['Bom dia, flor do dia! 🌹', 'Recebeu meu áudio de 7 minutos?'],
    fala: 'Bom dia! Já te mandei o bom dia no zap, no Instagram e no grupo da família, mas faço questão de dizer pessoalmente.',
    legenda: 'Administra 14 grupos da família. Nunca saiu de nenhum.' },
  { id: 'influencer', icon: '📱', nome: 'Influencer do Cais', tipo: 'Figura', onde: [{ rua: 'Rua do Bom Jesus', perto: [3136, -4009] }, { poi: /^Paço do Frevo$/ }],
    dica: 'Grava story na rua mais bonita do Recife Antigo pela 47ª vez hoje. Tem 312 seguidores e muita fé.',
    teaser: ['Gente, olha esse pôr do sol (são 10h da manhã)', 'Arrasta pra cima, arrasta!'],
    fala: 'Ai, tu me achou! Vai sair no meu story, marca aí. Usa o cupom RECIFE10 na loja de capinha da minha prima.',
    legenda: '312 seguidores, 3 deles são ela mesma. Engajamento arretado.' },
];

export class Lendas {
  constructor({ scene, world, hud, player, praia, corrida, sharks }) {
    Object.assign(this, { scene, world, hud, player, praia, corrida, sharks });
    this.ls = LENDAS.map((L) => ({ ...L, x: null, z: null, g: null, sem: false, fala: 0 }));
    this.resolvido = false;
    if (!save.lendas) save.lendas = { on: false, t: 0, achadas: [], dicas: [], fim: false };
    if (!Array.isArray(save.rankingLendas)) save.rankingLendas = [];
    this.avisou = 0;
    this.hud_ = this.criaHud();
  }

  get S() { return save.lendas; }
  get achadas() { return this.S.achadas.length; }

  // posição de cada lenda (feito na primeira atualização: o praia/corrida já existem)
  resolve() {
    const W = this.world;
    for (const L of this.ls) {
      for (const o of L.onde) {
        let p = null;
        if (o.poi) { const q = W.pois.find((q) => o.poi.test(q.name)); if (q) p = [q.x, q.z]; }
        else if (o.rua) {
          const rs = W.data.roads.filter((r) => r.n === o.rua);
          let bd = 400; for (const r of rs) for (const q of r.p) { const d = Math.hypot(q[0] - o.perto[0], q[1] - o.perto[1]); if (d < bd) { bd = d; p = q; } }
        } else if (o.orla != null) { const x = this.corrida?.lane?.(o.orla) ?? (this.sharks?.avX?.(o.orla) != null ? this.sharks.avX(o.orla) + 12 : null); if (x != null) p = [x, o.orla]; }
        else if (o.areia != null) { const x = this.praia?.meioAreia?.(o.areia); if (x != null) p = [x, o.areia]; }
        else if (o.xz) p = o.xz;
        if (p) { L.x = p[0]; L.z = p[1]; L.areia = o.areia != null; L.parede = L.id === 'emparedada'; break; }
      }
      if (L.x == null) L.sem = true;
    }
    this.resolvido = true;
  }

  comeca() {
    save.lendas = { on: true, t: 0, achadas: [], dicas: [], fim: false };
    persist();
    this.hud.banner('Caçada às Lendas do Recife', 'Dez lendas soltas na cidade. As dicas tão na aba Lendas do celular. O tempo tá correndo!', 4);
  }

  compraDica(i) {
    const L = this.ls[i]; if (!L || !this.S.on || this.S.achadas.includes(L.id) || this.S.dicas.includes(L.id)) return false;
    if (!spend(DICA)) { this.hud.flash(`A dica do bairro custa R$ ${DICA}. Faz um bico!`); return true; }
    this.S.dicas.push(L.id); persist();
    this.hud.flash(`${L.icon} Dica: fica em ${this.bairro(L)}. −R$ ${DICA}`);
    return true;
  }

  bairro(L) { return (L.x != null && this.hud.bairroAt?.(L.x, L.z)) || 'algum canto do Recife'; }

  update(dt, t, cam) {
    if (!this.resolvido) this.resolve();
    const S = this.S, P = this.player.pos;
    if (S.on) S.t += dt;
    // convite: uns 25 s depois de abrir o jogo, se a caçada nunca começou
    if (!S.on && !S.fim && !this.convidou && (this.tt = (this.tt || 0) + dt) > 25) { this.convidou = true; this.hud.banner('🕵️ Tem lenda solta no Recife!', 'Objetivo: acha as 10 lendas no menor tempo. Abre o celular (P), aba Lendas.', 5); }
    this.mostraHud();
    for (const L of this.ls) {
      if (L.sem) continue;
      const d = Math.hypot(L.x - cam.x, L.z - cam.z);
      if (L.g && d > 260) this.desmonta(L);
      if (d > 220) continue;
      if (!L.g) this.monta(L);
      if (!L.g) continue;
      this.anima(L, t, dt);
      const dp = Math.hypot(L.px - P.x, L.pz - P.z), achou = S.achadas.includes(L.id);
      if (!this.player.vehicle && dp < 25 && (L.fala -= dt) <= 0 && !achou) { L.fala = 9 + Math.random() * 6; this.hud.say(L.fala3d, pick(L.teaser), 2.5); }
      if (this.player.vehicle || dp > PERTO || achou) continue;
      if (!S.on) { if (t - this.avisou > 20) { this.avisou = t; this.hud.say(L.fala3d, 'Oxe, tu nem tá na caçada! Abre o celular, aba Lendas.', 3); } continue; }
      this.acha(L);
    }
  }

  acha(L) {
    const S = this.S;
    S.achadas.push(L.id); persist();
    conta('lenda');
    this.hud.say(L.fala3d, L.fala, 6);
    const n = S.achadas.length;
    if (n < this.ls.length) { this.hud.banner(`${L.icon} ${L.nome}`, `Lenda encontrada! ${n}/${this.ls.length} · ${tempoTxt(S.t)}`, 3.5); return; }
    // fechou as dez
    S.on = false; S.fim = true;
    const R = save.rankingLendas; R.push({ t: S.t, dia: new Date().toLocaleDateString('pt-BR') }); R.sort((a, b) => a.t - b.t); R.splice(5);
    const pos = R.findIndex((r) => r.t === S.t) + 1;
    let pago = false; if (!save.lendasPremio) { save.lendasPremio = true; addMoney(PREMIO); pago = true; }
    persist();
    conta('lendas10');
    if (S.t < 20 * 60) conta('lendas_rapido');
    this.hud.banner('Caçou as 10 Lendas do Recife!', `Tempo: ${tempoTxt(S.t)}${pos ? ` · ${pos}º no ranking` : ''}${pago ? ` · +R$ ${PREMIO}` : ''}`, 6);
  }

  // ---- HUD: cronômetro pequeno no canto enquanto a caçada corre
  criaHud() {
    const el = document.createElement('div');
    el.id = 'lendas-hud';
    el.style.cssText = 'position:fixed;left:16px;bottom:118px;z-index:20;padding:6px 10px;border-radius:10px;background:rgba(20,14,30,.72);color:#ffd166;font:700 14px system-ui,sans-serif;pointer-events:none;display:none';
    document.body.appendChild(el);
    return el;
  }
  mostraHud() {
    const S = this.S, el = this.hud_;
    const txt = S.on ? `🕵️ Lendas ${S.achadas.length}/${this.ls.length} · ${tempoTxt(S.t)}` : '';
    if (txt !== this.hudTxt) { this.hudTxt = txt; el.textContent = txt; el.style.display = txt ? 'block' : 'none'; }
  }

  // ---- aba Lendas do celular
  render(el) {
    const S = this.S, R = save.rankingLendas;
    const topo = S.on
      ? `<h4>🕵️ Caçada em andamento: ${S.achadas.length}/${this.ls.length}</h4><p>Tempo: <b>${tempoTxt(S.t)}</b>. Chega perto (a pé) pra achar. A dica do bairro custa R$ ${DICA}.</p>`
      : S.fim
        ? `<h4>🏆 Caçou as 10 em ${tempoTxt(S.t)}!</h4><p>Dá pra caçar de novo e tentar um tempo melhor.</p><div class="pay"><small>${touch() ? 'Toque aqui' : '<b>1</b> / clique'} pra caçar de novo</small></div>`
        : `<h4>🕵️ Dez lendas soltas no Recife</h4><p>Quatro assombrações do folclore e seis figuras que todo recifense conhece. Acha as dez no menor tempo e entra no ranking.</p><div class="pay"><small>${touch() ? 'Toque aqui' : '<b>1</b> / clique'} pra começar a caçada</small></div>`;
    const rank = R.length ? R.map((r, i) => `<p>${['🥇', '🥈', '🥉', '4º', '5º'][i]} ${tempoTxt(r.t)} <small>· ${r.dia}</small></p>`).join('') : '<p><small>Ninguém fechou a caçada ainda neste aparelho.</small></p>';
    const cards = this.ls.map((L, i) => {
      const achou = S.achadas.includes(L.id), temBairro = S.dicas.includes(L.id);
      if (achou) return `<div class="offer album"><span class="app" style="background:#8ee07a">${L.tipo.toUpperCase()}</span><h4>${L.icon} ${L.nome}</h4><p>${L.legenda}</p></div>`;
      const k = i === 9 ? '0' : String(i + 1);
      return `<div class="offer album got" data-l="${i}"><span class="app" style="background:#6d6788">LENDA ${i + 1}</span>${S.on && !touch() ? `<span class="k">${k}</span>` : ''}<h4>❓ ???</h4><p>${L.dica}</p>${S.on ? `<div class="pay"><small>${temBairro ? '📍 ' + this.bairro(L) : `bairro por R$ ${DICA}`}</small></div>` : ''}</div>`;
    }).join('');
    el.innerHTML = `<div class="offer album" data-top="1" style="${S.on ? 'cursor:default' : ''}"><span class="app" style="background:#f2b705">OBJETIVO</span>${topo}</div>`
      + `<div class="offer album" style="cursor:default"><span class="app" style="background:#c1121f">RANKING</span><h4>Melhores tempos</h4>${rank}</div>` + cards;
    el.querySelector('[data-top]').onclick = () => { if (!S.on) { this.comeca(); this.onChange?.(); } };
    el.querySelectorAll('[data-l]').forEach((c) => (c.onclick = () => { if (this.compraDica(Number(c.dataset.l))) this.onChange?.(); }));
  }

  key(code) {
    const m = /^Digit([0-9])$/.exec(code); if (!m) return false;
    const n = Number(m[1]);
    if (!this.S.on) { if (n === 1) { this.comeca(); this.onChange?.(); } return n === 1; }
    this.compraDica(n === 0 ? 9 : n - 1); this.onChange?.();
    return true;
  }

  // ---- cenas
  livre(x, z) { const W = this.world; return !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z) && !(W.ocupados || []).some(([ox, oz, r]) => Math.hypot(ox - x, oz - z) < r + 0.5); }

  lugar(L) {
    const W = this.world;
    if (L.areia) return [L.x, L.z, -Math.PI / 2];
    for (let r = 0; r < 90; r += 1.5) for (let a = 0; a < 6.28; a += r ? 0.5 / Math.max(1, r / 3) : 7) {
      const x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r;
      if (!this.livre(x, z)) continue;
      // de costas pra parede mais perto (a Emparedada exige parede a menos de 1,5 m)
      let yaw = null, perto = false;
      for (let b = 0; b < 6.28; b += 0.4) { if (W.blocked(x + Math.cos(b) * 1.3, z + Math.sin(b) * 1.3)) perto = true; if (yaw == null && W.blocked(x + Math.cos(b) * 3, z + Math.sin(b) * 3)) yaw = Math.atan2(-Math.cos(b), -Math.sin(b)); }
      if (L.parede && !perto) continue;
      return [x, z, yaw ?? Math.random() * 6.28];
    }
    return null;
  }

  monta(L) {
    const at = this.lugar(L); if (!at) { L.sem = true; return; }
    const [x, z, yaw] = at, y = this.world.groundY(x, z), g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = yaw;
    L.px = x; L.pz = z;
    const pessoa = (o) => { const p = makePerson(o); g.add(p); return p; };
    const placa = (linhas, px, py, pz, w = 0.8, h = 0.5, cor) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), placaTex(linhas, cor)); m.position.set(px, py, pz); g.add(m); return m; };
    let p = null;
    switch (L.id) {
      case 'perna': {
        // a perna: coxa, joelho, canela e pé, cabeluda, com a barra da bermuda em cima
        const pele = mat('#b57a4f'), pelo = mat('#1b1209', { roughness: 1 }), perna = new THREE.Group(); g.add(perna);
        const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; perna.add(o); return o; };
        add(new THREE.CylinderGeometry(0.34, 0.27, 1.0, 14), pele, 0, 1.7, 0);
        add(new THREE.SphereGeometry(0.27, 12, 10), pele, 0, 1.18, 0.02);
        add(new THREE.CylinderGeometry(0.25, 0.16, 1.0, 14), pele, 0, 0.66, 0);
        add(new THREE.BoxGeometry(0.34, 0.2, 0.7), pele, 0, 0.1, 0.18);
        add(new THREE.CylinderGeometry(0.4, 0.38, 0.35, 14), mat('#2b4a7a'), 0, 2.25, 0); // barra da bermuda
        const fio = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 3);
        for (let i = 0; i < 260; i++) { const h = 0.25 + Math.random() * 1.85, r = h > 1.2 ? 0.28 + (h - 1.2) * 0.08 : 0.17 + (h - 0.25) * 0.09, a = Math.random() * 6.28; const f = add(fio, pelo, Math.cos(a) * r, h, Math.sin(a) * r); f.rotation.set(Math.random() - 0.5, 0, Math.random() - 0.5 + 0.6 * Math.cos(a)); f.castShadow = false; }
        L.perna = perna; L.fala3d = perna; break;
      }
      case 'papafigo': {
        p = pessoa({ tipo: 'homem', shirt: '#6b5b4b', longSleeve: true, bottom: 'calca', pants: '#3a3a3a', hat: 'bone', hairColor: '#d8d8d8' });
        const saco = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat('#9a7b4f', { roughness: 1 })); saco.scale.set(1, 1.2, 0.9); saco.position.set(0.45, 0.45, -0.1); g.add(saco);
        const bacia = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.12, 14), mat('#c9ccd0', { metalness: 0.6 })); bacia.position.set(0, 1.0, 0.35); g.add(bacia);
        for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#5b2a4a')); f.position.set((Math.random() - 0.5) * 0.3, 1.08, 0.35 + (Math.random() - 0.5) * 0.3); g.add(f); }
        p.userData.armL.rotation.x = p.userData.armR.rotation.x = -0.9; p.userData.elbowL.rotation.x = p.userData.elbowR.rotation.x = -0.7;
        placa(['SÓ FIGO', 'R$ 10 o kg'], -0.7, 1.0, 0.2, 0.6, 0.38);
        break;
      }
      case 'emparedada': {
        p = pessoa({ tipo: 'mulher', top: 'vestido', shirt: '#f2f2ff' });
        p.userData.semCorpo = true; // fantasma: fica no boneco translúcido (corpos.js não troca)
        p.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; o.material.emissive = new THREE.Color('#9fb7ff'); o.material.emissiveIntensity = 0.6; o.castShadow = false; } });
        p.position.z = 0.15; L.fantasma = p; break;
      }
      case 'fulozinha': {
        p = pessoa({ tipo: 'mulher', top: 'vestido', shirt: '#4f7a3a', hairColor: '#120c08' });
        p.scale.setScalar(0.72);
        const cabelo = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.1), mat('#120c08', { roughness: 1 })); cabelo.position.set(0, 1.2, -0.16); (p.userData.upper || p).add(cabelo);
        for (let i = 0; i < 4; i++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), mat(['#ffd166', '#ff5d8f', '#ffffff', '#ff8c1a'][i])); fl.position.set(-0.12 + i * 0.08, 1.72, 0.05); (p.userData.upper || p).add(fl); }
        L.some = p; break;
      }
      case 'guia': {
        p = pessoa({ tipo: 'homem', shirt: '#ffd166', bottom: 'bermuda', hat: 'bone' });
        const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 6), mat('#444')); haste.position.set(0, -0.5, 0.1); p.userData.elbowR.add(haste);
        const band = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), placaTex(['GUIA', 'OFICIAL*'], '#e63946', '#fff')); band.position.set(0.2, -0.05, 0.1); p.userData.elbowR.add(band); band.rotation.y = Math.PI / 2;
        p.userData.armR.rotation.x = -2.6; break;
      }
      case 'profeta': {
        p = pessoa({ tipo: 'homem', shirt: '#e9e3d0', longSleeve: true, bottom: 'calca', pants: '#e9e3d0', hairColor: '#cfcfcf' });
        placa(['O ÔNIBUS', 'VEM!'], 0, 2.05, 0.35, 0.8, 0.5, '#fff1a8');
        p.userData.armL.rotation.set(-2.7, 0, -0.2); p.userData.armR.rotation.set(-2.7, 0, 0.2);
        break;
      }
      case 'coach': {
        p = pessoa({ tipo: 'homem', top: 'regata', shirt: '#111111', bottom: 'bermuda', pants: '#111111', shoes: '#ff5d8f' });
        placa(['MINDSET', '40 GRAUS'], 0.9, 1.1, 0.3, 0.7, 0.45, '#111111');
        const fone = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 16, Math.PI), mat('#ff5d8f')); fone.position.set(0, 1.72, 0); fone.rotation.z = 0; (p.userData.upper || p).add(fone);
        break;
      }
      case 'galego': {
        p = pessoa({ tipo: 'homem', top: 'regata', shirt: '#ffffff', bottom: 'bermuda', pants: '#f77f00', skin: '#e2876a', hair: 'short', hairColor: '#f1ead2' });
        const boia = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 18), mat('#ffd166')); boia.position.set(0.6, 0.15, 0.2); boia.rotation.x = Math.PI / 2; g.add(boia);
        break;
      }
      case 'tia': {
        p = pessoa({ tipo: 'mulher', top: 'vestido', shirt: '#d62f8f', hairColor: '#4a2a1a' });
        const cel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.015), mat('#222')); cel.position.set(0, -0.32, 0.06); p.userData.elbowR.add(cel);
        p.userData.armR.rotation.x = -1.2; p.userData.elbowR.rotation.x = -1.3;
        placa(['BOM DIA', '🌹'], -0.8, 1.2, 0.1, 0.55, 0.36, '#ffe5ec');
        break;
      }
      case 'influencer': {
        p = pessoa({ tipo: 'mulher', top: 'regata', shirt: '#ff5d8f', bottom: 'bermuda', pants: '#ffffff', hairColor: '#e0b070' });
        const pau = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), mat('#222')); pau.position.set(0, -0.45, 0.25); pau.rotation.x = -0.9; p.userData.elbowR.add(pau);
        const anel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 20), new THREE.MeshBasicMaterial({ color: '#fff8e1' })); anel.position.set(0, -0.8, 0.6); p.userData.elbowR.add(anel);
        p.userData.armR.rotation.x = -1.6;
        break;
      }
    }
    if (p) { L.fala3d = L.fala3d || p; L.p = p; }
    (this.world.ocupados ||= []).push([x, z, 1.5, 'lenda:' + L.id]);
    this.scene.add(g); L.g = g; L.fala = 1 + Math.random() * 3;
  }

  anima(L, t, dt) {
    if (L.perna) { const h = Math.abs(Math.sin(t * 3.1)); L.perna.position.y = h * 0.5; L.perna.rotation.z = Math.sin(t * 3.1) * 0.06; }
    if (L.fantasma) { L.fantasma.position.y = 0.15 + Math.sin(t * 1.3) * 0.08; L.fantasma.traverse((o) => { if (o.isMesh) o.material.opacity = 0.32 + Math.sin(t * 2) * 0.12; }); }
    if (L.some) L.some.visible = Math.sin(t * 0.7) > -0.6; // aparece e some no mato
    if (L.p && L.id === 'coach') { L.p.userData.armL.rotation.set(-1.2 + Math.sin(t * 2) * 0.4, 0, -0.6); L.p.userData.armR.rotation.set(-1.2 - Math.sin(t * 2) * 0.4, 0, 0.6); }
    if (L.p && L.id === 'galego') animatePerson(L.p, 0, dt);
  }

  desmonta(L) {
    if (L.fala3d) this.hud.forget(L.fala3d);
    if (this.world.ocupados) this.world.ocupados = this.world.ocupados.filter((o) => o[3] !== 'lenda:' + L.id);
    this.scene.remove(L.g); L.g = null; L.perna = L.fantasma = L.some = L.p = L.fala3d = null;
  }
}

function touch() { return document.body.classList.contains('touch'); }
