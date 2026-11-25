// Mirantes: lugares altos de onde se vê o Recife. A pé, perto do pé do mirante, B sobe e a câmera dá uma volta
// inteira devagar (~16 s) lá de cima, olhando pra cidade, com o nome e uma frase sobre a vista. B de novo (ou andar)
// desce antes. Cada mirante novo conta pro troféu (três mirantes dão "Recife de cima").
import { conta } from './trofeus.js';
import { save, persist } from './save.js';

const MIRANTES = [
  { re: /^Torre Malakoff$/, nome: 'Torre Malakoff', h: 24, frase: 'Do observatório da torre, o Recife Antigo inteiro: o porto, o Marco Zero e o Capibaribe encontrando o mar.' },
  { re: /^Santuário de Nossa Senhora da Conceição$|^Estatua de Nossa Senhora da Conceição$/, nome: 'Morro da Conceição', h: 14, frase: 'Lá de cima do morro, a Zona Norte se espalha até os prédios de Boa Viagem no horizonte.' },
  { re: /^Rampa Helicoidal do RioMar$/, nome: 'Rampa do RioMar', h: 32, frase: 'Da rampa, o Pina, a bacia do Pina e o mangue do Parque dos Manguezais, com Boa Viagem atrás.' },
  { re: /^Paço Alfândega$/, nome: 'Terraço do Paço Alfândega', h: 20, frase: 'Do terraço, a Rua do Bom Jesus, as torres das igrejas e o rio de um lado e do outro.' },
  { re: /^Edifício Holiday$/, nome: 'Edifício Holiday', h: 52, frase: 'Do alto do Holiday, a orla de Boa Viagem de ponta a ponta e o mar verde.' },
];
const DUR = 16;

export class Mirantes {
  constructor({ world, hud, player }) {
    Object.assign(this, { world, hud, player });
    this.ms = [];
    for (const M of MIRANTES) { const p = world.pois.find((q) => M.re.test(q.name)); if (p) this.ms.push({ ...M, x: p.x, z: p.z }); }
    this.ativo = null; // { M, t, p0 }
    this.cam = null;   // { pos, look } lido pelo main.js enquanto ativo
  }

  get perto() {
    if (this.player.vehicle || this.ativo) return null;
    const P = this.player.pos;
    return this.ms.find((M) => Math.hypot(M.x - P.x, M.z - P.z) < 22) || null;
  }

  get hint() { if (this.ativo) return 'B — descer do mirante'; const M = this.perto; return M ? `B — subir no mirante (${M.nome}) e ver a vista` : ''; }

  b() {
    if (this.ativo) { this.desce(); return true; }
    const M = this.perto; if (!M) return false;
    const P = this.player.pos;
    this.ativo = { M, t: 0, p0: [P.x, P.z], ang: Math.atan2(P.x - M.x, P.z - M.z) };
    this.hud.banner(M.nome, M.frase, 5);
    return true;
  }

  desce() {
    const A = this.ativo; if (!A) return;
    this.ativo = null; this.cam = null;
    if (A.t > DUR * 0.6) {
      if (!Array.isArray(save.mirantes)) save.mirantes = [];
      if (!save.mirantes.includes(A.M.nome)) { save.mirantes.push(A.M.nome); conta('mirante'); persist(); }
    }
  }

  update(dt) {
    const A = this.ativo; if (!A) return;
    const P = this.player.pos;
    // andou (ou entrou num carro): desce
    if (this.player.vehicle || Math.hypot(P.x - A.p0[0], P.z - A.p0[1]) > 3) { this.desce(); return; }
    A.t += dt;
    const M = A.M, a = A.ang + (A.t / DUR) * Math.PI * 2, y = this.world.groundY(M.x, M.z) + M.h;
    // câmera na borda do mirante olhando pra fora, um pouco pra baixo
    const px = M.x + Math.sin(a) * 2, pz = M.z + Math.cos(a) * 2;
    this.cam = { pos: [px, y, pz], look: [px + Math.sin(a) * 100, y - 18, pz + Math.cos(a) * 100] };
    if (A.t >= DUR) this.desce();
  }
}

