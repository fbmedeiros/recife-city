// Corpo com esqueleto para os NPCs de perto. Cada pessoa continua sendo o boneco de caixas de models.js: os módulos
// posam as juntas dele (userData.legL, armR, upper, head…) e chamam animatePerson como sempre. Quem está a até ~35 m
// da câmera (no máximo 16 pessoas) ganha um corpo humano com esqueleto (Quaternius, CC0, public/personagens), tirado
// de um conjunto reaproveitado: as peças de caixa somem e, a cada quadro, a pose das juntas de caixa é copiada para os
// ossos (coxa, canela, braço, antebraço, tronco, cabeça). Dança, dominó, capoeira e o resto continuam valendo.
// O que os módulos penduram depois no boneco (pandeiro, véu) continua visível, preso na junta de caixa.
// A roupa é uma malha só por pessoa, com uma cor por região do corpo (tronco, braço, antebraço, quadril/coxa,
// canela, pé), ligada ou desligada conforme o visual (camisa, regata, manga, vestido, calça, bermuda, saia, chinelo).
// ?semgentereal desliga.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { acessorios, tintaPele } from './protagonista.js';
// peças penduradas no tronco e na cabeça: se o número muda (um módulo pôs chapéu, véu...), recopia os acessórios
const nPecas = (u) => (u.upper?.children.length || 0) + (u.head?.children.length || 0) * 1000;

const RAIO = 35, RAIO_SAI = 42, MAX = 16;
const DESLIGADO = typeof location !== 'undefined' && /semgentereal/.test(location.search);
const PESSOAS = new Set();
// animatePerson (models.js) avisa que a pessoa está só andando neste quadro: o corpo novo usa a animação de verdade
// (parado, andar, trote) em vez de copiar o passo do boneco. Guarda o que ele pôs nos braços: se o módulo mexer nos
// braços depois (celular, sacola), os braços continuam copiados do boneco.
export function marcarAndar(u, speed) {
  u.__andarQ = quadro; u.__vel = speed;
  u.__aL = u.armL.rotation.x; u.__aR = u.armR.rotation.x; u.__eL = u.elbowL.rotation.x; u.__eR = u.elbowR.rotation.x;
}
export function registrarPessoa(g) { if (!DESLIGADO && !g.userData.look?.player) PESSOAS.add(g); }

// regiões da roupa pelo osso principal do vértice
const REGIOES = [/^(spine_0[123]|clavicle_[lr])$/, /^upperarm_[lr]$/, /^lowerarm_[lr]$/, /^(pelvis|thigh_[lr])$/, /^calf_[lr]$/, /^(foot_[lr]|ball_[lr])$/];
const BASE = {
  m: { corpo: 'Superhero_Male_FullBody.gltf', altura: 1.74, cabelos: { curto: 'Hair_SimpleParted.gltf', raspado: 'Hair_Buzzed.gltf', barba: 'Hair_Beard.gltf' } },
  f: { corpo: 'Superhero_Female_FullBody.gltf', altura: 1.64, cabelos: { longo: 'Hair_Long.gltf', coque: 'Hair_Buns.gltf', raspado: 'Hair_BuzzedFemale.gltf' } },
};
// estilo de cabelo do boneco de caixas → cabelo do kit
const CABELO = {
  m: { short: 'curto', buzz: 'raspado', curly: 'curto', afro: 'curto', careca: null, long: 'curto', longo: 'curto', bun: 'curto', rabo: 'curto', trancas: 'curto' },
  f: { long: 'longo', longo: 'longo', bun: 'coque', rabo: 'longo', trancas: 'coque', afro: 'coque', curly: 'longo', short: 'raspado', buzz: 'raspado', careca: null },
};

const loader = new GLTFLoader().setPath('/personagens/');
const load = (f) => new Promise((res, rej) => loader.load(f, res, undefined, rej));
let modelos = null; // { m, f } quando carregados

// trama de tecido branca: a cor vem da região
let trama = null;
function texTrama() {
  if (trama) return trama;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 2) { x.fillStyle = `rgba(0,0,0,${0.06 + 0.03 * Math.sin(i)})`; x.fillRect(0, i, 64, 1); }
  trama = new THREE.CanvasTexture(c); trama.wrapS = trama.wrapT = THREE.RepeatWrapping; trama.repeat.set(10, 10); trama.colorSpace = THREE.SRGBColorSpace;
  return trama;
}
function materialRoupa() {
  const m = new THREE.MeshStandardMaterial({ map: texTrama(), roughness: 0.9, side: THREE.DoubleSide });
  m.userData.cores = { value: Array.from({ length: 6 }, () => new THREE.Vector4(1, 1, 1, 0)) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.cores = m.userData.cores;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float regiao; varying float vRegiao;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegiao = regiao;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 cores[6]; varying float vRegiao;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  { vec4 rc = cores[int(vRegiao + 0.5)]; if (rc.a < 0.5) discard; diffuseColor.rgb *= rc.rgb; }');
  };
  m.customProgramCacheKey = () => 'roupa-regioes';
  return m;
}

// monta o modelo de um sexo: corpo, cabelos (presos nos ossos do corpo), roupa por região e a pose de referência
async function montarModelo(k, anims) {
  const B = BASE[k];
  const nomes = Object.entries(B.cabelos);
  const [base, ...extras] = await Promise.all([B.corpo, ...nomes.map(([, f]) => f)].map(load));
  const raiz = base.scene;
  let body = null;
  raiz.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.receiveShadow = true; o.castShadow = false; if (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count) body = o; } });
  // sombra só do corpo: roupa, cabelo, olhos e sobrancelhas ficam dentro do contorno dele e só dobravam o custo
  body.castShadow = true;
  const porNome = {}; body.skeleton.bones.forEach((b) => (porNome[b.name] = b));
  // cabelos
  nomes.forEach(([nome], i) => {
    const ms = []; extras[i].scene.traverse((o) => { if (o.isSkinnedMesh) ms.push(o); }); // junta antes: tirar da cena no meio da varredura quebra a varredura
    ms.forEach((m) => {
      const sk = new THREE.Skeleton(m.skeleton.bones.map((b) => porNome[b.name] || b), m.skeleton.boneInverses);
      m.removeFromParent(); body.parent.add(m); m.bind(sk, m.bindMatrix); m.frustumCulled = false; m.castShadow = false; m.name = 'cabelo:' + nome; m.visible = false;
      for (const mt of [m.material].flat()) if (mt.transparent) mt.alphaTest = 0.4;
    });
  });
  // roupa: triângulos do corpo com a região do osso principal (malha sem índice, região constante no triângulo)
  const g = body.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = body.skeleton.bones;
  const regV = new Int8Array(si.count);
  for (let v = 0; v < si.count; v++) {
    let b = 0, w = -1; for (let q = 0; q < 4; q++) { const ww = sw.getComponent(v, q); if (ww > w) { w = ww; b = si.getComponent(v, q); } }
    regV[v] = REGIOES.findIndex((re) => re.test(bones[b].name));
  }
  const idx = g.index.array, keep = [], regT = [], regCorpo = new Int8Array(idx.length / 3).fill(-1);
  for (let t = 0; t < idx.length; t += 3) {
    const r = [regV[idx[t]], regV[idx[t + 1]], regV[idx[t + 2]]].filter((x) => x >= 0);
    if (r.length >= 2) { keep.push(t / 3); regT.push(r.sort((a, b) => a - b)[r.length >> 1]); regCorpo[t / 3] = regT.at(-1); }
  }
  const ni = g.toNonIndexed(), out = new THREE.BufferGeometry();
  for (const [nome, at] of Object.entries(ni.attributes)) {
    const n = at.itemSize, arr = new at.array.constructor(keep.length * 3 * n);
    keep.forEach((t, j) => arr.set(at.array.subarray(t * 3 * n, t * 3 * n + 3 * n), j * 3 * n));
    out.setAttribute(nome, new THREE.BufferAttribute(arr, n, at.normalized));
  }
  const reg = new Float32Array(keep.length * 3); regT.forEach((r, j) => reg.fill(r, j * 3, j * 3 + 3));
  out.setAttribute('regiao', new THREE.BufferAttribute(reg, 1));
  const p = out.attributes.position, nr = out.attributes.normal;
  for (let v = 0; v < p.count; v++) { const d = reg[v] === 5 ? 0.01 : 0.013; p.setXYZ(v, p.getX(v) + nr.getX(v) * d, p.getY(v) + nr.getY(v) * d, p.getZ(v) + nr.getZ(v) * d); }
  const roupa = new THREE.SkinnedMesh(out, materialRoupa()); roupa.name = 'roupa';
  roupa.bind(body.skeleton, body.bindMatrix); roupa.frustumCulled = false; roupa.castShadow = false; roupa.receiveShadow = true;
  body.parent.add(roupa);
  body.name = 'corpo';
  // altura
  const box = new THREE.Box3().setFromObject(raiz);
  raiz.scale.setScalar(B.altura / (box.max.y - box.min.y));
  raiz.updateMatrixWorld(true);
  // descanso (bind) para os acessórios, e cabeça
  const ossoRest = {}; for (const b of bones) ossoRest[b.name] = b.matrixWorld.clone();
  const cabeca = new THREE.Box3(), v3 = new THREE.Vector3(), iHead = bones.findIndex((b) => b.name === 'Head');
  for (let i = 0; i < si.count; i++) {
    let b = 0, w = -1; for (let q = 0; q < 4; q++) { const ww = sw.getComponent(i, q); if (ww > w) { w = ww; b = si.getComponent(i, q); } }
    if (b === iHead) cabeca.expandByPoint(body.getVertexPosition(i, v3).applyMatrix4(body.matrixWorld));
  }
  // saia/vestido: tronco de cone da cintura até o joelho, abrindo embaixo, todo preso ao osso do quadril (a perna
  // anda por dentro). Medido no corpo em descanso: cintura = topo dos vértices do quadril, joelho = topo da canela
  {
    const iPel = bones.findIndex((b) => b.name === 'pelvis'), dom = (i) => { let b = 0, w = -1; for (let q = 0; q < 4; q++) { const ww = sw.getComponent(i, q); if (ww > w) { w = ww; b = si.getComponent(i, q); } } return b; };
    const quad = new THREE.Box3(), coxa = new THREE.Box3(); let joelho = -Infinity;
    for (let i = 0; i < si.count; i++) {
      const b = dom(i), n = bones[b].name;
      if (b === iPel) quad.expandByPoint(body.getVertexPosition(i, v3).applyMatrix4(body.matrixWorld));
      else if (/^thigh_/.test(n)) coxa.expandByPoint(body.getVertexPosition(i, v3).applyMatrix4(body.matrixWorld));
      else if (/^calf_/.test(n)) joelho = Math.max(joelho, body.getVertexPosition(i, v3).applyMatrix4(body.matrixWorld).y);
    }
    const topo = quad.max.y - 0.02, base = joelho + 0.03, h = topo - base;
    const cx = (quad.min.x + quad.max.x) / 2, cz = (quad.min.z + quad.max.z) / 2;
    const rx = (Math.max(quad.max.x, coxa.max.x) - Math.min(quad.min.x, coxa.min.x)) / 2 + 0.025, rz = (quad.max.z - quad.min.z) / 2 + 0.06;
    const cil = new THREE.CylinderGeometry(1, 1.7, h, 24, 3, true).toNonIndexed(); // abre bastante embaixo: a coxa anda e dança por dentro
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(), P = cil.attributes.position, N = cil.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      v3.set(P.getX(i) * rx + cx, P.getY(i) + base + h / 2, P.getZ(i) * rz + cz).applyMatrix4(inv); P.setXYZ(i, v3.x, v3.y, v3.z);
      v3.set(N.getX(i), N.getY(i), N.getZ(i)).transformDirection(inv); N.setXYZ(i, v3.x, v3.y, v3.z);
    }
    const n = P.count, sIdx = new Uint16Array(n * 4), sWt = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { sIdx[i * 4] = iPel; sWt[i * 4] = 1; }
    cil.setAttribute('skinIndex', new THREE.BufferAttribute(sIdx, 4)); cil.setAttribute('skinWeight', new THREE.BufferAttribute(sWt, 4));
    const saia = new THREE.SkinnedMesh(cil, new THREE.MeshStandardMaterial({ map: texTrama(), roughness: 0.9, side: THREE.DoubleSide }));
    saia.name = 'saia'; saia.bind(body.skeleton, body.bindMatrix); saia.frustumCulled = false; saia.castShadow = saia.receiveShadow = true; saia.visible = false;
    body.parent.add(saia);
  }
  // pose de referência = primeiro quadro de "parado" (braço caído, perna reta), que corresponde ao boneco em descanso
  const mixer = new THREE.AnimationMixer(raiz), idle = anims.animations.find((a) => a.name === 'Idle_Loop');
  if (idle) { mixer.clipAction(idle).play(); mixer.update(0); }
  raiz.updateMatrixWorld(true);
  const refLocal = {}, refWorld = {}, q = new THREE.Quaternion();
  for (const b of bones) { refLocal[b.name] = b.quaternion.clone(); refWorld[b.name] = b.getWorldQuaternion(q).clone(); }
  mixer.stopAllAction();
  // lado: a junta "L" do boneco de caixas fica em x < 0; usa o osso que está desse lado
  const x = (n) => new THREE.Vector3().setFromMatrixPosition(porNome[n].matrixWorld).x;
  const ladoL = x('thigh_l') < 0 ? 'l' : 'r', ladoR = ladoL === 'l' ? 'r' : 'l';
  const MAPA = [
    ['spine_01', ['upper']], ['Head', ['upper', 'head']],
    ['thigh_' + ladoL, ['legL']], ['calf_' + ladoL, ['legL', 'kneeL']], ['thigh_' + ladoR, ['legR']], ['calf_' + ladoR, ['legR', 'kneeR']],
    ['upperarm_' + ladoL, ['upper', 'armL']], ['lowerarm_' + ladoL, ['upper', 'armL', 'elbowL']],
    ['upperarm_' + ladoR, ['upper', 'armR']], ['lowerarm_' + ladoR, ['upper', 'armR', 'elbowR']],
  ];
  return { k, raiz, refLocal, refWorld, ossoRest, cabeca, MAPA, escala: raiz.scale.x,
    corte: { idxCorpo: idx.slice(), regCorpo, regRoupa: Int8Array.from(regT), nV: si.count, cache: new Map() } };
}

function carregarModelos() {
  if (carregar.p) return carregar.p;
  carregar.p = load('animacoes-jogo.glb').then((anims) => Promise.all([montarModelo('m', anims), montarModelo('f', anims)]).then(([m, f]) => { modelos = { m, f, clips: Object.fromEntries(anims.animations.map((a) => [a.name, a])) }; }))
    .catch((e) => { console.warn('corpos: NPCs continuam de caixas', e); modelos = false; });
  return carregar.p;
}
function carregar() {}

// um corpo do conjunto (clone do modelo, com materiais próprios para cor de pele, cabelo e roupa)
// geometria própria (para trocar o índice) com os mesmos atributos do modelo: nada de vértice duplicado na memória
function partilha(src) {
  const g = new THREE.BufferGeometry();
  for (const [n, a] of Object.entries(src.attributes)) g.setAttribute(n, a);
  if (src.index) g.setIndex(src.index);
  g.boundingBox = src.boundingBox; g.boundingSphere = src.boundingSphere;
  return g;
}
// pele coberta não é desenhada: para cada combinação de regiões vestidas (bit 0 tronco ... 5 pé), o corpo fica só
// com o que aparece mais uma fileira de triângulos por baixo da borda da roupa (a roupa é inflada 1 cm e, sem essa
// folga, a costura mostraria o vão), e a roupa só com as regiões vestidas. Índices guardados por combinação
function cortes(M, mask) {
  const K = M.corte;
  let c = K.cache.get(mask); if (c) return c;
  const { idxCorpo, regCorpo, regRoupa, nV } = K, nT = regCorpo.length;
  const coberto = (r) => r >= 0 && (mask >> r) & 1;
  const aberto = new Uint8Array(nV); // vértice que encosta em algum triângulo à mostra
  for (let t = 0; t < nT; t++) if (!coberto(regCorpo[t])) { aberto[idxCorpo[t * 3]] = 1; aberto[idxCorpo[t * 3 + 1]] = 1; aberto[idxCorpo[t * 3 + 2]] = 1; }
  const corpo = [];
  for (let t = 0; t < nT; t++) { const a = idxCorpo[t * 3], b = idxCorpo[t * 3 + 1], d = idxCorpo[t * 3 + 2]; if (!coberto(regCorpo[t]) || aberto[a] || aberto[b] || aberto[d]) corpo.push(a, b, d); }
  const roupa = [];
  for (let t = 0; t < regRoupa.length; t++) if (coberto(regRoupa[t])) roupa.push(t * 3, t * 3 + 1, t * 3 + 2);
  const Arr = nV > 65535 ? Uint32Array : Uint16Array;
  c = { corpo: new THREE.BufferAttribute(Arr.from(corpo), 1), roupa: new THREE.BufferAttribute((regRoupa.length * 3 > 65535 ? Uint32Array : Uint16Array).from(roupa), 1) };
  K.cache.set(mask, c);
  return c;
}

function novoCorpo(M) {
  const raiz = cloneSkel(M.raiz);
  const I = { k: M.k, M, raiz, bones: {}, cabelos: {}, dono: null, acess: [] };
  raiz.traverse((o) => {
    if (o.isBone) I.bones[o.name] = o;
    if (!o.isSkinnedMesh) return;
    o.frustumCulled = false;
    if (o.name === 'corpo') { o.material = o.material.clone(); o.geometry = partilha(o.geometry); I.corpo = o; }
    else if (o.name === 'roupa') { const m = materialRoupa(); o.material = m; o.geometry = partilha(o.geometry); I.roupa = m; I.roupaM = o; }
    else if (o.name === 'saia') { o.material = o.material.clone(); I.saia = o; }
    else if (o.name.startsWith('cabelo:')) { o.material = [o.material].flat().map((x) => x.clone()); if (o.material.length === 1) o.material = o.material[0]; I.cabelos[o.name.slice(7)] = o; }
  });
  I.ossoRest = M.ossoRest; I.cabeca = M.cabeca;
  I.mixer = new THREE.AnimationMixer(raiz); I.acoes = {};
  for (const n of ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop']) if (modelos.clips[n]) { const a = I.mixer.clipAction(modelos.clips[n]); a.play(); a.setEffectiveWeight(0); a.time = Math.random() * a.getClip().duration; I.acoes[n] = a; }
  return I;
}

const _c = new THREE.Color();
function vestir(I, look, g) {
  // pele no tom do boneco (tintaPele, protagonista.js: razão entre o tom e a média da textura)
  tintaPele(look.pele, I.corpo.material.color);
  // roupa por região: 0 tronco, 1 braço, 2 antebraço, 3 quadril/coxa, 4 canela, 5 pé
  const C = I.roupa.userData.cores.value, set = (i, cor) => { if (cor) { _c.set(cor); C[i].set(_c.r, _c.g, _c.b, 1); } else C[i].w = 0; };
  const top = look.top, bot = look.bottom;
  set(0, look.camisa);
  set(1, top === 'regata' || top === 'vestido' ? null : look.camisa);
  set(2, look.longSleeve || top === 'manga' ? look.camisa : null);
  // vestido e saia: a saia de verdade (cone da cintura ao joelho) e a coxa de fora por baixo
  const saia = bot === 'vestido' ? look.camisa : bot === 'saia' ? look.saia : null;
  if (I.saia) { I.saia.visible = !!saia; if (saia) I.saia.material.color.set(saia); }
  set(3, saia ? null : look.calca);
  set(4, bot === 'calca' ? look.calca : null);
  set(5, look.sapato);
  let mask = 0; for (let i = 0; i < 6; i++) if (C[i].w > 0) mask |= 1 << i;
  const ct = cortes(I.M, mask);
  I.corpo.geometry.setIndex(ct.corpo); I.roupaM.geometry.setIndex(ct.roupa); I.roupaM.visible = mask !== 0;
  // porte: o corpo do kit é de "super-herói"; cada pessoa sorteia magro, médio ou forte (braço e coxa mais finos,
  // tronco um pouco mais estreito). Idoso fica médio
  const h = ((g.id * 2654435761) >>> 0) % 100, fem = I.k === 'f';
  I.porte = look.tipo === 'idoso' ? 0.88 : h < (fem ? 50 : 40) ? 0.8 : h < (fem ? 90 : 80) ? 0.88 : 1;
  const e = I.M.escala, t = 0.86 + 0.14 * I.porte;
  I.raiz.scale.set(e * t, e, e * t);
  // cabelo
  const estilo = CABELO[I.k][look.cabelo] ?? null;
  for (const [nome, m] of Object.entries(I.cabelos)) {
    const on = nome === estilo || (nome === 'barba' && !look.fem && look.tipo !== 'mulher' && ((g.id * 7919) % 100) < 22);
    m.visible = on;
    if (on) for (const mt of [m.material].flat()) mt.color.set(look.corCabelo || '#1b1209');
  }
}

const ativos = new Map(); // pessoa → corpo
const livres = { m: [], f: [] };
let criados = 0;
const visivel = (o) => { for (; o; o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; };

function soltar(g) {
  const I = ativos.get(g); if (!I) return;
  ativos.delete(g);
  for (const a of I.acess) a.removeFromParent(); I.acess = [];
  for (const o of I.acessOrig || []) o.visible = true; I.acessOrig = [];
  I.raiz.removeFromParent(); I.dono = null;
  for (const m of g.userData.caixas || []) m.visible = true;
  for (const m of g.userData.acessorios || []) m.visible = true;
  livres[I.k].push(I);
}
function prender(g) {
  const look = g.userData.look, k = look.fem ? 'f' : 'm';
  let I = livres[k].pop();
  if (!I) { if (criados >= MAX + 4) return false; I = novoCorpo(modelos[k]); criados++; }
  vestir(I, look, g);
  g.add(I.raiz); I.dono = g; I.raiz.visible = true;
  for (const m of g.userData.caixas || []) m.visible = false;
  acessorios(I, g); I.nUpper = nPecas(g.userData);
  for (const m of g.userData.acessorios || []) m.visible = false;
  ativos.set(g, I);
  return true;
}

// copia a pose das juntas de caixa para os ossos
const _gq = new THREE.Quaternion(), _d = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _w = new THREE.Quaternion();
// braço e coxa mais finos na espessura (o osso cresce em y); mão e pé voltam ao tamanho
const MEMBROS = ['upperarm_l', 'upperarm_r', 'thigh_l', 'thigh_r'], PONTAS = ['hand_l', 'hand_r', 'foot_l', 'foot_r'];
function aplicarPorte(I) {
  const k = I.porte || 1;
  for (const n of MEMBROS) I.bones[n]?.scale.set(k, 1, k);
  for (const n of PONTAS) I.bones[n]?.scale.set(1 / k, 1, 1 / k);
}
function posar(g, I, dt) {
  const u = g.userData, M = I.M;
  // o módulo pendurou ou tirou alguma peça do tronco (chapéu de palha, sombrinha): refaz as cópias nos ossos
  if (u.upper && nPecas(u) !== I.nUpper) { acessorios(I, g); I.nUpper = nPecas(u); }
  const andando = u.__andarQ === quadro - 1 && !u.seated && I.mixer;
  g.getWorldQuaternion(_gq);
  let mapa = M.MAPA;
  if (andando) {
    // animação de verdade: parado, andar ou trote pela velocidade, com troca suave
    const v = u.__vel || 0, alvo = v < 0.3 ? 'Idle_Loop' : v < 4.8 ? 'Walk_Loop' : 'Jog_Fwd_Loop';
    for (const [n, a] of Object.entries(I.acoes)) {
      const w = a.getEffectiveWeight(), t = n === alvo ? 1 : 0;
      a.setEffectiveWeight(w + (t - w) * Math.min(1, dt * 8));
      a.timeScale = n === 'Walk_Loop' ? Math.min(1.7, Math.max(0.5, v / 1.4)) : n === 'Jog_Fwd_Loop' ? Math.min(1.8, Math.max(0.7, v / 4.2)) : 1;
    }
    I.mixer.update(dt);
    aplicarPorte(I);
    I.raiz.updateMatrixWorld(true);
    // braços mexidos pelo módulo depois do passo: continuam copiados do boneco
    const mexL = Math.abs(u.armL.rotation.x - u.__aL) > 1e-3 || Math.abs(u.elbowL.rotation.x - u.__eL) > 1e-3 || Math.abs(u.armL.rotation.z + 0.07) > 0.03 || u.armL.rotation.y !== 0;
    const mexR = Math.abs(u.armR.rotation.x - u.__aR) > 1e-3 || Math.abs(u.elbowR.rotation.x - u.__eR) > 1e-3 || Math.abs(u.armR.rotation.z - 0.07) > 0.03 || u.armR.rotation.y !== 0;
    mapa = M.MAPA.filter(([, c]) => (mexL && c.includes('armL')) || (mexR && c.includes('armR')));
    I.andando = true;
  } else {
    if (I.andando) { for (const a of Object.values(I.acoes)) a.setEffectiveWeight(0); I.andando = false; }
    for (const [n, b] of Object.entries(I.bones)) { const r = M.refLocal[n]; if (r) b.quaternion.copy(r); }
    aplicarPorte(I);
    I.raiz.updateMatrixWorld(true);
  }
  for (const [osso, cadeia] of mapa) {
    const b = I.bones[osso]; if (!b) continue;
    _d.identity(); for (const j of cadeia) if (u[j]) _d.multiply(u[j].quaternion);
    _w.copy(_gq).multiply(_d).multiply(M.refWorld[osso]);
    b.parent.getWorldQuaternion(_pq);
    b.quaternion.copy(_pq.invert().multiply(_w));
    b.updateMatrixWorld(true);
  }
}

const _p = new THREE.Vector3();
let quadro = 0;
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _esf = new THREE.Sphere(new THREE.Vector3(), 2.5);
export function atualizarGente(camera) {
  if (DESLIGADO || modelos === false) return;
  if (!modelos) { carregarModelos(); return; }
  quadro++;
  const agora = performance.now(), t0 = agora, dt = Math.min(0.1, (agora - (atualizarGente.t || agora)) / 1000); atualizarGente.t = agora;
  // candidatos: visíveis e perto da câmera
  const perto = [];
  for (const g of PESSOAS) {
    if (!g.parent) { if (!ativos.has(g)) { g.userData.__orfao = (g.userData.__orfao || 0) + 1; if (g.userData.__orfao > 600) PESSOAS.delete(g); } continue; }
    g.userData.__orfao = 0;
    if (g.userData.semCorpo) continue; // quem pede pra ficar como está (ex.: a Emparedada, translúcida, em lendas.js)
    const e = g.matrixWorld.elements, d = Math.hypot(e[12] - camera.position.x, e[13] - camera.position.y, e[14] - camera.position.z);
    const lim = ativos.has(g) ? RAIO_SAI : RAIO;
    if (d < lim && visivel(g)) { perto.push([d, g]); g.userData.__dCam = d; }
  }
  perto.sort((a, b) => a[0] - b[0]);
  const quer = new Set(perto.slice(0, MAX).map((x) => x[1]));
  for (const g of [...ativos.keys()]) if (!quer.has(g)) soltar(g);
  let novos = 0;
  for (const g of quer) if (!ativos.has(g) && novos < 2) { if (prender(g)) novos++; }
  for (const [g, I] of ativos) posar(g, I, dt);
  // as malhas com esqueleto não sabem se recortar pela câmera (frustumCulled desligado, a caixa delas não segue os
  // ossos): o corpo todo some quando a esfera da pessoa (folgada, para a sombra que cai na tela) está fora da vista;
  // de longe (mais de 20 m) a sombra é só um borrão e o corpo deixa de projetar
  _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (const [g, I] of ativos) {
    const e = g.matrixWorld.elements; _esf.center.set(e[12], e[13] + 0.9, e[14]);
    I.raiz.visible = _fr.intersectsSphere(_esf);
    I.corpo.castShadow = I.roupaM.castShadow = (g.userData.__dCam ?? 0) < 20; // a roupa tapa o buraco do corpo na sombra
  }
  atualizarGente.ms = (atualizarGente.ms || 0) * 0.95 + (performance.now() - t0) * 0.05; // custo médio por quadro (CPU)
  if (typeof window !== 'undefined' && quadro % 30 === 0 && window.__corposDebug) window.__corposDebug = [...ativos].map(([g, I]) => ({ cam: g.userData.look.camisa, porte: I.porte, hatY: I.acess[0] ? new THREE.Box3().setFromObject(I.acess[0]).getCenter(new THREE.Vector3()).toArray().map((v) => Math.round(v * 100) / 100) : null, headP: new THREE.Vector3().setFromMatrixPosition(I.bones.Head.matrixWorld).toArray().map((v) => Math.round(v * 100) / 100), headY: Math.round(new THREE.Vector3().setFromMatrixPosition(I.bones.Head.matrixWorld).y * 100) / 100, hatVis: I.acess[0] ? (() => { let v = true; I.acess[0].traverseAncestors((a) => { if (!a.visible) v = false; }); return v; })() : null, nUp: g.userData.upper?.children.length, acess: I.acess.length, orig: (I.acessOrig || []).map((o) => o.visible), look: g.userData.look, cores: I.roupa.userData.cores.value.map((v) => v.toArray().map((x) => Math.round(x * 100) / 100)) }));
  if (typeof window !== 'undefined' && quadro % 30 === 0) window.genteReal = { ms: Math.round(atualizarGente.ms * 100) / 100, ativos: ativos.size, andando: [...ativos.values()].filter((I) => I.andando).length, criados, pessoas: PESSOAS.size, onde: [...ativos].sort((a, b) => b[1].andando - a[1].andando).slice(0, 4).map(([g, I]) => [g.matrixWorld.elements[12], g.matrixWorld.elements[13], g.matrixWorld.elements[14], (g.userData.look.fem ? 'f' : 'm') + (I.andando ? ':anda' : '')].map((v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v))) };
}
