// Sinos das igrejas: a cada hora cheia do jogo, a igreja mais perto do jogador (a menos de 450 m) bate o sino uma vez
// por hora (13h = 1, como relógio de 12 horas), uma batida a cada 1,6 s. Igrejas são os lugares de culto do mapa e os
// nomes com igreja, basílica, capela, matriz ou convento.
export class Sinos {
  constructor({ world, day, audio, player }) {
    Object.assign(this, { day, audio, player });
    const re = /igreja|basílica|capela|matriz|convento|concatedral|paróquia/i;
    this.igrejas = world.pois.filter((p) => p.kind === 'place_of_worship' || re.test(p.name)).map((p) => ({ x: p.x, z: p.z, nome: p.name }));
    this.hora = Math.floor(day.hours);
  }

  update() {
    const h = Math.floor(this.day.hours);
    if (h === this.hora) return;
    const virou = h > this.hora; // o relógio do jogo volta das 17h pras 6h: aí não toca
    this.hora = h;
    if (!virou) return;
    const P = this.player.pos;
    let best = null, bd = 450;
    for (const g of this.igrejas) { const d = Math.hypot(g.x - P.x, g.z - P.z); if (d < bd) { bd = d; best = g; } }
    if (!best) return;
    const vol = (1 - bd / 450) ** 1.3, n = h % 12 || 12;
    for (let i = 0; i < n; i++) this.audio.sino?.(vol, i * 1.6);
    this.ultimo = { igreja: best.nome, batidas: n, dist: Math.round(bd) };
  }
}
