/**
 * Tests for src/public/SearchResultsFilter.js
 * CF-sg0e: SearchResultsFilter — quick-filter chips on Search Results page
 *
 * Coverage:
 *   getCategoriesFromResults  — extracts unique categories from result items
 *   sortResults               — client-side re-sort (price-asc, price-desc, relevance)
 *   filterByCategories        — OR-logic category filter
 *   initSearchFilter          — wires chip repeaters, result count, clear button, sessionStorage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  getCategoriesFromResults,
  sortResults,
  filterByCategories,
  initSearchFilter,
} from '../../src/public/SearchResultsFilter.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    expand: vi.fn().mockResolvedValue(undefined),
    collapse: vi.fn().mockResolvedValue(undefined),
    addCssClass: vi.fn(),
    removeCssClass: vi.fn(),
    onClick: vi.fn(),
    ...overrides,
  };
}

function makeItemEl() {
  const els = {};
  const $item = vi.fn(sel => {
    if (!els[sel]) els[sel] = makeEl();
    return els[sel];
  });
  $item.__els = els;
  return $item;
}

function makeRepeater() {
  const state = { cb: null, items: [], _data: [] };
  const repeater = {
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    expand: vi.fn().mockResolvedValue(undefined),
    collapse: vi.fn().mockResolvedValue(undefined),
    onItemReady: vi.fn(cb => { state.cb = cb; }),
    forEachItem: vi.fn(cb => {
      state.items.forEach(({ $item, itemData }) => cb($item, itemData));
    }),
    get data() { return state._data; },
    set data(v) {
      state._data = v;
      state.items = [];
      if (state.cb) {
        v.forEach(itemData => {
          const $item = makeItemEl();
          state.items.push({ $item, itemData });
          state.cb($item, itemData);
        });
      }
    },
    __state: state,
  };
  return repeater;
}

// Base product fixtures
const PRODUCTS = [
  { _id: 'p1', name: 'Futon Frame Oak',  price: 199, collections: ['Futon Frames'] },
  { _id: 'p2', name: 'Futon Mattress',   price: 99,  collections: ['Mattresses'] },
  { _id: 'p3', name: 'Murphy Bed',       price: 499, collections: ['Murphy Beds'] },
  { _id: 'p4', name: 'Platform Bed',     price: 349, collections: ['Platform Beds'] },
  { _id: 'p5', name: 'Futon Frame Pine', price: 149, collections: ['Futon Frames'] },
];

function makeWixEnv(overrides = {}) {
  const searchRepeater = makeRepeater();
  const sortRepeater   = makeRepeater();
  const catRepeater    = makeRepeater();
  const els = {
    '#searchRepeater':        searchRepeater,
    '#sortChipsRepeater':     sortRepeater,
    '#categoryChipsRepeater': catRepeater,
    '#filterResultCount':     makeEl(),
    '#clearFiltersBtn':       makeEl(),
    ...overrides,
  };
  const $w = vi.fn(sel => els[sel] || null);
  $w.__els = els;
  return $w;
}

function clickChip($repeater, itemIndex) {
  const { $item } = $repeater.__state.items[itemIndex];
  const handler = $item('#filterChip').onClick.mock.calls[0][0];
  handler();
}

beforeEach(() => {
  if (globalThis.sessionStorage?.clear) globalThis.sessionStorage.clear();
});

// ── getCategoriesFromResults ──────────────────────────────────────────────

describe('getCategoriesFromResults', () => {
  it('extracts unique categories from collections arrays', () => {
    const cats = getCategoriesFromResults(PRODUCTS);
    expect(cats).toContain('Futon Frames');
    expect(cats).toContain('Mattresses');
    expect(cats).toContain('Murphy Beds');
    expect(cats).toContain('Platform Beds');
  });

  it('deduplicates — Futon Frames appears once even with two products', () => {
    const cats = getCategoriesFromResults(PRODUCTS);
    expect(cats.filter(c => c === 'Futon Frames')).toHaveLength(1);
  });

  it('includes productType when present', () => {
    const results = [{ _id: 'x', price: 100, collections: [], productType: 'Accessories' }];
    expect(getCategoriesFromResults(results)).toContain('Accessories');
  });

  it('returns empty array for results with no collections or productType', () => {
    expect(getCategoriesFromResults([{ _id: 'x', price: 0, collections: [] }])).toEqual([]);
  });
});

// ── sortResults ───────────────────────────────────────────────────────────

describe('sortResults', () => {
  it('price-asc sorts lowest price first', () => {
    const sorted = sortResults(PRODUCTS, 'price-asc');
    expect(sorted[0].price).toBe(99);
    expect(sorted[sorted.length - 1].price).toBe(499);
  });

  it('price-desc sorts highest price first', () => {
    const sorted = sortResults(PRODUCTS, 'price-desc');
    expect(sorted[0].price).toBe(499);
    expect(sorted[sorted.length - 1].price).toBe(99);
  });

  it('relevance preserves original array order', () => {
    const sorted = sortResults(PRODUCTS, 'relevance');
    expect(sorted.map(p => p._id)).toEqual(PRODUCTS.map(p => p._id));
  });

  it('does not mutate the original array', () => {
    const original = [...PRODUCTS];
    sortResults(PRODUCTS, 'price-asc');
    expect(PRODUCTS.map(p => p._id)).toEqual(original.map(p => p._id));
  });
});

// ── filterByCategories ────────────────────────────────────────────────────

describe('filterByCategories', () => {
  it('returns all results when no categories active', () => {
    expect(filterByCategories(PRODUCTS, new Set())).toHaveLength(PRODUCTS.length);
  });

  it('filters to matching category', () => {
    const filtered = filterByCategories(PRODUCTS, new Set(['Futon Frames']));
    expect(filtered.every(p => p.collections.includes('Futon Frames'))).toBe(true);
    expect(filtered).toHaveLength(2);
  });

  it('multi-select: OR logic — union of two categories', () => {
    const filtered = filterByCategories(PRODUCTS, new Set(['Futon Frames', 'Murphy Beds']));
    expect(filtered).toHaveLength(3); // p1, p5 (Futon Frames) + p3 (Murphy Beds)
  });
});

// ── initSearchFilter ──────────────────────────────────────────────────────

describe('initSearchFilter', () => {
  // ── initialization ────────────────────────────────────────────────────

  it('populates sortChipsRepeater with 3 sort options', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    expect($w.__els['#sortChipsRepeater'].data).toHaveLength(3);
  });

  it('sort option labels include Relevance, Price Low→High, Price High→Low', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const labels = $w.__els['#sortChipsRepeater'].data.map(d => d.label);
    expect(labels).toContain('Relevance');
    expect(labels).toContain('Price Low→High');
    expect(labels).toContain('Price High→Low');
  });

  it('populates categoryChipsRepeater with unique categories from results', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const catValues = $w.__els['#categoryChipsRepeater'].data.map(d => d.value);
    expect(catValues).toContain('Futon Frames');
    expect(catValues).toContain('Murphy Beds');
  });

  it('sets filterResultCount to total result count on init', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    expect($w.__els['#filterResultCount'].text).toContain('5');
  });

  it('hides clearFiltersBtn on init (no active filters)', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    expect($w.__els['#clearFiltersBtn'].hide).toHaveBeenCalled();
  });

  it('collapses categoryChipsRepeater when only 1 category in results', () => {
    const singleCat = [
      { _id: 'a', price: 100, collections: ['Futon Frames'] },
      { _id: 'b', price: 200, collections: ['Futon Frames'] },
    ];
    const $w = makeWixEnv();
    initSearchFilter($w, singleCat);
    expect($w.__els['#categoryChipsRepeater'].collapse).toHaveBeenCalled();
  });

  // ── sort chip interaction ─────────────────────────────────────────────

  it('sort price-asc chip click re-orders searchRepeater.data by price ascending', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    // Find the price-asc chip item and click it
    const sortRepeater = $w.__els['#sortChipsRepeater'];
    const priceAscIdx = sortRepeater.data.findIndex(d => d.value === 'price-asc');
    clickChip(sortRepeater, priceAscIdx);
    const ids = $w.__els['#searchRepeater'].data.map(p => p._id);
    // p2 (99) should be first, p3 (499) should be last
    expect(ids[0]).toBe('p2');
    expect(ids[ids.length - 1]).toBe('p3');
  });

  it('sort price-desc chip click re-orders searchRepeater.data by price descending', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const sortRepeater = $w.__els['#sortChipsRepeater'];
    const priceDescIdx = sortRepeater.data.findIndex(d => d.value === 'price-desc');
    clickChip(sortRepeater, priceDescIdx);
    const ids = $w.__els['#searchRepeater'].data.map(p => p._id);
    expect(ids[0]).toBe('p3'); // 499
    expect(ids[ids.length - 1]).toBe('p2'); // 99
  });

  it('filterResultCount updates after sort action', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const sortRepeater = $w.__els['#sortChipsRepeater'];
    const priceAscIdx = sortRepeater.data.findIndex(d => d.value === 'price-asc');
    clickChip(sortRepeater, priceAscIdx);
    expect($w.__els['#filterResultCount'].text).toContain('5');
  });

  it('clearFiltersBtn shown after non-relevance sort applied', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const sortRepeater = $w.__els['#sortChipsRepeater'];
    const priceAscIdx = sortRepeater.data.findIndex(d => d.value === 'price-asc');
    clickChip(sortRepeater, priceAscIdx);
    expect($w.__els['#clearFiltersBtn'].show).toHaveBeenCalled();
  });

  // ── category chip interaction ─────────────────────────────────────────

  it('category chip click filters searchRepeater.data to matching category', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const catRepeater = $w.__els['#categoryChipsRepeater'];
    const futonIdx = catRepeater.data.findIndex(d => d.value === 'Futon Frames');
    clickChip(catRepeater, futonIdx);
    const filtered = $w.__els['#searchRepeater'].data;
    expect(filtered.every(p => p.collections.includes('Futon Frames'))).toBe(true);
    expect(filtered).toHaveLength(2);
  });

  it('filterResultCount updates after category filter applied', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const catRepeater = $w.__els['#categoryChipsRepeater'];
    const futonIdx = catRepeater.data.findIndex(d => d.value === 'Futon Frames');
    clickChip(catRepeater, futonIdx);
    expect($w.__els['#filterResultCount'].text).toContain('2');
  });

  it('multi-select: two category chips active → union of both shown', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const catRepeater = $w.__els['#categoryChipsRepeater'];

    // Click Futon Frames
    const futonIdx = catRepeater.data.findIndex(d => d.value === 'Futon Frames');
    clickChip(catRepeater, futonIdx);

    // After first click, catRepeater.data is refreshed — get latest items
    const murphyIdx = catRepeater.data.findIndex(d => d.value === 'Murphy Beds');
    clickChip(catRepeater, murphyIdx);

    const filtered = $w.__els['#searchRepeater'].data;
    expect(filtered).toHaveLength(3); // 2 Futon Frames + 1 Murphy Bed
  });

  it('clicking same category chip twice toggles it off', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const catRepeater = $w.__els['#categoryChipsRepeater'];
    const futonIdx = catRepeater.data.findIndex(d => d.value === 'Futon Frames');

    clickChip(catRepeater, futonIdx); // on
    clickChip(catRepeater, catRepeater.data.findIndex(d => d.value === 'Futon Frames')); // off

    expect($w.__els['#searchRepeater'].data).toHaveLength(PRODUCTS.length);
  });

  // ── clear button ──────────────────────────────────────────────────────

  it('clearFiltersBtn click resets sort and category filters', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);

    // Apply a sort filter
    const sortRepeater = $w.__els['#sortChipsRepeater'];
    const priceAscIdx = sortRepeater.data.findIndex(d => d.value === 'price-asc');
    clickChip(sortRepeater, priceAscIdx);

    // Click clear
    const clearHandler = $w.__els['#clearFiltersBtn'].onClick.mock.calls[0][0];
    clearHandler();

    // searchRepeater.data should be all results in original order
    expect($w.__els['#searchRepeater'].data).toHaveLength(PRODUCTS.length);
    expect($w.__els['#searchRepeater'].data[0]._id).toBe(PRODUCTS[0]._id);
  });

  it('clearFiltersBtn hides itself after clearing', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const sortRepeater = $w.__els['#sortChipsRepeater'];
    clickChip(sortRepeater, sortRepeater.data.findIndex(d => d.value === 'price-asc'));

    const clearHandler = $w.__els['#clearFiltersBtn'].onClick.mock.calls[0][0];
    clearHandler();

    const hideCalls = $w.__els['#clearFiltersBtn'].hide.mock.calls.length;
    expect(hideCalls).toBeGreaterThanOrEqual(1);
  });

  // ── sessionStorage persistence ────────────────────────────────────────

  it('saves filter state to sessionStorage after sort change', () => {
    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);
    const sortRepeater = $w.__els['#sortChipsRepeater'];
    clickChip(sortRepeater, sortRepeater.data.findIndex(d => d.value === 'price-asc'));

    const saved = JSON.parse(sessionStorage.getItem('cf_searchFilter'));
    expect(saved.sort).toBe('price-asc');
  });

  it('restores sort from sessionStorage on re-init (back-navigation)', () => {
    // Pre-seed sessionStorage
    sessionStorage.setItem('cf_searchFilter', JSON.stringify({ sort: 'price-desc', categories: [] }));

    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);

    // Sort repeater data should reflect price-desc as active
    const sortData = $w.__els['#sortChipsRepeater'].data;
    const activeChip = sortData.find(d => d.active);
    expect(activeChip?.value).toBe('price-desc');
  });

  it('restores category filter from sessionStorage on re-init', () => {
    sessionStorage.setItem(
      'cf_searchFilter',
      JSON.stringify({ sort: 'relevance', categories: ['Futon Frames'] }),
    );

    const $w = makeWixEnv();
    initSearchFilter($w, PRODUCTS);

    // searchRepeater.data should be filtered to Futon Frames immediately
    expect($w.__els['#searchRepeater'].data).toHaveLength(2);
  });

  // ── null safety ───────────────────────────────────────────────────────

  it('does not throw when $w returns null for all elements', () => {
    const $w = vi.fn(() => null);
    expect(() => initSearchFilter($w, PRODUCTS)).not.toThrow();
  });

  it('does not throw when searchResults is empty', () => {
    const $w = makeWixEnv();
    expect(() => initSearchFilter($w, [])).not.toThrow();
  });
});
