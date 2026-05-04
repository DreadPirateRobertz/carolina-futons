/**
 * @module unsubscribeService
 * @description Account-level email preferences — lets site members check and
 * manage their own opt-out status from /account/preferences.
 *
 * Unsubscribe token generation and HTTP endpoint logic live in:
 *   backend/utils/unsubToken.js       — HMAC-signed tokens
 *   backend/http-functions.js          — GET/POST /_functions/unsubscribe
 *   backend/emailAutomation.web.js     — unsubscribeContact / opt-out check
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logAuditEvent } from 'backend/utils/auditLog';

/**
 * Allows site members to check their own opt-out status.
 * Used by /account/preferences to show current email preferences.
 */
export const getEmailOptOutStatus = webMethod(
  Permissions.SiteMember,
  async (email) => {
    try {
      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) return { success: false, optedOut: false };

      const result = await wixData.query('Unsubscribes')
        .eq('email', cleanEmail)
        .limit(1)
        .find({ suppressAuth: true });

      const optedOut = result.items.some(item => item.sequenceType === 'all');
      return { success: true, optedOut };
    } catch (err) {
      console.error('[unsubscribeService] getEmailOptOutStatus error:', err);
      return { success: false, optedOut: false };
    }
  }
);

/**
 * Allows site members to re-subscribe from /account/preferences.
 */
export const resubscribeContact = webMethod(
  Permissions.SiteMember,
  async (email) => {
    try {
      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) return { success: false };

      const { allowed } = await checkRateLimit('ResubscribeRateLimit', cleanEmail, { max: 5, windowMs: 3_600_000 });
      if (!allowed) return { success: false, error: 'rate_limited' };

      const optOutRecords = await wixData.query('Unsubscribes')
        .eq('email', cleanEmail)
        .find({ suppressAuth: true });

      for (const record of optOutRecords.items) {
        await wixData.remove('Unsubscribes', record._id, { suppressAuth: true });
      }

      logAuditEvent('Unsubscribes', 'resubscribe', cleanEmail, {});
      return { success: true };
    } catch (err) {
      console.error('[unsubscribeService] resubscribeContact error:', err);
      return { success: false };
    }
  }
);
