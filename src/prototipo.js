// Protótipo de personagem (prototipo.html): o boneco de caixas de hoje (models.js) ao lado do corpo com esqueleto e
// animação que o protagonista usa no jogo (protagonista.js / carregarCorpo).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { makePerson, animatePerson } from './models.js';
import { carregarCorpo } from './protagonista.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9cc3dd');
scene.fog = new THREE.Fog('#cfdde6', 30, 120);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 300);
camera.position.set(0, 1.55, 5.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0); controls.enableDamping = true; controls.update();

// luz de meio de manhã no Recife: sol alto e quente, céu azul rebatendo nas sombras
scene.add(new THREE.HemisphereLight('#cfe6ff', '#8a7a60', 1.1));
const sun = new THREE.DirectionalLight('#fff1dc', 3.0);
sun.position.set(4, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);

// chão: calçada de pedra portuguesa clara e o asfalto atrás
const chao = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#cfc8bb', roughness: 0.92 }));
chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);
const rua = new THREE.Mesh(new THREE.PlaneGeometry(60, 8), new THREE.MeshStandardMaterial({ color: '#4a4b4f', roughness: 0.95 }));
rua.rotation.x = -Math.PI / 2; rua.position.set(0, 0.005, -6); rua.receiveShadow = true; scene.add(rua);
const meioFio = new THREE.Mesh(new THREE.BoxGeometry(60, 0.15, 0.25), new THREE.MeshStandardMaterial({ color: '#e6e1d6', roughness: 0.8 }));
meioFio.position.set(0, 0.075, -1.9); meioFio.castShadow = meioFio.receiveShadow = true; scene.add(meioFio);

// ---------------------------------------------------------------- boneco de hoje
const velho = makePerson({ player: true, hair: 'short' });
velho.position.set(-0.9, 0, 0);
velho.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(velho);

// ---------------------------------------------------------------- corpo novo (o mesmo do jogo: protagonista.js)
const info = document.getElementById('info');
let mixer = null, acoes = {}, atual = null;
async function montar() {
  const c = await carregarCorpo();
  c.raiz.position.set(0.9, 0, 0); scene.add(c.raiz);
  mixer = c.mixer; acoes = c.acoes;
  info.textContent = `${Math.round(c.tri / 1000)} mil triângulos · ${c.ossos} ossos · ${Object.keys(acoes).length} animações`;
  window.prototipo = { tri: c.tri, ossos: c.ossos, anims: Object.keys(acoes) };
  tocar('parado');
}

const MODOS = { parado: ['Idle_Loop', 0], andando: ['Walk_Loop', 1.4], correndo: ['Jog_Fwd_Loop', 4.2], pique: ['Sprint_Loop', 8], conversando: ['Idle_Talking_Loop', 0], dancando: ['Dance_Loop', 0], sentado: ['Sitting_Idle_Loop', 0] };
let vel = 0;
function tocar(modo) {
  const [nome, v] = MODOS[modo]; vel = v;
  const a = acoes[nome]; if (!a) return;
  a.reset().fadeIn(0.25).play(); if (atual && atual !== a) atual.fadeOut(0.25); atual = a;
  for (const b of ui.children) b.classList.toggle('on', b.dataset.m === modo);
}
const ui = document.getElementById('ui');
for (const [m, rot] of [['parado', 'Parado'], ['andando', 'Andando'], ['correndo', 'Correndo'], ['pique', 'No pique'], ['conversando', 'Conversando'], ['dancando', 'Dançando'], ['sentado', 'Sentado']]) {
  const b = document.createElement('button'); b.textContent = rot; b.dataset.m = m; b.onclick = () => tocar(m); ui.appendChild(b);
}
window.tocar = tocar;

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  mixer?.update(dt);
  animatePerson(velho, vel, dt);
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
montar().catch((e) => { info.textContent = 'erro: ' + e.message; console.error(e); });
