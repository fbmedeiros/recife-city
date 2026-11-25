import { makeVehicle, animateVehicle, SIREN } from './models.js';
import { pick } from './traffic.js';

// viaturas por nível de procurado (0 a 5 estrelas)
const COUNT = [0, 2, 3, 4, 6, 8];
const FALAS = ['Encosta o carro, macho!', 'Parado aí! Polícia!', 'Mão na cabeça, visse!', 'Tu não escapa não, visse!', 'Para, para, para!', 'Desce do carro, agora!'];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Heap {
  constructor() { this.a = []; }
  push(id, d) {
    const a = this.a; a.push([d, id]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

export class Police {
  constructor(scene, world, traffic, hud, audio) {
    this.scene = scene; this.world = world; this.traffic = traffic; this.hud = hud; this.audio = audio;
    this.g = traffic.drive;
    this.nodes = [...this.g.nodes.values()];
    this.dist = new Float32Array(this.nodes.length).fill(Infinity);
    this.cars = [];
    traffic.policeCars = this.cars; // lista própria: extraObstacles é de outros módulos (cachorros etc.), não pode virar viatura
    this.level = 0;
    this.unseen = 0;
    this.fieldT = 0;
    this.bustT = 0;
    this.frozen = 0;
    this.lastCrime = 0;
    this.spawnT = 0;
    this.onBusted = null;
  }

  crime(n, why) {
    if (this.frozen > 0) return;
    const now = performance.now();
    if (now - this.lastCrime < 1500) return;
    this.lastCrime = now;
    const before = this.level;
    this.level = Math.min(5, this.level + n);
    this.unseen = 0;
    if (this.level > before) this.hud.flash(`${why}  ${'★'.repeat(this.level)}`);
  }

  clear() {
    for (const c of this.cars) { this.scene.remove(c.mesh); this.hud.forget(c.mesh); }
    this.cars.length = 0;
    this.level = 0; this.unseen = 0; this.bustT = 0;
  }

  // distância de cada cruzamento até o jogador, seguindo as ruas (Dijkstra no grafo invertido)
  computeField(px, pz) {
    const n = this.traffic.nearestEdge(this.g, px, pz);
    if (!n) return;
    const dist = this.dist.fill(Infinity);
    const h = new Heap();
    dist[n.e.a.id] = n.t; h.push(n.e.a.id, n.t);
    const db = n.e.len - n.t;
    if (db < dist[n.e.b.id]) { dist[n.e.b.id] = db; h.push(n.e.b.id, db); }
    while (h.size) {
      const [d, u] = h.pop();
      if (d > dist[u]) continue;
      if (d > 1200) break; // viaturas nunca estão tão longe
      for (const ei of this.nodes[u].in) {
        const e = this.g.edges[ei];
        const nd = d + e.len, v = e.a.id;
        if (nd < dist[v]) { dist[v] = nd; h.push(v, nd); }
      }
    }
  }

  chooseNext(e) {
    if (this.level === 0) return this.traffic.chooseNext(this.g, e);
    let best = null, bd = Infinity;
    for (const i of e.b.out) {
      const o = this.g.edges[i];
      const d = o.len + this.dist[o.b.id] + (o.b === e.a ? 25 : 0);
      if (d < bd) { bd = d; best = o; }
    }
    return best || this.traffic.chooseNext(this.g, e);
  }

  los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 3);
    const { grid } = this.world;
    for (let i = 1; i < n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
      const ix = Math.floor((x - grid.xmin) / grid.RES), iz = Math.floor((z - grid.zmin) / grid.RES);
      if (ix < 0 || iz < 0 || ix >= grid.GW || iz >= grid.GH) return false;
      if (grid.mask[iz * grid.GW + ix] & 4) return false;
    }
    return true;
  }

  carFree(x, z, h, L) {
    const W = 0.9, f = L / 2 - 0.15, s = Math.sin(h), c = Math.cos(h), b = this.world.blocked, st = this.world.isStairs;
    for (const [a, w] of [[0, 0], [f, 0], [-f, 0], [f, W], [f, -W], [-f, W], [-f, -W], [0, W], [0, -W]]) {
      const px = x + s * a + c * w, pz = z + c * a - s * w;
      if (b(px, pz) || st?.(px, pz)) return false;
    }
    return true;
  }

  spawn(px, pz) {
    const e = this.traffic.randomEdge(this.g, px, pz, 110, 260);
    if (!e) return;
    const mesh = makeVehicle('police');
    this.scene.add(mesh);
    const c = { mesh, mode: 'graph', v: 12, stuck: 0, blind: 0, talkCd: 2 + Math.random() * 3, life: 0 };
    c.e = e; c.t = Math.random() * e.len;
    c.next = this.chooseNext(e);
    const p = this.traffic.posOn(e, c.t);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = Math.atan2(e.dx, e.dz);
    this.cars.push(c);
  }

  backToGraph(c) {
    const n = this.traffic.nearestEdge(this.g, c.mesh.position.x, c.mesh.position.z);
    if (!n) return;
    c.mode = 'graph'; c.e = n.e; c.t = n.t; c.stuck = 0; c.blind = 0;
    c.next = this.chooseNext(n.e);
    c.v = Math.max(0, c.v);
  }

  update(dt, player, time) {
    const px = player.pos.x, pz = player.pos.z;
    const pv = player.vehicle;
    const pSpeed = pv ? Math.abs(pv.speed) : player.speed || 0;
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) { this.clear(); this.onBusted?.(); }
    }

    if (this.level > 0) {
      this.fieldT -= dt;
      if (this.fieldT <= 0) { this.fieldT = 1; this.computeField(px, pz); }
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.cars.length < COUNT[this.level]) { this.spawnT = 1.2; this.spawn(px, pz); }
    }

    let seen = false, nearest = Infinity;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i], m = c.mesh;
      const dx = px - m.position.x, dz = pz - m.position.z, d = Math.hypot(dx, dz);
      c.life += dt;
      // sobrou viatura? some quando estiver longe
      if ((this.level === 0 && (d > 200 || c.life > 40)) || d > 420 || (this.cars.length > COUNT[this.level] && d > 150)) {
        this.scene.remove(m); this.hud.forget(m); this.cars.splice(i, 1); continue;
      }
      nearest = Math.min(nearest, d);
      const sees = this.level > 0 && d < 85 && this.los(m.position.x, m.position.z, px, pz);
      if (sees) seen = true;

      if (c.mode === 'graph') this.driveGraph(c, dt);
      else this.driveChase(c, dt, player, d, sees);
      if (this.level > 0 && c.mode === 'graph' && d < 45 && sees) { c.mode = 'chase'; c.blind = 0; }

      c.talkCd -= dt;
      if (this.level > 0 && d < 22 && c.talkCd <= 0) { this.hud.say(m, pick(FALAS), 2.2); c.talkCd = 6 + Math.random() * 4; }

      // batidas com o carro do jogador
      if (pv) {
        const ex = m.position.x - pv.mesh.position.x, ez = m.position.z - pv.mesh.position.z, ed = Math.hypot(ex, ez);
        if (ed < 2.8 && ed > 0.01) {
          const push = (2.8 - ed) / ed;
          pv.mesh.position.x -= ex * push * 0.5; pv.mesh.position.z -= ez * push * 0.5;
          m.position.x += ex * push * 0.5; m.position.z += ez * push * 0.5;
          if (Math.abs(pv.speed) > 8) { this.crime(1, 'Bateu na viatura'); this.audio?.thump(0.8); }
          pv.speed *= 0.5; c.v *= 0.3;
        }
      }
    }

    // fuga: sem ser visto por um tempo, as estrelas somem
    if (this.level > 0 && this.frozen <= 0) {
      if (seen) this.unseen = 0; else this.unseen += dt;
      if (this.unseen > 8 + this.level * 3) {
        this.level = 0; this.unseen = 0;
        this.hud.flash('Despistou a polícia!');
      }
      // prisão: viatura colada e jogador parado
      if (nearest < 7 && pSpeed < 3) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt);
      if (this.bustT > 2) {
        this.bustT = 0; this.frozen = 3.5;
        this.hud.banner('PRESO!', 'A PM te pegou, visse? Perdeu o carro e a ficha foi zerada.', 3.5);
      }
    }

    SIREN.update(time, this.level > 0 || this.frozen > 0);
    this.audio?.siren(this.level > 0 ? clamp(1 - nearest / 260, 0, 1) : 0);
    this.hud.setWanted(this.level, this.level > 0 && !seen && this.unseen > 1);
  }

  driveGraph(c, dt) {
    const m = c.mesh, e = c.e;
    let target = this.level > 0 ? 19 + this.level * 2 : 11;
    const remaining = e.len - c.t;
    if (c.next) {
      const turn = 1 - (c.next.dx * e.dx + c.next.dz * e.dz);
      if (turn > 0.3 && remaining < 16) target = Math.min(target, 6 + remaining * 0.6);
    }
    c.v += clamp(target - c.v, -16 * dt, 7 * dt);
    c.t += c.v * dt;
    while (c.t > c.e.len) {
      c.t -= c.e.len;
      if (!c.next) c.next = this.chooseNext(c.e);
      if (!c.next) { c.t = 0; break; }
      c.e = c.next;
      c.next = this.chooseNext(c.e);
    }
    const ce = c.e;
    const lane = ce.lane * 0.4;
    const x = ce.a.x + ce.dx * c.t - ce.dz * lane, z = ce.a.z + ce.dz * c.t + ce.dx * lane;
    const k = 1 - Math.exp(-8 * dt);
    m.position.x += (x - m.position.x) * k;
    m.position.z += (z - m.position.z) * k;
    const dh = wrap(Math.atan2(ce.dx, ce.dz) - m.rotation.y);
    m.rotation.y += dh * Math.min(1, dt * 6);
    animateVehicle(m, c.v, clamp(dh * 2, -1, 1), dt);
  }

  driveChase(c, dt, player, d, sees) {
    const m = c.mesh, L = m.userData.L;
    const pv = player.vehicle;
    let tx = player.pos.x, tz = player.pos.z;
    if (pv) { tx += Math.sin(pv.mesh.rotation.y) * pv.speed * 0.6; tz += Math.cos(pv.mesh.rotation.y) * pv.speed * 0.6; }
    const want = Math.atan2(tx - m.position.x, tz - m.position.z);
    const dh = wrap(want - m.rotation.y);
    const steer = clamp(dh, -1, 1);
    const pSpeed = pv ? Math.abs(pv.speed) : 4;
    let target = d > 14 ? 27 : Math.max(pSpeed, (d - 5) * 2);
    if (Math.abs(dh) > 1.1) target = Math.min(target, 7);
    c.v += clamp(target - c.v, -18 * dt, 8.5 * dt);
    const h = m.rotation.y + steer * 2.3 * dt * clamp(Math.abs(c.v) / 4, 0.2, 1);
    const nx = m.position.x + Math.sin(h) * c.v * dt, nz = m.position.z + Math.cos(h) * c.v * dt;
    if (this.carFree(nx, nz, h, L)) { m.position.x = nx; m.position.z = nz; c.stuck = Math.max(0, c.stuck - dt); }
    else if (this.carFree(nx, m.position.z, h, L)) { m.position.x = nx; c.v *= 0.96; }
    else if (this.carFree(m.position.x, nz, h, L)) { m.position.z = nz; c.v *= 0.96; }
    else { c.v *= -0.3; c.stuck += dt; }
    m.rotation.y = h;
    animateVehicle(m, c.v, steer, dt);
    c.blind = sees ? 0 : c.blind + dt;
    if (c.stuck > 1.2 || d > 70 || c.blind > 2.5 || this.level === 0) this.backToGraph(c);
  }
}
