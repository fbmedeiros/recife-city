// Texturas procedurais (nada baixado): ruído, fachadas em atlas, asfalto, chão, telhado e folhas.
// Cada textura importante vem com mapa de relevo (normal) para a luz do sol "pegar" nos detalhes.
import * as THREE from 'three';

// ---------------------------------------------------------------- ruído
function h2(x, y, s) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
// ruído de valor que repete a cada p células (textura sem emenda)
function vnoise(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const a = h2(x0, y0, s), b = h2(x1, y0, s), c = h2(x0, y1, s), d = h2(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, p, s = 1, oct = 4) {
  let t = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { t += a * vnoise(x * f, y * f, p * f, s + o * 17); n += a; a *= 0.5; f *= 2; }
  return t / n;
}
const rand = (s) => () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// relevo (0..1 por pixel) → normal map em espaço tangente, com borda repetível
function normalFrom(hf, w, h, strength = 2) {
  const c = canvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const at = (x, y) => hf[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// depois que a imagem vai para a placa de vídeo, a cópia no JS não serve mais: libera (fica só o tamanho)
export function releaseOnUpload(t) {
  const prev = t.onUpdate;
  t.onUpdate = (tt) => {
    prev?.(tt);
    const img = t.image;
    if (!img || img.released) return;
    const w = img.width, h = img.height;
    if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) { img.width = 1; img.height = 1; }
    t.source.data = { width: w, height: h, released: true };
  };
  return t;
}

function tex(c, srgb = true, aniso = 8) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return releaseOnUpload(t);
}

// lê o canal vermelho de um canvas em tons de cinza como relevo
function heightOf(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, hf = new Float32Array(c.width * c.height);
  for (let i = 0; i < hf.length; i++) hf[i] = d[i * 4] / 255;
  return hf;
}

// ---------------------------------------------------------------- fachadas
// Atlas 4 variantes × 2 linhas (térreo embaixo, andar-tipo em cima). Cada célula = 1 vão × 1 andar.
// Três camadas pintadas juntas: cor; "rm" (R = vidro de janela, G = aspereza, B = quanto tinge com a cor do prédio); relevo.
const S = 256;
const P = {
  wall: { c: '#ebe7df', h: 0.5, win: 0, ro: 0.9, ti: 1 },
  base: { c: '#bdb7ad', h: 0.55, win: 0, ro: 0.92, ti: 1 },
  trim: { c: '#f3f0e8', h: 0.78, win: 0, ro: 0.8, ti: 0 },
  trimT: { c: '#f6f3ec', h: 0.8, win: 0, ro: 0.8, ti: 1 },
  shadow: { c: '#3a3631', h: 0.3, win: 0, ro: 0.9, ti: 0 },
  glass: { c: '#93a8b4', h: 0.18, win: 1, ro: 0.06, ti: 0 },
  frame: { c: '#d7d8d6', h: 0.36, win: 0, ro: 0.35, ti: 0 },
  wood: { c: '#5b3a24', h: 0.4, win: 0, ro: 0.75, ti: 0 },
  iron: { c: '#1e2124', h: 0.85, win: 0, ro: 0.45, ti: 0 },
  steel: { c: '#8d9296', h: 0.4, win: 0, ro: 0.45, ti: 0 },
  dark: { c: '#1b1b1d', h: 0.12, win: 0, ro: 0.95, ti: 0 },
  ac: { c: '#e4e4df', h: 0.95, win: 0, ro: 0.55, ti: 0 },
  rail: { c: '#7d97a3', h: 0.62, win: 0, ro: 0.06, ti: 0 },
  grade: { c: '#f1f1ee', h: 0.85, win: 0, ro: 0.5, ti: 0 },
  brick: { c: '#b4592f', h: 0.62, win: 0, ro: 0.92, ti: 0 },
  mortar: { c: '#9a8f80', h: 0.38, win: 0, ro: 0.95, ti: 0 },
  spray: { c: '#ff006e', h: 0.52, win: 0, ro: 0.7, ti: 0 },
};
const SHUTTERS = ['#3f6e55', '#3b5f86', '#7a3b2e', '#4b7a78', '#6b4a2b'];
const SIGNS = ['#c8102e', '#f2b705', '#1d5fa8', '#2a9d58', '#e76f2a', '#7b2d8b'];

function painter(cx, cy, bayW, floorH, layers) {
  const { col, rm, hgt } = layers;
  const X = (m) => cx * S + (m / bayW) * S;
  const Y = (m) => cy * S + S - (m / floorH) * S;
  const css = (p) => `rgb(${Math.round(p.win * 255)},${Math.round(p.ro * 255)},${Math.round(p.ti * 255)})`;
  const gray = (v) => { const k = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${k},${k},${k})`; };
  const fill = (path, p, c) => {
    for (const [g, style] of [[col, c || p.c], [rm, css(p)], [hgt, gray(p.h)]]) { g.fillStyle = style; g.beginPath(); path(g); g.fill(); }
  };
  return {
    X, Y,
    rect(x0, y0, x1, y1, p, c) { fill((g) => g.rect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1)), p, c); },
    arch(x0, y0, x1, y1, p, c) { // retângulo com topo em arco pleno
      fill((g) => {
        const r = (X(x1) - X(x0)) / 2, top = Y(y1) + r;
        g.moveTo(X(x0), Y(y0)); g.lineTo(X(x0), top); g.arc((X(x0) + X(x1)) / 2, top, r, Math.PI, 0); g.lineTo(X(x1), Y(y0)); g.closePath();
      }, p, c);
    },
    clip(fn) { for (const g of [col, rm, hgt]) { g.save(); g.beginPath(); g.rect(cx * S, cy * S, S, S); g.clip(); } fn(); for (const g of [col, rm, hgt]) g.restore(); },
  };
}

// janela com caixilho de alumínio e divisões
function windowAl(p, x0, y0, x1, y1, cols = 2, r = Math.random) {
  p.rect(x0 - 0.06, y0 - 0.06, x1 + 0.06, y1 + 0.06, P.frame);
  p.rect(x0, y0, x1, y1, P.glass);
  if (r() < 0.35) p.rect(x0, y1 - (y1 - y0) * (0.3 + r() * 0.5), x0 + (x1 - x0) * (0.3 + r() * 0.5), y1, { ...P.glass, ro: 0.6, h: 0.2 }, ['#d8cdb4', '#c9d3d8', '#e2d6c4'][Math.floor(r() * 3)]); // cortina
  for (let i = 1; i < cols; i++) { const x = x0 + ((x1 - x0) * i) / cols; p.rect(x - 0.03, y0, x + 0.03, y1, P.frame); }
}
function acUnit(p, x, y) { p.rect(x, y, x + 0.72, y + 0.42, P.ac); p.rect(x + 0.06, y + 0.06, x + 0.4, y + 0.36, { ...P.ac, h: 0.7 }, '#bfc1bd'); p.rect(x, y - 0.04, x + 0.72, y, P.shadow); }
function pastilha(p, x0, y0, x1, y1, r) {
  p.rect(x0, y0, x1, y1, { ...P.wall, ro: 0.55 }, '#e9e6e0');
  for (let y = y0; y < y1 - 0.01; y += 0.1) for (let x = x0; x < x1 - 0.01; x += 0.1) {
    const k = 225 + Math.floor(r() * 30);
    p.rect(x + 0.008, y + 0.008, Math.min(x1, x + 0.092), Math.min(y1, y + 0.092), { ...P.wall, ro: 0.45, h: 0.56 }, `rgb(${k},${k - 2},${k - 6})`);
  }
}
function rollDoor(p, x0, y0, x1, y1) {
  p.rect(x0, y0, x1, y1, P.steel);
  for (let y = y0; y < y1; y += 0.09) p.rect(x0, y, x1, y + 0.025, { ...P.steel, h: 0.25 }, '#6c7175');
}

const DESIGNS = {
  colonial: {
    bay: 4, floor: 3.6,
    upper(p, v, r) {
      p.rect(0, 0, 4, 3.6, P.wall);
      p.rect(0, 0, 0.16, 3.6, P.trimT); p.rect(3.84, 0, 4, 3.6, P.trimT); // pilastras
      p.rect(0, 3.3, 4, 3.6, P.trim); p.rect(0, 3.24, 4, 3.3, P.shadow); // cornija
      const sh = SHUTTERS[Math.floor(r() * SHUTTERS.length)];
      if (v === 0 || v === 2) {
        p.arch(1.2, 0.55, 2.8, 3.0, P.trim);
        p.arch(1.35, 0.65, 2.65, 2.88, P.glass);
        if (v === 2) { // venezianas fechadas
          p.arch(1.35, 0.65, 2.65, 2.88, { ...P.wood, h: 0.45 }, sh);
          for (let y = 0.75; y < 2.3; y += 0.12) p.rect(1.38, y, 2.62, y + 0.04, { ...P.wood, h: 0.3 }, '#1f2b26');
          p.rect(1.97, 0.65, 2.03, 2.5, P.shadow);
        } else {
          p.rect(1.98, 0.65, 2.02, 2.6, P.frame, '#f0ece2'); p.rect(1.35, 1.9, 2.65, 1.94, P.frame, '#f0ece2');
          p.rect(0.62, 0.7, 1.18, 2.55, P.wood, sh); p.rect(2.82, 0.7, 3.38, 2.55, P.wood, sh); // folhas abertas na parede
        }
        p.rect(1.1, 0.48, 2.9, 0.6, P.trim);
      } else if (v === 1) { // porta-balcão com sacada de ferro
        p.rect(1.25, 0.3, 2.75, 2.95, P.trim);
        p.rect(1.4, 0.35, 2.6, 2.8, P.glass);
        p.rect(1.4, 0.35, 1.85, 2.8, P.wood, sh); p.rect(2.15, 0.35, 2.6, 2.8, P.wood, sh);
        p.rect(0.9, 0.12, 3.1, 0.3, P.trim);
        for (let x = 1.0; x < 3.05; x += 0.13) p.rect(x, 0.3, x + 0.035, 1.25, P.iron);
        p.rect(0.95, 1.2, 3.05, 1.27, P.iron); p.rect(0.95, 0.3, 3.05, 0.36, P.iron);
      } else { // janela com frontão
        p.rect(1.2, 0.7, 2.8, 2.6, P.trim);
        p.rect(1.35, 0.8, 2.65, 2.45, P.glass);
        p.rect(1.98, 0.8, 2.02, 2.45, P.frame, '#f0ece2');
        p.rect(1.05, 2.6, 2.95, 2.78, P.trim); p.rect(1.3, 2.78, 2.7, 2.95, P.trim);
        p.rect(1.1, 0.6, 2.9, 0.72, P.trim);
      }
    },
    ground(p, v, r) {
      p.rect(0, 0, 4, 3.6, P.wall);
      p.rect(0, 0, 4, 0.45, P.base);
      p.rect(0, 0, 0.16, 3.6, P.trimT); p.rect(3.84, 0, 4, 3.6, P.trimT);
      p.rect(0, 3.45, 4, 3.6, P.trim);
      if (v === 0) { p.arch(0.85, 0, 3.15, 3.2, P.trim); p.arch(1.0, 0, 3.0, 3.05, P.dark); rollDoor(p, 1.0, 1.35, 3.0, 2.05); p.rect(1.0, 0, 3.0, 1.35, P.glass); }
      else if (v === 1) { p.arch(0.95, 0, 3.05, 3.1, P.trim); p.arch(1.1, 0, 2.9, 2.95, P.wood); for (const x of [1.25, 2.05]) { p.rect(x, 0.3, x + 0.7, 1.3, { ...P.wood, h: 0.55 }, '#6b4630'); p.rect(x, 1.5, x + 0.7, 2.4, { ...P.wood, h: 0.55 }, '#6b4630'); } p.rect(1.98, 0, 2.02, 2.7, P.shadow); }
      else if (v === 2) { p.rect(0.5, 2.55, 3.5, 3.05, P.trim, SIGNS[Math.floor(r() * SIGNS.length)]); windowAl(p, 0.6, 0.45, 3.4, 2.4, 3, r); p.rect(2.3, 0.02, 3.3, 2.4, P.glass); }
      else { rollDoor(p, 0.6, 0.02, 3.4, 2.7); p.rect(0.5, 2.7, 3.5, 2.85, P.trim); }
    },
  },
  modern: {
    bay: 4, floor: 3,
    upper(p, v, r) {
      p.rect(0, 0, 4, 3, P.wall);
      p.rect(0, 0, 4, 0.22, P.trimT);
      if (v === 0) { windowAl(p, 0.1, 0.95, 3.9, 2.55, 4, r); if (r() < 0.8) acUnit(p, 0.3 + r() * 2.6, 0.38); }
      else if (v === 1) { pastilha(p, 0, 0.22, 4, 3, r); windowAl(p, 0.5, 1.0, 1.7, 2.3, 2, r); windowAl(p, 2.3, 1.0, 3.5, 2.3, 2, r); acUnit(p, 0.75, 0.42); if (r() < 0.6) acUnit(p, 2.55, 0.42); }
      else if (v === 2) { windowAl(p, 1.0, 1.0, 3.0, 2.4, 2, r); p.rect(1.0, 1.8, 3.0, 2.4, P.steel, '#c9cbc8'); for (let y = 1.82; y < 2.4; y += 0.07) p.rect(1.0, y, 3.0, y + 0.02, P.shadow); acUnit(p, 3.15, 1.2); }
      else { p.rect(0.05, 0.3, 3.95, 2.9, P.glass); for (let x = 0.2; x < 4; x += 0.5) p.rect(x, 0.22, x + 0.12, 3, P.trimT); }
    },
    ground(p, v, r) {
      p.rect(0, 0, 4, 3, P.wall);
      p.rect(0, 0, 4, 0.3, P.base);
      if (v === 0) { p.rect(0.2, 2.35, 3.8, 2.85, P.trim, SIGNS[Math.floor(r() * SIGNS.length)]); windowAl(p, 0.25, 0.3, 3.75, 2.3, 3, r); }
      else if (v === 1) { rollDoor(p, 0.25, 0.02, 3.75, 2.6); }
      else if (v === 2) { p.rect(0.3, 0.02, 3.7, 2.55, P.dark); windowAl(p, 1.4, 0.02, 2.6, 2.4, 2, r); for (let x = 0.32; x < 3.7; x += 0.14) p.rect(x, 0.02, x + 0.04, 2.55, P.grade); }
      else { p.rect(0.3, 0.02, 3.7, 2.6, P.steel, '#4a4e52'); for (let x = 0.3; x < 3.7; x += 0.3) p.rect(x, 0.02, x + 0.03, 2.6, P.shadow); }
    },
  },
  // casa de bairro: grade nas janelas, porta de aço, portão, varandinha e mercadinho
  casa: {
    bay: 4, floor: 3,
    upper(p, v, r) {
      p.rect(0, 0, 4, 3, P.wall);
      p.rect(0, 0, 4, 0.18, P.trimT);
      const grade = (x0, y0, x1, y1) => { for (let x = x0 + 0.12; x < x1; x += 0.14) p.rect(x, y0, x + 0.035, y1, P.grade); p.rect(x0, y0, x1, y0 + 0.05, P.grade); p.rect(x0, y1 - 0.05, x1, y1, P.grade); };
      if (v === 0) { windowAl(p, 0.8, 1.0, 2.4, 2.3, 2, r); grade(0.8, 1.0, 2.4, 2.3); acUnit(p, 2.8, 1.25); }
      else if (v === 1) { windowAl(p, 0.5, 1.2, 1.5, 2.2, 1, r); windowAl(p, 2.5, 1.5, 3.3, 2.2, 1, r); grade(0.5, 1.2, 1.5, 2.2); }
      else if (v === 2) { p.rect(0.6, 0.18, 3.4, 2.6, P.dark, '#4a3f36'); windowAl(p, 0.8, 0.18, 3.2, 2.45, 2, r); p.rect(0.4, 0.18, 3.6, 0.32, P.trim); for (let x = 0.5; x < 3.6; x += 0.13) p.rect(x, 0.32, x + 0.03, 1.15, P.iron); p.rect(0.4, 1.12, 3.6, 1.18, P.iron); }
      else { p.rect(1.6, 1.8, 2.4, 2.4, P.glass); grade(1.6, 1.8, 2.4, 2.4); }
    },
    ground(p, v, r) {
      p.rect(0, 0, 4, 3, P.wall);
      p.rect(0, 0, 4, 0.35, P.base);
      const grade = (x0, y0, x1, y1) => { for (let x = x0 + 0.1; x < x1; x += 0.13) p.rect(x, y0, x + 0.035, y1, P.grade); p.rect(x0, y1 - 0.05, x1, y1, P.grade); };
      if (v === 0) { p.rect(0.4, 0.02, 1.4, 2.2, P.wood, ['#6b4630', '#3b5f86', '#7a3b2e'][Math.floor(r() * 3)]); p.rect(1.3, 1.1, 1.36, 1.2, P.frame); windowAl(p, 2.0, 0.9, 3.5, 2.1, 2, r); grade(2.0, 0.9, 3.5, 2.1); }
      else if (v === 1) { rollDoor(p, 0.3, 0.02, 3.7, 2.4); }
      else if (v === 2) { p.rect(0.3, 0.02, 3.7, 2.2, P.dark, '#3a3330'); grade(0.3, 0.02, 3.7, 2.2); p.rect(0.3, 2.2, 3.7, 2.3, P.grade); }
      else { rollDoor(p, 0.3, 1.0, 3.7, 2.4); p.rect(0.3, 0.02, 3.7, 1.0, P.dark, '#2f2a26'); p.rect(0.2, 2.45, 3.8, 2.85, P.trim, SIGNS[Math.floor(r() * SIGNS.length)]); }
    },
  },
  // comunidade: casa autoconstruída — reboco pintado, tijolo aparente, meio-acabada e muro grafitado
  comunidade: {
    bay: 4, floor: 3,
    upper(p, v, r) {
      const brick = (x0, y0, x1, y1) => {
        p.rect(x0, y0, x1, y1, P.mortar);
        let row = 0;
        for (let y = y0; y < y1 - 0.01; y += 0.085, row++) for (let x = x0 - (row % 2) * 0.12; x < x1; x += 0.24) {
          const k = r(); p.rect(Math.max(x0, x + 0.012), y + 0.012, Math.min(x1, x + 0.228), Math.min(y1, y + 0.073), P.brick, k < 0.33 ? '#a84f2a' : k < 0.66 ? '#bd6337' : '#9c4826');
        }
      };
      const grade = (x0, y0, x1, y1) => { for (let x = x0 + 0.1; x < x1; x += 0.13) p.rect(x, y0, x + 0.035, y1, P.grade, '#2b5ea8'); p.rect(x0, y0, x1, y0 + 0.05, P.grade, '#2b5ea8'); p.rect(x0, y1 - 0.05, x1, y1, P.grade, '#2b5ea8'); };
      if (v === 0) { p.rect(0, 0, 4, 3, P.wall); windowAl(p, 1.0, 1.1, 2.4, 2.2, 2, r); grade(1.0, 1.1, 2.4, 2.2); }
      else if (v === 1) { brick(0, 0, 4, 3); p.rect(1.3, 1.2, 2.3, 2.2, P.glass, '#4a5f6c'); p.rect(1.25, 1.15, 2.35, 1.22, P.base, '#8f8a82'); }
      else if (v === 2) { p.rect(0, 0, 4, 1.2, P.wall); brick(0, 1.2, 4, 3); windowAl(p, 2.4, 1.4, 3.4, 2.3, 1, r); for (let x = 0.3; x < 2; x += 0.5) p.rect(x, 2.9, x + 0.06, 3.0, P.iron); }
      else {
        p.rect(0, 0, 4, 3, P.wall, '#f2f0ea');
        const C = ['#ff006e', '#3a86ff', '#ffbe0b', '#06d6a0', '#8338ec', '#fb5607'];
        for (let i = 0; i < 7; i++) { const x = 0.2 + r() * 3.2, y = 0.3 + r() * 2.2, w = 0.4 + r() * 1.2; p.arch(x, y, x + w, y + 0.3 + r() * 0.6, P.spray, C[i % C.length]); }
        for (let i = 0; i < 5; i++) { const x = 0.3 + i * 0.7, y = 1.1 + r() * 0.5; p.rect(x, y, x + 0.5, y + 0.5, P.spray, '#111111'); p.rect(x + 0.06, y + 0.06, x + 0.44, y + 0.44, P.spray, C[(i + 2) % C.length]); }
      }
    },
    ground(p, v, r) {
      const C = ['#e63946', '#2a9d8f', '#3a86ff', '#ffbe0b', '#8338ec'];
      if (v === 1 || v === 2) { p.rect(0, 0, 4, 3, P.mortar); for (let y = 0, row = 0; y < 3; y += 0.085, row++) for (let x = -(row % 2) * 0.12; x < 4; x += 0.24) p.rect(Math.max(0, x + 0.012), y + 0.012, Math.min(4, x + 0.228), Math.min(3, y + 0.073), P.brick, r() < 0.5 ? '#a84f2a' : '#b85e33'); }
      else p.rect(0, 0, 4, 3, P.wall);
      p.rect(0, 0, 4, 0.25, P.base, '#6f6a62');
      if (v === 0) { p.rect(0.4, 0.02, 1.4, 2.15, P.wood, C[Math.floor(r() * C.length)]); windowAl(p, 2.0, 0.95, 3.4, 2.0, 2, r); for (let x = 2.08; x < 3.4; x += 0.13) p.rect(x, 0.95, x + 0.035, 2.0, P.grade, '#2b5ea8'); }
      else if (v === 1) { rollDoor(p, 0.3, 0.02, 3.7, 2.3); p.rect(0.2, 2.35, 3.8, 2.8, P.trim, C[Math.floor(r() * C.length)]); }
      else if (v === 2) { p.rect(0.5, 0.02, 1.5, 2.1, P.iron, '#2b5ea8'); for (let y = 0.2; y < 2.1; y += 0.25) p.rect(0.5, y, 1.5, y + 0.04, P.grade); p.rect(2.2, 1.0, 3.3, 1.9, P.glass, '#4a5f6c'); }
      else { p.rect(0.3, 0.02, 3.7, 2.2, P.dark, '#3a3330'); for (let x = 0.38; x < 3.7; x += 0.14) p.rect(x, 0.02, x + 0.04, 2.2, P.grade, C[Math.floor(r() * C.length)]); p.rect(0.3, 2.2, 3.7, 2.28, P.grade); }
    },
  },
  tower: {
    bay: 6, floor: 3,
    upper(p, v, r) {
      p.rect(0, 0, 6, 3, P.wall);
      if (v <= 1) { // varanda
        pastilha(p, 0, 0, 0.7, 3, r); pastilha(p, 5.3, 0, 6, 3, r);
        // fundo da varanda à sombra, mas claro: nas fotos da orla as torres são brancas, não escuras
        p.rect(0.7, 0.2, 5.3, 2.75, P.dark, '#a3a8aa');
        windowAl(p, 0.95, 0.2, 5.05, 2.55, 4, r);
        p.rect(0.6, 0, 5.4, 0.2, P.trim);
        if (v === 0) { p.rect(0.7, 0.2, 5.3, 1.15, P.rail); p.rect(0.7, 1.12, 5.3, 1.18, P.frame); }
        else { for (let x = 0.75; x < 5.3; x += 0.12) p.rect(x, 0.2, x + 0.03, 1.15, P.iron, '#dcdcd8'); p.rect(0.7, 1.12, 5.3, 1.18, P.frame); }
        if (r() < 0.5) acUnit(p, 4.3, 1.9);
      } else if (v === 2) { pastilha(p, 0, 0, 6, 3, r); windowAl(p, 0.8, 1.0, 2.6, 2.4, 2, r); windowAl(p, 3.4, 1.0, 5.2, 2.4, 2, r); acUnit(p, 1.3, 0.45); acUnit(p, 3.95, 0.45); }
      // varanda gourmet (a das torres novas de Boa Viagem, Graças e Casa Forte): laje branca grossa marcando o andar,
      // guarda-corpo de vidro esverdeado, porta de correr ao fundo e, às vezes, jardineira; um pilar de reboco com
      // janelinha de serviço num canto. Antes era parede com três janelas e ar-condicionado, que da rua parecia
      // prédio de escritório
      else {
        p.rect(4.6, 0, 6, 3, P.wall); windowAl(p, 4.95, 1.35, 5.65, 2.25, 1, r);
        p.rect(0, 0.3, 4.6, 2.8, P.dark, '#9aa1a3');                 // fundo da varanda à sombra
        windowAl(p, 0.35, 0.3, 4.25, 2.6, 3, r);                    // porta de correr
        p.rect(0, 0.3, 4.6, 1.3, P.rail, '#c3cfcd');                // guarda-corpo de vidro
        p.rect(0, 1.26, 4.6, 1.32, P.frame);
        if (r() < 0.45) { p.rect(0.2, 0.3, 1.6, 0.62, P.wood, '#6b4630'); for (let x = 0.25; x < 1.55; x += 0.18) p.rect(x, 0.6, x + 0.14, 0.82, P.wood, '#3f7a3a'); } // jardineira
        p.rect(0, 0, 6, 0.3, P.trimT);                              // laje
        p.rect(0, 2.8, 4.6, 3, P.trimT);
      }
    },
    ground(p, v, r) {
      p.rect(0, 0, 6, 3, P.wall);
      p.rect(0, 2.6, 6, 3, P.trimT);
      if (v === 0) { p.rect(0, 0, 6, 2.6, P.dark, '#2c2e30'); windowAl(p, 1.2, 0.02, 4.8, 2.5, 4, r); p.rect(0, 0, 0.5, 2.6, P.trimT); p.rect(5.5, 0, 6, 2.6, P.trimT); }
      else if (v === 1) { p.rect(0, 0, 6, 2.6, P.dark); p.rect(0, 0, 6, 0.5, P.base); for (let x = 0.05; x < 6; x += 0.15) p.rect(x, 0.5, x + 0.04, 2.6, P.grade); p.rect(0, 2.5, 6, 2.6, P.grade); }
      else if (v === 2) { pastilha(p, 0, 0, 6, 2.6, r); p.rect(1.5, 0.02, 4.5, 2.3, P.steel, '#3f4347'); for (let x = 1.5; x < 4.5; x += 0.2) p.rect(x, 0.02, x + 0.05, 2.3, P.shadow); }
      else { p.rect(0, 0, 6, 2.6, P.glass); for (let x = 0; x <= 6; x += 2) p.rect(x - 0.05, 0, x + 0.05, 2.6, P.frame); p.rect(-0.1, 2.45, 6.1, 2.7, P.trim); }
    },
  },
};

let dirtCache = null;
function dirtField(W, H) {
  if (dirtCache) return dirtCache;
  const nf = new Float32Array(W * H), sf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    nf[y * W + x] = fbm(x / 6, y / 6, W / 6, 3, 3) - 0.5;
    sf[y * W + x] = fbm(x / 3, y / 60, W / 3, 9, 2);
  }
  return (dirtCache = { nf, sf });
}

export function facadeAtlas(kind, seed = 7) {
  const d = DESIGNS[kind], W = S * 4, H = S * 2;
  const col = canvas(W, H).getContext('2d'), rm = canvas(W, H).getContext('2d'), hgt = canvas(W, H).getContext('2d');
  const r = rand(seed * 977 + kind.length);
  for (let v = 0; v < 4; v++) {
    for (const [row, fn] of [[0, d.upper], [1, d.ground]]) { // linha 0 do canvas = em cima = andar-tipo
      const p = painter(v, row, d.bay, d.floor, { col, rm, hgt });
      p.clip(() => fn(p, v, r));
    }
  }
  // sujeira e textura do reboco: ruído fino + escorrido embaixo das janelas
  const img = col.getImageData(0, 0, W, H), px = img.data, hi = hgt.getImageData(0, 0, W, H), hp = hi.data;
  const { nf, sf } = dirtField(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x, i = j * 4;
    const n = nf[j], streak = sf[j];
    const k = 1 + n * 0.14 - Math.max(0, streak - 0.55) * 0.35;
    px[i] *= k; px[i + 1] *= k; px[i + 2] *= k;
    hp[i] = Math.max(0, Math.min(255, hp[i] + n * 18));
  }
  col.putImageData(img, 0, 0); hgt.putImageData(hi, 0, 0);
  const normal = normalFrom(heightOf(hgt.canvas), W, H, 3);
  return { map: tex(col.canvas), rm: tex(rm.canvas, false), normal: tex(normal, false) };
}

// ---------------------------------------------------------------- asfalto e calçadas das ruas
// u = atravessa a rua (0..1), v = ao longo (1 volta = 8 m). Grão, remendos, trilho dos pneus e sarjeta.
let grainCache = null;
function grain(w, h) {
  if (grainCache) return grainCache;
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fine = h2(x, y, 5), mid = fbm(x / 5, y / 5, w / 5, 11, 3);
    g[y * w + x] = fine * 0.45 + mid * 0.55;
  }
  return (grainCache = g);
}
export function roadSet(kind) {
  const W = 256, H = 1024, c = canvas(W, H), g = c.getContext('2d');
  const gr = grain(W, H), r = rand(kind.length * 131 + 3);
  const base = { stone: [196, 182, 154], foot: [204, 199, 190], cycle: [168, 76, 68], runway: [98, 99, 101], taxi: [102, 103, 105] }[kind] || [92, 92, 95];
  const img = g.createImageData(W, H), d = img.data, hf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, gv = gr[i];
    let k = 0.8 + gv * 0.4;
    const u = x / W;
    if (kind !== 'stone' && kind !== 'foot') {
      const macro = fbm(x / 40, y / 40, W / 40, 21, 3);
      k *= 0.9 + macro * 0.2;
      if (!['runway', 'taxi', 'cycle'].includes(kind)) {
        // trilho dos pneus mais escuro e liso, sarjeta suja nas bordas
        const tracks = Math.exp(-(((u - 0.32) / 0.07) ** 2)) + Math.exp(-(((u - 0.68) / 0.07) ** 2));
        k *= 1 - tracks * 0.08;
        k *= 1 - Math.max(0, 0.06 - Math.min(u, 1 - u)) * 4;
      }
    }
    d[i * 4] = base[0] * k; d[i * 4 + 1] = base[1] * k; d[i * 4 + 2] = base[2] * k; d[i * 4 + 3] = 255;
    hf[i] = gv;
  }
  g.putImageData(img, 0, 0);
  const H8 = (m) => (m / 8) * H; // metros → pixels ao longo
  if (kind === 'marked' || kind === 'plain') {
    // remendos de asfalto e rachaduras
    for (let n = 0; n < 4; n++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,20,22' : '90,90,92'},${0.12 + r() * 0.12})`; g.fillRect(r() * W * 0.8, r() * H, 20 + r() * 80, 40 + r() * 160); }
    g.strokeStyle = 'rgba(15,15,15,0.55)'; g.lineWidth = 1.2;
    for (let n = 0; n < 6; n++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 14; s++) { x += (r() - 0.5) * 14; y += r() * 14; g.lineTo(x, y); } g.stroke(); }
  }
  const paint = (x0, x1, y0, y1, color) => { g.fillStyle = color; for (let y = y0; y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) if (h2(x, y, 77) > 0.12) g.fillRect(x, y, 1, 1); };
  const worn = (a) => `rgba(236,236,230,${a})`;
  if (kind === 'marked') {
    paint(W / 2 - 7, W / 2 - 3, 0, H, 'rgba(232,190,60,0.92)'); paint(W / 2 + 3, W / 2 + 7, 0, H, 'rgba(232,190,60,0.92)');
    paint(5, 9, 0, H, worn(0.85)); paint(W - 9, W - 5, 0, H, worn(0.85));
  }
  if (kind === 'plain') for (let y = 0; y < H; y += H8(4)) paint(W / 2 - 2.5, W / 2 + 2.5, y, y + H8(2), worn(0.8));
  if (kind === 'runway') { for (let y = 0; y < H; y += H8(4)) paint(W / 2 - 3, W / 2 + 3, y, y + H8(2.2), worn(0.9)); paint(2, 5, 0, H, worn(0.9)); paint(W - 5, W - 2, 0, H, worn(0.9)); }
  if (kind === 'taxi') paint(W / 2 - 2.5, W / 2 + 2.5, 0, H, 'rgba(232,190,60,0.9)');
  if (kind === 'stone' || kind === 'foot') {
    // paralelepípedo (calçadão) ou placas de concreto (calçada)
    const cw = kind === 'stone' ? 18 : 128, chh = kind === 'stone' ? 26 : 128;
    for (let y = 0; y < H; y += chh) {
      const off = kind === 'stone' && (y / chh) % 2 ? cw / 2 : 0;
      for (let x = -cw; x < W; x += cw) {
        const t = 0.85 + r() * 0.3;
        g.fillStyle = `rgba(${t > 1 ? '255,255,255' : '0,0,0'},${Math.abs(t - 1) * 0.6})`; g.fillRect(x + off + 1, y + 1, cw - 2, chh - 2);
        g.fillStyle = 'rgba(40,34,28,0.55)'; g.fillRect(x + off, y, cw, 2); g.fillRect(x + off, y, 2, chh);
        for (let yy = y; yy < Math.min(H, y + chh); yy++) for (let xx = Math.max(0, x + off); xx < Math.min(W, x + off + cw); xx++) {
          const e = Math.min(xx - (x + off), yy - y, x + off + cw - xx, y + chh - yy);
          hf[yy * W + xx] = hf[yy * W + xx] * 0.3 + Math.min(1, e / 4) * 0.7;
        }
      }
    }
  }
  return { map: tex(c, true, 12), normal: tex(normalFrom(hf, W, H, kind === 'stone' || kind === 'foot' ? 2.5 : 1.4), false, 12) };
}

// ---------------------------------------------------------------- telhado (laje com manchas ou telha)
export function roofSet() {
  const N = 512, c = canvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, hf = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const stain = fbm(x / 40, y / 40, N / 40, 31, 4), fine = h2(x, y, 32);
    const k = 0.78 + stain * 0.35 + fine * 0.08 - Math.max(0, 0.4 - stain) * 0.5;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.min(255, k * 220); d[i * 4 + 3] = 255;
    hf[i] = fine * 0.5 + stain * 0.5;
  }
  g.putImageData(img, 0, 0);
  return { map: tex(c, true, 8), normal: tex(normalFrom(hf, N, N, 1.5), false, 8) };
}

// ---------------------------------------------------------------- folhagem (copa das árvores)
export function leafSet() {
  const N = 256, c = canvas(N, N), g = c.getContext('2d'), hgt = canvas(N, N).getContext('2d');
  g.fillStyle = '#7d8174'; g.fillRect(0, 0, N, N); // neutro: a cor vem de cada árvore
  hgt.fillStyle = '#000'; hgt.fillRect(0, 0, N, N);
  const r = rand(4242);
  for (let n = 0; n < 2600; n++) {
    const x = r() * N, y = r() * N, a = r() * Math.PI, s = 3 + r() * 5, l = 0.55 + r() * 0.6;
    for (const [ctx, style] of [[g, `rgb(${175 * l + 45},${185 * l + 50},${150 * l + 40})`], [hgt, `rgb(${255 * l * 0.8},${255 * l * 0.8},${255 * l * 0.8})`]]) {
      for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) {
        ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(a); ctx.fillStyle = style;
        ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }
  return { map: tex(c, true, 4), normal: tex(normalFrom(heightOf(hgt.canvas), N, N, 4), false, 4) };
}

export function barkSet() {
  const W = 128, H = 256, c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, hf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = fbm(x / 4, y / 22, W / 4, 41, 4);
    const k = 0.55 + v * 0.7;
    d[i * 4] = 98 * k; d[i * 4 + 1] = 82 * k; d[i * 4 + 2] = 66 * k; d[i * 4 + 3] = 255;
    hf[i] = v;
  }
  g.putImageData(img, 0, 0);
  return { map: tex(c, true, 4), normal: tex(normalFrom(hf, W, H, 4), false, 4) };
}
