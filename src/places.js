// Lugares com nome: placas nas fachadas de escolas, faculdades, museus, hospitais, bibliotecas, cinemas, shoppings,
// restaurantes, bares e cafés (dados do OSM), letreiros no alto dos shoppings, comércio da Boa Vista e marcos do bairro.
// Todas as placas ficam em poucos atlas de texto: uma chamada de desenho por atlas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makePerson } from './models.js';
import { releaseOnUpload } from './textures.js';
import { stampMesh } from './collide.js';
import { heightAt } from './terrain.js';

const STYLE = {
  restaurant: { bg: '#7a1f1f', fg: '#ffe8c2', icon: '🍽', y: 3.2, awn: true },
  bar: { bg: '#1f3b2c', fg: '#ffd166', icon: '🍺', y: 3.2, awn: true },
  pub: { bg: '#1f3b2c', fg: '#ffd166', icon: '🍺', y: 3.2, awn: true },
  cafe: { bg: '#5a3b26', fg: '#f6e6c8', icon: '☕', y: 3.0, awn: true },
  ice_cream: { bg: '#f7a8c4', fg: '#5a1838', icon: '🍦', y: 3.0, awn: true },
  fast_food: { bg: '#d62828', fg: '#ffffff', icon: '🍔', y: 3.2, awn: true },
  school: { bg: '#1d4f91', fg: '#ffffff', icon: '🎒', y: 4.2 },
  college: { bg: '#0b3a66', fg: '#ffffff', icon: '🎓', y: 4.8 },
  university: { bg: '#0b3a66', fg: '#ffffff', icon: '🎓', y: 4.8 },
  museum: { bg: '#262626', fg: '#f2d38a', icon: '🏛', y: 4.5 },
  arts_centre: { bg: '#262626', fg: '#f2d38a', icon: '🎨', y: 4.2 },
  gallery: { bg: '#262626', fg: '#f2d38a', icon: '🎨', y: 4.2 },
  hospital: { bg: '#f7f7f5', fg: '#c8102e', icon: '✚', y: 5 },
  library: { bg: '#3d405b', fg: '#f4f1de', icon: '📚', y: 4.2 },
  cinema: { bg: '#111111', fg: '#ff4d4d', icon: '🎬', y: 4.5 },
  theatre: { bg: '#3a0d14', fg: '#f6d28b', icon: '🎭', y: 4.5 },
  marketplace: { bg: '#2f6b4f', fg: '#ffffff', icon: '🧺', y: 4.0 },
  mall: { bg: '#0d1b2a', fg: '#ffffff', icon: '', roof: true },
  shop: { bg: '#333', fg: '#ffffff', icon: '', y: 3.0, awn: true },
  tech: { bg: '#0b2545', fg: '#5ce1e6', icon: '', y: 5 },
  townhall: { bg: '#f4f1ea', fg: '#0b3d91', icon: '', roof: true },
};
// alguns famosos com letreiro próprio
const SPECIAL = {
  'Restaurante Leite': { bg: '#141414', fg: '#d4af37', text: 'Restaurante Leite · desde 1882' },
  Parraxaxá: { bg: '#e9a23b', fg: '#3b1d0b', text: '🌵 Parraxaxá' },
  'Chica Pitanga': { bg: '#e05297', fg: '#ffffff', text: 'Chica Pitanga' },
  Bargaço: { bg: '#0b4f6c', fg: '#ffffff', text: '🦐 Bargaço' },
  Tasca: { bg: '#5b2333', fg: '#f7e7c6', text: 'Tasca' },
  'o bode - entre amigos': { bg: '#3a2a1a', fg: '#ffd166', text: '🐐 Entre Amigos o Bode' },
  'Paço do Frevo': { bg: '#e63946', fg: '#ffd166', text: '☂ Paço do Frevo' },
  'Museu Cais do Sertão': { bg: '#f4f1ea', fg: '#7a3b1d', text: 'Cais do Sertão' },
  'Faculdade de Direito do Recife': { bg: '#0b3a66', fg: '#f2d38a', text: '🎓 Faculdade de Direito do Recife' },
  'Porto Digital': { bg: '#0b2545', fg: '#5ce1e6', text: 'PORTO DIGITAL', roof: true },
  'CESAR - Centro de Estudos Avançados do Recife': { bg: '#111111', fg: '#ffffff', text: 'CESAR' },
  'Cesar School': { bg: '#111111', fg: '#ffffff', text: '🎓 CESAR School' },
  'Prefeitura da Cidade do Recife': { text: 'Prefeitura do Recife' },
  'Cine-Teatro Apolo': { bg: '#3a0d14', fg: '#f6d28b', text: '🎭 Cine-Teatro Apolo' },
  'Clube Vassourinhas': { bg: '#e63946', fg: '#ffd166', text: '🎺 Clube Vassourinhas' },
};
// comércio de rua da Boa Vista (nomes inventados)
const SHOPS = ['Tecidos Imperatriz', 'Calçados Aurora', 'Ótica Boa Vista', 'Lojão do Povo', 'Armarinho Capibaribe', 'Casa das Redes', 'Bolsas & Cia', 'Perfumaria Soledade',
  'Eletro Nordeste', 'Bazar do Hospício', 'Relojoaria Conde', 'Moda Frevo', 'Confecções Maracatu', 'Lanchonete Arretada', 'Padaria Boa Vista', 'Papelaria Sete de Setembro',
  'Celulares & Cia', 'Sapataria Recife', 'Tudo por R$ 10', 'Bijuterias Imperatriz', 'Livraria do Sebo', 'Casa do Forró', 'Discos Manguebeat', 'Brinquedos Ciranda',
  'Farmácia da Rua Nova', 'Malhas Pernambuco', 'Variedades Boa Vista', 'Joalheria Aurora', 'Doces de Mainha', 'Copiadora Rápida'];
const SHOP_COLORS = ['#c8102e', '#1d5fa8', '#2a9d58', '#e76f2a', '#7b2d8b', '#0b6e75', '#b5651d', '#3a3a3a'];
const COMMERCIAL = /^(Rua Imperatriz Teresa Cristina|Rua Nova|Avenida Conde da Boa Vista|Rua do Hospício|Rua Sete de Setembro|Avenida Caxangá|Avenida Engenheiro Abdias de Carvalho|Avenida General San Martin|Estrada dos Remédios|Rua Real da Torre|Avenida Doutor José Rufino|Avenida Norte Miguel Arraes de Alencar|Avenida Conselheiro Rosa e Silva|Avenida Beberibe)$/;

const B = new THREE.BoxGeometry(1, 1, 1);
const NOWALL = new Set(['roof', 'carport', 'construction', 'canopy', 'ruins']);
const ringOf = (b) => { const r = b.p.slice(); if (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop(); return r; };
const inside = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };

// ---------------------------------------------------------------- antes dos prédios: Rua da Aurora e alturas famosas
const PASTEL = ['#e8b04a', '#d9624b', '#4f9fbf', '#79b77a', '#f2e3a0', '#c97b9b', '#8fb8de', '#e98d5a', '#6fc2b4', '#e26d6d', '#b9a6e0'];
export function preparePlaces(data) {
  // Rua da Aurora: casario colorido de 2 a 4 andares de frente para o Capibaribe
  const aurora = data.roads.filter((r) => r.n === 'Rua da Aurora').flatMap((r) => r.p.slice(1).map((q, i) => [r.p[i], q]));
  // caixa da rua + 32 m: só os prédios dentro dela medem a distância (eram meio milhão de prédios × todos os trechos)
  let ax0 = Infinity, ax1 = -Infinity, az0 = Infinity, az1 = -Infinity;
  for (const [a, c] of aurora) for (const q of [a, c]) { ax0 = Math.min(ax0, q[0] - 32); ax1 = Math.max(ax1, q[0] + 32); az0 = Math.min(az0, q[1] - 32); az1 = Math.max(az1, q[1] + 32); }
  let n = 0;
  for (const b of data.buildings) {
    if (b.n || b.h > 20) continue;
    const cx = b.cx, cz = b.cz;
    if (cx < ax0 || cx > ax1 || cz < az0 || cz > az1) continue;
    if (!aurora.some(([a, c]) => segDist(cx, cz, a, c) < 32)) continue;
    const k = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1;
    b.h = 8 + Math.floor(k * 3) * 3.6; b.c = PASTEL[Math.floor(k * 997) % PASTEL.length]; n++;
  }
  for (const b of data.buildings) if (b.n === 'Edifício Holiday') { b.h = 52; b.c = '#d8ccb6'; }
  // Poço da Panela: ruas de paralelepípedo e casario térreo antigo em volta do largo
  const poco = data.bairros.find((q) => q.name === 'Poço da Panela');
  const largo = data.pois.find((p) => p.name === 'Praça Poço da Panela') || poco;
  if (poco && largo) {
    const cx = (poco.x + largo.x) / 2, cz = (poco.z + largo.z) / 2, R = 380;
    for (const r of data.roads) {
      if (!['residential', 'living_street', 'service', 'unclassified', 'tertiary'].includes(r.k) && !/Poço/.test(r.n || '')) continue;
      const m = r.p[Math.floor(r.p.length / 2)];
      if (Math.hypot(m[0] - cx, m[1] - cz) < R || /Poço/.test(r.n || '')) r.cobble = 1;
    }
    const CASARIO = ['#f6f3ec', '#f6f3ec', '#f2e3a0', '#e8b04a', '#8fb8de', '#d9624b', '#79b77a', '#f4efe2', '#c97b9b'];
    for (const b of data.buildings) {
      if (b.n || (b.h && b.h > 12)) continue;
      const x = b.cx, z = b.cz;
      if (Math.hypot(x - cx, z - cz) > R - 40) continue;
      const k = Math.abs(Math.sin(x * 7.13 + z * 3.71) * 43758.5453) % 1;
      b.h = 5.5 + Math.floor(k * 3) * 1.2; b.c = CASARIO[Math.floor(k * 977) % CASARIO.length];
    }
  }
  // shoppings grandes: caixa moderna (o jogo usa fachada moderna acima de 16,5 m)
  for (const b of data.buildings) if (/^Shopping (Recife|Boa Vista|Tacaruna|Plaza|Parnamirim)$/.test(b.n || '')) { b.h = Math.max(b.h || 0, 18); b.c = '#e6e2da'; }
  return n;
}

// ---------------------------------------------------------------- casario gerado onde o OSM não tem casas
// Em vários bairros o OSM quase não tem o contorno das casas. Ao carregar, mede quanto das ruas residenciais de
// cada bairro tem prédio do lado; abaixo de 60%, gera lotes ao longo dessas ruas, só onde a grade está livre (sem
// prédio, rua, água) e fora das praças. Roda logo depois da grade de colisão: as casas entram nela e no minimapa.
//   - histórico (Poço da Panela, Casa Forte): casario térreo colorido, telha;
//   - popular (Mustardinha, San Martin, Bongi, Afogados...): casas estreitas coladas, laje, reboco cru ou tijolo, caixa d'água azul;
//   - classe média (o resto): casas soltas e alguns prediozinhos.
const HISTORIC = /^(Poço da Panela|Casa Forte)$/;
// morros da zona norte: casario autoconstruído (fachada de comunidade)
export const MORRO = /^(Morro da Conceição|Alto José do Pinho|Alto do Mandu|Alto Santa Teresinha|Alto José Bonifácio|Vasco da Gama|Alto Nossa Senhora de Fátima|Córrego do Botijão|Bolo de Noiva|Linha do Tiro|Bomba do Hemetério|Água Fria|Macaxeira|Mangabeira|Fundão|Cajueiro|Porto da Madeira|Campina do Barreto|Peixinhos)$/;
const POPULAR = /^(Mustardinha|Zumbi|San Martin|Mangueira|Bongi|Afogados|Jiquiá|Estância|Caçote|Areias|Sítio do Berardo|Prado|Coqueiral|Torrões|Jardim São Paulo|Barro|Tejipió|Coqueiral|Ibura|Cohab|Vila Tamandaré)$/;
const STREET = ['residential', 'living_street', 'tertiary', 'unclassified', 'secondary'];
export function infillHouses(data, grid) {
  const { GW, GH, xmin, zmin, RES, mask } = grid, WATER = 1, ROAD = 2, SOLID = 4;
  const cell = (x, z) => { const ix = Math.floor((x - xmin) / RES), iz = Math.floor((z - zmin) / RES); return ix < 0 || iz < 0 || ix >= GW || iz >= GH ? -1 : iz * GW + ix; };
  const has = (x, z, bit) => { const i = cell(x, z); return i >= 0 && (mask[i] & bit) !== 0; };
  let seed = 12345; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  // bairro mais perto, guardado por quadrado de 40 m (antes era uma busca em todos os bairros a cada ponto)
  const nbCache = new Map();
  const nearestB = (x, z) => {
    const k = Math.floor(x / 40) * 100003 + Math.floor(z / 40);
    let b = nbCache.get(k);
    if (b === undefined) { let bd = Infinity; b = null; const cx = (Math.floor(x / 40) + 0.5) * 40, cz = (Math.floor(z / 40) + 0.5) * 40; for (const q of data.bairros) { const d = (q.x - cx) ** 2 + (q.z - cz) ** 2; if (d < bd) { bd = d; b = q; } } nbCache.set(k, b); }
    return b;
  };

  // 1) cobertura de cada bairro: pontos de rua com prédio a até ~15 m de algum lado
  const tot = {}, cov = {};
  for (const rd of data.roads) {
    if (!STREET.includes(rd.k) || rd.tu || rd.b) continue;
    for (let i = 0; i < rd.p.length - 1; i++) {
      const [ax, az] = rd.p[i], [bx, bz] = rd.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
      for (let t = 5; t < L; t += 25) {
        const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L, n = nearestB(x, z)?.name; if (!n) continue;
        tot[n] = (tot[n] || 0) + 1;
        let hit = false;
        for (let dx = -18; dx <= 18 && !hit; dx += 6) for (let dz = -18; dz <= 18 && !hit; dz += 6) if (has(x + dx, z + dz, SOLID)) hit = true;
        if (hit) cov[n] = (cov[n] || 0) + 1;
      }
    }
  }
  const sparse = new Set(Object.keys(tot).filter((n) => tot[n] > 30 && (cov[n] || 0) / tot[n] < 0.6 || HISTORIC.test(n)));

  // 2) parques (não constrói dentro), em células de 200 m
  const parkCells = new Map();
  for (const p of data.parks) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const v of p.p) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); z0 = Math.min(z0, v[1]); z1 = Math.max(z1, v[1]); }
    for (let x = Math.floor(x0 / 200); x <= Math.floor(x1 / 200); x++) for (let z = Math.floor(z0 / 200); z <= Math.floor(z1 / 200); z++) { const k = x + ',' + z; if (!parkCells.has(k)) parkCells.set(k, []); parkCells.get(k).push(p.p); }
  }
  const inPark = (x, z) => (parkCells.get(Math.floor(x / 200) + ',' + Math.floor(z / 200)) || []).some((r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; });

  const reserve = data.pois.filter((p) => /^(Nossa Senhora da Saúde|Praça Poço da Panela|Praça de Casa Forte|Poço das Artes|Jardim Secreto do Poço da Panela)$/.test(p.name) || (p.kind === 'park' && /^Parque /.test(p.name))).map((p) => [p.x, p.z, p.name.startsWith('Praça de Casa') ? 45 : 30]);
  // parque de diversões e atrações, monumentos e marcos de bairro: fica livre em volta
  for (const p of data.pois) {
    if (p.name === 'Mirabilândia') reserve.push([p.x, p.z, 150]);
    else if (/^(attraction|monument|memorial|tower|artwork)$/.test(p.kind) || /^(Jardim do Baobá|White Horse|Torre do Zeppelin|Parque de Exposições do Cordeiro|Parque Forte do Arraial Novo do Bom Jesus)$/.test(p.name)) reserve.push([p.x, p.z, p.name.startsWith('Parque') ? 60 : 18]);
  }
  const rectPts = (cx, cz, ux, uz, w, d) => { const nx = -uz, nz = ux; return [[cx - ux * w / 2 - nx * d / 2, cz - uz * w / 2 - nz * d / 2], [cx + ux * w / 2 - nx * d / 2, cz + uz * w / 2 - nz * d / 2], [cx + ux * w / 2 + nx * d / 2, cz + uz * w / 2 + nz * d / 2], [cx - ux * w / 2 + nx * d / 2, cz - uz * w / 2 + nz * d / 2]]; };
  const scan = (cx, cz, ux, uz, w, d, fn) => { const nx = -uz, nz = ux; for (let a = -w / 2; a <= w / 2; a += 1) for (let b = -d / 2; b <= d / 2; b += 1) { const r = fn(cx + ux * a + nx * b, cz + uz * a + nz * b); if (r === false) return false; } return true; };
  const okCell = (x, z) => { const i = cell(x, z); return i >= 0 && !(mask[i] & (WATER | ROAD | SOLID)); };
  // teste rápido (centro e quatro cantos) antes de varrer o lote inteiro: a maioria das tentativas cai aqui
  const free = (cx, cz, ux, uz, w, d, gap) => {
    const nx = -uz, nz = ux, a = (w + gap) / 2, b = (d + 2) / 2;
    if (!okCell(cx, cz) || !okCell(cx + ux * a + nx * b, cz + uz * a + nz * b) || !okCell(cx - ux * a + nx * b, cz - uz * a + nz * b) || !okCell(cx + ux * a - nx * b, cz + uz * a - nz * b) || !okCell(cx - ux * a - nx * b, cz - uz * a - nz * b)) return false;
    return scan(cx, cz, ux, uz, w + gap, d + 2, okCell);
  };
  const stamp = (cx, cz, ux, uz, w, d) => scan(cx, cz, ux, uz, w, d, (x, z) => { const i = cell(x, z); if (i >= 0) mask[i] |= SOLID; });

  // Igreja de Nossa Senhora da Saúde: terreno próprio de frente para o largo, se o OSM não tiver o prédio
  const ns = data.pois.find((p) => p.name === 'Nossa Senhora da Saúde'), lg = data.pois.find((p) => p.name === 'Praça Poço da Panela');
  if (ns && !data.buildings.some((b) => b.n === 'Igreja de Nossa Senhora da Saúde')) {
    const dir = lg ? Math.atan2(lg.x - ns.x, lg.z - ns.z) : 0, ux = Math.sin(dir), uz = Math.cos(dir);
    outer: for (let r = 0; r < 30; r += 3) for (let a = 0; a < Math.PI * 2; a += 0.6) {
      const cx = ns.x + Math.cos(a) * r, cz = ns.z + Math.sin(a) * r;
      if (!free(cx, cz, -uz, ux, 12, 22, 2)) continue;
      data.buildings.push({ p: [...rectPts(cx, cz, -uz, ux, 12, 22)], h: 10, n: 'Igreja de Nossa Senhora da Saúde', t: 'church', cx, cz });
      stamp(cx, cz, -uz, ux, 12, 22);
      break outer;
    }
  }

  // 3) lotes
  const HIST_C = ['#f6f3ec', '#f6f3ec', '#f4efe2', '#f2e3a0', '#e8b04a', '#8fb8de', '#d9624b', '#79b77a', '#c97b9b', '#e98d5a', '#b9a6e0'];
  const MORRO_C = ['#e63946', '#2a9d8f', '#3a86ff', '#ffbe0b', '#8338ec', '#fb5607', '#06d6a0', '#f4a6c6', '#9ad1d4', '#f2e3a0', '#f1f1ee', '#c9b9a3', '#c9b9a3', '#e9c46a'];
  const POP_C = ['#cdbfa9', '#c9b9a3', '#b5653a', '#a85a36', '#e8d36a', '#7fb3d5', '#e59a8c', '#9fd3a8', '#f2f0ea', '#d9c6e8', '#f0b26a'];
  const MID_C = ['#f4f1ea', '#ece6da', '#e6ddc9', '#d8e2e6', '#f2e8c9', '#e9d4c4', '#dfe8d6'];
  let added = 0;
  const count = {};
  for (const rd of data.roads) {
    if (!STREET.includes(rd.k) || rd.tu || rd.b) continue;
    const half = rd.k === 'secondary' ? 6 : rd.k === 'tertiary' ? 5 : 3.5;
    for (let i = 0; i < rd.p.length - 1; i++) {
      const [ax, az] = rd.p[i], [bx, bz] = rd.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 8) continue;
      const bq = nearestB((ax + bx) / 2, (az + bz) / 2); if (!bq || !sparse.has(bq.name)) continue;
      const hist = HISTORIC.test(bq.name), morro = MORRO.test(bq.name), pop = !hist && (morro || POPULAR.test(bq.name));
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (const s of [-1, 1]) for (let t = 4; t < L - 4;) {
        const w = hist ? 7.5 + rnd() * 3.5 : pop ? 4.8 + rnd() * 2.4 : 8 + rnd() * 4;
        const d = hist ? 9 + rnd() * 5 : pop ? 8 + rnd() * 6 : 10 + rnd() * 6;
        const tc = t + w / 2; t += w + (pop ? 0.2 : 1.5 + rnd() * 2.5);
        if (tc > L - 3) break;
        const off = half + (pop ? 1.8 : 2.6) + d / 2, cx = ax + ux * tc - uz * off * s, cz = az + uz * tc + ux * off * s;
        if (!free(cx, cz, ux, uz, w, d, pop ? 0.2 : 2)) continue; // barato primeiro
        if (reserve.some(([x, z, r]) => Math.hypot(x - cx, z - cz) < r) || inPark(cx, cz)) continue;
        const b = { p: rectPts(cx, cz, ux, uz, w, d), t: 'house', gen: 1, cx, cz };
        if (hist) { b.h = 4.2 + Math.floor(rnd() * 3) * 1.2; b.c = pick(HIST_C); }
        else if (morro) { b.h = 3 * (1 + (rnd() < 0.5 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0)) + rnd() * 0.3; b.c = pick(MORRO_C); b.style = 'comunidade'; if (rnd() < 0.8) b.tank = [(rnd() - 0.5) * w * 0.4, (rnd() - 0.5) * d * 0.4]; }
        else if (pop) { b.h = rnd() < 0.55 ? 3.4 : 6.4; b.c = pick(POP_C); b.style = 'casa'; if (rnd() < 0.75) b.tank = [(rnd() - 0.5) * w * 0.4, (rnd() - 0.5) * d * 0.4]; }
        else { const r = rnd(); b.h = r < 0.12 ? 10 + Math.floor(rnd() * 2) * 3 : r < 0.55 ? 3.6 : 6.6; b.c = pick(MID_C); b.style = b.h > 9 ? 'modern' : 'casa'; if (rnd() < 0.4 && b.h < 9) b.tank = [(rnd() - 0.5) * w * 0.4, (rnd() - 0.5) * d * 0.4]; }
        data.buildings.push(b);
        stamp(cx, cz, ux, uz, w, d);
        added++; count[bq.name] = (count[bq.name] || 0) + 1;
      }
    }
  }
  return { added, count, sparse: [...sparse] };
}

// ---------------------------------------------------------------- placas
export function buildPlaces(group, data, env) {
  // prédios famosos do Recife Antigo sem ponto no OSM: viram lugar com letreiro (e aparecem no HUD)
  for (const [n, kind] of [['CESAR - Centro de Estudos Avançados do Recife', 'tech'], ['Cesar School', 'college'], ['Porto Digital', 'tech'], ['Prefeitura da Cidade do Recife', 'townhall']]) {
    if (data.pois.some((p) => p.name === n)) continue;
    const b = data.buildings.filter((q) => q.n === n).sort((a, c) => (c.h || 0) - (a.h || 0))[0];
    if (b) data.pois.push({ name: n, kind, x: b.cx, z: b.cz });
  }
  // índice de prédios e de ruas
  // chaves numéricas (texto 'x,z' custava ~0,1 s só para montar o índice de meio milhão de prédios)
  const cells = new Map(), ck = (x, z) => x * 65536 + z, key = (x, z) => ck(Math.floor(x / 60), Math.floor(z / 60));
  data.buildings.forEach((b, i) => {
    const r = b.p; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of r) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    for (let x = Math.floor(x0 / 60); x <= Math.floor(x1 / 60); x++) for (let z = Math.floor(z0 / 60); z <= Math.floor(z1 / 60); z++) { const k = ck(x, z); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); }
  });
  const roadCells = new Map();
  for (const r of data.roads) if (!['footway', 'path', 'steps', 'cycleway'].includes(r.k)) for (let i = 0; i < r.p.length - 1; i++) {
    const a = r.p[i], b = r.p[i + 1], k = key((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    if (!roadCells.has(k)) roadCells.set(k, []);
    roadCells.get(k).push([a, b]);
  }
  const roadDist = (x, z) => {
    let best = 1e9; const cx = Math.floor(x / 60), cz = Math.floor(z / 60);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [a, b] of roadCells.get(ck(cx + i, cz + j)) || []) best = Math.min(best, segDist(x, z, a, b));
    return best;
  };
  const buildingAt = (x, z, maxD = 16) => {
    let best = null, bd = maxD;
    const cx = Math.floor(x / 60), cz = Math.floor(z / 60);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const idx of cells.get(ck(cx + i, cz + j)) || []) {
      const b = data.buildings[idx], r = ringOf(b);
      if (r.length < 3 || NOWALL.has(b.t)) continue; // coberturas não têm parede para pendurar placa
      if (inside(r, x, z)) return b;
      for (let k = 0; k < r.length; k++) { const d = segDist(x, z, r[k], r[(k + 1) % r.length]); if (d < bd) { bd = d; best = b; } }
    }
    return best;
  };
  // face do prédio virada para a rua (ou para um ponto dado)
  const faceOf = (b, toward) => {
    const r = ringOf(b);
    let A = 0; for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length]; A += a[0] * c[1] - c[0] * a[1]; }
    const s = A > 0 ? 1 : -1; // normal para fora do prédio
    let best = null;
    for (let i = 0; i < r.length; i++) {
      const a = r[i], c = r[(i + 1) % r.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 3) continue;
      const nx = (s * (c[1] - a[1])) / L, nz = (-s * (c[0] - a[0])) / L, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      const score = toward ? Math.hypot(mx + nx * 3 - toward[0], mz + nz * 3 - toward[1]) : roadDist(mx + nx * 4, mz + nz * 4);
      if (!best || score - L * 0.02 < best.score) best = { score: score - L * 0.02, mx, mz, nx, nz, L };
    }
    return best;
  };

  // ----- atlas de textos
  // células de 256 × 48 px: 336 placas por atlas de 2048 px (antes eram 84)
  const CW = 256, CH = 48, COLS = 8, ROWS = 42;
  const atlases = [];
  const newAtlas = () => {
    const c = document.createElement('canvas'); c.width = CW * COLS; c.height = CH * ROWS;
    const a = { c, g: c.getContext('2d'), n: 0, geos: [] };
    atlases.push(a); return a;
  };
  let cur = newAtlas();
  const drawCell = (text, st) => {
    if (cur.n >= COLS * ROWS) cur = newAtlas();
    const i = cur.n++, col = i % COLS, row = Math.floor(i / COLS), g = cur.g, x = col * CW, y = row * CH;
    g.fillStyle = st.bg; g.fillRect(x, y, CW, CH);
    g.strokeStyle = st.fg; g.globalAlpha = 0.5; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, CW - 6, CH - 6); g.globalAlpha = 1;
    let size = 28; g.font = `800 ${size}px Inter, Arial, sans-serif`;
    while (g.measureText(text).width > CW - 18 && size > 11) { size -= 1; g.font = `800 ${size}px Inter, Arial, sans-serif`; }
    g.fillStyle = st.fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + CW / 2, y + CH / 2 + 2);
    return { atlas: cur, col, row };
  };
  const plates = [], awnings = [], posts = [];
  const plateM = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.6, metalness: 0.3 });
  const AWN = ['#c8102e', '#1d5fa8', '#2a9d58', '#e9a23b', '#7b2d8b', '#f2f2f0'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  const awnKits = AWN.map(() => []);
  const addSign = (text, st, x, y, z, nx, nz, w, h) => {
    const cell = drawCell(text, st);
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cell.col + uv.getX(i)) / COLS, 1 - (cell.row + 1) / ROWS + uv.getY(i) / ROWS);
    g.rotateY(Math.atan2(nx, nz)); g.translate(x + nx * 0.14, y + heightAt(x, z), z + nz * 0.14);
    cell.atlas.geos.push(g);
    plates.push([B, [w + 0.2, h + 0.2, 0.12], [x + nx * 0.06, y, z + nz * 0.06], [0, Math.atan2(nx, nz), 0]]);
  };

  const seen = [];
  const KIND = new Set(Object.keys(STYLE));
  let count = 0;
  for (const p of data.pois) {
    if (!KIND.has(p.kind) || p.kind === 'shop') continue;
    if (seen.some((q) => q.name === p.name && Math.hypot(q.x - p.x, q.z - p.z) < 150)) continue;
    seen.push(p);
    const st = { ...STYLE[p.kind], ...(SPECIAL[p.name] || SPECIAL[Object.keys(SPECIAL).find((k) => p.name.startsWith(k))] || {}) };
    const text = st.text || ((st.icon ? st.icon + ' ' : '') + p.name);
    let b = buildingAt(p.x, p.z);
    const face = b && faceOf(b);
    if (b && !face) b = null; // prédio minúsculo sem parede útil: vira totem
    if (st.roof && b) {
      // shopping: letreiro grande iluminado no alto
      const f = face, bh = b.h || 12, w = Math.min(22, Math.max(10, f.L * 0.7));
      addSign(text, st, f.mx, bh + 2.2, f.mz, f.nx, f.nz, w, w * CH / CW);
      posts.push([B, [0.3, 2.2, 0.3], [f.mx + f.nz * w * 0.35, bh + 1.1, f.mz - f.nx * w * 0.35]], [B, [0.3, 2.2, 0.3], [f.mx - f.nz * w * 0.35, bh + 1.1, f.mz + f.nx * w * 0.35]]);
      count++; continue;
    }
    if (b) {
      const f = face;
      const w = Math.min(f.L * 0.85, st.awn ? 4.2 : 6), h = w * CH / CW, y = Math.min(st.y || 3.5, Math.max(2.6, (b.h || 6) - 1));
      addSign(text, st, f.mx, y, f.mz, f.nx, f.nz, w, h);
      if (st.awn) awnKits[count % AWN.length].push([B, [w + 0.4, 0.08, 1.3], [f.mx + f.nx * 0.65, y - h / 2 - 0.45, f.mz + f.nz * 0.65], [0.35, Math.atan2(f.nx, f.nz), 0], 'YXZ']);
    } else {
      // sem prédio por perto: totem na calçada
      let best = null;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) { const d = roadDist(p.x + Math.sin(a) * 6, p.z + Math.cos(a) * 6); if (!best || d < best.d) best = { d, a }; }
      const nx = Math.sin(best.a), nz = Math.cos(best.a);
      addSign(text, st, p.x, 2.6, p.z, nx, nz, 3.2, 3.2 * CH / CW);
      posts.push([B, [0.15, 2.2, 0.15], [p.x, 1.1, p.z]]);
    }
    count++;
  }

  // comércio de rua da Boa Vista: placa e toldo nas lojas do térreo
  let si = 0;
  const done = new Set();
  for (const r of data.roads) {
    if (!r.n || !COMMERCIAL.test(r.n)) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 2) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let d = 4; d < L; d += 10) for (const s of [-1, 1]) {
        const half = r.k === 'primary' || r.k === 'trunk' ? 9 : 6;
        const px = ax + ux * d - uz * half * s, pz = az + uz * d + ux * half * s;
        const b = buildingAt(px, pz, 8);
        if (!b || done.has(b) || b.n) continue;
        done.add(b);
        const f = faceOf(b, [ax + ux * d, az + uz * d]);
        if (!f || f.L < 4 || segDist(f.mx, f.mz, r.p[i], r.p[i + 1]) > half + 6) continue; // fachada de verdade na beira da rua
        const name = SHOPS[si % SHOPS.length], st = { ...STYLE.shop, bg: SHOP_COLORS[si % SHOP_COLORS.length] };
        const w = Math.min(f.L * 0.8, 4.5), h = w * CH / CW;
        addSign(name, st, f.mx, 3.0, f.mz, f.nx, f.nz, w, h);
        b.placa = true; // rua.js não põe outra loja neste prédio
        awnKits[si % AWN.length].push([B, [w + 0.4, 0.08, 1.4], [f.mx + f.nx * 0.7, 2.45, f.mz + f.nz * 0.7], [0.35, Math.atan2(f.nx, f.nz), 0], 'YXZ']);
        si++;
      }
    }
  }

  // ----- monta as malhas
  const signMats = [];
  for (const a of atlases) {
    if (!a.geos.length) continue;
    const t = releaseOnUpload(new THREE.CanvasTexture(a.c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.05, roughness: 0.45 });
    signMats.push(m);
    const mesh = new THREE.Mesh(mergeGeometries(a.geos), m); mesh.receiveShadow = true;
    group.add(mesh);
  }
  const bakeList = (list) => {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    return mergeGeometries(list.map(([geo, sc, ps, rt, order]) => { const g = geo.toNonIndexed(); m4.compose(new THREE.Vector3(ps[0], ps[1] + heightAt(ps[0], ps[2]), ps[2]), q.setFromEuler(e.set(...(rt || [0, 0, 0]), order || 'XYZ')), new THREE.Vector3(...sc)); return g.applyMatrix4(m4); }));
  };
  if (plates.length) { const m = new THREE.Mesh(bakeList([...plates, ...posts]), plateM); m.castShadow = true; group.add(m); }
  awnKits.forEach((list, i) => { if (list.length) { const m = new THREE.Mesh(bakeList(list), AWN[i]); m.castShadow = true; m.receiveShadow = true; group.add(m); } });

  buildBoaVista(group, data, env);
  return { count: count + si, shops: si, setNight(n) { for (const m of signMats) m.emissiveIntensity = 0.05 + n * 0.85; } };
}

// ---------------------------------------------------------------- Boa Vista: Caranguejo, Obelisco, Praça Maciel Pinheiro, Conde da Boa Vista
function buildBoaVista(group, data, env) {
  const poi = (n) => data.pois.find((p) => p.name === n);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const add = (geo, mat, x, y, z, r = [0, 0, 0], s = [1, 1, 1]) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...r); m.scale.set(...s); m.castShadow = true; m.receiveShadow = true; group.add(m); stampMesh(m); return m; };
  const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z);
  const spotNear = (x, z) => { for (let r = 0; r < 30; r += 2) for (let a = 0; a < Math.PI * 2; a += 0.5) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (free(px, pz) && free(px + 2, pz) && free(px - 2, pz) && free(px, pz + 2) && free(px, pz - 2)) return [px, pz]; } return [x, z]; };

  // Caranguejo gigante da Rua da Aurora (homenagem ao manguebeat)
  const cr = poi('Caranguejo da Rua da Aurora');
  if (cr) {
    const [x, z] = spotNear(cr.x, cr.z), shell = M('#c4471f', { roughness: 0.45, metalness: 0.2 });
    add(new THREE.CylinderGeometry(1.4, 1.6, 0.6, 16), M('#9a948a'), x, 0.3, z);
    add(new THREE.SphereGeometry(1.4, 20, 12), shell, x, 1.6, z, [0, 0, 0], [1.3, 0.55, 1]);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.09, 0.07, 1.6, 6), shell, x + s * 1.8, 1.05, z - 0.8 + k * 0.5, [0, 0, s * 1.0]);
      add(new THREE.CylinderGeometry(0.14, 0.12, 1.2, 8), shell, x + s * 1.3, 2.0, z + 1.4, [0.9, 0, s * 0.4]);
      add(new THREE.SphereGeometry(0.42, 12, 8), shell, x + s * 1.55, 2.55, z + 1.95, [0, 0, 0], [1, 0.7, 1.4]);
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), M('#222'), x + s * 0.35, 2.3, z + 1.0);
      add(new THREE.SphereGeometry(0.11, 8, 6), M('#111'), x + s * 0.35, 2.58, z + 1.0);
    }
  }
  // Obelisco da Rua da Aurora
  const ob = poi('Obelisco da Rua da Aurora');
  if (ob) {
    const [x, z] = spotNear(ob.x, ob.z), stone = M('#d8d0bf', { roughness: 0.8 });
    add(new THREE.BoxGeometry(3, 1.2, 3), stone, x, 0.6, z);
    add(new THREE.CylinderGeometry(0.55, 1.0, 11, 4, 1), stone, x, 6.7, z, [0, Math.PI / 4, 0]);
    add(new THREE.ConeGeometry(0.75, 1.3, 4), stone, x, 12.85, z, [0, Math.PI / 4, 0]);
  }
  // Praça Maciel Pinheiro: chafariz monumental
  const mp = data.pois.find((p) => p.name === 'Praça Maciel Pinheiro' && p.kind === 'park') || poi('Praça Maciel Pinheiro');
  if (mp) {
    const [x, z] = spotNear(mp.x, mp.z), stone = M('#e2dccd', { roughness: 0.7 }), water = M('#3f8fb0', { roughness: 0.05, metalness: 0.3, emissive: '#0d2f3c' });
    add(new THREE.CylinderGeometry(6, 6.3, 0.8, 40), stone, x, 0.4, z);
    add(new THREE.CylinderGeometry(5.5, 5.5, 0.1, 40), water, x, 0.78, z);
    add(new THREE.CylinderGeometry(1.0, 1.4, 2.6, 16), stone, x, 2.0, z);
    add(new THREE.CylinderGeometry(2.4, 0.8, 0.5, 24), stone, x, 3.4, z);
    add(new THREE.CylinderGeometry(0.5, 0.7, 1.6, 12), stone, x, 4.4, z);
    add(new THREE.CylinderGeometry(1.3, 0.4, 0.35, 20), stone, x, 5.3, z);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; add(new THREE.SphereGeometry(0.45, 10, 8), M('#bfb6a3'), x + Math.cos(a) * 1.5, 1.4, z + Math.sin(a) * 1.5, [0, 0, 0], [1, 0.9, 1.3]); }
    const bronze = new THREE.MeshStandardMaterial({ color: '#6b4f2e', metalness: 0.8, roughness: 0.35 });
    const st = makePerson({ player: true, hair: 'bun', longSleeve: true });
    st.traverse((o) => { if (o.isMesh) o.material = bronze; });
    st.position.set(x, 5.45, z); st.scale.setScalar(0.9); st.userData.armL.rotation.x = -2.6; group.add(st);
  }
  // Monumento ao Conde da Boa Vista: estátua em pedestal
  const cb = poi('Monumento ao Conde da Boa Vista');
  if (cb) {
    const [x, z] = spotNear(cb.x, cb.z);
    add(new THREE.BoxGeometry(2.2, 3.4, 2.2), M('#d8d0bf', { roughness: 0.8 }), x, 1.7, z);
    const bronze = new THREE.MeshStandardMaterial({ color: '#5b4428', metalness: 0.8, roughness: 0.35 });
    const st = makePerson({ player: true, hair: 'short', longSleeve: true });
    st.traverse((o) => { if (o.isMesh) o.material = bronze; });
    st.position.set(x, 3.4, z); st.scale.setScalar(1.3); st.userData.armR.rotation.x = -1.4; group.add(st);
  }
}
