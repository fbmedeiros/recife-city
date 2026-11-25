// Passo do frevo (passistas do bloco e da boemia). Feito a partir de fotos e aulas de passistas:
// - sombrinha na mão direita, erguida acima da cabeça ou ao lado, braço esticado; o outro braço aberto na altura do
//   ombro, como asa de equilíbrio;
// - joelhos sempre dobrados e pulinhos curtos a cada tempo (o frevo é rápido: ~150 batidas por minuto);
// - passos com forma própria, trocados a cada dois compassos:
//   tesoura   — uma perna cruza na frente da outra, na ponta do pé, alternando com um pulinho;
//   ferrolho  — chute para a frente com a perna quase esticada e o calcanhar na frente, alternando;
//   dobradiça — tronco jogado para trás e joelhos para a frente (a "dobradiça"), balançando de um lado para o outro;
//   parafuso  — pernas cruzadas, girando o corpo inteiro e descendo e subindo como um parafuso;
//   salto     — pulo alto com os dois joelhos para cima, sombrinha lá no alto.
// A altura do corpo é calculada pela perna de apoio, para o pé não afundar nem flutuar.
// Uso: const r = frevoPose(pessoa, t, fase); pessoa.position.y += r.y; pessoa.rotation.y = rumo + r.yaw;

const BPM = 150, L1 = 0.44, L2 = 0.41; // coxa e canela (models.js)
const STEPS = ['tesoura', 'ferrolho', 'dobradica', 'parafuso', 'tesoura', 'salto'];
const KEYS = ['lean', 'roll', 'lLx', 'lLz', 'lKx', 'rLx', 'rLz', 'rKx', 'aLx', 'aLz', 'eL', 'aRx', 'aRz', 'eR', 'head', 'yaw', 'jump'];

// pose de um passo no tempo b (em batidas, contínuo). s = lado (+1/-1) que alterna a cada batida.
function pose(step, b) {
  const beat = Math.floor(b), f = b - beat, s = beat % 2 ? 1 : -1;
  const bounce = Math.sin(Math.PI * f); // 0 no tempo, 1 no meio (pulinho)
  const P = {
    lean: 0.08, roll: 0, head: 0, yaw: 0, jump: 0.05 * bounce,
    // braço esquerdo aberto como asa, mão balançando no tempo; direito com a sombrinha no alto
    aLx: -0.15, aLz: -1.35 - 0.25 * bounce, eL: -0.45,
    aRx: -0.25, aRz: 2.45 + 0.2 * Math.sin(Math.PI * b * 0.5), eR: -0.25,
    lLx: -0.35, lLz: 0, lKx: 0.75, rLx: -0.35, rLz: 0, rKx: 0.75,
  };
  if (step === 'tesoura') {
    // a perna do lado s cruza por cima, na frente da outra; quem fica de apoio dobra
    const cross = 0.42, k = 0.6 + 0.25 * bounce;
    if (s > 0) { P.rLx = -0.45; P.rLz = -cross; P.rKx = 0.5; P.lLx = -0.3; P.lKx = k; }
    else { P.lLx = -0.45; P.lLz = cross; P.lKx = 0.5; P.rLx = -0.3; P.rKx = k; }
    P.yaw = s * 0.35; P.roll = -s * 0.08; P.jump = 0.09 * bounce;
  } else if (step === 'ferrolho') {
    // chute para a frente com a perna quase esticada; o corpo vai um pouco para trás
    const kick = 0.95 * Math.sin(Math.PI * Math.min(1, f * 1.4));
    if (s > 0) { P.rLx = -0.25 - kick; P.rKx = 0.15; P.lLx = -0.25; P.lKx = 0.6; }
    else { P.lLx = -0.25 - kick; P.lKx = 0.15; P.rLx = -0.25; P.rKx = 0.6; }
    P.lean = -0.18; P.jump = 0.06 * bounce; P.aLz = -1.5; P.yaw = -s * 0.15;
  } else if (step === 'dobradica') {
    // joelhos para a frente, tronco para trás; balança de um lado para o outro no tempo
    const sway = Math.sin(Math.PI * b);
    P.lLx = P.rLx = -1.05; P.lKx = P.rKx = 1.75;
    P.lean = -0.55; P.roll = 0.18 * sway; P.head = 0.3;
    P.aLx = -0.9; P.aLz = -1.1; P.eL = -0.6; P.aRz = 2.2; P.aRx = -0.5;
    P.jump = 0.02 * bounce;
  } else if (step === 'parafuso') {
    // pernas cruzadas, gira uma volta a cada quatro tempos, desce e sobe
    const down = 0.5 - 0.5 * Math.cos((Math.PI * b) / 2);
    P.lLz = 0.3; P.rLz = -0.3; P.lLx = -0.3 - 0.5 * down; P.rLx = -0.25 - 0.5 * down;
    P.lKx = 0.5 + 1.0 * down; P.rKx = 0.45 + 1.0 * down;
    P.yaw = (Math.PI * 2 * b) / 4; P.lean = 0.12 + 0.15 * down;
    P.aLz = -1.6; P.aRz = 2.7; P.jump = 0;
  } else if (step === 'salto') {
    // um pulo alto a cada dois tempos, joelhos para cima; no outro tempo, pulinho de preparação
    const big = beat % 2 === 0, air = Math.sin(Math.PI * f);
    if (big) { P.jump = 0.42 * air; P.lLx = P.rLx = -0.35 - 1.0 * air; P.lKx = P.rKx = 0.75 + 1.3 * air; P.aRz = 2.8; P.aLz = -2.0 * air - 1.3 * (1 - air); }
    else { P.lLx = P.rLx = -0.6; P.lKx = P.rKx = 1.1; P.jump = 0.04 * air; }
  }
  return P;
}

// tira a sombrinha do ombro (models.js a pendura no tronco) e põe na mão direita, como a passista segura
function sombrinhaNaMao(u) {
  if (u.frevoMao !== undefined) return;
  u.frevoMao = null;
  const s = u.upper.children.find((c) => c.isGroup && c.children.length === 2 && c.children[0].material?.vertexColors && c.children[0].material?.side === 2);
  if (!s) return;
  u.upper.remove(s);
  s.position.set(0, -0.27, 0.02); // na mão (fim do antebraço)
  s.rotation.set(Math.PI, 0, 0); // cabo seguindo o antebraço, copa além da mão
  s.scale.setScalar(0.62); // a sombrinha de frevo é pequena: ~50 cm de copa, mais ou menos a largura dos ombros
  u.elbowR.add(s);
  u.frevoMao = s;
}

// altura do quadril em relação ao pé (perna com coxa a e joelho k; coxa para a frente = a > 0)
const footDrop = (a, k) => L1 + L2 - L1 * Math.cos(a) - L2 * Math.cos(a - k);

export function frevoPose(p, t, ph = 0) {
  const u = p.userData;
  sombrinhaNaMao(u);
  const b = (t * BPM) / 60 + ph * 3.1;
  // troca de passo a cada 8 tempos (dois compassos), misturando no último meio tempo
  const seg = Math.floor(b / 8), w = Math.min(1, Math.max(0, (b - seg * 8 - 7.5) / 0.5));
  const pick = (n) => STEPS[(n + Math.floor(ph * 7)) % STEPS.length];
  const A = pose(pick(seg), b), B = w > 0 ? pose(pick(seg + 1), b) : A;
  const P = {}; for (const k of KEYS) P[k] = A[k] + (B[k] - A[k]) * w;
  u.legL.rotation.set(P.lLx, 0, P.lLz); u.legR.rotation.set(P.rLx, 0, P.rLz);
  u.kneeL.rotation.x = P.lKx; u.kneeR.rotation.x = P.rKx;
  u.armL.rotation.set(P.aLx, 0, P.aLz); u.armR.rotation.set(P.aRx, 0, P.aRz);
  u.elbowL.rotation.x = P.eL; u.elbowR.rotation.x = P.eR;
  u.upper.rotation.set(P.lean, 0, P.roll); u.head.rotation.x = P.head;
  // o pé mais baixo encosta no chão (a coxa cruzada também encurta um pouco a perna)
  const dl = footDrop(-P.lLx, P.lKx) + L1 * (1 - Math.cos(P.lLz)), dr = footDrop(-P.rLx, P.rKx) + L1 * (1 - Math.cos(P.rLz));
  return { y: (P.jump - Math.min(dl, dr)) * p.scale.y, yaw: P.yaw };
}
