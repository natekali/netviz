// App shell: wires the top bar, the builder form and the 3D viewer together,
// plus Import / Export / Sample / New and view switching.
import { createViewer } from './viewer.js';
import { createBuilder } from './builder.js';
import { createImportModal } from './importModal.js';
import { loadNetwork as fetchNetwork, validateNetwork } from './loadNetwork.js';
import { hideLoader, clearError } from './ui.js';

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = 'netviz.draft.v1';

let viewer = null;
let builder = null;
let ready = false;
let saveTimer = null;

// Persist the builder state (debounced) so nothing is lost on refresh.
function saveDraft() {
  if (!ready) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(builder.getNetwork()));
    } catch {
      /* storage full / unavailable - ignore */
    }
  }, 400);
}

function loadDraft() {
  try {
    const s = localStorage.getItem(DRAFT_KEY);
    if (!s) return null;
    return validateNetwork(JSON.parse(s));
  } catch {
    return null;
  }
}

function setView(v) {
  $('builder').hidden = v !== 'builder';
  $('hud').hidden = v !== 'viewer';
  document.querySelectorAll('#topbar .tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === v);
  });
}

function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// Build the current form into a validated network and show it in 3D.
function visualize() {
  let net;
  try {
    net = validateNetwork(builder.getNetwork());
  } catch (e) {
    toast(e.message, true);
    setView('builder');
    return false;
  }
  viewer.setNetwork(net);
  setView('viewer');
  clearError();
  return true;
}

function exportJSON() {
  const net = builder.getNetwork();
  const name = (net.meta.name || 'network').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const blob = new Blob([JSON.stringify(net, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name || 'network'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`Exported ${a.download}`);
}

function onImport(net) {
  builder.loadNetwork(net);
  viewer.setNetwork(net);
  setView('builder');
  toast(`Imported ${net.nodes.length} devices. Edit, then Visualize.`);
}

async function loadSample(initial) {
  try {
    const net = await fetchNetwork('network.json');
    builder.loadNetwork(net);
    viewer.setNetwork(net);
    if (!initial) {
      setView('viewer');
      toast(`Loaded sample: ${net.nodes.length} devices`);
    }
  } catch (err) {
    if (!initial) toast('Could not load sample: ' + err.message, true);
  }
}

(async () => {
  viewer = await createViewer($('app'));
  builder = createBuilder($('builder'), { onChange: saveDraft });
  const importModal = createImportModal({ onImport });

  // tabs: "3D View" always reflects the current form
  document.querySelectorAll('#topbar .tabs button').forEach((b) => {
    b.onclick = () => (b.dataset.view === 'viewer' ? visualize() : setView('builder'));
  });

  $('btn-visualize').onclick = visualize;
  $('btn-export').onclick = exportJSON;
  $('btn-new').onclick = () => {
    builder.loadBlank();
    setView('builder');
    toast('Started a blank network');
  };
  $('btn-sample').onclick = () => loadSample(false);
  $('btn-import').onclick = () => importModal.open();

  // Restore the saved draft if there is one; otherwise start from the sample.
  const draft = loadDraft();
  if (draft) {
    builder.loadNetwork(draft);
    viewer.setNetwork(draft);
  } else {
    await loadSample(true);
  }
  ready = true;
  setView('builder');
  hideLoader();
})();
