/**
 * @module customEvents
 * @description Canonical custom event taxonomy for GA4 funnel analytics.
 *
 * Defines 24 custom events across 12 feature categories, provides a typed
 * trackCustomEvent function that writes to the AnalyticsEvents CMS collection,
 * and maps organic event names (from page-level trackEvent calls) to the
 * canonical taxonomy.
 *
 * CF-w62s
 */
import { Permissions, webMethod } from 'wix-web-module';
import { insertAnalyticsEvent } from 'backend/utils/analyticsEvents';
import { sanitize } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';

// ── Canonical Event Taxonomy ────────────────────────────────────────
// GA4 custom event names. All lowercase, underscore-separated.
// Grouped by feature for documentation clarity.

export const CUSTOM_EVENTS = {
  // Style Quiz funnel
  quiz_started: { category: 'quiz', description: 'User begins the style quiz' },
  quiz_completed: { category: 'quiz', description: 'User completes all quiz steps' },
  quiz_lead_captured: { category: 'quiz', description: 'User submits email during/after quiz' },

  // Fabric Swatches
  swatch_requested: { category: 'swatch', description: 'User requests a fabric swatch sample' },
  swatch_to_purchase: { category: 'swatch', description: 'Swatch requester later purchases (attribution)' },

  // Bundle Deals
  bundle_viewed: { category: 'bundle', description: 'User views a bundle offer' },
  bundle_added: { category: 'bundle', description: 'User adds bundle to cart' },
  bundle_purchased: { category: 'bundle', description: 'Bundle order completed' },

  // Loyalty Program
  loyalty_enrolled: { category: 'loyalty', description: 'User signs up for CF+ loyalty' },
  loyalty_redeemed: { category: 'loyalty', description: 'User redeems loyalty points' },

  // Spin Wheel
  spin_played: { category: 'spin', description: 'User spins the prize wheel' },
  spin_won: { category: 'spin', description: 'User wins a spin wheel prize' },
  spin_converted: { category: 'spin', description: 'Spin winner makes a purchase' },

  // Referral Program
  referral_shared: { category: 'referral', description: 'User shares a referral link' },
  referral_converted: { category: 'referral', description: 'Referred user makes a purchase' },

  // Reviews
  review_submitted: { category: 'review', description: 'User submits a product review' },
  review_with_photo: { category: 'review', description: 'User submits a review with photo' },

  // Financing
  financing_calculated: { category: 'financing', description: 'User calculates financing terms' },
  financing_applied: { category: 'financing', description: 'User applies for financing' },

  // Compare Tool
  compare_started: { category: 'compare', description: 'User adds first product to compare' },
  compare_to_cart: { category: 'compare', description: 'User adds to cart from compare view' },

  // Room Planner
  room_planner_used: { category: 'room_planner', description: 'User interacts with room planner' },
  room_planner_to_cart: { category: 'room_planner', description: 'User adds to cart from room planner' },

  // PDP Shipping
  shipping_estimated: { category: 'shipping', description: 'User views shipping estimate on PDP' },

  // Consultation
  consultation_booked: { category: 'consultation', description: 'User books a design consultation' },
};

// ── Organic → Canonical Event Map ───────────────────────────────────
// Maps existing trackEvent names (from page files) to canonical names.

const EVENT_NAME_MAP = {
  quiz_start: 'quiz_started',
  quiz_complete: 'quiz_completed',
  email_captured: 'quiz_lead_captured',
  swatch_request: 'swatch_requested',
  financing_calculate: 'financing_calculated',
  financing_apply: 'financing_applied',
  room_planner_add_product: 'room_planner_used',
  room_planner_save: 'room_planner_used',
  spin_wheel: 'spin_played',
  reward_redeemed: 'loyalty_redeemed',
  loyalty_dashboard_view: 'loyalty_enrolled',
  compare_add: 'compare_started',
};

/**
 * Normalize an event name to canonical taxonomy.
 * Returns the canonical name if mapped, or the original if already canonical.
 *
 * @param {string} eventName - Raw event name from caller
 * @returns {string} Canonical event name
 */
export function normalizeEventName(eventName) {
  if (!eventName) return '';
  const cleaned = eventName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  return EVENT_NAME_MAP[cleaned] || cleaned;
}

/**
 * Track a custom analytics event. Writes to AnalyticsEvents CMS collection.
 * Rate-limited to 30 events per minute per source to prevent abuse.
 *
 * @param {string} eventName - Canonical event name (from CUSTOM_EVENTS)
 * @param {Object} [params={}] - Event-specific parameters
 * @param {string} [params.memberId] - Logged-in member ID (null for anonymous)
 * @param {string} [params.source] - Feature source (auto-detected from eventName if omitted)
 * @returns {Promise<{success: boolean}>}
 * @permission Anyone
 */
export const trackCustomEvent = webMethod(
  Permissions.Anyone,
  async (eventName, params = {}) => {
    try {
      if (!eventName || typeof eventName !== 'string') {
        return { success: false };
      }

      const canonical = normalizeEventName(eventName);
      const eventDef = CUSTOM_EVENTS[canonical];
      const source = sanitize(params.source || (eventDef ? eventDef.category : 'custom'), 50);

      const { allowed } = await checkRateLimit(
        'CustomEventRateLimit',
        source,
        { max: 30, windowMs: 60_000 }
      );
      if (!allowed) return { success: false };

      await insertAnalyticsEvent({
        memberId: params.memberId || null,
        eventType: canonical,
        source,
        payload: {
          ...params,
          originalEventName: eventName !== canonical ? eventName : undefined,
        },
      });

      return { success: true };
    } catch (err) {
      console.error('[customEvents] trackCustomEvent error:', err);
      return { success: false };
    }
  }
);

/**
 * Get all valid custom event names for documentation/validation.
 * @returns {string[]}
 * @permission Anyone
 */
export const getEventTaxonomy = webMethod(
  Permissions.Anyone,
  () => Object.keys(CUSTOM_EVENTS)
);
