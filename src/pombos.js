// Pombos nas praças: bandos de ~14 ciscando no chão (Marco Zero, Praça da Independência, da República, Maciel
// Pinheiro, 13 de Maio, Casa Forte). Chegou perto (a menos de 7 m, ou de carro a 15 m), o bando levanta voo de uma
// vez, dá umas voltas no alto e pousa de novo uns 15 s depois. Só existem com a câmera a menos de 250 m.
import * as THREE from 'three';

const PRACAS = [/^Marco Zero$/, /^Praça da Independência$/, /^Praça da República$/, /^Praça Maciel Pinheiro$/, /^Parque 13 de Maio$/, /^Praça de Casa Forte$/];
const corpoGeo = new THREE.SphereGeometry(0.13, 7, 5).scale(0.8, 0.75, 1.25);
const cabecaGeo = new THREE.SphereGeometry(0.06, 6, 5);
const asaGeo = new THREE.PlaneGeometry(0.28, 0.14).rotateX(-Math.PI / 2).translate(0.14, 0, 0); // asa deitada, presa no corpo
const CORES = ['#7d8088', '#8e919a', '#6b6d74', '#a3a19a', '#5c5e66'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide }));
const PESCOCO = new THREE.MeshStandardMaterial({ color: '#5f7d6e', roughness: 0.6, metalness: 0.3 });

export class Pombos {
  constructor({ scene, world, player }) {
    Object.assign(this, { scene, world, player });
    this.bandos = [];
    for (const re of PRACAS) {
      const p = world.pois.find((q) => re.test(q.name));
      if (p) this.bandos.push({ x: p.x, z: p.z, g: null, aves: [], voando: 0, t: 0 });
    }
  }

  update(dt, t, cam) {
    const P = this.player, v = P.vehicle;
    for (const B of this.bandos) {
      const dc = Math.hypot(B.x - cam.x, B.z - cam.z);
      if (dc > 280 && B.g) { this.scene.remove(B.g); B.g = null; B.aves = []; }
      if (dc > 250) continue;
      if (!B.g) this.monta(B);
      // susto: alguém chegou perto de qualquer pombo do bando
      if (B.voando <= 0) {
        const raio = v && Math.abs(v.speed) > 3 ? 15 : 7;
        if (B.aves.some((a) => Math.hypot(a.g.position.x - P.pos.x, a.g.position.z - P.pos.z) < raio)) B.voando = 14 + Math.random() * 4;
      }
      B.voando -= dt;
      for (const a of B.aves) {
        const g = a.g;
        if (B.voando > 0) {
          // voo: sobe e dá voltas largas em volta da praça, batendo as asas rápido
          a.ang += dt * (0.9 + a.ph * 0.05);
          const alt = Math.min(1, (14 - Math.max(0, B.voando - 2)) / 1.5);
          const tx = B.x + Math.cos(a.ang) * (8 + a.r), tz = B.z + Math.sin(a.ang) * (8 + a.r), ty = this.world.groundY(B.x, B.z) + 4 + a.h * alt * 5;
          g.position.x += (tx - g.position.x) * Math.min(1, dt * 2.2); g.position.z += (tz - g.position.z) * Math.min(1, dt * 2.2); g.position.y += (ty - g.position.y) * Math.min(1, dt * 2.5);
          g.rotation.y = a.ang + Math.PI; // tangente ao círculo
          const bate = Math.sin(t * 22 + a.ph) * 0.9;
          a.asaE.rotation.z = bate; a.asaD.rotation.z = -bate; a.asaE.scale.x = a.asaD.scale.x = 1;
        } else {
          // no chão: volta pro lugar, cisca (cabeça sobe e desce) e anda um pouquinho
          const chao = this.world.groundY(a.x, a.z);
          g.position.x += (a.x - g.position.x) * Math.min(1, dt * 1.5); g.position.z += (a.z - g.position.z) * Math.min(1, dt * 1.5);
          g.position.y += (chao - g.position.y) * Math.min(1, dt * 2);
          a.asaE.rotation.z = 0.1; a.asaD.rotation.z = -0.1; a.asaE.scale.x = a.asaD.scale.x = 0.35; // asa fechada junto do corpo
          a.cab.position.y = 0.12 + Math.max(0, Math.sin(t * 5 + a.ph)) * -0.08;
          if (Math.random() < dt * 0.3) { a.x += (Math.random() - 0.5) * 0.8; a.z += (Math.random() - 0.5) * 0.8; g.rotation.y = Math.random() * Math.PI * 2; }
        }
      }
    }
  }

  monta(B) {
    const g = new THREE.Group(), W = this.world;
    for (let i = 0; i < 14; i++) {
      let x = B.x, z = B.z;
      for (let k = 0; k < 10; k++) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 9; x = B.x + Math.cos(a) * r; z = B.z + Math.sin(a) * r; if (!W.blocked(x, z) && !W.isDrive(x, z) && !W.isWater(x, z)) break; }
      const p = new THREE.Group(), mat = CORES[i % CORES.length];
      const corpo = new THREE.Mesh(corpoGeo, mat); corpo.position.y = 0.12; p.add(corpo);
      const cab = new THREE.Mesh(cabecaGeo, PESCOCO); cab.position.set(0, 0.12, 0.15); p.add(cab);
      const asaE = new THREE.Mesh(asaGeo, mat), asaD = new THREE.Mesh(asaGeo, mat);
      asaE.position.set(0.05, 0.16, 0); asaD.position.set(-0.05, 0.16, 0); asaD.rotation.y = Math.PI;
      p.add(asaE, asaD);
      p.position.set(x, W.groundY(x, z), z); p.rotation.y = Math.random() * Math.PI * 2;
      g.add(p);
      B.aves.push({ g: p, cab, asaE, asaD, x, z, ang: Math.random() * Math.PI * 2, r: Math.random() * 6, h: Math.random(), ph: Math.random() * 6 });
    }
    this.scene.add(g); B.g = g; B.voando = 0;
  }
}
