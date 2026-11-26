// Menyalin mesin FFmpeg (core + wasm) dari node_modules ke public/ffmpeg
// supaya ikut ter-deploy di alamat situs yang sama (tanpa bergantung CDN).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@ffmpeg", "core", "dist", "esm");
const target = join(root, "public", "ffmpeg");
const files = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

if (!files.every((file) => existsSync(join(source, file)))) {
  console.warn("[copy-ffmpeg] Berkas @ffmpeg/core tidak ditemukan; situs akan memakai CDN sebagai cadangan.");
  process.exit(0);
}

mkdirSync(target, { recursive: true });
for (const file of files) {
  cpSync(join(source, file), join(target, file));
}
console.log("[copy-ffmpeg] Mesin ekspor disalin ke public/ffmpeg");
