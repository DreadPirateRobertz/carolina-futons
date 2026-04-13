/**
 * Category page public module — wires gamification features for category browsing.
 * Imported by the Category page Velo controller ($w.onReady).
 *
 * CF-gamif2
 */
import { initLoyaltyBadge } from './LoyaltyBadgeWidget';

/**
 * Initialise gamification widgets on the Category page.
 * Call from $w.onReady in the Category page Velo file.
 *
 * @param {Object} [opts] - Injectable overrides for testing
 * @returns {Promise<void>}
 */
export async function initCategoryPage(opts = {}) {
  await initLoyaltyBadge(opts);
}
