import * as THREE from 'three';
import { comSemente } from './semente.js';
import { buildClassics } from './classics.js';
import { compactGroup } from './compactar.js';
import { stampMesh, stampDisc } from './collide.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const OVERRIDES = {
  'Torre Malakoff': { h: 11, color: '#f1ece2' },
  'Paço do Frevo': { color: '#f4efe4' },
};

// Marcos modelados à mão (versões simplificadas). As posições vêm do OSM.
// mesma cidade a cada carga: o que esta montagem sorteia vem de uma semente fixa (semente.js)
export function buildLandmarks(scene, data, named, env) { return comSemente(1101, () => buildLandmarksSem(scene, data, named, env)); }
function buildLandmarksSem(scene, data, named, env) {
  const overrides = OVERRIDES;
  const group = new THREE.Group();
  const find = (re) => data.pois.find((p) => re.test(p.name));
  const centroid = (b) => {
    const p = b.p;
    return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  };
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

  // Marco Zero: rosa dos ventos no chão da Praça Rio Branco
  const mz = find(/^Marco Zero$/);
  if (mz && false) { // (a Rosa dos Ventos colorida e o medalhão agora vêm de marcozero.js)
    const disc = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ map: compassTexture(), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(mz.x, 0.08, mz.z);
    disc.receiveShadow = true;
    group.add(disc);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 12), std('#d8cfbf'));
    post.position.set(mz.x, 0.7, mz.z);
    post.castShadow = true;
    group.add(post);
  }

  // Coluna de Cristal (Parque das Esculturas Francisco Brennand), no molhe em frente ao Marco Zero
  const cc = find(/Coluna de Cristal/);
  if (cc && false) { // (a Torre de Cristal detalhada vem de marcozero.js)
    const col = new THREE.Group();
    const terracotta = std('#c98f63'), cream = std('#efe6d2');
    let y = 0;
    const seg = [[2.6, 2.2, 3], [1.5, 1.7, 2], [1.6, 1.6, 18], [2.1, 1.6, 1.2], [1.2, 2.1, 3], [0.4, 1.2, 4]];
    seg.forEach(([rt, rb, h], i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 16), i % 2 ? terracotta : cream);
      m.position.y = y + h / 2; y += h;
      m.castShadow = true; col.add(m);
    });
    // anéis de "cristal"
    for (let k = 0; k < 6; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.18, 8, 24), std('#7fb3c9', { metalness: 0.5, roughness: 0.2 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 7 + k * 3;
      col.add(ring);
    }
    col.position.set(cc.x, 0, cc.z);
    group.add(col);
  }

  // Torre Malakoff: torre com cúpula e relógio sobre o prédio do Arsenal
  const tm = named['Torre Malakoff']?.[0];
  if (tm) {
    const [x, z] = centroid(tm);
    const t = new THREE.Group();
    const white = std('#f3eee4');
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 12, 7), white); body.position.y = 11 + 6; t.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.6, 7.6), std('#d9cfbd')); band.position.y = 23.2; t.add(band);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 3, 16), white); drum.position.y = 25; t.add(drum);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#6f8a8f', { metalness: 0.4, roughness: 0.4 })); dome.position.y = 26.5; t.add(dome);
    for (let k = 0; k < 4; k++) {
      const clock = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), std('#fbf8f0', { emissive: '#3a3320' }));
      const a = (k * Math.PI) / 2;
      clock.position.set(Math.sin(a) * 3.52, 19, Math.cos(a) * 3.52);
      clock.rotation.y = a;
      t.add(clock);
    }
    t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    t.position.set(x, 0, z);
    group.add(t);
  }

  // estátuas e esculturas pela cidade (monumentos, memoriais, as sereias e Cosme & Damião no molhe)
  const bronze = std('#6b5332', { metalness: 0.6, roughness: 0.45 });
  const stone = std('#cfc6b6');
  const figGeo = new THREE.CapsuleGeometry(0.32, 1.1, 4, 8);
  const pedGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  for (const p of data.pois) {
    if (!/^(monument|memorial|artwork)$/.test(p.kind)) continue;
    if (/Coluna de Cristal|^Chico Science$|^Marquês de Tamandaré$/.test(p.name)) continue; // Chico Science ganha estátua própria (boemia.js)
    const s = new THREE.Group();
    const ped = new THREE.Mesh(pedGeo, stone); ped.position.y = 0.6; s.add(ped);
    const fig = new THREE.Mesh(figGeo, bronze); fig.position.y = 2.0; s.add(fig);
    s.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    s.position.set(p.x, 0, p.z);
    s.rotation.y = Math.random() * Math.PI * 2;
    group.add(s);
  }

  // marcos montados até aqui: cada malha entra na colisão
  group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) stampMesh(o); });
  buildOrla(group, data, env);

  // Parque Dona Lindu (Niemeyer): cúpula branca e a galeria em curva
  const dl = data.pois.find((p) => p.name === 'Dona Lindu');
  if (dl) {
    const white = std('#f7f6f2', { roughness: 0.5 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), white);
    dome.scale.y = 0.75;
    dome.position.set(dl.x - 25, 0, dl.z - 20);
    const gallery = new THREE.Mesh(new THREE.BoxGeometry(70, 7, 12), white);
    gallery.position.set(dl.x + 20, 4.5, dl.z + 30);
    gallery.rotation.y = 0.25;
    for (const [dx, dz] of [[-30, -4], [0, -4], [30, -4], [-30, 4], [0, 4], [30, 4]]) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8), white);
      pil.position.set(dx, -4.2, dz);
      gallery.add(pil);
    }
    for (const o of [dome, gallery]) { o.castShadow = true; o.receiveShadow = true; group.add(o); }
  }

  group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) stampMesh(o); }); // Dona Lindu e o que veio depois
  const classics = buildClassics(group, data, named, env);

  const compacto = compactGroup(group); // marcos: malhas grandes em Int16/Int8
  scene.add(group);
  return { compacto, overrides, group, setNight: classics.setNight, update: (t, cam) => classics.update(t, cam) };
}

// coqueiros na beira-mar de Boa Viagem e as placas de alerta de tubarão
function buildOrla(group, data, env) {
  const spots = [];
  for (const r of data.roads) {
    if (!r.n || !/^Avenida (Boa Viagem|Herculano Bandeira)/.test(r.n)) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < len; d += 11) {
        const x = ax + ((bx - ax) * d) / len, z = az + ((bz - az) * d) / len;
        spots.push([x, z]);
      }
    }
  }
  const palms = [];
  const signs = [];
  let lastSign = -1e9;
  for (const [x, z] of spots) {
    for (const off of [11, 20 + Math.random() * 25]) {
      const px = x + off + (Math.random() - 0.5) * 3, pz = z + (Math.random() - 0.5) * 5;
      if (env.isSolid(px, pz) || env.isWater(px, pz)) continue;
      // nada de coqueiro no meio do calçadão (nem na pista): só na areia ou no canteiro
      if ([[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]].some(([dx, dz]) => env.isRoad?.(px + dx, pz + dz))) continue;
      palms.push([px, pz]);
    }
    if (z - lastSign > 650 || lastSign - z > 650) {
      const sx = x + 15, sz = z + 4;
      if (!env.isSolid(sx, sz) && !env.isWater(sx, sz)) { signs.push([sx, sz]); lastSign = z; }
    }
  }
  if (palms.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 9, 7).translate(0, 4.5, 0);
    const leaf = new THREE.ConeGeometry(0.55, 4.2, 4, 1).rotateX(Math.PI / 2).scale(1, 0.18, 1).translate(0, 0, 2.1);
    const leaves = [];
    for (let k = 0; k < 7; k++) leaves.push(leaf.clone().rotateX(0.45).rotateY((k / 7) * Math.PI * 2));
    const crownGeo = mergeGeometries(leaves).translate(0, 9, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#8a7253', roughness: 0.9 }), palms.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: '#4f8a3a', roughness: 0.7, side: THREE.DoubleSide }), palms.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    palms.forEach(([x, z], i) => {
      stampDisc(x, z, 0.3);
      e.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.25);
      q.setFromEuler(e);
      const k = 0.8 + Math.random() * 0.45;
      m.compose(p.set(x, 0, z), q, s.set(k, k, k));
      trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m);
    });
    for (const im of [trunks, crowns]) { im.castShadow = true; im.computeBoundingSphere(); group.add(im); }
  }
  const signMat = new THREE.MeshStandardMaterial({ map: sharkTexture(), roughness: 0.6 });
  const poleMat = new THREE.MeshStandardMaterial({ color: '#777', metalness: 0.6, roughness: 0.4 });
  for (const [x, z] of signs) {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.08), [poleMat, poleMat, poleMat, poleMat, signMat, signMat]);
    board.position.y = 2.6;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), poleMat);
    pole.position.y = 1.3;
    g.add(board, pole);
    g.position.set(x, 0, z);
    g.rotation.y = -Math.PI / 2;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(g);
  }
}

function sharkTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 186;
  const g = c.getContext('2d');
  g.fillStyle = '#ffd400'; g.fillRect(0, 0, 256, 186);
  g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 174);
  g.fillStyle = '#111'; g.textAlign = 'center';
  g.font = 'bold 30px Inter, Arial, sans-serif'; g.fillText('PERIGO', 128, 42);
  g.font = 'bold 15px Inter, Arial, sans-serif';
  g.fillText('ÁREA SUJEITA A', 128, 66); g.fillText('INCIDENTES COM TUBARÃO', 128, 84);
  // barbatana
  g.beginPath(); g.moveTo(80, 160); g.quadraticCurveTo(120, 100, 150, 98); g.quadraticCurveTo(140, 130, 160, 160); g.closePath(); g.fill();
  g.fillStyle = '#1b4f8a'; g.fillRect(40, 160, 176, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function compassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const C = 256;
  g.fillStyle = '#d9cfbb'; g.beginPath(); g.arc(C, C, 256, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3b3b3b'; g.lineWidth = 10; g.beginPath(); g.arc(C, C, 236, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(C, C, 200, 0, Math.PI * 2); g.stroke();
  const star = (n, r1, r2, rot, colA, colB) => {
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      const a1 = a - Math.PI / n, a2 = a + Math.PI / n;
      for (const [side, col] of [[a1, colA], [a2, colB]]) {
        g.fillStyle = col;
        g.beginPath(); g.moveTo(C, C);
        g.lineTo(C + Math.sin(a) * r1, C - Math.cos(a) * r1);
        g.lineTo(C + Math.sin(side) * r2, C - Math.cos(side) * r2);
        g.closePath(); g.fill();
      }
    }
  };
  star(8, 150, 40, Math.PI / 8, '#8a6a3a', '#e9dcc0');
  star(4, 195, 50, 0, '#222', '#f4efe2');
  g.fillStyle = '#c5a24a'; g.beginPath(); g.arc(C, C, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#222'; g.font = 'bold 34px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  [['N', 0], ['L', 1], ['S', 2], ['O', 3]].forEach(([t, i]) => {
    const a = (i * Math.PI) / 2;
    g.fillText(t, C + Math.sin(a) * 218, C - Math.cos(a) * 218);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
