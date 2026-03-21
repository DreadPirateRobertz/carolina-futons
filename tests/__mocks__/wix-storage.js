// Mock wix-storage for vitest — mirrors wix-storage-frontend mock
export const session = {
  getItem: (key) => globalThis.sessionStorage.getItem(key),
  setItem: (key, value) => globalThis.sessionStorage.setItem(key, String(value)),
  removeItem: (key) => globalThis.sessionStorage.removeItem(key),
  clear: () => globalThis.sessionStorage.clear(),
};

export const local = {
  getItem: (key) => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, String(value)),
  removeItem: (key) => globalThis.localStorage.removeItem(key),
  clear: () => globalThis.localStorage.clear(),
};

export function __reset() {
  globalThis.sessionStorage.clear();
}
