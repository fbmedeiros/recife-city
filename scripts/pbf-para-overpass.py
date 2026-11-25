"""Converte um recorte de um arquivo .osm.pbf (Geofabrik) no mesmo JSON que a consulta Overpass do
fetch-osm.mjs devolve ("out geom"), para usar com: node scripts/fetch-osm.mjs --recife --cache

Uso: python3 scripts/pbf-para-overpass.py nordeste.osm.pbf data/raw-recife.json S W N E
Precisa do pyosmium (pip install osmium). Pega só o que a consulta pedia: vias, prédios, água, costa, praças,
parques, molhes, trilhos, aeroporto, bairros e lugares com nome.
"""
import json
import re
import sys

import osmium

src, out, S, W, N, E = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:7])
inbox = lambda lat, lon: S <= lat <= N and W <= lon <= E

NAT = {'water', 'coastline', 'reef', 'beach', 'sand', 'wood', 'scrub'}
LEIS = {'park', 'garden', 'pitch', 'playground'}
LAND = {'grass', 'recreation_ground', 'village_green'}
MAN = {'breakwater', 'pier', 'groyne', 'quay'}
RAIL = {'rail', 'subway', 'light_rail', 'tram'}
AERO = {'runway', 'taxiway', 'apron'}
PLACE = {'suburb', 'neighbourhood', 'quarter'}
AM_NODE1 = re.compile(r'^(place_of_worship|theatre|marketplace|townhall|museum|arts_centre)$')
AM_NODE2 = re.compile(r'^(school|college|university|restaurant|bar|cafe|pub|hospital|library|cinema|ice_cream|fast_food)$')
AM_WAY = re.compile(r'^(school|college|university|hospital|library|cinema|restaurant)$')


def want_node(t):
    n = 'name' in t
    if t.get('place') in PLACE:
        return True
    if not n:
        return False
    return 'tourism' in t or 'historic' in t or bool(AM_NODE1.match(t.get('amenity', ''))) or bool(AM_NODE2.match(t.get('amenity', ''))) or t.get('shop') == 'mall'


def want_way(t):
    n = 'name' in t
    return ('highway' in t or 'building' in t or t.get('natural') in NAT or t.get('waterway') == 'riverbank'
            or t.get('leisure') in LEIS or t.get('landuse') in LAND or t.get('place') == 'square'
            or t.get('man_made') in MAN or t.get('railway') in RAIL or t.get('aeroway') in AERO
            or (n and ('tourism' in t or 'historic' in t or t.get('shop') == 'mall' or bool(AM_WAY.match(t.get('amenity', ''))))))


def want_rel(t):
    return 'building' in t or t.get('natural') == 'water' or t.get('waterway') == 'riverbank'


KEYS = ('highway', 'building', 'natural', 'waterway', 'leisure', 'landuse', 'place', 'man_made', 'railway', 'tourism',
        'historic', 'amenity', 'aeroway', 'shop')
els = []
n_seen = 0
fp = osmium.FileProcessor(src).with_locations().with_areas().with_filter(osmium.filter.KeyFilter(*KEYS))
for o in fp:
    n_seen += 1
    if o.is_node():
        t = dict(o.tags)
        if not o.location.valid() or not inbox(o.location.lat, o.location.lon) or not want_node(t):
            continue
        els.append({'type': 'node', 'id': o.id, 'lat': o.location.lat, 'lon': o.location.lon, 'tags': t})
    elif o.is_way():
        t = dict(o.tags)
        if not want_way(t):
            continue
        try:
            g = [{'lat': nd.location.lat, 'lon': nd.location.lon} for nd in o.nodes]
        except osmium.InvalidLocationError:
            continue
        if not any(inbox(p['lat'], p['lon']) for p in g):
            continue
        els.append({'type': 'way', 'id': o.id, 'tags': t, 'geometry': g})
    elif o.is_area() and not o.from_way():
        t = dict(o.tags)
        if not want_rel(t):
            continue
        members = []
        for ring in o.outer_rings():
            g = [{'lat': nd.location.lat, 'lon': nd.location.lon} for nd in ring]
            members.append({'type': 'way', 'role': 'outer', 'geometry': g})
        if not any(inbox(p['lat'], p['lon']) for m in members for p in m['geometry']):
            continue
        els.append({'type': 'relation', 'id': o.orig_id(), 'tags': t, 'members': members})

with open(out, 'w') as f:
    json.dump({'elements': els}, f)
print(f'{len(els)} elementos no recorte (de {n_seen} lidos com as chaves de interesse) -> {out}')
