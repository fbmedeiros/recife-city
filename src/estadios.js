// Os três estádios do Trio de Ferro refeitos a partir de fotos aéreas:
// - Arruda (Santa Cruz): oval grandão de concreto, anel inferior escuro, anel superior com blocos de cadeira
//   vermelhos, brancos e pretos, fosso cinza em volta do gramado, fachada de concreto com nervuras; do lado, o
//   parque aquático e o campinho do clube.
// - Aflitos (Náutico): retângulo de cantos arredondados colado no campo, cadeiras vermelhas com fileiras brancas,
//   "NÁUTICO" escrito nas cadeiras atrás do gol, cobertura escura numa lateral, muro branco com faixa vermelha.
// - Ilha do Retiro (Sport): arquibancada em volta toda com faixas vermelhas e pretas, a social mais alta e coberta
//   numa lateral, refletores nas quatro quinas e o parque aquático do clube ao lado.
// A arquibancada é gerada por degraus seguindo uma superelipse (forma do estádio) ajustada ao contorno do OSM.
import * as THREE from 'three';
import { obb, ringOf } from './classics.js';
import { stampPoint, stampDisc } from './collide.js';

export const ESTADIOS = {
  'Estádio José do Rêgo Maciel - Arruda': {
    poi: 'Arruda (Santa Cruz)', n: 2.1, apron: 9, gate: 0.5, facade: 'arruda',
    // anel inferior (escuro) + circulação + anel superior colorido, fachada alta
    tiers: [{ d0: 0, d1: 17, h0: 1.0, h1: 9.5, rows: 14 }, { d0: 21, d1: 40, h0: 13, h1: 29, rows: 16 }],
    wall: { h: 31, color: '#bdb6a8', ribs: true, band: '#e9e6df' },
    color: (a, t, r) => {
      if (t === 0) return r % 4 === 0 ? '#3a3a3a' : '#2a2a2a';
      const s = Math.floor(((a / (Math.PI * 2)) * 24 + 24) % 24); // 24 setores de cadeira
      const blocks = ['#c8102e', '#c8102e', '#f2f0ea', '#161616', '#c8102e', '#f2f0ea', '#161616', '#161616'];
      return blocks[s % blocks.length];
    },
    masts: 4, club: true,
  },
  'Estádio Eládio de Barros Carvalho': {
    poi: 'Estádio dos Aflitos', n: 4.2, apron: 3, gate: Math.PI * 0.5, facade: 'aflitos',
    gateRoad: /Rosa e Silva/, // a sede do Náutico dá pra Av. Conselheiro Rosa e Silva (não pra rua mais perto)
    tiers: [{ d0: 0, d1: 24, h0: 0.8, h1: 13, rows: 20 }],
    wall: { h: 14.5, color: '#f4f2ee', stripe: '#c8102e' },
    color: (a, t, r) => (r % 5 === 4 ? '#f4f2ee' : r % 2 ? '#c8102e' : '#b70d29'),
    roof: (a) => Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.75, // uma lateral coberta
    roofColor: '#3a3d40', roofDepth: 0.68, word: { text: 'NÁUTICO', at: Math.PI, fg: '#ffffff', bg: '#c8102e' },
    masts: 4,
  },
  'Estádio Adelmar da Costa Carvalho': {
    poi: 'Ilha do Retiro (Sport)', n: 3.6, apron: 5, gate: -Math.PI * 0.5, facade: 'ilha',
    tiers: [{ d0: 0, d1: 30, h0: 0.8, h1: 16, rows: 22 }],
    tall: (a) => Math.max(0, Math.cos(a - Math.PI / 2)) ** 2 * 7, // a social sobe mais
    wall: { h: 17.5, color: '#2b2b2b', stripe: '#c8102e' },
    // faixas diagonais vermelhas e pretas
    color: (a, t, r) => { const s = Math.floor(((a / (Math.PI * 2)) * 48 + 48) % 48); return (s + Math.floor(r / 3)) % 2 ? '#c8102e' : '#141414'; },
    roof: (a) => Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.85,
    roofColor: '#d9d6cf', masts: 4, club: true,
  },
};

const sgnPow = (v, p) => Math.sign(v) * Math.abs(v) ** p;
const FOOT = new Set(['pedestrian', 'footway', 'path', 'steps', 'cycleway', 'track']);

// antes da grade de colisão: acha a rua de carro mais perto de cada estádio (lado da entrada) e abre o largo da
// frente, tirando as caixas de prédio sem nome entre a fachada e a rua
// pontos a cada ~8 m (a avenida pode ter vértices longe um do outro)
const densify = (p) => { const out = []; for (let i = 0; i < p.length - 1; i++) { const [ax, az] = p[i], [bx, bz] = p[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 8)); for (let j = 0; j < n; j++) out.push([ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n]); } if (p.length) out.push(p[p.length - 1]); return out; };
export function pruneEstadios(data) {
  data.stadiumGate = {};
  const roads = data.roads.filter((r) => !r.tu && !FOOT.has(r.k));
  for (const [name, S] of Object.entries(ESTADIOS)) {
    const b = data.buildings.find((q) => q.n === name); if (!b) continue;
    const o = obb(ringOf(b)), R = Math.max(o.len, o.wid) / 2;
    let best = null;
    const rs = S.gateRoad ? roads.filter((r) => S.gateRoad.test(r.n || '')) : roads;
    for (const r of rs) for (const [x, z] of densify(r.p)) {
      const dx = x - o.cx, dz = z - o.cz, d = Math.hypot(dx, dz); if (d < R * 0.85 || d > R + (S.gateRoad ? 220 : 140)) continue;
      // fora do contorno do estádio (elipse aproximada)
      const lx = dx * o.ux + dz * o.uz, lz = -dx * o.uz + dz * o.ux; if ((lx / (o.len / 2)) ** 2 + (lz / (o.wid / 2)) ** 2 < 1.15) continue;
      if (!best || d < best.d) best = { d, ux: dx / d, uz: dz / d };
    }
    if (!best) continue;
    data.stadiumGate[name] = best;
    // o largo da frente não recebe casa gerada
    const px = -best.uz, pz = best.ux, t0 = R * 0.6, t1 = best.d + 6, C = (t, w) => [o.cx + best.ux * t + px * w, o.cz + best.uz * t + pz * w];
    (data.noInfill ||= []).push([C(t0, -45), C(t1, -45), C(t1, 45), C(t0, 45)]);
    data.buildings = data.buildings.filter((q) => {
      if (q.n) return true;
      const cx = q.p.reduce((s2, p) => s2 + p[0], 0) / q.p.length, cz = q.p.reduce((s2, p) => s2 + p[1], 0) / q.p.length;
      const t = (cx - o.cx) * best.ux + (cz - o.cz) * best.uz, w = Math.abs(-(cx - o.cx) * best.uz + (cz - o.cz) * best.ux);
      return !(t > R * 0.6 && t < best.d + 6 && w < 45);
    });
  }
}

export function buildEstadios(group, data, env) {
  const anim = [];
  for (const [name, S] of Object.entries(ESTADIOS)) {
    const b = data.buildings.find((q) => q.n === name); if (!b) continue;
    const o = obb(ringOf(b)), rot = Math.atan2(-o.uz, o.ux), cos = Math.cos(rot), sin = Math.sin(rot);
    const toW = (x, z) => [o.cx + x * cos + z * sin, o.cz - x * sin + z * cos];
    const top = S.tiers.at(-1);
    const D = top.d1 + 1.5;
    // curva-base (borda do gramado + recuo): o contorno externo coincide com o do OSM
    const A = Math.max(56 + S.apron, o.len / 2 - D), B = Math.max(37 + S.apron, o.wid / 2 - D), p2 = 2 / S.n;
    const base = (a) => [A * sgnPow(Math.cos(a), p2), B * sgnPow(Math.sin(a), p2)];
    const normal = (a) => { const [x0, z0] = base(a - 1e-3), [x1, z1] = base(a + 1e-3), [x, z] = base(a); let nx = z1 - z0, nz = -(x1 - x0); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if (nx * x + nz * z < 0) { nx = -nx; nz = -nz; } return [nx, nz]; };
    const at = (a, d) => { const [x, z] = base(a), [nx, nz] = normal(a); return [x + nx * d, z + nz * d]; };

    // ---------------- entrada principal: o lado do estádio que fica mais perto de uma pista de carro
    let gateA = S.gate, best = Infinity;
    const G = data.stadiumGate?.[name];
    if (G) { const lx = G.ux * cos - G.uz * sin, lz = G.ux * sin + G.uz * cos; gateA = Math.atan2(lz / B, lx / A); best = -1; }
    for (let i = 0; i < 72 && best >= 0; i++) { const a = (i / 72) * Math.PI * 2; for (let r = 3; r < 60 && r < best; r += 2) { const [x, z] = at(a, D + r), [wx, wz] = toW(x, z); if (env.isDrive?.(wx, wz)) { best = r; gateA = a; break; } } }

    // ---------------- arquibancada em degraus (cor por vértice)
    const pos = [], col = [], c = new THREE.Color();
    const quad = (p, q, r, s, color) => { c.set(color); for (const v of [p, q, r, p, r, s]) { pos.push(...v); col.push(c.r, c.g, c.b); } };
    // caixa de p0 a p1 (eixo), largura w no sentido "lado" e espessura t
    const box = (p0, p1, w, t, color, side) => {
      const u = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).normalize(), sd = new THREE.Vector3(...side).normalize(), n = new THREE.Vector3().crossVectors(u, sd).normalize();
      const C = (P, a, b) => [P[0] + sd.x * a + n.x * b, P[1] + sd.y * a + n.y * b, P[2] + sd.z * a + n.z * b];
      const v = [C(p0, -w / 2, -t / 2), C(p0, w / 2, -t / 2), C(p0, w / 2, t / 2), C(p0, -w / 2, t / 2), C(p1, -w / 2, -t / 2), C(p1, w / 2, -t / 2), C(p1, w / 2, t / 2), C(p1, -w / 2, t / 2)];
      for (const [a, b2, c2, d2] of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [3, 2, 1, 0]]) quad(v[a], v[b2], v[c2], v[d2], color);
    };
    const N = 128;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
      const extra = S.tall ? S.tall(am) : 0;
      S.tiers.forEach((T, t) => {
        const last = t === S.tiers.length - 1, h1 = T.h1 + (last ? extra : 0), d1 = T.d1 + (last ? extra * 0.6 : 0);
        for (let r = 0; r < T.rows; r++) {
          const da = T.d0 + ((d1 - T.d0) * r) / T.rows, db = T.d0 + ((d1 - T.d0) * (r + 1)) / T.rows;
          const ha = T.h0 + ((h1 - T.h0) * r) / T.rows, hb = T.h0 + ((h1 - T.h0) * (r + 1)) / T.rows;
          const [x0a, z0a] = at(a0, da), [x1a, z1a] = at(a1, da), [x0b, z0b] = at(a0, db), [x1b, z1b] = at(a1, db);
          const seat = S.color(am, t, r), riser = new THREE.Color(seat).multiplyScalar(0.62).getStyle();
          quad([x0a, ha, z0a], [x1a, ha, z1a], [x1a, hb, z1a], [x0a, hb, z0a], riser);   // espelho do degrau
          quad([x0a, hb, z0a], [x1a, hb, z1a], [x1b, hb, z1b], [x0b, hb, z0b], seat);    // piso do degrau (cadeiras)
        }
        // parede de trás do degrau mais alto e laje entre os anéis
        const [x0, z0] = at(a0, d1), [x1, z1] = at(a1, d1);
        quad([x0, h1, z0], [x1, h1, z1], [x1, 0, z1], [x0, 0, z0], '#8f8a80');
        if (t === 0 && S.tiers[1]) { const [y0, w0] = at(a0, S.tiers[1].d0), [y1, w1] = at(a1, S.tiers[1].d0); quad([x0, h1, z0], [x1, h1, z1], [y1, S.tiers[1].h0, w1], [y0, S.tiers[1].h0, w0], '#a8a196'); }
      });
      // fachada de quem vê da rua (cada estádio a sua)
      facade(S.facade, i, a0, a1, D + extra * 0.6, S.wall.h + extra, quad, at, box);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const g = new THREE.Group(); g.position.set(o.cx, 0, o.cz); g.rotation.y = rot; group.add(g);
    const bowl = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }));
    bowl.castShadow = bowl.receiveShadow = true; g.add(bowl);

    // ---------------- gramado listrado com as linhas e o fosso/recuo em volta
    const ct = document.createElement('canvas'); ct.width = 1024; ct.height = 664; const cg = ct.getContext('2d');
    for (let i = 0; i < 14; i++) { cg.fillStyle = i % 2 ? '#3f8f3a' : '#4aa244'; cg.fillRect((i * 1024) / 14, 0, 1024 / 14 + 1, 664); }
    cg.strokeStyle = '#f4f4f0'; cg.lineWidth = 5; cg.strokeRect(14, 14, 996, 636); cg.beginPath(); cg.moveTo(512, 14); cg.lineTo(512, 650); cg.stroke();
    cg.beginPath(); cg.arc(512, 332, 88, 0, Math.PI * 2); cg.stroke();
    for (const x of [14, 1010 - 160]) { cg.strokeRect(x, 152, 160, 360); cg.strokeRect(x === 14 ? 14 : 1010 - 54, 246, 54, 172); }
    const pt = new THREE.CanvasTexture(ct); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = 8;
    const apronShape = new THREE.Shape(); for (let i = 0; i <= 96; i++) { const [x, z] = base((i / 96) * Math.PI * 2); i ? apronShape.lineTo(x, -z) : apronShape.moveTo(x, -z); }
    const apron = new THREE.Mesh(new THREE.ShapeGeometry(apronShape).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: S.apron > 6 ? '#8d8a84' : '#4a9a42', roughness: 0.95 }));
    apron.position.y = 0.09; apron.receiveShadow = true; g.add(apron);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 68).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9 }));
    pitch.position.y = 0.12; pitch.receiveShadow = true; g.add(pitch);
    // traves
    const white = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.4 });
    for (const sx of [-1, 1]) { const tg = new THREE.Group(); for (const z of [-3.66, 3.66]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 8), white); p.position.set(0, 1.22, z); tg.add(p); } const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 7.44), white); bar.position.y = 2.44; tg.add(bar); tg.position.x = sx * 52.5; g.add(tg); }

    // ---------------- nome escrito nas cadeiras (Aflitos)
    if (S.word) {
      const T = S.tiers[0], w = document.createElement('canvas'); w.width = 1024; w.height = 220; const wg = w.getContext('2d');
      wg.fillStyle = S.word.bg; wg.fillRect(0, 0, 1024, 220); wg.fillStyle = S.word.fg; wg.font = 'bold 170px Arial Black, Arial'; wg.textAlign = 'center'; wg.textBaseline = 'middle'; wg.fillText(S.word.text, 512, 118);
      const wt = new THREE.CanvasTexture(w); wt.colorSpace = THREE.SRGBColorSpace;
      const dm = (T.d0 + T.d1) / 2, hm = (T.h0 + T.h1) / 2 + 0.35, [x, z] = at(S.word.at, dm), slope = Math.atan2(T.h1 - T.h0, T.d1 - T.d0);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(B * 1.05, (T.d1 - T.d0) * 0.8 / Math.cos(slope)), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4 }));
      const ang = Math.atan2(...normal(S.word.at)); // de frente pro campo
      pl.rotation.order = 'YXZ'; pl.rotation.set(-(Math.PI / 2 - slope), ang + Math.PI, 0); pl.position.set(x, hm, z); g.add(pl);
    }
    // ---------------- cobertura (social)
    if (S.roof) {
      const rpos = [], rm = new THREE.MeshStandardMaterial({ color: S.roofColor, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
      const post = new THREE.MeshStandardMaterial({ color: '#7b7b78', metalness: 0.5 });
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2; if (!S.roof(am)) continue;
        const extra = S.tall ? S.tall(am) : 0, T = S.tiers.at(-1), dOut = T.d1 + extra * 0.6 + 1, dIn = T.d1 * (S.roofDepth ?? 0.42), hr = T.h1 + extra + 5;
        const [x0, z0] = at(a0, dIn), [x1, z1] = at(a1, dIn), [y0, w0] = at(a0, dOut), [y1, w1] = at(a1, dOut);
        rpos.push(x0, hr - 1.5, z0, x1, hr - 1.5, z1, y1, hr, w1, x0, hr - 1.5, z0, y1, hr, w1, y0, hr, w0);
        if (i % 6 === 0) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, hr, 8), post); p.position.set(y0, hr / 2, w0); p.castShadow = true; g.add(p); }
      }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3)); rg.computeVertexNormals();
      const roof = new THREE.Mesh(rg, rm); roof.castShadow = true; g.add(roof);
    }
    // ---------------- refletores nas quinas
    const lampMat = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff3c4', emissiveIntensity: 0.25 }), mastMat = new THREE.MeshStandardMaterial({ color: '#9a9a96', metalness: 0.5, roughness: 0.4 });
    for (let k = 0; k < (S.masts || 0); k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2, [x, z] = at(a, D + 4), H = S.wall.h + 22;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, H, 10), mastMat); m.position.set(x, H / 2, z); m.castShadow = true; g.add(m);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.6), lampMat); panel.position.set(x, H + 1.5, z); panel.rotation.set(0, Math.atan2(-x, -z), 0); g.add(panel);
    }

    // ---------------- sede / entrada principal, de frente pra rua
    // distância da curva-base até a rua da entrada (para a sede ficar na calçada da avenida, quando for o caso)
    const roadOff = G ? G.d - Math.hypot(...base(gateA)) : null;
    const sideSign = entrance(S.facade, g, at, normal, gateA, D, S.wall.h, toW, env, roadOff);
    const walkA = gateA - sideSign * 0.22; // o portão de pedestre fica do outro lado da sede

    // ---------------- colisão: só a arquibancada e o muro; um portão por onde o jogador entra a pé
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - walkA), Math.cos(a - walkA))) < 0.035) continue;
      for (let d = 0.5; d <= D + 0.6; d += 0.8) { const [x, z] = at(a, d), [wx, wz] = toW(x, z); stampPoint(wx, wz); }
    }
    for (let k = 0; k < (S.masts || 0); k++) { const [x, z] = at(Math.PI / 4 + (k * Math.PI) / 2, D + 4), [wx, wz] = toW(x, z); stampDisc(wx, wz, 0.8); }

    // ---------------- clube do lado: piscinas e campinho (Arruda e Ilha)
    if (S.club) {
      const free = (x, z) => !env.isSolid(x, z) && !env.isWater(x, z) && !env.isRoad?.(x, z);
      let spot = null;
      for (let r = Math.max(o.len, o.wid) / 2 + 22; r < Math.max(o.len, o.wid) / 2 + 110 && !spot; r += 6) for (let i = 0; i < 24 && !spot; i++) {
        const a = (i / 24) * Math.PI * 2, x = o.cx + Math.cos(a) * r, z = o.cz + Math.sin(a) * r;
        let ok = true; for (let dx = -18; dx <= 18 && ok; dx += 6) for (let dz = -12; dz <= 12 && ok; dz += 6) if (!free(x + dx, z + dz)) ok = false;
        if (ok) spot = [x, z];
      }
      if (spot) {
        const cg2 = new THREE.Group(); cg2.position.set(spot[0], 0, spot[1]); group.add(cg2);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(38, 0.3, 26), new THREE.MeshStandardMaterial({ color: '#e9e2d4', roughness: 0.8 })); deck.position.y = 0.15; deck.receiveShadow = true; cg2.add(deck);
        const water = new THREE.MeshStandardMaterial({ color: '#3fb6d6', roughness: 0.05, metalness: 0.2, emissive: '#0b3a46' });
        const pool = new THREE.Mesh(new THREE.BoxGeometry(25, 0.1, 12), water); pool.position.set(-4, 0.33, -4); cg2.add(pool);
        const kid = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.1, 28), water); kid.position.set(12, 0.33, 6); cg2.add(kid);
        const slide = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 9), new THREE.MeshStandardMaterial({ color: '#f2b705' })); slide.position.set(14, 2, -6); slide.rotation.x = 0.45; cg2.add(slide);
        for (let i = 0; i < 6; i++) { const u = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.5, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? '#c8102e' : '#f4f2ee' })); u.position.set(-14 + i * 4.4, 2.4, 9); cg2.add(u); const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), mastMat); pl.position.set(-14 + i * 4.4, 1.15, 9); cg2.add(pl); }
      }
    }
    if (!data.pois.some((p) => p.name === S.poi)) data.pois.push({ name: S.poi, kind: 'attraction', x: o.cx, z: o.cz });
  }
  return anim;
}

// ---------------------------------------------------------------- fachadas (vistas da rua), um pedaço por segmento
function facade(kind, i, a0, a1, D, H, quad, at, box) {
  const P = (a, d, y) => { const [x, z] = at(a, d); return [x, y, z]; };
  const front = (d, y0, y1, color) => quad(P(a1, d, y0), P(a0, d, y0), P(a0, d, y1), P(a1, d, y1), color);
  const am = (a0 + a1) / 2, [sx0, sz0] = at(a0, D), [sx1, sz1] = at(a1, D), side = [sx1 - sx0, 0, sz1 - sz0];
  if (kind === 'arruda') {
    // concreto aparente: plano escuro recuado (vãos da circulação), faixas brancas e pilar em todo segmento
    front(D - 0.9, 0, H, '#3b3a37');
    front(D + 0.02, 0, 1.2, '#a8a196'); front(D + 0.02, 11.4, 13.6, '#e2ded5'); front(D + 0.02, H - 2.4, H, '#e2ded5');
    quad(P(a0, D + 0.02, H), P(a0, D - 1.2, H), P(a1, D - 1.2, H), P(a1, D + 0.02, H), '#d8d3c8');
    box(P(am, D - 0.4, 0), P(am, D - 0.4, H - 2.4), 1.3, 1.4, '#bdb6a8', side);
    if (i % 4 === 0) box(P(am, D - 0.3, 5.6), P(am, D - 0.3, 6.2), 4.6, 1.6, '#b2ab9e', side); // laje de rampa interna aparecendo
  } else if (kind === 'aflitos') {
    // muro branco, painéis vermelhos embaixo alternando, faixa vermelha no alto, pilarzinho a cada dois
    front(D, 0, H, '#f4f2ee');
    if (i % 2 === 0) front(D + 0.03, 0.4, 4.2, '#c8102e');
    front(D + 0.04, H - 4, H - 2.4, '#c8102e');
    quad(P(a0, D, H), P(a0, D - 1.2, H), P(a1, D - 1.2, H), P(a1, D, H), '#e9e6df');
    if (i % 2 === 1) box(P(am, D + 0.25, 0), P(am, D + 0.25, H), 0.6, 0.5, '#e6e2da', side);
  } else if (kind === 'ilha') {
    // concreto pintado de preto, faixa vermelha no topo e embaixo, e os pilares inclinados de concreto
    front(D - 0.6, 0, H, '#1c1c1c');
    front(D - 0.55, 2.6, 3.3, '#c8102e');
    front(D + 0.2, H - 2.6, H, '#c8102e');
    quad(P(a0, D + 0.2, H), P(a0, D - 1.4, H), P(a1, D - 1.4, H), P(a1, D + 0.2, H), '#a3121f');
    if (i % 2 === 0) box(P(am, D + 3.4, 0), P(am, D - 0.2, H - 2.6), 1.1, 1.1, '#9d9a94', side);
  }
}

function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
// escudo estilizado (forma e cores do clube; não é a reprodução do brasão)
function shield(g, x, y, w, h, stripes, border, stars) {
  g.save(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h * 0.55); g.quadraticCurveTo(x + w, y + h * 0.9, x + w / 2, y + h); g.quadraticCurveTo(x, y + h * 0.9, x, y + h * 0.55); g.closePath();
  g.fillStyle = border; g.fill(); g.clip();
  const n = stripes.length; stripes.forEach((c, i) => { g.fillStyle = c; g.fillRect(x + 8 + ((w - 16) * i) / n, y + 8, (w - 16) / n + 1, h - 16); });
  g.restore(); g.lineWidth = 8; g.strokeStyle = border; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h * 0.55); g.quadraticCurveTo(x + w, y + h * 0.9, x + w / 2, y + h); g.quadraticCurveTo(x, y + h * 0.9, x, y + h * 0.55); g.closePath(); g.stroke();
  if (stars) { g.fillStyle = '#f2c230'; for (const sx of [x + w * 0.3, x + w * 0.7]) { g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 10 : 24, a = -Math.PI / 2 + (k * Math.PI) / 5; g.lineTo(sx + Math.cos(a) * r, y - 34 + Math.sin(a) * r); } g.fill(); } }
}
function hexes(g, x0, y0, cols, rows, r, palette) {
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const cx = x0 + i * r * 1.75 + (j % 2) * r * 0.87, cy = y0 + j * r * 1.5;
    g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95); } g.closePath();
    g.fillStyle = palette[(i * 3 + j * 5 + i * j) % palette.length]; g.fill();
  }
}

// sede / entrada principal de cada clube, encostada na fachada do lado da rua
function entrance(kind, g, at, normal, a, D, H, toW, env, roadOff = null) {
  const [nx, nz] = normal(a), yaw = Math.atan2(nx, nz), M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
  const place = (obj, d, side = 0) => { const [x, z] = at(a, d); obj.position.set(x + Math.cos(yaw) * side, obj.position.y, z - Math.sin(yaw) * side); obj.rotation.y = yaw; g.add(obj); obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return obj; };
  // de que lado do portão a sede cabe melhor (menos prédio do mapa no caminho)
  const solidIn = (d, side, w, dep) => { let n = 0; for (let u = -w / 2; u <= w / 2; u += 3) for (let v = -dep / 2; v <= dep / 2; v += 3) { const [x, z] = at(a, d + v), [wx, wz] = toW(x + Math.cos(yaw) * (side + u), z - Math.sin(yaw) * (side + u)); if (env.isSolid(wx, wz)) n++; } return n; };
  const pickSide = (d, side, w, dep) => (solidIn(d, side, w, dep) <= solidIn(d, -side, w, dep) ? side : -side);
  let sign = 1;
  const stampRect = (d, side, w, dep) => { for (let u = -w / 2; u <= w / 2; u += 0.8) for (let v = -dep / 2; v <= dep / 2; v += 0.8) { const [x, z] = at(a, d + v); const [wx, wz] = toW(x + Math.cos(yaw) * (side + u), z - Math.sin(yaw) * (side + u)); stampPoint(wx, wz); } };
  if (kind === 'arruda') {
    // fachada nova da sede: painel branco com hexágonos vermelhos, brancos e pretos nas pontas, escudo no meio,
    // faixa vermelha "SANTA CRUZ FUTEBOL CLUBE" e o térreo escuro com pilares e grade preta
    const W = 58, Hh = 13, dep = 8, grp = new THREE.Group();
    const tex = canvas(2048, 460, (c) => {
      c.fillStyle = '#f4f3ef'; c.fillRect(0, 0, 2048, 300);
      hexes(c, 20, 30, 5, 6, 30, ['#f4f3ef', '#c8102e', '#161616', '#c8102e', '#f4f3ef']); hexes(c, 1770, 30, 5, 6, 30, ['#161616', '#f4f3ef', '#c8102e', '#f4f3ef']);
      shield(c, 944, 20, 160, 190, ['#161616', '#f4f3ef', '#c8102e', '#f4f3ef', '#161616'], '#161616', false);
      c.fillStyle = '#c8102e'; c.fillRect(0, 230, 2048, 70); c.fillStyle = '#ffffff'; c.font = 'bold 58px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SANTA CRUZ FUTEBOL CLUBE', 1024, 268);
      c.fillStyle = '#1b1b1b'; c.fillRect(0, 300, 2048, 160); c.fillStyle = '#3a3a3a'; for (let x = 60; x < 2048; x += 180) c.fillRect(x, 300, 26, 160);
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, dep), [M('#e9e7e1'), M('#e9e7e1'), M('#161616'), M('#e9e7e1'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), M('#d9d6cf')]);
    body.position.y = Hh / 2; grp.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.8, dep + 1.5), M('#161616')); roof.position.set(0, Hh + 0.4, 0.4); grp.add(roof);
    for (let x = -W / 2 + 1; x <= W / 2 - 1; x += 0.45) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), M('#111')); bar.position.set(x, 1.2, dep / 2 + 4); grp.add(bar); }
    const sd = pickSide(D + dep / 2 + 0.5, 22, W, dep); sign = Math.sign(sd); place(grp, D + dep / 2 + 0.5, sd); stampRect(D + dep / 2 + 0.5, sd, W, dep);
  } else if (kind === 'aflitos') {
    // sede do Clube Náutico Capibaribe: art déco branco, torre redonda com faixas de janela e o nome no alto,
    // aleta vermelha, parte vermelha na ala e gradil vermelho
    const grp = new THREE.Group(), white = M('#f6f5f1'), red = M('#c8102e'), glass = M('#2c3a44', { roughness: 0.2, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(30, 11, 13), white); body.position.set(-8, 5.5, 0); grp.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(14, 3.5, 13.2), red); wing.position.set(-16, 9.3, 0); grp.add(wing);
    for (const y of [3.2, 7.4]) { const band = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 0.2), glass); band.position.set(-8, y, 6.55); grp.add(band); }
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 15, 32), white); tower.position.set(9, 7.5, 1.5); grp.add(tower);
    for (const y of [3.5, 7, 10.5]) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(6.08, 6.08, 1.8, 32, 1, true, -Math.PI / 2, Math.PI), glass); ring.position.set(9, y, 1.5); grp.add(ring); }
    const name = canvas(2048, 160, (c) => { c.fillStyle = '#f6f5f1'; c.fillRect(0, 0, 2048, 160); c.fillStyle = '#c8102e'; c.font = 'bold 96px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CLUBE NÁUTICO CAPIBARIBE', 1024, 84); });
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(6.1, 6.1, 2.2, 40, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: name, roughness: 0.6 })); lab.position.set(9, 13.5, 1.5); grp.add(lab);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(6.3, 6.3, 0.6, 32), white); crown.position.set(9, 15.2, 1.5); grp.add(crown);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 17, 3), red); fin.position.set(2.2, 8.5, 5); grp.add(fin);
    for (let x = -22; x <= 16; x += 0.5) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.6, 0.07), red); bar.position.set(x, 0.8, 9.5); grp.add(bar); }
    // a sede fica na calçada da Av. Rosa e Silva; entre ela e o estádio, a piscina do clube
    const ds = roadOff && roadOff - 14 > D + 8 ? roadOff - 14 : D + 8;
    const sd = ds > D + 8 ? 0 : pickSide(D + 8, 26, 44, 14); sign = sd ? Math.sign(sd) : 1; place(grp, ds, sd); stampRect(ds, sd, 44, 14);
    if (ds - (D + 2) > 22) {
      const pool = new THREE.Group(), dp = (D + 2 + ds - 8) / 2;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 0.3, 16), M('#d9d4c8', { roughness: 0.9 })); deck.position.y = 0.15; pool.add(deck);
      const water = new THREE.Mesh(new THREE.BoxGeometry(25, 0.32, 11), M('#3fa9d6', { roughness: 0.15, metalness: 0.1 })); water.position.y = 0.18; pool.add(water);
      for (let i = -4; i <= 4; i++) { const lane = new THREE.Mesh(new THREE.BoxGeometry(25, 0.05, 0.12), M('#f2f0ea')); lane.position.set(0, 0.36, i * 1.2); pool.add(lane); }
      place(pool, dp, 0);
    }
  } else if (kind === 'ilha') {
    // entrada principal: bloco preto com a faixa vermelha "ESTÁDIO ADELMAR COSTA CARVALHO" e o escudo grande;
    // mais adiante, o painel de murais vermelho e preto
    const grp = new THREE.Group(), W = 46, Hh = 15;
    const tex = canvas(2048, 680, (c) => {
      c.fillStyle = '#141414'; c.fillRect(0, 0, 2048, 680);
      c.fillStyle = '#c8102e'; c.fillRect(0, 0, 2048, 60); c.fillRect(0, 330, 1500, 90);
      c.fillStyle = '#ffffff'; c.font = 'bold 66px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ESTÁDIO ADELMAR COSTA CARVALHO', 760, 378);
      c.font = 'bold 34px Arial'; c.fillText('SPORT CLUB DO RECIFE', 760, 34);
      shield(c, 1610, 140, 330, 420, ['#141414', '#c8102e', '#141414', '#f2c230', '#141414', '#c8102e', '#141414'], '#141414', true);
      c.fillStyle = '#2a2a2a'; for (let x = 80; x < 1500; x += 230) c.fillRect(x, 470, 150, 210); c.fillStyle = '#c8102e'; for (let x = 80; x < 1500; x += 230) c.fillRect(x, 470, 150, 14);
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, 5), [M('#141414'), M('#141414'), M('#c8102e'), M('#141414'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), M('#141414')]);
    body.position.y = Hh / 2; grp.add(body);
    const sd = pickSide(D + 2.8, 20, W, 5); sign = Math.sign(sd); place(grp, D + 2.8, sd); stampRect(D + 2.8, sd, W, 5);
    // painel de murais numa curva (figuras vermelhas e pretas)
    const a2 = a + 0.9, mural = canvas(1024, 400, (c) => {
      c.fillStyle = '#1a1a1a'; c.fillRect(0, 0, 1024, 400);
      const cols = ['#c8102e', '#e63946', '#f2c230', '#f4f2ee', '#8a0f1d'];
      for (let i = 0; i < 26; i++) { c.fillStyle = cols[i % cols.length]; const x = (i * 97) % 1024, y = (i * 61) % 400, w = 60 + (i * 37) % 120, h = 50 + (i * 53) % 140; c.fillRect(x, y, w, h); }
      c.fillStyle = '#141414'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(70 + i * 128, 170, 34, 0, Math.PI * 2); c.fill(); c.fillRect(48 + i * 128, 200, 44, 120); }
    });
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(36, 13), new THREE.MeshStandardMaterial({ map: mural, roughness: 0.7 }));
    const [mx, mz] = at(a2, D + 0.25), [mnx, mnz] = normal(a2); mp.position.set(mx, 8.5, mz); mp.rotation.y = Math.atan2(mnx, mnz); g.add(mp);
  }
  return sign;
}
