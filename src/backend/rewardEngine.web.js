/**
 * @module rewardEngine.web
 * @description Auto-delivers tier perks when a member is promoted (CF-c6el.2),
 * and provides perk resolution for the Loyalty page "Your Perks" section (CF-c6el.3).
 *
 * Generates coupon codes, triggers notification emails, tracks delivery
 * idempotently via TierPerkDeliveries collection, and returns cumulative
 * unlocked perks plus next-tier teaser.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { getNewPerksOnPromotion, PERK_TYPES, TIER_PERKS, TIER_PERK_CATALOG, TIER_NAMES, TIER_THRESHOLDS, getTierForPoints } from 'public/gamificationTokens.js';

const DELIVERIES_COLLECTION = 'TierPerkDeliveries';
const MEMBER_POINTS_COLLECTION = 'MemberPoints';

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
  logError('generateUniqueCouponCode — exhausted 5 retries, returning unchecked code');
  return generateCouponCode();
}

/**
 * Deliver all new perks for a tier promotion. Idempotent — checks
 * TierPerkDeliveries for prior delivery of each perk type to the member.
 *
 * @param {string} memberId
 * @param {string|null} prevTier - tier before promotion (null if new member)
 * @param {string} newTier - tier after promotion
 * @returns {Promise<{ delivered: Array<{type: string, label: string, couponCode?: string, bookingUrl?: string}>, skipped: string[], failed: string[] }>}
 */
export const deliverTierPerks = webMethod(
  Permissions.Admin,
  async (memberId, prevTier, newTier) => {
    if (!memberId || !newTier) return { delivered: [], skipped: [], failed: [] };

    const newPerks = getNewPerksOnPromotion(prevTier, newTier);
    if (!newPerks.length) return { delivered: [], skipped: [], failed: [] };

    // Check which perks have already been delivered (dedup)
    const existingResult = await wixData
      .query(DELIVERIES_COLLECTION)
      .eq('memberId', memberId)
      .find({ suppressAuth: true });
    const deliveredTypes = new Set(existingResult.items.map(d => d.perkType));

    const delivered = [];
    const skipped = [];
    const failed = [];

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
        failed.push(perk.type);
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

    return { delivered, skipped, failed };
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the index of a tier in TIER_NAMES by display name, or -1 if not found.
 * @param {string} tierName  Display name e.g. 'Mountain Guide'
 * @returns {number}
 */
function tierIndex(tierName) {
  return TIER_NAMES.findIndex(t => t.name === tierName);
}

/**
 * Returns the TIER_THRESHOLDS key (e.g. 'MOUNTAIN_GUIDE') for a tier display name.
 * @param {string} tierName
 * @returns {string}
 */
function tierKey(tierName) {
  return tierName.toUpperCase().replace(/ /g, '_');
}

// ── getMemberDeliveredPerks ───────────────────────────────────────────────────

/**
 * Returns the unlocked tier perks for the authenticated member plus a teaser
 * of the next tier's perks. Used by LoyaltyPerksWidget on the Loyalty page.
 *
 * Perks are cumulative: a Summit Master member has all Trail Blazer,
 * Mountain Guide, and Summit Master perks unlocked.
 *
 * @returns {Promise<{
 *   success: boolean,
 *   currentTierName: string,
 *   currentTierKey: string,
 *   totalPoints: number,
 *   unlockedPerks: Array<{ tierKey: string, tierName: string, perkId: string, label: string, description: string, icon: string }>,
 *   nextTierName: string|null,
 *   nextTierKey: string|null,
 *   nextTierPointsNeeded: number|null,
 *   nextTierPerks: Array<{ perkId: string, label: string, description: string, icon: string }>|null,
 *   error?: string
 * }>}
 * @permission SiteMember
 */
export const getMemberDeliveredPerks = webMethod(Permissions.SiteMember, async () => {
  let member;
  try {
    member = await currentMember.getMember();
  } catch {
    member = null;
  }

  if (!member?._id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const result = await wixData.query(MEMBER_POINTS_COLLECTION)
      .eq('memberId', member._id)
      .limit(1)
      .find();

    const record = result.items[0];
    const totalPoints = record?.totalPoints ?? 0;
    const currentTierName = getTierForPoints(totalPoints);
    const idx = tierIndex(currentTierName);
    const currentTierKey = tierKey(currentTierName);

    // Collect all display perks for tiers at or below the current tier (cumulative).
    // TIER_PERK_CATALOG is the ordered array of display-layer perks (has perkId,
    // label, description, icon). TIER_PERKS is the delivery-grants object — different.
    const unlockedPerks = [];
    for (let i = 0; i <= idx; i++) {
      const group = TIER_PERK_CATALOG[i];
      for (const perk of (group?.perks ?? [])) {
        unlockedPerks.push({
          tierKey: group.tierKey,
          tierName: group.tierName,
          perkId: perk.perkId,
          label: perk.label,
          description: perk.description,
          icon: perk.icon,
        });
      }
    }

    // Next tier teaser
    const nextGroup = idx < TIER_PERK_CATALOG.length - 1 ? TIER_PERK_CATALOG[idx + 1] : null;
    const nextTierName = nextGroup?.tierName ?? null;
    const nextTierKey = nextGroup?.tierKey ?? null;
    const nextTierThreshold = nextTierKey ? (TIER_THRESHOLDS[nextTierKey] ?? null) : null;
    const nextTierPerks = nextGroup
      ? nextGroup.perks.map(p => ({ perkId: p.perkId, label: p.label, description: p.description, icon: p.icon }))
      : null;

    return {
      success: true,
      currentTierName,
      currentTierKey,
      totalPoints,
      unlockedPerks,
      nextTierName,
      nextTierKey,
      nextTierPointsNeeded: nextTierThreshold !== null ? Math.max(0, nextTierThreshold - totalPoints) : null,
      nextTierPerks,
    };
  } catch {
    return { success: false, error: 'Failed to load perks' };
  }
});
