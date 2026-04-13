/**
 * @module SwatchKitWidget
 * @description Pure functions for the Swatch Kit product page UI.
 *
 * No direct Wix API calls — all side effects handled by the page module.
 * Elements expected on /swatch-kit page:
 *   #swatchGrid         — repeater/grid showing fabric options
 *   #selectedCount      — "X of 5 selected" counter
 *   #addToCartBtn       — disabled until 1–5 swatches selected
 *   #creditBanner       — shows "$5 refundable on $200+ orders"
 *   #selectionError     — validation error text
 */

export const MIN_SWATCHES = 1;
export const MAX_SWATCHES = 5;
export const KIT_PRICE = 5;
export const QUALIFYING_MIN = 200;

/**
 * Whether the current selection is valid for purchase.
 * @param {string[]} selectedIds
 * @returns {boolean}
 */
export function isSelectionValid(selectedIds) {
  return (
    Array.isArray(selectedIds) &&
    selectedIds.length >= MIN_SWATCHES &&
    selectedIds.length <= MAX_SWATCHES
  );
}

/**
 * Toggle a swatch ID in/out of the selection.
 * Enforces MAX_SWATCHES — adding beyond limit returns current selection unchanged.
 *
 * @param {string[]} current — current selection
 * @param {string} swatchId
 * @returns {string[]} new selection (immutable — always a new array)
 */
export function toggleSwatch(current, swatchId) {
  if (!Array.isArray(current) || !swatchId) return current || [];
  const idx = current.indexOf(swatchId);
  if (idx !== -1) {
    return current.filter(id => id !== swatchId);
  }
  if (current.length >= MAX_SWATCHES) return current;
  return [...current, swatchId];
}

/**
 * Selection counter text shown beneath the grid.
 * @param {string[]} selectedIds
 * @returns {string}
 */
export function formatSelectionCount(selectedIds) {
  const n = Array.isArray(selectedIds) ? selectedIds.length : 0;
  const word = n === 1 ? 'swatch' : 'swatches';
  return `${n} of ${MAX_SWATCHES} ${word} selected`;
}

/**
 * Add-to-cart button state.
 * @param {string[]} selectedIds
 * @returns {{ disabled: boolean, label: string }}
 */
export function buildAddToCartState(selectedIds) {
  const valid = isSelectionValid(selectedIds);
  return {
    disabled: !valid,
    label: valid ? `Add ${selectedIds.length} Swatch Kit to Cart — $${KIT_PRICE}` : 'Select 1–5 swatches',
  };
}

/**
 * Credit refund banner text.
 * @returns {string}
 */
export function buildCreditBannerText() {
  return `$${KIT_PRICE} refundable as store credit on any order $${QUALIFYING_MIN}+`;
}

/**
 * Error text for selection validation.
 * Returns empty string when selection is valid.
 * @param {string[]} selectedIds
 * @returns {string}
 */
export function buildSelectionError(selectedIds) {
  if (!Array.isArray(selectedIds)) return 'Please select at least 1 swatch.';
  if (selectedIds.length === 0) return 'Please select at least 1 swatch.';
  if (selectedIds.length > MAX_SWATCHES) return `Maximum ${MAX_SWATCHES} swatches per kit.`;
  return '';
}

/**
 * Credit status banner for members who have a pending swatch kit credit.
 * @param {{ hasPendingCredit: boolean, expiresAt?: Date, amount?: number }} creditStatus
 * @returns {string}  Empty string when no pending credit.
 */
export function buildCreditStatusText(creditStatus) {
  if (!creditStatus?.hasPendingCredit) return '';
  const amount = creditStatus.amount ?? KIT_PRICE;
  if (creditStatus.expiresAt) {
    const expiryStr = new Date(creditStatus.expiresAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `You have $${amount} swatch credit — apply it to any $${QUALIFYING_MIN}+ order by ${expiryStr}.`;
  }
  return `You have $${amount} swatch credit — apply it to any $${QUALIFYING_MIN}+ order.`;
}
