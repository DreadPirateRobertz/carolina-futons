/**
 * @module pushTokenRegistry.web
 * @description Device push token registry for FCM/APNs.
 * Stores per-member device tokens in PushTokens CMS collection.
 * Used by pushNotificationService to dispatch to member devices.
 *
 * Exports:
 *   - PUSH_TOKENS_COLLECTION — CMS collection name
 *   - registerToken(memberId, token, platform) — upsert active token
 *   - deactivateToken(memberId, token) — mark token inactive
 *   - getActiveTokensForMember(memberId) — query active tokens
 */

import wixData from 'wix-data';

export const PUSH_TOKENS_COLLECTION = 'PushTokens';
const VALID_PLATFORMS = ['ios', 'android', 'web'];

/**
 * Register a device push token for a member.
 *
 * @param {string} memberId
 * @param {string} token     - FCM/APNs device token
 * @param {string} platform  - 'ios' | 'android' | 'web'
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function registerToken(memberId, token, platform) {
  if (!memberId) return { success: false, error: 'memberId is required' };
  if (!token) return { success: false, error: 'token is required' };
  if (!VALID_PLATFORMS.includes(platform)) {
    return { success: false, error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` };
  }
  try {
    await wixData.insert(
      PUSH_TOKENS_COLLECTION,
      { memberId, token, platform, active: true },
      { suppressAuth: true }
    );
    return { success: true };
  } catch (err) {
    console.error('[pushTokenRegistry] registerToken error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Return all active tokens for a member.
 *
 * @param {string} memberId
 * @returns {Promise<Array>}
 */
// idor-ok: internal helper — caller (webMethod or pushNotificationService) validates session ownership before passing memberId
export async function getActiveTokensForMember(memberId) {
  try {
    const result = await wixData
      .query(PUSH_TOKENS_COLLECTION)
      .eq('memberId', memberId)
      .eq('active', true)
      .find({ suppressAuth: true });
    return result.items;
  } catch (err) {
    console.error('[pushTokenRegistry] getActiveTokensForMember error:', err);
    return [];
  }
}

/**
 * Deactivate a specific device token for a member.
 * IDOR-safe: only deactivates tokens belonging to the given memberId.
 *
 * @param {string} memberId
 * @param {string} token
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
// idor-ok: internal helper — caller validates session ownership before passing memberId; scoped query ensures only member's own tokens are touched
export async function deactivateToken(memberId, token) {
  try {
    const result = await wixData
      .query(PUSH_TOKENS_COLLECTION)
      .eq('memberId', memberId)
      .eq('token', token)
      .find({ suppressAuth: true });
    if (!result.items.length) return { success: false, error: 'token not found' };
    const item = { ...result.items[0], active: false };
    await wixData.update(PUSH_TOKENS_COLLECTION, item, { suppressAuth: true });
    return { success: true };
  } catch (err) {
    console.error('[pushTokenRegistry] deactivateToken error:', err);
    return { success: false, error: err.message };
  }
}
