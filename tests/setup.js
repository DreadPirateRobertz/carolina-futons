// Global test setup — resets all Wix mocks before each test
import { __reset as resetData } from './__mocks__/wix-data.js';
import { __reset as resetCrm } from './__mocks__/wix-crm-backend.js';
import { __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetFetch } from './__mocks__/wix-fetch.js';
import { __reset as resetLocation } from './__mocks__/wix-location-frontend.js';
import { __reset as resetStores } from './__mocks__/wix-stores-frontend.js';
import { __reset as resetWixLocation } from './__mocks__/wix-location.js';
import { __reset as resetMembers } from './__mocks__/wix-members-backend.js';
import { __reset as resetStorage } from './__mocks__/wix-storage-frontend.js';
import { __reset as resetSite } from './__mocks__/wix-site-frontend.js';

// Provide sessionStorage globally (not available in Node environment)
class MockSessionStorage {
  constructor() { this._store = {}; }
  getItem(key) { return this._store[key] ?? null; }
  setItem(key, value) { this._store[key] = String(value); }
  removeItem(key) { delete this._store[key]; }
  clear() { this._store = {}; }
  get length() { return Object.keys(this._store).length; }
  key(index) { return Object.keys(this._store)[index] ?? null; }
}

if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = new MockSessionStorage();
}

beforeEach(() => {
  resetData();
  resetCrm();
  resetSecrets();
  resetFetch();
  resetLocation();
  resetStores();
  resetWixLocation();
  resetMembers();
  resetStorage();
  resetSite();
  if (globalThis.sessionStorage && globalThis.sessionStorage.clear) {
    globalThis.sessionStorage.clear();
  }
});
