/**
 * @module emailAutomation
 * @description Email marketing automation: welcome series, abandoned cart
 * recovery, post-purchase care sequence, re-engagement, and email queue
 * processing. Integrates with Wix Triggered Emails and CMS collections.
 *
 * @requires wix-web-module
 * @requires wix-crm-backend - Triggered Emails API
 * @requires wix-secrets-backend
 * @requires wix-data
 *
 * @setup
 * 1. Create `EmailQueue` CMS collection with fields:
 *    templateId (text), recipientEmail (text), recipientContactId (text),
 *    variables (object), sequenceType (text), sequenceStep (number),
 *    status (text: pending|sent|failed|cancelled), scheduledFor (dateTime),
 *    sentAt (dateTime), attempt (number), lastError (text),
 *    abVariant (text: A|B|null), createdAt (dateTime)
 *
 * 2. Create `Unsubscribes` CMS collection with fields:
 *    email (text), sequenceType (text: all|welcome|cart_recovery|
 *    post_purchase|reengagement), unsubscribedAt (dateTime)
 *
 * 3. Create triggered email templates in Dashboard > Marketing:
 *    welcome_series_1, welcome_series_2, welcome_series_3,
 *    cart_recovery_1, cart_recovery_2, cart_recovery_3,
 *    post_purchase_1, post_purchase_2, post_purchase_3,
 *    reengagement_1
 *
 * 4. Add secrets in Wix Secrets Manager:
 *    WELCOME_DISCOUNT_CODE, RECOVERY_DISCOUNT_CODE
 */
import { Permissions, webMethod } from 'wix-web-module';
import { triggeredEmails } from 'wix-crm-backend';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

// ── Sequence Definitions ──────────────────────────────────────────────
// Each sequence defines steps with template IDs, delay, and variables.
// Brand tokens: Sand #E8D5B7, Espresso #3A2518, Mountain Blue #5B8FA8

const SEQUENCES = {
  welcome: {
    steps: [
      { step: 1, templateId: 'welcome_series_1', delayHours: 0, description: 'Brand story + 10% discount' },
      { step: 2, templateId: 'welcome_series_2', delayHours: 72, description: 'Buying guide' },
      { step: 3, templateId: 'welcome_series_3', delayHours: 168, description: 'Social proof + UGC' },
    ],
    abTestStep: 1,
    abVariants: {
      A: { subjectLine: 'Welcome to Carolina Futons — here\'s 10% off your first order' },
      B: { subjectLine: 'Your 10% welcome gift is inside, {firstName}' },
    },
  },
  cart_recovery: {
    steps: [
      { step: 1, templateId: 'cart_recovery_1', delayHours: 1, description: 'Reminder with cart preview' },
      { step: 2, templateId: 'cart_recovery_2', delayHours: 24, description: 'Social proof + reviews' },
      { step: 3, templateId: 'cart_recovery_3', delayHours: 72, description: 'Discount incentive' },
    ],
  },
  post_purchase: {
    steps: [
      { step: 1, templateId: 'post_purchase_1', delayHours: 0, description: 'Thank you + tracking' },
      { step: 2, templateId: 'post_purchase_2', delayHours: 168, description: 'Assembly tips + review request' },
      { step: 3, templateId: 'post_purchase_3', delayHours: 720, description: 'Care guide + accessory upsell' },
    ],
  },
  reengagement: {
    steps: [
      { step: 1, templateId: 'reengagement_1', delayHours: 0, description: 'We miss you + exclusive offer' },
    ],
  },
};

// Maximum retry attempts for failed emails
const MAX_RETRY_ATTEMPTS = 3;

// ── Event Handlers (auto-register in backend/) ───────────────────────

/**
 * Triggered when a new site member is created.
 * Queues the welcome email series.
 */
export function wixMembers_onMemberCreated(event) {
  const member = event.entity || event;
  const email = member.loginEmail || member.contactDetails?.emails?.[0] || '';
  const firstName = member.contactDetails?.firstName || member.profile?.nickname || '';
  const contactId = member._id || '';

  if (!email) return;

  triggerWelcomeSequence(contactId, email, firstName)
    .catch(err => console.error('Error triggering welcome sequence:', err));
}

/**
 * Triggered when an order is created.
 * Queues the post-purchase care sequence.
 */
export function wixEcom_onOrderCreated(event) {
  const order = event.entity || event;
  const email = order.buyerInfo?.email || '';
  const firstName = order.billingInfo?.firstName || order.buyerInfo?.firstName || '';
  const contactId = order.buyerInfo?.contactId || '';
  const orderNumber = order.number || '';
  const total = order.totals?.total || order.priceSummary?.total?.amount || 0;
  const lineItems = (order.lineItems || []).map(item => ({
    name: item.name || item.productName?.original || '',
    quantity: item.quantity || 1,
    price: item.price || item.price?.amount || 0,
  }));

  if (!email) return;

  triggerPostPurchaseSequence(contactId, email, firstName, orderNumber, total, lineItems)
    .catch(err => console.error('Error triggering post-purchase sequence:', err));
}

/**
 * Triggered when an order is cancelled.
 * Cancels any pending post-purchase care emails for that order.
 */
export function wixEcom_onOrderCanceled(event) {
  const order = event.entity || event;
  const email = order.buyerInfo?.email || '';
  const orderNumber = order.number || '';

  if (!email) return;

  cancelSequenceForOrder(email, orderNumber)
    .catch(err => console.error('Error cancelling care sequence:', err));
}

// ── Public Web Methods ────────────────────────────────────────────────

/**
 * Queue a welcome email series for a new member.
 *
 * @function triggerWelcomeSequence
 * @param {string} contactId - Wix contact ID
 * @param {string} email - Member email
 * @param {string} firstName - Member first name
 * @returns {Promise<{success: boolean, queued: number}>}
 * @permission Admin
 */
export const triggerWelcomeSequence = webMethod(
  Permissions.Admin,
  async (contactId, email, firstName) => {
    try {
      if (!email) return { success: false, queued: 0 };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) return { success: false, queued: 0 };

      const cleanName = sanitize(firstName, 200);
      const cleanContactId = sanitize(contactId, 50);

      // Check unsubscribe
      if (await isUnsubscribed(cleanEmail, 'welcome')) {
        return { success: false, queued: 0 };
      }

      // Check duplicate: don't re-queue if welcome already queued for this email
      const existing = await wixData.query('EmailQueue')
        .eq('recipientEmail', cleanEmail)
        .eq('sequenceType', 'welcome')
        .eq('sequenceStep', 1)
        .find();

      if (existing.items.length > 0) return { success: false, queued: 0 };

      let discountCode = '';
      try { discountCode = await getSecret('WELCOME_DISCOUNT_CODE'); } catch (e) { console.error('[emailAutomation] Failed to retrieve WELCOME_DISCOUNT_CODE:', e.message); }

      const abVariant = selectABVariant();
      const abData = SEQUENCES.welcome.abVariants[abVariant] || {};
      const now = new Date();
      let queued = 0;

      for (const step of SEQUENCES.welcome.steps) {
        const scheduledFor = new Date(now.getTime() + step.delayHours * 60 * 60 * 1000);
        const variables = {
          firstName: cleanName,
          discountCode,
          email: cleanEmail,
        };

        // Add A/B subject line for step 1
        if (step.step === SEQUENCES.welcome.abTestStep) {
          variables.subjectLine = (abData.subjectLine || '').replace('{firstName}', cleanName);
        }

        await queueEmail({
          templateId: step.templateId,
          recipientEmail: cleanEmail,
          recipientContactId: cleanContactId,
          variables,
          sequenceType: 'welcome',
          sequenceStep: step.step,
          scheduledFor,
          abVariant: step.step === SEQUENCES.welcome.abTestStep ? abVariant : null,
        });
        queued++;
      }

      return { success: true, queued };
    } catch (err) {
      console.error('Error queuing welcome sequence:', err);
      return { success: false, queued: 0 };
    }
  }
);

/**
 * Queue a post-purchase care sequence for a completed order.
 *
 * @function triggerPostPurchaseSequence
 * @param {string} contactId - Wix contact ID
 * @param {string} email - Buyer email
 * @param {string} firstName - Buyer first name
 * @param {string} orderNumber - Order number
 * @param {number} total - Order total
 * @param {Array} lineItems - Order line items
 * @returns {Promise<{success: boolean, queued: number}>}
 * @permission Admin
 */
export const triggerPostPurchaseSequence = webMethod(
  Permissions.Admin,
  async (contactId, email, firstName, orderNumber, total, lineItems) => {
    try {
      if (!email) return { success: false, queued: 0 };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) return { success: false, queued: 0 };

      const cleanName = sanitize(firstName, 200);
      const cleanContactId = sanitize(contactId, 50);
      const cleanOrderNumber = sanitize(orderNumber, 20);

      if (await isUnsubscribed(cleanEmail, 'post_purchase')) {
        return { success: false, queued: 0 };
      }

      const productNames = (lineItems || [])
        .map(i => sanitize(i.name, 200))
        .filter(Boolean)
        .join(', ');

      const now = new Date();
      let queued = 0;

      for (const step of SEQUENCES.post_purchase.steps) {
        const scheduledFor = new Date(now.getTime() + step.delayHours * 60 * 60 * 1000);

        await queueEmail({
          templateId: step.templateId,
          recipientEmail: cleanEmail,
          recipientContactId: cleanContactId,
          variables: {
            firstName: cleanName,
            orderNumber: cleanOrderNumber,
            total: String(total),
            productNames,
            email: cleanEmail,
          },
          sequenceType: 'post_purchase',
          sequenceStep: step.step,
          scheduledFor,
        });
        queued++;
      }

      return { success: true, queued };
    } catch (err) {
      console.error('Error queuing post-purchase sequence:', err);
      return { success: false, queued: 0 };
    }
  }
);

/**
 * Find abandoned carts and queue recovery email sequences.
 * Should be called by a scheduled job (external cron or Wix automation).
 *
 * @function triggerAbandonedCartRecovery
 * @returns {Promise<{success: boolean, cartsProcessed: number}>}
 * @permission Admin
 */
export const triggerAbandonedCartRecovery = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Find carts abandoned >1hr with no recovery email queued
      const result = await wixData.query('AbandonedCarts')
        .eq('status', 'abandoned')
        .eq('recoveryEmailSent', false)
        .le('abandonedAt', oneHourAgo)
        .find();

      let cartsProcessed = 0;
      let discountCode = '';
      try { discountCode = await getSecret('RECOVERY_DISCOUNT_CODE'); } catch (e) { console.error('[emailAutomation] Failed to retrieve RECOVERY_DISCOUNT_CODE for cart recovery:', e.message); }

      for (const cart of result.items) {
        if (!cart.buyerEmail || !validateEmail(cart.buyerEmail)) continue;
        if (await isUnsubscribed(cart.buyerEmail, 'cart_recovery')) continue;

        // Check if recovery already queued for this cart (flat field, not nested)
        const alreadyQueued = await wixData.query('EmailQueue')
          .eq('recipientEmail', cart.buyerEmail)
          .eq('sequenceType', 'cart_recovery')
          .eq('checkoutId', cart.checkoutId)
          .find();

        if (alreadyQueued.items.length > 0) continue;

        const abandonedAt = new Date(cart.abandonedAt);
        let parsedItems = [];
        try {
          parsedItems = typeof cart.lineItems === 'string'
            ? JSON.parse(cart.lineItems)
            : (cart.lineItems || []);
        } catch (e) { parsedItems = []; }
        const itemSummary = parsedItems
          .map(i => `${i.name} (x${i.quantity})`)
          .join(', ');

        for (const step of SEQUENCES.cart_recovery.steps) {
          const scheduledFor = new Date(abandonedAt.getTime() + step.delayHours * 60 * 60 * 1000);

          await queueEmail({
            templateId: step.templateId,
            recipientEmail: cart.buyerEmail,
            recipientContactId: '',
            variables: {
              buyerName: cart.buyerName || '',
              cartTotal: String(cart.cartTotal || 0),
              itemSummary,
              discountCode: step.step === 3 ? discountCode : '',
              checkoutId: cart.checkoutId,
              email: cart.buyerEmail,
            },
            sequenceType: 'cart_recovery',
            sequenceStep: step.step,
            scheduledFor,
          });
        }

        // Mark recovery email as queued in AbandonedCarts
        await wixData.update('AbandonedCarts', {
          ...cart,
          recoveryEmailSent: true,
          recoveryEmailSentAt: new Date(),
        });

        cartsProcessed++;
      }

      return { success: true, cartsProcessed };
    } catch (err) {
      console.error('Error processing cart recovery:', err);
      return { success: false, cartsProcessed: 0 };
    }
  }
);

/**
 * Find dormant contacts (no activity in 90+ days) and queue re-engagement.
 *
 * @function triggerReengagement
 * @returns {Promise<{success: boolean, contacted: number}>}
 * @permission Admin
 */
export const triggerReengagement = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      // Find contacts who placed orders but not recently
      const result = await wixData.query('EmailQueue')
        .eq('sequenceType', 'post_purchase')
        .eq('sequenceStep', 1)
        .eq('status', 'sent')
        .le('sentAt', ninetyDaysAgo)
        .find();

      let contacted = 0;

      for (const item of result.items) {
        if (!item.recipientEmail) continue;
        if (await isUnsubscribed(item.recipientEmail, 'reengagement')) continue;

        // Skip if already sent reengagement recently
        const alreadySent = await wixData.query('EmailQueue')
          .eq('recipientEmail', item.recipientEmail)
          .eq('sequenceType', 'reengagement')
          .find();

        if (alreadySent.items.length > 0) continue;

        let discountCode = '';
        try { discountCode = await getSecret('RECOVERY_DISCOUNT_CODE'); } catch (e) { console.error('[emailAutomation] Failed to retrieve RECOVERY_DISCOUNT_CODE for reengagement:', e.message); }

        await queueEmail({
          templateId: SEQUENCES.reengagement.steps[0].templateId,
          recipientEmail: item.recipientEmail,
          recipientContactId: item.recipientContactId || '',
          variables: {
            firstName: item.variables?.firstName || '',
            discountCode,
            email: item.recipientEmail,
          },
          sequenceType: 'reengagement',
          sequenceStep: 1,
          scheduledFor: new Date(),
        });

        contacted++;
      }

      return { success: true, contacted };
    } catch (err) {
      console.error('Error processing reengagement:', err);
      return { success: false, contacted: 0 };
    }
  }
);

/**
 * Process the email queue: send all pending emails whose scheduled time has
 * passed. Should be called by a scheduled job every 15-30 minutes.
 *
 * @function processEmailQueue
 * @returns {Promise<{sent: number, failed: number, cancelled: number}>}
 * @permission Admin
 */
export const processEmailQueue = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const now = new Date();

      const pending = await wixData.query('EmailQueue')
        .eq('status', 'pending')
        .le('scheduledFor', now)
        .find();

      let sent = 0;
      let failed = 0;
      let cancelled = 0;

      for (const item of pending.items) {
        // Check if recipient unsubscribed since queuing
        if (await isUnsubscribed(item.recipientEmail, item.sequenceType)) {
          await wixData.update('EmailQueue', {
            ...item,
            status: 'cancelled',
            lastError: 'Recipient unsubscribed',
          });
          cancelled++;
          continue;
        }

        // For cart recovery: check if cart was recovered since queuing
        if (item.sequenceType === 'cart_recovery' && item.variables?.checkoutId) {
          const cartResult = await wixData.query('AbandonedCarts')
            .eq('checkoutId', item.variables.checkoutId)
            .eq('status', 'recovered')
            .find();

          if (cartResult.items.length > 0) {
            await wixData.update('EmailQueue', {
              ...item,
              status: 'cancelled',
              lastError: 'Cart recovered before send',
            });
            cancelled++;
            continue;
          }
        }

        // Attempt to send
        try {
          await sendQueuedEmail(item);
          await wixData.update('EmailQueue', {
            ...item,
            status: 'sent',
            sentAt: new Date(),
            attempt: (item.attempt || 0) + 1,
          });
          sent++;
        } catch (err) {
          const attempt = (item.attempt || 0) + 1;
          const newStatus = attempt >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending';
          // Exponential backoff: retry in 15min, then 1hr, then give up
          const backoffMs = attempt === 1 ? 15 * 60 * 1000 : 60 * 60 * 1000;
          const retryAt = new Date(Date.now() + backoffMs);

          await wixData.update('EmailQueue', {
            ...item,
            status: newStatus,
            attempt,
            lastError: err.message || 'Send failed',
            scheduledFor: newStatus === 'pending' ? retryAt : item.scheduledFor,
          });
          failed++;
        }
      }

      return { sent, failed, cancelled };
    } catch (err) {
      console.error('Error processing email queue:', err);
      return { sent: 0, failed: 0, cancelled: 0 };
    }
  }
);

/**
 * Unsubscribe an email from a specific sequence type or all sequences.
 * CAN-SPAM compliant: processes immediately, no confirmation required.
 *
 * @function unsubscribeContact
 * @param {string} email - Email to unsubscribe
 * @param {string} [sequenceType='all'] - Sequence type or 'all'
 * @returns {Promise<{success: boolean}>}
 * @permission Anyone — unsubscribe links must work without auth
 */
export const unsubscribeContact = webMethod(
  Permissions.Anyone,
  async (email, sequenceType = 'all') => {
    try {
      if (!email) return { success: false };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) return { success: false };

      const cleanType = sanitize(sequenceType, 50);

      // Record unsubscribe
      await wixData.insert('Unsubscribes', {
        email: cleanEmail,
        sequenceType: cleanType,
        unsubscribedAt: new Date(),
      });

      // Cancel any pending emails for this recipient
      const pendingEmails = await wixData.query('EmailQueue')
        .eq('recipientEmail', cleanEmail)
        .eq('status', 'pending')
        .find();

      for (const item of pendingEmails.items) {
        if (cleanType === 'all' || item.sequenceType === cleanType) {
          await wixData.update('EmailQueue', {
            ...item,
            status: 'cancelled',
            lastError: `Unsubscribed from ${cleanType}`,
          });
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Error processing unsubscribe:', err);
      return { success: false };
    }
  }
);

/**
 * Get email automation stats for admin dashboard.
 *
 * @function getEmailAutomationStats
 * @returns {Promise<Object>} Queue stats by sequence type and status
 * @permission Admin
 */
export const getEmailAutomationStats = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await wixData.query('EmailQueue')
        .ge('createdAt', thirtyDaysAgo)
        .find();

      const stats = { welcome: {}, cart_recovery: {}, post_purchase: {}, reengagement: {} };

      for (const item of result.items) {
        const seq = item.sequenceType || 'unknown';
        if (!stats[seq]) stats[seq] = {};
        stats[seq][item.status] = (stats[seq][item.status] || 0) + 1;
      }

      // A/B test results for welcome series
      const abResults = { A: { sent: 0 }, B: { sent: 0 } };
      for (const item of result.items) {
        if (item.sequenceType === 'welcome' && item.abVariant && item.status === 'sent') {
          abResults[item.abVariant].sent++;
        }
      }

      return { stats, abResults, totalEmails: result.items.length };
    } catch (err) {
      console.error('Error getting email stats:', err);
      return { stats: {}, abResults: {}, totalEmails: 0 };
    }
  }
);

/**
 * Record an email open or click event for tracking.
 *
 * @function recordEmailEvent
 * @param {Object} params
 * @param {string} params.emailQueueId - ID of the EmailQueue record
 * @param {string} params.eventType - 'open' or 'click'
 * @param {string} [params.linkUrl] - Clicked link URL (for click events)
 * @returns {Promise<{success: boolean}>}
 * @permission Anyone — tracking pixels/links fire without auth
 */
export const recordEmailEvent = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const { emailQueueId, eventType, linkUrl } = params;

      if (!emailQueueId || !eventType) return { success: false };
      if (eventType !== 'open' && eventType !== 'click') return { success: false };

      const cleanId = sanitize(emailQueueId, 50);
      const cleanUrl = linkUrl ? sanitize(linkUrl, 500) : '';

      await wixData.insert('EmailEvents', {
        emailQueueId: cleanId,
        eventType,
        linkUrl: cleanUrl,
        timestamp: new Date(),
      });

      return { success: true };
    } catch (err) {
      console.error('Error recording email event:', err);
      return { success: false };
    }
  }
);

/**
 * Get email open/click events for analytics.
 *
 * @function getEmailEvents
 * @param {string} [sequenceType] - Filter by sequence type
 * @param {number} [days=30] - Lookback window
 * @returns {Promise<{opens: number, clicks: number, events: Array}>}
 * @permission Admin
 */
export const getEmailEvents = webMethod(
  Permissions.Admin,
  async (sequenceType, days = 30) => {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const eventsResult = await wixData.query('EmailEvents')
        .ge('timestamp', since)
        .find();

      let events = eventsResult.items || [];

      // If filtering by sequence type, cross-reference EmailQueue
      if (sequenceType) {
        const queueResult = await wixData.query('EmailQueue')
          .eq('sequenceType', sequenceType)
          .find();

        const queueIds = new Set(queueResult.items.map(q => q._id));
        events = events.filter(e => queueIds.has(e.emailQueueId));
      }

      const opens = events.filter(e => e.eventType === 'open').length;
      const clicks = events.filter(e => e.eventType === 'click').length;

      return {
        opens,
        clicks,
        events: events.map(e => ({
          _id: e._id,
          emailQueueId: e.emailQueueId,
          eventType: e.eventType,
          linkUrl: e.linkUrl,
          timestamp: e.timestamp,
        })),
      };
    } catch (err) {
      console.error('Error fetching email events:', err);
      return { opens: 0, clicks: 0, events: [] };
    }
  }
);

// ── Internal Helpers ──────────────────────────────────────────────────

/**
 * Queue an email in the EmailQueue CMS collection.
 */
async function queueEmail({ templateId, recipientEmail, recipientContactId, variables, sequenceType, sequenceStep, scheduledFor, abVariant }) {
  await wixData.insert('EmailQueue', {
    templateId,
    recipientEmail,
    recipientContactId: recipientContactId || '',
    variables: variables || {},
    sequenceType,
    sequenceStep,
    // Flat field for dedup queries (Wix Data can't query nested object fields)
    checkoutId: variables?.checkoutId || '',
    status: 'pending',
    scheduledFor,
    sentAt: null,
    attempt: 0,
    lastError: '',
    abVariant: abVariant || null,
    createdAt: new Date(),
  });
}

/**
 * Send a queued email via Wix Triggered Emails.
 */
async function sendQueuedEmail(queueItem) {
  const contactId = queueItem.recipientContactId;

  if (!contactId) {
    throw new Error('No contact ID for recipient');
  }

  await triggeredEmails.emailContact(
    queueItem.templateId,
    contactId,
    { variables: queueItem.variables || {} }
  );
}

/**
 * Check if an email is unsubscribed from a sequence type.
 */
async function isUnsubscribed(email, sequenceType) {
  const result = await wixData.query('Unsubscribes')
    .eq('email', email.toLowerCase())
    .find();

  return result.items.some(
    item => item.sequenceType === 'all' || item.sequenceType === sequenceType
  );
}

/**
 * Select A/B test variant (50/50 random split).
 */
function selectABVariant() {
  return Math.random() < 0.5 ? 'A' : 'B';
}

/**
 * Cancel pending post-purchase emails when an order is cancelled.
 */
async function cancelSequenceForOrder(email, orderNumber) {
  if (!email) return;

  const cleanEmail = email.toLowerCase();

  const pending = await wixData.query('EmailQueue')
    .eq('recipientEmail', cleanEmail)
    .eq('sequenceType', 'post_purchase')
    .eq('status', 'pending')
    .find();

  for (const item of pending.items) {
    if (item.variables?.orderNumber === orderNumber || !orderNumber) {
      await wixData.update('EmailQueue', {
        ...item,
        status: 'cancelled',
        lastError: 'Order cancelled',
      });
    }
  }
}

// Export sequence definitions for testing
export const _SEQUENCES = SEQUENCES;
export const _MAX_RETRY_ATTEMPTS = MAX_RETRY_ATTEMPTS;
