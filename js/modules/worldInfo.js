import {
  DEFAULT_LANGUAGE,
  normalizeLanguageConfig,
  normalizeTranslationsMap,
  resolveLanguage,
} from "./localization.js";
import { DEFAULT_MAP_VIEWS, normalizeMapViews } from "./mapViews.js";
import { DEFAULT_SITE_THEME_ID, normalizeSiteThemeConfig } from "./siteThemes.js";

const DEFAULT_WORLD_NAME = "Serkonia";
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  enabled: true,
  uiEnabled: true,
  ambienceEnabled: true,
  masterVolume: 0.62,
  uiVolume: 0.5,
  ambienceVolume: 0.34,
  customUiClickUrl: "",
  customUiOpenUrl: "",
  customAmbienceUrl: "",
  ambienceByMode: {
    map: "",
    timeline: "",
    archive: "",
    homebrew: "",
    heroes: "",
  },
});

export const DEFAULT_SECTION_VISIBILITY = Object.freeze({
  timeline: true,
  archive: true,
  homebrew: true,
  heroes: true,
});

// These text keys are treated as the "branding layer" of the whole project.
// They are resolved together so renaming a world or switching language updates
// the app consistently across loading, search, heroes, and the side panel.
const WORLD_TEXT_KEYS = [
  "name",
  "appTitle",
  "faviconUrl",
  "loadingKicker",
  "loadingTitle",
  "loadingImageUrl",
  "loadingFailureTitle",
  "loadingPrepareNote",
  "loadingReadyNote",
  "loadingFailSubtitle",
  "loadingFailNote",
  "heroesKicker",
  "heroesTitle",
  "heroesIntro",
  "searchLabel",
  "searchButtonTitle",
  "panelTitle",
  "initial",
];

function normalizeText(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeVolume(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

export function normalizeAudioSettings(rawValue) {
  const raw = rawValue && typeof rawValue === "object" ? rawValue : {};
  const rawAmbienceByMode = raw.ambienceByMode && typeof raw.ambienceByMode === "object"
    ? raw.ambienceByMode
    : {};
  const legacyCustomAmbienceUrl = [
    rawAmbienceByMode.map,
    rawAmbienceByMode.timeline,
    rawAmbienceByMode.archive,
    rawAmbienceByMode.homebrew,
    rawAmbienceByMode.heroes,
  ].map((value) => normalizeText(value, "")).find(Boolean) || "";
  return {
    enabled: raw.enabled !== false,
    uiEnabled: raw.uiEnabled !== false,
    ambienceEnabled: raw.ambienceEnabled !== false,
    masterVolume: normalizeVolume(raw.masterVolume, DEFAULT_AUDIO_SETTINGS.masterVolume),
    uiVolume: normalizeVolume(raw.uiVolume, DEFAULT_AUDIO_SETTINGS.uiVolume),
    ambienceVolume: normalizeVolume(raw.ambienceVolume, DEFAULT_AUDIO_SETTINGS.ambienceVolume),
    customUiClickUrl: normalizeText(raw.customUiClickUrl, ""),
    customUiOpenUrl: normalizeText(raw.customUiOpenUrl, ""),
    customAmbienceUrl: normalizeText(raw.customAmbienceUrl, legacyCustomAmbienceUrl),
    ambienceByMode: {
      map: normalizeText(rawAmbienceByMode.map, ""),
      timeline: normalizeText(rawAmbienceByMode.timeline, ""),
      archive: normalizeText(rawAmbienceByMode.archive, ""),
      homebrew: normalizeText(rawAmbienceByMode.homebrew, ""),
      heroes: normalizeText(rawAmbienceByMode.heroes, ""),
    },
  };
}

export function normalizeSectionVisibility(rawValue) {
  const raw = rawValue && typeof rawValue === "object" ? rawValue : {};
  return Object.keys(DEFAULT_SECTION_VISIBILITY).reduce((result, key) => {
    result[key] = raw[key] !== false;
    return result;
  }, {});
}

function getWorldInitial(name) {
  const normalized = Array.from(String(name || "").trim()).find((symbol) => /\S/u.test(symbol));
  return (normalized || "S").toUpperCase();
}

// The default copy differs between Russian and English templates. Other
// languages still inherit from one of these two bases until the creator adds
// explicit translations.
function resolveTemplateLanguage(languageCode) {
  return String(languageCode || DEFAULT_LANGUAGE).trim().toLowerCase() === "en" ? "en" : DEFAULT_LANGUAGE;
}

function buildDefaultWorldInfo(name, languageCode = DEFAULT_LANGUAGE) {
  if (resolveTemplateLanguage(languageCode) === "en") {
    return {
      name,
      appTitle: `${name} Map`,
      faviconUrl: "",
      loadingKicker: `Chronicles of ${name}`,
      loadingTitle: `Welcome to ${name}`,
      loadingImageUrl: "",
      loadingFailureTitle: `${name} refused to load`,
      loadingPrepareNote: `Preparing the map of "${name}", the heroes, and everything you already managed to unleash.`,
      loadingReadyNote: `The map of "${name}" is ready. The chronicle is open. Time to step back into the world.`,
      loadingFailSubtitle: "Check the JSON files and the browser console while I stop pretending this is fine.",
      loadingFailNote: "The loading screen still lingers for a moment so the failure does not look like a random flicker.",
      heroesKicker: `Chronicles of ${name}`,
      heroesTitle: `Hall of Heroes \u00b7 ${name}`,
      heroesIntro: `Heroes, allies, legends, and notable faces of the campaign. Each card keeps the story of those who already left a mark on ${name}.`,
      searchLabel: `Search the world of ${name}`,
      searchButtonTitle: `Search the world of ${name}`,
      panelTitle: name,
      initial: getWorldInitial(name),
    };
  }

  return {
    name,
    appTitle: `${name} Map`,
    faviconUrl: "",
    loadingKicker: `\u0425\u0440\u043e\u043d\u0438\u043a\u0438 ${name}`,
    loadingTitle: `\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u0432 ${name}`,
    loadingImageUrl: "",
    loadingFailureTitle: `\u041c\u0438\u0440 \"${name}\" \u0441\u043f\u043e\u0442\u043a\u043d\u0443\u043b\u0441\u044f \u043d\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0435`,
    loadingPrepareNote: `\u041f\u043e\u0434\u0433\u043e\u0442\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u043c \u043a\u0430\u0440\u0442\u0443 \u043c\u0438\u0440\u0430 \"${name}\", \u0433\u0435\u0440\u043e\u0435\u0432, \u0445\u0440\u043e\u043d\u0438\u043a\u0438 \u0438 \u0432\u0441\u0451, \u0447\u0442\u043e \u0432\u044b \u0443\u0441\u043f\u0435\u043b\u0438 \u043d\u0430\u0442\u0432\u043e\u0440\u0438\u0442\u044c.`,
    loadingReadyNote: `\u041a\u0430\u0440\u0442\u0430 \u043c\u0438\u0440\u0430 \"${name}\" \u043d\u0430 \u043c\u0435\u0441\u0442\u0435. \u0425\u0440\u043e\u043d\u0438\u043a\u0430 \u043e\u0442\u043a\u0440\u044b\u0442\u0430. \u041f\u043e\u0440\u0430 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0442\u044c\u0441\u044f \u0432 \u043c\u0438\u0440.`,
    loadingFailSubtitle: "\u041f\u0440\u043e\u0432\u0435\u0440\u044c JSON \u0438 \u043a\u043e\u043d\u0441\u043e\u043b\u044c \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430, \u0430 \u044f \u043f\u043e\u043a\u0430 \u043d\u0435 \u0431\u0443\u0434\u0443 \u0434\u0435\u043b\u0430\u0442\u044c \u0432\u0438\u0434, \u0447\u0442\u043e \u0432\u0441\u0451 \u0432 \u043f\u043e\u0440\u044f\u0434\u043a\u0435.",
    loadingFailNote: "\u042d\u043a\u0440\u0430\u043d \u0435\u0449\u0451 \u043d\u0435\u043c\u043d\u043e\u0433\u043e \u0437\u0430\u0434\u0435\u0440\u0436\u0438\u0442\u0441\u044f, \u0447\u0442\u043e\u0431\u044b \u043e\u0448\u0438\u0431\u043a\u0430 \u043d\u0435 \u0432\u044b\u0433\u043b\u044f\u0434\u0435\u043b\u0430 \u043a\u0430\u043a \u0441\u043b\u0443\u0447\u0430\u0439\u043d\u044b\u0439 \u043c\u0438\u0433.",
    heroesKicker: `\u0425\u0440\u043e\u043d\u0438\u043a\u0438 ${name}`,
    heroesTitle: `\u0417\u0430\u043b \u0433\u0435\u0440\u043e\u0435\u0432 \u00b7 ${name}`,
    heroesIntro: `\u0413\u0435\u0440\u043e\u0438, \u0441\u043e\u044e\u0437\u043d\u0438\u043a\u0438, \u043b\u0435\u0433\u0435\u043d\u0434\u044b \u0438 \u0432\u0430\u0436\u043d\u044b\u0435 \u043b\u0438\u0446\u0430 \u043a\u0430\u043c\u043f\u0430\u043d\u0438\u0438. \u041a\u0430\u0436\u0434\u0430\u044f \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u0445\u0440\u0430\u043d\u0438\u0442 \u0438\u0441\u0442\u043e\u0440\u0438\u044e \u0442\u043e\u0433\u043e, \u043a\u0442\u043e \u0443\u0436\u0435 \u043e\u0441\u0442\u0430\u0432\u0438\u043b \u0441\u043b\u0435\u0434 \u0432 ${name}.`,
    searchLabel: `\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043c\u0438\u0440\u0443 \"${name}\"`,
    searchButtonTitle: `\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043c\u0438\u0440\u0443 \"${name}\"`,
    panelTitle: name,
    initial: getWorldInitial(name),
  };
}

export const DEFAULT_WORLD_INFO = Object.freeze({
  ...buildDefaultWorldInfo(DEFAULT_WORLD_NAME, DEFAULT_LANGUAGE),
  audioSettings: { ...DEFAULT_AUDIO_SETTINGS },
  siteThemeId: DEFAULT_SITE_THEME_ID,
  siteThemeOverrides: {},
  defaultLanguage: DEFAULT_LANGUAGE,
  languagesEnabled: false,
  languages: [
    { code: DEFAULT_LANGUAGE, label: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
    { code: "en", label: "English" },
  ],
  mapViewSwitcherVisible: true,
  sectionVisibility: { ...DEFAULT_SECTION_VISIBILITY },
  mapViews: DEFAULT_MAP_VIEWS.map((entry) => ({
    ...entry,
    translations: normalizeTranslationsMap(entry.translations),
  })),
  loadingFlavorLines: [],
  translations: {},
});

export function normalizeWorldInfo(rawValue) {
  // World info acts like a root config object: it combines branding, language
  // settings, loading-screen copy, and map-view preferences.
  const raw = rawValue && typeof rawValue === "object" ? rawValue : {};
  const name = normalizeText(raw.name, DEFAULT_WORLD_INFO.name);
  const languageConfig = normalizeLanguageConfig(raw);
  const defaults = buildDefaultWorldInfo(name, languageConfig.defaultLanguage);
  const result = WORLD_TEXT_KEYS.reduce((entry, key) => {
    entry[key] = normalizeText(raw[key], defaults[key]);
    return entry;
  }, {});

  result.defaultLanguage = languageConfig.defaultLanguage;
  result.languagesEnabled = languageConfig.languagesEnabled;
  result.languages = languageConfig.languages;
  result.mapViewSwitcherVisible = raw.mapViewSwitcherVisible !== false;
  result.sectionVisibility = normalizeSectionVisibility(raw.sectionVisibility);
  result.mapViews = normalizeMapViews(raw.mapViews);
  result.audioSettings = normalizeAudioSettings(raw.audioSettings);
  const themeConfig = normalizeSiteThemeConfig(raw);
  result.siteThemeId = themeConfig.siteThemeId;
  result.siteThemeOverrides = themeConfig.siteThemeOverrides;
  result.loadingFlavorLines = Array.isArray(raw.loadingFlavorLines)
    ? raw.loadingFlavorLines
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
    : [];
  result.translations = normalizeTranslationsMap(raw.translations);
  return result;
}

export function resolveWorldInfoForLanguage(currentWorldInfo, languageCode = DEFAULT_LANGUAGE) {
  // This resolver keeps dynamic fields like the world name and generated
  // defaults in sync, even when only part of the branding was translated.
  const current = normalizeWorldInfo(currentWorldInfo);
  const targetLanguage = resolveLanguage(current, languageCode);
  const localizedName = targetLanguage === current.defaultLanguage
    ? current.name
    : normalizeText(current.translations?.[targetLanguage]?.name, current.name);

  const baseDefaults = buildDefaultWorldInfo(current.name, current.defaultLanguage);
  const localizedDefaults = buildDefaultWorldInfo(localizedName, targetLanguage);
  const localized = {
    ...localizedDefaults,
    defaultLanguage: current.defaultLanguage,
    languagesEnabled: current.languagesEnabled,
    languages: current.languages,
    mapViewSwitcherVisible: current.mapViewSwitcherVisible,
    sectionVisibility: current.sectionVisibility,
    mapViews: current.mapViews,
    audioSettings: current.audioSettings,
    siteThemeId: current.siteThemeId,
    siteThemeOverrides: current.siteThemeOverrides,
    loadingFlavorLines: current.loadingFlavorLines,
    translations: current.translations,
  };

  WORLD_TEXT_KEYS.forEach((key) => {
    const translatedValue = targetLanguage === current.defaultLanguage
      ? ""
      : normalizeText(current.translations?.[targetLanguage]?.[key], "");
    if (translatedValue) {
      localized[key] = translatedValue;
      return;
    }

    const baseValue = normalizeText(current[key], baseDefaults[key]);
    localized[key] = baseValue === baseDefaults[key]
      ? localizedDefaults[key]
      : baseValue;
  });

  const translatedFlavorLines = targetLanguage === current.defaultLanguage
    ? []
    : current.translations?.[targetLanguage]?.loadingFlavorLines;
  localized.loadingFlavorLines = Array.isArray(translatedFlavorLines) && translatedFlavorLines.some((entry) => String(entry || "").trim())
    ? translatedFlavorLines.map((entry) => String(entry || "").trim()).filter(Boolean)
    : current.loadingFlavorLines;

  return localized;
}

export function renameWorldInfo(currentWorldInfo, nextName, options = {}) {
  // Renaming in the default language updates every auto-generated default that
  // still tracks the old name, but preserves any field the creator customized.
  const normalizedCurrent = normalizeWorldInfo(currentWorldInfo);
  const languageCode = resolveLanguage(
    normalizedCurrent,
    options.languageCode || normalizedCurrent.defaultLanguage || DEFAULT_LANGUAGE,
  );
  const name = normalizeText(nextName, DEFAULT_WORLD_INFO.name);

  if (languageCode !== normalizedCurrent.defaultLanguage) {
    return normalizeWorldInfo({
      ...normalizedCurrent,
      translations: {
        ...normalizedCurrent.translations,
        [languageCode]: {
          ...(normalizedCurrent.translations?.[languageCode] || {}),
          name,
        },
      },
    });
  }

  const previousName = normalizeText(normalizedCurrent.name, DEFAULT_WORLD_INFO.name);
  const previousDefaults = buildDefaultWorldInfo(previousName, normalizedCurrent.defaultLanguage);
  const renamed = buildDefaultWorldInfo(name, normalizedCurrent.defaultLanguage);
  renamed.audioSettings = normalizeAudioSettings(normalizedCurrent.audioSettings);
  renamed.siteThemeId = normalizedCurrent.siteThemeId;
  renamed.siteThemeOverrides = normalizedCurrent.siteThemeOverrides;
  renamed.sectionVisibility = normalizeSectionVisibility(normalizedCurrent.sectionVisibility);

  WORLD_TEXT_KEYS.forEach((key) => {
    if (key === "name") return;

    const currentValue = normalizeText(normalizedCurrent[key], previousDefaults[key]);
    renamed[key] = currentValue === previousDefaults[key]
      ? renamed[key]
      : currentValue;
  });

  return normalizeWorldInfo({
    ...renamed,
    defaultLanguage: normalizedCurrent.defaultLanguage,
    languagesEnabled: normalizedCurrent.languagesEnabled,
    languages: normalizedCurrent.languages,
    mapViewSwitcherVisible: normalizedCurrent.mapViewSwitcherVisible,
    sectionVisibility: normalizedCurrent.sectionVisibility,
    mapViews: normalizedCurrent.mapViews,
    siteThemeId: normalizedCurrent.siteThemeId,
    siteThemeOverrides: normalizedCurrent.siteThemeOverrides,
    loadingFlavorLines: normalizedCurrent.loadingFlavorLines,
    translations: normalizedCurrent.translations,
  });
}
