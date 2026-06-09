// Viewer HUD: header, legend (zones + status), status filter, hover tooltip and
// the click detail panel. Rebuilt each time a new network is shown. Focused on
// topology comprehension - IP/metrics are shown only if present.
import { STATUSES, STATUS_UI, typeLabel } from './catalog.js';

const $ = (id) => document.getElementById(id);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function buildHUD(network, handlers) {
  const zonesById = new Map(network.zones.map((z) => [z.id, z]));

  // ---- header ----
  $('net-name').textContent = network.meta?.name || 'Untitled Network';
  const gen = network.meta?.generatedAt ? new Date(network.meta.generatedAt) : null;
  $('net-meta').textContent = gen && !isNaN(gen) ? `updated ${gen.toLocaleDateString()}` : 'live';
  $('net-counts').textContent = `${network.nodes.length} devices · ${network.links.length} links`;

  // ---- status filter ----
  const counts = {};
  for (const s of STATUSES) counts[s] = 0;
  for (const n of network.nodes) counts[n.status || 'ok']++;

  const filterEl = $('filter');
  filterEl.innerHTML = '';
  filterEl.appendChild(el('div', 'filter-title', 'Filter by health'));
  const active = new Set(STATUSES);
  for (const s of STATUSES) {
    const ui = STATUS_UI[s];
    const row = el('label', 'filter-row');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.addEventListener('change', () => {
      cb.checked ? active.add(s) : active.delete(s);
      handlers.onFilterChange(new Set(active));
    });
    const sw = el('span', 'swatch');
    sw.style.color = ui.color;
    sw.style.background = ui.color;
    row.append(cb, sw, el('span', null, ui.label), el('span', 'count', String(counts[s])));
    filterEl.appendChild(row);
  }

  // ---- legend ----
  const legendEl = $('legend');
  legendEl.innerHTML = '';
  const zoneSec = el('div', 'legend-section');
  zoneSec.appendChild(el('div', 'legend-title', 'Zones'));
  for (const z of network.zones) {
    const item = el('div', 'legend-item');
    const sw = el('span', 'swatch');
    sw.style.color = z.color;
    sw.style.background = z.color;
    item.append(sw, el('span', null, z.label || z.id));
    zoneSec.appendChild(item);
  }
  legendEl.appendChild(zoneSec);

  // ---- tooltip ----
  const tooltip = $('tooltip');
  function showTooltip(node, x, y) {
    const ui = STATUS_UI[node.status] || STATUS_UI.ok;
    const zone = zonesById.get(node.zone);
    tooltip.innerHTML =
      `<div class="tt-name">${esc(node.label || node.id)}</div>` +
      `<div class="tt-row"><b>${esc(typeLabel(node.type))}</b>${
        zone ? ` · ${esc(zone.label || zone.id)}` : ''
      }</div>` +
      `<div class="tt-row tt-status" style="color:${ui.color}">● ${ui.label}</div>`;
    tooltip.classList.add('show');
    positionTooltip(x, y);
  }
  function positionTooltip(x, y) {
    const pad = 16;
    const r = tooltip.getBoundingClientRect();
    let nx = x + pad;
    let ny = y + pad;
    if (nx + r.width > window.innerWidth - 8) nx = x - r.width - pad;
    if (ny + r.height > window.innerHeight - 8) ny = y - r.height - pad;
    tooltip.style.left = nx + 'px';
    tooltip.style.top = ny + 'px';
  }
  function hideTooltip() {
    tooltip.classList.remove('show');
  }

  // ---- detail panel ----
  const detail = $('detail');
  const body = $('detail-body');
  $('detail-close').onclick = () => handlers.onDetailClose();

  function openDetail(node, connections) {
    const ui = STATUS_UI[node.status] || STATUS_UI.ok;
    const zone = zonesById.get(node.zone);
    const m = node.metrics || {};

    const kv = (k, v, color) =>
      `<div class="kv"><span class="k">${k}</span><span class="v"${
        color ? ` style="color:${color}"` : ''
      }>${v}</span></div>`;

    const rows = [
      kv('Type', typeLabel(node.type)),
      kv('Zone', zone ? zone.label || zone.id : node.zone || '-', zone?.color),
    ];
    if (node.ip) rows.push(kv('Address', esc(node.ip)));
    if (typeof m.cpu === 'number') rows.push(kv('CPU', `${m.cpu}%`));
    if (typeof m.throughputMbps === 'number')
      rows.push(kv('Throughput', `${m.throughputMbps.toLocaleString()} Mbps`));

    const conn = connections.length
      ? connections
          .map((c) => {
            const z = zonesById.get(c.node.zone);
            const col = z?.color || '#7b8aa6';
            return (
              `<div class="conn-item" data-id="${esc(c.node.id)}">` +
              `<span class="swatch" style="color:${col};background:${col}"></span>` +
              `${esc(c.node.label || c.node.id)}` +
              `<span class="link-type">${esc(c.link.type || 'link')}</span></div>`
            );
          })
          .join('')
      : `<div style="color:var(--text-faint);font-size:12px">No connections.</div>`;

    let members = '';
    if (node.count > 1 && Array.isArray(node.members)) {
      members =
        `<div class="detail-section-title">Grouped devices (${node.members.length})</div>` +
        node.members.map((m) => `<div class="member-item">${esc(m.label || m.id)}</div>`).join('');
    }

    body.innerHTML =
      `<div class="detail-name">${esc(node.label || node.id)}</div>` +
      `<div class="detail-type">${esc(typeLabel(node.type))}</div>` +
      `<div class="detail-status" style="color:${ui.color};background:${hexA(ui.color, 0.12)}">` +
      `<span class="swatch" style="color:${ui.color};background:${ui.color}"></span>${ui.label}</div>` +
      rows.join('') +
      `<div class="detail-section-title">Connected to (${connections.length})</div>` +
      conn +
      members;

    body.querySelectorAll('.conn-item').forEach((n) => {
      n.onclick = () => handlers.onConnClick(n.dataset.id);
    });
    detail.dataset.open = 'true';
  }
  function closeDetail() {
    detail.dataset.open = 'false';
  }

  return { showTooltip, positionTooltip, hideTooltip, openDetail, closeDetail };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function showError(msg) {
  const b = $('error-banner');
  b.textContent = '⚠ ' + msg;
  b.classList.add('show');
}
export function clearError() {
  $('error-banner').classList.remove('show');
}
export function hideLoader() {
  $('loader')?.classList.add('hidden');
}
