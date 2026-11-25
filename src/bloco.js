// Troça de frevo desfilando no Recife Antigo: estandarte na frente, passistas de sombrinha no passo do frevo,
// foliões e a orquestra de metais atrás. Sai às 15h e recolhe às 20h (hora do jogo), vai e volta por um caminho
// de ~1,3 km pelas ruas a pé em volta do Marco Zero. A troça e o estandarte são inventados (nome próprio do jogo).
// Dançar (G) perto do bloco por uns segundos conta como brincar: rende uns trocados uma vez por desfile.
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { frevoPose } from './frevo.js';
import { addMoney } from './save.js';
import { conta } from './trofeus.js';

const NOME = 'Troça Caraí Que Calor';
const CORES = ['#d7263d', '#f2b705', '#1d5fa8', '#2a9d58'];
const VEL = 1.1, ABRE = 15, FECHA = 20;

export class Bloco {
  constructor({ scene, world, traffic, hud, audio, day, player }) {
    Object.assign(this, { scene, world, traffic, hud, audio, day, player });
    const mz = world.pois.find((p) => p.name === 'Marco Zero');
    // vários sorteios de caminho; fica o mais longo (sempre o mesmo, o sorteio tem semente)
    this.route = null;
    if (mz) for (let seed = 1; seed <= 24; seed++) { const r = buildRoute(traffic.foot, mz.x, mz.z, seed); if (r && (!this.route || r.len > this.route.len)) this.route = r; if (this.route?.len >= 1300) break; }
    this.s = 0; this.dir = 1; this.t = 0; this.brincou = 0; this.pago = false; this.avisou = false;
    if (!this.route) return;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this.members = [];
    const add = (p, back, side, style, ph = Math.random() * 6) => { this.group.add(p); this.members.push({ p, back, side, style, ph }); };
    // estandarte: porta-estandarte com o pau e a bandeira bordada
    const pe = makePerson({ shirt: '#f2b705', pants: '#1d1d1d', longSleeve: true });
    pe.add(estandarte());
    pe.userData.armR.rotation.x = -1.1; pe.userData.elbowR.rotation.x = -0.6;
    add(pe, 0, 0, 'anda');
    // passistas em fileiras de três
    for (let i = 0; i < 12; i++) add(makePerson({ hand: 'sombrinha', shirt: CORES[i % 4], longSleeve: false }), 4 + Math.floor(i / 3) * 2.2, ((i % 3) - 1) * 1.9, 'frevo');
    // foliões em volta
    for (let i = 0; i < 10; i++) add(makePerson(), 6 + Math.random() * 10, (Math.random() < 0.5 ? -1 : 1) * (2.8 + Math.random() * 1.6), 'folia');
    // orquestra de metais no fim, de camisa branca
    const metal = new THREE.MeshStandardMaterial({ color: '#d4a73a', metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const p = makePerson({ shirt: '#f2f2ee', pants: '#1d1d1d', longSleeve: false });
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 10, 1, true), metal);
      horn.position.set(0, 1.62, 0.38); horn.rotation.x = -Math.PI / 2 + 0.2; p.add(horn);
      p.userData.armL.rotation.x = p.userData.armR.rotation.x = -1.2; p.userData.elbowL.rotation.x = p.userData.elbowR.rotation.x = -0.9;
      add(p, 15 + Math.floor(i / 4) * 2, ((i % 4) - 1.5) * 1.4, 'toca', i);
    }
  }

  get ativo() { const h = this.day.hours; return h >= ABRE && h < FECHA; }

  update(dt, t, cam) {
    if (!this.route) return;
    const on = this.ativo;
    if (!on) { if (this.group.visible) { this.group.visible = false; this.audio.loop('frevo', 0); this.pago = false; this.avisou = false; } return; }
    const R = this.route, L = R.len;
    this.s += this.dir * VEL * dt;
    if (this.s > L) { this.s = L; this.dir = -1; } else if (this.s < 0) { this.s = 0; this.dir = 1; }
    const lead = R.at(this.s), d = Math.hypot(lead.x - cam.x, lead.z - cam.z);
    this.group.visible = d < 450;
    this.audio.loop('frevo', d < 160 ? 0.5 * (1 - d / 160) ** 1.5 : 0);
    if (!this.group.visible) return;
    for (const m of this.members) {
      const q = R.at(this.s - this.dir * m.back), h = this.dir > 0 ? q.h : q.h + Math.PI;
      const x = q.x + Math.cos(h) * m.side, z = q.z - Math.sin(h) * m.side;
      const p = m.p, u = p.userData;
      p.position.set(x, this.world.groundY(x, z), z);
      if (m.style === 'frevo') {
        const f = frevoPose(p, t, m.ph); // tesoura, ferrolho, dobradiça, parafuso e salto (frevo.js)
        p.position.y += f.y;
        p.rotation.y = h + Math.sin(t * 0.7 + m.ph) * 0.5 + f.yaw;
      } else if (m.style === 'toca') {
        p.rotation.y = h; p.rotation.z = Math.sin(t * 6 + m.ph) * 0.05; u.head.rotation.x = Math.sin(t * 6 + m.ph) * 0.15;
        u.legL.rotation.x = Math.sin(t * 4 + m.ph) * 0.35; u.legR.rotation.x = -u.legL.rotation.x;
      } else {
        p.rotation.y = h;
        animatePerson(p, VEL, dt);
        if (m.style === 'folia') { p.position.y += Math.abs(Math.sin(t * 5 + m.ph)) * 0.15; u.armL.rotation.z = -1.4 - Math.sin(t * 5 + m.ph) * 0.4; }
      }
    }
    // aviso e brincadeira
    const pd = Math.hypot(lead.x - this.player.pos.x, lead.z - this.player.pos.z);
    if (!this.avisou && pd < 90) { this.avisou = true; this.hud.flash(`🎺 A ${NOME} tá passando! Aperta G pra brincar no bloco.`); }
    if (this.player.dancing && pd < 25) {
      this.brincou += dt;
      if (this.brincou > 8 && !this.pago) { this.pago = true; addMoney(20); this.hud.flash(`Brincou na ${NOME}! +R$ 20`); conta('bloco'); }
    }
  }
}

// caminho de ida e volta pelas ruas a pé perto do Marco Zero, preferindo rua com nome (sem avenida de carro rápido)
function buildRoute(g, cx, cz, seed) {
  let start = null, bd = Infinity;
  for (const n of g.nodes.values()) { const d = Math.hypot(n.x - cx, n.z - cz); if (d < bd && n.out.length) { bd = d; start = n; } }
  if (!start || bd > 150) return null;
  let s = seed * 7919; const R = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
  const pts = [[start.x, start.z]], seen = new Set([start.id]);
  let cur = start, len = 0;
  while (len < 1300) {
    const opts = cur.out.map((i) => g.edges[i]).filter((e) => !seen.has(e.b.id) && Math.hypot(e.b.x - cx, e.b.z - cz) < 520);
    if (!opts.length) break;
    const named = opts.filter((e) => e.name);
    const e = (named.length ? named : opts)[Math.floor(R() * (named.length || opts.length))];
    seen.add(e.b.id); pts.push([e.b.x, e.b.z]); len += e.len; cur = e.b;
  }
  if (len < 250) return null;
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (d) => {
    d = Math.max(0, Math.min(len, d));
    let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
    const a = pts[i - 1], b = pts[i], f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, h: Math.atan2(b[0] - a[0], b[1] - a[1]) };
  };
  return { pts, len, at };
}

function estandarte() {
  const g = new THREE.Group();
  const pau = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6), new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.7, roughness: 0.3 }));
  pau.position.set(0.35, 1.6, 0.25); g.add(pau);
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const x = c.getContext('2d');
  x.fillStyle = '#b3122d'; x.fillRect(0, 0, 256, 320);
  x.strokeStyle = '#f2c230'; x.lineWidth = 10; x.strokeRect(8, 8, 240, 304);
  x.fillStyle = '#f2c230'; x.textAlign = 'center'; x.font = '700 30px Inter, Arial, sans-serif';
  ['TROÇA', 'CARAÍ', 'QUE', 'CALOR'].forEach((l, i) => x.fillText(l, 128, 70 + i * 52));
  x.font = '600 18px Inter, Arial, sans-serif'; x.fillText('Recife · Pernambuco', 128, 292);
  // sombrinha de frevo bordada no meio
  const cols = ['#d7263d', '#f2b705', '#1d5fa8', '#2a9d58'];
  for (let k = 0; k < 8; k++) { x.fillStyle = cols[k % 4]; x.beginPath(); x.moveTo(128, 252); x.arc(128, 252, 22, Math.PI + (k * Math.PI) / 8, Math.PI + ((k + 1) * Math.PI) / 8); x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const band = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
  band.position.set(0.35, 2.55, 0.26); g.add(band);
  return g;
}
