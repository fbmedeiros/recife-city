// Relevo dos morros. O resto da cidade é plano (altura 0). Cada morro é um platô com encosta íngreme, centrado no
// ponto do bairro no OSM; as alturas são aproximadas (o OSM não tem altitude).
// Os morros ficam em grupos (vizinhos juntos), cada grupo com a sua grade: com o Recife inteiro, os morros vão de
// Guabiraba ao Ibura e uma grade única cobriria a cidade toda.
// heightAt(x, z) é usado por chão, ruas, prédios, postes, árvores, placas, cultura, carros, pessoas e câmera.
export const HILLS = {
  // zona norte (o recorte antigo)
  'Morro da Conceição': [72, 430], 'Alto José do Pinho': [52, 360], 'Alto do Mandu': [48, 380], 'Alto Santa Teresinha': [56, 360],
  'Alto José Bonifácio': [62, 420], 'Vasco da Gama': [58, 430], 'Alto Nossa Senhora de Fátima': [60, 360], 'Córrego do Botijão': [38, 300],
  'Bolo de Noiva': [50, 380], 'Linha do Tiro': [42, 360], 'Macaxeira': [36, 360], 'Bomba do Hemetério': [28, 300],
  // Recife inteiro: morros do norte e noroeste e as URs do sul
  'Nova Descoberta': [62, 520], 'Passarinho': [55, 520], 'Dois Unidos': [50, 480], 'Brejo de Beberibe': [55, 460],
  'Brejo da Guabiraba': [60, 520], 'Guabiraba': [48, 700], 'Córrego do Jenipapo': [55, 420], 'Pau-Ferro': [50, 520],
  'Dois Irmãos': [40, 560], 'Sítio dos Pintos': [35, 420], 'Ibura': [52, 650], 'Jordão': [40, 480], 'Cohab': [45, 600],
};
// centro preferido (o topo): a Estátua de Nossa Senhora da Conceição fica no alto do morro
const TOP = { 'Morro da Conceição': 'Estatua de Nossa Senhora da Conceição' };
const STEP = 4;
export const TERRAIN = { groups: [], hills: [] };

const ss = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function hash(x, z) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function initTerrain(data) {
  const hills = [], seen = new Set();
  for (const b of data.bairros) {
    const def = HILLS[b.name]; if (!def || seen.has(b.name)) continue;
    seen.add(b.name);
    const top = TOP[b.name] && data.pois.find((p) => p.name === TOP[b.name]);
    hills.push({ name: b.name, x: top ? top.x : b.x, z: top ? top.z : b.z, H: def[0], R: def[1] });
  }
  TERRAIN.hills = hills;
  // agrupa morros que se tocam (ou quase): cada grupo vira uma grade
  const groups = [];
  for (const h of hills) {
    const hit = groups.filter((g) => g.list.some((k) => Math.hypot(k.x - h.x, k.z - h.z) < k.R + h.R + 300));
    if (!hit.length) groups.push({ list: [h] });
    else { const g = hit[0]; g.list.push(h); for (const o of hit.slice(1)) { g.list.push(...o.list); groups.splice(groups.indexOf(o), 1); } }
  }
  TERRAIN.groups = groups.map((G) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const h of G.list) { x0 = Math.min(x0, h.x - h.R); x1 = Math.max(x1, h.x + h.R); z0 = Math.min(z0, h.z - h.R); z1 = Math.max(z1, h.z + h.R); }
    for (const h of G.list) h.far = (h.R / 0.85) * 1.001;
    const nx = Math.ceil((x1 - x0) / STEP) + 1, nz = Math.ceil((z1 - z0) / STEP) + 1, g = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * STEP, z = z0 + j * STEP;
      let h = 0, w = 0;
      for (const k of G.list) {
        // o ruído do contorno multiplica a distância por 0,85 a 1,15: além de R/0,85 a encosta já é zero e o morro não
        // muda nada aqui (pula o ruído, que é o que custa)
        const d0 = Math.hypot(x - k.x, z - k.z); if (d0 > k.far) continue;
        const d = d0 * (0.85 + 0.3 * vnoise(x / 140 + k.H, z / 140)); // contorno irregular
        const f = ss(k.R, k.R * 0.32, d);
        h = Math.max(h, k.H * f); w = Math.max(w, f);
      }
      // ondulação nas encostas e no topo (sem mexer na planície)
      if (w > 0.02) h += (vnoise(x / 45, z / 45) - 0.5) * 6 * w;
      g[j * nx + i] = Math.max(0, h);
    }
    return { grid: g, x0, z0, nx, nz, x1: x0 + (nx - 1) * STEP, z1: z0 + (nz - 1) * STEP };
  });
  return TERRAIN;
}

const groupAt = (x, z) => { for (const G of TERRAIN.groups) if (x > G.x0 && x < G.x1 && z > G.z0 && z < G.z1) return G; return null; };
// Pontes sobre a água: o tabuleiro sobe uns 2,5 m sobre o rio, com rampa nas cabeceiras (world.js monta a grade
// com setDeck). Fica aqui para carro, gente, câmera, poste e ponte usarem a mesma altura.
let DECK = null;
export function setDeck(d) { DECK = d; }
export function deckAt(x, z) {
  const D = DECK; if (!D || x < D.x0 || z < D.z0 || x > D.x1 || z > D.z1) return 0;
  const fx = (x - D.x0) / D.S, fz = (z - D.z0) / D.S, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, m = D.cells;
  const a = m.get(i * 65536 + j) || 0, b = m.get((i + 1) * 65536 + j) || 0, c = m.get(i * 65536 + j + 1) || 0, d = m.get((i + 1) * 65536 + j + 1) || 0;
  if (!(a || b || c || d)) return 0;
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function heightAt(x, z) {
  const k = DECK ? deckAt(x, z) : 0;
  return k ? Math.max(k, hillAt(x, z)) : hillAt(x, z);
}
function hillAt(x, z) {
  const T = groupAt(x, z); if (!T) return 0;
  const fx = (x - T.x0) / STEP, fz = (z - T.z0) / STEP;
  if (fx < 0 || fz < 0 || fx >= T.nx - 1 || fz >= T.nz - 1) return 0;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, n = T.nx, g = T.grid;
  const a = g[j * n + i], b = g[j * n + i + 1], c = g[(j + 1) * n + i], d = g[(j + 1) * n + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const inHills = (x, z) => !!groupAt(x, z);

// malha do chão dos morros: uma grade de STEP metros por grupo, juntas numa geometria só, mesma textura e mesmo uv
// do chão plano
export function terrainGeometry(THREE, bounds) {
  const Gs = TERRAIN.groups; if (!Gs.length) return null;
  const { xmin, xmax, zmin, zmax } = bounds, W = xmax - xmin, H = zmax - zmin;
  let nv = 0, ni = 0; for (const T of Gs) { nv += T.nx * T.nz; ni += (T.nx - 1) * (T.nz - 1) * 6; }
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let base = 0, o = 0;
  for (const T of Gs) {
    for (let j = 0; j < T.nz; j++) for (let i = 0; i < T.nx; i++) {
      const k = j * T.nx + i, q = base + k, x = T.x0 + i * STEP, z = T.z0 + j * STEP;
      pos[q * 3] = x; pos[q * 3 + 1] = T.grid[k] + 0.03; pos[q * 3 + 2] = z;
      uv[q * 2] = (x - xmin) / W; uv[q * 2 + 1] = (zmax - z) / H;
    }
    for (let j = 0; j < T.nz - 1; j++) for (let i = 0; i < T.nx - 1; i++) {
      const a = base + j * T.nx + i, b = a + 1, c = a + T.nx, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
    base += T.nx * T.nz;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}
