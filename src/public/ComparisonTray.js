/**
 * @module ComparisonTray
 * @description Floating product comparison tray for collection/category pages.
 *
 * Users add up to 3 products via addToCompareTray (toggle: adds if absent,
 * removes if already present). The tray auto-shows on first add, auto-hides
 * when emptied. compareNowBtn is disabled until 2+ products are in the tray.
 * Navigates to /compare?ids=<id1>,<id2>[,<id3>] on Compare Now click.
 *
 * State is persisted in sessionStorage so the tray survives navigation between
 * collection pages within the same session.
 *
 * CF-r0dr: Product Comparison Tray
 *
 * Editor nicknames (Collection / Category pages):
 *   comparisonTray          → #comparisonTray         (Box, fixed overlay)
 *   comparisonSlot1/2/3     → #comparisonSlot1/2/3    (Box, one per slot)
 *   comparisonSlotImage1/2/3→ #comparisonSlotImage1/2/3 (Image)
 *   comparisonSlotName1/2/3 → #comparisonSlotName1/2/3  (Text)
 *   comparisonSlotRemove1/2/3→#comparisonSlotRemove1/2/3 (Button)
 *   compareNowBtn           → #compareNowBtn           (Button, primary CTA)
 *   clearComparisonBtn      → #clearComparisonBtn      (Button, secondary)
 *   comparisonCount         → #comparisonCount         (Text, badge)
 *
 * @example
 *   // In Collection Page code:
 *   import { initComparisonTray, addToCompareTray } from 'public/ComparisonTray';
 *   $w.onReady(() => {
 *     initComparisonTray($w, { navigate: wixLocationFrontend.to });
 *     // On each product card's "Add to Compare" button:
 *     $w('#addToCompareBtn').onClick(() => addToCompareTray($w, product, undefined));
 *   });
 */

// ── Constants ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'cf_comparison_tray';
const MAX_TRAY    = 3;

// ── Storage helpers ────────────────────────────────────────────────────

/**
 * Read current tray state from sessionStorage.
 * @param {Object|null} storage
 * @returns {Array<{_id: string, name: string, mainMedia: string}>}
 */
export function getTrayState(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function saveTrayState(storage, products) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch (_) {}
}

// ── Internal helpers ──────────────────────────────────────────────────

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try { return sessionStorage; } catch (_) { return null; }
}

function safeGet($wFn, selector) {
  try { return $wFn(selector) || null; } catch (_) { return null; }
}

// ── UI sync ────────────────────────────────────────────────────────────

const SLOT_SELECTORS = [
  { slot: '#comparisonSlot1', img: '#comparisonSlotImage1', name: '#comparisonSlotName1' },
  { slot: '#comparisonSlot2', img: '#comparisonSlotImage2', name: '#comparisonSlotName2' },
  { slot: '#comparisonSlot3', img: '#comparisonSlotImage3', name: '#comparisonSlotName3' },
];

/**
 * Render tray slots, count badge, and button states.
 * No-op if elements are absent.
 *
 * @param {Function} $wFn
 * @param {Array} products - Current tray products (0–3)
 */
export function syncTrayUI($wFn, products) {
  try {
    SLOT_SELECTORS.forEach(({ slot, img, name }, i) => {
      const product = products[i];
      const slotEl = safeGet($wFn, slot);
      const imgEl  = safeGet($wFn, img);
      const nameEl = safeGet($wFn, name);

      if (product) {
        if (slotEl) slotEl.show();
        if (imgEl  && product.mainMedia) imgEl.src   = product.mainMedia;
        if (nameEl && product.name)      nameEl.text = product.name;
      } else {
        if (slotEl) slotEl.hide();
      }
    });

    const countEl = safeGet($wFn, '#comparisonCount');
    if (countEl) {
      const n = products.length;
      countEl.text = n === 1 ? '1 product' : `${n} products`;
    }

    const compareBtn = safeGet($wFn, '#compareNowBtn');
    if (compareBtn) {
      if (products.length >= 2) compareBtn.enable();
      else                      compareBtn.disable();
    }
  } catch (_) {}
}

// ── Tray visibility ────────────────────────────────────────────────────

function showTray($wFn) {
  const tray = safeGet($wFn, '#comparisonTray');
  if (tray) tray.show();
}

function hideTray($wFn) {
  const tray = safeGet($wFn, '#comparisonTray');
  if (tray) tray.hide();
}

// ── Public actions ─────────────────────────────────────────────────────

/**
 * Add a product to the tray, or remove it if already present (toggle).
 * Enforces max of MAX_TRAY products. Shows/hides tray automatically.
 * No-op if product has no _id.
 *
 * @param {Function} $wFn
 * @param {{ _id: string, name: string, mainMedia: string }} product
 * @param {Object|null} [storage] - Defaults to sessionStorage
 */
export function addToCompareTray($wFn, product, storage) {
  if (!product?._id) return;

  const stor = resolveStorage(storage);

  const current = getTrayState(stor);
  const alreadyInTray = current.some(p => p._id === product._id);

  let updated;
  if (alreadyInTray) {
    updated = current.filter(p => p._id !== product._id);
  } else {
    if (current.length >= MAX_TRAY) return; // tray full
    updated = [...current, { _id: product._id, name: product.name, mainMedia: product.mainMedia }];
  }

  saveTrayState(stor, updated);
  syncTrayUI($wFn, updated);

  if (updated.length > 0) showTray($wFn);
  else                    hideTray($wFn);
}

/**
 * Remove a product from the tray by id.
 * Hides tray if it becomes empty.
 *
 * @param {Function} $wFn
 * @param {string} productId
 * @param {Object|null} [storage]
 */
export function removeFromTray($wFn, productId, storage) {
  const stor = resolveStorage(storage);

  const updated = getTrayState(stor).filter(p => p._id !== productId);
  saveTrayState(stor, updated);
  syncTrayUI($wFn, updated);

  if (updated.length === 0) hideTray($wFn);
}

/**
 * Clear the tray entirely and hide it.
 *
 * @param {Function} $wFn
 * @param {Object|null} [storage]
 */
export function clearTray($wFn, storage) {
  const stor = resolveStorage(storage);

  saveTrayState(stor, []);
  syncTrayUI($wFn, []);
  hideTray($wFn);
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Initialise the comparison tray on a Collection / Category page.
 *
 * 1. Reads any persisted tray state from sessionStorage.
 * 2. Shows/hides tray and syncs UI to persisted state.
 * 3. Wires compareNowBtn → navigate to /compare?ids=<id1>,<id2>[,<id3>]
 * 4. Wires clearComparisonBtn → clearTray.
 * 5. Wires each slot's remove button → removeFromTray for that slot's product.
 *
 * @param {Function} $wFn - Wix $w selector function
 * @param {Object} [opts]
 * @param {Object|null} [opts.storage]  - Injectable sessionStorage for testing
 * @param {Function}    [opts.navigate] - Injectable navigation fn (productId → void); defaults to wixLocationFrontend.to
 */
export function initComparisonTray($wFn, opts = {}) {
  try {
    const storage = 'storage' in opts ? opts.storage : resolveStorage();
    const navigate = opts.navigate || (() => {});

    const current = getTrayState(storage);

    syncTrayUI($wFn, current);
    if (current.length > 0) showTray($wFn);
    else                    hideTray($wFn);

    // Wire compare button
    const compareBtn = safeGet($wFn, '#compareNowBtn');
    if (compareBtn) {
      compareBtn.onClick(() => {
        const products = getTrayState(storage);
        if (products.length < 2) return;
        const ids = products.map(p => p._id).join(',');
        navigate(`/compare?ids=${ids}`);
      });
    }

    // Wire clear button
    const clearBtn = safeGet($wFn, '#clearComparisonBtn');
    if (clearBtn) {
      clearBtn.onClick(() => clearTray($wFn, storage));
    }

    // Wire per-slot remove buttons
    const REMOVE_SELECTORS = ['#comparisonSlotRemove1', '#comparisonSlotRemove2', '#comparisonSlotRemove3'];
    REMOVE_SELECTORS.forEach((sel, i) => {
      const btn = safeGet($wFn, sel);
      if (btn) {
        btn.onClick(() => {
          const products = getTrayState(storage);
          const product  = products[i];
          if (product) removeFromTray($wFn, product._id, storage);
        });
      }
    });
  } catch (err) {
    console.error('[ComparisonTray] init error:', err?.message ?? err);
  }
}
