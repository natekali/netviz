// Central tuning. Nothing here describes a specific network - only HOW any
// network is laid out, sized and lit. Topology comes entirely from the JSON.

export const CONFIG = {
  // --- layout (supports vertical top-down OR horizontal left→right) ---
  tierGapY: 25,           // gap between tiers when stacked vertically
  tierGapX: 34,           // gap between tiers when laid out horizontally
  nodeGapBreadth: 11,     // spacing of devices along a tier's breadth
  nodeGapZ: 12,           // depth spacing within a tier
  maxDepth: 3,            // keep tiers shallow (rows in Z)
  labelGap: 7,            // gap between a tier and its zone label

  // --- node cards ---
  cardHeight: 6.2,        // world height of a card sprite
  bobAmplitude: 0.2,      // gentle vertical bob
  selectScale: 1.25,
  haloBaseOpacity: 0.12,  // faint zone glow behind healthy nodes
  dimOpacity: 0.13,       // card opacity when dimmed by focus

  // --- links ---
  tubeSegments: 24,
  tubeRadialSegments: 6,
  tubeRadiusMin: 0.05,
  tubeRadiusMax: 0.17,
  linkCurveLift: 2.2,     // base upward bow of each link curve
  linkCurveDistFactor: 0.05,
  linkOpacity: 0.28,
  linkOpacityOffline: 0.05,
  linkFocusConnected: 0.95,
  linkFocusDim: 0.035,

  // --- packets ---
  maxPacketsPerLink: 4,
  packetSpeed: 0.16,      // base curve-fraction per second (scaled by traffic)
  packetSize: 7,          // small points for a clean render
  packetDimAlpha: 0.05,

  // --- bloom (subtle - cards must stay crisp) ---
  bloomStrength: 0.32,
  bloomRadius: 0.4,
  bloomThreshold: 0.62,

  // --- camera ---
  fov: 50,
  flyDuration: 0.75,      // seconds
  focusDistance: 22,      // how far the camera sits from a focused node

  // --- fallbacks for unknown / malformed data ---
  fallbackZoneColor: '#7b8aa6',
};
