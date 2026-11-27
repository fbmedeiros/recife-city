// Agenda do Recife: o que tem pra fazer na cidade, num lugar só (com os desafios do dia no topo). A aba "Agenda" do celular lista os passatempos
// (o que está rolando agora primeiro, depois do mais perto pro mais longe) e escolher um traça a rota no GPS. A
// mesma lista vira ícones no mapa grande (M).
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export class Agenda {
  constructor({ gps, hud, day, m }) {
    Object.assign(this, { gps, hud, day, m });
    this.order = [];
  }

  // { icon, nome, desc, x, z, agora (rolando agora), quando (texto do horário) }
  lugares() {
    const M = this.m, h = this.day.hours, out = [];
    const add = (o) => { if (o && Number.isFinite(o.x) && Number.isFinite(o.z)) out.push(o); };
    const perto = (arr, P) => arr.reduce((b, q) => (!b || Math.hypot(q.x - P.x, q.z - P.z) < Math.hypot(b.x - P.x, b.z - P.z) ? q : b), null);
    const P = M.player.pos;
    if (M.jogo?.ativo && M.jogo.clube) { const c = M.jogo.clube; add({ icon: '⚽', nome: `Jogo do ${c.nome}`, desc: `Hoje tem jogo ${c.estadio}. Bota a camisa do time!`, x: c.x, z: c.z, agora: true, quando: 'hoje' }); }
    if (M.bloco?.ativo && M.bloco.route) { const q = M.bloco.route.at(M.bloco.s); add({ icon: '🎺', nome: 'Troça de frevo', desc: 'A troça tá desfilando no Recife Antigo. Pega a sombrinha!', x: q.x, z: q.z, agora: true, quando: 'agora' }); }
    if (M.feira) { const f = perto(M.feira.feiras, P); if (f) add({ icon: '🍍', nome: `Feira livre · ${f.nome.replace(/^Mercado (da |de |do )?/, '')}`, desc: 'Barracas de fruta e verdura na frente do mercado. B compra.', x: f.x, z: f.z, agora: M.feira.aberta, quando: '6h às 13h' }); }
    if (M.forro?.m) add({ icon: '🪗', nome: 'Forró pé-de-serra', desc: 'Trio e casais dançando xote no pátio do Mercado da Boa Vista.', x: M.forro.m.x, z: M.forro.m.z, agora: h >= 13, quando: 'a partir das 13h' });
    if (M.capoeira?.mz) add({ icon: '🤸', nome: 'Roda de capoeira', desc: 'Berimbau, pandeiro e a ginga no Marco Zero.', x: M.capoeira.mz.x, z: M.capoeira.mz.z, agora: M.capoeira.ativa, quando: 'a partir das 10h' });
    for (const S of M.artistas?.shows || []) add({ icon: S.tipo === 'mamulengo' ? '🎭' : '🥁', nome: S.tipo === 'mamulengo' ? 'Mamulengo' : 'Emboladores de coco', desc: S.tipo === 'mamulengo' ? 'Bonecos e criançada no Pátio de São Pedro. B joga uma moeda.' : 'Embolada de pandeiro no Mercado de São José. B joga uma moeda.', x: S.x, z: S.z, agora: true, quando: 'o dia todo' });
    if (M.pescaria) { const L = perto(M.pescaria.pontos.filter((q) => !q.sem), P); if (L) add({ icon: '🎣', nome: 'Pescaria no cais', desc: `Pescadores na beira do rio (${L.nome}). B pede a vara e pesca.`, x: L.x, z: L.z, agora: true, quando: 'o dia todo' }); }
    if (M.domino) { const D = perto(M.domino.mesas.filter((q) => q.x < 1e8), P); if (D) add({ icon: '🎲', nome: 'Dominó na praça', desc: `Os senhores batendo pedra na ${D.nome}. Chega perto e aperta B pra sentar e jogar de dupla.`, x: D.x, z: D.z, agora: true, quando: 'o dia todo' }); }
    if (M.catamara?.ok) add({ icon: '⛴️', nome: 'Passeio de catamarã', desc: 'Pelo Capibaribe, por baixo das pontes do Centro, com guia. R$ 30.', x: M.catamara.cais.tx, z: M.catamara.cais.tz, agora: true, quando: 'o dia todo' });
    if (M.voltaPontes?.ok) { const rec = M.voltaPontes.recordeTxt?.(); add({ icon: '🏁', nome: 'Volta das Pontes', desc: `Contra o relógio pelas pontes do Centro, de carro ou moto.${rec ? ' Recorde: ' + rec + '.' : ''}`, x: M.voltaPontes.largada.x, z: M.voltaPontes.largada.z, agora: true, quando: 'o dia todo' }); }
    if (M.quadrilha?.s) add({ icon: '🔥', nome: 'Ensaio de quadrilha junina', desc: 'Fogueira, bandeirinhas e o marcador puxando as figuras no Sítio da Trindade. B entra na dança.', x: M.quadrilha.s.x, z: M.quadrilha.s.z, agora: M.quadrilha.aberto, quando: 'a partir das 14h' });
    if (M.natal?.ativo && M.natal.mz) add({ icon: '🎄', nome: 'Natal no Marco Zero', desc: 'Árvore gigante com luzinhas e o Papai Noel suando no calor. Foto com ele: R$ 10.', x: M.natal.mz.x, z: M.natal.mz.z, agora: true, quando: 'até o Dia de Reis' });
    if (M.repente?.poi) add({ icon: '🪕', nome: 'Cantoria de repente', desc: `Mestre Zé Pajeú desafia quem chegar, na frente da ${M.repente.poi.name}. Chega perto e aperta B pra pelejar.`, x: M.repente.poi.x, z: M.repente.poi.z, agora: M.repente.ativo, quando: 'das 9h ao fim da tarde' });
    if (M.galao?.k) add({ icon: '💧', nome: 'Entrega de galão', desc: `Pega um galão no Depósito Água Boa (${M.galao.k.bairro}) e leva a pé até a casa da freguesa.`, x: M.galao.k.x, z: M.galao.k.z, agora: !M.galao.carregando, quando: 'o dia todo' });
    if (M.picole?.k) add({ icon: '🍦', nome: 'Bico de picolé', desc: 'Pega o isopor no quiosque Picolé Arretado, no calçadão de Boa Viagem, e vende 12 picolés na areia.', x: M.picole.k.x, z: M.picole.k.z, agora: !M.picole.vendendo, quando: 'o dia todo' });
    if (M.corrida?.ok) { const rec = M.corrida.recordeTxt?.(); add({ icon: '🏃', nome: 'Corrida da Orla', desc: `2 km pelo calçadão de Boa Viagem, largada no Parque Dona Lindu. Inscrição R$ 10, pódio paga.${rec ? ' Seu recorde: ' + rec + '.' : ''}`, x: M.corrida.largada.x, z: M.corrida.largada.z, agora: M.corrida.janela && !M.corrida.feitaHoje, quando: 'das 6h às 10h' }); }
    if (M.mirantes) { const vistos = M.save.mirantes || [], falta = M.mirantes.ms.filter((q) => !vistos.includes(q.nome)); const q = perto(falta.length ? falta : M.mirantes.ms, P); if (q) add({ icon: '🔭', nome: `Mirante · ${q.nome}`, desc: `Sobe e vê o Recife de cima. ${vistos.length}/${M.mirantes.ms.length} mirantes vistos.`, x: q.x, z: q.z, agora: true, quando: 'o dia todo' }); }
    if (M.bicicletas) { const b = perto(M.bicicletas.es, P); if (b) add({ icon: '🚲', nome: 'Bicicleta compartilhada', desc: `Estação mais perto: ${b.nome}. R$ 5 o aluguel.`, x: b.x, z: b.z, agora: true, quando: 'o dia todo' }); }
    if (M.praia && M.sharks?.av) { const z = (M.sharks.av[0][1] + M.sharks.av.at(-1)[1]) / 2, x = M.praia.meioAreia(Math.round(z / 400) * 400); if (x != null) add({ icon: '🏖️', nome: 'Praia de Boa Viagem', desc: 'Pelada na areia, frescobol, queijo coalho e picolé.', x, z: Math.round(z / 400) * 400, agora: true, quando: 'o dia todo' }); }
    if (M.passageiro && M.world.busStations?.length) { const s = perto(M.world.busStations, P); add({ icon: '🚌', nome: 'Ônibus no corredor', desc: 'Pega o ônibus numa estação da Conde da Boa Vista. R$ 4,30.', x: s.x, z: s.z, agora: true, quando: 'o dia todo' }); }
    return out;
  }

  render(el, player) {
    const d = (s) => Math.hypot(s.x - player.pos.x, s.z - player.pos.z);
    this.order = this.lugares().sort((a, b) => (b.agora - a.agora) || d(a) - d(b));
    const km = (s) => (d(s) / 1000).toFixed(1).replace('.', ',') + ' km';
    el.innerHTML = (this.desafios?.html() || '') + this.order.map((s, i) => {
      const bairro = this.hud.bairroAt(s.x, s.z);
      return `<div class="offer album${s.agora ? '' : ' got'}" data-i="${i}">
        <span class="app" style="background:${s.agora ? '#f2b705' : '#6d6788'}">${s.agora ? 'AGORA' : s.quando.toUpperCase()}</span>${i < 9 ? `<span class="k">${i + 1}</span>` : ''}
        <h4>${s.icon} ${cap(s.nome)}</h4>
        <p>${bairro ? '📍 ' + bairro + '. ' : ''}${s.desc}</p>
        <div class="pay"><small>${km(s)} · escolher traça a rota</small></div></div>`;
    }).join('');
    el.querySelectorAll('.offer[data-i]').forEach((c) => (c.onclick = () => this.act(Number(c.dataset.i))));
  }

  act(i) {
    const s = this.order[i];
    if (!s) return false;
    this.gps.setDest(s.x, s.z, cap(s.nome));
    this.onRoute?.();
    return true;
  }

  // ícones no mapa grande (não entram no minimapa)
  marcas() { return this.lugares().map((s) => ({ x: s.x, z: s.z, icon: s.icon, cor: s.agora ? '#f2b705' : '#9a93b5', mini: false })); }
}
