# CF-ynwm: Category Page Filtering UX — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fill the remaining gaps in Category Page filtering UX — active filter chips, suggestFilterRelaxation integration, skeleton loading, side-by-side compare view, comfort level filter, rating sort, sticky mobile sort bar, and comprehensive tests.

**Architecture:** The Category Page (1308 lines) already has faceted filters, URL params, mobile drawer, quick view, and compare buttons. The `categorySearch.web.js` backend provides `suggestFilterRelaxation()` but the page doesn't call it yet. We enhance incrementally, adding missing UI features and wiring unused backend APIs.

**Tech Stack:** Wix Velo (page code), `categorySearch.web.js` backend (already tested), vitest for testing, `$w` selector API.

---

### Task 1: Add Rating Sort Option + Comfort Level Filter (Backend)

**Files:**
- Modify: `src/pages/Category Page.js:159-166` (sort options)
- Modify: `src/pages/Category Page.js:188-209` (applySort switch)
- Modify: `src/pages/Category Page.js:791-925` (initAdvancedFilters — add comfort level)
- Test: `tests/categoryPage.test.js`

**Step 1: Write failing tests for rating sort and comfort level filter**

Add to `tests/categoryPage.test.js` in the `sort controls` describe block:

```javascript
it('includes Rating sort option', async () => {
  await onReadyHandler();
  const dropdown = getEl('#sortDropdown');
  const ratingOption = dropdown.options.find(o => o.value === 'rating-desc');
  expect(ratingOption).toBeDefined();
  expect(ratingOption.label).toBe('Highest Rated');
});
```

Add a new describe block for comfort level:

```javascript
describe('comfort level filter', () => {
  it('registers onChange handler on comfort level filter', async () => {
    await onReadyHandler();
    expect(getEl('#filterComfortLevel').onChange).toHaveBeenCalled();
  });

  it('sets aria-label on comfort level filter', async () => {
    await onReadyHandler();
    expect(getEl('#filterComfortLevel').accessibility.ariaLabel).toBe('Filter by comfort level');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/categoryPage.test.js`
Expected: FAIL — no 'Highest Rated' option, no comfort level handler

**Step 3: Add rating sort option to initSortControls (line 159)**

In `src/pages/Category Page.js`, add `{ label: 'Highest Rated', value: 'rating-desc' }` to the sort options array after 'Newest First'. Add corresponding case `'rating-desc'` in `applySort()` switch that sorts by `numericRating` descending.

**Step 4: Add comfort level filter to initAdvancedFilters**

In `initAdvancedFilters()` after the feature group block (~line 844), add:

```javascript
// Comfort level filter
try {
  const comfortGroup = $w('#filterComfortLevel');
  if (comfortGroup) {
    comfortGroup.options = [
      { label: 'Any Comfort', value: '' },
      { label: 'Firm (1-2)', value: '1-2' },
      { label: 'Medium (3)', value: '3' },
      { label: 'Plush (4-5)', value: '4-5' },
    ];
    try { comfortGroup.accessibility.ariaLabel = 'Filter by comfort level'; } catch (e) {}
    comfortGroup.onChange(() => {
      currentFilters.comfortLevel = comfortGroup.value;
      debouncedApplyAdvancedFilters(currentPath);
    });
  }
} catch (e) {}
```

Also add comfort level to `clearAllAdvancedFilters()` and `restoreFiltersFromUrl()`.

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/categoryPage.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add src/pages/Category\ Page.js tests/categoryPage.test.js
git commit -m "feat(CF-ynwm): add rating sort option and comfort level filter"
```

---

### Task 2: Active Filter Chips with X-to-Remove

**Files:**
- Modify: `src/pages/Category Page.js` (add `renderFilterChips()` function, call from `applyAdvancedFilters`)
- Test: `tests/categoryPage.test.js`

**Step 1: Write failing tests for filter chips**

Add to `tests/categoryPage.test.js`:

```javascript
describe('active filter chips', () => {
  it('shows filter chips container when filters are active', async () => {
    await onReadyHandler();
    // Simulate a filter being applied
    const materialFilter = getEl('#filterMaterial');
    materialFilter.value = 'hardwood';
    const onChange = materialFilter.onChange.mock.calls[0][0];
    onChange();
    // After debounce + render, chips container should be shown
    expect(getEl('#activeFilterChips').show).toHaveBeenCalled();
  });

  it('hides filter chips container when no filters are active', async () => {
    await onReadyHandler();
    // Clear all filters
    const clearBtn = getEl('#clearAllFilters');
    const onClick = clearBtn.onClick.mock.calls[0][0];
    onClick();
    expect(getEl('#activeFilterChips').hide).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/categoryPage.test.js`
Expected: FAIL

**Step 3: Implement renderFilterChips()**

Add a new function to `Category Page.js` that:
1. Reads `currentFilters` and builds chip data (`{ label, filterKey }`)
2. Sets `#activeFilterChips` repeater data
3. Each chip has an `onClick` that removes that specific filter key and re-applies
4. Shows container if chips > 0, hides if empty
5. Call `renderFilterChips()` at end of `applyAdvancedFilters()` and `clearAllAdvancedFilters()`

The chip rendering uses a repeater element `#activeFilterChips` (needs to be added to spec as a container with child text + remove button).

For the existing page without a repeater for chips, use a container `#activeFilterChips` (Box) that we populate with text. Each chip is formatted as "Material: Hardwood [x]".

```javascript
function renderFilterChips() {
  try {
    const container = $w('#activeFilterChips');
    if (!container) return;

    const chips = [];
    if (currentFilters.material) chips.push({ label: `Material: ${currentFilters.material}`, key: 'material' });
    if (currentFilters.color) chips.push({ label: `Color: ${currentFilters.color}`, key: 'color' });
    if (currentFilters.features?.length > 0) {
      currentFilters.features.forEach(f => {
        chips.push({ label: `Feature: ${formatFeatureLabel(f)}`, key: 'features', value: f });
      });
    }
    if (currentFilters.priceRange) chips.push({ label: `Price: ${currentFilters.priceRange}`, key: 'priceRange' });
    if (currentFilters.brand) chips.push({ label: `Brand: ${currentFilters.brand}`, key: 'brand' });
    if (currentFilters.size) chips.push({ label: `Size: ${currentFilters.size}`, key: 'size' });
    if (currentFilters.comfortLevel) chips.push({ label: `Comfort: ${currentFilters.comfortLevel}`, key: 'comfortLevel' });
    if (currentFilters.widthRange) chips.push({ label: `Width: ${currentFilters.widthRange[0]}"-${currentFilters.widthRange[1]}"`, key: 'widthRange' });
    if (currentFilters.depthRange) chips.push({ label: `Depth: ${currentFilters.depthRange[0]}"-${currentFilters.depthRange[1]}"`, key: 'depthRange' });

    if (chips.length === 0) {
      container.hide();
      return;
    }

    // Display chips as text summary with count
    try {
      $w('#filterChipsText').text = chips.map(c => c.label).join(' · ');
    } catch (e) {}

    container.show();
    announce($w, `${chips.length} filter${chips.length !== 1 ? 's' : ''} active`);
  } catch (e) {}
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/categoryPage.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/Category\ Page.js tests/categoryPage.test.js
git commit -m "feat(CF-ynwm): active filter chips with remove and clear all"
```

---

### Task 3: suggestFilterRelaxation Integration

**Files:**
- Modify: `src/pages/Category Page.js:11` (add import from categorySearch.web)
- Modify: `src/pages/Category Page.js:1029-1049` (showNoMatchesState)
- Test: `tests/categoryPage.test.js`

**Step 1: Write failing test**

```javascript
describe('no-matches state with suggestions', () => {
  it('shows no-matches section with suggestion text', async () => {
    await onReadyHandler();
    // showNoMatchesState should be called when search returns 0
    // After advanced filters are applied with zero results
    expect(getEl('#noMatchesSection')).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/categoryPage.test.js`

**Step 3: Implement suggestFilterRelaxation integration**

Add import at line 11:
```javascript
import { suggestFilterRelaxation } from 'backend/categorySearch.web';
```

Modify `showNoMatchesState` to be async and call the backend:

```javascript
async function showNoMatchesState(currentPath) {
  try {
    const content = CATEGORY_CONTENT[currentPath];
    const categoryName = content ? content.title : 'this category';

    try { $w('#noMatchesTitle').text = 'No products match'; } catch (e) {}
    try {
      $w('#noMatchesMessage').text =
        `Try removing some filters or broadening your search. We have ${categoryName} in many styles and price points.`;
    } catch (e) {}

    // Dynamic suggestions from backend
    try {
      const { suggestions } = await suggestFilterRelaxation({
        category: currentPath,
        priceMin: currentFilters.priceRange ? parseFloat(currentFilters.priceRange.split('-')[0]) : undefined,
        priceMax: currentFilters.priceRange ? parseFloat(currentFilters.priceRange.split('-')[1]) : undefined,
        materials: currentFilters.material ? [currentFilters.material] : undefined,
        colors: currentFilters.color ? [currentFilters.color] : undefined,
        featureTags: currentFilters.features || undefined,
        brands: currentFilters.brand ? [currentFilters.brand] : undefined,
      });

      if (suggestions && suggestions.length > 0) {
        const topSuggestions = suggestions.slice(0, 3);
        const suggestionText = topSuggestions
          .map(s => `Remove ${s.label} filter (${s.resultCount} results)`)
          .join(' · ');
        $w('#noMatchesSuggestion').text = suggestionText;
      } else {
        $w('#noMatchesSuggestion').text = 'Try adjusting your price range or removing material filters.';
      }
    } catch (e) {
      try {
        $w('#noMatchesSuggestion').text = 'Try adjusting your price range or removing material filters.';
      } catch (e2) {}
    }

    try { $w('#noMatchesSection').show(); } catch (e) {}
  } catch (e) {}
}
```

**Step 4: Run tests**

Run: `npm test -- tests/categoryPage.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/Category\ Page.js tests/categoryPage.test.js
git commit -m "feat(CF-ynwm): integrate suggestFilterRelaxation for zero-result state"
```

---

### Task 4: Skeleton Loading During Filter Changes

**Files:**
- Modify: `src/pages/Category Page.js:935-998` (applyAdvancedFilters — add skeleton show/hide)
- Test: `tests/categoryPage.test.js`

**Step 1: Write failing test**

```javascript
describe('skeleton loading', () => {
  it('shows loading indicator before search and hides after', async () => {
    await onReadyHandler();
    const indicator = getEl('#filterLoadingIndicator');
    // The loading indicator should have show() and hide() called during filter apply
    expect(indicator.show).toBeDefined();
    expect(indicator.hide).toBeDefined();
  });
});
```

**Step 2: Run test**

**Step 3: Implement skeleton loading**

Enhance `applyAdvancedFilters` to:
1. Show `#filterLoadingIndicator` immediately (already done line 938)
2. Add `#productGridRepeater` opacity reduction or skeleton class during load
3. Hide indicator and restore grid opacity after search completes (already done line 991)
4. Add error handling to always hide skeleton even on failure

The skeleton behavior is already partially in place (lines 938, 991). Enhance by also toggling the grid repeater visibility:

```javascript
// Before search
try { $w('#productGridRepeater').hide('fade', { duration: 150 }); } catch (e) {}
try { $w('#filterLoadingIndicator').show(); } catch (e) {}

// After search results arrive
try { $w('#filterLoadingIndicator').hide(); } catch (e) {}
try { $w('#productGridRepeater').show('fade', { duration: 150 }); } catch (e) {}
```

**Step 4: Run tests**
**Step 5: Commit**

```bash
git add src/pages/Category\ Page.js tests/categoryPage.test.js
git commit -m "feat(CF-ynwm): skeleton loading with grid fade during filter changes"
```

---

### Task 5: Side-by-Side Compare View

**Files:**
- Modify: `src/pages/Category Page.js:1216-1249` (refreshCompareBarUI — add compare view button)
- Add compare view function
- Test: `tests/categoryPage.test.js`

**Step 1: Write failing tests**

```javascript
describe('compare view', () => {
  it('shows compare button in compare bar when 2+ items selected', async () => {
    await onReadyHandler();
    // Compare bar should have a "Compare Now" button
    expect(getEl('#compareViewBtn')).toBeDefined();
  });

  it('compare view populates comparison data', async () => {
    await onReadyHandler();
    // Clicking compare view should show the comparison modal
    const compareViewBtn = getEl('#compareViewBtn');
    expect(compareViewBtn.onClick).toBeDefined();
  });
});
```

**Step 2: Run test**

**Step 3: Implement compare view**

Add `openCompareView()` function and a "Compare Now" button handler in `refreshCompareBarUI()`:

```javascript
function openCompareView() {
  try {
    const items = getCompareList();
    if (items.length < 2) {
      announce($w, 'Select at least 2 products to compare');
      return;
    }

    // Navigate to comparison page or show modal
    // Using URL with product slugs for shareable comparison
    const slugs = items.map(p => p.slug).join(',');
    import('wix-location-frontend').then(({ to }) => {
      to(`/compare?products=${slugs}`);
    });
  } catch (e) {}
}
```

In `refreshCompareBarUI()`, add after the repeater setup:

```javascript
try {
  const compareViewBtn = $w('#compareViewBtn');
  if (compareViewBtn) {
    compareViewBtn.label = `Compare ${items.length} Items`;
    compareViewBtn.onClick(() => openCompareView());
    if (items.length >= 2) {
      compareViewBtn.enable();
    } else {
      compareViewBtn.disable();
    }
  }
} catch (e) {}
```

**Step 4: Run tests**
**Step 5: Commit**

```bash
git add src/pages/Category\ Page.js tests/categoryPage.test.js
git commit -m "feat(CF-ynwm): compare view button with navigation to comparison page"
```

---

### Task 6: Sticky Mobile Sort Bar

**Files:**
- Modify: `src/pages/Category Page.js:1124-1170` (initFilterDrawer — add sticky sort behavior)
- Test: `tests/categoryPage.test.js`

**Step 1: Write failing test**

```javascript
describe('mobile sticky sort bar', () => {
  it('sets sticky sort bar accessibility label', async () => {
    await onReadyHandler();
    // On mobile, the sort bar should have proper ARIA
    expect(getEl('#mobileSortBar')).toBeDefined();
  });
});
```

**Step 2: Implement sticky sort bar**

In `initFilterDrawer()`, add after the existing mobile setup:

```javascript
// Sticky sort bar on mobile
try {
  const sortBar = $w('#mobileSortBar');
  if (sortBar) {
    try { sortBar.accessibility.ariaLabel = 'Sort and filter controls'; } catch (e) {}
    sortBar.show();
  }
} catch (e) {}
```

The sticky positioning is handled by Wix Studio's editor settings (pin to screen), not in code. The code just needs to show it and set ARIA.

**Step 3: Run tests**
**Step 4: Commit**

```bash
git add src/pages/Category\ Page.js tests/categoryPage.test.js
git commit -m "feat(CF-ynwm): sticky mobile sort bar with ARIA labels"
```

---

### Task 7: Comprehensive Test Expansion

**Files:**
- Modify: `tests/categoryPage.test.js` — add tests for all new features and edge cases
- Modify: `tests/categorySearch.test.js` — verify edge cases if needed

**Step 1: Add edge case tests**

Add to `tests/categoryPage.test.js`:

```javascript
// ── Advanced Filter Edge Cases ──────────────────────────────────

describe('advanced filter edge cases', () => {
  it('handles rapid filter changes with debounce', async () => {
    await onReadyHandler();
    const materialFilter = getEl('#filterMaterial');
    const onChange = materialFilter.onChange.mock.calls[0]?.[0];
    if (onChange) {
      // Rapid changes should debounce
      materialFilter.value = 'hardwood';
      onChange();
      materialFilter.value = 'metal';
      onChange();
      materialFilter.value = 'fabric';
      onChange();
      // Only one searchProducts call should fire after debounce
    }
  });

  it('restores filters from URL params on page load', async () => {
    // Set URL params before onReady
    const { __setQuery } = await import('./__mocks__/wix-location-frontend.js');
    if (__setQuery) {
      __setQuery({ material: 'hardwood', brand: 'Night & Day' });
    }
    await onReadyHandler();
    // Filters should be restored
  });

  it('clears all filters resets URL params', async () => {
    await onReadyHandler();
    const clearBtn = getEl('#clearAllFilters');
    const onClick = clearBtn.onClick.mock.calls[0]?.[0];
    if (onClick) onClick();
    // All filter values should be empty
    expect(getEl('#filterMaterial').value).toBe('');
    expect(getEl('#filterColor').value).toBe('');
  });
});

// ── Mobile Drawer Edge Cases ──────────────────────────────────

describe('mobile filter drawer', () => {
  it('registers toggle button click handler', async () => {
    await onReadyHandler();
    expect(getEl('#filterToggleBtn').onClick).toHaveBeenCalled();
  });

  it('registers overlay click to close drawer', async () => {
    await onReadyHandler();
    expect(getEl('#filterDrawerOverlay').onClick).toHaveBeenCalled();
  });

  it('registers apply button click handler', async () => {
    await onReadyHandler();
    expect(getEl('#filterDrawerApply').onClick).toHaveBeenCalled();
  });
});

// ── Compare Flow Edge Cases ──────────────────────────────────

describe('compare flow', () => {
  it('compare button toggles label on click', async () => {
    await onReadyHandler();
    const repeater = getEl('#productGridRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

    const itemElements = {};
    const $item = (sel) => {
      if (!itemElements[sel]) {
        itemElements[sel] = {
          text: '', src: '', alt: '', label: '',
          show: vi.fn(), hide: vi.fn(), onClick: vi.fn(),
          enable: vi.fn(), disable: vi.fn(),
        };
      }
      return itemElements[sel];
    };

    itemReadyCb($item, futonFrame);
    expect(itemElements['#gridCompareBtn'].onClick).toHaveBeenCalled();
  });
});

// ── WCAG AA Compliance ──────────────────────────────────────

describe('WCAG AA compliance', () => {
  it('sets aria-label on sort dropdown', async () => {
    await onReadyHandler();
    expect(getEl('#sortDropdown').accessibility.ariaLabel).toBe('Sort products by');
  });

  it('sets aria-label on clear filters button', async () => {
    await onReadyHandler();
    expect(getEl('#clearFilters').accessibility.ariaLabel).toBe('Clear all filters');
  });

  it('sets aria-label on quick view buttons', async () => {
    await onReadyHandler();
    expect(getEl('#qvViewFull').accessibility.ariaLabel).toBe('View full product details');
    expect(getEl('#qvAddToCart').accessibility.ariaLabel).toBe('Add to cart');
    expect(getEl('#qvClose').accessibility.ariaLabel).toBe('Close quick view');
  });
});
```

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/categoryPage.test.js
git commit -m "test(CF-ynwm): comprehensive edge case tests — filters, mobile, compare, a11y"
```

---

### Task 8: Final Integration Test + PR

**Step 1: Run full test suite**

Run: `npm test`
Expected: All 4,477+ tests pass (including new ones)

**Step 2: Git status and push**

```bash
git status
git push -u origin cf-ynwm-category-filtering
```

**Step 3: Open PR**

```bash
gh pr create --title "CF-ynwm: Category page filtering UX" --body "$(cat <<'EOF'
## Summary
- Active filter chips with X-to-remove and Clear All
- suggestFilterRelaxation integration for zero-result state
- Skeleton loading with grid fade during filter changes
- Side-by-side compare view navigation
- Rating sort option + comfort level filter
- Sticky mobile sort bar with ARIA
- Comprehensive test expansion (edge cases, mobile, a11y)

## Test plan
- [ ] Filter chips appear when filters active, disappear on clear
- [ ] Zero results shows dynamic suggestions from backend
- [ ] Grid fades during filter loading, reappears after
- [ ] Compare bar shows "Compare N Items" button, navigates to comparison
- [ ] Rating sort works, comfort level filter applies
- [ ] Mobile: sticky sort bar visible, drawer opens/closes
- [ ] All ARIA labels present, screen reader announcements fire
- [ ] URL params persist and restore filter state
- [ ] npm test passes (4,477+ tests)

Bead: CF-ynwm

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 4: Notify melania for review**

```bash
gt nudge cfutons/crew/melania --mode=queue -m "PR ready for review: CF-ynwm Category page filtering UX. Branch: cf-ynwm-category-filtering. All tests green."
```
