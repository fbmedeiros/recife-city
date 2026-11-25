// Sons sintetizados com WebAudio (motor, buzina, batida). Sem arquivos externos.
export class Audio {
  // mudo: guarda a escolha no navegador e vale também antes do som começar
  constructor() { try { this.muted = localStorage.getItem('hellcife-mudo') === '1'; } catch { this.muted = false; } }
  setMuted(on) {
    this.muted = on;
    try { localStorage.setItem('hellcife-mudo', on ? '1' : '0'); } catch {}
    if (this.master) this.master.gain.setTargetAtTime(on ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }
  start() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(ctx.destination);
    // motor: duas serras desafinadas + filtro
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 500;
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.osc = [0, 7].map((det) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 40; o.detune.value = det * 10;
      o.connect(this.engFilter); o.start(); return o;
    });
  }

  engine(on, speed, throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 38 + (Math.abs(speed) % 11) * 5 + Math.abs(speed) * 2.2 + throttle * 12;
    for (const o of this.osc) o.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engFilter.frequency.setTargetAtTime(350 + throttle * 700 + Math.abs(speed) * 20, t, 0.1);
    this.engGain.gain.setTargetAtTime(on ? 0.07 + throttle * 0.05 : 0, t, 0.15);
  }

  // sirene "wail": oscilador varrendo de ~600 a ~1300 Hz
  siren(vol) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.sirenGain) {
      this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 950;
      const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 0.55;
      const depth = ctx.createGain(); depth.gain.value = 350;
      lfo.connect(depth); depth.connect(o.frequency);
      o.connect(f); f.connect(this.sirenGain); this.sirenGain.connect(this.master);
      o.start(); lfo.start();
    }
    this.sirenGain.gain.setTargetAtTime(vol * vol * 0.06, ctx.currentTime, 0.2);
  }

  // sirene da ambulância: dois tons alternando (separada da sirene da polícia, que tem o próprio volume)
  ambulancia(vol) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.ambGain) {
      if (vol < 0.01) return;
      this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 780;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.1;
      const depth = ctx.createGain(); depth.gain.value = 170;
      lfo.connect(depth); depth.connect(o.frequency);
      o.connect(f); f.connect(this.ambGain); this.ambGain.connect(this.master);
      o.start(); lfo.start();
    }
    this.ambGain.gain.setTargetAtTime(vol * vol * 0.05, ctx.currentTime, 0.2);
  }

  horn(vol = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12 * vol, t + 0.02); g.gain.setTargetAtTime(0, t + 0.35, 0.05);
    g.connect(this.master);
    for (const f of [415, 523]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 0.6); }
  }

  thump(vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (this.lastThump && t - this.lastThump < 0.25) return;
    this.lastThump = t;
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0.6 * vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }

  // ---------------------------------------------------------------- batidas originais, em loop, com volume por distância
  // brega: brega-funk de 150 BPM (bumbo sincopado, palma no 2 e 4, chimbal, baixo e acorde curto)
  // atabaque: três tambores (rum, rumpi e lé) a 112 BPM
  loop(kind, vol) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.loops ||= {};
    let L = this.loops[kind];
    if (!L) {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master);
      L = this.loops[kind] = { g, next: ctx.currentTime + 0.05, step: 0, bar: 0 };
    }
    L.g.gain.setTargetAtTime(vol, ctx.currentTime, 0.25);
    if (vol < 0.003) { L.next = ctx.currentTime + 0.05; return; } // parado: não agenda nada
    const bpm = { brega: 150, atabaque: 112, ciranda: 92, punk: 180, capoeira: 108, coco: 116, forro: 92, frevo: RADIO[0].bpm }[kind], stepDur = 60 / bpm / (kind === 'atabaque' ? 2 : 4);
    while (L.next < ctx.currentTime + 0.2) {
      if (kind === 'frevo') this.frevoStep(L.g, L.next, L);
      else if (kind === 'brega') this.bregaStep(L.g, L.next, L.step, L.bar); else if (kind === 'punk') this.punkStep(L.g, L.next, L.step, L.bar); else if (kind === 'ciranda') this.cirandaStep(L.g, L.next, L.step, L.bar); else if (kind === 'capoeira') this.capoeiraStep(L.g, L.next, L.step); else if (kind === 'coco') this.cocoStep(L.g, L.next, L.step); else if (kind === 'forro') this.forroStep(L.g, L.next, L.step, L.bar); else this.atabaqueStep(L.g, L.next, L.step);
      L.next += stepDur; L.step = (L.step + 1) % 16;
      if (L.step === 0) L.bar = (L.bar + 1) % 4;
    }
  }

  // ---------------------------------------------------------------- ambiente da cidade
  // v = { mar, passaro, cigarra, sapo } de 0 a 1, chamado umas vezes por segundo pelo ambience.js
  // mar: ruído grave que cresce e quebra devagar (onda a cada ~9 s); cigarra: zumbido agudo pulsado que vem
  // em ondas de ~4 s;
  // passarinho e sapo: notas avulsas sorteadas (bem-te-vi de três notas, assobio subindo, coaxar grave).
  ambient(v, dt) {
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    if (!this._amb) {
      const mk = () => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master); return g; };
      // mar
      const mar = mk(), src = ctx.createBufferSource(); src.buffer = this.noise(); src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      const swell = ctx.createGain(); swell.gain.value = 0.55;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lfoG = ctx.createGain(); lfoG.gain.value = 0.45;
      lfo.connect(lfoG); lfoG.connect(swell.gain); src.connect(lp); lp.connect(swell); swell.connect(mar); src.start(); lfo.start();
      // cigarra: 5,2 kHz modulado a 45 Hz (o chiado), crescendo e sumindo em ondas de ~4 s
      const grilo = mk(), osc = ctx.createOscillator(); osc.frequency.value = 5200;
      const am = ctx.createGain(); am.gain.value = 0.5; const trill = ctx.createOscillator(); trill.type = 'square'; trill.frequency.value = 45;
      const trG = ctx.createGain(); trG.gain.value = 0.5; trill.connect(trG); trG.connect(am.gain);
      const grp = ctx.createGain(); grp.gain.value = 0.5; const gl = ctx.createOscillator(); gl.type = 'sine'; gl.frequency.value = 0.25;
      const glG = ctx.createGain(); glG.gain.value = 0.5; gl.connect(glG); glG.connect(grp.gain);
      osc.connect(am); am.connect(grp); grp.connect(grilo); osc.start(); trill.start(); gl.start();
      this._amb = { mar, grilo, out: mk(), tB: 0, tS: 0 };
      this._amb.out.gain.value = 1;
    }
    const A = this._amb;
    A.mar.gain.setTargetAtTime(v.mar * 0.35, now, 0.6);
    A.grilo.gain.setTargetAtTime(v.cigarra * 0.01, now, 0.8);
    // passarinho: chance por segundo cresce com o verde
    A.tB -= dt;
    if (v.passaro > 0.05 && A.tB <= 0) {
      A.tB = 0.6 + Math.random() * (3.5 - 2.5 * v.passaro);
      const vol = 0.03 * v.passaro, t = now + Math.random() * 0.2;
      if (Math.random() < 0.4) { // bem-te-vi: três notas, a do meio mais alta
        [[2300, 0.09], [3300, 0.16], [2600, 0.12]].forEach(([f, d], i) => this.hit(A.out, t + i * 0.17, { type: 'sine', f0: f, f1: f * 0.92, dur: d, vol }));
      } else { const f = 2800 + Math.random() * 1800; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.hit(A.out, t + i * 0.11, { type: 'sine', f0: f, f1: f * 1.25, dur: 0.07, vol: vol * 0.8 }); }
    }
    // sapo: coaxar grave aqui e ali, perto de brejo, mangue e rio
    A.tS -= dt;
    if (v.sapo > 0.12 && A.tS <= 0) {
      A.tS = 0.8 + Math.random() * (4 - 3 * v.sapo);
      const t = now + Math.random() * 0.3, f = 160 + Math.random() * 90;
      for (let i = 0; i < 2; i++) this.hit(A.out, t + i * 0.14, { type: 'square', f0: f, f1: f * 0.8, dur: 0.1, vol: 0.025 * v.sapo, filter: 'lowpass', fq: 900 });
    }
  }

  // torcida no estádio: murmúrio de multidão (ruído na faixa da voz) que cresce e baixa, com palmas no ritmo
  torcida(v) {
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    if (!this._torc) {
      if (v < 0.01) return;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master);
      const src = ctx.createBufferSource(); src.buffer = this.noise(); src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.7;
      const sw = ctx.createGain(); sw.gain.value = 0.6; const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.4;
      lfo.connect(lg); lg.connect(sw.gain); src.connect(bp); bp.connect(sw); sw.connect(g); src.start(); lfo.start();
      this._torc = { g, v: 0, next: now };
    }
    const T = this._torc;
    if (Math.abs(T.v - v) > 0.01) { T.v = v; T.g.gain.setTargetAtTime(v * 0.5, now, 0.5); }
    // palmas: três batidas e pausa, a 120 por minuto
    if (v > 0.05) while (T.next < now + 0.2) { const k = Math.round(T.next / 0.5) % 4; if (k < 3) this.hit(T.g, T.next, { noise: true, f0: 1800, dur: 0.06, vol: 0.5, filter: 'bandpass' }); T.next += 0.5; }
    else T.next = now + 0.1;
  }

  // sino de igreja: uma batida com parciais de sino (fundamental, terça menor, quinta, oitava e "hum" grave) que
  // demoram a sumir; o volume vem da distância até a igreja
  sino(vol, quando = 0) {
    if (!this.ctx || vol < 0.01) return;
    const t = this.ctx.currentTime + quando, f = 392;
    for (const [m, v, d] of [[0.5, 0.5, 4.5], [1, 1, 3.2], [1.2, 0.45, 2.4], [1.5, 0.35, 2], [2, 0.3, 1.6], [2.76, 0.15, 1.1]]) this.hit(this.master, t, { type: 'sine', f0: f * m, dur: d, vol: 0.09 * vol * v });
  }

  // turbina de avião: ronco grave (ruído filtrado) com um assobio agudo por cima; volume pela distância
  aviao(vol) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this._aviao) {
      if (vol < 0.01) return;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master);
      const src = ctx.createBufferSource(); src.buffer = this.noise(); src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; src.connect(lp); lp.connect(g); src.start();
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 2900; const og = ctx.createGain(); og.gain.value = 0.04; const of = ctx.createBiquadFilter(); of.type = 'bandpass'; of.frequency.value = 2900; o.connect(of); of.connect(og); og.connect(g); o.start();
      this._aviao = { g, v: 0 };
    }
    const A = this._aviao;
    if (Math.abs(A.v - vol) > 0.01) { A.v = vol; A.g.gain.setTargetAtTime(vol * 0.55, ctx.currentTime, 0.3); }
  }

  // pedra de dominó batendo na mesa de madeira: estalo seco e curto
  tac(vol = 1) {
    if (!this.ctx || vol < 0.02) return;
    const t = this.ctx.currentTime;
    this.hit(this.master, t, { noise: true, f0: 3200, dur: 0.05, vol: 0.35 * vol, filter: 'bandpass' });
    this.hit(this.master, t, { type: 'triangle', f0: 900, f1: 500, dur: 0.06, vol: 0.12 * vol });
  }

  // carro entrando na poça: chuá de ruído abafado
  splash(vol = 0.6) {
    if (!this.ctx) return;
    this.hit(this.master, this.ctx.currentTime, { noise: true, f0: 1100, dur: 0.45, vol: 0.5 * vol, filter: 'lowpass' });
  }

  // chuva (toró): ruído em laço, grave cortado e agudo abafado; o volume segue a intensidade da chuva
  rain(v) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this._rain) {
      if (v < 0.01) return;
      const src = ctx.createBufferSource(); src.buffer = this.noise(); src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.master); src.start();
      this._rain = { g, src, v: 0 };
    }
    const R = this._rain;
    if (Math.abs(R.v - v) > 0.01) { R.v = v; R.g.gain.setTargetAtTime(v * 0.22, ctx.currentTime, 0.4); }
  }

  // ---------------------------------------------------------------- rádio 8-bit (tecla R)
  // Três estações com faixas de composição própria no clima dos ritmos da cidade: frevo, manguebeat e brega.
  // Som de console antigo: melodia em onda quadrada, baixo em triângulo e bateria de ruído.
  radioSet(i) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.radioOut) {
      this.radioOut = ctx.createGain(); this.radioOut.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
      this.radioOut.connect(lp); lp.connect(this.master);
    }
    this.station = i;
    this.radioOut.gain.setTargetAtTime(i < 0 ? 0 : 0.55, ctx.currentTime, 0.15);
    if (i >= 0) { const S = RADIO[i]; this.radio = { S, next: ctx.currentTime + 0.1, step: 0, mel: parse(S.lead), bass: parse(S.bass), n: parse(S.lead).length }; }
  }
  radioTick() {
    if (!this.ctx || this.station == null || this.station < 0 || !this.radio) return;
    const R = this.radio, S = R.S, ctx = this.ctx, sd = 60 / S.bpm / 4, out = this.radioOut;
    while (R.next < ctx.currentTime + 0.25) {
      const i = R.step % R.n, s = i % 16, t = R.next;
      const m = R.mel[i], b = R.bass[i % R.bass.length];
      if (m && m.on) this.hit(out, t, { type: 'square', f0: m.f, dur: m.len * sd * 0.92, vol: 0.05 });
      if (m && m.on && S.harm) this.hit(out, t, { type: 'square', f0: m.f * 0.749, dur: m.len * sd * 0.9, vol: 0.022 }); // terça embaixo
      if (b && b.on) this.hit(out, t, { type: 'triangle', f0: b.f, dur: b.len * sd * 0.95, vol: 0.16 });
      if (S.kick.includes(s)) this.hit(out, t, { type: 'square', f0: 110, f1: 40, dur: 0.12, vol: 0.22 });
      if (S.snare.includes(s)) this.hit(out, t, { noise: true, f0: 2500, dur: 0.1, vol: 0.2, filter: 'bandpass' });
      if (S.hat.includes(s)) this.hit(out, t, { noise: true, f0: 9000, dur: 0.03, vol: 0.06, filter: 'highpass' });
      R.next += sd; R.step++;
    }
  }
  noise() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate; const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (this._noise = b);
  }
  hit(out, t, { type = 'sine', f0, f1, dur, vol, filter, fq = 1, noise = false }) {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    let src;
    if (noise) { src = ctx.createBufferSource(); src.buffer = this.noise(); src.loopStart = Math.random() * 0.5; }
    else { src = ctx.createOscillator(); src.type = type; src.frequency.setValueAtTime(f0, t); if (f1) src.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8); }
    let node = src;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = f0 && noise ? f0 : (fq > 1 ? fq : 2000); if (noise) f.Q.value = 1.2; node.connect(f); node = f; }
    node.connect(g); g.connect(out);
    src.start(t, noise ? Math.random() * 0.5 : 0); src.stop(t + dur + 0.05);
  }
  // bloco de frevo na rua: a melodia da Rádio Frevo tocada por metais (dente de serra abafado, trombone uma oitava
  // abaixo) com caixa e surdo; som de rua, mais cheio que o 8-bit do rádio
  frevoStep(out, t, L) {
    const S = RADIO[0];
    this._frevo ||= { mel: parse(S.lead), bass: parse(S.bass) };
    const F = this._frevo, sd = 60 / S.bpm / 4, i = (L.k = (L.k ?? -1) + 1) % F.mel.length, s = i % 16;
    const m = F.mel[i], b = F.bass[i % F.bass.length];
    if (m && m.on) { this.hit(out, t, { type: 'sawtooth', f0: m.f, dur: m.len * sd * 0.85, vol: 0.06, filter: 'lowpass', fq: 2600 }); this.hit(out, t, { type: 'sawtooth', f0: m.f / 2, dur: m.len * sd * 0.85, vol: 0.05, filter: 'lowpass', fq: 1400 }); }
    if (b && b.on) this.hit(out, t, { type: 'triangle', f0: b.f, dur: b.len * sd * 0.9, vol: 0.14 });
    if (s === 0 || s === 8) this.hit(out, t, { type: 'sine', f0: 90, f1: 45, dur: 0.18, vol: 0.35 });
    if (S.snare.includes(s)) this.hit(out, t, { noise: true, f0: 2200, dur: 0.09, vol: 0.18, filter: 'bandpass' });
  }

  bregaStep(out, t, s, bar) {
    const KICK = [0, 3, 6, 8, 11, 14], CLAP = [4, 12], STAB = [2, 7, 10];
    const ROOT = [55, 55, 49, 52][bar]; // lá, lá, sol, sol# (grave)
    if (KICK.includes(s)) { this.hit(out, t, { f0: 140, f1: 42, dur: 0.28, vol: 0.9 }); this.hit(out, t, { type: 'sawtooth', f0: ROOT, dur: 0.2, vol: 0.18, filter: 'lowpass', fq: 260 }); }
    if (CLAP.includes(s)) this.hit(out, t, { noise: true, f0: 1500, dur: 0.14, vol: 0.45, filter: 'bandpass' });
    if (s % 2 === 0) this.hit(out, t, { noise: true, f0: 8000, dur: s === 14 ? 0.12 : 0.035, vol: 0.12, filter: 'highpass' });
    if (STAB.includes(s)) for (const m of [4, 4 * 1.189, 4 * 1.498]) this.hit(out, t, { type: 'square', f0: ROOT * m, dur: 0.1, vol: 0.035, filter: 'lowpass', fq: 2400 });
  }
  // ciranda: zabumba pesada no 1, ganzá contínuo, caixa leve e uma melodia pentatônica simples (composição própria)
  cirandaStep(out, t, s, bar) {
    if (s === 0 || s === 8) this.hit(out, t, { f0: 85, f1: 50, dur: 0.4, vol: 0.85 });
    if (s === 6 || s === 14) this.hit(out, t, { f0: 110, f1: 70, dur: 0.22, vol: 0.4 });
    if (s === 4 || s === 12) this.hit(out, t, { noise: true, f0: 2200, dur: 0.1, vol: 0.18, filter: 'bandpass' });
    this.hit(out, t, { noise: true, f0: 7500, dur: s % 2 ? 0.03 : 0.05, vol: s % 2 ? 0.05 : 0.09, filter: 'highpass' });
    const MEL = [[0, 2, 4, 2], [4, 7, 4, 2], [0, 2, 4, 7], [9, 7, 4, 0]][bar], SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    if (s % 4 === 0) { const n = MEL[s / 4]; this.hit(out, t, { type: 'triangle', f0: 392 * Math.pow(2, n / 12), dur: 0.38, vol: 0.07 }); }
    void SCALE;
  }
  // punk rock de 180 BPM (composição própria): bumbo e caixa retos, chimbal em colcheia e guitarra em power chord
  // distorcida tocando colcheias; abafado pelas paredes (passa-baixa), como quem ouve da calçada
  punkStep(out, t, s, bar) {
    if (!this.punkOut) {
      const ctx = this.ctx, sh = ctx.createWaveShaper(), curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); }
      sh.curve = curve; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      sh.connect(lp); lp.connect(out); this.punkOut = sh;
    }
    const ROOT = [82.4, 82.4, 98, 73.4][bar]; // mi, mi, sol, ré
    if (s === 0 || s === 6 || s === 8 || s === 10) this.hit(out, t, { f0: 120, f1: 45, dur: 0.18, vol: 0.9 });
    if (s === 4 || s === 12) this.hit(out, t, { noise: true, f0: 1800, dur: 0.16, vol: 0.55, filter: 'bandpass' });
    if (s % 2 === 0) this.hit(out, t, { noise: true, f0: 7000, dur: 0.04, vol: 0.1, filter: 'highpass' });
    if (s % 2 === 0) for (const m of [1, 1.498, 2]) this.hit(this.punkOut, t, { type: 'sawtooth', f0: ROOT * m, dur: 0.16, vol: 0.06 });
  }
  // roda de capoeira (batida tradicional de domínio público, timbres sintetizados): berimbau gunga no
  // "tch-tch dom dim" (chiado da pedra encostada, corda solta, pedra apertada), caxixi, pandeiro e agogô
  capoeiraStep(out, t, s) {
    const b = s % 8;
    if (b === 0 || b === 2) this.hit(out, t, { noise: true, f0: 900, dur: 0.06, vol: 0.22, filter: 'bandpass' });
    if (b === 4) { this.hit(out, t, { type: 'triangle', f0: 98, f1: 96, dur: 0.6, vol: 0.32 }); this.hit(out, t, { type: 'sine', f0: 196, dur: 0.4, vol: 0.12 }); }
    if (b === 6) { this.hit(out, t, { type: 'triangle', f0: 110, f1: 108, dur: 0.5, vol: 0.3 }); this.hit(out, t, { type: 'sine', f0: 220, dur: 0.35, vol: 0.1 }); }
    this.hit(out, t, { noise: true, f0: 6500, dur: 0.03, vol: s % 2 ? 0.04 : 0.07, filter: 'highpass' }); // caxixi
    if (s === 0 || s === 8) this.hit(out, t, { f0: 80, f1: 55, dur: 0.3, vol: 0.5 }); // pandeiro grave / atabaque
    if (s === 4 || s === 12) this.hit(out, t, { noise: true, f0: 2400, dur: 0.07, vol: 0.2, filter: 'bandpass' }); // tapa
    if (s % 2) this.hit(out, t, { noise: true, f0: 9000, dur: 0.05, vol: 0.05, filter: 'highpass' }); // platinela
    if (s === 0 || s === 3 || s === 6) this.hit(out, t, { type: 'square', f0: s === 3 ? 660 : 880, dur: 0.08, vol: 0.025, filter: 'lowpass', fq: 3000 }); // agogô
  }
  // coco de embolada (ritmo tradicional, timbres sintetizados): pandeiro com grave no 1 e no "e" do 2, tapa no 2,
  // platinela nas semicolcheias e ganzá contínuo
  cocoStep(out, t, s) {
    if (s === 0 || s === 6 || s === 8 || s === 14) this.hit(out, t, { f0: 85, f1: 60, dur: 0.25, vol: s % 8 ? 0.35 : 0.55 });
    if (s === 4 || s === 12) this.hit(out, t, { noise: true, f0: 2600, dur: 0.07, vol: 0.25, filter: 'bandpass' });
    this.hit(out, t, { noise: true, f0: 9500, dur: 0.04, vol: s % 2 ? 0.05 : 0.08, filter: 'highpass' });
    this.hit(out, t, { noise: true, f0: 6000, dur: 0.03, vol: s % 4 === 2 ? 0.08 : 0.04, filter: 'highpass' }); // ganzá
  }
  // xote pé-de-serra (composição própria): zabumba no 1 e no "e" do 2 com o bacalhau (aro) no contratempo, triângulo
  // aberto/fechado em semicolcheia e sanfona tocando acorde no tempo e uma melodia simples em sol maior por cima
  forroStep(out, t, s, bar) {
    if (s === 0 || s === 10) this.hit(out, t, { f0: 95, f1: 55, dur: 0.35, vol: 0.7 });
    if (s === 4 || s === 12) this.hit(out, t, { noise: true, f0: 3500, dur: 0.05, vol: 0.12, filter: 'bandpass' }); // bacalhau
    this.hit(out, t, { type: 'sine', f0: 3800, dur: s % 4 === 2 ? 0.2 : 0.04, vol: s % 4 === 2 ? 0.05 : 0.03 }); // triângulo
    const ACORDE = [[196, 247, 294], [262, 330, 392], [294, 370, 440], [196, 247, 294]][bar];
    if (s % 4 === 0) for (const f of ACORDE) this.hit(out, t, { type: 'sawtooth', f0: f, dur: 0.22, vol: 0.022, filter: 'lowpass', fq: 1800 });
    const MEL = [[392, 0, 440, 494, 0, 440, 392, 0], [523, 0, 494, 440, 0, 392, 440, 0], [587, 0, 523, 494, 0, 440, 494, 0], [392, 0, 330, 294, 0, 330, 392, 0]][bar];
    if (s % 2 === 0) { const f = MEL[s / 2]; if (f) this.hit(out, t, { type: 'square', f0: f, dur: 0.24, vol: 0.035, filter: 'lowpass', fq: 2600 }); }
  }
  atabaqueStep(out, t, s) {
    // lé marca, rumpi responde, rum repica
    const LE = [0, 3, 6, 8, 11, 14], RUMPI = [2, 5, 10, 13], RUM = [7, 15, 9];
    if (LE.includes(s)) { this.hit(out, t, { f0: 95, f1: 70, dur: 0.35, vol: 0.6 }); this.hit(out, t, { noise: true, f0: 600, dur: 0.05, vol: 0.12, filter: 'bandpass' }); }
    if (RUMPI.includes(s)) this.hit(out, t, { f0: 160, f1: 120, dur: 0.25, vol: 0.45 });
    if (RUM.includes(s)) { this.hit(out, t, { f0: 240, f1: 190, dur: 0.18, vol: 0.4 }); this.hit(out, t, { noise: true, f0: 1800, dur: 0.04, vol: 0.15, filter: 'bandpass' }); }
    if (s % 4 === 1) this.hit(out, t, { noise: true, f0: 6000, dur: 0.05, vol: 0.06, filter: 'highpass' }); // agogô/xequerê
  }
}

// notas: "C5", "F#4", "-" segura a anterior, "." pausa; 16 passos por compasso
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function parse(str) {
  const out = [];
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '-') { const last = [...out].reverse().find((o) => o.on); if (last) last.len++; out.push({ on: false }); continue; }
    if (tok === '.') { out.push({ on: false }); continue; }
    const m = /^([A-G]#?)(\d)$/.exec(tok); if (!m) { out.push({ on: false }); continue; }
    out.push({ on: true, len: 1, f: 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12) });
  }
  return out;
}
// composições próprias (não são transcrições de músicas existentes)
const RADIO = [
  {
    name: 'Rádio Frevo 8-bit', bpm: 152, harm: true,
    kick: [0, 8], snare: [2, 4, 6, 10, 12, 14, 15], hat: [0, 2, 4, 6, 8, 10, 12, 14],
    lead: `C5 E5 G5 E5 C6 - G5 E5 F5 A5 C6 A5 G5 - - .
           E5 G5 C6 G5 E5 - D5 E5 F5 E5 D5 C5 B4 - G4 .
           B4 D5 G5 D5 B4 - G5 F5 E5 F5 G5 A5 B5 - G5 .
           C6 B5 A5 G5 F5 E5 D5 B4 C5 - - - G4 A4 B4 .
           A5 G5 F5 E5 F5 - A5 - G5 F5 E5 D5 E5 - C5 .
           D5 E5 F5 G5 A5 - F5 - G5 - E5 - C5 - . .
           B4 C5 D5 E5 F5 E5 D5 C5 B4 - D5 - G5 - F5 .
           E5 G5 C6 - G5 E5 C5 - C5 - . . . . . .`,
    bass: `C3 . G2 . C3 . G2 . C3 . G2 . E3 . G2 .
           C3 . G2 . C3 . G2 . C3 . G2 . C3 . D3 .
           G2 . D3 . G2 . D3 . G2 . D3 . B2 . D3 .
           C3 . G2 . C3 . G2 . C3 . E3 . G3 . . .
           F2 . C3 . F2 . C3 . F2 . C3 . A2 . C3 .
           F2 . C3 . F2 . C3 . G2 . D3 . G2 . D3 .
           G2 . D3 . G2 . D3 . G2 . D3 . B2 . D3 .
           C3 . G2 . C3 . E3 . C3 . . . . . . .`,
  },
  {
    name: 'Rádio Mangue Bit', bpm: 100,
    kick: [0, 3, 6, 10, 12], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    lead: `E5 . . G5 . A5 . B5 - . A5 G5 . E5 . .
           D5 . . E5 . G5 . A5 - . G5 E5 . D5 . .
           E5 . . G5 . A5 . B5 - . A5 G5 . E5 . .
           G5 . A5 . B5 . D6 - B5 . A5 . G5 . E5 .
           B5 - - . A5 - - . G5 - E5 - D5 - E5 -
           . . . . . . . . . . . . E5 G5 A5 B5
           B5 - - . A5 - - . G5 - E5 - D5 - B4 -
           E5 - - - . . . . . . . . . . . .`,
    bass: `E2 . E2 G2 . A2 . E2 . E2 B2 . A2 G2 . .
           D2 . D2 E2 . G2 . D2 . D2 A2 . G2 E2 . .`,
  },
  {
    name: 'Rádio Brega 8-bit', bpm: 118, harm: true,
    kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14],
    lead: `A4 - C5 E5 - - D5 C5 - B4 - A4 - - . .
           F4 - A4 C5 - - B4 A4 - G4 - F4 - - . .
           E5 - - D5 C5 - D5 E5 - G5 - E5 - - . .
           D5 - - C5 B4 - C5 D5 - - B4 - G4 - . .
           A5 - - G5 E5 - - C5 D5 - E5 - - - . .
           F5 - - E5 C5 - - A4 C5 - D5 - - - . .
           E5 - - D5 C5 - B4 - C5 - B4 - G4 - - .
           A4 - - - - - - - . . . . . . . .`,
    bass: `A2 . . . . . E3 . A2 . . . . . E3 .
           F2 . . . . . C3 . F2 . . . . . C3 .
           C3 . . . . . G2 . C3 . . . . . G2 .
           G2 . . . . . D3 . G2 . . . . . B2 .`,
  },
];
export const RADIO_NAMES = RADIO.map((r) => r.name);
