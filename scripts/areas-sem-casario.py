"""Áreas onde o casario gerado não entra: estacionamentos, aeroporto, porto, indústria, comércio, ferrovia, quartel,
cemitério, obra. A cobertura do solo (WorldCover) chama asfalto e pátio de "construído"; sem isto, o gerador enchia de
casas o estacionamento do aeroporto e de shoppings.

Uso: python3 scripts/areas-sem-casario.py nordeste.osm.pbf public/data/recife-full.json [public/data/recife.json …]
Grava `semCasario` (anéis externos em metros do jogo) em cada mapa. Precisa do pyosmium.
"""
import json
import sys

import osmium

src, maps = sys.argv[1], sys.argv[2:]
S, W, N, E = -8.17, -35.03, -7.92, -34.84
LANDUSE = {'industrial', 'commercial', 'retail', 'railway', 'military', 'cemetery', 'construction', 'port', 'depot', 'garages', 'landfill', 'brownfield'}
rings = []
fp = osmium.FileProcessor(src).with_areas().with_filter(osmium.filter.KeyFilter('landuse', 'amenity', 'aeroway', 'industrial'))
for o in fp:
    if not o.is_area():
        continue
    t = o.tags
    ok = t.get('landuse') in LANDUSE or t.get('amenity') in ('parking', 'bus_station', 'fuel') or t.get('aeroway') in ('aerodrome', 'apron', 'terminal') or 'industrial' in t
    if not ok:
        continue
    for ring in o.outer_rings():
        pts = [(n.lat, n.lon) for n in ring]
        if any(S <= la <= N and W <= lo <= E for la, lo in pts):
            rings.append(pts)
print(len(rings), 'áreas no retângulo')
for path in maps:
    with open(path) as f:
        d = json.load(f)
    m = d['meta']
    d['semCasario'] = [[[round((lo - m['lon0']) * m['mLon'], 1), round(-(la - m['lat0']) * m['mLat'], 1)] for la, lo in r] for r in rings]
    with open(path, 'w') as f:
        json.dump(d, f, separators=(',', ':'))
    print(path, len(d['semCasario']), 'áreas sem casario')
