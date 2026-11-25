// Sorteio com semente durante uma montagem: troca Math.random por um gerador fixo enquanto fn roda e devolve o
// original no fim. Assim tudo o que a montagem sorteia (coqueiro, barraca, gente, rotação) sai igual a cada carga,
// e a grade de colisão (que lojas, mesas e semáforos consultam depois) também. Só para código síncrono.
export function comSemente(seed, fn) {
  const orig = Math.random;
  let s = seed >>> 0;
  Math.random = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
  try { return fn(); } finally { Math.random = orig; }
}
