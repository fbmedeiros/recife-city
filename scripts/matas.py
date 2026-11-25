"""Matas do Recife (natural=wood/scrub, landuse=forest), inclusive as grandes desenhadas como relação (Refúgio Mata
São João da Várzea, Dois Irmãos, Mata do Engenho Uchôa…), que o pbf-para-overpass.py não trazia.

Uso: python3 scripts/matas.py nordeste.osm.pbf public/data/recife-full.json [public/data/recife.json …]
Grava em cada mapa a lista `matas` (anéis externos em metros do jogo, na projeção do próprio mapa, com 1 casa decimal)
e põe os anéis também em `parks` como 'green' (o chão fica verde). Rodar de novo substitui as matas antigas.
Precisa do pyosmium (pip install osmium).
"""
import json
import sys

import osmium

src, maps = sys.argv[1], sys.argv[2:]
S, W, N, E = -8.17, -35.03, -7.92, -34.84  # retângulo do município com folga

rings = []
fp = osmium.FileProcessor(src).with_areas().with_filter(osmium.filter.KeyFilter('natural', 'landuse'))
for o in fp:
    if not o.is_area():
        continue
    t = o.tags
    if not (t.get('natural') in ('wood', 'scrub') or t.get('landuse') == 'forest'):
        continue
    for ring in o.outer_rings():
        pts = [(n.lat, n.lon) for n in ring]
        if not any(S <= la <= N and W <= lo <= E for la, lo in pts):
            continue
        rings.append({'pts': pts, 'n': t.get('name'), 'k': t.get('natural') or 'forest'})
print(len(rings), 'anéis de mata no retângulo')

for path in maps:
    with open(path) as f:
        d = json.load(f)
    m = d['meta']
    bb = None  # meta.bbox fica em graus; aqui vale o retângulo das ruas
    out = []
    for r in rings:
        p = [[round((lo - m['lon0']) * m['mLon'], 1), round(-(la - m['lat0']) * m['mLat'], 1)] for la, lo in r['pts']]
        xs = [q[0] for q in p]; zs = [q[1] for q in p]
        # só o que encosta na área do mapa (a grade de colisão cobre as ruas com 50 m de folga)
        if bb is None:
            rx = [q[0] for rr in d['roads'] for q in rr['p']]; rz = [q[1] for rr in d['roads'] for q in rr['p']]
            bb = [min(rx), min(rz), max(rx), max(rz)]
        if max(xs) < bb[0] or min(xs) > bb[2] or max(zs) < bb[1] or min(zs) > bb[3]:
            continue
        area = 0.5 * abs(sum(p[i][0] * p[i - 1][1] - p[i - 1][0] * p[i][1] for i in range(len(p))))
        if area < 400:
            continue
        out.append({'p': p, 'n': r['n'], 'a': round(area)})
    old = {json.dumps(x['p']) for x in d.get('matas', [])}
    d['parks'] = [pk for pk in d['parks'] if not (pk.get('mata') or json.dumps(pk['p']) in old)]
    d['matas'] = out
    for x in out:
        d['parks'].append({'p': x['p'], 'k': 'green', 'mata': 1})
    with open(path, 'w') as f:
        json.dump(d, f, separators=(',', ':'))
    print(path, len(out), 'matas,', round(sum(x['a'] for x in out) / 1e4), 'ha')
