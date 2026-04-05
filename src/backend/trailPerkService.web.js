/**
 * @module trailPerkService.web
 * @description Perk delivery for Blue Ridge Trail completions (CF-mcyh.2).
 *
 * Perks:
 *   perk-free-shipping  — free white-glove delivery coupon (Spring trail)
 *   perk-early-access   — clearance early-access email notification (Summer trail)
 *   perk-styling-call   — personal styling call booking link (Fall trail)
 *
 * Collections:
 *   MemberTrailPerks  — dedup: { _id, memberId, perkId, deliveredAt, couponCode? }
 *
 * Exports:
 *   deliverTrailPerk(memberId, perkId) — called on trail completion
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

export const TRAIL_PERKS_COLLECTION = 'MemberTrailPerks';
const EMAIL_QUEUE_COLLECTION = 'EmailQueue';

// ── Perk definitions ──────────────────────────────────────────────────────────

/**
 * Generate CF-XXXXXXXX coupon code using unambiguous alphanumerics.
 * Local to this module — does not depend on rewardsStore coupon namespace.
 */
function generatePerkCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TRAIL-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const PERK_EMAIL_TEMPLATES = {
  'perk-free-shipping': 'trail_perk_free_shipping',
  'perk-early-access': 'trail_perk_early_access',
  'perk-styling-call': 'trail_perk_styling_call',
};

const VALID_PERK_IDS = new Set(Object.keys(PERK_EMAIL_TEMPLATES));

// ── deliverTrailPerk ──────────────────────────────────────────────────────────

/**
 * Delivers a trail completion perk to a member.
 *
 * Idempotent: if the member already has a record for this perkId in
 * MemberTrailPerks, returns the existing record without re-sending.
 *
 * For perk-free-shipping: generates a unique TRAIL- coupon code and queues
 *   a trail_perk_free_shipping email with the code.
 * For perk-early-access: queues a trail_perk_early_access email.
 * For perk-styling-call: queues a trail_perk_styling_call email with booking link.
 *
 * @param {string} memberId
 * @param {string} perkId  — one of: perk-free-shipping, perk-early-access, perk-styling-call
 * @param {string} recipientEmail
 * @returns {Promise<{ success: boolean, alreadyDelivered?: boolean, couponCode?: string, error?: string }>}
 */
export const deliverTrailPerk = webMethod(
  Permissions.Admin,
  async (memberId, perkId, recipientEmail) => {
  if (!memberId || typeof memberId !== 'string') {
    return { success: false, error: 'memberId is required.' };
  }
  if (!VALID_PERK_IDS.has(perkId)) {
    return { success: false, error: `Unknown perkId: ${perkId}. Valid: ${[...VALID_PERK_IDS].join(', ')}.` };
  }
  if (!recipientEmail || typeof recipientEmail !== 'string') {
    return { success: false, error: 'recipientEmail is required.' };
  }

  // Idempotency check — one perk per member per perkId
  const existingResult = await wixData
    .query(TRAIL_PERKS_COLLECTION)
    .eq('memberId', memberId)
    .eq('perkId', perkId)
    .limit(1)
    .find({ suppressAuth: true });

  if (existingResult.items.length > 0) {
    const existing = existingResult.items[0];
    return {
      success: true,
      alreadyDelivered: true,
      couponCode: existing.couponCode || null,
    };
  }

  // Generate coupon for free-shipping perk
  let couponCode = null;
  if (perkId === 'perk-free-shipping') {
    couponCode = generatePerkCouponCode();
  }

  // Record perk delivery
  const now = new Date();
  try {
    await wixData.insert(TRAIL_PERKS_COLLECTION, {
      _id: `${memberId}_${perkId}`,
      memberId,
      perkId,
      deliveredAt: now,
      ...(couponCode ? { couponCode } : {}),
    });
  } catch (err) {
    const msg = String(err?.message ?? err).toLowerCase();
    const isDuplicate = msg.includes('duplicate') || msg.includes('unique constraint');
    if (isDuplicate) {
      return { success: true, alreadyDelivered: true, couponCode };
    }
    logError(`trailPerkService — perk record insert failed for ${memberId} / ${perkId}`, err);
    return { success: false, error: 'Failed to record perk delivery.' };
  }

  // Queue email notification
  const templateId = PERK_EMAIL_TEMPLATES[perkId];
  try {
    await wixData.insert(EMAIL_QUEUE_COLLECTION, {
      templateId,
      recipientEmail,
      variables: {
        memberId,
        perkId,
        ...(couponCode ? { couponCode } : {}),
      },
      status: 'pending',
      createdAt: now,
    });
  } catch (err) {
    // Non-fatal: perk record is saved; email failure is best-effort
    logError(`trailPerkService — email queue insert failed for ${memberId} / ${perkId}`, err);
  }

    return { success: true, alreadyDelivered: false, couponCode };
  }
);

// Export for testing
export const _VALID_PERK_IDS = VALID_PERK_IDS;
export const _PERK_EMAIL_TEMPLATES = PERK_EMAIL_TEMPLATES;
export const _TRAIL_PERKS_COLLECTION = TRAIL_PERKS_COLLECTION;

// ── getTrailPerkStatus ────────────────────────────────────────────────────────

/**
 * Returns all trail perks delivered to a member.
 *
 * @param {string} memberId
 * @returns {Promise<{ success: boolean, perks: Array<{perkId: string, deliveredAt: Date, couponCode?: string}>, error?: string }>}
 */
export const getTrailPerkStatus = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (!memberId || typeof memberId !== 'string') {
      return { success: false, perks: [], error: 'memberId is required.' };
    }

    try {
      const result = await wixData
        .query(TRAIL_PERKS_COLLECTION)
        .eq('memberId', memberId)
        .find({ suppressAuth: true });

      const perks = result.items.map(r => ({
        perkId:      r.perkId,
        deliveredAt: r.deliveredAt,
        ...(r.couponCode ? { couponCode: r.couponCode } : {}),
      }));

      return { success: true, perks };
    } catch (err) {
      logError(`trailPerkService — getTrailPerkStatus failed for ${memberId}`, err);
      return { success: false, perks: [], error: 'Failed to load perk status.' };
    }
  }
);
