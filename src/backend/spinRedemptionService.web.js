/**
 * @module spinRedemptionService.web
 * @description Bonus spin grant and redemption flow.
 * Spins are granted by rewardEngine on qualifying events and expire after 30 days.
 * Redemption is idempotent and IDOR-guarded (memberId checked on every operation).
 *
 * CMS collection: SpinGrants
 *   _id, memberId, grantedAt, expiresAt, redeemedAt, reward, rewardValue, status
 *
 * Exports:
 *   - SPIN_GRANTS_COLLECTION
 *   - grantSpin(memberId) — insert a pending spin with 30-day expiry
 *   - getPendingSpins(memberId) — query non-expired pending spins for member
 *   - redeemSpin(memberId, spinId, { reward, rewardValue }) — mark redeemed
 */

import wixData from 'wix-data';

export const SPIN_GRANTS_COLLECTION = 'SpinGrants';
const SPIN_EXPIRY_DAYS = 30;

/**
 * Grant a spin to a member (pending, expires in 30 days).
 *
 * @param {string} memberId
 * @returns {Promise<{ success: boolean, spinId?: string, error?: string }>}
 */
export async function grantSpin(memberId) {
  if (!memberId) return { success: false, error: 'memberId is required' };
  try {
    const expiresAt = new Date(Date.now() + 86400000 * SPIN_EXPIRY_DAYS);
    const item = await wixData.insert(
      SPIN_GRANTS_COLLECTION,
      {
        memberId,
        grantedAt: new Date(),
        expiresAt,
        status: 'pending',
        redeemedAt: null,
        reward: null,
        rewardValue: null,
      },
      { suppressAuth: true }
    );
    return { success: true, spinId: item._id };
  } catch (err) {
    console.error('[spinRedemptionService] grantSpin error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Return pending, non-expired spins for a member.
 *
 * @param {string} memberId
 * @returns {Promise<Array>}
 */
export async function getPendingSpins(memberId) {
  try {
    const result = await wixData
      .query(SPIN_GRANTS_COLLECTION)
      .eq('memberId', memberId)
      .eq('status', 'pending')
      .ge('expiresAt', new Date())
      .find({ suppressAuth: true });
    return result.items;
  } catch (err) {
    console.error('[spinRedemptionService] getPendingSpins error:', err);
    return [];
  }
}

/**
 * Redeem a spin grant for a member.
 * IDOR-safe: memberId must match the grant's memberId.
 *
 * @param {string} memberId
 * @param {string} spinId
 * @param {{ reward: string, rewardValue: any }} rewardData
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function redeemSpin(memberId, spinId, { reward, rewardValue }) {
  try {
    const item = await wixData.get(SPIN_GRANTS_COLLECTION, spinId, { suppressAuth: true });
    if (!item) return { success: false, error: 'spin not found' };
    if (item.memberId !== memberId) return { success: false, error: 'spin belongs to another member' };
    if (item.status === 'redeemed') return { success: false, error: 'already redeemed' };
    if (item.status === 'expired' || new Date(item.expiresAt) < new Date()) {
      return { success: false, error: 'spin expired' };
    }
    await wixData.update(
      SPIN_GRANTS_COLLECTION,
      { ...item, status: 'redeemed', redeemedAt: new Date(), reward, rewardValue },
      { suppressAuth: true }
    );
    return { success: true };
  } catch (err) {
    console.error('[spinRedemptionService] redeemSpin error:', err);
    return { success: false, error: err.message };
  }
}
