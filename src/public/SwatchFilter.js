/**
 * @module SwatchFilter
 * @description Category page clientside swatch/fabric filter.
 *
 * Clicking a color chip filters the product grid repeater to show only
 * products matching that fabric. Multi-select: clicking multiple chips
 * shows the union. Clear button resets to all. Active filter set is
 * persisted in sessionStorage so back-navigation restores state.
 *
 * CF-wigv: Color/Fabric Swatch Filter
 *
 * Editor nicknames (Category Page):
 *   swatchFilterSection  → #swatchFilterSection   (Box — structural landmark; not queried by this module)
 *   swatchFilterRepeater → #swatchFilterRepeater  (Repeater — chip strip)
 *   swatchChip           → #swatchChip            (Box per item, active state via CSS class)
 *   swatchLabel          → #swatchLabel           (Text per item — color/fabric name)
 *   swatchCount          → #swatchCount           (Text per item — '(12)')
 *   clearFilterBtn       → #clearFilterBtn        (Button, hidden when no filter active)
 *   filterResultCount    → #filterResultCount     (Text — 'Showing 12 of 88 products')
 *
 * @example
 *   // In Category Page code:
 *   import { initSwatchFilter } from 'public/SwatchFilter';
 *   $w.onReady(() => {
 *     $w('#categoryDataset').onReady(() => {
 *       $w('#categoryDataset').getItems(0, 1000).then(({ items }) => {
 *         initSwatchFilter($w, items);
 *       });
 *     });
 *   });
 */

const STORAGE_KEY = 'cf_swatch_filter';
const CSS_ACTIVE  = 'swatch-active';

// ── Storage helpers ────────────────────────────────────────────────

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  // undefined → use real sessionStorage; null → caller explicitly opts out of persistence
  try {
    return sessionStorage;
  } catch (err) {
    console.warn('[SwatchFilter] sessionStorage unavailable — filter state will not persist:', err?.message ?? err);
    return null;
  }
}

/**
 * Read persisted active filters from sessionStorage.
 *
 * @param {Object|null} storage - sessionStorage-compatible object (getItem/setItem), or null to skip.
 * @returns {Set<string>}
 */
export function getActiveFilters(storage) {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed);
  } catch (err) {
    console.warn('[SwatchFilter] getActiveFilters: could not read stored filters —', err?.message ?? err);
    return new Set();
  }
}

/**
 * Persist active filter Set to sessionStorage.
 *
 * @param {Object|null} storage - sessionStorage-compatible object, or null to skip.
 * @param {Set<string>} filters
 */
export function saveActiveFilters(storage, filters) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...filters]));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.warn('[SwatchFilter] sessionStorage quota exceeded — filter state not persisted');
    } else {
      console.error('[SwatchFilter] saveActiveFilters: unexpected storage error:', err?.message ?? err);
    }
  }
}

// ── Pure data helpers ──────────────────────────────────────────────

/**
 * Extract unique fabric values from products, sorted alphabetically.
 * Products with null/undefined/empty-string fabric are excluded.
 *
 * @param {Array<{fabric?: string}>} products
 * @returns {Array<{_id: string, label: string, count: number}>}
 */
export function getUniqueFabrics(products) {
  const counts = new Map();
  for (const p of products) {
    if (!p.fabric) continue;
    counts.set(p.fabric, (counts.get(p.fabric) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fabric, count]) => ({ _id: fabric, label: fabric, count }));
}

/**
 * Filter products to those whose fabric is in activeFilters (OR logic).
 * Returns all products when activeFilters is empty.
 * Preserves original array order.
 *
 * @param {Array} products
 * @param {Set<string>} activeFilters
 * @returns {Array}
 */
export function filterProducts(products, activeFilters) {
  if (activeFilters.size === 0) return products;
  return products.filter(p => p.fabric && activeFilters.has(p.fabric));
}

// ── UI helpers ─────────────────────────────────────────────────────

function safeGet($wFn, sel) {
  try { return $wFn(sel) || null; } catch (_) { return null; }
}

/**
 * Sync chip CSS active-states and show/hide clearFilterBtn.
 * Note: chip CSS state is managed here (via chipMap), not inside onItemReady.
 *
 * @param {Function} $wFn
 * @param {Set<string>} activeFilters
 * @param {Map<string, Object>} chipMap - fabric _id → chip element
 */
export function syncSwatchUI($wFn, activeFilters, chipMap = new Map()) {
  try {
    // Sync chip active CSS for every registered chip
    for (const [fabricId, chipEl] of chipMap) {
      if (activeFilters.has(fabricId)) chipEl.addCssClass(CSS_ACTIVE);
      else                              chipEl.removeCssClass(CSS_ACTIVE);
    }

    // Show/hide clear button
    const clearBtn = safeGet($wFn, '#clearFilterBtn');
    if (clearBtn) {
      if (activeFilters.size > 0) clearBtn.show();
      else                         clearBtn.hide();
    }
  } catch (err) {
    console.error('[SwatchFilter] syncSwatchUI error:', err?.message ?? err);
  }
}

/**
 * Update the result count badge text.
 * @param {Function} $wFn
 * @param {number} shown
 * @param {number} total
 */
export function syncResultCount($wFn, shown, total) {
  try {
    const el = safeGet($wFn, '#filterResultCount');
    if (el) {
      el.text = `Showing ${shown} of ${total} products`;
      el.show();
    }
  } catch (err) {
    console.error('[SwatchFilter] syncResultCount error:', err?.message ?? err);
  }
}

// ── Internal: update grid + UI after filter change ──────────────────

function applyFilters($wFn, allProducts, activeFilters, storage, chipMap) {
  const filtered = filterProducts(allProducts, activeFilters);

  const gridRepeater = safeGet($wFn, '#productGridRepeater');
  if (!gridRepeater) {
    console.warn('[SwatchFilter] applyFilters: #productGridRepeater not found — grid cannot be updated');
    return;
  }
  gridRepeater.data = filtered;

  saveActiveFilters(storage, activeFilters);
  syncSwatchUI($wFn, activeFilters, chipMap);
  syncResultCount($wFn, filtered.length, allProducts.length);
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Initialise the swatch filter on a Category Page.
 *
 * 1. Reads any persisted filter state from sessionStorage.
 * 2. Registers onItemReady on swatchFilterRepeater (BEFORE setting .data),
 *    restoring active-state CSS for any persisted filters and wiring chip clicks.
 * 3. Sets swatchFilterRepeater.data to unique fabric chips + counts.
 * 4. Wires clearFilterBtn to reset all filters (including chip CSS).
 * 5. Applies persisted state to productGridRepeater immediately.
 *
 * @param {Function} $wFn - Wix $w selector function
 * @param {Array} allProducts - Full product list for the category
 * @param {Object} [opts]
 * @param {Object|null} [opts.storage] - Injectable sessionStorage for testing
 */
export function initSwatchFilter($wFn, allProducts, opts = {}) {
  try {
    if (!Array.isArray(allProducts)) {
      console.error('[SwatchFilter] initSwatchFilter: allProducts must be an array, got', typeof allProducts);
      return;
    }

    const storage = resolveStorage(opts.storage);
    // Shared mutable set — assumes single init per page lifecycle
    const activeFilters = getActiveFilters(storage);
    // Maps fabric _id → chip element for CSS sync on filter changes
    const chipMap = new Map();

    const items = getUniqueFabrics(allProducts);
    const swatchRepeater = safeGet($wFn, '#swatchFilterRepeater');
    if (!swatchRepeater) {
      console.warn('[SwatchFilter] #swatchFilterRepeater not found — swatch filter will not render');
    } else {
      // onItemReady MUST be registered before .data is set (Wix Velo requirement)
      swatchRepeater.onItemReady(($item, itemData) => {
        try {
          const labelEl = safeGet($item, '#swatchLabel');
          if (labelEl) labelEl.text = itemData.label;

          const countEl = safeGet($item, '#swatchCount');
          if (countEl) countEl.text = `(${itemData.count})`;

          const chipEl = safeGet($item, '#swatchChip');
          if (chipEl) {
            chipMap.set(itemData._id, chipEl);

            if (activeFilters.has(itemData._id)) chipEl.addCssClass(CSS_ACTIVE);
            else                                  chipEl.removeCssClass(CSS_ACTIVE);

            chipEl.onClick(() => {
              if (activeFilters.has(itemData._id)) activeFilters.delete(itemData._id);
              else                                  activeFilters.add(itemData._id);
              applyFilters($wFn, allProducts, activeFilters, storage, chipMap);
            });
          }
        } catch (err) {
          console.error('[SwatchFilter] onItemReady error for item', itemData?._id, ':', err?.message ?? err);
        }
      });

      swatchRepeater.data = items;
    }

    // Wire clear button
    const clearBtn = safeGet($wFn, '#clearFilterBtn');
    if (clearBtn) {
      clearBtn.onClick(() => {
        activeFilters.clear();
        applyFilters($wFn, allProducts, activeFilters, storage, chipMap);
      });
    }

    // Apply initial state
    applyFilters($wFn, allProducts, activeFilters, storage, chipMap);
  } catch (err) {
    console.error('[SwatchFilter] init error:', err?.message ?? err, err);
  }
}
