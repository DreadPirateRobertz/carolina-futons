/**
 * @module BNPLWidget
 * @description Buy Now Pay Later payment estimate widget for product detail pages.
 * Displays Affirm and Klarna instalment estimates based on product price.
 * Pure calculation — no external API calls.
 *
 * Elements:
 *   #bnplContainer — Wrapper shown when estimates are available
 *   #bnplAffirm    — Text element: "As low as $X/mo with Affirm" (price / 12)
 *   #bnplKlarna    — Text element: "4 payments of $X with Klarna" (price / 4)
 *
 * CF-nqb5.1
 */

// ── safeGet ──────────────────────────────────────────────────────────────────
// Returns null when the element is not found (normal on pages where the widget
// is partially rendered). Warns on unexpected runtime errors so they are not
// silently swallowed.
function safeGet($wFn, sel) {
  try {
    return $wFn(sel) || null;
  } catch (err) {
    const msg = err?.message ?? '';
    if (!msg.includes('not found') && !msg.includes('Cannot read'))
      console.warn('[BNPLWidget] safeGet unexpected error:', sel, msg);
    return null;
  }
}

/**
 * Format a price as "$X" — whole dollars omit cents, others show 2dp.
 * @param {number} amount
 * @returns {string}
 */
function formatAmount(amount) {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/**
 * Calculate Affirm and Klarna payment estimate strings for a given price.
 * Returns empty strings for invalid or non-positive prices.
 *
 * @param {number|string} price - Product price
 * @returns {{ affirm: string, klarna: string }}
 */
export function formatBNPLEstimates(price) {
  const p = parseFloat(price);
  if (!Number.isFinite(p) || p <= 0) return { affirm: '', klarna: '' };

  const affirmAmt  = Math.round((p / 12) * 100) / 100;
  const klarnaAmt  = Math.round((p / 4)  * 100) / 100;

  return {
    affirm: `As low as ${formatAmount(affirmAmt)}/mo with Affirm`,
    klarna: `4 payments of ${formatAmount(klarnaAmt)} with Klarna`,
  };
}

/**
 * Initialise the BNPL widget on a product page.
 *
 * Element access uses safeGet so unknown selectors (pages where the widget
 * is partially wired) degrade gracefully. Unexpected errors are warned to
 * the console rather than silently discarded.
 *
 * @param {function(string): object} $w - Wix element selector
 * @param {number} price - Product price
 */
export function initBNPLWidget($w, price) {
  const { affirm, klarna } = formatBNPLEstimates(price);

  if (!affirm) {
    safeGet($w, '#bnplContainer')?.hide();
    return;
  }

  const affirmEl    = safeGet($w, '#bnplAffirm');
  const klarnaEl    = safeGet($w, '#bnplKlarna');
  const containerEl = safeGet($w, '#bnplContainer');

  if (affirmEl)    affirmEl.text    = affirm;
  if (klarnaEl)    klarnaEl.text    = klarna;
  if (containerEl) containerEl.show();
}
