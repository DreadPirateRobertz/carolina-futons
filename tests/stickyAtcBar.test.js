/**
 * Tests for src/public/StickyAtcBar.js
 * CF-gj26: Sticky Add-to-Cart Bar — PDP scroll-aware fixed bottom bar
 *
 * Coverage:
 *   syncStickyBarState   — sets name, price, disables button when out of stock
 *   showStickyBar        — calls .show() on the bar
 *   hideStickyBar        — calls .hide() on the bar
 *   handleStickyAtcClick — calls addToCart, manages button loading state, re-enables
 *   initStickyAtcBar     — full integration: init, scroll show/hide, click, edge cases
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncStickyBarState,
  showStickyBar,
  hideStickyBar,
  handleStickyAtcClick,
  initStickyAtcBar,
} from '../src/public/StickyAtcBar.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeElement(overrides = {}) {
  return {
    text:    null,
    label:   null,
    show:    vi.fn(),
    hide:    vi.fn(),
    enable:  vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    ...overrides,
  };
}

function make$w(map = {}) {
  return (sel) => map[sel] ?? null;
}

function makeState(overrides = {}) {
  return {
    product: {
      _id:            'prod-001',
      name:           'Futon Sofa',
      formattedPrice: '$499.00',
    },
    selectedQuantity: 1,
    isOutOfStock:     false,
    ...overrides,
  };
}

function makeElements() {
  return {
    bar:         makeElement(),
    productName: makeElement(),
    price:       makeElement(),
    btn:         makeElement(),
  };
}

function make$wFromElements({ bar, productName, price, btn } = makeElements()) {
  return make$w({
    '#stickyAtcBar':         bar,
    '#stickyAtcProductName': productName,
    '#stickyAtcPrice':       price,
    '#stickyAtcBtn':         btn,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 1. syncStickyBarState
// ═══════════════════════════════════════════════════════════════════════

describe('syncStickyBarState', () => {
  it('sets product name on #stickyAtcProductName', () => {
    const els = makeElements();
    syncStickyBarState(make$wFromElements(els), makeState());
    expect(els.productName.text).toBe('Futon Sofa');
  });

  it('sets formattedPrice on #stickyAtcPrice', () => {
    const els = makeElements();
    syncStickyBarState(make$wFromElements(els), makeState());
    expect(els.price.text).toBe('$499.00');
  });

  it('enables button when in-stock', () => {
    const els = makeElements();
    syncStickyBarState(make$wFromElements(els), makeState({ isOutOfStock: false }));
    expect(els.btn.enable).toHaveBeenCalled();
    expect(els.btn.disable).not.toHaveBeenCalled();
  });

  it('disables button and sets label when out of stock', () => {
    const els = makeElements();
    syncStickyBarState(make$wFromElements(els), makeState({ isOutOfStock: true }));
    expect(els.btn.disable).toHaveBeenCalled();
    expect(els.btn.label).toMatch(/out of stock/i);
  });

  it('resets button label to default when switching from out-of-stock to in-stock', () => {
    const els = makeElements();
    const $wFn = make$wFromElements(els);
    syncStickyBarState($wFn, makeState({ isOutOfStock: true }));
    syncStickyBarState($wFn, makeState({ isOutOfStock: false }));
    expect(els.btn.label).toBe('Add to Cart');
  });

  it('does not throw when product is null', () => {
    expect(() => syncStickyBarState(make$wFromElements(), makeState({ product: null }))).not.toThrow();
  });

  it('does not throw when elements are absent', () => {
    expect(() => syncStickyBarState(make$w(), makeState())).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. showStickyBar / hideStickyBar
// ═══════════════════════════════════════════════════════════════════════

describe('showStickyBar', () => {
  it('calls .show() on #stickyAtcBar', () => {
    const bar = makeElement();
    showStickyBar(make$w({ '#stickyAtcBar': bar }));
    expect(bar.show).toHaveBeenCalled();
  });

  it('does not throw when bar is absent', () => {
    expect(() => showStickyBar(make$w())).not.toThrow();
  });
});

describe('hideStickyBar', () => {
  it('calls .hide() on #stickyAtcBar', () => {
    const bar = makeElement();
    hideStickyBar(make$w({ '#stickyAtcBar': bar }));
    expect(bar.hide).toHaveBeenCalled();
  });

  it('does not throw when bar is absent', () => {
    expect(() => hideStickyBar(make$w())).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. handleStickyAtcClick
// ═══════════════════════════════════════════════════════════════════════

describe('handleStickyAtcClick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers(); // flushes setTimeout so _busy resets between tests
    vi.useRealTimers();
  });

  it('calls addToCart with productId and selectedQuantity', async () => {
    const addToCart = vi.fn(async () => {});
    const els = makeElements();
    await handleStickyAtcClick(make$wFromElements(els), makeState(), { addToCart });
    expect(addToCart).toHaveBeenCalledWith('prod-001', 1);
  });

  it('passes selectedQuantity > 1 to addToCart', async () => {
    const addToCart = vi.fn(async () => {});
    const els = makeElements();
    await handleStickyAtcClick(make$wFromElements(els), makeState({ selectedQuantity: 3 }), { addToCart });
    expect(addToCart).toHaveBeenCalledWith('prod-001', 3);
  });

  it('ignores a second click while in-flight (busy guard)', async () => {
    let resolve;
    const addToCart = vi.fn(() => new Promise(r => { resolve = r; }));
    const els = makeElements();
    const first = handleStickyAtcClick(make$wFromElements(els), makeState(), { addToCart });
    // Fire second click before first resolves
    await handleStickyAtcClick(make$wFromElements(els), makeState(), { addToCart });
    resolve();
    await first;
    expect(addToCart).toHaveBeenCalledTimes(1);
  });

  it('disables button and sets "Adding..." during call', async () => {
    let resolve;
    const addToCart = vi.fn(() => new Promise(r => { resolve = r; }));
    const els = makeElements();
    const clickPromise = handleStickyAtcClick(make$wFromElements(els), makeState(), { addToCart });
    expect(els.btn.disable).toHaveBeenCalled();
    expect(els.btn.label).toBe('Adding...');
    resolve();
    await clickPromise;
  });

  it('sets button label to "Added!" after success', async () => {
    const addToCart = vi.fn(async () => {});
    const els = makeElements();
    await handleStickyAtcClick(make$wFromElements(els), makeState(), { addToCart });
    expect(els.btn.label).toBe('Added!');
  });

  it('re-enables button and resets label after timeout', async () => {
    const addToCart = vi.fn(async () => {});
    const els = makeElements();
    await handleStickyAtcClick(make$wFromElements(els), makeState(), { addToCart });
    vi.advanceTimersByTime(3000);
    expect(els.btn.enable).toHaveBeenCalled();
    expect(els.btn.label).toBe('Add to Cart');
  });

  it('sets error label on addToCart failure', async () => {
    const addToCart = vi.fn(async () => { throw new Error('CMS error'); });
    const els = makeElements();
    await handleStickyAtcClick(make$wFromElements(els), makeState(), { addToCart });
    expect(els.btn.label).toMatch(/error|try again/i);
  });

  it('re-enables button after error + timeout', async () => {
    const addToCart = vi.fn(async () => { throw new Error('fail'); });
    const els = makeElements();
    await handleStickyAtcClick(make$wFromElements(els), makeState(), { addToCart });
    vi.advanceTimersByTime(3000);
    expect(els.btn.enable).toHaveBeenCalled();
    expect(els.btn.label).toBe('Add to Cart');
  });

  it('does nothing when addToCart is absent from opts', async () => {
    const els = makeElements();
    await handleStickyAtcClick(make$wFromElements(els), makeState(), {});
    expect(els.btn.disable).not.toHaveBeenCalled();
  });

  it('does nothing when product is null (no productId)', async () => {
    const addToCart = vi.fn(async () => {});
    const els = makeElements();
    await handleStickyAtcClick(make$wFromElements(els), makeState({ product: null }), { addToCart });
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('does not throw when btn element is absent', async () => {
    const addToCart = vi.fn(async () => {});
    await expect(
      handleStickyAtcClick(make$w(), makeState(), { addToCart })
    ).resolves.not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. initStickyAtcBar — integration
// ═══════════════════════════════════════════════════════════════════════

describe('initStickyAtcBar', () => {
  let els, $wFn, state, addToCart, scrollHandlers;

  beforeEach(() => {
    vi.useFakeTimers();
    els = makeElements();
    const mainBtn = makeElement();
    $wFn = make$w({
      '#stickyAtcBar':         els.bar,
      '#stickyAtcProductName': els.productName,
      '#stickyAtcPrice':       els.price,
      '#stickyAtcBtn':         els.btn,
      '#addToCartButton':      mainBtn,
    });
    state = makeState();
    addToCart = vi.fn(async () => {});
    scrollHandlers = [];
  });

  function makeOpts(boundsTop = 100) {
    return {
      addToCart,
      onScroll: (fn) => { scrollHandlers.push(fn); },
      getBoundingRect: vi.fn(async () => ({ top: boundsTop })),
    };
  }

  async function fireScroll(opts, boundsTop) {
    opts.getBoundingRect.mockResolvedValue({ top: boundsTop });
    for (const fn of scrollHandlers) await fn();
  }

  it('hides bar on init', () => {
    initStickyAtcBar($wFn, state, makeOpts());
    expect(els.bar.hide).toHaveBeenCalled();
  });

  it('syncs product name and price on init', () => {
    initStickyAtcBar($wFn, state, makeOpts());
    expect(els.productName.text).toBe('Futon Sofa');
    expect(els.price.text).toBe('$499.00');
  });

  it('shows bar when ATC button scrolls above viewport (top < 0)', async () => {
    const opts = makeOpts(100);
    initStickyAtcBar($wFn, state, opts);
    await fireScroll(opts, -10);
    expect(els.bar.show).toHaveBeenCalled();
  });

  it('does not show bar when ATC button is still in view (top >= 0)', async () => {
    const opts = makeOpts(100);
    initStickyAtcBar($wFn, state, opts);
    await fireScroll(opts, 50);
    expect(els.bar.show).not.toHaveBeenCalled();
  });

  it('hides bar when ATC button re-enters viewport (top >= 0 after being hidden)', async () => {
    const opts = makeOpts(100);
    initStickyAtcBar($wFn, state, opts);
    await fireScroll(opts, -10); // show
    await fireScroll(opts, 20);  // hide
    // bar.hide called on init + on scroll re-enter
    expect(els.bar.hide).toHaveBeenCalledTimes(2);
  });

  it('does not re-show bar while already visible (no flicker)', async () => {
    const opts = makeOpts(100);
    initStickyAtcBar($wFn, state, opts);
    await fireScroll(opts, -5);
    await fireScroll(opts, -20); // still out of view
    expect(els.bar.show).toHaveBeenCalledTimes(1);
  });

  it('hides bar when ATC button top is exactly 0 (at viewport edge)', async () => {
    const opts = makeOpts(100);
    initStickyAtcBar($wFn, state, opts);
    await fireScroll(opts, -5); // show
    await fireScroll(opts, 0);  // top === 0 satisfies >= 0 → hide
    expect(els.bar.hide).toHaveBeenCalledTimes(2);
  });

  it('does not re-hide bar while already hidden', async () => {
    const opts = makeOpts(100);
    initStickyAtcBar($wFn, state, opts);
    await fireScroll(opts, 10);
    await fireScroll(opts, 50); // still in view
    // Only the initial hide
    expect(els.bar.hide).toHaveBeenCalledTimes(1);
  });

  it('registers onClick on the sticky button', () => {
    initStickyAtcBar($wFn, state, makeOpts());
    expect(els.btn.onClick).toHaveBeenCalled();
  });

  it('sticky button click calls addToCart', async () => {
    const opts = makeOpts();
    initStickyAtcBar($wFn, state, opts);
    const clickHandler = els.btn.onClick.mock.calls[0][0];
    await clickHandler();
    expect(addToCart).toHaveBeenCalledWith('prod-001', 1);
  });

  it('sticky button click passes selectedQuantity > 1 through to addToCart', async () => {
    const opts = makeOpts();
    initStickyAtcBar($wFn, makeState({ selectedQuantity: 4 }), opts);
    const clickHandler = els.btn.onClick.mock.calls[0][0];
    await clickHandler();
    expect(addToCart).toHaveBeenCalledWith('prod-001', 4);
  });

  it('does not throw when getBoundingRect rejects', async () => {
    const opts = {
      addToCart,
      onScroll: (fn) => { scrollHandlers.push(fn); },
      getBoundingRect: vi.fn().mockRejectedValue(new Error('DOM unavailable')),
    };
    initStickyAtcBar($wFn, state, opts);
    await expect(Promise.all(scrollHandlers.map(fn => fn()))).resolves.not.toThrow();
  });

  it('disables sticky button when out of stock', () => {
    initStickyAtcBar($wFn, makeState({ isOutOfStock: true }), makeOpts());
    expect(els.btn.disable).toHaveBeenCalled();
  });

  it('does not throw when bar element is absent', () => {
    expect(() => initStickyAtcBar(make$w(), state, makeOpts())).not.toThrow();
  });

  it('does not throw when onScroll is absent', () => {
    expect(() => initStickyAtcBar($wFn, state, { addToCart })).not.toThrow();
  });

  it('does not throw when state.product is null', () => {
    expect(() => initStickyAtcBar($wFn, makeState({ product: null }), makeOpts())).not.toThrow();
  });

  afterEach(() => {
    vi.runAllTimers(); // flushes setTimeout so _busy resets between tests
    vi.useRealTimers();
  });
});
