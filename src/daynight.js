import * as THREE from 'three';

// Recife: 8° S. Em novembro a declinação do sol é ~ -19°, então ao meio-dia ele passa um pouco ao sul do zênite.
const LAT = THREE.MathUtils.degToRad(-8.06);
const DEC = THREE.MathUtils.degToRad(-19);
// o Recife fica a leste do meridiano do fuso: meio-dia solar ~11h20 (nasce ~5h, põe ~17h30)
const SOLAR_NOON = 11.35;
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Paleta por altura do sol (e = seno da elevação). Interpolada entre as chaves.
// zen/hor: céu no alto e no horizonte · glow: halo em volta do sol · belt: rosa do lado oposto no crepúsculo
// cl/cs: nuvem iluminada e sombra · sun/si: cor e força da luz direta · hemi/hi: luz ambiente
const KEYS = [
  { e: -0.30, zen: '#03071a', hor: '#0b1430', glow: '#1a1430', gs: 0.0, belt: '#1a1a3a', sun: '#8fa8ff', si: 0.0, hemi: '#4a5f9a', hi: 0.55, gnd: '#15131a', cl: '#1b2236', cs: '#0a0f1c', exp: 1.05, bloom: 0.8, cover: 0.52 },
  { e: -0.10, zen: '#101a48', hor: '#4e3260', glow: '#ff5a2e', gs: 0.35, belt: '#6b4a7e', sun: '#8fa8ff', si: 0.0, hemi: '#6a5f9a', hi: 0.6, gnd: '#2a2028', cl: '#6e3f63', cs: '#241d38', exp: 0.95, bloom: 0.85, cover: 0.5 },
  { e: -0.02, zen: '#233a7a', hor: '#ff6a3a', glow: '#ff4410', gs: 1.0, belt: '#c8789c', sun: '#ff6a2a', si: 0.9, hemi: '#e89a8a', hi: 0.7, gnd: '#5a3a3a', cl: '#ff8a4a', cs: '#6a3a64', exp: 0.78, bloom: 1.0, cover: 0.5 },
  { e: 0.05, zen: '#2f4f98', hor: '#ff9a4a', glow: '#ff6a1e', gs: 0.95, belt: '#e39aa6', sun: '#ff8a3e', si: 2.0, hemi: '#f0b49a', hi: 0.75, gnd: '#6a4a3a', cl: '#ffb070', cs: '#8a5070', exp: 0.7, bloom: 0.9, cover: 0.5 },
  { e: 0.15, zen: '#3a6cc0', hor: '#ffd29a', glow: '#ffa050', gs: 0.55, belt: '#e8c4c0', sun: '#ffbf7a', si: 2.7, hemi: '#d8cce6', hi: 0.8, gnd: '#8a7a60', cl: '#fff0dc', cs: '#b49aa0', exp: 0.64, bloom: 0.55, cover: 0.52 },
  { e: 0.40, zen: '#2c72d2', hor: '#b8d6ee', glow: '#fff2d6', gs: 0.25, belt: '#c8dcf0', sun: '#fff4e2', si: 3.0, hemi: '#bcd6ff', hi: 0.85, gnd: '#8a7a60', cl: '#ffffff', cs: '#c2ccd8', exp: 0.6, bloom: 0.3, cover: 0.54 },
].map((k) => Object.fromEntries(Object.entries(k).map(([key, v]) => [key, typeof v === 'string' ? new THREE.Color(v) : v])));

function palette(e, out) {
  let i = 0;
  while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((e - a.e) / (b.e - a.e), 0, 1);
  for (const k in a) {
    if (k === 'e') continue;
    if (a[k].isColor) (out[k] ||= new THREE.Color()).copy(a[k]).lerp(b[k], t);
    else out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out;
}

const DAY_START = 6, DAY_END = 17.1;
export class DayNight {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.hours = 16.5;          // começa no fim da tarde
    this.rate = 1 / 60;         // 1 hora de jogo = 1 minuto real
    this.night = 0;
    this.bloom = 0.4;
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3(0.35, 0.75, -0.25).normalize();
    this.lightDir = new THREE.Vector3();
    this.p = {};
    this.onNight = [];          // callbacks(nightFactor) para janelas, postes, faróis…

    this.skyMat = skyMaterial();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3200, 48, 24), this.skyMat);
    this.sky.renderOrder = -2;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.envScene = new THREE.Scene();
    // o céu usado para iluminar e refletir: mesmas cores, porém menos saturado e com "chão" quente embaixo,
    // senão as sombras ficam azul-marinho
    const envMat = skyMaterial();
    envMat.uniforms = { ...this.skyMat.uniforms, envMode: { value: 1 } };
    this.envScene.add(new THREE.Mesh(this.sky.geometry, envMat));
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.lastEnvDir = new THREE.Vector3(0, -2, 0);

    this.clouds = makeClouds();
    scene.add(this.clouds);

    scene.fog = new THREE.Fog('#e3cdb4', 220, 1250);
    this.hemi = new THREE.HemisphereLight('#bcd6ff', '#8a7a60', 0.8);
    this.sun = new THREE.DirectionalLight('#ffd9ae', 2.8);
    const s = this.sun;
    s.castShadow = true;
    // sombra mais nítida no computador (4096); no celular fica 2048
    const touch = document.body.classList.contains('touch');
    s.shadow.mapSize.set(touch ? 2048 : 4096, touch ? 2048 : 4096);
    Object.assign(s.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 1, far: 800 });
    s.shadow.bias = -0.0003; s.shadow.normalBias = 0.3; s.shadow.radius = 3;
    scene.add(this.hemi, s, s.target);

    this.stars = makeStars();
    scene.add(this.stars);
    this.time = 0;
    this.update(0, new THREE.Vector3(), new THREE.Vector3());
  }

  get clock() {
    const h = Math.floor(this.hours) % 24, m = Math.floor((this.hours % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // só dia e tarde: o relógio vai das 6h até pouco antes do pôr do sol e volta pro amanhecer (sem noite)
  wrap(h) { const A = DAY_START, B = DAY_END; return A + ((((h - A) % (B - A)) + (B - A)) % (B - A)); }
  skip(h) { this.hours = this.wrap(this.hours + h); }

  update(dt, focus, camPos) {
    this.time += dt;
    this.hours = this.wrap(this.hours + dt * this.rate);
    const H = ((this.hours - SOLAR_NOON) / 24) * Math.PI * 2;
    const east = -Math.cos(DEC) * Math.sin(H);
    const up = Math.sin(LAT) * Math.sin(DEC) + Math.cos(LAT) * Math.cos(DEC) * Math.cos(H);
    const north = Math.cos(LAT) * Math.sin(DEC) - Math.sin(LAT) * Math.cos(DEC) * Math.cos(H);
    this.sunDir.set(east, up, -north).normalize();
    const p = palette(up, this.p);
    const n = (this.night = smooth(0.04, -0.14, up));

    // céu
    const u = this.skyMat.uniforms;
    u.sunDir.value.copy(this.sunDir);
    u.moonDir.value.copy(this.moonDir);
    u.zen.value.copy(p.zen); u.hor.value.copy(p.hor); u.glowCol.value.copy(p.glow); u.belt.value.copy(p.belt);
    u.glowStr.value = p.gs;
    u.sunCol.value.copy(p.sun);
    u.sunVis.value = smooth(-0.03, 0.01, up);
    u.moonVis.value = n;
    this.sky.position.copy(camPos);

    // nuvens (andam devagar com o vento alísio, de sudeste)
    const cu = this.clouds.material.uniforms;
    cu.sunDir.value.copy(this.sunDir.y > -0.05 ? this.sunDir : this.moonDir);
    cu.lit.value.copy(p.cl); cu.shade.value.copy(p.cs);
    cu.cover.value = p.cover;
    cu.wind.value.set(this.time * -0.0012, this.time * 0.0018);
    cu.fogCol.value.copy(p.hor);
    this.clouds.position.set(camPos.x, camPos.y + 650, camPos.z);
    cu.offset.value.set(camPos.x / 9000, camPos.z / 9000);

    this.renderer.toneMappingExposure = p.exp;
    this.bloom = p.bloom;

    // luz direta: sol (ou lua azulada de noite)
    if (up > -0.03) {
      this.lightDir.copy(this.sunDir);
      if (this.lightDir.y < 0.06) this.lightDir.y = 0.06;
      this.sun.color.copy(p.sun);
      this.sun.intensity = p.si;
    } else {
      this.lightDir.copy(this.moonDir);
      this.sun.color.set('#8fa8ff');
      this.sun.intensity = 0.7 * n;
    }
    this.lightDir.normalize();
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 400);
    this.sun.target.position.copy(focus);

    this.hemi.color.copy(p.hemi);
    this.hemi.groundColor.copy(p.gnd);
    this.hemi.intensity = p.hi * 0.7; // o céu refletido (environment) já ilumina as sombras

    // neblina na cor do horizonte, puxando um pouco do brilho do sol
    this.scene.fog.color.copy(p.hor).lerp(p.glow, p.gs * 0.18);
    this.scene.fog.far = 1250 - n * 300;
    this.scene.environmentIntensity = 0.55 - n * 0.42;

    this.stars.material.opacity = smooth(0.4, 0.95, n);
    this.stars.position.copy(camPos);

    // reflexos: refaz o mapa de ambiente quando o sol anda uns 2°
    if (this.lastEnvDir.angleTo(this.sunDir) > 0.035) {
      this.lastEnvDir.copy(this.sunDir);
      const old = this.scene.environment;
      this.scene.environment = this.pmrem.fromScene(this.envScene, 0, 1, 5000).texture; // far > raio do céu (3200)
      old?.dispose();
    }
    for (const f of this.onNight) f(n);
  }
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, moonDir: { value: new THREE.Vector3(0, 1, 0) },
      zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, glowCol: { value: new THREE.Color() },
      belt: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() },
      glowStr: { value: 0 }, sunVis: { value: 1 }, moonVis: { value: 0 }, envMode: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 sunDir, moonDir, zen, hor, glowCol, belt, sunCol;
      uniform float glowStr, sunVis, moonVis, envMode;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.42));
        if (h < 0.0) col = mix(hor, hor * 0.6, clamp(-h * 5.0, 0.0, 1.0));
        float sd = dot(d, sunDir);
        float s = max(sd, 0.0);
        float band = exp(-abs(h) * 5.0);
        // halo largo rente ao horizonte + brilho em volta do sol
        col += glowCol * glowStr * (pow(s, 3.0) * 0.6 * band + pow(s, 24.0) * 0.8 + pow(s, 600.0) * 2.5);
        // cinturão de Vênus: faixa rosada do lado oposto ao sol
        col = mix(col, belt, glowStr * 0.45 * pow(max(-sd, 0.0), 1.5) * exp(-abs(h - 0.1) * 8.0));
        // disco do sol (HDR, para o bloom)
        col += sunCol * smoothstep(0.99935, 0.9997, sd) * sunVis * 22.0;
        // lua
        float md = dot(d, moonDir);
        col += vec3(0.85, 0.9, 1.0) * smoothstep(0.99955, 0.9998, md) * moonVis * 4.0;
        col += vec3(0.4, 0.5, 0.85) * pow(max(md, 0.0), 120.0) * moonVis * 0.25;
        if (envMode > 0.5) {
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(col, vec3(l), 0.5);
          vec3 gnd = hor * vec3(0.62, 0.55, 0.46);
          col = mix(col, gnd, smoothstep(0.02, -0.12, h));
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ruído de valor periódico (repete sem emenda), várias oitavas
function noiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const octaves = [[8, 0.5], [16, 0.25], [32, 0.15], [64, 0.1]];
  const grids = octaves.map(([g]) => Float32Array.from({ length: g * g }, () => Math.random()));
  const fade = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    octaves.forEach(([g, w], k) => {
      const gx = (x / size) * g, gy = (y / size) * g;
      const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = fade(gx - x0), fy = fade(gy - y0);
      const G = grids[k], at = (i, j) => G[((j % g) * g) + (i % g)];
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
      v += (a + (b - a) * fy) * w;
    });
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.min(255, v * 255); data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

function makeClouds() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: {
      noise: { value: noiseTexture() }, offset: { value: new THREE.Vector2() }, wind: { value: new THREE.Vector2() },
      lit: { value: new THREE.Color() }, shade: { value: new THREE.Color() }, fogCol: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, cover: { value: 0.5 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vDir;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D noise; uniform vec2 offset, wind; uniform vec3 lit, shade, fogCol, sunDir; uniform float cover;
      varying vec2 vUv; varying vec3 vDir;
      void main() {
        vec2 uv = vUv + offset;
        float n = texture2D(noise, uv * 2.0 + wind).r * 0.7 + texture2D(noise, uv * 5.3 - wind * 1.6).r * 0.3;
        float a = smoothstep(cover, cover + 0.2, n);
        if (a < 0.01) discard;
        vec3 d = normalize(vDir);
        float sd = max(dot(d, sunDir), 0.0);
        float light = clamp(0.25 + (n - cover) * 2.2 + pow(sd, 5.0) * 0.6, 0.0, 1.0);
        vec3 col = mix(shade, lit, light);
        col += lit * pow(sd, 18.0) * (1.0 - a) * 1.2;           // bordas acesas contra o sol
        col = mix(fogCol, col, smoothstep(0.02, 0.3, d.y));      // somem no horizonte
        // some antes da borda do plano (e do limite de visão da câmera, 4 km): sem a linha reta no horizonte
        float edge = 1.0 - smoothstep(0.16, 0.32, length(vUv - 0.5)); // some antes do limite de visão (4 km)
        gl_FragColor = vec4(col, a * 0.9 * smoothstep(0.04, 0.45, d.y) * edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const g = new THREE.PlaneGeometry(9000, 9000).rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}

function makeStars() {
  const N = 1800, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random(), v = Math.random() * 0.95;
    const th = u * Math.PI * 2, ph = Math.acos(1 - v); // só no hemisfério de cima
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * 3000;
    pos[i * 3 + 1] = Math.cos(ph) * 3000;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 3000;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = -1;
  return p;
}
