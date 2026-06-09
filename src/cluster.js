// Collapses identical devices into one node so large networks stay readable.
// Two devices merge only when they're truly interchangeable: same zone, type
// and status, AND wired to exactly the same neighbours. The merged node carries
// a count and its member list; links are remapped and de-duplicated.
import { typeLabel } from './catalog.js';

export function clusterNetwork(network) {
  const adj = new Map();
  const add = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
  };
  for (const l of network.links) {
    add(l.source, l.target);
    add(l.target, l.source);
  }

  const groups = new Map();
  for (const n of network.nodes) {
    const neigh = [...(adj.get(n.id) || [])].sort().join(',');
    const key = `${n.zone}||${n.type}||${n.status || 'ok'}||${neigh}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  }

  const idMap = new Map();
  const nodes = [];
  let ci = 0;
  for (const members of groups.values()) {
    if (members.length === 1) {
      const n = members[0];
      idMap.set(n.id, n.id);
      nodes.push({ ...n, count: 1 });
    } else {
      const id = `cluster-${ci++}`;
      const first = members[0];
      nodes.push({
        id,
        label: `${typeLabel(first.type)} ×${members.length}`,
        type: first.type,
        zone: first.zone,
        status: first.status || 'ok',
        count: members.length,
        members: members.map((m) => ({ id: m.id, label: m.label || m.id })),
      });
      for (const m of members) idMap.set(m.id, id);
    }
  }

  const seen = new Set();
  const links = [];
  for (const l of network.links) {
    const s = idMap.get(l.source);
    const t = idMap.get(l.target);
    if (!s || !t || s === t) continue;
    const k = [s, t].sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    links.push({ source: s, target: t, type: l.type });
  }

  return { meta: network.meta, zones: network.zones, nodes, links };
}
