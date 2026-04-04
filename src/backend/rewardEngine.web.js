/**
 * @module rewardEngine.web
 * @description Auto-delivers tier perks when a member is promoted.
 * Generates coupon codes, triggers notification emails, and tracks delivery
 * idempotently via TierPerkDeliveries collection.
 *
 * Called from gamificationCore.web.js on tier_upgraded events.
 *
 * CF-c6el.2
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { getNewPerksOnPromotion, PERK_TYPES } from 'public/gamificationTokens.js';

const DELIVERIES_COLLECTION = 'TierPerkDeliveries';

const STYLING_CALL_BOOKING_URL = 'https://calendly.com/carolinafutons-brenda/styling-call';

function logError(msg, err) {
  console.error(`[rewardEngine] ${msg}`, err?.message ?? err ?? '');
}

/**
 * Generate CF-XXXXXXXX coupon code (same alphabet as rewardsStore — excludes O/0/I/1).
 * @returns {string}
 */
function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CF-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate a unique coupon code, checking TierPerkDeliveries for collisions.
 * @returns {Promise<string>}
 */
async function generateUniqueCouponCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCouponCode();
    const existing = await wixData
      .query(DELIVERIES_COLLECTION)
      .eq('couponCode', code)
      .limit(1)
      .find({ suppressAuth: true });
    if (existing.items.length === 0) return code;
  }
  return generateCouponCode();
}

/**
 * Deliver all new perks for a tier promotion. Idempotent — checks
 * TierPerkDeliveries for prior delivery of each perk type to the member.
 *
 * @param {string} memberId
 * @param {string} prevTier - tier before promotion
 * @param {string} newTier - tier after promotion
 * @returns {Promise<{ delivered: Array<{type: string, couponCode?: string, bookingUrl?: string}>, skipped: string[] }>}
 */
export const deliverTierPerks = webMethod(
  Permissions.Admin,
  async (memberId, prevTier, newTier) => {
    if (!memberId || !newTier) return { delivered: [], skipped: [] };

    const newPerks = getNewPerksOnPromotion(prevTier, newTier);
    if (!newPerks.length) return { delivered: [], skipped: [] };

    // Check which perks have already been delivered (dedup)
    const existingResult = await wixData
      .query(DELIVERIES_COLLECTION)
      .eq('memberId', memberId)
      .find({ suppressAuth: true });
    const deliveredTypes = new Set(existingResult.items.map(d => d.perkType));

    const delivered = [];
    const skipped = [];

    for (const perk of newPerks) {
      if (deliveredTypes.has(perk.type)) {
        skipped.push(perk.type);
        continue;
      }

      const record = {
        _id: `${memberId}_${perk.type}`,
        memberId,
        perkType: perk.type,
        tier: newTier,
        deliveredAt: new Date().toISOString(),
      };

      const result = { type: perk.type, label: perk.label };

      if (perk.delivery === 'coupon_email') {
        const couponCode = await generateUniqueCouponCode();
        record.couponCode = couponCode;
        result.couponCode = couponCode;
      }

      if (perk.type === PERK_TYPES.STYLING_CALL) {
        record.bookingUrl = STYLING_CALL_BOOKING_URL;
        result.bookingUrl = STYLING_CALL_BOOKING_URL;
      }

      try {
        await wixData.insert(DELIVERIES_COLLECTION, record, { suppressAuth: true });
      } catch (err) {
        // Duplicate _id = already delivered (race condition guard)
        if (err?.message?.includes('duplicate') || err?.message?.includes('already exists')) {
          skipped.push(perk.type);
          continue;
        }
        logError(`insert failed for ${memberId} perk ${perk.type}`, err);
        continue;
      }

      delivered.push(result);
    }

    // Send tier-up notification email with perk summary (best-effort)
    if (delivered.length > 0) {
      try {
        await sendTierPerkEmail(memberId, newTier, delivered);
      } catch (err) {
        logError(`email failed for ${memberId}`, err);
      }
    }

    return { delivered, skipped };
  }
);

/**
 * Send a tier promotion email listing newly unlocked perks.
 * Uses triggeredEmails.emailMember with template 'tier_perk_unlock'.
 *
 * @param {string} memberId
 * @param {string} newTier
 * @param {Array<{type: string, couponCode?: string, bookingUrl?: string}>} deliveredPerks
 */
async function sendTierPerkEmail(memberId, newTier, deliveredPerks) {
  const { triggeredEmails } = await import('wix-crm-backend');

  const perkSummary = deliveredPerks.map(d => {
    let line = d.label;
    if (d.couponCode) line += ` (code: ${d.couponCode})`;
    if (d.bookingUrl) line += ` — Book here: ${d.bookingUrl}`;
    return line;
  }).join('\n');

  const couponCodes = deliveredPerks
    .filter(d => d.couponCode)
    .map(d => d.couponCode)
    .join(', ');

  await triggeredEmails.emailMember(
    'tier_perk_unlock',
    memberId,
    {
      variables: {
        tierName: newTier,
        perkSummary,
        couponCodes: couponCodes || 'None',
        bookingUrl: deliveredPerks.find(d => d.bookingUrl)?.bookingUrl || '',
      },
    }
  );
}

/**
 * Look up all perks delivered to a member (for member page display).
 *
 * @param {string} memberId
 * @returns {Promise<Array<{perkType: string, tier: string, couponCode?: string, bookingUrl?: string, deliveredAt: string}>>}
 */
export const getMemberDeliveredPerks = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (!memberId) return [];
    const result = await wixData
      .query(DELIVERIES_COLLECTION)
      .eq('memberId', memberId)
      .find({ suppressAuth: true });
    return result.items.map(({ perkType, tier, couponCode, bookingUrl, deliveredAt }) => ({
      perkType, tier, couponCode, bookingUrl, deliveredAt,
    }));
  }
);
