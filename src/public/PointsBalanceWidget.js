/**
 * @module PointsBalanceWidget
 * @description Member dashboard tile showing total loyalty points, current tier,
 * and an expiry warning when points are within the warning window.
 *
 * Elements:
 *   #pointsBalanceTile    — Text element displaying formatted total points
 *   #pointsTierLabel      — Text element displaying current tier name
 *   #pointsExpiryWarning  — Text element showing "Points expire in N days"
 *                           (visible only when expiry warning is active)
 *
 * CF-ht7v
 */

import { getEarningConfig } from 'backend/loyaltyBonusPoints.web';
import { getExpiryWarning } from 'backend/pointsExpiryService.web';
import { getTierForPoints } from 'public/gamificationTokens';

/**
 * Initialise the points balance widget.
 *
 * @param {Function}  $w         Wix element selector
 * @param {string}    memberId   Member ID to fetch expiry data for
 * @param {Object}    [opts]     Injectable overrides (for testing)
 * @param {Function}  [opts.getEarningConfig]  Defaults to backend getEarningConfig
 * @param {Function}  [opts.getExpiryWarning]  Defaults to backend getExpiryWarning(memberId)
 */
export async function initPointsBalanceWidget($w, memberId, opts = {}) {
  const _getEarningConfig = opts.getEarningConfig ?? getEarningConfig;
  const _getExpiryWarning = opts.getExpiryWarning ?? ((id) => getExpiryWarning(id));

  const [, expiryResult] = await Promise.allSettled([
    _getEarningConfig(),
    _getExpiryWarning(memberId),
  ]);

  const expiry = expiryResult.status === 'fulfilled' ? expiryResult.value : null;
  const totalPoints = (expiry && expiry.totalPoints != null) ? expiry.totalPoints : 0;
  const tier = getTierForPoints(totalPoints);

  try { $w('#pointsBalanceTile').text = totalPoints.toLocaleString('en-US'); } catch (e) {}
  try { $w('#pointsTierLabel').text = tier; } catch (e) {}

  if (expiry && expiry.daysUntilExpiry != null) {
    try {
      $w('#pointsExpiryWarning').text = `Points expire in ${expiry.daysUntilExpiry} days`;
      $w('#pointsExpiryWarning').show();
    } catch (e) {}
  } else {
    try { $w('#pointsExpiryWarning').hide(); } catch (e) {}
  }
}
