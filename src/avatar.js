// Escolha de personagem: seis figuras do Recife (nomes e histórias inventados). Aparece na tela de início, acima do
// JOGAR, e no celular (aba Serviços → Trocar de personagem). Fica salvo em save.avatar; trocar zera o corte da
// barbearia, que volta ao cabelo do personagem. O corpo de verdade (protagonista.js) lê sexo, pele e barba do visual.
import { save, persist } from './save.js';

export const AVATARES = [
  { id: 'biu', nome: 'Biu do Frevo', sub: 'Passista desde menino. Sobe ladeira de Olinda sem perder o passo.', sexo: 'm', pele: '#5a3825', hair: 'buzz', hairColor: '#120c08', barba: true, shirt: '#ffd23f', pants: '#1f7a3a', shoes: '#f2f2f0' },
  { id: 'dandara', nome: 'Dandara do Maracatu', sub: 'Batuqueira do baque virado. Quando ela toca, a calçada treme.', sexo: 'f', pele: '#4a2e1e', hair: 'trancas', hairColor: '#120c08', barba: false, shirt: '#f4f1ea', pants: '#c1121f', shoes: '#f2f2f0' },
  { id: 'galego', nome: 'Galego da Orla', sub: 'Mora em Boa Viagem, vive vermelho do sol e jura que viu o tubarão.', sexo: 'm', pele: '#e8b896', hair: 'short', hairColor: '#d8b25a', barba: false, shirt: '#3bceac', pants: '#ff8c42', shoes: '#2a6fb5' },
  { id: 'julia', nome: 'Júlia de Casa Amarela', sub: 'Faz corrida de app e conhece todo atalho da cidade (e todo buraco).', sexo: 'f', pele: '#a8714a', hair: 'longo', hairColor: '#2a1a10', barba: false, shirt: '#ff6bd6', pants: '#3a5a8a', shoes: '#f2f2f0' },
  { id: 'kae', nome: 'Kaê do Passinho', sub: 'Dança brega-funk em qualquer calçada. O cabelo nevou de propósito.', sexo: 'm', pele: '#8a5a3a', hair: 'buzz', hairColor: '#f1ead2', barba: false, shirt: '#111111', pants: '#111111', shoes: '#ff3b3b' },
  { id: 'severino', nome: 'Seu Severino', sub: 'Aposentado, rei do dominó da praça. Conhece o Recife de antes do asfalto.', sexo: 'm', pele: '#7a4e32', hair: 'short', hairColor: '#cfcfcf', barba: true, shirt: '#4d96ff', pants: '#d8cbb0', shoes: '#5a3a1e' },
];

export const avatarAtual = () => AVATARES.find((a) => a.id === save.avatar) || AVATARES[0];

// retrato desenhado (SVG) a partir das cores do personagem
export function retrato(a) {
  const f = a.sexo === 'f';
  const cab = {
    buzz: `<path d="M34 30a16 16 0 0 1 32 0v-2a16 16 0 0 0-32 0z" fill="${a.hairColor}"/><path d="M34 31c0-10 7-17 16-17s16 7 16 17c-3-5-9-8-16-8s-13 3-16 8z" fill="${a.hairColor}"/>`,
    short: `<path d="M33 33c-1-12 6-21 17-21s19 8 17 21c-2-6-6-9-9-9-4 3-12 3-18 0-3 1-6 4-7 9z" fill="${a.hairColor}"/>`,
    longo: `<path d="M32 34c-2-14 6-22 18-22s20 8 18 22l3 22h-8l-2-20c-3-6-7-9-11-9s-8 3-11 9l-2 20h-8z" fill="${a.hairColor}"/>`,
    trancas: `<circle cx="50" cy="10" r="8" fill="${a.hairColor}"/><path d="M33 32c-1-12 6-20 17-20s18 8 17 20c-4-6-10-9-17-9s-13 3-17 9z" fill="${a.hairColor}"/>`,
  }[a.hair] || '';
  const barba = a.barba ? `<path d="M37 38c2 10 7 14 13 14s11-4 13-14c-3 4-8 6-13 6s-10-2-13-6z" fill="${a.hairColor}"/>` : '';
  return `<svg viewBox="0 0 100 120" aria-hidden="true">
    <rect x="44" y="48" width="12" height="10" fill="${a.pele}"/>
    <path d="M${f ? 26 : 22} 120v-40c0-14 12-24 28-24s28 10 28 24v40z" fill="${a.shirt}"/>
    <path d="M${f ? 30 : 27} 64c-6 2-8 8-8 14v42h8z M${f ? 70 : 73} 64c6 2 8 8 8 14v42h-8z" fill="${a.pele}"/>
    <circle cx="50" cy="34" r="16" fill="${a.pele}"/>
    ${cab}${barba}
    <circle cx="44" cy="34" r="1.8" fill="#1b0f0a"/><circle cx="56" cy="34" r="1.8" fill="#1b0f0a"/>
    <path d="M45 42q5 3 10 0" stroke="#1b0f0a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>`;
}

export class Avatar {
  constructor({ applyOutfit }) {
    this.applyOutfit = applyOutfit;
    this.onChange = null;
  }

  get atual() { return avatarAtual(); }
  get todos() { return AVATARES; }

  escolhe(id) {
    const a = AVATARES.find((q) => q.id === id); if (!a) return false;
    const mudou = save.avatar !== id;
    save.avatar = id;
    if (mudou) { save.outfit.hair = null; save.outfit.hairColor = null; }
    persist();
    this.applyOutfit();
    this.onChange?.(a);
    this.marca?.();
    return true;
  }

  // grade de cartões; ao escolher, marca o cartão e chama escolhe
  monta(el) {
    el.innerHTML = `<div class="av-grade">${AVATARES.map((a) => `<button class="av-card" data-av="${a.id}" type="button" title="${a.nome}">${retrato(a)}<b>${a.nome}</b></button>`).join('')}</div><div class="av-sub"></div>`;
    const sub = el.querySelector('.av-sub');
    const marca = () => { const A = this.atual; el.querySelectorAll('.av-card').forEach((b) => b.classList.toggle('on', b.dataset.av === A.id)); sub.innerHTML = `<b>${A.nome}</b> · ${A.sub}`; };
    el.querySelectorAll('.av-card').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.escolhe(b.dataset.av); marca(); }));
    this.marca = marca;
    marca();
  }
}
