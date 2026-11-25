// Progresso do jogador, guardado no navegador (localStorage). Se não der pra salvar, o jogo segue sem.
const KEY = 'oxecity.save.v1';

function load() {
  const base = { money: 0, cars: [], items: [], outfit: { shirt: null, hat: null, glasses: false, hand: null }, turbo: false, home: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...base, ...JSON.parse(raw), outfit: { ...base.outfit, ...(JSON.parse(raw).outfit || {}) } };
    // migra o dinheiro da versão anterior
    base.money = Number(localStorage.getItem('oxecity.money')) || 0;
  } catch {}
  return base;
}

export const save = load();
const listeners = [];

export function persist() {
  if (persist.desligado) return;
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {}
  for (const f of listeners) f(save);
}
export function onSave(f) { listeners.push(f); }

// recomeçar do zero: apaga o progresso e recarrega o jogo (nada mais grava depois disso)
export function zerarSave() {
  try { localStorage.removeItem(KEY); localStorage.removeItem('oxecity.money'); } catch {}
  persist.desligado = true;
  location.reload();
}

export function addMoney(v) {
  save.money = Math.max(0, Math.round(save.money + v));
  persist();
}

export function spend(price) {
  if (save.money < price) return false;
  addMoney(-price);
  return true;
}
