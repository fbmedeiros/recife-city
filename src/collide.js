// Colisão dos modelos feitos por código: carimba na grade (bit SOLID) a "sombra" no chão de cada peça.
// Peças que começam acima de 2,2 m (cornijas, coberturas, letreiros) e peças rasas no chão (gramado, espelho d'água,
// tapetes) não bloqueiam. Peças finas (postes, troncos) ocupam pelo menos a célula do centro.
import * as THREE from 'three';
import { heightAt } from './terrain.js';

const SOLID = 4;
export const COLL = { grid: null };

function cellIndex(x, z) {
  const g = COLL.grid; if (!g) return -1;
  const ix = Math.floor((x - g.xmin) / g.RES), iz = Math.floor((z - g.zmin) / g.RES);
  return ix < 0 || iz < 0 || ix >= g.GW || iz >= g.GH ? -1 : iz * g.GW + ix;
}
export function stampPoint(x, z) { const i = cellIndex(x, z); if (i >= 0) COLL.grid.mask[i] |= SOLID; }
// abre um retângulo (centro, eixo u e meias-larguras) tirando o bit SOLID: pátio aberto dentro de um prédio
export function clearBox(cx, cz, ux, uz, hu, hv) {
  const g = COLL.grid; if (!g) return;
  const R = Math.hypot(hu, hv);
  for (let dx = -R; dx <= R; dx += g.RES / 2) for (let dz = -R; dz <= R; dz += g.RES / 2) {
    const u = dx * ux + dz * uz, v = -dx * uz + dz * ux;
    if (Math.abs(u) <= hu && Math.abs(v) <= hv) { const i = cellIndex(cx + dx, cz + dz); if (i >= 0) g.mask[i] &= ~SOLID; }
  }
}
export function stampDisc(x, z, r) {
  const g = COLL.grid; if (!g) return;
  stampPoint(x, z);
  for (let dx = -r; dx <= r; dx += g.RES / 2) for (let dz = -r; dz <= r; dz += g.RES / 2) if (dx * dx + dz * dz <= r * r) stampPoint(x + dx, z + dz);
}

// envoltória convexa (monotone chain) e preenchimento das células cujo centro cai dentro
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export function stampHull(points) {
  const g = COLL.grid; if (!g || points.length === 0) return;
  const h = hull(points);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, cx = 0, cz = 0;
  for (const [x, z] of h) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); cx += x; cz += z; }
  stampPoint(cx / h.length, cz / h.length);
  if (h.length < 3) return;
  const R = g.RES;
  for (let x = Math.floor(x0 / R) * R + R / 2; x <= x1; x += R) for (let z = Math.floor(z0 / R) * R + R / 2; z <= z1; z += R) {
    let inside = true;
    for (let i = 0; i < h.length && inside; i++) { const a = h[i], b = h[(i + 1) % h.length]; if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) inside = false; }
    if (inside) stampPoint(x, z);
  }
}

const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
// caixa (bounding box da geometria) levada ao mundo pela matriz
export function stampBox(box, matrix) {
  if (!COLL.grid || box.isEmpty()) return;
  let k = 0, y0 = Infinity, y1 = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const v = corners[k++].set(x, y, z).applyMatrix4(matrix); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  // alturas medidas a partir do chão daquele ponto (no morro o chão não é 0)
  let mx = 0, mz = 0; for (const v of corners) { mx += v.x / 8; mz += v.z / 8; }
  const gy = heightAt(mx, mz); y0 -= gy; y1 -= gy;
  if (y0 > 2.2) return;                       // começa acima da cabeça
  if (y1 - y0 < 0.3 && y1 < 0.8) return;       // raso no chão
  stampHull(corners.map((v) => [v.x, v.z]));
}
export function stampMesh(mesh) {
  if (!COLL.grid || !mesh.geometry) return;
  mesh.updateWorldMatrix(true, false);
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  stampBox(mesh.geometry.boundingBox, mesh.matrixWorld);
}
