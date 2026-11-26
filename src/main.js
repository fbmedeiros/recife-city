import { decodeCobertura } from './cobertura.js';
import * as THREE from 'three';
import { DayNight } from './daynight.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { setVehicleLights } from './models.js';
import { loadWorld } from './world.js';
import { makePerson, makeVehicle, animatePerson, animateVehicle } from './models.js';
import { Traffic } from './traffic.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Shop } from './shop.js';
import { Phone } from './phone.js';
import { save, onSave } from './save.js';
import { Touch, isTouch } from './touch.js';
import { buildTrees } from './trees.js';
import { loadPhotos } from './photos.js';
import { PASSOS, passinhoPose, applyPose } from './culture.js';
import { protagonista } from './protagonista.js';
import { atualizarGente } from './corpos.js';
import { heightAt } from './terrain.js';
import { addMoney } from './save.js';
import { GPS } from './gps.js';
import { Album } from './album.js';
import { Weather } from './weather.js';
import { Bloco } from './bloco.js';
import { Ambience } from './ambience.js';
import { Ambulantes } from './ambulantes.js';
import { Boletim } from './boletim.js';
import { Jogo } from './jogo.js';
import { Praia } from './praia.js';
import { comSemente } from './semente.js';
import { Roteiro } from './roteiro.js';
import { Zap } from './zap.js';
import { Ambulancia } from './ambulancia.js';
import { Blitz } from './blitz.js';
import { Pombos } from './pombos.js';
import { Sinos } from './sinos.js';
import { Feira } from './feira.js';
import { Negocios } from './negocios.js';
import { Caranguejos } from './caranguejos.js';
import { Pipas } from './pipas.js';
import { Pescaria } from './pescaria.js';
import { VoltaPontes } from './voltapontes.js';
import { Artistas } from './artistas.js';
import { Forro } from './forro.js';
import { CarroDeSom } from './carrodesom.js';
import { Passageiro } from './passageiro.js';
import { PraiaJogos } from './praiajogos.js';
import { Bicicletas } from './bicicletas.js';
import { Catamara } from './catamara.js';
import { Agenda } from './agenda.js';
import { Desafios } from './desafios.js';
import { Casamento } from './casamento.js';
import { Lixo } from './lixo.js';
import { Barbearia } from './barbearia.js';
import { Corrida } from './corrida.js';
import { Quadrilha } from './quadrilha.js';
import { Lendas } from './lendas.js';
import { Malabarista } from './malabarista.js';
import { Mirantes } from './mirantes.js';
import { Domino } from './domino.js';
import { Capoeira } from './capoeira.js';
import { Jangadas } from './jangadas.js';
import { Avioes } from './avioes.js';
import { conta, onTrofeu } from './trofeus.js';
import { Sharks } from './tubarao.js';
import { GenteDaRua } from './gente.js';
import { Caramelos } from './caramelos.js';
import { RADIO_NAMES } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.75;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 4000);
const day = new DayNight(scene, renderer);

// pós-processamento: bloom no sol, postes, janelas e faróis
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// oclusão de ambiente (cantos, pé das paredes, debaixo das árvores): só no computador, pesa no celular
const gtao = isTouch ? null : new GTAOPass(scene, camera, innerWidth, innerHeight);
if (gtao) {
  gtao.updateGtaoMaterial({ radius: 3, distanceExponent: 1.4, thickness: 3, scale: 1.1, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.9;
  composer.addPass(gtao);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.55, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// correção de cor: um pouco mais de contraste e saturação, tom quente de sol nordestino e vinheta
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, warm: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float warm; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.1);
      col = (col - 0.5) * 1.07 + 0.5;
      col *= mix(vec3(1.0), vec3(1.04, 1.0, 0.94), warm);
      col = mix(col, col * vec3(1.02, 1.0, 1.06), smoothstep(0.35, 0.0, l) * 0.5 * warm); // sombras levemente frias, luz quente
      vec2 d = vUv - 0.5; col *= 1.0 - dot(d, d) * 0.5;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
});
composer.addPass(grade);

// farol do carro do jogador (sempre na cena, para não recompilar os shaders ao ligar)
const headlight = new THREE.SpotLight('#fff3d6', 0, 70, 0.55, 0.5, 1.2);
scene.add(headlight, headlight.target);

const loadingEl = document.getElementById('loading');
const playBtn = document.getElementById('play');
const startEl = document.getElementById('start');
const keys = {};
const audio = new Audio();

// tempo de cada etapa do carregamento (window.loadTimes, para medir)
const loadTimes = (window.loadTimes = []); let lastT = performance.now(), lastLabel = 'início';
const progress = (t) => { const now = performance.now(); loadTimes.push([lastLabel, Math.round(now - lastT), Math.round((performance.memory?.usedJSHeapSize || 0) / 1e6)]); /* [etapa, ms, MB de heap no fim] */ lastT = now; lastLabel = t; loadingEl.textContent = t; window.__introProgress?.(loadTimes.length / 12); };
// padrão: o município inteiro; ?mapa=antigo abre o recorte antigo (centro, zona norte e Boa Viagem, mais leve)
const MAPA = new URLSearchParams(location.search).get('mapa') === 'antigo' ? '/data/recife.json' : '/data/recife-full.json';
// baixa o mapa enquanto carrega as fotos; junto vem a cobertura do solo (WorldCover), que diz onde tem mata e bairro
window.__mapData = Promise.all([fetch(MAPA).then((r) => r.json()), fetch(MAPA.replace('.json', '-cobertura.bin')).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)])
  .then(([d, cob]) => { if (cob && !new URLSearchParams(location.search).has('semcobertura')) d.cobertura = decodeCobertura(cob, d.meta); return d; });
const photos = await loadPhotos(renderer, progress);
const world = await loadWorld(scene, renderer, progress, photos);
const water = scene.getObjectByName('water');
progress('Plantando oitis e flamboyants…');
const trees = new URLSearchParams(location.search).has('notrees') ? { count: 0, update() {} } : buildTrees(scene, world, photos);
progress('Montando trânsito, polícia e bicos…');
// o que só serve para montar a cidade sai da memória (ruas, bairros e lugares continuam: HUD, trânsito e bicos usam)
const pistaAeroporto = world.data.aeroway.find((a) => a.k === 'runway' && a.p.length > 5)?.p.slice() || null; // pros aviões pousando (avioes.js)
for (const k of ['buildings', 'parks', 'water', 'coastline', 'reefs', 'piers', 'aeroway', 'rail']) world.data[k] = [];
// peças fixas da cidade: depois de irem para a placa de vídeo, os vértices saem da memória do JS
// (carros e pessoas ficam de fora: suas geometrias são reaproveitadas para montar novos modelos)
{
  const drop = function () { this.array = null; };
  const visit = (o) => {
    if (o.userData?.model) return;
    if (o.isMesh || o.isPoints) {
      const geo = o.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      if (o.isInstancedMesh && !o.boundingSphere) o.computeBoundingSphere();
      for (const a of [...Object.values(geo.attributes), geo.index]) if (a && a.array) a.onUpload(drop);
    }
    for (const c of o.children) visit(c);
  };
  visit(scene);
}
const hud = new Hud(camera, world);
const traffic = new Traffic(scene, world, hud, audio);
traffic.isFree = (x, z) => !world.blocked(x, z) && !world.isWater(x, z);
const police = new Police(scene, world, traffic, hud, audio);
traffic.onCrime = (n, why) => police.crime(n, why);
const missions = new Missions(scene, world, traffic, police, hud);
hud.setMoney(save.money);
onSave((s) => hud.setMoney(s.money));
function outfitOpts() {
  const o = save.outfit;
  // padrão parecido com o do Bah City: moletom cinza, calça escura e tênis branco; o cabelo vem da barbearia
  return { player: true, shirt: '#8e9399', longSleeve: true, pants: '#26282e', jeans: false, shoes: '#f2f2f0', skin: '#c48a60', hair: o.hair || 'short', hairColor: o.hairColor || '#1b1209', stripes: o.shirt || undefined, hat: o.hat, glasses: o.glasses, hand: o.hand };
}

// ---------- jogador ----------
const marcoZero = world.pois.find((p) => p.name === 'Marco Zero') || { x: 0, z: 0 };
const player = {
  pos: new THREE.Vector3(marcoZero.x - 30, 0, marcoZero.z + 6),
  heading: -Math.PI / 2,
  mesh: makePerson(outfitOpts()),
  vehicle: null,
  yOff: 0, vy: 0,       // pulo
  boat: null,           // atravessando de barco
  move: null, moveT: 0, // passo do passinho
};
scene.add(player.mesh);
const prota = protagonista(); prota.attach(player.mesh, outfitOpts()); // corpo com esqueleto e animação (protagonista.js)
function applyOutfit() {
  const old = player.mesh;
  player.mesh = makePerson(outfitOpts());
  player.mesh.position.copy(old.position);
  player.mesh.rotation.y = old.rotation.y;
  player.mesh.visible = old.visible;
  scene.remove(old);
  scene.add(player.mesh);
  prota.attach(player.mesh, outfitOpts());
}

const nearestEdge = (graph, x, z) => traffic.nearestEdge(graph, x, z);

// um carro estacionado do lado, pra já sair dirigindo
{
  const n = nearestEdge(traffic.drive, player.pos.x, player.pos.z);
  if (n) {
    const mesh = makeVehicle('car', '#e3b12f');
    const p = traffic.posOn(n.e, n.t);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = Math.atan2(n.e.dx, n.e.dz);
    scene.add(mesh);
    traffic.parked.push({ mesh, v: 0 });
  }
}

police.onBusted = () => {
  if (player.vehicle) { scene.remove(player.vehicle.mesh); player.vehicle = null; audio.engine(false, 0, 0); }
  player.mesh.visible = true;
  player.speed = 0;
  const home = save.home || { x: marcoZero.x - 30, z: marcoZero.z + 6 };
  teleport(home.x, home.z);
  hud.flash('Liberado. Te comporta, visse!');
  missions.onBusted();
};

const lockMouse = () => { if (isTouch) return; try { canvas.requestPointerLock()?.catch?.(() => {}); } catch {} };
const isFree = (x, z) => !world.blocked(x, z);
let sharks = null; // criado mais embaixo (tubarao.js)
// a pé: carros (andando, estacionados, viaturas) são obstáculos
function insideCar(x, z, pad = 0.3) {
  for (const c of [...traffic.cars, ...traffic.parked, ...police.cars]) {
    const m = c.mesh; if (!m || (player.vehicle && m === player.vehicle.mesh)) continue;
    const dx = x - m.position.x, dz = z - m.position.z; if (dx * dx + dz * dz > 64) continue;
    const h = m.rotation.y, f = dx * Math.sin(h) + dz * Math.cos(h), r = dx * Math.cos(h) - dz * Math.sin(h);
    if (Math.abs(f) < (m.userData.L || 4.2) / 2 + pad && Math.abs(r) < (m.userData.W || 1.8) / 2 + pad) return true;
  }
  return false;
}
// carro: confere o contorno inteiro (quinas, laterais e frente), não só a linha do meio; escadaria não é rua
function carFree(x, z, h, L) {
  const W = (player.vehicle?.mesh.userData.W || 1.8) / 2 - 0.08, f = L / 2 - 0.15, s = Math.sin(h), c = Math.cos(h);
  for (const [a, b] of [[0, 0], [f, 0], [-f, 0], [f, W], [f, -W], [-f, W], [-f, -W], [0, W], [0, -W], [f / 2, W], [f / 2, -W], [-f / 2, W], [-f / 2, -W]]) {
    const px = x + s * a + c * b, pz = z + c * a - s * b;
    if (!isFree(px, pz) || world.isStairs(px, pz)) return false;
  }
  return !carHitsBody(x, z, h, L, W + 0.08);
}
// quanto o carro está dentro de algo (0 = livre). Se ele já está encostado/preso, qualquer movimento que não
// piore é aceito, então dá pra sempre sair de ré ou de lado em vez de travar.
function carCost(x, z, h, L) {
  const W = (player.vehicle?.mesh.userData.W || 1.8) / 2 - 0.08, f = L / 2 - 0.15, s = Math.sin(h), c = Math.cos(h);
  let n = 0;
  for (const [a, b] of [[0, 0], [f, 0], [-f, 0], [f, W], [f, -W], [-f, W], [-f, -W], [0, W], [0, -W], [f / 2, W], [f / 2, -W], [-f / 2, W], [-f / 2, -W]]) {
    const px = x + s * a + c * b, pz = z + c * a - s * b;
    if (!isFree(px, pz) || world.isStairs(px, pz)) n++;
  }
  return n + (carHitsBody(x, z, h, L, W + 0.08) ? 1 : 0);
}
// a pé: mesma ideia, somando parede, gente e carro
function footCost(x, z) {
  let n = 0;
  for (const [a, b] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) if (!isFree(x + a, z + b) && !sharks?.swimmable(x + a, z + b)) n += 2;
  if (!player.dancing) {
    for (const [bx, bz] of world.culture?.bodies || []) { const d = Math.hypot(bx - x, bz - z); if (d < 0.6) n += 1 + (0.6 - d) * 4; }
    for (const p of traffic.peds) if (p.down <= 0) { const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z); if (d < 0.6) n += 1 + (0.6 - d) * 4; }
  }
  if (insideCar(x, z)) n += 3;
  return n;
}
// rede de segurança: preso há mais de 1,2 s, procura o lugar livre mais perto (até 40 m) e põe lá
function unstick(x, z, cost) {
  for (let r = 0.75; r <= 40; r += r < 10 ? 0.75 : 1.5) for (let a = 0; a < Math.PI * 2; a += Math.PI / Math.max(4, r * 4)) {
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (cost(px, pz) === 0) return [px, pz];
  }
  return null;
}
let stuckT = 0;
// pessoas paradas (plateias, dançarinos, banda, marisqueiras) e pedestres: obstáculo para o carro
function carHitsBody(x, z, h, L, W) {
  const s = Math.sin(h), c = Math.cos(h);
  const inRect = (px, pz) => { const dx = px - x, dz = pz - z; return Math.abs(dx * s + dz * c) < L / 2 + 0.3 && Math.abs(dx * c - dz * s) < W + 0.3; };
  for (const [bx, bz] of world.culture?.bodies || []) if (inRect(bx, bz)) return true;
  return false;
}
// corpo do jogador a pé: raio de 0,3 m, contra prédios, objetos, pessoas e pedestres
function bodyFree(x, z) {
  for (const [a, b] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) if (!isFree(x + a, z + b)) return false;
  for (const [bx, bz] of world.culture?.bodies || []) if (Math.hypot(bx - x, bz - z) < 0.6) return false;
  for (const p of traffic.peds) if (p.down <= 0 && Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z) < 0.6) return false;
  return true;
}

function enterOrExit() {
  if (passageiro.dentro || catamara.ativo || quadrilha.dancando) return; // de passageiro não pega o volante
  if (player.vehicle) {
    const v = player.vehicle;
    if (Math.abs(v.speed) > 3) return;
    const h = v.mesh.rotation.y;
    for (const side of [1, -1]) {
      const x = v.mesh.position.x + Math.cos(h) * 2.2 * side, z = v.mesh.position.z - Math.sin(h) * 2.2 * side;
      if (isFree(x, z)) {
        player.pos.set(x, 0, z);
        traffic.parked.push({ mesh: v.mesh, v: 0 });
        player.vehicle = null;
        player.mesh.visible = true;
        if (v.mesh.userData.rider) v.mesh.userData.rider.visible = false; // moto estacionada fica sem piloto
        audio.engine(false, 0, 0);
        bicicletas.desceu(v.mesh); // bicicleta alugada perto de estação: devolve
        return;
      }
    }
    return;
  }
  const car = traffic.nearestCar(player.pos.x, player.pos.z, 4.5);
  if (!car) return;
  if (traffic.cars.includes(car)) { traffic.removeCar(car); traffic.ejectDriver(car); }
  else traffic.parked.splice(traffic.parked.indexOf(car), 1);
  player.vehicle = { mesh: car.mesh, speed: car.v || 0, steer: 0 };
  if (car.mesh.userData.rider) car.mesh.userData.rider.visible = true; // o piloto passa a ser você
  player.mesh.visible = false;
  hud.forget(car.mesh);
}

function teleport(x, z) {
  const graph = player.vehicle ? traffic.drive : traffic.foot;
  const n = nearestEdge(graph, x, z);
  if (!n) return;
  const p = traffic.posOn(n.e, n.t);
  if (player.vehicle) {
    player.vehicle.mesh.position.set(p.x, 0, p.z);
    player.vehicle.mesh.rotation.y = Math.atan2(n.e.dx, n.e.dz);
    player.vehicle.speed = 0;
    camYaw = player.vehicle.mesh.rotation.y + Math.PI;
  }
  player.pos.set(p.x, 0, p.z);
  for (const c of traffic.cars) scene.remove(c.mesh);
  for (const p2 of traffic.peds) { scene.remove(p2.mesh); hud.forget(p2.mesh); }
  traffic.cars.length = 0; traffic.peds.length = 0;
}

// ---------- celular: bicos, garagem, loja e serviços ----------
const shop = new Shop({ scene, traffic, police, hud, player, applyOutfit, teleport });
shop.marcoZero = { x: marcoZero.x - 30, z: marcoZero.z + 6 };
{
  const pts = world.data.roads.filter((r) => r.n === 'Avenida Boa Viagem').flatMap((r) => r.p);
  const p = pts.sort((a, b) => Math.abs(a[1] - 2600) - Math.abs(b[1] - 2600))[0];
  if (p) { shop.bvx = p[0] + 12; shop.bvz = p[1]; }
}
const phone = new Phone(hud, missions, shop);
// tubarão de Boa Viagem: o mar da orla deixa entrar; 3 s nadando e ele vem
const sharkMats = new Map();
sharks = new Sharks({ scene, world, hud, player, mat: (c, o = {}) => { const k = c + JSON.stringify(o); if (!sharkMats.has(k)) sharkMats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o })); return sharkMats.get(k); } });
// flanelinhas do Recife Antigo, corredores e barracas de coco e açaí na orla
const gente = comSemente(4404, () => new GenteDaRua({ scene, world, hud, player })); // lugares sorteados com semente: a grade sai igual a cada carga
// cachorros caramelo atravessando a rua (os carros freiam pra eles)
const caramelos = new Caramelos({ scene, world, traffic, player, hud });
// Ítalo Sena (humorista) no calçadão em frente ao Segundo Jardim, soltando o bordão pra galera em volta
let italo = null;
{
  const j = world.data.pois.find((p) => p.name === 'Segundo Jardim de Boa Viagem');
  let spot = null;
  if (j) for (let r = 4; r < 30 && !spot; r += 2) for (let a = 0; a < 12; a++) { const x = j.x + Math.cos(a * 0.52) * r, z = j.z + Math.sin(a * 0.52) * r; if (isFree(x, z) && !world.isRoad(x, z) && !sharks.swimmable(x, z)) { spot = [x, z]; break; } }
  if (spot) {
    const [x, z] = spot, m = makePerson({ shirt: '#1d1d1d', pants: '#d9d4c7', hat: 'bone', longSleeve: false });
    m.position.set(x, 0, z); scene.add(m);
    const fans = [];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 1.4 - 0.7, fx = x + Math.sin(a) * 2.6, fz = z + Math.cos(a) * 2.6; if (!isFree(fx, fz)) continue; const f = makePerson(); f.position.set(fx, 0, fz); f.rotation.y = Math.atan2(x - fx, z - fz); scene.add(f); fans.push(f); }
    italo = { mesh: m, fans, t: 0 };
    world.data.pois.push({ name: 'Ítalo Sena', kind: 'attraction', x, z });
  }
}
function updateItalo(dt, t) {
  if (!italo) return;
  const m = italo.mesh, u = m.userData, d = Math.hypot(player.pos.x - m.position.x, player.pos.z - m.position.z);
  m.visible = d < 160; for (const f of italo.fans) f.visible = m.visible;
  if (!m.visible) return;
  m.rotation.y = Math.atan2(player.pos.x - m.position.x, player.pos.z - m.position.z); // fala olhando pro jogador
  u.armR.rotation.x = -1.2 + Math.sin(t * 5) * 0.5; u.elbowR.rotation.x = -0.8; u.armL.rotation.z = -0.5 - Math.sin(t * 3) * 0.3; // gesticulando
  for (const f of italo.fans) f.userData.upper.rotation.x = Math.max(0, Math.sin(t * 7 + f.id)) * 0.12; // rindo
  italo.t -= dt;
  if (d < 35 && italo.t <= 0) { hud.say(m, 'Aguarde o processo, vú!', 3.2); italo.t = 7; }
}
// GPS (tecla N): destino, setas no chão e próxima manobra
const gps = new GPS({ scene, world, traffic, hud, player });
gps.onClose = () => { if (!phone.open && !hud.mapOpen) lockMouse(); };
// álbum de lugares (aba Álbum do celular): chegar perto de um marco tira a foto; escolher um traça a rota
const album = new Album(hud, missions.spots);
album.gps = gps;
album.onRoute = () => { if (phone.open) togglePhone(); };
phone.album = album;
onTrofeu((a, b, c) => album.postal(a, b, c)); // troféu ganho aparece no mesmo cartão-postal
album.buildSigns(scene, world, traffic);
// toró de vez em quando: céu fechado, neblina curta, barulho de chuva (game.weather.set(1) força)
const weather = new Weather({ scene, day, audio, hud, world, traffic });
// troça de frevo desfilando no Recife Antigo das 15h às 20h (G perto dela: brincar no bloco)
const bloco = new Bloco({ scene, world, traffic, hud, audio, day, player });
// som ambiente: mar na orla, passarinho de dia no verde, grilo e sapo de noite
const ambience = new Ambience({ world, day, audio, sharks, weather });
// ambulante no sinal: parou no vermelho, chega alguém vendendo (B compra)
const ambulantes = new Ambulantes({ scene, world, hud, player });
// boletim da rádio ligada: notícia do que está acontecendo (toró, alagamento, troça, hora e calor)
// dia de jogo: um estádio do Trio de Ferro por dia, das 14h às 17h, com a torcida em volta
const jogo = new Jogo({ scene, world, hud, audio, day, player, traffic });
// vendedores na areia de Boa Viagem (queijo coalho, picolé, castanha, amendoim): a pé, B compra
const praia = new Praia({ scene, world, hud, player, sharks });
// primeiro dia no Recife: tarefas que ensinam o jogo, no canto da tela (✕ fecha de vez)
// Zap: mensagens com pedidos (praia, sinal, jogo, álbum, bicos…) que rendem uns trocados
const zap = new Zap({ album, phone, missions, world, postal: (a, b, c) => album.postal(a, b, c) });
phone.zap = zap;
// ambulância de sirene ligada a cada poucos minutos; o trânsito abre caminho
const ambulancia = new Ambulancia({ scene, traffic, audio, hud, player });
// blitz de trânsito de vez em quando numa avenida perto: passar devagar libera, furar dá estrela
const blitz = new Blitz({ scene, world, traffic, hud, player, police });
// pombos ciscando nas praças; chegou perto, voam
const pombos = new Pombos({ scene, world, player });
// sino da igreja mais perto a cada hora cheia
const sinos = new Sinos({ world, day, audio, player });
// feira livre na frente dos mercados de bairro, de manhã (a pé, B compra)
const feira = new Feira({ scene, world, hud, player, day });
// negócios comprados em Serviços rendem a cada hora cheia
const negocios = new Negocios({ day, hud });
// caranguejos e catador no mangue perto da câmera (a pé, B compra uma corda)
const caranguejos = new Caranguejos({ scene, world, hud, player });
// pipas no céu da comunidade mais perto; linha arrebenta de vez em quando e dá pra aparar
const pipas = new Pipas({ scene, world, hud, player, weather });
// dominó dos senhores nas praças de bairro
const domino = new Domino({ scene, world, hud, player, audio });
// roda de capoeira no Marco Zero, das 10h ao fim da tarde
const capoeira = new Capoeira({ scene, world, hud, player, day });
// pescadores na beira do rio no Centro: a pé, B pede a vara e pesca
const pescaria = new Pescaria({ scene, world, hud, player, audio });
// Volta das Pontes contra o relógio, largada no Marco Zero (de carro, B começa)
const voltaPontes = new VoltaPontes({ scene, world, hud, player, missions });
// mamulengo no Pátio de São Pedro e emboladores de coco no Mercado de São José (a pé, B joga uma moeda)
const artistas = new Artistas({ scene, world, hud, player });
// forró pé-de-serra no Mercado da Boa Vista, de tarde
const forro = new Forro({ scene, world, hud, player, day });
// mirantes: a pé, B sobe e a câmera dá a volta lá de cima
const mirantes = new Mirantes({ world, hud, player });
// carro de som anunciando o que está rolando na cidade
const carroDeSom = new CarroDeSom({ traffic, hud, player, day, audio, eventos: { jogo, bloco, feira, forro, capoeira, day } });
// passageiro no corredor da Conde da Boa Vista: B na estação espera o ônibus
// pelada e frescobol na areia de Boa Viagem
const praiaJogos = new PraiaJogos({ scene, world, hud, player, praia, audio });
// estações de bicicleta compartilhada (a pé, B aluga; descer perto de estação devolve)
// passeio de catamarã pelo Capibaribe saindo do Marco Zero (a pé, B embarca)
const catamara = new Catamara({ scene, world, hud, player });
const bicicletas = new Bicicletas({ scene, world, hud, player, traffic });
// malabarista na faixa quando o carro para no vermelho (B dá uma moeda)
const malabarista = new Malabarista({ scene, world, hud, player, ambulantes });
const passageiro = new Passageiro({ world, traffic, hud, player, livre: (x, z) => isFree(x, z) });
// agenda: aba do celular com o que tem pra fazer (e ícones no mapa grande)
const agenda = new Agenda({ gps, hud, day, m: { player, world, save, jogo, bloco, feira, forro, capoeira, artistas, pescaria, domino, catamara, voltaPontes, mirantes, bicicletas, praia, sharks, passageiro } });
phone.agenda = agenda;
// desafios do dia (três por dia do jogo, no topo da Agenda)
const desafios = new Desafios({ day, hud });
agenda.desafios = desafios;
// casamento saindo da igreja mais perto, de vez em quando
const casamento = new Casamento({ scene, world, hud, player, sinos, makeVehicle });
// caminhão de lixo com os garis correndo atrás
const lixo = new Lixo({ scene, world, traffic, hud, player });
// barbearias de bairro perto dos mercados (a pé, B corta o cabelo)
const barbearia = new Barbearia({ scene, world, hud, player, applyOutfit });
// Corrida da Orla: de manhã, largada no Parque Dona Lindu, 2 km pelo calçadão (a pé, B se inscreve)
const corrida = new Corrida({ scene, world, hud, player, day, sharks });
agenda.m.corrida = corrida;
// ensaio de quadrilha junina no Sítio da Trindade, de tarde (a pé, B entra e acompanha as figuras)
const quadrilha = new Quadrilha({ scene, world, hud, player, day, trees });
agenda.m.quadrilha = quadrilha;
// o objetivo do jogo: caçada às 10 Lendas do Recife (aba Lendas do celular, ranking local)
const lendas = new Lendas({ scene, world, hud, player, praia, corrida, sharks });
phone.lendas = lendas;
lendas.onChange = () => phone.render();
agenda.onRoute = () => { if (phone.open) togglePhone(); };
// jangadas navegando no mar de Boa Viagem
const jangadas = new Jangadas({ scene, world, sharks });
// avião pousando nos Guararapes a cada 3–5 min, chegando baixo pelo norte
const avioes = new Avioes({ scene, audio, pista: pistaAeroporto });
zap.avioes = avioes;
const roteiro = new Roteiro({ player, phone, hud, radio: () => station, postal: (a, b, c) => album.postal(a, b, c) });
const boletim = new Boletim({ hud, weather, bloco, day, album, jogo });
boletim.blitz = blitz;
// marcas no mapa: os 21 lugares do álbum (os que faltam também no minimapa) e o bloco de frevo quando desfila
hud.marcas = () => {
  const out = album.spots.map((s) => { const tem = album.has(s); return { x: s.x, z: s.z, icon: '📸', cor: tem ? '#8ee07a' : '#c9c1da', mini: !tem }; });
  if (jogo.ativo) { const C = jogo.clube; out.push({ x: C.x, z: C.z, icon: '⚽', cor: '#ffffff', mini: true }); }
  if (bloco.route && bloco.ativo) { const q = bloco.route.at(bloco.s); out.push({ x: q.x, z: q.z, icon: '🎺', cor: '#f2b705', mini: true }); }
  for (const m of window.game?.agenda?.marcas() || []) if (m.icon !== '⚽' && m.icon !== '🎺') out.push(m); // passatempos só no mapa grande
  return out;
};
// rádio 8-bit (tecla R): desligada → Frevo → Mangue Bit → Brega → desligada
let station = -1;
let fotoPedida = false;
let estacoesVistas = 0;
function setStation(i) {
  station = i;
  audio.radioSet(station);
  hud.flash(station < 0 ? '📻 Rádio desligada' : `📻 ${RADIO_NAMES[station]} · R troca a estação`);
  radioUI.render();
}
function radio() { setStation(station + 1 >= RADIO_NAMES.length ? -1 : station + 1); }
// botão da rádio na parte de baixo (ao lado do GPS): mostra o que está tocando e abre a lista pra ligar, desligar ou escolher
const radioUI = (() => {
  const css = document.createElement('style');
  css.textContent = `#radio-btn{position:fixed;left:50%;bottom:72px;transform:translateX(5px);z-index:25;background:#2b1d3a;color:#fff;border:0;border-radius:999px;padding:10px 16px;font:700 14px Inter,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;white-space:nowrap;max-width:46vw;overflow:hidden;text-overflow:ellipsis}
#radio-btn.on{background:linear-gradient(100deg,#8338ec,#e8343f)}
#radio-menu{position:fixed;left:50%;bottom:122px;transform:translateX(5px);z-index:26;background:#fff;color:#1d1d1f;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.4);overflow:hidden;min-width:230px;font-family:Inter,system-ui,sans-serif}
#radio-menu button{display:block;width:100%;text-align:left;border:0;background:none;padding:11px 16px;font:600 14px Inter,sans-serif;cursor:pointer;color:#1d1d1f}
#radio-menu button:hover{background:#f1ecfb}#radio-menu button.cur{background:#ece3fb;color:#5b1a9a}
#radio-menu .rm-h{padding:9px 16px;font:800 12px Inter,sans-serif;letter-spacing:.06em;color:#8a8a90;background:#f7f6fa}
#radio-btn.hidden,#radio-menu.hidden{display:none}
body.touch #radio-btn{bottom:auto;top:calc(env(safe-area-inset-top) + 64px)}body.touch #radio-menu{bottom:auto;top:calc(env(safe-area-inset-top) + 112px)}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'radio-btn'; btn.className = 'hidden';
  const menu = document.createElement('div'); menu.id = 'radio-menu'; menu.className = 'hidden';
  document.body.append(btn, menu);
  const close = () => { menu.classList.add('hidden'); };
  btn.onclick = () => { if (menu.classList.toggle('hidden')) return; document.exitPointerLock?.(); render(); };
  function render() {
    const on = station >= 0;
    btn.textContent = on ? `📻 ${RADIO_NAMES[station]} ▾` : '📻 Rádio desligada ▾';
    btn.classList.toggle('on', on);
    menu.innerHTML = '<div class="rm-h">RÁDIO 8-BIT · tecla R</div>' + RADIO_NAMES.map((n, i) => `<button data-i="${i}" class="${i === station ? 'cur' : ''}">${i === station ? '🔊' : '▶️'} ${n}</button>`).join('') + `<button data-i="-1" class="${on ? '' : 'cur'}">⏹️ ${on ? 'Desligar a rádio' : 'Desligada'}</button>`;
    menu.querySelectorAll('button').forEach((b) => (b.onclick = () => { setStation(Number(b.dataset.i)); close(); lockMouse(); }));
  }
  // botão de mudo, do lado da rádio (tecla U)
  const mute = document.createElement('button'); mute.id = 'mute-btn'; mute.className = 'hidden';
  const css2 = document.createElement('style');
  css2.textContent = `#mute-btn{position:fixed;left:50%;bottom:72px;z-index:25;width:42px;height:42px;border-radius:50%;border:0;background:#2b1d3a;color:#fff;font-size:19px;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer}
#mute-btn.off{background:#e8343f}#mute-btn.hidden{display:none}body.touch #mute-btn{bottom:auto;top:calc(env(safe-area-inset-top) + 64px)}`;
  document.head.appendChild(css2); document.body.append(mute);
  const place = () => { const r = btn.getBoundingClientRect(); mute.style.left = Math.round(r.right + 8) + 'px'; };
  const renderMute = () => { mute.textContent = audio.muted ? '🔇' : '🔊'; mute.title = audio.muted ? 'Som desligado (U liga)' : 'Som ligado (U desliga)'; mute.classList.toggle('off', audio.muted); place(); };
  mute.onclick = () => { toggleMute(); };
  const _render = render;
  return { render() { _render(); requestAnimationFrame(place); }, show() { btn.classList.remove('hidden'); mute.classList.remove('hidden'); _render(); renderMute(); requestAnimationFrame(place); }, close, renderMute };
})();
function toggleMute() { audio.setMuted(!audio.muted); radioUI.renderMute(); hud.flash(audio.muted ? '🔇 Som desligado' : '🔊 Som ligado'); }
addEventListener('resize', () => requestAnimationFrame(() => radioUI.renderMute?.()));
function toggleGPS() {
  if (gps.isOpen) { gps.close(); return; }
  if (phone.open) phone.toggle(player);
  if (hud.mapOpen) toggleMap();
  document.exitPointerLock?.(); gps.open();
}

// ---------- entrada ----------
let camYaw = Math.PI / 2, camPitch = 0.28, lastMouse = 0;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  // setinhas e espaço não rolam a página
  if (started && /^(Arrow|Space)/.test(e.code) && !phone.open) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Space' && started && !phone.open) jump();
  if (e.code === 'KeyF') { if (!boardBoat()) enterOrExit(); }
  if (e.code === 'KeyH') audio.horn(1);
  if (e.code === 'KeyG' && started) toggleDance();
  if (e.code === 'KeyP' && started) { togglePhone(); return; }
  if (phone.open) {
    phone.key(e.code);
    if (!phone.open) lockMouse();
  }
  if (e.code === 'KeyT' && started) skipTime(e.shiftKey ? -2 : 2);
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyN' && started) { if (e.shiftKey) gps.clear(gps.dest ? '🧭 Rota cancelada.' : null); else toggleGPS(); }
  if (e.code === 'KeyR' && started && !e.shiftKey) radio();
  if (e.code === 'KeyU' && started) toggleMute();
  if (e.code === 'KeyK' && started) fotoPedida = true; // modo foto: salva a cena sem HUD
  if (e.code === 'KeyB' && started) { if (player.vehicle) { if (!voltaPontes.comeca() && !ambulantes.comprar()) malabarista.moeda(); } else if (!quadrilha.b() && !corrida.b() && !barbearia.corta() && !catamara.b() && !passageiro.b() && !bicicletas.aluga() && !mirantes.b() && !pescaria.b() && !artistas.moeda() && !praia.comprar() && !feira.comprar()) caranguejos.comprar(); }
});
function togglePhone() {
  if (hud.mapOpen) toggleMap();
  const open = phone.toggle(player);
  if (open) document.exitPointerLock?.(); else lockMouse();
}
function toggleMap() {
  if (phone.open) phone.toggle(player);
  const open = hud.toggleMap(player, teleport, (x, z) => { gps.setDest(x, z, 'ponto no mapa'); lockMouse(); });
  if (open) document.exitPointerLock?.(); else lockMouse();
}
function skipTime(h) { day.skip(h); hud.flash(`${day.clock}`); }
document.querySelectorAll('.close-x').forEach((b) => b.addEventListener('click', () => (b.dataset.x === 'map' ? toggleMap() : togglePhone())));

// celular e tablet: joystick, câmera por arrasto e botões
const touch = isTouch ? new Touch({
  keys,
  onTap: (a) => {
    if (!started) return;
    if (a === 'act') { if (player.vehicle && voltaPontes.hint && voltaPontes.comeca()) return; if (player.vehicle && ambulantes.hint && ambulantes.comprar()) return; if (player.vehicle && malabarista.hint && malabarista.moeda()) return; if (!player.vehicle && (quadrilha.perto || quadrilha.dancando) && quadrilha.b()) return; if (!player.vehicle && corrida.perto && corrida.b()) return; if (!player.vehicle && barbearia.hint && barbearia.corta()) return; if (!player.vehicle && catamara.hint && catamara.b()) return; if (!player.vehicle && bicicletas.hint && bicicletas.aluga()) return; if (!player.vehicle && passageiro.hint && passageiro.b()) return; if (!player.vehicle && mirantes.hint && mirantes.b()) return; if (!player.vehicle && pescaria.hint && pescaria.b()) return; if (!player.vehicle && artistas.hint && artistas.moeda()) return; if (!player.vehicle && praia.hint && praia.comprar()) return; if (!player.vehicle && feira.hint && feira.comprar()) return; if (!player.vehicle && caranguejos.hint && caranguejos.comprar()) return; if (boardBoat()) return; if (!player.vehicle && !traffic.nearestCar(player.pos.x, player.pos.z, 4.5) && (player.dancing || nearRoda())) toggleDance(); else enterOrExit(); }
    else if (a === 'jump') jump();
    else if (a === 'dance') toggleDance();
    else if (a === 'horn') audio.horn(1);
    else if (a === 'phone') togglePhone();
    else if (a === 'map') toggleMap();
    else if (a === 'gps') toggleGPS();
    else if (a === 'radio') radio();
    else if (a === 'mute') toggleMute();
    else if (a === 'time') skipTime(2);
  },
  onLook: (dx, dy) => {
    camYaw -= dx * 0.0065;
    camPitch = Math.max(0.02, Math.min(1.3, camPitch + dy * 0.004));
    lastMouse = performance.now();
  },
}) : null;
// lê teclado e joystick juntos
function moveInput() {
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (touch && (touch.move.x || touch.move.y)) { f = touch.move.y; s = touch.move.x; }
  return { f, s };
}
addEventListener('keyup', (e) => (keys[e.code] = false));
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('click', () => { if (!hud.mapOpen) lockMouse(); });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  camYaw -= e.movementX * 0.0025;
  camPitch = Math.max(0.02, Math.min(1.3, camPitch + e.movementY * 0.002));
  lastMouse = performance.now();
});
document.addEventListener('pointerlockchange', () => {
  if (!isTouch && document.pointerLockElement !== canvas && !hud.mapOpen) hud.hint('Clique na tela para controlar a câmera');
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  gtao?.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
});

progress('pronto');
loadingEl.classList.add('hidden');
window.__introDone?.();
playBtn.classList.remove('hidden');
let started = false;
playBtn.addEventListener('click', () => {
  started = true;
  audio.start();
  radioUI.show();
  startEl.classList.add('hidden');
  hud.show();
  lockMouse();
  if (touch) {
    touch.show(true);
    // tela cheia deitada, quando o navegador deixa
    try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch {}
  }
});

// show de punk no primeiro andar do Dokas: som sai pela janela
if (world.data.dokas?.door && world.culture) world.culture.sounds.push({ kind: 'punk', x: world.data.dokas.door[0], z: world.data.dokas.door[1], base: 0.5, R: 90 });
// flesheiros: quando um menino pula perto, a galera grita o nome do salto
let lastDiveFlash = 0;
if (world.rio) world.rio.onDive = (d, tr) => {
  const now = performance.now();
  if (!started || now - lastDiveFlash < 6000 || Math.hypot(d.x - player.pos.x, d.z - player.pos.z) > 45) return;
  lastDiveFlash = now; hud.flash(`Flesheiro! ${tr.name}`);
};
// ---------- simulação ----------
// ---------- dançar na roda de passinho ----------
const nearRoda = () => (world.culture?.danceSpots || []).find((d) => Math.hypot(d.x - player.pos.x, d.z - player.pos.z) < d.r);
let tipTimer = 0;
function resetPose() {
  const u = player.mesh.userData;
  for (const k of ['legL', 'legR', 'kneeL', 'kneeR', 'armL', 'armR', 'elbowL', 'elbowR', 'upper']) u[k]?.rotation.set(0, 0, 0);
  u.armL.rotation.z = -0.07; u.armR.rotation.z = 0.07; u.upper.position.y = 0;
}
function toggleDance() {
  if (player.vehicle || player.boat) return;
  if (player.dancing) { player.dancing = false; resetPose(); return; }
  player.dancing = true; player.yOff = 0; player.vy = 0;
  nextMove();
  const r = nearRoda();
  if (r) {
    // na roda, vai pro meio, de frente pra galera, e ganha uns trocados
    tipTimer = 12;
    player.pos.set(r.x + 0.2, 0, r.z + 1.6);
    hud.flash('Bora, mostra teu passinho!');
  } else hud.flash(`Passinho: ${player.move}`);
}
// troca de passo a cada 8 tempos (3,2 s no brega-funk de 150 BPM), nunca repetindo o anterior
function nextMove() {
  const opts = PASSOS.filter((m) => m !== player.move);
  player.move = opts[Math.floor(Math.random() * opts.length)];
  player.moveT = 8 * 60 / 150;
}
// pulo: espaço a pé (no carro, espaço continua sendo o freio de mão)
function jump() {
  if (player.vehicle || player.boat || player.yOff > 0.01) return;
  if (player.dancing) { player.dancing = false; resetPose(); }
  player.vy = 5.2; player.yOff = 0.001;
}
// barqueiros do Marco Zero: F perto do trapiche com barco atracado
function boardBoat() {
  if (player.vehicle || player.boat || !world.rio) return false;
  const b = world.rio.boardable(player.pos.x, player.pos.z);
  if (!b) return false;
  if (save.money < 5) { hud.flash('A travessia é R$ 5, visse? Faz um bico antes.'); return true; }
  addMoney(-5);
  if (player.dancing) { player.dancing = false; resetPose(); }
  player.boat = { b, from: b.state };
  b.rider = player;
  const u = player.mesh.userData;
  u.legL.rotation.set(-1.45, 0, 0); u.legR.rotation.set(-1.45, 0, 0); u.kneeL.rotation.x = 1.45; u.kneeR.rotation.x = 1.45;
  hud.flash(b.state === 'A' ? 'Bora pro Parque das Esculturas! R$ 5' : 'Bora de volta pro Marco Zero! R$ 5');
  return true;
}
const _seat = new THREE.Vector3();
function updateBoatRide() {
  const { b, from } = player.boat;
  _seat.set(...b.seat); b.g.localToWorld(_seat);
  player.pos.set(_seat.x, 0, _seat.z);
  player.heading = b.yaw;
  player.mesh.position.copy(_seat);
  player.mesh.rotation.set(b.g.rotation.x, b.yaw, b.g.rotation.z, 'YXZ');
  player.speed = b.speed;
  // chegou do outro lado: desce no trapiche
  if (b.state !== 'move' && b.state !== from) {
    const l = b.state === 'A' ? b.landA : b.landB;
    player.pos.set(l[0], 0, l[1]); player.mesh.rotation.set(0, player.heading, 0);
    b.rider = null; player.boat = null; resetPose();
    hud.flash(b.state === 'B' ? 'Parque das Esculturas de Francisco Brennand' : 'Marco Zero');
    return;
  }
  hud.hint('');
}

function updateOnFoot(dt) {
  const { f, s } = moveInput();
  const mag = Math.min(1, Math.hypot(f, s));
  let mx = 0, mz = 0;
  if (f || s) {
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    mx = fx * f + rx * s; mz = fz * f + rz * s;
    const l = Math.hypot(mx, mz); mx /= l; mz /= l;
  }
  // pulo: sobe e cai de volta no chão
  if (player.yOff > 0) {
    player.vy -= 15 * dt; player.yOff += player.vy * dt;
    if (player.yOff <= 0) { player.yOff = 0; player.vy = 0; }
  }
  const run = keys.ShiftLeft || keys.ShiftRight;
  const swim = sharks.swimming;
  const speed = (f || s) ? (swim ? 2.2 : run ? 8 : 4.2 * Math.max(0.45, mag)) : 0;
  player.speed = speed;
  const nx = player.pos.x + mx * speed * dt, nz = player.pos.z + mz * speed * dt;
  // se um carro parou em cima de você, dá pra sair; senão carro bloqueia como parede
  // dançando no meio da roda, os dançarinos em volta não prendem o jogador
  const cur = footCost(player.pos.x, player.pos.z);
  let unstuck = false;
  const ok = (x, z) => { const c = footCost(x, z); return c === 0 || (cur > 0 && c <= cur); };
  if (cur > 0) {
    stuckT += dt;
    if (stuckT > 1.2) { const p = unstick(player.pos.x, player.pos.z, footCost); if (p) { player.pos.x = p[0]; player.pos.z = p[1]; unstuck = true; } stuckT = 0; }
  } else stuckT = 0;
  if (unstuck) { /* já foi posto num lugar livre neste quadro */ }
  else if (ok(nx, nz)) { player.pos.x = nx; player.pos.z = nz; }
  else if (ok(nx, player.pos.z)) player.pos.x = nx;
  else if (ok(player.pos.x, nz)) player.pos.z = nz;
  if (speed) {
    const target = Math.atan2(mx, mz);
    let dh = target - player.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    player.heading += dh * Math.min(1, dt * 12);
  }
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading;
  player.hop = 0;
  if (player.dancing && speed > 0) { player.dancing = false; resetPose(); }
  if (player.dancing) {
    player.moveT -= dt;
    if (player.moveT <= 0) { nextMove(); hud.flash(`Passinho: ${player.move}`); }
    const P = passinhoPose(player.move, clock.elapsedTime);
    applyPose(player.mesh, P, Math.min(1, dt * 16));
    // giro, deslize de lado e pulinho mexem o corpo inteiro (só o desenho; a posição no mapa não muda)
    player.mesh.rotation.y = player.heading + P.yaw;
    player.mesh.position.x += Math.cos(player.heading) * P.side; player.mesh.position.z -= Math.sin(player.heading) * P.side;
    player.hop = P.hop;
    if (nearRoda()) {
      tipTimer -= dt;
      if (tipTimer <= 0) { tipTimer = 15; addMoney(5); hud.flash(['Caraí, que passinho!', 'É o ouro, boy! Os trocados vieram: R$ 5', 'A galera jogou uns trocados: R$ 5', 'Arretado! Mais R$ 5'][Math.floor(Math.random() * 4)]); }
    }
  } else if (player.yOff > 0) {
    // no ar: joelhos dobrados, braços pra cima
    const u = player.mesh.userData, k = Math.min(1, dt * 12);
    u.legL.rotation.x += (-0.7 - u.legL.rotation.x) * k; u.legR.rotation.x += (0.2 - u.legR.rotation.x) * k;
    u.kneeL.rotation.x += (1.2 - u.kneeL.rotation.x) * k; u.kneeR.rotation.x += (0.6 - u.kneeR.rotation.x) * k;
    u.armL.rotation.x += (-1.6 - u.armL.rotation.x) * k; u.armR.rotation.x += (-1.6 - u.armR.rotation.x) * k;
  } else animatePerson(player.mesh, speed, dt);

  const car = traffic.nearestCar(player.pos.x, player.pos.z, 4.5);
  const steal = car && traffic.cars.includes(car);
  const roda = !car && nearRoda();
  const boat = !car && world.rio?.boardable(player.pos.x, player.pos.z);
  if (touch) { touch.setMode(false, quadrilha.perto ? 'dançar' : corrida.perto ? 'correr' : barbearia.hint ? 'cortar' : catamara.hint ? (catamara.ativo ? 'voltar' : 'embarcar') : bicicletas.hint ? 'alugar' : passageiro.hint ? (passageiro.dentro ? 'descer' : passageiro.espera ? 'desistir' : 'esperar') : mirantes.hint ? (mirantes.ativo ? 'descer' : 'subir') : pescaria.hint ? (pescaria.estado ? 'puxar' : 'pescar') : artistas.hint ? 'moeda' : praia.hint || feira.hint || caranguejos.hint ? 'comprar' : boat ? 'barco' : car ? (steal ? 'roubar' : 'entrar') : roda ? (player.dancing ? 'parar' : 'dançar') : null); hud.hint(''); }
  else hud.hint(boat ? `F — atravessar de barco pro ${boat.state === 'A' ? 'Parque das Esculturas' : 'Marco Zero'} (R$ 5)` : car ? (steal ? 'F — roubar o carro' : 'F — entrar no carro') : roda ? (player.dancing ? 'G — sair da roda' : 'G — entrar na roda de passinho') : player.dancing ? 'G — parar de dançar' : quadrilha.hint || corrida.hint || barbearia.hint || catamara.hint || bicicletas.hint || passageiro.hint || mirantes.hint || pescaria.hint || artistas.hint || praia.hint || feira.hint || caranguejos.hint);
}

function updateDriving(dt) {
  const v = player.vehicle, m = v.mesh, L = m.userData.L, bus = m.userData.kind === 'bus';
  const inp = moveInput();
  const throttle = Math.max(0, inp.f), brake = Math.max(0, -inp.f), hb = keys.Space;
  const steerIn = -inp.s;
  v.steer += (steerIn - v.steer) * Math.min(1, dt * 7);
  const st = m.userData.stats;
  const vmax = st.vmax;
  if (throttle) v.speed += v.speed < -0.5 ? 22 * dt * throttle : st.accel * throttle * (1 - v.speed / vmax) * dt;
  if (brake) v.speed -= v.speed > 0.5 ? 24 * (1 - 0.35 * weather.r) * dt * brake : 6 * dt * brake; // molhado freia menos
  if (!throttle && !brake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (1.2 + Math.abs(v.speed) * 0.04) * dt);
  if (hb) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 11 * dt);
  v.speed = Math.max(-9, Math.min(vmax, v.speed));
  // poça de alagamento: a água segura o carro; entrar rápido espirra e molha quem tá na calçada
  const poca = weather.puddleAt(m.position.x, m.position.z);
  if (poca > 0 && Math.abs(v.speed) > 4) {
    v.speed *= 1 - Math.min(0.5, poca * 0.8 * dt);
    if (!v.naPoca && Math.abs(v.speed) > 9) { weather.splash(m.position.x, m.position.z, m.rotation.y, Math.abs(v.speed)); audio.splash(Math.min(1, Math.abs(v.speed) / 20)); }
    v.naPoca = true;
  } else if (poca === 0) v.naPoca = false;
  const grip = Math.max(-1, Math.min(1, v.speed / 5));
  const yaw = v.steer * 1.9 * st.turn * grip / (1 + Math.abs(v.speed) / 24) * (hb ? 1.6 : 1);
  let h = m.rotation.y + yaw * dt;
  // pista molhada: o carro aponta pra um lado e segue andando um pouco pro outro (derrapa na curva)
  const wet = weather.r;
  if (v.vh == null || wet < 0.05 || Math.abs(v.speed) < 3) v.vh = h;
  else { const d = Math.atan2(Math.sin(h - v.vh), Math.cos(h - v.vh)); v.vh += d * Math.min(1, dt * (12 - 9 * wet) / (1 + Math.abs(v.speed) / 18)); }
  const dx = Math.sin(v.vh) * v.speed * dt, dz = Math.cos(v.vh) * v.speed * dt;
  if (v.speed > 1) conta('km', (v.speed * dt) / 1000);
  const x = m.position.x, z = m.position.z;
  const cur = carCost(x, z, m.rotation.y, L);
  let carUnstuck = false;
  const carFree = (X, Z, H) => { const c = carCost(X, Z, H, L); return c === 0 || (cur > 0 && c <= cur); };
  if (cur > 0) {
    stuckT += dt;
    if (stuckT > 1.2 && Math.abs(v.speed) < 2) { const p = unstick(x, z, (X, Z) => carCost(X, Z, h, L)); if (p) { m.position.x = p[0]; m.position.z = p[1]; carUnstuck = true; } stuckT = 0; }
  } else stuckT = 0;
  if (carUnstuck) { /* já saiu */ }
  else if (carFree(x + dx, z + dz, h, L)) { m.position.x += dx; m.position.z += dz; }
  else if (carFree(x + dx, z, h, L)) { m.position.x += dx; v.speed *= 0.97; }
  else if (carFree(x, z + dz, h, L)) { m.position.z += dz; v.speed *= 0.97; }
  else {
    if (Math.abs(v.speed) > 5) audio.thump(Math.min(1, Math.abs(v.speed) / 25));
    v.speed *= -0.25; v.vh = null;
    if (!carFree(x, z, h)) h = m.rotation.y; // não gira pra dentro da parede
  }
  m.rotation.y = h;
  animateVehicle(m, v.speed, v.steer, dt);
  player.pos.set(m.position.x, 0, m.position.z);
  player.heading = h;
  audio.engine(m.userData.kind !== 'bike', v.speed, throttle); // bike não tem motor
  const canExit = Math.abs(v.speed) < 3;
  if (touch) { touch.setMode(true, voltaPontes.hint ? 'largar' : ambulantes.hint ? 'comprar' : malabarista.hint ? 'moeda' : canExit ? 'sair' : null); hud.hint(''); } // no toque, o botão de ação compra do ambulante
  else hud.hint(canExit ? (m.userData.kind === 'moto' || m.userData.kind === 'bike' ? `F — descer da ${m.userData.kind === 'moto' ? 'moto' : 'bicicleta'}` : bus ? 'F — descer do ônibus' : 'F — sair do carro') + (voltaPontes.hint ? ' · ' + voltaPontes.hint : ambulantes.hint ? ' · ' + ambulantes.hint : malabarista.hint ? ' · ' + malabarista.hint : '') : '');
}

// câmera atrás do personagem, olhando para onde ele olha. Mexeu o mouse (ou arrastou no celular), ela fica onde
// você deixou por um instante e depois volta para trás dele. Prédio no caminho: a câmera chega mais perto.
let camDist = 5.2;
function updateCamera(dt) {
  // depuração: câmera livre (window.game.camFree = { pos: [x, y, z], look: [x, y, z] })
  // mirante: a câmera dá a volta lá de cima
  if (mirantes.cam) { const f = mirantes.cam; camera.position.set(...f.pos); camera.lookAt(...f.look); return; }
  if (window.game?.camFree) { const f = window.game.camFree; camera.position.set(...f.pos); camera.lookAt(...f.look); return; }
  const v = player.vehicle || passageiro.camV || catamara.camV; // de passageiro, a câmera segue o ônibus
  const idle = performance.now() - lastMouse > 900;
  const moving = v ? Math.abs(v.speed) > 1.5 : player.speed > 0.3;
  if (idle && (moving || !player.dancing)) {
    const heading = v ? v.mesh.rotation.y + (v.speed < -1 ? Math.PI : 0) : player.heading;
    const target = heading + Math.PI;
    let d = target - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    // a pé, andando de volta para a câmera (S), ela não persegue (senão ficaria girando)
    if (v || !moving || Math.abs(d) < 1.75) camYaw += d * Math.min(1, dt * (moving ? (v ? 2.8 : 3.5) : 1.2));
    camPitch += ((v ? 0.22 : 0.26) - camPitch) * Math.min(1, dt * 1.5);
  }
  const bus = v?.mesh.userData.kind === 'bus';
  const want = v ? (bus ? 17 : 9.5) : 5.2;
  const tx = player.pos.x, tz = player.pos.z, ty = (v ? (bus ? 3 : 1.7) : 1.55) + heightAt(tx, tz);
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch), dx = Math.sin(camYaw) * cp, dz = Math.cos(camYaw) * cp;
  // colisão da câmera: anda do personagem para trás até achar parede
  let free = want;
  for (let d = v ? 2.5 : 0.8; d <= want; d += 0.4) { if (world.blocked(tx + dx * d, tz + dz * d) && !world.isWater(tx + dx * d, tz + dz * d)) { free = Math.max(v ? 2.5 : 1.0, d - 0.6); break; } }
  camDist += (free - camDist) * Math.min(1, dt * (free < camDist ? 14 : 3)); // aproxima rápido, afasta devagar
  const cx = tx + dx * camDist, cz = tz + dz * camDist;
  camera.position.set(cx, Math.max(heightAt(cx, cz) + 0.6, ty + sp * camDist), cz); // no morro a câmera não entra na encosta
  camera.lookAt(tx, ty, tz);
}

// ---------- noite: janelas, postes, faróis ----------
day.onNight.push((n) => {
  world.setNight(n);
  traffic.night = n;
  setVehicleLights(n);
});
function updateHeadlight() {
  const v = player.vehicle;
  const on = v && day.night > 0.25;
  headlight.intensity = on ? 900 * day.night : 0;
  if (!v) return;
  const h = v.mesh.rotation.y, p = v.mesh.position;
  headlight.position.set(p.x + Math.sin(h) * 2, 1.0, p.z + Math.cos(h) * 2);
  headlight.target.position.set(p.x + Math.sin(h) * 22, 0, p.z + Math.cos(h) * 22);
}

const clock = new THREE.Clock();
function frame() {
  // a página pode abrir escondida (largura 0); quando aparecer, ajusta o tamanho
  if (renderer.domElement.width === 0 && innerWidth > 0) dispatchEvent(new Event('resize'));
  const dt = frame.manual ? (clock.elapsedTime += 1 / 30, 1 / 30) : Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (started && !hud.mapOpen && police.frozen <= 0 && !sharks.busy && sharks.phase !== 'over') {
    if (player.vehicle) updateDriving(dt); else if (player.boat) updateBoatRide(); else if (passageiro.dentro) { if (touch) { touch.setMode(false, 'descer'); hud.hint(''); } else hud.hint(passageiro.hint); } else if (catamara.ativo) { if (touch) { touch.setMode(false, 'voltar'); hud.hint(''); } else hud.hint(catamara.hint); } else if (quadrilha.dancando) { if (touch) { touch.setMode(false, 'passo'); hud.hint(''); } else hud.hint(quadrilha.hint); } else updateOnFoot(dt);
  } else if (!started) {
    camYaw += dt * 0.05; // giro lento atrás da tela inicial
  }
  traffic.update(dt, player);
  police.update(dt, player, t);
  missions.update(dt, player, t);
  if (started) gps.update(dt);
  if (started) album.update(dt, player);
  if (started) sharks.update(dt, t);
  if (started) updateItalo(dt, t);
  gente.update(dt, t);
  if (started) caramelos.update(dt, t);
  audio.radioTick();
  // relevo: tudo que se move fica no chão; carros inclinam na ladeira
  {
    const ground = (m, off = 0) => { m.position.y = world.groundY(m.position.x, m.position.z) + off; }; // com a calçada
    const pitch = (m) => {
      const L = (m.userData.L || 4) / 2, h = m.rotation.y, x = m.position.x, z = m.position.z;
      const f = heightAt(x + Math.sin(h) * L, z + Math.cos(h) * L), b = heightAt(x - Math.sin(h) * L, z - Math.cos(h) * L);
      m.rotation.order = 'YXZ'; m.rotation.x = -Math.atan2(f - b, 2 * L);
      m.position.y = (f + b) / 2;
    };
    for (const c of traffic.cars) pitch(c.mesh);
    for (const c of traffic.parked) pitch(c.mesh);
    for (const c of police.cars) pitch(c.mesh);
    for (const p of traffic.peds) ground(p.mesh, p.down > 0 ? 0.15 : 0);
    if (player.vehicle) pitch(player.vehicle.mesh); else if (sharks.busy) { /* o tubarão puxa pro fundo */ } else if (!player.boat) ground(player.mesh, player.yOff + (player.hop || 0) - (sharks.swimming ? 1.05 : 0));
  }
  prota.update(dt, { speed: player.speed || 0, air: player.yOff > 0.05, dancing: !!player.dancing, boat: !!player.boat, swim: !!sharks.swimming, driving: !!player.vehicle });
  updateCamera(dt);
  world.update(camera.position, t);
  trees.update(camera.position, t);
  atualizarGente(camera); // NPCs de perto com corpo de esqueleto (corpos.js)
  // pedestres longe não aparecem (cada um tem ~20 peças)
  for (const ped of traffic.peds) ped.mesh.visible = ped.mesh.position.distanceToSquared(camera.position) < 150 * 150;
  hud.update(dt, player, camYaw);
  water?.userData.update?.(t);
  day.update(started ? dt : 0, player.pos, camera.position);
  weather.update(started ? dt : 0, camera, started);
  traffic.wet = weather.r;
  if (started) bloco.update(dt, t, camera.position);
  ambience.update(dt, camera.position, started);
  if (started) ambulantes.update(dt);
  if (started) boletim.update(dt, station, RADIO_NAMES[station]);
  if (started) jogo.update(dt, t, camera.position);
  if (started) praia.update(dt, t, camera.position);
  if (started) roteiro.update(dt);
  if (started) zap.update(dt);
  if (started) ambulancia.update(dt, t);
  if (started) blitz.update(dt, t);
  pombos.update(dt, t, camera.position);
  if (started) sinos.update();
  if (started) feira.update(dt, t, camera.position);
  if (started) negocios.update();
  if (started) caranguejos.update(dt, t, camera.position);
  if (started) pipas.update(dt, t, camera.position);
  if (started) domino.update(dt, t, camera.position);
  if (started) capoeira.update(dt, t, camera.position);
  if (started) pescaria.update(dt, t, camera.position);
  if (started) voltaPontes.update(dt, t);
  if (started) artistas.update(dt, t, camera.position);
  if (started) forro.update(dt, t, camera.position);
  mirantes.update(dt);
  if (started) carroDeSom.update(dt);
  if (started) passageiro.update(dt);
  if (started) praiaJogos.update(dt, t, camera.position);
  if (started) bicicletas.update(dt, t, camera.position);
  catamara.update(dt, t);
  if (started) desafios.update();
  if (started) casamento.update(dt, t);
  if (started) lixo.update(dt, t);
  if (started) barbearia.update(dt, t, camera.position);
  if (started) corrida.update(dt, t, camera.position);
  if (started) quadrilha.update(dt, t, camera.position);
  if (started) lendas.update(dt, t, camera.position);
  if (started) malabarista.update(dt, t);
  // hora do rush: de manhã cedo e no fim da tarde a cidade enche de carro
  { const h = day.hours, rush = (h >= 6.5 && h < 9) || h >= 16; traffic.maxCars = rush ? 70 : 55; traffic.rush = rush; }
  jangadas.update(dt, t, camera.position);
  // estações do corredor de ônibus aparecem quando a rua monta: as árvores do canteiro em cima delas saem
  if (world.busStations && world.busStations.length > (estacoesVistas || 0)) { trees.tira?.(world.busStations.slice(estacoesVistas || 0)); estacoesVistas = world.busStations.length; }
  if (started) avioes.update(dt, camera.position);
  hud.setClock(day.clock);
  updateHeadlight();
  // som das comunidades: cada batida no volume da fonte mais perto
  if (started && world.culture) {
    const vol = { brega: 0, atabaque: 0, ciranda: 0, punk: 0, capoeira: capoeira.vol(camera.position), coco: artistas.vol(camera.position), forro: Math.max(forro.vol(camera.position), quadrilha.vol(camera.position)) };
    for (const s of world.culture.sounds) {
      if (s.night && day.hours < 14) continue; // sem noite: o atabaque do terreiro toca à tarde
      const d = Math.hypot(s.x - camera.position.x, s.z - camera.position.z);
      if (d < s.R) vol[s.kind] = Math.max(vol[s.kind], s.base * (1 - d / s.R) ** 2);
    }
    if (player.dancing) vol.brega = Math.max(vol.brega, 0.35); // dançando em qualquer lugar: o brega toca no celular
    for (const k in vol) audio.loop(k, vol[k]);
  }
  bloom.strength = day.bloom;
  grade.uniforms.warm.value = 1 - day.night * 0.8;
  composer.render();
  // modo foto (K): o canvas só tem a cena (o HUD é HTML por cima), lido logo depois de desenhar
  if (fotoPedida) {
    fotoPedida = false;
    const bairro = (hud.bairroAt(player.pos.x, player.pos.z) || 'recife').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const nome = `hellcife-${bairro}-${(day.clock || '').replace(':', 'h')}.png`;
    renderer.domElement.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
    hud.flash('📸 Foto salva!');
  }
  if (!frame.manual) requestAnimationFrame(frame);
}
frame();

// para depuração no console
window.game = { lendas, quadrilha, corrida, barbearia, casamento, lixo, desafios, agenda, catamara, bicicletas, malabarista, praiaJogos, carroDeSom, passageiro, forro, mirantes, artistas, voltaPontes, pescaria, pipas, domino, capoeira, gps, album, weather, bloco, ambience, ambulantes, boletim, jogo, praia, roteiro, zap, ambulancia, blitz, pombos, sinos, feira, negocios, caranguejos, jangadas, avioes, audio, sharks, caramelos,
  player, traffic, police, missions, world, day, composer, save, shop, phone, camera, scene, renderer, keys, teleport, enterOrExit, touch, trees,
  // depuração: avança n quadros na mão (o navegador pausa o loop quando a janela fica escondida)
  tick(n = 1) { frame.manual = true; for (let i = 0; i < n; i++) frame(); frame.manual = false; },
  setCam(yaw, pitch) { camYaw = yaw; if (pitch != null) camPitch = pitch; lastMouse = performance.now(); },
};
