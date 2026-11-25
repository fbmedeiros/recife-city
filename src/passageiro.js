// Andar de ônibus como passageiro no corredor da Conde da Boa Vista: a pé, numa estação do canteiro, B espera o
// ônibus. O primeiro que parar na estação embarca o jogador (passa a catraca, R$ 4,30). Lá dentro a câmera
// acompanha o ônibus de longe; B pede pra descer e o jogador sai na próxima estação (ou do lado do ônibus, se ele
// parar fora do corredor). B de novo na espera desiste.
import { spend } from './save.js';
import { conta } from './trofeus.js';

const PASSAGEM = 4.3;
const preco = `R$ ${PASSAGEM.toFixed(2).replace('.', ',')}`;

export class Passageiro {
  constructor({ world, traffic, hud, player, livre }) {
    Object.assign(this, { world, traffic, hud, player, livre });
    this.espera = null; // estação onde está esperando
    this.dentro = null; // { c, embarcou, quer }
  }

  get estacao() {
    if (this.player.vehicle || this.dentro) return null;
    const P = this.player.pos;
    let best = null, bd = 7;
    for (const st of this.world.busStations || []) { const d = Math.hypot(st.x - P.x, st.z - P.z); if (d < bd) { bd = d; best = st; } }
    return best;
  }

  get hint() {
    if (this.dentro) return this.dentro.quer ? 'Vai descer na próxima parada' : 'B — pedir pra descer na próxima parada';
    if (this.espera) return 'Esperando o ônibus... (B desiste)';
    return this.estacao ? `B — esperar o ônibus aqui (passagem ${preco})` : '';
  }

  // para a câmera: o ônibus faz as vezes de veículo
  get camV() { const D = this.dentro; return D ? { mesh: D.c.mesh, speed: D.c.v || 0 } : null; }

  b() {
    if (this.dentro) { this.dentro.quer = true; this.hud.flash('Tocou a campainha: desce na próxima.'); return true; }
    if (this.espera) { this.espera = null; this.hud.flash('Desistiu do ônibus.'); return true; }
    const st = this.estacao; if (!st) return false;
    this.espera = st; this.hud.flash('Esperando o ônibus na estação...');
    return true;
  }

  update(dt) {
    const P = this.player;
    if (this.espera) {
      const st = this.espera;
      if (P.vehicle || Math.hypot(st.x - P.pos.x, st.z - P.pos.z) > 9) { this.espera = null; return; }
      const c = this.traffic.cars.find((q) => q.corredor && q.parada > 0 && q.ultimaEstacao === st);
      if (c) this.embarca(c);
      return;
    }
    const D = this.dentro; if (!D) return;
    const c = D.c, m = c.mesh;
    if (!this.traffic.cars.includes(c)) { this.desce(m.position.x, m.position.z, m.rotation.y); return; }
    // o jogador vai junto, escondido
    P.pos.set(m.position.x, 0, m.position.z); P.heading = m.rotation.y;
    if (!D.quer) return;
    if (c.parada > 0 && c.ultimaEstacao && c.ultimaEstacao !== D.embarcou) { const st = c.ultimaEstacao; this.desce(st.x, st.z, m.rotation.y, true); return; }
    if (!c.corredor && (c.v || 0) < 0.5) this.desce(m.position.x, m.position.z, m.rotation.y);
  }

  embarca(c) {
    if (!spend(PASSAGEM)) { this.hud.flash(`Sem dinheiro pra passagem (${preco}).`); this.espera = null; return; }
    this.dentro = { c, embarcou: this.espera, quer: false };
    this.espera = null;
    this.player.mesh.visible = false;
    this.hud.flash(`Passou a catraca. −${preco}`);
  }

  // sai do ônibus: na estação, ou do lado dele num lugar livre
  desce(x, z, h, naEstacao = false) {
    const P = this.player;
    let px = x, pz = z;
    if (!naEstacao) for (const s of [1, -1]) { const qx = x + Math.cos(h) * 2.4 * s, qz = z - Math.sin(h) * 2.4 * s; if (this.livre(qx, qz)) { px = qx; pz = qz; break; } }
    P.pos.set(px, 0, pz);
    P.mesh.visible = true;
    this.dentro = null;
    this.hud.flash(naEstacao ? 'Desceu na estação. Valeu, motorista!' : 'Desceu do ônibus.');
    conta('passageiro');
  }
}
