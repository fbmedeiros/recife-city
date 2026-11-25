// Árvores de rua e de praça: oitis, mangueiras e flamboyants, em instâncias por bloco de 800 m.
// O tronco entra na colisão; a copa balança de leve com o vento.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { leafSet, barkSet, fbm } from './textures.js';
import { heightAt } from './terrain.js';
import { ROAD_W } from './world.js';

const WATER = 1, ROAD = 2, SOLID = 4, DRIVE = 128;
// ruas com calçada (rua.js): árvore em fileira no canteiro junto ao meio-fio
const ROW = { primary: [9, 2, 0.08], secondary: [9, 2, 0.08], tertiary: [10, 2, 0.12], residential: [13, 4, 0.35], unclassified: [13, 4, 0.35], living_street: [12, 3, 0.3] };
const STREET = new Set(['residential', 'tertiary', 'secondary', 'primary', 'living_street', 'unclassified', 'pedestrian']);
const CH = 800, SHOW = 900;
const GREENS = ['#6f9d48', '#5f8f3f', '#7fae55', '#557f39', '#8bb35c', '#4e7a37'];
const FLAMB = ['#d9482b', '#e0632e', '#c93a26'];

function rnd(seed) { let s = seed | 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296; }

// copa irregular: algumas esferas amassadas, mais escuras embaixo e por dentro
function canopyGeo(kind) {
  const r = rnd(kind === 'wide' ? 77 : 33), parts = [];
  const blobs = kind === 'wide'
    ? [[0, 5.0, 0, 2.3], [1.9, 4.7, 0.4, 1.7], [-1.8, 4.8, -0.3, 1.8], [0.3, 4.6, 1.9, 1.6], [-0.2, 4.7, -1.9, 1.7]]
    : [[0, 5.2, 0, 2.0], [1.1, 4.4, 0.5, 1.5], [-1.1, 4.5, -0.4, 1.6], [0.2, 6.2, -0.2, 1.4], [0.1, 4.3, 1.2, 1.4]];
  for (const [x, y, z, s] of blobs) {
    const g = new THREE.IcosahedronGeometry(s, 1);
    g.scale(1, kind === 'wide' ? 0.62 : 0.85, 1);
    g.translate(x, y, z);
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = fbm(x * 0.9 + 10, z * 0.9 + y * 0.7, 64, 5, 2) - 0.5;
    const l = Math.hypot(x, z) || 1;
    pos.setXYZ(i, x + (x / l) * n * 0.6, y + n * 0.5, z + (z / l) * n * 0.6);
    const ao = 0.5 + 0.55 * THREE.MathUtils.smoothstep(y, 3.6, 6.6) + r() * 0.08;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// textura de cacho de folhas (fundo transparente): folhas elípticas claras, tingidas depois pela cor da instância
let CARD_TEX = null;
function leafCardTex() {
  if (CARD_TEX) return CARD_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = rnd(9);
  for (let i = 0; i < 230; i++) {
    const x = 24 + r() * 208, y = 24 + r() * 208, d = Math.hypot(x - 128, y - 128); if (d > 112 * (0.75 + r() * 0.3)) continue;
    const a = r() * Math.PI * 2, L = 11 + r() * 10, v = 185 + Math.floor(r() * 70), sh = d / 128;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `rgb(${Math.floor(v * (0.9 - sh * 0.12))},${v},${Math.floor(v * (0.82 - sh * 0.1))})`; // quase neutro: a cor vem da instância
    g.beginPath(); g.ellipse(0, 0, L, L * 0.42, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,60,20,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-L, 0); g.lineTo(L, 0); g.stroke();
    g.restore();
  }
  CARD_TEX = new THREE.CanvasTexture(c); CARD_TEX.colorSpace = THREE.SRGBColorSpace; CARD_TEX.anisotropy = 4;
  return CARD_TEX;
}
// copa de cartões: dezenas de planos com cacho de folhas espalhados na superfície das bolhas, com a normal
// apontando pra fora do centro da copa (luz macia, como nas árvores de jogo) e escurecendo embaixo
function cardsGeo(kind) {
  const r = rnd(kind === 'wide' ? 177 : 133), parts = [];
  const blobs = kind === 'wide'
    ? [[0, 5.0, 0, 2.6], [2.1, 4.7, 0.4, 2.0], [-2.0, 4.8, -0.3, 2.1], [0.3, 4.6, 2.1, 1.9], [-0.2, 4.7, -2.1, 2.0]]
    : [[0, 5.3, 0, 2.3], [1.2, 4.5, 0.5, 1.8], [-1.2, 4.6, -0.4, 1.8], [0.2, 6.4, -0.2, 1.6], [0.1, 4.4, 1.3, 1.7]];
  const cy = kind === 'wide' ? 4.8 : 5.1;
  for (const [bx, by, bz, bs] of blobs) {
    const n = Math.round(bs * 9);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = Math.sqrt(1 - u * u), rad = bs * (0.55 + r() * 0.5);
      const x = bx + rr * Math.cos(th) * rad, y = by + u * rad * (kind === 'wide' ? 0.62 : 0.85), z = bz + rr * Math.sin(th) * rad;
      const size = 1.5 + r() * 1.3, q = new THREE.PlaneGeometry(size, size);
      q.rotateX(r() * Math.PI); q.rotateY(r() * Math.PI * 2); q.rotateZ((r() - 0.5) * 1.2);
      q.translate(x, y, z);
      // normal = direção a partir do centro da copa
      const nrm = q.attributes.normal, pos = q.attributes.position, col = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        const vx = pos.getX(k), vy = pos.getY(k) - cy, vz = pos.getZ(k), l = Math.hypot(vx, vy, vz) || 1;
        nrm.setXYZ(k, vx / l, vy / l + 0.25, vz / l);
        const ao = 0.55 + 0.5 * THREE.MathUtils.smoothstep(pos.getY(k), cy - 1.6, cy + 1.6);
        col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = Math.min(1.05, ao);
      }
      q.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push(q);
    }
  }
  return mergeGeometries(parts);
}

// árvore folhuda para os modelos montados com Kit (praças, canteiros): tronco, miolo escuro e cartões de folha
const LEAFY = new Map();
export function leafyTree(k, x, z, scale = 1, color = '#5f8f3f', kind = 'wide') {
  if (!LEAFY.has(kind)) {
    const inner = canopyGeo(kind); inner.scale(0.78, 0.82, 0.78); inner.translate(0, 1.0, 0); inner.deleteAttribute('color');
    LEAFY.set(kind, { trunk: trunkGeo(kind), inner, cards: cardsGeo(kind) });
  }
  const G = LEAFY.get(kind), key = color + kind;
  if (!LEAFY.has(key)) {
    const c = new THREE.Color(color);
    LEAFY.set(key, {
      card: new THREE.MeshStandardMaterial({ map: leafCardTex(), alphaTest: 0.42, side: THREE.DoubleSide, color: c, roughness: 0.8 }),
      inner: new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.5), roughness: 0.9 }),
      bark: new THREE.MeshStandardMaterial({ color: '#6b5440', roughness: 0.95 }),
    });
  }
  const M = LEAFY.get(key), sc = [scale, scale, scale], p = [x, 0, z];
  k.add(M.bark, G.trunk, sc, p).add(M.inner, G.inner, sc, p).add(M.card, G.cards, sc, p);
}

function trunkGeo(kind) {
  const t = new THREE.CylinderGeometry(0.15, 0.27, 4.2, 7, 3);
  t.translate(0, 2.1, 0);
  const b1 = new THREE.CylinderGeometry(0.06, 0.12, 2.2, 5); b1.rotateZ(0.8); b1.translate(0.7, 3.9, 0);
  const b2 = new THREE.CylinderGeometry(0.06, 0.12, 2.0, 5); b2.rotateZ(-0.75); b2.rotateY(1.2); b2.translate(-0.3, 3.8, -0.6);
  const extra = [];
  for (let i = 0; i < 4; i++) { const b = new THREE.CylinderGeometry(0.04, 0.09, 1.9, 5); b.rotateZ(0.7 + (i % 2) * 0.25); b.rotateY(i * 1.6 + 0.4); const a = i * 1.6 + 0.4; b.translate(Math.cos(a) * 0.55, 4.5 + (i % 2) * 0.4, -Math.sin(a) * 0.55); extra.push(b); }
  const g = mergeGeometries([t, b1, b2, ...extra]);
  if (kind === 'wide') g.scale(1.15, 0.9, 1.15);
  return g;
}

export function buildTrees(scene, world, photos) {
  const { data, grid } = world, { GW, GH, xmin, zmin, RES, mask } = grid;
  const cell = (x, z) => {
    const ix = Math.floor((x - xmin) / RES), iz = Math.floor((z - zmin) / RES);
    return ix < 0 || iz < 0 || ix >= GW || iz >= GH ? -1 : iz * GW + ix;
  };
  // livre num raio de ~1,5 m (calçada de verdade, sem rua, prédio ou água)
  const free = (x, z) => {
    for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
      const i = cell(x + dx, z + dz);
      if (i < 0 || mask[i] & (WATER | ROAD | SOLID)) return false;
    }
    return true;
  };
  const taken = new Set();
  const spot = (x, z, gap) => {
    const k = Math.floor(x / gap) + ',' + Math.floor(z / gap);
    if (taken.has(k)) return false;
    taken.add(k);
    return true;
  };
  const r = rnd(2024);
  const trees = []; // [x, z, kind, scale, yaw, color]
  // orla de Boa Viagem/Pina: lá a árvore é coqueiro (classics.js põe os coqueiros do calçadão); copa redonda e
  // flamboyant ficam fora do lado do mar, do canteiro e da calçada da avenida (até 30 m pra dentro)
  const OB = 50, orlaX = new Map();
  for (const rd of data.roads) {
    if (!rd.n || !/^Avenida (Boa Viagem|Herculano Bandeira)/.test(rd.n)) continue;
    for (let i = 0; i < rd.p.length - 1; i++) { const [ax, az] = rd.p[i], [bx, bz] = rd.p[i + 1], st = Math.max(1, Math.ceil(Math.abs(bz - az) / 20)); for (let k = 0; k <= st; k++) { const x = ax + ((bx - ax) * k) / st, z = az + ((bz - az) * k) / st, b = Math.floor(z / OB); if (!(orlaX.get(b) >= x)) orlaX.set(b, x); } }
  }
  // só a faixa de Boa Viagem (até 150 m pro mar, z > −700): Pina e Brasília Teimosa, a leste, ficam com as árvores
  const naOrla = (x, z) => { const ox = orlaX.get(Math.floor(z / OB)); return ox != null && z > -700 && ox - x < 30 && ox - x > -150; };
  const add = (x, z, flambChance, pit = false) => {
    if (naOrla(x, z)) return;
    const fl = r() < flambChance;
    const kind = fl || r() < 0.3 ? 'wide' : 'round';
    const color = fl ? FLAMB[Math.floor(r() * FLAMB.length)] : GREENS[Math.floor(r() * GREENS.length)];
    trees.push([x, z, kind, pit ? 0.8 + r() * 0.35 : 0.75 + r() * 0.55, r() * Math.PI * 2, color, pit]);
    const i = cell(x, z);
    if (i >= 0) mask[i] |= SOLID; // tronco na colisão
  };

  // praças e parques
  for (const p of data.parks) {
    if (p.k !== 'green' || p.p.length < 3) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, A = 0;
    for (let i = 0; i < p.p.length; i++) {
      const a = p.p[i], b = p.p[(i + 1) % p.p.length];
      x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); z0 = Math.min(z0, a[1]); z1 = Math.max(z1, a[1]);
      A += a[0] * b[1] - b[0] * a[1];
    }
    const n = Math.min(500, Math.floor(Math.abs(A) / 2 / 160));
    for (let k = 0; k < n * 2; k++) {
      const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
      let inside = false;
      for (let i = 0, j = p.p.length - 1; i < p.p.length; j = i++) {
        const a = p.p[i], b = p.p[j];
        if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      if (inside && free(x, z) && spot(x, z, 7)) add(x, z, 0.1);
    }
  }
  // calçadas com meio-fio: fileira de árvores a ~1 m da guia, com canteiro de terra em volta do tronco
  const at = (x, z, bits) => { const i = cell(x, z); return i < 0 || (mask[i] & bits) !== 0; };
  for (const rd of data.roads) {
    const row = ROW[rd.k];
    if (!row || rd.tu || rd.b || rd.cobble) continue;
    if (/^Calçadão/.test(rd.n || '')) continue;
    const off = (ROAD_W[rd.k] || 7) / 2 + 0.22 + 0.8;
    let carry = r() * row[0];
    for (let i = 0; i < rd.p.length - 1; i++) {
      const a = rd.p[i], b = rd.p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 1) { carry = Math.max(0, carry - L); continue; }
      const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
      let t = carry;
      for (; t < L; t += row[0] + r() * row[1]) {
        if (t < 3 || t > L - 3) continue; // longe da esquina
        for (const side of [1, -1]) {
          if (r() < row[2]) continue;
          const x = a[0] + ux * t + nx * off * side, z = a[1] + uz * t + nz * off * side;
          // na calçada: sem pista no ponto nem perto dele, sem prédio, poste ou água, e com folga até a parede
          if (at(x, z, DRIVE | SOLID | WATER) || at(x + ux * 1.2, z + uz * 1.2, DRIVE) || at(x - ux * 1.2, z - uz * 1.2, DRIVE)) continue;
          if (at(x + nx * side * 1.3, z + nz * side * 1.3, SOLID | DRIVE)) continue;
          if (spot(x, z, 6)) add(x, z, 0.12, true);
        }
      }
      carry = t - L;
    }
  }
  // calçadão, rua de pedestre e o resto: dos dois lados da rua, a cada ~16–24 m
  for (const rd of data.roads) {
    if (!STREET.has(rd.k) || rd.tu || rd.b || ROW[rd.k]) continue;
    if (/^Calçadão/.test(rd.n || '')) continue; // o calçadão da orla é livre: sem árvore no meio
    const off = (rd.k === 'pedestrian' ? 3 : rd.k === 'primary' || rd.k === 'secondary' ? 6.5 : 4.5) + 2.2;
    let carry = r() * 12;
    for (let i = 0; i < rd.p.length - 1; i++) {
      const a = rd.p[i], b = rd.p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 1) continue;
      const nx = -dz / L, nz = dx / L;
      for (let t = carry; t < L; t += 16 + r() * 8) {
        if (r() < 0.25) continue;
        for (const side of [1, -1]) {
          if (r() < 0.25) continue;
          const x = a[0] + (dx * t) / L + nx * off * side, z = a[1] + (dz * t) / L + nz * off * side;
          if (free(x, z) && spot(x, z, 9)) add(x, z, 0.12);
        }
        carry = t + 16 - L;
      }
    }
  }

  // ---------- malhas instanciadas por bloco
  const leaf = leafSet(), bark = barkSet();
  const time = { value: 0 };
  const sway = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
    float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
    float k = max(0.0, transformed.y - 3.0) * 0.035;
    transformed.x += sin(uTime * 1.3 + ph) * k; transformed.z += cos(uTime * 1.1 + ph * 1.3) * k * 0.7;
  #endif`);
  };
  const canopyMat = new THREE.MeshStandardMaterial({ map: leaf.map, normalMap: leaf.normal, normalScale: new THREE.Vector2(1.4, 1.4), vertexColors: true, roughness: 0.82 });
  canopyMat.onBeforeCompile = sway;
  const trunkMat = new THREE.MeshStandardMaterial({ map: photos?.bark.map || bark.map, normalMap: photos?.bark.normal || bark.normal, roughness: 0.95 });
  // copa = miolo escuro (dá volume, não deixa ver através) + cartões de folhas por fora
  const cardMat = new THREE.MeshStandardMaterial({ map: leafCardTex(), alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.8 });
  cardMat.onBeforeCompile = sway;
  const inner = (k) => { const g = canopyGeo(k); g.scale(0.78, 0.82, 0.78); g.translate(0, 1.0, 0); const c = g.attributes.color; for (let i = 0; i < c.count; i++) c.setX(i, c.getX(i) * 0.62), c.setY(i, c.getY(i) * 0.62), c.setZ(i, c.getZ(i) * 0.62); return g; };
  const geos = { round: [trunkGeo('round'), inner('round'), cardsGeo('round')], wide: [trunkGeo('wide'), inner('wide'), cardsGeo('wide')] };

  // canteiro: moldura de concreto e terra, 1,1 m × 1,1 m, na altura da calçada (0,15 m)
  const pitGeo = mergeGeometries([
    new THREE.BoxGeometry(1.1, 0.03, 0.12).translate(0, 0.165, 0.49), new THREE.BoxGeometry(1.1, 0.03, 0.12).translate(0, 0.165, -0.49),
    new THREE.BoxGeometry(0.12, 0.03, 0.86).translate(0.49, 0.165, 0), new THREE.BoxGeometry(0.12, 0.03, 0.86).translate(-0.49, 0.165, 0),
    new THREE.BoxGeometry(0.86, 0.01, 0.86).translate(0, 0.152, 0),
  ].map((g, i) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); const v = i < 4 ? [0.72, 0.71, 0.68] : [0.2, 0.15, 0.1]; for (let k = 0; k < n; k++) c.set(v, k * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }));
  const pitMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const chunks = new Map();
  for (const t of trees) {
    const key = Math.floor(t[0] / CH) + ',' + Math.floor(t[1] / CH) + ',' + t[2];
    let c = chunks.get(key);
    if (!c) chunks.set(key, (c = { kind: t[2], cx: (Math.floor(t[0] / CH) + 0.5) * CH, cz: (Math.floor(t[1] / CH) + 0.5) * CH, list: [] }));
    c.list.push(t);
  }
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  // cada bloco guardado compacto (6 números por árvore: x, z, escala, giro, cor, canteiro); as malhas instanciadas
  // só existem perto da câmera. Antes a cidade inteira ficava montada, e as matrizes dos blocos longe (que nunca iam
  // pra placa de vídeo) seguravam dezenas de MB no JS.
  const list = [];
  for (const c of chunks.values()) {
    const f = new Float32Array(c.list.length * 6);
    c.list.forEach(([x, z, , sc, yaw, color, pit], i) => f.set([x, z, sc, yaw, col.set(color).getHex(), pit ? 1 : 0], i * 6));
    list.push({ cx: c.cx, cz: c.cz, kind: c.kind, f, meshes: null });
  }
  const drop = function () { this.array = null; }; // depois de ir pra placa de vídeo, a cópia do JS sai
  const montar = (c) => {
    const n = c.f.length / 6, [tg, cg, kg] = geos[c.kind], F = c.f;
    const trunk = new THREE.InstancedMesh(tg, trunkMat, n), crown = new THREE.InstancedMesh(cg, canopyMat, n), cards = new THREE.InstancedMesh(kg, cardMat, n);
    let npit = 0;
    for (let i = 0; i < n; i++) {
      const x = F[i * 6], z = F[i * 6 + 1], sc = F[i * 6 + 2];
      m4.compose(p.set(x, heightAt(x, z), z), q.setFromAxisAngle(up, F[i * 6 + 3]), s.set(sc, sc * (0.9 + (i % 5) * 0.05), sc));
      trunk.setMatrixAt(i, m4); crown.setMatrixAt(i, m4); cards.setMatrixAt(i, m4);
      col.setHex(F[i * 6 + 4]); crown.setColorAt(i, col); cards.setColorAt(i, col);
      if (F[i * 6 + 5]) npit++;
    }
    const meshes = [trunk, crown, cards];
    if (npit) {
      const pm = new THREE.InstancedMesh(pitGeo, pitMat, npit);
      for (let i = 0, k = 0; i < n; i++) if (F[i * 6 + 5]) { const x = F[i * 6], z = F[i * 6 + 1]; m4.compose(p.set(x, heightAt(x, z), z), q.setFromAxisAngle(up, 0), s.set(1, 1, 1)); pm.setMatrixAt(k++, m4); }
      pm.castShadow = false; meshes.push(pm);
    }
    for (const m of meshes) { if (m !== meshes[3]) m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); m.instanceMatrix.onUpload(drop); m.instanceColor?.onUpload(drop); group.add(m); }
    c.meshes = meshes;
  };
  const desmontar = (c) => { for (const m of c.meshes) { group.remove(m); m.dispose(); } c.meshes = null; };
  const PERTO = SHOW + CH * 0.7, LONGE = PERTO + 300;
  // as listas de trabalho ficam presas no escopo enquanto o update viver (o `add` usa `trees`): esvazia
  const total = trees.length;
  trees.length = 0; taken.clear(); chunks.clear();
  scene.add(group);

  // tira as árvores que caem em cima de algum retângulo (estações do corredor de ônibus, que só existem depois que a
  // rua monta): zera a escala delas no bloco compacto e remonta o bloco se estiver montado
  const tira = (rects) => {
    let n = 0;
    for (const c of list) {
      let mudou = false;
      for (let i = 0; i < c.f.length / 6; i++) {
        const x = c.f[i * 6], z = c.f[i * 6 + 1];
        for (const R of rects) { const rx = x - R.x, rz = z - R.z, al = rx * R.dx + rz * R.dz, tr = rx * R.dz - rz * R.dx; if (Math.abs(al) < R.len / 2 + 1 && Math.abs(tr) < R.w / 2 + 1.5) { c.f[i * 6 + 2] = 0.0001; mudou = true; n++; break; } }
      }
      if (mudou && c.meshes) desmontar(c);
    }
    return n;
  };
  return {
    count: total, tira,
    update(cam, t) {
      time.value = t;
      // perto monta (no máximo 3 blocos por quadro, pra não engasgar), longe desmonta
      let n = 0;
      for (const c of list) {
        const d = Math.hypot(c.cx - cam.x, c.cz - cam.z);
        if (d < PERTO && !c.meshes && n < 3) { montar(c); n++; } else if (d > LONGE && c.meshes) desmontar(c);
      }
    },
  };
}
