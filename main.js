import './style.css';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const $ = (id) => document.getElementById(id);
const fileInput = $('videoFile');
const quoteInput = $('quoteText');
const previewVideo = $('previewVideo');
const previewQuote = $('previewQuote');
const quotePanel = $('quotePanel');
const renderBtn = $('renderBtn');
const ffmpeg = new FFmpeg();
let selectedFile = null;
let selectedDuration = 0;
let selectedStyle = 'cinematic';
let selectedFont = 'serif';
let outputUrl = null;
let ffmpegLoaded = false;
let ffmpegLoading = null;

const looks = {
  cinematic: { contrast: 1.20, saturation: .78, brightness: -.035, vignette: .34, panel: 'rgba(5,6,8,.78)' },
  blue:      { contrast: 1.12, saturation: .82, brightness: -.025, vignette: .30, panel: 'rgba(5,10,19,.78)' },
  warm:      { contrast: 1.10, saturation: 1.12, brightness: .005, vignette: .25, panel: 'rgba(20,12,6,.74)' },
  mono:      { contrast: 1.16, saturation: 0, brightness: -.01, vignette: .36, panel: 'rgba(5,5,5,.80)' },
  soft:      { contrast: 1.04, saturation: .88, brightness: -.008, vignette: .18, panel: 'rgba(8,10,13,.70)' },
  deep:      { contrast: 1.34, saturation: 1.04, brightness: -.025, vignette: .40, panel: 'rgba(0,0,0,.82)' }
};
const fontFamilies = {
  serif: '"Playfair Display", Georgia, serif',
  clean: '"DM Sans", Arial, sans-serif',
  bold: '"Montserrat", Arial, sans-serif',
  soft: '"DM Sans", Arial, sans-serif'
};
const fontWeights = { serif: 500, clean: 500, bold: 800, soft: 300 };

function setProgress(title, pct, note) {
  $('progressWrap').hidden = false;
  $('progressTitle').textContent = title;
  $('progressPct').textContent = `${Math.round(pct)}%`;
  $('progressBar').style.width = `${Math.max(0, Math.min(100, pct))}%`;
  $('progressNote').textContent = note || '';
}
function showError(message) { $('errorBox').textContent = message; $('errorBox').hidden = false; }
function clearError() { $('errorBox').hidden = true; $('errorBox').textContent = ''; }
function updateButton() { renderBtn.disabled = !(selectedFile && quoteInput.value.trim()); }
function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function getDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { const duration = video.duration; URL.revokeObjectURL(url); resolve(duration); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video tidak dapat dibaca browser. Coba MP4 (H.264).')); };
    video.src = url;
  });
}
fileInput.addEventListener('change', async () => {
  clearError();
  selectedFile = null; selectedDuration = 0; updateButton();
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('video/')) return showError('Pilih file video, bukan gambar atau dokumen.');
  if (file.size > 120 * 1024 * 1024) return showError('Ukuran file terlalu besar. Untuk HP, gunakan video maksimal 120 MB.');
  try {
    const duration = await getDuration(file);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Durasi video tidak terbaca.');
    if (duration > 20.05) return showError(`Durasi video ${duration.toFixed(1)} detik. Maksimal 20 detik.`);
    selectedFile = file;
    selectedDuration = duration;
    const url = URL.createObjectURL(file);
    if (previewVideo.dataset.url) URL.revokeObjectURL(previewVideo.dataset.url);
    previewVideo.dataset.url = url;
    previewVideo.src = url;
    previewVideo.play().catch(() => {});
    $('fileHint').textContent = file.name;
    $('videoMeta').hidden = false;
    $('videoMeta').textContent = `${file.name} · ${duration.toFixed(1)} detik · ${formatBytes(file.size)}`;
    updateButton();
    updatePreviewText();
  } catch (error) { showError(error.message || 'Gagal membaca video.'); }
});

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}
function layoutText(ctx, text, maxWidth, maxHeight, fontKey) {
  const chars = text.trim().length;
  let size = chars < 75 ? 54 : chars < 150 ? 48 : chars < 260 ? 42 : 36;
  let lines = [];
  while (size >= 28) {
    ctx.font = `${fontWeights[fontKey]} ${size}px ${fontFamilies[fontKey]}`;
    lines = wrapText(ctx, text.trim(), maxWidth);
    const lineHeight = size * (fontKey === 'serif' ? 1.42 : 1.48);
    if (lines.length * lineHeight <= maxHeight && lines.length <= 12) break;
    size -= 2;
  }
  const finalSize = Math.max(28, size);
  return { size: finalSize, lines, lineHeight: finalSize * (fontKey === 'serif' ? 1.42 : 1.48) };
}
async function makeOverlay(text, styleName, resolution) {
  if (document.fonts?.ready) await document.fonts.ready;
  const factor = resolution / 1080;
  const width = resolution;
  const height = Math.round(resolution * 16 / 9);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const style = looks[styleName];
  const fontKey = selectedFont;
  const x = Math.round(80 * factor);
  const maxTextWidth = Math.round(760 * factor);
  const maxTextHeight = Math.round(650 * factor);
  const layout = layoutText(ctx, text, maxTextWidth, maxTextHeight, fontKey);
  ctx.font = `${fontWeights[fontKey]} ${Math.round(layout.size * factor)}px ${fontFamilies[fontKey]}`;
  const measured = Math.min(maxTextWidth, Math.max(...layout.lines.map(line => ctx.measureText(line).width), 260 * factor));
  const panelW = Math.min(Math.round(850 * factor), Math.round(measured + 62 * factor));
  const panelH = Math.round(layout.lines.length * layout.lineHeight * factor + 48 * factor);
  const position = $('textPosition').value;
  const centerY = position === 'upper' ? height * .38 : position === 'lower' ? height * .59 : height * .49;
  const panelY = Math.max(Math.round(260 * factor), Math.min(Math.round(1120 * factor), Math.round(centerY - panelH / 2)));
  const panelX = Math.max(28 * factor, x - 22 * factor);
  const radius = 22 * factor;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.24)'; ctx.shadowBlur = 28 * factor;
  ctx.fillStyle = style.panel;
  ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, radius); ctx.fill();
  ctx.restore();
  const gradient = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
  gradient.addColorStop(0, 'rgba(0,0,0,.12)'); gradient.addColorStop(1, 'rgba(0,0,0,.02)');
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, radius); ctx.fill();
  ctx.font = `${fontWeights[fontKey]} ${Math.round(layout.size * factor)}px ${fontFamilies[fontKey]}`;
  ctx.textBaseline = 'top'; ctx.fillStyle = $('textColor').value;
  ctx.shadowColor = 'rgba(0,0,0,.50)'; ctx.shadowBlur = 3 * factor; ctx.shadowOffsetY = 1 * factor;
  let y = panelY + 24 * factor;
  for (const line of layout.lines) { if (line) ctx.fillText(line, x, y); y += layout.lineHeight * factor; }
  const even = value => Math.max(2, Math.floor(value / 2) * 2);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob
    ? resolve({ blob, region: { x: even(panelX), y: even(panelY), w: even(panelW), h: even(panelH) } })
    : reject(new Error('Gagal membuat lapisan teks.')), 'image/png'));
}
function updatePreviewText() {
  const text = quoteInput.value.trim() || 'Hiduplah dengan tenang dan sederhana. Tak perlu semua orang tahu perjalananmu.';
  previewQuote.textContent = text;
  $('charCount').textContent = `${quoteInput.value.length}/650`;
  const chars = text.length;
  previewQuote.style.fontSize = `${chars < 90 ? 13 : chars < 190 ? 12 : chars < 340 ? 11 : 10}px`;
  previewQuote.className = `font-${selectedFont}`;
  previewQuote.style.color = $('textColor').value;
  quotePanel.style.background = looks[selectedStyle].panel;
  const strength = Number($('filterStrength').value) / 100;
  const look = looks[selectedStyle];
  const contrast = 1 + (look.contrast - 1) * strength;
  const saturation = 1 + (look.saturation - 1) * strength;
  const brightness = 1 + look.brightness * strength;
  previewVideo.style.filter = `contrast(${contrast}) saturate(${saturation}) brightness(${brightness})${selectedStyle === 'mono' ? ' grayscale(1)' : ''}`;
  quotePanel.style.top = $('textPosition').value === 'upper' ? '23%' : $('textPosition').value === 'lower' ? '42%' : '30%';
  updateButton();
}
quoteInput.addEventListener('input', updatePreviewText);
document.querySelectorAll('.style-option').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.style-option').forEach(item => item.classList.remove('active'));
  button.classList.add('active'); selectedStyle = button.dataset.style; updatePreviewText();
}));
document.querySelectorAll('.font-option').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.font-option').forEach(item => item.classList.remove('active'));
  button.classList.add('active'); selectedFont = button.dataset.font; updatePreviewText();
}));
$('filterStrength').addEventListener('input', () => { $('filterStrengthValue').value = `${$('filterStrength').value}%`; updatePreviewText(); });
$('blurStrength').addEventListener('input', () => { $('blurStrengthValue').value = $('blurStrength').value; const px = Number($('blurStrength').value) * .38; quotePanel.style.backdropFilter = `blur(${px}px)`; quotePanel.style.webkitBackdropFilter = `blur(${px}px)`; });
['textColor', 'textPosition'].forEach(id => $(id).addEventListener('change', updatePreviewText));

async function loadFFmpeg() {
  if (ffmpegLoaded) return;
  if (ffmpegLoading) return ffmpegLoading;
  ffmpegLoading = (async () => {
    const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
    setProgress('Memuat mesin video…', 3, 'Unduhan pertama sekitar 30 MB. Pastikan koneksi internet stabil dan jangan tutup halaman.');
    ffmpeg.on('log', ({ message }) => { if (/frame=|video:|size=/.test(message)) $('progressNote').textContent = message.slice(0, 150); });
    await ffmpeg.load({ coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm') });
    ffmpegLoaded = true;
  })();
  try { await ffmpegLoading; } finally { ffmpegLoading = null; }
}
function buildGrade(style, strength) {
  const amount = strength / 100;
  const mix = (target, neutral) => (neutral + (target - neutral) * amount).toFixed(3);
  return `eq=contrast=${mix(style.contrast, 1)}:saturation=${mix(style.saturation, 1)}:brightness=${mix(style.brightness, 0)},vignette=${(style.vignette * amount).toFixed(3)}*PI`;
}

renderBtn.addEventListener('click', async () => {
  clearError();
  if (!selectedFile || !quoteInput.value.trim()) return;
  renderBtn.disabled = true; $('outputCard').hidden = true;
  try {
    await loadFFmpeg();
    const resolution = Number($('resolution').value);
    const height = Math.round(resolution * 16 / 9);
    setProgress('Menyiapkan video…', 10, 'Membaca video dan menyiapkan desain teks.');
    const inputExt = (selectedFile.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    const inputName = `input.${inputExt}`;
    const overlayName = 'quote-overlay.png';
    const outputName = 'quietframe-output.mp4';
    const overlayData = await makeOverlay(quoteInput.value, selectedStyle, resolution);
    await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));
    await ffmpeg.writeFile(overlayName, await fetchFile(overlayData.blob));
    setProgress('Mengedit video…', 18, 'Menerapkan filter, blur lokal, dan gaya tulisan.');
    const style = looks[selectedStyle];
    const region = overlayData.region;
    const blur = Math.max(0, Math.round(Number($('blurStrength').value) * resolution / 1080));
    const blurFilter = blur > 0 ? `crop=${region.w}:${region.h}:${region.x}:${region.y},boxblur=${blur}:2[blurred]` : `crop=${region.w}:${region.h}:${region.x}:${region.y}[blurred]`;
    const grade = buildGrade(style, Number($('filterStrength').value));
    const filter = `[0:v]scale=${resolution}:${height}:force_original_aspect_ratio=increase,crop=${resolution}:${height}[base];[base]split[original][forblur];[forblur]${blurFilter};[original][blurred]overlay=${region.x}:${region.y},${grade}[graded];[graded][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`;
    const args = ['-i', inputName, '-loop', '1', '-i', overlayName, '-filter_complex', filter, '-map', '[v]'];
    if ($('audioMode').value === 'original') args.push('-map', '0:a?');
    args.push('-t', String(Math.min(20, selectedDuration)), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', resolution === 1080 ? '21' : '22');
    if ($('audioMode').value === 'original') args.push('-c:a', 'aac', '-b:a', '160k', '-ar', '44100');
    args.push('-movflags', '+faststart', outputName);
    await ffmpeg.exec(args);
    setProgress('Menyiapkan hasil…', 94, 'Hampir selesai. Menyediakan file MP4 untuk diunduh.');
    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (!bytes.length) throw new Error('File hasil kosong. Coba lagi dengan video MP4 yang kompatibel.');
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
    $('downloadBtn').href = outputUrl;
    $('outputInfo').textContent = `MP4 · ${resolution} × ${height} · ${$('audioMode').value === 'mute' ? 'Tanpa audio' : 'Audio asli'} · ${formatBytes(bytes.byteLength)}`;
    $('outputCard').hidden = false;
    setProgress('Selesai!', 100, 'Video siap. Tekan Unduh MP4 untuk menyimpan hasilnya.');
  } catch (error) {
    console.error(error);
    const message = String(error?.message || error);
    showError(`Proses gagal: ${message.slice(0, 260)}. Coba video MP4 H.264 yang lebih kecil, tutup tab lain, lalu ulangi. iPhone dapat membatasi proses karena memori browser.`);
    setProgress('Belum berhasil', 0, 'Periksa format video dan ruang memori perangkat.');
  } finally { updateButton(); }
});
window.addEventListener('beforeunload', () => {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  if (previewVideo.dataset.url) URL.revokeObjectURL(previewVideo.dataset.url);
});
updatePreviewText();
