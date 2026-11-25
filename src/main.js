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
  offsetX: 0,
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
  clean: "Arial, Helvetica, sans-serif",
  bold: "Arial, Helvetica, sans-serif",
  soft: '"Trebuchet MS", Arial, sans-serif',
  classic: '"Palatino Linotype", Palatino, serif',
  modern: "Arial, Helvetica, sans-serif",
  typewriter: '"Courier New", monospace',
  editorial: "Georgia, serif"
};

const FILTER_MAP = {
  normal: "",
  cinematic: "eq=contrast=1.15:saturation=0.82:brightness=-0.025",
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
const textOffsetX = $("#textOffsetX");
const textOffsetXValue = $("#textOffsetXValue");

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
   HELPERS
========================================= */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function showError(message) {
  if (!exportError) return;
  exportError.textContent = message;
  exportError.classList.add("visible");
}

function clearExportMessages() {
  exportError?.classList.remove("visible");
  exportResult?.classList.remove("visible");
  exportProgress?.classList.remove("visible");
  if (exportError) exportError.textContent = "";
}

function formatFileSize(bytes) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showStage(step) {
  state.stage = step;

  $$(".stage").forEach((stage) => {
    stage.classList.toggle("active", Number(stage.dataset.step) === step);
  });

  document.body.dataset.stage = String(step);
  window.scrollTo({ top: 0, behavior: "instant" });
}

function updateCharacterCount() {
  const value = quoteInput?.value || "";
  setText(characterCount, `${value.length}/500`);
  if (startEditing) startEditing.disabled = !state.file;
}

function fontString(size) {
  const weight = state.font === "bold" ? "900 " : "";
  return `${weight}${size}px ${FONT_MAP[state.font] || FONT_MAP.serif}`;
}

/* =========================================
   VIDEO UPLOAD
========================================= */

uploadButton?.addEventListener("click", () => videoInput?.click());

videoInput?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("video/")) {
    alert("Silakan pilih file video yang valid.");
    videoInput.value = "";
    return;
  }

  if (state.videoURL) URL.revokeObjectURL(state.videoURL);

  state.file = file;
  state.videoURL = URL.createObjectURL(file);

  if (previewVideo) {
    previewVideo.src = state.videoURL;
    previewVideo.load();
  }

  setText(videoFileName, file.name);
  setText(videoFileSize, formatFileSize(file.size));

  selectedVideo?.classList.add("visible");
  uploadButton?.classList.add("has-video");

  updateCharacterCount();
  updateDurationHint();
});

removeVideo?.addEventListener("click", () => {
  if (state.videoURL) URL.revokeObjectURL(state.videoURL);

  state.file = null;
  state.videoURL = null;

  previewVideo?.removeAttribute("src");
  previewVideo?.load();

  if (videoInput) videoInput.value = "";

  selectedVideo?.classList.remove("visible");
  uploadButton?.classList.remove("has-video");

  setText(videoFileName, "Video belum dipilih");
  setText(videoFileSize, "Pilih video dari perangkat");

  updateCharacterCount();
});

/* =========================================
   STAGE 1 & NAVIGATION
========================================= */

quoteInput?.addEventListener("input", () => {
  state.text = quoteInput.value;
  updateCharacterCount();
});

startEditing?.addEventListener("click", () => {
  if (!state.file) {
    alert("Pilih video terlebih dahulu.");
    return;
  }

  state.text = quoteInput?.value || "";
  if (editorQuote) editorQuote.value = state.text;

  updateQuotePreview();
  updateVideoAppearance();
  showStage(2);

  previewVideo?.play().catch(() => {});
});

backToUpload?.addEventListener("click", () => {
  showStage(1);
  previewVideo?.pause();
});

continueToExport?.addEventListener("click", () => {
  state.text = editorQuote?.value ?? state.text;
  updateQuotePreview();
  updateDurationHint();

  showStage(3);
  previewVideo?.pause();
  clearExportMessages();
});

backToEditor?.addEventListener("click", () => {
  showStage(2);
  previewVideo?.play().catch(() => {});
});

/* =========================================
   VIDEO PLAY / PAUSE
========================================= */

previewPlay?.addEventListener("click", async () => {
  if (!previewVideo) return;

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

previewVideo?.addEventListener("play", () => setText(playIcon, "Ⅱ"));
previewVideo?.addEventListener("pause", () => setText(playIcon, "▶"));

/* =========================================
   TIKTOK PREVIEW UI
========================================= */

toggleTikTokUI?.addEventListener("click", () => {
  const hidden = mockTikTokUI?.classList.toggle("hidden");
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
      panel.classList.toggle("active", panel.id === `panel-${panelName}`);
    });
  });
});

/* =========================================
   TEXT WRAPPING
========================================= */

function wrapText(context, text, maxWidth) {
  const lines = [];

  text.split("\n").forEach((paragraph) => {
    if (!paragraph.trim()) {
      lines.push("");
      return;
    }

    let line = "";

    paragraph.split(/\s+/).forEach((word) => {
      let test = line ? `${line} ${word}` : word;

      if (context.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
        test = word;
      } else {
        line = test;
      }

      /* Pecah kata yang sangat panjang agar tidak keluar area */
      if (context.measureText(line).width > maxWidth) {
        let part = "";
        for (const char of line) {
          const candidate = part + char;
          if (context.measureText(candidate).width > maxWidth && part) {
            lines.push(part);
            part = char;
          } else {
            part = candidate;
          }
        }
        line = part;
      }
    });

    if (line) lines.push(line);
  });

  return lines;
}

/* =========================================
   QUOTE PREVIEW & AUTO FIT
========================================= */

function getPreviewFontSize() {
  if (!previewQuote) return state.textSize;
  return Number.parseFloat(getComputedStyle(previewQuote).fontSize) || state.textSize;
}

function getFittedFontSize(maxWidth, maxHeight, baseSize, gap) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return baseSize;

  let size = Math.max(1, baseSize);

  while (size > 1) {
    context.font = fontString(size);
    const lines = wrapText(context, state.text, maxWidth);
    const paragraphCount = state.text.split("\n").length;
    const height =
      lines.length * size * 1.25 +
      Math.max(0, paragraphCount - 1) * gap;

    if (height <= maxHeight) break;
    size--;
  }

  return Math.max(1, size);
}

function applyPreviewAutoFit() {
  if (!previewQuote || !previewScreen) return;

  if (state.textSize === 0) {
    previewQuote.style.display = "none";
    return;
  }

  previewQuote.style.display = "block";

  const width = previewScreen.clientWidth;
  const height = previewScreen.clientHeight;
  if (!width || !height) return;

  if (!state.autoFit) {
    previewQuote.style.fontSize = `${state.textSize}px`;
    return;
  }

  const size = getFittedFontSize(
    width * 0.76,
    height * 0.36,
    state.textSize,
    state.paragraphGap
  );

  previewQuote.style.fontSize = `${size}px`;
}

function updateQuotePreview() {
  if (!previewQuote || !quotePanel || !quotePanelInner) return;

  state.text = editorQuote?.value ?? state.text;
  previewQuote.textContent = state.text;

  previewQuote.style.color = state.textColor;
  previewQuote.style.fontFamily = FONT_MAP[state.font] || FONT_MAP.serif;
  previewQuote.style.fontSize = `${state.textSize}px`;
  previewQuote.style.textAlign = state.alignment;
  previewQuote.style.fontWeight = state.font === "bold" ? "900" : "normal";
  previewQuote.style.lineHeight = "1.25";
  previewQuote.style.display = state.textSize === 0 ? "none" : "block";

  quotePanel.classList.remove(
    "position-top",
    "position-center",
    "position-bottom"
  );
  quotePanel.classList.add(`position-${state.position}`);

  const screenHeight = previewScreen?.clientHeight || 0;
  quotePanel.style.setProperty(
    "--quote-offset",
    `${(state.offset / 100) * screenHeight * 0.35}px`
  );
  quotePanel.style.setProperty("--quote-offset-x", `${state.offsetX}%`);

  quotePanelInner.style.setProperty(
    "--paragraph-gap",
    `${state.paragraphGap}px`
  );

  quotePanelInner.classList.toggle("blur-active", state.blurEnabled);
  quotePanelInner.style.setProperty("--quote-blur", `${state.blurStrength}px`);

  applyPreviewAutoFit();
}

editorQuote?.addEventListener("input", updateQuotePreview);

/* =========================================
   TEXT SLIDERS
========================================= */

[
  ["textSize", "textSizeValue", (value) => {
    state.textSize = Number(value);
    return `${value}px`;
  }],
  ["textOffset", "textOffsetValue", (value) => {
    state.offset = Number(value);
    return `${value}%`;
  }],
  ["textOffsetX", "textOffsetXValue", (value) => {
    state.offsetX = Number(value);
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
  if (!input) return;

  input.addEventListener("input", () => {
    setText(output, update(input.value));
    updateQuotePreview();
  });
});

/* =========================================
   TEXT COLOR
========================================= */

textColor?.addEventListener("change", () => {
  state.textColor = textColor.value;
  if (customTextColor) customTextColor.value = textColor.value;
  updateQuotePreview();
});

customTextColor?.addEventListener("input", () => {
  state.textColor = customTextColor.value;
  if (textColor) textColor.value = customTextColor.value;
  updateQuotePreview();
});

/* =========================================
   POSITION & ALIGNMENT
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

autoFit?.addEventListener("change", () => {
  state.autoFit = autoFit.checked;
  updateQuotePreview();
});

blurEnabled?.addEventListener("change", () => {
  state.blurEnabled = blurEnabled.checked;
  updateQuotePreview();
});

/* =========================================
   DRAG TEXT DIRECTLY IN PREVIEW
========================================= */

if (quotePanel && previewScreen) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;

  quotePanel.style.touchAction = "none";

  quotePanel.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, input, textarea")) return;
    if (!state.text.trim() || state.textSize === 0) return;

    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    initialX = state.offsetX;
    initialY = state.offset;

    quotePanel.setPointerCapture?.(event.pointerId);
  });

  quotePanel.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    const rect = previewScreen.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    state.offsetX = clamp(
      initialX + ((event.clientX - startX) / rect.width) * 100,
      -35,
      35
    );

    state.offset = clamp(
      initialY + ((event.clientY - startY) / (rect.height * 0.35)) * 100,
      -100,
      100
    );

    if (textOffsetX) textOffsetX.value = state.offsetX;
    if (textOffset) textOffset.value = state.offset;

    setText(textOffsetXValue, `${Math.round(state.offsetX)}%`);
    setText(textOffsetValue, `${Math.round(state.offset)}%`);

    updateQuotePreview();
  });

  const stopDragging = () => {
    dragging = false;
  };

  quotePanel.addEventListener("pointerup", stopDragging);
  quotePanel.addEventListener("pointercancel", stopDragging);
  quotePanel.addEventListener("lostpointercapture", stopDragging);
}

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
  if (!previewVideo) return;

  const filter = FILTER_PREVIEW[state.filter] || "";
  const temperature = state.temperature
    ? `sepia(${Math.abs(state.temperature) / 180}) hue-rotate(${state.temperature * 0.35}deg)`
    : "";

  previewVideo.style.filter = [
    `brightness(${state.brightness}%)`,
    `contrast(${state.contrast}%)`,
    `saturate(${state.saturation}%)`,
    filter,
    temperature
  ].filter(Boolean).join(" ");
}

[
  ["brightness", "brightnessValue", "brightness", "%"],
  ["contrast", "contrastValue", "contrast", "%"],
  ["saturation", "saturationValue", "saturation", "%"],
  ["temperature", "temperatureValue", "temperature", ""]
].forEach(([id, outputId, key, suffix]) => {
  const input = $(`#${id}`);
  if (!input) return;

  input.addEventListener("input", () => {
    state[key] = Number(input.value);
    setText($(`#${outputId}`), `${input.value}${suffix}`);
    updateVideoAppearance();
  });
});

$("#autoAdjust")?.addEventListener("click", () => {
  state.brightness = 105;
  state.contrast = 108;
  state.saturation = 106;
  state.temperature = 5;

  [
    ["brightness", 105, "105%"],
    ["contrast", 108, "108%"],
    ["saturation", 106, "106%"],
    ["temperature", 5, "5"]
  ].forEach(([id, value, label]) => {
    const input = $(`#${id}`);
    if (input) input.value = value;
    setText($(`#${id}Value`), label);
  });

  updateVideoAppearance();
});

$("#resetAdjustments")?.addEventListener("click", () => {
  state.brightness = 100;
  state.contrast = 100;
  state.saturation = 100;
  state.temperature = 0;
  state.filter = "normal";

  [
    ["brightness", 100, "100%"],
    ["contrast", 100, "100%"],
    ["saturation", 100, "100%"],
    ["temperature", 0, "0"]
  ].forEach(([id, value, label]) => {
    const input = $(`#${id}`);
    if (input) input.value = value;
    setText($(`#${id}Value`), label);
  });

  $$(".filter-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === "normal");
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
  if (!state.file || !durationHint) return;

  const video = document.createElement("video");
  const url = URL.createObjectURL(state.file);

  video.preload = "metadata";
  video.src = url;

  video.onloadedmetadata = () => {
    const actualDuration = video.duration;

    durationHint.textContent =
      Number.isFinite(actualDuration) && actualDuration < state.duration
        ? `Video asli ${actualDuration.toFixed(1)} detik. Hasil akan mengikuti durasi asli video.`
        : `Video akan dipotong otomatis menjadi maksimal ${state.duration} detik.`;

    URL.revokeObjectURL(url);
  };

  video.onerror = () => {
    durationHint.textContent = `Durasi hasil maksimal ${state.duration} detik.`;
    URL.revokeObjectURL(url);
  };
}

resolution?.addEventListener("change", () => {
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
        Boolean(option.querySelector("input")?.checked)
      );
    });
  });
});

/* =========================================
   CANVAS TEXT OVERLAY
========================================= */

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function createTextOverlay(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);

  if (!state.text.trim() || state.textSize === 0) return canvas;

  const previewWidth = previewScreen?.clientWidth || 300;
  const scale = width / previewWidth;
  const safeWidth = width * 0.76;
  const safeHeight = height * 0.36;

  let previewFontSize = state.textSize;

  if (state.autoFit) {
    previewFontSize = getFittedFontSize(
      previewWidth * 0.76,
      (previewScreen?.clientHeight || previewWidth * 16 / 9) * 0.36,
      state.textSize,
      state.paragraphGap
    );
  }

  const fontSize = Math.max(1, previewFontSize * scale);
  const paragraphSpacing = state.paragraphGap * scale;
  context.font = fontString(fontSize);
  context.textAlign = state.alignment;
  context.textBaseline = "middle";

  const paragraphLines = state.text.split("\n").map((paragraph) => {
    return wrapText(context, paragraph, safeWidth);
  });

  let totalHeight = 0;

  paragraphLines.forEach((paragraph, index) => {
    totalHeight += Math.max(1, paragraph.length) * fontSize * 1.25;
    if (index < paragraphLines.length - 1) totalHeight += paragraphSpacing;
  });

  /* Jika auto-fit aktif, pastikan tinggi teks tidak melewati batas */
  if (state.autoFit && totalHeight > safeHeight) {
    let adjusted = fontSize;

    while (adjusted > 1 && totalHeight > safeHeight) {
      adjusted -= 1;
      context.font = fontString(adjusted);

      const newLines = state.text.split("\n").map((paragraph) => {
        return wrapText(context, paragraph, safeWidth);
      });

      totalHeight = 0;
      newLines.forEach((paragraph, index) => {
        totalHeight += Math.max(1, paragraph.length) * adjusted * 1.25;
        if (index < newLines.length - 1) totalHeight += paragraphSpacing;
      });

      paragraphLines.splice(0, paragraphLines.length, ...newLines);
    }

    context.font = fontString(adjusted);
  }

  const finalFontSize = Number.parseFloat(context.font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || fontSize;
  const lineHeight = finalFontSize * 1.25;

  totalHeight = 0;
  paragraphLines.forEach((paragraph, index) => {
    totalHeight += Math.max(1, paragraph.length) * lineHeight;
    if (index < paragraphLines.length - 1) totalHeight += paragraphSpacing;
  });

  let centerY = state.position === "top"
    ? height * 0.28
    : state.position === "bottom"
      ? height * 0.70
      : height * 0.50;

  centerY += (state.offset / 100) * height * 0.35;

  const baseX = state.alignment === "left"
    ? width * 0.12
    : state.alignment === "right"
      ? width * 0.88
      : width * 0.50;

  const x = baseX + (state.offsetX / 100) * width;

  if (state.blurEnabled) {
    let widestLine = 0;

    paragraphLines.flat().forEach((line) => {
      widestLine = Math.max(widestLine, context.measureText(line).width);
    });

    const paddingX = finalFontSize * 0.55;
    const paddingY = finalFontSize * 0.32;
    const boxWidth = Math.min(widestLine + paddingX * 2, width * 0.86);
    const boxHeight = totalHeight + paddingY * 2;

    let boxX = x - boxWidth / 2;
    if (state.alignment === "left") boxX = x - paddingX;
    if (state.alignment === "right") boxX = x - boxWidth + paddingX;

    const boxY = centerY - boxHeight / 2;

    context.save();
    context.fillStyle = `rgba(0,0,0,${clamp(state.blurStrength / 60, 0.03, 0.35)})`;
    drawRoundedRect(context, boxX, boxY, boxWidth, boxHeight, finalFontSize * 0.35);
    context.fill();
    context.restore();
  }

  context.fillStyle = state.textColor;
  context.shadowColor = "rgba(0,0,0,.38)";
  context.shadowBlur = finalFontSize * 0.12;
  context.shadowOffsetY = finalFontSize * 0.04;

  let y = centerY - totalHeight / 2 + lineHeight / 2;

  paragraphLines.forEach((paragraph, index) => {
    const rows = paragraph.length ? paragraph : [""];

    rows.forEach((line) => {
      context.fillText(line, x, y);
      y += lineHeight;
    });

    if (index < paragraphLines.length - 1) y += paragraphSpacing;
  });

  return canvas;
}

/* =========================================
   FFMPEG INITIALIZATION
========================================= */

async function loadFFmpeg() {
  if (state.ffmpegReady) return;

  if (!state.ffmpeg) state.ffmpeg = new FFmpeg();

  const ffmpeg = state.ffmpeg;

  ffmpeg.on("progress", ({ progress }) => {
    if (!state.exporting) return;
    const percent = clamp(Math.round(progress * 100), 0, 99);
    setText(progressPercent, `${percent}%`);
    if (progressBar) progressBar.style.width = `${percent}%`;
  });

  ffmpeg.on("log", ({ message }) => {
    console.log("[QuietFrame FFmpeg]", message);
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
  });

  state.ffmpegReady = true;
}

/* =========================================
   OUTPUT DIMENSIONS & FILTER
========================================= */

function getOutputDimensions() {
  const height = state.resolution === 720 ? 1280 : 1920;
  return {
    width: Math.round(height * 9 / 16),
    height
  };
}

function getFFmpegVideoFilter() {
  const { width, height } = getOutputDimensions();

  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    "setsar=1"
  ];

  if (state.filter !== "normal" && FILTER_MAP[state.filter]) {
    filters.push(FILTER_MAP[state.filter]);
  }

  filters.push(
    `eq=brightness=${(state.brightness - 100) / 100}:contrast=${state.contrast / 100}:saturation=${state.saturation / 100}`
  );

  if (state.temperature !== 0) {
    const amount = state.temperature / 100;
    filters.push(`colorbalance=rs=${amount}:bs=${-amount}`);
  }

  return filters.join(",");
}

function updateProgress(percent, label) {
  setText(progressPercent, `${percent}%`);
  setText(progressLabel, label);
  if (progressBar) progressBar.style.width = `${percent}%`;
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
  if (exportButton) {
    exportButton.disabled = true;
    exportButton.classList.add("loading");
  }

  clearExportMessages();
  exportProgress?.classList.add("visible");
  updateProgress(0, "Menyiapkan video...");

  try {
    await loadFFmpeg();
    updateProgress(8, "Membaca video...");

    const ffmpeg = state.ffmpeg;
    const inputName = "quietframe-input.mp4";
    const overlayName = "quietframe-overlay.png";
    const outputName = "quietframe-output.mp4";

    for (const name of [inputName, overlayName, outputName]) {
      try {
        await ffmpeg.deleteFile(name);
      } catch {}
    }

    await ffmpeg.writeFile(inputName, await fetchFile(state.file));
    updateProgress(20, "Menyiapkan teks...");

    const dimensions = getOutputDimensions();
    const overlayCanvas = createTextOverlay(dimensions.width, dimensions.height);

    const overlayBlob = await new Promise((resolve) => {
      overlayCanvas.toBlob(resolve, "image/png");
    });

    if (!overlayBlob) throw new Error("Gagal membuat lapisan teks.");

    await ffmpeg.writeFile(overlayName, await fetchFile(overlayBlob));
    updateProgress(30, "Memproses video...");

    const selectedAudio =
      $('input[name="audioMode"]:checked')?.value || "original";

    const command = [
      "-i", inputName,
      "-i", overlayName,
      "-filter_complex",
      `[0:v]${getFFmpegVideoFilter()}[base];[base][1:v]overlay=0:0:format=auto[vout]`,
      "-map", "[vout]"
    ];

    if (selectedAudio === "original") {
      command.push("-map", "0:a?", "-c:a", "aac", "-b:a", "128k");
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
    const outputBlob = new Blob([outputData.buffer], { type: "video/mp4" });

    if (state.outputURL) URL.revokeObjectURL(state.outputURL);
    state.outputURL = URL.createObjectURL(outputBlob);

    if (downloadButton) {
      downloadButton.href = state.outputURL;
      downloadButton.download = "quietframe-video.mp4";
      downloadButton.classList.add("visible");
    }

    updateProgress(100, "Video selesai dibuat.");
    exportResult?.classList.add("visible");
    setText(progressLabel, "Ekspor berhasil");

    for (const name of [inputName, overlayName, outputName]) {
      try {
        await ffmpeg.deleteFile(name);
      } catch {}
    }
  } catch (error) {
    console.error("QuietFrame export error:", error);
    showError(`Gagal memproses video: ${error.message || "Terjadi kesalahan."}`);
    setText(progressLabel, "Ekspor gagal");
  } finally {
    state.exporting = false;

    if (exportButton) {
      exportButton.disabled = false;
      exportButton.classList.remove("loading");
    }
  }
}

exportButton?.addEventListener("click", exportVideo);

downloadButton?.addEventListener("click", (event) => {
  if (!state.outputURL) {
    event.preventDefault();
    showError("Video belum berhasil dibuat.");
  }
});

/* =========================================
   PREVIEW FULLSCREEN
========================================= */

function createPreviewFullscreenButton() {
  const topline = $(".preview-topline");
  if (!topline || $("#previewFullscreen")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "previewFullscreen";
  button.className = "preview-fullscreen-button";
  button.textContent = "Perbesar";

  button.addEventListener("click", () => {
    const enabled = document.body.classList.toggle("preview-expanded");
    button.textContent = enabled ? "Tutup" : "Perbesar";
    button.setAttribute("aria-pressed", String(enabled));
    requestAnimationFrame(updateQuotePreview);
  });

  topline.appendChild(button);
}

createPreviewFullscreenButton();

/* =========================================
   RESPONSIVE PREVIEW
========================================= */

if ("ResizeObserver" in window && previewScreen) {
  const resizeObserver = new ResizeObserver(() => {
    if (state.stage === 2) updateQuotePreview();
  });

  resizeObserver.observe(previewScreen);
} else {
  window.addEventListener("resize", updateQuotePreview);
}

/* =========================================
   INITIALIZATION
========================================= */

function initialize() {
  showStage(1);
  updateCharacterCount();
  updateQuotePreview();
  updateVideoAppearance();

  setText(textSizeValue, `${state.textSize}px`);
  setText(textOffsetValue, "0%");
  setText(textOffsetXValue, "0%");
  setText(paragraphGapValue, `${state.paragraphGap}px`);
  setText(blurStrengthValue, state.blurStrength);

  setText($("#brightnessValue"), "100%");
  setText($("#contrastValue"), "100%");
  setText($("#saturationValue"), "100%");
  setText($("#temperatureValue"), "0");

  downloadButton?.classList.remove("visible");
  exportResult?.classList.remove("visible");
  exportProgress?.classList.remove("visible");

  if (textSize) {
    textSize.min = "0";
    textSize.max = "120";
  }

  if (textOffsetX) {
    textOffsetX.min = "-35";
    textOffsetX.max = "35";
  }
}

initialize();
