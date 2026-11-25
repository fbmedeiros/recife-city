// Jogos na areia de Boa Viagem, perto da câmera quando ela está na orla:
// - Pelada: campinho de ~24 × 12 m no meio da areia, gol marcado com dois pares de chinelo, oito meninos (time sem
//   camisa contra time de camisa laranja) correndo atrás da bola. A bola rola, quica e para na areia fofa. O jogador
//   a pé chuta só de encostar nela (na direção em que está andando); gol dele conta pro troféu.
// - Frescobol: três duplas na beira d'água, a bolinha indo e voltando entre as raquetes com o "toc" de madeira.
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { conta } from './trofeus.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const BOLA = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.5 });
const CHINELO = new THREE.MeshStandardMaterial({ color: '#2a6fb5', roughness: 0.7 });
const RAQUETE = new THREE.MeshStandardMaterial({ color: '#c9853a', roughness: 0.6 });
const BOLINHA = new THREE.MeshStandardMaterial({ color: '#f2d22e', roughness: 0.5 });
const GOL = ['Gooool!', 'É gol, caraí!', 'Golaço!', 'Chupa essa!'];
const FALA = ['Toca, toca!', 'Passa a bola, fominha!', 'Ei, ladrão!', 'Marca ele aí!', 'Chuta, menino!'];
const MEIO = 12, LARG = 6, BOCA = 1.5; // meio campo (z), meia largura (x), meia boca do gol

export class PraiaJogos {
  constructor({ scene, world, hud, player, praia, audio }) {
    Object.assign(this, { scene, world, hud, player, praia, audio });
    this.pel = null; this.fres = []; this.zf = null;
  }

  get bola() { return this.pel?.bola || null; }

  // x da primeira água depois do meio da areia na altura z (null fora da orla)
  agua(z) { const m = this.praia.meioAreia(z); if (m == null) return null; for (let x = m; x < m + 200; x += 1.5) if (this.world.isWater(x, z)) return x; return null; }

  update(dt, t, cam) {
    const pr = this.praia, xc = pr.meioAreia(cam.z), naOrla = xc != null && Math.abs(cam.x - xc) < 400;
    // pelada em pontos fixos a cada 400 m de praia (sempre o mesmo lugar)
    // na areia molhada perto da água (os guarda-sóis ficam pro lado do calçadão)
    const z0 = Math.round(cam.z / 400) * 400, ag = naOrla ? this.agua(z0) : null, x0 = ag != null ? ag - LARG - 4 : null;
    if (this.pel && (!naOrla || this.pel.z0 !== z0)) this.desmontaPelada();
    if (naOrla && !this.pel && x0 != null && pr.meioAreia(z0 - MEIO) != null && pr.meioAreia(z0 + MEIO) != null) this.montaPelada(x0, z0);
    if (this.pel) this.joga(dt, t);
    // frescobol: três duplas perto da câmera, na beira d'água
    if (this.fres.length && (!naOrla || Math.abs(this.zf - cam.z) > 350)) this.desmontaFrescobol();
    if (naOrla && !this.fres.length) this.montaFrescobol(cam.z);
    for (const F of this.fres) this.rebate(F, dt, t);
  }

  // ------------------------------------------------------------------ pelada
  montaPelada(cx, cz) {
    const g = new THREE.Group(), W = this.world;
    const chao = (x, z) => W.groundY(x, z);
    for (const s of [-1, 1]) for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.27), CHINELO); c.position.set(cx + sx * BOCA, chao(cx, cz + s * MEIO) + 0.02, cz + s * MEIO); g.add(c);
    }
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 9), BOLA); g.add(bola);
    const kids = [];
    for (let i = 0; i < 8; i++) {
      const time = i % 2, k = makePerson({ bottom: 'bermuda', ...(time ? { shirt: '#e07a1f', top: 'camisa' } : { top: 'regata', shirt: '#c98b5a' }) });
      k.scale.multiplyScalar(0.8); g.add(k);
      // cada um tem um "lugar" no campo: o time 0 ataca o gol de +z, o time 1 o de −z
      kids.push({ p: k, time, base: [(Math.random() * 2 - 1) * LARG * 0.8, (time ? 1 : -1) * (2 + Math.random() * 7)], vel: 3.8 + Math.random() * 1.2 });
    }
    for (const k of kids) k.p.position.set(cx + k.base[0], chao(cx + k.base[0], cz + k.base[1]), cz + k.base[1]);
    this.scene.add(g);
    this.pel = { g, cx, cz, z0: cz, bola, b: { x: cx, z: cz, y: 0, vx: 0, vz: 0, vy: 0 }, kids, placar: [0, 0], fala: 3, pausa: 0, tocou: null };
  }

  desmontaPelada() { if (!this.pel) return; for (const k of this.pel.kids) this.hud.forget(k.p); this.scene.remove(this.pel.g); this.pel = null; }

  chuta(b, dx, dz, forca, quem) {
    const L = Math.hypot(dx, dz) || 1;
    b.vx = (dx / L) * forca; b.vz = (dz / L) * forca; b.vy = forca * (0.15 + Math.random() * 0.2);
    this.pel.tocou = quem;
  }

  joga(dt, t) {
    const E = this.pel, b = E.b, W = this.world, P = this.player;
    // jogador a pé encostou na bola: chuta pra onde está indo
    if (!P.vehicle && b.y < 0.6 && Math.hypot(b.x - P.pos.x, b.z - P.pos.z) < 0.9 && E.pausa <= 0) {
      const h = P.heading, f = 7 + Math.min(6, (P.speed || 0) * 1.2);
      this.chuta(b, Math.sin(h), Math.cos(h), f, 'jogador');
    }
    // física: rola com atrito forte (areia fofa) e quica baixo
    b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt; b.vy -= 9.8 * dt;
    if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) > 1 ? -b.vy * 0.35 : 0; }
    const atr = Math.exp(-(b.y > 0 ? 0.3 : 1.6) * dt); b.vx *= atr; b.vz *= atr;
    // gol ou fundo / lateral
    const rz = b.z - E.cz, rx = b.x - E.cx;
    if (Math.abs(rz) > MEIO) {
      if (Math.abs(rx) < BOCA && b.y < 1.6) this.gol(rz > 0 ? 0 : 1);
      else { b.x = E.cx + Math.sign(rx || 1) * BOCA * 2; b.z = E.cz + Math.sign(rz) * (MEIO - 1); b.vx = b.vz = 0; }
    } else if (Math.abs(rx) > LARG + 1.5) { b.x = E.cx + Math.sign(rx) * LARG; b.vx = b.vz = 0; }
    E.pausa -= dt;
    E.bola.position.set(b.x, W.groundY(b.x, b.z) + 0.11 + b.y, b.z);
    E.bola.rotation.x += b.vz * dt * 9; E.bola.rotation.z -= b.vx * dt * 9;
    // meninos: os dois mais perto de cada time correm na bola, os outros voltam pro seu lugar acompanhando a jogada
    const perto = [0, 1].map((tm) => E.kids.filter((k) => k.time === tm).sort((a, c) => d2(a.p.position, b) - d2(c.p.position, b)).slice(0, 2));
    for (const k of E.kids) {
      const vai = perto[k.time].includes(k) && E.pausa <= 0;
      const tx = vai ? b.x : E.cx + k.base[0] + (b.x - E.cx) * 0.3, tz = vai ? b.z : E.cz + k.base[1] + (b.z - E.cz) * 0.4;
      const dx = tx - k.p.position.x, dz = tz - k.p.position.z, d = Math.hypot(dx, dz);
      const v = d > 0.4 ? Math.min(k.vel, d * 3) : 0;
      if (v) { k.p.position.x += (dx / d) * v * dt; k.p.position.z += (dz / d) * v * dt; k.p.rotation.y = Math.atan2(dx, dz); }
      k.p.position.y = W.groundY(k.p.position.x, k.p.position.z);
      animatePerson(k.p, v, dt);
      // chegou na bola: chuta pro gol do outro time, com erro
      if (vai && d < 0.7 && b.y < 0.5 && E.tocou !== k) {
        const gz = E.cz + (k.time ? -1 : 1) * MEIO, gx = E.cx + (Math.random() * 2 - 1) * BOCA * 2.2;
        const longe = Math.abs(gz - b.z) > 7;
        this.chuta(b, gx - b.x + (Math.random() - 0.5) * (longe ? 6 : 1), gz - b.z, longe ? 6 + Math.random() * 3 : 9 + Math.random() * 3, k);
      }
    }
    // falatório quando o jogador está perto
    if ((E.fala -= dt) <= 0) {
      E.fala = 5 + Math.random() * 5;
      if (Math.hypot(E.cx - P.pos.x, E.cz - P.pos.z) < 30) this.hud.say(pick(E.kids).p, pick(FALA), 2);
    }
  }

  gol(time) {
    const E = this.pel, P = this.player;
    E.placar[time]++;
    const doJogador = E.tocou === 'jogador';
    const k = pick(E.kids.filter((q) => q.time === time));
    if (Math.hypot(E.cx - P.pos.x, E.cz - P.pos.z) < 40) this.hud.say(k.p, `${pick(GOL)} Tá ${E.placar[0]} a ${E.placar[1]}!`, 2.5);
    if (doJogador) { conta('gol_praia'); this.hud.flash('Gol teu na pelada da praia! Os meninos te chamaram pro time.'); }
    E.b = { x: E.cx, z: E.cz, y: 0, vx: 0, vz: 0, vy: 0 }; E.pausa = 2; E.tocou = null;
    this.ultimoGol = { time, doJogador };
  }

  // ------------------------------------------------------------------ frescobol
  montaFrescobol(zc) {
    const W = this.world, ax = (z) => { const a = this.agua(z); return a == null ? null : a - 4; }, z0 = Math.round(zc / 400) * 400;
    for (let i = 0; i < 3; i++) {
      const z = zc + (i - 1) * 110 + (Math.random() - 0.5) * 40, x = ax(z); if (x == null || Math.abs(z - z0) < MEIO + 15) continue; // longe da pelada
      const g = new THREE.Group(), par = [];
      for (const s of [-1, 1]) {
        const p = makePerson({ bottom: 'bermuda', top: Math.random() < 0.5 ? 'regata' : undefined });
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 14), RAQUETE); r.rotation.x = Math.PI / 2; r.position.set(0, -0.42, 0.08); p.userData.elbowR.add(r);
        const pz = z + s * 3.2; p.position.set(x, W.groundY(x, pz), pz); p.rotation.y = s > 0 ? Math.PI : 0; g.add(p); par.push(p);
      }
      const bolinha = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), BOLINHA); g.add(bolinha);
      this.scene.add(g); this.fres.push({ g, par, bolinha, x, z, t: Math.random(), dir: 1, dur: 0.9 + Math.random() * 0.3 });
    }
    this.zf = zc;
  }

  desmontaFrescobol() { for (const F of this.fres) this.scene.remove(F.g); this.fres = []; }

  rebate(F, dt, t) {
    F.t += dt / F.dur;
    if (F.t >= 1) {
      F.t -= 1; F.dir = -F.dir;
      if (Math.random() < 0.04) F.t = -1.5; // caiu: um vai buscar (pausa)
      const P = this.player.pos, d = Math.hypot(F.x - P.x, F.z - P.z);
      if (d < 25) this.audio.tac?.(0.5 * (1 - d / 25));
    }
    const u = Math.max(0, F.t), [a, b] = F.dir > 0 ? F.par : [F.par[1], F.par[0]];
    const ya = a.position.y + 1.2, yb = b.position.y + 1.2;
    F.bolinha.visible = F.t >= 0;
    F.bolinha.position.set(F.x + 0.25, ya + (yb - ya) * u + Math.sin(u * Math.PI) * 0.8, a.position.z + (b.position.z - a.position.z) * u);
    for (const [i, p] of F.par.entries()) {
      const u2 = p.userData; u2.armR.rotation.x = -1.2 + Math.sin(t * 7 + i * Math.PI) * 0.5;
      u2.legL.rotation.x = Math.sin(t * 3 + i) * 0.15; u2.legR.rotation.x = -u2.legL.rotation.x; u2.kneeL.rotation.x = u2.kneeR.rotation.x = 0.3;
    }
  }
}

function d2(p, b) { return (p.x - b.x) ** 2 + (p.z - b.z) ** 2; }
