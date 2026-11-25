// Casamento na saída da igreja: de vez em quando (uns 6 min), na igreja mais perto do jogador (até 250 m), os noivos
// saem pela porta entre duas fileiras de convidados que batem palma e jogam arroz. O carro dos noivos espera na rua
// com latinhas amarradas e a plaquinha de recém-casados; eles entram e o carro some. Estar perto (25 m) na hora da
// saída conta pro troféu.
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { conta } from './trofeus.js';

const VIVAS = ['Vivam os noivos!', 'Felicidades, casal!', 'Joga o buquê!', 'Beija! Beija!', 'Que casal lindo, visse!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ARROZ = new THREE.PointsMaterial({ color: '#fbfbf2', size: 0.06 });
const PLACA = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#c8202f'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('RECÉM-CASADOS ♥', 128, 43); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t }); })();
const LATA = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.8, roughness: 0.3 });

export class Casamento {
  constructor({ scene, world, hud, player, sinos, makeVehicle }) {
    Object.assign(this, { scene, world, hud, player, sinos, makeVehicle });
    this.c = null; this.espera = 90 + Math.random() * 120;
  }

  update(dt, t) {
    const P = this.player.pos;
    if (!this.c) {
      if ((this.espera -= dt) > 0) return;
      this.espera = 300 + Math.random() * 120;
      let best = null, bd = 250;
      for (const g of this.sinos?.igrejas || []) { const d = Math.hypot(g.x - P.x, g.z - P.z); if (d < bd && d > 30) { bd = d; best = g; } }
      if (best) this.monta(best);
      return;
    }
    const C = this.c; C.t += dt;
    // noivos: saem da porta e andam pelo corredor até o carro
    const u = Math.min(1, C.t / 14);
    C.noivos.forEach((n, i) => {
      const x = C.porta[0] + (C.carro[0] - C.porta[0]) * u + C.lx * (i ? 0.35 : -0.35), z = C.porta[1] + (C.carro[1] - C.porta[1]) * u + C.lz * (i ? 0.35 : -0.35);
      n.position.set(x, this.world.groundY(x, z), z); n.rotation.y = C.yaw;
      n.visible = u < 1;
      animatePerson(n, u < 1 ? 1.1 : 0, dt);
    });
    // convidados batendo palma e jogando arroz pra cima
    for (const [i, g] of C.conv.entries()) { const b = Math.max(0, Math.sin(t * 8 + i)); g.userData.armL.rotation.set(-1.3 - b * 0.4, 0, -0.2 + b * 0.3); g.userData.armR.rotation.set(-1.3 - b * 0.4, 0, 0.2 - b * 0.3); }
    const pos = C.arroz.geometry.attributes.position, vel = C.vel;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + vel[i] * dt; vel[i] -= 9.8 * dt;
      if (y < C.y || C.t < 0.5) { const k = Math.floor(Math.random() * C.conv.length), g = C.conv[k].position; pos.setXYZ(i, g.x + (Math.random() - 0.5) * 0.6, g.y + 1.8, g.z + (Math.random() - 0.5) * 0.6); vel[i] = 2 + Math.random() * 2.5; continue; }
      pos.setY(i, y);
    }
    pos.needsUpdate = true; C.arroz.visible = u < 1;
    if ((C.fala -= dt) <= 0) { C.fala = 2.5; if (Math.hypot(C.porta[0] - P.x, C.porta[1] - P.z) < 40 && u < 1) this.hud.say(pick(C.conv), pick(VIVAS), 2); }
    if (!C.viu && u > 0.2 && Math.hypot(C.porta[0] - P.x, C.porta[1] - P.z) < 25) { C.viu = true; conta('casamento'); this.hud.flash('Pegou a saída de um casamento! Felicidades aos noivos.'); }
    // noivos entraram: o carro sai devagar pela rua e some
    if (u >= 1) { C.carroM.position.x += C.fx * 4 * dt; C.carroM.position.z += C.fz * 4 * dt; }
    if (C.t > 24) this.desmonta();
  }

  monta(ig) {
    const W = this.world, livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z);
    // porta: primeiro ponto livre saindo da igreja em direção à rua mais perto; carro: na rua
    let rua = null;
    for (let r = 5; r < 80 && !rua; r += 2) for (let a = 0; a < 6.28; a += 0.2) { const x = ig.x + Math.cos(a) * r, z = ig.z + Math.sin(a) * r; if (W.isDrive(x, z)) { rua = [x, z, a]; break; } }
    if (!rua) return;
    const a = rua[2], dx = Math.cos(a), dz = Math.sin(a);
    let porta = null;
    for (let r = 2; r < 80; r += 1) { const x = ig.x + dx * r, z = ig.z + dz * r; if (livre(x, z) && !W.isDrive(x, z)) { porta = [x, z]; break; } }
    if (!porta) return;
    const carro = [rua[0] + dx * 2, rua[1] + dz * 2];
    if (Math.hypot(carro[0] - porta[0], carro[1] - porta[1]) < 4) return;
    const yaw = Math.atan2(carro[0] - porta[0], carro[1] - porta[1]), lx = Math.cos(yaw), lz = -Math.sin(yaw), y = W.groundY(...porta);
    const g = new THREE.Group();
    const noivo = makePerson({ tipo: 'homem', top: 'manga', shirt: '#1f2430', pants: '#1f2430', bottom: 'calca', shoes: '#111111' });
    const noiva = makePerson({ tipo: 'mulher', top: 'vestido', shirt: '#fbfbf8', shoes: '#f4f1ea' });
    const veu = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    veu.position.set(0, -0.2, -0.08); (noiva.userData.head || noiva).add(veu);
    g.add(noivo, noiva);
    // convidados em duas fileiras do corredor
    const conv = [], L = Math.hypot(carro[0] - porta[0], carro[1] - porta[1]);
    for (let i = 0; i < 12; i++) {
      const s = i % 2 ? 1 : -1, f = (Math.floor(i / 2) + 0.5) / 6 * Math.min(L, 12), x = porta[0] + Math.sin(yaw) * f + lx * s * 1.5, z = porta[1] + Math.cos(yaw) * f + lz * s * 1.5;
      const p = makePerson({ shoes: '#222' }); p.position.set(x, W.groundY(x, z), z); p.rotation.y = yaw + (s > 0 ? -Math.PI / 2 : Math.PI / 2); g.add(p); conv.push(p);
    }
    // carro dos noivos com latinhas e a plaquinha
    const carroM = this.makeVehicle('car', '#f4f4f2'); if (carroM.userData.rider) carroM.userData.rider.visible = false;
    carroM.position.set(carro[0], W.groundY(...carro), carro[1]); carroM.rotation.y = Math.atan2(lx, lz); // de lado na rua, paralelo à calçada
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), PLACA); placa.position.set(0, 0.75, -2.32); placa.rotation.y = Math.PI; carroM.add(placa);
    for (let i = 0; i < 4; i++) { const lata = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), LATA); lata.rotation.z = Math.PI / 2; lata.position.set(-0.45 + i * 0.3, 0.06, -3.2 - (i % 2) * 0.3); carroM.add(lata); }
    g.add(carroM);
    // arroz: pontinhos jogados pra cima pelos convidados
    const N = 300, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3).fill(-999), 3));
    const arroz = new THREE.Points(geo, ARROZ); arroz.frustumCulled = false; g.add(arroz);
    this.scene.add(g);
    this.c = { g, noivos: [noivo, noiva], conv, arroz, vel: new Float32Array(N), porta, carro, yaw, lx, lz, y, carroM, fx: lx, fz: lz, t: 0, fala: 1, viu: false, igreja: ig.nome };
    this.ultimo = ig.nome;
  }

  desmonta() {
    const C = this.c; if (!C) return;
    for (const p of C.conv) this.hud.forget(p);
    this.scene.remove(C.g); this.c = null;
  }
}
