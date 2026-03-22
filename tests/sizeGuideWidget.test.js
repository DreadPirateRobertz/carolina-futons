/**
 * @file sizeGuideWidget.test.js
 * @description Tests for src/public/SizeGuide.js — product page size guide modal.
 *
 * CF-z64j: Size Guide Modal
 *
 * Covers: title, aria-labels, button wiring, modal open/close,
 * repeater onItemReady ordering, data shape, row fields, null safety.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { initSizeGuide } from '../src/public/SizeGuide.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    accessibility: { ariaLabel: '' },
    open: vi.fn(),
    close: vi.fn(),
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    ...overrides,
  };
}

function makeWixEnv(overrides = {}) {
  const els = {
    '#sizeGuideBtn':      makeEl(),
    '#sizeGuideModal':    makeEl(),
    '#sizeGuideTitle':    makeEl(),
    '#sizeGuideRepeater': makeEl(),
    '#sizeGuideClose':    makeEl(),
    ...overrides,
  };
  const $w = vi.fn(sel => els[sel] || null);
  $w.__els = els;
  return $w;
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ── initSizeGuide ─────────────────────────────────────────────────────────

describe('initSizeGuide', () => {

  // ── title ────────────────────────────────────────────────────────────

  it('sets #sizeGuideTitle text to "Futon Size Guide"', async () => {
    const $w = makeWixEnv();
    await initSizeGuide($w);
    expect($w.__els['#sizeGuideTitle'].text).toBe('Futon Size Guide');
  });

  // ── ARIA labels ──────────────────────────────────────────────────────

  it('sets aria-label "Open size guide" on #sizeGuideBtn', async () => {
    const $w = makeWixEnv();
    await initSizeGuide($w);
    expect($w.__els['#sizeGuideBtn'].accessibility.ariaLabel).toBe('Open size guide');
  });

  it('sets aria-label "Close size guide" on #sizeGuideClose', async () => {
    const $w = makeWixEnv();
    await initSizeGuide($w);
    expect($w.__els['#sizeGuideClose'].accessibility.ariaLabel).toBe('Close size guide');
  });

  // ── button wiring ────────────────────────────────────────────────────

  it('registers onClick on #sizeGuideBtn', async () => {
    const $w = makeWixEnv();
    await initSizeGuide($w);
    expect($w.__els['#sizeGuideBtn'].onClick).toHaveBeenCalledTimes(1);
    expect(typeof $w.__els['#sizeGuideBtn'].onClick.mock.calls[0][0]).toBe('function');
  });

  it('registers onClick on #sizeGuideClose', async () => {
    const $w = makeWixEnv();
    await initSizeGuide($w);
    expect($w.__els['#sizeGuideClose'].onClick).toHaveBeenCalledTimes(1);
    expect(typeof $w.__els['#sizeGuideClose'].onClick.mock.calls[0][0]).toBe('function');
  });

  // ── modal open / close ───────────────────────────────────────────────

  it('opens #sizeGuideModal when #sizeGuideBtn is clicked', async () => {
    const $w = makeWixEnv();
    await initSizeGuide($w);
    const handler = $w.__els['#sizeGuideBtn'].onClick.mock.calls[0][0];
    handler();
    expect($w.__els['#sizeGuideModal'].open).toHaveBeenCalled();
  });

  it('closes #sizeGuideModal when #sizeGuideClose is clicked', async () => {
    const $w = makeWixEnv();
    await initSizeGuide($w);
    const handler = $w.__els['#sizeGuideClose'].onClick.mock.calls[0][0];
    handler();
    expect($w.__els['#sizeGuideModal'].close).toHaveBeenCalled();
  });

  // ── repeater ordering ────────────────────────────────────────────────

  it('registers onItemReady BEFORE setting .data on repeater', async () => {
    const callOrder = [];
    const repeater = {
      onItemReady: vi.fn(() => callOrder.push('onItemReady')),
      _data: undefined,
      get data() { return this._data; },
      set data(v) { callOrder.push('data'); this._data = v; },
    };
    const $w = makeWixEnv({ '#sizeGuideRepeater': repeater });
    await initSizeGuide($w);
    expect(callOrder.indexOf('onItemReady')).toBeLessThan(callOrder.indexOf('data'));
  });

  // ── repeater data ────────────────────────────────────────────────────

  it('sets repeater data with 3 rows', async () => {
    let capturedData;
    const repeater = {
      onItemReady: vi.fn(),
      get data() { return capturedData; },
      set data(v) { capturedData = v; },
    };
    const $w = makeWixEnv({ '#sizeGuideRepeater': repeater });
    await initSizeGuide($w);
    expect(capturedData).toHaveLength(3);
  });

  it('repeater data contains Full, Queen, and Twin rows', async () => {
    let capturedData;
    const repeater = {
      onItemReady: vi.fn(),
      get data() { return capturedData; },
      set data(v) { capturedData = v; },
    };
    const $w = makeWixEnv({ '#sizeGuideRepeater': repeater });
    await initSizeGuide($w);
    const names = capturedData.map(r => r.name);
    expect(names).toEqual(expect.arrayContaining(['Full', 'Queen', 'Twin']));
  });

  it('each row has a unique _id', async () => {
    let capturedData;
    const repeater = {
      onItemReady: vi.fn(),
      get data() { return capturedData; },
      set data(v) { capturedData = v; },
    };
    const $w = makeWixEnv({ '#sizeGuideRepeater': repeater });
    await initSizeGuide($w);
    const ids = capturedData.map(r => r._id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ── onItemReady row rendering ─────────────────────────────────────────

  it('sets all 5 dimension fields in onItemReady callback', async () => {
    let capturedCallback;
    const repeater = makeEl({
      onItemReady: vi.fn(cb => { capturedCallback = cb; }),
    });
    const $w = makeWixEnv({ '#sizeGuideRepeater': repeater });
    await initSizeGuide($w);

    const nameEl   = makeEl();
    const widthEl  = makeEl();
    const lengthEl = makeEl();
    const foldedEl = makeEl();
    const openEl   = makeEl();
    const $item = vi.fn(sel => ({
      '#sizeGuideName':    nameEl,
      '#sizeGuideWidth':   widthEl,
      '#sizeGuideLength':  lengthEl,
      '#sizeGuideFoldedH': foldedEl,
      '#sizeGuideOpenH':   openEl,
    }[sel] || makeEl()));

    capturedCallback($item, {
      _id: 'row-0', name: 'Full', width: '54"', length: '75"',
      foldedH: '~35"', openH: '~16"',
    });

    expect(nameEl.text).toBe('Full');
    expect(widthEl.text).toBe('54"');
    expect(lengthEl.text).toBe('75"');
    expect(foldedEl.text).toBe('~35"');
    expect(openEl.text).toBe('~16"');
  });

  it('Queen row has correct dimensions in static data', async () => {
    let capturedData;
    const repeater = {
      onItemReady: vi.fn(),
      get data() { return capturedData; },
      set data(v) { capturedData = v; },
    };
    const $w = makeWixEnv({ '#sizeGuideRepeater': repeater });
    await initSizeGuide($w);
    const queen = capturedData.find(r => r.name === 'Queen');
    expect(queen).toBeDefined();
    expect(queen.width).toBe('60"');
    expect(queen.length).toBe('80"');
    expect(queen.foldedH).toBe('~37"');
    expect(queen.openH).toBe('~18"');
  });

  // ── null safety ──────────────────────────────────────────────────────

  it('does not throw when $w returns null for all elements', async () => {
    const $w = vi.fn(() => null);
    await expect(initSizeGuide($w)).resolves.not.toThrow();
  });
});
