// Form-based network builder, optimized for speed:
//   • Quick-start TEMPLATES so you never start blank.
//   • Bulk "add N devices" bar (e.g. 10 workstations on a switch in one click).
//   • Connections folded INTO each device as "Connects to" chips - no separate
//     table to maintain. Link types are inferred automatically.
import {
  DEVICE_TYPES,
  TYPE_BY_ID,
  CATEGORIES,
  DEFAULT_ZONES,
  STATUSES,
  STATUS_UI,
  typeLabel,
} from './catalog.js';
import { TEMPLATES } from './presets.js';

const INFRA = new Set(['switch', 'router', 'firewall', 'loadbalancer', 'gateway', 'proxy', 'ids', 'vpn']);
const CLOUDISH = new Set(['cloud', 'saas', 'cdn', 'internet']);
function inferLinkType(a, b) {
  if (CLOUDISH.has(a) || CLOUDISH.has(b)) return 'wan';
  if (a === 'ap' || b === 'ap') return 'wireless';
  if (a === 'nas' || a === 'san' || b === 'nas' || b === 'san') return 'storage';
  if (INFRA.has(a) && INFRA.has(b)) return 'trunk';
  return 'access';
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function blankState() {
  return { name: 'My Network', zones: DEFAULT_ZONES.map((z) => ({ ...z })), devices: [], seq: 1 };
}

export function createBuilder(root, { onChange } = {}) {
  let state = blankState();

  const uid = (prefix) => {
    let id;
    do {
      id = `${prefix}-${state.seq++}`;
    } while (state.devices.some((d) => d.id === id));
    return id;
  };
  const uniqueZoneId = (label) => {
    const base = slug(label);
    let id = base;
    let i = 2;
    while (state.zones.some((z) => z.id === id)) id = `${base}-${i++}`;
    return id;
  };

  // ---- serialize / deserialize ----
  function getNetwork() {
    const byId = new Map(state.devices.map((d) => [d.id, d]));
    const seen = new Set();
    const links = [];
    for (const d of state.devices) {
      for (const up of d.uplinks || []) {
        if (up === d.id || !byId.has(up)) continue;
        const key = [d.id, up].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ source: d.id, target: up, type: inferLinkType(d.type, byId.get(up).type) });
      }
    }
    return {
      meta: { name: state.name || 'My Network', generatedAt: new Date().toISOString() },
      zones: state.zones.map((z) => ({ id: z.id, label: z.label, color: z.color })),
      nodes: state.devices.map((d) => ({ id: d.id, label: d.label, type: d.type, zone: d.zone, status: d.status })),
      links,
    };
  }

  function loadNetwork(net) {
    const zones = (net.zones || []).map((z) => ({
      id: z.id || uniqueZoneId(z.label || 'zone'),
      label: z.label || z.id,
      color: z.color || '#7b8aa6',
    }));
    // Skip nodes without an id and drop duplicates (keep first); normalize
    // unknown type/status so the form selects always reflect the real value.
    const seen = new Set();
    const devices = [];
    for (const n of net.nodes || []) {
      if (!n || !n.id || seen.has(n.id)) continue;
      seen.add(n.id);
      devices.push({
        id: n.id,
        label: n.label || n.id,
        type: TYPE_BY_ID[n.type] ? n.type : 'generic',
        zone: n.zone || '',
        status: STATUSES.includes(n.status) ? n.status : 'ok',
        uplinks: [],
      });
    }
    const byId = new Map(devices.map((d) => [d.id, d]));
    for (const l of net.links || []) {
      const s = byId.get(l.source);
      if (s && byId.has(l.target) && !s.uplinks.includes(l.target)) s.uplinks.push(l.target);
    }
    state = {
      name: net.meta?.name || 'Imported Network',
      zones: zones.length ? zones : DEFAULT_ZONES.map((z) => ({ ...z })),
      devices,
      seq: devices.length + zones.length + 10,
    };
    render();
  }

  function loadBlank() {
    state = blankState();
    render();
  }
  function loadTemplate(key) {
    const t = TEMPLATES.find((x) => x.key === key);
    if (t) loadNetwork(JSON.parse(JSON.stringify(t.net)));
  }

  // ---- mutations ----
  const addZone = () => {
    const label = `Zone ${state.zones.length + 1}`;
    state.zones.push({ id: uniqueZoneId(label), label, color: pickColor(state.zones.length) });
    render();
  };
  const removeZone = (id) => {
    state.zones = state.zones.filter((z) => z.id !== id);
    for (const d of state.devices) if (d.zone === id) d.zone = '';
    render();
  };
  const moveZone = (id, dir) => {
    const i = state.zones.findIndex((z) => z.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= state.zones.length) return;
    [state.zones[i], state.zones[j]] = [state.zones[j], state.zones[i]];
    render();
  };
  const addDevice = (type = 'server', zone = state.zones[0]?.id || '', uplink = '') => {
    const n = state.devices.filter((d) => d.type === type).length + 1;
    state.devices.push({
      id: uid('dev'),
      label: `${typeLabel(type)} ${n}`,
      type,
      zone,
      status: 'ok',
      uplinks: uplink ? [uplink] : [],
    });
  };
  const addMany = (count, type, zone, uplink) => {
    for (let i = 0; i < Math.max(1, Math.min(50, count)); i++) addDevice(type, zone, uplink);
    render();
  };
  const removeDevice = (id) => {
    state.devices = state.devices.filter((d) => d.id !== id);
    for (const d of state.devices) d.uplinks = (d.uplinks || []).filter((u) => u !== id);
    render();
  };
  const addUplink = (id, up) => {
    const d = state.devices.find((x) => x.id === id);
    if (d && up && up !== id && !d.uplinks.includes(up)) {
      d.uplinks.push(up);
      render();
    }
  };
  const removeUplink = (id, up) => {
    const d = state.devices.find((x) => x.id === id);
    if (d) {
      d.uplinks = d.uplinks.filter((u) => u !== up);
      render();
    }
  };

  // ---- render ----
  function render() {
    const dev = state.devices;
    root.innerHTML = `
      <div class="builder-inner">
        <div class="builder-head">
          <h1>Describe your network</h1>
          <p>Pick a starting point, add your devices, and say what each connects to.
             Then hit <b>Visualize</b>. Use <b>Export</b> to save and share.</p>
          <div class="b-templates">
            <span>Start from:</span>
            ${TEMPLATES.map((t) => `<button class="b-tmpl" data-tmpl="${t.key}">${t.label}</button>`).join('')}
            <button class="b-tmpl" data-action="blank">Blank</button>
          </div>
        </div>

        <section class="b-card">
          <label class="b-field">
            <span>NETWORK NAME</span>
            <input id="b-name" type="text" value="${esc(state.name)}" placeholder="My Network" />
          </label>
        </section>

        <section class="b-card">
          <div class="b-card-head">
            <h2>Zones <span class="b-hint">network layers, outside in</span></h2>
            <button class="b-add" data-action="add-zone">+ Zone</button>
          </div>
          <div class="b-list">${state.zones.map(zoneRow).join('')}</div>
        </section>

        <section class="b-card">
          <div class="b-card-head">
            <h2>Devices <span class="b-count">${dev.length}</span></h2>
            <button class="b-add" data-action="add-device">+ Device</button>
          </div>

          <div class="b-quickadd">
            <span>Quick add</span>
            <input id="qa-count" type="number" min="1" max="50" value="5" />
            <span>×</span>
            ${typeSelect('workstation', 'qa-type')}
            <span>in</span>
            ${zoneSelect(state.zones[state.zones.length - 1]?.id || '', 'qa-zone')}
            <span>linked to</span>
            ${deviceSelect('', 'qa-uplink', true)}
            <button class="b-add" data-action="quick-add">Add</button>
          </div>

          <div class="b-list b-devices">
            ${dev.length ? dev.map(deviceCard).join('') : `<div class="b-empty">No devices yet. Pick a template above or click <b>+ Device</b>.</div>`}
          </div>
        </section>
      </div>`;
    bind();
    onChange?.(); // structural changes (add/remove/reorder) trigger a save
  }

  function zoneRow(z) {
    return `<div class="b-row b-zone-row" data-id="${z.id}">
      <input type="color" data-k="color" value="${z.color}" />
      <input type="text" data-k="label" value="${esc(z.label)}" placeholder="Zone name" />
      <div class="b-rowbtns">
        <button data-action="zone-up" title="Move left">▲</button>
        <button data-action="zone-down" title="Move right">▼</button>
        <button data-action="zone-del" class="del" title="Remove">✕</button>
      </div>
    </div>`;
  }

  function deviceCard(d) {
    const byId = new Map(state.devices.map((x) => [x.id, x]));
    const chips = (d.uplinks || [])
      .filter((u) => byId.has(u))
      .map(
        (u) =>
          `<span class="b-chip">${esc(byId.get(u).label)}<button data-action="unlink" data-up="${u}" title="Remove">✕</button></span>`,
      )
      .join('');
    return `<div class="b-devcard" data-id="${d.id}">
      <div class="b-devmain">
        <input type="text" data-k="label" value="${esc(d.label)}" placeholder="Device name" />
        ${typeSelect(d.type, null, 'type')}
        ${zoneSelect(d.zone, null, 'zone')}
        ${statusSelect(d.status)}
        <button data-action="device-del" class="del" title="Remove device">✕</button>
      </div>
      <div class="b-connects">
        <span class="b-connects-label">Connects to</span>
        <div class="b-chips">
          ${chips}
          ${deviceSelect('', null, false, d.id, 'addlink')}
        </div>
      </div>
    </div>`;
  }

  function typeSelect(val, id, dataK) {
    const groups = CATEGORIES.map((cat) => {
      const opts = DEVICE_TYPES.filter((t) => t.category === cat)
        .map((t) => `<option value="${t.id}" ${t.id === val ? 'selected' : ''}>${t.label}</option>`)
        .join('');
      return `<optgroup label="${cat}">${opts}</optgroup>`;
    }).join('');
    return `<select ${id ? `id="${id}"` : ''} ${dataK ? `data-k="${dataK}"` : ''}>${groups}</select>`;
  }
  function zoneSelect(val, id, dataK) {
    const opts = state.zones
      .map((z) => `<option value="${z.id}" ${z.id === val ? 'selected' : ''}>${esc(z.label)}</option>`)
      .join('');
    return `<select ${id ? `id="${id}"` : ''} ${dataK ? `data-k="${dataK}"` : ''}><option value="">- none -</option>${opts}</select>`;
  }
  function statusSelect(val) {
    const opts = STATUSES.map(
      (s) => `<option value="${s}" ${s === val ? 'selected' : ''}>${STATUS_UI[s].label}</option>`,
    ).join('');
    return `<select data-k="status">${opts}</select>`;
  }
  // device dropdown. `placeholderNone` for quick-add (allows "no uplink");
  // for the add-link picker, `excludeId` hides self + already-linked.
  function deviceSelect(val, id, placeholderNone, excludeId, action) {
    const exclude = excludeId ? state.devices.find((d) => d.id === excludeId) : null;
    const taken = new Set(exclude ? exclude.uplinks : []);
    const opts = state.devices
      .filter((d) => d.id !== excludeId && !taken.has(d.id))
      .map((d) => `<option value="${d.id}" ${d.id === val ? 'selected' : ''}>${esc(d.label)}</option>`)
      .join('');
    const ph = action === 'addlink' ? '+ connect…' : placeholderNone ? '(no uplink)' : '- device -';
    return `<select ${id ? `id="${id}"` : ''} ${action ? `data-action="${action}"` : ''}>
      <option value="">${ph}</option>${opts}</select>`;
  }

  // ---- events ----
  function bind() {
    document.getElementById('b-name').addEventListener('input', (e) => {
      state.name = e.target.value;
      onChange?.();
    });

    root.querySelectorAll('[data-tmpl]').forEach((b) =>
      b.addEventListener('click', () => loadTemplate(b.dataset.tmpl)),
    );

    root.querySelectorAll('[data-action]').forEach((node) => {
      const action = node.dataset.action;
      if (action === 'addlink') {
        node.addEventListener('change', (e) => {
          const id = node.closest('.b-devcard')?.dataset.id;
          if (e.target.value) addUplink(id, e.target.value);
        });
        return;
      }
      node.addEventListener('click', () => {
        const card = node.closest('.b-devcard, .b-zone-row');
        const id = card?.dataset.id;
        if (action === 'blank') loadBlank();
        else if (action === 'add-zone') addZone();
        else if (action === 'add-device') { addDevice(); render(); }
        else if (action === 'quick-add') {
          const count = parseInt(document.getElementById('qa-count').value, 10) || 1;
          addMany(count, document.getElementById('qa-type').value, document.getElementById('qa-zone').value, document.getElementById('qa-uplink').value);
        } else if (action === 'zone-up') moveZone(id, -1);
        else if (action === 'zone-down') moveZone(id, 1);
        else if (action === 'zone-del') removeZone(id);
        else if (action === 'device-del') removeDevice(id);
        else if (action === 'unlink') removeUplink(id, node.dataset.up);
      });
    });

    root.querySelectorAll('.b-zone-row').forEach((row) => {
      const z = state.zones.find((x) => x.id === row.dataset.id);
      row.querySelector('[data-k="color"]').addEventListener('input', (e) => { z.color = e.target.value; onChange?.(); });
      const lbl = row.querySelector('[data-k="label"]');
      lbl.addEventListener('input', (e) => { z.label = e.target.value; onChange?.(); });
      lbl.addEventListener('change', render);
    });

    root.querySelectorAll('.b-devcard').forEach((card) => {
      const d = state.devices.find((x) => x.id === card.dataset.id);
      const lbl = card.querySelector('[data-k="label"]');
      lbl.addEventListener('input', (e) => { d.label = e.target.value; onChange?.(); });
      lbl.addEventListener('change', render);
      card.querySelector('[data-k="type"]').addEventListener('change', (e) => { d.type = e.target.value; onChange?.(); });
      card.querySelector('[data-k="zone"]').addEventListener('change', (e) => { d.zone = e.target.value; onChange?.(); });
      card.querySelector('[data-k="status"]').addEventListener('change', (e) => { d.status = e.target.value; onChange?.(); });
    });
  }

  render();
  return { getNetwork, loadNetwork, loadBlank };
}

const PALETTE = ['#ff5a5a', '#ffb454', '#54a0ff', '#5af0c0', '#a98bff', '#ff8bd0', '#7bd88f', '#f7b7ff'];
const pickColor = (i) => PALETTE[i % PALETTE.length];
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
