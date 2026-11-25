// Som ambiente pelo lugar e pela hora: onda do mar na orla de Boa Viagem e do Pina, passarinho onde tem árvore
// (parque, mata, quintal), cigarra na mata fechada no calor da tarde e sapo perto de brejo, mangue e rio (mais
// na chuva). O jogo não tem noite (o dia vai das 6h às 17h06), então tudo é som de dia.
// O lugar vem da cobertura do solo (WorldCover) e da linha da avenida da orla (tubarao.js); a chuva cala os
// passarinhos. Calcula duas vezes por segundo; o áudio só suaviza o volume.
import { COB } from './cobertura.js';

export class Ambience {
  constructor({ world, day, audio, sharks, weather }) {
    Object.assign(this, { world, day, audio, sharks, weather });
    this.cob = world.data.cobertura || null;
    this.v = { mar: 0, passaro: 0, cigarra: 0, sapo: 0 };
    this.t = 0;
  }

  update(dt, cam, started) {
    this.t -= dt;
    if (this.t <= 0) { this.t = 0.5; this.medir(cam, started); }
    this.audio.ambient?.(this.v, dt);
  }

  medir(cam, started) {
    const v = this.v, x = cam.x, z = cam.z, chuva = this.weather?.r || 0;
    if (!started) { v.mar = v.passaro = v.cigarra = v.sapo = 0; return; }
    // mar: distância até a faixa de areia (uns 40 m depois da avenida da orla)
    const ax = this.sharks?.avX?.(z);
    v.mar = ax != null ? Math.max(0, 1 - Math.abs(x - (ax + 45)) / 260) ** 1.5 : 0;
    const C = this.cob;
    const verde = C ? C.frac(x, z, COB.ARVORE, 60) : 0;
    const brejo = C ? Math.min(1, (C.frac(x, z, COB.MANGUE, 90) + C.frac(x, z, COB.BREJO, 90) + 0.2 * C.frac(x, z, COB.AGUA, 90)) * 1.6) : 0;
    const h = this.day.hours;
    v.passaro = Math.min(1, verde * 1.6) * (1 - chuva) * (h < 16.5 ? 1 : 0.5); // no fim da tarde, metade
    v.cigarra = Math.max(0, verde - 0.35) / 0.65 * (h > 10 ? 1 : 0.3) * (1 - chuva);  // só na mata fechada, no calor
    v.sapo = brejo * (0.35 + 0.65 * chuva);
  }
}
