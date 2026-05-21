// Simple global settings store using localStorage + custom events.
// Keeps settings consistent across pages without prop-drilling.

const STORAGE_KEY = 'muse_settings_v1';
const DEFAULTS = {
  volume: 80,
  voiceEnabled: true,
  darkMode: true,
  notifications: true,
  animations: true,
  highContrast: false,
  autoNarration: true,
  fontSize: 'Medium'
};

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeAll(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

let cached = readAll();

export const settingsStore = {
  get() {
    cached = readAll();
    return cached;
  },

  getKey(key) {
    cached = readAll();
    return cached[key];
  },

  set(patch) {
    cached = { ...readAll(), ...(patch || {}) };
    writeAll(cached);
    window.dispatchEvent(new CustomEvent('muse:settings-changed', { detail: cached }));
    return cached;
  },

  reset() {
    writeAll({ ...DEFAULTS });
    cached = { ...DEFAULTS };
    window.dispatchEvent(new CustomEvent('muse:settings-changed', { detail: cached }));
    return cached;
  },

  defaults: { ...DEFAULTS }
};

