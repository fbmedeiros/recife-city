// Texturas fotográficas CC0 do Poly Haven (polyhaven.com), em public/textures. Créditos no README.
// Cada uma tem a cor (diff, sRGB) e o relevo (nor, padrão OpenGL). Se alguma falhar, entra uma textura neutra.
import * as THREE from 'three';
import { releaseOnUpload } from './textures.js';

export const PHOTOS = {
  asphalt: 'asphalt_02',
  pave: 'concrete_pavement',
  cobble: 'cobblestone_floor_08',
  grass: 'sparse_grass',
  sand: 'sand_01',
  stucco: 'white_stucco',
  clay: 'clay_roof_tiles_02',
  slab: 'concrete_floor_worn_001',
  bark: 'bark_brown_02',
};

function neutral(rgb) {
  const t = new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

// cor média (em linear) para a gente poder "tingir" a foto com a cor do lugar sem mudar o brilho
function average(img) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data, s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += Math.pow(d[i + k] / 255, 2.2);
    return new THREE.Vector3(s[0] / 256, s[1] / 256, s[2] / 256);
  } catch { return new THREE.Vector3(0.5, 0.5, 0.5); }
}

export async function loadPhotos(renderer, progress) {
  progress?.('Carregando as fotos de asfalto, calçada e telha…');
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const one = async (file, srgb) => {
    try {
      const t = await loader.loadAsync(`/textures/${file}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = aniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    } catch {
      console.warn('textura não carregou:', file);
      return null;
    }
  };
  const out = {};
  await Promise.all(Object.entries(PHOTOS).map(async ([key, name]) => {
    const [map, normal] = await Promise.all([one(`${name}_diff`, true), one(`${name}_nor`, false)]);
    out[key] = {
      map: map || neutral([128, 128, 128]),
      normal: normal || neutral([128, 128, 255]),
      avg: map ? average(map.image) : new THREE.Vector3(0.22, 0.22, 0.22),
    };
    if (map) releaseOnUpload(map);
    if (normal) releaseOnUpload(normal);
  }));
  return out;
}

// GLSL comum: base tangente pelas derivadas (serve para qualquer superfície e qualquer uv)
export const TBN_GLSL = `
mat3 fTBN(vec3 p, vec3 N, vec2 uv) {
  vec3 q0 = dFdx(p), q1 = dFdy(p); vec2 s0 = dFdx(uv), s1 = dFdy(uv);
  vec3 q1p = cross(q1, N), q0p = cross(N, q0);
  vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
  float d = max(dot(T, T), dot(B, B)); float k = d == 0.0 ? 0.0 : inversesqrt(d);
  return mat3(T * k, B * k, N);
}
vec3 nrm(sampler2D t, vec2 uv) { return texture2D(t, uv).xyz * 2.0 - 1.0; }
`;
