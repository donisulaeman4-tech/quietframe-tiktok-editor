import { FFmpeg } from "https://esm.sh/@ffmpeg/ffmpeg@0.12.6";
import { fetchFile } from "https://esm.sh/@ffmpeg/util@0.12.1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  file: null,
  mediaType: null,
  mediaExtension: "mp4",
  mediaURL: null,
  outputURL: null,
  sourceDuration: null,
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

const SAFE_AREA = {
  left: 0.18,
  right: 0.18,
  top: 0.20,
  bottom: 0.20
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
  normal: [],
  cinematic: ["eq=contrast=1.15:saturation=0.82:brightness=-0.025"],
  blue: ["colorbalance=bs=0.12:bm=0.04:rs=-0.04"],
  warm: ["colorbalance=rs=0.10:gs=0.035:bs=-0.10"],
  mono: ["hue=s=0", "eq=contrast=1.08"],
  soft: ["eq=contrast=0.92:saturation=0.85:brightness=0.025"],
  deep: ["eq=contrast=1.22:saturation=1.08:brightness=-0.035"],
  golden: ["colorbalance=rs=0.12:gs=0.05:bs=-0.13", "eq=saturation=1.12"],
  night: ["eq=brightness=-0.08:contrast=1.12:saturation=0.75"]
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

const videoInput = $("#videoInput");
const uploadButton = $("#uploadButton");
const selectedVideo = $("#selectedVideo");
const videoFileName = $("#videoFileName");
const videoFileSize = $("#videoFileSize");
const fileTypeIcon = $("#fileTypeIcon");
const removeVideo = $("#removeVideo");

const quoteInput = $("#quoteInput");
const editorQuote = $("#editorQuote");
const characterCount = $("#characterCount");
const startEditing = $("#startEditing");
const backToUpload = $("#backToUpload");
const continueToExport = $("#continueToExport");
const backToEditor = $("#backToEditor");

const previewVideo = $("#previewVideo");
const previewImage = $("#previewImage");
const previewScreen = $("#previewScreen");
const previewQuote = $("#previewQuote");
const quotePanel = $("#quotePanel");
const quotePanelInner = $("#quotePanelInner");
const previewPlay = $("#previewPlay");
const playIcon = $("#playIcon");

const toggleTikTokUI = $("#toggleTikTokUI");
const mockTikTokUI = $("#mockTikTokUI");
const guideVertical = $("#guideVertical");
const guideHorizontal = $("#guideHorizontal");

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
const customDuration = $("#customDuration");

const exportButton = $("#exportButton");
const downloadButton = $("#downloadButton");
const exportProgress = $("#exportProgress");
const progressLabel = $("#progressLabel");
const progressPercent = $("#progressPercent");
const progressBar = $("#progressBar");
const exportResult = $("#exportResult");
const exportError = $("#exportError");
const audioGroup = $("#audioGroup");

let fullscreenButton = null;

const SESSION_DB_NAME = "quietframe-session-db";
const SESSION_DB_VERSION = 1;
const SESSION_STORE_NAME = "sessions";
const SESSION_KEY = "current";

let sessionDBPromise = null;
let sessionSaveTimer = null;
let restoringSession = false;
let historyInitialized = false;

function openSessionDB() {
  if (sessionDBPromise) return sessionDBPromise;
  sessionDBPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Browser tidak mendukung IndexedDB."));
      return;
    }
    const request = indexedDB.open(SESSION_DB_NAME, SESSION_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SESSION_STORE_NAME)) {
        database.createObjectStore(SESSION_STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error);
  });
  return sessionDBPromise;
}

function getSessionSnapshot() {
  const textValue = state.stage === 1
    ? (quoteInput?.value ?? state.text)
    : (editorQuote?.value ?? state.text);
  return {
    version: 1,
    savedAt: Date.now(),
    state: {
      stage: state.stage,
      duration: state.duration,
      resolution: state.resolution,
      text: textValue,
      textSize: state.textSize,
      textColor: state.textColor,
      font: state.font,
      position: state.position,
      alignment: state.alignment,
      offset: state.offset,
      offsetX: state.offsetX,
      autoFit: state.autoFit,
      paragraphGap: state.paragraphGap,
      blurEnabled: state.blurEnabled,
      blurStrength: state.blurStrength,
      filter: state.filter,
      brightness: state.brightness,
      contrast: state.contrast,
      saturation: state.saturation,
      temperature: state.temperature,
      mediaType: state.mediaType,
      mediaExtension: state.mediaExtension,
      fileName: state.file?.name || "",
      fileType: state.file?.type || "",
      fileLastModified: state.file?.lastModified || Date.now(),
      customDuration: customDuration?.value || "",
      audioMode: $('input[name="audioMode"]:checked')?.value || "original",
      activePanel: $(".settings-panel.active")?.id || "panel-text",
      activeTab: $(".tool-tab.active")?.dataset.panel || "text",
      tiktokHidden: Boolean(mockTikTokUI?.classList.contains("hidden"))
    },
    file: state.file || null
  };
}

async function saveSessionNow() {
  if (restoringSession) return;
  try {
    const database = await openSessionDB();
    const snapshot = getSessionSnapshot();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(SESSION_STORE_NAME, "readwrite");
      transaction.objectStore(SESSION_STORE_NAME).put(snapshot, SESSION_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn("[QuietFrame] Sesi belum dapat disimpan:", error);
  }
}

function scheduleSessionSave() {
  if (restoringSession) return;
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(saveSessionNow, 350);
}

async function readSavedSession() {
  const database = await openSessionDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SESSION_STORE_NAME, "readonly");
    const request = transaction.objectStore(SESSION_STORE_NAME).get(SESSION_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function restoreMediaFile(file, mediaType, extension) {
  if (!file || !mediaType) return;
  revokeMediaURL();
  state.file = file;
  state.mediaType = mediaType;
  state.mediaExtension = extension || getFileExtension(file);
  state.sourceDuration = null;
  state.mediaURL = URL.createObjectURL(file);
  previewVideo?.pause();

  if (previewVideo) {
    previewVideo.removeAttribute("src");
    previewVideo.load();
    previewVideo.style.display = "none";
  }
  if (previewImage) {
    previewImage.removeAttribute("src");
    previewImage.style.display = "none";
  }

  if (mediaType === "video" && previewVideo) {
    previewVideo.src = state.mediaURL;
    previewVideo.style.display = "block";
    previewVideo.load();
    previewVideo.onloadedmetadata = () => {
      state.sourceDuration = Number.isFinite(previewVideo.duration)
        ? previewVideo.duration
        : null;
      updateDurationHint();
    };
    if (previewPlay) previewPlay.hidden = false;
    if (audioGroup) audioGroup.style.display = "";
  } else if (mediaType === "image" && previewImage) {
    previewImage.src = state.mediaURL;
    previewImage.style.display = "block";
    if (previewPlay) previewPlay.hidden = true;
    if (audioGroup) audioGroup.style.display = "none";
  }

  setText(videoFileName, file.name);
  setText(videoFileSize, formatFileSize(file.size));
  setText(fileTypeIcon, mediaType === "image" ? "FOTO" : "VIDEO");
  selectedVideo?.classList.add("visible");
  uploadButton?.classList.add("has-video");
  updateCharacterCount();
  updateDurationHint();
}

async function restoreSession() {
  try {
    const saved = await readSavedSession();
    if (!saved?.state) return;
    restoringSession = true;
    const savedState = saved.state;

    [
      "duration", "resolution", "textSize", "offset", "offsetX",
      "paragraphGap", "blurStrength", "brightness", "contrast",
      "saturation", "temperature"
    ].forEach((key) => {
      if (savedState[key] !== undefined && Number.isFinite(Number(savedState[key]))) {
        state[key] = Number(savedState[key]);
      }
    });

    ["autoFit", "blurEnabled"].forEach((key) => {
      if (typeof savedState[key] === "boolean") state[key] = savedState[key];
    });

    [
      "text", "textColor", "font", "position", "alignment", "filter"
    ].forEach((key) => {
      if (typeof savedState[key] === "string") state[key] = savedState[key];
    });

    if (saved.file instanceof Blob && savedState.mediaType) {
      const restoredFile = new File(
        [saved.file],
        savedState.fileName || "quietframe-media",
        {
          type: savedState.fileType || saved.file.type || "",
          lastModified: savedState.fileLastModified || Date.now()
        }
      );
      restoreMediaFile(restoredFile, savedState.mediaType, savedState.mediaExtension);
    }

    if (quoteInput) quoteInput.value = state.text;
    if (editorQuote) editorQuote.value = state.text;

    const controlValues = {
      textSize: state.textSize,
      textOffset: state.offset,
      textOffsetX: state.offsetX,
      paragraphGap: state.paragraphGap,
      blurStrength: state.blurStrength,
      brightness: state.brightness,
      contrast: state.contrast,
      saturation: state.saturation,
      temperature: state.temperature
    };

    Object.entries(controlValues).forEach(([id, value]) => {
      const control = $("#" + id);
      if (control) control.value = String(value);
    });

    if (textColor) {
      const hasColor = [...textColor.options].some(
        (option) => option.value.toLowerCase() === state.textColor.toLowerCase()
      );
      textColor.value = hasColor ? state.textColor : "#ffffff";
    }

    if (customTextColor) customTextColor.value = state.textColor;
    if (autoFit) autoFit.checked = state.autoFit;
    if (blurEnabled) blurEnabled.checked = state.blurEnabled;
    if (resolution) resolution.value = String(state.resolution);
    if (customDuration) customDuration.value = savedState.customDuration || "";
    setDuration(state.duration, false);

    $$('input[name="audioMode"]').forEach((radio) => {
      radio.checked = radio.value === savedState.audioMode;
    });

    $$(".audio-option").forEach((option) => {
      option.classList.toggle("active", Boolean(option.querySelector("input")?.checked));
    });

    $$(".position-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.position === state.position);
    });

    $$(".align-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.align === state.alignment);
    });

    $$(".font-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.font === state.font);
    });

    $$(".filter-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === state.filter);
    });

    const activePanel = savedState.activePanel || "panel-text";
    const activeTab = savedState.activeTab || "text";

    $$(".settings-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === activePanel);
    });

    $$(".tool-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.panel === activeTab);
    });

    mockTikTokUI?.classList.toggle("hidden", Boolean(savedState.tiktokHidden));
    toggleTikTokUI?.classList.toggle("active", !savedState.tiktokHidden);

    setText(textSizeValue, String(state.textSize));
    setText(textOffsetValue, `${state.offset}%`);
    setText(textOffsetXValue, `${state.offsetX}%`);
    setText(paragraphGapValue, `${state.paragraphGap}px`);
    setText(blurStrengthValue, String(state.blurStrength));
    setText($("#brightnessValue"), `${state.brightness}%`);
    setText($("#contrastValue"), `${state.contrast}%`);
    setText($("#saturationValue"), `${state.saturation}%`);
    setText($("#temperatureValue"), String(state.temperature));

    updateCharacterCount();
    updateQuotePreview();
    updateMediaAppearance();
    updateDurationHint();

    const restoredStage = saved.file ? clamp(Number(savedState.stage) || 1, 1, 3) : 1;
    rebuildStageHistory(restoredStage);
    showStage(restoredStage, { skipHistory: true });

    console.info("[QuietFrame] Sesi terakhir berhasil dipulihkan.");
  } catch (error) {
    console.warn("[QuietFrame] Sesi sebelumnya tidak dapat dipulihkan:", error);
  } finally {
    restoringSession = false;
  }
}

document.addEventListener("input", scheduleSessionSave);
document.addEventListener("change", scheduleSessionSave);
document.addEventListener("click", scheduleSessionSave);
document.addEventListener("pointerup", scheduleSessionSave);

window.addEventListener("pagehide", () => {
  clearTimeout(sessionSaveTimer);
  saveSessionNow();
});

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

function rebuildStageHistory(stage) {
  const target = clamp(Number(stage) || 1, 1, 3);
  try {
    history.replaceState({ quietFrame: true, stage: 1 }, "", location.href);
    for (let step = 2; step <= target; step++) {
      history.pushState({ quietFrame: true, stage: step }, "", location.href);
    }
    historyInitialized = true;
  } catch (error) {
    console.warn("[QuietFrame] Riwayat navigasi tidak tersedia:", error);
  }
}

function showStage(step, options = {}) {
  const target = clamp(Number(step) || 1, 1, 3);
  const previousStage = state.stage;

  if (previousStage === 3 && target !== 3 && state.exporting) {
    cancelExport();
  }

  if (!options.skipHistory && target !== previousStage) {
    try {
      const historyState = { quietFrame: true, stage: target };
      if (!historyInitialized || options.replaceHistory) {
        history.replaceState(historyState, "", location.href);
        historyInitialized = true;
      } else {
        history.pushState(historyState, "", location.href);
      }
    } catch (error) {
      console.warn("[QuietFrame] Riwayat navigasi tidak dapat diperbarui:", error);
    }
  }

  state.stage = target;

  $$(".stage").forEach((stage) => {
    stage.classList.toggle("active", Number(stage.dataset.step) === target);
  });

  document.body.dataset.stage = String(target);

  if (target !== 2) exitPreviewFullscreen();

  if (target === 2) {
    requestAnimationFrame(() => {
      updateQuotePreview();
      updateMediaAppearance();
    });
  }

  scheduleSessionSave();
}

function navigateBackTo(target) {
  if (
    historyInitialized &&
    history.state?.quietFrame === true &&
    Number(history.state.stage) === state.stage &&
    state.stage > target
  ) {
    history.back();
    return;
  }

  showStage(target, { replaceHistory: true });
}

window.addEventListener("popstate", (event) => {
  const target = Number(event.state?.stage);
  if (event.state?.quietFrame !== true || ![1, 2, 3].includes(target)) return;

  showStage(target, { skipHistory: true });

  if (target === 2 && state.mediaType === "video") {
    previewVideo?.play().catch(() => {});
  } else {
    previewVideo?.pause();
  }
});

function updateCharacterCount() {
  const value = quoteInput?.value || "";
  setText(characterCount, `${value.length}/500`);
  if (startEditing) startEditing.disabled = !state.file;
}

function fontString(size) {
  const weight = state.font === "bold" ? "900 " : "";
  return `${weight}${size}px ${FONT_MAP[state.font] || FONT_MAP.serif}`;
}

function getFileExtension(file) {
  const nameExtension = file.name.split(".").pop()?.toLowerCase() || "";
  const allowed = ["mp4", "mov", "m4v", "webm", "3gp", "jpg", "jpeg", "png", "webp"];

  if (allowed.includes(nameExtension)) return nameExtension;

  const mimeMap = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
    "video/webm": "webm",
    "video/3gpp": "3gp",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  return mimeMap[file.type] || "";
}

function getMediaType(file, extension) {
  if (
    file.type.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp"].includes(extension)
  ) {
    return "image";
  }

  if (
    file.type.startsWith("video/") ||
    ["mp4", "mov", "m4v", "webm", "3gp"].includes(extension)
  ) {
    return "video";
  }

  return null;
}

function revokeMediaURL() {
  if (state.mediaURL) URL.revokeObjectURL(state.mediaURL);
  state.mediaURL = null;
}

uploadButton?.addEventListener("click", () => videoInput?.click());

videoInput?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const extension = getFileExtension(file);
  const mediaType = getMediaType(file, extension);

  if (!mediaType || !extension) {
    alert("Format tidak didukung. Gunakan MP4, MOV, WEBM, JPG, PNG, atau WEBP.");
    videoInput.value = "";
    return;
  }

  revokeMediaURL();

  state.file = file;
  state.mediaType = mediaType;
  state.mediaExtension = extension;
  state.sourceDuration = null;
  state.mediaURL = URL.createObjectURL(file);

  previewVideo?.pause();

  if (previewVideo) {
    previewVideo.removeAttribute("src");
    previewVideo.load();
    previewVideo.style.display = "none";
  }

  if (previewImage) {
    previewImage.removeAttribute("src");
    previewImage.style.display = "none";
  }

  if (mediaType === "video") {
    previewVideo.src = state.mediaURL;
    previewVideo.style.display = "block";
    previewVideo.load();

    previewVideo.onloadedmetadata = () => {
      state.sourceDuration = Number.isFinite(previewVideo.duration)
        ? previewVideo.duration
        : null;
      updateDurationHint();
    };

    if (previewPlay) previewPlay.hidden = false;
    if (audioGroup) audioGroup.style.display = "";
  } else {
    previewImage.src = state.mediaURL;
    previewImage.style.display = "block";

    if (previewPlay) previewPlay.hidden = true;
    if (audioGroup) audioGroup.style.display = "none";
  }

  setText(videoFileName, file.name);
  setText(videoFileSize, formatFileSize(file.size));
  setText(fileTypeIcon, mediaType === "image" ? "FOTO" : "VIDEO");

  selectedVideo?.classList.add("visible");
  uploadButton?.classList.add("has-video");

  updateCharacterCount();
  updateDurationHint();
  updateMediaAppearance();
});

removeVideo?.addEventListener("click", () => {
  revokeMediaURL();

  state.file = null;
  state.mediaType = null;
  state.sourceDuration = null;

  previewVideo?.pause();
  previewVideo?.removeAttribute("src");
  previewVideo?.load();
  previewImage?.removeAttribute("src");

  if (previewVideo) previewVideo.style.display = "none";
  if (previewImage) previewImage.style.display = "none";
  if (previewPlay) previewPlay.hidden = false;
  if (videoInput) videoInput.value = "";

  selectedVideo?.classList.remove("visible");
  uploadButton?.classList.remove("has-video");

  setText(videoFileName, "Media belum dipilih");
  setText(videoFileSize, "Pilih video atau foto dari perangkat");
  setText(fileTypeIcon, "MEDIA");

  if (audioGroup) audioGroup.style.display = "";

  updateCharacterCount();
  updateDurationHint();
});

quoteInput?.addEventListener("input", () => {
  state.text = quoteInput.value;
  updateCharacterCount();
});

startEditing?.addEventListener("click", () => {
  if (!state.file) {
    alert("Pilih video atau foto terlebih dahulu.");
    return;
  }

  state.text = quoteInput?.value || "";
  if (editorQuote) editorQuote.value = state.text;

  showStage(2);
  updateQuotePreview();
  updateMediaAppearance();

  if (state.mediaType === "video") previewVideo?.play().catch(() => {});
});

backToUpload?.addEventListener("click", () => {
  previewVideo?.pause();
  navigateBackTo(1);
});

continueToExport?.addEventListener("click", () => {
  state.text = editorQuote?.value ?? state.text;
  updateQuotePreview();
  updateDurationHint();
  previewVideo?.pause();
  clearExportMessages();
  showStage(3);
});

backToEditor?.addEventListener("click", () => {
  navigateBackTo(2);
  if (state.mediaType === "video") previewVideo?.play().catch(() => {});
});

previewPlay?.addEventListener("click", async () => {
  if (!previewVideo || state.mediaType !== "video") return;

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

toggleTikTokUI?.addEventListener("click", () => {
  const hidden = mockTikTokUI?.classList.toggle("hidden");
  toggleTikTokUI.classList.toggle("active", !hidden);
});

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

function wrapText(context, text, maxWidth) {
  const lines = [];

  text.split("\n").forEach((paragraph) => {
    if (!paragraph.trim()) {
      lines.push("");
      return;
    }

    let line = "";

    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;

      if (context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);

      if (context.measureText(word).width <= maxWidth) {
        line = word;
        continue;
      }

      let fragment = "";

      for (const character of word) {
        const next = fragment + character;

        if (context.measureText(next).width > maxWidth && fragment) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment = next;
        }
      }

      line = fragment;
    }

    if (line) lines.push(line);
  });

  return lines;
}

function getSafePreviewDimensions() {
  const width = previewScreen?.clientWidth || 300;
  const height = previewScreen?.clientHeight || width * 16 / 9;

  return {
    width,
    height,
    maxWidth: width * (1 - SAFE_AREA.left - SAFE_AREA.right),
    maxHeight: height * (1 - SAFE_AREA.top - SAFE_AREA.bottom),
    left: width * SAFE_AREA.left,
    right: width * (1 - SAFE_AREA.right),
    top: height * SAFE_AREA.top,
    bottom: height * (1 - SAFE_AREA.bottom)
  };
}

function calculateAutoFitFontSize({
  text,
  requestedSize,
  maxWidth,
  maxHeight,
  paragraphGap
}) {
  const requested = Math.max(1, requestedSize);

  if (!state.autoFit || !text.trim()) {
    return requested;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context || maxWidth <= 0 || maxHeight <= 0) {
    return requested;
  }

  let size = requested;

  while (size > 1) {
    context.font = fontString(size);

    const lines = wrapText(context, text, maxWidth);
    const lineCount = Math.max(1, lines.length);
    const paragraphCount = text.split("\n").length;

    const totalHeight =
      lineCount * size * 1.25 +
      Math.max(0, paragraphCount - 1) * paragraphGap;

    if (totalHeight <= maxHeight) {
      break;
    }

    size = Math.max(1, size - 0.5);
  }

  return size;
}

function getPreviewFontSize() {
  const dimensions = getSafePreviewDimensions();
  const logicalScale = dimensions.width / 360;

  const requestedSize = Math.max(
    1,
    state.textSize * logicalScale
  );

  const gap = state.paragraphGap * logicalScale;

  return calculateAutoFitFontSize({
    text: state.text,
    requestedSize,
    maxWidth: dimensions.maxWidth,
    maxHeight: dimensions.maxHeight,
    paragraphGap: gap
  });
}

function applyPreviewSafeArea() {
  if (!quotePanel || !quotePanelInner) return;

  quotePanel.style.position = "absolute";
  quotePanel.style.left = `${SAFE_AREA.left * 100}%`;
  quotePanel.style.right = `${SAFE_AREA.right * 100}%`;
  quotePanel.style.top = `${SAFE_AREA.top * 100}%`;
  quotePanel.style.bottom = `${SAFE_AREA.bottom * 100}%`;

  quotePanel.style.width = "auto";
  quotePanel.style.height = "auto";
  quotePanel.style.minHeight = "0";
  quotePanel.style.padding = "0";
  quotePanel.style.boxSizing = "border-box";
  quotePanel.style.display = "flex";
  quotePanel.style.justifyContent = "center";
  quotePanel.style.transform = "none";

  if (state.position === "top") {
    quotePanel.style.alignItems = "flex-start";
  } else if (state.position === "bottom") {
    quotePanel.style.alignItems = "flex-end";
  } else {
    quotePanel.style.alignItems = "center";
  }

  quotePanelInner.style.width = "100%";
  quotePanelInner.style.maxWidth = "100%";
  quotePanelInner.style.boxSizing = "border-box";
}

function updateQuotePreview() {
  if (!previewQuote || !quotePanel || !quotePanelInner) return;

  state.text = editorQuote?.value ?? state.text;
  previewQuote.textContent = state.text;

  const dimensions = getSafePreviewDimensions();
  const logicalScale = dimensions.width / 360;

  applyPreviewSafeArea();

  previewQuote.style.width = "100%";
  previewQuote.style.maxWidth = "100%";
  previewQuote.style.boxSizing = "border-box";
  previewQuote.style.overflowWrap = "anywhere";
  previewQuote.style.whiteSpace = "pre-wrap";

  previewQuote.style.color = state.textColor;
  previewQuote.style.fontFamily = FONT_MAP[state.font] || FONT_MAP.serif;
  previewQuote.style.fontWeight = state.font === "bold" ? "900" : "normal";
  previewQuote.style.textAlign = state.alignment;
  previewQuote.style.lineHeight = "1.25";
  previewQuote.style.display = state.textSize === 0 ? "none" : "block";

  const fontSize = getPreviewFontSize();
  previewQuote.style.fontSize = `${fontSize}px`;

  quotePanelInner.style.setProperty(
    "--paragraph-gap",
    `${state.paragraphGap * logicalScale}px`
  );

  quotePanelInner.style.setProperty(
    "--quote-blur",
    `${state.blurStrength * logicalScale}px`
  );

  quotePanelInner.classList.toggle("blur-active", state.blurEnabled);

  quotePanel.style.setProperty(
    "--quote-offset",
    `${(state.offset / 100) * dimensions.height * 0.35}px`
  );

  quotePanelInner.style.setProperty(
    "--quote-offset-x",
    `${state.offsetX}%`
  );
}

editorQuote?.addEventListener("input", updateQuotePreview);

[
  ["textSize", "textSizeValue", (value) => {
    state.textSize = Number(value);
    return `${value}`;
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

textColor?.addEventListener("change", () => {
  state.textColor = textColor.value;

  if (customTextColor) {
    customTextColor.value = textColor.value;
  }

  updateQuotePreview();
});

customTextColor?.addEventListener("input", () => {
  state.textColor = customTextColor.value;

  if (textColor) {
    textColor.value = customTextColor.value;
  }

  updateQuotePreview();
});

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

    guideVertical?.classList.add("visible");
    guideHorizontal?.classList.add("visible");
  });

  quotePanel.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    const rect = previewScreen.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    let nextX =
      initialX + ((event.clientX - startX) / rect.width) * 100;

    let nextY =
      initialY + ((event.clientY - startY) / (rect.height * 0.35)) * 100;

    if (Math.abs(nextX) < 2.5) nextX = 0;
    if (Math.abs(nextY) < 2.5) nextY = 0;

    state.offsetX = clamp(nextX, -18, 18);
    state.offset = clamp(nextY, -60, 60);

    if (textOffsetX) textOffsetX.value = state.offsetX;
    if (textOffset) textOffset.value = state.offset;

    setText(textOffsetXValue, `${Math.round(state.offsetX)}%`);
    setText(textOffsetValue, `${Math.round(state.offset)}%`);

    updateQuotePreview();
  });

  const stopDragging = () => {
    dragging = false;
    guideVertical?.classList.remove("visible");
    guideHorizontal?.classList.remove("visible");
  };

  quotePanel.addEventListener("pointerup", stopDragging);
  quotePanel.addEventListener("pointercancel", stopDragging);
  quotePanel.addEventListener("lostpointercapture", stopDragging);
}

$$(".font-option").forEach((button) => {
  button.addEventListener("click", () => {
    state.font = button.dataset.font;

    $$(".font-option").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    updateQuotePreview();
  });
});

function updateMediaAppearance() {
  const filter = FILTER_PREVIEW[state.filter] || "";

  const temperature = state.temperature
    ? `sepia(${Math.abs(state.temperature) / 180}) hue-rotate(${state.temperature * 0.35}deg)`
    : "";

  const styleFilter = [
    `brightness(${state.brightness}%)`,
    `contrast(${state.contrast}%)`,
    `saturate(${state.saturation}%)`,
    filter,
    temperature
  ].filter(Boolean).join(" ");

  if (previewVideo) previewVideo.style.filter = styleFilter;
  if (previewImage) previewImage.style.filter = styleFilter;
}

$$(".filter-option").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;

    $$(".filter-option").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    updateMediaAppearance();
  });
});

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
    updateMediaAppearance();
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

  updateMediaAppearance();
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

  updateMediaAppearance();
});

function setDuration(value, updateInput = true) {
  const duration = Number(value);

  if (!Number.isInteger(duration) || duration < 1 || duration > 3600) {
    return false;
  }

  state.duration = duration;

  $$("[data-duration]").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.duration) === duration
    );
  });

  if (customDuration && updateInput) {
    customDuration.value = [12, 15, 17, 20].includes(duration)
      ? ""
      : String(duration);
  }

  updateDurationHint();

  return true;
}

$$("[data-duration]").forEach((button) => {
  button.addEventListener("click", () => {
    setDuration(button.dataset.duration);
  });
});

customDuration?.addEventListener("input", () => {
  const raw = customDuration.value.trim();

  if (!raw) {
    $$("[data-duration]").forEach((button) => {
      button.classList.remove("active");
    });

    return;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 1 || value > 3600) {
    return;
  }

  setDuration(value, false);
});

customDuration?.addEventListener("change", () => {
  if (!customDuration.value.trim()) return;

  const value = Number(customDuration.value);

  if (!setDuration(value, false)) {
    customDuration.value = String(state.duration);
    showError("Durasi harus bilangan bulat antara 1 sampai 3600 detik.");
    return;
  }

  customDuration.value = String(state.duration);
});

function updateDurationHint() {
  if (!durationHint) return;

  if (!state.file) {
    durationHint.textContent = "Pilih preset atau isi durasi sendiri.";
  } else if (state.mediaType === "image") {
    durationHint.textContent =
      `Foto akan dijadikan video selama ${state.duration} detik.`;
  } else if (
    Number.isFinite(state.sourceDuration) &&
    state.sourceDuration < state.duration
  ) {
    durationHint.textContent =
      `Durasi video asli ${state.sourceDuration.toFixed(1)} detik. Hasil mengikuti durasi aslinya.`;
  } else {
    durationHint.textContent =
      `Video akan dipotong maksimal ${state.duration} detik.`;
  }
}

resolution?.addEventListener("change", () => {
  state.resolution = Number(resolution.value);
});

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

function createTextOverlay(width, height) {
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context || !state.text.trim() || state.textSize === 0) {
    return canvas;
  }

  const logicalScale = width / 360;

  const safeWidth =
    width * (1 - SAFE_AREA.left - SAFE_AREA.right);

  const safeHeight =
    height * (1 - SAFE_AREA.top - SAFE_AREA.bottom);

  const safeLeft = width * SAFE_AREA.left;
  const safeRight = width * (1 - SAFE_AREA.right);
  const safeTop = height * SAFE_AREA.top;
  const safeBottom = height * (1 - SAFE_AREA.bottom);

  const fontSize = getExportFontSize(
    width,
    height,
    logicalScale
  );

  const maxWidth = safeWidth;
  const gap = state.paragraphGap * logicalScale;

  context.font = fontString(fontSize);
  context.textAlign = state.alignment;
  context.textBaseline = "middle";

  const paragraphs = state.text.split("\n").map((paragraph) => {
    return wrapText(context, paragraph, maxWidth);
  });

  const lineHeight = fontSize * 1.25;

  const lineCount = paragraphs.reduce(
    (total, lines) => total + Math.max(1, lines.length),
    0
  );

  const totalHeight =
    lineCount * lineHeight +
    Math.max(0, paragraphs.length - 1) * gap;

  let centerY;

  if (state.position === "top") {
    centerY = safeTop + totalHeight / 2;
  } else if (state.position === "bottom") {
    centerY = safeBottom - totalHeight / 2;
  } else {
    centerY = safeTop + safeHeight / 2;
  }

  centerY += (state.offset / 100) * height * 0.35;

  let x;

  if (state.alignment === "left") {
    x = safeLeft;
  } else if (state.alignment === "right") {
    x = safeRight;
  } else {
    x = width / 2;
  }

  x += (state.offsetX / 100) * safeWidth;

  if (state.blurEnabled) {
    let widest = 0;

    paragraphs.flat().forEach((line) => {
      widest = Math.max(
        widest,
        context.measureText(line).width
      );
    });

    const padX = fontSize * 0.55;
    const padY = fontSize * 0.32;

    const boxWidth = Math.min(
      widest + padX * 2,
      safeWidth
    );

    const boxHeight = totalHeight + padY * 2;

    let boxX = x - boxWidth / 2;

    if (state.alignment === "left") {
      boxX = x - padX;
    }

    if (state.alignment === "right") {
      boxX = x - boxWidth + padX;
    }

    boxX = clamp(
      boxX,
      safeLeft,
      safeRight - boxWidth
    );

    context.save();

    context.fillStyle =
      `rgba(0,0,0,${clamp(state.blurStrength / 70, 0.04, 0.38)})`;

    context.beginPath();

    context.roundRect(
      boxX,
      centerY - boxHeight / 2,
      boxWidth,
      boxHeight,
      fontSize * 0.35
    );

    context.fill();
    context.restore();
  }

  context.fillStyle = state.textColor;
  context.shadowColor = "rgba(0,0,0,.38)";
  context.shadowBlur = fontSize * 0.12;
  context.shadowOffsetY = fontSize * 0.04;

  let y = centerY - totalHeight / 2 + lineHeight / 2;

  paragraphs.forEach((lines, index) => {
    (lines.length ? lines : [""]).forEach((line) => {
      context.fillText(line, x, y, maxWidth);
      y += lineHeight;
    });

    if (index < paragraphs.length - 1) {
      y += gap;
    }
  });

  return canvas;
}

function getExportFontSize(width, height, logicalScale) {
  const requestedSize = Math.max(
    1,
    state.textSize * logicalScale
  );

  const maxWidth =
    width * (1 - SAFE_AREA.left - SAFE_AREA.right);

  const maxHeight =
    height * (1 - SAFE_AREA.top - SAFE_AREA.bottom);

  const gap = state.paragraphGap * logicalScale;

  return calculateAutoFitFontSize({
    text: state.text,
    requestedSize,
    maxWidth,
    maxHeight,
    paragraphGap: gap
  });
}

let ffmpegLoadPromise = null;
let ffmpegLoadController = null;
let exportRunId = 0;

async function fetchFFmpegAsset(url, mimeType, signal) {
  const response = await fetch(url, { signal, cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Gagal mengunduh mesin ekspor (HTTP ${response.status}).`);
  }
  const data = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([data], { type: mimeType }));
}

async function loadFFmpeg() {
  if (state.ffmpegReady) return;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    updateProgress(2, "Memuat mesin ekspor...");
    const cdnBases = [
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd",
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd"
    ];
    let lastError = null;

    for (const baseURL of cdnBases) {
      if (!state.exporting) throw new Error("Proses ekspor dibatalkan.");

      let coreURL = null;
      let wasmURL = null;
      const controller = new AbortController();
      ffmpegLoadController = controller;
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        if (!state.ffmpeg) {
          state.ffmpeg = new FFmpeg();
          state.ffmpeg.on("progress", ({ progress }) => {
            if (!state.exporting) return;
            const percent = clamp(40 + Math.round(progress * 53), 40, 93);
            setText(progressPercent, `${percent}%`);
            if (progressBar) progressBar.style.width = `${percent}%`;
          });
          state.ffmpeg.on("log", ({ message }) => {
            console.log("[QuietFrame FFmpeg]", message);
          });
        }

        updateProgress(3, "Mengunduh mesin ekspor...");
        [coreURL, wasmURL] = await Promise.all([
          fetchFFmpegAsset(`${baseURL}/ffmpeg-core.js`, "text/javascript", controller.signal),
          fetchFFmpegAsset(`${baseURL}/ffmpeg-core.wasm`, "application/wasm", controller.signal)
        ]);

        if (!state.exporting) throw new Error("Proses ekspor dibatalkan.");

        let loadTimer;

        await Promise.race([
          state.ffmpeg.load({ coreURL, wasmURL }),
          new Promise((_, reject) => {
            loadTimer = setTimeout(() => {
              controller.abort();
              reject(new Error("Waktu pemuatan mesin ekspor habis (30 detik)."));
            }, 30000);
          })
        ]).finally(() => clearTimeout(loadTimer));

        state.ffmpegReady = true;
        return;
      } catch (error) {
        lastError = controller.signal.aborted
          ? new Error("Waktu unduh atau pemuatan mesin ekspor habis.")
          : error;

        console.warn("[QuietFrame] CDN FFmpeg gagal:", baseURL, lastError);

        try {
          await state.ffmpeg?.terminate();
        } catch {}

        state.ffmpeg = null;
        state.ffmpegReady = false;
      } finally {
        clearTimeout(timeout);
        if (coreURL) URL.revokeObjectURL(coreURL);
        if (wasmURL) URL.revokeObjectURL(wasmURL);
        if (ffmpegLoadController === controller) ffmpegLoadController = null;
      }
    }

    throw new Error(
      `Mesin ekspor gagal dimuat dari kedua server. Periksa koneksi internet lalu coba lagi. ${lastError?.message || ""}`
    );
  })();

  try {
    await ffmpegLoadPromise;
  } finally {
    ffmpegLoadPromise = null;
  }
}

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

  filters.push(...(FILTER_MAP[state.filter] || []));

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

  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
}

function validateExport() {
  if (!state.file) {
    showError("Pilih video atau foto terlebih dahulu.");
    return false;
  }

  if (
    !Number.isInteger(state.duration) ||
    state.duration < 1 ||
    state.duration > 3600
  ) {
    showError("Durasi harus bilangan bulat antara 1 sampai 3600 detik.");
    return false;
  }

  if (!state.mediaType) {
    showError("Jenis media tidak dikenali.");
    return false;
  }

  return true;
}

function cancelExport() {
  if (!state.exporting) return;

  exportRunId++;
  state.exporting = false;
  ffmpegLoadController?.abort();

  const activeFFmpeg = state.ffmpeg;
  state.ffmpeg = null;
  state.ffmpegReady = false;
  ffmpegLoadPromise = null;

  try {
    activeFFmpeg?.terminate();
  } catch {}

  if (exportButton) {
    exportButton.disabled = false;
    exportButton.classList.remove("loading");
  }

  updateProgress(0, "Ekspor dibatalkan.");
}

async function exportVideo() {
  if (state.exporting) return;

  clearExportMessages();

  if (!validateExport()) return;

  state.exporting = true;
  const thisExportRun = ++exportRunId;

  if (exportButton) {
    exportButton.disabled = true;
    exportButton.classList.add("loading");
  }

  exportProgress?.classList.add("visible");

  updateProgress(0, "Menyiapkan media...");

  const inputName = `quietframe-input.${state.mediaExtension}`;
  const overlayName = "quietframe-overlay.png";
  const outputName = "quietframe-output.mp4";

  try {
    await loadFFmpeg();
    if (thisExportRun !== exportRunId) return;

    const ffmpeg = state.ffmpeg;

    updateProgress(8, "Membaca media...");

    for (const name of [inputName, overlayName, outputName]) {
      try {
        await ffmpeg.deleteFile(name);
      } catch {}
    }

    await ffmpeg.writeFile(
      inputName,
      await fetchFile(state.file)
    );

    if (thisExportRun !== exportRunId) return;

    updateProgress(20, "Membuat teks...");

    const dimensions = getOutputDimensions();

    const overlayCanvas = createTextOverlay(
      dimensions.width,
      dimensions.height
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

    if (thisExportRun !== exportRunId) return;

    updateProgress(30, "Menyiapkan ekspor...");

    const selectedAudio =
      $('input[name="audioMode"]:checked')?.value || "original";

    const command = [];

    if (state.mediaType === "image") {
      command.push(
        "-loop", "1",
        "-framerate", "30",
        "-i", inputName
      );
    } else {
      command.push("-i", inputName);
    }

    command.push(
      "-loop", "1",
      "-framerate", "30",
      "-i", overlayName
    );

    command.push(
      "-filter_complex",
      `[0:v]${getFFmpegVideoFilter()}[base];[base][1:v]overlay=0:0:format=auto[vout]`,
      "-map", "[vout]"
    );

    if (
      state.mediaType === "video" &&
      selectedAudio === "original"
    ) {
      command.push(
        "-map", "0:a?",
        "-c:a", "aac",
        "-b:a", "128k"
      );
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
      "-movflags", "+faststart",
      outputName
    );

    updateProgress(40, "Merender video...");

    const exitCode = await ffmpeg.exec(command);
    if (thisExportRun !== exportRunId) return;

    if (exitCode !== 0) {
      throw new Error(
        "Proses ekspor gagal. Coba gunakan resolusi 720p atau file media lain."
      );
    }

    updateProgress(94, "Menyiapkan hasil...");

    const outputData = await ffmpeg.readFile(outputName);
    if (thisExportRun !== exportRunId) return;

    const outputBlob = new Blob(
      [outputData],
      { type: "video/mp4" }
    );

    if (state.outputURL) {
      URL.revokeObjectURL(state.outputURL);
    }

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
    if (thisExportRun !== exportRunId) return;

    console.error("QuietFrame export error:", error);

    showError(
      `Gagal memproses media: ${error.message || "Terjadi kesalahan."}`
    );

    setText(progressLabel, "Ekspor gagal");
  } finally {
    if (thisExportRun === exportRunId) {
      state.exporting = false;

      if (exportButton) {
        exportButton.disabled = false;
        exportButton.classList.remove("loading");
      }
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

function createPreviewFullscreenButton() {
  const topline = $(".preview-topline");

  if (!topline || $("#previewFullscreen")) return;

  fullscreenButton = document.createElement("button");

  fullscreenButton.type = "button";
  fullscreenButton.id = "previewFullscreen";
  fullscreenButton.className = "preview-fullscreen-button";
  fullscreenButton.textContent = "Perbesar";

  fullscreenButton.setAttribute("aria-pressed", "false");

  fullscreenButton.addEventListener("click", () => {
    document.body.classList.contains("preview-expanded")
      ? exitPreviewFullscreen()
      : enterPreviewFullscreen();
  });

  topline.appendChild(fullscreenButton);
}

function enterPreviewFullscreen() {
  if (state.stage !== 2) return;

  document.body.classList.add("preview-expanded");

  if (fullscreenButton) {
    fullscreenButton.textContent = "Tutup";
    fullscreenButton.setAttribute("aria-pressed", "true");
  }

  requestAnimationFrame(() => {
    updateQuotePreview();
    updateMediaAppearance();
  });
}

function exitPreviewFullscreen() {
  document.body.classList.remove("preview-expanded");

  if (fullscreenButton) {
    fullscreenButton.textContent = "Perbesar";
    fullscreenButton.setAttribute("aria-pressed", "false");
  }

  requestAnimationFrame(() => {
    updateQuotePreview();
    updateMediaAppearance();
  });
}

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    document.body.classList.contains("preview-expanded")
  ) {
    exitPreviewFullscreen();
  }
});

createPreviewFullscreenButton();

if ("ResizeObserver" in window && previewScreen) {
  const observer = new ResizeObserver(() => {
    if (state.stage === 2) {
      updateQuotePreview();
    }
  });

  observer.observe(previewScreen);
} else {
  window.addEventListener("resize", updateQuotePreview);
}

function initialize() {
  rebuildStageHistory(1);
  showStage(1, { skipHistory: true });

  updateCharacterCount();
  updateQuotePreview();
  updateMediaAppearance();

  setText(textSizeValue, `${state.textSize}`);
  setText(textOffsetValue, "0%");
  setText(textOffsetXValue, "0%");
  setText(paragraphGapValue, `${state.paragraphGap}px`);
  setText(blurStrengthValue, state.blurStrength);

  setText($("#brightnessValue"), "100%");
  setText($("#contrastValue"), "100%");
  setText($("#saturationValue"), "100%");
  setText($("#temperatureValue"), "0");

  if (textSize) {
    textSize.min = "0";
    textSize.max = "120";
  }

  if (textOffsetX) {
    textOffsetX.min = "-18";
    textOffsetX.max = "18";
  }

  if (customDuration) {
    customDuration.value = "";
  }

  if (previewVideo) {
    previewVideo.style.display = "none";
  }

  if (previewImage) {
    previewImage.style.display = "none";
  }
}

initialize();
restoreSession();
