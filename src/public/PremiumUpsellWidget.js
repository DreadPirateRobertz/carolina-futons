/**
 * @module PremiumUpsellWidget
 * @description CF+ Premium membership upsell on Member Page.
 * Shows upsell CTA with benefit list for Mountain Guide+ tier members
 * who are not yet CF+ subscribers.
 *
 * Elements:
 *   #premiumUpsellSection  — Container (expand/collapse)
 *   #premiumUpsellTitle    — "Upgrade to CF+" heading
 *   #premiumBenefitsList   — Repeater or text list of benefits
 *   #premiumPriceText      — "$14.99/mo or $119.99/yr"
 *   #premiumSignupBtn      — CTA button linking to signup
 *   #premiumAlreadyMember  — "You're already a CF+ member!" (shown if subscribed)
 *
 * CF-ortb
 */

import { getPremiumUpsellData as _defaultGetUpsellData } from 'backend/premiumMembership.web';

const SIGNUP_URL = 'https://www.carolinafutons.com/cf-plus';

/**
 * Format plan prices for display.
 * @param {Array} plans
 * @returns {string}
 */
export function formatPlanPrices(plans) {
  if (!plans || plans.length === 0) return '';
  const monthly = plans.find(p => p.type === 'monthly');
  const annual = plans.find(p => p.type === 'annual');
  if (monthly && annual) {
    return `$${monthly.price}/mo or $${annual.price}/yr`;
  }
  if (monthly) return `$${monthly.price}/mo`;
  if (annual) return `$${annual.price}/yr`;
  return '';
}

/**
 * Initialise the premium upsell widget.
 *
 * @param {Object}   [opts]   Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getPremiumUpsellData]
 */
export async function initPremiumUpsellWidget(opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getUpsellData = opts.getPremiumUpsellData ?? (() => _defaultGetUpsellData());

  // Hide by default
  try { $w('#premiumUpsellSection').collapse(); } catch {}
  try { $w('#premiumAlreadyMember').hide(); } catch {}

  let data;
  try {
    data = await getUpsellData();
  } catch {
    return;
  }

  // Non-member or error
  if (!data) return;

  // Already a CF+ member — show confirmation, no upsell
  if (data.alreadyMember) {
    try { $w('#premiumAlreadyMember').show(); } catch {}
    try { $w('#premiumUpsellSection').expand(); } catch {}
    try { $w('#premiumSignupBtn').hide(); } catch {}
    try { $w('#premiumPriceText').hide(); } catch {}
    return;
  }

  // Not eligible (tier too low) — stay hidden
  if (!data.eligible) return;

  // Show upsell
  try { $w('#premiumUpsellTitle').text = 'Upgrade to CF+'; } catch {}

  // Benefits list
  if (data.benefits && data.benefits.length > 0) {
    try {
      $w('#premiumBenefitsList').text = data.benefits.map(b => `• ${b}`).join('\n');
    } catch {}
  }

  // Price
  try { $w('#premiumPriceText').text = formatPlanPrices(data.plans); } catch {}

  // Signup CTA
  try {
    $w('#premiumSignupBtn').onClick(() => {
      import('wix-location-frontend').then(({ to }) => to(SIGNUP_URL))
        .catch(() => {});
    });
  } catch {}

  try { $w('#premiumUpsellSection').expand(); } catch {}
}
