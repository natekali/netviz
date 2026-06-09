// Spatial grounding for the 3D scene: a faint ground grid (fades into the fog)
// and a big floating zone label above each tier, so the depth and the zones are
// immediately legible. Rebuilt per network alongside the nodes.
import * as THREE from 'three';

function labelSprite(text, color, anchor) {
  const font = '700 64px -apple-system, "Segoe UI", Roboto, sans-serif';
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = font;
  const w = Math.ceil(meas.measureText(text).width);
  const c = document.createElement('canvas');
  c.width = w + 48;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
  );
  const h = 3.2;
  sp.scale.set((h * c.width) / c.height, h, 1);
  sp.center.set(anchor[0], anchor[1]);
  sp.renderOrder = 3;
  return sp;
}

export function buildEnvironment(layout, zonesById) {
  const group = new THREE.Group();

  const size = layout.span * 2.2;
  const divisions = Math.min(80, Math.max(16, Math.round(size / 10)));
  const grid = new THREE.GridHelper(size, divisions, 0x33486b, 0x1b2942);
  grid.position.y = layout.floorY;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  grid.material.depthWrite = false;
  group.add(grid);

  for (const t of layout.tiers) {
    const zone = zonesById.get(t.zone.id) || t.zone;
    const sp = labelSprite((zone.label || zone.id).toUpperCase(), zone.color || '#9ec3ff', t.labelAnchor);
    sp.position.set(t.labelPos.x, t.labelPos.y, t.labelPos.z);
    group.add(sp);
  }

  return group;
}
