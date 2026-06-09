// Pointer interaction: hover (raycast → highlight + tooltip), click-to-select
// (with drag/click disambiguation so orbiting never selects), and a smooth
// camera fly-to-focus tween.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createInteraction(camera, controls, renderer, pickables, handlers) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  let hoveredId = null;
  let down = null; // { x, y, t }
  let dragging = false;

  const fly = { active: false, t: 0, dur: CONFIG.flyDuration };
  const fromPos = new THREE.Vector3();
  const toPos = new THREE.Vector3();
  const fromTar = new THREE.Vector3();
  const toTar = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const el = renderer.domElement;

  function pick(clientX, clientY) {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    for (const h of hits) {
      const rec = h.object.userData.rec;
      if (rec && rec.visible) return rec;
    }
    return null;
  }

  function onPointerMove(e) {
    if (e.buttons) {
      dragging = true;
      if (hoveredId !== null) {
        hoveredId = null;
        handlers.onHoverEnd();
      }
      handlers.onTooltipHide();
      return;
    }
    const rec = pick(e.clientX, e.clientY);
    const id = rec ? rec.node.id : null;
    if (id !== hoveredId) {
      hoveredId = id;
      if (rec) handlers.onHover(rec);
      else handlers.onHoverEnd();
    }
    if (rec) handlers.onTooltipMove(rec.node, e.clientX, e.clientY);
    else handlers.onTooltipHide();
    el.style.cursor = rec ? 'pointer' : 'default';
  }

  function onPointerDown(e) {
    down = { x: e.clientX, y: e.clientY };
    dragging = false;
  }

  function onPointerUp(e) {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 5 || dragging) {
      dragging = false;
      return; // it was an orbit/pan drag, not a click
    }
    const rec = pick(e.clientX, e.clientY);
    if (rec) handlers.onSelect(rec);
    else handlers.onClickEmpty();
  }

  function onWheel() {
    fly.active = false; // let the user take over zoom
  }
  function onLeave() {
    if (hoveredId !== null) {
      hoveredId = null;
      handlers.onHoverEnd();
    }
    handlers.onTooltipHide();
  }

  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('wheel', onWheel, { passive: true });
  el.addEventListener('pointerleave', onLeave);

  function flyTo(targetVec) {
    fromPos.copy(camera.position);
    fromTar.copy(controls.target);
    toTar.copy(targetVec);
    // keep current viewing direction, settle at a fixed comfortable distance
    dir.subVectors(camera.position, controls.target).normalize();
    toPos.copy(targetVec).addScaledVector(dir, CONFIG.focusDistance);
    fly.t = 0;
    fly.active = true;
  }

  // ease in/out
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  function update(dt) {
    if (fly.active) {
      fly.t += dt / fly.dur;
      const k = ease(Math.min(1, fly.t));
      camera.position.lerpVectors(fromPos, toPos, k);
      controls.target.lerpVectors(fromTar, toTar, k);
      if (fly.t >= 1) fly.active = false;
    }
    controls.update();
  }

  function dispose() {
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('pointerleave', onLeave);
  }

  return { update, flyTo, dispose };
}
