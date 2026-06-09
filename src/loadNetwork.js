// Fetches network.json at runtime and validates it.
// The renderer is built ENTIRELY from whatever this returns - there is no
// hardcoded topology anywhere else in the app.

export async function loadNetwork(url) {
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    throw new Error(`Could not fetch "${url}" - is it in /public? (${e.message})`);
  }
  if (!res.ok) throw new Error(`Failed to load "${url}": HTTP ${res.status}`);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`"${url}" is not valid JSON: ${e.message}`);
  }
  return validateNetwork(data);
}

/**
 * Validates and normalizes a network description.
 * - Fatal problems (no nodes / not an object) throw.
 * - Recoverable problems (link → missing node, unknown zone, duplicate id)
 *   are logged clearly and the offending pieces are dropped, so the rest of
 *   the network still renders.
 * Returns { meta, zones, nodes, links (valid only), errors[], warnings[] }.
 */
export function validateNetwork(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('network.json must be a JSON object with { meta, zones, nodes, links }.');
  }

  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  const rawZones = Array.isArray(data.zones) ? data.zones : [];
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const rawLinks = Array.isArray(data.links) ? data.links : [];

  // Coerce zone colours to a safe #hex string (imported JSON may contain a
  // number, a CSS name, or junk - those would break canvas/Three colour parsing).
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const zones = rawZones.map((z) => {
    const color = typeof z.color === 'string' && HEX.test(z.color.trim()) ? z.color.trim() : '#7b8aa6';
    if (color !== z.color) warnings.push(`Zone "${z.id || z.label}" has an invalid colour - using a fallback.`);
    return { ...z, color };
  });

  if (!zones.length) warnings.push('No "zones" defined - nodes will use a fallback colour.');
  if (!nodes.length) throw new Error('network.json contains no "nodes" to render.');

  // Index nodes, catch duplicates / missing ids.
  const nodeIds = new Set();
  const zoneIds = new Set(zones.map((z) => z.id));
  const cleanNodes = [];
  nodes.forEach((n, i) => {
    if (!n || typeof n !== 'object' || !n.id) {
      errors.push(`nodes[${i}] is missing an "id" - skipped.`);
      return;
    }
    if (nodeIds.has(n.id)) {
      warnings.push(`Duplicate node id "${n.id}" - keeping the first occurrence.`);
      return;
    }
    nodeIds.add(n.id);
    if (n.zone && !zoneIds.has(n.zone)) {
      warnings.push(`Node "${n.id}" references unknown zone "${n.zone}".`);
    }
    cleanNodes.push(n);
  });

  // Validate links: both endpoints must resolve to a real node.
  const links = [];
  rawLinks.forEach((l, i) => {
    if (!l || typeof l !== 'object') {
      errors.push(`links[${i}] is not an object - skipped.`);
      return;
    }
    const missing = [];
    if (!nodeIds.has(l.source)) missing.push(`source "${l.source}"`);
    if (!nodeIds.has(l.target)) missing.push(`target "${l.target}"`);
    if (missing.length) {
      errors.push(`links[${i}] references missing node ${missing.join(' and ')} - skipped.`);
      return;
    }
    if (l.source === l.target) {
      warnings.push(`links[${i}] connects "${l.source}" to itself - skipped.`);
      return;
    }
    links.push(l);
  });

  // Log everything clearly.
  warnings.forEach((w) => console.warn('[network.json] ⚠ ' + w));
  errors.forEach((e) => console.error('[network.json] ✖ ' + e));
  console.info(
    `[network.json] loaded "${meta.name || 'unnamed'}": ` +
      `${cleanNodes.length} nodes, ${links.length} links, ${zones.length} zones` +
      (errors.length ? ` (${errors.length} error(s) - see above)` : ''),
  );

  return { meta, zones, nodes: cleanNodes, links, errors, warnings };
}
