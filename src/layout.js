// Layout in two orientations the user can switch between:
//   • "vertical"   - zones stack TOP → BOTTOM (external/cloud on top, flowing
//     down to internal endpoints). Devices spread horizontally across each tier.
//   • "horizontal" - zones run LEFT → RIGHT (external on the left → internal on
//     the right). Devices stack vertically within each tier.
// Either way: external→internal is the reading direction (correct data transit),
// each tier is a clean band/wall with a little depth (Z) for 3D, and gets a
// zone label. A ground grid sits underneath.
import * as THREE from 'three';

const CLOUD_RE = /cloud|saas|external|internet/i;

function isCloudZone(zone, nodes) {
  if (CLOUD_RE.test(zone.id || '') || CLOUD_RE.test(zone.label || '')) return true;
  return nodes.length > 0 && nodes.every((n) => n.type === 'cloud' || n.type === 'saas');
}

export function computeLayout(network, cfg, orientation = 'vertical') {
  const vertical = orientation !== 'horizontal';
  const { zones, nodes } = network;

  const byZone = new Map(zones.map((z) => [z.id, []]));
  const orphans = [];
  for (const n of nodes) {
    if (byZone.has(n.zone)) byZone.get(n.zone).push(n);
    else orphans.push(n);
  }

  // Tier order (reading direction): cloud-like zones first, then flow zones.
  const flowTiers = [];
  const cloudTiers = [];
  for (const zone of zones) {
    const zn = byZone.get(zone.id);
    if (!zn.length) continue;
    (isCloudZone(zone, zn) ? cloudTiers : flowTiers).push({ zone, nodes: zn });
  }
  if (orphans.length) flowTiers.push({ zone: { id: '__orphans__', label: 'Unzoned' }, nodes: orphans });
  const tierList = [...cloudTiers, ...flowTiers];
  const nTiers = tierList.length;

  // Per-tier grid: depth (Z, capped) × breadth (the long axis of the band).
  const grids = tierList.map((t) => {
    const n = t.nodes.length;
    const depth = Math.min(cfg.maxDepth, Math.max(1, n));
    const breadth = Math.ceil(n / depth);
    return { depth, breadth };
  });
  let maxBreadthHalf = 0;
  for (const g of grids) maxBreadthHalf = Math.max(maxBreadthHalf, ((g.breadth - 1) / 2) * cfg.nodeGapBreadth);

  const positions = new Map();
  const tiers = [];
  const tierGap = vertical ? cfg.tierGapY : cfg.tierGapX;

  tierList.forEach((t, ti) => {
    const { depth, breadth } = grids[ti];
    // reading direction: first tier (cloud) at top (vertical) / left (horizontal)
    const tierPos = vertical
      ? ((nTiers - 1) / 2 - ti) * tierGap
      : (ti - (nTiers - 1) / 2) * tierGap;
    t.nodes.forEach((node, i) => {
      const d = i % depth; // depth index (Z)
      const b = Math.floor(i / depth); // breadth index
      const bp = (b - (breadth - 1) / 2) * cfg.nodeGapBreadth;
      const dp = (d - (depth - 1) / 2) * cfg.nodeGapZ;
      const p = vertical
        ? new THREE.Vector3(bp, tierPos, dp) // breadth along X
        : new THREE.Vector3(tierPos, bp, dp); // breadth along Y
      positions.set(node.id, p);
    });
    tiers.push({ zone: t.zone, tierPos });
  });

  // Zone labels: a left column (vertical) or a top row (horizontal).
  const labelOffset = maxBreadthHalf + cfg.cardHeight + cfg.labelGap;
  for (const t of tiers) {
    if (vertical) {
      t.labelPos = { x: -labelOffset, y: t.tierPos, z: 0 };
      t.labelAnchor = [1, 0.5]; // right edge → tidy left column
    } else {
      t.labelPos = { x: t.tierPos, y: labelOffset, z: 0 };
      t.labelAnchor = [0.5, 0.5]; // centered above the tier
    }
  }

  // Bounds for framing + ground grid.
  let radius = 12;
  let minY = Infinity;
  positions.forEach((p) => {
    radius = Math.max(radius, Math.hypot(p.x, p.y, p.z));
    minY = Math.min(minY, p.y);
  });
  radius = Math.max(radius, labelOffset, (nTiers / 2) * tierGap) + cfg.cardHeight * 1.6;
  const floorY = (isFinite(minY) ? minY : 0) - cfg.cardHeight * 1.4;
  const span = Math.max(maxBreadthHalf * 2, nTiers * tierGap, 40);

  return { positions, radius, floorY, tiers, span, orientation };
}
