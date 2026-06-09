// Onboarding / import. Two reliable paths in one panel:
//   1. "From a diagram" - a ready-made prompt the user pastes (with their PNG /
//      Visio screenshot) into ChatGPT or Claude to get a valid network.json,
//      then pastes the result back here.
//   2. "Paste / file" - paste JSON or upload a .json file.
// Both go through the same validator with clear, inline feedback.
import { DEVICE_TYPES } from './catalog.js';
import { validateNetwork } from './loadNetwork.js';

function buildPrompt() {
  const types = DEVICE_TYPES.map((t) => t.id).join(', ');
  return `You convert network diagrams into JSON for the Netviz 3D topology viewer.
I'll give you an image of a network diagram (or a description). Reply with ONLY one
valid JSON object - no prose, no markdown fences - matching this schema exactly:

{
  "meta": { "name": "<network name>" },
  "zones": [ { "id": "<short-id>", "label": "<Zone name>", "color": "<#hex>" } ],
  "nodes": [ { "id": "<unique-id>", "label": "<device name>", "type": "<type>", "zone": "<zone id>", "status": "ok" } ],
  "links": [ { "source": "<node id>", "target": "<node id>" } ]
}

Rules:
- "type" must be one of: ${types}. Pick the closest match; use "generic" if unsure.
- Group devices into "zones" (segments/tiers): e.g. Perimeter, DMZ, Core, Internal LAN, Cloud.
  Order them external -> internal; give each a distinct hex colour.
- "status" is one of: ok | warning | critical | offline (default "ok").
- A link's "source"/"target" must each equal a node "id".
- Use short unique ids. Only include devices actually shown in the diagram.
Output the JSON now.`;
}

export function createImportModal({ onImport }) {
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>Import a network</h2>
      <p class="modal-sub">Already have your topology as a diagram or a JSON file? Bring it in.</p>

      <div class="modal-tabs">
        <button data-tab="ai" class="active">From a diagram</button>
        <button data-tab="json">Paste / file</button>
      </div>

      <div data-pane="ai">
        <div class="modal-step"><span class="num">1</span><span class="txt">Copy the prompt below.</span></div>
        <div class="modal-step"><span class="num">2</span><span class="txt">Open <b>ChatGPT</b> or <b>Claude</b>, paste the prompt, and attach a screenshot of your network diagram (PNG, Visio export, whiteboard photo…).</span></div>
        <div class="modal-step"><span class="num">3</span><span class="txt">Paste the JSON it returns into the box below and hit <b>Import</b>.</span></div>
        <div class="code-block">
          <button class="code-copy" data-copy>Copy prompt</button>
          <pre id="im-prompt"></pre>
        </div>
      </div>

      <div data-pane="json" hidden>
        <div class="modal-step"><span class="txt">Upload a <b>.json</b> file you exported earlier, or paste its contents below.</span></div>
        <div class="file-drop" data-drop>Click to choose a .json file</div>
        <input type="file" accept="application/json,.json" hidden data-file />
      </div>

      <textarea data-json placeholder="Paste your network JSON here…"></textarea>

      <div class="modal-actions">
        <span class="hint grow" data-status></span>
        <button class="btn-ghost" data-close>Cancel</button>
        <button class="btn-primary" data-import>Import</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.querySelector('#im-prompt').textContent = buildPrompt();
  const ta = el.querySelector('[data-json]');
  const status = el.querySelector('[data-status]');
  const fileInput = el.querySelector('[data-file]');

  const setStatus = (msg, err) => {
    status.textContent = msg || '';
    status.style.color = err ? 'var(--critical)' : 'var(--faint)';
  };

  const open = () => {
    setStatus('');
    el.classList.add('show');
  };
  const close = () => el.classList.remove('show');

  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  el.querySelector('[data-close]').onclick = close;

  el.querySelectorAll('.modal-tabs button').forEach((b) => {
    b.onclick = () => {
      el.querySelectorAll('.modal-tabs button').forEach((x) => x.classList.toggle('active', x === b));
      el.querySelector('[data-pane="ai"]').hidden = b.dataset.tab !== 'ai';
      el.querySelector('[data-pane="json"]').hidden = b.dataset.tab !== 'json';
    };
  });

  el.querySelector('[data-copy]').onclick = async (e) => {
    try {
      await navigator.clipboard.writeText(buildPrompt());
      e.target.textContent = 'Copied ✓';
      setTimeout(() => (e.target.textContent = 'Copy prompt'), 1600);
    } catch {
      const r = document.createRange();
      r.selectNodeContents(el.querySelector('#im-prompt'));
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
  };

  el.querySelector('[data-drop]').onclick = () => fileInput.click();
  fileInput.onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      ta.value = await f.text();
      setStatus(`Loaded ${f.name} - review and Import.`);
    } catch (err) {
      setStatus('Could not read that file: ' + err.message, true);
    }
  };

  el.querySelector('[data-import]').onclick = () => {
    const raw = ta.value.trim();
    if (!raw) return setStatus('Paste some JSON first.', true);
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return setStatus('That isn’t valid JSON: ' + err.message, true);
    }
    let net;
    try {
      net = validateNetwork(data);
    } catch (err) {
      return setStatus(err.message, true);
    }
    onImport(net);
    close();
  };

  return { open };
}
