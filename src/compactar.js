// Compacta as malhas grandes de um grupo já montado (comunidades, marcos, rio): posição em Int16 e normal em Int8,
// com o centro e a meia-extensão da malha passados para mesh.position/scale. É a mesma ideia do Acc.geoQ do
// world.js e do rua.js. Malha longe da câmera nunca vai para a placa de vídeo, então os Float32 dela ficavam
// no JS para sempre; compactada, ocupa ~40% disso, e depois de enviada à placa a cópia do JS é solta.
//
// A malha compactada vira filha do objeto original, com position = c e scale = sc: o mundo fica M·T(c)·S(sc), exato
// para qualquer rotação, e quem anima o objeto (barco, Galo, LED) continua mexendo nele como antes. O objeto
// original fica com uma geometria vazia (não desenha nada). A normal no espaço novo é sc∘n, normalizada.
import * as THREE from 'three';

const MIN_VERTS = 300;    // malha pequena não vale a conta
const MAX_EXT = 4000;     // 4 km / 65.535 ≈ 6 cm de passo: mais que isso já aparece
function solta() { this.array = null; }
const VAZIA = new THREE.BufferGeometry(); // o objeto original não desenha mais nada (0 vértices)
VAZIA.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3)); VAZIA.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);

export function compactGroup(root) {
  if (typeof location !== 'undefined' && /semcompactar/.test(location.search)) return null; // comparação de memória
  root.updateMatrixWorld(true);
  // geometria usada por mais de uma malha (peças de gente, sombrinhas…) fica como está
  const uso = new Map();
  root.traverse((o) => { if (o.geometry) uso.set(o.geometry, (uso.get(o.geometry) || 0) + 1); });
  let antes = 0, depois = 0, n = 0; const novos = [];
  root.traverse((o) => {
    const g = o.geometry;
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !g || uso.get(g) !== 1 || g.morphAttributes?.position) return;
    const P = g.attributes.position, N = g.attributes.normal;
    if (!P || !(P.array instanceof Float32Array) || P.isInterleavedBufferAttribute || P.count < MIN_VERTS) return;
    if (N && (!(N.array instanceof Float32Array) || N.isInterleavedBufferAttribute)) return;
    const a = P.array, cnt = P.count;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < cnt * 3; i += 3) { const x = a[i], y = a[i + 1], z = a[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    if (!(x1 - x0 < MAX_EXT && y1 - y0 < MAX_EXT && z1 - z0 < MAX_EXT)) return;
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], sc = [Math.max(0.01, (x1 - x0) / 2), Math.max(0.01, (y1 - y0) / 2), Math.max(0.01, (z1 - z0) / 2)];
    antes += Object.values(g.attributes).reduce((t, at) => t + at.array.byteLength, 0) + (g.index ? g.index.array.byteLength : 0);
    const qp = new Int16Array(cnt * 3);
    for (let i = 0; i < cnt * 3; i += 3) for (let k = 0; k < 3; k++) qp[i + k] = Math.round(((a[i + k] - c[k]) / sc[k]) * 32767);
    g.setAttribute('position', new THREE.BufferAttribute(qp, 3, true));
    if (N) {
      const na = N.array, qn = new Int8Array(cnt * 3);
      for (let i = 0; i < cnt * 3; i += 3) {
        const x = na[i] * sc[0], y = na[i + 1] * sc[1], z = na[i + 2] * sc[2], l = Math.hypot(x, y, z) || 1;
        qn[i] = Math.round((x / l) * 127); qn[i + 1] = Math.round((y / l) * 127); qn[i + 2] = Math.round((z / l) * 127);
      }
      g.setAttribute('normal', new THREE.BufferAttribute(qn, 3, true));
    }
    // uv entre 0 e 1 cabe em Uint16; uv que repete (textura em ladrilho) fica em Float32
    const U = g.attributes.uv;
    if (U && U.array instanceof Float32Array && !U.isInterleavedBufferAttribute) {
      const ua = U.array; let ok = true; for (let i = 0; i < ua.length && ok; i++) if (ua[i] < 0 || ua[i] > 1) ok = false;
      if (ok) { const qu = new Uint16Array(ua.length); for (let i = 0; i < ua.length; i++) qu[i] = Math.round(ua[i] * 65535); g.setAttribute('uv', new THREE.BufferAttribute(qu, 2, true)); }
    }
    if (g.index && !(g.index.array instanceof Uint16Array) && cnt < 65536) g.setIndex(new THREE.BufferAttribute(Uint16Array.from(g.index.array), 1));
    g.boundingBox = null; g.computeBoundingSphere();
    for (const at of [...Object.values(g.attributes), g.index]) if (at) { depois += at.array.byteLength; at.onUpload(solta); }
    const filho = new THREE.Mesh(g, o.material);
    filho.position.set(c[0], c[1], c[2]); filho.scale.set(sc[0], sc[1], sc[2]);
    filho.castShadow = o.castShadow; filho.receiveShadow = o.receiveShadow; filho.renderOrder = o.renderOrder; filho.frustumCulled = o.frustumCulled;
    novos.push([o, filho]);
    n++;
  });
  // depois de percorrer (não dá pra mexer na árvore durante o traverse)
  for (const [o, filho] of novos) { o.geometry = VAZIA; o.castShadow = false; o.add(filho); }
  return { malhas: n, antesMB: +(antes / 1e6).toFixed(1), depoisMB: +(depois / 1e6).toFixed(1) };
}
