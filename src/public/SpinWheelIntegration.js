/**
 * @module SpinWheelIntegration
 * @description Wires bonus spin grants to loyalty thresholds on the member dashboard.
 *
 * Elements:
 *   #bonusSpinCTA      — CTA shown when member has bonus spins available
 *   #spinWheelLightbox — Spin wheel modal container
 *   #spinWheelCloseBtn — Hides the lightbox on click
 *
 * CF-qjnv
 */

import { getBonusSpinsAvailable as _defaultGetBonusSpins } from 'backend/spinWheel.web';

/**
 * Initialise the spin wheel CTA and lightbox wiring.
 *
 * @param {string}   memberId  Member ID to check spin eligibility for
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w] Wix element selector (defaults to globalThis.$w)
 * @param {Function} [opts.getBonusSpinsAvailable] Defaults to backend getBonusSpinsAvailable
 */
export async function initSpinWheel(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getBonusSpinsAvailable = opts.getBonusSpinsAvailable ?? ((id) => _defaultGetBonusSpins(id));

  let spins;
  try {
    spins = await getBonusSpinsAvailable(memberId);
  } catch (e) {
    try { $w('#bonusSpinCTA').hide(); } catch (_) {}
    return;
  }

  if (spins > 0) {
    const label = spins === 1 ? 'You have 1 bonus spin!' : `You have ${spins} bonus spins!`;
    try { $w('#bonusSpinCTA').text = label; } catch (_) {}
    try { $w('#bonusSpinCTA').show(); } catch (_) {}
    try {
      $w('#bonusSpinCTA').onClick(() => {
        try { $w('#spinWheelLightbox').show(); } catch (_) {}
      });
    } catch (_) {}
    try {
      $w('#spinWheelCloseBtn').onClick(() => {
        try { $w('#spinWheelLightbox').hide(); } catch (_) {}
      });
    } catch (_) {}
  } else {
    try { $w('#bonusSpinCTA').hide(); } catch (_) {}
  }
}

/**
 * Returns true when the member has at least one bonus spin available.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]
 * @param {Function} [opts.getBonusSpinsAvailable]
 * @returns {Promise<boolean>}
 */
export async function hasBonusSpins(memberId, opts = {}) {
  const getBonusSpinsAvailable = opts.getBonusSpinsAvailable ?? ((id) => _defaultGetBonusSpins(id));
  try {
    const spins = await getBonusSpinsAvailable(memberId);
    return spins > 0;
  } catch (e) {
    return false;
  }
}
