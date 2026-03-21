/**
 * Tests for pinterestTag.js — Pinterest Tag (Conversion Tag) tracking
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initPinterestTag, firePinterestEvent, setPinterestTagId } from '../src/public/pinterestTag.js';

// ── initPinterestTag — basic guards ────────────────────────────────────────

describe('initPinterestTag — basic guards', () => {
  beforeEach(() => {
    setPinterestTagId('');
    delete globalThis.window?.pintrk;
  });

  it('does not throw when window is undefined', () => {
    const origWindow = globalThis.window;
    try {
      delete globalThis.window;
      expect(() => initPinterestTag()).not.toThrow();
    } finally {
      globalThis.window = origWindow;
    }
  });

  it('does not throw when called normally (TAG_ID is empty)', () => {
    expect(() => initPinterestTag()).not.toThrow();
  });

  it('does not initialize when TAG_ID is empty', () => {
    initPinterestTag();
    expect(globalThis.window?.pintrk).toBeUndefined();
  });

  it('does not throw when document is undefined', () => {
    const origDoc = globalThis.document;
    try {
      delete globalThis.document;
      setPinterestTagId('TAG_DOC_GUARD');
      expect(() => initPinterestTag()).not.toThrow();
    } finally {
      globalThis.document = origDoc;
      setPinterestTagId('');
    }
  });

  it('does not reinitialize when pintrk already exists on window', () => {
    const existingPintrk = vi.fn();
    existingPintrk.queue = [];
    existingPintrk.version = '3.0';
    globalThis.window = globalThis.window || {};
    globalThis.window.pintrk = existingPintrk;

    setPinterestTagId('TEST_TAG_123');
    initPinterestTag();

    // pintrk should remain the same object — not overwritten
    expect(globalThis.window.pintrk).toBe(existingPintrk);

    setPinterestTagId('');
    delete globalThis.window.pintrk;
  });
});

// ── firePinterestEvent ─────────────────────────────────────────────────────

describe('firePinterestEvent', () => {
  beforeEach(() => {
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = {};
    }
  });

  it('does not throw when pintrk is not initialized', () => {
    delete globalThis.window.pintrk;
    expect(() => firePinterestEvent('viewcategory', {})).not.toThrow();
  });

  it('calls pintrk track when pintrk is available', () => {
    const mockPintrk = vi.fn();
    globalThis.window.pintrk = mockPintrk;
    firePinterestEvent('addtocart', { value: 150, currency: 'USD', order_quantity: 1 });
    expect(mockPintrk).toHaveBeenCalledWith('track', 'addtocart', { value: 150, currency: 'USD', order_quantity: 1 });
  });

  it('does not throw when pintrk throws internally', () => {
    globalThis.window.pintrk = () => { throw new Error('network error'); };
    expect(() => firePinterestEvent('purchase', { value: 500 })).not.toThrow();
  });

  it('does not throw when window is undefined', () => {
    const origWindow = globalThis.window;
    try {
      delete globalThis.window;
      expect(() => firePinterestEvent('viewcategory', { category_name: 'futons' })).not.toThrow();
    } finally {
      globalThis.window = origWindow;
    }
  });

  it('uses empty object as default params', () => {
    const mockPintrk = vi.fn();
    globalThis.window.pintrk = mockPintrk;
    firePinterestEvent('pagevisit');
    expect(mockPintrk).toHaveBeenCalledWith('track', 'pagevisit', {});
  });

  it('passes checkout event params correctly', () => {
    const mockPintrk = vi.fn();
    globalThis.window.pintrk = mockPintrk;
    firePinterestEvent('checkout', {
      value: 799,
      order_quantity: 2,
      currency: 'USD',
      line_items: [{ product_name: 'Metro Futon Frame', product_id: 'p1' }],
    });
    expect(mockPintrk).toHaveBeenCalledWith('track', 'checkout', expect.objectContaining({
      value: 799,
      currency: 'USD',
    }));
  });

  afterEach(() => {
    delete globalThis.window?.pintrk;
  });
});

// ── initPinterestTag — IIFE loader path ────────────────────────────────────

describe('initPinterestTag — IIFE loader path', () => {
  let origDocument;

  beforeEach(() => {
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = {};
    }
    origDocument = globalThis.document;
    // Minimal DOM stubs for the IIFE's createElement/getElementsByTagName
    const fakeScript = { src: '', async: false };
    const fakeParent = { insertBefore: vi.fn() };
    globalThis.document = {
      createElement: vi.fn(() => fakeScript),
      getElementsByTagName: vi.fn(() => [{ parentNode: fakeParent }]),
    };
    delete globalThis.window.pintrk;
  });

  afterEach(() => {
    setPinterestTagId('');
    delete globalThis.window.pintrk;
    globalThis.document = origDocument;
  });

  it('sets up pintrk queue when TAG_ID is set', () => {
    setPinterestTagId('TEST_TAG_456');
    initPinterestTag();

    expect(globalThis.window.pintrk).toBeDefined();
    expect(Array.isArray(globalThis.window.pintrk.queue)).toBe(true);
    expect(globalThis.window.pintrk.version).toBe('3.0');
  });

  it('calls createElement for the Pinterest core.js script', () => {
    setPinterestTagId('TAG_SCRIPT_TEST');
    initPinterestTag();
    expect(globalThis.document.createElement).toHaveBeenCalledWith('script');
  });

  it('calls pintrk with load and tag ID', () => {
    setPinterestTagId('TAG_LOAD_TEST');
    initPinterestTag();

    const firstCall = globalThis.window.pintrk.queue[0];
    expect(firstCall[0]).toBe('load');
    expect(firstCall[1]).toBe('TAG_LOAD_TEST');
    expect(firstCall[2]).toEqual({ np: 'wix' });
  });

  it('calls pintrk with page after load', () => {
    setPinterestTagId('TAG_PAGE_TEST');
    initPinterestTag();

    const secondCall = globalThis.window.pintrk.queue[1];
    expect(secondCall[0]).toBe('page');
  });

  it('does not throw when getElementsByTagName returns empty', () => {
    globalThis.document.getElementsByTagName = vi.fn(() => []);
    setPinterestTagId('TAG_EMPTY_DOM');
    expect(() => initPinterestTag()).not.toThrow();
  });

  it('resets to no-op when TAG_ID cleared after init', () => {
    setPinterestTagId('TAG_TEMP');
    initPinterestTag();

    setPinterestTagId('');
    delete globalThis.window.pintrk;

    initPinterestTag();
    expect(globalThis.window.pintrk).toBeUndefined();
  });
});

// ── setPinterestTagId ──────────────────────────────────────────────────────

describe('setPinterestTagId', () => {
  afterEach(() => {
    setPinterestTagId('');
  });

  it('sets the tag ID for subsequent initPinterestTag calls', () => {
    expect(() => setPinterestTagId('MY_TAG')).not.toThrow();
  });

  it('treats null as empty string (no init)', () => {
    setPinterestTagId(null);
    expect(() => initPinterestTag()).not.toThrow();
    expect(globalThis.window?.pintrk).toBeUndefined();
  });

  it('treats undefined as empty string (no init)', () => {
    setPinterestTagId(undefined);
    expect(() => initPinterestTag()).not.toThrow();
    expect(globalThis.window?.pintrk).toBeUndefined();
  });
});
