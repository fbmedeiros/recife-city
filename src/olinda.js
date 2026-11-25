// Vizinhos no horizonte: Olinda (e o começo de Paulista) ao norte, Piedade e Candeias (Jaboatão) ao sul. O mapa do
// jogo é só o município do Recife: depois do limite era tudo mar, então da Zona Norte e do Recife Antigo não se via a
// colina de Olinda, e a praia de Boa Viagem acabava no mar em vez de seguir pelas torres de Piedade. Aqui entra um
// cenário de longe (ninguém anda lá): terra além do limite até a orla (costa pelas coordenadas reais), relevo, casario
// e torres instanciados e os marcos que se veem de longe. Tudo determinístico (hash da posição), sem sombra, com
// neblina de paisagem (mais longa que a da cidade) e em poucas malhas por região.
import * as THREE from 'three';

const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
const COLORIDO = ['#f2c14e', '#e76f51', '#4f86c6', '#f4a6c6', '#8ac926', '#f7f3ea', '#c1121f', '#2a9d8f', '#ffd6a5', '#9b5de5'];
const PLAIN = ['#e8e2d6', '#d9d2c3', '#f1ede4', '#cfc7b6', '#e3d5b8', '#bfc7c9'];

// neblina de paisagem: a cidade usa neblina até 1,25 km, e com ela a colina de Olinda sumia antes de aparecer. Os
// vizinhos são vistos do Recife a 2–6 km, então aqui a neblina começa e termina ~3x mais longe (mais que isso, o casario de longe ficava mais nítido que o Recife de perto)
function longe(m) {
  if (m.userData.longe) return; m.userData.longe = true;
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
  float fogFactor = smoothstep( fogNear * 3.0, fogFar * 3.2, vFogDepth );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * 0.96 );
#endif`); };
  m.customProgramCacheKey = () => 'olinda-longe';
}

// R: { nome, box: [X0, X1, Z0, Z1], coast: [[lat, lon], …] (em ordem de z), hills: [[x, z, H, raio]],
//      torre(x, z, dc, r) → [largura, fundo, altura] | null, colorido(x, z) → bool, marcos(ctx) }
function entorno(meta, isOut, R, ocupado = () => false) {
  const P = (lat, lon) => [(lon - meta.lon0) * meta.mLon, -(lat - meta.lat0) * meta.mLat];
  const COAST = R.coast.map(([a, b]) => P(a, b));
  const coastX = (z) => {
    for (let i = 0; i < COAST.length - 1; i++) {
      const a = COAST[i], b = COAST[i + 1];
      if ((z - a[1]) * (z - b[1]) <= 0) return a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1] || 1);
    }
    const near = Math.abs(z - COAST[0][1]) < Math.abs(z - COAST.at(-1)[1]) ? COAST[0] : COAST.at(-1);
    return near[0];
  };
  const hills = (R.hills || []).map(([la, lo, H, r]) => [...P(la, lo), H, r]);
  const hAt = (x, z) => {
    let h = 0;
    for (const [hx, hz, H, r] of hills) { const d = Math.hypot(x - hx, z - hz) / r; if (d < 1.6) h = Math.max(h, H * Math.exp(-d * d * 1.6)); }
    return h * (0.85 + 0.3 * hash(Math.floor(x / 90), Math.floor(z / 90)));
  };
  const [X0, X1, Z0, Z1] = R.box, S = 25;
  const nx = Math.round((X1 - X0) / S) + 1, nz = Math.round((Z1 - Z0) / S) + 1;
  const land = new Uint8Array(nx * nz), H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X0 + i * S, z = Z0 + j * S, k = j * nx + i;
    if (x < coastX(z) + 10 && isOut(x, z)) { land[k] = 1; H[k] = hAt(x, z); }
  }
  // chão: grade com cor por vértice (areia na beira, verde nos morros, cinza-quente da cidade no plano)
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), idx = [];
  const C = new THREE.Color(), SAND = new THREE.Color('#e2d2a6'), CITY = new THREE.Color('#b3ada1'), GREEN = new THREE.Color('#5f7d48'), DRY = new THREE.Color('#8e9a6c');
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X0 + i * S, z = Z0 + j * S, k = j * nx + i, h = H[k], dc = coastX(z) - x, n = hash(i * 0.37, j * 0.71);
    // um pouco abaixo do chão do Recife (onde os dois se cruzam, o do Recife fica por cima); do lado do mar a borda
    // afunda, e a água corta a areia numa linha lisa em vez dos degraus da grade de 25 m
    pos[k * 3] = x; pos[k * 3 + 1] = dc < -8 ? -1.6 : h - 0.06; pos[k * 3 + 2] = z;
    if (dc < 55) C.copy(SAND); else if (h > 7) C.copy(GREEN).lerp(DRY, n * 0.5); else C.copy(CITY).lerp(DRY, n * 0.25);
    col[k * 3] = C.r; col[k * 3 + 1] = C.g; col[k * 3 + 2] = C.b;
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (land[a] | land[b] | land[c] | land[d]) idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const group = new THREE.Group(); group.name = R.nome;
  group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
  const landAt = (x, z) => { const i = Math.round((x - X0) / S), j = Math.round((z - Z0) / S); return i >= 0 && j >= 0 && i < nx && j < nz && land[j * nx + i] === 1; };
  const hgt = (x, z) => { const i = Math.round((x - X0) / S), j = Math.round((z - Z0) / S); return i >= 0 && j >= 0 && i < nx && j < nz ? H[j * nx + i] : 0; };

  // casario, torres e árvores
  const houses = [], towers = [], trees = [];
  for (let z = Z0 + 10; z < Z1; z += 20) for (let x = X0 + 10; x < X1; x += 20) {
    const r = hash(x * 0.013, z * 0.017), jx = x + (hash(x, z + 1) - 0.5) * 8, jz = z + (hash(x + 1, z) - 0.5) * 8;
    if (!landAt(jx, jz)) continue;
    const dc = coastX(jz) - jx; if (dc < 70 || ocupado(jx, jz)) continue;
    const h = hgt(jx, jz), yaw = (hash(jx, jz) - 0.5) * 0.3;
    const t = R.torre(jx, jz, dc, r);
    if (t) { towers.push([jx, h, jz, ...t, yaw]); continue; }
    if (h > 10 && r > 0.55) { trees.push([jx, h, jz, 5 + r * 5]); continue; } // morro arborizado
    const centro = R.colorido(jx, jz);
    if (r < (centro ? 0.78 : R.dens ?? 0.34)) {
      const w = centro ? 6 + r * 4 : 7 + r * 6, d = centro ? 9 + r * 6 : 8 + r * 7, hh = centro ? 5 + hash(jz, x) * 3.5 : 3.5 + hash(jz, x) * 6;
      const pal = centro ? COLORIDO : PLAIN;
      houses.push([jx, h, jz, w, d, hh, yaw, pal[Math.floor(hash(jx * 3, jz) * pal.length)]]);
    }
  }
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  const inst = (geo, mat, list, f) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); im.count = list.length;
    list.forEach((it, i) => { f(it, V, Sc, E); im.setMatrixAt(i, M.compose(V, q.setFromEuler(E), Sc)); });
    return im;
  };
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  if (houses.length) {
    const hm = inst(box, new THREE.MeshStandardMaterial({ roughness: 0.85 }), houses, ([x, y, z, w, d, h, yaw], v, s, e) => { v.set(x, y - 0.5, z); s.set(w, h + 0.5, d); e.set(0, yaw, 0); });
    houses.forEach((it, i) => hm.setColorAt(i, C.set(it[7])));
    group.add(hm);
    // telhado de barro de duas águas
    const roofGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1).rotateZ(Math.PI / 2).translate(0, 0.25, 0);
    group.add(inst(roofGeo, new THREE.MeshStandardMaterial({ color: '#b5532f', roughness: 0.8 }), houses, ([x, y, z, w, d, h, yaw], v, s, e) => { v.set(x, y + h, z); s.set(w * 1.08, 2.2, d * 1.2); e.set(0, yaw + Math.PI / 2, 0); }));
  }
  if (towers.length) {
    // torres brancas da orla, com a faixa escura das janelas e varandas
    group.add(inst(box, new THREE.MeshStandardMaterial({ color: '#f1eee6', roughness: 0.7 }), towers, ([x, y, z, w, d, h, yaw], v, s, e) => { v.set(x, y, z); s.set(w, h, d); e.set(0, yaw, 0); }));
    const bandGeo = new THREE.BoxGeometry(1.01, 1, 1.01).translate(0, 0.5, 0);
    group.add(inst(bandGeo, new THREE.MeshStandardMaterial({ color: '#53606a', roughness: 0.4, metalness: 0.3 }), towers, ([x, y, z, w, d, h, yaw], v, s, e) => { v.set(x, y + 4, z); s.set(w, h - 6, d * 0.55); e.set(0, yaw, 0); }));
  }
  if (trees.length) {
    const crown = new THREE.IcosahedronGeometry(1, 0).translate(0, 1.4, 0);
    const tm = inst(crown, new THREE.MeshStandardMaterial({ color: '#3f6a34', roughness: 0.9, flatShading: true }), trees, ([x, y, z, r], v, s, e) => { v.set(x, y, z); s.set(r, r * 0.85, r); e.set(0, hash(x, z) * 3, 0); });
    trees.forEach((t, i) => tm.setColorAt(i, C.set('#3f6a34').offsetHSL(0, 0, (hash(t[0], t[2]) - 0.5) * 0.12)));
    group.add(tm);
  }

  // marcos de longe: igrejas brancas de telha (nave, frontão, torres com coruchéu) e o que cada região tiver
  const mats = {
    white: new THREE.MeshStandardMaterial({ color: '#f5f2ea', roughness: 0.7 }), tile: new THREE.MeshStandardMaterial({ color: '#b04a2a', roughness: 0.8 }),
    stone: new THREE.MeshStandardMaterial({ color: '#c9c3b5', roughness: 0.85 }), dark: new THREE.MeshStandardMaterial({ color: '#2d2f33', roughness: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: '#c1121f', roughness: 0.6 }),
  };
  const add = (geo, m, x, y, z, yaw = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = yaw; group.add(o); return o; };
  const church = (lat, lon, L, W, T, yaw, towersN = 2) => {
    const [x, z] = P(lat, lon), y = hgt(x, z) - 0.3, ux = Math.sin(yaw), uz = Math.cos(yaw);
    add(new THREE.BoxGeometry(W, 11, L).translate(0, 5.5, 0), mats.white, x, y, z, yaw);
    add(new THREE.CylinderGeometry(W * 0.62, W * 0.62, L, 3, 1).rotateX(Math.PI / 2).translate(0, 11, 0), mats.tile, x, y, z, yaw).scale.set(1, 0.45, 1);
    const fx = x + ux * L / 2, fz = z + uz * L / 2; // frontão na frente (+z local)
    add(new THREE.BoxGeometry(W * 0.7, 4, 0.8).translate(0, 13, 0), mats.white, fx, y, fz, yaw);
    for (let t = 0; t < towersN; t++) {
      const o = towersN === 1 ? 0 : (t ? 1 : -1) * (W / 2 + 1.6), tx = fx + Math.cos(yaw) * o - ux * 2, tz = fz - Math.sin(yaw) * o - uz * 2;
      add(new THREE.BoxGeometry(4.2, T, 4.2).translate(0, T / 2, 0), mats.white, tx, y, tz, yaw);
      add(new THREE.ConeGeometry(2.6, 4.5, 4).rotateY(Math.PI / 4).translate(0, T + 2.25, 0), mats.tile, tx, y, tz, yaw);
    }
  };
  R.marcos?.({ P, hgt, add, church, mats });
  group.traverse((o) => { if (o.isMesh) { longe(o.material); o.castShadow = false; o.receiveShadow = false; o.matrixAutoUpdate = false; o.updateMatrix(); } });
  if (typeof window !== 'undefined') (window.vizinhos ||= {})[R.nome] = { casas: houses.length, torres: towers.length, arvores: trees.length, tri: idx.length / 3 };
  return group;
}

// Olinda: orla do Istmo ao Janga, as colinas do sítio histórico (Alto da Sé, Amaro Branco, Guadalupe, Bonsucesso,
// Águas Compridas), o casario colorido em volta da Sé, torres brancas em Bairro Novo, Casa Caiada e Rio Doce
function olindaDef(meta) {
  const SE = [(-34.8552 - meta.lon0) * meta.mLon, -(-8.0137 - meta.lat0) * meta.mLat];
  return {
    nome: 'olinda', box: [1500, 9000, -15000, -4800],
    coast: [[-8.052, -34.873], [-8.04, -34.866], [-8.018, -34.853], [-8.01, -34.849], [-7.995, -34.843], [-7.978, -34.836], [-7.955, -34.83], [-7.93, -34.823], [-7.9, -34.82]],
    hills: [[-8.0137, -34.8552, 42, 430], [-8.0110, -34.8606, 34, 520], [-8.0015, -34.8634, 40, 650], [-7.9929, -34.8697, 45, 750], [-8.0200, -34.8579, 18, 400]],
    torre: (x, z, dc, r) => (dc < 320 && z < SE[1] - 900 && r < 0.14 ? [14 + hash(z, x) * 10, 14 + hash(x * 2, z) * 8, 36 + hash(x, z * 3) * 42] : null),
    colorido: (x, z) => Math.hypot(x - SE[0], z - SE[1]) < 750,
    marcos({ P, hgt, add, church, mats }) {
      church(-8.0137, -34.8552, 52, 20, 24, Math.PI * 0.75);          // Catedral da Sé (Alto da Sé)
      church(-8.0126, -34.8542, 34, 13, 19, Math.PI * 0.6, 1);       // Igreja da Misericórdia
      church(-8.0094, -34.8537, 44, 16, 22, Math.PI * 1.05);         // Mosteiro de São Bento
      church(-8.0168, -34.8530, 40, 15, 20, Math.PI * 0.9, 1);       // Convento de São Francisco
      church(-8.0189, -34.8515, 36, 14, 20, Math.PI * 0.55);         // Igreja do Carmo
      { // Caixa d'Água do Alto da Sé: torre de concreto com o mirante em cima
        const [x, z] = P(-8.0146, -34.8566), y = hgt(x, z);
        add(new THREE.CylinderGeometry(3.2, 3.6, 36, 14).translate(0, 18, 0), mats.stone, x, y, z);
        add(new THREE.CylinderGeometry(7.5, 6, 5, 18).translate(0, 38.5, 0), mats.stone, x, y, z);
        add(new THREE.CylinderGeometry(7.6, 7.6, 1.6, 18).translate(0, 41.2, 0), mats.dark, x, y, z);
      }
      { // farol de Olinda: torre branca com a lanterna no alto
        const [x, z] = P(-8.0098, -34.8508), y = hgt(x, z);
        add(new THREE.CylinderGeometry(1.8, 2.6, 24, 12).translate(0, 12, 0), mats.white, x, y, z);
        add(new THREE.CylinderGeometry(2.1, 2.1, 2.6, 12).translate(0, 25.3, 0), mats.dark, x, y, z);
        add(new THREE.ConeGeometry(2.3, 2.2, 12).translate(0, 27.7, 0), mats.red, x, y, z);
      }
    },
  };
}

// Piedade e Candeias (Jaboatão): a praia de Boa Viagem continua para o sul com a mesma parede de torres altas na
// beira-mar (Av. Bernardo Vieira de Melo), mais baixa em Candeias; no interior, casas; a oeste, o Morro dos
// Guararapes com a Igreja de Nossa Senhora dos Prazeres no alto
function piedadeDef() {
  return {
    nome: 'piedade', box: [-7500, 500, 5000, 13800], dens: 0.2, // interior de Jaboatão quase todo na neblina: menos casas
    coast: [[-8.145, -34.9045], [-8.1552, -34.9089], [-8.17, -34.913], [-8.19, -34.918], [-8.21, -34.925], [-8.23, -34.932], [-8.26, -34.94]],
    hills: [[-8.1475, -34.9555, 62, 520]],
    torre: (x, z, dc, r) => {
      const candeias = z > 11000;
      if (dc < 240 && r < (candeias ? 0.3 : 0.5)) return [16 + hash(z, x) * 10, 16 + hash(x * 2, z) * 10, (candeias ? 30 : 50) + hash(x, z * 3) * (candeias ? 40 : 65)];
      if (dc < 700 && r < 0.08) return [14 + hash(z, x) * 8, 14 + hash(x * 2, z) * 8, 30 + hash(x, z * 3) * 30];
      return null;
    },
    colorido: () => false,
    marcos({ church }) {
      church(-8.1478, -34.9552, 38, 14, 20, Math.PI * 0.5); // Igreja de N. S. dos Prazeres (Montes Guararapes)
    },
  };
}

export function buildOlinda(meta, isOut, ocupado) { return entorno(meta, isOut, olindaDef(meta), ocupado); }
export function buildPiedade(meta, isOut, ocupado) { return entorno(meta, isOut, piedadeDef(), ocupado); }
