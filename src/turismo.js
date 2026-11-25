// Bico de turismo (app GUIA ARRETADO): buscar um visitante perto do jogador e levar até um marco da cidade.
// Na chegada, o motorista conta em uma frase o que é o lugar. Os destinos são achados nos POIs do mapa pelo nome
// (um destino que o mapa não tem fica de fora). Texto próprio, curto, com fato verificável.

export const TOURS = [
  { re: /^Marco Zero$/, nome: 'o Marco Zero', fato: 'Daqui se contam as distâncias de Pernambuco. Do outro lado do mar fica o Parque das Esculturas do Brennand, no molhe.' },
  { re: /^Paço do Frevo$/, nome: 'o Paço do Frevo', fato: 'O frevo é Patrimônio Imaterial da Humanidade desde 2012. Lá dentro tem as orquestras, os passos e as sombrinhas.' },
  { re: /^Embaixada de Pernambuco - Bonecos Gigantes/, nome: 'a Embaixada dos Bonecos Gigantes', fato: 'Os bonecos gigantes saem no carnaval de Olinda. Aqui dá pra ver de perto os mais famosos.' },
  { re: /^Museu Cais do Sertão$/, nome: 'o Cais do Sertão', fato: 'Museu do sertão e de Luiz Gonzaga, o Rei do Baião, no armazém do porto.' },
  { re: /^Sinagoga Kahal Zur Israel$/, nome: 'a Sinagoga Kahal Zur Israel', fato: 'A primeira sinagoga das Américas, do tempo dos holandeses, na Rua do Bom Jesus.' },
  { re: /^Casa da Cultura$/, nome: 'a Casa da Cultura', fato: 'Era a Casa de Detenção. Hoje as celas são lojinhas de artesanato pernambucano.' },
  { re: /^Teatro Santa Isabel$/, nome: 'o Teatro Santa Isabel', fato: 'Teatro de 1850, na Praça da República, vizinho do Palácio do Campo das Princesas.' },
  { re: /^Capela Dourada$/, nome: 'a Capela Dourada', fato: 'Capela da Ordem Terceira de São Francisco, toda forrada de talha em ouro.' },
  { re: /^Igreja (Matriz )?da Madre de Deus$/, nome: 'a Madre de Deus', fato: 'Igreja barroca do Bairro do Recife, de frente pro cais.' },
  { re: /^Forte das Cinco Pontas$/, nome: 'o Forte das Cinco Pontas', fato: 'Forte do século XVII que hoje guarda o Museu da Cidade do Recife.' },
  { re: /^Basílica Sagrado Coração de Jesus$/, nome: 'a Basílica do Sagrado Coração', fato: 'A igreja gótica alta da Boa Vista, que se vê de longe.' },
  { re: /^Parque 13 de Maio$/, nome: 'o Parque 13 de Maio', fato: 'Parque no centro, na Rua da Aurora, com lago, coreto e muita sombra.' },
  { re: /^Parque da Jaqueira$/, nome: 'o Parque da Jaqueira', r: 150, fato: 'Pista de cooper, parquinho e a capelinha do século XVIII lá dentro.' },
  { re: /^Praça de Casa Forte$/, nome: 'a Praça de Casa Forte', fato: 'O primeiro jardim público de Burle Marx, de 1935, com plantas da Amazônia e da Caatinga.' },
  { re: /^Sítio da Trindade$/, nome: 'o Sítio da Trindade', r: 150, fato: 'Ali foi o Arraial do Bom Jesus, contra os holandeses. Hoje é o palco do São João de Casa Amarela.' },
  { re: /^Museu do Homem do Nordeste$/, nome: 'o Museu do Homem do Nordeste', fato: 'Museu criado por Gilberto Freyre, com o cotidiano, a fé e o trabalho do Nordeste.' },
  { re: /^Instituto Ricardo Brennand$|^Museu Instituto Ricardo Brennand$/, nome: 'o Instituto Ricardo Brennand', r: 150, fato: 'Um castelo na Várzea, com armaduras, espadas e a maior coleção particular de quadros de Frans Post.' },
  { re: /^Oficina Brennand$/, nome: 'a Oficina Brennand', r: 150, fato: 'Ateliê de Francisco Brennand numa olaria antiga, cheio de esculturas de cerâmica.' },
  { re: /^Zoológico Dois Irmãos$/, nome: 'o Parque Dois Irmãos', r: 150, fato: 'O zoológico fica dentro de um pedaço de Mata Atlântica, com açude e trilha.' },
  { re: /^Universidade Federal de Pernambuco$/, nome: 'a UFPE', r: 150, fato: 'A Cidade Universitária, com o Hospital das Clínicas e o RU mais disputado do Recife.' },
  { re: /^Parque Histórico Nacional dos Guararapes$/, nome: 'os Montes Guararapes', r: 150, fato: 'Onde foram as Batalhas dos Guararapes, no século XVII. Dizem que ali nasceu o Exército Brasileiro.' },
];

export const TURISTAS = [
  ['Seu Hans', 'turista da Alemanha'], ['Dona Marta', 'de São Paulo'], ['Kevin', 'de Fortaleza'], ['Lúcia', 'de Lisboa'],
  ['Tio Zé', 'de Caruaru'], ['Mariana', 'de Belo Horizonte'], ['Akira', 'turista do Japão'], ['Dona Fátima', 'de Petrolina'],
  ['Pierre', 'turista da França'], ['Renata', 'do Rio'],
];

export const FALAS_TURISTA = [
  'Que calor é esse, meu Deus? É sempre assim?', 'Me disseram que tem que provar bolo de rolo. É verdade?', 'Isso aqui é a Veneza brasileira, né?',
  'Quantas pontes tem esse Recife, hein?', 'Moço, é verdade que tem tubarão em Boa Viagem?', 'Eu quero ver frevo de verdade antes de ir embora!',
  'O que é "visse"? Todo mundo fala!', 'Bota um frevo no rádio, motorista!', 'Depois tu me ensina onde come um caldinho bom?',
  'Que coisa linda esse rio no meio da cidade!',
];

// destinos que existem no mapa: { x, z, nome, fato } (um por destino, no primeiro POI que bate)
export function tourSpots(pois) {
  const out = [];
  for (const t of TOURS) {
    const p = pois.find((q) => t.re.test(q.name));
    if (p) out.push({ x: p.x, z: p.z, nome: t.nome, fato: t.fato, r: t.r || 70 });
  }
  return out;
}
