// Protagonista com corpo de verdade: esqueleto de 65 ossos, pele com relevo e animações (Quaternius, Universal Base
// Characters + Universal Animation Library, CC0, em public/personagens). O boneco de caixas (models.js) continua
// existindo, invisível: o resto do jogo mexe nas peças dele (passinho, pulo, barco, carro, colisão), e o corpo novo
// é filho dele, então herda posição, giro e visibilidade. A animação sai do estado do jogador (parado, andando,
// correndo, no pique, no ar, dançando, sentado no barco, nadando). ?bonecovelho volta ao boneco de caixas.
// A roupa (regata, bermuda e tênis) é recortada do próprio corpo pelos ossos e presa no mesmo esqueleto.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ALTURA = 1.75;
// pele: a textura do kit é um moreno médio (média ~#a87450 nos dois corpos). O tom por cima leva a luminância da
// pele à do tom escolhido (razão em linear; a cor do material passa de 1 quando é para clarear): galego claro,
// Dandara retinta. Do matiz, só 25% da diferença: razão cheia por canal subia o azul 3,7× contra 2× do vermelho e
// a pele clara ficava cinzenta; assim fica o calor natural da textura
const PELE_MEDIA = [0.392, 0.174, 0.080], LUM = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const LUM_MEDIA = LUM(...PELE_MEDIA);
const _pele = new THREE.Color();
// o boneco do jogador (o último que recebeu attach): os NPCs de perto viram a cabeça para ele (corpos.js)
let jogador = null;
export const jogadorMesh = () => jogador;

export function tintaPele(hex, alvo) {
  _pele.set(hex);
  // expoente 0,8: comprime os extremos (retinto não vira breu e perde o rosto; o claro não estoura)
  const L = (LUM(_pele.r, _pele.g, _pele.b) / LUM_MEDIA) ** 0.8, m = 0.25;
  const k = (i, v) => L * (1 + m * (v / PELE_MEDIA[i] / L - 1));
  return alvo.setRGB(k(0, _pele.r), k(1, _pele.g), k(2, _pele.b));
}
const RUPA = {
  regata: { ossos: /^(spine_0[123]|clavicle_[lr])$/, infla: 0.012 },
  bermuda: { ossos: /^(pelvis|thigh_[lr])$/, infla: 0.014 },
  tenis: { ossos: /^(foot_[lr]|ball_[lr])$/, infla: 0.01 },
};

// recorta do corpo os triângulos cujos três vértices têm como osso principal um dos ossos da peça
function peca(body, def, mat) {
  const g = body.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const bones = body.skeleton.bones, idx = g.index.array, main = new Uint8Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    let b = 0, w = -1; for (let k = 0; k < 4; k++) { const ww = sw.getComponent(v, k); if (ww > w) { w = ww; b = si.getComponent(v, k); } }
    main[v] = def.ossos.test(bones[b].name) ? 1 : 0;
  }
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) if (main[idx[t]] && main[idx[t + 1]] && main[idx[t + 2]]) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  const ng = g.clone(), p = ng.attributes.position;
  for (let v = 0; v < p.count; v++) p.setXYZ(v, p.getX(v) + nor.getX(v) * def.infla, p.getY(v) + nor.getY(v) * def.infla, p.getZ(v) + nor.getZ(v) * def.infla);
  ng.setIndex(keep);
  const m = new THREE.SkinnedMesh(ng, mat);
  m.bind(body.skeleton, body.bindMatrix);
  m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
  return m;
}
// tecido: trama fina gerada, para a roupa não ficar com cara de plástico
function tecido(cor, rep = 8) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = cor; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 2) { x.fillStyle = `rgba(0,0,0,${0.05 + 0.03 * Math.sin(i)})`; x.fillRect(0, i, 128, 1); x.fillStyle = 'rgba(255,255,255,0.04)'; x.fillRect(i, 0, 1, 128); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, side: THREE.DoubleSide });
}

// carrega e veste o corpo. cores: { regata, bermuda, tenis, cabelo }. Devolve { raiz, mixer, acoes, tri }
// corte da barbearia (barbearia.js / save.outfit.hair) → cabelo do kit. Os do kit são poucos: cacheado e black power
// ficam com o social, tranças com o coque; careca fica sem
// Corpo feminino (avatar.js). Os dois arquivos de corpo já trazem olhos e sobrancelhas
const CABELOS = {
  m: { short: 'Hair_SimpleParted.gltf', buzz: 'Hair_Buzzed.gltf', curly: 'Hair_SimpleParted.gltf', afro: 'Hair_SimpleParted.gltf', trancas: 'Hair_Buns.gltf', longo: 'Hair_SimpleParted.gltf', careca: null },
  f: { short: 'Hair_Long.gltf', curly: 'Hair_Long.gltf', afro: 'Hair_Long.gltf', longo: 'Hair_Long.gltf', trancas: 'Hair_Buns.gltf', buzz: 'Hair_BuzzedFemale.gltf', careca: null },
};
const CORPO = {
  m: { arq: 'Superhero_Male_FullBody.gltf', sobrancelha: null, altura: ALTURA },
  f: { arq: 'Superhero_Female_FullBody.gltf', sobrancelha: null, altura: 1.66 },
};
// cores: { regata, bermuda, tenis, cabelo, corte, sexo: 'm'|'f', pele: '#hex', barba: bool }
export async function carregarCorpo(cores = {}, anim = 'animacoes-jogo.glb') {
  const loader = new GLTFLoader().setPath('/personagens/');
  const load = (f) => (f ? new Promise((res, rej) => loader.load(f, res, undefined, rej)) : Promise.resolve(null));
  const sexo = cores.sexo === 'f' ? 'f' : 'm', K = CORPO[sexo], tab = CABELOS[sexo];
  const corte = cores.corte in tab ? tab[cores.corte] : sexo === 'f' ? 'Hair_Long.gltf' : 'Hair_Buzzed.gltf';
  const barbaArq = sexo === 'm' && cores.barba ? 'Hair_Beard.gltf' : null;
  const [corpo, cabelo, barba, sobrancelha, anims] = await Promise.all([K.arq, corte, barbaArq, K.sobrancelha, anim].map(load));
  const raiz = corpo.scene;
  let body = null;
  raiz.traverse((o) => { if (o.isSkinnedMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; if (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count) body = o; } });
  // cabelo, barba e sobrancelha vêm presos ao osso da cabeça de outro esqueleto: liga aos ossos do corpo pelo nome
  const porNome = {}; body.skeleton.bones.forEach((b) => (porNome[b.name] = b));
  for (const extra of [cabelo, barba, sobrancelha].filter(Boolean)) {
    const ms = []; extra.scene.traverse((o) => { if (o.isSkinnedMesh) ms.push(o); });
    for (const m of ms) {
      const sk = new THREE.Skeleton(m.skeleton.bones.map((b) => porNome[b.name] || b), m.skeleton.boneInverses);
      m.removeFromParent(); body.parent.add(m); m.bind(sk, m.bindMatrix); m.castShadow = true; m.frustumCulled = false;
      // a textura do cabelo vem cinza (o kit tinge no shader)
      for (const mt of [m.material].flat()) { mt.color?.set(cores.cabelo || '#3a2a20'); if (mt.transparent) mt.alphaTest = 0.4; }
    }
  }
  // pele no tom escolhido (igual aos NPCs em corpos.js)
  if (cores.pele) tintaPele(cores.pele, body.material.color);
  const cor = { regata: cores.regata || '#f4f1ea', bermuda: cores.bermuda || '#2f4f7a', tenis: cores.tenis || '#eeeeea' };
  for (const [nome, def] of Object.entries(RUPA)) { const r = peca(body, def, tecido(cor[nome], nome === 'tenis' ? 4 : 8)); r.name = nome; body.parent.add(r); }
  const box = new THREE.Box3().setFromObject(raiz);
  raiz.scale.setScalar(K.altura / (box.max.y - box.min.y));
  const mixer = new THREE.AnimationMixer(raiz), acoes = {};
  for (const c of anims.animations) acoes[c.name] = mixer.clipAction(c);
  let tri = 0; raiz.traverse((o) => { if (o.isMesh) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  // pose de descanso guardada para prender acessórios: matriz de cada osso e a caixa da cabeça, no espaço do pai da
  // raiz (a raiz ainda está solta na origem, então o espaço do mundo é esse)
  raiz.updateMatrixWorld(true);
  const ossoRest = {}; for (const b of body.skeleton.bones) ossoRest[b.name] = b.matrixWorld.clone();
  const cabeca = new THREE.Box3(), v = new THREE.Vector3(), si = body.geometry.attributes.skinIndex, sw = body.geometry.attributes.skinWeight;
  const iHead = body.skeleton.bones.findIndex((b) => b.name === 'Head');
  for (let i = 0; i < si.count; i++) {
    let b = 0, w = -1; for (let k = 0; k < 4; k++) { const ww = sw.getComponent(i, k); if (ww > w) { w = ww; b = si.getComponent(i, k); } }
    if (b === iHead) cabeca.expandByPoint(body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld));
  }
  return { raiz, mixer, acoes, tri, ossos: body.skeleton.bones.length, bones: Object.fromEntries(body.skeleton.bones.map((b) => [b.name, b])), ossoRest, cabeca };
}

// Boné/chapéu, óculos e sombrinha da loja: o boneco de caixas (models.js) já os desenha como filhos do tronco dele,
// depois da cabeça. Aqui cada peça é copiada (mesma geometria e cor) e presa num osso do corpo novo: chapéu e óculos
// na cabeça (com a posição e o tamanho ajustados da cabeça de caixa para a cabeça nova), a sombrinha no peito, do
// lado direito, onde o boneco a carrega. Refeito a cada troca na loja.
const _T = new THREE.Matrix4(), _S = new THREE.Matrix4(), _A = new THREE.Matrix4();
export function acessorios(C, host) {
  for (const a of C.acess || []) a.removeFromParent();
  for (const o of C.acessOrig || []) o.visible = true; // os originais (no boneco de caixas) voltam a aparecer
  C.acess = []; C.acessOrig = [];
  const u = host?.userData; if (!u?.upper || !u.head) return;
  // acessórios: o que foi pendurado no tronco depois da cabeça, e o que foi posto na própria cabeça depois do
  // rosto e do cabelo (capacete, véu, moicano: estes vão sempre para o osso da cabeça)
  const fixos = u.head.userData.fixos ?? u.head.children.length;
  const daCabeca = new Set(u.head.children.slice(fixos));
  const itens = [...u.upper.children.slice(u.upper.children.indexOf(u.head) + 1), ...daCabeca];
  if (!itens.length) return;
  // matriz da peça no espaço do tronco
  // (a cabeça de caixa entra em descanso: só a posição e a escala, sem o giro de olhar em volta daquele quadro)
  const cabecaRest = new THREE.Matrix4().compose(u.head.position, new THREE.Quaternion(), u.head.scale);
  const noTronco = (o) => { const m = new THREE.Matrix4(); let p = o; while (p && p !== u.upper) { p.updateMatrix(); m.premultiply(p === u.head ? cabecaRest : p.matrix); p = p.parent; } return m; };
  // cabeça de caixa no espaço do tronco (em descanso o tronco coincide com o boneco)
  const hb = new THREE.Box3(), tmp = new THREE.Box3();
  for (const f of u.head.children.slice(0, fixos)) f.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); o.updateMatrix(); tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrix).applyMatrix4(cabecaRest); hb.union(tmp); } });
  // alinha as duas cabeças pelo topo e pela frente do rosto (a de caixa inclui pescoço e cabelo, então o centro
  // dela fica em outro lugar), com a escala pela largura
  const bc = hb.getCenter(new THREE.Vector3()), nc = C.cabeca.getCenter(new THREE.Vector3());
  const s = (C.cabeca.max.x - C.cabeca.min.x) / Math.max(0.05, hb.max.x - hb.min.x);
  for (const o of itens) {
    o.updateMatrix();
    // altura da peça no espaço do tronco: tudo acima de 1,6 m é de cabeça (chapéu, óculos); senão, do peito (sombrinha)
    const lb = new THREE.Box3(); o.traverse((q) => { if (q.isMesh) { q.geometry.computeBoundingBox(); tmp.copy(q.geometry.boundingBox); lb.union(tmp.applyMatrix4(noTronco(q))); } });
    const naCabeca = daCabeca.has(o) || lb.min.y > 1.6; // o cabo da sombrinha começa no ombro (~1,4 m)
    const osso = naCabeca ? 'Head' : 'spine_03';
    if (!C.bones[osso]) continue;
    // T: da cabeça de caixa para a cabeça nova (no peito, só a escala da altura)
    // chapéu (peça toda acima de 1,73 m) sobe a altura de um cabelo: a cabeça de caixa mede com o cabelo, a nova não
    if (naCabeca) _T.makeTranslation(nc.x, C.cabeca.max.y + (!daCabeca.has(o) && lb.min.y > 1.73 ? 0.04 : 0), C.cabeca.max.z).multiply(_S.makeScale(s, s, s)).multiply(_A.makeTranslation(-bc.x, -hb.max.y, -hb.max.z));
    else _T.makeScale(0.95, 0.95, 0.95);
    const W = new THREE.Group();
    W.matrixAutoUpdate = false;
    W.matrix.copy(C.ossoRest[osso]).invert().multiply(_T).multiply(noTronco(o));
    const c = o.clone(); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); c.visible = true;
    c.traverse((q) => { if (q.isMesh) { q.castShadow = true; q.visible = true; } });
    W.add(c); C.bones[osso].add(W); C.acess.push(W);
    o.visible = false; C.acessOrig.push(o); // a cópia vai na cabeça/peito do corpo novo; o original some
  }
}

// controle do protagonista no jogo
export function protagonista() {
  const desligado = typeof location !== 'undefined' && /bonecovelho/.test(location.search);
  let C = null, host = null, atual = null, cores = null, carregando = null;
  const esconderCaixas = (m) => { for (const o of m.children) if (o !== C?.raiz) o.visible = false; };
  const mostrarCaixas = (m) => { for (const o of m.children) if (o !== C?.raiz) o.visible = true; };
  const tocar = (nome, ts = 1, fade = 0.2) => {
    const a = C.acoes[nome]; if (!a) return;
    a.timeScale = ts;
    if (a === atual) return;
    a.reset().fadeIn(fade).play(); atual?.fadeOut(fade); atual = a;
  };
  const api = {
    // prende o corpo no boneco (de novo a cada troca de roupa na barbearia/loja)
    attach(mesh, outfit = {}) {
      host = mesh; jogador = mesh;
      if (desligado) return;
      const novas = { regata: outfit.stripes || outfit.shirt, bermuda: outfit.pants, tenis: outfit.shoes, cabelo: outfit.hairColor, corte: outfit.hair, sexo: outfit.sexo, pele: outfit.skin, barba: !!outfit.barba };
      const mudou = JSON.stringify(novas) !== JSON.stringify(cores);
      cores = novas;
      if (C && !mudou) { mesh.add(C.raiz); esconderCaixas(mesh); acessorios(C, mesh); return; }
      const pedido = (carregando = carregarCorpo(cores).then((c) => {
        if (pedido !== carregando) return; // chegou outra troca de roupa no meio
        if (C) { C.raiz.removeFromParent(); C.mixer.stopAllAction(); }
        C = c; atual = null;
        host.add(C.raiz); esconderCaixas(host); acessorios(C, host);
        if (typeof window !== 'undefined') window.protagonista = { tri: C.tri, ossos: C.ossos, anims: Object.keys(C.acoes) };
      }).catch((e) => { console.warn('protagonista: fica o boneco de caixas', e); if (host) mostrarCaixas(host); }));
    },
    // e: { speed, air, dancing, boat, swim, driving }
    update(dt, e) {
      if (!C || !host) return;
      if (C.raiz.parent !== host) { host.add(C.raiz); esconderCaixas(host); }
      // o resto do jogo mexe na pose do boneco de caixas (ex.: sentado no barco); o corpo novo não herda isso,
      // só posição e giro, então desfaz a escala/pose estranha que a raiz possa ter herdado
      if (e.driving) tocar('Driving_Loop');
      else if (e.boat) tocar('Sitting_Idle_Loop');
      else if (e.swim) e.speed > 0.3 ? tocar('Swim_Fwd_Loop') : tocar('Swim_Idle_Loop');
      else if (e.air) tocar('Jump_Loop', 1, 0.12);
      else if (e.dancing) tocar('Dance_Loop');
      else if (e.speed < 0.3) tocar('Idle_Loop', 1, 0.25);
      else if (e.speed < 5) tocar('Walk_Loop', Math.max(0.6, e.speed / 1.6), 0.2);   // passada acompanha a velocidade
      else if (e.speed < 7) tocar('Jog_Fwd_Loop', e.speed / 4.2, 0.2);
      else tocar('Sprint_Loop', e.speed / 8, 0.2);
      C.mixer.update(dt);
    },
  };
  return api;
}
