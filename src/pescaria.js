// Pescadores no cais: na beira do Capibaribe e do Beberibe (Rua da Aurora, Cais José Estelita, Cais de Santa Rita,
// Marco Zero, pontes do Centro), dois ou três senhores de vara na mão, a linha caindo n'água e o balde do lado.
// A pé, perto de um, B pede a vara emprestada e pesca: espera beliscar (3–8 s), quando aparece "PUXA!" aperta B de
// novo em até 1,3 s. Puxou cedo ou demorou, o peixe foge. Peixe pego o pescador compra na hora. Só monta com a
// câmera a menos de 200 m.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { addMoney } from './save.js';
import { conta } from './trofeus.js';

const LUGARES = [/^Parque da Rua da Aurora$/, /^Armazéns do Cais José Estelita$/, /^Marco Zero$/, /^Ponte Maurício de Nassau$/, /^Ponte da Boa Vista$/, /^Obelisco da Rua da Aurora$/, /^Cais de Santa Rita$/, /^Ponte Duarte Coelho$/, /^Ponte Santa Isabel$/, /^Ponte Buarque de Macedo$/];
const PEIXES = [
  { nome: 'carapeba', kg: [0.2, 0.6], preco: 8, p: 30 },
  { nome: 'tainha', kg: [0.5, 1.8], preco: 15, p: 25 },
  { nome: 'bagre', kg: [0.4, 1.5], preco: 6, p: 25 },
  { nome: 'camurim', kg: [1.5, 4.5], preco: 40, p: 8 },
  { nome: 'siri', kg: [0.1, 0.3], preco: 4, p: 12 },
];
const FUGIU = ['Ih, puxou cedo! Espantou o peixe.', 'Comeu a isca e foi embora, visse?', 'Fugiu! Tem que ter paciência, boy.'];
const CONVERSA = ['Hoje tá beliscando pouco...', 'Maré tá subindo, agora vem peixe.', 'Ontem peguei um camurim desse tamanho!', 'Pescar é bom que acalma a cabeça.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const VARA = new THREE.MeshStandardMaterial({ color: '#3a2c1e', roughness: 0.7 });
const BALDE = new THREE.MeshStandardMaterial({ color: '#e07a1f', roughness: 0.6 });
const LINHA = new THREE.LineBasicMaterial({ color: '#dddddd', transparent: true, opacity: 0.6 });
const varaGeo = new THREE.CylinderGeometry(0.012, 0.025, 3.2, 5).translate(0, 1.6, 0);

export class Pescaria {
  constructor({ scene, world, hud, player, audio }) {
    Object.assign(this, { scene, world, hud, player, audio });
    this.pontos = [];
    for (const re of LUGARES) { const p = world.pois.find((q) => re.test(q.name)); if (p) this.pontos.push({ x: p.x, z: p.z, nome: p.name, g: null, ps: [], sem: false }); }
    this.estado = null; // { fase: 'espera' | 'puxa', t, p }
  }

  get perto() {
    if (this.player.vehicle) return null;
    let best = null, bd = 3.5;
    for (const L of this.pontos) for (const p of L.ps) { const d = Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  get hint() {
    const E = this.estado;
    if (E) return E.fase === 'puxa' ? 'PUXA! Aperta B!' : 'Esperando beliscar... (B puxa a linha)';
    return this.perto ? 'B — pedir a vara emprestada e pescar' : '';
  }

  // tecla B a pé: começa a pescar ou puxa a linha
  b() {
    const E = this.estado;
    if (E) {
      if (E.fase === 'puxa') this.pegou(E.p); else { this.hud.flash(pick(FUGIU)); this.estado = null; }
      return true;
    }
    const p = this.perto; if (!p) return false;
    this.estado = { fase: 'espera', t: 3 + Math.random() * 5, p };
    this.hud.say(p.p, 'Tá aqui, segura firme. Quando beliscar tu puxa!', 2.5);
    return true;
  }

  pegou(p) {
    let r = Math.random() * PEIXES.reduce((s, f) => s + f.p, 0), f = PEIXES[0];
    for (const q of PEIXES) { if ((r -= q.p) < 0) { f = q; break; } }
    const kg = f.kg[0] + Math.random() * (f.kg[1] - f.kg[0]), preco = Math.max(2, Math.round(f.preco * kg));
    addMoney(preco);
    this.hud.flash(`Pegou ${f.nome === 'siri' ? 'um' : 'uma'} ${f.nome} de ${kg.toFixed(1).replace('.', ',')} kg! O pescador comprou: +R$ ${preco}`);
    this.hud.say(p.p, f.nome === 'camurim' ? 'Caraí, um camurim! Tu tem sorte, visse?' : 'Boa! Leva jeito pra coisa.', 2.5);
    this.audio.splash?.(0.4);
    conta('peixe'); if (f.nome === 'camurim') conta('camurim');
    this.ultimo = { nome: f.nome, kg, preco };
    this.estado = null;
  }

  update(dt, t, cam) {
    const E = this.estado;
    if (E) {
      if (this.player.vehicle || Math.hypot(E.p.x - this.player.pos.x, E.p.z - this.player.pos.z) > 5) this.estado = null;
      else if ((E.t -= dt) <= 0) {
        if (E.fase === 'espera') { E.fase = 'puxa'; E.t = 1.3; this.audio.splash?.(0.15); }
        else { this.hud.flash(pick(FUGIU)); this.estado = null; }
      }
    }
    for (const L of this.pontos) {
      if (L.sem) continue;
      const d = Math.hypot(L.x - cam.x, L.z - cam.z);
      if (L.g && d > 230) { for (const p of L.ps) this.hud.forget(p.p); this.scene.remove(L.g); L.g = null; L.ps = []; }
      if (d > 200) continue;
      if (!L.g) this.monta(L);
      for (const p of L.ps) {
        const puxando = this.estado?.p === p && this.estado.fase === 'puxa';
        p.vara.rotation.x = p.rx + Math.sin(t * 1.3 + p.ph) * 0.04 + (puxando ? Math.sin(t * 30) * 0.08 : 0);
        p.vara.updateMatrixWorld(); p.ponta.set(0, 3.2, 0); p.vara.localToWorld(p.ponta);
        const a = p.linha.geometry.attributes.position; a.setXYZ(0, p.ponta.x, p.ponta.y, p.ponta.z); a.setXYZ(1, p.agua[0], -0.7, p.agua[1]); a.needsUpdate = true;
        if ((p.fala -= dt) < 0 && Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z) < 12) { p.fala = 25 + Math.random() * 20; this.hud.say(p.p, pick(CONVERSA), 3); }
      }
    }
  }

  // beira d'água: ponto de terra livre com água a ~3 m numa direção (o pescador olha pra lá)
  monta(L) {
    const W = this.world, g = new THREE.Group(), achados = [];
    for (let r = 0; r < 160 && achados.length < 3; r += 4) for (let a = 0; a < 6.28 && achados.length < 3; a += 0.25) {
      const x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r;
      if (W.isWater(x, z) || W.blocked(x, z) || W.isDrive(x, z) || achados.some((q) => Math.hypot(q[0] - x, q[1] - z) < 12)) continue;
      for (let b = 0; b < 6.28; b += 0.4) {
        const wx = x + Math.cos(b) * 3, wz = z + Math.sin(b) * 3;
        if (W.isWater(wx, wz) && W.isWater(x + Math.cos(b) * 6, z + Math.sin(b) * 6)) { achados.push([x, z, b]); break; }
      }
    }
    if (!achados.length) { L.sem = true; return; }
    for (const [x, z, b] of achados) {
      const y = W.groundY(x, z), dx = Math.cos(b), dz = Math.sin(b);
      const p = makePerson({ tipo: Math.random() < 0.7 ? 'idoso' : 'homem', fem: false, hat: 'bone', bottom: 'bermuda' });
      p.position.set(x, y, z); p.rotation.y = Math.atan2(dx, dz); g.add(p);
      const u = p.userData; u.armR.rotation.x = -0.9; u.armL.rotation.x = -0.8; u.elbowR.rotation.x = u.elbowL.rotation.x = -0.4;
      // vara presa na frente do corpo, apontando pro rio
      const vara = new THREE.Mesh(varaGeo, VARA); vara.position.set(0.15, 1.0, 0.35); const rx = 0.9; vara.rotation.x = rx; p.add(vara);
      const balde = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.3, 10), BALDE); balde.position.set(x - dz * 0.6, y + 0.15, z + dx * 0.6); g.add(balde);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const linha = new THREE.Line(lg, LINHA); linha.frustumCulled = false; g.add(linha);
      L.ps.push({ p, x, z, vara, rx, linha, ponta: new THREE.Vector3(), agua: [x + dx * 5.5, z + dz * 5.5], ph: Math.random() * 6, fala: 3 + Math.random() * 10 });
    }
    this.scene.add(g); L.g = g;
  }
}
