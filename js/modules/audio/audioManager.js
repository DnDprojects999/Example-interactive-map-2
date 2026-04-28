import { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings } from "../worldInfo.js";
import { getUiText } from "../uiLocale.js";
import {
  clearUserAudioSettings,
  clamp01,
  mergeAudioSettings,
  readFileToDataUrl,
  readUserAudioSettings,
  writeUserAudioSettings,
} from "./audioPersistence.js";
import { createAudioEngine } from "./audioEngine.js";
import { createAudioUiController } from "./audioUiController.js";

export function createAudioManager(options) {
  const { els, state, persistWorldInfo } = options;

  let userSettings = readUserAudioSettings();
  let settings = mergeAudioSettings(state.worldData?.audioSettings, userSettings);

  function getWorldDefaults() {
    return normalizeAudioSettings(state.worldData?.audioSettings || DEFAULT_AUDIO_SETTINGS);
  }

  function getSelectedModeTarget() {
    return audioEngine.getCurrentMode() || "map";
  }

  const audioEngine = createAudioEngine({
    getSettings: () => settings,
  });
  const audioUi = createAudioUiController({
    els,
    state,
    getUiText,
    getSettings: () => settings,
    getCurrentMode: () => audioEngine.getCurrentMode(),
    getSelectedModeTarget,
  });

  function syncUi() {
    settings = mergeAudioSettings(getWorldDefaults(), userSettings);
    audioUi.syncUi();
  }

  function persistUserSettings(nextValue) {
    userSettings = {
      enabled: nextValue.enabled,
      uiEnabled: nextValue.uiEnabled,
      ambienceEnabled: nextValue.ambienceEnabled,
      masterVolume: clamp01(nextValue.masterVolume, DEFAULT_AUDIO_SETTINGS.masterVolume),
      uiVolume: clamp01(nextValue.uiVolume, DEFAULT_AUDIO_SETTINGS.uiVolume),
      ambienceVolume: clamp01(nextValue.ambienceVolume, DEFAULT_AUDIO_SETTINGS.ambienceVolume),
    };
    writeUserAudioSettings(userSettings);
    settings = mergeAudioSettings(getWorldDefaults(), userSettings);
    audioEngine.applyGainSettings();
    audioEngine.syncAmbience();
    syncUi();
  }

  function togglePopover(force) {
    if (!els.audioPopover || !els.audioToggleButton) return;
    const nextOpen = typeof force === "boolean" ? force : els.audioPopover.hidden;
    els.audioPopover.hidden = !nextOpen;
    els.audioToggleButton.setAttribute("aria-expanded", String(nextOpen));
  }

  function saveCurrentAsWorldDefaults() {
    state.worldData.audioSettings = normalizeAudioSettings(settings);
    persistWorldInfo?.();
  }

  function resetLocalPreferences() {
    clearUserAudioSettings();
    userSettings = {};
    settings = mergeAudioSettings(getWorldDefaults(), userSettings);
    audioEngine.applyGainSettings();
    audioEngine.syncAmbience();
    syncUi();
  }

  function updateWorldAudioSettings(mutator) {
    const nextAudioSettings = normalizeAudioSettings(mutator(normalizeAudioSettings(state.worldData?.audioSettings)));
    state.worldData.audioSettings = nextAudioSettings;
    settings = mergeAudioSettings(nextAudioSettings, userSettings);
    persistWorldInfo?.();
    audioEngine.applyGainSettings();
    audioEngine.syncAmbience();
    syncUi();
  }

  function setup() {
    syncUi();

    const unlockHandler = () => audioEngine.unlockAudio();
    document.addEventListener("pointerdown", unlockHandler, { passive: true });
    document.addEventListener("keydown", unlockHandler, { passive: true });

    els.audioToggleButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      audioEngine.unlockAudio();
      togglePopover();
      audioEngine.playUiSound("open");
    });

    els.audioEnabledButton?.addEventListener("click", () => {
      persistUserSettings({ ...settings, enabled: !settings.enabled });
      audioEngine.playUiSound("click");
    });
    els.audioUiButton?.addEventListener("click", () => {
      persistUserSettings({ ...settings, uiEnabled: !settings.uiEnabled });
      audioEngine.playUiSound("click");
    });
    els.audioAmbienceButton?.addEventListener("click", () => {
      persistUserSettings({ ...settings, ambienceEnabled: !settings.ambienceEnabled });
      audioEngine.playUiSound("click");
    });

    els.audioMasterVolumeInput?.addEventListener("input", (event) => {
      persistUserSettings({ ...settings, masterVolume: Number(event.target.value) / 100 });
    });
    els.audioUiVolumeInput?.addEventListener("input", (event) => {
      persistUserSettings({ ...settings, uiVolume: Number(event.target.value) / 100 });
      audioEngine.playUiSound("click");
    });
    els.audioAmbienceVolumeInput?.addEventListener("input", (event) => {
      persistUserSettings({ ...settings, ambienceVolume: Number(event.target.value) / 100 });
    });

    els.audioPreviewClickButton?.addEventListener("click", () => {
      audioEngine.unlockAudio();
      audioEngine.playUiSound("click");
    });
    els.audioPreviewOpenButton?.addEventListener("click", () => {
      audioEngine.unlockAudio();
      audioEngine.playUiSound("open");
    });
    els.audioPreviewAmbienceButton?.addEventListener("click", () => {
      audioEngine.previewAmbienceForMode(getSelectedModeTarget());
    });
    els.audioSaveDefaultsButton?.addEventListener("click", () => {
      saveCurrentAsWorldDefaults();
      audioEngine.playUiSound("click");
    });
    els.audioResetLocalButton?.addEventListener("click", () => {
      resetLocalPreferences();
      audioEngine.playUiSound("click");
    });
    els.audioUploadUiButton?.addEventListener("click", () => {
      els.audioUiFileInput?.click();
    });
    els.audioClearUiButton?.addEventListener("click", () => {
      updateWorldAudioSettings((current) => ({
        ...current,
        customUiClickUrl: "",
      }));
      audioEngine.playUiSound("click");
    });
    els.audioUploadOpenButton?.addEventListener("click", () => {
      els.audioOpenFileInput?.click();
    });
    els.audioClearOpenButton?.addEventListener("click", () => {
      updateWorldAudioSettings((current) => ({
        ...current,
        customUiOpenUrl: "",
      }));
      audioEngine.playUiSound("click");
    });
    els.audioUploadAmbienceButton?.addEventListener("click", () => {
      els.audioAmbienceFileInput?.click();
    });
    els.audioClearAmbienceButton?.addEventListener("click", () => {
      updateWorldAudioSettings((current) => ({
        ...current,
        customAmbienceUrl: "",
        ambienceByMode: {},
      }));
      audioEngine.playUiSound("click");
    });

    els.audioUiFileInput?.addEventListener("change", async (event) => {
      const [file] = Array.from(event.target.files || []);
      event.target.value = "";
      if (!file) return;
      const url = await readFileToDataUrl(file);
      updateWorldAudioSettings((current) => ({
        ...current,
        customUiClickUrl: url,
      }));
      audioEngine.unlockAudio();
      audioEngine.playUiSound("click");
    });
    els.audioOpenFileInput?.addEventListener("change", async (event) => {
      const [file] = Array.from(event.target.files || []);
      event.target.value = "";
      if (!file) return;
      const url = await readFileToDataUrl(file);
      updateWorldAudioSettings((current) => ({
        ...current,
        customUiOpenUrl: url,
      }));
      audioEngine.unlockAudio();
      audioEngine.playUiSound("open");
    });
    els.audioAmbienceFileInput?.addEventListener("change", async (event) => {
      const [file] = Array.from(event.target.files || []);
      event.target.value = "";
      if (!file) return;
      const url = await readFileToDataUrl(file);
      updateWorldAudioSettings((current) => ({
        ...current,
        customAmbienceUrl: url,
        ambienceByMode: {},
      }));
      audioEngine.unlockAudio();
      audioEngine.syncAmbience();
    });

    document.addEventListener("click", (event) => {
      if (!els.audioSwitcher?.contains(event.target)) togglePopover(false);
    });

    document.addEventListener("serkonia:edit-mode-changed", () => syncUi());

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("button, summary, .mode-link") : null;
      if (!target) return;
      if (target.closest(".audio-popover") && target.tagName === "BUTTON") return;
      if (target.closest(".audio-switcher")) return;
      window.setTimeout(() => audioEngine.playUiSound("click"), 0);
    });

    audioEngine.observeBodyMode(() => {
      syncUi();
    });
  }

  return {
    setup,
    syncUi,
    playUiSound: (...args) => audioEngine.playUiSound(...args),
    reportRuntimeEvent(entry) {
      if (entry?.level === "error") audioEngine.playUiSound("alert");
    },
  };
}
