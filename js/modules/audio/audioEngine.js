import { clamp01 } from "./audioPersistence.js";

function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * 0.28;
  }
  return buffer;
}

function deriveModeFromBody() {
  if (document.body.classList.contains("timeline-mode")) return "timeline";
  if (document.body.classList.contains("archive-mode")) return "archive";
  if (document.body.classList.contains("homebrew-mode")) return "homebrew";
  if (document.body.classList.contains("heroes-mode")) return "heroes";
  return "map";
}

function playSampleUrl(url, volume) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) return false;
  const sample = new Audio(normalizedUrl);
  sample.volume = clamp01(volume, 0);
  sample.play().catch(() => {});
  return true;
}

export function createAudioEngine(options) {
  const { getSettings } = options;

  let audioContext = null;
  let masterGain = null;
  let uiGain = null;
  let ambienceGain = null;
  let unlocked = false;
  let currentMode = deriveModeFromBody();
  let noiseBuffer = null;
  let ambienceNodes = [];
  let ambienceRootGain = null;
  let ambienceElement = null;
  let bodyModeObserver = null;

  function ensureAudioContext() {
    if (!audioContext) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return null;
      audioContext = new AudioContextCtor();
      masterGain = audioContext.createGain();
      uiGain = audioContext.createGain();
      ambienceGain = audioContext.createGain();
      uiGain.connect(masterGain);
      ambienceGain.connect(masterGain);
      masterGain.connect(audioContext.destination);
      noiseBuffer = createNoiseBuffer(audioContext);
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  }

  function applyGainSettings() {
    const settings = getSettings();
    if (!masterGain || !uiGain || !ambienceGain) return;
    masterGain.gain.value = settings.enabled ? settings.masterVolume : 0;
    uiGain.gain.value = settings.enabled && settings.uiEnabled ? settings.uiVolume : 0;
    ambienceGain.gain.value = settings.enabled && settings.ambienceEnabled ? settings.ambienceVolume : 0;
    if (ambienceElement) {
      ambienceElement.volume = settings.enabled && settings.ambienceEnabled
        ? clamp01(settings.masterVolume * settings.ambienceVolume, 0)
        : 0;
    }
  }

  function stopAmbience() {
    if (ambienceElement) {
      ambienceElement.pause();
      ambienceElement.src = "";
      ambienceElement = null;
    }
    ambienceNodes.forEach((node) => {
      try {
        node.stop?.();
      } catch (error) {
        // noop
      }
      try {
        node.disconnect?.();
      } catch (error) {
        // noop
      }
    });
    ambienceNodes = [];
    if (ambienceRootGain) {
      try {
        ambienceRootGain.disconnect();
      } catch (error) {
        // noop
      }
      ambienceRootGain = null;
    }
  }

  function buildAmbienceGraph(mode = currentMode) {
    const settings = getSettings();
    const context = ensureAudioContext();
    if (!context || !settings.enabled || !settings.ambienceEnabled || !unlocked) return;

    stopAmbience();
    const rootGain = context.createGain();
    rootGain.gain.value = 0;
    rootGain.connect(ambienceGain);
    ambienceRootGain = rootGain;

    const configs = {
      map: { freqs: [164.81, 246.94], gains: [0.018, 0.012], noise: 0.006, filter: 1180 },
      timeline: { freqs: [196, 293.66], gains: [0.016, 0.01], noise: 0.005, filter: 920 },
      archive: { freqs: [146.83, 220], gains: [0.022, 0.012], noise: 0.008, filter: 760 },
      homebrew: { freqs: [174.61, 261.63], gains: [0.019, 0.014], noise: 0.006, filter: 1360 },
      heroes: { freqs: [220, 329.63], gains: [0.014, 0.01], noise: 0.004, filter: 1620 },
    };
    const config = configs[mode] || configs.map;

    config.freqs.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      oscillator.type = index === 0 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gainNode.gain.value = config.gains[index] || 0.01;
      lfo.type = "sine";
      lfo.frequency.value = 0.08 + index * 0.03;
      lfoGain.gain.value = 0.004 + index * 0.002;
      lfo.connect(lfoGain);
      lfoGain.connect(gainNode.gain);
      oscillator.connect(gainNode);
      gainNode.connect(rootGain);
      oscillator.start();
      lfo.start();
      ambienceNodes.push(oscillator, lfo, gainNode, lfoGain);
    });

    if (noiseBuffer) {
      const noise = context.createBufferSource();
      const noiseFilter = context.createBiquadFilter();
      const noiseGainNode = context.createGain();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.value = config.filter;
      noiseGainNode.gain.value = config.noise;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGainNode);
      noiseGainNode.connect(rootGain);
      noise.start();
      ambienceNodes.push(noise, noiseFilter, noiseGainNode);
    }

    rootGain.gain.cancelScheduledValues(context.currentTime);
    rootGain.gain.linearRampToValueAtTime(1, context.currentTime + 1.7);
  }

  function getCustomAmbienceUrl(mode = currentMode) {
    const settings = getSettings();
    return String(settings.customAmbienceUrl || settings.ambienceByMode?.[mode] || "").trim();
  }

  function playCustomAmbience(mode = currentMode) {
    const settings = getSettings();
    const url = getCustomAmbienceUrl(mode);
    if (!url || !settings.enabled || !settings.ambienceEnabled || !unlocked) return false;
    stopAmbience();
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = clamp01(settings.masterVolume * settings.ambienceVolume, 0);
    ambienceElement = audio;
    audio.play().catch(() => {});
    return true;
  }

  function syncAmbience() {
    const settings = getSettings();
    if (!settings.enabled || !settings.ambienceEnabled || !unlocked) {
      stopAmbience();
      return;
    }
    if (playCustomAmbience(currentMode)) return;
    buildAmbienceGraph(currentMode);
  }

  function unlockAudio() {
    if (unlocked) return;
    const context = ensureAudioContext();
    if (!context) return;
    unlocked = true;
    applyGainSettings();
    syncAmbience();
  }

  function playToneStack(tones, envelope = {}) {
    const context = ensureAudioContext();
    if (!context || !uiGain) return;
    const now = context.currentTime;
    const peak = envelope.peak ?? 0.045;
    const attack = envelope.attack ?? 0.012;
    const hold = envelope.hold ?? 0.02;
    const release = envelope.release ?? 0.18;

    tones.forEach((tone) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = tone.type || "sine";
      oscillator.frequency.setValueAtTime(tone.from, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.to || tone.from), now + (tone.ramp || 0.08));
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime((tone.gain || 1) * peak, now + attack);
      gainNode.gain.exponentialRampToValueAtTime((tone.gain || 1) * peak * 0.72, now + attack + hold);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + release);
      oscillator.connect(gainNode);
      gainNode.connect(uiGain);
      oscillator.start(now);
      oscillator.stop(now + release + 0.04);
    });
  }

  function playUiSound(kind = "click") {
    const settings = getSettings();
    if (!settings.enabled || !settings.uiEnabled || !unlocked) return;
    const sharedUiVolume = settings.masterVolume * settings.uiVolume;
    const customOpenUrl = String(settings.customUiOpenUrl || "").trim();
    const customClickUrl = String(settings.customUiClickUrl || "").trim();
    if (kind === "open" && playSampleUrl(customOpenUrl || customClickUrl, sharedUiVolume)) return;
    if ((kind === "click" || kind === "mode") && playSampleUrl(customClickUrl, sharedUiVolume)) return;
    if (kind === "alert" && playSampleUrl(customOpenUrl || customClickUrl, sharedUiVolume)) return;

    if (kind === "mode") {
      playToneStack(
        [
          { type: "triangle", from: 260, to: 392, ramp: 0.09, gain: 1 },
          { type: "sine", from: 392, to: 523.25, ramp: 0.12, gain: 0.65 },
        ],
        { peak: 0.05, attack: 0.014, hold: 0.026, release: 0.2 },
      );
      return;
    }

    if (kind === "alert") {
      playToneStack(
        [
          { type: "sawtooth", from: 240, to: 176, ramp: 0.18, gain: 1 },
          { type: "triangle", from: 180, to: 130, ramp: 0.22, gain: 0.5 },
        ],
        { peak: 0.065, attack: 0.018, hold: 0.02, release: 0.28 },
      );
      return;
    }

    if (kind === "open") {
      playToneStack(
        [
          { type: "triangle", from: 392, to: 523.25, ramp: 0.08, gain: 1 },
          { type: "sine", from: 523.25, to: 659.25, ramp: 0.12, gain: 0.62 },
        ],
        { peak: 0.055, attack: 0.012, hold: 0.03, release: 0.22 },
      );
      return;
    }

    playToneStack(
      [
        { type: "triangle", from: 320, to: 420, ramp: 0.05, gain: 1 },
        { type: "sine", from: 480, to: 620, ramp: 0.08, gain: 0.4 },
      ],
      { peak: 0.035, attack: 0.01, hold: 0.014, release: 0.12 },
    );
  }

  function previewAmbienceForMode(mode) {
    const settings = getSettings();
    if (!settings.enabled || !settings.ambienceEnabled) return;
    unlockAudio();
    if (playCustomAmbience(mode)) return;
    buildAmbienceGraph(mode);
  }

  function observeBodyMode(onModeChange) {
    if (bodyModeObserver || typeof MutationObserver !== "function") return;
    bodyModeObserver = new MutationObserver(() => {
      const nextMode = deriveModeFromBody();
      if (nextMode === currentMode) return;
      currentMode = nextMode;
      syncAmbience();
      playUiSound("mode");
      onModeChange?.(nextMode);
    });
    bodyModeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    currentMode = deriveModeFromBody();
  }

  return {
    applyGainSettings,
    getCurrentMode: () => currentMode,
    observeBodyMode,
    playUiSound,
    previewAmbienceForMode,
    syncAmbience,
    unlockAudio,
  };
}
