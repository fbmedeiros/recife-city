// Álbum de lugares: chegar perto de um marco (a pé, de carro, como for) tira a foto dele pro álbum do celular.
// A primeira vez rende uns trocados e conta o que é o lugar; o álbum completo rende um prêmio.
// Na aba Álbum do celular, escolher um lugar traça a rota do GPS até ele.
import * as THREE from 'three';
import { save, persist, addMoney } from './save.js';
import { conta } from './trofeus.js';

const POR_FOTO = 15, COMPLETO = 300;
const semArtigo = (s) => s.replace(/^(o|a|os|as) /, '');
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export class Album {
  constructor(hud, spots) {
    Object.assign(this, { hud, spots, t: 0, order: [] });
    if (!Array.isArray(save.album)) save.album = [];
  }

  has(s) { return save.album.includes(s.nome); }

  update(dt, player) {
    if ((this.t -= dt) > 0) return;
    this.t = 0.5;
    for (const s of this.spots) {
      // um por vez: o próximo espera o letreiro deste sair (Paço do Frevo e Bonecos Gigantes ficam a 70 m)
      if (!this.has(s) && Math.hypot(s.x - player.pos.x, s.z - player.pos.z) < s.r) { this.discover(s); this.t = 8.5; break; }
    }
  }

  discover(s) {
    save.album.push(s.nome);
    persist();
    const n = this.spots.filter((q) => this.has(q)).length, total = this.spots.length;
    addMoney(POR_FOTO);
    setTimeout(() => conta('foto'), 0); // depois do cartão da foto (o troféu entra na fila)
    this.postal(`📸 ${cap(semArtigo(s.nome))}`, s.fato, `Álbum ${n}/${total} · +R$ ${POR_FOTO}`);
    if (n === total) setTimeout(() => { addMoney(COMPLETO); this.postal('Álbum completo!', 'Tu conhece o Recife de ponta a ponta, visse?', `+R$ ${COMPLETO}`); }, 8500);
  }

  // cartão-postal no alto da tela (o letreiro grande do jogo cobria tudo com nome comprido)
  postal(titulo, texto, rodape) {
    // um cartão por vez: o que chegar enquanto outro está na tela espera ele sair
    const agora = performance.now();
    if (this.postalAte > agora) { (this.fila ||= []).push([titulo, texto, rodape]); return; }
    this.postalAte = agora + 8400;
    let el = document.getElementById('postal');
    if (!el) { el = document.createElement('div'); el.id = 'postal'; el.innerHTML = '<b></b><p></p><small></small>'; document.body.appendChild(el); }
    el.querySelector('b').textContent = titulo;
    el.querySelector('p').textContent = texto;
    el.querySelector('small').textContent = rodape;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.postalT);
    this.postalT = setTimeout(() => { el.classList.remove('show'); const p = this.fila?.shift(); if (p) setTimeout(() => this.postal(...p), 450); }, 8000);
  }

  render(el, player) {
    // os que faltam primeiro, do mais perto pro mais longe; depois os já fotografados
    const d = (s) => Math.hypot(s.x - player.pos.x, s.z - player.pos.z);
    const falta = this.spots.filter((s) => !this.has(s)).sort((a, b) => d(a) - d(b));
    const tem = this.spots.filter((s) => this.has(s)).sort((a, b) => d(a) - d(b));
    this.order = [...falta, ...tem];
    const km = (s) => (d(s) / 1000).toFixed(1).replace('.', ',') + ' km';
    el.innerHTML = this.order.map((s, i) => {
      const ok = this.has(s), bairro = this.hud.bairroAt(s.x, s.z);
      return `<div class="offer album${ok ? ' got' : ''}" data-i="${i}">
        <span class="app" style="background:${ok ? '#8ee07a' : '#6d6788'}">${ok ? '📸 NO ÁLBUM' : 'FALTA'}</span>${i < 9 ? `<span class="k">${i + 1}</span>` : ''}
        <h4>${cap(semArtigo(s.nome))}</h4>
        <p>${ok ? s.fato : `${bairro ? '📍 ' + bairro + '. ' : ''}Chega perto pra tirar a foto.`}</p>
        <div class="pay"><small>${km(s)} · escolher traça a rota</small></div></div>`;
    }).join('');
    el.querySelectorAll('.offer[data-i]').forEach((c) => (c.onclick = () => this.act(Number(c.dataset.i))));
  }

  // placa marrom de atrativo turístico (o padrão das placas de turismo no Brasil) na rua mais perto de cada marco,
  // de frente pro trânsito, para quem passa reconhecer o lugar de longe
  buildSigns(scene, world, traffic) {
    const poste = new THREE.MeshStandardMaterial({ color: '#8d9399', roughness: 0.5, metalness: 0.6 });
    const verso = new THREE.MeshStandardMaterial({ color: '#7b8187', roughness: 0.7 });
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8).translate(0, 1.7, 0);
    for (const s of this.spots) {
      const n = traffic.nearestEdge(traffic.drive, s.x, s.z);
      if (!n || n.d > 700) continue; // Brennand e Guararapes: a placa fica na rua de acesso, a ~500 m
      const e = n.e, t = Math.min(Math.max(n.t, 2), e.len - 2);
      const px = e.a.x + e.dx * t, pz = e.a.z + e.dz * t;
      let nx = -e.dz, nz = e.dx;
      if ((s.x - px) * nx + (s.z - pz) * nz < 0) { nx = -nx; nz = -nz; }
      // primeiro o lado do marco, depois o outro; fora da rua, ou na calçada quando a fachada encosta na rua
      const livre = [(x, z) => !world.isRoad(x, z) && !world.blocked(x, z), (x, z) => !world.isDrive(x, z) && !world.blocked(x, z)];
      let at = null;
      for (const ok of livre) for (const sd of [1, -1]) for (let o = 2.5; o < 16 && !at; o += 0.5) {
        const x = px + nx * sd * o, z = pz + nz * sd * o;
        if (ok(x, z)) at = [x, z];
      }
      if (!at) continue;
      const g = new THREE.Group();
      const face = new THREE.MeshStandardMaterial({ map: signTex(cap(semArtigo(s.nome))), roughness: 0.6 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 0.06), [verso, verso, verso, verso, face, face]);
      board.position.y = 2.9;
      for (const dx of [-1.1, 1.1]) { const p = new THREE.Mesh(postGeo, poste); p.position.x = dx; g.add(p); }
      g.add(board);
      g.position.set(at[0], world.groundY(at[0], at[1]), at[1]);
      g.rotation.y = Math.atan2(e.dx, e.dz); // placa atravessada, legível pra quem vem nos dois sentidos
      scene.add(g);
    }
  }

  get count() { return `${this.spots.filter((s) => this.has(s)).length}/${this.spots.length}`; }

  act(i) {
    const s = this.order[i];
    if (!s || !this.gps) return false;
    this.gps.setDest(s.x, s.z, cap(semArtigo(s.nome)));
    this.onRoute?.();
    return true;
  }
}

function signTex(nome) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 176;
  const x = c.getContext('2d');
  x.fillStyle = '#6b3d1f'; x.fillRect(0, 0, 512, 176);
  x.strokeStyle = '#f4efe6'; x.lineWidth = 6; x.strokeRect(10, 10, 492, 156);
  x.fillStyle = '#f4efe6'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = 54; x.font = `700 ${size}px Inter, Arial, sans-serif`;
  // numa linha só se couber com letra de pelo menos 38 px; senão quebra em duas
  while (x.measureText(nome).width > 470 && size > 38) { size -= 2; x.font = `700 ${size}px Inter, Arial, sans-serif`; }
  if (x.measureText(nome).width <= 470) { x.fillText(nome, 256, 90); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  size = 50; x.font = `700 ${size}px Inter, Arial, sans-serif`;
  const words = nome.split(' '), lines = [];
  for (const w of words) { const l = lines.length ? lines[lines.length - 1] + ' ' + w : w; if (lines.length && x.measureText(l).width > 450) lines.push(w); else if (lines.length) lines[lines.length - 1] = l; else lines.push(w); }
  if (lines.length > 2) { size = 40; x.font = `700 ${size}px Inter, Arial, sans-serif`; }
  while (lines.some((l) => x.measureText(l).width > 470) && size > 26) { size -= 2; x.font = `700 ${size}px Inter, Arial, sans-serif`; }
  const lh = size * 1.1, y0 = 88 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => x.fillText(l, 256, y0 + i * lh));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
