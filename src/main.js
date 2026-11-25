import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/* =====================================
   QUIETFRAME — VIDEO QUOTE EDITOR
===================================== */

const $ = (id) => document.getElementById(id);

let sourceFile = null;
let previewUrl = null;
let outputUrl = null;
let ffmpeg = null;

let selectedStyle = 'cinematic';
let selectedFont = 'serif';
let selectedAlignment = 'center';
let currentTab = 'text';

const fonts = {
  serif: 'Georgia, serif',
  clean: 'Arial, sans-serif',
  bold: 'Arial Black, Arial, sans-serif',
  soft: 'Arial, sans-serif'
};

const tabTitles = {
  text: 'Pengaturan Teks',
  font: 'Pilihan Font',
  filter: 'Filter Video',
  blur: 'Blur Belakang Teks',
  audio: 'Pengaturan Audio'
};

const filterPreview = {
  cinematic: (s) =>
    `brightness(${1 - s * 0.06}) contrast(${1 + s * 0.18}) saturate(${1 - s * 0.18})`,
  blue: (s) =>
    `brightness(0.98) contrast(${1 + s * 0.12}) saturate(${1 - s * 0.25}) hue-rotate(8deg)`,
  warm: (s) =>
    `brightness(1.02) contrast(${1 + s * 0.08}) saturate(${1 + s * 0.12}) sepia(${s * 0.18})`,
  mono: (s) =>
    `grayscale(1) contrast(${1 + s * 0.12})`,
  soft: (s) =>
    `brightness(1.03) contrast(${1 - s * 0.08}) saturate(${1 - s * 0.12})`,
  deep: (s) =>
    `contrast(${1 + s * 0.35}) saturate(${1 + s * 0.08})`
};


/* =====================================
   NAVIGASI HALAMAN
===================================== */

function showStep(step) {
  document.querySelectorAll('[data-step]').forEach((panel) => {
    const active = Number(panel.dataset.step) === step;

    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  if (step === 2) {
    updatePreview();
    updateVideoTime();
  }

  if (step === 3) {
    $('audioModeExport').value = $('audioMode').value;
    $('renderBtn').disabled = !sourceFile;
  }
}

function goToEditor() {
  if (!sourceFile) {
    showError('Pilih video terlebih dahulu.');
    showStep(1);
    return;
  }

  if (!$('quoteText').value.trim()) {
    showError('Tulis kutipan terlebih dahulu.');
    $('quoteText').focus();
    return;
  }

  clearErrors();
  $('editorQuote').value = $('quoteText').value;

  showStep(2);
}

function goToExport() {
  if (!sourceFile) {
    showError('Pilih video terlebih dahulu.');
    showStep(1);
    return;
  }

  if (!$('quoteText').value.trim()) {
    showError('Tulis kutipan terlebih dahulu.');
    showStep(1);
    return;
  }

  clearErrors();
  $('audioModeExport').value = $('audioMode').value;

  showStep(3);
}


/* =====================================
   PESAN DAN STATUS
===================================== */

function showError(message) {
  const activeStep = document.querySelector('[data-step]:not([hidden])');

  const target = activeStep?.querySelector('.error') || $('errorBox');

  target.textContent = message;
  target.hidden = false;
}

function clearErrors() {
  $('errorBox').hidden = true;
  $('errorBoxExport').hidden = true;
}

function setProgress(title, percent, note = '') {
  $('progressWrap').hidden = false;
  $('progressTitle').textContent = title;
  $('progressPct').textContent = `${percent}%`;
  $('progressBar').style.width = `${percent}%`;
  $('progressNote').textContent = note;
}


/* =====================================
   UPLOAD VIDEO
===================================== */

$('videoFile').addEventListener('change', (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith('video/')) {
    showError('File yang dipilih bukan video.');
    event.target.value = '';
    return;
  }

  sourceFile = file;

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  previewUrl = URL.createObjectURL(file);

  const video = $('previewVideo');

  video.src = previewUrl;
  video.load();

  $('fileHint').textContent = file.name;

  $('videoMeta').hidden = false;
  $('videoMeta').textContent =
    `${(file.size / 1024 / 1024).toFixed(1)} MB`;

  $('toEditor').disabled = false;
  $('renderBtn').disabled = false;

  clearErrors();

  video.play().catch(() => {});

  updatePreview();
});


/* =====================================
   VIDEO PREVIEW
===================================== */

function updateVideoTime() {
  const video = $('previewVideo');

  if (!video) return;

  const current = Number.isFinite(video.currentTime)
    ? video.currentTime
    : 0;

  const duration = Number.isFinite(video.duration)
    ? video.duration
    : 0;

  $('timeLabel').textContent =
    `${formatTime(current)} / ${formatTime(duration)}`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

$('previewVideo').addEventListener('timeupdate', updateVideoTime);

$('previewVideo').addEventListener('loadedmetadata', () => {
  updateVideoTime();
});

$('playPreview').addEventListener('click', () => {
  const video = $('previewVideo');

  if (video.paused) {
    video.play().catch(() => {});
    $('playPreview').textContent = 'Ⅱ';
  } else {
    video.pause();
    $('playPreview').textContent = '▶';
  }
});

$('previewVideo').addEventListener('play', () => {
  $('playPreview').textContent = 'Ⅱ';
});

$('previewVideo').addEventListener('pause', () => {
  $('playPreview').textContent = '▶';
});

$('previewExpand').addEventListener('click', () => {
  const frame = document.querySelector('.phone-frame');

  if (!frame) return;

  const expanded = frame.classList.toggle('preview-expanded');

  $('previewExpand').textContent = expanded ? '↙' : '⛶';
  $('previewExpand').setAttribute(
    'aria-expanded',
    String(expanded)
  );
});


/* =====================================
   SIMULASI UI TIKTOK
===================================== */

$('showTikTokUI').addEventListener('change', (event) => {
  const visible = event.target.checked;

  $('previewScreen').classList.toggle(
    'hide-tiktok-ui',
    !visible
  );
});


/* =====================================
   UPDATE TEKS PREVIEW
===================================== */

function updatePreview() {
  const quote = $('editorQuote').value || $('quoteText').value || '';

  const previewQuote = $('previewQuote');
  const displayQuote = quote.trim() || 'Kutipanmu akan tampil di sini.';

  previewQuote.replaceChildren();

  displayQuote.split(/\n{2,}/).forEach((paragraph) => {
    const element = document.createElement('span');

    element.className = 'quote-paragraph';
    element.textContent = paragraph;

    previewQuote.appendChild(element);
  });

  const fontSize = Number($('textSize').value);
  const paragraphGap = Number($('paragraphGap').value);
  const blurStrength = Number($('blurStrength').value);
  const filterStrength = Number($('filterStrength').value);

  previewQuote.style.color = $('textColor').value;
  previewQuote.style.fontFamily = fonts[selectedFont];
  previewQuote.style.fontWeight =
    selectedFont === 'bold' ? '900' : '400';

  previewQuote.style.fontStyle =
    selectedFont === 'soft' ? 'italic' : 'normal';

  previewQuote.style.textAlign = selectedAlignment;
  previewQuote.style.fontSize = `${fontSize / 10.8}cqw`;
  previewQuote.style.setProperty(
    '--paragraph-gap',
    `${paragraphGap / 10.8}cqw`
  );

  $('quotePanel').dataset.position = $('textPosition').value;
  $('quotePanel').dataset.blur =
    $('enableTextBlur').checked ? 'on' : 'off';

  $('quotePanel').style.setProperty(
    '--text-blur',
    `${blurStrength}px`
  );

  $('previewScreen').dataset.style = selectedStyle;

  $('previewVideo').style.filter =
    filterPreview[selectedStyle](filterStrength / 100);

  $('charCount').textContent =
    `${$('quoteText').value.length}/650`;

  $('filterStrengthValue').textContent =
    `${filterStrength}%`;

  $('blurStrengthValue').textContent =
    `${blurStrength}px`;

  $('textSizeValue').textContent =
    `${fontSize} px`;

  $('paragraphGapValue').textContent =
    `${paragraphGap} px`;

  $('mockCaption').textContent =
    quote.trim().replace(/\n/g, ' ') ||
    'Tulis caption atau kutipan singkat di sini…';
}


/* =====================================
   SINKRONISASI KUTIPAN
===================================== */

$('quoteText').addEventListener('input', () => {
  $('editorQuote').value = $('quoteText').value;
  updatePreview();
});

$('editorQuote').addEventListener('input', () => {
  $('quoteText').value = $('editorQuote').value;
  updatePreview();
});


/* =====================================
   PENGATURAN TEKS
===================================== */

[
  'textColor',
  'textPosition',
  'textSize',
  'paragraphGap',
  'autoFit',
  'enableTextBlur',
  'blurStrength',
  'filterStrength'
].forEach((id) => {
  const element = $(id);

  element.addEventListener('input', updatePreview);
  element.addEventListener('change', updatePreview);
});


/* =====================================
   PERATAAN TEKS
===================================== */

document.querySelectorAll('[data-align]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedAlignment = button.dataset.align;

    document.querySelectorAll('[data-align]').forEach((item) => {
      const active = item.dataset.align === selectedAlignment;

      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });

    updatePreview();
  });
});


/* =====================================
   PILIH FONT
===================================== */

document.querySelectorAll('[data-font]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedFont = button.dataset.font;

    document.querySelectorAll('[data-font]').forEach((item) => {
      item.classList.toggle(
        'active',
        item.dataset.font === selectedFont
      );
    });

    updatePreview();
  });
});


/* =====================================
   PILIH FILTER
===================================== */

document.querySelectorAll('[data-style]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedStyle = button.dataset.style;

    document.querySelectorAll('[data-style]').forEach((item) => {
      item.classList.toggle(
        'active',
        item.dataset.style === selectedStyle
      );
    });

    updatePreview();
  });
});


/* =====================================
   TOOLBAR EDITOR
===================================== */

function selectTab(tab) {
  currentTab = tab;

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.classList.toggle(
      'active',
      button.dataset.tab === tab
    );
  });

  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    const active = panel.dataset.tabPanel === tab;

    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });

  $('settingsTitle').textContent =
    tabTitles[tab] || 'Pengaturan';
}

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    selectTab(button.dataset.tab);
  });
});

$('settingsBack').addEventListener('click', () => {
  selectTab('text');
});


/* =====================================
   AUDIO
===================================== */

$('audioMode').addEventListener('change', () => {
  $('audioModeExport').value = $('audioMode').value;
});

$('audioModeExport').addEventListener('change', () => {
  $('audioMode').value = $('audioModeExport').value;
});


/* =====================================
   NAVIGASI TOMBOL
===================================== */

$('toEditor').addEventListener('click', goToEditor);

$('backToContent').addEventListener('click', () => showStep(1));

$('backToContentBottom').addEventListener('click', () => showStep(1));

$('toExport').addEventListener('click', goToExport);

$('toExportBottom').addEventListener('click', goToExport);

$('backToEditor').addEventListener('click', () => showStep(2));


/* =====================================
   MEMBUAT OVERLAY TEKS
===================================== */

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height
  );
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r
  );
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const result = [];

  const hardLines = paragraph.split('\n');

  hardLines.forEach((hardLine) => {
    const words = hardLine.split(/\s+/).filter(Boolean);

    if (!words.length) {
      result.push('');
      return;
    }

    let line = '';

    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;

      if (ctx.measureText(test).width > maxWidth && line) {
        result.push(line);
        line = word;
      } else {
        line = test;
      }
    });

    if (line) result.push(line);
  });

  return result;
}

async function createTextOverlay(quote, width, height) {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Browser tidak mendukung pembuatan overlay teks.');
  }

  const paragraphs = quote.replace(/\r\n/g, '\n').split(/\n{2,}/);

  /*
    AREA AMAN:
    - Tidak menutupi kolom ikon kanan.
    - Tidak masuk area caption bawah.
    - Kutipan berada di bagian tengah video.
  */

  const boxWidth = Math.floor(width * 0.74 / 2) * 2;
  const x = Math.floor(width * 0.05 / 2) * 2;

  const padding = width * 0.045;
  const maxTextWidth = boxWidth - padding * 2;

  const maxTextHeight = height * 0.36;
  const paragraphGap =
    Number($('paragraphGap').value) * (width / 1080);

  const autoFit = $('autoFit').checked;

  let fontSize =
    Number($('textSize').value) * (width / 1080);

  const fontWeight =
    selectedFont === 'bold' ? '900' : '400';

  let wrappedParagraphs = [];

  function calculateLines(size) {
    ctx.font = `${fontWeight} ${size}px ${fonts[selectedFont]}`;

    return paragraphs.map((paragraph) =>
      wrapParagraph(ctx, paragraph, maxTextWidth)
    );
  }

  function calculateHeight(groups, size) {
    const lineHeight = size * 1.35;

    const lineCount = groups.reduce(
      (total, group) => total + group.length,
      0
    );

    const gapCount = Math.max(0, groups.length - 1);

    return (
      lineCount * lineHeight +
      gapCount * paragraphGap
    );
  }

  wrappedParagraphs = calculateLines(fontSize);

  if (autoFit) {
    while (
      calculateHeight(wrappedParagraphs, fontSize) > maxTextHeight &&
      fontSize > 18 * (width / 1080)
    ) {
      fontSize -= 2 * (width / 1080);
      wrappedParagraphs = calculateLines(fontSize);
    }
  }

  const lineHeight = fontSize * 1.35;

  const contentHeight = calculateHeight(
    wrappedParagraphs,
    fontSize
  );

  const boxPadding = Math.max(24, width * 0.025);

  const boxHeight = Math.ceil(
    (contentHeight + boxPadding * 2) / 2
  ) * 2;

  let y = (height - boxHeight) / 2;

  const position = $('textPosition').value;

  if (position === 'upper') {
    y = height * 0.30;
  }

  if (position === 'lower') {
    y = height * 0.49;
  }

  y = Math.max(
    height * 0.17,
    Math.min(y, height * 0.68 - boxHeight)
  );

  y = Math.floor(y / 2) * 2;

  const blurEnabled = $('enableTextBlur').checked;
  const blurStrength = Number($('blurStrength').value);

  /*
    Panel transparan tipis.
    Blur video di belakang panel dibuat oleh FFmpeg
    pada area panel saja.
  */

  const gradient = ctx.createLinearGradient(
    x,
    y,
    x,
    y + boxHeight
  );

  gradient.addColorStop(0, 'rgba(8, 9, 14, 0.10)');
  gradient.addColorStop(1, 'rgba(8, 9, 14, 0.17)');

  ctx.fillStyle = gradient;

  roundedRect(
    ctx,
    x,
    y,
    boxWidth,
    boxHeight,
    Math.max(12, width * 0.025)
  );

  ctx.fill();

  ctx.fillStyle = $('textColor').value;
  ctx.textAlign = selectedAlignment;
  ctx.textBaseline = 'middle';

  ctx.font =
    `${fontWeight} ${fontSize}px ${fonts[selectedFont]}`;

  if (selectedFont === 'soft') {
    ctx.font = `italic ${fontSize}px ${fonts[selectedFont]}`;
  }

  let textX = x + boxWidth / 2;

  if (selectedAlignment === 'left') {
    textX = x + padding;
  }

  if (selectedAlignment === 'right') {
    textX = x + boxWidth - padding;
  }

  let cursorY =
    y + (boxHeight - contentHeight) / 2 + lineHeight / 2;

  wrappedParagraphs.forEach((lines, paragraphIndex) => {
    lines.forEach((line) => {
      ctx.fillText(
        line,
        textX,
        cursorY,
        maxTextWidth
      );

      cursorY += lineHeight;
    });

    if (paragraphIndex < wrappedParagraphs.length - 1) {
      cursorY += paragraphGap;
    }
  });

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Gagal membuat gambar teks.'));
        return;
      }

      resolve(result);
    }, 'image/png');
  });

  return {
    blob,
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    blurEnabled,
    blurStrength
  };
}


/* =====================================
   FILTER UNTUK VIDEO EKSPOR
===================================== */

function getExportFilter() {
  const strength = Number($('filterStrength').value) / 100;

  const filters = {
    cinematic:
      `eq=contrast=${1 + strength * 0.18}:brightness=${-0.025 * strength}:saturation=${1 - strength * 0.18}`,

    blue:
      `colorbalance=bs=${0.12 * strength}:gs=${0.02 * strength},eq=contrast=${1 + strength * 0.12}:saturation=${1 - strength * 0.25}`,

    warm:
      `colorbalance=rs=${0.10 * strength}:gs=${0.04 * strength}:bs=${-0.08 * strength},eq=saturation=${1 + strength * 0.12}`,

    mono:
      `hue=s=0,eq=contrast=${1 + strength * 0.12}`,

    soft:
      `eq=contrast=${1 - strength * 0.08}:brightness=${0.025 * strength}:saturation=${1 - strength * 0.12}`,

    deep:
      `eq=contrast=${1 + strength * 0.35}:brightness=${-0.035 * strength}:saturation=${1 + strength * 0.08}`
  };

  return filters[selectedStyle] || filters.cinematic;
}


/* =====================================
   MEMUAT FFmpeg
===================================== */

async function loadEngine() {
  if (ffmpeg && ffmpeg.loaded) {
    return;
  }

  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    const percent = Math.min(
      95,
      Math.max(30, Math.round(30 + progress * 65))
    );

    setProgress('Memproses video…', percent);
  });

  const baseURL =
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';

  const coreURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.js`,
    'text/javascript'
  );

  const wasmURL = await toBlobURL(
    `${baseURL}/ffmpeg-core.wasm`,
    'application/wasm'
  );

  await ffmpeg.load({
    coreURL,
    wasmURL
  });
}


/* =====================================
   EKSPOR VIDEO
===================================== */

async function renderVideo() {
  if (!sourceFile) {
    showError('Pilih video terlebih dahulu.');
    return;
  }

  const quote = $('editorQuote').value.trim();

  if (!quote) {
    showError('Tulis kutipan terlebih dahulu.');
    showStep(2);
    return;
  }

  if (sourceFile.size > 150 * 1024 * 1024) {
    showError(
      'Ukuran video melebihi 150 MB. Coba gunakan video yang lebih kecil.'
    );
    return;
  }

  clearErrors();

  $('renderBtn').disabled = true;
  $('outputCard').hidden = true;

  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
    outputUrl = null;
  }

  const inputName = 'quietframe-input.mp4';
  const overlayName = 'quietframe-text.png';
  const outputName = 'quietframe-final.mp4';

  try {
    setProgress(
      'Menyiapkan mesin video…',
      5,
      'Pertama kali membutuhkan koneksi internet untuk memuat FFmpeg.'
    );

    await loadEngine();

    setProgress('Membaca video…', 15);

    await ffmpeg.writeFile(
      inputName,
      await fetchFile(sourceFile)
    );

    const width = Number($('resolution').value);
    const height = Math.round(width * 16 / 9);

    const overlay = await createTextOverlay(
      quote,
      width,
      height
    );

    await ffmpeg.writeFile(
      overlayName,
      await fetchFile(overlay.blob)
    );

    const videoFilters = [
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`,
      'setsar=1',
      getExportFilter()
    ];

    const graph = [];

    graph.push(
      `[0:v]${videoFilters.join(',')}[base]`
    );

    let finalBase = '[base]';

    /*
      Blur hanya pada kotak kutipan.
      Bagian video lain tetap tajam dan terlihat.
    */

    if (overlay.blurEnabled && overlay.blurStrength > 0) {
      const blurRadius = Math.max(
        1,
        Math.round(overlay.blurStrength * (width / 1080))
      );

      graph.push(
        `[base]split=2[baseclean][blurinput]`
      );

      graph.push(
        `[blurinput]crop=${overlay.width}:${overlay.height}:${overlay.x}:${overlay.y},boxblur=${blurRadius}:1[blurred]`
      );

      graph.push(
        `[baseclean][blurred]overlay=${overlay.x}:${overlay.y}[softened]`
      );

      finalBase = '[softened]';
    }

    graph.push(
      `${finalBase}[1:v]overlay=0:0:format=auto[outv]`
    );

    const audioMode = $('audioModeExport').value;

    const args = [
      '-i',
      inputName,

      '-i',
      overlayName,

      '-filter_complex',
      graph.join(';'),

      '-map',
      '[outv]'
    ];

    if (audioMode === 'original') {
      args.push('-map', '0:a?');
    }

    args.push(
      '-c:v',
      'libx264',

      '-preset',
      'ultrafast',

      '-crf',
      '20',

      '-pix_fmt',
      'yuv420p'
    );

    if (audioMode === 'original') {
      args.push(
        '-c:a',
        'aac',
        '-b:a',
        '192k'
      );
    } else {
      args.push('-an');
    }

    args.push(
      '-movflags',
      '+faststart',
      outputName
    );

    setProgress(
      'Membuat video MP4…',
      30,
      'Jangan tutup halaman selama proses ekspor.'
    );

    await ffmpeg.exec(args);

    setProgress('Menyiapkan hasil video…', 96);

    const data = await ffmpeg.readFile(outputName);

    const blob = new Blob(
      [data],
      { type: 'video/mp4' }
    );

    outputUrl = URL.createObjectURL(blob);

    $('downloadBtn').href = outputUrl;
    $('outputInfo').textContent =
      `${width} × ${height} · MP4 · 9:16`;

    $('outputCard').hidden = false;

    setProgress(
      'Video berhasil dibuat!',
      100,
      'Tekan tombol Unduh MP4 untuk menyimpan video.'
    );

  } catch (error) {
    console.error('QuietFrame export error:', error);

    showError(
      `Gagal memproses video: ${error.message || error}. Periksa koneksi internet atau coba video MP4 yang lebih kecil.`
    );

    setProgress(
      'Ekspor gagal',
      0,
      'Silakan coba lagi.'
    );

  } finally {
    $('renderBtn').disabled = false;
  }
}

$('renderBtn').addEventListener('click', renderVideo);


/* =====================================
   BERSIHKAN RESOURCE
===================================== */

window.addEventListener('beforeunload', () => {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
  }
});


/* =====================================
   INISIALISASI
===================================== */

$('editorQuote').value = '';
$('quoteText').value = '';

$('toEditor').disabled = true;
$('renderBtn').disabled = true;

selectTab('text');
updatePreview();
showStep(1);
