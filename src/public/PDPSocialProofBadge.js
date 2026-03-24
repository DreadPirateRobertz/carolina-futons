/**
 * PDPSocialProofBadge.js — PDP social proof badge renderer (cf-ic1).
 *
 * Pre-auth social proof badge below the product title.
 * Text: "X Charlotte members competing — earn N points on this purchase"
 *
 * ZIP source: caller passes zipPrefix (typically from URL query param ?zipPrefix=282).
 * Falls back to national count when no ZIP prefix is provided.
 * Points preview: Math.floor(product.price) — base rate, 1 pt per dollar.
 *
 * Elements:
 *   #socialProofBadge — text element (shown/hidden based on count)
 */

/**
 * Initialize the PDP social proof badge.
 *
 * @param {Function} $w - Wix element selector
 * @param {{ product: { price: number }|null }} state - Product page state
 * @param {Function} getNeighborCountFn - Backend callable (injected for testability)
 * @param {{ zipPrefix?: string }} [opts] - Options (zipPrefix from URL param)
 */
export async function initPDPSocialProofBadge($w, state, getNeighborCountFn, opts = {}) {
  const badge = $w('#socialProofBadge');

  function hideBadge() {
    try { badge.hide(); } catch (e) { console.warn('[PDPSocialProofBadge] badge.hide failed:', e); }
  }

  // Guard: no product loaded
  if (!state?.product) {
    hideBadge();
    return;
  }

  const points = Math.floor(state.product.price ?? 0);
  const zipPrefix = opts.zipPrefix || null;

  try {
    const result = await getNeighborCountFn(zipPrefix);

    // Guard malformed or error result — don't show badge on DB failures
    if (!result || typeof result.count !== 'number' || result.error || result.count <= 0) {
      hideBadge();
      return;
    }

    const text = `${result.count} Charlotte members competing — earn ${points} points on this purchase`;
    badge.text = text;
    try { badge.accessibility.ariaLabel = text; } catch (e) {}
    badge.show();
  } catch (err) {
    console.warn('[PDPSocialProofBadge] Failed to load neighbor count:', err);
    hideBadge();
  }
}
