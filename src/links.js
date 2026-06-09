// Link rendering: each link is a smooth curved tube, additively blended and
// tinted by its SOURCE zone. The curve is kept so the packet system can ride
// sprites along it. Tube radius scales (log) with bandwidth.
import * as THREE from 'three';
import { CONFIG } from './config.js';

function radiusForBandwidth(mbps) {
  const v = typeof mbps === 'number' && mbps > 0 ? mbps : 100;
  const t = Math.min(1, Math.log10(v) / 5); // ~10 Mbps→0.2 .. 100 Gbps→1
  return CONFIG.tubeRadiusMin + (CONFIG.tubeRadiusMax - CONFIG.tubeRadiusMin) * t;
}

export function buildLinks(network, records, zonesById) {
  const group = new THREE.Group();
  const links = [];

  for (const link of network.links) {
    const srcRec = records.get(link.source);
    const dstRec = records.get(link.target);
    if (!srcRec || !dstRec) continue; // already validated, but stay safe

    const a = srcRec.base;
    const b = dstRec.base;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    // Bow the curve toward the viewer (+Z) so links arc out as clean 3D ribbons
    // between the vertical tiers instead of cutting straight through cards.
    const bow = CONFIG.linkCurveLift + a.distanceTo(b) * CONFIG.linkCurveDistFactor;
    mid.z += bow;
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());

    const srcZone = zonesById.get(srcRec.node.zone);
    const color = new THREE.Color(srcZone?.color || CONFIG.fallbackZoneColor);
    const offline = srcRec.offline || dstRec.offline;

    const geo = new THREE.TubeGeometry(
      curve,
      CONFIG.tubeSegments,
      radiusForBandwidth(link.bandwidthMbps),
      CONFIG.tubeRadialSegments,
      false,
    );
    const baseOpacity = offline ? CONFIG.linkOpacityOffline : CONFIG.linkOpacity;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);

    links.push({
      link,
      curve,
      mesh,
      mat,
      color,
      baseOpacity,
      offline,
      source: link.source,
      target: link.target,
      traffic: clamp01(link.traffic, 0.3),
      visible: true,
    });
  }

  return { group, links };
}

function clamp01(v, fallback) {
  const n = typeof v === 'number' && isFinite(v) ? v : fallback;
  return Math.min(1, Math.max(0, n));
}

// Build adjacency: nodeId -> Set(neighbourId), nodeId -> [linkObj].
export function buildGraph(links) {
  const neighbours = new Map();
  const incident = new Map();
  const add = (a, b, l) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    if (!incident.has(a)) incident.set(a, []);
    neighbours.get(a).add(b);
    incident.get(a).push(l);
  };
  for (const l of links) {
    add(l.source, l.target, l);
    add(l.target, l.source, l);
  }
  return { neighbours, incident };
}

// Dim/brighten links on focus. focus = { active, ids:Set(nodes that "own" links) }.
export function applyLinkFocus(links, focus) {
  for (const l of links) {
    if (!l.visible) {
      l.mat.opacity = 0;
      l.mesh.visible = false;
      continue;
    }
    l.mesh.visible = true;
    if (!focus.active) {
      l.mat.opacity = l.baseOpacity;
    } else {
      const connected = focus.ids.has(l.source) || focus.ids.has(l.target);
      l.mat.opacity = connected ? CONFIG.linkFocusConnected : CONFIG.linkFocusDim;
    }
  }
}

// Recompute per-link visibility from node visibility (both endpoints must show).
export function refreshLinkVisibility(links, records) {
  for (const l of links) {
    const s = records.get(l.source);
    const d = records.get(l.target);
    l.visible = !!(s && d && s.visible && d.visible);
  }
}
