// Animated data packets.
//
// One THREE.Points cloud holds every packet across every link (one draw call).
// Each packet rides its link's curve; count & speed scale with link.traffic.
// Links touching an offline node get none. A custom shader gives round,
// additive, distance-attenuated glow and per-packet alpha (for focus dimming).
import * as THREE from 'three';
import { CONFIG } from './config.js';

const vertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uSize;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (300.0 / max(-mv.z, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float a = smoothstep(0.5, 0.0, d);   // soft round falloff
    if (a <= 0.001) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export function buildPackets(links) {
  const packets = []; // { curve, t, speed, source, target }
  const colorList = [];

  for (const l of links) {
    if (l.offline) continue;
    const n = Math.max(1, Math.round(l.traffic * CONFIG.maxPacketsPerLink));
    const speed = CONFIG.packetSpeed * (0.4 + l.traffic);
    for (let i = 0; i < n; i++) {
      packets.push({
        curve: l.curve,
        t: i / n, // evenly spaced along the link
        speed,
        source: l.source,
        target: l.target,
      });
      colorList.push(l.color);
    }
  }

  const count = packets.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const alphas = new Float32Array(count).fill(1);
  packets.forEach((p, i) => {
    const c = colorList[i];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    const pt = p.curve.getPoint(p.t);
    positions[i * 3] = pt.x;
    positions[i * 3 + 1] = pt.y;
    positions[i * 3 + 2] = pt.z;
  });

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aAlpha', alphaAttr);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: CONFIG.packetSize } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  return { points, packets, geo, posAttr, alphaAttr };
}

const _p = new THREE.Vector3();
export function updatePackets(state, dt) {
  const { packets, posAttr } = state;
  const arr = posAttr.array;
  for (let i = 0; i < packets.length; i++) {
    const p = packets[i];
    p.t += p.speed * dt;
    if (p.t > 1) p.t -= 1;
    p.curve.getPoint(p.t, _p);
    arr[i * 3] = _p.x;
    arr[i * 3 + 1] = _p.y;
    arr[i * 3 + 2] = _p.z;
  }
  posAttr.needsUpdate = true;
}

// Dim packets not attached to the focused node(s). focus = { active, ids:Set }.
export function applyPacketFocus(state, focus, hiddenNodes) {
  const { packets, alphaAttr } = state;
  const arr = alphaAttr.array;
  for (let i = 0; i < packets.length; i++) {
    const p = packets[i];
    const hidden = hiddenNodes.has(p.source) || hiddenNodes.has(p.target);
    if (hidden) {
      arr[i] = 0;
    } else if (!focus.active) {
      arr[i] = 1;
    } else {
      arr[i] = focus.ids.has(p.source) || focus.ids.has(p.target) ? 1 : CONFIG.packetDimAlpha;
    }
  }
  alphaAttr.needsUpdate = true;
}
