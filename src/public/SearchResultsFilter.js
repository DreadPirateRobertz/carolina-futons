// SearchResultsFilter.js — Quick-filter chips for the Search Results page
// CF-sg0e: Sort (Relevance, Price Low→High, Price High→Low) + Category multi-select chips
// Client-side only — no re-query to backend; updates #searchRepeater.data directly.

const SESSION_KEY = 'cf_searchFilter';

export const SORT_OPTIONS = [
  { _id: 'sort-relevance',  label: 'Relevance',       value: 'relevance'  },
  { _id: 'sort-price-asc',  label: 'Price Low→High',  value: 'price-asc'  },
  { _id: 'sort-price-desc', label: 'Price High→Low',  value: 'price-desc' },
];

// ── Pure helpers (also exported for unit tests) ───────────────────────────

/** Extract ordered unique category values from result items. */
export function getCategoriesFromResults(results) {
  const seen = new Set();
  const cats = [];
  for (const p of results) {
    const colls = Array.isArray(p.collections) ? p.collections : [];
    const type  = p.productType || '';
    for (const v of type ? [...colls, type] : colls) {
      if (v && !seen.has(v)) { seen.add(v); cats.push(v); }
    }
  }
  return cats;
}

/** Client-side sort — does NOT mutate the input array. */
export function sortResults(results, sortValue) {
  const arr = [...results];
  if (sortValue === 'price-asc')  arr.sort((a, b) => (a.price || 0) - (b.price || 0));
  if (sortValue === 'price-desc') arr.sort((a, b) => (b.price || 0) - (a.price || 0));
  return arr; // 'relevance' → original order
}

/** Filter by active categories (OR logic). Empty set returns all. */
export function filterByCategories(results, activeCategories) {
  if (!activeCategories.size) return results;
  return results.filter(p => {
    const colls = Array.isArray(p.collections) ? p.collections : [];
    const type  = p.productType || '';
    return [...activeCategories].some(cat => colls.includes(cat) || type === cat);
  });
}

// ── Main init ─────────────────────────────────────────────────────────────

/**
 * initSearchFilter($w, searchResults)
 *
 * Wire quick-filter chips above the results grid.
 * Call from Search Results.js after performSearch resolves with products.
 *
 * @param {Function} $w            Wix $w selector
 * @param {Array}    searchResults Current page result items (product objects)
 */
export function initSearchFilter($w, searchResults) {
  const allResults    = [...searchResults];
  let activeSort      = 'relevance';
  let activeCategories = new Set();

  // ── Restore state from sessionStorage (back-navigation) ──────────────

  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      activeSort       = state.sort       || 'relevance';
      activeCategories = new Set(state.categories || []);
    }
  } catch (e) { /* ignore parse errors */ }

  // ── Internal helpers ──────────────────────────────────────────────────

  function getDisplayResults() {
    return sortResults(filterByCategories(allResults, activeCategories), activeSort);
  }

  function hasActiveFilters() {
    return activeSort !== 'relevance' || activeCategories.size > 0;
  }

  function saveState() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        sort:       activeSort,
        categories: [...activeCategories],
      }));
    } catch (e) {}
  }

  function updateResultCount(results) {
    try {
      const n = results.length;
      $w('#filterResultCount').text = `${n} result${n !== 1 ? 's' : ''}`;
    } catch (e) {}
  }

  function updateClearBtn() {
    try {
      hasActiveFilters() ? $w('#clearFiltersBtn').show() : $w('#clearFiltersBtn').hide();
    } catch (e) {}
  }

  function updateSearchRepeater(results) {
    try {
      $w('#searchRepeater').data = results.map(p => ({ ...p, _id: p._id }));
    } catch (e) {}
  }

  function applyAndRender() {
    const results = getDisplayResults();
    updateSearchRepeater(results);
    updateResultCount(results);
    updateClearBtn();
    saveState();
  }

  // ── Sort chips ────────────────────────────────────────────────────────

  function getSortData() {
    return SORT_OPTIONS.map(opt => ({ ...opt, active: opt.value === activeSort }));
  }

  function refreshSortChips() {
    try { $w('#sortChipsRepeater').data = getSortData(); } catch (e) {}
  }

  try {
    const sortRepeater = $w('#sortChipsRepeater');
    if (sortRepeater) {
      sortRepeater.onItemReady(($item, itemData) => {
        try { $item('#filterChipLabel').text = itemData.label; } catch (e) {}
        try {
          itemData.active
            ? $item('#filterChip').addCssClass('filter-active')
            : $item('#filterChip').removeCssClass('filter-active');
        } catch (e) {}
        try {
          $item('#filterChip').onClick(() => {
            activeSort = itemData.value;
            refreshSortChips();
            applyAndRender();
          });
        } catch (e) {}
      });
      sortRepeater.data = getSortData();
    }
  } catch (e) {}

  // ── Category chips ────────────────────────────────────────────────────

  const categories = getCategoriesFromResults(allResults);

  function getCategoryData() {
    return categories.map((cat, i) => ({
      _id:    `cat-${i}`,
      label:  cat,
      value:  cat,
      active: activeCategories.has(cat),
    }));
  }

  function refreshCategoryChips() {
    try { $w('#categoryChipsRepeater').data = getCategoryData(); } catch (e) {}
  }

  try {
    const catRepeater = $w('#categoryChipsRepeater');
    if (catRepeater) {
      if (categories.length <= 1) {
        try { catRepeater.collapse(); } catch (e) {}
      } else {
        catRepeater.onItemReady(($item, itemData) => {
          try { $item('#filterChipLabel').text = itemData.label; } catch (e) {}
          try {
            itemData.active
              ? $item('#filterChip').addCssClass('filter-active')
              : $item('#filterChip').removeCssClass('filter-active');
          } catch (e) {}
          try {
            $item('#filterChip').onClick(() => {
              activeCategories.has(itemData.value)
                ? activeCategories.delete(itemData.value)
                : activeCategories.add(itemData.value);
              refreshCategoryChips();
              applyAndRender();
            });
          } catch (e) {}
        });
        catRepeater.data = getCategoryData();
        try { catRepeater.expand(); } catch (e) {}
      }
    }
  } catch (e) {}

  // ── Clear button ──────────────────────────────────────────────────────

  try {
    $w('#clearFiltersBtn').onClick(() => {
      activeSort = 'relevance';
      activeCategories.clear();
      refreshSortChips();
      refreshCategoryChips();
      applyAndRender();
    });
  } catch (e) {}

  // ── Initial render ────────────────────────────────────────────────────

  const initialResults = getDisplayResults();
  updateResultCount(initialResults);
  updateClearBtn();

  // If restored state has active filters, apply to search repeater immediately
  if (hasActiveFilters()) {
    updateSearchRepeater(initialResults);
  }

  return {
    getDisplayResults,
    getActiveSort:       () => activeSort,
    getActiveCategories: () => new Set(activeCategories),
  };
}
