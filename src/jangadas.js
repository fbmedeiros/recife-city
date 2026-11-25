// Jangadas navegando no mar de Boa Viagem: quatro jangadas de vela triangular colorida passeiam devagar ao longo da
// costa, a 250–450 m da avenida da orla (além da arrebentação), balançando nas ondas. Ficam só num trecho de ~1,2 km
// em volta da câmera e só quando a câmera está na orla.
import * as THREE from 'three';

const VELAS = ['#f2f2ee', '#e8343f', '#f2b705', '#2a6fb5', '#2a9d58'];
const madeira = new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 0.9 });

export class Jangadas {
  constructor({ scene, world, sharks }) {
    Object.assign(this, { scene, world, sharks });
    this.js = [];
  }

  update(dt, t, cam) {
    const S = this.sharks, ax = S?.avX?.(cam.z);
    const naOrla = ax != null && Math.abs(cam.x - ax) < 700;
    for (let i = this.js.length - 1; i >= 0; i--) {
      const J = this.js[i];
      if (!naOrla || Math.abs(J.z - cam.z) > 900) { this.scene.remove(J.g); this.js.splice(i, 1); }
    }
    if (!naOrla) return;
    while (this.js.length < 4) { if (!this.cria(cam.z + (Math.random() * 2 - 1) * 600)) break; }
    for (const J of this.js) {
      J.z += J.dir * J.vel * dt;
      const a = S.avX(J.z);
      if (a == null) { J.dir = -J.dir; continue; }
      const x = a + J.off;
      if (!this.world.isWater(x, J.z)) { J.dir = -J.dir; J.z += J.dir * 2; continue; }
      J.g.position.set(x, -0.55 + Math.sin(t * 1.3 + J.ph) * 0.18, J.z);
      J.g.rotation.y = J.dir > 0 ? 0 : Math.PI;
      J.g.rotation.z = Math.sin(t * 0.9 + J.ph) * 0.08; J.g.rotation.x = Math.sin(t * 1.1 + J.ph * 2) * 0.05;
    }
  }

  cria(z) {
    const a = this.sharks.avX(z);
    if (a == null) return false;
    const off = 250 + Math.random() * 200, x = a + off;
    if (!this.world.isWater(x, z)) return false;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 5.4), madeira));
    const mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6.2, 6), madeira); mastro.position.set(0, 3.2, 1.0); g.add(mastro);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 5.4); sh.lineTo(3.4, 0.2); sh.closePath();
    const vela = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: VELAS[Math.floor(Math.random() * VELAS.length)], roughness: 0.8, side: THREE.DoubleSide }));
    vela.position.set(0, 0.6, 1.0); vela.rotation.y = -Math.PI / 2 + 0.35; g.add(vela);
    g.position.set(x, -0.5, z);
    this.scene.add(g);
    this.js.push({ g, z, off, dir: Math.random() < 0.5 ? 1 : -1, vel: 1.2 + Math.random() * 1.3, ph: Math.random() * 6 });
    return true;
  }
}
