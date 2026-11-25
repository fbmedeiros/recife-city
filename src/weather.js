// Toró: a chuva forte e rápida do Recife. Chega de vez em quando, fecha o céu, escurece a luz, encurta a neblina e
// faz barulho; depois estia. As gotas são riscos numa caixa em volta da câmera, que caem e dão a volta no shader
// (nenhum vértice é mexido no JS). game.weather.set(1) força a chuva; set(0) estia.
import * as THREE from 'three';
import { conta } from './trofeus.js';

const N = 14000, BOX = 70, ALT = 36;
const CHEGA = ['Vem um toró aí, visse!', 'Caraí, que toró!', 'Fecha o vidro que vem chuva!', 'Lá vem chuva, corre pra debaixo da marquise!'];
const ESTIA = ['Estiou! O sol voltou.', 'A chuva passou, mas a rua tá um lago.', 'Estiou. Cuidado com as poças, visse?'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const CINZA = new THREE.Color('#8b939a');

export class Weather {
  constructor({ scene, day, audio, hud, world, traffic }) {
    Object.assign(this, { scene, day, audio, hud, world, traffic });
    this.flood = 0;        // alagamento: sobe com chuva forte, baixa devagar depois que estia
    this.spots = new Map(); // poça por trecho de rua (decidido uma vez, a mesma poça volta no mesmo lugar)
    this.near = [];         // poças perto do jogador agora: { x, z, rx, rz, rot, mesh }
    this.pool = [];
    this.scanT = 0;
    this.r = 0;            // intensidade atual (0 seco, 1 toró)
    this.target = 0;
    this.wait = 240 + Math.random() * 240; // primeira chuva depois de 4 a 8 min
    this.mesh = makeRain();
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.near0 = scene.fog.near; // o ciclo do dia não refaz o near da neblina a cada quadro
  }

  set(v) { this.target = v; this.wait = v ? 90 + Math.random() * 90 : 300 + Math.random() * 300; this.announce(v); }

  announce(v) { if (v && !this.raining) { this.hud.flash('🌧️ ' + pick(CHEGA)); conta('toro'); } else if (!v && this.raining) this.hud.flash('☀️ ' + pick(ESTIA)); this.raining = !!v; }

  // depois de day.update: escurece o que o ciclo do dia acabou de pôr
  update(dt, camera, started) {
    if (started) {
      this.wait -= dt;
      if (this.wait <= 0) this.set(this.target ? 0 : 0.7 + Math.random() * 0.3);
    }
    // alagamento: uns 40 s de toró forte enchem a rua; depois de estiar, a água leva uns 2 min pra baixar
    this.flood = Math.max(0, Math.min(1, this.flood + (this.r > 0.5 ? dt / 40 : -dt / 120)));
    this.updatePuddles(dt, camera);
    this.updateSprays(dt);
    const k = 1 - Math.exp(-dt / 6); // a chuva engrossa e afina em uns 6 s
    this.r += (this.target - this.r) * k;
    if (Math.abs(this.r - this.target) < 0.002) this.r = this.target;
    const r = this.r, d = this.day;
    this.audio.rain?.(started ? r : 0);
    this.mesh.visible = r > 0.01;
    const fog = this.scene.fog;
    fog.near = this.near0 * (1 - 0.7 * r);
    if (r <= 0.001) { if ('intensity' in d.sun.shadow) d.sun.shadow.intensity = 1; return; }
    fog.color.lerp(CINZA, 0.6 * r).multiplyScalar(1 - 0.35 * d.night * r);
    fog.far *= 1 - 0.6 * r;
    d.sun.intensity *= 1 - 0.75 * r;
    d.hemi.intensity *= 1 - 0.25 * r;
    d.renderer.toneMappingExposure *= 1 - 0.2 * r;
    d.bloom *= 1 - 0.5 * r;
    if ('intensity' in d.sun.shadow) d.sun.shadow.intensity = 1 - 0.85 * r; // sombra quase some com o céu fechado
    const su = d.skyMat.uniforms; // céu: sol escondido, cores puxadas pro cinza de chuva
    su.sunVis.value *= 1 - r; su.glowStr.value *= 1 - 0.9 * r;
    su.zen.value.lerp(CINZA, 0.75 * r).multiplyScalar(1 - 0.3 * d.night * r); su.hor.value.lerp(CINZA, 0.75 * r); su.belt.value.lerp(CINZA, 0.75 * r);
    const cu = d.clouds.material.uniforms;
    cu.cover.value = Math.max(cu.cover.value, 0.55 + 0.45 * r);
    cu.lit.value.lerp(CINZA, 0.7 * r); cu.shade.value.lerp(CINZA, 0.5 * r).multiplyScalar(1 - 0.4 * r);
    const u = this.mesh.material.uniforms;
    u.time.value += dt;
    u.cam.value.copy(camera.position);
    u.alpha.value = r * (0.6 - 0.25 * d.night);
    u.col.value.copy(fog.color).lerp(new THREE.Color('#e6eef5'), 0.6);
  }
}

// ---------------------------------------------------------------- alagamento
// Poça em trecho de rua de carro a até ~80 m de rio, canal ou mar (onde a água não escoa: no Recife, quase toda
// avenida perto do Capibaribe, do Beberibe e dos canais), mais uma ou outra baixada qualquer.
Weather.prototype.spotOf = function (e) {
  const key = Math.round(e.mx) + ',' + Math.round(e.mz);
  let sp = this.spots.get(key);
  if (sp !== undefined) return sp;
  sp = null;
  const W = this.world, h = hash2(e.mx, e.mz);
  let perto = false;
  for (let a = 0; a < 8 && !perto; a++) for (const d of [35, 70]) { const x = e.mx + Math.cos(a * 0.785) * d, z = e.mz + Math.sin(a * 0.785) * d; if (W.isWater(x, z) && !W.isWater(e.mx, e.mz)) { perto = true; break; } }
  if (e.len > 12 && (perto ? h < 0.55 : h < 0.04)) {
    const t = 0.25 + hash2(e.mz, e.mx) * 0.5, w = Math.max(5, e.w || 7);
    sp = { x: e.a.x + e.dx * e.len * t, z: e.a.z + e.dz * e.len * t, rx: Math.min(w * 0.42, 5) * (0.8 + h * 0.4), rz: 4 + hash2(e.mx + 1, e.mz) * 7, rot: Math.atan2(e.dx, e.dz) };
  }
  this.spots.set(key, sp);
  return sp;
};

Weather.prototype.updatePuddles = function (dt, camera) {
  const f = this.flood;
  if (f <= 0) { for (const p of this.near) p.mesh.visible = false; return; }
  if ((this.scanT -= dt) <= 0) {
    this.scanT = 1.5;
    const g = this.traffic.drive, cx = Math.floor(camera.position.x / 100), cz = Math.floor(camera.position.z / 100), list = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) for (const e of g.cells.get(cx + i + ',' + (cz + j)) || []) { const sp = this.spotOf(e); if (sp && !list.includes(sp)) list.push(sp); }
    for (const p of this.near) if (!list.includes(p)) { p.mesh.visible = false; this.pool.push(p.mesh); p.mesh = null; }
    this.near = list.slice(0, 60);
    for (const p of this.near) {
      if (!p.mesh) {
        p.mesh = this.pool.pop() || this.newPuddle();
        p.mesh.position.set(p.x, this.world.groundY ? this.world.groundY(p.x, p.z) + 0.06 : 0.06, p.z);
        p.mesh.rotation.y = p.rot;
      }
    }
  }
  const s = Math.min(1, f * 1.4);
  for (const p of this.near) { p.mesh.visible = true; p.mesh.scale.set(p.rx * s, 1, p.rz * s); }
  PUDDLE_MAT.opacity = 0.45 + 0.3 * f;
  PUDDLE_MAT.color.copy(this.scene.fog.color).lerp(WATER_TINT, 0.35);
};

Weather.prototype.newPuddle = function () {
  const m = new THREE.Mesh(PUDDLE_GEO, PUDDLE_MAT);
  m.renderOrder = 2;
  this.scene.add(m);
  return m;
};

// profundidade da poça no ponto (0 fora, até 1 no meio), para o carro frear e espirrar
Weather.prototype.puddleAt = function (x, z) {
  if (this.flood < 0.15) return 0;
  const s = Math.min(1, this.flood * 1.4);
  for (const p of this.near) {
    const dx = x - p.x, dz = z - p.z, c = Math.cos(p.rot), sn = Math.sin(p.rot);
    const u = (dx * c - dz * sn) / (p.rx * s), v = (dx * sn + dz * c) / (p.rz * s), q = u * u + v * v;
    if (q < 1) return (1 - q) * this.flood;
  }
  return 0;
};

// carro passando na poça: borrifo d'água (pontos que sobem e caem) e quem estiver na calçada perto reclama
const FALAS_MOLHOU = ['Ei, motô! Me molhou todinho!', 'Oxe! Tá doido, é? Olha a poça!', 'Caraí, encharcou minha roupa!', 'Vai devagar na água, tabacudo!', 'Eita, era minha roupa de trabalho!'];
Weather.prototype.splash = function (x, z, heading, speed) {
  const n = 60, pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, sp = 3 + Math.random() * speed * 0.35;
    pos[i * 3] = x + Math.cos(heading) * side * 1.0; pos[i * 3 + 1] = 0.2; pos[i * 3 + 2] = z - Math.sin(heading) * side * 1.0;
    vel.push(Math.cos(heading) * side * sp + (Math.random() - 0.5) * 2, 2.5 + Math.random() * 3.5, -Math.sin(heading) * side * sp + (Math.random() - 0.5) * 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe8ef', size: 0.12, map: gota(), alphaTest: 0.02, transparent: true, opacity: 0.85, depthWrite: false }));
  this.scene.add(pts);
  (this.sprays ||= []).push({ pts, vel, t: 0 });
  for (const p of this.traffic.peds) {
    if (p.down > 0 || p.molhou > 0) continue;
    if (Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z) < 8) { this.hud.say(p.mesh, pick(FALAS_MOLHOU), 3); p.molhou = 20; p.flee = 1.5; conta('molhou'); break; }
  }
};
Weather.prototype.updateSprays = function (dt) {
  if (!this.sprays?.length) return;
  for (let k = this.sprays.length - 1; k >= 0; k--) {
    const S = this.sprays[k]; S.t += dt;
    const a = S.pts.geometry.attributes.position;
    for (let i = 0; i < S.vel.length / 3; i++) { S.vel[i * 3 + 1] -= 9.8 * dt; a.array[i * 3] += S.vel[i * 3] * dt; a.array[i * 3 + 1] = Math.max(0, a.array[i * 3 + 1] + S.vel[i * 3 + 1] * dt); a.array[i * 3 + 2] += S.vel[i * 3 + 2] * dt; }
    a.needsUpdate = true;
    S.pts.material.opacity = 0.85 * (1 - S.t / 0.9);
    if (S.t > 0.9) { this.scene.remove(S.pts); S.pts.geometry.dispose(); S.pts.material.dispose(); /* a textura da gota é compartilhada */ this.sprays.splice(k, 1); }
  }
  for (const p of this.traffic.peds) if (p.molhou > 0) p.molhou -= dt;
};

const PUDDLE_GEO = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const PUDDLE_MAT = new THREE.MeshStandardMaterial({ color: '#4a5560', roughness: 0.02, metalness: 0.95, envMapIntensity: 1.6, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
let GOTA = null; // gota redonda (sem isso o ponto é um quadrado)
function gota() {
  if (GOTA) return GOTA;
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return (GOTA = new THREE.CanvasTexture(c));
}
const WATER_TINT = new THREE.Color('#5d7a8c');
function hash2(x, z) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }

function makeRain() {
  const pos = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const x = Math.random() * BOX, y = Math.random() * ALT, z = Math.random() * BOX;
    for (let e = 0; e < 2; e++) { const q = i * 2 + e; pos[q * 3] = x; pos[q * 3 + 1] = y; pos[q * 3 + 2] = z; end[q] = e; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('end', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, alpha: { value: 0 }, col: { value: new THREE.Color('#dfe7ee') } },
    vertexShader: `
      attribute float end; uniform float time; uniform vec3 cam; varying float vA;
      void main() {
        float sp = 24.0 + fract(position.x * 7.13 + position.z * 3.7) * 8.0;   // gotas caem a 24–32 m/s
        float y = mod(position.y - time * sp, ${ALT.toFixed(1)});
        vec3 p = vec3(cam.x + mod(position.x - cam.x, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)}, cam.y - 12.0 + y, cam.z + mod(position.z - cam.z, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)});
        p += vec3(0.25, 1.0, -0.15) * end * 0.9;                               // risco de ~0,9 m, inclinado pelo vento
        vA = 1.0 - end * 0.7;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform float alpha; uniform vec3 col; varying float vA; void main() { gl_FragColor = vec4(col, alpha * vA); }`,
  });
  const L = new THREE.LineSegments(g, m);
  L.frustumCulled = false;
  L.renderOrder = 6;
  return L;
}

// guarda-chuva de pedestre: copa em gomos coloridos e cabo, preso acima da cabeça (a pessoa tem ~1,75 m)
const UMB_CORES = ['#1d1d1d', '#c8102e', '#1f4fa0', '#f2c230', '#2e8b57', '#7b2d8e'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide }));
const UMB_CABO = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.5 });
const UMB_COPA = new THREE.ConeGeometry(0.62, 0.28, 8, 1, true).translate(0, 2.2, 0);
const UMB_HASTE = new THREE.CylinderGeometry(0.012, 0.012, 1.05, 5).translate(0, 1.72, 0);
export function makeUmbrella() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(UMB_COPA, UMB_CORES[Math.floor(Math.random() * UMB_CORES.length)]), new THREE.Mesh(UMB_HASTE, UMB_CABO));
  g.position.set(0.12, 0, 0.08);
  g.rotation.z = -0.06;
  return g;
}
