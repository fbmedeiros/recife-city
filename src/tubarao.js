// Tubarão de Boa Viagem: o mar da orla agora deixa o jogador entrar (nadando, mais devagar). Passou 3 s na água,
// aparece a barbatana, o tubarão chega, ataca e o jogo acaba com "Vacilou, boy!". Na areia, as placas amarelas de
// "área sujeita a ataque de tubarão" avisam (como as de verdade na orla).
import * as THREE from 'three';
import { Kit } from './classics.js';

export class Sharks {
  constructor({ scene, world, hud, player, mat }) {
    Object.assign(this, { scene, world, hud, player });
    this.seaT = 0; this.phase = null; this.busy = false;
    // eixo da Av. Boa Viagem (norte-sul): o mar fica a leste
    const pts = world.data.roads.filter((r) => r.n === 'Avenida Boa Viagem').flatMap((r) => r.p).sort((a, b) => a[1] - b[1]);
    this.av = pts.filter((p, i) => i === 0 || p[1] - pts[i - 1][1] > 2);
    this.buildShark();
    this.buildSigns(mat);
    this.buildUI();
  }
  avX(z) {
    const A = this.av; if (A.length < 2 || z < A[0][1] || z > A.at(-1)[1]) return null;
    let lo = 0, hi = A.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m][1] <= z) lo = m; else hi = m; }
    const t = (z - A[lo][1]) / (A[hi][1] - A[lo][1] || 1); return A[lo][0] + (A[hi][0] - A[lo][0]) * t;
  }
  // mar da orla onde dá pra entrar nadando (até ~200 m da avenida)
  swimmable(x, z) {
    if (!this.world.isWater(x, z)) return false;
    const ax = this.avX(z); return ax != null && x > ax && x < ax + 200;
  }
  get swimming() { return !this.player.vehicle && this.swimmable(this.player.pos.x, this.player.pos.z); }

  buildShark() {
    const g = new THREE.Group(), grey = new THREE.MeshStandardMaterial({ color: '#6f7d86', roughness: 0.5 }), belly = new THREE.MeshStandardMaterial({ color: '#e9ecec', roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), grey); body.scale.set(0.7, 0.6, 2.4); g.add(body);
    const under = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), belly); under.scale.set(0.66, 0.5, 2.3); under.position.y = -0.02; g.add(under);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 4), grey); fin.scale.set(0.22, 1.7, 1.5); fin.position.set(0, 1.2, -0.2); fin.rotation.x = -0.35; g.add(fin);
    const tail = new THREE.Group(); tail.position.z = -2.3; g.add(tail);
    for (const s of [1, -1]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 4), grey); t.scale.set(0.15, 1, 1); t.position.set(0, s * 0.45, -0.3); t.rotation.x = s * -0.9 + Math.PI / 2 * 0; tail.add(t); }
    for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 4), grey); p.scale.set(1, 1, 0.15); p.position.set(s * 0.75, -0.25, 0.5); p.rotation.z = s * 1.9; g.add(p); }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#4a1414' })); mouth.position.set(0, -0.2, 2.1); mouth.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI); g.add(mouth);
    for (let i = 0; i < 8; i++) { const a = Math.PI * (i / 7), tooth = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), belly); tooth.position.set(Math.cos(a) * 0.3, -0.2 - Math.sin(a) * 0.04, 2.15 - Math.sin(a) * 0.05); g.add(tooth); }
    for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#0a0a0a' })); e.position.set(s * 0.42, 0.15, 1.6); g.add(e); }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.visible = false; this.scene.add(g); this.shark = g; this.tail = tail;
    // espirro de sangue e espuma
    this.splash = [];
    for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 6, 4), new THREE.MeshBasicMaterial({ color: i % 3 ? '#b3121f' : '#f4f8f8', transparent: true })); m.visible = false; this.scene.add(m); this.splash.push({ m, v: new THREE.Vector3() }); }
  }

  // placas amarelas na areia, a cada ~350 m
  buildSigns(mat) {
    if (this.av.length < 2) return;
    const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d');
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, 256, 320); g.strokeStyle = '#111'; g.lineWidth = 10; g.strokeRect(8, 8, 240, 304);
    g.fillStyle = '#111'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.fillText('PERIGO', 128, 58);
    g.beginPath(); g.moveTo(60, 190); g.quadraticCurveTo(128, 110, 196, 190); g.lineTo(150, 190); g.lineTo(128, 120); g.lineTo(110, 190); g.closePath(); g.fill(); // barbatana
    g.fillRect(40, 196, 176, 6);
    g.font = 'bold 22px Arial'; g.fillText('ÁREA SUJEITA A', 128, 240); g.fillText('ATAQUE DE', 128, 266); g.fillText('TUBARÃO', 128, 292);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const k = new Kit(), face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), post = mat('#d9d9d4', { metalness: 0.5 });
    const z0 = this.av[0][1], z1 = this.av.at(-1)[1];
    for (let z = z0 + 150; z < z1; z += 350) {
      const ax = this.avX(z); let x = null;
      for (let d = 8; d < 120; d += 1) { if (this.world.isWater(ax + d, z)) { x = ax + d - 6; break; } }
      if (x == null || this.world.isSolid(x, z) || this.world.isRoad?.(x, z)) continue;
      k.box(post, 0.1, 2.6, 0.1, x, 1.3, z).add(face, new THREE.PlaneGeometry(1.0, 1.25), [1, 1, 1], [x - 0.07, 2.2, z], [0, -Math.PI / 2, 0]).add(face, new THREE.PlaneGeometry(1.0, 1.25), [1, 1, 1], [x + 0.07, 2.2, z], [0, Math.PI / 2, 0]);
    }
    k.build(this.scene, 0, 0, 0, true, false);
  }

  buildUI() {
    const el = (this.over = document.createElement('div'));
    el.id = 'vacilou';
    el.innerHTML = `<div class="v-box"><div class="v-t">VACILOU, BOY!</div><div class="v-s">Entrou no mar de Boa Viagem e o tubarão te pegou.<br>Respeita a placa amarela, visse?</div><button>Bora de novo</button><div class="v-k">Enter</div></div>`;
    const css = document.createElement('style');
    css.textContent = `#vacilou{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(120,0,10,.55),rgba(20,0,0,.92));font-family:Inter,system-ui,sans-serif;color:#fff;text-align:center}
#vacilou.on{display:flex;animation:vac .6s ease-out}
@keyframes vac{from{opacity:0;transform:scale(1.1)}to{opacity:1;transform:none}}
#vacilou .v-t{font-family:Anton,Impact,sans-serif;font-size:clamp(48px,11vw,120px);letter-spacing:2px;color:#ffd166;text-shadow:0 6px 0 #7a0010,0 10px 30px rgba(0,0,0,.6)}
#vacilou .v-s{font-size:18px;margin:10px 0 22px;opacity:.95;line-height:1.4}
#vacilou button{font:800 18px Inter,sans-serif;background:#ffd166;color:#3b0a0a;border:0;border-radius:999px;padding:12px 28px;cursor:pointer}
#vacilou .v-k{font-size:12px;opacity:.6;margin-top:8px}`;
    document.head.appendChild(css); document.body.appendChild(el);
    el.querySelector('button').onclick = () => this.restart();
    addEventListener('keydown', (e) => { if (this.phase === 'over' && e.code === 'Enter') this.restart(); });
  }

  update(dt, t) {
    const P = this.player.pos;
    if (this.phase === 'over') return;
    if (!this.phase) {
      if (this.swimming) {
        if (this.seaT === 0) this.hud.flash('🦈 Oxe, boy, tu entrou no mar de Boa Viagem? Sai daí, visse!');
        this.seaT += dt;
        if (this.seaT > 3) {
          // barbatana surge mais pro fundo e vem direto
          this.phase = 'vem'; this.pt = 0;
          this.sx = P.x + 22; this.sz = P.z + (Math.random() - 0.5) * 14;
          this.shark.visible = true; this.hud.flash('🦈 Ó a barbatana! Corre, boy!');
        }
      } else this.seaT = 0;
    }
    if (this.phase === 'vem') {
      this.pt += dt;
      const dx = P.x - this.sx, dz = P.z - this.sz, d = Math.hypot(dx, dz);
      const sp = 9 + this.pt * 4; this.sx += (dx / d) * sp * dt; this.sz += (dz / d) * sp * dt;
      this.shark.position.set(this.sx, -0.75, this.sz); this.shark.rotation.set(0, Math.atan2(dx, dz) + Math.sin(t * 8) * 0.12, 0);
      this.tail.rotation.y = Math.sin(t * 10) * 0.5;
      if (d < 2.2) { this.phase = 'bote'; this.pt = 0; this.busy = true; this.bx = P.x; this.bz = P.z; for (const s of this.splash) { s.m.visible = true; s.m.position.set(P.x, 0.2, P.z); s.v.set((Math.random() - 0.5) * 6, 3 + Math.random() * 6, (Math.random() - 0.5) * 6); s.m.material.opacity = 1; } }
    }
    if (this.phase === 'bote') {
      this.pt += dt;
      const k = Math.min(1, this.pt / 0.5);
      this.shark.position.set(this.bx, -0.6 + Math.sin(k * Math.PI) * 2.2, this.bz); this.shark.rotation.x = -0.8 + k * 1.4;
      this.player.mesh.position.y = -0.4 - this.pt * 1.5; // puxado pro fundo
      for (const s of this.splash) { s.v.y -= 14 * dt; s.m.position.addScaledVector(s.v, dt); s.m.material.opacity = Math.max(0, 1 - this.pt / 1.4); }
      if (this.pt > 1.5) { this.phase = 'over'; this.over.classList.add('on'); document.exitPointerLock?.(); this.shark.visible = false; for (const s of this.splash) s.m.visible = false; }
    }
  }

  // volta pra areia, perto de onde entrou no mar
  restart() {
    const P = this.player.pos, ax = this.avX(P.z) ?? P.x;
    let x = ax + 6; for (let d = 6; d < 120; d += 1) { if (this.world.isWater(ax + d, P.z)) break; if (!this.world.isSolid(ax + d, P.z) && !this.world.isRoad?.(ax + d, P.z)) x = ax + d; }
    P.x = x - 4; P.z += 0;
    this.player.mesh.position.set(P.x, 0, P.z);
    this.phase = null; this.busy = false; this.seaT = 0; this.over.classList.remove('on');
    this.hud.flash('Voltou pra areia. Agora só no raso, hein!');
    this.onRestart?.();
  }
}
