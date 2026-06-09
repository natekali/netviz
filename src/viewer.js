// The 3D viewer engine. Created once; `setNetwork(network)` (re)builds the
// scene from a validated network object, so the same viewer is reused when the
// user edits, imports or regenerates their topology.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { UNIQUE_ICONS } from './catalog.js';
import { loadIconImages } from './icons.js';
import { createScene, frameGraph } from './scene.js';
import { computeLayout } from './layout.js';
import { buildNodes, updateNodes, applyNodeFocus } from './nodes.js';
import { buildLinks, buildGraph, applyLinkFocus, refreshLinkVisibility } from './links.js';
import { buildPackets, updatePackets, applyPacketFocus } from './packets.js';
import { buildEnvironment } from './environment.js';
import { clusterNetwork } from './cluster.js';
import { createInteraction } from './interaction.js';
import { buildHUD } from './ui.js';

export async function createViewer(container) {
  const { scene, camera, renderer, controls, composer } = createScene(container);
  const icons = await loadIconImages(UNIQUE_ICONS);

  let cur = null; // current render bundle
  let sourceNetwork = null; // the original (un-clustered) network
  let orientation = 'vertical';
  let grouped = false;

  function disposeObject(obj) {
    obj.traverse?.((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          // keepMap flags textures shared across networks (e.g. the halo glow)
          // so we don't dispose a texture the next render will reuse.
          if (m.map && !m.userData?.keepMap) m.map.dispose();
          m.dispose();
        }
      }
    });
  }

  function clear() {
    if (!cur) return;
    cur.interaction.dispose();
    scene.remove(cur.nodeGroup);
    scene.remove(cur.linkGroup);
    scene.remove(cur.packetState.points);
    scene.remove(cur.env);
    disposeObject(cur.nodeGroup);
    disposeObject(cur.linkGroup);
    disposeObject(cur.env);
    cur.packetState.points.geometry.dispose();
    cur.packetState.points.material.dispose();
    cur = null;
  }

  function setNetwork(network) {
    sourceNetwork = network;
    build();
  }

  function build() {
    clear();
    const network = grouped ? clusterNetwork(sourceNetwork) : sourceNetwork;
    const zonesById = new Map(network.zones.map((z) => [z.id, z]));
    const layout = computeLayout(network, CONFIG, orientation);
    const { group: nodeGroup, records, pickables } = buildNodes(network, layout.positions, zonesById, icons);
    const { group: linkGroup, links } = buildLinks(network, records, zonesById);
    const graph = buildGraph(links);
    const packetState = buildPackets(links);
    const env = buildEnvironment(layout, zonesById);

    scene.add(nodeGroup, linkGroup, packetState.points, env);
    frameGraph(camera, controls, layout.radius, orientation);

    const hud = buildHUD(network, {
      onFilterChange,
      onConnClick: (id) => selectNode(id, true),
      onDetailClose: () => {
        cur.selectedId = null;
        hud.closeDetail();
        refreshFocus();
      },
    });

    const interaction = createInteraction(camera, controls, renderer, pickables, {
      onHover: (rec) => {
        cur.hoverId = rec.node.id;
        refreshFocus();
      },
      onHoverEnd: () => {
        cur.hoverId = null;
        refreshFocus();
      },
      onSelect: (rec) => selectNode(rec.node.id, true),
      onClickEmpty: () => {
        cur.selectedId = null;
        hud.closeDetail();
        refreshFocus();
      },
      onTooltipMove: (node, x, y) => hud.showTooltip(node, x, y),
      onTooltipHide: () => hud.hideTooltip(),
    });

    cur = {
      network, records, links, graph, packetState, env,
      nodeGroup, linkGroup, hud, interaction,
      zonesById, hiddenNodes: new Set(), radius: layout.radius,
      hoverId: null, selectedId: null,
    };

    refreshFocus();
  }

  // Switch orientation live: reposition nodes, rebuild links/packets/labels at
  // the new spots, reframe - while preserving selection + status filter.
  function applyLayout() {
    if (!cur) return;
    const layout = computeLayout(cur.network, CONFIG, orientation);
    for (const rec of cur.records.values()) {
      const p = layout.positions.get(rec.node.id);
      if (p) {
        rec.base.copy(p);
        rec.holder.position.copy(p);
      }
    }
    scene.remove(cur.linkGroup, cur.packetState.points, cur.env);
    disposeObject(cur.linkGroup);
    disposeObject(cur.env);
    cur.packetState.points.geometry.dispose();
    cur.packetState.points.material.dispose();

    const { group: linkGroup, links } = buildLinks(cur.network, cur.records, cur.zonesById);
    cur.linkGroup = linkGroup;
    cur.links = links;
    cur.graph = buildGraph(links);
    cur.packetState = buildPackets(links);
    cur.env = buildEnvironment(layout, cur.zonesById);
    scene.add(cur.linkGroup, cur.packetState.points, cur.env);

    cur.radius = layout.radius;
    refreshLinkVisibility(cur.links, cur.records);
    frameGraph(camera, controls, layout.radius, orientation);
    refreshFocus();
  }

  function setOrientation(o) {
    if (o === orientation) return;
    orientation = o;
    applyLayout();
  }

  function setGrouped(on) {
    if (on === grouped || !sourceNetwork) return;
    grouped = on;
    build(); // node set changes, so a full rebuild
  }

  function resetView() {
    if (cur) frameGraph(camera, controls, cur.radius, orientation);
  }

  function saveImage() {
    const name = (sourceNetwork?.meta?.name || 'network')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    composer.render(); // ensure the buffer is current
    const url = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'network'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---- focus / selection ----
  const noFocus = { active: false, ids: new Set(), connected: new Set() };

  function focusFor(centerId) {
    const connected = cur.graph.neighbours.get(centerId);
    return { active: true, ids: new Set([centerId]), connected: connected ? new Set(connected) : new Set() };
  }

  function refreshFocus() {
    if (!cur) return;
    const center = cur.hoverId || cur.selectedId;
    const rec = center ? cur.records.get(center) : null;
    const focus = rec && rec.visible ? focusFor(center) : noFocus;
    applyNodeFocus(cur.records, focus, cur.selectedId);
    applyLinkFocus(cur.links, focus);
    applyPacketFocus(cur.packetState, focus, cur.hiddenNodes);
  }

  function connectionsFor(id) {
    const inc = cur.graph.incident.get(id) || [];
    return inc.map((l) => {
      const otherId = l.source === id ? l.target : l.source;
      return { node: cur.records.get(otherId).node, link: l.link };
    });
  }

  function selectNode(id, fly) {
    const rec = cur.records.get(id);
    if (!rec || !rec.visible) return;
    cur.selectedId = id;
    refreshFocus();
    cur.hud.openDetail(rec.node, connectionsFor(id));
    if (fly) cur.interaction.flyTo(rec.base);
  }

  function onFilterChange(activeStatuses) {
    cur.hiddenNodes.clear();
    for (const rec of cur.records.values()) {
      rec.visible = activeStatuses.has(rec.status);
      if (!rec.visible) cur.hiddenNodes.add(rec.node.id);
    }
    refreshLinkVisibility(cur.links, cur.records);
    if (cur.selectedId && cur.hiddenNodes.has(cur.selectedId)) {
      cur.selectedId = null;
      cur.hud.closeDetail();
    }
    refreshFocus();
  }

  // ---- render loop ----
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (cur) {
      updateNodes(cur.records, t, cur.selectedId);
      updatePackets(cur.packetState, dt);
      cur.interaction.update(dt);
    }
    composer.render();
  }
  animate();

  // Wire the orientation segmented control (static in the HUD).
  const orientBtns = [...document.querySelectorAll('#orient button')];
  orientBtns.forEach((b) => {
    b.onclick = () => {
      setOrientation(b.dataset.orient);
      orientBtns.forEach((x) => x.classList.toggle('active', x.dataset.orient === orientation));
    };
  });

  // Wire the viewer tools (reset / save image / group similar).
  const resetBtn = document.querySelector('#view-tools [data-act="reset"]');
  const pngBtn = document.querySelector('#view-tools [data-act="png"]');
  const groupToggle = document.getElementById('group-toggle');
  if (resetBtn) resetBtn.onclick = resetView;
  if (pngBtn) pngBtn.onclick = saveImage;
  if (groupToggle) groupToggle.onchange = () => setGrouped(groupToggle.checked);

  return { setNetwork, setOrientation, resetView, saveImage, setGrouped };
}
