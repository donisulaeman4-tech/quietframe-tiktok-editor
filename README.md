# QuietFrame — TikTok Quote Editor

A static browser-based video editor for short quote videos. It uses FFmpeg.wasm to render a 9:16 MP4 locally in the browser.

## Features
- Upload one video up to 120 MB and export lengths up to 60 seconds (MP4/H.264 recommended).
- Enter up to 650 characters; wrapping and font size adapt automatically.
- Six looks: Cinematic Dark, Moody Blue, Warm Vintage, Black & White, Soft Film, and Deep Contrast.
- Filter intensity and local background blur controls.
- Four quote font styles: Elegant Serif, Modern Clean, Bold Impact, and Soft Minimal.
- Text color and safe-area vertical position controls.
- Export MP4 in 1080 × 1920 (Full HD) or 720 × 1280 (HD), 9:16.
- Preserve original audio or mute the output.
- Video processing runs in the browser; the video file is not uploaded to an app server.
- Responsive interface with an approximate TikTok safe-area preview.

## Run locally
Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy free with GitHub Pages
1. Create a new public GitHub repository, for example `quietframe-tiktok-editor`.
2. Upload all files and folders from this project to the repository root.
3. Ensure the default branch is named `main`.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, choose **GitHub Actions** as the source.
6. Open **Actions** and wait for the `Deploy QuietFrame to GitHub Pages` workflow to finish.
7. Your site URL will be `https://YOUR-USERNAME.github.io/quietframe-tiktok-editor/`.

The included workflow builds the Vite app and publishes `dist/` automatically after each push to `main`.

## Important compatibility notes
- The FFmpeg WebAssembly engine (roughly 30 MB) is copied into the site at build time (scripts/copy-ffmpeg.mjs) and served from the same GitHub Pages address, with unpkg and jsDelivr as fallbacks. It downloads on the first export, so an internet connection is required for that first load. Google Fonts are also loaded online; fallback system fonts are used if unavailable.
- Rendering is local, but video encoding is resource-intensive. iPhones may render slowly or stop a tab if memory is low. Keep the source video short and reasonably sized; close other tabs/apps before rendering.
- The app limits input to 20 seconds and 120 MB. For best compatibility use MP4 with H.264 video and AAC audio.
- Some iOS Safari versions/codecs may not support every MOV/HEVC source. If a video fails, convert it to MP4/H.264 before upload.
- The exported video is cropped to fill 9:16. Very wide or square source videos will lose content at the sides or top/bottom. 1080p export does not add detail that was absent from a low-resolution source.
- The preview is an approximate safe-area guide, not an exact TikTok UI emulator. Check the final video in TikTok's upload preview before publishing.
- iPhone Safari may run out of memory or pause a tab during encoding, especially at 1080p. For older phones, choose 720p, close other tabs, and use a small MP4 source. This project has not been validated on every iPhone/Safari version.
- Audio is either kept from the source video or removed. Uploading a separate music track and mixing multiple audio tracks are not included in this release.
- No AI text generation is included: the user supplies the quote. Text layout and rendering are automatic.

## License
Project interface code: MIT. FFmpeg.wasm and FFmpeg core are separate upstream projects with their own licenses and notices. Review the upstream FFmpeg.wasm documentation and FFmpeg licensing before redistributing modified binaries.


## Fitur (v1.0.7)

- Latar polos atau gradasi tanpa perlu upload video.
- Pilih bagian video (mulai dari detik ke-berapa), ulangi video sampai durasi penuh, dan kecepatan 1×, 0,75×, 0,5×.
- Foto bergerak pelan (zoom).
- Bayangan dan garis tepi teks, animasi teks perlahan atau baris demi baris.
- Gaya cepat (Minimalis, Sinematik, Galau, Hangat, Tegas).
- Garis zona aman TikTok saat menggeser teks.
- Saran durasi dari panjang kutipan, putar hasil sebelum disimpan, dan tombol Bagikan.
- Bisa dipasang di layar utama HP. Ikon, manifest, dan service worker dibuat otomatis saat build
  oleh `scripts/copy-ffmpeg.mjs`, jadi tidak ada berkas biner yang perlu diunggah ke repo.
