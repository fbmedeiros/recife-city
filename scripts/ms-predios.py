# Contornos reais de prédios (Microsoft Global ML Building Footprints, ODbL) que faltam no OSM.
# Uso: python3 -I scripts/ms-predios.py data/msbuildings/recife-211003132.csv.gz public/data/recife-full.json public/data/predios-ms.bin
# Saída: contornos em metros do jogo (0,1 m), só os que não encostam em prédio do OSM e ficam dentro do município
# (meta.limit). Sem altura: a base não traz altura no Brasil.
# .bin (o jogo lê este; 2,4 MB comprimido contra 4,3 MB do JSON), em little-endian:
#   'MSB1' | uint32 N (prédios) | uint32 P (pontos) | uint16 pontos_por_prédio[N] | (zeros até múltiplo de 4)
#   | int32 primeiro_ponto[2N] (x, z em decímetros) | int16 passo[2(P-N)] (diferença para o ponto anterior, decímetros)
# .json: {src, b: [[x0,z0,x1,z1,...], ...]} (formato antigo, legível)
# Só converter um .json antigo para .bin: python3 -I scripts/ms-predios.py --de-json predios-ms.json predios-ms.bin
import array, gzip, json, sys, math

def write_bin(out, path):
    cnt = array.array('H'); first = array.array('i'); step = array.array('h')
    for f in out:
        q = [round(v * 10) for v in f]
        cnt.append(len(q) // 2); first.extend(q[:2])
        for i in range(2, len(q), 2):
            dx, dz = q[i] - q[i - 2], q[i + 1] - q[i - 1]
            if max(abs(dx), abs(dz)) > 32767: raise SystemExit('lado de prédio com mais de 3,2 km: não cabe em int16')
            step.extend([dx, dz])
    head = b'MSB1' + array.array('I', [len(cnt), len(first) // 2 + len(step) // 2]).tobytes() + cnt.tobytes()
    head += b'\0' * (-len(head) % 4)
    if sys.byteorder != 'little':
        for a in (first, step): a.byteswap()
    open(path, 'wb').write(head + first.tobytes() + step.tobytes())

if sys.argv[1] == '--de-json':
    write_bin(json.load(open(sys.argv[2]))['b'], sys.argv[3]); raise SystemExit
d = json.load(open(sys.argv[2])); m = d['meta']
lat0, lon0, mLat, mLon = m['lat0'], m['lon0'], m['mLat'], m['mLon']
W, E, S, N = m['bbox']['w'], m['bbox']['e'], m['bbox']['s'], m['bbox']['n']
xmin = (W - lon0) * mLon; zmin = -(N - lat0) * mLat; xmax = (E - lon0) * mLon; zmax = -(S - lat0) * mLat
C = 2.0; GW = math.ceil((xmax - xmin) / C); GH = math.ceil((zmax - zmin) / C)
occ = bytearray(GW * GH)
def fill(ring, grid, v=1, cell=C, w=GW, h=GH):
    zs = [p[1] for p in ring]; r0 = max(0, int((min(zs) - zmin) / cell)); r1 = min(h - 1, int((max(zs) - zmin) / cell))
    for r in range(r0, r1 + 1):
        z = zmin + (r + .5) * cell; xs = []
        n = len(ring)
        for i in range(n):
            ax, az = ring[i]; bx, bz = ring[i - 1]
            if (az > z) != (bz > z): xs.append(ax + (z - az) * (bx - ax) / (bz - az))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            for c in range(max(0, math.ceil((xs[k] - xmin) / cell - .5)), min(w - 1, int((xs[k + 1] - xmin) / cell - .5)) + 1): grid[r * w + c] = v
for b in d['buildings']: fill(b['p'], occ)
# município: rasterizado a 8 m
L = 8.0; LW = math.ceil((xmax - xmin) / L); LH = math.ceil((zmax - zmin) / L); lim = bytearray(LW * LH)
if m.get('limit'):
    for ring in m['limit']:
        tmp = bytearray(LW * LH); fill(ring, tmp, 1, L, LW, LH)
        for i, v in enumerate(tmp):
            if v: lim[i] ^= 1
else: lim = bytearray([1]) * (LW * LH)
out = []; tot = 0; skip_osm = 0
for line in gzip.open(sys.argv[1], 'rt'):
    i = line.find('[[['); j = line.find(']]]', i)
    pts = [tuple(map(float, s.strip('[] ').split(','))) for s in line[i + 3:j].split('], [')]
    if not (W <= pts[0][0] <= E and S <= pts[0][1] <= N): continue
    g = [((lo - lon0) * mLon, -(la - lat0) * mLat) for lo, la in pts]
    if g[0] == g[-1]: g = g[:-1]
    if len(g) < 3: continue
    A = abs(sum(g[k][0] * g[(k + 1) % len(g)][1] - g[(k + 1) % len(g)][0] * g[k][1] for k in range(len(g)))) / 2
    if A < 20: continue
    cx = sum(p[0] for p in g) / len(g); cz = sum(p[1] for p in g) / len(g)
    li = int((cz - zmin) / L) * LW + int((cx - xmin) / L)
    if not (0 <= li < len(lim)) or not lim[li]: continue
    tot += 1
    # encosta em prédio do OSM? (centro e vértices puxados 1 m para dentro)
    hit = False
    for (x, z) in [(cx, cz)] + [(x + (cx - x) * min(1, 1 / max(1e-6, math.hypot(cx - x, cz - z))), z + (cz - z) * min(1, 1 / max(1e-6, math.hypot(cx - x, cz - z)))) for x, z in g]:
        c = int((x - xmin) / C); r = int((z - zmin) / C)
        if 0 <= c < GW and 0 <= r < GH and occ[r * GW + c]: hit = True; break
    if hit: skip_osm += 1; continue
    flat = []
    for x, z in g: flat += [round(x, 1), round(z, 1)]
    out.append(flat)
if sys.argv[3].endswith('.bin'): write_bin(out, sys.argv[3])
else: json.dump({'src': 'Microsoft Global ML Building Footprints 2026-02 (ODbL)', 'b': out}, open(sys.argv[3], 'w'), separators=(',', ':'))
print('no município', tot, 'já no OSM', skip_osm, 'novos', len(out))
