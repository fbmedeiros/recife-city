"""Contorno dos bairros (OSM boundary=administrative, admin_level=10) para o HUD dizer o bairro em que o jogador
está de verdade. Antes era o bairro de centro mais perto, que erra perto das divisas (o Instituto Ricardo Brennand,
na Várzea, aparecia como Curado).

Uso: python3 scripts/bairros-contorno.py nordeste.osm.pbf public/data/recife-full.json [public/data/recife.json …]
Grava `bairrosArea` = [{n: nome, r: [anéis externos em metros do jogo, simplificados a ~4 m]}] em cada mapa.
"""
import json
import sys

sys.setrecursionlimit(100000)

import osmium

src, maps = sys.argv[1], sys.argv[2:]
S, W, N, E = -8.20, -35.06, -7.90, -34.82


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    (ax, az), (bx, bz) = pts[0], pts[-1]
    dx, dz = bx - ax, bz - az
    L = (dx * dx + dz * dz) ** 0.5 or 1e-9
    i, dmax = 0, 0.0
    for k in range(1, len(pts) - 1):
        d = abs((pts[k][0] - ax) * dz - (pts[k][1] - az) * dx) / L
        if d > dmax:
            i, dmax = k, d
    if dmax <= eps:
        return [pts[0], pts[-1]]
    return rdp(pts[: i + 1], eps)[:-1] + rdp(pts[i:], eps)


areas = []
fp = osmium.FileProcessor(src).with_areas().with_filter(osmium.filter.KeyFilter('boundary'))
for o in fp:
    if not o.is_area():
        continue
    t = o.tags
    if t.get('boundary') != 'administrative' or t.get('admin_level') != '10' or not t.get('name'):
        continue
    rings = [[(n.lat, n.lon) for n in r] for r in o.outer_rings()]
    pts = [p for r in rings for p in r]
    if not pts:
        continue
    la = sum(p[0] for p in pts) / len(pts)
    lo = sum(p[1] for p in pts) / len(pts)
    if S <= la <= N and W <= lo <= E:
        areas.append((t['name'], rings))
print(len(areas), 'bairros com contorno')
for path in maps:
    with open(path) as f:
        d = json.load(f)
    m = d['meta']
    out = []
    for name, rings in areas:
        rr = []
        for r in rings:
            pts = [((lo - m['lon0']) * m['mLon'], -(la - m['lat0']) * m['mLat']) for la, lo in r]
            # anel fechado: corta no ponto mais longe do primeiro e simplifica as duas metades
            k = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
            s = rdp(pts[: k + 1], 4.0)[:-1] + rdp(pts[k:], 4.0)
            if len(s) >= 3:
                rr.append([[round(x, 1), round(z, 1)] for x, z in s])
        if rr:
            out.append({'n': name, 'r': rr})
    d['bairrosArea'] = out
    with open(path, 'w') as f:
        json.dump(d, f, separators=(',', ':'))
    print(path, len(out), 'bairros,', sum(len(r) for b in out for r in b['r']), 'pontos')
