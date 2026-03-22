/**
 * Tests for src/public/ComparisonTray.js
 * CF-r0dr: Product Comparison Tray — floating bottom bar, up to 3 products
 *
 * Coverage:
 *   getTrayState         — returns current comparison state from sessionStorage
 *   addToCompareTray     — adds product, prevents duplicates, enforces max-3
 *   removeFromTray       — removes product by id, updates tray UI
 *   clearTray            — empties tray, hides bar
 *   syncTrayUI           — renders slots, count badge, button states
 *   initComparisonTray   — wires buttons + syncs UI on load
 *   navigateToCompare    — navigates to /compare with product IDs
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTrayState,
  addToCompareTray,
  removeFromTray,
  clearTray,
  syncTrayUI,
  initComparisonTray,
} from '../src/public/ComparisonTray.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeElement(overrides = {}) {
  return {
    text:    '',
    label:   '',
    src:     '',
    show:    vi.fn(),
    hide:    vi.fn(),
    enable:  vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    ...overrides,
  };
}

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem:    vi.fn(k => store[k] ?? null),
    setItem:    vi.fn((k, v) => { store[k] = v; }),
    removeItem: vi.fn(k => { delete store[k]; }),
    _store:     store,
  };
}

function makeProduct(overrides = {}) {
  return {
    _id:            'prod-001',
    name:           'Classic Futon',
    mainMedia:      'https://img.example.com/classic.jpg',
    formattedPrice: '$299.00',
    ...overrides,
  };
}

function makeElements() {
  return {
    tray:         makeElement(),
    slot1:        makeElement(), slot2:        makeElement(), slot3:        makeElement(),
    img1:         makeElement(), img2:         makeElement(), img3:         makeElement(),
    name1:        makeElement(), name2:        makeElement(), name3:        makeElement(),
    remove1:      makeElement(), remove2:      makeElement(), remove3:      makeElement(),
    compareBtn:   makeElement(),
    clearBtn:     makeElement(),
    countBadge:   makeElement(),
  };
}

function make$w(els) {
  const map = {
    '#comparisonTray':         els.tray,
    '#comparisonSlot1':        els.slot1,
    '#comparisonSlot2':        els.slot2,
    '#comparisonSlot3':        els.slot3,
    '#comparisonSlotImage1':   els.img1,
    '#comparisonSlotImage2':   els.img2,
    '#comparisonSlotImage3':   els.img3,
    '#comparisonSlotName1':    els.name1,
    '#comparisonSlotName2':    els.name2,
    '#comparisonSlotName3':    els.name3,
    '#comparisonSlotRemove1':  els.remove1,
    '#comparisonSlotRemove2':  els.remove2,
    '#comparisonSlotRemove3':  els.remove3,
    '#compareNowBtn':          els.compareBtn,
    '#clearComparisonBtn':     els.clearBtn,
    '#comparisonCount':        els.countBadge,
  };
  return (sel) => map[sel] ?? null;
}

const STORAGE_KEY = 'cf_comparison_tray';

function encodeState(products) {
  return JSON.stringify(products);
}

// ═══════════════════════════════════════════════════════════════════════
// 1. getTrayState
// ═══════════════════════════════════════════════════════════════════════

describe('getTrayState', () => {
  it('returns empty array when storage is empty', () => {
    const storage = makeStorage();
    expect(getTrayState(storage)).toEqual([]);
  });

  it('returns parsed products from storage', () => {
    const products = [makeProduct()];
    const storage = makeStorage({ [STORAGE_KEY]: encodeState(products) });
    expect(getTrayState(storage)).toEqual(products);
  });

  it('returns empty array when storage value is invalid JSON', () => {
    const storage = makeStorage({ [STORAGE_KEY]: 'not-json' });
    expect(getTrayState(storage)).toEqual([]);
  });

  it('returns empty array when storage is null', () => {
    expect(getTrayState(null)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. addToCompareTray
// ═══════════════════════════════════════════════════════════════════════

describe('addToCompareTray', () => {
  it('adds a product to an empty tray', () => {
    const storage = makeStorage();
    const els = makeElements();
    addToCompareTray(make$w(els), makeProduct(), storage);
    const state = getTrayState(storage);
    expect(state).toHaveLength(1);
    expect(state[0]._id).toBe('prod-001');
  });

  it('shows the tray when the first product is added', () => {
    const storage = makeStorage();
    const els = makeElements();
    addToCompareTray(make$w(els), makeProduct(), storage);
    expect(els.tray.show).toHaveBeenCalled();
  });

  it('removes product if already in tray (toggle behavior)', () => {
    const storage = makeStorage();
    const els = makeElements();
    addToCompareTray(make$w(els), makeProduct(), storage);
    addToCompareTray(make$w(els), makeProduct(), storage);
    expect(getTrayState(storage)).toHaveLength(0);
  });

  it('hides tray after toggle-remove empties it', () => {
    const storage = makeStorage();
    const els = makeElements();
    addToCompareTray(make$w(els), makeProduct(), storage);
    els.tray.hide.mockClear();
    addToCompareTray(make$w(els), makeProduct(), storage);
    expect(els.tray.hide).toHaveBeenCalled();
  });

  it('enforces max 3 products — rejects a 4th', () => {
    const storage = makeStorage();
    const els = makeElements();
    addToCompareTray(make$w(els), makeProduct({ _id: 'p1' }), storage);
    addToCompareTray(make$w(els), makeProduct({ _id: 'p2' }), storage);
    addToCompareTray(make$w(els), makeProduct({ _id: 'p3' }), storage);
    addToCompareTray(make$w(els), makeProduct({ _id: 'p4' }), storage);
    expect(getTrayState(storage)).toHaveLength(3);
  });

  it('enables compareNowBtn when 2+ products are in tray', () => {
    const storage = makeStorage();
    const els = makeElements();
    addToCompareTray(make$w(els), makeProduct({ _id: 'p1' }), storage);
    addToCompareTray(make$w(els), makeProduct({ _id: 'p2' }), storage);
    expect(els.compareBtn.enable).toHaveBeenCalled();
  });

  it('disables compareNowBtn when fewer than 2 products', () => {
    const storage = makeStorage();
    const els = makeElements();
    addToCompareTray(make$w(els), makeProduct(), storage);
    expect(els.compareBtn.disable).toHaveBeenCalled();
  });

  it('does not throw when storage is null', () => {
    const els = makeElements();
    expect(() => addToCompareTray(make$w(els), makeProduct(), null)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. removeFromTray
// ═══════════════════════════════════════════════════════════════════════

describe('removeFromTray', () => {
  it('removes a product by id', () => {
    const products = [makeProduct({ _id: 'p1' }), makeProduct({ _id: 'p2' })];
    const storage = makeStorage({ [STORAGE_KEY]: encodeState(products) });
    const els = makeElements();
    removeFromTray(make$w(els), 'p1', storage);
    const state = getTrayState(storage);
    expect(state).toHaveLength(1);
    expect(state[0]._id).toBe('p2');
  });

  it('hides tray when last product is removed', () => {
    const storage = makeStorage({ [STORAGE_KEY]: encodeState([makeProduct()]) });
    const els = makeElements();
    removeFromTray(make$w(els), 'prod-001', storage);
    expect(els.tray.hide).toHaveBeenCalled();
  });

  it('does not throw when id is not in tray', () => {
    const storage = makeStorage();
    const els = makeElements();
    expect(() => removeFromTray(make$w(els), 'nonexistent', storage)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. clearTray
// ═══════════════════════════════════════════════════════════════════════

describe('clearTray', () => {
  it('empties the tray', () => {
    const products = [makeProduct({ _id: 'p1' }), makeProduct({ _id: 'p2' })];
    const storage = makeStorage({ [STORAGE_KEY]: encodeState(products) });
    const els = makeElements();
    clearTray(make$w(els), storage);
    expect(getTrayState(storage)).toEqual([]);
  });

  it('hides the tray', () => {
    const storage = makeStorage({ [STORAGE_KEY]: encodeState([makeProduct()]) });
    const els = makeElements();
    clearTray(make$w(els), storage);
    expect(els.tray.hide).toHaveBeenCalled();
  });

  it('does not throw when storage is null', () => {
    const els = makeElements();
    expect(() => clearTray(make$w(els), null)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. syncTrayUI
// ═══════════════════════════════════════════════════════════════════════

describe('syncTrayUI', () => {
  it('populates slot 1 with first product name and image', () => {
    const products = [makeProduct({ name: 'Classic Futon', mainMedia: 'https://img.example.com/a.jpg' })];
    const els = makeElements();
    syncTrayUI(make$w(els), products);
    expect(els.name1.text).toBe('Classic Futon');
    expect(els.img1.src).toBe('https://img.example.com/a.jpg');
  });

  it('shows populated slots, hides empty slots', () => {
    const products = [makeProduct({ _id: 'p1' }), makeProduct({ _id: 'p2' })];
    const els = makeElements();
    syncTrayUI(make$w(els), products);
    expect(els.slot1.show).toHaveBeenCalled();
    expect(els.slot2.show).toHaveBeenCalled();
    expect(els.slot3.hide).toHaveBeenCalled();
  });

  it('sets count badge text', () => {
    const products = [makeProduct({ _id: 'p1' }), makeProduct({ _id: 'p2' })];
    const els = makeElements();
    syncTrayUI(make$w(els), products);
    expect(els.countBadge.text).toBe('2 products');
  });

  it('sets count badge to "1 product" (singular)', () => {
    const els = makeElements();
    syncTrayUI(make$w(els), [makeProduct()]);
    expect(els.countBadge.text).toBe('1 product');
  });

  it('enables compareNowBtn when 2+ products', () => {
    const products = [makeProduct({ _id: 'p1' }), makeProduct({ _id: 'p2' })];
    const els = makeElements();
    syncTrayUI(make$w(els), products);
    expect(els.compareBtn.enable).toHaveBeenCalled();
    expect(els.compareBtn.disable).not.toHaveBeenCalled();
  });

  it('disables compareNowBtn when fewer than 2 products', () => {
    const els = makeElements();
    syncTrayUI(make$w(els), [makeProduct()]);
    expect(els.compareBtn.disable).toHaveBeenCalled();
    expect(els.compareBtn.enable).not.toHaveBeenCalled();
  });

  it('does not throw when elements are absent', () => {
    expect(() => syncTrayUI(() => null, [makeProduct()])).not.toThrow();
  });

  it('does not throw when products is empty', () => {
    const els = makeElements();
    expect(() => syncTrayUI(make$w(els), [])).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. initComparisonTray — integration
// ═══════════════════════════════════════════════════════════════════════

describe('initComparisonTray', () => {
  let els, $wFn, storage, navigate;

  beforeEach(() => {
    els     = makeElements();
    $wFn    = make$w(els);
    storage = makeStorage();
    navigate = vi.fn();
  });

  it('hides tray on init when storage is empty', () => {
    initComparisonTray($wFn, { storage, navigate });
    expect(els.tray.hide).toHaveBeenCalled();
  });

  it('shows tray on init when products already in storage', () => {
    const products = [makeProduct()];
    storage = makeStorage({ [STORAGE_KEY]: encodeState(products) });
    initComparisonTray(make$w(els), { storage, navigate });
    expect(els.tray.show).toHaveBeenCalled();
  });

  it('wires clearComparisonBtn onClick', () => {
    initComparisonTray($wFn, { storage, navigate });
    expect(els.clearBtn.onClick).toHaveBeenCalled();
  });

  it('wires compareNowBtn onClick', () => {
    initComparisonTray($wFn, { storage, navigate });
    expect(els.compareBtn.onClick).toHaveBeenCalled();
  });

  it('wires remove buttons for all 3 slots', () => {
    initComparisonTray($wFn, { storage, navigate });
    expect(els.remove1.onClick).toHaveBeenCalled();
    expect(els.remove2.onClick).toHaveBeenCalled();
    expect(els.remove3.onClick).toHaveBeenCalled();
  });

  it('clearBtn click empties tray and hides it', () => {
    storage = makeStorage({ [STORAGE_KEY]: encodeState([makeProduct()]) });
    initComparisonTray(make$w(els), { storage, navigate });
    const clearHandler = els.clearBtn.onClick.mock.calls[0][0];
    clearHandler();
    expect(getTrayState(storage)).toEqual([]);
    expect(els.tray.hide).toHaveBeenCalled();
  });

  it('compareNowBtn click navigates to /compare with product IDs', () => {
    const products = [makeProduct({ _id: 'p1' }), makeProduct({ _id: 'p2' })];
    storage = makeStorage({ [STORAGE_KEY]: encodeState(products) });
    initComparisonTray(make$w(els), { storage, navigate });
    const compareHandler = els.compareBtn.onClick.mock.calls[0][0];
    compareHandler();
    expect(navigate).toHaveBeenCalledWith('/compare?ids=p1,p2');
  });

  it('remove1 click removes first product from tray', () => {
    const products = [makeProduct({ _id: 'p1' }), makeProduct({ _id: 'p2' })];
    storage = makeStorage({ [STORAGE_KEY]: encodeState(products) });
    initComparisonTray(make$w(els), { storage, navigate });
    const removeHandler = els.remove1.onClick.mock.calls[0][0];
    removeHandler();
    const state = getTrayState(storage);
    expect(state.some(p => p._id === 'p1')).toBe(false);
  });

  it('disables compareNowBtn on init when fewer than 2 products', () => {
    initComparisonTray($wFn, { storage, navigate });
    expect(els.compareBtn.disable).toHaveBeenCalled();
  });

  it('does not throw when elements are absent', () => {
    expect(() => initComparisonTray(() => null, { storage, navigate })).not.toThrow();
  });

  it('does not throw when storage is null', () => {
    expect(() => initComparisonTray($wFn, { storage: null, navigate })).not.toThrow();
  });
});
