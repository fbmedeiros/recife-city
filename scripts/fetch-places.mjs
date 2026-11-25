// Busca só os lugares (escolas, faculdades, museus, shoppings, restaurantes, bares, cafés, hospitais, bibliotecas,
// cinemas) e junta aos POIs do public/data/recife.json, com a mesma projeção. Consulta pequena: responde rápido.
// Uso: npm run places
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outFile = path.join(root, 'public/data/recife.json');
const data = JSON.parse(fs.readFileSync(outFile, 'utf8'));
const { bbox: B, lat0, lon0, mLat, mLon } = data.meta;
const b = `${B.s},${B.w},${B.n},${B.e}`;
const KINDS = 'school|college|university|restaurant|bar|cafe|pub|hospital|library|cinema|ice_cream|fast_food|museum|theatre|arts_centre';
const query = `[out:json][timeout:90];
(
  nwr["name"]["amenity"~"^(${KINDS})$"](${b});
  nwr["name"]["shop"="mall"](${b});
  nwr["name"]["tourism"="museum"](${b});
);
out center tags;`;

const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
let json;
for (const url of endpoints) {
  try {
    console.log('Baixando de', url);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'city-game-prototype/0.1' }, body: 'data=' + encodeURIComponent(query), signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    json = await res.json();
    break;
  } catch (err) { console.warn('Falhou:', err.message); }
}
if (!json) throw new Error('Nenhum servidor Overpass respondeu');

const r1 = (v) => Math.round(v * 10) / 10;
const have = new Set(data.pois.map((p) => p.name + '|' + Math.round(p.x / 30) + '|' + Math.round(p.z / 30)));
let added = 0;
for (const el of json.elements) {
  const t = el.tags || {}, c = el.center || el;
  if (c.lat == null) continue;
  const x = r1((c.lon - lon0) * mLon), z = r1(-(c.lat - lat0) * mLat);
  const kind = t.shop === 'mall' ? 'mall' : t.tourism === 'museum' ? 'museum' : t.amenity;
  const key = t.name + '|' + Math.round(x / 30) + '|' + Math.round(z / 30);
  if (have.has(key)) { const p = data.pois.find((q) => q.name === t.name && Math.abs(q.x - x) < 60 && Math.abs(q.z - z) < 60); if (p && !/^(attraction|information)$/.test(kind)) p.kind = p.kind === 'information' || p.kind === 'attraction' ? kind : p.kind; continue; }
  have.add(key);
  data.pois.push({ name: t.name, kind, x, z });
  added++;
}
fs.writeFileSync(outFile, JSON.stringify(data));
const count = {};
for (const p of data.pois) count[p.kind] = (count[p.kind] || 0) + 1;
console.log(`OK: +${added} lugares`, count);
