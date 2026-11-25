import * as THREE from 'three';

const MAP_LABELS = /^(Marco Zero|Paço do Frevo|Torre Malakoff|Coluna de Cristal|Casa da Cultura|Mercado de São José|Forte das Cinco Pontas|Forte do Brum|Teatro Santa Isabel|Palácio do Governo de Pernambuco|Rua do Bom Jesus|Sinagoga Kahal Zur Israel|Capela Dourada|Paço Alfândega|Parque 13 de Maio|Caranguejo da Rua da Aurora|Ponte Maurício de Nassau|Ponte da Boa Vista|Museu da Cidade do Recife|Mercado da Boa Vista|Dona Lindu|Shopping Recife|Shopping RioMar|Mercado de Boa Viagem|Terminal Integrado Aeroporto|Praça Boa Viagem|Parque das Esculturas de Francisco Brennand|Shopping Boa Vista|Faculdade de Direito do Recife|Museu Cais do Sertão|Restaurante Leite|Parraxaxá|Bargaço|Chica Pitanga|Teatro do Parque|teatro do parque|Praça Maciel Pinheiro|Real Hospital Português|Universidade Católica de Pernambuco|Igreja da Madre de Deus|Concatedral de São Pedro dos Clérigos|Basílica do Carmo|Obelisco da Rua da Aurora|Parque da Jaqueira|Museu do Estado|Shopping Tacaruna|Shopping Plaza|Museu do Homem do Nordeste|Parque das Graças|Praça de Casa Forte|Colégio Damas|Estádio dos Aflitos|Nossa Senhora da Saúde|Praça Poço da Panela|Poço das Artes|Torre do Zeppelin|Parque do Jiquiá|Ilha do Retiro \(Sport\)|Parque de Exposições do Cordeiro|Jardim do Baobá|Museu da Abolição|Parque da Tamarineira|Parque Santana|Mirabilândia|Clube Vassourinhas|Mercado da Encruzilhada|Mercado de Afogados|Mercado da Torre|Parque Forte do Arraial Novo do Bom Jesus|Paredão do Brega · .*|Ensaio de Maracatu · .*|Campo de Pelada · .*|Roda de Passinho · .*|Terreiro de Umbanda · .*|Oferendas a Iemanjá · .*|Roda de Ciranda · .*|Palafitas · .*|Viveiros de camarão · .*|Centro de Artes Ilha de Deus|Estatua de Nossa Senhora da Conceição|Santuário de Nossa Senhora da Conceição|Palco do Alto José do Pinho|Praça do Morro da Conceição|Galo da Madrugada|Barqueiros do Marco Zero|Palácio do Campo das Princesas|Teatro Santa Isabel|Paço Alfândega|Porto Digital|CESAR - Centro de Estudos Avançados do Recife|Prefeitura da Cidade do Recife|Feirinha da Praça do Arsenal|Cinema São Luiz|Cine-Teatro Apolo|Caixa Cultural|Praça de Casa Forte|Dokas|Arruda \(Santa Cruz\)|Colégio Marista São Luís|Colégio Agnes|Colégio Boa Viagem|Colégio Santa Maria|Colégio NAP|Colégio Apoio|Museu do Estado|Pátio de São Pedro|Soparia|Edifício Holiday|Edifício Acaiaca|Primeiro Jardim de Boa Viagem|Segundo Jardim de Boa Viagem|Terceiro Jardim de Boa Viagem|Rampa Helicoidal do RioMar|Armazéns do Cais José Estelita|Shopping Recife|Shopping RioMar|Geraldão|Quartel do Derby do Comando Geral da Polícia Militar|Mercado da Encruzilhada|Mercado da Madalena|Mercado de Casa Amarela|Real Hospital Português|Câmara Municipal do Recife|Fundação Joaquim Nabuco|Biblioteca Pública do Estado de Pernambuco|Hospital da Restauração|Hospital Santa Joana Recife|Hospital Memorial São José|Ponte Estaiada|Fórum Joana Bezerra|Prefeitura da Cidade do Recife|Bodega de Véio|Boteco da Moeda|Bar Zero Um|Teatro Mamulengo|Lisbela e Prisioneiros|Bar do Tonhão|Real Botequim|Boteco do Bêu|Tatu Bola|Frevo na Praça do Arsenal|Pracinha de Boa Viagem · tapioca e feirinha|Tapioca Rendada do Damião|Comércio da Rua Nova|Parque da Rua da Aurora|Lagoa do Araçá|Peixe frito do Buraco da Velha|Chico Science|Sinagoga Kahal Zur Israel|Rua do Bom Jesus|Centro de Artesanato de Pernambuco|Parraxaxá|Jardim do Baobá)$/;

export class Hud {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.el = document.getElementById('hud');
    this.streetEl = document.getElementById('street');
    this.nearEl = document.getElementById('near');
    this.speedEl = document.getElementById('speed');
    this.kmhEl = document.getElementById('kmh');
    this.hintEl = document.getElementById('hint');
    this.bubblesEl = document.getElementById('bubbles');
    this.mini = document.getElementById('minimap').getContext('2d');
    this.mapEl = document.getElementById('map');
    this.big = document.getElementById('bigmap');
    this.bubbles = [];
    this.tick = 0;
    this.v = new THREE.Vector3();
    // segmentos de ruas com nome, para o letreiro de localização
    this.segs = new Map(); // por célula de 50 m
    for (const r of world.data.roads) {
      if (!r.n) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const s = [r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], r.n];
        const k = Math.floor((s[0] + s[2]) / 100) + ',' + Math.floor((s[1] + s[3]) / 100);
        (this.segs.get(k) || this.segs.set(k, []).get(k)).push(s);
      }
    }
    this.bairros = world.data.bairros || [];
    this.bairroGrid = gradeDeBairros(world.data.bairrosArea);
    world.data.bairrosArea = null; // já virou grade
    this.bairroEl = document.getElementById('bairro');
    this.labels = world.pois.filter((p) => MAP_LABELS.test(p.name)).filter((p, i, a) => a.findIndex((q) => q.name === p.name) === i);
    this.nearPois = world.pois.filter((p) => p.kind !== 'hotel' && p.kind !== 'hostel' && p.kind !== 'motel' && p.kind !== 'apartment');
  }

  show() { this.el.classList.remove('hidden'); }

  setWanted(level, blinking) {
    const el = (this.wantedEl ||= document.getElementById('wanted'));
    const key = level + (blinking ? 'b' : '');
    if (this.wantedKey === key) return;
    this.wantedKey = key;
    el.innerHTML = level ? Array.from({ length: 5 }, (_, i) => `<span class="${i < level ? 'on' : ''}">★</span>`).join('') : '';
    el.classList.toggle('blink', blinking);
  }

  flash(text) {
    const el = (this.flashEl ||= document.getElementById('flash'));
    el.textContent = text;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  banner(title, sub, secs) {
    const el = (this.bigEl ||= document.getElementById('big'));
    el.querySelector('.t').textContent = title;
    el.querySelector('.s').textContent = sub;
    el.classList.remove('hidden');
    clearTimeout(this.bigTimer);
    this.bigTimer = setTimeout(() => el.classList.add('hidden'), secs * 1000);
  }

  say(obj, text, secs = 3) {
    this.forget(obj);
    const div = document.createElement('div');
    div.className = 'bubble';
    div.textContent = text;
    this.bubblesEl.appendChild(div);
    this.bubbles.push({ obj, div, t: secs });
  }

  forget(obj) {
    this.bubbles = this.bubbles.filter((b) => { if (b.obj === obj) { b.div.remove(); return false; } return true; });
  }

  hint(text) { if (this.hintEl.textContent !== text) this.hintEl.textContent = text; }

  update(dt, player, camYaw) {
    // balões de fala
    const w = innerWidth, h = innerHeight;
    this.bubbles = this.bubbles.filter((b) => {
      b.t -= dt;
      if (b.t <= 0 || !b.obj.parent) { b.div.remove(); return false; }
      this.v.copy(b.obj.position); this.v.y += 2.3;
      const dist = this.v.distanceTo(this.camera.position);
      this.v.project(this.camera);
      const visible = this.v.z < 1 && dist < 70;
      b.div.style.display = visible ? '' : 'none';
      if (visible) b.div.style.transform = `translate(${(this.v.x * 0.5 + 0.5) * w}px, ${(-this.v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
      return true;
    });

    const v = player.vehicle;
    this.speedEl.classList.toggle('hidden', !v);
    if (v) this.kmhEl.textContent = Math.round(Math.abs(v.speed) * 3.6);

    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.4;
      const { x, z } = player.pos;
      this.streetEl.textContent = this.streetAt(x, z) || 'Recife';
      this.bairroEl.textContent = this.bairroAt(x, z) || '';
      let near = null, bd = 70;
      for (const p of this.nearPois) {
        const d = Math.hypot(p.x - x, p.z - z) - (MAP_LABELS.test(p.name) ? 30 : 0);
        if (d < bd) { bd = d; near = p.name; }
      }
      this.nearEl.textContent = near ? '📍 ' + near : '';
    }
    this.drawMini(player, camYaw);
  }

  streetAt(x, z, maxD = 30) {
    let best = null, bd = maxD;
    const cx = Math.floor(x / 50), cz = Math.floor(z / 50), R = Math.ceil(maxD / 50) + 2;
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
      const l = this.segs.get(cx + i + ',' + (cz + j));
      if (!l) continue;
      for (const s of l) {
        const dx = s[2] - s[0], dz = s[3] - s[1];
        const l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2));
        const d = Math.hypot(s[0] + dx * t - x, s[1] + dz * t - z);
        if (d < bd) { bd = d; best = s[4]; }
      }
    }
    return best;
  }

  bairroAt(x, z) {
    // dentro do contorno oficial do bairro (OSM admin_level 10); fora de todos, o de centro mais perto
    const G = this.bairroGrid;
    if (G) { const c = Math.floor((x - G.x0) / G.cell), r = Math.floor((z - G.z0) / G.cell); if (c >= 0 && r >= 0 && c < G.w && r < G.h) { const k = G.g[r * G.w + c]; if (k) return G.names[k - 1]; } }
    let best = null, bd = Infinity;
    for (const b of this.bairros) { const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b.name; } }
    return best;
  }

  setClock(text) {
    this.clockText = text;
    const el = (this.clockEl ||= document.getElementById('clock'));
    if (el.textContent !== text) el.textContent = text;
  }

  setMoney(v) {
    const el = (this.moneyEl ||= document.getElementById('money'));
    el.textContent = 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  }

  // objetivo da missão no topo da tela
  objective(text, timer, dist) {
    const el = (this.objEl ||= document.getElementById('objective'));
    if (!text) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const t = timer == null ? '' : `<span class="timer${timer < 15 ? ' low' : ''}">${Math.floor(timer / 60)}:${String(Math.floor(timer % 60)).padStart(2, '0')}</span>`;
    const d = dist == null ? '' : `<span class="dist">${dist > 1000 ? (dist / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(dist) + ' m'}</span>`;
    const html = `<div class="obj-text">${text}</div><div class="obj-meta">${t}${d}</div>`;
    if (html !== this.objHtml) { el.innerHTML = html; this.objHtml = html; }
  }

  drawMini(player, camYaw) {
    const g = this.mini, map = this.world.mapCanvas, { S, xmin, zmin } = map.userData;
    const size = 200, zoom = 2.2;
    g.save();
    g.fillStyle = '#1f5f7a'; g.fillRect(0, 0, size, size);
    g.translate(size / 2, size / 2);
    g.rotate(camYaw);
    g.scale(zoom, zoom);
    g.drawImage(map, -(player.pos.x - xmin) * S, -(player.pos.z - zmin) * S);
    g.restore();
    // rota do GPS (linha azul) e o destino
    if (this.gpsRoute) {
      const c = Math.cos(camYaw), sn = Math.sin(camYaw), s2 = map.userData.S * zoom;
      const to = (p) => { const dx = (p.x - player.pos.x) * s2, dz = (p.z - player.pos.z) * s2; return [size / 2 + dx * c - dz * sn, size / 2 + dx * sn + dz * c]; };
      g.save(); g.beginPath(); g.arc(size / 2, size / 2, 99, 0, Math.PI * 2); g.clip();
      g.lineJoin = g.lineCap = 'round';
      for (const [w, col] of [[7, '#ffffff'], [4.5, '#1a73e8']]) { g.lineWidth = w; g.strokeStyle = col; g.beginPath(); this.gpsRoute.forEach((p, i) => { const [x, y] = to(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); }
      g.restore();
    }
    // alvo da missão (preso na borda quando está longe)
    if (this.target) {
      const { S: s2 } = map.userData;
      let dx = (this.target.x - player.pos.x) * s2 * zoom, dz = (this.target.z - player.pos.z) * s2 * zoom;
      const c = Math.cos(camYaw), sn = Math.sin(camYaw);
      let rx = dx * c - dz * sn, ry = dx * sn + dz * c;
      const len = Math.hypot(rx, ry), maxR = 86;
      if (len > maxR) { rx *= maxR / len; ry *= maxR / len; }
      g.save();
      g.translate(size / 2 + rx, size / 2 + ry);
      g.fillStyle = '#ffd166'; g.strokeStyle = '#1a1420'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    }
    // marcas (lugar do álbum que falta, bloco desfilando): só as que cabem no círculo
    const marcas = this.marcas?.() || [];
    if (marcas.length) {
      const c = Math.cos(camYaw), sn = Math.sin(camYaw), s2 = map.userData.S * zoom;
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '11px sans-serif';
      for (const m of marcas) {
        if (!m.mini) continue;
        const dx = (m.x - player.pos.x) * s2, dz = (m.z - player.pos.z) * s2, rx = dx * c - dz * sn, ry = dx * sn + dz * c;
        if (Math.hypot(rx, ry) > 88) continue;
        g.fillStyle = m.cor; g.strokeStyle = '#1a1420'; g.lineWidth = 2;
        g.beginPath(); g.arc(size / 2 + rx, size / 2 + ry, 8, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillText(m.icon, size / 2 + rx, size / 2 + ry + 1);
      }
      g.restore();
    }
    // seta do jogador
    g.save();
    g.translate(size / 2, size / 2);
    g.rotate(camYaw + Math.PI - player.heading);
    g.fillStyle = '#ff3b3b'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // norte
    g.save();
    g.translate(size / 2, size / 2);
    g.rotate(camYaw);
    g.fillStyle = '#fff'; g.font = 'bold 13px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', 0, -84);
    g.restore();
  }

  get mapOpen() { return !this.mapEl.classList.contains('hidden'); }

  toggleMap(player, onTeleport, onRoute) {
    if (this.mapOpen) { this.mapEl.classList.add('hidden'); return false; }
    const map = this.world.mapCanvas, { S, xmin, zmin } = map.userData;
    const c = this.big;
    c.width = map.width; c.height = map.height;
    const g = c.getContext('2d');
    g.drawImage(map, 0, 0);
    g.textAlign = 'center';
    // o mapa é desenhado bem maior do que aparece na tela (~600 px de altura): letra e marca crescem na proporção
    const k = Math.max(1, c.height / 600);
    g.font = `italic 800 ${Math.round(8 * k)}px Inter, sans-serif`;
    // nomes dos bairros no centro do contorno oficial (sem contorno, no ponto do OSM); bairro bem pequeno fica sem nome
    // maiores primeiro; nome que encostaria noutro já escrito fica de fora (senão vira uma sopa de letras)
    const rot = this.bairroGrid?.rotulos ? [...this.bairroGrid.rotulos].sort((a, b) => b.area - a.area) : this.bairros;
    const ocupado = [];
    for (const b of rot) {
      if (/^(Loteamento|Vila|Jardim Jordao)/.test(b.name)) continue;
      const x = (b.x - xmin) * S, y = (b.z - zmin) * S, tw = g.measureText(b.name.toUpperCase()).width / 2 + 2 * k, th = 6 * k;
      if (ocupado.some((o) => Math.abs(o[0] - x) < o[2] + tw && Math.abs(o[1] - y) < th * 2)) continue;
      ocupado.push([x, y, tw]);
      g.lineWidth = 3 * k; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(b.name.toUpperCase(), x, y);
      g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(b.name.toUpperCase(), x, y);
    }
    g.font = '600 13px Inter, sans-serif';
    for (const p of this.labels) {
      const x = (p.x - xmin) * S, y = (p.z - zmin) * S;
      g.fillStyle = '#ffd166'; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(p.name, x, y - 8);
      g.fillStyle = '#fff'; g.fillText(p.name, x, y - 8);
    }
    // marcas do jogo no mapa grande: lugares do álbum (verde = já tem a foto) e o bloco de frevo
    g.textBaseline = 'middle'; g.font = `${Math.round(13 * k)}px sans-serif`;
    for (const m of this.marcas?.() || []) {
      const mx = (m.x - xmin) * S, my = (m.z - zmin) * S;
      g.fillStyle = m.cor; g.strokeStyle = '#1a1420'; g.lineWidth = 2 * k;
      g.beginPath(); g.arc(mx, my, 10 * k, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillText(m.icon, mx, my + 1);
    }
    g.textBaseline = 'alphabetic';
    if (this.target) {
      const tx = (this.target.x - xmin) * S, ty = (this.target.z - zmin) * S;
      g.fillStyle = '#ffd166'; g.strokeStyle = '#1a1420'; g.lineWidth = 3;
      g.beginPath(); g.arc(tx, ty, 9, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    const x = (player.pos.x - xmin) * S, y = (player.pos.z - zmin) * S;
    g.fillStyle = '#ff3b3b'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.stroke();
    c.onclick = (ev) => {
      const r = c.getBoundingClientRect();
      const mx = ((ev.clientX - r.left) / r.width) * c.width, my = ((ev.clientY - r.top) / r.height) * c.height;
      // clique: vai pra lá · Shift+clique: traça a rota no GPS
      if (ev.shiftKey && onRoute) onRoute(mx / S + xmin, my / S + zmin); else onTeleport(mx / S + xmin, my / S + zmin);
      this.mapEl.classList.add('hidden');
    };
    this.mapEl.classList.remove('hidden');
    return true;
  }
}

// grade de 20 m com o índice do bairro (0 = fora de todos), rasterizada uma vez a partir dos contornos
function gradeDeBairros(areas) {
  if (!areas?.length) return null;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const a of areas) for (const r of a.r) for (const [x, z] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const cell = 20, w = Math.ceil((x1 - x0) / cell) + 1, h = Math.ceil((z1 - z0) / cell) + 1;
  const g = new Uint8Array(w * h), names = [], xs = [], rotulos = [];
  areas.forEach((a, i) => {
    if (i >= 255) return;
    names.push(a.n);
    // rótulo no mapa: centro de área do maior anel (o ponto do OSM às vezes fica na beira do bairro)
    let best = null, bestA = 0;
    for (const ring of a.r) { let A = 0, cx = 0, cz = 0; for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) { const [x0, z0] = ring[j], [x1, z1] = ring[k], f = x0 * z1 - x1 * z0; A += f; cx += (x0 + x1) * f; cz += (z0 + z1) * f; } A /= 2; if (Math.abs(A) > bestA) { bestA = Math.abs(A); best = [cx / (6 * A), cz / (6 * A)]; } }
    if (best) rotulos.push({ name: a.n, x: best[0], z: best[1], area: bestA });
    for (const ring of a.r) {
      let a0 = Infinity, b0 = -Infinity; for (const p of ring) { if (p[1] < a0) a0 = p[1]; if (p[1] > b0) b0 = p[1]; }
      for (let r = Math.max(0, Math.floor((a0 - z0) / cell)); r <= Math.min(h - 1, Math.floor((b0 - z0) / cell)); r++) {
        const z = z0 + (r + 0.5) * cell; xs.length = 0;
        for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) { const [ax, az] = ring[k], [bx, bz] = ring[j]; if ((az > z) !== (bz > z)) xs.push(ax + ((z - az) * (bx - ax)) / (bz - az)); }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) { const c0 = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5)), c1 = Math.min(w - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5)); if (c1 >= c0) g.fill(i + 1, r * w + c0, r * w + c1 + 1); }
      }
    }
  });
  return { g, w, h, x0, z0, cell, names, rotulos };
}
