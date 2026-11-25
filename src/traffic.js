import * as THREE from 'three';
import { makeVehicle, makePerson, animateVehicle, animatePerson } from './models.js';
import { ROAD_W } from './world.js';
import { makeUmbrella } from './weather.js';

const FOOT = new Set(['pedestrian', 'footway', 'path', 'steps', 'cycleway', 'track']);
const SPEED = { primary: 14, secondary: 12, tertiary: 11, trunk: 15, unclassified: 9, residential: 8, living_street: 5 };

const FALAS_CORRE = [
  'Oxe! Tá doido, é?', 'Vixe Maria!', 'Caraí, que pressa!', 'Ô, painho, devagar!', 'Tá pensando que é Fórmula 1, macho?', 'Avexe não, visse!',
  'Mainha, olha o maluco!', 'Caraí, boy, quase me leva!', 'Ei, mermão, olha a faixa!', 'Tá virado no mói de coentro, é?', 'Vai devagar, abestado!',
  'Oxe, quer morrer, é, boy?', 'Lá ele! Corre não, visse!', 'Tá aperreado por quê, macho?', 'Tá avexado pra quê, tabacudo?', 'Que queijo do caraí!',
  'Quase uma chapoletada, visse!', 'Ei, abestalhado, olha por onde anda!', 'Vou estilar com esse cara!', 'Que tiração é essa, boy?',
];
const FALAS_ATROPELO = ['Ai, meu Deus!', 'Oxente!', 'Tu me paga, visse!', 'Valei-me, Frei Damião!', 'Caraí! Tá cego, é?', 'Ai, minha coluna, boy!', 'Que chapoletada, caraí!', 'Deu a mulesta!'];
const FALAS_ROUBO = ['Oxe! Devolve meu carro, macho!', 'Caraí! Acabei de pagar o IPVA!', 'Ladrão! Pega ladrão!', 'Meu carro, visse! Volta aqui!', 'Ei, boy, isso é meu!', 'Caraí, mainha vai me matar!', 'Deu a mulesta! Levaram meu carro!', 'Bora ver, viu! Tu não vai longe!'];
const FALAS_CHUVA = ['Caraí, que toró!', 'Vixe, a Agamenon já deve tá alagada.', 'Esqueci o guarda-chuva, de novo!', 'Essa chuva não para mais não, visse?', 'Vou ficar ensopado até o trabalho.', 'Corre que lá vem mais!', 'Pronto, o ônibus vai atrasar.'];
const FALAS_SOLTAS = [
  // de todo canto
  'Bora pro Marco Zero mais tarde?', 'Esse calor tá arretado hoje…', 'Vou pegar o ônibus ali no Cais.', 'Tem frevo no Paço hoje, visse?',
  'Me vê uma tapioca, por favor!', 'O Leão, o Timbu e a Cobra Coral, tudo aqui.', 'Que sol da gota serena!', 'Bora tomar uma água de coco?',
  'Caraí, que quentura!', 'Massa demais esse som!', 'Tô liso, só no fim do mês, visse?', 'Lá ele! Deus me livre!', 'Oxe, tu é doido, é?',
  'Ei, bença, tia!', 'Bença, vó! Tô indo ali e já volto.', 'Deus te abençoe, meu filho.', 'Arrodeia por ali que é mais perto.',
  'Tô morgado hoje, dormi nada com essa muriçoca.', 'Vem um toró aí, olha o céu!', 'Tô aperreado, perdi o bacurau ontem.', 'Dispense, visse? Deixa isso pra lá.',
  'Vamos? — Aí dento!', 'Já tô chegando, viu? Tchau, tchau!', 'Isso aí é pala, boy.', 'Que cebosa essa fila…',
  // comida
  'Bora bater o sarro num caldinho de feijão?', 'Me vê um arrumadinho de charque!', 'Macaxeira com charque no café, é o ouro!', 'Tapioca molhada na Pracinha, bora?',
  'Mainha fez cartola hoje, visse?', 'Trouxe bolo de rolo do São José!', 'Bora comer agulhinha frita em Brasília Teimosa?', 'Um espetinho com queijo coalho e mel de engenho…',
  'Mungunzá quentinho, quem quer?', 'Bolo Souza Leão de vó é outro nível.', 'Hoje tem chambaril no Mercado da Encruzilhada!', 'Quero um guaiamum, meu rato!',
  // futebol (Trio de Ferro)
  'Vai ter clássico domingo, bora pro Arruda?', 'Teu time pipocou de novo, foi?', 'Esse ano é nosso! — Aí dento!', 'Vou secar o rival hoje na TV.',
  'Ei, seu peba, toca a bola na pelada!', 'Bora um baba na praia mais tarde?', 'A bola lambeu a trave, caraí!', 'Que desmantelo foi aquele jogo ontem?',
  // carnaval
  'Tu vai brincar onde no Carnaval?', 'O Galo é no Sábado de Zé Pereira, visse!', 'Vim bem cheguei hoje!', 'A La Ursa quer dinheiro, quem não dá é pirangueiro!',
  'Que furdunço no Recife Antigo!', 'Bora sair na troça da rua?', 'Vou brincar até a apoteose!',
  // da comunidade
  'Ei, boy, chega mais!', 'Essa boyzinha é o ouro, visse?', 'Esse passinho aí é o ouro!', 'Hoje tem brega no paredão, bora?',
  'Mermão, tu viu o baile ontem?', 'Ô, boyzinho, me empresta o carregador?', 'Caraí, macho, tô morrendo de rir!', 'Visse o novo passinho da galera?',
  'Na moral, ninguém dança igual a gente.', 'Bora pra pracinha que hoje tem resenha!', 'E aí, meu rato, beleza?', 'Minha boinha tá vindo aí!',
  'Esse kit tá peso, visse!', 'Mantenha a postura, boy!', 'Tive uma lusa: bora pro Marco Zero!', 'Tu é paia, boy, sumisse ontem.',
  'Mancoso! Disse que vinha e não veio.', 'Para de pala de botico, macho!', 'Rata peso, olha o estilo!',
  // da classe média
  'Bora pro RioMar depois da praia?', 'Tô morando no Parnamirim agora, visse?', 'A Agamenon tá de rosca hoje…', 'Vou pegar um Uber pro Recife Antigo.',
  'Esse fim de semana é Porto de Galinhas!', 'Bora tomar um chope em Casa Forte?', 'Massa demais o novo café ali da Jaqueira.', 'Painho emprestou o carro, bora pra Boa Viagem!',
  'Tá cheio de boy na Jaqueira hoje.', 'Tem chorinho no Real Botequim sábado.', 'Bora pro Parraxaxá comer jerimum e carne de sol?', 'O bombeiro do posto disse que o etanol subiu.',
];
const FALAS_NOITE = ['Bora pro Recife Antigo? Hoje tem show!', 'Essa brisa da noite é boa demais.', 'Vou comer um cachorro-quente ali na orla.', 'Tô morto, dia puxado hoje…', 'Bora tomar uma no Bar do Biu?', 'Hoje é dia de brega, boyzinha!', 'Bora pegar o bacurau, senão fica!', 'Tô bicado já, visse!'];
const DIURNAS = /sol|calor|tapioca|água de coco|quentura|café|baba na praia/i;
export const pick = (a) => a[Math.floor(Math.random() * a.length)];

const PARK_CAR = new Set(['residential', 'tertiary', 'unclassified', 'living_street', 'secondary']);

// Aresta do grafo. Comprimento, direção e afastamento da faixa ficam numa tabela Float64 compartilhada (4 por aresta) e o meio
// é calculado das pontas: com meio milhão de arestas (a pé e de carro), número quebrado guardado no objeto vira uma
// caixinha à parte na memória do Chrome, e isso pesava dezenas de MB. Os campos são só de leitura depois de montado.
class Edge {
  constructor(F, i, k, a, b, w, vmax, name) { this.F = F; this.i = i; this.k = k; this.a = a; this.b = b; this.w = w; this.vmax = vmax; this.name = name; }
  get len() { return this.F[this.i * 4]; }
  get dx() { return this.F[this.i * 4 + 1]; }
  get dz() { return this.F[this.i * 4 + 2]; }
  get lane() { return this.F[this.i * 4 + 3]; }
  get mx() { return (this.a.x + this.b.x) / 2; }
  get mz() { return (this.a.z + this.b.z) / 2; }
}

function buildGraph(roads, accept, lane, oneway) {
  const nodes = new Map();
  const edges = [];
  let cap = 0; for (const r of roads) if (accept(r)) cap += Math.max(0, r.p.length - 1) * 2;
  const F = new Float64Array(cap * 4);
  const node = (p) => {
    const k = p[0] + ',' + p[1];
    let n = nodes.get(k);
    if (!n) nodes.set(k, (n = { id: nodes.size, x: p[0], z: p[1], out: [], in: [] }));
    return n;
  };
  for (const r of roads) {
    if (!accept(r)) continue;
    const w = ROAD_W[r.k] || 4;
    const ow = oneway ? r.o || 0 : 0;
    const ln = lane(r, w, ow), vmax = SPEED[r.k] || 8;
    for (let i = 0; i < r.p.length - 1; i++) {
      const A = node(r.p[i]), B = node(r.p[i + 1]);
      const add = (a, b) => {
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        if (len < 0.3) return;
        const j = edges.length;
        F[j * 4] = len; F[j * 4 + 1] = dx / len; F[j * 4 + 2] = dz / len; F[j * 4 + 3] = ln;
        a.out.push(j);
        b.in.push(j);
        edges.push(new Edge(F, j, r.k, a, b, w, vmax, r.n));
      };
      if (ow !== -1) add(A, B);
      if (ow !== 1) add(B, A);
    }
  }
  // índice espacial: arestas por célula de 100 m
  const cells = new Map();
  edges.forEach((e) => {
    const k = Math.floor(e.mx / CELL) + ',' + Math.floor(e.mz / CELL);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = []));
    c.push(e);
  });
  // os nós só são lidos em lista (.size e .values()): o Map com chave "x,z" (uma string por nó) sai da memória
  const list = [...nodes.values()];
  nodes.clear();
  return { nodes: { size: list.length, values: () => list.values() }, edges, cells };
}
const CELL = 100;

// sobreposição de dois retângulos (carros) no plano; devolve a direção e a profundidade para separar a de b
export function obbHit(a, b) {
  const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
  const ra = Math.max(a.userData.L || 4, a.userData.W || 2), rb = Math.max(b.userData.L || 4, b.userData.W || 2);
  if (dx * dx + dz * dz > ((ra + rb) / 2) ** 2 * 1.3) return null;
  const axes = (m) => { const h = m.rotation.y; return [[Math.sin(h), Math.cos(h), (m.userData.L || 4) / 2], [Math.cos(h), -Math.sin(h), (m.userData.W || 1.8) / 2]]; };
  const A = axes(a), B = axes(b);
  let best = null;
  for (const [ax, az] of [...A, ...B]) {
    const proj = (S) => S.reduce((s, [ux, uz, e]) => s + Math.abs(ux * ax + uz * az) * e, 0);
    const d = dx * ax + dz * az, o = proj(A) + proj(B) - Math.abs(d);
    if (o <= 0) return null;
    if (!best || o < best.depth) best = { depth: o, nx: ax * Math.sign(d || 1), nz: az * Math.sign(d || 1) };
  }
  return best;
}

export class Traffic {
  constructor(scene, world, hud, audio) {
    this.scene = scene; this.world = world; this.hud = hud; this.audio = audio;
    const roads = world.data.roads;
    this.drive = buildGraph(roads, (r) => r.d && r.k !== 'service' && !r.tu, (r, w, ow) => (ow ? (w >= 9 ? w / 4 : 0) : w / 4), true);
    this.foot = buildGraph(roads, (r) => !r.tu && !['motorway', 'trunk', 'motorway_link', 'trunk_link'].includes(r.k),
      (r, w) => (FOOT.has(r.k) ? (r.k === 'pedestrian' ? 1.5 : 0) : w / 2 + 1.1), false);
    this.cars = [];
    this.peds = [];
    this.parked = [];
    this.extraObstacles = [];
    this.onCrime = null;
    this.maxCars = 55;
    this.maxPeds = 70;
  }

  randomEdge(graph, cx, cz, rMin, rMax) {
    for (let t = 0; t < 40; t++) {
      const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
      const list = graph.cells.get(Math.floor((cx + Math.cos(a) * r) / CELL) + ',' + Math.floor((cz + Math.sin(a) * r) / CELL));
      if (!list) continue;
      const e = list[Math.floor(Math.random() * list.length)];
      const d = Math.hypot(e.mx - cx, e.mz - cz);
      if (d >= rMin - CELL && d <= rMax + CELL) return e;
    }
    return null;
  }

  place(agent, graph, e, t) {
    agent.e = e; agent.t = t;
    agent.next = this.chooseNext(graph, e);
    const p = this.posOn(e, t);
    agent.mesh.position.set(p.x, 0, p.z);
    agent.mesh.rotation.y = Math.atan2(e.dx, e.dz);
  }

  posOn(e, t) {
    return { x: e.a.x + e.dx * t - e.dz * e.lane, z: e.a.z + e.dz * t + e.dx * e.lane };
  }

  // posição do pedestre na aresta, sempre na calçada: tenta o lado de costume, depois o outro; null se os dois
  // lados caem na pista de carro
  pedPos(e, t, cur) {
    const isDrive = this.world.isDrive, isSolid = this.world.isSolid;
    let a = this.posOn(e, t);
    // rua estreita (Recife Antigo): o recuo da calçada passa da fachada; encolhe o recuo até sair de dentro do prédio
    if (isSolid?.(a.x, a.z)) {
      const cx = e.a.x + e.dx * t, cz = e.a.z + e.dz * t; let fit = null, edge = null;
      for (const f of [0.8, 0.6, 0.4, 0.2, 0]) { const q = { x: cx + (a.x - cx) * f, z: cz + (a.z - cz) * f }; if (isSolid(q.x, q.z)) continue; if (!isDrive?.(q.x, q.z)) { fit = q; break; } edge ||= q; }
      if (fit || edge) return fit || edge; // sem calçada livre: anda na beira da rua, como no Recife Antigo
    }
    if (!isDrive || !isDrive(a.x, a.z)) return a;
    const b = { x: e.a.x + e.dx * t + e.dz * e.lane, z: e.a.z + e.dz * t - e.dx * e.lane };
    if (!isDrive(b.x, b.z)) return b;
    return cur && !isDrive(cur.x, cur.z) ? null : a;
  }
  crossesDrive(p, q) {
    const isDrive = this.world.isDrive; if (!isDrive) return false;
    for (let k = 1; k < 6; k++) { const x = p.x + ((q.x - p.x) * k) / 6, z = p.z + ((q.z - p.z) * k) / 6; if (isDrive(x, z)) return true; }
    return false;
  }

  chooseNext(graph, e) {
    const outs = e.b.out.map((i) => graph.edges[i]);
    const fwd = outs.filter((o) => o.b !== e.a);
    const list = fwd.length ? fwd : outs;
    if (!list.length) return null;
    // prefere seguir reto
    const scored = list.map((o) => ({ o, s: o.dx * e.dx + o.dz * e.dz + Math.random() * 1.2 }));
    scored.sort((a, b) => b.s - a.s);
    return scored[0].o;
  }

  spawnCar(px, pz, rMin, rMax) {
    const e = this.randomEdge(this.drive, px, pz, rMin, rMax);
    if (!e) return;
    const r = Math.random();
    // Recife tem moto e entregador de bike pra todo lado
    const corredor = /Conde da Boa Vista/.test(e.name || ''); // corredor: muito mais ônibus
    const kind = r < (corredor ? 0.4 : 0.06) ? 'bus' : r < 0.32 ? 'moto' : r < 0.42 ? 'bike' : r < 0.55 ? 'suv' : 'car';
    const mesh = makeVehicle(kind);
    this.scene.add(mesh);
    // bike vai no canto da pista, perto do meio-fio, pros carros passarem do lado
    const car = { mesh, v: kind === 'bike' ? 4 : e.vmax * 0.6, stuck: 0, ghost: 0, side: kind === 'bike' ? 1 : 0 };
    this.place(car, this.drive, e, Math.random() * e.len);
    this.cars.push(car);
  }

  spawnParked(px, pz) {
    const e = this.randomEdge(this.drive, px, pz, 25, 230);
    if (!e || e.k === 'motorway' || e.k === 'trunk') return;
    // carro estacionado em paralelo junto ao meio-fio (rua de bairro e secundária) ou moto/bike de bico pra guia
    const car = Math.random() < 0.6 && PARK_CAR.has(e.k) && (e.w || 7) >= 7;
    const t = (car ? 5 : 3) + Math.random() * Math.max(0, e.len - (car ? 10 : 6)), side = (e.w || 7) / 2 - (car ? 1.05 : 0.5);
    if (car && e.len < 12) return;
    const x = e.a.x + e.dx * t - e.dz * side, z = e.a.z + e.dz * t + e.dx * side;
    if (this.isFree && !this.isFree(x, z)) return;
    if (this.parked.some((c) => Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z) < (car ? 5.5 : 3))) return;
    const mesh = car ? makeVehicle(Math.random() < 0.3 ? 'suv' : 'car') : makeVehicle(Math.random() < 0.65 ? 'moto' : 'bike');
    if (mesh.userData.rider) mesh.userData.rider.visible = false;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.atan2(e.dx, e.dz) + (car ? 0 : (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 - 0.5)); // moto: de bico pro meio-fio, inclinada
    this.scene.add(mesh);
    this.parked.push({ mesh, v: 0, auto: true, side: car }); // side: o trânsito passa do lado, sem frear
  }

  spawnPed(px, pz, rMin, rMax) {
    const e = this.randomEdge(this.foot, px, pz, rMin, rMax);
    if (!e) return;
    const t = Math.random() * e.len, at = this.pedPos(e, t, null);
    if (this.world.isDrive && this.world.isDrive(at.x, at.z)) return; // nasce sempre na calçada
    const mesh = makePerson();
    this.scene.add(mesh);
    const ped = { mesh, v: 1.1 + Math.random() * 0.6, down: 0, talk: Math.random() * 20, speechCd: 0 };
    this.place(ped, this.foot, e, t);
    mesh.position.set(at.x, 0, at.z);
    this.peds.push(ped);
  }

  removeCar(car) {
    this.cars.splice(this.cars.indexOf(car), 1);
  }

  nearestCar(x, z, maxD) {
    let best = null, bd = maxD;
    for (const c of [...this.cars, ...this.parked]) {
      const d = Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // dono do carro roubado sai reclamando
  ejectDriver(car) {
    const mesh = makePerson();
    const h = car.mesh.rotation.y;
    mesh.position.set(car.mesh.position.x + Math.cos(h) * 2.4, 0, car.mesh.position.z - Math.sin(h) * 2.4);
    this.scene.add(mesh);
    const e = this.randomEdge(this.foot, mesh.position.x, mesh.position.z, 0, 40);
    const ped = { mesh, v: 3.5, down: 0, talk: 99, speechCd: 4, flee: 6 };
    if (e) { ped.e = e; ped.t = e.len / 2; ped.next = this.chooseNext(this.foot, e); }
    this.peds.push(ped);
    this.hud.say(mesh, pick(FALAS_ROUBO), 3.5);
    this.onCrime?.(1, 'Roubo de veículo');
  }

  nearestEdge(graph, x, z) {
    let best = null, bd = Infinity;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let ring = 0; ring < 30; ring++) {
      for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const list = graph.cells.get(cx + i + ',' + (cz + j));
        if (!list) continue;
        for (const e of list) {
          const t = Math.max(0, Math.min(e.len, (x - e.a.x) * e.dx + (z - e.a.z) * e.dz));
          const d = Math.hypot(e.a.x + e.dx * t - x, e.a.z + e.dz * t - z);
          if (d < bd) { bd = d; best = { e, t, d }; }
        }
      }
      // edges podem ter até ~meia aresta de distância do centro da célula
      if (best && bd < (ring - 1) * CELL) return best;
    }
    if (best) return best;
    for (const e of graph.edges) {
      const t = Math.max(0, Math.min(e.len, (x - e.a.x) * e.dx + (z - e.a.z) * e.dz));
      const d = Math.hypot(e.a.x + e.dx * t - x, e.a.z + e.dz * t - z);
      if (d < bd) { bd = d; best = { e, t, d }; }
    }
    return best;
  }

  update(dt, player) {
    const px = player.pos.x, pz = player.pos.z;
    // população em volta do jogador
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (Math.hypot(c.mesh.position.x - px, c.mesh.position.z - pz) > 520) { this.scene.remove(c.mesh); this.cars.splice(i, 1); }
    }
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (Math.hypot(p.mesh.position.x - px, p.mesh.position.z - pz) > 260) { this.scene.remove(p.mesh); this.hud.forget(p.mesh); this.peds.splice(i, 1); }
    }
    // motos e bikes estacionadas no meio-fio, pra pegar (ou roubar)
    for (let i = this.parked.length - 1; i >= 0; i--) {
      const c = this.parked[i];
      if (c.auto && c.mesh !== player.vehicle?.mesh && Math.hypot(c.mesh.position.x - px, c.mesh.position.z - pz) > 320) { this.scene.remove(c.mesh); this.parked.splice(i, 1); }
    }
    if (this.parked.filter((c) => c.auto).length < 26) this.spawnParked(px, pz);
    let n = 0;
    while (this.cars.length < this.maxCars && n++ < 3) this.spawnCar(px, pz, this.cars.length < 20 ? 30 : 180, 480);
    n = 0;
    while (this.peds.length < this.maxPeds && n++ < 3) this.spawnPed(px, pz, this.peds.length < 25 ? 10 : 120, 240);

    const obstacles = [];
    for (const c of this.cars) obstacles.push(c);
    for (const c of this.parked) obstacles.push(c);
    for (const c of this.extraObstacles) obstacles.push(c);
    for (const c of this.policeCars || []) obstacles.push(c);
    for (const p of this.peds) if (p.down <= 0) obstacles.push(p); // quem atravessa a rua faz o carro frear
    const pv = player.vehicle;
    obstacles.push({ mesh: pv ? pv.mesh : player.mesh, isPlayer: true });

    this.amb = this.cars.find((c) => c.amb) || null; // ambulância na rua (ambulancia.js)
    for (const c of this.cars) this.updateCar(c, dt, obstacles);
    for (const p of this.peds) this.updatePed(p, dt, player);
    // toró: metade abre o guarda-chuva (decidido uma vez por pessoa); o resto vai na chuva mesmo
    const chove = (this.wet || 0) > 0.3;
    for (const p of this.peds) {
      if (chove && p.umb === undefined) { p.umb = Math.random() < 0.5 ? makeUmbrella() : null; if (p.umb) p.mesh.add(p.umb); }
      if (p.umb) p.umb.visible = chove && p.down <= 0;
    }

    // batida do carro do jogador com o trânsito, estacionados e viaturas: retângulo contra retângulo (eixos separadores)
    if (pv) {
      for (const c of [...this.cars, ...this.parked, ...this.extraObstacles, ...(this.policeCars || [])]) {
        if (c.mesh === pv.mesh) continue;
        const hit = obbHit(pv.mesh, c.mesh);
        if (hit) {
          pv.mesh.position.x -= hit.nx * hit.depth; pv.mesh.position.z -= hit.nz * hit.depth;
          if (Math.abs(pv.speed) > 4) { this.audio?.thump(Math.min(1, Math.abs(pv.speed) / 20)); }
          pv.speed *= -0.25;
          c.v = 0; c.stuck = -2;
        }
      }
    }
  }

  updateCar(c, dt, obstacles) {
    const m = c.mesh;
    const e = c.e;
    let target = m.userData.kind === 'bike' ? Math.min(e.vmax, 6.5) : e.vmax;
    if (c.amb) target = Math.max(14, e.vmax * 1.6); // ambulância: bem acima do limite
    if (c.lento) target = Math.min(target, c.lento); // caminhão de lixo: devagar, com os garis correndo atrás
    // ambulância chegando por trás na mesma mão: encosta no meio-fio e quase para
    const A = this.amb;
    c.puxa = false;
    if (A && A !== c) {
      const am = A.mesh.position, rx = m.position.x - am.x, rz = m.position.z - am.z, afx = Math.sin(A.mesh.rotation.y), afz = Math.cos(A.mesh.rotation.y);
      const frente = rx * afx + rz * afz, lado = Math.abs(rx * afz - rz * afx);
      if (frente > 0 && frente < 35 && lado < 3.5 && Math.sin(m.rotation.y) * afx + Math.cos(m.rotation.y) * afz > 0.5) { c.puxa = true; target = Math.min(target, 1.5); }
    }
    const remaining = e.len - c.t;
    if (c.next) {
      const turn = 1 - (c.next.dx * e.dx + c.next.dz * e.dz);
      if (turn > 0.3 && remaining < 18) target = Math.min(target, 4 + remaining * 0.4);
    } else if (remaining < 10) target = Math.min(target, remaining);
    // olha pra frente
    const fx = Math.sin(m.rotation.y), fz = Math.cos(m.rotation.y);
    let queue = false; // parado atrás de quem espera o sinal
    if (c.amb) c.ghost = 1; // ambulância atravessa quem está parado (os outros abrem caminho)
    if (c.ghost <= 0) {
      for (const o of obstacles) {
        if (o === c) continue;
        const rx = o.mesh.position.x - m.position.x, rz = o.mesh.position.z - m.position.z;
        const ahead = rx * fx + rz * fz;
        if (ahead <= 0 || ahead > 16) continue;
        const lat = Math.abs(rx * fz - rz * fx);
        if (lat > 2.2) continue;
        if (!o.mesh.userData.L && !o.isPlayer && lat > 1.3) continue; // pedestre na calçada, fora da faixa
        if ((o.side || c.side) && lat > 0.9) continue; // bike no canto: passa do lado
        const gap = ahead - (m.userData.L + (o.mesh.userData.L || 1)) / 2 - 1.5;
        target = Math.min(target, Math.max(0, gap * 1.2));
        if ((o.red || o.queue) && gap < 8) queue = true;
        if (o.isPlayer && gap < 3 && Math.random() < dt * 0.4) this.audio?.horn(0.25, m.position);
      }
    } else c.ghost -= dt;
    // corredor de ônibus (Conde da Boa Vista): ônibus na faixa exclusiva para uns segundos em cada estação do canteiro
    c.corredor = m.userData.kind === 'bus' && /Conde da Boa Vista/.test(e.name || '');
    if (c.corredor) {
      if (c.parada > 0) { c.parada -= dt; target = 0; }
      else for (const st of this.world.busStations || []) {
        if (st === c.ultimaEstacao) continue;
        const rx = st.x - m.position.x, rz = st.z - m.position.z, ahead = rx * fx + rz * fz, lat = Math.abs(rx * fz - rz * fx);
        if (ahead < -2 || ahead > 30 || lat > 9) continue;
        if (ahead < 1.5 && c.v < 1) { c.parada = 5 + Math.random() * 3; c.ultimaEstacao = st; target = 0; break; } // embarque
        target = Math.min(target, Math.max(0.8, ahead * 0.6));
      }
    }
    // semáforo fechado à frente: para antes da faixa (e não conta como "preso", senão o carro fura o sinal)
    const stop = this.world.stopAhead?.(m.position.x, m.position.z, fx, fz);
    c.red = stop != null && !c.amb; c.queue = queue; // ambulância não para no sinal
    if (c.red) target = Math.min(target, Math.max(0, (stop - m.userData.L / 2 - 0.5) * 1.2));
    const dv = target - c.v;
    c.v += Math.max(-14 * dt, Math.min(4 * dt, dv));
    if (c.v < 0) c.v = 0;
    if (c.v < 0.3 && !c.red && !c.queue && !(c.parada > 0)) { c.stuck += dt; if (c.stuck > 7) { c.ghost = 2.5; c.stuck = 0; } } else c.stuck = 0; // parado na estação do corredor também não conta como preso
    c.t += c.v * dt;
    while (c.t > c.e.len) {
      c.t -= c.e.len;
      if (!c.next) { c.next = this.chooseNext(this.drive, c.e); if (!c.next) { c.t = 0; break; } }
      c.e = c.next;
      c.next = this.chooseNext(this.drive, c.e);
    }
    const p = this.posOn(c.e, c.t);
    if (c.side || c.puxa) { const off = Math.max(0, (c.e.w || 7) / 2 - 0.9 - c.e.lane); p.x -= c.e.dz * off; p.z += c.e.dx * off; }
    // corredor da Conde da Boa Vista: ônibus vai na faixa de dentro (do lado do canteiro, espelho da faixa de fora)
    if (c.corredor) { p.x += c.e.dz * 2 * c.e.lane; p.z -= c.e.dx * 2 * c.e.lane; }
    const k = 1 - Math.exp(-8 * dt);
    m.position.x += (p.x - m.position.x) * k;
    m.position.z += (p.z - m.position.z) * k;
    const targetH = Math.atan2(c.e.dx, c.e.dz);
    let dh = targetH - m.rotation.y;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    m.rotation.y += dh * Math.min(1, dt * 6);
    animateVehicle(m, c.v, Math.max(-1, Math.min(1, dh * 2)), dt);
  }

  updatePed(p, dt, player) {
    const m = p.mesh;
    p.speechCd -= dt;
    if (p.down > 0) {
      p.down -= dt;
      m.rotation.x = -Math.PI / 2; m.position.y = 0.15;
      if (p.down <= 0) { m.rotation.x = 0; m.position.y = 0; }
      return;
    }
    const pv = player.vehicle;
    if (pv) {
      const d = Math.hypot(pv.mesh.position.x - m.position.x, pv.mesh.position.z - m.position.z);
      const spd = Math.abs(pv.speed);
      if (d < 1.9 && spd > 3) {
        p.down = 4;
        const h = pv.mesh.rotation.y;
        m.position.x += Math.sin(h) * 2.5; m.position.z += Math.cos(h) * 2.5;
        this.hud.say(m, pick(FALAS_ATROPELO), 2.5);
        this.audio?.thump(0.5);
        this.onCrime?.(1, 'Atropelamento');
        return;
      }
      if (d < 8 && spd > 7 && p.speechCd <= 0) { this.hud.say(m, pick(FALAS_CORRE), 2.2); p.speechCd = 8; p.flee = 1.5; }
    }
    p.talk -= dt;
    if (p.talk <= 0) {
      p.talk = 25 + Math.random() * 40;
      if (Math.hypot(player.pos.x - m.position.x, player.pos.z - m.position.z) < 25) this.hud.say(m, (this.wet || 0) > 0.3 && Math.random() < 0.6 ? pick(FALAS_CHUVA) : this.night > 0.5 ? pick([...FALAS_NOITE, ...FALAS_SOLTAS.filter((f) => !DIURNAS.test(f))]) : pick(FALAS_SOLTAS), 3);
    }
    if (!p.e) { animatePerson(m, 0, dt); return; }
    let v = p.flee > 0 ? 4 : p.v * (1 + 0.45 * (this.wet || 0)); // na chuva todo mundo apressa o passo
    if (p.flee > 0) p.flee -= dt;
    // espera o jogador sair da frente
    if (!pv) {
      const dx = player.pos.x - m.position.x, dz = player.pos.z - m.position.z, fx = Math.sin(m.rotation.y), fz = Math.cos(m.rotation.y);
      const ahead = dx * fx + dz * fz;
      if (ahead > 0 && ahead < 1.3 && Math.abs(dx * fz - dz * fx) < 0.7) v = 0;
    }
    const tPrev = p.t;
    p.t += v * dt;
    while (p.t > p.e.len) {
      p.t -= p.e.len;
      if (!p.next) { p.next = this.chooseNext(this.foot, p.e); if (!p.next) { p.t = 0; break; } }
      p.e = p.next;
      p.next = this.chooseNext(this.foot, p.e);
    }
    let pos = this.pedPos(p.e, p.t, m.position);
    // pedestre não anda no meio da pista: se o próximo ponto (ou o caminho até ele) cai na faixa de carro,
    // dá meia-volta e segue pela calçada de onde veio
    if (!pos || (Math.hypot(pos.x - m.position.x, pos.z - m.position.z) > 2.5 && this.crossesDrive(m.position, pos))) {
      const back = p.e.b.out.map((i) => this.foot.edges[i]).find((o) => o.b === p.e.a);
      if (back) { p.e = back; p.t = Math.max(0, back.len - p.t); p.next = this.chooseNext(this.foot, back); }
      pos = { x: m.position.x, z: m.position.z };
    }
    // não atravessa prédio, objeto ou água: espera um pouco e, se continuar bloqueado, muda de caminho
    if (this.world.blocked(pos.x, pos.z) && !this.world.blocked(m.position.x, m.position.z)) {
      p.t = Math.min(tPrev, p.e.len); p.wait = (p.wait || 0) + dt; pos = { x: m.position.x, z: m.position.z };
      if (p.wait > 1.5) { const e = this.randomEdge(this.foot, m.position.x, m.position.z, 0, 30); if (e) { p.e = e; p.t = 0; p.next = this.chooseNext(this.foot, e); } p.wait = 0; }
    } else p.wait = 0;
    const k = 1 - Math.exp(-6 * dt);
    m.position.x += (pos.x - m.position.x) * k;
    m.position.z += (pos.z - m.position.z) * k;
    let dh = Math.atan2(p.e.dx, p.e.dz) - m.rotation.y;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    m.rotation.y += dh * Math.min(1, dt * 8);
    animatePerson(m, v, dt);
  }
}
