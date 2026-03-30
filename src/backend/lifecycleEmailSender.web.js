/**
 * @module lifecycleEmailSender
 * @description Orchestrates lifecycle email sends: scans order milestones via
 * lifecycleCron, deduplicates against SentLifecycleMails, and queues emails
 * in EmailQueue for processing by emailAutomation.web.js.
 *
 * Milestone → templateId mapping:
 *   day_7   → 'lifecycle_day_7'   (flip/rotate care guide)
 *   month_1 → 'lifecycle_month_1' (care tips + review encouragement)
 *   year_1  → 'lifecycle_year_1'  (anniversary + ANNIVERSARY15 coupon)
 *
 * Collections:
 *   EmailQueue          — consumed by processEmailQueue cron (every 15 min)
 *   SentLifecycleMails  — dedup guard: { orderId, milestone, email, sentAt }
 *
 * @cron Add to jobs.config:
 *   sendLifecycleEmails — daily at 09:05 UTC (5 min after scanLifecycleMilestones)
 *   cronExpression: '5 9 * * *'
 *
 * CF-3izl.3
 */

import wixData from 'wix-data';
import { scanLifecycleMilestones } from 'backend/lifecycleCron.web';

export const SENT_LIFECYCLE_MAILS_COLLECTION = 'SentLifecycleMails';
export const LIFECYCLE_EMAIL_QUEUE_TYPE = 'lifecycle';

const ANNIVERSARY_COUPON_CODE = 'ANNIVERSARY15';

/** Maps milestone label to EmailQueue templateId. */
const MILESTONE_TEMPLATE_ID = {
  day_7:   'lifecycle_day_7',
  month_1: 'lifecycle_month_1',
  year_1:  'lifecycle_year_1',
};

/**
 * Scan for purchase milestones and queue lifecycle emails for new sends.
 * Deduplicates: skips any orderId+milestone already recorded in SentLifecycleMails.
 *
 * @returns {Promise<{
 *   success: boolean,
 *   totalScanned: number,
 *   queued: number,
 *   skipped: number,
 *   error?: string
 * }>}
 */
export async function sendLifecycleEmails() {
  try {
    // 1. Scan for milestones
    const scan = await scanLifecycleMilestones();
    if (!scan.success) {
      return { success: false, totalScanned: 0, queued: 0, skipped: 0, error: 'Scan failed.' };
    }

    const { results, ordersScanned } = scan;
    if (!results.length) {
      return { success: true, totalScanned: ordersScanned, queued: 0, skipped: 0 };
    }

    // 2. Load dedup records for all relevant orderId+milestone combos
    const dedupKeys = new Set(await loadSentKeys());

    let queued = 0;
    let skipped = 0;

    // 3. Process each milestone result
    for (const item of results) {
      const dedupKey = `${item.orderId}:${item.milestone}`;

      if (dedupKeys.has(dedupKey)) {
        skipped++;
        continue;
      }

      const templateId = MILESTONE_TEMPLATE_ID[item.milestone];
      if (!templateId) {
        // Unknown milestone — skip silently
        skipped++;
        continue;
      }

      // 4. Build variables for the email template
      const variables = {
        name: item.buyerName || 'Valued Customer',
        productName: item.productName || 'your futon',
        orderDate: item.orderDate instanceof Date
          ? item.orderDate.toISOString().slice(0, 10)
          : String(item.orderDate),
      };

      if (item.milestone === 'year_1') {
        variables.couponCode = ANNIVERSARY_COUPON_CODE;
      }

      // 5. Queue the email
      await wixData.insert('EmailQueue', {
        templateId,
        recipientEmail: item.email,
        recipientContactId: item.memberId || null,
        variables,
        sequenceType: LIFECYCLE_EMAIL_QUEUE_TYPE,
        sequenceStep: 1,
        status: 'pending',
        scheduledFor: new Date(),
        attempt: 0,
        createdAt: new Date(),
      });

      // 6. Record in SentLifecycleMails to prevent resend
      await wixData.insert(SENT_LIFECYCLE_MAILS_COLLECTION, {
        orderId:   item.orderId,
        milestone: item.milestone,
        email:     item.email,
        sentAt:    new Date(),
      });

      dedupKeys.add(dedupKey);
      queued++;
    }

    return { success: true, totalScanned: ordersScanned, queued, skipped };
  } catch (err) {
    console.error('[lifecycleEmailSender] sendLifecycleEmails failed:', err);
    return { success: false, totalScanned: 0, queued: 0, skipped: 0, error: 'Failed to send lifecycle emails.' };
  }
}

/**
 * Load all existing orderId:milestone dedup keys from SentLifecycleMails.
 * @returns {Promise<string[]>}
 */
async function loadSentKeys() {
  const { items } = await wixData
    .query(SENT_LIFECYCLE_MAILS_COLLECTION)
    .limit(1000)
    .find();

  return items.map(r => `${r.orderId}:${r.milestone}`);
}
