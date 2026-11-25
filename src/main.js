import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/* =========================================
   QUIETFRAME — MAIN JAVASCRIPT
========================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const videoInput = $('#videoInput');
const previewVideo = $('#previewVideo');

let uploadedFile = null;
let videoURL = null;
let exportedURL = null;
let ffmpeg = null;
let ffmpegReady = false;
let exporting = false;

const settings = {
  font: 'serif',
  filter: 'normal',
  position: 'center',
  alignment: 'center',
  color: '#ffffff',
  size: 32,
  offset: 0,
  paragraphGap: 12,
  blur: false,
  blurStrength: 8,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  temperature: 0
};


/* =========================================
   STAGE NAVIGATION
========================================= */

function showStage(step) {
  $$('.stage').forEach((stage) => {
    stage.classList.toggle(
      'active',
      Number(stage.dataset.step) === step
    );
  });

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  if (step === 2) {
    updatePreviewText();
    updateVideoFilter();
  }
}

$('#backToUpload')?.addEventListener('click', () => {
  showStage(1);
});

$('#backToEditor')?.addEventListener('click', () => {
  showStage(2);
});

$('#continueToExport')?.addEventListener('click', () => {
  if (!uploadedFile) {
    alert('Silakan pilih video terlebih dahulu.');
    return;
  }

  showStage(3);
});


/* =========================================
   VIDEO UPLOAD
========================================= */

$('#uploadButton')?.addEventListener('click', () => {
  videoInput.click();
});

videoInput?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith('video/')) {
    alert('File yang dipilih bukan video.');
    videoInput.value = '';
    return;
  }

  uploadedFile = file;

  if (videoURL) {
    URL.revokeObjectURL(videoURL);
  }

  videoURL = URL.createObjectURL(file);

  previewVideo.src = videoURL;
  previewVideo.load();

  $('#videoFileName').textContent = file.name;
  $('#videoFileSize').textContent = formatFileSize(file.size);

  $('#selectedVideo').classList.add('visible');
  $('#uploadButton').classList.add('has-video');

  $('#startEditing').disabled = false;

  updatePreviewText();
});

$('#removeVideo')?.addEventListener('click', () => {
  uploadedFile = null;

  if (videoURL) {
    URL.revokeObjectURL(videoURL);
    videoURL = null;
  }

  previewVideo.removeAttribute('src');
  previewVideo.load();

  videoInput.value = '';

  $('#selectedVideo').classList.remove('visible');
  $('#uploadButton').classList.remove('has-video');

  $('#videoFileName').textContent = 'Video belum dipilih';
  $('#videoFileSize').textContent = 'Pilih video dari perangkat';

  $('#startEditing').disabled = true;
});

$('#startEditing')?.addEventListener('click', () => {
  if (!uploadedFile) {
    alert('Pilih video terlebih dahulu.');
    return;
  }

  const quote = $('#quoteInput').value.trim();

  $('#editorQuote').value = quote;

  updatePreviewText();
  showStage(2);

  previewVideo.play().catch(() => {});
});

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


/* =========================================
   QUOTE INPUT
========================================= */

$('#quoteInput')?.addEventListener('input', () => {
  const value = $('#quoteInput').value;

  $('#characterCount').textContent = `${value.length}/500`;

  if ($('#editorQuote')) {
    $('#editorQuote').value = value;
  }

  updatePreviewText();
});

$('#editorQuote')?.addEventListener('input', () => {
  $('#quoteInput').value = $('#editorQuote').value;

  const value = $('#quoteInput').value;

  $('#characterCount').textContent = `${value.length}/500`;

  updatePreviewText();
});


/* =========================================
   PREVIEW TEXT
========================================= */

function updatePreviewText() {
  const quote = $('#editorQuote')?.value || $('#quoteInput')?.value || '';

  const previewQuote = $('#previewQuote');
  const quotePanel = $('#quotePanel');
  const quoteInner = $('#quotePanelInner');

  if (!previewQuote || !quotePanel || !quoteInner) return;

  previewQuote.textContent = quote || 'Tulis kutipan kamu di sini.';

  settings.size = Number($('#textSize')?.value || 32);
  settings.color = $('#customTextColor')?.value || $('#textColor')?.value || '#ffffff';

  previewQuote.style.color = settings.color;
  previewQuote.style.fontSize = `${settings.size}px`;
  previewQuote.style.textAlign = settings.alignment;
  previewQuote.style.lineHeight = '1.28';

  previewQuote.style.fontFamily = getFontFamily(settings.font);

  previewQuote.style.whiteSpace = 'pre-wrap';
  previewQuote.style.overflowWrap = 'anywhere';

  quotePanel.style.setProperty(
    '--quote-offset',
    `${settings.offset}%`
  );

  quotePanel.classList.toggle('blur-active', settings.blur);

  quoteInner.style.backdropFilter = settings.blur
    ? `blur(${settings.blurStrength}px)`
    : 'none';

  quoteInner.style.webkitBackdropFilter = settings.blur
    ? `blur(${settings.blurStrength}px)`
    : 'none';

  quoteInner.style.background = settings.blur
    ? 'rgba(0,0,0,0.16)'
    : 'transparent';

  quoteInner.style.padding = settings.blur
    ? '12px 14px'
    : '0';

  quoteInner.style.borderRadius = settings.blur
    ? '10px'
    : '0';

  quotePanel.classList.remove('position-top', 'position-center', 'position-bottom');
  quotePanel.classList.add(`position-${settings.position}`);

  updateParagraphSpacing();
  autoFitPreviewText();
}

function getFontFamily(font) {
  const fonts = {
    serif: 'Georgia, "Times New Roman", serif',
    clean: 'Arial, Helvetica, sans-serif',
    bold: 'Arial, Helvetica, sans-serif',
    soft: '"Trebuchet MS", Arial, sans-serif',
    classic: 'Palatino, "Book Antiqua", serif',
    modern: 'Verdana, sans-serif',
    typewriter: '"Courier New", monospace',
    editorial: 'Baskerville, Georgia, serif'
  };

  return fonts[font] || fonts.serif;
}

function updateParagraphSpacing() {
  const previewQuote = $('#previewQuote');

  if (!previewQuote) return;

  previewQuote.style.setProperty(
    '--paragraph-gap',
    `${settings.paragraphGap}px`
  );

  previewQuote.innerHTML = '';

  const text = $('#editorQuote')?.value || $('#quoteInput')?.value || '';

  const paragraphs = text.split('\n');

  paragraphs.forEach((paragraph, index) => {
    const line = document.createElement('span');

    line.textContent = paragraph || '\u00A0';
    line.style.display = 'block';

    if (index !== paragraphs.length - 1) {
      line.style.marginBottom = `${settings.paragraphGap}px`;
    }

    previewQuote.appendChild(line);
  });
}

function autoFitPreviewText() {
  const enabled = $('#autoFit')?.checked ?? true;

  const previewQuote = $('#previewQuote');
  const quotePanel = $('#quotePanel');

  if (!previewQuote || !quotePanel) return;

  if (!enabled) {
    previewQuote.style.fontSize = `${settings.size}px`;
    return;
  }

  const availableHeight = quotePanel.clientHeight * 0.75;

  let fontSize = settings.size;

  previewQuote.style.fontSize = `${fontSize}px`;

  while (
    previewQuote.scrollHeight > availableHeight &&
    fontSize > 14
  ) {
    fontSize -= 1;
    previewQuote.style.fontSize = `${fontSize}px`;
  }
}


/* =========================================
   TEXT COLOR
========================================= */

$('#textColor')?.addEventListener('change', () => {
  const color = $('#textColor').value;

  $('#customTextColor').value = color;
  settings.color = color;

  updatePreviewText();
});

$('#customTextColor')?.addEventListener('input', () => {
  settings.color = $('#customTextColor').value;

  updatePreviewText();
});


/* =========================================
   TEXT SIZE
========================================= */

$('#textSize')?.addEventListener('input', () => {
  settings.size = Number($('#textSize').value);

  $('#textSizeValue').textContent = settings.size;

  updatePreviewText();
});


/* =========================================
   TEXT POSITION
========================================= */

$$('.position-button').forEach((button) => {
  button.addEventListener('click', () => {
    $$('.position-button').forEach((item) => {
      item.classList.remove('active');
    });

    button.classList.add('active');

    settings.position = button.dataset.position;

    updatePreviewText();
  });
});

$('#textOffset')?.addEventListener('input', () => {
  settings.offset = Number($('#textOffset').value);

  $('#textOffsetValue').textContent = settings.offset;

  updatePreviewText();
});


/* =========================================
   TEXT ALIGNMENT
========================================= */

$$('.align-button').forEach((button) => {
  button.addEventListener('click', () => {
    $$('.align-button').forEach((item) => {
      item.classList.remove('active');
    });

    button.classList.add('active');

    settings.alignment = button.dataset.align;

    updatePreviewText();
  });
});


/* =========================================
   AUTO FIT
========================================= */

$('#autoFit')?.addEventListener('change', () => {
  updatePreviewText();
});


/* =========================================
   PARAGRAPH GAP
========================================= */

$('#paragraphGap')?.addEventListener('input', () => {
  settings.paragraphGap = Number($('#paragraphGap').value);

  $('#paragraphGapValue').textContent = settings.paragraphGap;

  updatePreviewText();
});


/* =========================================
   BLUR SETTINGS
========================================= */

$('#blurEnabled')?.addEventListener('change', () => {
  settings.blur = $('#blurEnabled').checked;

  updatePreviewText();
});

$('#blurStrength')?.addEventListener('input', () => {
  settings.blurStrength = Number($('#blurStrength').value);

  $('#blurStrengthValue').textContent = settings.blurStrength;

  updatePreviewText();
});


/* =========================================
   FONT SELECTION
========================================= */

$$('.font-option').forEach((button) => {
  button.addEventListener('click', () => {
    $$('.font-option').forEach((item) => {
      item.classList.remove('active');
    });

    button.classList.add('active');

    settings.font = button.dataset.font;

    updatePreviewText();
  });
});


/* =========================================
   FILTERS
========================================= */

const filterStyles = {
  normal: 'none',
  cinematic: 'contrast(1.15) saturate(0.85) brightness(0.92)',
  blue: 'saturate(0.9) hue-rotate(12deg) contrast(1.08)',
  warm: 'sepia(0.2) saturate(1.15) brightness(1.04)',
  mono: 'grayscale(1) contrast(1.12)',
  soft: 'contrast(0.88) saturate(0.85) brightness(1.08)',
  deep: 'contrast(1.28) saturate(1.08) brightness(0.88)',
  golden: 'sepia(0.32) saturate(1.25) contrast(1.05)',
  night: 'brightness(0.72) contrast(1.2) saturate(0.8)'
};

const filterValues = {
  normal: null,
  cinematic: 'eq=contrast=1.15:saturation=0.85:brightness=-0.04',
  blue: 'colorbalance=bs=0.08:rs=-0.03,eq=contrast=1.08:saturation=0.9',
  warm: 'colorbalance=rs=0.08:gs=0.02:bs=-0.08,eq=saturation=1.15:brightness=0.02',
  mono: 'hue=s=0,eq=contrast=1.12',
  soft: 'eq=contrast=0.88:saturation=0.85:brightness=0.03',
  deep: 'eq=contrast=1.28:saturation=1.08:brightness=-0.06',
  golden: 'colorbalance=rs=0.12:gs=0.04:bs=-0.12,eq=saturation=1.2',
  night: 'eq=brightness=-0.1:contrast=1.2:saturation=0.8'
};

$$('.filter-option').forEach((button) => {
  button.addEventListener('click', () => {
    $$('.filter-option').forEach((item) => {
      item.classList.remove('active');
    });

    button.classList.add('active');

    settings.filter = button.dataset.filter;

    updateVideoFilter();
  });
});

function updateVideoFilter() {
  if (!previewVideo) return;

  const filter = filterStyles[settings.filter] || 'none';

  const brightness = settings.brightness / 100;
  const contrast = settings.contrast / 100;
  const saturation = settings.saturation / 100;

  const adjustment = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;

  const temperature = settings.temperature;

  previewVideo.style.filter =
    `${filter} ${adjustment} sepia(${Math.max(0, temperature) / 250})`;

  previewVideo.style.webkitFilter = previewVideo.style.filter;
}


/* =========================================
   IMAGE ADJUSTMENTS
========================================= */

const adjustmentControls = [
  ['brightness', 'brightnessValue', '%'],
  ['contrast', 'contrastValue', '%'],
  ['saturation', 'saturationValue', '%'],
  ['temperature', 'temperatureValue', '']
];

adjustmentControls.forEach(([id, output, suffix]) => {
  const input = $(`#${id}`);

  input?.addEventListener('input', () => {
    settings[id] = Number(input.value);

    $(`#${output}`).textContent = `${input.value}${suffix}`;

    updateVideoFilter();
  });
});

$('#autoAdjust')?.addEventListener('click', () => {
  settings.brightness = 105;
  settings.contrast = 108;
  settings.saturation = 108;
  settings.temperature = 8;

  setAdjustmentInputs();

  updateVideoFilter();
});

$('#resetAdjustments')?.addEventListener('click', () => {
  settings.brightness = 100;
  settings.contrast = 100;
  settings.saturation = 100;
  settings.temperature = 0;

  settings.filter = 'normal';

  setAdjustmentInputs();

  $$('.filter-option').forEach((item) => {
    item.classList.toggle(
      'active',
      item.dataset.filter === 'normal'
    );
  });

  updateVideoFilter();
});

function setAdjustmentInputs() {
  adjustmentControls.forEach(([id, output, suffix]) => {
    const input = $(`#${id}`);

    if (!input) return;

    input.value = settings[id];

    $(`#${output}`).textContent = `${settings[id]}${suffix}`;
  });
}


/* =========================================
   EDITOR TOOLBAR
========================================= */

$$('.tool-tab').forEach((button) => {
  button.addEventListener('click', () => {
    const panelName = button.dataset.panel;

    $$('.tool-tab').forEach((item) => {
      item.classList.remove('active');
    });

    $$('.settings-panel').forEach((panel) => {
      panel.classList.remove('active');
    });

    button.classList.add('active');

    const panel = $(`#panel-${panelName}`);

    panel?.classList.add('active');
  });
});


/* =========================================
   TIKTOK PREVIEW UI
========================================= */

$('#toggleTikTokUI')?.addEventListener('click', () => {
  const screen = $('#previewScreen');

  const hidden = screen.classList.toggle('hide-tiktok-ui');

  $('#toggleTikTokUI').classList.toggle('active', !hidden);
});


/* =========================================
   VIDEO PLAY / PAUSE
========================================= */

$('#previewPlay')?.addEventListener('click', () => {
  if (!previewVideo.src) return;

  if (previewVideo.paused) {
    previewVideo.play().catch(() => {});
  } else {
    previewVideo.pause();
  }
});

previewVideo?.addEventListener('play', () => {
  $('#playIcon').textContent = 'Ⅱ';
});

previewVideo?.addEventListener('pause', () => {
  $('#playIcon').textContent = '▶';
});


/* =========================================
   EXPANDED PREVIEW
========================================= */

$('#previewScreen')?.addEventListener('dblclick', () => {
  if (!document.fullscreenElement) {
    $('#previewScreen').requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
});


/* =========================================
   CANVAS TEXT RENDERING
========================================= */

function wrapCanvasText(context, text, maxWidth) {
  const paragraphs = text.split('\n');
  const lines = [];

  paragraphs.forEach((paragraph) => {
    if (!paragraph.trim()) {
      lines.push('');
      return;
    }

    const words = paragraph.split(/\s+/);
    let line = '';

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;

      if (
        context.measureText(testLine).width > maxWidth &&
        line
      ) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    });

    if (line) lines.push(line);
  });

  return lines;
}

function createTextOverlay(width, height) {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  const quote = $('#editorQuote').value || $('#quoteInput').value || '';

  const boxWidth = width * 0.68;
  const centerX = width / 2;

  const fontSize = Math.round(settings.size * (width / 390));

  const fontFamilies = {
    serif: 'Georgia',
    clean: 'Arial',
    bold: 'Arial',
    soft: 'Trebuchet MS',
    classic: 'Palatino',
    modern: 'Verdana',
    typewriter: 'Courier New',
    editorial: 'Baskerville'
  };

  const family = fontFamilies[settings.font] || 'Georgia';

  const fontWeight = settings.font === 'bold' ? 'bold' : 'normal';

  context.font = `${fontWeight} ${fontSize}px "${family}"`;

  context.textBaseline = 'top';

  const lines = wrapCanvasText(
    context,
    quote,
    boxWidth
  );

  const lineHeight = fontSize * 1.28;
  const paragraphGap = settings.paragraphGap * (width / 390);

  let totalHeight = 0;

  lines.forEach((line, index) => {
    totalHeight += lineHeight;

    if (line === '') {
      totalHeight += paragraphGap;
    }
  });

  const padding = settings.blur ? width * 0.035 : 0;

  const panelHeight = totalHeight + padding * 2;

  let centerY;

  if (settings.position === 'top') {
    centerY = height * 0.27;
  } else if (settings.position === 'bottom') {
    centerY = height * 0.70;
  } else {
    centerY = height * 0.50;
  }

  centerY += (settings.offset / 100) * height;

  const safeTop = height * 0.14;
  const safeBottom = height * 0.83;

  centerY = Math.max(
    safeTop + panelHeight / 2,
    Math.min(safeBottom - panelHeight / 2, centerY)
  );

  const panelX = Math.round(centerX - boxWidth / 2 - padding);
  const panelY = Math.round(centerY - panelHeight / 2);

  const panelWidth = Math.round(boxWidth + padding * 2);
  const finalPanelHeight = Math.round(panelHeight);

  context.fillStyle = settings.color;

  context.font = `${fontWeight} ${fontSize}px "${family}"`;

  let y = panelY + padding;

  lines.forEach((line, index) => {
    if (line === '') {
      y += lineHeight + paragraphGap;
      return;
    }

    context.textAlign = settings.alignment;

    let x = centerX;

    if (settings.alignment === 'left') {
      x = panelX + padding;
    } else if (settings.alignment === 'right') {
      x = panelX + panelWidth - padding;
    }

    context.fillText(line, x, y, boxWidth);

    y += lineHeight;
  });

  return {
    canvas,
    panelX,
    panelY,
    panelWidth,
    panelHeight: finalPanelHeight,
    centerY
  };
}


/* =========================================
   FFMPEG INITIALIZATION
========================================= */

async function loadFFmpeg() {
  if (ffmpegReady) return;

  if (!ffmpeg) {
    ffmpeg = new FFmpeg();

    ffmpeg.on('progress', ({ progress }) => {
      const percentage = Math.max(
        0,
        Math.min(100, Math.round(progress * 100))
      );

      $('#progressPercent').textContent = `${percentage}%`;
      $('#progressBar').style.width = `${percentage}%`;
    });

    ffmpeg.on('log', ({ message }) => {
      console.log('[QuietFrame FFmpeg]', message);
    });
  }

  $('#progressLabel').textContent = 'Memuat mesin video...';

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

  ffmpegReady = true;
}


/* =========================================
   EXPORT FILTERS
========================================= */

function buildVideoFilter() {
  const filters = [];

  const filter = filterValues[settings.filter];

  if (filter) {
    filters.push(filter);
  }

  const brightness = (settings.brightness - 100) / 100;

  filters.push(
    `eq=brightness=${brightness.toFixed(3)}:contrast=${(settings.contrast / 100).toFixed(2)}:saturation=${(settings.saturation / 100).toFixed(2)}`
  );

  if (settings.temperature !== 0) {
    const amount = settings.temperature / 100;

    filters.push(
      `colorbalance=rs=${amount.toFixed(2)}:bs=${(-amount).toFixed(2)}`
    );
  }

  return filters.join(',');
}


/* =========================================
   EXPORT VIDEO
========================================= */

$('#exportButton')?.addEventListener('click', async () => {
  if (exporting) return;

  if (!uploadedFile) {
    alert('Video belum dipilih.');
    return;
  }

  exporting = true;

  const exportButton = $('#exportButton');

  exportButton.disabled = true;
  exportButton.querySelector('span').textContent = 'Memproses...';

  $('#exportError').textContent = '';
  $('#exportResult').classList.remove('visible');
  $('#exportProgress').classList.add('visible');

  $('#progressBar').style.width = '0%';
  $('#progressPercent').textContent = '0%';

  try {
    await loadFFmpeg();

    $('#progressLabel').textContent = 'Membaca video...';

    const inputName = 'quietframe-input.mp4';
    const outputName = 'quietframe-output.mp4';
    const overlayName = 'quietframe-text.png';

    await ffmpeg.writeFile(
      inputName,
      await fetchFile(uploadedFile)
    );

    const resolution = Number($('#resolution').value || 1080);

    const outputWidth = resolution === 720 ? 720 : 1080;
    const outputHeight = Math.round(outputWidth * 16 / 9);

    const overlay = createTextOverlay(
      outputWidth,
      outputHeight
    );

    const overlayBlob = await new Promise((resolve) => {
      overlay.canvas.toBlob(resolve, 'image/png');
    });

    if (!overlayBlob) {
      throw new Error('Gagal membuat gambar teks.');
    }

    await ffmpeg.writeFile(
      overlayName,
      await fetchFile(overlayBlob)
    );

    $('#progressLabel').textContent = 'Menyusun video...';

    const videoFilter = buildVideoFilter();

    const scaleFilter =
      `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase,crop=${outputWidth}:${outputHeight},setsar=1`;

    const baseFilter = `${scaleFilter},${videoFilter}`;

    const args = [
      '-i', inputName,
      '-i', overlayName
    ];

    if (settings.blur && settings.blurStrength > 0) {
      const x = Math.max(0, Math.round(overlay.panelX));
      const y = Math.max(0, Math.round(overlay.panelY));

      const w = Math.min(
        outputWidth - x,
        Math.round(overlay.panelWidth)
      );

      const h = Math.min(
        outputHeight - y,
        Math.round(overlay.panelHeight)
      );

      const blurAmount = Math.max(
        2,
        Math.round(settings.blurStrength / 2)
      );

      const complexFilter =
        `[0:v]${baseFilter},split=2[base][blurinput];` +
        `[blurinput]crop=${w}:${h}:${x}:${y},boxblur=${blurAmount}:1[blurred];` +
        `[base][blurred]overlay=${x}:${y}[clean];` +
        `[clean][1:v]overlay=0:0[outv]`;

      args.push(
        '-filter_complex',
        complexFilter,
        '-map',
        '[outv]'
      );
    } else {
      args.push(
        '-filter_complex',
        `[0:v]${baseFilter}[base];[base][1:v]overlay=0:0[outv]`,
        '-map',
        '[outv]'
      );
    }

    const audioMode =
      $('input[name="audioMode"]:checked')?.value || 'original';

    if (audioMode === 'original') {
      args.push(
        '-map', '0:a?',
        '-c:a', 'aac',
        '-b:a', '192k'
      );
    } else {
      args.push('-an');
    }

    args.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-shortest',
      outputName
    );

    await ffmpeg.exec(args);

    $('#progressLabel').textContent = 'Menyiapkan hasil video...';

    const outputData = await ffmpeg.readFile(outputName);

    const outputBlob = new Blob(
      [outputData.buffer],
      { type: 'video/mp4' }
    );

    if (exportedURL) {
      URL.revokeObjectURL(exportedURL);
    }

    exportedURL = URL.createObjectURL(outputBlob);

    $('#downloadButton').href = exportedURL;
    $('#downloadButton').download = 'quietframe-video.mp4';

    $('#progressBar').style.width = '100%';
    $('#progressPercent').textContent = '100%';

    $('#progressLabel').textContent = 'Selesai';

    $('#exportResult').classList.add('visible');
    $('#downloadButton').classList.add('visible');

  } catch (error) {
    console.error('QuietFrame export error:', error);

    $('#exportError').textContent =
      `Gagal memproses video: ${error.message || 'Terjadi kesalahan.'}`;

    $('#progressLabel').textContent = 'Ekspor gagal';

  } finally {
    exporting = false;

    exportButton.disabled = false;
    exportButton.querySelector('span').textContent = 'Ekspor Video';
  }
});


/* =========================================
   AUDIO OPTION VISUAL STATE
========================================= */

$$('.audio-option').forEach((option) => {
  option.addEventListener('click', () => {
    $$('.audio-option').forEach((item) => {
      item.classList.remove('active');
    });

    option.classList.add('active');

    const radio = option.querySelector('input[type="radio"]');

    if (radio) radio.checked = true;
  });
});


/* =========================================
   EXPORT CLEANUP
========================================= */

window.addEventListener('beforeunload', () => {
  if (videoURL) {
    URL.revokeObjectURL(videoURL);
  }

  if (exportedURL) {
    URL.revokeObjectURL(exportedURL);
  }
});


/* =========================================
   INITIALIZATION
========================================= */

function initializeQuietFrame() {
  $('#startEditing').disabled = true;

  $('#characterCount').textContent = '0/500';

  updatePreviewText();
  updateVideoFilter();

  showStage(1);
}

initializeQuietFrame();
