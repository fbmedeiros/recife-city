// Barbearia de bairro: na calçada perto dos mercados (Casa Amarela, Encruzilhada, Afogados, Madalena, São José,
// Boa Vista), um quiosque com o poste listrado girando, a cadeira de barbeiro, o espelho e o barbeiro de pé. Os nomes
// são inventados. A pé, perto, B corta o cabelo (R$ 15): cada corte é o próximo da lista (social, máquina 1, nevou,
// cacheado, black power, luzes, tranças, careca). Fica salvo no visual do jogador.
import * as THREE from 'three';
import { makePerson } from './models.js';
import { save, spend, persist } from './save.js';
import { conta } from './trofeus.js';

const LUGARES = [
  { re: /^Mercado de Casa Amarela$/, nome: 'Barbearia do Biu' },
  { re: /^Mercado da Encruzilhada$/, nome: 'Salão do Galego' },
  { re: /^Mercado de Afogados$/, nome: 'Barbearia Nevou' },
  { re: /^Mercado da Madalena$/, nome: 'Corte do Júnior' },
  { re: /^Mercado de São José$/, nome: 'Barbearia Pernambucana' },
  { re: /^Mercado da Boa Vista$/, nome: 'Barbearia do Tonho' },
];
export const CORTES = [
  { nome: 'social', hair: 'short', cor: '#1b1209', fala: 'Social clássico. Pronto pra entrevista de emprego!' },
  { nome: 'máquina 1', hair: 'buzz', cor: '#1b1209', fala: 'Máquina 1, baixinho e fresco pro calor.' },
  { nome: 'nevou', hair: 'buzz', cor: '#f1ead2', fala: 'Nevou! Platinado pra brilhar no paredão.' },
  { nome: 'cacheado', hair: 'curly', cor: '#2a1a10', fala: 'Cacheado com creme, do jeito que tu pediu.' },
  { nome: 'black power', hair: 'afro', cor: '#1b1209', fala: 'Black power armado. Respeita!' },
  { nome: 'luzes', hair: 'curly', cor: '#b98a4a', fala: 'Cacheado com luzes. Ficou massa, visse?' },
  { nome: 'tranças', hair: 'trancas', cor: '#1b1209', fala: 'Tranças nagô, trabalho caprichado.' },
  { nome: 'careca', hair: 'careca', cor: '#1b1209', fala: 'Raspou tudo! Agora é só passar o protetor.' },
];
const PRECO = 15;
const BRANCO = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.5 });
const COURO = new THREE.MeshStandardMaterial({ color: '#7a1e22', roughness: 0.5 });
const METAL = new THREE.MeshStandardMaterial({ color: '#b7bcc2', metalness: 0.8, roughness: 0.3 });
const ESPELHO = new THREE.MeshStandardMaterial({ color: '#9fc4d8', metalness: 0.9, roughness: 0.05 });
const POSTE = (() => { // listras vermelha, branca e azul em espiral
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  for (let i = -4; i < 12; i++) { g.fillStyle = ['#c8202f', '#f4f4f2', '#1d5fa8'][((i % 3) + 3) % 3]; g.beginPath(); g.moveTo(0, i * 16); g.lineTo(64, i * 16 - 32); g.lineTo(64, i * 16 - 16); g.lineTo(0, i * 16 + 16); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const placa = (txt) => { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#1d3557'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#ffd166'; g.font = 'bold 52px sans-serif'; g.textAlign = 'center'; g.fillText(txt, 256, 66); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t }); };

export class Barbearia {
  constructor({ scene, world, hud, player, applyOutfit }) {
    Object.assign(this, { scene, world, hud, player, applyOutfit });
    this.bs = [];
    for (const L of LUGARES) { const p = world.pois.find((q) => L.re.test(q.name)); if (p) this.bs.push({ x: p.x, z: p.z, nome: L.nome, g: null, sem: false }); }
  }

  get perto() {
    if (this.player.vehicle) return null;
    const P = this.player.pos;
    return this.bs.find((B) => B.g && Math.hypot(B.local[0] - P.x, B.local[1] - P.z) < 4) || null;
  }

  get hint() { const B = this.perto; if (!B) return ''; const c = CORTES[this.proximo()]; return `B — cortar o cabelo na ${B.nome}: ${c.nome} (R$ ${PRECO})`; }

  // índice do próximo corte (o seguinte ao atual)
  proximo() { const i = CORTES.findIndex((c) => c.hair === (save.outfit.hair || 'short') && c.cor === (save.outfit.hairColor || '#1b1209')); return (i + 1) % CORTES.length; }

  corta() {
    const B = this.perto; if (!B) return false;
    if (!spend(PRECO)) { this.hud.say(B.barbeiro, 'Sem dinheiro não tem corte, meu rei!', 2.5); return true; }
    const c = CORTES[this.proximo()];
    save.outfit.hair = c.hair; save.outfit.hairColor = c.cor; persist();
    this.applyOutfit();
    this.hud.say(B.barbeiro, c.fala, 3);
    this.hud.flash(`Cortou o cabelo: ${c.nome}. −R$ ${PRECO}`);
    conta('corte');
    return true;
  }

  update(dt, t, cam) {
    for (const B of this.bs) {
      if (B.sem) continue;
      const d = Math.hypot(B.x - cam.x, B.z - cam.z);
      if (B.g && d > 230) { this.hud.forget(B.barbeiro); this.scene.remove(B.g); B.g = null; }
      if (d > 200) continue;
      if (!B.g) this.monta(B);
      if (B.g) POSTE.offset.y = (t * 0.4) % 1; // o poste gira
    }
  }

  monta(B) {
    const W = this.world, livre = (x, z) => !W.blocked(x, z) && !W.isWater(x, z) && !W.isDrive(x, z) && !(W.ocupados || []).some(([ox, oz, r]) => Math.hypot(ox - x, oz - z) < r + 1);
    if (W.ocupados) W.ocupados = W.ocupados.filter((o) => o[3] !== 'barbearia:' + B.nome);
    // calçada livre de uns 3 m, a partir de 45 m do mercado (perto dele fica a feira de manhã)
    let at = null;
    for (let r = 45; r < 120 && !at; r += 3) for (let a = 0; a < 6.28 && !at; a += 0.2) {
      const x = B.x + Math.cos(a) * r, z = B.z + Math.sin(a) * r;
      if (![[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].every(([ox, oz]) => livre(x + ox, z + oz))) continue;
      // de costas pra parede mais perto (frente pra rua)
      let yaw = 0; for (let b = 0; b < 6.28; b += 0.4) if (W.blocked(x + Math.cos(b) * 3, z + Math.sin(b) * 3)) { yaw = Math.atan2(-Math.cos(b), -Math.sin(b)); break; }
      at = [x, z, yaw];
    }
    if (!at) { B.sem = true; return; }
    const [x, z, yaw] = at, y = W.groundY(x, z), g = new THREE.Group(), q = new THREE.Group();
    q.position.set(x, y, z); q.rotation.y = yaw; g.add(q);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); q.add(o); return o; };
    add(new THREE.BoxGeometry(2.6, 2.6, 0.12), BRANCO, 0, 1.3, -1.1);                        // parede do fundo
    add(new THREE.BoxGeometry(2.8, 0.12, 2.4), BRANCO, 0, 2.6, 0);                           // cobertura
    add(new THREE.BoxGeometry(2.6, 0.45, 0.05), placa(B.nome), 0, 2.9, 1.15);               // letreiro
    add(new THREE.BoxGeometry(1.2, 0.8, 0.03), ESPELHO, 0, 1.55, -1.03);                    // espelho
    add(new THREE.CylinderGeometry(0.25, 0.3, 0.5, 12), METAL, 0, 0.25, -0.2);               // base da cadeira
    add(new THREE.BoxGeometry(0.6, 0.15, 0.55), COURO, 0, 0.6, -0.2);                        // assento
    add(new THREE.BoxGeometry(0.6, 0.7, 0.12), COURO, 0, 1.0, -0.48);                        // encosto
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 16), new THREE.MeshStandardMaterial({ map: POSTE, roughness: 0.4 }), 1.45, 1.9, 1.0); // poste listrado
    const barbeiro = makePerson({ tipo: 'homem', shirt: '#f4f4f2', longSleeve: false, bottom: 'calca' });
    const bx = x + Math.sin(yaw) * 0.4 + Math.cos(yaw) * 0.7, bz = z + Math.cos(yaw) * 0.4 - Math.sin(yaw) * 0.7;
    barbeiro.position.set(bx, y, bz); barbeiro.rotation.y = yaw + Math.PI; g.add(barbeiro);
    barbeiro.userData.armR.rotation.x = -1.0; barbeiro.userData.elbowR.rotation.x = -0.8;
    (W.ocupados ||= []).push([x, z, 2.5, 'barbearia:' + B.nome]);
    this.scene.add(g); B.g = g; B.local = [x + Math.sin(yaw) * 1.6, z + Math.cos(yaw) * 1.6]; B.barbeiro = barbeiro;
  }
}
