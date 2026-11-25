// Passeio de catamarã pelo Capibaribe: sai do cais do Marco Zero, contorna o Recife Antigo e sobe o rio passando
// por baixo das pontes do Centro (Maurício de Nassau, Buarque de Macedo, Boa Vista, Santa Isabel, Princesa Isabel —
// as que existirem); no fim o jogador volta pro cais. O caminho é achado pela água (A* na grade de água, preferindo o meio do rio) na primeira vez. O guia
// narra o que aparece na margem (Cais do Sertão, Palácio do Campo das Princesas, Teatro de Santa Isabel, Rua da
// Aurora, Casa da Cultura…). A pé, perto do cais, B embarca (R$ 30); B de novo durante o passeio volta pro cais.
import * as THREE from 'three';
import { spend } from './save.js';
import { conta } from './trofeus.js';

const PRECO = 30, VEL = 9;
const PONTES = [/^Ponte Maurício de Nassau$/, /^Ponte Buarque de Macedo$/, /^Ponte da Boa Vista$/, /^Ponte Santa Isabel$/, /^Ponte Princesa Isabel$/];
const GUIA = [
  { re: /^Parque das Esculturas de Francisco Brennand$/, txt: 'Do lado de lá, no molhe, o Parque das Esculturas de Francisco Brennand, com a Torre de Cristal.' },
  { re: /^Museu Cais do Sertão$/, txt: 'Esse armazém do porto é o Museu Cais do Sertão, que conta a história do sertão e de Luiz Gonzaga.' },
  { re: /^Ponte Maurício de Nassau$/, txt: 'A Ponte Maurício de Nassau liga o Recife Antigo a Santo Antônio. Foi aqui que Nassau mandou fazer a primeira grande ponte do Brasil, no século XVII.' },
  { re: /^Palácio do Campo das Princesas$/, txt: 'Ali, o Palácio do Campo das Princesas, sede do governo de Pernambuco.' },
  { re: /^Teatro Santa Isabel$/, txt: 'O Teatro de Santa Isabel, de 1850, um dos teatros mais antigos do Brasil.' },
  { re: /^Ponte da Boa Vista$/, txt: 'A Ponte da Boa Vista, de ferro, liga a Rua Nova à Boa Vista.' },
  { re: /^Obelisco da Rua da Aurora$|^Parque da Rua da Aurora$/, txt: 'Do outro lado, a Rua da Aurora, com o casario colorido de frente pro Capibaribe.' },
  { re: /^Caranguejo da Rua da Aurora$/, txt: 'Olha o caranguejo gigante na Rua da Aurora: o Recife é a cidade do mangue.' },
  { re: /^Casa da Cultura$/, txt: 'A Casa da Cultura foi a antiga Casa de Detenção. Hoje as celas viraram lojas de artesanato.' },
  { re: /^Armazéns do Cais José Estelita$/, txt: 'Os armazéns do Cais José Estelita, antigos galpões da ferrovia.' },
];
const BRANCO = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.5 });
const AZUL = new THREE.MeshStandardMaterial({ color: '#1d5fa8', roughness: 0.5 });
const LONA = new THREE.MeshStandardMaterial({ color: '#f2b705', roughness: 0.7, side: THREE.DoubleSide });

export class Catamara {
  constructor({ scene, world, hud, player }) {
    Object.assign(this, { scene, world, hud, player });
    const mz = world.pois.find((p) => p.name === 'Marco Zero');
    this.pontes = PONTES.map((re) => world.pois.find((q) => re.test(q.name))).filter(Boolean);
    this.ok = !!mz && this.pontes.length >= 1;
    if (!this.ok) return;
    // cais: o ponto d'água mais perto do Marco Zero, com terra do lado (onde o jogador espera)
    const W = world;
    for (let r = 4; r < 300 && !this.cais; r += 3) for (let a = 0; a < 6.28; a += 0.2) {
      const x = mz.x + Math.cos(a) * r, z = mz.z + Math.sin(a) * r;
      if (W.isWater(x, z) && W.isWater(x + Math.cos(a) * 8, z + Math.sin(a) * 8)) { this.cais = { x: x + Math.cos(a) * 8, z: z + Math.sin(a) * 8, tx: x - Math.cos(a) * 3, tz: z - Math.sin(a) * 3 }; break; }
    }
    if (!this.cais) { this.ok = false; return; }
    this.guia = GUIA.map((G) => ({ ...G, p: world.pois.find((q) => G.re.test(q.name)) })).filter((G) => G.p);
    this.barco = modelo();
    this.barco.position.set(this.cais.x, -0.4, this.cais.z);
    scene.add(this.barco);
    this.rota = null; this.ativo = null;
  }

  get perto() {
    if (!this.ok || this.player.vehicle || this.ativo) return false;
    const P = this.player.pos;
    return Math.hypot(this.cais.tx - P.x, this.cais.tz - P.z) < 14;
  }

  get hint() { return this.ativo ? 'B — voltar pro cais' : this.perto ? `B — passeio de catamarã pelo Capibaribe (R$ ${PRECO})` : ''; }
  get camV() { return this.ativo ? { mesh: this.barco, speed: VEL } : null; }

  b() {
    if (this.ativo) { this.fim('Voltou pro cais antes do fim do passeio.'); return true; }
    if (!this.perto) return false;
    if (!this.rota) this.rota = this.calcula();
    if (!this.rota) { this.hud.flash('O catamarã tá em manutenção hoje.'); return true; }
    if (!spend(PRECO)) { this.hud.flash(`O passeio custa R$ ${PRECO}.`); return true; }
    this.ativo = { s: 0, ditos: new Set() };
    this.player.mesh.visible = false;
    this.hud.banner('Passeio de catamarã', 'Bem-vindos a bordo! Vamos subir o Capibaribe pelas pontes do Centro.', 4);
    return true;
  }

  fim(msg) {
    const A = this.ativo; if (!A) return;
    this.ativo = null; this.hud.objective(null);
    this.player.pos.set(this.cais.tx, 0, this.cais.tz);
    this.player.mesh.visible = true;
    this.barco.position.set(this.cais.x, -0.4, this.cais.z);
    if (A.s >= this.comp - 1) { conta('catamara'); this.hud.banner('Fim do passeio', 'Obrigado por navegar com a gente. Volte sempre pro Recife!', 4); }
    else if (msg) this.hud.flash(msg);
  }

  update(dt, t) {
    if (!this.ok) return;
    const A = this.ativo;
    this.barco.position.y = -0.45 + Math.sin(t * 1.4) * 0.06;
    if (!A) return;
    A.s += VEL * dt;
    if (A.s >= this.comp) { A.s = this.comp; this.fim(); return; }
    const [x, z] = this.em(A.s), [x2, z2] = this.em(Math.min(this.comp, A.s + 6));
    this.barco.position.x = x; this.barco.position.z = z;
    if (Math.hypot(x2 - x, z2 - z) > 0.1) this.barco.rotation.y = Math.atan2(x2 - x, z2 - z);
    this.barco.rotation.z = Math.sin(t * 1.1) * 0.02;
    this.player.pos.set(x, 0, z); this.player.heading = this.barco.rotation.y;
    // guia: fala de cada lugar uma vez quando passa a menos de 160 m
    for (const G of this.guia) if (!A.ditos.has(G.txt) && Math.hypot(G.p.x - x, G.p.z - z) < 160) { A.ditos.add(G.txt); this.hud.objective(`🎙️ ${G.txt}`); break; } // legenda discreta até a próxima fala
  }

  // ponto a s metros do começo da rota
  em(s) {
    const R = this.rota, L = this.acum;
    let i = 1; while (i < L.length - 1 && L[i] < s) i++;
    const u = (s - L[i - 1]) / Math.max(0.001, L[i] - L[i - 1]);
    return [R[i - 1][0] + (R[i][0] - R[i - 1][0]) * u, R[i - 1][1] + (R[i][1] - R[i - 1][1]) * u];
  }

  // cais → cada ponte (na ordem de quem está mais perto) → cais, pelo meio do rio
  calcula() {
    const ord = [], resto = this.pontes.map((p) => [p.x, p.z]);
    let cur = [this.cais.x, this.cais.z];
    while (resto.length) { let bi = 0, bd = Infinity; resto.forEach((p, i) => { const d = Math.hypot(p[0] - cur[0], p[1] - cur[1]); if (d < bd) { bd = d; bi = i; } }); cur = resto.splice(bi, 1)[0]; ord.push(cur); }
    const ida = [[this.cais.x, this.cais.z], ...ord];
    const pts = [];
    for (let i = 1; i < ida.length; i++) { const seg = this.astar(ida[i - 1], ida[i]); if (!seg) break; pts.push(...(pts.length ? seg.slice(1) : seg)); }
    if (pts.length < 2) return null;
    const rota = suaviza(pts); // só a ida: no fim o catamarã leva o pessoal de volta pro cais (fim de passeio)
    this.acum = [0]; for (let i = 1; i < rota.length; i++) this.acum.push(this.acum[i - 1] + Math.hypot(rota[i][0] - rota[i - 1][0], rota[i][1] - rota[i - 1][1]));
    this.comp = this.acum.at(-1);
    return rota;
  }

  // A* na água, grade de 6 m, custo maior perto da margem; a ponte (que tapa a água) conta como água
  astar(a, b) {
    const W = this.world, R = 6, M = 900; // folga grande: do cais do Marco Zero o barco contorna o Recife Antigo
    const x0 = Math.min(a[0], b[0]) - M, z0 = Math.min(a[1], b[1]) - M, GW = Math.ceil((Math.abs(a[0] - b[0]) + 2 * M) / R), GH = Math.ceil((Math.abs(a[1] - b[1]) + 2 * M) / R);
    const agua = new Int8Array(GW * GH).fill(-1);
    const ok = (i) => { if (agua[i] < 0) { const x = x0 + (i % GW) * R, z = z0 + Math.floor(i / GW) * R; agua[i] = W.isWater(x, z) ? (W.isWater(x + 12, z) && W.isWater(x - 12, z) && W.isWater(x, z + 12) && W.isWater(x, z - 12) ? 2 : 1) : 0; } return agua[i]; };
    const idx = (x, z) => Math.max(0, Math.min(GH - 1, Math.round((z - z0) / R))) * GW + Math.max(0, Math.min(GW - 1, Math.round((x - x0) / R)));
    // começo e fim: célula d'água mais perto (a ponte em si pode estar marcada como terra)
    const maisPerto = (x, z) => { const c = idx(x, z); if (ok(c)) return c; for (let r = 1; r < 30; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const i = c + dz * GW + dx; if (i >= 0 && i < GW * GH && ok(i)) return i; } return -1; };
    const s = maisPerto(...a), e = maisPerto(...b);
    if (s < 0 || e < 0) return null;
    const ex = e % GW, ez = Math.floor(e / GW);
    const g = new Float32Array(GW * GH).fill(Infinity), de = new Int32Array(GW * GH).fill(-1), fech = new Uint8Array(GW * GH);
    const heap = [[0, s]]; g[s] = 0;
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    let n = 0;
    while (heap.length && n++ < 400000) {
      const [, i] = pop(); if (fech[i]) continue; fech[i] = 1;
      if (i === e) break;
      const ix = i % GW, iz = Math.floor(i / GW);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= GW || jz >= GH) continue;
        const j = jz * GW + jx, w = ok(j); if (!w || fech[j]) continue;
        const c = g[i] + Math.hypot(dx, dz) * (w === 2 ? 1 : 3);
        if (c < g[j]) { g[j] = c; de[j] = i; push(c + Math.hypot(jx - ex, jz - ez), j); }
      }
    }
    if (!fech[e]) return null;
    const out = []; for (let i = e; i >= 0; i = de[i]) out.push([x0 + (i % GW) * R, z0 + Math.floor(i / GW) * R]);
    return out.reverse();
  }
}

// média móvel pra tirar o zigue-zague da grade
function suaviza(p) {
  let q = p;
  for (let k = 0; k < 3; k++) q = q.map((v, i) => (i === 0 || i === q.length - 1 ? v : [(q[i - 1][0] + v[0] * 2 + q[i + 1][0]) / 4, (q[i - 1][1] + v[1] * 2 + q[i + 1][1]) / 4]));
  return q;
}

// catamarã de passeio: dois cascos, convés, toldo amarelo e bancos
function modelo() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 13), AZUL); c.position.set(s * 1.8, 0.2, 0); g.add(c); const p = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 8).rotateX(Math.PI / 2), AZUL); p.position.set(s * 1.8, 0.2, 7.3); g.add(p); }
  const conves = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 12), BRANCO); conves.position.y = 0.75; g.add(conves);
  for (const [x, z] of [[-2.1, -4.5], [2.1, -4.5], [-2.1, 4.5], [2.1, 4.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), BRANCO); p.position.set(x, 1.55, z); g.add(p); }
  const toldo = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 10), LONA); toldo.position.y = 2.3; g.add(toldo); // baixo pra passar debaixo das pontes
  for (let z = -3.5; z <= 3.5; z += 1.75) for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.45), AZUL); b.position.set(s * 1.1, 1.08, z); g.add(b); }
  return g;
}
