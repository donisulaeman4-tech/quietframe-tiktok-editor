
import { FFmpeg } from "https://esm.sh/@ffmpeg/ffmpeg@0.12.6";
import { fetchFile, toBlobURL } from "https://esm.sh/@ffmpeg/util@0.12.1";

/* =========================================
   QUIETFRAME — VIDEO QUOTE EDITOR
========================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  file: null,
  videoURL: null,
  outputURL: null,
  ffmpeg: null,
  ffmpegReady: false,
  exporting: false,

  stage: 1,
  duration: 15,
  resolution: 1080,

  text: "",
  textSize: 32,
  textColor: "#ffffff",
  font: "serif",
  position: "center",
  alignment: "center",
  offset: 0,
  autoFit: true,
  paragraphGap: 12,

  blurEnabled: false,
  blurStrength: 8,

  filter: "normal",

  brightness: 100,
  contrast: 100,
  saturation: 100,
  temperature: 0
};

const FONT_MAP = {
  serif: 'Georgia, "Times New Roman", serif',
  clean: 'Arial, Helvetica, sans-serif',
  bold: 'Arial, Helvetica, sans-serif',
  soft: 'Trebuchet MS, Arial, sans-serif',
  classic: '"Palatino Linotype", Palatino, serif',
  modern: 'Arial, Helvetica, sans-serif',
  typewriter: '"Courier New", monospace',
  editorial: 'Georgia, serif'
};

const FILTER_MAP = {
  normal: "",
  cinematic: "contrast=1.15:saturation=0.82:brightness=-0.025",
  blue: "colorbalance=bs=0.12:bm=0.04:rs=-0.04",
  warm: "colorbalance=rs=0.10:gs=0.035:bs=-0.10",
  mono: "hue=s=0:contrast=1.08",
  soft: "eq=contrast=0.92:saturation=0.85:brightness=0.025",
  deep: "eq=contrast=1.22:saturation=1.08:brightness=-0.035",
  golden: "colorbalance=rs=0.12:gs=0.05:bs=-0.13:saturation=1.12",
  night: "eq=brightness=-0.08:contrast=1.12:saturation=0.75"
};

const FILTER_PREVIEW = {
  normal: "",
  cinematic: "contrast(1.15) saturate(.82) brightness(.97)",
  blue: "hue-rotate(8deg) saturate(.9)",
  warm: "sepia(.22) saturate(1.12)",
  mono: "grayscale(1) contrast(1.08)",
  soft: "contrast(.92) saturate(.85) brightness(1.025)",
  deep: "contrast(1.22) saturate(1.08) brightness(.965)",
  golden: "sepia(.3) saturate(1.2)",
  night: "brightness(.88) contrast(1.12) saturate(.75)"
};


/* =========================================
   ELEMENT REFERENCES
========================================= */

const videoInput = $("#videoInput");
const uploadButton = $("#uploadButton");
const selectedVideo = $("#selectedVideo");
const videoFileName = $("#videoFileName");
const videoFileSize = $("#videoFileSize");
const removeVideo = $("#removeVideo");

const quoteInput = $("#quoteInput");
const editorQuote = $("#editorQuote");
const characterCount = $("#characterCount");

const startEditing = $("#startEditing");
const backToUpload = $("#backToUpload");
const continueToExport = $("#continueToExport");
const backToEditor = $("#backToEditor");

const previewVideo = $("#previewVideo");
const previewScreen = $("#previewScreen");
const previewQuote = $("#previewQuote");
const quotePanel = $("#quotePanel");
const quotePanelInner = $("#quotePanelInner");

const previewPlay = $("#previewPlay");
const playIcon = $("#playIcon");
const toggleTikTokUI = $("#toggleTikTokUI");
const mockTikTokUI = $("#mockTikTokUI");

const textColor = $("#textColor");
const customTextColor = $("#customTextColor");
const textSize = $("#textSize");
const textSizeValue = $("#textSizeValue");
const textOffset = $("#textOffset");
const textOffsetValue = $("#textOffsetValue");

const autoFit = $("#autoFit");
const paragraphGap = $("#paragraphGap");
const paragraphGapValue = $("#paragraphGapValue");

const blurEnabled = $("#blurEnabled");
const blurStrength = $("#blurStrength");
const blurStrengthValue = $("#blurStrengthValue");

const resolution = $("#resolution");
const durationHint = $("#durationHint");

const exportButton = $("#exportButton");
const downloadButton = $("#downloadButton");
const exportProgress = $("#exportProgress");
const progressLabel = $("#progressLabel");
const progressPercent = $("#progressPercent");
const progressBar = $("#progressBar");
const exportResult = $("#exportResult");
const exportError = $("#exportError");


/* =========================================
   GENERAL HELPERS
========================================= */

function showStage(step) {
  state.stage = step;

  $$(".stage").forEach((stage) => {
    stage.classList.toggle(
      "active",
      Number(stage.dataset.step) === step
    );
  });

  document.body.dataset.stage = String(step);

  window.scrollTo({ top: 0, behavior: "instant" });
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function showError(message) {
  exportError.textContent = message;
  exportError.classList.add("visible");
}

function clearExportMessages() {
  exportError.textContent = "";
  exportError.classList.remove("visible");
  exportResult.classList.remove("visible");
  exportProgress.classList.remove("visible");
}

function updateCharacterCount() {
  const value = quoteInput.value || "";
  setText(characterCount, `${value.length}/500`);
  startEditing.disabled = !state.file;
}


/* =========================================
   VIDEO UPLOAD
========================================= */

uploadButton.addEventListener("click", () => {
  videoInput.click();
});

videoInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("video/")) {
    alert("Silakan pilih file video yang valid.");
    videoInput.value = "";
    return;
  }

  if (state.videoURL) {
    URL.revokeObjectURL(state.videoURL);
  }

  state.file = file;
  state.videoURL = URL.createObjectURL(file);

  previewVideo.src = state.videoURL;
  previewVideo.load();

  setText(videoFileName, file.name);
  setText(videoFileSize, formatFileSize(file.size));

  selectedVideo.classList.add("visible");
  uploadButton.classList.add("has-video");

  updateCharacterCount();
});

removeVideo.addEventListener("click", () => {
  if (state.videoURL) {
    URL.revokeObjectURL(state.videoURL);
  }

  state.file = null;
  state.videoURL = null;

  previewVideo.removeAttribute("src");
  previewVideo.load();

  videoInput.value = "";

  selectedVideo.classList.remove("visible");
  uploadButton.classList.remove("has-video");

  setText(videoFileName, "Video belum dipilih");
  setText(videoFileSize, "Pilih video dari perangkat");

  updateCharacterCount();
});

previewVideo.addEventListener("error", () => {
  if (state.file) {
    console.warn("Video tidak dapat diputar pada pratinjau.");
  }
});


/* =========================================
   STAGE 1
========================================= */

quoteInput.addEventListener("input", () => {
  state.text = quoteInput.value;
  updateCharacterCount();
});

startEditing.addEventListener("click", () => {
  if (!state.file) {
    alert("Pilih video terlebih dahulu.");
    return;
  }

  state.text = quoteInput.value;
  editorQuote.value = state.text;

  updateQuotePreview();
  updateVideoAppearance();

  showStage(2);

  previewVideo.play().catch(() => {});
});


/* =========================================
   STAGE NAVIGATION
========================================= */

backToUpload.addEventListener("click", () => {
  showStage(1);
  previewVideo.pause();
});

continueToExport.addEventListener("click", () => {
  state.text = editorQuote.value;
  updateQuotePreview();
  updateDurationHint();

  showStage(3);
  previewVideo.pause();

  clearExportMessages();
});

backToEditor.addEventListener("click", () => {
  showStage(2);
  previewVideo.play().catch(() => {});
});


/* =========================================
   VIDEO PLAY / PAUSE
========================================= */

previewPlay.addEventListener("click", async () => {
  if (previewVideo.paused) {
    try {
      await previewVideo.play();
      setText(playIcon, "Ⅱ");
    } catch {
      setText(playIcon, "▶");
    }
  } else {
    previewVideo.pause();
    setText(playIcon, "▶");
  }
});

previewVideo.addEventListener("play", () => {
  setText(playIcon, "Ⅱ");
});

previewVideo.addEventListener("pause", () => {
  setText(playIcon, "▶");
});


/* =========================================
   TIKTOK PREVIEW UI
========================================= */

toggleTikTokUI.addEventListener("click", () => {
  const hidden = mockTikTokUI.classList.toggle("hidden");

  toggleTikTokUI.classList.toggle("active", !hidden);
});


/* =========================================
   EDITOR TABS
========================================= */

$$(".tool-tab").forEach((button) => {
  button.addEventListener("click", () => {
    const panelName = button.dataset.panel;

    $$(".tool-tab").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    $$(".settings-panel").forEach((panel) => {
      panel.classList.toggle(
        "active",
        panel.id === `panel-${panelName}`
      );
    });
  });
});


/* =========================================
   QUOTE TEXT
========================================= */

editorQuote.addEventListener("input", () => {
  state.text = editorQuote.value;
  updateQuotePreview();
});

function getTextFont() {
  if (state.font === "bold") {
    return `900 ${state.textSize}px ${FONT_MAP.bold}`;
  }

  return `${state.textSize}px ${FONT_MAP[state.font] || FONT_MAP.serif}`;
}

function updateQuotePreview() {
  state.text = editorQuote.value;

  previewQuote.textContent = state.text || "";

  previewQuote.style.color = state.textColor;
  previewQuote.style.fontFamily = FONT_MAP[state.font] || FONT_MAP.serif;

  previewQuote.style.fontSize = `${state.textSize}px`;
  previewQuote.style.textAlign = state.alignment;
  previewQuote.style.fontWeight = state.font === "bold" ? "900" : "normal";

  previewQuote.style.lineHeight = "1.25";

  quotePanel.classList.remove(
    "position-top",
    "position-center",
    "position-bottom"
  );

  quotePanel.classList.add(`position-${state.position}`);

  quotePanel.style.setProperty(
    "--quote-offset",
    `${state.offset}%`
  );

  quotePanelInner.style.setProperty(
    "--paragraph-gap",
    `${state.paragraphGap}px`
  );

  quotePanelInner.classList.toggle(
    "blur-active",
    state.blurEnabled
  );

  quotePanelInner.style.setProperty(
    "--quote-blur",
    `${state.blurStrength}px`
  );

  previewQuote.style.display = state.textSize === 0 ? "none" : "block";

  applyPreviewAutoFit();
}

function applyPreviewAutoFit() {
  if (!state.autoFit || state.textSize <= 0) {
    previewQuote.style.fontSize = `${state.textSize}px`;
    return;
  }

  const screen = previewScreen.getBoundingClientRect();

  if (!screen.width || !screen.height) return;

  const maxWidth = screen.width * 0.70;
  const maxHeight = screen.height * 0.34;

  const words = state.text.split(/\s+/);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  let size = state.textSize;

  while (size > 1) {
    context.font = `${size}px ${FONT_MAP[state.font]}`;

    let lines = 1;
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine
        ? `${currentLine} ${word}`
        : word;

      if (context.measureText(testLine).width > maxWidth && currentLine) {
        lines++;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    const estimatedHeight =
      lines * size * 1.25 +
      (state.paragraphGap * 0.7);

    if (estimatedHeight <= maxHeight) break;

    size--;
  }

  previewQuote.style.fontSize = `${Math.max(1, size)}px`;
}

[
  ["textSize", "textSizeValue", (value) => {
    state.textSize = Number(value);
    return value;
  }],
  ["textOffset", "textOffsetValue", (value) => {
    state.offset = Number(value);
    return `${value}%`;
  }],
  ["paragraphGap", "paragraphGapValue", (value) => {
    state.paragraphGap = Number(value);
    return `${value}px`;
  }],
  ["blurStrength", "blurStrengthValue", (value) => {
    state.blurStrength = Number(value);
    return value;
  }]
].forEach(([inputId, outputId, update]) => {
  const input = $(`#${inputId}`);
  const output = $(`#${outputId}`);

  input.addEventListener("input", () => {
    const displayValue = update(input.value);
    setText(output, displayValue);
    updateQuotePreview();
  });
});


/* =========================================
   TEXT COLOR
========================================= */

textColor.addEventListener("change", () => {
  state.textColor = textColor.value;
  customTextColor.value = textColor.value;
  updateQuotePreview();
});

customTextColor.addEventListener("input", () => {
  state.textColor = customTextColor.value;
  textColor.value = customTextColor.value;
  updateQuotePreview();
});


/* =========================================
   TEXT POSITION
========================================= */

$$(".position-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.position = button.dataset.position;

    $$(".position-button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    updateQuotePreview();
  });
});

$$(".align-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.alignment = button.dataset.align;

    $$(".align-button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    updateQuotePreview();
  });
});


/* =========================================
   AUTO FIT
========================================= */

autoFit.addEventListener("change", () => {
  state.autoFit = autoFit.checked;
  updateQuotePreview();
});


/* =========================================
   BLUR
========================================= */

blurEnabled.addEventListener("change", () => {
  state.blurEnabled = blurEnabled.checked;
  updateQuotePreview();
});


/* =========================================
   FONT SELECTION
========================================= */

$$(".font-option").forEach((button) => {
  button.addEventListener("click", () => {
    state.font = button.dataset.font;

    $$(".font-option").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    updateQuotePreview();
  });
});


/* =========================================
   FILTER SELECTION
========================================= */

$$(".filter-option").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;

    $$(".filter-option").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    updateVideoAppearance();
  });
});


/* =========================================
   IMAGE ADJUSTMENTS
========================================= */

function updateVideoAppearance() {
  const filter = FILTER_PREVIEW[state.filter] || "";

  const adjustment = [
    `brightness(${state.brightness}%)`,
    `contrast(${state.contrast}%)`,
    `saturate(${state.saturation}%)`,
    filter
  ].filter(Boolean).join(" ");

  previewVideo.style.filter = adjustment;
}

const adjustmentControls = [
  ["brightness", "brightnessValue", "brightness", "%"],
  ["contrast", "contrastValue", "contrast", "%"],
  ["saturation", "saturationValue", "saturation", "%"],
  ["temperature", "temperatureValue", "temperature", ""]
];

adjustmentControls.forEach(([id, outputId, key, suffix]) => {
  const input = $(`#${id}`);
  const output = $(`#${outputId}`);

  input.addEventListener("input", () => {
    state[key] = Number(input.value);

    setText(output, `${input.value}${suffix}`);
    updateVideoAppearance();
  });
});

$("#autoAdjust").addEventListener("click", () => {
  state.brightness = 105;
  state.contrast = 108;
  state.saturation = 106;
  state.temperature = 5;

  $("#brightness").value = 105;
  $("#contrast").value = 108;
  $("#saturation").value = 106;
  $("#temperature").value = 5;

  setText($("#brightnessValue"), "105%");
  setText($("#contrastValue"), "108%");
  setText($("#saturationValue"), "106%");
  setText($("#temperatureValue"), "5");

  updateVideoAppearance();
});

$("#resetAdjustments").addEventListener("click", () => {
  state.brightness = 100;
  state.contrast = 100;
  state.saturation = 100;
  state.temperature = 0;
  state.filter = "normal";

  $("#brightness").value = 100;
  $("#contrast").value = 100;
  $("#saturation").value = 100;
  $("#temperature").value = 0;

  setText($("#brightnessValue"), "100%");
  setText($("#contrastValue"), "100%");
  setText($("#saturationValue"), "100%");
  setText($("#temperatureValue"), "0");

  $$(".filter-option").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.filter === "normal"
    );
  });

  updateVideoAppearance();
});


/* =========================================
   EXPORT DURATION
========================================= */

$$("[data-duration]").forEach((button) => {
  button.addEventListener("click", () => {
    state.duration = Number(button.dataset.duration);

    $$("[data-duration]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    updateDurationHint();
  });
});

function updateDurationHint() {
  if (!state.file) return;

  const video = document.createElement("video");
  const url = URL.createObjectURL(state.file);

  video.preload = "metadata";
  video.src = url;

  video.onloadedmetadata = () => {
    const actualDuration = video.duration;

    if (Number.isFinite(actualDuration) && actualDuration < state.duration) {
      durationHint.textContent =
        `Video asli ${actualDuration.toFixed(1)} detik. Durasi hasil akan mengikuti video asli.`;
    } else {
      durationHint.textContent =
        `Video akan dipotong otomatis menjadi maksimal ${state.duration} detik.`;
    }

    URL.revokeObjectURL(url);
  };

  video.onerror = () => {
    durationHint.textContent =
      `Durasi hasil maksimal ${state.duration} detik.`;

    URL.revokeObjectURL(url);
  };
}

resolution.addEventListener("change", () => {
  state.resolution = Number(resolution.value);
});


/* =========================================
   EXPORT AUDIO OPTION
========================================= */

$$('input[name="audioMode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    $$(".audio-option").forEach((option) => {
      option.classList.toggle(
        "active",
        option.querySelector("input").checked
      );
    });
  });
});


/* =========================================
   TEXT CANVAS
========================================= */

function wrapText(context, text, maxWidth) {
  const paragraphs = text.split("\n");
  const lines = [];

  paragraphs.forEach((paragraph) => {
    if (!paragraph.trim()) {
      lines.push("");
      return;
    }

    const words = paragraph.split(/\s+/);
    let line = "";

    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;

      if (context.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });

    if (line) lines.push(line);
  });

  return lines;
}

function createTextOverlay(width, height) {
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  context.clearRect(0, 0, width, height);

  if (!state.text.trim() || state.textSize === 0) {
    return canvas;
  }

  const safeWidth = width * 0.76;
  const safeHeight = height * 0.36;

  let fontSize = state.textSize;
  let lines = [];

  function calculateLines(size) {
    context.font =
      `${state.font === "bold" ? "900 " : ""}${size}px ${FONT_MAP[state.font]}`;

    return wrapText(context, state.text, safeWidth);
  }

  lines = calculateLines(fontSize);

  if (state.autoFit) {
    while (fontSize > 1) {
      lines = calculateLines(fontSize);

      const lineHeight = fontSize * 1.25;
      const paragraphCount = state.text.split("\n").length;
      const estimatedHeight =
        lines.length * lineHeight +
        Math.max(0, paragraphCount - 1) *
        (state.paragraphGap * height / 1920);

      if (estimatedHeight <= safeHeight) break;

      fontSize--;
    }
  }

  context.font =
    `${state.font === "bold" ? "900 " : ""}${fontSize}px ${FONT_MAP[state.font]}`;

  context.textAlign = state.alignment;
  context.textBaseline = "middle";
  context.fillStyle = state.textColor;

  context.shadowColor = "rgba(0,0,0,0.38)";
  context.shadowBlur = fontSize * 0.12;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = fontSize * 0.04;

  const lineHeight = fontSize * 1.25;
  const paragraphSpacing = state.paragraphGap * height / 1920;

  const paragraphLines = [];
  let currentParagraph = 0;

  state.text.split("\n").forEach((paragraph) => {
    const paragraphWrapped = wrapText(
      context,
      paragraph,
      safeWidth
    );

    paragraphLines.push({
      lines: paragraphWrapped.length ? paragraphWrapped : [""],
      paragraph: currentParagraph++
    });
  });

  let totalHeight = 0;

  paragraphLines.forEach((item) => {
    totalHeight += item.lines.length * lineHeight;
  });

  totalHeight += Math.max(0, paragraphLines.length - 1) * paragraphSpacing;

  let centerY;

  if (state.position === "top") {
    centerY = height * 0.28;
  } else if (state.position === "bottom") {
    centerY = height * 0.68;
  } else {
    centerY = height * 0.50;
  }

  centerY += (state.offset / 100) * height * 0.35;

  let y = centerY - totalHeight / 2 + lineHeight / 2;

  const x = state.alignment === "left"
    ? width * 0.12
    : state.alignment === "right"
      ? width * 0.88
      : width * 0.50;

  /* Background lembut di belakang teks.
     Blur CSS preview tidak dapat diekspor identik,
     jadi ekspor memakai lapisan transparan. */

  if (state.blurEnabled) {
    const paddingX = fontSize * 0.55;
    const paddingY = fontSize * 0.32;

    const boxWidth = Math.min(
      safeWidth + paddingX * 2,
      width * 0.86
    );

    const boxHeight = totalHeight + paddingY * 2;

    const boxX = state.alignment === "left"
      ? width * 0.12 - paddingX
      : state.alignment === "right"
        ? width * 0.88 - boxWidth + paddingX
        : width * 0.50 - boxWidth / 2;

    const boxY = centerY - boxHeight / 2;

    context.save();
    context.shadowColor = "transparent";
    context.fillStyle = `rgba(0,0,0,${clamp(state.blurStrength / 60, 0.03, 0.35)})`;

    const radius = fontSize * 0.35;

    context.beginPath();
    context.roundRect(
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      radius
    );
    context.fill();
    context.restore();
  }

  context.shadowColor = "rgba(0,0,0,0.38)";
  context.shadowBlur = fontSize * 0.12;

  paragraphLines.forEach((paragraph, index) => {
    paragraph.lines.forEach((line) => {
      context.fillText(line, x, y);
      y += lineHeight;
    });

    if (index < paragraphLines.length - 1) {
      y += paragraphSpacing;
    }
  });

  return canvas;
}


/* =========================================
   FFMPEG INITIALIZATION
========================================= */

async function loadFFmpeg() {
  if (state.ffmpegReady) return;

  if (!state.ffmpeg) {
    state.ffmpeg = new FFmpeg();
  }

  const ffmpeg = state.ffmpeg;

  ffmpeg.on("progress", ({ progress }) => {
    if (!state.exporting) return;

    const percent = clamp(
      Math.round(progress * 100),
      0,
      99
    );

    setText(progressPercent, `${percent}%`);
    progressBar.style.width = `${percent}%`;
  });

  ffmpeg.on("log", ({ message }) => {
    console.log("[QuietFrame FFmpeg]", message);
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

  await ffmpeg.load({
    coreURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.js`,
      "text/javascript"
    ),
    wasmURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      "application/wasm"
    )
  });

  state.ffmpegReady = true;
}


/* =========================================
   EXPORT HELPERS
========================================= */

function getVideoDimensions() {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(state.file);

    video.preload = "metadata";
    video.src = url;

    video.onloadedmetadata = () => {
      const width = video.videoWidth || 1080;
      const height = video.videoHeight || 1920;

      URL.revokeObjectURL(url);

      resolve({ width, height });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Tidak dapat membaca ukuran video."));
    };
  });
}

function getOutputDimensions(sourceWidth, sourceHeight) {
  const targetHeight = state.resolution;

  const ratio = sourceWidth / sourceHeight;

  let width = Math.round(targetHeight * ratio);

  width = Math.max(2, width - (width % 2));

  return {
    width,
    height: targetHeight
  };
}

function getFFmpegVideoFilter() {
  const filters = [];

  filters.push(
    `scale=${state.resolution === 1080 ? "1080" : "720"}:-2`
  );

  if (state.filter !== "normal" && FILTER_MAP[state.filter]) {
    filters.push(FILTER_MAP[state.filter]);
  }

  const brightness = (state.brightness - 100) / 100;
  const contrast = state.contrast / 100;
  const saturation = state.saturation / 100;

  filters.push(
    `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`
  );

  if (state.temperature !== 0) {
    const amount = state.temperature / 100;

    filters.push(
      `colorbalance=rs=${amount}:bs=${-amount}`
    );
  }

  return filters.join(",");
}

function updateProgress(percent, label) {
  setText(progressPercent, `${percent}%`);
  setText(progressLabel, label);
  progressBar.style.width = `${percent}%`;
}


/* =========================================
   MAIN EXPORT PROCESS
========================================= */

async function exportVideo() {
  if (!state.file) {
    showError("Pilih video terlebih dahulu.");
    return;
  }

  if (state.exporting) return;

  state.exporting = true;

  exportButton.disabled = true;
  exportButton.classList.add("loading");

  clearExportMessages();

  exportProgress.classList.add("visible");

  updateProgress(0, "Menyiapkan video...");

  try {
    await loadFFmpeg();

    updateProgress(8, "Membaca video...");

    const ffmpeg = state.ffmpeg;

    const inputName = "quietframe-input";
    const overlayName = "quietframe-overlay.png";
    const outputName = "quietframe-output.mp4";

    try {
      await ffmpeg.deleteFile(inputName);
    } catch {}

    try {
      await ffmpeg.deleteFile(overlayName);
    } catch {}

    try {
      await ffmpeg.deleteFile(outputName);
    } catch {}

    await ffmpeg.writeFile(
      inputName,
      await fetchFile(state.file)
    );

    updateProgress(20, "Menyiapkan teks...");

    const dimensions = await getVideoDimensions();

    const outputDimensions = getOutputDimensions(
      dimensions.width,
      dimensions.height
    );

    const overlayCanvas = createTextOverlay(
      outputDimensions.width,
      outputDimensions.height
    );

    const overlayBlob = await new Promise((resolve) => {
      overlayCanvas.toBlob(resolve, "image/png");
    });

    if (!overlayBlob) {
      throw new Error("Gagal membuat lapisan teks.");
    }

    await ffmpeg.writeFile(
      overlayName,
      await fetchFile(overlayBlob)
    );

    updateProgress(30, "Memproses video...");

    const selectedAudio =
      $('input[name="audioMode"]:checked')?.value || "original";

    const videoFilter = getFFmpegVideoFilter();

    const command = [
      "-i", inputName,
      "-i", overlayName,

      "-filter_complex",
      `[0:v]${videoFilter}[base];[base][1:v]overlay=0:0:format=auto[vout]`,

      "-map", "[vout]"
    ];

    if (selectedAudio === "original") {
      command.push("-map", "0:a?");
      command.push("-c:a", "aac");
      command.push("-b:a", "128k");
    } else {
      command.push("-an");
    }

    command.push(
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-t", String(state.duration),
      "-shortest",
      "-movflags", "+faststart",
      outputName
    );

    updateProgress(40, "Merender video...");

    const exitCode = await ffmpeg.exec(command);

    if (exitCode !== 0) {
      throw new Error("Proses FFmpeg gagal. Coba gunakan video lain.");
    }

    updateProgress(94, "Menyiapkan hasil...");

    const outputData = await ffmpeg.readFile(outputName);

    const outputBlob = new Blob(
      [outputData.buffer],
      { type: "video/mp4" }
    );

    if (state.outputURL) {
      URL.revokeObjectURL(state.outputURL);
    }

    state.outputURL = URL.createObjectURL(outputBlob);

    downloadButton.href = state.outputURL;
    downloadButton.download = "quietframe-video.mp4";

    updateProgress(100, "Video selesai dibuat.");

    exportResult.classList.add("visible");
    downloadButton.classList.add("visible");

    setText(
      progressLabel,
      "Ekspor berhasil"
    );

    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(overlayName);
      await ffmpeg.deleteFile(outputName);
    } catch {}

  } catch (error) {
    console.error("QuietFrame export error:", error);

    showError(
      `Gagal memproses video: ${error.message || "Terjadi kesalahan."}`
    );

    setText(progressLabel, "Ekspor gagal");

  } finally {
    state.exporting = false;

    exportButton.disabled = false;
    exportButton.classList.remove("loading");
  }
}


/* =========================================
   EXPORT BUTTON
========================================= */

exportButton.addEventListener("click", exportVideo);


/* =========================================
   DOWNLOAD RESULT
========================================= */

downloadButton.addEventListener("click", (event) => {
  if (!state.outputURL) {
    event.preventDefault();
    showError("Video belum berhasil dibuat.");
  }
});


/* =========================================
   RESPONSIVE PREVIEW
========================================= */

if ("ResizeObserver" in window) {
  const resizeObserver = new ResizeObserver(() => {
    if (state.stage === 2) {
      applyPreviewAutoFit();
    }
  });

  resizeObserver.observe(previewScreen);
} else {
  window.addEventListener("resize", () => {
    applyPreviewAutoFit();
  });
}


/* =========================================
   INITIALIZATION
========================================= */

function initialize() {
  showStage(1);

  updateCharacterCount();
  updateQuotePreview();
  updateVideoAppearance();

  setText(textSizeValue, state.textSize);
  setText(textOffsetValue, "0");
  setText(paragraphGapValue, `${state.paragraphGap}px`);
  setText(blurStrengthValue, state.blurStrength);

  setText($("#brightnessValue"), "100%");
  setText($("#contrastValue"), "100%");
  setText($("#saturationValue"), "100%");
  setText($("#temperatureValue"), "0");

  downloadButton.classList.remove("visible");
  exportResult.classList.remove("visible");
  exportProgress.classList.remove("visible");
}

initialize();
