/**
 * Tests for tikTokPixel.js — TikTok Pixel tracking initialization
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTikTokPixel, fireTikTokEvent, setPixelId } from '../src/public/tikTokPixel.js';

describe('initTikTokPixel', () => {
  beforeEach(() => {
    // Ensure clean window state
    delete globalThis.window?.ttq;
  });

  it('does not throw when window is undefined', () => {
    const origWindow = globalThis.window;
    try {
      delete globalThis.window;
      expect(() => initTikTokPixel()).not.toThrow();
    } finally {
      globalThis.window = origWindow;
    }
  });

  it('does not throw when called normally (PIXEL_ID is empty)', () => {
    // PIXEL_ID is '' by default, so init should return early
    expect(() => initTikTokPixel()).not.toThrow();
  });

  it('does not initialize when PIXEL_ID is empty', () => {
    initTikTokPixel();
    // ttq should NOT be set because PIXEL_ID is empty
    expect(globalThis.window?.ttq).toBeUndefined();
  });
});

describe('fireTikTokEvent', () => {
  beforeEach(() => {
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = {};
    }
  });

  it('does not throw when ttq is not initialized', () => {
    delete globalThis.window.ttq;
    expect(() => fireTikTokEvent('ViewContent', {})).not.toThrow();
  });

  it('calls ttq.track when ttq is available', () => {
    const mockTrack = vi.fn();
    globalThis.window.ttq = { track: mockTrack };
    fireTikTokEvent('AddToCart', { value: 100, currency: 'USD' });
    expect(mockTrack).toHaveBeenCalledWith('AddToCart', { value: 100, currency: 'USD' });
  });

  it('does not throw when ttq.track throws', () => {
    globalThis.window.ttq = {
      track: () => { throw new Error('network error'); },
    };
    expect(() => fireTikTokEvent('Purchase', {})).not.toThrow();
  });

  it('does not throw when window is undefined', () => {
    const origWindow = globalThis.window;
    try {
      delete globalThis.window;
      expect(() => fireTikTokEvent('ViewContent', { id: '123' })).not.toThrow();
    } finally {
      globalThis.window = origWindow;
    }
  });

  it('uses empty object as default params', () => {
    const mockTrack = vi.fn();
    globalThis.window.ttq = { track: mockTrack };
    fireTikTokEvent('PageView');
    expect(mockTrack).toHaveBeenCalledWith('PageView', {});
  });

  afterEach(() => {
    delete globalThis.window?.ttq;
  });
});

describe('initTikTokPixel — double-init guard', () => {
  it('does not re-initialize when ttq already exists on window', () => {
    const existingTtq = { page: vi.fn(), track: vi.fn() };
    globalThis.window = globalThis.window || {};
    globalThis.window.ttq = existingTtq;

    initTikTokPixel();

    // ttq should remain the same object — not overwritten
    expect(globalThis.window.ttq).toBe(existingTtq);

    delete globalThis.window.ttq;
  });
});

// ── IIFE pixel loader (with PIXEL_ID set via setPixelId) ────────────

describe('initTikTokPixel — IIFE pixel loader path', () => {
  let origDocument;

  beforeEach(() => {
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = {};
    }
    origDocument = globalThis.document;
    // Provide minimal DOM stubs for the IIFE's createElement/getElementsByTagName
    globalThis.document = {
      createElement: vi.fn(() => ({ src: '', async: false })),
      getElementsByTagName: vi.fn(() => [{ parentNode: { insertBefore: vi.fn() } }]),
    };
    delete globalThis.window.ttq;
    delete globalThis.window.TiktokAnalyticsObject;
  });

  afterEach(() => {
    setPixelId(''); // Reset to default empty
    delete globalThis.window.ttq;
    delete globalThis.window.TiktokAnalyticsObject;
    globalThis.document = origDocument;
  });

  it('initializes ttq on window when PIXEL_ID is set', () => {
    setPixelId('TEST_PIXEL_123');
    initTikTokPixel();

    expect(globalThis.window.TiktokAnalyticsObject).toBe('ttq');
    expect(globalThis.window.ttq).toBeDefined();
    expect(Array.isArray(globalThis.window.ttq)).toBe(true);
  });

  it('calls ttq.load with the pixel ID', () => {
    setPixelId('PIXEL_ABC');
    initTikTokPixel();

    // ttq._i should have the pixel ID registered
    expect(globalThis.window.ttq._i).toBeDefined();
    expect(globalThis.window.ttq._i['PIXEL_ABC']).toBeDefined();
  });

  it('calls createElement via the IIFE loader', () => {
    setPixelId('PIXEL_XYZ');
    initTikTokPixel();

    expect(globalThis.document.createElement).toHaveBeenCalledWith('ttq');
  });

  it('does not reinitialize when ttq already exists', () => {
    const existingTtq = { page: vi.fn(), track: vi.fn() };
    globalThis.window.ttq = existingTtq;
    setPixelId('PIXEL_DUPE');

    initTikTokPixel();

    expect(globalThis.window.ttq).toBe(existingTtq);
  });

  it('does not throw when document.getElementsByTagName returns empty', () => {
    globalThis.document.getElementsByTagName = vi.fn(() => []);
    setPixelId('PIXEL_EMPTY');

    // The IIFE accesses [0].parentNode which would be undefined
    // Outer try/catch should handle it
    expect(() => initTikTokPixel()).not.toThrow();
  });

  it('resets to no-op when PIXEL_ID cleared after init', () => {
    setPixelId('PIXEL_TEMP');
    initTikTokPixel();

    // Clear pixel and delete ttq to simulate fresh state
    setPixelId('');
    delete globalThis.window.ttq;
    delete globalThis.window.TiktokAnalyticsObject;

    initTikTokPixel();

    // Should not re-create ttq because PIXEL_ID is empty
    expect(globalThis.window.ttq).toBeUndefined();
  });
});

// ── setPixelId ──────────────────────────────────────────────────────

describe('setPixelId', () => {
  afterEach(() => {
    setPixelId('');
  });

  it('sets the pixel ID for subsequent initTikTokPixel calls', () => {
    setPixelId('MY_PIXEL');
    // After setting, initTikTokPixel would use this ID
    // (verified in IIFE tests above)
    expect(() => setPixelId('MY_PIXEL')).not.toThrow();
  });

  it('treats null as empty string', () => {
    setPixelId(null);
    expect(() => initTikTokPixel()).not.toThrow();
  });

  it('treats undefined as empty string', () => {
    setPixelId(undefined);
    expect(() => initTikTokPixel()).not.toThrow();
  });
});
