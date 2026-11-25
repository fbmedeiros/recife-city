"""Cobertura do solo do Recife (ESA WorldCover 2021, 10 m, CC BY 4.0) recortada para a área de um mapa do jogo.

Uso: python3 scripts/cobertura.py ESA_WorldCover_10m_2021_v200_S09W036_Map.tif public/data/recife-full.json public/data/recife-full-cobertura.bin
Precisa de rasterio e numpy.

Classes gravadas (1 byte por célula, em corridas):
  0 outro · 1 árvore · 2 arbusto/capim/roça · 3 construído · 4 solo exposto · 5 água · 6 brejo · 7 mangue
Formato: 'COB1', latN, lonW, dlat, dlon (float64), W, H (uint32), depois pares [classe uint8][corrida uint16 LE]
em ordem de linha (norte para sul, oeste para leste).
"""
import json
import struct
import sys

import numpy as np
import rasterio
from rasterio.windows import from_bounds

tif, mapa, out = sys.argv[1:4]
with open(mapa) as f:
    d = json.load(f)
m = d['meta']
xs = [p[0] for r in d['roads'] for p in r['p']]
zs = [p[1] for r in d['roads'] for p in r['p']]
x0, x1, z0, z1 = min(xs) - 60, max(xs) + 60, min(zs) - 60, max(zs) + 60
lonW, lonE = m['lon0'] + x0 / m['mLon'], m['lon0'] + x1 / m['mLon']
latN, latS = m['lat0'] - z0 / m['mLat'], m['lat0'] - z1 / m['mLat']

REMAP = np.zeros(256, np.uint8)
for k, v in {10: 1, 20: 2, 30: 2, 40: 2, 50: 3, 60: 4, 80: 5, 90: 6, 95: 7}.items():
    REMAP[k] = v

with rasterio.open(tif) as src:
    win = from_bounds(lonW, latS, lonE, latN, src.transform).round_offsets().round_lengths()
    a = src.read(1, window=win)
    t = src.window_transform(win)
a = REMAP[a]
H, W = a.shape
dlon, dlat = t.a, -t.e
N0, W0 = t.f, t.c

flat = a.ravel()
change = np.flatnonzero(np.diff(flat)) + 1
starts = np.concatenate(([0], change))
lens = np.diff(np.concatenate((starts, [flat.size])))
buf = bytearray(b'COB1' + struct.pack('<4d2I', N0, W0, dlat, dlon, W, H))
for s, n in zip(starts, lens):
    v = int(flat[s])
    while n > 0:
        k = min(int(n), 65535)
        buf += struct.pack('<BH', v, k)
        n -= k
with open(out, 'wb') as f:
    f.write(buf)
cnt = np.bincount(flat, minlength=8)
nomes = ['outro', 'árvore', 'aberto', 'construído', 'solo', 'água', 'brejo', 'mangue']
print(f'{W}x{H} células de {dlon * 110210:.1f} x {dlat * 110574:.1f} m, {len(buf) / 1e6:.2f} MB ->', out)
print(', '.join(f'{nomes[i]} {cnt[i] / flat.size * 100:.0f}%' for i in range(8)))
