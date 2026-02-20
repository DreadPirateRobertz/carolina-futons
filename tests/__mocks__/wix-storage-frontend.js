// Mock wix-storage-frontend for vitest
// Uses globalThis.sessionStorage so setup.js clear() resets it
export const session = {
  getItem: (key) => globalThis.sessionStorage.getItem(key),
  setItem: (key, value) => globalThis.sessionStorage.setItem(key, String(value)),
  removeItem: (key) => globalThis.sessionStorage.removeItem(key),
  clear: () => globalThis.sessionStorage.clear(),
};

export const local = {
  getItem: (key) => globalThis.sessionStorage.getItem(key),
  setItem: (key, value) => globalThis.sessionStorage.setItem(key, String(value)),
  removeItem: (key) => globalThis.sessionStorage.removeItem(key),
  clear: () => globalThis.sessionStorage.clear(),
};

export const memory = {
  getItem: (key) => globalThis.sessionStorage.getItem(key),
  setItem: (key, value) => globalThis.sessionStorage.setItem(key, String(value)),
  removeItem: (key) => globalThis.sessionStorage.removeItem(key),
  clear: () => globalThis.sessionStorage.clear(),
};

export function __reset() {
  globalThis.sessionStorage.clear();
}
