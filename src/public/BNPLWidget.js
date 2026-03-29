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
 * @param {Function} $w    - Wix element selector
 * @param {number}   price - Product price
 */
export function initBNPLWidget($w, price) {
  const { affirm, klarna } = formatBNPLEstimates(price);

  if (!affirm) {
    try { $w('#bnplContainer').hide(); } catch (e) {}
    return;
  }

  try { $w('#bnplAffirm').text = affirm; } catch (e) {}
  try { $w('#bnplKlarna').text = klarna; } catch (e) {}
  try { $w('#bnplContainer').show(); } catch (e) {}
}
