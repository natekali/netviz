// Renderer, scene, camera, OrbitControls, bloom composer, lighting and the
// radial-gradient NOC backdrop. Knows nothing about topology.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';

function makeGradientTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(512, 430, 60, 512, 512, 760);
  g.addColorStop(0, '#14161d');
  g.addColorStop(0.5, '#0b0d12');
  g.addColorStop(1, '#06070a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 1024);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = makeGradientTexture();
  scene.fog = new THREE.FogExp2(0x06070a, 0.0042);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    4000,
  );
  camera.position.set(40, 38, 130);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.6;
  controls.panSpeed = 0.7;
  controls.maxDistance = 1200;
  controls.minDistance = 6;

  // Lighting - modest, so emissive + bloom carry the look.
  scene.add(new THREE.AmbientLight(0x4a5a78, 0.6));
  const key = new THREE.DirectionalLight(0x9ec3ff, 0.7);
  key.position.set(60, 120, 80);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x4060a0, 0.45);
  rim.position.set(-80, -40, -60);
  scene.add(rim);

  // Postprocessing: bloom on emissive nodes/packets/links.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloomStrength,
    CONFIG.bloomRadius,
    CONFIG.bloomThreshold,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return { scene, camera, renderer, controls, composer, bloom };
}

// Frame the whole graph: target the center, sit back far enough to see it all.
export function frameGraph(camera, controls, radius, orientation = 'vertical') {
  const dist = (radius / Math.sin((CONFIG.fov * Math.PI) / 360)) * 1.02;
  // Vertical: near eye-level so the top→bottom flow reads. Horizontal: a touch
  // more elevation to take in the left→right bands and their depth.
  const dir =
    orientation === 'horizontal'
      ? new THREE.Vector3(0.16, 0.34, 1).normalize()
      : new THREE.Vector3(0.3, 0.16, 1).normalize();
  controls.target.set(0, 0, 0);
  camera.position.copy(dir.multiplyScalar(dist));
  controls.update();
}
