/**
 * Tests for src/public/SwatchFilter.js
 * CF-wigv: Color/Fabric Swatch Filter — category page clientside grid filtering
 *
 * Coverage:
 *   getUniqueFabrics    — extracts sorted unique fabric values with counts
 *   filterProducts      — multi-select union filter (active OR logic)
 *   getActiveFilters    — reads persisted filter set from sessionStorage
 *   saveActiveFilters   — persists filter set to sessionStorage
 *   syncSwatchUI        — renders chip active states + clearFilterBtn visibility
 *   syncResultCount     — updates filterResultCount text
 *   initSwatchFilter    — populates repeater, wires clicks, restores session state
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getUniqueFabrics,
  filterProducts,
  getActiveFilters,
  saveActiveFilters,
  syncSwatchUI,
  syncResultCount,
  initSwatchFilter,
} from '../src/public/SwatchFilter.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text:    '',
    show:    vi.fn(),
    hide:    vi.fn(),
    onClick: vi.fn(),
    addCssClass:    vi.fn(),
    removeCssClass: vi.fn(),
    data: null,
    onItemReady: vi.fn(),
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

function make$w() {
  const els = new Map();
  const fn = (sel) => {
    if (!els.has(sel)) els.set(sel, makeEl());
    return els.get(sel);
  };
  fn._els = els;
  return fn;
}

// ── Product fixtures ──────────────────────────────────────────────────

const p1 = { _id: 'p1', name: 'Futon A', fabric: 'Chocolate' };
const p2 = { _id: 'p2', name: 'Futon B', fabric: 'Navy' };
const p3 = { _id: 'p3', name: 'Futon C', fabric: 'Chocolate' };
const p4 = { _id: 'p4', name: 'Futon D', fabric: 'Tan' };
const p5 = { _id: 'p5', name: 'Futon E', fabric: null };
const p6 = { _id: 'p6', name: 'Futon F' };

// ── getUniqueFabrics ──────────────────────────────────────────────────

describe('getUniqueFabrics', () => {
  it('returns unique fabrics with counts', () => {
    const fabrics = getUniqueFabrics([p1, p2, p3]);
    expect(fabrics).toHaveLength(2);
    const choc = fabrics.find(f => f._id === 'Chocolate');
    expect(choc).toBeDefined();
    expect(choc.count).toBe(2);
    const navy = fabrics.find(f => f._id === 'Navy');
    expect(navy.count).toBe(1);
  });

  it('each item has _id, label, and count', () => {
    const fabrics = getUniqueFabrics([p1]);
    expect(fabrics[0]).toHaveProperty('_id');
    expect(fabrics[0]).toHaveProperty('label');
    expect(fabrics[0]).toHaveProperty('count');
  });

  it('ignores products with null or missing fabric', () => {
    const fabrics = getUniqueFabrics([p1, p5, p6]);
    expect(fabrics.every(f => f._id)).toBe(true);
    expect(fabrics.some(f => !f._id)).toBe(false);
  });

  it('returns empty array for empty product list', () => {
    expect(getUniqueFabrics([])).toEqual([]);
  });

  it('sorts fabrics alphabetically by label', () => {
    const fabrics = getUniqueFabrics([p4, p2, p1]); // Tan, Navy, Chocolate
    const labels = fabrics.map(f => f.label);
    expect(labels).toEqual([...labels].sort());
  });

  it('returns single-item array for all same fabric', () => {
    const fabrics = getUniqueFabrics([p1, p3]);
    expect(fabrics).toHaveLength(1);
    expect(fabrics[0].count).toBe(2);
  });
});

// ── filterProducts ────────────────────────────────────────────────────

describe('filterProducts', () => {
  const all = [p1, p2, p3, p4, p5, p6];

  it('returns all products when activeFilters is empty', () => {
    expect(filterProducts(all, new Set())).toEqual(all);
  });

  it('filters to products matching single fabric', () => {
    const result = filterProducts(all, new Set(['Chocolate']));
    expect(result.map(p => p._id)).toEqual(['p1', 'p3']);
  });

  it('returns union for multi-select (OR logic)', () => {
    const result = filterProducts(all, new Set(['Chocolate', 'Tan']));
    expect(result.map(p => p._id)).toContain('p1');
    expect(result.map(p => p._id)).toContain('p3');
    expect(result.map(p => p._id)).toContain('p4');
    expect(result).toHaveLength(3);
  });

  it('returns empty array when no products match', () => {
    expect(filterProducts(all, new Set(['Magenta']))).toEqual([]);
  });

  it('products with null fabric are excluded when filter is active', () => {
    const result = filterProducts([p5, p6], new Set(['Chocolate']));
    expect(result).toEqual([]);
  });

  it('handles empty product list', () => {
    expect(filterProducts([], new Set(['Chocolate']))).toEqual([]);
  });
});

// ── getActiveFilters / saveActiveFilters ──────────────────────────────

describe('getActiveFilters', () => {
  it('returns empty Set when nothing stored', () => {
    const storage = makeStorage();
    const filters = getActiveFilters(storage);
    expect(filters).toBeInstanceOf(Set);
    expect(filters.size).toBe(0);
  });

  it('returns Set of stored filter values', () => {
    const storage = makeStorage({ 'cf_swatch_filter': JSON.stringify(['Chocolate', 'Navy']) });
    const filters = getActiveFilters(storage);
    expect(filters.has('Chocolate')).toBe(true);
    expect(filters.has('Navy')).toBe(true);
    expect(filters.size).toBe(2);
  });

  it('returns empty Set on parse error', () => {
    const storage = makeStorage({ 'cf_swatch_filter': 'not-json{' });
    expect(getActiveFilters(storage).size).toBe(0);
  });

  it('returns empty Set when storage is null', () => {
    expect(getActiveFilters(null).size).toBe(0);
  });

  it('returns empty Set when stored value is not an array', () => {
    const storage = makeStorage({ 'cf_swatch_filter': JSON.stringify({ foo: 'bar' }) });
    expect(getActiveFilters(storage).size).toBe(0);
  });
});

describe('saveActiveFilters', () => {
  it('persists filter Set to sessionStorage', () => {
    const storage = makeStorage();
    saveActiveFilters(storage, new Set(['Chocolate', 'Tan']));
    expect(storage.setItem).toHaveBeenCalledWith(
      'cf_swatch_filter',
      expect.stringContaining('Chocolate'),
    );
  });

  it('persists empty Set as empty array', () => {
    const storage = makeStorage();
    saveActiveFilters(storage, new Set());
    expect(storage.setItem).toHaveBeenCalledWith('cf_swatch_filter', '[]');
  });

  it('is no-op when storage is null', () => {
    expect(() => saveActiveFilters(null, new Set(['Chocolate']))).not.toThrow();
  });
});

// ── syncSwatchUI ──────────────────────────────────────────────────────

describe('syncSwatchUI', () => {
  it('hides clearFilterBtn when no active filters', () => {
    const $w = make$w();
    syncSwatchUI($w, new Set());
    expect($w('#clearFilterBtn').hide).toHaveBeenCalled();
  });

  it('shows clearFilterBtn when filters are active', () => {
    const $w = make$w();
    syncSwatchUI($w, new Set(['Chocolate']));
    expect($w('#clearFilterBtn').show).toHaveBeenCalled();
  });

  it('removes active CSS from chips not in activeFilters', () => {
    const $w = make$w();
    const chipEl = makeEl();
    const chipMap = new Map([['Chocolate', chipEl]]);
    syncSwatchUI($w, new Set(), chipMap);
    expect(chipEl.removeCssClass).toHaveBeenCalledWith('swatch-active');
  });

  it('adds active CSS for chips in activeFilters', () => {
    const $w = make$w();
    const chipEl = makeEl();
    const chipMap = new Map([['Chocolate', chipEl]]);
    syncSwatchUI($w, new Set(['Chocolate']), chipMap);
    expect(chipEl.addCssClass).toHaveBeenCalledWith('swatch-active');
  });

  it('does not throw when clearFilterBtn is absent', () => {
    const $w = (sel) => { if (sel === '#clearFilterBtn') throw new Error('not found'); return makeEl(); };
    expect(() => syncSwatchUI($w, new Set())).not.toThrow();
  });
});

// ── syncResultCount ───────────────────────────────────────────────────

describe('syncResultCount', () => {
  it('sets filterResultCount text to "Showing X of Y products"', () => {
    const $w = make$w();
    syncResultCount($w, 12, 88);
    expect($w('#filterResultCount').text).toBe('Showing 12 of 88 products');
  });

  it('shows filterResultCount element', () => {
    const $w = make$w();
    syncResultCount($w, 5, 20);
    expect($w('#filterResultCount').show).toHaveBeenCalled();
  });

  it('does not throw when filterResultCount is absent', () => {
    const $w = (sel) => { if (sel === '#filterResultCount') throw new Error('not found'); return makeEl(); };
    expect(() => syncResultCount($w, 5, 20)).not.toThrow();
  });
});

// ── initSwatchFilter ──────────────────────────────────────────────────

describe('initSwatchFilter', () => {
  let $w, storage, allProducts;

  beforeEach(() => {
    $w = make$w();
    storage = makeStorage();
    allProducts = [p1, p2, p3, p4]; // Chocolate×2, Navy×1, Tan×1
  });

  it('populates swatchFilterRepeater.data with unique fabrics', () => {
    initSwatchFilter($w, allProducts, { storage });
    const data = $w('#swatchFilterRepeater').data;
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3); // Chocolate, Navy, Tan
    expect(data.some(d => d._id === 'Chocolate')).toBe(true);
  });

  it('registers onItemReady on swatchFilterRepeater', () => {
    initSwatchFilter($w, allProducts, { storage });
    expect($w('#swatchFilterRepeater').onItemReady).toHaveBeenCalled();
  });

  it('wires clearFilterBtn.onClick', () => {
    initSwatchFilter($w, allProducts, { storage });
    expect($w('#clearFilterBtn').onClick).toHaveBeenCalled();
  });

  it('hides clearFilterBtn on init when no stored filters', () => {
    initSwatchFilter($w, allProducts, { storage });
    expect($w('#clearFilterBtn').hide).toHaveBeenCalled();
  });

  it('shows clearFilterBtn on init when stored filters exist', () => {
    const storedStorage = makeStorage({
      'cf_swatch_filter': JSON.stringify(['Chocolate']),
    });
    initSwatchFilter($w, allProducts, { storage: storedStorage });
    expect($w('#clearFilterBtn').show).toHaveBeenCalled();
  });

  it('sets productGridRepeater.data to all products when no stored filters', () => {
    initSwatchFilter($w, allProducts, { storage });
    expect($w('#productGridRepeater').data).toEqual(allProducts);
  });

  it('sets productGridRepeater.data to filtered products when stored filters exist', () => {
    const storedStorage = makeStorage({
      'cf_swatch_filter': JSON.stringify(['Chocolate']),
    });
    initSwatchFilter($w, allProducts, { storage: storedStorage });
    const data = $w('#productGridRepeater').data;
    expect(data.every(p => p.fabric === 'Chocolate')).toBe(true);
    expect(data).toHaveLength(2);
  });

  it('sets initial filterResultCount to "Showing X of Y products"', () => {
    initSwatchFilter($w, allProducts, { storage });
    expect($w('#filterResultCount').text).toBe('Showing 4 of 4 products');
  });

  it('does not throw when swatchFilterRepeater is absent', () => {
    // productGridRepeater must still be present so applyFilters can update it
    const brokenW = (sel) => {
      if (sel === '#swatchFilterRepeater') throw new Error('absent');
      return makeEl();
    };
    expect(() => initSwatchFilter(brokenW, allProducts, { storage: makeStorage() })).not.toThrow();
  });

  it('still sets productGridRepeater.data when swatchFilterRepeater is absent', () => {
    const els = new Map();
    const brokenW = (sel) => {
      if (sel === '#swatchFilterRepeater') throw new Error('absent');
      if (!els.has(sel)) els.set(sel, makeEl());
      return els.get(sel);
    };
    initSwatchFilter(brokenW, allProducts, { storage: makeStorage() });
    expect(els.get('#productGridRepeater').data).toEqual(allProducts);
  });

  it('handles empty allProducts gracefully', () => {
    expect(() => initSwatchFilter($w, [], { storage })).not.toThrow();
    expect($w('#swatchFilterRepeater').data).toEqual([]);
  });

  // ── chip click (via onItemReady simulation) ─────────────────────────

  it('onItemReady sets swatchLabel text and swatchCount text', () => {
    initSwatchFilter($w, allProducts, { storage });
    const onItemReadyCb = $w('#swatchFilterRepeater').onItemReady.mock.calls[0][0];

    const $item = make$w();
    onItemReadyCb($item, { _id: 'Chocolate', label: 'Chocolate', count: 2 }, 0);

    expect($item('#swatchLabel').text).toBe('Chocolate');
    expect($item('#swatchCount').text).toBe('(2)');
  });

  it('chip click toggles fabric ON and filters grid', () => {
    initSwatchFilter($w, allProducts, { storage });

    const onItemReadyCallback = $w('#swatchFilterRepeater').onItemReady.mock.calls[0][0];
    const $item = make$w();
    const chipEl = makeEl();
    $item['#swatchChip'] = chipEl;
    $item._els = new Map([['#swatchChip', chipEl]]);
    const itemData = { _id: 'Chocolate', label: 'Chocolate', count: 2 };

    // Simulate onItemReady firing for this chip
    onItemReadyCallback($item, itemData, 0);

    // Capture the click handler registered on swatchChip
    const clickHandler = $item('#swatchChip').onClick.mock.calls[0][0];
    clickHandler(); // click: Chocolate ON

    expect($w('#productGridRepeater').data.every(p => p.fabric === 'Chocolate')).toBe(true);
  });

  it('chip click toggles fabric OFF and restores broader result', () => {
    const storedStorage = makeStorage({
      'cf_swatch_filter': JSON.stringify(['Chocolate']),
    });
    initSwatchFilter($w, allProducts, { storage: storedStorage });

    const onItemReadyCb = $w('#swatchFilterRepeater').onItemReady.mock.calls[0][0];
    const $item = make$w();
    const chipEl = makeEl();
    $item['#swatchChip'] = chipEl;
    $item._els = new Map([['#swatchChip', chipEl]]);
    const itemData = { _id: 'Chocolate', label: 'Chocolate', count: 2 };

    onItemReadyCb($item, itemData, 0);
    const clickHandler = $item('#swatchChip').onClick.mock.calls[0][0];
    clickHandler(); // click: Chocolate OFF

    // productGridRepeater should now show all 4 products
    expect($w('#productGridRepeater').data).toHaveLength(4);
  });

  it('chip click persists active filters to sessionStorage', () => {
    initSwatchFilter($w, allProducts, { storage });

    const onItemReadyCb = $w('#swatchFilterRepeater').onItemReady.mock.calls[0][0];
    const $item = make$w();
    $item._els = new Map([['#swatchChip', makeEl()]]);
    onItemReadyCb($item, { _id: 'Navy', label: 'Navy', count: 1 }, 0);
    const clickHandler = $item('#swatchChip').onClick.mock.calls[0][0];
    clickHandler();

    expect(storage.setItem).toHaveBeenCalledWith(
      'cf_swatch_filter',
      expect.stringContaining('Navy'),
    );
  });

  it('clearFilterBtn click resets all filters and shows all products', () => {
    const storedStorage = makeStorage({
      'cf_swatch_filter': JSON.stringify(['Chocolate']),
    });
    initSwatchFilter($w, allProducts, { storage: storedStorage });

    const clearHandler = $w('#clearFilterBtn').onClick.mock.calls[0][0];
    clearHandler();

    expect($w('#productGridRepeater').data).toEqual(allProducts);
    expect($w('#filterResultCount').text).toBe('Showing 4 of 4 products');
  });

  it('clearFilterBtn click removes swatch-active CSS from all chips', () => {
    const storedStorage = makeStorage({
      'cf_swatch_filter': JSON.stringify(['Chocolate']),
    });
    initSwatchFilter($w, allProducts, { storage: storedStorage });

    // Register a chip so it's in chipMap
    const onItemReadyCb = $w('#swatchFilterRepeater').onItemReady.mock.calls[0][0];
    const chipEl = makeEl();
    const $item = make$w();
    $item._els.set('#swatchChip', chipEl);
    onItemReadyCb($item, { _id: 'Chocolate', label: 'Chocolate', count: 2 }, 0);
    chipEl.removeCssClass.mockClear(); // ignore the initial render call

    const clearHandler = $w('#clearFilterBtn').onClick.mock.calls[0][0];
    clearHandler();

    expect(chipEl.removeCssClass).toHaveBeenCalledWith('swatch-active');
  });

  it('clearFilterBtn click hides clearFilterBtn after reset', () => {
    const storedStorage = makeStorage({
      'cf_swatch_filter': JSON.stringify(['Chocolate']),
    });
    initSwatchFilter($w, allProducts, { storage: storedStorage });

    const clearHandler = $w('#clearFilterBtn').onClick.mock.calls[0][0];
    clearHandler();

    expect($w('#clearFilterBtn').hide).toHaveBeenCalled();
  });

  it('clearFilterBtn click persists empty filters to sessionStorage', () => {
    const storedStorage = makeStorage({
      'cf_swatch_filter': JSON.stringify(['Chocolate']),
    });
    initSwatchFilter($w, allProducts, { storage: storedStorage });

    const clearHandler = $w('#clearFilterBtn').onClick.mock.calls[0][0];
    clearHandler();

    expect(storedStorage.setItem).toHaveBeenCalledWith('cf_swatch_filter', '[]');
  });

  it('multi-select: clicking two chips shows union', () => {
    initSwatchFilter($w, allProducts, { storage });
    const onItemReadyCb = $w('#swatchFilterRepeater').onItemReady.mock.calls[0][0];

    // Helper to fire a chip click for a given fabric
    function clickChip(fabric) {
      const $item = make$w();
      $item._els = new Map([['#swatchChip', makeEl()]]);
      onItemReadyCb($item, { _id: fabric, label: fabric, count: 1 }, 0);
      $item('#swatchChip').onClick.mock.calls[0][0]();
    }

    clickChip('Chocolate'); // adds Chocolate
    clickChip('Tan');       // adds Tan

    const result = $w('#productGridRepeater').data;
    expect(result.map(p => p._id)).toContain('p1'); // Chocolate
    expect(result.map(p => p._id)).toContain('p3'); // Chocolate
    expect(result.map(p => p._id)).toContain('p4'); // Tan
    expect(result).toHaveLength(3);
  });

  it('empty state: filterResultCount shows "Showing 0 of Y products"', () => {
    initSwatchFilter($w, allProducts, { storage });
    const onItemReadyCb = $w('#swatchFilterRepeater').onItemReady.mock.calls[0][0];
    const $item = make$w();
    $item._els = new Map([['#swatchChip', makeEl()]]);
    onItemReadyCb($item, { _id: 'Magenta', label: 'Magenta', count: 0 }, 0);
    $item('#swatchChip').onClick.mock.calls[0][0]();

    expect($w('#filterResultCount').text).toBe('Showing 0 of 4 products');
  });

  it('does not throw when allProducts is not an array', () => {
    expect(() => initSwatchFilter($w, null, { storage })).not.toThrow();
    expect(() => initSwatchFilter($w, undefined, { storage })).not.toThrow();
  });
});

// ── Additional edge cases ─────────────────────────────────────────────

describe('getUniqueFabrics — empty string fabric', () => {
  it('excludes products with empty-string fabric', () => {
    const withEmpty = { _id: 'pe', name: 'Futon E', fabric: '' };
    const fabrics = getUniqueFabrics([p1, withEmpty]);
    expect(fabrics.every(f => f._id !== '')).toBe(true);
    expect(fabrics).toHaveLength(1);
  });
});

describe('filterProducts — order preservation', () => {
  it('preserves original array order in filtered results', () => {
    const result = filterProducts([p3, p1], new Set(['Chocolate']));
    expect(result[0]._id).toBe('p3');
    expect(result[1]._id).toBe('p1');
  });
});

describe('saveActiveFilters — quota exceeded', () => {
  it('does not throw when setItem throws QuotaExceededError', () => {
    const quotaStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        const err = new DOMException('QuotaExceededError', 'QuotaExceededError');
        throw err;
      }),
    };
    expect(() => saveActiveFilters(quotaStorage, new Set(['Chocolate']))).not.toThrow();
  });

  it('does not throw when setItem throws unexpected error', () => {
    const brokenStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => { throw new Error('unexpected'); }),
    };
    expect(() => saveActiveFilters(brokenStorage, new Set(['Chocolate']))).not.toThrow();
  });
});
