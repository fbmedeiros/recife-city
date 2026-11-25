// Primeiro dia no Recife: lista curta de tarefas no canto da tela que ensina o jogo (andar, carro, celular, bico,
// álbum, rádio, mapa). Cada tarefa é marcada quando o jogo vê que foi feita, em qualquer ordem; no fim cai um
// prêmio. Fica salvo (save.roteiro); o ✕ fecha de vez pra quem já conhece.
import { save, persist, addMoney } from './save.js';

const PREMIO = 50;
const BICOS = ['corrida', 'entrega', 'turismo', 'onibus', 'racha'];

export class Roteiro {
  constructor({ player, phone, hud, radio, postal }) {
    Object.assign(this, { player, phone, hud, radio, postal });
    if (!save.roteiro || typeof save.roteiro !== 'object') save.roteiro = save.roteiro === 'ok' || save.roteiro === 'fechado' ? save.roteiro : { feitos: [] };
    this.t = 0; this.inicio = null;
    const st = () => save.stats || {};
    const bicos = () => BICOS.reduce((a, k) => a + (st()[k] || 0), 0);
    this.base = { bicos: bicos(), fotos: st().foto || 0 };
    this.tarefas = [
      { id: 'anda', txt: 'Anda um pouco pela cidade', tecla: 'WASD', ok: () => this.inicio && Math.hypot(player.pos.x - this.inicio.x, player.pos.z - this.inicio.z) > 25 },
      { id: 'carro', txt: 'Entra num carro', tecla: 'F perto de um', ok: () => !!player.vehicle },
      { id: 'celular', txt: 'Abre o celular', tecla: 'P', ok: () => phone.open },
      { id: 'bico', txt: 'Faz um bico do celular', tecla: 'aba Bicos', ok: () => bicos() > this.base.bicos },
      { id: 'foto', txt: 'Tira uma foto pro álbum', tecla: 'chega perto de um 📸', ok: () => (st().foto || 0) > this.base.fotos },
      { id: 'radio', txt: 'Liga a rádio', tecla: 'R', ok: () => radio() >= 0 },
      { id: 'mapa', txt: 'Abre o mapa da cidade', tecla: 'M', ok: () => hud.mapOpen },
    ];
    this.render();
  }

  get ativo() { return typeof save.roteiro === 'object'; }

  update(dt) {
    if (!this.ativo) return;
    this.inicio ||= { x: this.player.pos.x, z: this.player.pos.z };
    if ((this.t -= dt) > 0) return;
    this.t = 0.4;
    const R = save.roteiro;
    let mudou = false;
    for (const tf of this.tarefas) if (!R.feitos.includes(tf.id) && tf.ok()) { R.feitos.push(tf.id); mudou = true; this.hud.flash(`✔ ${tf.txt}`); }
    if (!mudou) return;
    if (R.feitos.length >= this.tarefas.length) {
      save.roteiro = 'ok'; addMoney(PREMIO);
      this.postal?.('🌴 Primeiro dia no Recife!', 'Tu já sabe se virar na cidade. Agora é com tu: bicos, álbum, troça, praia e dia de jogo te esperam.', `+R$ ${PREMIO}`);
    }
    persist();
    this.render();
  }

  fechar() { save.roteiro = 'fechado'; persist(); this.render(); }

  render() {
    let el = document.getElementById('roteiro');
    if (!this.ativo) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'roteiro';
      document.getElementById('hud')?.appendChild(el) || document.body.appendChild(el);
      el.addEventListener('click', (e) => { if (e.target.closest('.rt-x')) this.fechar(); });
    }
    const R = save.roteiro, n = R.feitos.length;
    el.innerHTML = `<div class="rt-h">Primeiro dia no Recife <span>${n}/${this.tarefas.length}</span><button class="rt-x" title="Fechar o roteiro">✕</button></div>` +
      this.tarefas.map((tf) => { const ok = R.feitos.includes(tf.id); return `<div class="rt-i${ok ? ' ok' : ''}">${ok ? '✔' : '○'} ${tf.txt}${ok ? '' : ` <small>${tf.tecla}</small>`}</div>`; }).join('');
  }
}
