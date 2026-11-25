// Comunidades e a cultura delas: casario autoconstruído, paredão de brega, roda de passinho, terreiro de umbanda,
// campo de pelada e, em Brasília Teimosa, jangadas e oferendas a Iemanjá na beira-mar.
// Tudo é procurado em espaço livre dentro de cada comunidade (praças primeiro), sem invadir prédio, rua ou água.
import * as THREE from 'three';
import { comSemente } from './semente.js';
import { makePerson } from './models.js';
import { stampMesh, stampDisc } from './collide.js';
import { heightAt } from './terrain.js';
import { compactGroup } from './compactar.js';

export const COMMUNITIES = [
  { name: 'Brasília Teimosa', bairro: 'Brasília Teimosa', R: 430, beach: true },
  { name: 'Coque', bairro: 'Ilha Joana Bezerra', R: 330 },
  // Ilha de Deus: comunidade de pescadores e marisqueiras no mangue da Bacia do Pina. A área é a própria ilha
  // (terra ligada ao ponto do OSM, sem atravessar água), não um círculo.
  { name: 'Ilha de Deus', poi: 'Ilha de Deus', R: 320, island: true },
  // morros da zona norte: os dois maiores ganham paredão, roda, terreiro e pelada, além do que é só deles
  { name: 'Morro da Conceição', bairro: 'Morro da Conceição', R: 430, special: 'conceicao' },
  { name: 'Alto José do Pinho', bairro: 'Alto José do Pinho', R: 360, special: 'palco' },
  // morros e comunidades que antes só tinham o casario: cada uma ganha um pedaço da vida cultural, variando entre
  // elas (paredão de brega, roda de passinho, terreiro, pelada, ensaio de maracatu de baque virado)
  { name: 'Alto do Mandu', bairro: 'Alto do Mandu', R: 340, feat: ['paredao', 'pelada'] },
  { name: 'Alto Santa Teresinha', bairro: 'Alto Santa Teresinha', R: 340, feat: ['roda', 'terreiro'] },
  { name: 'Alto José Bonifácio', bairro: 'Alto José Bonifácio', R: 340, feat: ['maracatu', 'pelada'] },
  { name: 'Vasco da Gama', bairro: 'Vasco da Gama', R: 340, feat: ['paredao', 'roda'] },
  { name: 'Alto Nossa Senhora de Fátima', bairro: 'Alto Nossa Senhora de Fátima', R: 340, feat: ['terreiro', 'pelada'] },
  { name: 'Córrego do Botijão', bairro: 'Córrego do Botijão', R: 340, feat: ['roda', 'pelada'] },
  { name: 'Bolo de Noiva', bairro: 'Bolo de Noiva', R: 340, feat: ['paredao'] },
  { name: 'Linha do Tiro', bairro: 'Linha do Tiro', R: 340, feat: ['maracatu', 'roda'] },
  { name: 'Bomba do Hemetério', bairro: 'Bomba do Hemetério', R: 340, feat: ['maracatu', 'paredao', 'terreiro'] },
  // comunidades que não tinham nada (centro pelo bairro do OSM ou pelo endereço pesquisado)
  { name: 'Santo Amaro', bairro: 'Santo Amaro', R: 300, feat: ['maracatu', 'pelada'] },
  { name: 'Coelhos', bairro: 'Coelhos', R: 260, feat: ['paredao', 'roda'] },
  { name: 'Mustardinha', bairro: 'Mustardinha', R: 300, feat: ['paredao', 'pelada'] },
  { name: 'Vila Tamandaré', bairro: 'Vila Tamandaré', R: 240, feat: ['roda', 'pelada'] },
  { name: 'Peixinhos', bairro: 'Peixinhos', R: 320, feat: ['maracatu', 'paredao'] },
  { name: 'Pilar', at: [3188, -4579], R: 160, feat: ['roda'] },
  { name: 'Caranguejo Tabaiares', at: [-562, -3148], R: 220, feat: ['paredao', 'pelada'] },
  { name: 'Vila Santa Luzia', at: [-1493, -6052], R: 220, feat: ['roda', 'pelada'] },
  { name: 'Ilha do Joaneiro', at: [1739, -6183], R: 240, feat: ['paredao', 'pelada'] },
  // Recife inteiro (o mapa padrão): comunidades dos bairros novos, pelo centro do bairro no OSM
  { name: 'Roda de Fogo', bairro: 'Torrões', R: 320, feat: ['paredao', 'roda', 'pelada'] },
  { name: 'Detran', bairro: 'Iputinga', R: 300, feat: ['paredao', 'pelada'] },
  { name: 'UR-7', bairro: 'Várzea', R: 280, feat: ['roda', 'pelada'] },
  { name: 'Ibura', bairro: 'Ibura', R: 520, feat: ['paredao', 'roda', 'terreiro', 'pelada'] },
  { name: 'Jordão', bairro: 'Jordão', R: 420, feat: ['paredao', 'pelada'] },
  { name: 'Nova Descoberta', bairro: 'Nova Descoberta', R: 440, feat: ['maracatu', 'paredao', 'pelada'] },
  { name: 'Passarinho', bairro: 'Passarinho', R: 420, feat: ['paredao', 'roda'] },
  { name: 'Dois Unidos', bairro: 'Dois Unidos', R: 400, feat: ['terreiro', 'pelada'] },
  { name: 'Brejo de Beberibe', bairro: 'Brejo de Beberibe', R: 380, feat: ['roda', 'pelada'] },
  { name: 'Córrego do Jenipapo', bairro: 'Córrego do Jenipapo', R: 360, feat: ['paredao', 'terreiro'] },
  { name: 'Cohab', bairro: 'Cohab', R: 480, feat: ['paredao', 'roda', 'pelada'] },
];
const BPM = { brega: 150, atabaque: 112, ciranda: 92 };
const has = (c, f) => !c.feat || c.feat.includes(f); // sem lista: tem tudo (as comunidades grandes)

// células de terra da ilha: preenche a partir do ponto sem atravessar água, até R metros
function islandCells(grid, x, z, R) {
  const { GW, GH, xmin, zmin, RES, mask } = grid, WATER = 1;
  const i0 = Math.floor((z - zmin) / RES) * GW + Math.floor((x - xmin) / RES);
  const set = new Set([i0]), q = [i0];
  while (q.length) {
    const i = q.pop(), cx = i % GW, cz = (i / GW) | 0;
    for (const j of [i + 1, i - 1, i + GW, i - GW]) {
      if (set.has(j) || j < 0 || j >= GW * GH || (mask[j] & WATER)) continue;
      const jx = xmin + (j % GW + 0.5) * RES, jz = zmin + (((j / GW) | 0) + 0.5) * RES;
      if (Math.hypot(jx - x, jz - z) > R) continue;
      set.add(j); q.push(j);
    }
  }
  return set;
}

// ---------------------------------------------------------------- antes dos prédios: casario de comunidade
const VIVID = ['#e63946', '#2a9d8f', '#3a86ff', '#ffbe0b', '#8338ec', '#fb5607', '#06d6a0', '#f4a6c6', '#9ad1d4', '#f2e3a0', '#e9c46a', '#f1f1ee', '#c9b9a3', '#c9b9a3'];
export function prepareCommunities(data, grid) {
  let seed = 4242; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let n = 0;
  for (const c of COMMUNITIES) {
    const b0 = c.at ? { x: c.at[0], z: c.at[1] } : c.poi ? data.pois.find((p) => p.name === c.poi) : data.bairros.find((b) => b.name === c.bairro); if (!b0) continue;
    if (c.at && !data.bairros.some((b) => b.name === c.name)) data.bairros.push({ name: c.name, x: c.at[0], z: c.at[1] }); // aparece no HUD
    c.x = b0.x; c.z = b0.z;
    if (c.island && grid) c.cells = islandCells(grid, c.x, c.z, c.R);
    // a ilha aparece como "bairro" no HUD (o mais perto é o que vale)
    if (c.island && !data.bairros.some((b) => b.name === c.name)) data.bairros.push({ name: c.name, x: c.x, z: c.z });
    const inZone = (x, z) => {
      if (!c.cells) return Math.hypot(x - c.x, z - c.z) <= c.R;
      const { GW, xmin, zmin, RES } = grid; return c.cells.has(Math.floor((z - zmin) / RES) * GW + Math.floor((x - xmin) / RES));
    };
    c.inZone = inZone;
    for (const b of data.buildings) {
      if (b.n || b.gen || (b.h && b.h > 15) || ['church', 'school', 'warehouse', 'industrial', 'commercial', 'retail', 'roof'].includes(b.t)) continue;
      const x = b.cx, z = b.cz;
      if (!inZone(x, z)) continue;
      const floors = 1 + (rnd() < 0.5 ? 1 : 0) + (rnd() < 0.15 ? 1 : 0);
      b.h = floors * 3 + rnd() * 0.3; b.style = 'comunidade'; b.c = VIVID[Math.floor(rnd() * VIVID.length)];
      if (rnd() < 0.8) b.tank = [(rnd() - 0.5) * 2, (rnd() - 0.5) * 2];
      n++;
    }
  }
  // Centro de Artes Ilha de Deus vira lugar (placa e HUD)
  const ca = data.buildings.find((b) => b.n === 'Centro de Artes Ilha de Deus');
  if (ca && !data.pois.some((p) => p.name === ca.n)) { const r = ca.p; data.pois.push({ name: ca.n, kind: 'arts_centre', x: r.reduce((s, p) => s + p[0], 0) / r.length, z: r.reduce((s, p) => s + p[1], 0) / r.length }); }
  return n;
}

// ---------------------------------------------------------------- danças
export function dance(p, t, style, ph = 0) {
  const u = p.userData; if (!u.legL) return;
  if (style === 'passinho') {
    // pés rápidos, abre-fecha, corpo solto e quicando no tempo
    const w = t * (BPM.brega / 60) * Math.PI * 2 * 0.5 + ph, s = Math.sin(w), c = Math.cos(w * 2);
    u.legL.rotation.set(s * 0.55, 0, -0.08 + c * 0.22); u.legR.rotation.set(-s * 0.55, 0, 0.08 - c * 0.22);
    u.kneeL.rotation.x = 0.35 + Math.max(0, s) * 0.9; u.kneeR.rotation.x = 0.35 + Math.max(0, -s) * 0.9;
    u.armL.rotation.set(-s * 0.7 - 0.3, 0, -0.35 - Math.abs(c) * 0.3); u.armR.rotation.set(s * 0.7 - 0.3, 0, 0.35 + Math.abs(c) * 0.3);
    u.elbowL.rotation.x = -0.9; u.elbowR.rotation.x = -0.9;
    u.upper.position.y = -0.06 + Math.abs(Math.sin(w * 2)) * 0.07; u.upper.rotation.set(0.12, s * 0.25, c * 0.06);
  } else if (style === 'brega') {
    // gingado de brega: quadril e ombros balançando, braços dobrados
    const w = t * (BPM.brega / 60) * Math.PI * 0.5 + ph, s = Math.sin(w);
    u.legL.rotation.set(Math.max(0, s) * 0.25, 0, -0.05); u.legR.rotation.set(Math.max(0, -s) * 0.25, 0, 0.05);
    u.kneeL.rotation.x = 0.15 + Math.max(0, s) * 0.35; u.kneeR.rotation.x = 0.15 + Math.max(0, -s) * 0.35;
    u.armL.rotation.set(-0.6, 0, -0.25 + s * 0.2); u.armR.rotation.set(-0.6, 0, 0.25 + s * 0.2);
    u.elbowL.rotation.x = -1.3; u.elbowR.rotation.x = -1.3;
    u.upper.position.y = Math.abs(Math.cos(w)) * 0.03; u.upper.rotation.set(0, s * 0.35, s * 0.08);
  } else if (style === 'ciranda') {
    // roda de ciranda: de mãos dadas, pisando forte no tempo e balançando junto
    const w = t * (BPM.ciranda / 60) * Math.PI + ph, s = Math.sin(w);
    u.legL.rotation.set(Math.max(0, s) * 0.35, 0, -0.05); u.legR.rotation.set(Math.max(0, -s) * 0.35, 0, 0.05);
    u.kneeL.rotation.x = 0.1 + Math.max(0, s) * 0.4; u.kneeR.rotation.x = 0.1 + Math.max(0, -s) * 0.4;
    u.armL.rotation.set(-0.2 + s * 0.15, 0, -1.05); u.armR.rotation.set(-0.2 - s * 0.15, 0, 1.05);
    u.elbowL.rotation.x = -0.15; u.elbowR.rotation.x = -0.15;
    u.upper.position.y = Math.abs(s) * 0.03; u.upper.rotation.set(0.05 + Math.max(0, s) * 0.08, 0, 0);
  } else if (style === 'marisca') {
    // marisqueira catando sururu: agachada na lama, mãos na água
    const w = t * 1.3 + ph, s = Math.sin(w);
    u.legL.rotation.set(-1.2, 0, -0.15); u.legR.rotation.set(-1.0, 0, 0.15); u.kneeL.rotation.x = 1.9; u.kneeR.rotation.x = 1.7;
    u.armL.rotation.set(-1.1 + s * 0.25, 0, -0.1); u.armR.rotation.set(-1.2 - s * 0.25, 0, 0.1);
    u.elbowL.rotation.x = -0.2; u.elbowR.rotation.x = -0.3;
    u.upper.position.y = -0.35; u.upper.rotation.set(0.7, 0, 0);
  } else if (style === 'rema') {
    // pescador sentado remando na canoa
    const w = t * 1.6 + ph, s = Math.sin(w);
    u.legL.rotation.set(-1.45, 0, 0.1); u.legR.rotation.set(-1.45, 0, -0.1); u.kneeL.rotation.x = 1.5; u.kneeR.rotation.x = 1.5;
    u.armL.rotation.set(-0.9 + s * 0.5, 0, -0.2); u.armR.rotation.set(-0.9 + s * 0.5, 0, 0.2);
    u.elbowL.rotation.x = -0.5; u.elbowR.rotation.x = -0.5;
    u.upper.position.y = 0; u.upper.rotation.set(0.15 + s * 0.12, 0, 0);
  } else if (style === 'baque') {
    // batuqueiro de alfaia: as duas baquetas descem alternadas, corpo marcando o baque virado
    const w = t * (BPM.atabaque / 60) * Math.PI * 2 + ph, a = Math.max(0, Math.sin(w)), b2 = Math.max(0, -Math.sin(w));
    u.legL.rotation.set(0, 0, -0.12); u.legR.rotation.set(0, 0, 0.12); u.kneeL.rotation.x = 0.15; u.kneeR.rotation.x = 0.15;
    u.armL.rotation.set(-1.3 - a * 0.9, 0, 0.3); u.armR.rotation.set(-1.3 - b2 * 0.9, 0, -0.3); u.elbowL.rotation.x = -0.9; u.elbowR.rotation.x = -0.9;
    u.upper.position.y = Math.abs(Math.sin(w)) * 0.03; u.upper.rotation.set(0.08, Math.sin(w * 0.5) * 0.1, 0);
  } else if (style === 'gira') {
    // baiana girando a saia
    p.rotation.y += 0.04 * (ph || 1);
    u.armL.rotation.set(-0.3, 0, -1.1); u.armR.rotation.set(-0.3, 0, 1.1); u.elbowL.rotation.x = -0.3; u.elbowR.rotation.x = -0.3;
    u.legL.rotation.set(0, 0, -0.05); u.legR.rotation.set(0, 0, 0.05); u.upper.position.y = 0; u.upper.rotation.set(0, 0, Math.sin(t * 3) * 0.08);
  } else if (style === 'pesca') {
    // pescador de linha na ponte, parado, mexendo de leve a vara
    const s = Math.sin(t * 0.7 + ph);
    u.legL.rotation.set(0, 0, -0.04); u.legR.rotation.set(0, 0, 0.04); u.kneeL.rotation.x = 0; u.kneeR.rotation.x = 0;
    u.armR.rotation.set(-1.0 + s * 0.08, 0, 0.1); u.elbowR.rotation.x = -0.5; u.armL.rotation.set(-0.3, 0, -0.1); u.elbowL.rotation.x = -0.6;
    u.upper.position.y = 0; u.upper.rotation.set(0.05, 0, 0);
  } else {
    // plateia batendo palma no tempo
    const w = t * (BPM.brega / 60) * Math.PI + ph, k = 0.5 + 0.5 * Math.sin(w);
    u.legL.rotation.set(0, 0, -0.05); u.legR.rotation.set(0, 0, 0.05); u.kneeL.rotation.x = 0.05; u.kneeR.rotation.x = 0.05;
    u.armL.rotation.set(-1.05, 0, 0.15 + k * 0.35); u.armR.rotation.set(-1.05, 0, -0.15 - k * 0.35);
    u.elbowL.rotation.x = -0.7; u.elbowR.rotation.x = -0.7;
    u.upper.position.y = Math.abs(Math.sin(w * 0.5)) * 0.02; u.upper.rotation.set(0, Math.sin(w * 0.25) * 0.1, 0);
  }
  if (u.head) u.head.rotation.y = -u.upper.rotation.y * 0.6;
}

// ---------------------------------------------------------------- passinho do jogador (tecla G em qualquer lugar)
// Cada passo devolve uma pose (ângulos das juntas) e um movimento do corpo inteiro (giro, deslize, pulinho).
// O jogo troca de passo a cada 8 tempos e mistura uma pose na outra, então não fica travando entre eles.
export const PASSOS = ['Tesourinha', 'Caranguejo', 'Quebradeira', 'Giro', 'Cruzado', 'Trava', 'Pulinho'];
const pose = () => ({ legL: [0, 0, -0.05], legR: [0, 0, 0.05], kneeL: 0.1, kneeR: 0.1, armL: [0, 0, -0.1], armR: [0, 0, 0.1], elbowL: -0.3, elbowR: -0.3, up: [0, 0, 0], upY: 0, yaw: 0, side: 0, hop: 0 });
const ease = (x) => x * x * (3 - 2 * x);
export function passinhoPose(move, t) {
  const b = t * BPM.brega / 60, f = b % 1, n = Math.floor(b), P = pose();
  if (move === 'Tesourinha') {
    // pés rápidos abrindo e fechando, corpo solto quicando
    const w = b * Math.PI, s = Math.sin(w), c = Math.cos(w * 2);
    P.legL = [s * 0.55, 0, -0.08 + c * 0.22]; P.legR = [-s * 0.55, 0, 0.08 - c * 0.22];
    P.kneeL = 0.35 + Math.max(0, s) * 0.9; P.kneeR = 0.35 + Math.max(0, -s) * 0.9;
    P.armL = [-s * 0.7 - 0.3, 0, -0.35 - Math.abs(c) * 0.3]; P.armR = [s * 0.7 - 0.3, 0, 0.35 + Math.abs(c) * 0.3];
    P.elbowL = P.elbowR = -0.9; P.upY = -0.06 + Math.abs(Math.sin(w * 2)) * 0.07; P.up = [0.12, s * 0.25, c * 0.06];
  } else if (move === 'Caranguejo') {
    // de lado, abre e fecha as pernas e desliza pra um lado e pro outro
    const w = b * Math.PI, o = Math.abs(Math.sin(w));
    P.legL = [-0.1, 0, -0.1 - o * 0.4]; P.legR = [-0.1, 0, 0.1 + o * 0.4];
    P.kneeL = P.kneeR = 0.5 + o * 0.45;
    P.armL = [-0.5 - o * 0.6, 0, -0.55]; P.armR = [-0.5 - (1 - o) * 0.6, 0, 0.55];
    P.elbowL = P.elbowR = -1.4; P.up = [0.18, 0, -Math.sin(w) * 0.12]; P.upY = -0.1 - o * 0.06;
    P.side = Math.sin(b * Math.PI / 4) * 0.8;
  } else if (move === 'Quebradeira') {
    // o corpo "quebra" seco em cada tempo: agacha, torce e solta
    const hit = Math.exp(-f * 7), d = n % 2 ? 1 : -1;
    P.legL = [-hit * 0.45, 0, -0.14]; P.legR = [-hit * 0.45, 0, 0.14];
    P.kneeL = P.kneeR = 0.3 + hit * 0.9;
    P.up = [0.1 + hit * 0.35, d * 0.4, d * hit * 0.25]; P.upY = -0.15 * hit;
    P.armL = [-0.3 - hit * 1.2, 0, -0.5 - d * 0.35]; P.armR = [-0.3 - (1 - hit) * 0.8, 0, 0.5 - d * 0.35];
    P.elbowL = -0.5 - hit * 1.2; P.elbowR = -1.4 + hit * 0.6;
  } else if (move === 'Giro') {
    // dois tempos girando num pé só, dois tempos aterrissando no balanço
    const q = (b % 4) / 2;
    if (q < 1) {
      P.yaw = ease(q) * Math.PI * 2;
      P.legL = [0, 0, -0.04]; P.kneeL = 0.15; P.legR = [-1.1, 0, 0.12]; P.kneeR = 1.5;
      P.armL = [-0.25, 0, -1.3]; P.armR = [-0.25, 0, 1.3]; P.elbowL = P.elbowR = -0.2; P.up = [0, 0, 0]; P.upY = 0.03;
    } else {
      const hit = Math.exp(-(q - 1) * 2 * 5), s = Math.sin(b * Math.PI);
      P.legL = [s * 0.4, 0, -0.15]; P.legR = [-s * 0.4, 0, 0.15]; P.kneeL = P.kneeR = 0.3 + hit * 0.8;
      P.armL = [-0.9, 0, -0.3 + hit * 0.4]; P.armR = [-0.9, 0, 0.3 - hit * 0.4]; P.elbowL = P.elbowR = -1.2;
      P.up = [0.15 + hit * 0.2, 0, 0]; P.upY = -0.12 * hit;
    }
  } else if (move === 'Cruzado') {
    // perna cruzando na frente da outra, tronco torcendo e braços cruzando junto
    const s = Math.sin(b * Math.PI), a = Math.max(0, s), z = Math.max(0, -s);
    P.legL = [-0.15 * a, 0, -0.1 + 0.42 * a]; P.legR = [-0.15 * z, 0, 0.1 - 0.42 * z];
    P.kneeL = 0.3 + a * 0.35; P.kneeR = 0.3 + z * 0.35;
    P.up = [0.1, s * 0.45, 0]; P.upY = -0.05 + Math.abs(Math.cos(b * Math.PI)) * 0.05;
    P.armL = [-0.7, 0, -0.25 + 0.9 * a]; P.armR = [-0.7, 0, 0.25 - 0.9 * z]; P.elbowL = P.elbowR = -1.1;
  } else if (move === 'Trava') {
    // trava numa pose diferente a cada tempo
    const k = n % 4, m = k === 3 ? -1 : 1;
    if (k === 0 || k === 3) {
      // aponta pro céu com o joelho lá em cima
      P.armR = [-2.8, 0, 0.2 * m]; P.elbowR = 0; P.armL = [-0.3, 0, -0.4]; P.elbowL = -1.5;
      P.legL = [-0.9, 0, 0]; P.kneeL = 1.4; P.legR = [0, 0, 0.05]; P.kneeR = 0.2; P.up = [0.05, 0.2 * m, 0];
      if (m < 0) { [P.armL, P.armR] = [[-2.8, 0, -0.2], [-0.3, 0, 0.4]]; [P.elbowL, P.elbowR] = [0, -1.5]; [P.legL, P.legR, P.kneeL, P.kneeR] = [[0, 0, -0.05], [-0.9, 0, 0], 0.2, 1.4]; }
    } else if (k === 1) {
      // agachado, mãos na frente
      P.legL = [-0.9, 0, -0.25]; P.legR = [-0.9, 0, 0.25]; P.kneeL = P.kneeR = 1.6; P.upY = -0.33;
      P.up = [0.4, 0, 0]; P.armL = [-1.2, 0, -0.3]; P.armR = [-1.2, 0, 0.3]; P.elbowL = P.elbowR = -1.2;
    } else {
      // de lado, um braço aberto e o outro dobrado
      P.up = [0, -0.3, 0.28]; P.armL = [-0.4, 0, -1.4]; P.elbowL = 0; P.armR = [-1.6, 0, 0.6]; P.elbowR = -1.8;
      P.legL = [0, 0, -0.35]; P.legR = [0, 0, 0.1]; P.kneeL = P.kneeR = 0.2;
    }
    P.upY += Math.exp(-f * 10) * -0.04;
  } else {
    // Pulinho: um pulinho por tempo, chutando uma perna de cada vez
    const tuck = Math.sin(f * Math.PI), kick = n % 2;
    P.hop = 4 * f * (1 - f) * 0.2;
    P.legL = [kick ? -0.9 * tuck : 0.1, 0, -0.08]; P.legR = [kick ? 0.1 : -0.9 * tuck, 0, 0.08];
    P.kneeL = kick ? 0.2 : 0.9 * tuck; P.kneeR = kick ? 0.9 * tuck : 0.2;
    P.armL = [-0.4 - tuck * 0.9, 0, -0.4]; P.armR = [-0.4 - tuck * 0.9, 0, 0.4]; P.elbowL = P.elbowR = -1.3;
    P.up = [0.08, (kick ? 1 : -1) * 0.2, 0];
  }
  return P;
}
// leva as juntas na direção da pose (k = 1 encaixa direto)
export function applyPose(p, P, k) {
  const u = p.userData; if (!u.legL) return;
  const r3 = (o, a) => { o.rotation.x += (a[0] - o.rotation.x) * k; o.rotation.y += (a[1] - o.rotation.y) * k; o.rotation.z += (a[2] - o.rotation.z) * k; };
  r3(u.legL, P.legL); r3(u.legR, P.legR); r3(u.armL, P.armL); r3(u.armR, P.armR); r3(u.upper, P.up);
  u.kneeL.rotation.x += (P.kneeL - u.kneeL.rotation.x) * k; u.kneeR.rotation.x += (P.kneeR - u.kneeR.rotation.x) * k;
  u.elbowL.rotation.x += (P.elbowL - u.elbowL.rotation.x) * k; u.elbowR.rotation.x += (P.elbowR - u.elbowR.rotation.x) * k;
  u.upper.position.y += (P.upY - u.upper.position.y) * k;
  if (u.head) u.head.rotation.y = -u.upper.rotation.y * 0.6;
}

// ---------------------------------------------------------------- montagem
// mesma cidade a cada carga: o que esta montagem sorteia vem de uma semente fixa (semente.js)
export function buildCulture(group, data, env) { return comSemente(2202, () => buildCultureSem(group, data, env)); }
function buildCultureSem(group, data, env) {
  const M = new Map();
  const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o })); return M.get(k); };
  const add = (parent, geo, m, x, y, z, ry = 0, solid = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; parent.add(o); if (solid) { parent.updateWorldMatrix(true, true); stampMesh(o); } return o; };
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z) && !env.isRoad(x, z);
  const used = [];
  const clear = (x, z, w, d) => {
    if (used.some(([ux, uz, ur]) => Math.hypot(ux - x, uz - z) < ur + Math.max(w, d) / 2)) return false;
    let lo = Infinity, hi = -Infinity;
    for (let dx = -w / 2; dx <= w / 2; dx += 1.5) for (let dz = -d / 2; dz <= d / 2; dz += 1.5) { if (!free(x + dx, z + dz)) return false; const y = heightAt(x + dx, z + dz); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    return hi - lo < 2.2; // no morro, só onde o chão é quase plano
  };
  const inside = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  // procura espaço w × d: primeiro nas praças da comunidade, depois em qualquer lugar livre dentro dela
  const findSpot = (c, w, d) => {
    const squares = data.parks.filter((q) => q.k !== 'sand' && q.p.some((v) => Math.hypot(v[0] - c.x, v[1] - c.z) < c.R));
    for (const pass of [0, 1]) for (let r = 0; r <= c.R; r += 6) for (let a = 0; a < Math.PI * 2; a += 0.35 * Math.max(0.3, 30 / Math.max(r, 30))) {
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (pass === 0 && !squares.some((q) => inside(q.p, x, z))) continue;
      if (c.inZone && !c.inZone(x, z)) continue;
      if (clear(x, z, w, d)) { used.push([x, z, Math.max(w, d) / 2 + 4]); return [x, z]; }
    }
    return null;
  };
  // direção para o lado mais aberto (para virar o paredão de costas para a parede)
  const openDir = (x, z) => { let best = 0, ba = 0; for (let a = 0; a < Math.PI * 2; a += 0.3) { let f = 0; for (let d = 3; d <= 25; d += 2) { if (env.isSolid(x + Math.sin(a) * d, z + Math.cos(a) * d)) break; f++; } if (f > best) { best = f; ba = a; } } return ba; };

  const clusters = [], sounds = [], danceSpots = [];
  // plateia sem sombra própria: cada pessoa tem ~25 peças e a sombra dobraria as chamadas de desenho
  const people = (n, opts) => Array.from({ length: n }, () => { const p = makePerson(opts); p.traverse((o) => { if (o.isMesh) o.castShadow = false; }); return p; });
  const ledMats = [];
  const lightMats = [];

  for (const c of COMMUNITIES) {
    if (c.x == null) continue;
    if (c.island) { buildIsland(c, group, data, env, { mat, add, clusters, sounds, people, findSpot, used }); continue; }
    if (c.kit === false) continue;
    if (c.special) buildMorro(c, group, data, env, { mat, add, clusters, sounds, people, findSpot });

    // ---- paredão de brega: caixas empilhadas com luz que pisca no tempo, galera dançando na frente
    const sp = has(c, 'paredao') && findSpot(c, 16, 16);
    if (sp) {
      const g = new THREE.Group(); g.position.y = heightAt(sp[0], sp[1]); group.add(g); // no morro, o grupo assenta no chão
      const face = openDir(sp[0], sp[1]), fx = Math.sin(face), fz = Math.cos(face);
      const bx = sp[0] - fx * 6, bz = sp[1] - fz * 6;
      const black = mat('#141414', { roughness: 0.5 }), grill = mat('#2a2a2a', { roughness: 0.8 });
      const led = new THREE.MeshStandardMaterial({ color: '#ff2fa0', emissive: '#ff2fa0', emissiveIntensity: 1.5 }); ledMats.push(led);
      const stand = new THREE.Group(); stand.position.set(bx, 0, bz); stand.rotation.y = face; g.add(stand);
      add(stand, new THREE.BoxGeometry(6.4, 0.4, 2.2), mat('#3a3a3a'), 0, 0.2, 0);
      for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
        const x = (col - 1) * 2.05, y = 0.4 + row * 1.15 + 0.55;
        add(stand, new THREE.BoxGeometry(1.95, 1.1, 1.2), black, x, y, 0);
        add(stand, new THREE.CylinderGeometry(0.4, 0.4, 0.06, 20).rotateX(Math.PI / 2), grill, x, y, 0.62, 0, false);
        add(stand, new THREE.TorusGeometry(0.44, 0.04, 6, 24), led, x, y, 0.64, 0, false);
      }
      add(stand, new THREE.BoxGeometry(6.2, 0.18, 0.2), led, 0, 3.95, 0.5, 0, false);
      add(stand, new THREE.BoxGeometry(1.4, 0.9, 0.9), mat('#2b2b2b'), 3.9, 0.85, 0.6); // mesa do DJ
      const crowd = people(9).map((p, i) => {
        const a = (i / 9) * Math.PI - Math.PI / 2, d = 3 + (i % 3) * 1.6;
        p.position.set(sp[0] + fx * (d - 3) + Math.cos(face) * Math.sin(a) * 5, 0, sp[1] + fz * (d - 3) - Math.sin(face) * Math.sin(a) * 5);
        p.rotation.y = face + Math.PI + (Math.random() - 0.5) * 0.6; g.add(p);
        return { p, style: i % 4 === 0 ? 'passinho' : 'brega', ph: Math.random() * 6 };
      });
      const dj = people(1, { shirt: '#111', hat: 'bone' })[0]; dj.position.set(bx + Math.cos(face) * 3.9 + fx * 1.4, 0, bz - Math.sin(face) * 3.9 + fz * 1.4); dj.rotation.y = face + Math.PI; g.add(dj);
      crowd.push({ p: dj, style: 'brega', ph: 0 });
      clusters.push({ g, x: sp[0], z: sp[1], crowd });
      sounds.push({ kind: 'brega', x: bx, z: bz, base: 0.55, R: 110 });
      data.pois.push({ name: `Paredão do Brega · ${c.name}`, kind: 'attraction', x: bx, z: bz });
    }

    // ---- roda de passinho: plateia em círculo batendo palma, dois dançarinos no meio
    const rp = has(c, 'roda') && findSpot(c, 12, 12);
    if (rp) {
      const g = new THREE.Group(); g.position.y = heightAt(rp[0], rp[1]); group.add(g); // no morro, o grupo assenta no chão
      const crowd = [];
      people(10).forEach((p, i) => { const a = (i / 10) * Math.PI * 2; p.position.set(rp[0] + Math.cos(a) * 3.8, 0, rp[1] + Math.sin(a) * 3.8); p.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); g.add(p); crowd.push({ p, style: 'clap', ph: Math.random() }); });
      people(2, { longSleeve: false }).forEach((p, i) => { p.position.set(rp[0] + (i ? 1 : -1) * 0.9, 0, rp[1]); p.rotation.y = i ? -Math.PI / 2 : Math.PI / 2; g.add(p); crowd.push({ p, style: 'passinho', ph: i * 1.7 }); });
      clusters.push({ g, x: rp[0], z: rp[1], crowd });
      danceSpots.push({ x: rp[0], z: rp[1], r: 7, name: c.name });
      sounds.push({ kind: 'brega', x: rp[0], z: rp[1], base: 0.3, R: 50 });
      data.pois.push({ name: `Roda de Passinho · ${c.name}`, kind: 'attraction', x: rp[0], z: rp[1] });
    }

    // ---- terreiro de umbanda: casa simples branca e azul, bandeirolas, atabaques na porta
    const tp = has(c, 'terreiro') && findSpot(c, 12, 14);
    if (tp) {
      const g = new THREE.Group(); g.position.y = heightAt(tp[0], tp[1]); group.add(g); // no morro, o grupo assenta no chão
      const face = openDir(tp[0], tp[1]);
      const h = new THREE.Group(); h.position.set(tp[0], 0, tp[1]); h.rotation.y = face; g.add(h);
      const white = mat('#f6f4ee', { roughness: 0.85 }), blue = mat('#3d6fb0'), clay = mat('#c46a45', { roughness: 0.85 });
      add(h, new THREE.BoxGeometry(7, 3.4, 9), white, 0, 1.7, -2);
      add(h, new THREE.BoxGeometry(7.05, 0.5, 9.05), blue, 0, 0.25, -2, 0, false);
      const roof = new THREE.Shape(); roof.moveTo(-4, 0); roof.lineTo(4, 0); roof.lineTo(0, 1.8); roof.closePath();
      add(h, new THREE.ExtrudeGeometry(roof, { depth: 9.6, bevelEnabled: false }).translate(0, 0, -4.8), clay, 0, 3.4, -2, 0, false);
      add(h, new THREE.BoxGeometry(1.6, 2.4, 0.1), blue, 0, 1.2, 2.53, 0, false);
      const warm = new THREE.MeshStandardMaterial({ color: '#2a1d14', emissive: '#ffb35a', emissiveIntensity: 0.05 }); lightMats.push(warm);
      add(h, new THREE.BoxGeometry(1.3, 2.1, 0.12), warm, 0, 1.05, 2.56, 0, false);
      for (const x of [-2.4, 2.4]) { add(h, new THREE.BoxGeometry(1, 1, 0.1), blue, x, 2, 2.53, 0, false); }
      // atabaques: rum, rumpi e lé
      const wood = mat('#7a4a2a', { roughness: 0.6 }), skin = mat('#e8dcc0', { roughness: 0.8 });
      [[1.0, 1.25, 0.32], [1.8, 1.05, 0.29], [2.55, 0.85, 0.26]].forEach(([x, hh, r]) => { add(h, new THREE.CylinderGeometry(r, r * 0.7, hh, 14), wood, x, hh / 2, 3.6); add(h, new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.04, 14), skin, x, hh + 0.02, 3.6, 0, false); });
      add(h, new THREE.SphereGeometry(0.25, 12, 8), mat('#b5653a'), -1.5, 0.25, 3.3); // quartinha
      // bandeirolas brancas e azuis
      const poleM = mat('#6b4a33');
      for (const x of [-4.5, 4.5]) add(h, new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), poleM, x, 2.1, 6);
      const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.17, 0, 0), new THREE.Vector3(0.17, 0, 0), new THREE.Vector3(0, -0.35, 0)]); flagGeo.computeVertexNormals();
      const fw = mat('#ffffff', { side: THREE.DoubleSide }), fb = mat('#6fa8dc', { side: THREE.DoubleSide });
      for (const [z0, z1] of [[6, 2.6], [6, 6]]) for (let k = 0; k <= 20; k++) {
        const t = k / 20, x = -4.5 + t * 9, z = z0 + (z1 - z0) * t, y = 4.1 - Math.sin(t * Math.PI) * 0.7;
        if (z0 !== z1 && k % 2) continue;
        add(h, flagGeo, k % 2 ? fb : fw, x, y, z0 === z1 ? z : 6 - t * 3.4, 0, false);
      }
      clusters.push({ g, x: tp[0], z: tp[1], crowd: [] });
      sounds.push({ kind: 'atabaque', x: tp[0], z: tp[1], base: 0.45, R: 70, night: true });
      data.pois.push({ name: `Terreiro de Umbanda · ${c.name}`, kind: 'place_of_worship', x: tp[0], z: tp[1] });
    }

    // ---- campo de pelada de terra com traves e a molecada jogando
    const pp = has(c, 'pelada') && findSpot(c, 28, 16);
    if (pp) {
      const g = new THREE.Group(); g.position.y = heightAt(pp[0], pp[1]); group.add(g); // no morro, o grupo assenta no chão
      const dirt = new THREE.Mesh(new THREE.PlaneGeometry(26, 14).rotateX(-Math.PI / 2), mat('#a07a52', { roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 }));
      dirt.position.set(pp[0], 0.06, pp[1]); dirt.receiveShadow = true; g.add(dirt);
      const post = mat('#f4f4f0');
      for (const sx of [-1, 1]) {
        for (const sz of [-1.6, 1.6]) { const m = add(g, new THREE.CylinderGeometry(0.06, 0.06, 2, 6), post, pp[0] + sx * 12.6, 1, pp[1] + sz, 0, false); stampDisc(m.position.x, m.position.z, 0.1); }
        add(g, new THREE.CylinderGeometry(0.06, 0.06, 3.3, 6).rotateX(Math.PI / 2), post, pp[0] + sx * 12.6, 2, pp[1], 0, false);
      }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat('#ffffff')); g.add(ball);
      const kids = people(6).map((p, i) => { p.scale.multiplyScalar(0.78); g.add(p); return { p, ph: i * 1.1, sx: (i % 2 ? 1 : -1) }; });
      clusters.push({ g, x: pp[0], z: pp[1], crowd: [], extraBodies: kids.map((k) => k.p), pelada: { kids, ball, cx: pp[0], cz: pp[1] } });
      data.pois.push({ name: `Campo de Pelada · ${c.name}`, kind: 'attraction', x: pp[0], z: pp[1] });
    }

    // ---- ensaio de maracatu de baque virado: batuqueiros com alfaias em fileiras, caixas e gonguê na frente,
    // a corte com o pálio (guarda-sol bordado) e as baianas de saia rodada girando
    const mp = c.feat && c.feat.includes('maracatu') && findSpot(c, 20, 16);
    if (mp) {
      const g = new THREE.Group(); g.position.y = heightAt(mp[0], mp[1]); group.add(g);
      const face = openDir(mp[0], mp[1]), fx = Math.sin(face), fz = Math.cos(face), rx = Math.cos(face), rz = -Math.sin(face);
      const crowd = [], wood = mat('#7a4a2a', { roughness: 0.6 }), skinM = mat('#efe3c8', { roughness: 0.8 }), rope = mat('#d8c27a');
      for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
        const lx = (col - 2) * 1.6, lz = -row * 1.7, x = mp[0] + rx * lx + fx * lz, z = mp[1] + rz * lx + fz * lz;
        const p = people(1, { shirt: ['#d7263d', '#f2f2ee', '#1d3557'][row], longSleeve: false })[0]; p.position.set(x, 0, z); p.rotation.y = face; g.add(p);
        const drum = new THREE.Group(); drum.position.set(0, 1.0, 0.32); p.add(drum);
        drum.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.42, 14).rotateZ(Math.PI / 2), wood));
        for (const sx of [-0.22, 0.22]) { const sk = new THREE.Mesh(new THREE.CircleGeometry(0.33, 14), skinM); sk.position.x = sx; sk.rotation.y = Math.PI / 2; drum.add(sk); }
        drum.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 4, 14).rotateY(Math.PI / 2), rope));
        crowd.push({ p, style: 'baque', ph: (col + row) * 0.2 });
      }
      // corte: rei e rainha sob o pálio, e duas baianas
      const cx = mp[0] + fx * 4.5, cz = mp[1] + fz * 4.5;
      const king = people(1, { shirt: '#c9a227', longSleeve: true })[0]; king.position.set(cx - rx * 0.7, 0, cz - rz * 0.7); king.rotation.y = face; g.add(king);
      const queen = people(1, { shirt: '#8338ec', longSleeve: true })[0]; queen.position.set(cx + rx * 0.7, 0, cz + rz * 0.7); queen.rotation.y = face; g.add(queen);
      for (const q of [king, queen]) { const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.14, 8), mat('#d4af37', { metalness: 0.8, roughness: 0.3 })); crown.position.y = 1.95; q.userData.upper.add(crown); crowd.push({ p: q, style: 'brega', ph: 1 }); }
      add(g, new THREE.CylinderGeometry(0.04, 0.04, 3, 6), mat('#6b4a33'), cx - fx * 0.9, 1.5, cz - fz * 0.9, 0, false);
      add(g, new THREE.ConeGeometry(1.5, 0.6, 12, 1, true), mat('#c8102e', { side: THREE.DoubleSide }), cx - fx * 0.9 + fx * 0.6, 3, cz - fz * 0.9 + fz * 0.6, 0, false);
      for (const s2 of [-1, 1]) {
        const b = people(1, { shirt: '#f2f2ee', longSleeve: false })[0]; b.position.set(cx + rx * s2 * 3, 0, cz + rz * s2 * 3); g.add(b);
        const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.0, 16, 1, true), mat(s2 > 0 ? '#e63946' : '#2a9d8f', { side: THREE.DoubleSide })); skirt.position.y = 0.55; b.add(skirt);
        crowd.push({ p: b, style: 'gira', ph: s2 });
      }
      clusters.push({ g, x: mp[0], z: mp[1], crowd });
      sounds.push({ kind: 'atabaque', x: mp[0], z: mp[1], base: 0.55, R: 90 });
      data.pois.push({ name: `Ensaio de Maracatu · ${c.name}`, kind: 'attraction', x: mp[0], z: mp[1] });
    }

    // ---- beira-mar de Brasília Teimosa: jangadas na areia e oferendas a Iemanjá
    if (c.beach) {
      const shore = [];
      for (let r = 60; r <= c.R + 100 && shore.length < 40; r += 8) for (let a = 0; a < Math.PI * 2; a += 0.12) {
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (!free(x, z)) continue;
        const toWater = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => k * Math.PI / 4).find((b) => env.isWater(x + Math.sin(b) * 6, z + Math.cos(b) * 6));
        if (toWater != null && shore.every((s) => Math.hypot(s[0] - x, s[1] - z) > 25)) shore.push([x, z, toWater]);
      }
      const wood = mat('#8a6a48', { roughness: 0.9 }), sail = mat('#f6f1e3', { side: THREE.DoubleSide, roughness: 0.8 });
      shore.slice(0, 6).forEach(([x, z, b], i) => {
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = b + Math.PI / 2; group.add(g);
        add(g, new THREE.BoxGeometry(1.5, 0.35, 5.2), wood, 0, 0.2, 0);
        add(g, new THREE.CylinderGeometry(0.06, 0.06, 6, 6), wood, 0, 3.2, 1, 0, false);
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 5.4); sh.lineTo(-3.2, 0.4); sh.closePath();
        const s = new THREE.Mesh(new THREE.ShapeGeometry(sh), sail); s.position.set(0, 0.7, 1); s.rotation.y = Math.PI / 2; s.castShadow = true; g.add(s);
        if (i === 0) {
          // oferendas a Iemanjá: flores e barquinhos de oferenda junto à água
          const flowers = ['#ffffff', '#6fa8dc', '#f4a6c6', '#ffffff', '#9ad1d4'];
          for (let k = 0; k < 18; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(flowers[k % 5])); fl.position.set(3 + Math.random() * 2.5, 0.1, (Math.random() - 0.5) * 4); g.add(fl); }
          for (let k = 0; k < 3; k++) { const bt = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.8), mat('#f6f4ee')); bt.position.set(4.5 + k * 0.6, 0.08, -1 + k); g.add(bt); const can = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6), mat('#fff3c4', { emissive: '#ffcf7a', emissiveIntensity: 1 })); can.position.set(4.5 + k * 0.6, 0.28, -1 + k); g.add(can); }
          data.pois.push({ name: 'Oferendas a Iemanjá · Brasília Teimosa', kind: 'attraction', x: x, z: z });
        }
      });
    }
  }

  // malhas grandes em Int16/Int8 (a maior parte fica longe da câmera e nunca ia pra placa de vídeo)
  const compacto = compactGroup(group);

  // ---------------------------------------------------------------- animação, visibilidade e luz
  const _v = new THREE.Vector3();
  return {
    compacto, sounds, danceSpots, bodies: [],
    update(t, cam) {
      this.bodies.length = 0;
      const beat = (t * BPM.brega / 60) % 1, pulse = Math.pow(1 - beat, 3);
      for (const m of ledMats) { m.emissiveIntensity = 0.8 + pulse * 3.5; m.emissive.setHSL((t * 0.1) % 1, 1, 0.55); m.color.copy(m.emissive); }
      for (const c of clusters) {
        const vis = Math.hypot(c.x - cam.x, c.z - cam.z) < (c.radius || 130);
        c.g.visible = vis;
        if (!vis) continue;
        for (const d of c.crowd) dance(d.p, t, d.style, d.ph);
        c.tick?.(t);
        // corpos das pessoas perto da câmera: obstáculos para o jogador (a pé e de carro)
        if (Math.hypot(c.x - cam.x, c.z - cam.z) < (c.radius ? c.radius : 90)) for (const o of [...c.crowd, ...(c.extraBodies || [])]) { const p = o.p || o; if (!p?.isObject3D) continue; p.getWorldPosition(_v); if (Math.hypot(_v.x - cam.x, _v.z - cam.z) < 80) this.bodies.push([_v.x, _v.z]); }
        if (c.pelada) {
          const { kids, ball, cx, cz } = c.pelada, bx = cx + Math.sin(t * 0.7) * 9, bz = cz + Math.sin(t * 1.3) * 4;
          ball.position.set(bx, 0.12 + Math.abs(Math.sin(t * 3)) * 0.4, bz);
          kids.forEach((k) => {
            const tx = bx + k.sx * (2 + Math.sin(t + k.ph) * 2.5), tz = bz + Math.cos(t * 0.8 + k.ph) * 3;
            const dx = tx - k.p.position.x, dz = tz - k.p.position.z, d = Math.hypot(dx, dz);
            if (d > 0.2) { k.p.position.x += dx * 0.03; k.p.position.z += dz * 0.03; k.p.rotation.y = Math.atan2(dx, dz); }
            const u = k.p.userData, w = t * 9 + k.ph, s = Math.sin(w);
            u.legL.rotation.set(s * 0.7, 0, 0); u.legR.rotation.set(-s * 0.7, 0, 0); u.kneeL.rotation.x = 0.4 + Math.max(0, -s); u.kneeR.rotation.x = 0.4 + Math.max(0, s);
            u.armL.rotation.set(-s * 0.6, 0, 0); u.armR.rotation.set(s * 0.6, 0, 0);
          });
        }
      }
    },
    setNight(n) { for (const m of lightMats) m.emissiveIntensity = 0.05 + n * 2.5; },
  };
}

// ---------------------------------------------------------------- Ilha de Deus
// palafitas com passarelas sobre a água (dá para andar nelas), mangue nas margens, canoas, marisqueiras,
// pescadores na ponte, estacas dos viveiros de camarão e roda de ciranda.
function buildIsland(c, group, data, env, { mat, add, clusters, sounds, people, findSpot }) {
  const G = env.grid, { GW, GH, xmin, zmin, RES, mask } = G, WATER = 1, SOLID = 4;
  const idx = (x, z) => { const ix = Math.floor((x - xmin) / RES), iz = Math.floor((z - zmin) / RES); return ix < 0 || iz < 0 || ix >= GW || iz >= GH ? -1 : iz * GW + ix; };
  const cellXZ = (i) => [xmin + (i % GW + 0.5) * RES, zmin + (((i / GW) | 0) + 0.5) * RES];
  const water = (x, z) => { const i = idx(x, z); return i >= 0 && (mask[i] & WATER) !== 0; };
  let seed = 909; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // centro da ilha e borda (células de terra com água ao lado)
  let sx = 0, sz = 0; for (const i of c.cells) { const [x, z] = cellXZ(i); sx += x; sz += z; }
  const cx = sx / c.cells.size, cz = sz / c.cells.size;
  const shore = [];
  for (const i of c.cells) { if ([i + 1, i - 1, i + GW, i - GW].some((j) => mask[j] & WATER)) shore.push(cellXZ(i)); }
  // anda pela borda em ordem de ângulo
  shore.sort((a, b) => Math.atan2(a[1] - cz, a[0] - cx) - Math.atan2(b[1] - cz, b[0] - cx));
  const g = new THREE.Group(); group.add(g);
  const wood = mat('#7a5a3a', { roughness: 0.9 }), plank = mat('#9c7a52', { roughness: 0.95 }), tin = mat('#8f9496', { metalness: 0.5, roughness: 0.5 });
  const WALLS = ['#3a86ff', '#e63946', '#2a9d8f', '#ffbe0b', '#f4a6c6', '#06d6a0', '#f2f0ea', '#fb5607'].map((col) => mat(col, { roughness: 0.85 }));
  const clearWater = (x, z) => { const i = idx(x, z); if (i >= 0) mask[i] &= ~WATER; };
  const solid = (x, z) => { const i = idx(x, z); if (i >= 0) mask[i] |= SOLID; };

  // ---- palafitas: a cada ~11 m de borda, uma casinha de madeira sobre estacas, 6 m água adentro, com passarela.
  // Todas as palafitas viram poucas malhas (uma por material): são dezenas de casas com ~20 peças cada.
  const stilts = [];
  const bins = new Map(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const put = (m, geo, x, y, z, yaw, rx = 0) => { const gg = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(gg.attributes)) if (!['position', 'normal'].includes(k)) gg.deleteAttribute(k); gg.applyMatrix4(M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, yaw, 0, 'YXZ')), S.set(1, 1, 1))); if (!bins.has(m)) bins.set(m, []); bins.get(m).push(gg); };
  const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  let last = null, count = 0;
  for (const [x, z] of shore) {
    if (last && Math.hypot(x - last[0], z - last[1]) < 11) continue;
    let ox = 0, oz = 0; for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) if (water(x + Math.cos(a) * 3, z + Math.sin(a) * 3)) { ox += Math.cos(a); oz += Math.sin(a); }
    const l = Math.hypot(ox, oz); if (l < 0.5) continue; ox /= l; oz /= l;
    const hx = x + ox * 6, hz = z + oz * 6;
    let ok = true; for (let dx = -2.5; dx <= 2.5 && ok; dx += 1) for (let dz = -2.5; dz <= 2.5 && ok; dz += 1) if (!water(hx + dx, hz + dz)) ok = false;
    if (!ok || rnd() < 0.15) continue;
    last = [x, z]; count++;
    const yaw = Math.atan2(ox, oz), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const L2W = (lx, lz) => [hx + cy * lx + sy * lz, hz - sy * lx + cy * lz]; // local da casa → mundo
    const P = (m, geo, lx, y, lz, rx) => { const [wx, wz] = L2W(lx, lz); put(m, geo, wx, y, wz, yaw, rx); };
    const w = 3.6 + rnd() * 1.2, d = 3.6 + rnd() * 1.4, floor = 1.0, wallH = 2.4;
    for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [0, -d / 2], [0, d / 2]]) P(wood, new THREE.CylinderGeometry(0.07, 0.09, floor + 0.6, 5), px, (floor - 0.6) / 2, pz);
    P(plank, BOX(w + 0.4, 0.12, d + 0.8), 0, floor, 0.2);
    P(WALLS[count % WALLS.length], BOX(w, wallH, d), 0, floor + wallH / 2, 0);
    P(tin, BOX(w + 0.6, 0.08, d + 0.9), 0, floor + wallH + 0.25, 0, 0.12);
    P(mat('#5b3a24'), BOX(0.9, 1.8, 0.06), 0, floor + 0.9, -d / 2 - 0.03);
    P(mat('#1e2124'), BOX(0.8, 0.7, 0.06), w * 0.28, floor + 1.4, -d / 2 - 0.03);
    if (rnd() < 0.5) { P(mat('#dddddd'), BOX(w, 0.02, 0.02), 0, floor + 1.8, d / 2 + 0.6); for (let k = 0; k < 4; k++) P(mat(['#e63946', '#ffffff', '#3a86ff', '#ffbe0b'][k]), BOX(0.45, 0.6, 0.02), -w / 2 + 0.5 + k * (w / 4), floor + 1.5, d / 2 + 0.6); } // varal
    // passarela de tábuas da beira até a porta (a água nesse trecho vira chão andável)
    const L = Math.hypot(hx - x, hz - z) - d / 2;
    put(plank, BOX(1.2, 0.1, L), (x + (hx - ox * d / 2)) / 2, 0.35, (z + (hz - oz * d / 2)) / 2, yaw);
    for (let t = 0; t <= L; t += 0.75) for (const s2 of [-0.5, 0.5]) clearWater(x + ox * t - oz * s2, z + oz * t + ox * s2);
    for (let a = -w / 2; a <= w / 2; a += 0.75) for (let b = -d / 2; b <= d / 2; b += 0.75) { const [wx, wz] = L2W(a, b); solid(wx, wz); }
    stilts.push([hx, hz, yaw]);
  }
  for (const [m, list] of bins) {
    let n = 0; for (const gg of list) n += gg.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const gg of list) { pos.set(gg.attributes.position.array, o * 3); nor.set(gg.attributes.normal.array, o * 3); o += gg.attributes.position.count; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  }
  data.pois.push({ name: 'Palafitas · Ilha de Deus', kind: 'attraction', x: stilts[0]?.[0] ?? cx, z: stilts[0]?.[1] ?? cz });

  // ---- mangue: moitas com raízes-escora na beira d'água, em volta da ilha e dos canais
  const spots = [];
  for (let r = 40; r < c.R + 220 && spots.length < 700; r += 4) for (let a = 0; a < Math.PI * 2; a += 4 / r) {
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (!water(x, z) || stilts.some(([sx2, sz2]) => Math.hypot(sx2 - x, sz2 - z) < 8)) continue;
    if (![0, 1, 2, 3, 4, 5].some((k) => !water(x + Math.cos(k) * 3, z + Math.sin(k) * 3))) continue; // só rente à margem
    if (rnd() < 0.55) spots.push([x, z]);
  }
  if (spots.length) {
    const parts = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; parts.push(new THREE.CylinderGeometry(0.04, 0.06, 1.6, 4).rotateZ(0.5).rotateY(a).translate(Math.cos(a) * 0.45, 0.6, -Math.sin(a) * 0.45)); }
    const roots = mergeG(parts);
    const crown = mergeG([[0, 2.0, 0, 1.4], [0.9, 1.8, 0.3, 1.0], [-0.8, 1.9, -0.4, 1.1], [0.2, 2.6, 0, 0.9]].map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).scale(1, 0.7, 1).translate(x, y, z)));
    const rootIM = new THREE.InstancedMesh(roots, mat('#5a4636', { roughness: 0.95 }), spots.length), crownIM = new THREE.InstancedMesh(crown, mat('#2f5e2a', { roughness: 0.8 }), spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), p = new THREE.Vector3();
    spots.forEach(([x, z], i) => { const s = 0.8 + rnd() * 0.7; m4.compose(p.set(x, -0.1, z), q.setFromAxisAngle(up, rnd() * 6.28), sc.set(s, s * (0.8 + rnd() * 0.4), s)); rootIM.setMatrixAt(i, m4); crownIM.setMatrixAt(i, m4); });
    crownIM.castShadow = true; g.add(rootIM, crownIM);
  }

  // ---- canoas na água perto das palafitas, algumas com pescador remando
  const crew = [];
  const hull = mergeG([new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.55, 0.45, 2.4)]);
  stilts.filter((_, i) => i % 2 === 0).slice(0, 10).forEach(([x, z, yaw], i) => {
    const bx = x + Math.sin(yaw) * 6 + Math.cos(yaw) * 2.5, bz = z + Math.cos(yaw) * 6 - Math.sin(yaw) * 2.5;
    if (!water(bx, bz)) return;
    const b = new THREE.Group(); b.position.set(bx, 0.32, bz); b.rotation.y = yaw + 1.2 + rnd() * 0.6; g.add(b);
    const hm = new THREE.Mesh(hull, mat(i % 2 ? '#2b5ea8' : '#c8102e', { roughness: 0.7 })); hm.rotation.x = Math.PI; hm.castShadow = true; b.add(hm);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 4, 20).scale(0.55, 2.4, 1).rotateX(Math.PI / 2), wood); b.add(rim);
    if (i % 3 === 0) { const p = people(1, { hat: 'bone', longSleeve: false })[0]; p.position.set(0, -0.32, -0.6); b.add(p); crew.push({ p, style: 'rema', ph: rnd() * 6 }); const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), wood); oar.position.set(0.5, 0.5, 0); oar.rotation.z = 0.9; b.add(oar); }
    crew.push({ boat: b, ph: rnd() * 6 });
  });

  // ---- marisqueiras catando sururu na lama da margem, com balaio
  const mud = shore.filter((_, i) => i % 37 === 5).slice(0, 5);
  mud.forEach(([x, z], i) => {
    let ox = 0, oz = 0; for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) if (water(x + Math.cos(a) * 3, z + Math.sin(a) * 3)) { ox += Math.cos(a); oz += Math.sin(a); }
    const l = Math.hypot(ox, oz) || 1, px = x + (ox / l) * 1.8, pz = z + (oz / l) * 1.8;
    const p = people(1, { hat: i % 2 ? 'bone' : undefined, longSleeve: true, shirt: ['#f4a6c6', '#e9c46a', '#9ad1d4', '#e63946'][i % 4] })[0];
    p.position.set(px, 0, pz); p.rotation.y = Math.atan2(ox, oz); g.add(p); crew.push({ p, style: 'marisca', ph: i });
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.35, 10), mat('#b99a5b', { roughness: 0.95 })); basket.position.set(px - oz / l * 0.8, 0.12, pz + ox / l * 0.8); g.add(basket);
  });
  if (mud.length) data.pois.push({ name: 'Marisqueiras · Ilha de Deus', kind: 'attraction', x: mud[0][0], z: mud[0][1] });

  // ---- pescadores de linha na ponte que liga a ilha ao continente
  const bridges = data.roads.filter((r) => r.b && r.p.some((q) => Math.hypot(q[0] - cx, q[1] - cz) < c.R + 120));
  bridges.slice(0, 2).forEach((r, k) => {
    const a = r.p[0], b = r.p.at(-1), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, half = r.k === 'footway' || r.k === 'path' ? 1.6 : 3.5;
    for (let j = 0; j < 2; j++) {
      const t = L * (0.3 + j * 0.35), s = j % 2 ? 1 : -1, px = a[0] + ux * t - uz * half * s, pz = a[1] + uz * t + ux * half * s;
      const p = people(1, { hat: 'bone' })[0], hy = heightAt(px, pz); p.position.set(px, hy, pz); p.rotation.y = Math.atan2(-uz * s, ux * s); g.add(p); crew.push({ p, style: 'pesca', ph: k * 2 + j });
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 3.2, 5), mat('#3a2a1e')); rod.position.set(px - uz * s * 1.4, 1.9 + hy, pz + ux * s * 1.4); rod.rotation.set(0, Math.atan2(-uz * s, ux * s), 0); rod.rotateX(1.0); g.add(rod);
    }
  });

  // ---- viveiros de camarão: estacas de madeira em volta dos lagos pequenos perto da ilha
  const ponds = data.water.filter((w) => { const mx = w.reduce((s, q) => s + q[0], 0) / w.length, mz = w.reduce((s, q) => s + q[1], 0) / w.length; let A = 0; for (let i = 0; i < w.length; i++) { const p = w[i], q = w[(i + 1) % w.length]; A += p[0] * q[1] - q[0] * p[1]; } A = Math.abs(A / 2); return A > 250 && A < 15000 && Math.hypot(mx - cx, mz - cz) < c.R + 250; });
  const stakes = [];
  for (const w of ponds) for (let i = 0; i < w.length; i++) { const p = w[i], q = w[(i + 1) % w.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); for (let t = 0; t < L; t += 5) stakes.push([p[0] + (q[0] - p[0]) * t / L, p[1] + (q[1] - p[1]) * t / L]); }
  if (stakes.length) {
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 5).translate(0, 0.5, 0), wood, Math.min(stakes.length, 1500));
    const m4 = new THREE.Matrix4(); stakes.slice(0, 1500).forEach(([x, z], i) => im.setMatrixAt(i, m4.makeTranslation(x, 0, z)));
    g.add(im);
    const mid = ponds[0]; data.pois.push({ name: 'Viveiros de camarão · Ilha de Deus', kind: 'attraction', x: mid.reduce((s, q) => s + q[0], 0) / mid.length, z: mid.reduce((s, q) => s + q[1], 0) / mid.length });
  }

  // ---- roda de ciranda: gente de mãos dadas girando devagar
  const rs = findSpot(c, 12, 12);
  if (rs) {
    const ring = new THREE.Group(); ring.position.set(rs[0], 0, rs[1]); g.add(ring);
    const N = 14, R = 3.4;
    people(N).forEach((p, i) => { const a = (i / N) * Math.PI * 2; p.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); p.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); ring.add(p); crew.push({ p, style: 'ciranda', ph: 0 }); });
    crew.push({ ring });
    sounds.push({ kind: 'ciranda', x: rs[0], z: rs[1], base: 0.45, R: 80 });
    data.pois.push({ name: 'Roda de Ciranda · Ilha de Deus', kind: 'attraction', x: rs[0], z: rs[1] });
  }

  clusters.push({
    g, x: cx, z: cz, crowd: [], radius: c.R + 150, extraBodies: crew.filter((k) => k.p && k.style !== 'rema').map((k) => k.p),
    tick(t) {
      for (const k of crew) {
        if (k.p) dance(k.p, t, k.style, k.ph);
        if (k.boat) { k.boat.position.y = 0.32 + Math.sin(t * 1.4 + k.ph) * 0.05; k.boat.rotation.z = Math.sin(t * 1.1 + k.ph) * 0.05; }
        if (k.ring) k.ring.rotation.y = t * 0.12;
      }
    },
  });
}

function mergeG(list) {
  // junta geometrias simples (mesmos atributos) numa só
  const norm = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k); return n; });
  let total = 0; for (const g of norm) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3); let o = 0;
  for (const g of norm) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// ---------------------------------------------------------------- morros da zona norte
// Morro da Conceição: estátua de Nossa Senhora da Conceição no alto, santuário e bandeirolas azuis e brancas
// (Festa do Morro, em 8 de dezembro). Alto José do Pinho: palco com banda tocando, berço de uma cena musical forte.
function buildMorro(c, group, data, env, { mat, add, clusters, sounds, people, findSpot }) {
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z) && !env.isRoad(x, z);
  const near = (x, z, w, d, R = 40) => {
    for (let r = 0; r <= R; r += 2) for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; let ok = true;
      for (let dx = -w / 2; dx <= w / 2 && ok; dx += 1.5) for (let dz = -d / 2; dz <= d / 2 && ok; dz += 1.5) if (!free(px + dx, pz + dz)) ok = false;
      if (ok) return [px, pz];
    }
    return null;
  };
  const lifted = (x, z) => { const g = new THREE.Group(); g.position.set(x, heightAt(x, z), z); group.add(g); return g; };

  if (c.special === 'conceicao') {
    const st = data.pois.find((p) => p.name === 'Estatua de Nossa Senhora da Conceição') || { x: c.x, z: c.z };
    const s0 = near(st.x, st.z, 5, 5, 30);
    if (s0) {
      const g = lifted(s0[0], s0[1]);
      const stone = mat('#e6e1d6', { roughness: 0.8 }), robe = mat('#f8f6f0', { roughness: 0.5 }), blue = mat('#3d6fb0', { roughness: 0.45 }), gold = mat('#d4a73a', { metalness: 0.9, roughness: 0.25 }), skin = mat('#efd6bf', { roughness: 0.6 });
      add(g, new THREE.BoxGeometry(4.2, 1.2, 4.2), stone, 0, 0.6, 0);
      add(g, new THREE.BoxGeometry(2.6, 4.2, 2.6), stone, 0, 3.3, 0);
      add(g, new THREE.CylinderGeometry(1.0, 1.6, 0.6, 16), stone, 0, 5.7, 0, 0, false);
      // a imagem: túnica branca, manto azul, mãos postas, coroa dourada, sobre a lua e as nuvens
      add(g, new THREE.CylinderGeometry(0.75, 1.25, 5.2, 18), robe, 0, 8.6, 0, 0, false);
      add(g, new THREE.CylinderGeometry(1.0, 1.45, 4.6, 18, 1, true, Math.PI * 0.15, Math.PI * 1.7), mat('#3d6fb0', { roughness: 0.45, side: THREE.DoubleSide }), 0, 8.4, -0.05, 0, false);
      add(g, new THREE.SphereGeometry(0.55, 16, 12), skin, 0, 11.75, 0, 0, false);
      add(g, new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), blue, 0, 11.85, -0.06, 0, false);
      add(g, new THREE.CylinderGeometry(0.42, 0.34, 0.45, 12), gold, 0, 12.45, 0, 0, false);
      add(g, new THREE.SphereGeometry(0.22, 10, 8), skin, 0, 10.3, 0.85, 0, false);
      add(g, new THREE.TorusGeometry(1.2, 0.18, 8, 24, Math.PI), mat('#e9e4d8'), 0, 6.2, 0.2, 0, false);
      g.children.forEach((o) => { o.castShadow = true; });
      clusters.push({ g, x: s0[0], z: s0[1], crowd: [], radius: 1500 }); // vista de longe: é o marco do morro
      // santuário ao lado
      const s1 = near(s0[0] + 16, s0[1], 9, 14, 45);
      if (s1) {
        const h = lifted(s1[0], s1[1]); h.rotation.y = Math.atan2(s0[0] - s1[0], s0[1] - s1[1]);
        add(h, new THREE.BoxGeometry(8, 6, 13), robe, 0, 3, 0);
        add(h, new THREE.BoxGeometry(8.1, 0.6, 13.1), blue, 0, 0.3, 0, 0, false);
        const roof = new THREE.Shape(); roof.moveTo(-4.4, 0); roof.lineTo(4.4, 0); roof.lineTo(0, 2.4); roof.closePath();
        add(h, new THREE.ExtrudeGeometry(roof, { depth: 13.6, bevelEnabled: false }).translate(0, 0, -6.8), mat('#c46a45', { roughness: 0.85 }), 0, 6, 0, 0, false);
        add(h, new THREE.BoxGeometry(2.6, 9.5, 2.6), robe, 2.8, 4.75, 5.4); add(h, new THREE.ConeGeometry(1.9, 2.8, 4), blue, 2.8, 10.9, 5.4, Math.PI / 4, false);
        add(h, new THREE.BoxGeometry(2, 3.2, 0.1), blue, -0.6, 1.6, 6.55, 0, false);
        add(h, new THREE.BoxGeometry(0.15, 1.4, 0.15), gold, -0.6, 7.6, 6.4, 0, false); add(h, new THREE.BoxGeometry(0.8, 0.15, 0.15), gold, -0.6, 7.8, 6.4, 0, false);
        clusters.push({ g: h, x: s1[0], z: s1[1], crowd: [], radius: 400 });
        data.pois.push({ name: 'Santuário de Nossa Senhora da Conceição', kind: 'place_of_worship', x: s1[0], z: s1[1] });
      }
      // bandeirolas azuis e brancas atravessando as ruas em volta (Festa do Morro)
      const flags = [], strings = [];
      for (const r of data.roads) {
        if (!['residential', 'living_street', 'tertiary', 'unclassified', 'pedestrian', 'steps', 'footway'].includes(r.k)) continue;
        for (let i = 0; i < r.p.length - 1; i++) {
          const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 4) continue;
          if (Math.hypot((ax + bx) / 2 - s0[0], (az + bz) / 2 - s0[1]) > 260) continue;
          const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, span = r.k === 'footway' || r.k === 'steps' ? 6 : 10;
          for (let d = 4; d < L; d += 9) {
            const mx = ax + ux * d, mz = az + uz * d, base = heightAt(mx, mz) + 5.6;
            strings.push([mx, base, mz, Math.atan2(nx, nz), span]);
            for (let t = -span / 2 + 0.3; t < span / 2; t += 0.5) flags.push([mx + nx * t, base - (1 - (2 * t / span) ** 2) * 0.6, mz + nz * t, Math.atan2(ux, uz)]);
          }
        }
      }
      if (flags.length) {
        const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.17, 0, 0), new THREE.Vector3(0.17, 0, 0), new THREE.Vector3(0, -0.38, 0)]); tri.computeVertexNormals();
        const im = new THREE.InstancedMesh(tri, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), flags.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), cW = new THREE.Color('#ffffff'), cB = new THREE.Color('#3d7fd6');
        flags.forEach(([x, y, z, yaw], i) => { m4.compose(p.set(x, y, z), q.setFromEuler(e.set(0, yaw, 0)), one); im.setMatrixAt(i, m4); im.setColorAt(i, i % 2 ? cB : cW); });
        group.add(im);
        const cord = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 1), mat('#333333'), strings.length);
        strings.forEach(([x, y, z, yaw, span], i) => { m4.compose(p.set(x, y, z), q.setFromEuler(e.set(0, yaw, 0)), new THREE.Vector3(1, 1, span)); cord.setMatrixAt(i, m4); });
        group.add(cord);
      }
    }
  }

  if (c.special === 'palco') {
    const sp = findSpot(c, 20, 20);
    if (sp) {
      const g = lifted(sp[0], sp[1]);
      // palco de frente para o lado mais aberto
      let best = 0, face = 0; for (let a = 0; a < Math.PI * 2; a += 0.3) { let f = 0; for (let d = 3; d <= 20; d += 2) { if (env.isSolid(sp[0] + Math.sin(a) * d, sp[1] + Math.cos(a) * d)) break; f++; } if (f > best) { best = f; face = a; } }
      const stage = new THREE.Group(); stage.position.set(-Math.sin(face) * 6, 0, -Math.cos(face) * 6); stage.rotation.y = face; g.add(stage);
      const black = mat('#141414'), wood = mat('#5a3d28', { roughness: 0.8 }), truss = mat('#9aa0a4', { metalness: 0.7, roughness: 0.35 });
      add(stage, new THREE.BoxGeometry(10, 1.2, 5), wood, 0, 0.6, 0);
      // fundo do palco com o nome do lugar
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const cx2 = cv.getContext('2d');
      const grd = cx2.createLinearGradient(0, 0, 512, 0); grd.addColorStop(0, '#ff006e'); grd.addColorStop(0.5, '#ffbe0b'); grd.addColorStop(1, '#3a86ff');
      cx2.fillStyle = '#111'; cx2.fillRect(0, 0, 512, 160); cx2.fillStyle = grd; cx2.font = '900 54px Inter, Arial'; cx2.textAlign = 'center'; cx2.fillText('ALTO JOSÉ DO PINHO', 256, 72); cx2.font = '700 30px Inter, Arial'; cx2.fillStyle = '#f1f1ee'; cx2.fillText('música da comunidade', 256, 122);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const banner = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.3 });
      add(stage, new THREE.BoxGeometry(10, 3.2, 0.2), banner, 0, 3.0, -2.4, 0, false);
      for (const sx of [-5.6, 5.6]) { add(stage, new THREE.BoxGeometry(1.4, 3.4, 1.2), black, sx, 1.7, 0.6); add(stage, new THREE.CylinderGeometry(0.1, 0.1, 6, 6), truss, sx, 3, -2.2, 0, false); }
      add(stage, new THREE.BoxGeometry(11.4, 0.25, 0.25), truss, 0, 6, -2.2, 0, false);
      const spot = new THREE.MeshStandardMaterial({ color: '#ff2fa0', emissive: '#ff2fa0', emissiveIntensity: 2 });
      for (let k = -2; k <= 2; k++) add(stage, new THREE.CylinderGeometry(0.2, 0.28, 0.5, 10), spot, k * 2.2, 5.7, -2.1, 0, false);
      // bateria
      add(stage, new THREE.CylinderGeometry(0.45, 0.45, 0.5, 14).rotateZ(Math.PI / 2), mat('#c8102e'), 0, 1.75, -1.2, Math.PI / 2, false);
      for (const [x, z] of [[-0.6, -0.9], [0.6, -0.9]]) add(stage, new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12), mat('#c8102e'), x, 2.05, z, 0, false);
      add(stage, new THREE.CylinderGeometry(0.35, 0.35, 0.02, 14), mat('#d4a73a', { metalness: 0.9 }), 0.9, 2.5, -1.2, 0, false);
      const band = [];
      const musician = (x, z, kind) => {
        const p = people(1, { shirt: ['#111111', '#c8102e', '#f1f1ee', '#1d3557'][band.length % 4], hair: kind === 'voz' ? 'curly' : undefined })[0];
        p.position.set(x, 1.2, z); stage.add(p); band.push({ p, kind });
        if (kind === 'guitarra' || kind === 'baixo') {
          const gtr = new THREE.Group(); gtr.position.set(0.05, 1.12, 0.22); gtr.rotation.set(0, 0, -0.9); p.add(gtr);
          gtr.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.45, 0.07), mat(kind === 'baixo' ? '#3a86ff' : '#ffbe0b')));
          const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, kind === 'baixo' ? 0.95 : 0.75, 0.04), mat('#3a2a1e')); neck.position.y = 0.6; gtr.add(neck);
        }
        if (kind === 'voz') { const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), truss); mic.position.set(0, 0.75, 0.45); p.add(mic); }
        if (kind === 'bateria') { p.userData.seated = true; const u = p.userData; u.legL.rotation.x = -1.4; u.legR.rotation.x = -1.4; u.kneeL.rotation.x = 1.4; u.kneeR.rotation.x = 1.4; p.position.y = 1.2 - 0.38; }
      };
      musician(0, -1.9, 'bateria'); musician(-2.6, 0.2, 'guitarra'); musician(2.6, 0.2, 'baixo'); musician(0, 1.2, 'voz');
      // galera na frente do palco
      const crowd = people(12).map((p, i) => {
        const lat = (i % 4 - 1.5) * 2.2, dep = 3 + Math.floor(i / 4) * 2;
        p.position.set(Math.sin(face) * (dep - 6) + Math.cos(face) * lat, 0, Math.cos(face) * (dep - 6) - Math.sin(face) * lat); p.rotation.y = face + Math.PI; g.add(p);
        return { p, style: i % 3 === 0 ? 'passinho' : 'brega', ph: Math.random() * 6 };
      });
      clusters.push({
        g, x: sp[0], z: sp[1], crowd, extraBodies: band.map((b) => b.p),
        tick(t) {
          const beat = (t * 150 / 60) % 1;
          spot.emissiveIntensity = 1 + Math.pow(1 - beat, 3) * 4; spot.emissive.setHSL((t * 0.15) % 1, 1, 0.55); spot.color.copy(spot.emissive);
          for (const m of band) {
            const u = m.p.userData, w = t * Math.PI * 5;
            if (m.kind === 'guitarra' || m.kind === 'baixo') { u.armR.rotation.set(-0.7 + Math.sin(w) * 0.35, 0, 0.3); u.elbowR.rotation.x = -1.0; u.armL.rotation.set(-1.2, 0, -0.5); u.elbowL.rotation.x = -1.3; u.upper.rotation.x = 0.1 + Math.abs(Math.sin(w / 2)) * 0.1; }
            else if (m.kind === 'bateria') { u.armL.rotation.x = -0.9 + Math.sin(w) * 0.4; u.armR.rotation.x = -0.9 - Math.sin(w) * 0.4; u.elbowL.rotation.x = -0.8; u.elbowR.rotation.x = -0.8; }
            else dance(m.p, t, 'brega', 0);
          }
        },
      });
      sounds.push({ kind: 'brega', x: sp[0], z: sp[1], base: 0.55, R: 120 });
      data.pois.push({ name: 'Palco do Alto José do Pinho', kind: 'attraction', x: sp[0], z: sp[1] });
    }
  }
}
