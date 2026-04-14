/**
 * @module marketingSequences.web
 * @description Lifecycle email sequence triggers for CF-5io3.
 *
 * Five sequences, all CMS-driven via the EmailSequences collection:
 *   welcome       — day 0 (delayHours: 0)
 *   cart_abandon  — 1hr delay, deduped by checkoutId
 *   post_purchase — 72hr delay (day 3)
 *   review_request — 168hr delay (day 7)
 *   winback       — 720hr delay (day 30)
 *
 * Each trigger reads active steps from EmailSequences, computes scheduledFor
 * from delayHours, and calls enqueueEmail (which handles dedup + persistence).
 *
 * CMS collection: EmailSequences
 *   sequenceType: Text (indexed)  — 'welcome'|'cart_abandon'|'post_purchase'|'review_request'|'winback'
 *   step: Number                  — step order (1-based)
 *   templateId: Text              — Wix Triggered Emails template ID
 *   delayHours: Number            — hours after trigger to send
 *   subject: Text                 — human-readable label (not passed to Wix)
 *   active: Boolean (indexed)     — false = skip this step
 *
 * @requires wix-web-module
 * @requires wix-data
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { enqueueEmail } from 'backend/emailQueueService.web';

export const EMAIL_SEQUENCES_COLLECTION = 'EmailSequences';

function logError(msg, err) {
  console.error(`[marketingSequences] ${msg}`, err?.message ?? err ?? '');
}

// ── Internal: load active steps for a sequence type ──────────────────────────

async function loadActiveSteps(sequenceType) {
  const result = await wixData
    .query(EMAIL_SEQUENCES_COLLECTION)
    .eq('sequenceType', sequenceType)
    .eq('active', true)
    .ascending('step')
    .find({ suppressAuth: true });
  return result.items;
}

// ── Internal: enqueue all steps for a sequence ───────────────────────────────

async function enqueueSequenceSteps(steps, baseParams, extraFields = {}) {
  const now = Date.now();
  let enqueued = 0;

  for (const step of steps) {
    const scheduledFor = new Date(now + step.delayHours * 3600 * 1000);
    const result = await enqueueEmail({
      templateId: step.templateId,
      recipientEmail: baseParams.email,
      recipientContactId: baseParams.contactId,
      variables: baseParams.variables,
      sequenceType: baseParams.sequenceType,
      sequenceStep: step.step,
      scheduledFor,
      ...extraFields,
    });
    if (result.success && !result.skipped) enqueued++;
  }

  return enqueued;
}

// ── triggerWelcomeSequence ────────────────────────────────────────────────────

/**
 * Trigger the welcome email sequence for a new member/contact.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.contactId
 * @param {string} [params.firstName]
 * @returns {Promise<{success: boolean, enqueued: number, error?: string}>}
 */
export const triggerWelcomeSequence = webMethod(Permissions.Admin, async (params) => {
  const { email, contactId, firstName = '' } = params ?? {};

  if (!email) return { success: false, error: 'email is required' };
  if (!contactId) return { success: false, error: 'contactId is required' };

  try {
    const steps = await loadActiveSteps('welcome');
    const enqueued = await enqueueSequenceSteps(steps, {
      email,
      contactId,
      sequenceType: 'welcome',
      variables: { firstName },
    });
    return { success: true, enqueued };
  } catch (err) {
    logError('triggerWelcomeSequence failed', err);
    return { success: false, error: err?.message ?? 'unknown error' };
  }
});

// ── triggerCartAbandonSequence ────────────────────────────────────────────────

/**
 * Trigger the cart abandonment email sequence.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.contactId
 * @param {string} [params.firstName]
 * @param {string} params.checkoutId - Required for dedup
 * @param {Array}  [params.cartItems]
 * @returns {Promise<{success: boolean, enqueued: number, error?: string}>}
 */
export const triggerCartAbandonSequence = webMethod(Permissions.Admin, async (params) => {
  const { email, contactId, firstName = '', checkoutId, cartItems = [] } = params ?? {};

  if (!email) return { success: false, error: 'email is required' };
  if (!contactId) return { success: false, error: 'contactId is required' };
  if (!checkoutId) return { success: false, error: 'checkoutId is required' };

  try {
    const steps = await loadActiveSteps('cart_abandon');
    const enqueued = await enqueueSequenceSteps(
      steps,
      {
        email,
        contactId,
        sequenceType: 'cart_abandon',
        variables: { firstName, checkoutId, cartItems: JSON.stringify(cartItems) },
      },
      { checkoutId }
    );
    return { success: true, enqueued };
  } catch (err) {
    logError('triggerCartAbandonSequence failed', err);
    return { success: false, error: err?.message ?? 'unknown error' };
  }
});

// ── triggerPostPurchaseSequence ───────────────────────────────────────────────

/**
 * Trigger the post-purchase follow-up sequence.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.contactId
 * @param {string} [params.firstName]
 * @param {string} params.orderNumber
 * @param {number} [params.total]
 * @returns {Promise<{success: boolean, enqueued: number, error?: string}>}
 */
export const triggerPostPurchaseSequence = webMethod(Permissions.Admin, async (params) => {
  const { email, contactId, firstName = '', orderNumber, total = 0 } = params ?? {};

  if (!email) return { success: false, error: 'email is required' };
  if (!contactId) return { success: false, error: 'contactId is required' };

  try {
    const steps = await loadActiveSteps('post_purchase');
    const enqueued = await enqueueSequenceSteps(steps, {
      email,
      contactId,
      sequenceType: 'post_purchase',
      variables: { firstName, orderNumber, total: String(total) },
    });
    return { success: true, enqueued };
  } catch (err) {
    logError('triggerPostPurchaseSequence failed', err);
    return { success: false, error: err?.message ?? 'unknown error' };
  }
});

// ── triggerReviewRequestSequence ──────────────────────────────────────────────

/**
 * Trigger the review request sequence (day 7 after purchase).
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.contactId
 * @param {string} [params.firstName]
 * @param {string} [params.productName]
 * @param {string} [params.orderId]
 * @returns {Promise<{success: boolean, enqueued: number, error?: string}>}
 */
export const triggerReviewRequestSequence = webMethod(Permissions.Admin, async (params) => {
  const { email, contactId, firstName = '', productName = '', orderId = '' } = params ?? {};

  if (!email) return { success: false, error: 'email is required' };
  if (!contactId) return { success: false, error: 'contactId is required' };

  try {
    const steps = await loadActiveSteps('review_request');
    const enqueued = await enqueueSequenceSteps(steps, {
      email,
      contactId,
      sequenceType: 'review_request',
      variables: { firstName, productName, orderId },
    });
    return { success: true, enqueued };
  } catch (err) {
    logError('triggerReviewRequestSequence failed', err);
    return { success: false, error: err?.message ?? 'unknown error' };
  }
});

// ── triggerWinbackSequence ────────────────────────────────────────────────────

/**
 * Trigger the winback sequence for lapsed customers (day 30).
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.contactId
 * @param {string} [params.firstName]
 * @returns {Promise<{success: boolean, enqueued: number, error?: string}>}
 */
export const triggerWinbackSequence = webMethod(Permissions.Admin, async (params) => {
  const { email, contactId, firstName = '' } = params ?? {};

  if (!email) return { success: false, error: 'email is required' };
  if (!contactId) return { success: false, error: 'contactId is required' };

  try {
    const steps = await loadActiveSteps('winback');
    const enqueued = await enqueueSequenceSteps(steps, {
      email,
      contactId,
      sequenceType: 'winback',
      variables: { firstName },
    });
    return { success: true, enqueued };
  } catch (err) {
    logError('triggerWinbackSequence failed', err);
    return { success: false, error: err?.message ?? 'unknown error' };
  }
});

// ── scanAndTriggerWinback ─────────────────────────────────────────────────────

const ORDERS_COLLECTION = 'Stores/Orders';
// Weekly Monday cron. Window must cover at least one week so a customer who
// hit day 30 the day after last Monday's run isn't silently skipped. 30–37
// days picks up every lapsed buyer exactly once without backfilling history.
const WINBACK_WINDOW_MIN_DAYS = 30;
const WINBACK_WINDOW_MAX_DAYS = 37;

/**
 * Cron orchestrator: scans Stores/Orders for buyers whose most recent order
 * landed in the winback window (30–37 days ago) and fires triggerWinbackSequence
 * per unique buyer. enqueueEmail-level dedup in EmailQueue prevents double-sends
 * across runs; an in-run Set prevents double-triggering for buyers with multiple
 * orders in the same window.
 *
 * @function scanAndTriggerWinback
 * @returns {Promise<{success: boolean, scanned: number, triggered: number, error?: string}>}
 * @permission Admin
 */
export const scanAndTriggerWinback = webMethod(Permissions.Admin, async () => {
  try {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const minDate = new Date(now - WINBACK_WINDOW_MAX_DAYS * DAY_MS);
    const maxDate = new Date(now - WINBACK_WINDOW_MIN_DAYS * DAY_MS);

    const orders = await wixData.query(ORDERS_COLLECTION)
      .ge('_createdDate', minDate)
      .le('_createdDate', maxDate)
      .limit(1000)
      .find({ suppressAuth: true });

    const scanned = orders.items.length;
    const seenEmails = new Set();
    let triggered = 0;

    for (const order of orders.items) {
      const email = order?.buyerInfo?.email || '';
      const contactId = order?.buyerInfo?.contactId || '';
      const firstName = order?.buyerInfo?.firstName || '';
      if (!email || !contactId) continue;
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);

      const result = await triggerWinbackSequence({ email, contactId, firstName });
      if (result?.success && result?.enqueued > 0) triggered++;
    }

    return { success: true, scanned, triggered };
  } catch (err) {
    logError('scanAndTriggerWinback failed', err);
    return { success: false, scanned: 0, triggered: 0, error: err?.message ?? 'unknown error' };
  }
});
