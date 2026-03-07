/**
 * Tests for tikTokPixel.js — TikTok Pixel tracking initialization
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTikTokPixel, fireTikTokEvent } from '../src/public/tikTokPixel.js';

describe('initTikTokPixel', () => {
  beforeEach(() => {
    // Ensure clean window state
    delete globalThis.window?.ttq;
  });

  it('does not throw when window is undefined', () => {
    const origWindow = globalThis.window;
    delete globalThis.window;
    expect(() => initTikTokPixel()).not.toThrow();
    globalThis.window = origWindow;
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

  afterEach(() => {
    delete globalThis.window?.ttq;
  });
});
