// Empinar pipa na comunidade: perto de uma das crianças que estão soltando pipa (src/pipas.js), a pé, B pede uma
// pipa emprestada ("Pega a reserva, mas devolve!"). Aí você fica parado segurando a linha e a câmera olha pra pipa:
// W/↑ puxa a linha (a pipa sobe, a linha encurta um pouco), S/↓ dá linha (vai mais longe, desce devagar), A/D vira pra
// um lado e pro outro. A brisa vem em rajadas; pipa muito de lado embica e despenca. A meta é segurar a pipa a 35 m de
// altura por 20 s (somados) em até 90 s: conta pro troféu. Se ela descer a menos de 3 m, caiu. B recolhe a linha.
// Linha de algodão, sem cerol: cerol é proibido e machuca gente, a molecada aqui não usa.
import * as THREE from 'three';
import { conta } from './trofeus.js';

const VENTO = new THREE.Vector2(0.8, -0.6).normalize(); // mesma brisa de src/pipas.js
const META = 35, SEGURA = 20, LIMITE = 90;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function pipaMesh() {
  const s = new THREE.Shape(); s.moveTo(0, 0.55); s.lineTo(0.42, 0); s.lineTo(0, -0.75); s.lineTo(-0.42, 0); s.closePath();
  const k = new THREE.Group();
  k.add(new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: '#ff3b3b', roughness: 0.7, side: THREE.DoubleSide, emissive: '#ff3b3b', emissiveIntensity: 0.2 })));
  const faixa = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.25), new THREE.MeshStandardMaterial({ color: '#ffd166', side: THREE.DoubleSide })); faixa.position.set(0, -0.1, 0.005); k.add(faixa);
  const rab = [], rm = new THREE.MeshStandardMaterial({ color: '#ffd166', side: THREE.DoubleSide });
  let pai = k, y = -0.75;
  for (let j = 0; j < 6; j++) { const piv = new THREE.Group(); piv.position.y = y; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.5), rm); m.position.y = -0.25; piv.add(m); pai.add(piv); rab.push(piv); pai = piv; y = -0.5; }
  k.scale.setScalar(2.3);
  return { k, rab };
}

export class Empinar {
  constructor({ scene, world, hud, player, pipas, weather }) {
    Object.assign(this, { scene, world, hud, player, pipas, weather });
    this.S = null; this.f = 0; this.s = 0;
  }

  get ativo() { return !!this.S; }
  criancaPerto() {
    if (this.S || this.player.vehicle || !this.pipas.g) return null;
    const P = this.player.pos;
    return this.pipas.ps.find((q) => !q.livre && Math.hypot(q.ax - P.x, q.az - P.z) < 3) || null;
  }
  get hint() {
    if (this.S) return 'W puxa · S dá linha · A/D vira a pipa · B recolhe';
    return this.criancaPerto() ? 'B — pedir uma pipa emprestada e empinar' : '';
  }

  b() {
    if (this.S) { this.fim('recolheu'); return true; }
    const c = this.criancaPerto(); if (!c) return false;
    if ((this.weather?.r || 0) > 0.3) { this.hud.say(c.kid, 'Com chuva não dá, a pipa de seda rasga!', 3); return true; }
    const { k, rab } = pipaMesh();
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.7 })); line.frustumCulled = false;
    this.scene.add(k, line);
    const P = this.player.pos;
    // começa baixinha, a favor do vento, com 12 m de linha
    this.S = { k, rab, line, kid: c.kid, L: 12, el: 0.5, az: 0, raj: 0.6, alvoRaj: 0.6, tr: 0, alto: 0, t: 0, ax: P.x, az0: P.z, y0: this.world.groundY(P.x, P.z) };
    this.player.heading = Math.atan2(VENTO.x, VENTO.y);
    this.hud.say(c.kid, 'Pega a reserva, mas devolve, visse!', 3);
    this.hud.banner('Empinar pipa', `Segura a pipa a ${META} m de altura por ${SEGURA} s. W puxa, S dá linha, A/D vira.`, 4);
    return true;
  }

  // chamado no lugar do andar enquanto empina (f: frente/trás, s: lados)
  controle(f, s) { this.f = f; this.s = s; }

  get altura() { const S = this.S; return S ? S.L * Math.sin(S.el) : 0; }
  get pos() {
    const S = this.S, h = Math.cos(S.el) * S.L, c = Math.cos(S.az), s = Math.sin(S.az);
    const dx = VENTO.x * c - VENTO.y * s, dz = VENTO.x * s + VENTO.y * c;
    return new THREE.Vector3(S.ax + dx * h, S.y0 + 1.5 + Math.sin(S.el) * S.L, S.az0 + dz * h);
  }

  update(dt, t) {
    const S = this.S; if (!S) return;
    S.t += dt;
    if (this.player.vehicle) return this.fim('largou');
    if ((this.weather?.r || 0) > 0.3) return this.fim('chuva');
    // rajadas: a força do vento muda devagar entre fraca e forte
    if ((S.tr -= dt) <= 0) { S.tr = 2 + Math.random() * 3; S.alvoRaj = 0.25 + Math.random() * 0.9; }
    S.raj += (S.alvoRaj - S.raj) * Math.min(1, dt * 0.8);
    const f = this.f, s = this.s;
    // puxar sobe e encurta; dar linha alonga e baixa; sem mexer, a pipa cai devagar se o vento estiver fraco
    S.el += ((S.raj - 0.55) * 0.35 + Math.max(0, f) * 0.55 - Math.max(0, -f) * 0.04) * dt;
    S.L += (Math.max(0, -f) * 7 - Math.max(0, f) * 1.2) * dt;
    S.L = Math.max(8, Math.min(70, S.L)); S.el = Math.min(1.35, S.el);
    // de lado: o vento empurra pra onde ela já está inclinada; muito de lado, embica e despenca
    S.az += (s * 0.9 + Math.sin(t * 0.7) * 0.12 * S.raj + S.az * 0.15) * dt;
    if (Math.abs(S.az) > 1.15) S.el -= 0.9 * dt;
    const h = this.altura;
    if (h >= META) S.alto += dt;
    const k = S.k, p = this.pos;
    k.position.copy(p); k.lookAt(S.ax, S.y0 + 1.5, S.az0); k.rotateZ(S.az * 0.8 + Math.sin(t * 2.3) * 0.15);
    S.rab.forEach((r, i) => { r.rotation.x = Math.sin(t * 6 + i * 0.8) * 0.5; });
    const a = S.line.geometry.attributes.position; a.setXYZ(0, S.ax, S.y0 + 1.5, S.az0); a.setXYZ(1, p.x, p.y, p.z); a.needsUpdate = true;
    // jogador de frente pra pipa, braços pra cima segurando a linha
    const m = this.player.mesh, u = m.userData; m.rotation.y = this.player.heading = Math.atan2(p.x - S.ax, p.z - S.az0);
    if (u.armR) { u.armR.rotation.x = -2.3 - Math.max(0, f) * 0.5 + Math.sin(t * 8) * (f > 0 ? 0.25 : 0.05); u.armL.rotation.x = -1.7; }
    this.hud.objective(`Pipa: ${Math.round(h)} m de altura · ${Math.round(S.L)} m de linha · lá no alto ${Math.floor(S.alto)}/${SEGURA} s`);
    if (S.alto >= SEGURA) return this.fim('conseguiu');
    if (h < 3 && S.t > 6) return this.fim('caiu');
    if (S.t > LIMITE) this.fim('cansou');
  }

  // câmera atrás do jogador, olhando entre ele e a pipa
  cam() {
    const S = this.S; if (!S) return null;
    const p = this.pos, P = this.player.pos, dx = p.x - P.x, dz = p.z - P.z, l = Math.hypot(dx, dz) || 1;
    const y = S.y0 + 1.6, ux = -dx / l, uz = -dz / l;
    // anda pra trás até 7 m, parando antes de parede (no morro as casas ficam coladas)
    let d = 7; for (let q = 0.8; q <= 7; q += 0.4) if (this.world.blocked(P.x + ux * q, P.z + uz * q)) { d = Math.max(0.9, q - 0.6); break; }
    return { pos: [P.x + ux * d, y + 0.6 + d * 0.23, P.z + uz * d], look: [P.x + (p.x - P.x) * 0.4, y + (p.y - y) * 0.4, P.z + (p.z - P.z) * 0.4], yaw: Math.atan2(-dx, -dz) };
  }

  fim(como) {
    const S = this.S; if (!S) return;
    this.S = null; this.f = this.s = 0;
    this.scene.remove(S.k, S.line); S.line.geometry.dispose();
    this.hud.objective(null);
    const u = this.player.mesh?.userData; if (u?.armR) { u.armR.rotation.x = 0; u.armL.rotation.x = 0; }
    if (como === 'conseguiu') { conta('pipa_alto'); this.hud.banner('Pipa lá no alto!', 'Segurou 20 s acima de 35 m. A molecada bateu palma.', 4); this.hud.say(S.kid, pick(['Caraí, tu empina bem!', 'Essa foi longe, visse!', 'Pode ficar mais um pouco com ela!']), 3); }
    else if (como === 'caiu') this.hud.banner('A pipa caiu!', 'Faltou vento, ou faltou puxar. Pede de novo e tenta outra vez.', 3.5);
    else if (como === 'cansou') this.hud.banner('Recolheu a pipa', `Ficou ${Math.floor(S.alto)} s lá no alto. A meta é ${SEGURA} s acima de ${META} m.`, 3.5);
    else if (como === 'chuva') this.hud.banner('Chuva!', 'Recolheu a pipa antes de o papel de seda rasgar.', 3);
    else this.hud.flash('Recolheu a linha e devolveu a pipa.');
  }
}
