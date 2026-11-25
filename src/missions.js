import * as THREE from 'three';
import { makePerson, makeVehicle } from './models.js';
import { pick } from './traffic.js';
import { save, addMoney } from './save.js';
import { tourSpots, TURISTAS, FALAS_TURISTA } from './turismo.js';
import { conta } from './trofeus.js';

const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'trunk']);
const NOMES = ['Dona Socorro', 'Seu Biu', 'Kaline', 'Severino', 'Jéssica', 'Painho Tonho', 'Rayane', 'Edvaldo', 'Mainha Cida', 'Wellington', 'Lucicleide', 'Thiago'];
const COMIDAS = ['2 tapiocas de queijo coalho', 'um bolo de rolo', 'um cuscuz com charque', 'um açaí de 500', 'uma macaxeira com carne de sol', 'um caldinho de feijão', 'uma cartola', 'um sanduíche de pernil'];
const FALAS_CORRIDA = [
  'Pega a Agamenon que é mais rápido, visse?', 'Tá calor demais hoje, liga o ar aí.', 'Tu é daqui mesmo, motorista?', 'Bora, que tô atrasada pro trabalho!',
  'Esse trânsito do Recife é osso…', 'Coloca um brega aí no rádio!', 'Domingo tem jogo do Sport, tu vai?', 'Ei, motô, arrodeia pela Rosa e Silva!',
  'Caraí, que calor dentro desse carro!', 'Liga o som aí, boy, bota um brega!', 'Tu é o ouro, motô!', 'Tô atrasado pro trampo, mermão!',
  'A Agamenon tá de rosca, arrodeia por dentro do Espinheiro.', 'Faz o balão ali na frente, visse?', 'Cuidado com esse catabiu, vai quebrar o carro!',
  'Que zoada desse som do carro do lado!', 'Tô avexado, motô, bora!', 'Se der o tango no mango, eu desço e vou a pé.', 'Ali tem um cu-de-boi, pega a outra.',
  'Tá cheio de muriçoca nesse carro, caraí!', 'Vem um toró aí, fecha o vidro!',
]
const FALAS_SUSTO = ['Vixe! Cuidado, macho!', 'Oxe! Quer me matar, é?', 'Valei-me! Devagar!', 'Eita que eu vou dar uma estrela só!', 'Caraí, boy! Tá doido, é?', 'Lá ele! Quase bate!', 'Que chapoletada, caraí!', 'Deu a mulesta! Dirige direito, tabacudo!', 'Oxe, tá estilando, é?'];
const FALAS_BUSAO = ['Motô, para no próximo, visse!', 'Liga o ar, pelo amor de Deus!', 'Se aperta aí atrás, povo, que tem lugar!', 'Esse passa no Derby?', 'Devagar, motorista, que tem gente em pé!',
  'Ei, abre a porta de trás!', 'Caraí, que busão cheio!', 'Tô atrasada, acelera aí!', 'Quem tem troco pra cinquenta?'];
const FALAS_SOBE = ['Bom dia, motorista!', 'Boa tarde, motô!', 'Espera aí, espera!', 'Passa no centro?', 'Valeu por esperar, visse!'];
const FALAS_GARUPA = ['Segura firme que eu vou de garupa!', 'Ei, motô, sem empinar, visse!', 'Passa no corredor, que é mais rápido!', 'Caraí, que vento bom na cara!', 'Cuidado com o buraco ali!', 'Tô sem capacete não, né? Ah, tá aqui.', 'Corta pela Rosa e Silva, motô!'];
const FALAS_FIM = ['Valeu, visse! Cinco estrelas!', 'Obrigada, meu filho!', 'Arretado, chegou rapidinho!', 'Valeu, motô!', 'Tu é o ouro, visse!', 'Deus te abençoe, meu filho!', 'Massa demais, valeu, boy!', 'Peso, motô! Já tô chegando, viu? Tchau!', 'Arretado! Valeu, meu rato!'];
const APPS = {
  corrida: { name: 'OXECAR', color: '#ffd166' },
  entrega: { name: 'TAPIOCA JÁ', color: '#ff7b3a' },
  racha: { name: 'RACHA', color: '#e8343f' },
  turismo: { name: 'GUIA ARRETADO', color: '#3ac0a0' },
  onibus: { name: 'BUSÃO', color: '#f2b705' },
  moto: { name: 'MOTOXE', color: '#2a9d8f' },
};

// "na Rua X" / "no Cais Y"
const MASC = /^(Cais|Largo|Pátio|Beco|Dique|Viaduto|Parque|Mercado|Shopping|Paço|Terminal|Caminho|Corredor|Acesso|Elevado|Túnel|Complexo|Loteamento|Conjunto|Alto|Sítio|Polo|Museu|Forte|Marco)\b/i;
const na = (s) => (s && MASC.test(s) ? 'no ' : 'na ') + (s || 'rua');
const ate = (s) => 'até ' + (s && MASC.test(s) ? 'o ' : 'a ') + (s || 'rua');
const fmtKm = (m) => (m / 1000).toFixed(1).replace('.', ',') + ' km';

export class Missions {
  constructor(scene, world, traffic, police, hud) {
    Object.assign(this, { scene, world, traffic, police, hud });
    this.active = null;
    this.offers = [];
    this.offersAt = -1e9;
    this.phoneEl = document.getElementById('phone');
    this.offersEl = document.getElementById('offers');
    this.marker = makeMarker();
    this.marker.visible = false;
    scene.add(this.marker);
    this.raceRoute = this.buildRaceRoute();
    this.spots = tourSpots(world.pois);
  }

  get money() { return save.money; }

  // chamado pelo celular ao abrir a aba de bicos
  prepare(player) {
    if (performance.now() - this.offersAt > 45000 || !this.offers.length) this.makeOffers(player);
  }

  closePhone() { this.phoneEl.classList.add('hidden'); }

  addMoney(v) {
    addMoney(v);
  }

  // ---------------------------------------------------------------- ofertas

  makeOffers(player) {
    this.offersAt = performance.now();
    const list = [];
    // racha só pra quem está a até 4 km da orla do racha (com o Recife inteiro, de Passarinho dava 13 km só pra chegar)
    const perto = (this.raceRoute?.cps || []).some(([cx, cz]) => Math.hypot(cx - player.pos.x, cz - player.pos.z) < 4000);
    for (const type of ['corrida', 'entrega', perto && Math.random() < 0.6 ? 'racha' : 'corrida', Math.random() < 0.34 ? 'onibus' : Math.random() < 0.5 ? 'turismo' : 'moto']) {
      const o = type === 'corrida' ? this.offerCorrida(player) : type === 'entrega' ? this.offerEntrega(player) : type === 'turismo' ? this.offerTurismo(player) : type === 'onibus' ? this.offerOnibus(player) : type === 'moto' ? this.offerMoto(player) : this.offerRacha(player);
      if (o) list.push(o);
    }
    // bicos de história (do Zap) ficam sempre no topo até serem feitos
    this.offers = [...(this.fixas || []).filter((f) => this.active?.historia !== f.historia), ...list];
  }

  edgePoint(graph, x, z, rMin, rMax, filter = () => true, side = 0) {
    for (let k = 0; k < 30; k++) {
      const e = this.traffic.randomEdge(graph, x, z, rMin, rMax);
      if (!e || !filter(e) || e.len < 6) continue;
      const t = e.len * (0.3 + Math.random() * 0.4);
      const p = this.traffic.posOn(e, t);
      if (side) { p.x += -e.dz * side; p.z += e.dx * side; }
      if (this.world.blocked(p.x, p.z)) continue;
      return { x: p.x, z: p.z, e, street: e.name || this.hud.streetAt(p.x, p.z, 80) };
    }
    return null;
  }

  offerCorrida(player) {
    const { x, z } = player.pos;
    const a = this.edgePoint(this.traffic.foot, x, z, 120, 600, (e) => DRIVE.has(e.k) && e.lane > 3);
    if (!a) return null;
    const b = this.edgePoint(this.traffic.drive, a.x, a.z, 900, 2600, (e) => !!e.name);
    if (!b) return null;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const nome = pick(NOMES);
    const destBairro = this.hud.bairroAt(b.x, b.z);
    return {
      type: 'corrida', title: `${nome} → ${destBairro || b.street}`,
      desc: `Buscar ${na(a.street)} e levar ${ate(b.street)}${destBairro ? ' (' + destBairro + ')' : ''}. Precisa de carro.`,
      pay: Math.round(12 + d * 0.006), km: Math.hypot(a.x - x, a.z - z) + d,
      stages: [
        { label: `Busque ${nome} ${na(a.street)}`, x: a.x, z: a.z, r: 13, stop: true, car: true, enter: () => this.spawnClient(a.x, a.z, 'Aqui, motorista!'), arrive: () => this.pickupClient() },
        { label: `Leve ${nome} ${ate(b.street)}`, x: b.x, z: b.z, r: 14, stop: true, car: true, time: d / 8 + 35, arrive: () => this.dropClient() },
      ],
      name: nome,
    };
  }

  // turismo: visitante perto do jogador até um marco a 1,2–7 km; na chegada, o motorista conta o que é o lugar
  offerTurismo(player) {
    const { x, z } = player.pos;
    const longe = this.spots.map((t) => ({ t, d: Math.hypot(t.x - x, t.z - z) })).filter((o) => o.d > 1200 && o.d < 7000);
    if (!longe.length) return null;
    const { t } = pick(longe);
    const a = this.edgePoint(this.traffic.foot, x, z, 120, 600, (e) => DRIVE.has(e.k) && e.lane > 3);
    if (!a) return null;
    const n = this.traffic.nearestEdge(this.traffic.drive, t.x, t.z);
    if (!n) return null;
    const b = this.traffic.posOn(n.e, n.t);
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const [nome, deOnde] = pick(TURISTAS);
    return {
      type: 'turismo', title: `${nome} → ${t.nome.replace(/^(o|a|os|as) /, '')}`,
      desc: `${nome}, ${deOnde}, quer conhecer ${t.nome}. Buscar ${na(a.street)}. Precisa de carro.`,
      pay: Math.round(20 + d * 0.008), km: Math.hypot(a.x - x, a.z - z) + d,
      stages: [
        { label: `Busque ${nome} ${na(a.street)}`, x: a.x, z: a.z, r: 13, stop: true, car: true, enter: () => this.spawnClient(a.x, a.z, 'Olá! É o guia?'), arrive: () => this.pickupClient() },
        { label: `Leve ${nome} até ${t.nome}`, x: b.x, z: b.z, r: 16, stop: true, car: true, time: d / 8 + 45, arrive: () => this.tourArrive(t) },
      ],
      name: nome,
    };
  }

  // ônibus: pegar o busão parado perto e fazer uma linha pela mesma avenida, parando em cada ponto (~400 m)
  offerOnibus(player) {
    const { x, z } = player.pos, g = this.traffic.drive;
    let line = null;
    for (let k = 0; k < 12 && !line; k++) {
      const e0 = this.traffic.randomEdge(g, x, z, 150, 1400);
      if (!e0 || !e0.name || !/^(Avenida|Estrada|Rua)/.test(e0.name) || !['primary', 'secondary', 'trunk', 'tertiary'].includes(e0.k)) continue;
      const pts = [], stops = []; let e = e0, len = 0, last = -400, guard = 0;
      while (e && len < 2600 && guard++ < 400) {
        for (let d = Math.max(0, last + 400 - len); d < e.len; d += 400) {
          const t = Math.min(e.len - 2, Math.max(2, d)), side = (e.w || 7) / 2 - 1.6;
          stops.push({ x: e.a.x + e.dx * t - e.dz * side, z: e.a.z + e.dz * t + e.dx * side }); last = len + d;
        }
        len += e.len;
        const nx = e.b.out.map((i) => g.edges[i]).filter((n) => n.name === e0.name && n.b !== e.a);
        e = nx.sort((p, q) => (q.dx * e.dx + q.dz * e.dz) - (p.dx * e.dx + p.dz * e.dz))[0];
      }
      if (stops.length >= 4) line = { name: e0.name, stops: stops.slice(0, 7), len, e0 };
    }
    if (!line) return null;
    // o busão espera estacionado numa rua perto do jogador
    const q = this.edgePoint(this.traffic.drive, x, z, 40, 250, (e) => e.len > 20 && (e.w || 7) >= 7);
    if (!q) return null;
    const S = line.stops, curto = line.name.replace(/^(Avenida|Estrada) /, '');
    let km = Math.hypot(q.x - S[0].x, q.z - S[0].z); for (let i = 1; i < S.length; i++) km += Math.hypot(S[i].x - S[i - 1].x, S[i].z - S[i - 1].z);
    return {
      type: 'onibus', title: `Linha ${curto}`,
      desc: `Pegar o busão parado aqui perto e fazer ${S.length} paradas ${na(line.name)}. Para em cada ponto pro povo subir.`,
      pay: Math.round(30 + km * 0.01), km: Math.hypot(q.x - x, q.z - z) + km,
      stages: [
        { label: 'Pegue o busão da linha (aperta F perto dele)', x: q.x, z: q.z, r: 9, bus: true, enter: () => this.spawnBus(q), arrive: () => this.hud.flash('Busão na mão! Bora pra primeira parada.') },
        ...S.map((p, i) => ({ label: `Parada ${i + 1} de ${S.length} · ${line.name}`, x: p.x, z: p.z, r: 15, stop: true, bus: true, ...(i === 0 ? { time: km / 7 + 60 } : {}), enter: () => this.genteNoPonto(p, i === S.length - 1), arrive: () => this.busStop(i === S.length - 1) })),
      ],
      name: 'passageiros', pax: 0,
    };
  }

  // mototáxi: a moto espera no meio-fio perto; corrida curta com o passageiro na garupa
  offerMoto(player) {
    const { x, z } = player.pos;
    const q = this.edgePoint(this.traffic.drive, x, z, 30, 200, (e) => e.len > 10);
    if (!q) return null;
    const a = this.edgePoint(this.traffic.foot, q.x, q.z, 150, 500, (e) => DRIVE.has(e.k));
    if (!a) return null;
    const b = this.edgePoint(this.traffic.drive, a.x, a.z, 500, 1600, (e) => !!e.name);
    if (!b) return null;
    const d = Math.hypot(b.x - a.x, b.z - a.z), nome = pick(NOMES), destBairro = this.hud.bairroAt(b.x, b.z);
    return {
      type: 'moto', title: `${nome} → ${destBairro || b.street}`,
      desc: `Pegar a moto aqui perto, buscar ${na(a.street)} e levar ${ate(b.street)}${destBairro ? ' (' + destBairro + ')' : ''} na garupa.`,
      pay: Math.round(10 + d * 0.009), km: Math.hypot(q.x - x, q.z - z) + Math.hypot(a.x - q.x, a.z - q.z) + d,
      stages: [
        { label: 'Pegue a moto do MOTOXE (aperta F perto dela)', x: q.x, z: q.z, r: 8, moto: true, enter: () => { const v = this.player?.vehicle; if (v?.mesh.userData.kind === 'moto') { const s = this.active.stages[0]; s.x = v.mesh.position.x; s.z = v.mesh.position.z; this.hud.flash('Já tá de moto? Bora com ela mesmo!'); } else this.spawnBus(q, 'moto'); }, arrive: () => this.hud.flash('Capacete na cabeça. Bora!') }, // quem já tem moto vai com a sua
        { label: `Busque ${nome} ${na(a.street)}`, x: a.x, z: a.z, r: 12, stop: true, moto: true, enter: () => this.spawnClient(a.x, a.z, 'Ei, mototáxi! Aqui!'), arrive: () => this.pickupClient() },
        { label: `Leve ${nome} ${ate(b.street)}`, x: b.x, z: b.z, r: 13, stop: true, moto: true, time: d / 9 + 30, arrive: () => this.dropClient() },
      ],
      name: nome,
    };
  }

  spawnBus(q, kind = 'bus') {
    // busão de bico anterior que ficou parado (ninguém dirigindo) sai de cena
    const old = this.bus, k = old ? this.traffic.parked.indexOf(old) : -1;
    if (k >= 0) { this.traffic.parked.splice(k, 1); this.scene.remove(old.mesh); }
    const mesh = makeVehicle(kind);
    if (mesh.userData.rider) mesh.userData.rider.visible = false;
    const lado = (q.e.w || 7) / 2 - (kind === 'bus' ? 1.5 : 0.6);
    mesh.position.set(q.x - q.e.dz * lado, 0, q.z + q.e.dx * lado);
    mesh.rotation.y = Math.atan2(q.e.dx, q.e.dz);
    this.scene.add(mesh);
    this.bus = { mesh, v: 0, auto: false, side: true };
    this.traffic.parked.push(this.bus);
    const s = this.active.stages[0]; s.x = mesh.position.x; s.z = mesh.position.z; this.marker.position.set(s.x, 0, s.z); this.hud.target = { x: s.x, z: s.z };
  }

  // gente esperando no ponto: aparece quando a parada vira o destino e sobe no ônibus quando ele para
  genteNoPonto(p, fim) {
    this.tiraPonto();
    if (fim) return;
    const n = 2 + Math.floor(Math.random() * 5), lista = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, x = p.x + Math.cos(a) * 1.4, z = p.z + Math.sin(a) * 1.4;
      const g = makePerson(); g.position.set(x, this.world.groundY ? this.world.groundY(x, z) : 0, z); g.rotation.y = Math.random() * 6; this.scene.add(g); lista.push(g);
    }
    if (lista[0]) this.hud.say(lista[0], pick(['Ô motorista, para aqui!', 'Esse é o meu!', 'Finalmente, viu!']), 3);
    this.ponto = lista;
  }

  tiraPonto() { for (const g of this.ponto || []) { this.hud.forget(g); this.scene.remove(g); } this.ponto = []; }

  busStop(fim) {
    const quantos = (this.ponto || []).length;
    this.tiraPonto(); // subiram
    const m = this.active, v = this.player.vehicle, sobe = fim ? 0 : quantos, desce = m.i > 1 ? Math.min(m.pax, 1 + Math.floor(Math.random() * 4)) : 0;
    m.pax += sobe - (fim ? m.pax : desce);
    m.pay += sobe * 3;
    if (sobe) conta('passageiro', sobe);
    if (v) this.hud.say(v.mesh, fim ? 'Ponto final! Todo mundo descendo!' : pick(FALAS_SOBE), 2.5);
    this.hud.flash(fim ? 'Ponto final! Linha completa.' : `+${sobe} passageiro${sobe > 1 ? 's' : ''}${desce ? ` · desceram ${desce}` : ''} · ${m.pax} no busão`);
  }

  // bico de história (pedido do Zap): buscar alguém num lugar fixo e levar a outro, com fala própria.
  // h = { id, nome, de: {x, z, nome}, para: {x, z, nome}, pay, oi, tchau }
  offerHistoria(h) {
    const ponto = (q) => { const n = this.traffic.nearestEdge(this.traffic.drive, q.x, q.z); if (!n) return null; const p = this.traffic.posOn(n.e, n.t); return { x: p.x, z: p.z }; };
    const a = ponto(h.de), b = ponto(h.para);
    if (!a || !b) return null;
    const d = Math.hypot(b.x - a.x, b.z - a.z), x = this.player?.pos.x ?? a.x, z = this.player?.pos.z ?? a.z;
    return {
      type: 'corrida', historia: h.id, title: `⭐ ${h.nome.replace(/^(o|a) /, '')} → ${h.para.nome}`,
      desc: `Buscar ${h.nome} ${na(h.de.nome)} e levar ${ate(h.para.nome)}. Precisa de carro.`,
      pay: h.pay, km: Math.hypot(a.x - x, a.z - z) + d,
      stages: [
        { label: `Busque ${h.nome} ${na(h.de.nome)}`, x: a.x, z: a.z, r: 14, stop: true, car: true, enter: () => this.spawnClient(a.x, a.z, h.oi), arrive: () => this.pickupClient() },
        { label: `Leve ${h.nome} ${ate(h.para.nome)}`, x: b.x, z: b.z, r: 15, stop: true, car: true, time: d / 7 + 90, arrive: () => this.dropClient(h.tchau) },
      ],
      name: h.nome, pegou: h.pegou,
    };
  }

  tourArrive(t) {
    const v = this.player.vehicle;
    if (v) this.hud.say(v.mesh, `Chegamos! ${t.fato}`, 7);
    this.dropClient(pick(['Que massa! Obrigado, guia!', 'Arretado! Vou tirar foto!', 'Valeu demais, visse?', 'Que lindo! Cinco estrelas!']));
  }

  offerEntrega(player) {
    const { x, z } = player.pos;
    const places = this.world.pois.filter((p) => /^(marketplace|mall)$/.test(p.kind) || /mercado|shopping/i.test(p.name));
    let shop = places.map((p) => ({ p, d: Math.hypot(p.x - x, p.z - z) })).filter((o) => o.d < 2500).sort((a, b) => a.d - b.d)[Math.floor(Math.random() * 3)];
    let a;
    if (shop) {
      const n = this.traffic.nearestEdge(this.traffic.foot, shop.p.x, shop.p.z);
      const p = this.traffic.posOn(n.e, n.t);
      a = { x: p.x, z: p.z, name: shop.p.name };
    } else {
      const q = this.edgePoint(this.traffic.foot, x, z, 150, 700, (e) => DRIVE.has(e.k));
      if (!q) return null;
      a = { x: q.x, z: q.z, name: `Tapiocaria da ${q.street || 'esquina'}` };
    }
    const b = this.edgePoint(this.traffic.foot, a.x, a.z, 500, 1800, (e) => DRIVE.has(e.k) && !!e.name);
    if (!b) return null;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const comida = pick(COMIDAS), num = 10 + Math.floor(Math.random() * 1900);
    return {
      type: 'entrega', title: comida[0].toUpperCase() + comida.slice(1),
      desc: `Pegar ${na(a.name)} e entregar ${na(b.street)}, nº ${num}. Vai a pé, de carro, como quiser.`,
      pay: Math.round(8 + d * 0.005), km: Math.hypot(a.x - x, a.z - z) + d,
      stages: [
        { label: `Pegue ${comida} ${na(a.name)}`, x: a.x, z: a.z, r: 10, stop: true },
        { label: `Entregue ${na(b.street)}, nº ${num}`, x: b.x, z: b.z, r: 10, stop: true, time: d / 7 + 40, enter: () => this.spawnClient(b.x, b.z, 'É meu o pedido!') , arrive: () => this.dropDelivery() },
      ],
    };
  }

  buildRaceRoute() {
    const pts = [];
    for (const r of this.world.data.roads) {
      if (!r.n || !/^Avenida (Boa Viagem|Herculano Bandeira)/.test(r.n) || r.k === 'service') continue;
      for (const p of r.p) pts.push(p);
    }
    if (pts.length < 10) return null;
    pts.sort((a, b) => a[1] - b[1]);
    const cps = [pts[0]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc > 480) { cps.push(pts[i]); acc = 0; }
    }
    let total = 0;
    for (let i = 1; i < cps.length; i++) total += Math.hypot(cps[i][0] - cps[i - 1][0], cps[i][1] - cps[i - 1][1]);
    return { cps, total };
  }

  offerRacha(player) {
    const R = this.raceRoute;
    if (!R) return null;
    const [sx, sz] = R.cps[0];
    const n = R.cps.length - 1;
    const time = R.total / 21 + 20;
    return {
      type: 'racha', title: 'Racha na beira-mar',
      desc: `Do Pina até o fim de Boa Viagem: ${n} pontos de controle em ${fmtKm(R.total)}. É ilegal, então a PM vai atrás.`,
      pay: 250, km: Math.hypot(sx - player.pos.x, sz - player.pos.z) + R.total,
      stages: [
        { label: 'Vá até a largada do racha, na Herculano Bandeira', x: sx, z: sz, r: 16, stop: true, car: true, arrive: () => { this.police.crime(1, 'Racha na orla'); this.hud.flash('Valendo! Acelera!'); } },
        ...R.cps.slice(1).map(([x, z], i) => ({ label: `Racha · ponto ${i + 1} de ${n}`, x, z, r: 18, stop: false, car: true, ...(i === 0 ? { time } : {}) })),
      ],
    };
  }

  renderPhone(player) {
    const html = [];
    if (this.active) {
      const m = this.active;
      html.push(`<div class="offer active"><span class="app" style="background:${APPS[m.type].color}">${APPS[m.type].name}</span><span class="k">EM ANDAMENTO</span><h4>${m.title}</h4><p>${m.stages[m.i].label}</p><div class="pay">R$ ${m.pay}</div></div>`);
    }
    this.offers.forEach((o, i) => {
      html.push(`<div class="offer" data-i="${i}"><span class="app" style="background:${APPS[o.type].color}">${APPS[o.type].name}</span><span class="k">${i + 1}</span><h4>${o.title}</h4><p>${o.desc}</p><div class="pay">R$ ${o.pay}<small>${fmtKm(o.km)}</small></div></div>`);
    });
    if (!this.offers.length) html.push('<p style="color:#a79fbb">Nenhum bico por perto agora. Tenta de novo daqui a pouco.</p>');
    this.offersEl.innerHTML = html.join('');
    this.offersEl.querySelectorAll('.offer[data-i]').forEach((el) => (el.onclick = () => this.accept(Number(el.dataset.i), player)));
  }

  // ---------------------------------------------------------------- execução

  accept(i, player) {
    const o = this.offers[i];
    if (!o) return;
    if (this.active) this.fail('Bico anterior cancelado', true);
    this.offers.splice(i, 1);
    this.active = { ...o, i: -1, timer: null, crashes: 0, talk: 8 };
    this.closePhone();
    this.next();
    this.hud.flash(`${APPS[o.type].name}: bico aceito!`);
    return true;
  }

  cancel() { if (this.active) this.fail('Tu cancelou o bico', true); }

  next() {
    const m = this.active;
    m.i++;
    if (m.i >= m.stages.length) return this.complete();
    const s = m.stages[m.i];
    if (s.time) m.timer = s.time;
    s.enter?.();
    this.marker.position.set(s.x, 0, s.z);
    this.marker.userData.ring.scale.setScalar(s.r);
    this.marker.visible = true;
    this.hud.target = { x: s.x, z: s.z };
  }

  complete() {
    const m = this.active;
    let pay = m.pay;
    let extra = '';
    if (m.timer != null && m.timer > 0) { const bonus = Math.round(m.type === 'racha' ? Math.min(150, m.timer) : Math.min(25, m.timer * 0.12)); pay += bonus; if (bonus) extra = ` (+R$ ${bonus} de bônus)`; }
    if ((m.type === 'corrida' || m.type === 'turismo' || m.type === 'onibus' || m.type === 'moto') && m.crashes) { pay = Math.max(5, pay - m.crashes * 4); extra += ` · ${m.crashes} batida${m.crashes > 1 ? 's' : ''}`; }
    this.addMoney(pay);
    this.hud.flash(`+R$ ${pay}${extra}`);
    conta(m.type);
    if (m.historia) conta('historia:' + m.historia); // pedido de história do Zap cumprido
    this.clear();
  }

  fail(reason, silent) {
    if (!this.active) return;
    if (!silent) this.hud.flash(`Bico perdido: ${reason}`);
    else this.hud.flash(reason);
    this.clear();
  }

  clear() {
    this.tiraGarupa();
    this.tiraPonto();
    if (this.client) { const c = this.client; setTimeout(() => { this.scene.remove(c); this.hud.forget(c); }, 4000); this.client = null; }
    this.active = null;
    this.marker.visible = false;
    this.hud.target = null;
    this.hud.objective(null);
    this.offersAt = -1e9;
  }

  onBusted() {
    if (this.active) this.fail('tu foi preso');
    const fine = Math.round(this.money * 0.1);
    if (fine > 0) { this.addMoney(-fine); setTimeout(() => this.hud.flash(`Fiança: −R$ ${fine}`), 2700); }
  }

  spawnClient(x, z, line) {
    if (this.client) this.scene.remove(this.client);
    const p = makePerson();
    p.position.set(x, 0, z);
    this.scene.add(p);
    this.client = p;
    this.hud.say(p, line, 4);
  }

  pickupClient() {
    if (this.client) { this.hud.forget(this.client); this.scene.remove(this.client); this.client = null; }
    // mototáxi: o passageiro aparece na garupa, na mesma pose do piloto e um pouco atrás
    const vm = this.player?.vehicle?.mesh, rider = vm?.userData.rider;
    if (this.active?.type === 'moto' && rider) {
      const g = makePerson({ helmet: true }), u = g.userData, r = rider.userData;
      for (const k of ['upper', 'armL', 'armR', 'elbowL', 'elbowR', 'legL', 'legR', 'kneeL', 'kneeR']) if (u[k] && r[k]) u[k].rotation.copy(r[k].rotation);
      u.armL && (u.armL.rotation.x = -0.6); u.armR && (u.armR.rotation.x = -0.6); // segurando na cintura do piloto
      g.position.copy(rider.position).add(new THREE.Vector3(0, 0.06, -0.42)); g.rotation.copy(rider.rotation);
      vm.add(g); this.garupa = { g, vm };
    }
    this.hud.flash(this.active.pegou || `${this.active.name} entrou no carro`);
  }

  tiraGarupa() { if (this.garupa) { this.garupa.vm.remove(this.garupa.g); this.garupa = null; } }

  dropClient(line = pick(FALAS_FIM)) {
    this.tiraGarupa();
    const v = this.player.vehicle;
    if (v) {
      const h = v.mesh.rotation.y;
      this.spawnClient(v.mesh.position.x + Math.cos(h) * 2.4, v.mesh.position.z - Math.sin(h) * 2.4, line);
    }
  }

  dropDelivery() {
    if (this.client) this.hud.say(this.client, 'Valeu! Chegou quentinho!', 3);
  }

  update(dt, player, time) {
    this.player = player;
    const m = this.active;
    this.marker.userData.beam.material.opacity = 0.22 + Math.sin(time * 4) * 0.08;
    this.marker.userData.ring.rotation.y += dt;
    if (!m) return;
    const s = m.stages[m.i];
    const v = player.vehicle;
    const speed = v ? Math.abs(v.speed) : player.speed || 0;
    const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z);

    if (m.timer != null) {
      m.timer -= dt;
      if (m.timer <= 0) return this.fail(m.type === 'racha' ? 'o tempo do racha acabou' : m.type === 'onibus' ? 'a linha atrasou demais e a empresa tirou o busão de tu' : m.type === 'moto' ? 'o passageiro cansou de esperar e pegou outro mototáxi' : m.type === 'corrida' || m.type === 'turismo' ? 'o passageiro desistiu e desceu' : 'o cliente cancelou o pedido');
    }

    // corrida: passageiro reage à direção e foge da polícia
    if (m.type === 'moto' && m.i === 2 && v) {
      if (m.lastSpeed != null && m.lastSpeed - speed > 7) { m.crashes++; this.hud.say(v.mesh, pick(FALAS_SUSTO), 2.5); }
      m.talk -= dt;
      if (m.talk <= 0) { m.talk = 11 + Math.random() * 9; this.hud.say(v.mesh, pick(FALAS_GARUPA), 3); }
    }
    if (m.type === 'moto' && m.i === 2 && !v) { m.lastSpeed = speed; return this.fail('tu largou o passageiro no meio do caminho'); }
    if ((m.type === 'corrida' || m.type === 'turismo') && m.i === 1 && v) {
      if (this.police.level > 0 && this.police.cars.some((c) => c.mesh.position.distanceTo(v.mesh.position) < 70)) return this.fail('a passageira viu a polícia e pulou fora');
      if (m.lastSpeed != null && m.lastSpeed - speed > 7) { m.crashes++; this.hud.say(v.mesh, pick(FALAS_SUSTO), 2.5); }
      m.talk -= dt;
      if (m.talk <= 0) { m.talk = 12 + Math.random() * 10; this.hud.say(v.mesh, pick(m.type === 'turismo' ? FALAS_TURISTA : FALAS_CORRIDA), 3); }
      if (!v) return this.fail('tu largou a passageira');
    }
    if (m.type === 'onibus' && m.i > 1 && v && m.lastSpeed != null && m.lastSpeed - speed > 7) { m.crashes++; if (m.pax) this.hud.say(v.mesh, pick(FALAS_SUSTO), 2.5); } // pancada com gente dentro
    m.lastSpeed = speed;
    if ((m.type === 'corrida' || m.type === 'turismo') && m.i === 1 && !v) return this.fail(m.type === 'turismo' ? 'tu largou o turista no meio do caminho' : 'tu largou a passageira');

    let text = s.label;
    const noBus = v && v.mesh.userData.kind === 'bus', naMoto = v && v.mesh.userData.kind === 'moto';
    if (s.bus && !noBus) text += m.i > 0 ? ' <small>(volta pro busão!)</small>' : '';
    else if (s.moto && !naMoto) text += m.i > 0 ? ' <small>(volta pra moto!)</small>' : '';
    else if (s.car && !v) text += ' <small>(precisa de um carro: aperta F perto de um)</small>';
    else if (s.stop && d < s.r * 2 && speed > 3) text += ' <small>(para no marcador)</small>';
    this.hud.objective(text, m.timer, d);

    if (m.type === 'onibus' && m.i > 0 && noBus) { m.talk -= dt; if (m.talk <= 0 && m.pax > 0) { m.talk = 14 + Math.random() * 10; this.hud.say(v.mesh, pick(FALAS_BUSAO), 3); } }
    if (d < s.r && (!s.car || v) && (!s.bus || noBus) && (!s.moto || naMoto) && (!s.stop || speed < 3)) {
      s.arrive?.();
      if (this.active === m) this.next();
    }
  }
}

function makeMarker() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 90, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  beam.position.y = 45;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.position.y = 0.2;
  g.add(beam, ring);
  g.userData = { beam, ring };
  g.renderOrder = 5;
  return g;
}
