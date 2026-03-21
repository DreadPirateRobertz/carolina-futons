/**
 * @module emailABService
 * @description A/B testing infrastructure for transactional emails.
 * Provides deterministic variant assignment (memberId+campaignId hash),
 * send logging to the EmailABLog CMS collection, conversion marking
 * (triggered by klaviyoWebhook click events), and a results query endpoint.
 *
 * @setup
 * Create `EmailABLog` CMS collection with fields:
 *   memberId (text), recipientEmail (text), campaignId (text),
 *   variant (text: A|B), sentAt (dateTime), converted (boolean),
 *   convertedAt (dateTime, nullable)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

// ── Campaign Definitions ──────────────────────────────────────────────
// Each campaign maps variant keys to subject-line overrides.
// Subject lines are injected as template variables by the caller.

export const CAMPAIGNS = {
  welcome_step1: {
    A: { subjectLine: "Welcome to Carolina Futons — here's 10% off your first order" },
    B: { subjectLine: 'Your 10% welcome gift is inside, {firstName}' },
  },
  cart_recovery_step1: {
    A: { subjectLine: 'You left something behind — your cart is waiting' },
    B: { subjectLine: 'Still thinking it over? Your futon is almost gone' },
  },
};

// ── assignVariant ─────────────────────────────────────────────────────

/**
 * Deterministically assign A or B based on a hash of memberId+campaignId.
 * The same pair always produces the same variant — no cross-contamination.
 *
 * @param {string} memberId - Wix member ID.
 * @param {string} campaignId - Campaign identifier (e.g. 'welcome_step1').
 * @returns {'A'|'B'} Variant assignment.
 */
export function assignVariant(memberId, campaignId) {
  const key = `${memberId}:${campaignId}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2 === 0) ? 'A' : 'B';
}

// ── logABSend ─────────────────────────────────────────────────────────

/**
 * Record an A/B email send in the EmailABLog collection.
 *
 * @param {string} memberId - Wix member ID.
 * @param {string} recipientEmail - Recipient email address.
 * @param {string} campaignId - Campaign identifier.
 * @param {'A'|'B'} variant - The variant that was sent.
 * @returns {Promise<void>}
 */
export async function logABSend(memberId, recipientEmail, campaignId, variant) {
  await wixData.insert('EmailABLog', {
    memberId,
    recipientEmail: recipientEmail.toLowerCase().trim(),
    campaignId,
    variant,
    sentAt: new Date(),
    converted: false,
    convertedAt: null,
  });
}

// ── markABConversion ──────────────────────────────────────────────────

/**
 * Mark the first unconverted EmailABLog record for email+campaign as converted.
 * Called from the klaviyoWebhook handler on `email_clicked` events.
 *
 * @param {string} email - Recipient email from Klaviyo click payload.
 * @param {string} campaignId - Campaign identifier from click payload.
 * @returns {Promise<{updated: boolean}>}
 */
export async function markABConversion(email, campaignId) {
  const cleanEmail = email.toLowerCase().trim();
  const { items } = await wixData.query('EmailABLog')
    .eq('recipientEmail', cleanEmail)
    .eq('campaignId', campaignId)
    .eq('converted', false)
    .limit(1)
    .find();

  if (!items.length) return { updated: false };

  const record = items[0];
  await wixData.update('EmailABLog', {
    ...record,
    converted: true,
    convertedAt: new Date(),
  });
  return { updated: true };
}

// ── getABResult ───────────────────────────────────────────────────────

/**
 * Return sent and converted counts per variant for a campaign.
 * Admin-only — intended for analytics dashboards and reporting.
 *
 * @function getABResult
 * @param {string} campaignId - Campaign identifier.
 * @returns {Promise<{campaignId: string, A: {sent: number, converted: number}, B: {sent: number, converted: number}}>}
 */
export const getABResult = webMethod(
  Permissions.Admin,
  async (campaignId) => {
    if (!campaignId || typeof campaignId !== 'string') {
      return { error: 'invalid_campaign_id' };
    }

    const [aSent, aConverted, bSent, bConverted] = await Promise.all([
      wixData.query('EmailABLog').eq('campaignId', campaignId).eq('variant', 'A').count(),
      wixData.query('EmailABLog').eq('campaignId', campaignId).eq('variant', 'A').eq('converted', true).count(),
      wixData.query('EmailABLog').eq('campaignId', campaignId).eq('variant', 'B').count(),
      wixData.query('EmailABLog').eq('campaignId', campaignId).eq('variant', 'B').eq('converted', true).count(),
    ]);

    return {
      campaignId,
      A: { sent: aSent, converted: aConverted },
      B: { sent: bSent, converted: bConverted },
    };
  }
);
