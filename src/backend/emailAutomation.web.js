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
import { createCartRecoveryCoupon } from 'backend/couponsService.web';

// ── Sequence Definitions ──────────────────────────────────────────────
// Each sequence defines steps with template IDs, delay, and variables.
// Brand tokens: Surface #F0F4F8, Navy #1E3A5F, CF Blue #5B8FA8

const SEQUENCES = {
  welcome: {
    steps: [
      { step: 1, templateId: 'welcome_series_1', delayHours: 0, description: 'Brand story + 10% discount' },
      { step: 2, templateId: 'welcome_series_2', delayHours: 72, description: 'Buying guide' },
      { step: 3, templateId: 'welcome_series_3', delayHours: 168, description: 'First purchase nudge + discount urgency' },
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
    abTestStep: 1,
    abVariants: {
      A: { subjectLine: 'You left something behind — your cart is waiting' },
      B: { subjectLine: 'Still thinking it over? Your futon is almost gone' },
    },
  },
  post_purchase: {
    steps: [
      { step: 1, templateId: 'post_purchase_1', delayHours: 72, description: 'Assembly follow-up — How\'s setup going?' },
      { step: 2, templateId: 'post_purchase_2', delayHours: 168, description: 'Review solicitation — Enjoying your furniture?' },
      { step: 3, templateId: 'post_purchase_3', delayHours: 720, description: 'Care guide + accessory upsell' },
      { step: 4, templateId: 'post_purchase_review_reward', delayHours: 336, description: 'Day-14 review prompt — earn 100 pts (CF-qy79)' },
    ],
  },
  reengagement: {
    steps: [
      { step: 1, templateId: 'reengagement_1', delayHours: 0, description: 'We miss you + exclusive offer' },
    ],
  },
  restock: {
    steps: [
      { step: 1, templateId: 'restock_notification', delayHours: 0, description: 'Product back in stock notification' },
    ],
  },
  review_thanks: {
    steps: [
      { step: 1, templateId: 'review_thank_you', delayHours: 0, description: 'Thank you for your review + 10% discount' },
    ],
  },
};

// Maximum retry attempts for failed emails
const MAX_RETRY_ATTEMPTS = 3;

// Send window: only deliver emails between these hours (America/New_York).
// Emails scheduled outside this window are deferred to the next window open.
const SEND_WINDOW = { startHour: 8, endHour: 20, timezone: 'America/New_York' };

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

  return triggerWelcomeSequence(contactId, email, firstName)
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

  return Promise.all([
    // Send customer-facing order confirmation
    import('backend/emailService.web')
      .then(({ sendOrderConfirmation }) => sendOrderConfirmation({
        contactId,
        email,
        firstName,
        orderNumber: String(orderNumber),
        total: typeof total === 'number' ? `$${total.toFixed(2)}` : String(total),
        itemSummary: lineItems.map(i => `${i.quantity}× ${i.name}`).join(', '),
      }))
      .catch(err => console.error('Error sending order confirmation:', err)),

    // Queue post-purchase care sequence
    triggerPostPurchaseSequence(contactId, email, firstName, orderNumber, total, lineItems)
      .catch(err => console.error('Error triggering post-purchase sequence:', err)),
  ]);
}

/**
 * Triggered when an order fulfillment is created (shipped).
 * Sends a shipping notification with tracking info to the buyer.
 */
export function wixEcom_onFulfillmentCreated(event) {
  const fulfillment = event.entity || event;
  const order = fulfillment.order || {};
  const email = order.buyerInfo?.email || fulfillment.buyerInfo?.email || '';
  const firstName = order.billingInfo?.firstName || order.buyerInfo?.firstName || '';
  const contactId = order.buyerInfo?.contactId || fulfillment.buyerInfo?.contactId || '';
  const orderNumber = order.number || fulfillment.orderNumber || '';
  const tracking = fulfillment.trackingInfo || {};

  if (!email) return;

  import('backend/emailService.web')
    .then(({ sendShippingNotification }) => sendShippingNotification({
      contactId,
      email,
      firstName,
      orderNumber: String(orderNumber),
      trackingNumber: tracking.trackingNumber || '',
      trackingUrl: tracking.trackingLink || '',
      carrier: tracking.shippingProvider || '',
    }))
    .catch(err => console.error('Error sending shipping notification:', err));
}

/**
 * Triggered when an order is marked as delivered.
 * Sends a delivery confirmation email to the buyer.
 */
export function wixEcom_onOrderDelivered(event) {
  const order = event.entity || event;
  const email = order.buyerInfo?.email || '';
  const firstName = order.billingInfo?.firstName || order.buyerInfo?.firstName || '';
  const contactId = order.buyerInfo?.contactId || '';
  const orderNumber = order.number || '';
  const lineItems = order.lineItems || [];

  if (!email) return;

  import('backend/emailService.web')
    .then(({ sendDeliveryConfirmation }) => sendDeliveryConfirmation({
      contactId,
      email,
      firstName,
      orderNumber: String(orderNumber),
    }))
    .catch(err => console.error('Error sending delivery confirmation:', err));

  // CF-qy79: Queue Day-14 review prompt with points reward
  const productNames = lineItems
    .map(i => i.name || i.productName || '')
    .filter(Boolean)
    .join(', ');
  triggerReviewRewardPrompt(contactId, email, firstName, String(orderNumber), productNames)
    .catch(err => console.error('[CF-qy79] Error queuing review reward prompt on delivery:', err));
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
      let discountAvailable = false;
      try {
        discountCode = await getSecret('WELCOME_DISCOUNT_CODE');
        discountAvailable = !!discountCode;
      } catch (e) {
        console.warn('[emailAutomation] Welcome discount unavailable, emails will omit discount:', e.message);
      }

      const abVariant = selectABVariant(cleanEmail);
      const abData = SEQUENCES.welcome.abVariants[abVariant] || {};
      const now = new Date();
      let queued = 0;

      for (const step of SEQUENCES.welcome.steps) {
        const scheduledFor = new Date(now.getTime() + step.delayHours * 60 * 60 * 1000);
        const variables = {
          firstName: cleanName,
          discountCode,
          discountAvailable,
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
 * Trigger the welcome email series for the currently logged-in member.
 * Member-accessible entry point — no contactId required.
 * Uses EmailQueue dedup guard: does not re-queue if welcome step 1 already exists.
 *
 * @function triggerWelcomeSeries
 * @param {string} email - Member email
 * @param {string} [firstName] - Member first name (optional)
 * @returns {Promise<{success: boolean, queued: number}>}
 * @permission Member
 */
export const triggerWelcomeSeries = webMethod(
  Permissions.SiteMember,
  async (email, firstName) => {
    try {
      if (!email) return { success: false, queued: 0 };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) return { success: false, queued: 0 };

      const cleanName = sanitize(firstName || '', 200);

      if (await isUnsubscribed(cleanEmail, 'welcome')) {
        return { success: false, queued: 0 };
      }

      const existing = await wixData.query('EmailQueue')
        .eq('recipientEmail', cleanEmail)
        .eq('sequenceType', 'welcome')
        .eq('sequenceStep', 1)
        .find();

      if (existing.items.length > 0) return { success: false, queued: 0 };

      let discountCode = '';
      let discountAvailable = false;
      try {
        discountCode = await getSecret('WELCOME_DISCOUNT_CODE');
        discountAvailable = !!discountCode;
      } catch (e) {
        console.warn('[emailAutomation] Welcome discount unavailable:', e.message);
      }

      const abVariant = selectABVariant(cleanEmail);
      const abData = SEQUENCES.welcome.abVariants[abVariant] || {};
      const now = new Date();
      let queued = 0;

      for (const step of SEQUENCES.welcome.steps) {
        const scheduledFor = new Date(now.getTime() + step.delayHours * 60 * 60 * 1000);
        const variables = { firstName: cleanName, discountCode, discountAvailable, email: cleanEmail };

        // Apply A/B subject line override for the test step
        if (step.step === SEQUENCES.welcome.abTestStep) {
          variables.subjectLine = (abData.subjectLine || '').replace('{firstName}', cleanName);
        }

        await queueEmail({
          templateId: step.templateId,
          recipientEmail: cleanEmail,
          recipientContactId: '',
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
      console.error('Error queuing welcome series:', err);
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

      const SITE_URL = 'https://www.carolinafutons.com';
      const assemblyGuideUrl = `${SITE_URL}/getting-it-home#assembly`;
      const reviewUrl = `${SITE_URL}/product-page/${cleanOrderNumber}#reviews`;

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
            assemblyGuideUrl,
            reviewUrl,
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
 * Queue a Day-14 review prompt email for a delivered order.
 * Awards 100 pts for a review (+ 50 for photo) — points are awarded when
 * the member submits via gamification_submit_review, not by this email.
 * This just prompts them.
 *
 * CF-qy79
 *
 * @function triggerReviewRewardPrompt
 * @param {string} contactId
 * @param {string} email
 * @param {string} firstName
 * @param {string} orderNumber
 * @param {string} productNames - Comma-separated product names
 * @returns {Promise<{success: boolean}>}
 * @permission Admin
 */
export const triggerReviewRewardPrompt = webMethod(
  Permissions.Admin,
  async (contactId, email, firstName, orderNumber, productNames) => {
    try {
      if (!email) return { success: false };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) return { success: false };

      const cleanName = sanitize(firstName, 200);
      const cleanContactId = sanitize(contactId, 50);
      const cleanOrderNumber = sanitize(orderNumber, 20);
      const cleanProductNames = sanitize(productNames, 500);

      if (await isUnsubscribed(cleanEmail, 'post_purchase')) {
        return { success: false };
      }

      // Don't send duplicate review prompts for the same order
      const existing = await wixData.query('EmailQueue')
        .eq('recipientEmail', cleanEmail)
        .eq('sequenceType', 'post_purchase')
        .eq('sequenceStep', 4)
        .eq('checkoutId', cleanOrderNumber)
        .find();

      if (existing.items.length > 0) return { success: false };

      const SITE_URL = 'https://www.carolinafutons.com';
      const reviewUrl = `${SITE_URL}/product-page/${cleanOrderNumber}#reviews`;
      const scheduledFor = new Date(Date.now() + 336 * 60 * 60 * 1000); // 14 days

      await queueEmail({
        templateId: 'post_purchase_review_reward',
        recipientEmail: cleanEmail,
        recipientContactId: cleanContactId,
        variables: {
          firstName: cleanName,
          orderNumber: cleanOrderNumber,
          productNames: cleanProductNames,
          reviewUrl,
          pointsReward: '100',
          photoBonusPoints: '50',
          email: cleanEmail,
          checkoutId: cleanOrderNumber,
        },
        sequenceType: 'post_purchase',
        sequenceStep: 4,
        scheduledFor,
      });

      return { success: true };
    } catch (err) {
      console.error('[CF-qy79] Error queuing review reward prompt:', err);
      return { success: false };
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

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const cart of result.items) {
        const cartEmail = (cart.buyerEmail || '').toLowerCase().trim();
        if (!cartEmail || !validateEmail(cartEmail)) continue;
        if (await isUnsubscribed(cartEmail, 'cart_recovery')) continue;

        // Check if recovery already queued for this cart (flat field, not nested)
        const alreadyQueued = await wixData.query('EmailQueue')
          .eq('recipientEmail', cartEmail)
          .eq('sequenceType', 'cart_recovery')
          .eq('checkoutId', cart.checkoutId)
          .find();

        if (alreadyQueued.items.length > 0) continue;

        // Cross-cart dedup: skip if any active cart recovery was queued for this email in last 24h
        // Only count pending/sent — cancelled/failed should not block new recovery
        const recentRecovery = await wixData.query('EmailQueue')
          .eq('recipientEmail', cartEmail)
          .eq('sequenceType', 'cart_recovery')
          .eq('sequenceStep', 1)
          .ge('createdAt', oneDayAgo)
          .find();

        const hasActiveRecovery = recentRecovery.items.some(
          item => item.status === 'pending' || item.status === 'sent'
        );
        if (hasActiveRecovery) continue;

        const abandonedAt = new Date(cart.abandonedAt);
        let parsedItems = [];
        try {
          parsedItems = typeof cart.lineItems === 'string'
            ? JSON.parse(cart.lineItems)
            : (cart.lineItems || []);
        } catch (e) { console.warn('[emailAutomation] Malformed lineItems for cart', cart.checkoutId, ':', e.message); parsedItems = []; }
        const itemSummary = parsedItems
          .map(i => `${i.name} (x${i.quantity})`)
          .join(', ');

        for (const step of SEQUENCES.cart_recovery.steps) {
          const scheduledFor = new Date(abandonedAt.getTime() + step.delayHours * 60 * 60 * 1000);

          // Step 3 only: create a unique single-use coupon — do not burn a coupon for steps 1 or 2
          let discountCode = '';
          let discountAvailable = false;
          if (step.step === 3) {
            try {
              const couponResult = await createCartRecoveryCoupon(cartEmail);
              if (couponResult.success) {
                discountCode = couponResult.code;
                discountAvailable = true;
              }
            } catch (e) {
              console.error('[emailAutomation] createCartRecoveryCoupon failed for cart', cart.checkoutId,
                '— email:', cartEmail, '— step 3 will send without discount. Error:', e.message);
            }
          }

          await queueEmail({
            templateId: step.templateId,
            recipientEmail: cartEmail,
            recipientContactId: '',
            variables: {
              buyerName: cart.buyerName || '',
              cartTotal: String(cart.cartTotal || 0),
              itemSummary,
              discountCode,
              discountAvailable,
              checkoutId: cart.checkoutId,
              email: cartEmail,
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
      let discountCode = '';
      let discountAvailable = false;
      try {
        discountCode = await getSecret('RECOVERY_DISCOUNT_CODE');
        discountAvailable = !!discountCode;
      } catch (e) {
        console.warn('[emailAutomation] Reengagement discount unavailable, emails will omit discount:', e.message);
      }

      for (const item of result.items) {
        if (!item.recipientEmail) continue;
        if (await isUnsubscribed(item.recipientEmail, 'reengagement')) continue;

        // Skip if already sent reengagement recently
        const alreadySent = await wixData.query('EmailQueue')
          .eq('recipientEmail', item.recipientEmail)
          .eq('sequenceType', 'reengagement')
          .find();

        if (alreadySent.items.length > 0) continue;

        await queueEmail({
          templateId: SEQUENCES.reengagement.steps[0].templateId,
          recipientEmail: item.recipientEmail,
          recipientContactId: item.recipientContactId || '',
          variables: {
            firstName: item.variables?.firstName || '',
            discountCode,
            discountAvailable,
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
 * @returns {Promise<{sent: number, failed: number, cancelled: number, deferred: number}>}
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
      let deferred = 0;

      // Send-time optimization: defer non-transactional emails outside business hours
      const windowCheck = checkSendWindow(now);
      const deferOutsideWindow = !windowCheck.inWindow;

      for (const item of pending.items) {
        // Cart recovery step 1 and restock are time-sensitive — send regardless of window
        const isTimeSensitive = (
          (item.sequenceType === 'cart_recovery' && item.sequenceStep === 1) ||
          item.sequenceType === 'restock'
        );

        if (deferOutsideWindow && !isTimeSensitive) {
          // Reschedule to next send window open
          await wixData.update('EmailQueue', {
            ...item,
            scheduledFor: windowCheck.nextWindowOpen,
          });
          deferred++;
          continue;
        }

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
          // Stepped backoff: retry in 15min, then 1hr, then give up
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

      return { sent, failed, cancelled, deferred };
    } catch (err) {
      console.error('Error processing email queue:', err);
      return { sent: 0, failed: 0, cancelled: 0, deferred: 0 };
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
 * Select A/B test variant deterministically based on email hash.
 * Same email always gets the same variant, ensuring consistent UX
 * and valid A/B test results (no cross-contamination).
 *
 * @param {string} email - Subscriber email (used as hash input)
 * @returns {'A'|'B'} Variant assignment
 */
function selectABVariant(email = '') {
  if (!email) return Math.random() < 0.5 ? 'A' : 'B';
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2 === 0) ? 'A' : 'B';
}

/**
 * Cancel pending post-purchase emails when an order is cancelled.
 */
async function cancelSequenceForOrder(email, orderNumber) {
  if (!email) return;
  if (!orderNumber) {
    console.warn('[emailAutomation] cancelSequenceForOrder called without orderNumber — skipping to avoid bulk cancellation');
    return;
  }

  const cleanEmail = email.toLowerCase();

  const pending = await wixData.query('EmailQueue')
    .eq('recipientEmail', cleanEmail)
    .eq('sequenceType', 'post_purchase')
    .eq('status', 'pending')
    .find();

  for (const item of pending.items) {
    if (item.variables?.orderNumber === orderNumber) {
      await wixData.update('EmailQueue', {
        ...item,
        status: 'cancelled',
        lastError: `Order ${orderNumber} cancelled`,
      });
    }
  }
}

// ── Restock Notifications ─────────────────────────────────────────────

/**
 * Queue restock notification emails for back-in-stock subscribers.
 * Called by events.js when inventory goes from 0 → positive.
 *
 * @function triggerRestockNotifications
 * @param {string} productId - The restocked product's ID
 * @param {Array<{email: string, contactId?: string, productName?: string}>} subscribers
 * @returns {Promise<{success: boolean, notified: number, failed: number, error?: string}>}
 * @permission Admin
 */
export const triggerRestockNotifications = webMethod(
  Permissions.Admin,
  async (productId, subscribers) => {
    try {
      if (!productId || !Array.isArray(subscribers) || subscribers.length === 0) {
        return { success: false, notified: 0 };
      }

      let notified = 0;
      let failed = 0;
      for (const sub of subscribers) {
        try {
          const email = (sub.email || '').toLowerCase();
          if (!email || !validateEmail(email)) continue;
          if (await isUnsubscribed(email, 'restock')) continue;

          await queueEmail({
            templateId: SEQUENCES.restock.steps[0].templateId,
            recipientEmail: email,
            recipientContactId: sub.contactId || '',
            variables: {
              productName: sanitize(sub.productName || '', 200),
              productId,
              email,
            },
            sequenceType: 'restock',
            sequenceStep: 1,
            scheduledFor: new Date(),
          });

          // Mark subscriber as notified
          if (sub._id) {
            await wixData.update('BackInStockSignups', {
              ...sub,
              notified: true,
              notifiedAt: new Date(),
            });
          }
          notified++;
        } catch (subErr) {
          failed++;
          console.warn(`[emailAutomation] Failed to notify subscriber ${sub.email || 'unknown'} for product ${productId}:`, subErr.message);
        }
      }

      return { success: true, notified, failed };
    } catch (err) {
      console.error('[emailAutomation] Error triggering restock notifications:', err);
      return { success: false, notified: 0, failed: 0, error: err.message };
    }
  }
);

// ── Review Thank-You ──────────────────────────────────────────────────

/**
 * Queue a review thank-you email with discount code.
 *
 * @function triggerReviewThanks
 * @param {string} contactId - Reviewer's contact ID
 * @param {string} email - Reviewer's email
 * @param {string} firstName - Reviewer's first name
 * @param {string} productName - Product that was reviewed
 * @returns {Promise<{success: boolean}>}
 * @permission Admin
 */
export const triggerReviewThanks = webMethod(
  Permissions.Admin,
  async (contactId, email, firstName, productName) => {
    try {
      const cleanEmail = (email || '').toLowerCase();
      if (!cleanEmail || !validateEmail(cleanEmail)) return { success: false };
      if (await isUnsubscribed(cleanEmail, 'review_thanks')) return { success: false };

      let discountCode = '';
      let discountAvailable = false;
      try {
        discountCode = await getSecret('REVIEW_DISCOUNT_CODE');
        discountAvailable = !!discountCode;
      } catch (e) {
        console.warn('[emailAutomation] Could not retrieve review discount secret — sending review email without discount:', e.message);
      }

      await queueEmail({
        templateId: SEQUENCES.review_thanks.steps[0].templateId,
        recipientEmail: cleanEmail,
        recipientContactId: sanitize(contactId, 50),
        variables: {
          firstName: sanitize(firstName, 200),
          productName: sanitize(productName, 200),
          discountCode,
          discountAvailable,
          email: cleanEmail,
        },
        sequenceType: 'review_thanks',
        sequenceStep: 1,
        scheduledFor: new Date(),
      });

      return { success: true };
    } catch (err) {
      console.error('[emailAutomation] Error triggering review thank-you:', err);
      return { success: false };
    }
  }
);

/**
 * Check if current time is within the send window (business hours EST).
 * Returns { inWindow: boolean, nextWindowOpen?: Date }.
 */
function checkSendWindow(now = new Date()) {
  const estHour = parseInt(
    now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: SEND_WINDOW.timezone }),
    10
  );
  if (estHour >= SEND_WINDOW.startHour && estHour < SEND_WINDOW.endHour) {
    return { inWindow: true };
  }
  // Calculate next window open
  const tomorrow8am = new Date(now);
  if (estHour >= SEND_WINDOW.endHour) {
    tomorrow8am.setDate(tomorrow8am.getDate() + 1);
  }
  // Set to startHour EST — approximate by setting UTC hours
  // (exact TZ conversion is complex without Intl, but this is close enough
  // for scheduling purposes; the next processEmailQueue run will re-check)
  const estOffset = 5; // EST is UTC-5 (EDT is UTC-4; close enough for scheduling)
  tomorrow8am.setUTCHours(SEND_WINDOW.startHour + estOffset, 0, 0, 0);
  return { inWindow: false, nextWindowOpen: tomorrow8am };
}

// ── A/B Test Management ──────────────────────────────────────────────

/**
 * Create a new A/B test configuration for a sequence.
 * Supports subject line variants and send-time offset variants.
 *
 * @function createAbTest
 * @param {Object} config
 * @param {string} config.sequenceType - Sequence to test (welcome, cart_recovery, etc.)
 * @param {number} config.testStep - Step number within the sequence to test
 * @param {Object} config.variants - { A: {...}, B: {...} } variant definitions
 * @param {number} [config.sampleSize=100] - Min sends per variant before resolving
 * @param {string} [config.metricField='openRate'] - Metric to compare (openRate or clickRate)
 * @returns {Promise<{success: boolean}>}
 * @permission Admin
 */
export const createAbTest = webMethod(
  Permissions.Admin,
  async (config = {}) => {
    try {
      const { sequenceType, testStep, variants, sampleSize = 100, metricField = 'openRate' } = config;

      if (!sequenceType || testStep == null) return { success: false, reason: 'Missing sequenceType or testStep' };
      if (!variants || !variants.A || !variants.B) return { success: false, reason: 'Missing variant definitions' };
      if (metricField !== 'openRate' && metricField !== 'clickRate') return { success: false, reason: 'Invalid metricField' };

      // Prevent duplicate active tests for same sequence+step
      const existing = await wixData.query('AbTests')
        .eq('sequenceType', sequenceType)
        .eq('testStep', testStep)
        .eq('status', 'active')
        .find();
      if (existing.items.length > 0) return { success: false, reason: 'Active test already exists for this sequence step' };

      await wixData.insert('AbTests', {
        sequenceType,
        testStep,
        variantA: variants.A,
        variantB: variants.B,
        sampleSize,
        metricField,
        status: 'active',
        winner: null,
        variantARate: null,
        variantBRate: null,
        createdAt: new Date(),
        resolvedAt: null,
      });

      return { success: true };
    } catch (err) {
      console.error('[emailAutomation] Error creating A/B test:', err);
      return { success: false, error: err.message };
    }
  }
);

/**
 * Resolve an A/B test winner based on open/click rates.
 * Compares variant performance after sufficient sample size.
 *
 * @function resolveAbTestWinner
 * @param {string} testId - AbTests record _id
 * @returns {Promise<{success: boolean, winner?: string, variantARate?: number, variantBRate?: number, reason?: string}>}
 * @permission Admin
 */
export const resolveAbTestWinner = webMethod(
  Permissions.Admin,
  async (testId) => {
    try {
      if (!testId) return { success: false, reason: 'Missing test ID' };

      const testResult = await wixData.query('AbTests')
        .eq('_id', testId)
        .find();

      if (testResult.items.length === 0) {
        return { success: false, reason: 'Test not found' };
      }

      const test = testResult.items[0];

      if (test.status !== 'active') {
        return { success: false, reason: 'Test already resolved' };
      }

      // Get sent emails per variant (parallel, with pagination limit)
      const queryVariant = (variant) => wixData.query('EmailQueue')
        .eq('sequenceType', test.sequenceType)
        .eq('sequenceStep', test.testStep)
        .eq('abVariant', variant)
        .eq('status', 'sent')
        .limit(1000)
        .find();

      const [variantAResult, variantBResult] = await Promise.all([
        queryVariant('A'), queryVariant('B'),
      ]);

      const aSent = variantAResult.items.length;
      const bSent = variantBResult.items.length;

      if (aSent < test.sampleSize || bSent < test.sampleSize) {
        return { success: false, reason: `Sample size not met: A=${aSent}, B=${bSent}, required=${test.sampleSize}` };
      }

      // Get events for these emails
      const aIds = new Set(variantAResult.items.map(i => i._id));
      const bIds = new Set(variantBResult.items.map(i => i._id));

      const eventsResult = await wixData.query('EmailEvents')
        .eq('eventType', test.metricField === 'clickRate' ? 'click' : 'open')
        .limit(1000)
        .find();

      let aEvents = 0;
      let bEvents = 0;
      for (const event of eventsResult.items) {
        if (aIds.has(event.emailQueueId)) aEvents++;
        if (bIds.has(event.emailQueueId)) bEvents++;
      }

      const variantARate = aSent > 0 ? aEvents / aSent : 0;
      const variantBRate = bSent > 0 ? bEvents / bSent : 0;
      const winner = variantARate >= variantBRate ? 'A' : 'B';

      // Store results
      await wixData.update('AbTests', {
        ...test,
        status: 'resolved',
        winner,
        variantARate,
        variantBRate,
        resolvedAt: new Date(),
      });

      return { success: true, winner, variantARate, variantBRate };
    } catch (err) {
      console.error('[emailAutomation] Error resolving A/B test:', err);
      return { success: false, reason: err.message };
    }
  }
);

/**
 * Get all A/B test results.
 *
 * @function getAbTestResults
 * @returns {Promise<{tests: Array}>}
 * @permission Admin
 */
export const getAbTestResults = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await wixData.query('AbTests').find();
      return {
        tests: result.items.map(t => ({
          _id: t._id,
          sequenceType: t.sequenceType,
          testStep: t.testStep,
          status: t.status,
          winner: t.winner,
          variantARate: t.variantARate,
          variantBRate: t.variantBRate,
          sampleSize: t.sampleSize,
          metricField: t.metricField,
          createdAt: t.createdAt,
          resolvedAt: t.resolvedAt,
        })),
      };
    } catch (err) {
      console.error('[emailAutomation] Error getting A/B test results:', err);
      return { tests: [], error: err.message };
    }
  }
);

/**
 * Get active A/B test config for a sequence type.
 *
 * @function getAbTestConfig
 * @param {string} sequenceType
 * @returns {Promise<{test: Object|null}>}
 * @permission Admin
 */
export const getAbTestConfig = webMethod(
  Permissions.Admin,
  async (sequenceType) => {
    try {
      const result = await wixData.query('AbTests')
        .eq('sequenceType', sequenceType)
        .eq('status', 'active')
        .find();

      return { test: result.items.length > 0 ? result.items[0] : null };
    } catch (err) {
      console.error('[emailAutomation] Error getting A/B test config:', err);
      return { test: null, error: err.message };
    }
  }
);

// ── Campaign Analytics Dashboard ─────────────────────────────────────

/**
 * Get comprehensive campaign analytics for the admin dashboard.
 * Includes send/open/click rates per campaign, sequence completion rates,
 * unsubscribe trending, and A/B test results.
 *
 * @function getCampaignAnalytics
 * @param {number} [days=30] - Lookback window in days
 * @returns {Promise<Object>} Dashboard analytics data
 * @permission Admin
 */
export const getCampaignAnalytics = webMethod(
  Permissions.Admin,
  async (days = 30) => {
    try {
      const parsed = Number(days);
      const safeDays = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 365)) : 30;
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

      // 1. Fetch emails in period (limit 1000 — Wix find() defaults to 50)
      const emailResult = await wixData.query('EmailQueue')
        .ge('createdAt', since)
        .limit(1000)
        .find();
      const emails = emailResult.items || [];

      // 2. Fetch events in period
      const eventsResult = await wixData.query('EmailEvents')
        .ge('timestamp', since)
        .limit(1000)
        .find();
      const events = eventsResult.items || [];

      // Build event lookup: emailQueueId → { opens, clicks }
      const eventsByEmail = {};
      for (const evt of events) {
        if (!eventsByEmail[evt.emailQueueId]) {
          eventsByEmail[evt.emailQueueId] = { opens: 0, clicks: 0 };
        }
        if (evt.eventType === 'open') eventsByEmail[evt.emailQueueId].opens++;
        if (evt.eventType === 'click') eventsByEmail[evt.emailQueueId].clicks++;
      }

      // 3. Build per-campaign stats
      const campaigns = {};
      for (const email of emails) {
        const seq = email.sequenceType || 'unknown';
        if (!campaigns[seq]) {
          campaigns[seq] = { sent: 0, failed: 0, cancelled: 0, pending: 0, opens: 0, clicks: 0 };
        }
        campaigns[seq][email.status] = (campaigns[seq][email.status] || 0) + 1;

        const emailEvents = eventsByEmail[email._id];
        if (emailEvents) {
          campaigns[seq].opens += emailEvents.opens;
          campaigns[seq].clicks += emailEvents.clicks;
        }
      }

      // Calculate rates
      for (const seq of Object.keys(campaigns)) {
        const c = campaigns[seq];
        c.openRate = c.sent > 0 ? c.opens / c.sent : 0;
        c.clickRate = c.sent > 0 ? c.clicks / c.sent : 0;
      }

      // 4. Sequence completion rates
      const completionRates = {};
      const seqsByRecipient = {};
      for (const email of emails) {
        const key = `${email.sequenceType}:${email.recipientEmail}`;
        if (!seqsByRecipient[key]) {
          seqsByRecipient[key] = { seq: email.sequenceType, maxStep: 0, sentSteps: new Set() };
        }
        if (email.status === 'sent') {
          seqsByRecipient[key].sentSteps.add(email.sequenceStep);
          seqsByRecipient[key].maxStep = Math.max(seqsByRecipient[key].maxStep, email.sequenceStep);
        }
      }

      // Determine max step per sequence from SEQUENCES config
      const seqMaxSteps = {};
      for (const [seqName, seqDef] of Object.entries(SEQUENCES)) {
        seqMaxSteps[seqName] = Math.max(...seqDef.steps.map(s => s.step));
      }

      const seqEntered = {};
      const seqCompleted = {};
      for (const data of Object.values(seqsByRecipient)) {
        const seq = data.seq;
        seqEntered[seq] = (seqEntered[seq] || 0) + 1;
        const maxStep = seqMaxSteps[seq] || data.maxStep;
        if (data.sentSteps.has(maxStep)) {
          seqCompleted[seq] = (seqCompleted[seq] || 0) + 1;
        }
      }

      for (const seq of Object.keys(seqEntered)) {
        completionRates[seq] = {
          entered: seqEntered[seq],
          completed: seqCompleted[seq] || 0,
          rate: seqEntered[seq] > 0 ? (seqCompleted[seq] || 0) / seqEntered[seq] : 0,
        };
      }

      // 5. Unsubscribe trending
      const unsubResult = await wixData.query('Unsubscribes')
        .ge('unsubscribedAt', since)
        .limit(1000)
        .find();
      const unsubs = unsubResult.items || [];

      const unsubByType = {};
      for (const u of unsubs) {
        const t = u.sequenceType || 'unknown';
        unsubByType[t] = (unsubByType[t] || 0) + 1;
      }

      // 6. A/B test summary
      const abResult = await wixData.query('AbTests').find();
      const abTestSummary = (abResult.items || []).map(t => ({
        _id: t._id,
        sequenceType: t.sequenceType,
        testStep: t.testStep,
        status: t.status,
        winner: t.winner,
        variantARate: t.variantARate,
        variantBRate: t.variantBRate,
      }));

      return {
        success: true,
        periodDays: safeDays,
        campaigns,
        completionRates,
        unsubscribes: {
          total: unsubs.length,
          byType: unsubByType,
        },
        abTestSummary,
      };
    } catch (err) {
      console.error('[emailAutomation] Error fetching campaign analytics:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  }
);

// Export sequence definitions for testing
export const _SEQUENCES = SEQUENCES;
export const _MAX_RETRY_ATTEMPTS = MAX_RETRY_ATTEMPTS;
export const _SEND_WINDOW = SEND_WINDOW;
export { selectABVariant as _selectABVariant, checkSendWindow as _checkSendWindow };
