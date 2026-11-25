// Artistas de rua do Centro:
// - Mamulengo no Pátio de São Pedro: a tolda de chita (barraca de pano) com a janelinha, dois bonecos de mamulengo
//   brigando e dançando lá em cima, e a criançada sentada no chão rindo;
// - Emboladores de coco na frente do Mercado de São José: dois cantadores de pandeiro, um de frente pro outro,
//   trocando verso com uma rodinha em volta (som de pandeiro e ganzá pela distância).
// A pé, perto, B joga uma moeda no chapéu (R$ 2). Assistir de perto ~30 s conta pro troféu de cada um. Só monta
// com a câmera a menos de 200 m.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { spend } from './save.js';
import { conta } from './trofeus.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const FALA_MAMULENGO = ['Ô criançada, cadê o dono da festa?', 'Vem cá que eu te dou uma paulada!', 'Ai, ai, ai, me acudam!', 'Dança, boneco, dança!', 'Quem foi que roubou meu chapéu?'];
const RISO = ['Hahaha!', 'Bate nele!', 'Olha atrás de tu!', 'Kkkkk!'];
const FALA_COCO = ['Ô parceiro, presta atenção, lá vai verso!', 'Meu pandeiro é de couro de bode!', 'Tu canta bem, mas eu canto melhor!', 'Embola, embola, que eu quero ver!', 'Segura o coco, minha gente!'];
const OBRIGADO = ['Deus lhe pague, patrão!', 'Valeu, meu irmão! Volta sempre!', 'Obrigado! A arte agradece!'];
const CHITA = (() => { // chita: fundo vermelho com florzona amarela e azul, pintada num canvas
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#c8202f'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 14; i++) { const x = (i * 37) % 128, y = (i * 53) % 128; g.fillStyle = i % 2 ? '#f2b705' : '#2a6fb5'; g.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28; g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 4, a, 0, 6.28); } g.fill(); g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(x, y, 3, 0, 6.28); g.fill(); g.fillStyle = '#2a9d58'; g.fillRect(x + 8, y + 6, 8, 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const SHOWS = [
  { tipo: 'mamulengo', lugar: [/^Pátio de São Pedro$/, /^Concatedral de São Pedro dos Clérigos$/], conta: 'mamulengo' },
  { tipo: 'coco', lugar: [/^Mercado de São José$/], conta: 'coco' },
];

export class Artistas {
  constructor({ scene, world, hud, player }) {
    Object.assign(this, { scene, world, hud, player });
    this.shows = [];
    for (const S of SHOWS) {
      const p = S.lugar.map((re) => world.pois.find((q) => re.test(q.name))).find(Boolean);
      if (p) this.shows.push({ ...S, x: p.x, z: p.z, nome: p.name, g: null, sem: false });
    }
  }

  get perto() {
    if (this.player.vehicle) return null;
    for (const S of this.shows) if (S.g && Math.hypot(S.local[0] - this.player.pos.x, S.local[1] - this.player.pos.z) < 6) return S;
    return null;
  }

  get hint() { const S = this.perto; return S ? `B — jogar uma moeda pro ${S.tipo === 'mamulengo' ? 'mamulengueiro' : 'embolador'} (R$ 2)` : ''; }

  moeda() {
    const S = this.perto; if (!S) return false;
    if (!spend(2)) { this.hud.flash('Tá sem nem dois reais, visse?'); return true; }
    this.hud.say(S.agradece, pick(OBRIGADO), 2.5);
    this.hud.flash(`Jogou uma moeda no chapéu. −R$ 2`);
    conta('artista');
    return true;
  }

  // som da roda de coco pela distância (main.js mistura com os outros loops)
  vol(cam) {
    const S = this.shows.find((s) => s.tipo === 'coco' && s.g); if (!S) return 0;
    const d = Math.hypot(S.local[0] - cam.x, S.local[1] - cam.z);
    return d < 90 ? 0.45 * (1 - d / 90) ** 2 : 0;
  }

  update(dt, t, cam) {
    const P = this.player;
    for (const S of this.shows) {
      if (S.sem) continue;
      const d = Math.hypot(S.x - cam.x, S.z - cam.z);
      if (S.g && d > 230) { for (const o of S.falam) this.hud.forget(o); this.scene.remove(S.g); S.g = null; }
      if (d > 200) continue;
      if (!S.g && !this.monta(S)) continue;
      const dj = Math.hypot(S.local[0] - P.pos.x, S.local[1] - P.pos.z), assistindo = !P.vehicle && dj < 10;
      if (S.tipo === 'mamulengo') {
        // bonecos: sobem e descem, giram, se batem; a plateia balança de rir
        S.bonecos.forEach((b, i) => {
          const fase = t * 3 + i * 2.2, briga = Math.sin(t * 0.7) > 0.4;
          b.position.y = 1.8 + Math.abs(Math.sin(fase)) * 0.18;
          b.position.x = (i ? 0.25 : -0.25) + (briga ? Math.sin(t * 9 + i * Math.PI) * 0.15 : Math.sin(fase * 0.5) * 0.1);
          b.rotation.y = briga ? (i ? -1.2 : 1.2) : Math.sin(fase * 0.7) * 0.8;
          b.rotation.z = Math.sin(fase * 1.3) * 0.25;
        });
        for (const k of S.plateia) k.userData.upper && (k.userData.upper.rotation.x = Math.max(0, Math.sin(t * 6 + k.userData.ph)) * 0.15);
      } else {
        // emboladores: balançam o pandeiro, cantam virados um pro outro
        S.cantadores.forEach((c, i) => { const u = c.userData; u.armR.rotation.x = -1.2 + Math.abs(Math.sin(t * 9 + i)) * 0.35; u.upper.rotation.y = Math.sin(t * 2 + i) * 0.2; });
      }
      if ((S.fala -= dt) <= 0) {
        S.fala = 4 + Math.random() * 4;
        if (dj < 25) {
          if (S.tipo === 'mamulengo') { this.hud.say(S.falam[0], pick(FALA_MAMULENGO), 2.5); if (Math.random() < 0.6) setTimeout(() => S.g && this.hud.say(pick(S.plateia), pick(RISO), 1.5), 1200); }
          else this.hud.say(S.cantadores[S.vez = 1 - S.vez], pick(FALA_COCO), 2.5);
        }
      }
      S.assistiu = assistindo ? S.assistiu + dt : 0;
      if (S.assistiu > 30) { S.assistiu = -1e9; conta(S.conta); this.hud.flash(S.tipo === 'mamulengo' ? 'Assistiu o mamulengo! Arte do Recife.' : 'Assistiu a embolada! Que rima, visse?'); }
    }
  }

  monta(S) {
    const W = this.world, livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z);
    let cx = null, cz = null;
    for (let r = 10; r < 70 && cx == null; r += 4) for (let a = 0; a < 6.28; a += 0.3) {
      const x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r;
      let ok = livre(x, z); for (let k = 0; k < 8 && ok; k++) { const b = (k * Math.PI) / 4; if (!livre(x + Math.cos(b) * 3.5, z + Math.sin(b) * 3.5)) ok = false; }
      if (ok) { cx = x; cz = z; break; }
    }
    if (cx == null) { S.sem = true; return false; }
    const g = new THREE.Group(), y = W.groundY(cx, cz), yaw = Math.random() * 6.28, fx = Math.sin(yaw), fz = Math.cos(yaw);
    S.local = [cx, cz]; S.fala = 2; S.vez = 0; S.assistiu = 0;
    if (S.tipo === 'mamulengo') {
      // tolda: armação de pau coberta de chita, com a janela no alto onde os bonecos aparecem
      const tolda = new THREE.Group(); tolda.position.set(cx, y, cz); tolda.rotation.y = yaw; g.add(tolda);
      const pano = new THREE.MeshStandardMaterial({ map: CHITA, roughness: 0.85, side: THREE.DoubleSide });
      const parte = (w, h, x, yy, z, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pano); m.position.set(x, yy, z); m.rotation.y = ry; tolda.add(m); };
      parte(1.8, 1.7, 0, 0.85, 0.4); parte(1.8, 0.35, 0, 2.45, 0.4); parte(0.3, 0.6, -0.75, 2.0, 0.4); parte(0.3, 0.6, 0.75, 2.0, 0.4); // frente com a janela
      parte(0.8, 2.6, -0.9, 1.3, 0, Math.PI / 2); parte(0.8, 2.6, 0.9, 1.3, 0, Math.PI / 2); parte(1.8, 2.6, 0, 1.3, -0.4);
      const fundo = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshStandardMaterial({ color: '#1d3557' })); fundo.position.set(0, 2.0, -0.3); tolda.add(fundo);
      S.bonecos = [0, 1].map((i) => {
        const b = new THREE.Group();
        const roupa = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 8), new THREE.MeshStandardMaterial({ color: i ? '#2a9d58' : '#f2b705' })); roupa.position.y = 0.05; b.add(roupa);
        const cab = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: i ? '#8a5a3c' : '#e0b48a', roughness: 0.6 })); cab.position.y = 0.28; b.add(cab);
        const chapeu = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.08, 10), new THREE.MeshStandardMaterial({ color: i ? '#c8202f' : '#3a2c1e' })); chapeu.position.y = 0.37; b.add(chapeu);
        const nariz = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), new THREE.MeshStandardMaterial({ color: '#c8202f' })); nariz.position.set(0, 0.28, 0.09); b.add(nariz);
        b.position.set(i ? 0.25 : -0.25, 1.8, 0.35); tolda.add(b); return b;
      });
      // quem fala é a tolda (o balão aparece em cima dela)
      const voz = new THREE.Object3D(); voz.position.set(cx, y + 0.3, cz); g.add(voz);
      S.falam = [voz]; S.agradece = voz;
      // criançada sentada no chão em leque na frente
      S.plateia = [];
      for (let i = 0; i < 9; i++) {
        const a = yaw + (i - 4) * 0.22, r = 3.2 + (i % 2) * 0.9, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
        const k = makePerson({ bottom: 'bermuda' }); k.scale.multiplyScalar(0.72);
        const u = k.userData; u.seated = true; u.legL.rotation.x = u.legR.rotation.x = -1.5; u.kneeL.rotation.x = u.kneeR.rotation.x = 1.6; u.ph = Math.random() * 6;
        k.position.set(x, y - 0.55, z); k.rotation.y = Math.atan2(cx - x, cz - z); g.add(k); S.plateia.push(k); S.falam.push(k);
      }
    } else {
      S.cantadores = [-1, 1].map((s) => {
        const x = cx + fz * s * 0.9, z = cz - fx * s * 0.9;
        const c = makePerson({ tipo: 'homem', hat: 'bone', shirt: s < 0 ? '#f4f1ea' : '#e8c26a', longSleeve: true, bottom: 'calca' });
        const pd = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 14), new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.8 }));
        pd.rotation.x = Math.PI / 2; pd.position.set(0, -0.35, 0.1); c.userData.elbowL.add(pd); c.userData.armL.rotation.set(-1.3, 0, -0.1); c.userData.elbowL.rotation.x = -0.8;
        c.position.set(x, y, z); c.rotation.y = Math.atan2(cx - x, cz - z) + s * 0.5; g.add(c); return c;
      });
      // chapéu no chão pras moedas e a rodinha em volta
      const chapeu = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.1, 12), new THREE.MeshStandardMaterial({ color: '#b88a4a', roughness: 0.9 })); chapeu.position.set(cx + fx * 0.8, y + 0.05, cz + fz * 0.8); g.add(chapeu);
      for (let i = 0; i < 8; i++) {
        const a = yaw + (i - 3.5) * 0.35, x = cx + Math.sin(a) * 3.4, z = cz + Math.cos(a) * 3.4;
        const p = makePerson({}); p.position.set(x, y, z); p.rotation.y = Math.atan2(cx - x, cz - z); g.add(p);
      }
      S.falam = S.cantadores; S.agradece = S.cantadores[0];
    }
    this.scene.add(g); S.g = g;
    return true;
  }
}
