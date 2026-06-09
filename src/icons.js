// Loads Lucide SVG icons (imported as raw strings by Vite) and rasterizes them
// to HTMLImageElements we can draw onto the node "card" canvases. We recolour
// `currentColor` and bump the intrinsic size so they stay crisp.
import globe from 'lucide-static/icons/globe.svg?raw';
import router from 'lucide-static/icons/router.svg?raw';
import network from 'lucide-static/icons/network.svg?raw';
import waypoints from 'lucide-static/icons/waypoints.svg?raw';
import arrowLeftRight from 'lucide-static/icons/arrow-left-right.svg?raw';
import route from 'lucide-static/icons/route.svg?raw';
import wifi from 'lucide-static/icons/wifi.svg?raw';
import brickWall from 'lucide-static/icons/brick-wall.svg?raw';
import shieldAlert from 'lucide-static/icons/shield-alert.svg?raw';
import lockKeyhole from 'lucide-static/icons/lock-keyhole.svg?raw';
import fileSearch from 'lucide-static/icons/file-search.svg?raw';
import server from 'lucide-static/icons/server.svg?raw';
import box from 'lucide-static/icons/box.svg?raw';
import serverCog from 'lucide-static/icons/server-cog.svg?raw';
import container from 'lucide-static/icons/container.svg?raw';
import cpu from 'lucide-static/icons/cpu.svg?raw';
import appWindow from 'lucide-static/icons/app-window.svg?raw';
import boxes from 'lucide-static/icons/boxes.svg?raw';
import database from 'lucide-static/icons/database.svg?raw';
import warehouse from 'lucide-static/icons/warehouse.svg?raw';
import mail from 'lucide-static/icons/mail.svg?raw';
import usersRound from 'lucide-static/icons/users-round.svg?raw';
import activity from 'lucide-static/icons/activity.svg?raw';
import hardDrive from 'lucide-static/icons/hard-drive.svg?raw';
import archive from 'lucide-static/icons/archive.svg?raw';
import monitor from 'lucide-static/icons/monitor.svg?raw';
import laptop from 'lucide-static/icons/laptop.svg?raw';
import smartphone from 'lucide-static/icons/smartphone.svg?raw';
import phone from 'lucide-static/icons/phone.svg?raw';
import printer from 'lucide-static/icons/printer.svg?raw';
import cctv from 'lucide-static/icons/cctv.svg?raw';
import creditCard from 'lucide-static/icons/credit-card.svg?raw';
import cloud from 'lucide-static/icons/cloud.svg?raw';
import batteryCharging from 'lucide-static/icons/battery-charging.svg?raw';

const RAW = {
  globe, router, network, waypoints, 'arrow-left-right': arrowLeftRight, route, wifi,
  'brick-wall': brickWall, 'shield-alert': shieldAlert, 'lock-keyhole': lockKeyhole,
  'file-search': fileSearch, server, box, 'server-cog': serverCog, container, cpu,
  'app-window': appWindow, boxes, database, warehouse, mail, 'users-round': usersRound,
  activity, 'hard-drive': hardDrive, archive, monitor, laptop, smartphone, phone,
  printer, cctv, 'credit-card': creditCard, cloud, 'battery-charging': batteryCharging,
};

function rasterize(rawSvg, color, size) {
  const svg = rawSvg
    .replace(/currentColor/g, color)
    .replace('width="24"', `width="${size}"`)
    .replace('height="24"', `height="${size}"`)
    .replace('stroke-width="2"', 'stroke-width="1.8"');
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Preload the given icon names as white images at `size` px.
 * Returns a map { iconName -> HTMLImageElement|null }.
 */
export async function loadIconImages(names, { color = '#eaf2ff', size = 128 } = {}) {
  const out = {};
  await Promise.all(
    names.map(async (n) => {
      const raw = RAW[n] || RAW.box;
      out[n] = await rasterize(raw, color, size);
    }),
  );
  return out;
}
