// Ensaio de quadrilha junina no Sítio da Trindade (Casa Amarela, onde acontece o São João do Recife): no fim
// da tarde (das 14h até o relógio virar; o jogo não tem noite), num terreiro livre do sítio, bandeirinhas, fogueira, sanfoneiro e o marcador puxando as figuras.
// Seis casais (chapéu de palha e vestido de chita) fazem cumprimento, balancê, caminho da roça, olha a chuva / é
// mentira, túnel, grande roda e anarriê. A pé, perto, B entra no ensaio: a cada figura que o marcador grita, B
// na hora (1,8 s) acompanha o passo. Acertou 6 das 8, conta pro troféu. O som é o do forró (composição própria).
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { conta } from './trofeus.js';

const FIG = ['Cumprimento!', 'Balancê!', 'Caminho da roça!', 'Olha a chuva!', 'É mentira!', 'Túnel!', 'Grande roda!', 'Anarriê!'];
const DUR = 7, JANELA = 1.8, NC = 6;
const CHITA = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#d62f8f', '#3a86ff'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const PALHA = new THREE.MeshStandardMaterial({ color: '#d9b56a', roughness: 0.9 });
const LENHA = new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.9 });
const FOGO = new THREE.MeshBasicMaterial({ color: '#ff8c1a', transparent: true, opacity: 0.85 });
const FOGO2 = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.9 });
const POSTE = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.8 });
const FIO = new THREE.LineBasicMaterial({ color: '#333333' });

function chapeu(p) {
  const h = new THREE.Group();
  const aba = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 16), PALHA); aba.position.y = 1.75; h.add(aba);
  const copa = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.12, 12), PALHA); copa.position.y = 1.82; h.add(copa);
  (p.userData.upper || p).add(h);
}

export class Quadrilha {
  constructor({ scene, world, hud, player, day, trees }) {
    Object.assign(this, { scene, world, hud, player, day, trees });
    const p = world.pois.find((q) => q.name === 'Sítio da Trindade');
    this.s = p ? { x: p.x, z: p.z } : null; this.g = null; this.sem = false; this.dancando = false;
  }

  get aberto() { const h = this.day.hours; return h >= 14; }

  get perto() {
    if (!this.g || this.dancando || this.player.vehicle) return false;
    const P = this.player.pos; return Math.hypot(this.c[0] - P.x, this.c[1] - P.z) < 14;
  }

  get hint() {
    if (this.dancando) return this.janela > 0 ? `B — ${FIG[this.fig]}` : `Quadrilha: ${this.acertos}/${this.feitas} passos. Espera o marcador…`;
    return this.perto ? 'B — entrar no ensaio da quadrilha' : '';
  }

  b() {
    if (this.dancando) {
      if (this.janela > 0 && !this.foi) { this.foi = true; this.acertos++; this.hud.flash(pick(['Boa! No passo!', 'Isso, matuto!', 'Arretado!'])); }
      return true;
    }
    if (!this.perto) return false;
    this.dancando = true; this.acertos = 0; this.feitas = 0; this.inicio = this.fig; this.janela = 0; this.foi = true;
    this.hud.banner('Ensaio da quadrilha', 'Quando o marcador gritar a figura, aperta B na hora!', 3);
    return true;
  }

  sai(msg) { this.dancando = false; this.player.speed = 0; if (msg) this.hud.flash(msg); }

  // posição-alvo do dançarino k (0..2*NC-1; par = cavalheiro) na figura f, no tempo u (0..1) da figura
  alvo(k, f, u, t) {
    const i = k >> 1, dama = k & 1, s = (i - (NC - 1) / 2) * 1.7, lado = dama ? 1 : -1;
    const [cx, cz] = this.c, ax = this.ax, az = this.az, bx = -az, bz = ax; // ax/az: eixo das fileiras; b: entre as fileiras
    const at = (a, b) => [cx + ax * a + bx * b, cz + az * a + bz * b];
    switch (FIG[f]) {
      case 'Caminho da roça!': { const a = ((k / (2 * NC)) + u * 0.6) * Math.PI * 2; return at(Math.cos(a) * 6, Math.sin(a) * 3); }
      case 'Olha a chuva!': return at(s, lado * 0.8);
      case 'Túnel!': { const q = ((i + u * NC) % NC) - (NC - 1) / 2; return at(q * 1.7, lado * 0.45); }
      case 'Grande roda!': { const a = (k / (2 * NC) + u * 0.5) * Math.PI * 2; return at(Math.cos(a) * 4, Math.sin(a) * 4); }
      default: return at(s, lado * 2);
    }
  }

  update(dt, t, cam) {
    if (!this.s || this.sem) return;
    const d = Math.hypot(this.s.x - cam.x, this.s.z - cam.z);
    if (this.g && (d > 260 || !this.aberto)) { if (this.dancando) this.sai(null); this.desmonta(); }
    if (d > 220 || !this.aberto) return;
    if (!this.g && !this.monta()) return;
    // relógio das figuras
    const T = (this.T += dt), f = Math.floor(T / DUR) % FIG.length, u = (T % DUR) / DUR;
    if (f !== this.fig) {
      this.fig = f; this.hud.say(this.marcador, FIG[f], 2.2);
      if (this.dancando) {
        if (!this.foi) this.hud.flash('Perdeu o passo!');
        if (this.feitas >= FIG.length) {
          const ok = this.acertos >= 6;
          if (ok) conta('quadrilha');
          this.sai(ok ? `Quadrilha arretada! ${this.acertos}/${FIG.length} passos. Viva São João!` : `Só ${this.acertos}/${FIG.length} passos. Ensaia mais, matuto!`);
        } else { this.feitas++; this.janela = JANELA; this.foi = false; }
      }
    }
    if (this.janela > 0) this.janela -= dt;
    const P = this.player;
    if (this.dancando && (P.vehicle || Math.hypot(this.c[0] - P.pos.x, this.c[1] - P.pos.z) > 25)) this.sai('Saiu do ensaio.');
    // dançarinos (o jogador entra no lugar do 6º cavalheiro)
    const fig = FIG[f];
    this.ds.forEach((D, k) => {
      const eu = this.dancando && k === 2 * (NC - 1);
      const o = eu ? P.mesh : D.p;
      D.p.visible = !eu;
      const [tx, tz] = this.alvo(k, f, u, t), px = eu ? P.pos.x : D.x, pz = eu ? P.pos.z : D.z;
      const dx = tx - px, dz = tz - pz, dd = Math.hypot(dx, dz), v = dd > 0.15 ? Math.min(dd * 3, 2.6) : 0;
      const nx = px + (v ? (dx / dd) * v * dt : 0), nz = pz + (v ? (dz / dd) * v * dt : 0);
      // de frente pro par nas fileiras; andando, pra onde vai
      const par = this.alvo(k ^ 1, f, u, t), yaw = v > 0.4 ? Math.atan2(dx, dz) : Math.atan2(par[0] - nx, par[1] - nz);
      if (eu) { P.pos.x = nx; P.pos.z = nz; P.mesh.position.x = nx; P.mesh.position.z = nz; P.mesh.rotation.y = yaw; P.speed = v; if (P.heading != null) P.heading = yaw; return; }
      D.x = nx; D.z = nz;
      o.position.set(nx, this.world.groundY(nx, nz), nz); o.rotation.y = yaw;
      animatePerson(o, v, dt);
      const U = o.userData; if (!U.armL) return;
      const b = Math.sin(t * 6 + k);
      if (fig === 'Balancê!') { U.armL.rotation.set(-0.3, 0, -0.5 - b * 0.2); U.armR.rotation.set(-0.3, 0, 0.5 + b * 0.2); if (U.upper) U.upper.rotation.z = b * 0.12; }
      else if (fig === 'Olha a chuva!') { U.armL.rotation.set(-2.8, 0, 0.3); U.armR.rotation.set(-2.8, 0, -0.3); }
      else if (fig === 'Túnel!') { (D.dama ? U.armL : U.armR).rotation.set(-2.6, 0, 0); }
      else if (fig === 'Cumprimento!' && U.upper) U.upper.rotation.x = u < 0.5 ? Math.sin(u * Math.PI * 2) * 0.5 : 0;
      else if (U.upper) { U.upper.rotation.x = 0; U.upper.rotation.z = 0; }
    });
    // fogueira tremendo, sanfona abrindo
    this.chama.scale.set(1 + Math.sin(t * 13) * 0.08, 1 + Math.sin(t * 9.7) * 0.15, 1 + Math.cos(t * 11) * 0.08);
    this.chama2.scale.y = 1 + Math.sin(t * 15 + 1) * 0.2;
    this.fole.scale.x = 1 + Math.sin(t * 2.2) * 0.35;
    const dj = Math.hypot(this.c[0] - P.pos.x, this.c[1] - P.pos.z);
    this.assistiu = !P.vehicle && dj < 15 ? this.assistiu + dt : 0;
    if (this.assistiu > 40 && !this.viu) { this.viu = true; conta('quadrilha_viu'); }
  }

  vol(cam) {
    if (!this.g) return 0;
    const d = Math.hypot(this.c[0] - cam.x, this.c[1] - cam.z);
    return d < 120 ? 0.5 * (1 - d / 120) ** 2 : 0;
  }

  monta() {
    const W = this.world, livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z) && !(W.ocupados || []).some(([ox, oz, r, key]) => key !== 'quadrilha' && Math.hypot(ox - x, oz - z) < r + 1);
    if (W.ocupados) W.ocupados = W.ocupados.filter((o) => o[3] !== 'quadrilha');
    // terreiro: um largo de uns 14 x 10 m livre dentro (ou perto) do sítio
    let at = null;
    for (let r = 0; r < 140 && !at; r += 4) for (let a = 0; a < 6.28 && !at; a += r ? 0.25 : 7) {
      const x = this.s.x + Math.cos(a) * r, z = this.s.z + Math.sin(a) * r;
      for (const e of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
        const ax = Math.cos(e), az = Math.sin(e), bx = -az, bz = ax;
        let ok = true;
        for (let i = -7; i <= 7 && ok; i += 1.75) for (let j = -5; j <= 5 && ok; j += 1.25) if (!livre(x + ax * i + bx * j, z + az * i + bz * j)) ok = false;
        if (ok) { at = [x, z, ax, az]; break; }
      }
    }
    if (!at) { this.sem = true; return false; }
    const [cx, cz, ax, az] = at, bx = -az, bz = ax, y = W.groundY(cx, cz), g = new THREE.Group();
    this.c = [cx, cz]; this.ax = ax; this.az = az;
    // dançarinos
    this.ds = [];
    for (let k = 0; k < 2 * NC; k++) {
      const dama = k & 1, cor = CHITA[(k >> 1) % CHITA.length];
      const p = dama ? makePerson({ tipo: 'mulher', top: 'vestido', shirt: cor }) : makePerson({ tipo: 'homem', shirt: cor, longSleeve: true, bottom: 'calca', pants: '#2b4a7a' });
      if (!dama) chapeu(p);
      g.add(p);
      const [x, z] = this.alvo(k, 0, 0, 0); p.position.set(x, y, z);
      this.ds.push({ p, x, z, dama });
    }
    // marcador e sanfoneiro na cabeceira
    const mx = cx + ax * 8.5, mz = cz + az * 8.5, olha = Math.atan2(cx - mx, cz - mz);
    this.marcador = makePerson({ tipo: 'homem', shirt: '#c1121f', longSleeve: true, bottom: 'calca' }); chapeu(this.marcador);
    this.marcador.position.set(mx + bx * 1, W.groundY(mx, mz), mz + bz * 1); this.marcador.rotation.y = olha; g.add(this.marcador);
    this.marcador.userData.armR.rotation.x = -1.4; this.marcador.userData.elbowR.rotation.x = -1.2; // microfone
    const sanf = makePerson({ tipo: 'homem', shirt: '#2a9d8f', longSleeve: true }); chapeu(sanf);
    sanf.position.set(mx - bx * 1, W.groundY(mx, mz), mz - bz * 1); sanf.rotation.y = olha; g.add(sanf);
    const su = sanf.userData; su.armL.rotation.set(-1.1, 0, -0.5); su.armR.rotation.set(-1.1, 0, 0.5); su.elbowL.rotation.x = su.elbowR.rotation.x = -1.2;
    this.fole = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.18), new THREE.MeshStandardMaterial({ color: '#b3202c', roughness: 0.4 })); this.fole.position.set(0, 1.05, 0.3); sanf.add(this.fole);
    // fogueira no pé do terreiro
    const fx = cx - ax * 9, fz = cz - az * 9, fy = W.groundY(fx, fz), fog = new THREE.Group(); fog.position.set(fx, fy, fz); g.add(fog);
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), LENHA); l.rotation.z = 0.9; l.rotation.y = (i / 6) * Math.PI * 2; l.position.y = 0.35; fog.add(l); }
    this.chama = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 8), FOGO); this.chama.position.y = 0.75; fog.add(this.chama);
    this.chama2 = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 8), FOGO2); this.chama2.position.y = 0.6; fog.add(this.chama2);
    // bandeirinhas: postes nos quatro cantos e fios em zigue-zague por cima do terreiro
    const cantos = [[-8, -6], [8, -6], [8, 6], [-8, 6]].map(([i, j]) => [cx + ax * i + bx * j, cz + az * i + bz * j]);
    for (const [x, z] of cantos) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6), POSTE); p.position.set(x, W.groundY(x, z) + 2.1, z); g.add(p); }
    const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3));
    const mats = CHITA.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    for (const [a, b] of [[0, 2], [1, 3], [0, 1], [2, 3], [1, 2], [3, 0]]) {
      const A = cantos[a], B = cantos[b], L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.floor(L / 0.45), pts = [];
      for (let i = 0; i <= n; i++) {
        const s = i / n, x = A[0] + (B[0] - A[0]) * s, z = A[1] + (B[1] - A[1]) * s, yy = y + 4.1 - Math.sin(s * Math.PI) * 0.6;
        pts.push(new THREE.Vector3(x, yy, z));
        if (i && i < n) { const m = new THREE.Mesh(tri, mats[i % mats.length]); m.position.set(x, yy, z); m.rotation.y = Math.atan2(B[0] - A[0], B[1] - A[1]) + Math.PI / 2; g.add(m); }
      }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), FIO));
    }
    (W.ocupados ||= []).push([cx, cz, 10, 'quadrilha']);
    this.trees?.tira?.([{ x: cx, z: cz, dx: ax, dz: az, len: 20, w: 14 }]); // terreiro limpo: sem árvore no meio da dança
    this.scene.add(g); this.g = g; this.T = 0; this.fig = -1; this.assistiu = 0; this.viu = false;
    return true;
  }

  desmonta() {
    if (!this.g) return;
    this.hud.forget(this.marcador);
    if (this.world.ocupados) this.world.ocupados = this.world.ocupados.filter((o) => o[3] !== 'quadrilha');
    this.scene.remove(this.g); this.g = null;
  }
}
