// Shared vocabulary for BOTH the builder form and the 3D viewer.
// Comprehensive device catalogue covering networking, security, compute,
// storage, data, applications, endpoints, cloud and facilities - each mapped
// to a recognizable Lucide icon. Unknown types fall back to a generic box.

export const DEVICE_TYPES = [
  // Network
  { id: 'internet',     label: 'Internet / WAN',  category: 'Network',     icon: 'globe' },
  { id: 'router',       label: 'Router',          category: 'Network',     icon: 'router' },
  { id: 'switch',       label: 'Switch',          category: 'Network',     icon: 'network' },
  { id: 'loadbalancer', label: 'Load Balancer',   category: 'Network',     icon: 'waypoints' },
  { id: 'proxy',        label: 'Reverse Proxy',   category: 'Network',     icon: 'arrow-left-right' },
  { id: 'gateway',      label: 'Gateway',         category: 'Network',     icon: 'route' },
  { id: 'ap',           label: 'Wireless AP',     category: 'Network',     icon: 'wifi' },

  // Security
  { id: 'firewall',     label: 'Firewall',        category: 'Security',    icon: 'brick-wall' },
  { id: 'ids',          label: 'IDS / IPS',       category: 'Security',    icon: 'shield-alert' },
  { id: 'vpn',          label: 'VPN Gateway',     category: 'Security',    icon: 'lock-keyhole' },
  { id: 'siem',         label: 'SIEM / Logging',  category: 'Security',    icon: 'file-search' },

  // Compute
  { id: 'server',       label: 'Server',          category: 'Compute',     icon: 'server' },
  { id: 'vm',           label: 'Virtual Machine', category: 'Compute',     icon: 'box' },
  { id: 'hypervisor',   label: 'Hypervisor Host', category: 'Compute',     icon: 'server-cog' },
  { id: 'container',    label: 'Container / K8s', category: 'Compute',     icon: 'container' },
  { id: 'mainframe',    label: 'Mainframe',       category: 'Compute',     icon: 'cpu' },

  // Application / services
  { id: 'webserver',    label: 'Web Server',      category: 'Application', icon: 'app-window' },
  { id: 'appserver',    label: 'App Server',      category: 'Application', icon: 'boxes' },
  { id: 'mail',         label: 'Mail Server',     category: 'Application', icon: 'mail' },
  { id: 'dns',          label: 'DNS / DHCP',      category: 'Application', icon: 'globe' },
  { id: 'directory',    label: 'Directory / AD',  category: 'Application', icon: 'users-round' },
  { id: 'monitoring',   label: 'Monitoring',      category: 'Application', icon: 'activity' },

  // Data
  { id: 'database',     label: 'Database',        category: 'Data',        icon: 'database' },
  { id: 'datawarehouse',label: 'Data Warehouse',  category: 'Data',        icon: 'warehouse' },

  // Storage
  { id: 'nas',          label: 'NAS',             category: 'Storage',     icon: 'hard-drive' },
  { id: 'san',          label: 'SAN / Storage',   category: 'Storage',     icon: 'hard-drive' },
  { id: 'backup',       label: 'Backup',          category: 'Storage',     icon: 'archive' },

  // Endpoints
  { id: 'workstation',  label: 'Workstation',     category: 'Endpoint',    icon: 'monitor' },
  { id: 'laptop',       label: 'Laptop',          category: 'Endpoint',    icon: 'laptop' },
  { id: 'mobile',       label: 'Mobile Device',   category: 'Endpoint',    icon: 'smartphone' },
  { id: 'voip',         label: 'VoIP Phone',      category: 'Endpoint',    icon: 'phone' },
  { id: 'printer',      label: 'Printer / MFP',   category: 'Endpoint',    icon: 'printer' },
  { id: 'camera',       label: 'IP Camera',       category: 'Endpoint',    icon: 'cctv' },
  { id: 'iot',          label: 'IoT Device',      category: 'Endpoint',    icon: 'cpu' },
  { id: 'pos',          label: 'POS Terminal',    category: 'Endpoint',    icon: 'credit-card' },

  // Cloud / SaaS
  { id: 'cloud',        label: 'Cloud / VPC',     category: 'Cloud',       icon: 'cloud' },
  { id: 'saas',         label: 'SaaS App',        category: 'Cloud',       icon: 'cloud' },
  { id: 'cdn',          label: 'CDN',             category: 'Cloud',       icon: 'globe' },

  // Facilities / other
  { id: 'ups',          label: 'UPS / Power',     category: 'Facilities',  icon: 'battery-charging' },
  { id: 'generic',      label: 'Generic Device',  category: 'Other',       icon: 'box' },
];

export const TYPE_BY_ID = Object.fromEntries(DEVICE_TYPES.map((t) => [t.id, t]));
export const FALLBACK_ICON = 'box';

// All distinct icon names we actually need to rasterize.
export const UNIQUE_ICONS = [...new Set(DEVICE_TYPES.map((t) => t.icon)), FALLBACK_ICON];

// Categories in display order (for grouping the builder dropdown / legend).
export const CATEGORIES = [...new Set(DEVICE_TYPES.map((t) => t.category))];

export function typeLabel(id) {
  return TYPE_BY_ID[id]?.label || id;
}
export function typeIcon(id) {
  return TYPE_BY_ID[id]?.icon || FALLBACK_ICON;
}

// Sensible default zones (tiers, left→right). Fully editable in the builder.
export const DEFAULT_ZONES = [
  { id: 'edge',  label: 'Perimeter',     color: '#ff5a5a' },
  { id: 'dmz',   label: 'DMZ',           color: '#ffb454' },
  { id: 'core',  label: 'Core',          color: '#54a0ff' },
  { id: 'lan',   label: 'Internal LAN',  color: '#5af0c0' },
  { id: 'cloud', label: 'Cloud / SaaS',  color: '#a98bff' },
];

export const LINK_TYPES = ['trunk', 'access', 'wan', 'vpn', 'wireless', 'storage', 'internet'];

export const STATUSES = ['ok', 'warning', 'critical', 'offline'];
export const STATUS_UI = {
  ok: { label: 'Healthy', color: '#5af0c0' },
  warning: { label: 'Warning', color: '#ffc24d' },
  critical: { label: 'Critical', color: '#ff5a5a' },
  offline: { label: 'Offline', color: '#6a7689' },
};
