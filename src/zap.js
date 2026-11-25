// Zap: mensagens no celular de gente da vida do jogador no Recife. Cada uma pede um favor que usa uma parte do
// jogo (praia, sinal, troça, dia de jogo, álbum, bicos, toró). Cumprir rende uns trocados e uma resposta.
// Um pedido por vez; o próximo chega uns 2 a 4 minutos depois. Quando a lista acaba, recomeça. Fica salvo (save.zap).
import { save, persist, addMoney } from './save.js';
import { onConta, conta } from './trofeus.js';

const PEDIDOS = [
  { id: 'mainha', de: 'Mainha', cor: '#e07aa8', msg: 'Ô meu filho, quando passar na praia traz um queijo coalho pra mainha, visse? Com mel de engenho!', conta: 'praia', n: 1, fim: 'Deus te abençoe, meu filho! Tava uma delícia. 🙏', premio: 30 },
  { id: 'vizinha', de: 'Dona Socorro (vizinha)', cor: '#f2b705', msg: 'Menino, tu que anda de carro: compra uma água daquele rapaz do sinal pra ajudar ele? Ele tá no corre desde cedo.', conta: 'sinal', n: 1, fim: 'Tu é o ouro, visse! Ele ficou todo feliz.', premio: 20 },
  { id: 'primo', de: 'Primo Thiago', cor: '#c8102e', msg: 'Ei boy, bora pro jogo hoje? Te espero na porta do estádio, das 14h às 17h. Não me deixa plantado!', conta: 'jogo', n: 1, fim: 'Arretado! Que festa arretada, a torcida tava demais! ⚽', premio: 30 },
  { id: 'prima', de: 'Prima Júlia (SP)', cor: '#3ac0a0', msg: 'Primo!! Tira uma foto no Paço do Frevo pra mim? Quero postar dizendo que conheço o Recife kkkk', foto: 'o Paço do Frevo', fim: 'AAAA que lindo!! Ano que vem eu vou pro carnaval com certeza!', premio: 25 },
  { id: 'chefe', de: 'OXECAR (central)', cor: '#ffd166', msg: 'Motorista, hoje tem bônus: faz 3 corridas no app e ganha R$ 60 por fora.', conta: 'corrida', n: 3, fim: 'Bônus liberado! Obrigado por rodar com a gente.', premio: 60 },
  { id: 'amigo', de: 'Kaline', cor: '#d7263d', msg: 'A Troça Caraí Que Calor vai sair hoje à tarde no Recife Antigo! Bora brincar? Chega lá e dança (G)!', conta: 'bloco', n: 1, fim: 'Eita que tu frevou bonito! 😂', premio: 25 },
  { id: 'tia', de: 'Tia Cida', cor: '#6f8fb8', msg: 'Meu sobrinho, tá chovendo aí? Aqui em Caruaru tá um sol de rachar. Me avisa quando cair um toró!', conta: 'toro', n: 1, fim: 'Vixe! Cuidado com os alagamentos, viu? Não sai dirigindo feito doido.', premio: 15 },
  { id: 'busao', de: 'Seu Biu', cor: '#2a9d58', msg: 'Meu rapaz, tô precisando de um motorista de ônibus pra cobrir uma linha hoje. Pega uma no BUSÃO pra mim?', conta: 'onibus', n: 1, fim: 'Valeu demais! O povo chegou todo no horário.', premio: 40 },
  { id: 'gringo', de: 'Wellington', cor: '#7b2d8e', msg: 'Boy, meu amigo gringo chegou e quer conhecer a cidade. Leva um turista pra passear pelo GUIA ARRETADO?', conta: 'turismo', n: 1, fim: 'Ele amou! Disse que vai voltar pro carnaval. 🇧🇷', premio: 35 },
  { id: 'castelo', de: 'Prima Júlia (SP)', cor: '#3ac0a0', msg: 'Primo, me disseram que tem um CASTELO no Recife?? Manda foto do Instituto Ricardo Brennand!', foto: 'o Instituto Ricardo Brennand', fim: 'Gente, parece a Europa! Recife é outro nível.', premio: 30 },
  { id: 'tapioca', de: 'Mainha', cor: '#e07aa8', msg: 'Meu filho, faz umas entregas no TAPIOCA JÁ pra juntar um dinheirinho, que o mês tá apertado.', conta: 'entrega', n: 2, fim: 'Isso, meu filho! Trabalhador igual teu pai. ❤️', premio: 30 },
  { id: 'jaqueira', de: 'Kaline', cor: '#d7263d', msg: 'Bora dar uma volta no Parque da Jaqueira? Tira uma foto de lá pra eu ver se tá cheio!', foto: 'o Parque da Jaqueira', fim: 'Tá lindo! Domingo a gente vai correr lá.', premio: 20 },
  { id: 'pipoca', de: 'Dona Socorro (vizinha)', cor: '#f2b705', msg: 'Meu filho, compra mais umas coisinhas do pessoal que vende no sinal. Eles vivem disso!', conta: 'sinal', n: 2, fim: 'Deus te pague! Gente boa é assim.', premio: 25 },
  { id: 'km', de: 'Seu Biu', cor: '#2a9d58', msg: 'Rapaz, tô pensando em comprar um carro. Roda uns 5 km por aí e me diz se o trânsito tá muito ruim.', conta: 'km', n: 5, fim: 'Vixe, então vou continuar de busão mesmo! Obrigado.', premio: 20 },
];
PEDIDOS.push(
  { id: 'caranguejada', de: 'Painho', cor: '#8a5a2b', msg: 'Filho, domingo tem caranguejada aqui em casa! Passa num mangue (Ilha de Deus, Pina, Afogados...) e compra uma corda com o catador.', conta: 'caranguejo', n: 1, fim: 'Caranguejo, pirão e cerveja gelada. Domingo perfeito! 🦀', premio: 40 },
  { id: 'macaxeira', de: 'Mainha', cor: '#e07aa8', msg: 'Meu filho, amanhã cedo passa na feira (Casa Amarela, Encruzilhada, Madalena...) e traz macaxeira, que eu vou fazer com charque!', conta: 'feira', n: 1, fim: 'Macaxeira com charque saindo! Vem almoçar, viu?', premio: 25 },
  { id: 'missa', de: 'Vó', cor: '#b49a5e', msg: 'Meu neto, me leva na missa da Igreja da Madre de Deus, lá no Bairro do Recife? Tô aqui em Casa Forte. Bico ⭐ no teu celular.', conta: 'historia:missa', n: 1, fim: 'Rezei por tu, meu neto. E o padre fez um sermão lindo.', premio: 30,
    missao: { id: 'missa', nome: 'Vó', de: { poi: /^Praça de Casa Forte/, nome: 'Praça de Casa Forte' }, para: { poi: /^Igreja Matriz Madre de Deus$|^Igreja da Madre de Deus$/, nome: 'Igreja da Madre de Deus' }, pay: 35, oi: 'Devagar, meu neto, que eu não sou mais menina!', tchau: 'Ouviu o sino? Chegamos bem na hora!', pegou: 'Vó entrou no carro com o terço na mão.' } },
);
// história: a Prima Júlia vem visitar (só depois da foto do Paço do Frevo). O pedido vira um bico ⭐ no celular.
PEDIDOS.push({ id: 'chegada', depois: 'prima', de: 'Prima Júlia (SP)', cor: '#3ac0a0', msg: 'PRIMOOO! Comprei a passagem, chego amanhã no aeroporto! Me busca lá e me leva pra casa de vó em Casa Forte? Tá no teu celular, bico ⭐.', conta: 'historia:chegada', n: 1, fim: 'Recife é muito mais quente do que eu pensava 😂 Vó já fez bolo de rolo! Obrigada, primo ❤️', premio: 50,
  missao: { id: 'chegada', nome: 'a Prima Júlia', de: { poi: /^Terminal Integrado Aeroporto/, nome: 'Terminal Integrado do Aeroporto' }, para: { poi: /^Praça de Casa Forte/, nome: 'Praça de Casa Forte' }, pay: 45, oi: 'PRIMO! Aqui! Tô morrendo de calor!', tchau: 'Chegamos! Vó tá na janela acenando!' } });
PEDIDOS.push(
  { id: 'passeio', depois: 'chegada', de: 'Prima Júlia (SP)', cor: '#3ac0a0', msg: 'Primo, hoje eu quero conhecer o Recife Antigo! Me pega aqui em vó e me leva no Marco Zero? Bico ⭐ no teu celular.', conta: 'historia:passeio', n: 1, fim: 'Gente, o Marco Zero com aquele mar e as esculturas do Brennand lá do outro lado... tô apaixonada 😍', premio: 40,
    missao: { id: 'passeio', nome: 'a Prima Júlia', de: { poi: /^Praça de Casa Forte/, nome: 'Praça de Casa Forte' }, para: { poi: /^Marco Zero$/, nome: 'Marco Zero' }, pay: 40, oi: 'Bora! Passei protetor e tudo!', tchau: 'Que lugar lindo! Vou tirar mil fotos!' } },
  { id: 'frevo', depois: 'passeio', de: 'Prima Júlia (SP)', cor: '#3ac0a0', msg: 'Me disseram que tem uma troça de frevo que sai à tarde no Recife Antigo. Me ensina a dançar? Chega lá e dança (G) comigo!', conta: 'bloco', n: 1, fim: 'Eu não sei dançar frevo, mas pulei feito doida! Melhor dia da viagem 🎺', premio: 35 },
  { id: 'volta', depois: 'frevo', de: 'Prima Júlia (SP)', cor: '#3ac0a0', msg: 'Primo... acabou a viagem 😭 Me leva pro aeroporto? Tô aqui em vó com as malas (e três bolos de rolo).', conta: 'historia:volta', n: 1, fim: 'Já tô com saudade do Recife. Ano que vem eu volto pro carnaval, me espera! Te amo, primo ❤️', premio: 80,
    missao: { id: 'volta', nome: 'a Prima Júlia', de: { poi: /^Praça de Casa Forte/, nome: 'Praça de Casa Forte' }, para: { poi: /^Terminal Integrado Aeroporto/, nome: 'Terminal Integrado do Aeroporto' }, pay: 50, oi: 'Cuidado com os bolos de rolo no porta-malas!', tchau: 'Tchau, Recife! Volto no carnaval!' } },
);
// história 2: aniversário de Mainha (começa depois do primeiro pedido de Mainha). Painho combina tudo em segredo.
PEDIDOS.push(
  { id: 'niver1', depois: 'mainha', de: 'Painho', cor: '#8a5a2b', msg: 'Ei, filho, é segredo: domingo é aniversário de tua mãe! Junta R$ 300 pra gente fazer uma festa surpresa. Quando tiver, eu pego contigo.', ok: () => save.money >= 300, fim: 'Peguei os R$ 300 aqui. Já encomendei os salgadinhos e o guaraná! 🤫', premio: -300 },
  { id: 'niver2', depois: 'niver1', de: 'Painho', cor: '#8a5a2b', msg: 'Agora busca o bolo de rolo que eu encomendei lá na Casa da Cultura e traz pra Praça de Casa Forte, que a festa vai ser em vó. Bico ⭐!', conta: 'historia:niver2', n: 1, fim: 'Que bolo bonito! Escondi no quarto de vó.', premio: 60,
    missao: { id: 'niver2', nome: 'o bolo de rolo', de: { poi: /^Casa da Cultura$/, nome: 'Casa da Cultura' }, para: { poi: /^Praça de Casa Forte/, nome: 'Praça de Casa Forte' }, pay: 35, oi: 'O bolo do seu Tonho? Tá aqui, cuidado que é de goiabada!', tchau: 'Entregue! Ninguém viu nada.', pegou: 'Bolo de rolo no banco de trás. Devagar nas curvas!' } },
  { id: 'niver3', depois: 'niver2', de: 'Painho', cor: '#8a5a2b', msg: 'Distrai tua mãe! Leva ela pra dar uma volta no Parque da Jaqueira enquanto a gente arruma a casa. Bico ⭐, ela tá em vó.', conta: 'historia:niver3', n: 1, fim: 'Tudo pronto! Pode trazer ela de volta quando quiser 🎉', premio: 50,
    missao: { id: 'niver3', nome: 'Mainha', de: { poi: /^Praça de Casa Forte/, nome: 'Praça de Casa Forte' }, para: { poi: /^Parque da Jaqueira/, nome: 'Parque da Jaqueira' }, pay: 30, oi: 'Que passeio é esse do nada, menino? Tá aprontando, é?', tchau: 'Que tarde linda na Jaqueira, meu filho!' } },
  { id: 'niver4', depois: 'niver3', de: 'Mainha', cor: '#e07aa8', msg: 'MEU FILHO!!! Que festa foi essa?! Vó, Painho, tua prima por vídeo... eu chorei! Tu é o melhor filho do mundo ❤️', ok: () => true, fim: 'Deus te abençoe sempre. Guardei um pedaço de bolo pra tu.', premio: 150 },
);
// história 3: roteiro gastronômico do Wellington, que faz blog de comida (começa depois do pedido do amigo gringo)
const W = (id, de, para, oi, tchau) => ({ id, nome: 'o Wellington', de, para, pay: 35, oi, tchau, pegou: 'Wellington entrou no carro, já filmando tudo pro blog.' });
const lugar = (nome) => ({ poi: new RegExp('^' + nome + '$'), nome });
PEDIDOS.push(
  { id: 'gastro1', depois: 'gringo', de: 'Wellington', cor: '#7b2d8e', msg: 'Boy, meu blog de comida tá crescendo! Me leva num roteiro? Começa no Restaurante Leite, que funciona desde 1882. Me pega no Marco Zero. Bico ⭐!', conta: 'historia:gastro1', n: 1, fim: 'Que lugar! Garçom de gravata, piso antigo... parece que voltei no tempo.', premio: 30,
    missao: W('gastro1', lugar('Marco Zero'), lugar('Restaurante Leite'), 'Bora! Câmera carregada!', 'Chegamos! Já tô sentindo o cheiro daqui.') },
  { id: 'gastro2', depois: 'gastro1', de: 'Wellington', cor: '#7b2d8e', msg: 'Agora peixada! Me leva do Restaurante Leite pro Bargaço, lá no Pina. Bico ⭐.', conta: 'historia:gastro2', n: 1, fim: 'Peixada com pirão... vou ter que dormir depois dessa 😴', premio: 30,
    missao: W('gastro2', lugar('Restaurante Leite'), lugar('Bargaço'), 'Ainda dá pra comer mais, né?', 'Olha o mar ali do lado, que lugar!') },
  { id: 'gastro3', depois: 'gastro2', de: 'Wellington', cor: '#7b2d8e', msg: 'Me disseram que o peixe frito mais famoso é o do Buraco da Velha, em Brasília Teimosa. Bora? Bico ⭐ saindo do Bargaço.', conta: 'historia:gastro3', n: 1, fim: 'Peixe fresquinho, na beira do mar, com o povo da comunidade contando história. Melhor post do blog!', premio: 30,
    missao: W('gastro3', lugar('Bargaço'), lugar('Peixe frito do Buraco da Velha'), 'Brasília Teimosa! Nunca fui, que massa!', 'Que vista do mar, boy!') },
  { id: 'gastro4', depois: 'gastro3', de: 'Wellington', cor: '#7b2d8e', msg: 'Pra fechar: tapioca rendada do Damião, na orla de Boa Viagem. Me pega no Buraco da Velha. Bico ⭐.', conta: 'historia:gastro4', n: 1, fim: 'O post do roteiro bombou: 50 mil curtidas! Tu vai aparecer no vídeo como "o motorista arretado" 😂', premio: 80,
    missao: W('gastro4', lugar('Peixe frito do Buraco da Velha'), lugar('Tapioca Rendada do Damião'), 'A última! Prometo.', 'Tapioca rendada, olha que coisa linda!') },
);
const ESPERA = [120, 240]; // segundos até o próximo pedido

export class Zap {
  constructor({ album, postal, phone, missions, world }) {
    Object.assign(this, { album, postal, phone, missions, world });
    if (!save.zap || typeof save.zap !== 'object') save.zap = { feitos: [], atual: null, conv: [] };
    this.t = 25; // o primeiro chega uns 25 s depois de começar
    onConta((k, v) => this.contou(k, v));
  }

  get Z() { return save.zap; }
  get naoLidas() { return this.Z.conv.filter((m) => !m.lida).length; }

  update(dt) {
    const Z = this.Z;
    if (Z.atual) {
      const P = PEDIDOS.find((p) => p.id === Z.atual.id);
      if (P?.missao && this.missions && !this.missions.fixas?.length) {
        const M = P.missao, acha = (q) => this.world.pois.find((x) => q.poi.test(x.name));
        const de = acha(M.de), para = acha(M.para);
        const o = de && para && this.missions.offerHistoria({ ...M, de: { x: de.x, z: de.z, nome: M.de.nome }, para: { x: para.x, z: para.z, nome: M.para.nome } });
        if (o) { this.missions.fixas = [o]; this.missions.offersAt = -1e9; }
      }
      if (P?.foto && this.album?.spots.some((s) => s.nome === P.foto && this.album.has(s))) this.cumpre(P);
      else if (P?.ok && (this.okT = (this.okT || 0) + dt) > 4 && P.ok()) { this.okT = 0; this.cumpre(P); } // espera uns segundos pra a mensagem ser lida
      return;
    }
    if ((this.t -= dt) > 0) return;
    const jaFoi = (id) => Z.feitos.includes(id) || (Z.historia || []).includes(id);
    let livres = PEDIDOS.filter((p) => !Z.feitos.includes(p.id) && (!p.depois || (jaFoi(p.depois) && !(Z.historia || []).includes(p.id))));
    // acabou a lista: começa outra rodada (o pessoal volta a pedir)
    if (!livres.length) { Z.historia = [...new Set([...(Z.historia || []), ...Z.feitos])]; Z.feitos = []; Z.rodada = (Z.rodada || 1) + 1; livres = PEDIDOS.filter((p) => !p.missao && !p.depois); } // história não repete
    const hist = livres.filter((p) => p.depois); // passo de história liberado vem antes dos pedidos avulsos
    const P = hist.length ? hist[0] : livres[Math.floor(Math.random() * livres.length)];
    Z.atual = { id: P.id, feito: 0 };
    this.chega(P.de, P.msg, P.cor);
    if (P.id === 'chegada' && this.avioes) this.avioes.t = 0; // o avião da prima pousa nos Guararapes
    persist();
  }

  contou(k, v) {
    const A = this.Z.atual;
    if (!A) return;
    const P = PEDIDOS.find((p) => p.id === A.id);
    if (!P || P.conta !== k) return;
    const antes = Math.floor(A.feito);
    A.feito += v;
    if (A.feito >= P.n) this.cumpre(P); else if (Math.floor(A.feito) !== antes) persist(); // km chega aos pedacinhos: grava só a cada 1
  }

  cumpre(P) {
    const Z = this.Z;
    Z.feitos.push(P.id); Z.atual = null;
    if (P.id === 'volta') conta('historia_prima'); // fim da história da prima
    if (P.id === 'niver4') conta('historia_niver'); // fim do aniversário de Mainha
    if (P.id === 'gastro4') conta('historia_gastro'); // fim do roteiro gastronômico
    if (P.missao && this.missions) { this.missions.fixas = []; this.missions.offersAt = -1e9; }
    addMoney(P.premio);
    this.chega(P.de, P.fim, P.cor);
    this.postal?.(`💬 ${P.de}`, P.fim, P.premio < 0 ? `Pedido cumprido · −R$ ${-P.premio}` : `Pedido cumprido · +R$ ${P.premio}`);
    this.t = ESPERA[0] + Math.random() * (ESPERA[1] - ESPERA[0]);
    persist();
  }

  chega(de, txt, cor) {
    const Z = this.Z;
    Z.conv.push({ de, txt, cor, lida: false });
    if (Z.conv.length > 30) Z.conv.splice(0, Z.conv.length - 30);
    let el = document.getElementById('zap-aviso');
    if (!el) { el = document.createElement('div'); el.id = 'zap-aviso'; el.innerHTML = '<b></b><span></span><small>P abre o celular · aba Zap</small>'; document.body.appendChild(el); }
    el.querySelector('b').textContent = '💬 ' + de;
    el.querySelector('span').textContent = txt;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.tm); this.tm = setTimeout(() => el.classList.remove('show'), 8000);
  }

  render(el) {
    const Z = this.Z;
    const P = Z.atual && PEDIDOS.find((p) => p.id === Z.atual.id);
    const topo = P ? `<div class="offer zap-pedido"><span class="app" style="background:${P.cor}">PEDIDO</span><h4>${P.de}</h4><p>${P.msg}</p><div class="pay">${P.premio < 0 ? '−R$ ' + -P.premio : 'R$ ' + P.premio}${P.n > 1 ? `<small>${Math.floor(Z.atual.feito)}/${P.n}</small>` : ''}</div></div>` : '';
    el.innerHTML = topo + [...Z.conv].reverse().map((m) => `<div class="offer zap-msg"><h4 style="color:${m.cor}">${m.de}</h4><p>${m.txt}</p></div>`).join('') || '<p style="color:#a79fbb">Nenhuma mensagem ainda.</p>';
    for (const m of Z.conv) m.lida = true;
    persist();
  }
}
