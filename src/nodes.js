// Node rendering as flat, billboarded "icon cards": a rounded card per device
// showing its real device icon, name, type and a status dot - always facing the
// camera so the diagram stays legible from any angle. A soft halo behind each
// card carries the zone/status glow (and pulses for warning/critical).
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { typeIcon, typeLabel, STATUS_UI } from './catalog.js';

// ---- shared textures ----
let _haloTex = null;
function haloTexture() {
  if (_haloTex) return _haloTex;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  _haloTex = new THREE.CanvasTexture(c);
  return _haloTex;
}

const CARD_W = 280;
const CARD_H = 300;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLabel(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  // truncate leftover into the last line with an ellipsis
  if (lines.length > maxLines) lines.length = maxLines;
  if (ctx.measureText(line).width > maxW) {
    let s = line;
    while (s.length && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    lines[lines.length - 1] = s + '…';
  }
  return lines;
}

function makeCardTexture(node, zoneColor, iconImg) {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d');
  const status = node.status || 'ok';
  const offline = status === 'offline';
  const pad = 14;
  const x = pad;
  const y = pad;
  const w = CARD_W - pad * 2;
  const h = CARD_H - pad * 2;
  const count = node.count || 1;

  // stacked look behind the card when it represents several devices
  if (count > 1) {
    for (let s = 2; s >= 1; s--) {
      const off = s * 7;
      roundRect(ctx, x + off, y - off, w, h, 22);
      ctx.fillStyle = `rgba(13,20,33,${0.4 - s * 0.08})`;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = hexA(offline ? '#39414e' : zoneColor, 0.4 - s * 0.1);
      ctx.stroke();
    }
  }

  // body
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = offline ? 'rgba(14,18,24,0.9)' : 'rgba(13,20,33,0.92)';
  ctx.fill();

  // zone-tinted top fade
  if (!offline) {
    const grad = ctx.createLinearGradient(0, y, 0, y + 80);
    grad.addColorStop(0, hexA(zoneColor, 0.28));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    roundRect(ctx, x, y, w, h, 22);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, 90);
    ctx.restore();
  }

  // border
  roundRect(ctx, x, y, w, h, 22);
  ctx.lineWidth = 3;
  ctx.strokeStyle = offline ? '#39414e' : zoneColor;
  ctx.stroke();

  // icon
  if (iconImg) {
    const isz = 116;
    ctx.globalAlpha = offline ? 0.4 : 1;
    ctx.drawImage(iconImg, (CARD_W - isz) / 2, 44, isz, isz);
    ctx.globalAlpha = 1;
  }

  // name
  ctx.textAlign = 'center';
  ctx.fillStyle = offline ? '#6b7689' : '#ffffff';
  ctx.font = '600 30px -apple-system, "Segoe UI", Roboto, sans-serif';
  const nameLines = wrapLabel(ctx, node.label || node.id, w - 24, 2);
  let ty = 196;
  for (const ln of nameLines) {
    ctx.fillText(ln, CARD_W / 2, ty);
    ty += 34;
  }

  // type label
  ctx.fillStyle = offline ? '#586273' : '#90a2c0';
  ctx.font = '500 21px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(typeLabel(node.type).toUpperCase(), CARD_W / 2, ty + 6);

  // status dot
  const su = STATUS_UI[status] || STATUS_UI.ok;
  ctx.beginPath();
  ctx.arc(CARD_W - pad - 18, pad + 18, 9, 0, Math.PI * 2);
  ctx.fillStyle = su.color;
  ctx.fill();
  if (!offline) {
    ctx.shadowColor = su.color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // count badge for clusters
  if (count > 1) {
    const label = `×${count}`;
    ctx.font = '700 22px -apple-system, "Segoe UI", Roboto, sans-serif';
    const bw = ctx.measureText(label).width + 26;
    const bx = pad + 4;
    const by = pad + 4;
    roundRect(ctx, bx, by, bw, 30, 15);
    ctx.fillStyle = offline ? '#39414e' : zoneColor;
    ctx.fill();
    ctx.fillStyle = '#0b0c0f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + 16);
    ctx.textBaseline = 'alphabetic';
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function phaseFromId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h % 1000) / 1000) * Math.PI * 2;
}

export function buildNodes(network, positions, zonesById, icons) {
  const group = new THREE.Group();
  const records = new Map();
  const pickables = [];
  const cardH = CONFIG.cardHeight;
  const cardW = cardH * (CARD_W / CARD_H);

  for (const node of network.nodes) {
    const pos = positions.get(node.id) || new THREE.Vector3();
    const zone = zonesById.get(node.zone);
    const zoneColor = zone?.color || CONFIG.fallbackZoneColor;
    const status = node.status || 'ok';
    const offline = status === 'offline';
    const iconImg = icons[typeIcon(node.type)] || icons.box;

    const holder = new THREE.Group();
    holder.position.copy(pos);

    // halo
    const su = STATUS_UI[status] || STATUS_UI.ok;
    const haloColor = new THREE.Color(
      status === 'warning' || status === 'critical' ? su.color : zoneColor,
    );
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTexture(),
        color: haloColor,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    halo.scale.set(cardW * 2.1, cardH * 2.1, 1);
    halo.renderOrder = 1;
    halo.material.userData.keepMap = true; // halo texture is shared across networks
    holder.add(halo);

    // card
    const cardTex = makeCardTexture(node, zoneColor, iconImg);
    const card = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cardTex,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        alphaTest: 0.35,
      }),
    );
    card.scale.set(cardW, cardH, 1);
    card.renderOrder = 2;
    card.userData.nodeId = node.id;
    holder.add(card);

    group.add(holder);
    pickables.push(card);

    const rec = {
      node,
      holder,
      halo,
      card,
      base: pos.clone(),
      cardW,
      cardH,
      status,
      offline,
      zoneColor,
      phase: phaseFromId(node.id),
      visible: true,
    };
    card.userData.rec = rec;
    records.set(node.id, rec);
  }

  return { group, records, pickables };
}

// Per-frame: subtle bob + halo pulse + selection emphasis.
export function updateNodes(records, t, selectedId) {
  for (const rec of records.values()) {
    if (!rec.visible) continue;
    const bob = Math.sin(t * 1.1 + rec.phase) * CONFIG.bobAmplitude;
    rec.holder.position.y = rec.base.y + bob;

    if (!rec._dim) {
      let op;
      switch (rec.status) {
        case 'warning':
          op = 0.32 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.4 + rec.phase));
          break;
        case 'critical':
          op = 0.42 + 0.32 * (0.5 + 0.5 * Math.sin(t * 6.0 + rec.phase));
          break;
        case 'offline':
          op = 0;
          break;
        default:
          op = CONFIG.haloBaseOpacity;
      }
      rec.halo.material.opacity = rec._selected ? Math.max(op, 0.5) : op;
    }
  }
}

// focus = { active, ids:Set(highlighted), connected:Set }
export function applyNodeFocus(records, focus, selectedId) {
  for (const rec of records.values()) {
    rec._selected = rec.node.id === selectedId;
    if (!rec.visible) {
      rec.holder.visible = false;
      continue;
    }
    rec.holder.visible = true;

    let cardOp = 1;
    let scale = 1;
    let dim = false;
    if (focus.active) {
      if (focus.ids.has(rec.node.id)) {
        scale = CONFIG.selectScale;
      } else if (focus.connected.has(rec.node.id)) {
        cardOp = 0.96;
      } else {
        cardOp = CONFIG.dimOpacity;
        dim = true;
      }
    }
    if (rec._selected) scale = Math.max(scale, CONFIG.selectScale);

    rec._dim = dim;
    rec.card.material.opacity = cardOp;
    rec.card.scale.set(rec.cardW * scale, rec.cardH * scale, 1);
    rec.halo.scale.set(rec.cardW * 2.1 * scale, rec.cardH * 2.1 * scale, 1);
    if (dim) rec.halo.material.opacity = 0;
  }
}

function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
