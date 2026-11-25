// Baixa os dados do OpenStreetMap do centro do Recife e gera public/data/recife.json
// Uso: npm run data   (passe --cache para reaproveitar data/raw.json)
import fs from 'node:fs';
import path from 'node:path';

// Do centro (Recife Antigo, Santo Antônio, São José, Boa Vista) até o Pina, Boa Viagem e o aeroporto
const AMENITY = /^(school|college|university|restaurant|bar|cafe|pub|hospital|library|cinema|ice_cream|fast_food)$/;
let BBOX = { s: -8.1450, w: -34.9350, n: -8.0500, e: -34.8640 };
let LAT0 = (BBOX.s + BBOX.n) / 2;
let LON0 = (BBOX.w + BBOX.e) / 2;
let M_LAT = 110574;
let M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);

// --norte=-8.028: baixa só a faixa entre o limite norte atual e essa latitude, com a MESMA projeção,
// e junta ao recife.json existente (o que já estava no mapa é ignorado)
const northArg = process.argv.find((a) => a.startsWith('--norte='));
let EXTEND = null;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// --recife: amplia o mapa para o município inteiro do Recife, com a MESMA projeção do recife.json atual (as posições
// postas à mão continuam valendo). Baixa o retângulo do município em pedaços, ignora o que já estava no mapa e só
// aceita o que fica dentro do limite oficial do Recife (OSM, admin_level 8). Gera public/data/recife-full.json.
const recifeArg = process.argv.includes('--recife');
const rawFile = path.join(root, 'data', northArg ? 'raw-norte.json' : recifeArg ? 'raw-recife.json' : 'raw.json');
const outFile = path.join(root, 'public', 'data', 'recife.json');
const fullFile = path.join(root, 'public', 'data', 'recife-full.json');
if (northArg) {
  const old = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  const m = old.meta;
  EXTEND = { old, oldN: m.bbox.n, newN: parseFloat(northArg.split('=')[1]) };
  ({ lat0: LAT0, lon0: LON0, mLat: M_LAT, mLon: M_LON } = m);
  BBOX = { ...m.bbox, s: m.bbox.n, n: EXTEND.newN };
}

let LIMIT = null; // anéis do limite do município (lat/lon)
if (recifeArg) {
  const old = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  const m = old.meta;
  ({ lat0: LAT0, lon0: LON0, mLat: M_LAT, mLon: M_LON } = m);
  LIMIT = await recifeLimit();
  let s = 90, n = -90, w = 180, e = -180;
  for (const r of LIMIT) for (const [lat, lon] of r) { s = Math.min(s, lat); n = Math.max(n, lat); w = Math.min(w, lon); e = Math.max(e, lon); }
  BBOX = { s: Math.min(s - 0.003, m.bbox.s), w: Math.min(w - 0.003, m.bbox.w), n: Math.max(n + 0.003, m.bbox.n), e: Math.max(e + 0.003, m.bbox.e) };
  EXTEND = { old, box: m.bbox };
  console.log('Município do Recife:', BBOX);
}
async function recifeLimit() {
  const f = path.join(root, 'data', 'recife-limite.json');
  let j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  if (!j) j = await overpass('[out:json][timeout:120];relation["boundary"="administrative"]["admin_level"="8"]["name"="Recife"](-8.20,-35.10,-7.85,-34.80);out geom;', 200000), fs.writeFileSync(f, JSON.stringify(j));
  const rel = j.elements.find((x) => x.type === 'relation');
  const outers = rel.members.filter((mm) => mm.type === 'way' && mm.role === 'outer' && mm.geometry).map((mm) => mm.geometry.map((p) => [p.lat, p.lon]));
  // costura os pedaços do contorno
  const key = (p) => p[0] + ',' + p[1], rings = [], pend = outers.slice();
  while (pend.length) { let cur = pend.shift(), ch = true; while (ch) { ch = false; for (let i = 0; i < pend.length; i++) { const l = pend[i]; if (key(l[0]) === key(cur.at(-1))) cur = cur.concat(l.slice(1)); else if (key(l.at(-1)) === key(cur.at(-1))) cur = cur.concat(l.slice().reverse().slice(1)); else continue; pend.splice(i, 1); ch = true; break; } } rings.push(cur); }
  return rings;
}
const inLimit = (lat, lon) => { if (!LIMIT) return true; let c = false; for (const r of LIMIT) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [ay, ax] = r[i], [by, bx] = r[j]; if ((ay > lat) !== (by > lat) && lon < ((bx - ax) * (lat - ay)) / (by - ay) + ax) c = !c; } return c; };
async function overpass(q, timeout = 600000) {
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  for (let round = 0; round < 6; round++) for (const url of endpoints) {
    try {
      console.log('Baixando de', url);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'city-game-prototype/0.1' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) { console.warn('Falhou:', err.message); await new Promise((r) => setTimeout(r, 8000 + round * 7000)); }
  }
  throw new Error('Nenhum servidor Overpass respondeu');
}

const queryFor = (b) => `[out:json][timeout:600][maxsize:1073741824];
(
  way["highway"](${b});
  way["building"](${b});
  relation["building"](${b});
  way["natural"~"^(water|coastline|reef|beach|sand|wood|scrub)$"](${b});
  relation["natural"="water"](${b});
  way["waterway"="riverbank"](${b});
  relation["waterway"="riverbank"](${b});
  way["leisure"~"^(park|garden|pitch|playground)$"](${b});
  way["landuse"~"^(grass|recreation_ground|village_green)$"](${b});
  way["place"="square"](${b});
  way["man_made"~"^(breakwater|pier|groyne|quay)$"](${b});
  way["railway"~"^(rail|subway|light_rail|tram)$"](${b});
  node["name"]["tourism"](${b});
  node["name"]["historic"](${b});
  node["name"]["amenity"~"^(place_of_worship|theatre|marketplace|townhall|museum|arts_centre)$"](${b});
  way["name"]["tourism"](${b});
  way["name"]["historic"](${b});
  way["aeroway"~"^(runway|taxiway|apron)$"](${b});
  node["place"~"^(suburb|neighbourhood|quarter)$"](${b});
  way["name"]["shop"="mall"](${b});
  node["name"]["amenity"~"^(school|college|university|restaurant|bar|cafe|pub|hospital|library|cinema|ice_cream|fast_food)$"](${b});
  way["name"]["amenity"~"^(school|college|university|hospital|library|cinema|restaurant)$"](${b});
  node["name"]["shop"="mall"](${b});
);
out geom;`;
const b = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
const query = queryFor(b);

async function download() {
  if (process.argv.includes('--cache') && fs.existsSync(rawFile)) {
    return JSON.parse(fs.readFileSync(rawFile, 'utf8'));
  }
  if (recifeArg) {
    // em pedaços de ~0,04° (uns 4,5 km), guardando cada pedaço pronto (se cair no meio, recomeça de onde parou)
    const tiles = [], step = 0.02, all = new Map();
    for (let la = BBOX.s; la < BBOX.n; la += step) for (let lo = BBOX.w; lo < BBOX.e; lo += step) tiles.push([la, lo, Math.min(la + step, BBOX.n), Math.min(lo + step, BBOX.e)]);
    const dir = path.join(root, 'data', 'tiles2'); fs.mkdirSync(dir, { recursive: true });
    for (const [i, [s2, w2, n2, e2]] of tiles.entries()) {
      // pedaço todo dentro do mapa antigo: pula
      const ob = EXTEND.box; if (s2 >= ob.s && n2 <= ob.n && w2 >= ob.w && e2 <= ob.e) continue;
      const f = path.join(dir, `t${i}.json`);
      let j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
      if (!j) { console.log(`Pedaço ${i + 1}/${tiles.length}`); j = await overpass(queryFor(`${s2},${w2},${n2},${e2}`)); fs.writeFileSync(f, JSON.stringify(j)); }
      for (const el of j.elements) all.set(el.type + el.id, el);
    }
    return { elements: [...all.values()] };
  }
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  for (const url of endpoints) {
    try {
      console.log('Baixando de', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'city-game-prototype/0.1' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(240000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      fs.mkdirSync(path.dirname(rawFile), { recursive: true });
      fs.writeFileSync(rawFile, JSON.stringify(json));
      return json;
    } catch (err) {
      console.warn('Falhou:', err.message);
    }
  }
  throw new Error('Nenhum servidor Overpass respondeu');
}

const r1 = (v) => Math.round(v * 10) / 10;
const proj = (p) => [r1((p.lon - LON0) * M_LON), r1(-(p.lat - LAT0) * M_LAT)];
const projLine = (geom) => geom.filter(Boolean).map(proj);

// junta pedaços de anéis (membros de relações) pelas pontas
function stitch(lines) {
  const key = (p) => p[0] + ',' + p[1];
  const pending = lines.map((l) => l.slice());
  const rings = [];
  while (pending.length) {
    let cur = pending.shift();
    let changed = true;
    while (changed && key(cur[0]) !== key(cur[cur.length - 1])) {
      changed = false;
      for (let i = 0; i < pending.length; i++) {
        const l = pending[i];
        const end = key(cur[cur.length - 1]);
        if (key(l[0]) === end) cur = cur.concat(l.slice(1));
        else if (key(l[l.length - 1]) === end) cur = cur.concat(l.slice().reverse().slice(1));
        else if (key(l[l.length - 1]) === key(cur[0])) cur = l.concat(cur.slice(1));
        else if (key(l[0]) === key(cur[0])) cur = l.slice().reverse().concat(cur.slice(1));
        else continue;
        pending.splice(i, 1);
        changed = true;
        break;
      }
    }
    if (cur.length >= 4) rings.push(cur);
  }
  return rings;
}

function ringsOf(el) {
  if (el.type === 'way') return el.geometry ? [projLine(el.geometry)] : [];
  if (el.type === 'relation') {
    const outers = (el.members || []).filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry);
    return stitch(outers.map((m) => projLine(m.geometry)));
  }
  return [];
}

function heightOf(t) {
  const num = (v) => {
    const f = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(f) ? f : null;
  };
  if (t.height && num(t.height)) return num(t.height);
  if (t['building:levels'] && num(t['building:levels'])) return num(t['building:levels']) * 3.2 + 1;
  return null;
}

const DRIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'living_street', 'service']);
const FOOT = new Set(['pedestrian', 'footway', 'path', 'steps', 'cycleway', 'track']);

const data = await download();
const out = {
  meta: { bbox: BBOX, lat0: LAT0, lon0: LON0, mLat: M_LAT, mLon: M_LON, source: '© OpenStreetMap contributors (ODbL)' },
  roads: [], buildings: [], bairros: [], aeroway: [], water: [], coastline: [], parks: [], reefs: [], piers: [], rail: [], pois: [],
};
const seen = new Set();

// no modo faixa: tudo que tem algum ponto dentro do mapa antigo já foi baixado antes
const touchesOld = (el) => {
  if (!EXTEND) return false;
  const pts = el.type === 'node' ? [el] : el.geometry || (el.members || []).flatMap((mm) => mm.geometry || []);
  if (EXTEND.box) { const B = EXTEND.box; if (pts.some((p) => p && p.lat >= B.s && p.lat <= B.n && p.lon >= B.w && p.lon <= B.e)) return true; return !pts.some((p) => p && inLimit(p.lat, p.lon)); }
  return pts.some((p) => p && p.lat < EXTEND.oldN);
};
for (const el of data.elements) {
  const id = el.type + el.id;
  if (seen.has(id)) continue;
  seen.add(id);
  if (touchesOld(el)) continue;
  const t = el.tags || {};

  if (el.type === 'node') {
    const [x, z] = proj(el);
    if (t.place) { out.bairros.push({ name: t.name, x, z }); continue; }
    out.pois.push({ name: t.name, kind: t.tourism || t.historic || t.amenity || (t.shop === 'mall' ? 'mall' : 'place'), x, z });
    continue;
  }

  if (t.building && t.building !== 'no' && !t['building:part']) {
    for (const ring of ringsOf(el)) {
      if (ring.length < 4) continue;
      out.buildings.push({ p: ring, h: heightOf(t), n: t.name || undefined, t: t.building, c: t['building:colour'] || undefined });
    }
    if (t.name && (t.tourism || t.historic || t.shop === 'mall' || AMENITY.test(t.amenity || ''))) {
      const ring = ringsOf(el)[0];
      if (ring) {
        const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
        const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
        out.pois.push({ name: t.name, kind: t.tourism || t.historic || (t.shop === 'mall' ? 'mall' : t.amenity), x: r1(cx), z: r1(cz) });
      }
    }
    continue;
  }

  if (t.highway && el.type === 'way' && el.geometry) {
    const kind = t.highway;
    if (!DRIVE.has(kind) && !FOOT.has(kind)) continue;
    if (t.area === 'yes') {
      out.parks.push({ p: projLine(el.geometry), k: 'plaza' });
      continue;
    }
    out.roads.push({
      k: kind, n: t.name || undefined, p: projLine(el.geometry),
      b: t.bridge && t.bridge !== 'no' ? 1 : undefined,
      tu: t.tunnel && t.tunnel !== 'no' ? 1 : undefined,
      o: t.oneway === 'yes' || t.junction === 'roundabout' ? 1 : t.oneway === '-1' ? -1 : undefined,
      l: t.lanes ? parseInt(t.lanes, 10) || undefined : undefined,
      d: DRIVE.has(kind) && t.access !== 'no' && t.motor_vehicle !== 'no' ? 1 : undefined,
    });
    continue;
  }

  if (t.aeroway && el.geometry) {
    out.aeroway.push({ k: t.aeroway, p: projLine(el.geometry), w: parseFloat(t.width) || (t.aeroway === 'runway' ? 45 : 23) });
    continue;
  }
  if (t.natural === 'coastline' && el.geometry) { out.coastline.push(projLine(el.geometry)); continue; }
  if (t.natural === 'water' || t.waterway === 'riverbank') { out.water.push(...ringsOf(el)); continue; }
  if (t.natural === 'reef') { out.reefs.push(...ringsOf(el)); continue; }
  if (t.man_made && el.geometry) {
    out.piers.push({ p: projLine(el.geometry), k: t.man_made, closed: el.geometry.length > 3 && el.geometry[0].lat === el.geometry.at(-1).lat && el.geometry[0].lon === el.geometry.at(-1).lon });
    continue;
  }
  if (t.railway && el.geometry) { out.rail.push(projLine(el.geometry)); continue; }
  if (t.leisure || t.landuse || t.place === 'square' || ['wood', 'scrub', 'beach', 'sand'].includes(t.natural)) {
    const k = t.natural === 'beach' || t.natural === 'sand' ? 'sand' : t.place === 'square' ? 'plaza' : 'green';
    for (const ring of ringsOf(el)) out.parks.push({ p: ring, k });
    if (t.name && t.leisure === 'park') {
      const ring = ringsOf(el)[0];
      if (ring) out.pois.push({ name: t.name, kind: 'park', x: r1(ring.reduce((s, p) => s + p[0], 0) / ring.length), z: r1(ring.reduce((s, p) => s + p[1], 0) / ring.length) });
    }
    continue;
  }
  if (t.name && (t.tourism || t.historic || t.shop === 'mall' || AMENITY.test(t.amenity || '')) && el.geometry) {
    const ring = projLine(el.geometry);
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    out.pois.push({ name: t.name, kind: t.tourism || t.historic || (t.shop === 'mall' ? 'mall' : t.amenity), x: r1(cx), z: r1(cz) });
  }
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
if (EXTEND && EXTEND.box) {
  const o = EXTEND.old;
  for (const k of Object.keys(out)) if (Array.isArray(out[k])) o[k] = (o[k] || []).concat(out[k]);
  o.meta.bbox = BBOX;
  // bairros oficiais sem ponto de bairro no OSM (posição pela busca de endereço)
  for (const [name, lat, lon] of [['Cohab', -8.1243, -34.9487]]) if (!o.bairros.some((b) => b.name === name)) o.bairros.push({ name, x: r1((lon - LON0) * M_LON), z: r1(-(lat - LAT0) * M_LAT) });
  o.meta.limit = LIMIT.map((r) => r.map(([lat, lon]) => [r1((lon - LON0) * M_LON), r1(-(lat - LAT0) * M_LAT)])); // contorno do município, em metros
  fs.writeFileSync(fullFile, JSON.stringify(o));
  console.log(`Recife inteiro: +${out.buildings.length} prédios, +${out.roads.length} vias, +${out.pois.length} POIs, +${out.bairros.length} bairros, +${out.parks.length} praças, +${out.water.length} água → ${Math.round(fs.statSync(fullFile).size / 1024)} KB`);
  process.exit(0);
}
if (EXTEND) {
  const o = EXTEND.old;
  for (const k of Object.keys(out)) if (Array.isArray(out[k])) o[k] = (o[k] || []).concat(out[k]);
  o.meta.bbox = { ...o.meta.bbox, n: EXTEND.newN };
  fs.writeFileSync(outFile, JSON.stringify(o));
  console.log(`Faixa norte: +${out.buildings.length} prédios, +${out.roads.length} vias, +${out.pois.length} POIs, +${out.parks.length} praças, +${out.water.length} água`);
  process.exit(0);
}
fs.writeFileSync(outFile, JSON.stringify(out));
const kb = Math.round(fs.statSync(outFile).size / 1024);
console.log(`OK: ${out.bairros.length} bairros, ${out.aeroway.length} aeroporto, ${out.roads.length} vias, ${out.buildings.length} prédios, ${out.water.length} água, ${out.coastline.length} costa, ${out.parks.length} praças/parques, ${out.reefs.length} arrecifes, ${out.piers.length} molhes, ${out.pois.length} POIs → ${kb} KB`);
