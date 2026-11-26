// Troféus: contadores do que o jogador fez (guardados no save) e marcas que rendem um prêmio uma vez.
// conta('corrida') soma 1; conta('km', 0.3) soma 0,3. Ao passar de uma marca, aparece o cartão e cai o dinheiro.
import { save, persist, addMoney } from './save.js';

export const TROFEUS = [
  { id: 'corrida1', k: 'corrida', n: 1, nome: 'Primeira corrida', desc: 'Levou o primeiro passageiro no OXECAR.', premio: 10 },
  { id: 'corrida10', k: 'corrida', n: 10, nome: 'Motô de fé', desc: '10 corridas no OXECAR.', premio: 60 },
  { id: 'corrida50', k: 'corrida', n: 50, nome: 'Conhece o Recife de olho fechado', desc: '50 corridas no OXECAR.', premio: 250 },
  { id: 'entrega10', k: 'entrega', n: 10, nome: 'Tapioca quentinha', desc: '10 entregas no TAPIOCA JÁ.', premio: 50 },
  { id: 'turismo5', k: 'turismo', n: 5, nome: 'Guia arretado', desc: 'Levou 5 turistas pra conhecer a cidade.', premio: 60 },
  { id: 'moto5', k: 'moto', n: 5, nome: 'Mototaxista', desc: 'Fez 5 corridas no MOTOXE.', premio: 50 },
  { id: 'onibus3', k: 'onibus', n: 3, nome: 'Busão lotado', desc: 'Fez 3 linhas de ônibus inteiras.', premio: 60 },
  { id: 'pax100', k: 'passageiro', n: 100, nome: 'Cem cabeças', desc: '100 passageiros subiram no teu busão.', premio: 80 },
  { id: 'racha3', k: 'racha', n: 3, nome: 'Rei da beira-mar', desc: 'Ganhou 3 rachas na orla.', premio: 100 },
  { id: 'km10', k: 'km', n: 10, nome: 'Rodou a cidade', desc: '10 km dirigidos.', premio: 30 },
  { id: 'km100', k: 'km', n: 100, nome: 'Pneu careca', desc: '100 km dirigidos.', premio: 150 },
  { id: 'album10', k: 'foto', n: 10, nome: 'Fotógrafo de bolso', desc: '10 lugares no álbum.', premio: 40 },
  { id: 'bloco1', k: 'bloco', n: 1, nome: 'Folião', desc: 'Brincou na Troça Caraí Que Calor.', premio: 20 },
  { id: 'bloco5', k: 'bloco', n: 5, nome: 'Frevo no pé', desc: 'Brincou em 5 desfiles da troça.', premio: 80 },
  { id: 'molhou5', k: 'molhou', n: 5, nome: 'Tabacudo da poça', desc: 'Molhou 5 pessoas passando na poça. Coitados.', premio: 5 },
  { id: 'sinal5', k: 'sinal', n: 5, nome: 'Freguês do sinal', desc: 'Comprou 5 vezes de ambulante no semáforo.', premio: 10 },
  { id: 'jogo1', k: 'jogo', n: 1, nome: 'Arquibancada', desc: 'Foi pra porta do estádio em dia de jogo.', premio: 20 },
  { id: 'jogo3', k: 'jogo', n: 3, nome: 'Trio de Ferro', desc: 'Foi em 3 dias de jogo.', premio: 60 },
  { id: 'praia3', k: 'praia', n: 3, nome: 'Pé na areia', desc: 'Comprou 3 vezes dos vendedores da praia.', premio: 15 },
  { id: 'prima', k: 'historia_prima', n: 1, nome: 'Primo do ano', desc: 'Levou a Prima Júlia do aeroporto ao aeroporto: Marco Zero, frevo e bolo de rolo.', premio: 100 },
  { id: 'niver', k: 'historia_niver', n: 1, nome: 'Filho de ouro', desc: 'Fez a festa surpresa de aniversário de Mainha.', premio: 100 },
  { id: 'gastro', k: 'historia_gastro', n: 1, nome: 'Gourmet do Recife', desc: 'Levou o Wellington no roteiro: Restaurante Leite, Bargaço, Buraco da Velha e tapioca do Damião.', premio: 100 },
  { id: 'blitz3', k: 'blitz', n: 3, nome: 'Documento em dia', desc: 'Passou certinho por 3 blitz.', premio: 30 },
  { id: 'feira3', k: 'feira', n: 3, nome: 'Freguês da feira', desc: 'Comprou 3 vezes na feira livre.', premio: 15 },
  { id: 'camisa', k: 'camisa_time', n: 1, nome: 'Torcedor de verdade', desc: 'Foi pro jogo com a camisa do time da casa.', premio: 25 },
  { id: 'renda1000', k: 'renda', n: 1000, nome: 'Empresário arretado', desc: 'Teus negócios já renderam R$ 1.000.', premio: 100 },
  { id: 'caranguejo', k: 'caranguejo', n: 1, nome: 'Cidade do mangue', desc: 'Comprou caranguejo de um catador no mangue.', premio: 15 },
  { id: 'pipa', k: 'pipa', n: 1, nome: 'Aparador de pipa', desc: 'Aparou uma pipa que voou solta no morro.', premio: 15 },
  { id: 'domino', k: 'domino', n: 1, nome: 'Peru de dominó', desc: 'Assistiu de perto uma partida inteira de dominó na praça.', premio: 10 },
  { id: 'capoeira', k: 'capoeira', n: 1, nome: 'Camará', desc: 'Assistiu de perto a roda de capoeira no Marco Zero.', premio: 15 },
  { id: 'peixe', k: 'peixe', n: 1, nome: 'Pescador do Capibaribe', desc: 'Pescou um peixe na beira do rio com a vara emprestada.', premio: 10 },
  { id: 'camurim', k: 'camurim', n: 1, nome: 'História de pescador', desc: 'Pegou um camurim no Capibaribe. Ninguém acredita.', premio: 40 },
  { id: 'pontes', k: 'volta_pontes', n: 1, nome: 'Veneza brasileira', desc: 'Completou a Volta das Pontes do Centro.', premio: 20 },
  { id: 'pontes_ouro', k: 'volta_pontes_ouro', n: 1, nome: 'Rei das pontes', desc: 'Fez a Volta das Pontes abaixo do tempo de ouro.', premio: 60 },
  { id: 'mamulengo', k: 'mamulengo', n: 1, nome: 'Mamulengueiro', desc: 'Assistiu o mamulengo no Pátio de São Pedro.', premio: 15 },
  { id: 'coco', k: 'coco', n: 1, nome: 'Embolada', desc: 'Assistiu os emboladores de coco no Mercado de São José.', premio: 15 },
  { id: 'artista5', k: 'artista', n: 5, nome: 'Mecenas da rua', desc: 'Jogou 5 moedas pros artistas de rua.', premio: 15 },
  { id: 'corrida_orla', k: 'corrida_orla', n: 1, nome: 'Peito nº 1', desc: 'Completou a Corrida da Orla, 2 km no calçadão de Boa Viagem.', premio: 20 },
  { id: 'corrida_podio', k: 'corrida_podio', n: 1, nome: 'Pódio na orla', desc: 'Chegou entre os três primeiros na Corrida da Orla.', premio: 30 },
  { id: 'corrida_vitoria', k: 'corrida_vitoria', n: 1, nome: 'Campeão da orla', desc: 'Ganhou a Corrida da Orla.', premio: 60 },
  { id: 'quadrilha_viu', k: 'quadrilha_viu', n: 1, nome: 'Olha a fogueira', desc: 'Assistiu o ensaio da quadrilha junina no Sítio da Trindade.', premio: 10 },
  { id: 'quadrilha', k: 'quadrilha', n: 1, nome: 'Matuto arretado', desc: 'Acertou 6 dos 8 passos no ensaio da quadrilha.', premio: 30 },
  { id: 'lenda1', k: 'lenda', n: 1, nome: 'Vi uma lenda', desc: 'Achou a primeira das Lendas do Recife.', premio: 10 },
  { id: 'lenda5', k: 'lenda', n: 5, nome: 'Meio caminho assombrado', desc: 'Achou 5 Lendas do Recife.', premio: 40 },
  { id: 'lendas10', k: 'lendas10', n: 1, nome: 'Caçador de Lendas', desc: 'Achou as 10 Lendas do Recife. O objetivo do jogo!', premio: 100 },
  { id: 'lendas_rapido', k: 'lendas_rapido', n: 1, nome: 'Mais rápido que a Perna Cabeluda', desc: 'Fechou a caçada às Lendas em menos de 20 minutos.', premio: 100 },
  { id: 'forro', k: 'forro', n: 1, nome: 'Arrasta-pé', desc: 'Curtiu o forró pé-de-serra no Mercado da Boa Vista.', premio: 15 },
  { id: 'mirante1', k: 'mirante', n: 1, nome: 'Vista bonita', desc: 'Subiu num mirante e viu o Recife de cima.', premio: 10 },
  { id: 'mirante3', k: 'mirante', n: 3, nome: 'Recife de cima', desc: 'Viu a vista de 3 mirantes diferentes.', premio: 40 },
  { id: 'passageiro', k: 'passageiro', n: 1, nome: 'Via Livre', desc: 'Andou de ônibus no corredor da Conde da Boa Vista.', premio: 10 },
  { id: 'gol_praia', k: 'gol_praia', n: 1, nome: 'Craque da areia', desc: 'Fez um gol na pelada da praia de Boa Viagem.', premio: 20 },
  { id: 'bike_aluguel', k: 'bike_aluguel', n: 1, nome: 'Pedalando no Recife', desc: 'Alugou uma bicicleta compartilhada.', premio: 10 },
  { id: 'malabarista', k: 'malabarista', n: 1, nome: 'Respeita o artista', desc: 'Deu uma moeda pro malabarista do sinal.', premio: 5 },
  { id: 'catamara', k: 'catamara', n: 1, nome: 'Veneza de catamarã', desc: 'Fez o passeio de catamarã pelo Capibaribe até o fim.', premio: 25 },
  { id: 'casamento', k: 'casamento', n: 1, nome: 'Padrinho de ocasião', desc: 'Viu a saída de um casamento na porta da igreja.', premio: 10 },
  { id: 'corte', k: 'corte', n: 1, nome: 'Na régua', desc: 'Cortou o cabelo numa barbearia de bairro.', premio: 10 },
  { id: 'corte4', k: 'corte', n: 4, nome: 'Cliente fiel', desc: 'Cortou o cabelo 4 vezes na barbearia.', premio: 20 },
  { id: 'chuva1', k: 'toro', n: 1, nome: 'Debaixo do toró', desc: 'Enfrentou o primeiro toró.', premio: 15 },
];

if (!save.stats || typeof save.stats !== 'object') save.stats = {};
if (!Array.isArray(save.trofeus)) save.trofeus = [];

let mostrar = null; // cartão na tela (o álbum empresta o dele)
export function onTrofeu(f) { mostrar = f; }

const ouvintes = []; // quem quer saber quando algo é contado (o Zap usa pra ver se o pedido foi cumprido)
export function onConta(f) { ouvintes.push(f); }

export function conta(k, v = 1) {
  const S = save.stats;
  S[k] = (S[k] || 0) + v;
  for (const f of ouvintes) f(k, v);
  for (const t of TROFEUS) {
    if (t.k !== k || save.trofeus.includes(t.id) || S[k] < t.n) continue;
    save.trofeus.push(t.id);
    addMoney(t.premio);
    mostrar?.(`🏆 ${t.nome}`, t.desc, `Troféu ${save.trofeus.length}/${TROFEUS.length} · +R$ ${t.premio}`);
  }
  // km entra várias vezes por segundo: grava de vez em quando
  if (k !== 'km' || Math.floor(S.km * 2) !== Math.floor((S.km - v) * 2)) persist();
}

export function renderTrofeus(el) {
  const S = save.stats;
  const fmt = (t) => (t.k === 'km' ? (S.km || 0).toFixed(1).replace('.', ',') : Math.floor(S[t.k] || 0)) + ' / ' + t.n;
  const lista = [...TROFEUS].sort((a, b) => save.trofeus.includes(a.id) - save.trofeus.includes(b.id));
  el.innerHTML = lista.map((t) => {
    const ok = save.trofeus.includes(t.id), p = Math.min(1, (S[t.k] || 0) / t.n);
    return `<div class="offer trofeu${ok ? ' got' : ''}"><span class="app" style="background:${ok ? '#ffd166' : '#6d6788'}">${ok ? '🏆 GANHO' : 'FALTA'}</span>
      <h4>${t.nome}</h4><p>${t.desc}</p>
      <div class="barra"><i style="width:${Math.round(p * 100)}%"></i></div>
      <div class="pay"><small>${fmt(t)} · prêmio R$ ${t.premio}</small></div></div>`;
  }).join('');
}

export const contagem = () => `${save.trofeus.length}/${TROFEUS.length}`;
