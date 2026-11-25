
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
let currentStep = 1;

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

function showStep(step) {
  currentStep = step;

  document.querySelectorAll('[data-step]').forEach((panel) => {
    const active = Number(panel.dataset.step) === step;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });

  document.querySelectorAll('[data-step-indicator]').forEach((item) => {
    const number = Number(item.dataset.stepIndicator);
    item.classList.toggle('active', number === step);
    item.classList.toggle('completed', number < step);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (step === 2) updatePreview();
  if (step === 3) syncExportPreview();
}

function syncExportPreview() {
  const preview = $('previewVideo');
  const exportPreview = $('exportPreviewVideo');

  if (previewUrl && exportPreview) {
    exportPreview.src = previewUrl;
    exportPreview.load();
    exportPreview.play().catch(() => {});
  }
}

function setProgress(title, percent, note = '') {
  $('progressWrap').hidden = false;
  $('progressTitle').textContent = title;
  $('progressPct').textContent = `${percent}%`;
  $('progressBar').style.width = `${percent}%`;
  if (note) $('progressNote').textContent = note;
}

function showError(message) {
  const contentError = $('errorBox');
  const exportError = $('errorBoxExport');

  if (contentError) {
    contentError.hidden = false;
    contentError.textContent = message;
  }

  if (exportError) {
    exportError.hidden = false;
    exportError.textContent = message;
  }
}

function clearErrors() {
  if ($('errorBox')) $('errorBox').hidden = true;
  if ($('errorBoxExport')) $('errorBoxExport').hidden = true;
}

function updatePreview() {
  const rawQuote = $('quoteText').value;
  const quote = rawQuote.trim();
  const blurEnabled = $('enableTextBlur').checked;
  const blurStrength = Number($('blurStrength').value);
  const paragraphGap = Number($('paragraphGap').value);

  const previewQuote = $('previewQuote');
  const displayQuote =
    quote || 'Hiduplah dengan tenang dan sederhana. Tak perlu semua orang tahu perjalananmu.';

  previewQuote.replaceChildren();
  previewQuote.style.setProperty('--paragraph-gap', `${paragraphGap}px`);

  displayQuote.split(/\n{2,}/).forEach((paragraph) => {
    const paragraphElement = document.createElement('span');
    paragraphElement.className = 'quote-paragraph';
    paragraphElement.textContent = paragraph;
    previewQuote.appendChild(paragraphElement);
  });

  $('charCount').textContent = `${rawQuote.length}/650`;
  $('filterStrengthValue').textContent = `${$('filterStrength').value}%`;
  $('blurStrengthValue').textContent = `${blurStrength}px`;
  $('textSizeValue').textContent = `${$('textSize').value} px`;
  $('paragraphGapValue').textContent = `${paragraphGap}px`;

  previewQuote.style.color = $('textColor').value;
  previewQuote.style.fontFamily = fonts[selectedFont];
  previewQuote.style.fontWeight =
    selectedFont === 'bold' ? '900' : '400';
  previewQuote.style.fontStyle =
    selectedFont === 'soft' ? 'italic' : 'normal';

  previewQuote.style.textAlign = selectedAlignment;
  previewQuote.style.fontSize =
    `clamp(12px, ${Number($('textSize').value) / 10.8}cqw, 32px)`;

  $('quotePanel').dataset.position = $('textPosition').value;
  $('quotePanel').dataset.blur = blurEnabled ? 'on' : 'off';
  $('quotePanel').style.setProperty('--text-blur', `${blurStrength}px`);
  $('previewScreen').dataset.style = selectedStyle;

  const strength = Number($('filterStrength').value) / 100;
  const previewFilters = {
    cinematic: `brightness(${1 - strength * 0.06}) contrast(${1 + strength * 0.18}) saturate(${1 - strength * 0.18})`,
    blue: `brightness(0.98) contrast(${1 + strength * 0.12}) saturate(${1 - strength * 0.25}) hue-rotate(8deg)`,
    warm: `brightness(1.02) contrast(${1 + strength * 0.08}) saturate(${1 + strength * 0.12}) sepia(${strength * 0.18})`,
    mono: `grayscale(1) contrast(${1 + strength * 0.12})`,
    soft: `brightness(1.03) contrast(${1 - strength * 0.08}) saturate(${1 - strength * 0.12})`,
    deep: `contrast(${1 + strength * 0.35}) saturate(${1 + strength * 0.08})`
  };

  $('previewVideo').style.filter = previewFilters[selectedStyle];
  if ($('exportPreviewVideo')) {
    $('exportPreviewVideo').style.filter = previewFilters[selectedStyle];
  }
}

function createTextOverlay(quote, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  const position = $('textPosition').value;
  const color = $('textColor').value;
  const autoFit = $('autoFit').checked;

  const boxWidth = Math.floor(width * 0.88 / 2) * 2;
  const padding = width * 0.06;
  const textMaxWidth = boxWidth - padding * 2;
  const maxHeight = height * 0.42;
  const paragraphGap = Number($('paragraphGap').value) * (width / 1080);
  const paragraphs = quote.replace(/\r\n/g, '\n').split(/\n{2,}/);

  let fontSize = Number($('textSize').value) * (width / 1080);
  let lines = [];
  let paragraphBreaks = 0;

  function wrapText(size) {
    ctx.font = `${selectedFont === 'bold' ? '900' : '400'} ${size}px ${fonts[selectedFont]}`;

    const result = [];
    let breaks = 0;

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const hardLines = paragraph.split('\n');

      hardLines.forEach((hardLine) => {
        const words = hardLine.split(/\s+/).filter(Boolean);

        if (words.length === 0) {
          result.push('');
          return;
        }

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
      });

      if (paragraphIndex < paragraphs.length - 1) breaks += 1;
    });

    return { lines: result, paragraphBreaks: breaks };
  }

  let wrapped = wrapText(fontSize);
  lines = wrapped.lines;
  paragraphBreaks = wrapped.paragraphBreaks;

  function totalTextHeight() {
    return lines.length * fontSize * 1.35 +
      paragraphBreaks * paragraphGap;
  }

  if (autoFit) {
    while (
      totalTextHeight() > maxHeight &&
      fontSize > 18 * (width / 1080)
    ) {
      fontSize -= 2 * (width / 1080);
      wrapped = wrapText(fontSize);
      lines = wrapped.lines;
      paragraphBreaks = wrapped.paragraphBreaks;
    }
  }

  const lineHeight = fontSize * 1.35;
  const contentHeight = totalTextHeight();
  const boxPadding = Math.max(35, width * 0.032);

  const boxHeight = Math.floor(
    Math.max(
      lineHeight + boxPadding * 2,
      contentHeight + boxPadding * 2
    ) / 2
  ) * 2;

  let y = (height - boxHeight) / 2;
  if (position === 'upper') y = height * 0.29;
  if (position === 'lower') y = height * 0.54;

  y = Math.max(20, Math.min(y, height - boxHeight - 20));
  y = Math.floor(y / 2) * 2;

  const x = Math.floor(((width - boxWidth) / 2) / 2) * 2;
  const blurEnabled = $('enableTextBlur').checked;
  const blurStrength = Number($('blurStrength').value);

  const gradient = ctx.createLinearGradient(x, y, x, y + boxHeight);
  gradient.addColorStop(0, 'rgba(10,10,14,0.12)');
  gradient.addColorStop(1, 'rgba(10,10,14,0.20)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, boxWidth, boxHeight, 28);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textAlign = selectedAlignment;
  ctx.textBaseline = 'middle';
  ctx.font = `${selectedFont === 'bold' ? '900' : '400'} ${fontSize}px ${fonts[selectedFont]}`;

  let textX = width / 2;
  if (selectedAlignment === 'left') textX = x + padding;
  if (selectedAlignment === 'right') textX = x + boxWidth - padding;

  let cursorY = y + (boxHeight - contentHeight) / 2 + lineHeight / 2;
  let lineIndex = 0;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphLineCount = paragraph.split('\n').reduce(
      (count, hardLine) => {
        const words = hardLine.split(/\s+/).filter(Boolean);
        if (words.length === 0) return count + 1;

        let line = '';
        let wrappedCount = 0;

        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > textMaxWidth && line) {
            wrappedCount += 1;
            line = word;
          } else {
            line = test;
          }
        }

        return count + wrappedCount + (line ? 1 : 0);
      },
      0
    );

    for (let i = 0; i < paragraphLineCount; i += 1) {
      ctx.fillText(lines[lineIndex] ?? '', textX, cursorY, textMaxWidth);
      cursorY += lineHeight;
      lineIndex += 1;
    }

    if (paragraphIndex < paragraphs.length - 1) cursorY += paragraphGap;
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({
        blob,
        x,
        y,
        width: boxWidth,
        height: boxHeight,
        blurEnabled,
        blurStrength
      });
    }, 'image/png');
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
    showStep(1);
    return;
  }

  if (sourceFile.size > 150 * 1024 * 1024) {
    showError('Ukuran video terlalu besar. Coba video yang lebih kecil.');
    return;
  }

  clearErrors();
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

    const overlay = await createTextOverlay(quote, width, height);

    if (!overlay || !overlay.blob) {
      throw new Error('Gagal membuat teks overlay.');
    }

    await ffmpeg.writeFile(overlayName, await fetchFile(overlay.blob));

    const strength = Number($('filterStrength').value) / 100;
    const filter = styles[selectedStyle];

    const filters = [
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`,
      'setsar=1',
      `eq=contrast=${1 + strength * 0.18}:saturation=${0.85 + strength * 0.15}`
    ];

    const graphParts = [
      `[0:v]${filters.join(',')},${filter}[base]`
    ];

    let videoInput = '[base]';

    if (overlay.blurEnabled && overlay.blurStrength > 0) {
      const radius = Math.max(1, Math.round(overlay.blurStrength));

      graphParts.push(
        `[base]split=2[baseclean][blurinput]`,
        `[blurinput]crop=${overlay.width}:${overlay.height}:${overlay.x}:${overlay.y},boxblur=${radius}:1[blurred]`,
        `[baseclean][blurred]overlay=${overlay.x}:${overlay.y}[softened]`
      );

      videoInput = '[softened]';
    }

    graphParts.push(
      `${videoInput}[1:v]overlay=0:0:format=auto[outv]`
    );

    const args = [
      '-i', inputName,
      '-i', overlayName,
      '-filter_complex', graphParts.join(';'),
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
    const blob = new Blob([data.buffer], { type: 'video/mp4' });

    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = URL.createObjectURL(blob);

    $('downloadBtn').href = outputUrl;
    $('outputInfo').textContent = `${width} × ${height} · MP4 · 9:16`;
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

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);

  $('previewVideo').src = previewUrl;
  $('previewVideo').load();
  $('previewVideo').play().catch(() => {});

  $('exportPreviewVideo').src = previewUrl;
  $('exportPreviewVideo').load();
  $('exportPreviewVideo').play().catch(() => {});

  $('toEditor').disabled = false;
  $('renderBtn').disabled = false;
  clearErrors();
});

$('toEditor').addEventListener('click', () => {
  if (!sourceFile) {
    showError('Pilih video terlebih dahulu.');
    return;
  }
  if (!$('quoteText').value.trim()) {
    showError('Tulis kutipan terlebih dahulu.');
    $('quoteText').focus();
    return;
  }
  clearErrors();
  showStep(2);
});

$('backToContent').addEventListener('click', () => showStep(1));

$('toExport').addEventListener('click', () => {
  if (!$('quoteText').value.trim()) {
    showError('Tulis kutipan terlebih dahulu.');
    showStep(1);
    return;
  }
  clearErrors();
  showStep(3);
});

$('backToEditor').addEventListener('click', () => showStep(2));

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.tab;

    document.querySelectorAll('[data-tab]').forEach((item) => {
      item.classList.toggle('active', item === button);
    });

    document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
      const active = panel.dataset.tabPanel === tab;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  });
});

$('quoteText').addEventListener('input', updatePreview);
$('filterStrength').addEventListener('input', updatePreview);
$('blurStrength').addEventListener('input', updatePreview);
$('paragraphGap').addEventListener('input', updatePreview);
$('enableTextBlur').addEventListener('change', updatePreview);
$('textColor').addEventListener('change', updatePreview);
$('textPosition').addEventListener('change', updatePreview);
$('textSize').addEventListener('input', updatePreview);
$('autoFit').addEventListener('change', updatePreview);

$('audioModeExport').addEventListener('change', () => {
  $('audioMode').value = $('audioModeExport').value;
});

$('audioMode').addEventListener('change', () => {
  $('audioModeExport').value = $('audioMode').value;
});

$('previewExpand').addEventListener('click', () => {
  const column = $('previewColumn');
  const expanded = column.classList.toggle('preview-expanded');

  $('previewExpand').setAttribute('aria-expanded', String(expanded));
  $('previewExpand').textContent = expanded
    ? 'Perkecil ↙'
    : 'Perbesar ↗';
});

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

$('quoteText').value = '';
$('renderBtn').disabled = true;
$('toEditor').disabled = true;
updatePreview();
showStep(1);
