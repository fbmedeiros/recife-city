// Dia de jogo: a cada dia do jogo, um dos três estádios do Trio de Ferro tem partida à tarde (14h às 17h).
// A torcida do dono da casa enche o entorno com a camisa do time, pulando e balançando bandeira, e o barulho de
// arquibancada se ouve de longe. Torcida aqui é festa: canto, bandeira e pulo (nada de briga).
// Rodízio: Sport na Ilha do Retiro, Náutico nos Aflitos, Santa Cruz no Arruda.
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { conta } from './trofeus.js';
import { save } from './save.js';
import { ROUPAS } from './shop.js';

const CLUBES = [
  { time: 0, roupa: 'rubronegra', apelido: 'rubro-negro', nome: 'Sport', poi: 'Ilha do Retiro (Sport)', estadio: 'na Ilha do Retiro', cores: ['#c8102e', '#111111'], listras: 'h' },
  { time: 1, roupa: 'alvirrubra', apelido: 'alvirrubro', nome: 'Náutico', poi: 'Estádio dos Aflitos', estadio: 'nos Aflitos', cores: ['#c8102e', '#f4f4f2'], listras: 'v' },
  { time: 2, roupa: 'tricolor', apelido: 'tricolor', nome: 'Santa Cruz', poi: 'Arruda (Santa Cruz)', estadio: 'no Arruda', cores: ['#111111', '#f4f4f2', '#c8102e'], listras: 'h' },
];
const ABRE = 14, FECHA = 17;
const GRITOS = ['Vamo, vamo, ', 'Ô, ô, ô, ', 'É campeão! ', 'Aqui é '];

export class Jogo {
  constructor({ scene, world, hud, audio, day, player, traffic }) {
    Object.assign(this, { scene, world, hud, audio, day, player, traffic });
    this.dia = 0; this.ultimaHora = day.hours; this.crowd = null; this.foi = false;
    this.locais = CLUBES.map((c) => { const p = world.pois.find((q) => q.name === c.poi); return p ? { ...c, x: p.x, z: p.z } : null; });
  }

  get clube() { return this.locais[this.dia % 3] || this.locais.find(Boolean); }
  get ativo() { const h = this.day.hours; return !!this.clube && h >= ABRE && h < FECHA; }

  update(dt, t, cam) {
    // o relógio do jogo volta das 17h06 para as 6h: virou o dia, muda o estádio
    if (this.day.hours < this.ultimaHora - 5) { this.dia++; this.foi = false; this.desmonta(); }
    this.ultimaHora = this.day.hours;
    const C = this.clube;
    if (!this.ativo || !C) { if (this.crowd) this.desmonta(); this.audio.torcida?.(0); return; }
    const d = Math.hypot(C.x - cam.x, C.z - cam.z);
    this.audio.torcida?.(d < 700 ? 0.6 * (1 - d / 700) ** 1.4 : 0);
    if (d > 600) { if (this.crowd) this.crowd.group.visible = false; return; }
    if (!this.crowd) this.monta(C);
    const G = this.crowd; G.group.visible = true;
    for (const m of G.gente) {
      const p = m.p, u = p.userData, b = t * 4 + m.ph;
      if (m.anda) { // chegando no estádio
        const dx = C.x - p.position.x, dz = C.z - p.position.z, dd = Math.hypot(dx, dz);
        if (dd > m.para) { p.position.x += (dx / dd) * 1.3 * dt; p.position.z += (dz / dd) * 1.3 * dt; p.rotation.y = Math.atan2(dx, dz); animatePerson(p, 1.3, dt); }
        else m.anda = false;
      } else {
        animatePerson(p, 0, dt);
        p.position.y = this.world.groundY(p.position.x, p.position.z) + Math.max(0, Math.sin(b)) * 0.28; // pulando
        u.armL.rotation.z = -2.4 + Math.sin(b) * 0.4; u.armR.rotation.z = 2.4 - Math.sin(b + 1) * 0.4; // braços pra cima
      }
      if (m.bandeira) m.bandeira.rotation.y = Math.sin(t * 2.2 + m.ph) * 0.6;
    }
    G.grito -= dt;
    if (G.grito <= 0) { G.grito = 6 + Math.random() * 6; const m = G.gente[Math.floor(Math.random() * G.gente.length)]; if (m && Math.hypot(m.p.position.x - cam.x, m.p.position.z - cam.z) < 60) this.hud.say(m.p, GRITOS[Math.floor(Math.random() * GRITOS.length)] + C.nome + '!', 2.5); }
    // foi pra porta do estádio em dia de jogo
    if (!this.foi && Math.hypot(C.x - this.player.pos.x, C.z - this.player.pos.z) < 140) { this.foi = true; this.hud.flash(`⚽ Dia de jogo do ${C.nome}!`); conta('jogo'); this.reage(C); }
  }

  // a torcida repara na camisa do jogador: a do time da casa é festa; a de rival, zoeira (de boa)
  reage(C) {
    const vestida = JSON.stringify(save.outfit?.shirt || null), time = (id) => JSON.stringify(ROUPAS.find((r) => r.id === id)?.value);
    const quem = this.crowd?.gente.slice().sort((a, b) => a.p.position.distanceTo(this.player.mesh.position) - b.p.position.distanceTo(this.player.mesh.position))[0]?.p;
    if (!quem) return;
    if (vestida === time(C.roupa)) { this.hud.say(quem, `Ê, ${C.apelido}! Chega mais, que hoje é nosso!`, 3.5); conta('camisa_time'); }
    else { const rival = CLUBES.find((k) => k !== C && vestida === time(k.roupa)); if (rival) this.hud.say(quem, `Oxe, camisa do ${rival.nome} aqui? Corajoso, visse! 😂`, 3.5); }
  }

  monta(C) {
    const group = new THREE.Group(), gente = [], W = this.world;
    const livre = (x, z) => !W.blocked(x, z) && !W.isDrive(x, z) && !W.isWater(x, z);
    const flagTex = bandeira(C);
    const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 });
    // a festa fica do lado da avenida mais perto (onde é a entrada), num leque de ~70°
    const n = this.traffic?.nearestEdge(this.traffic.drive, C.x, C.z);
    const a0 = n ? Math.atan2(n.e.a.z + n.e.dz * n.t - C.z, n.e.a.x + n.e.dx * n.t - C.x) : Math.random() * Math.PI * 2;
    let tent = 0;
    while (gente.length < 60 && tent++ < 1500) {
      const a = a0 + (Math.random() - 0.5) * 1.25, r = 55 + Math.random() * (tent > 700 ? 90 : 35), x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
      if (!livre(x, z)) continue;
      const p = makePerson({ top: 'time', time: C.time, bottom: Math.random() < 0.7 ? 'bermuda' : 'calca' });
      p.position.set(x, W.groundY(x, z), z); p.rotation.y = Math.atan2(C.x - x, C.z - z);
      const m = { p, ph: Math.random() * 6, anda: Math.random() < 0.3, para: r - 25 - Math.random() * 15 };
      if (gente.length % 6 === 0) { // bandeira no pau
        const g = new THREE.Group();
        const pau = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 5), new THREE.MeshStandardMaterial({ color: '#cfcfcf' }));
        pau.position.y = 1.2; g.add(pau);
        const pano = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.85), flagMat); pano.position.set(0.66, 2.0, 0); g.add(pano);
        g.position.set(0.3, 0.4, 0.15); p.add(g); m.bandeira = g;
      }
      group.add(p); gente.push(m);
    }
    this.scene.add(group);
    this.crowd = { group, gente, grito: 3, flagTex, flagMat };
  }

  desmonta() {
    if (!this.crowd) return;
    for (const m of this.crowd.gente) this.hud.forget(m.p);
    this.scene.remove(this.crowd.group);
    this.crowd.flagTex.dispose(); this.crowd.flagMat.dispose();
    this.crowd = null;
  }
}

function bandeira(C) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 84; const x = c.getContext('2d');
  const n = C.cores.length * 2;
  for (let i = 0; i < n; i++) {
    x.fillStyle = C.cores[i % C.cores.length];
    if (C.listras === 'v') x.fillRect((i * 128) / n, 0, 128 / n + 1, 84); else x.fillRect(0, (i * 84) / n, 128, 84 / n + 1);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
