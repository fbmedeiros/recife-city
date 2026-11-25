// Avião pousando no Aeroporto dos Guararapes: a cada 3–5 minutos um jato chega pelo norte, alinhado com a pista,
// descendo numa rampa de ~3° desde uns 9 km (≈ 470 m de altura), passa baixo sobre a cidade, toca a pista, freia e
// some no fim dela. Só voa com a câmera a menos de ~7 km do caminho. Som de turbina pela distância.
import * as THREE from 'three';

const BRANCO = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4, metalness: 0.2 });
const FAIXA = new THREE.MeshStandardMaterial({ color: '#1d5fa8', roughness: 0.5 });
const CINZA = new THREE.MeshStandardMaterial({ color: '#8a9096', roughness: 0.4, metalness: 0.5 });
const LUZ = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4d0', emissiveIntensity: 3 });

export class Avioes {
  constructor({ scene, audio, pista }) {
    Object.assign(this, { scene, audio });
    this.ok = !!pista && pista.length >= 2;
    if (!this.ok) return;
    // cabeceira norte (onde toca) e sul (fim da pista); aproximação vem do norte
    const [a, b] = pista[0][1] > pista.at(-1)[1] ? [pista.at(-1), pista[0]] : [pista[0], pista.at(-1)];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    this.A = a; this.u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; this.L = L;
    this.av = null; this.t = 40 + Math.random() * 60;
  }

  // posição ao longo do caminho: s < 0 antes da cabeceira (no ar), 0..L na pista
  pos(s) {
    const x = this.A[0] + this.u[0] * s, z = this.A[1] + this.u[1] * s;
    const y = s < 300 ? Math.max(0, (300 - s) * Math.tan((3 * Math.PI) / 180)) + 2.2 : 2.2; // toca uns 300 m depois da cabeceira
    return [x, y, z];
  }

  update(dt, cam) {
    if (!this.ok) return;
    if (!this.av) {
      this.audio.aviao?.(0);
      if ((this.t -= dt) > 0) return;
      this.t = 180 + Math.random() * 120;
      // só se a câmera estiver perto do caminho (até 7 km da linha de aproximação)
      const [mx, , mz] = this.pos(-3000);
      if (Math.hypot(mx - cam.x, mz - cam.z) > 9000) return;
      this.av = { g: modelo(), s: -9000, v: 75 };
      this.scene.add(this.av.g);
    }
    const V = this.av;
    // no ar a ~75 m/s (270 km/h); na pista freia até ~15 m/s
    if (V.s > 300) V.v = Math.max(15, V.v - 2.6 * dt);
    V.s += V.v * dt;
    const [x, y, z] = this.pos(V.s), [x2, y2, z2] = this.pos(V.s + 30);
    V.g.position.set(x, y, z);
    V.g.lookAt(x2, y2, z2);
    const d = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
    this.audio.aviao?.(d < 2500 ? (1 - d / 2500) ** 1.6 : 0);
    if (V.s > this.L - 50) { this.scene.remove(V.g); this.av = null; }
  }
}

// jato de corredor único: fuselagem, nariz, asas enflechadas, motores, deriva e profundores; luz de pouso acesa
function modelo() {
  const g = new THREE.Group(), add = (m, geo, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  add(BRANCO, new THREE.CylinderGeometry(2, 2, 30, 14).rotateX(Math.PI / 2), 0, 0, 0);
  add(BRANCO, new THREE.SphereGeometry(2, 14, 10).scale(1, 1, 2.2), 0, 0, 15);
  add(BRANCO, new THREE.ConeGeometry(2, 7, 14).rotateX(-Math.PI / 2), 0, 0.4, -18.5);
  add(FAIXA, new THREE.BoxGeometry(4.05, 0.5, 30), 0, -0.2, 0);
  for (const s of [-1, 1]) {
    add(BRANCO, new THREE.BoxGeometry(16, 0.35, 4.5), s * 9.5, -0.6, -1, 0, s * 0.45, 0); // asa enflechada
    add(CINZA, new THREE.CylinderGeometry(0.9, 0.9, 3.6, 12).rotateX(Math.PI / 2), s * 6, -1.6, 1.2); // motor
    add(BRANCO, new THREE.BoxGeometry(6, 0.25, 2.2), s * 3.6, 0.6, -18, 0, s * 0.4, 0); // profundor
    add(LUZ, new THREE.SphereGeometry(0.35, 8, 6), s * 4, -1, 2.5);
  }
  add(FAIXA, new THREE.BoxGeometry(0.3, 6, 3.6), 0, 3.6, -17.5, -0.35, 0, 0); // deriva
  g.scale.setScalar(1);
  return g;
}
