// Menyiapkan berkas tambahan sebelum build (dijalankan otomatis oleh "npm run build"):
//  1. Menyalin mesin FFmpeg (core + wasm) dari node_modules ke public/ffmpeg
//  2. Membuat ikon aplikasi (PNG), manifest, dan service worker di public/
// Semuanya dibuat saat build, jadi tidak ada berkas biner yang perlu diunggah ke repo.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

// ---------- 1. Mesin FFmpeg ----------
function copyFFmpeg() {
  const source = join(root, "node_modules", "@ffmpeg", "core", "dist", "esm");
  const target = join(publicDir, "ffmpeg");
  const files = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

  if (!files.every((file) => existsSync(join(source, file)))) {
    console.warn("[prepare] Berkas @ffmpeg/core tidak ditemukan; situs akan memakai CDN sebagai cadangan.");
    return;
  }

  mkdirSync(target, { recursive: true });
  for (const file of files) cpSync(join(source, file), join(target, file));
  console.log("[prepare] Mesin ekspor disalin ke public/ffmpeg");
}

// ---------- 2. Ikon PNG ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Lambang "Q": cincin emas dengan ekor, di atas latar gelap.
function drawIcon(size) {
  const background = [11, 11, 14];
  const gold = [231, 201, 148];
  const ringRadius = 0.27;
  const thickness = 0.058;
  const samples = 3;
  const raw = Buffer.alloc((size * 4 + 1) * size);

  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;

    for (let x = 0; x < size; x++) {
      let coverage = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = (x + (sx + 0.5) / samples) / size;
          const v = (y + (sy + 0.5) / samples) / size;
          const ring = Math.abs(Math.hypot(u - 0.5, v - 0.5) - ringRadius) <= thickness / 2;
          const tail = distanceToSegment(u, v, 0.58, 0.58, 0.73, 0.74) <= thickness / 2;
          if (ring || tail) coverage += 1;
        }
      }

      coverage /= samples * samples;
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      for (let channel = 0; channel < 3; channel++) {
        raw[offset + channel] = Math.round(background[channel] + (gold[channel] - background[channel]) * coverage);
      }
      raw[offset + 3] = 255;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // kedalaman bit
  header[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function writeIconsAndManifest() {
  const iconDir = join(publicDir, "icons");
  mkdirSync(iconDir, { recursive: true });

  writeFileSync(join(iconDir, "apple-touch-icon.png"), drawIcon(180));
  writeFileSync(join(iconDir, "icon-192.png"), drawIcon(192));
  writeFileSync(join(iconDir, "icon-512.png"), drawIcon(512));

  const manifest = {
    name: "QuietFrame",
    short_name: "QuietFrame",
    description: "Buat video kutipan vertikal 9:16 untuk TikTok langsung di HP.",
    lang: "id",
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0e",
    theme_color: "#0b0b0e",
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };

  writeFileSync(join(publicDir, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));
  console.log("[prepare] Ikon dan manifest dibuat di public/");
}

// ---------- 3. Service worker ----------
// Hanya menyimpan berkas berat yang tidak berubah (mesin ekspor dan aset ber-hash),
// jadi halaman utama selalu diambil dari jaringan dan pembaruan langsung terlihat.
function writeServiceWorker() {
  const source = `const CACHE = "quietframe-${version}";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const heavy = /\\/ffmpeg\\/ffmpeg-core\\.(js|wasm)$/.test(url.pathname) || /\\/assets\\//.test(url.pathname);
  if (!heavy) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  })());
});
`;

  writeFileSync(join(publicDir, "sw.js"), source);
  console.log("[prepare] Service worker dibuat di public/sw.js");
}

mkdirSync(publicDir, { recursive: true });
copyFFmpeg();
writeIconsAndManifest();
writeServiceWorker();
