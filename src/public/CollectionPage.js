/**
 * Collection page public module — wires gamification features for collection browsing.
 * Imported by the Collection page Velo controller ($w.onReady).
 *
 * CF-gamif2
 */
import { initLoyaltyBadge } from './LoyaltyBadgeWidget';

/**
 * Initialise gamification widgets on the Collection page.
 * Call from $w.onReady in the Collection page Velo file.
 *
 * @param {Object} [opts] - Injectable overrides for testing
 * @returns {Promise<void>}
 */
export async function initCollectionPage(opts = {}) {
  await initLoyaltyBadge(opts);
}
