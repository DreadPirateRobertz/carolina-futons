/**
 * @module emailQueueService.web
 * @description Queue-based email sender with dedup, rate limiting, and send window enforcement.
 *
 * Send window: 9am–8pm ET only. Emails scheduled outside this window are
 * rescheduled to the next 9am ET window open.
 *
 * Dedup: pending/sent items block re-queue for the same
 * (recipientEmail, sequenceType, sequenceStep) tuple.
 * For cart_abandon sequences, checkoutId is also used as a dedup key.
 *
 * Rate limiting: uses shared checkRateLimit utility with 'EmailQueueRateLimit'
 * collection. Fails open on DB errors.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-crm-backend
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { checkRateLimit } from 'backend/utils/rateLimit';

export const EMAIL_QUEUE_COLLECTION = 'EmailQueue';
const RATE_LIMIT_COLLECTION = 'EmailQueueRateLimit';
export const MAX_RETRIES = 3;

const SEND_WINDOW_START = 9;  // 9am ET
const SEND_WINDOW_END = 20;   // 8pm ET

function logError(msg, err) {
  console.error(`[emailQueueService] ${msg}`, err?.message ?? err ?? '');
}

// ── Send window helpers ───────────────────────────────────────────────────────

/**
 * Returns true if the given UTC timestamp falls within 9am–8pm ET.
 * @param {number} nowMs - UTC timestamp in ms (defaults to Date.now())
 * @returns {boolean}
 */
export function isInSendWindow(nowMs = Date.now()) {
  const etHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(new Date(nowMs))
  );
  return etHour >= SEND_WINDOW_START && etHour < SEND_WINDOW_END;
}

/**
 * Returns the UTC timestamp (ms) of the next 9am ET window open on or after `nowMs`.
 * If nowMs is before 9am ET today, returns today's 9am ET.
 * If nowMs is at or after 8pm ET, returns tomorrow's 9am ET.
 * @param {number} nowMs
 * @returns {number}
 */
function nextWindowOpenUTC(nowMs) {
  const now = new Date(nowMs);

  // Get today's ET date components
  const etDateStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/New_York',
  }).format(now);
  const [y, m, d] = etDateStr.split('-').map(Number);

  const etHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(now)
  );

  // Determine which calendar day's 9am ET to target
  const targetDay = etHour >= SEND_WINDOW_END ? d + 1 : d;

  // Build a reference point: target day at noon UTC
  const refUTC = Date.UTC(y, m - 1, targetDay, 12, 0, 0);

  // Find ET offset at that reference point (DST-safe)
  const etHourAtRef = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(new Date(refUTC))
  );
  const etOffsetMs = (12 - etHourAtRef) * 3600 * 1000;

  // Target day midnight ET in UTC = refUTC - 12h + etOffset
  const targetMidnightUTC = refUTC - 12 * 3600 * 1000 + etOffsetMs;

  return targetMidnightUTC + SEND_WINDOW_START * 3600 * 1000;
}

// ── enqueueEmail ─────────────────────────────────────────────────────────────

/**
 * Add an email to the send queue. Deduplicates against pending and sent items.
 *
 * @param {Object} params
 * @param {string} params.templateId
 * @param {string} params.recipientEmail
 * @param {string} params.recipientContactId
 * @param {Object} params.variables - Template variables (will be JSON-stringified)
 * @param {string} params.sequenceType
 * @param {number} params.sequenceStep
 * @param {Date}   params.scheduledFor
 * @param {string} [params.checkoutId] - For cart_abandon dedup
 * @param {string} [params.abVariant]
 * @returns {Promise<{success: boolean, skipped?: boolean, error?: string}>}
 */
export async function enqueueEmail(params) {
  const {
    templateId,
    recipientEmail,
    recipientContactId,
    variables,
    sequenceType,
    sequenceStep,
    scheduledFor,
    checkoutId = null,
    abVariant = null,
  } = params;

  try {
    // Dedup: check for existing pending/sent for same email+type+step
    const dedupQuery = wixData
      .query(EMAIL_QUEUE_COLLECTION)
      .eq('recipientEmail', recipientEmail)
      .eq('sequenceType', sequenceType)
      .eq('sequenceStep', sequenceStep)
      .hasSome('status', ['pending', 'sent'])
      .limit(1);

    const existing = await dedupQuery.find({ suppressAuth: true });
    if (existing.items.length > 0) {
      return { success: true, skipped: true };
    }

    // Additional dedup for cart_abandon by checkoutId
    if (checkoutId && sequenceType === 'cart_abandon') {
      const checkoutDedup = await wixData
        .query(EMAIL_QUEUE_COLLECTION)
        .eq('checkoutId', checkoutId)
        .eq('sequenceType', 'cart_abandon')
        .hasSome('status', ['pending', 'sent'])
        .limit(1)
        .find({ suppressAuth: true });

      if (checkoutDedup.items.length > 0) {
        return { success: true, skipped: true };
      }
    }

    const record = {
      templateId,
      recipientEmail,
      recipientContactId,
      variables: typeof variables === 'string' ? variables : JSON.stringify(variables),
      sequenceType,
      sequenceStep,
      status: 'pending',
      scheduledFor,
      sentAt: null,
      attempt: 0,
      lastError: null,
      checkoutId,
      abVariant,
      createdAt: new Date(),
    };

    await wixData.insert(EMAIL_QUEUE_COLLECTION, record, { suppressAuth: true });
    return { success: true };
  } catch (err) {
    logError(`enqueueEmail failed for ${recipientEmail}/${sequenceType}/${sequenceStep}`, err);
    return { success: false, error: err?.message ?? 'unknown error' };
  }
}

// ── processQueue ─────────────────────────────────────────────────────────────

/**
 * Process pending queue items: send emails within the send window,
 * reschedule those outside the window, apply rate limiting.
 *
 * @param {Object} [opts]
 * @param {number} [opts.now] - UTC ms timestamp override for testing
 * @param {number} [opts.rateLimitMax] - Override rate limit max (default 10 per hour per address)
 * @param {number} [opts.batchSize] - Max items to process per run (default 50)
 * @returns {Promise<{sent: number, skipped: number, rescheduled: number, rateLimited: number, failed: number}>}
 */
export const processQueue = webMethod(Permissions.Admin, async (opts = {}) => {
  const now = opts.now ?? Date.now();
  const batchSize = opts.batchSize ?? 50;
  const rateLimitMax = opts.rateLimitMax ?? 10;

  let sent = 0, skipped = 0, rescheduled = 0, rateLimited = 0, failed = 0;

  let items;
  try {
    const result = await wixData
      .query(EMAIL_QUEUE_COLLECTION)
      .eq('status', 'pending')
      .le('scheduledFor', new Date(now))
      .ascending('scheduledFor')
      .limit(batchSize)
      .find({ suppressAuth: true });
    items = result.items;
  } catch (err) {
    logError('processQueue query failed', err);
    return { sent, skipped, rescheduled, rateLimited, failed };
  }

  if (items.length === 0) return { sent, skipped, rescheduled, rateLimited, failed };

  // Defer CRM import to avoid top-level side effects in tests
  const { triggeredEmails } = await import('wix-crm-backend');

  for (const item of items) {
    // Outside send window — reschedule
    if (!isInSendWindow(now)) {
      const nextOpen = nextWindowOpenUTC(now);
      try {
        await wixData.update(
          EMAIL_QUEUE_COLLECTION,
          { ...item, scheduledFor: new Date(nextOpen) },
          { suppressAuth: true }
        );
        rescheduled++;
      } catch (err) {
        logError(`reschedule failed for ${item._id}`, err);
      }
      continue;
    }

    // Rate limit check
    const rl = await checkRateLimit(RATE_LIMIT_COLLECTION, item.recipientEmail, {
      now,
      max: rateLimitMax,
      windowMs: 3600 * 1000,
    });
    if (!rl.allowed) {
      rateLimited++;
      continue;
    }

    // Attempt send
    try {
      const variables = item.variables
        ? (typeof item.variables === 'string' ? JSON.parse(item.variables) : item.variables)
        : {};

      await triggeredEmails.emailContact(item.templateId, item.recipientContactId, { variables });

      await wixData.update(
        EMAIL_QUEUE_COLLECTION,
        { ...item, status: 'sent', sentAt: new Date(now), attempt: item.attempt + 1 },
        { suppressAuth: true }
      );
      sent++;
    } catch (err) {
      const newAttempt = (item.attempt ?? 0) + 1;
      const isExhausted = newAttempt > MAX_RETRIES;
      try {
        await wixData.update(
          EMAIL_QUEUE_COLLECTION,
          {
            ...item,
            attempt: newAttempt,
            status: isExhausted ? 'failed' : 'pending',
            lastError: err?.message ?? 'send failed',
          },
          { suppressAuth: true }
        );
      } catch (updateErr) {
        logError(`update after send failure for ${item._id}`, updateErr);
      }
      if (isExhausted) {
        failed++;
      } else {
        skipped++;
      }
    }
  }

  return { sent, skipped, rescheduled, rateLimited, failed };
});

// ── cancelQueuedEmails ────────────────────────────────────────────────────────

/**
 * Cancel all pending queue items for a given recipient + sequence type.
 *
 * @param {string} recipientEmail
 * @param {string} sequenceType
 * @returns {Promise<{cancelled: number}>}
 */
export async function cancelQueuedEmails(recipientEmail, sequenceType) {
  try {
    const result = await wixData
      .query(EMAIL_QUEUE_COLLECTION)
      .eq('recipientEmail', recipientEmail)
      .eq('sequenceType', sequenceType)
      .eq('status', 'pending')
      .find({ suppressAuth: true });

    let cancelled = 0;
    for (const item of result.items) {
      try {
        await wixData.update(
          EMAIL_QUEUE_COLLECTION,
          { ...item, status: 'cancelled' },
          { suppressAuth: true }
        );
        cancelled++;
      } catch (err) {
        logError(`cancel update failed for ${item._id}`, err);
      }
    }

    return { cancelled };
  } catch (err) {
    logError(`cancelQueuedEmails query failed for ${recipientEmail}/${sequenceType}`, err);
    return { cancelled: 0 };
  }
}
