/**
 * @module SubscribeAndSave
 * @description Product page widget showing "Subscribe & Save 10%" for eligible products.
 *
 * Elements:
 *   #subscribeSection     — Container for the entire subscribe option
 *   #subscribeToggle      — Checkbox/toggle to opt into subscription
 *   #subscribeLabel       — Text: "Subscribe & Save 10%"
 *   #subscribeFrequency   — Dropdown for delivery frequency
 *   #subscribeDiscount    — Text: discount amount preview
 *
 * CF-wzv8
 */

import { isProductSubscribable as _defaultCheck, getSubscriptionPlans as _defaultPlans, createSubscription as _defaultCreate } from 'backend/subscriptionService.web';

/**
 * Initialise the Subscribe & Save section on a product page.
 *
 * @param {string}   productId    Product to check eligibility for
 * @param {string}   productName  Product display name
 * @param {Object}   [opts]       Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.isProductSubscribable]
 * @param {Function} [opts.getSubscriptionPlans]
 * @param {Function} [opts.createSubscription]
 */
export async function initSubscribeAndSave(productId, productName, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const checkEligibility = opts.isProductSubscribable ?? ((id) => _defaultCheck(id));
  const getPlans = opts.getSubscriptionPlans ?? (() => _defaultPlans());
  const createSub = opts.createSubscription ?? ((o) => _defaultCreate(o));

  let eligibility;
  try {
    eligibility = await checkEligibility(productId);
  } catch {
    eligibility = null;
  }

  if (!eligibility || !eligibility.subscribable) {
    try { $w('#subscribeSection').hide(); } catch (_) {}
    return { subscribed: false };
  }

  try { $w('#subscribeSection').show(); } catch (_) {}
  try { $w('#subscribeLabel').text = `Subscribe & Save ${eligibility.discount}%`; } catch (_) {}

  // Load frequency options into dropdown
  let plans = [];
  try {
    plans = await getPlans();
  } catch (_) {}

  if (plans.length > 0) {
    try {
      $w('#subscribeFrequency').options = plans.map(p => ({
        label: p.label,
        value: p.frequency,
      }));
      $w('#subscribeFrequency').value = plans[0].frequency;
    } catch (_) {}
  }

  // Track subscription opt-in state
  const state = { enabled: false, frequency: plans[0]?.frequency || 'monthly' };

  try {
    $w('#subscribeToggle').onChange(() => {
      state.enabled = !!$w('#subscribeToggle').checked;
      try {
        if (state.enabled) {
          $w('#subscribeFrequency').show();
          $w('#subscribeDiscount').text = `You save ${eligibility.discount}% on every delivery`;
          $w('#subscribeDiscount').show();
        } else {
          $w('#subscribeFrequency').hide();
          $w('#subscribeDiscount').hide();
        }
      } catch (_) {}
    });
  } catch (_) {}

  try {
    $w('#subscribeFrequency').onChange(() => {
      state.frequency = $w('#subscribeFrequency').value;
    });
  } catch (_) {}

  return {
    get subscribed() { return state.enabled; },
    get frequency() { return state.frequency; },
    async createOnCheckout() {
      if (!state.enabled) return null;
      try {
        return await createSub({
          productId,
          productName,
          frequency: state.frequency,
          quantity: 1,
        });
      } catch (e) {
        console.warn('[SubscribeAndSave] createOnCheckout failed:', e?.message);
        return { success: false, message: 'Failed to create subscription' };
      }
    },
  };
}
