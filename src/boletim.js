// Boletim da rádio: com a rádio ligada, o locutor dá uma notícia a cada minuto e pouco, num letreiro de visor de
// rádio de carro (9 s). A notícia sai do que está acontecendo no jogo: toró e rua alagada (pelas poças de verdade),
// por onde a troça de frevo está passando, a hora e o calor, além de recados e do trânsito (esse é inventado).
const TRANSITO = ['na Agamenon Magalhães, sentido Boa Viagem', 'na Avenida Norte, chegando no Derby', 'na Caxangá, perto do terminal', 'na Domingos Ferreira, sentido Piedade',
  'na Avenida Recife, na altura do Ipsep', 'na ponte da Boa Vista', 'na Conselheiro Aguiar, sentido Pina', 'na Abdias de Carvalho'];
const RECADOS = [
  'Tá liso, motorista? O OXECAR tá chamando gente: abre o celular e pega um bico!',
  'Recado pra quem tá na rua: bebe água, que o sol do Recife não perdoa, visse?',
  'Parou no sinal? Compra uma água do ambulante e ajuda quem tá no corre!',
  'Já passou no Paço do Frevo? Tem guia arretado levando turista pra lá todo dia.',
  'Quem não tem carro vai de busão, e quem tem carro dirige o busão: tem vaga no BUSÃO!',
  'Cuidado com as poças depois do toró: molhar o povo na calçada é feio, tabacudo!',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Boletim {
  constructor({ hud, weather, bloco, day, album, jogo }) {
    Object.assign(this, { hud, weather, bloco, day, album, jogo });
    this.t = 8; this.ultima = null;
  }

  update(dt, estacao, nome) {
    if (estacao < 0) { this.t = 8; return; } // desligou: ao ligar de novo, a primeira notícia vem em 8 s
    if ((this.t -= dt) > 0) return;
    this.t = 70 + Math.random() * 40;
    this.mostrar(nome, this.noticia());
  }

  noticia() {
    const W = this.weather, B = this.bloco, h = this.day.hours, opts = [];
    if (W && W.r > 0.5) {
      const p = W.near?.[Math.floor(Math.random() * W.near.length)], rua = p && this.hud.streetAt(p.x, p.z, 80);
      opts.push(W.flood > 0.3 && rua ? `Toró forte no Recife! Tem água acumulada na ${rua}. Vai devagar que a pista tá lisa!` : 'Caiu o toró! Liga o farol e vai devagar, que a pista tá lisa.');
      opts.push(opts[0]);
    } else if (W && W.flood > 0.2) opts.push('A chuva passou, mas a água ainda não baixou em várias ruas perto dos canais. Cuidado com as poças!');
    if (B?.route && B.ativo) { const q = B.route.at(B.s), rua = this.hud.streetAt(q.x, q.z, 60); opts.push(`A Troça Caraí Que Calor tá na rua${rua ? ', passando pela ' + rua : ''}! Vem brincar, que o frevo não espera!`); }
    const Bz = this.blitz?.b;
    if (Bz) opts.push(`Atenção, motorista: tem blitz${Bz.rua ? ' na ' + Bz.rua : ' por perto'}. Documento em dia e devagar, visse?`);
    if (this.day.hours >= 6 && this.day.hours < 13) opts.push('Bom dia, Recife! As feiras livres de Casa Amarela, Encruzilhada, Madalena e Afogados já tão montadas. Tem manga, caju e macaxeira fresquinha!');
    const J = this.jogo;
    if (J?.ativo) { const C = J.clube; opts.push(`Hoje tem ${C.nome} ${C.estadio}! A torcida já tá em volta do estádio, cantando e balançando bandeira.`, `Dia de jogo: trânsito carregado perto ${C.estadio === 'no Arruda' ? 'do Arruda' : C.estadio === 'nos Aflitos' ? 'dos Aflitos' : 'da Ilha do Retiro'}. Vai cedo, torcedor!`); }
    const graus = Math.round(26 + 6 * Math.sin(((h - 7) / 10) * Math.PI));
    opts.push(`Agora são ${this.day.clock || Math.floor(h) + 'h'} no Recife e o termômetro marca ${graus} graus${graus >= 31 ? '. Caraí, que calor!' : '.'}`);
    opts.push(`Trânsito lento ${pick(TRANSITO)}. Arrodeia por dentro, visse?`);
    opts.push(pick(RECADOS));
    const falta = this.album?.spots?.filter((s) => !this.album.has(s)).length;
    if (falta) opts.push(`Turista e recifense: ainda dá pra conhecer ${falta} cartões-postais da cidade. Olha o álbum no celular!`);
    let n = pick(opts);
    if (n === this.ultima && opts.length > 1) n = pick(opts.filter((o) => o !== n));
    return (this.ultima = n);
  }

  mostrar(nome, texto) {
    let el = document.getElementById('boletim');
    if (!el) { el = document.createElement('div'); el.id = 'boletim'; el.innerHTML = '<b></b><span></span>'; document.body.appendChild(el); }
    el.querySelector('b').textContent = '📻 ' + nome;
    el.querySelector('span').textContent = texto;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.tm); this.tm = setTimeout(() => el.classList.remove('show'), 9000);
  }
}
