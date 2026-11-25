// Controles de toque para celular e tablet: joystick à esquerda, arrastar à direita gira a câmera,
// botões de ação. Ativa sozinho em telas de toque, ou com ?touch=1 na URL.
export const isTouch = new URLSearchParams(location.search).has('touch') ||
  matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
// já na tela de carregamento, pra mostrar as instruções certas
if (isTouch) document.body.classList.add('touch');

const BTNS = [
  { id: 'act', label: '🚗', sub: 'entrar', tap: 'act' },
  { id: 'brake', label: '✋', sub: 'freio', hold: 'Space', drive: true },
  { id: 'run', label: '🏃', sub: 'correr', hold: 'ShiftLeft', foot: true },
  { id: 'jump', label: '⤴️', sub: 'pular', tap: 'jump', foot: true },
  { id: 'dance', label: '🕺', sub: 'passinho', tap: 'dance', foot: true },
  { id: 'horn', label: '📯', sub: 'buzina', tap: 'horn', drive: true },
];
const TOP = [
  { id: 'phone', label: '📱', tap: 'phone' },
  { id: 'map', label: '🗺️', tap: 'map' },
  { id: 'gps', label: '🧭', tap: 'gps' },
  { id: 'radio', label: '📻', tap: 'radio' },
  { id: 'mute', label: '🔇', tap: 'mute' },
  { id: 'time', label: '⏩', tap: 'time' },
];

export class Touch {
  constructor({ keys, onTap, onLook }) {
    Object.assign(this, { keys, onTap, onLook });
    this.move = { x: 0, y: 0 }; // x: direita +, y: frente +
    this.stick = null; // { id, ox, oy }
    this.looks = new Map(); // pointerId -> {x, y}
    this.mode = 'foot';
    document.body.classList.add('touch');
    this.build();
  }

  build() {
    const el = (this.el = document.createElement('div'));
    el.id = 'touch';
    el.className = 'hidden';
    el.innerHTML = `
      <div id="t-look"></div>
      <div id="t-stick" class="idle"><div class="ring"></div><div class="knob"></div></div>
      <div id="t-btns">${BTNS.map((b) => `<button data-b="${b.id}" class="${b.drive ? 'drive' : ''}${b.foot ? 'foot' : ''}"><span>${b.label}</span><small>${b.sub}</small></button>`).join('')}</div>
      <div id="t-top">${TOP.map((b) => `<button data-b="${b.id}">${b.label}</button>`).join('')}</div>`;
    document.body.appendChild(el);
    this.stickEl = el.querySelector('#t-stick');
    this.knob = el.querySelector('.knob');
    this.actBtn = el.querySelector('[data-b="act"]');
    this.actSub = this.actBtn.querySelector('small');

    const look = el.querySelector('#t-look');
    const opt = { passive: false };
    look.addEventListener('pointerdown', (e) => this.down(e), opt);
    addEventListener('pointermove', (e) => this.moveP(e), opt);
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));

    for (const b of [...BTNS, ...TOP]) {
      const btn = el.querySelector(`[data-b="${b.id}"]`);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        btn.classList.add('on');
        if (b.hold) this.keys[b.hold] = true;
        if (b.tap) this.onTap(b.tap);
      });
      const release = () => { btn.classList.remove('on'); if (b.hold) this.keys[b.hold] = false; };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    }
    // evita zoom por gesto e o menu de toque longo
    for (const ev of ['gesturestart', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  show(on) { this.el.classList.toggle('hidden', !on); if (!on) this.reset(); }

  reset() {
    this.stick = null; this.looks.clear();
    this.move.x = this.move.y = 0;
    this.stickEl.classList.add('idle');
    this.knob.style.transform = '';
    for (const b of BTNS) if (b.hold) this.keys[b.hold] = false;
  }

  // metade esquerda da tela: joystick que nasce onde o dedo encosta; metade direita: câmera
  down(e) {
    e.preventDefault();
    if (e.clientX < innerWidth * 0.45 && !this.stick) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      this.stickEl.classList.remove('idle');
      this.stickEl.style.left = e.clientX + 'px';
      this.stickEl.style.top = e.clientY + 'px';
      this.knob.style.transform = '';
    } else {
      this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }

  moveP(e) {
    if (this.stick?.id === e.pointerId) {
      e.preventDefault();
      const R = 56;
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // zona morta pequena, resposta suave
      const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
      this.move.x = dz(dx / R);
      this.move.y = dz(-dy / R);
      return;
    }
    const p = this.looks.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    this.onLook(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX; p.y = e.clientY;
  }

  up(e) {
    if (this.stick?.id === e.pointerId) {
      this.stick = null;
      this.move.x = this.move.y = 0;
      this.stickEl.classList.add('idle');
      this.knob.style.transform = '';
    }
    this.looks.delete(e.pointerId);
  }

  // mostra só os botões que fazem sentido agora
  setMode(driving, actLabel) {
    const m = driving ? 'drive' : 'foot';
    if (m !== this.mode) { this.mode = m; this.el.dataset.mode = m; }
    const txt = actLabel || (driving ? 'sair' : 'entrar');
    if (this.actSub.textContent !== txt) this.actSub.textContent = txt;
    this.actBtn.classList.toggle('dim', !actLabel);
  }
}
