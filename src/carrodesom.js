// Carro de som: um carro do trânsito perto do jogador ganha as cornetas no teto e sai anunciando o que está rolando
// na cidade agora (jogo, troça de frevo, feira, forró, capoeira) misturado com propaganda de loja de bairro
// (inventada). Fala a cada ~9 s quando passa a menos de 70 m; quando o carro some, outro assume uns 40 s depois.
import * as THREE from 'three';

const PROPAGANDA = [
  'Atenção, atenção! Mercadinho Boa Sorte: o quilo do charque tá na promoção, é só hoje!',
  'Olha o ovo! Trinta ovos é quinze reais, ovo fresquinho de granja!',
  'Atenção, freguesia! Loja do Seu Biu: tudo pra casa, parcelado em dez vezes!',
  'Chegou o gás! Olha o gás, entrega rapidinho no seu endereço!',
  'Atenção, atenção! Curso de cabeleireiro com certificado, as inscrições tão abertas!',
];
const CINZA = new THREE.MeshStandardMaterial({ color: '#d9d9d9', roughness: 0.5, metalness: 0.4 });
const PRETO = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6 });
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class CarroDeSom {
  constructor({ traffic, hud, player, day, audio, eventos }) {
    Object.assign(this, { traffic, hud, player, day, audio, eventos });
    this.c = null; this.espera = 20; this.fala = 3;
  }

  // o que está rolando agora (cada módulo diz se está ativo)
  anuncios() {
    const E = this.eventos, out = [];
    if (E.jogo?.ativo && E.jogo.clube) out.push(`Hoje tem ${E.jogo.clube.nome} ${E.jogo.clube.estadio}! Bota a camisa e vem pro jogo!`);
    if (E.bloco?.ativo) out.push('A troça de frevo tá desfilando no Recife Antigo! Pega a sombrinha e vem!');
    if (E.feira?.aberta) out.push('Feira livre na frente dos mercados de bairro, fruta fresquinha até uma da tarde!');
    if (E.forro && E.day.hours >= 13) out.push('Hoje tem forró pé-de-serra no pátio do Mercado da Boa Vista! Arrasta-pé a tarde toda!');
    if (E.capoeira?.ativa) out.push('Roda de capoeira no Marco Zero! Vem ver a ginga, minha gente!');
    return out;
  }

  get frase() { const a = this.anuncios(); return a.length && Math.random() < 0.65 ? pick(a) : pick(PROPAGANDA); }

  update(dt) {
    const T = this.traffic, P = this.player.pos;
    if (this.c && !T.cars.includes(this.c)) { this.solta(); }
    if (!this.c) {
      if ((this.espera -= dt) > 0) return;
      this.espera = 5;
      const c = T.cars.find((q) => !q.amb && !q.puxa && q !== this.player.vehicle && /^(car|suv)$/.test(q.mesh.userData.kind || '') && Math.hypot(q.mesh.position.x - P.x, q.mesh.position.z - P.z) < 220);
      if (c) this.pega(c);
      return;
    }
    const m = this.c.mesh, d = Math.hypot(m.position.x - P.x, m.position.z - P.z);
    if ((this.fala -= dt) <= 0) {
      this.fala = 9;
      if (d < 70) { this.hud.say(m, this.frase, 4.5); this.audio.horn?.(0.15 * (1 - d / 70)); }
    }
  }

  pega(c) {
    const g = new THREE.Group(), m = c.mesh;
    // altura do teto pela caixa do carro
    const box = new THREE.Box3().setFromObject(m), topo = box.max.y - m.position.y;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.9), PRETO); g.add(base);
    for (const s of [-1, 1]) {
      const corneta = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.06, 0.5, 12, 1, true), CINZA);
      corneta.rotation.x = s * Math.PI / 2; corneta.position.set(0, 0.22, s * 0.3); g.add(corneta);
    }
    g.position.y = topo + 0.03; m.add(g);
    this.c = c; c.som = true; this.ext = g; this.fala = 2;
  }

  solta() {
    if (this.c) { this.c.mesh.remove(this.ext); this.hud.forget(this.c.mesh); this.c.som = false; }
    this.c = null; this.ext = null; this.espera = 40;
  }
}
