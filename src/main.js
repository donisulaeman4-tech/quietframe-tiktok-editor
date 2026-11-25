
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const $ = (id) => document.getElementById(id);

let sourceFile = null;
let selectedStyle = 'cinematic';
let selectedFont = 'serif';
let selectedAlignment = 'center';
let ffmpeg = null;
let outputUrl = null;
let previewUrl = null;

const styles = {
  cinematic: 'eq=contrast=1.18:brightness=-0.06:saturation=0.82',
  blue: 'colorbalance=bs=0.12:gs=0.02,eq=saturation=0.75:contrast=1.12',
  warm: 'colorbalance=rs=0.10:gs=0.04:bs=-0.08,eq=saturation=1.12',
  mono: 'hue=s=0,eq=contrast=1.12',
  soft: 'eq=contrast=0.92:brightness=0.025:saturation=0.88',
  deep: 'eq=contrast=1.35:brightness=-0.035:saturation=1.08'
};

const fonts = {
  serif: 'Georgia, serif',
  clean: 'Arial, sans-serif',
  bold: 'Arial Black, Arial, sans-serif',
  soft: 'Arial, sans-serif'
};

function setProgress(title, percent, note = '') {
  $('progressWrap').hidden = false;
  $('progressTitle').textContent = title;
  $('progressPct').textContent = `${percent}%`;
  $('progressBar').style.width = `${percent}%`;
  if (note) $('progressNote').textContent = note;
}

function showError(message) {
  $('errorBox').hidden = false;
  $('errorBox').textContent = message;
}

function updatePreview() {
  const quote = $('quoteText').value.trim();

  $('previewQuote').textContent =
    quote || 'Hiduplah dengan tenang dan sederhana. Tak perlu semua orang tahu perjalananmu.';

  $('charCount').textContent = `${$('quoteText').value.length}/650`;
  $('filterStrengthValue').textContent = `${$('filterStrength').value}%`;
  $('blurStrengthValue').textContent = $('blurStrength').value;

  $('textSizeValue').textContent = `${$('textSize').value} px`;

  $('previewQuote').style.color = $('textColor').value;
  $('previewQuote').style.fontFamily = fonts[selectedFont];
  $('previewQuote').style.fontWeight =
    selectedFont === 'bold' ? '900' : '400';
  $('previewQuote').style.fontStyle =
    selectedFont === 'soft' ? 'italic' : 'normal';

  $('previewQuote').style.textAlign = selectedAlignment;
  $('previewQuote').style.fontSize =
    `clamp(12px, ${Number($('textSize').value) / 10.8}cqw, 32px)`;

  $('quotePanel').dataset.position = $('textPosition').value;
  $('previewScreen').dataset.style = selectedStyle;
}

function createTextOverlay(quote, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  const position = $('textPosition').value;
  const color = $('textColor').value;
  const autoFit = $('autoFit').checked;

  const boxWidth = width * 0.88;
  const padding = width * 0.06;
  const textMaxWidth = boxWidth - padding * 2;
  const maxHeight = height * 0.42;
  const words = quote.split(/\s+/);

  let fontSize = Number($('textSize').value) * (width / 1080);
  let lines = [];

  function wrapText(size) {
    ctx.font = `${selectedFont === 'bold' ? '900' : '400'} ${size}px ${fonts[selectedFont]}`;

    const result = [];
    let line = '';

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;

      if (ctx.measureText(test).width > textMaxWidth && line) {
        result.push(line);
        line = word;
      } else {
        line = test;
      }
    }

    if (line) result.push(line);
    return result;
  }

  lines = wrapText(fontSize);

  if (autoFit) {
    while (
      lines.length * fontSize * 1.35 > maxHeight &&
      fontSize > 18 * (width / 1080)
    ) {
      fontSize -= 2 * (width / 1080);
      lines = wrapText(fontSize);
    }
  }

  const lineHeight = fontSize * 1.35;
  const boxHeight = Math.max(
    lineHeight + 70,
    lines.length * lineHeight + 70
  );

  let y = (height - boxHeight) / 2;
  if (position === 'upper') y = height * 0.29;
  if (position === 'lower') y = height * 0.54;

  y = Math.max(20, Math.min(y, height - boxHeight - 20));

  const x = (width - boxWidth) / 2;

  const gradient = ctx.createLinearGradient(x, y, x, y + boxHeight);
  gradient.addColorStop(0, 'rgba(10,10,14,0.57)');
  gradient.addColorStop(1, 'rgba(10,10,14,0.72)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, boxWidth, boxHeight, 28);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textAlign = selectedAlignment;
  ctx.textBaseline = 'middle';
  ctx.font = `${selectedFont === 'bold' ? '900' : '400'} ${fontSize}px ${fonts[selectedFont]}`;

  let textX = width / 2;

  if (selectedAlignment === 'left') {
    textX = x + padding;
  } else if (selectedAlignment === 'right') {
    textX = x + boxWidth - padding;
  }

  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      textX,
      y + 35 + index * lineHeight + lineHeight / 2,
      textMaxWidth
    );
  });

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}

async function loadEngine() {
  if (ffmpeg) return;

  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    const percent = Math.min(95, Math.round(progress * 100));
    setProgress('Memproses video…', percent);
  });

  const baseURL =
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';

  await ffmpeg.load({
    coreURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.js`,
      'text/javascript'
    ),
    wasmURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      'application/wasm'
    )
  });
}

async function renderVideo() {
  if (!sourceFile) {
    showError('Pilih video terlebih dahulu.');
    return;
  }

  const quote = $('quoteText').value.trim();

  if (!quote) {
    showError('Tulis kutipan terlebih dahulu.');
    return;
  }

  if (sourceFile.size > 150 * 1024 * 1024) {
    showError('Ukuran video terlalu besar. Coba video yang lebih kecil.');
    return;
  }

  $('errorBox').hidden = true;
  $('renderBtn').disabled = true;
  $('outputCard').hidden = true;

  try {
    setProgress(
      'Memuat mesin video…',
      5,
      'Pertama kali membutuhkan koneksi internet untuk memuat FFmpeg.'
    );

    await loadEngine();

    setProgress('Membaca video…', 15);

    const inputName = 'input-video';
    const outputName = 'quietframe-output.mp4';
    const overlayName = 'quote-overlay.png';

    await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));

    const width = Number($('resolution').value);
    const height = width * 16 / 9;

    const overlayBlob = await createTextOverlay(quote, width, height);

    if (!overlayBlob) {
      throw new Error('Gagal membuat teks overlay.');
    }

    await ffmpeg.writeFile(
      overlayName,
      await fetchFile(overlayBlob)
    );

    const strength = Number($('filterStrength').value) / 100;
    const filter = styles[selectedStyle];

    const filters = [
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`,
      'setsar=1',
      `eq=contrast=${1 + strength * 0.18}:saturation=${0.85 + strength * 0.15}`
    ];

    const graph = [
      `[0:v]${filters.join(',')},${filter}[base]`,
      `[base][1:v]overlay=0:0:format=auto[outv]`
    ].join(';');

    const args = [
      '-i', inputName,
      '-i', overlayName,
      '-filter_complex', graph,
      '-map', '[outv]'
    ];

    if ($('audioMode').value === 'original') {
      args.push('-map', '0:a?');
    }

    args.push(
      '-t', '20',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p'
    );

    if ($('audioMode').value === 'original') {
      args.push('-c:a', 'aac', '-b:a', '192k');
    } else {
      args.push('-an');
    }

    args.push('-movflags', '+faststart', outputName);

    setProgress('Membuat video MP4…', 30);

    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], {
      type: 'video/mp4'
    });

    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }

    outputUrl = URL.createObjectURL(blob);

    $('downloadBtn').href = outputUrl;
    $('outputInfo').textContent =
      `${width} × ${height} · MP4 · 9:16`;

    $('outputCard').hidden = false;

    setProgress(
      'Selesai!',
      100,
      'Video berhasil dibuat. Tekan Unduh MP4 untuk menyimpan.'
    );

  } catch (error) {
    console.error(error);

    showError(
      `Gagal memproses video: ${error.message || error}. Coba gunakan video MP4 yang lebih kecil.`
    );

    setProgress('Proses gagal', 0);

  } finally {
    $('renderBtn').disabled = false;
  }
}

$('videoFile').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  sourceFile = file;
  $('fileHint').textContent = file.name;
  $('videoMeta').hidden = false;
  $('videoMeta').textContent =
    `${(file.size / 1024 / 1024).toFixed(1)} MB`;

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  previewUrl = URL.createObjectURL(file);
  $('previewVideo').src = previewUrl;
  $('previewVideo').load();
  $('previewVideo').play().catch(() => {});

  $('renderBtn').disabled = false;
  $('errorBox').hidden = true;
});

$('quoteText').addEventListener('input', updatePreview);
$('filterStrength').addEventListener('input', updatePreview);
$('blurStrength').addEventListener('input', updatePreview);
$('textColor').addEventListener('change', updatePreview);
$('textPosition').addEventListener('change', updatePreview);
$('textSize').addEventListener('input', updatePreview);
$('autoFit').addEventListener('change', updatePreview);

document.querySelectorAll('[data-align]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedAlignment = button.dataset.align;

    document.querySelectorAll('[data-align]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });

    updatePreview();
  });
});

document.querySelectorAll('[data-style]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedStyle = button.dataset.style;

    document.querySelectorAll('[data-style]').forEach((item) => {
      item.classList.toggle('active', item === button);
    });

    updatePreview();
  });
});

document.querySelectorAll('[data-font]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedFont = button.dataset.font;

    document.querySelectorAll('[data-font]').forEach((item) => {
      item.classList.toggle('active', item === button);
    });

    updatePreview();
  });
});

$('renderBtn').addEventListener('click', renderVideo);

updatePreview();
