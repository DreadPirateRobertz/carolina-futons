import { describe, it, expect } from 'vitest';
import { get_manifest, get_serviceWorker, get_health } from '../../src/backend/http-functions.js';
import {
  canShowInstallPrompt,
  isInstalledPWA,
  __resetPrompt,
} from '../../src/public/pwaHelpers.js';

// ── get_manifest ────────────────────────────────────────────────────

describe('get_manifest', () => {
  it('returns 200 with JSON body', () => {
    const res = get_manifest();
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/json');
  });

  it('returns valid manifest JSON with required fields', () => {
    const res = get_manifest();
    const manifest = JSON.parse(res.body);
    expect(manifest.name).toBe('Carolina Futons');
    expect(manifest.short_name).toBe('CF Futons');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('includes theme color and background color', () => {
    const res = get_manifest();
    const manifest = JSON.parse(res.body);
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
  });

  it('includes icons with 192px and 512px sizes', () => {
    const res = get_manifest();
    const manifest = JSON.parse(res.body);
    expect(manifest.icons).toHaveLength(2);
    const sizes = manifest.icons.map(i => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('sets long cache TTL', () => {
    const res = get_manifest();
    expect(res.headers['Cache-Control']).toContain('max-age=86400');
  });

  it('includes description and categories', () => {
    const res = get_manifest();
    const manifest = JSON.parse(res.body);
    expect(manifest.description).toContain('futon');
    expect(manifest.categories).toContain('shopping');
  });
});

// ── get_serviceWorker ──────────────────────────────────────────────

describe('get_serviceWorker', () => {
  it('returns 200 with JavaScript content type', () => {
    const res = get_serviceWorker();
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('application/javascript');
  });

  it('includes Service-Worker-Allowed header for root scope', () => {
    const res = get_serviceWorker();
    expect(res.headers['Service-Worker-Allowed']).toBe('/');
  });

  it('sets no-cache to ensure fresh SW on updates', () => {
    const res = get_serviceWorker();
    expect(res.headers['Cache-Control']).toBe('no-cache');
  });

  it('includes install event listener', () => {
    const res = get_serviceWorker();
    expect(res.body).toContain("self.addEventListener('install'");
  });

  it('includes activate event listener with cache cleanup', () => {
    const res = get_serviceWorker();
    expect(res.body).toContain("self.addEventListener('activate'");
    expect(res.body).toContain('caches.delete');
  });

  it('includes fetch event listener with offline fallback', () => {
    const res = get_serviceWorker();
    expect(res.body).toContain("self.addEventListener('fetch'");
    expect(res.body).toContain('navigate');
  });

  it('precaches key product pages', () => {
    const res = get_serviceWorker();
    expect(res.body).toContain('/shop-main');
    expect(res.body).toContain('/futon-frames');
    expect(res.body).toContain('/mattresses');
    expect(res.body).toContain('/murphy-cabinet-beds');
  });

  it('uses skipWaiting for immediate activation', () => {
    const res = get_serviceWorker();
    expect(res.body).toContain('self.skipWaiting()');
  });

  it('uses clients.claim for immediate control', () => {
    const res = get_serviceWorker();
    expect(res.body).toContain('self.clients.claim()');
  });
});

// ── pwaHelpers ─────────────────────────────────────────────────────

describe('pwaHelpers', () => {
  it('canShowInstallPrompt returns false when no prompt captured', () => {
    __resetPrompt();
    expect(canShowInstallPrompt()).toBe(false);
  });

  it('isInstalledPWA returns false in test environment', () => {
    expect(isInstalledPWA()).toBe(false);
  });
});
