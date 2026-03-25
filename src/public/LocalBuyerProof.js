/**
 * @module LocalBuyerProof
 * @description ZIP-based social proof for Product Pages.
 * Shows "X people near [City] bought furniture this week."
 *
 * Elements:
 *   #localBuyerProof — Container text element (expand/collapse)
 *
 * CF-rhqm
 */

import { getLocalBuyerCount as _defaultGetLocalBuyerCount } from 'backend/socialProof.web';

/**
 * @param {string} zipPrefix — 3-digit ZIP prefix
 * @param {Object} [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getLocalBuyerCount]
 */
export async function initLocalBuyerProof(zipPrefix, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getLocalBuyerCount = opts.getLocalBuyerCount ?? _defaultGetLocalBuyerCount;

  try {
    const result = await getLocalBuyerCount(zipPrefix);

    if (!result || result.count === 0) {
      try { $w('#localBuyerProof').collapse(); } catch {}
      return;
    }

    const city = result.city || 'your area';
    const text = result.count === 1
      ? `1 person near ${city} bought furniture this week`
      : `${result.count} people near ${city} bought furniture this week`;

    try { $w('#localBuyerProof').text = text; } catch {}
    try { $w('#localBuyerProof').expand(); } catch {}
  } catch (err) {
    console.error('[LocalBuyerProof] failed to load', err);
    try { $w('#localBuyerProof').collapse(); } catch {}
  }
}
