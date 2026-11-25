// Intro enquanto o jogo carrega: fotos tiradas do próprio jogo (public/intro) com curiosidades do Recife e dicas,
// trocando a cada 6 s com zoom lento. Roda antes do main.js (script próprio, sem dependências).
const SLIDES = [
  ['marco-zero', 'Marco Zero', 'A Rosa dos Ventos de Cícero Dias marca onde o Recife começa. Do outro lado, o Parque das Esculturas de Francisco Brennand, com a Torre de Cristal de 32 m. Pega o barqueiro: R$ 5 a travessia.'],
  ['arsenal', 'Praça do Arsenal e Paço do Frevo', 'O frevo é Patrimônio Imaterial da Humanidade pela UNESCO desde 2012. Fim de semana tem orquestra e passista com sombrinha na praça.'],
  ['galo', 'Galo da Madrugada', 'No Sábado de Zé Pereira, o Galo arrasta multidão pelo centro e já entrou no Guinness como o maior bloco de carnaval do mundo. Aqui ninguém pula Carnaval: brinca!'],
  ['aurora', 'Rua da Aurora e o Capibaribe', 'Rios, pontes e casarões fizeram o Recife ganhar o apelido de Veneza Brasileira. Na beira do rio tem até o caranguejo gigante da Rua da Aurora.'],
  ['dokas', 'Dokas, Rua do Brum', 'No primeiro andar do sobrado, o Dokas foi palco de muito punk rock no Recife Antigo. Chega perto da porta que o som tá rolando.'],
  ['estaiada', 'Ponte Estaiada da Via Mangue', 'A Via Mangue corta o manguezal ligando o Pina a Boa Viagem. Liga o GPS (tecla N) e digita qualquer endereço da cidade.'],
  ['boa-viagem', 'Orla de Boa Viagem', 'São uns 7 km de calçadão, com tapioca na Pracinha e o Ítalo Sena no Segundo Jardim. As placas amarelas não são brincadeira: tubarão, visse?'],
  ['arruda', 'Mundão do Arruda', 'A casa do Santa Cruz é um dos maiores estádios do Nordeste. O Trio de Ferro (Sport, Santa e Náutico) tá todo no mapa.'],
];
const TIPS = ['G faz o passinho em qualquer lugar', 'R liga a rádio 8-bit', 'N abre o GPS', 'P abre o celular com os bicos', 'F rouba carro, moto ou bike… e chama a PM'];

const el = document.getElementById('intro');
if (el) {
  const [a, b] = el.querySelectorAll('.slide'), cap = el.querySelector('.intro-cap'), t = cap.querySelector('.ic-t'), s = cap.querySelector('.ic-s');
  // pré-carrega e só mostra as fotos que existem
  const ok = [];
  let i = 0, front = a, shown = false;
  const show = () => {
    if (!ok.length) return;
    const [img, title, text] = ok[i % ok.length];
    const back = front === a ? b : a;
    back.style.backgroundImage = `url(/intro/${img}.jpg)`;
    back.classList.remove('on'); void back.offsetWidth; back.classList.add('on'); front.classList.remove('on'); front = back;
    cap.style.opacity = 0;
    setTimeout(() => { t.textContent = title; s.textContent = `${text}  ·  Dica: ${TIPS[i % TIPS.length]}.`; cap.style.opacity = 1; }, 450);
    i++;
  };
  SLIDES.forEach((sl) => { const im = new Image(); im.onload = () => { ok.push(sl); if (!shown) { shown = true; show(); } }; im.src = `/intro/${sl[0]}.jpg`; });
  setInterval(show, 6000);
}
// barra de progresso (o main.js chama a cada etapa do carregamento)
window.__introProgress = (f) => { const bar = document.querySelector('#loadbar i'); if (bar) bar.style.width = Math.round(Math.min(1, f) * 100) + '%'; };
window.__introDone = () => { window.__introProgress(1); setTimeout(() => document.getElementById('loadbar')?.classList.add('done'), 700); };
