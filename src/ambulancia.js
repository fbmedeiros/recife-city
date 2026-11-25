// Ambulância cruzando a cidade de sirene ligada, a cada 2,5–5 min, numa avenida perto do jogador. Ela é um carro do
// trânsito com três diferenças (em traffic.js, `c.amb`): anda mais rápido, não para no sinal e atravessa quem está
// parado. Quem está à frente na mesma mão encosta no meio-fio e quase para até ela passar.
// Ambulância genérica (branca, faixa vermelha, cruz e "AMBULÂNCIA"), sem marca de serviço real.
import * as THREE from 'three';
import { makeVehicle } from './models.js';

export class Ambulancia {
  constructor({ scene, traffic, audio, hud, player }) {
    Object.assign(this, { scene, traffic, audio, hud, player });
    this.car = null; this.t = 150 + Math.random() * 120; this.vida = 0;
    this.luzA = new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff2a2a', emissiveIntensity: 2 });
    this.luzB = new THREE.MeshStandardMaterial({ color: '#2a6bff', emissive: '#2a6bff', emissiveIntensity: 0.1 });
  }

  update(dt, t) {
    const T = this.traffic;
    if (this.car && (!T.cars.includes(this.car) || (this.vida += dt) > 100 || this.longe() > 700)) this.some();
    if (!this.car) { this.audio.ambulancia?.(0); if ((this.t -= dt) <= 0) this.chama(); return; }
    // luz giratória: vermelho e azul alternando
    const on = Math.floor(t * 4) % 2 === 0;
    this.luzA.emissiveIntensity = on ? 2.4 : 0.1; this.luzB.emissiveIntensity = on ? 0.1 : 2.4;
    const d = this.longe();
    this.audio.ambulancia?.(d < 400 ? 1 - d / 400 : 0);
  }

  longe() { const p = this.car.mesh.position; return Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z); }

  chama() {
    const T = this.traffic, P = this.player.pos;
    this.t = 150 + Math.random() * 150;
    let e = null;
    for (let k = 0; k < 20 && !e; k++) { const q = T.randomEdge(T.drive, P.x, P.z, 120, 320); if (q && ['primary', 'secondary', 'trunk', 'tertiary'].includes(q.k) && q.len > 20) e = q; }
    if (!e) return;
    const mesh = makeVehicle('suv', '#f6f6f2');
    // faixa vermelha, cruz e barra de luz no teto
    const L = mesh.userData.L || 4.6, W = 2.0;
    const faixa = new THREE.MeshStandardMaterial({ color: '#d0202a', roughness: 0.5 });
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, L * 0.9), faixa); f.position.set(sx * (W / 2 + 0.01), 0.95, 0); mesh.add(f); }
    const barra = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.25), this.luzA), b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.25), this.luzB);
    a.position.x = -0.28; b.position.x = 0.28; barra.add(a, b); barra.position.set(0, 1.95, L * 0.18); mesh.add(barra);
    const cruz = new THREE.Group();
    for (const [w, h] of [[0.5, 0.14], [0.14, 0.5]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, w), faixa); cruz.add(c); }
    for (const sx of [-1, 1]) { const c = cruz.clone(); c.position.set(sx * (W / 2 + 0.02), 1.35, -L * 0.15); mesh.add(c); }
    mesh.add(placa());
    this.scene.add(mesh);
    const car = { mesh, v: e.vmax, stuck: 0, ghost: 0, side: 0, amb: true };
    T.place(car, T.drive, e, Math.random() * e.len);
    T.cars.push(car);
    this.car = car; this.vida = 0;
    if (this.longe() < 350) this.hud.flash('🚑 Ambulância passando! Encosta e abre caminho.');
  }

  some() {
    const T = this.traffic, i = T.cars.indexOf(this.car);
    if (i >= 0) T.cars.splice(i, 1);
    this.scene.remove(this.car.mesh);
    this.car = null;
  }
}

// "AMBULÂNCIA" escrito ao contrário no capô, pra ler no retrovisor (como nas de verdade)
function placa() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d');
  x.fillStyle = '#f6f6f2'; x.fillRect(0, 0, 256, 48);
  x.translate(256, 0); x.scale(-1, 1);
  x.fillStyle = '#d0202a'; x.font = '800 34px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('AMBULÂNCIA', 128, 26);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.rotation.x = -Math.PI / 2 + 0.25; m.position.set(0, 1.12, 2.05);
  return m;
}
