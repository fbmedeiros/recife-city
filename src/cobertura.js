// Cobertura do solo (ESA WorldCover 2021, 10 m, CC BY 4.0), recortada por scripts/cobertura.py: diz, a cada ~9 m,
// se ali é árvore, área construída, campo, água, brejo ou mangue. Serve para pôr mata onde existe mata e casario onde
// existe bairro, mesmo quando o OpenStreetMap não desenhou nada. JavaScript puro (roda no Node também).
export const COB = { OUTRO: 0, ARVORE: 1, ABERTO: 2, CONSTRUIDO: 3, SOLO: 4, AGUA: 5, BREJO: 6, MANGUE: 7 };

// buf: ArrayBuffer do .bin; meta: data.meta do mapa (projeção do jogo)
export function decodeCobertura(buf, meta) {
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'COB1') return null;
  const latN = dv.getFloat64(4, true), lonW = dv.getFloat64(12, true), dlat = dv.getFloat64(20, true), dlon = dv.getFloat64(28, true);
  const W = dv.getUint32(36, true), H = dv.getUint32(40, true), a = new Uint8Array(W * H);
  for (let o = 44, i = 0; o + 2 < buf.byteLength; o += 3) { const v = dv.getUint8(o), n = dv.getUint16(o + 1, true); if (v) a.fill(v, i, i + n); i += n; }
  const { lat0, lon0, mLat, mLon } = meta;
  // x, z do jogo -> célula
  const at = (x, z) => {
    const c = Math.floor((lon0 + x / mLon - lonW) / dlon), r = Math.floor((latN - (lat0 - z / mLat)) / dlat);
    return c < 0 || r < 0 || c >= W || r >= H ? 0 : a[r * W + c];
  };
  // fração da classe k num quadrado de lado 2*rad em volta de (x, z)
  const frac = (x, z, k, rad = 25) => { let n = 0, t = 0; for (let dz = -rad; dz <= rad; dz += 9) for (let dx = -rad; dx <= rad; dx += 9) { t++; if (at(x + dx, z + dz) === k) n++; } return n / t; };
  return { at, frac, W, H };
}
