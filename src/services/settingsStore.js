/**
 * Small preference values (theme, motion, speech rate/voice) - localStorage is
 * the right tool here, not IndexedDB, since these are a handful of tiny values
 * read constantly, not structured records.
 */
const THEME_KEY = 'appTheme';
const REDUCE_MOTION_KEY = 'reduceMotion';
const SPEECH_RATE_KEY = 'speechRate';
const SPEECH_VOICE_KEY = 'speechVoiceName';

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function getReduceMotion() {
  return localStorage.getItem(REDUCE_MOTION_KEY) === 'true';
}

export function applyReduceMotion(value) {
  document.documentElement.setAttribute('data-reduce-motion', value ? 'true' : 'false');
}

export function setReduceMotion(value) {
  localStorage.setItem(REDUCE_MOTION_KEY, value ? 'true' : 'false');
  applyReduceMotion(value);
}

export function getSpeechRate() {
  const v = parseFloat(localStorage.getItem(SPEECH_RATE_KEY));
  return Number.isNaN(v) ? 0.95 : v;
}

export function setSpeechRate(rate) {
  localStorage.setItem(SPEECH_RATE_KEY, String(rate));
}

export function getSpeechVoiceName() {
  return localStorage.getItem(SPEECH_VOICE_KEY) || '';
}

export function setSpeechVoiceName(name) {
  localStorage.setItem(SPEECH_VOICE_KEY, name);
}

/** Called once at app startup so a previously-chosen theme/motion setting applies immediately, before any screen renders. */
export function applyPersistedSettings() {
  applyTheme(getTheme());
  applyReduceMotion(getReduceMotion());
}
