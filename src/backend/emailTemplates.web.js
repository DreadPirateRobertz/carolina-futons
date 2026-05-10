/**
 * @module emailTemplates
 * @description Wix CRM dashboard template-ID map + the live promotional
 * email queueing endpoint.
 *
 * cf-4x7e Pass 3 chunk A (cf-q8m2) retired the SUPERSEDE-shaped admin
 * surface that lived here: 18 webMethods (template registry browse,
 * preview helpers, dynamic content sections, hard-coded welcome/order/
 * post-purchase template generators) plus their private impls
 * (_get*Section helpers, makeEmailGenerator factory, generate*Email
 * convenience exports, buildProductBlock helper) and the
 * CATEGORY_LABELS const that supported them. None had real callers per
 * cf-3l5l triage (95% dead surface) — production templates flow through
 * Wix Triggered Emails using TEMPLATE_ID_MAP at dispatch time.
 *
 * What's left:
 *   - TEMPLATE_ID_MAP — Wix dashboard ID lookup; ~20 callers across
 *     emailService, emailAutomation, etc.
 *   - resolveTemplateId — the lookup helper used at every dispatch site
 *   - queuePromotionalEmail — admin-trigger webMethod that the
 *     contentScheduler cron uses to fan out promotional sends; reads
 *     the trimmed TEMPLATE_REGISTRY (marketing entries only)
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Wix CRM Dashboard Template-ID Map ──────────────────────────────────
// Stilgar registered the production templates with opaque IDs different
// from the human-readable names. Outgoing triggeredEmails.emailContact()
// calls must pass the dashboard ID, not the human-readable name. Use
// resolveTemplateId('<human_name>') at every dispatch boundary so the
// call site stays grep-friendly.
//
// Map sourced from melania 2026-05-10. Extend in lockstep with cf-c6g5
// template registrations on staging — any human_name not in this map
// resolves to itself (callers using the literal still work; the dashboard
// will reject if the template is unregistered, surfacing the gap clearly).
export const TEMPLATE_ID_MAP = Object.freeze({
  // Welcome series
  welcome_series_1: 'VJBSYDf',
  welcome_series_2: 'VJBSndP',
  welcome_series_3: 'VJBT0f4',
  welcome_series_4: 'VJBT8lB',
  welcome_series_5: 'VJBTFoO',
  // Cart recovery
  cart_recovery_1: 'VJBTMzv',
  cart_recovery_2: 'VJBTRJe',
  cart_recovery_3: 'VJBTXIu',
  // Order lifecycle
  order_confirmation: 'VJBTjjZ',
  order_shipped: 'VJBTpK1',
  delivery_confirmation: 'VJBTuXp',
  freight_shipped: 'VJBUKCa',
  // Post-purchase
  post_purchase_1: 'VJBVVig',
  post_purchase_2: 'VJBVc41',
  post_purchase_3: 'VJBVi9P',
  post_purchase_review_reward: 'VJBVq0v',
  post_purchase_referral: 'VJBVv8f',
  // Promotional
  promotional_sale: 'VJBW0Rt',
  promotional_new_arrival: 'VJBW5IP',
  promotional_seasonal: 'VJBWBgb',
  // Re-engagement
  reengagement_1: 'VJBWIEt',
  reengagement_2: 'VJBWO0C',
  reengagement_3: 'VJBWTd7',
  // Transactional / one-off
  contact_form_submission: 'VJBU6zD',
  contact_form_auto_reply: 'VJBOnfD',
  swatch_confirmation: 'VJBTzwh',
  new_order_notification: 'VJBUDr1',
  owner_alert: 'VJBVPLd',
});

/**
 * Resolve a human-readable template name to its Wix CRM dashboard ID.
 * Falls through to the input if the name isn't in TEMPLATE_ID_MAP — that
 * way unmapped templates still attempt dispatch (Wix surfaces the failure
 * cleanly) without forcing every dispatch site to add a guard.
 *
 * @param {string} name - Human-readable template name (e.g. 'welcome_series_1')
 * @returns {string} Dashboard ID if mapped, else the input name unchanged
 */
export function resolveTemplateId(name) {
  return TEMPLATE_ID_MAP[name] || name;
}

// ── Template Registry ───────────────────────────────────────────────
// Central registry of all email templates with metadata and variable schemas.

const TEMPLATE_REGISTRY = {
  // Welcome Series
  welcome_series_1: {
    id: 'welcome_series_1',
    name: 'Welcome — Brand Story + Discount',
    sequence: 'welcome',
    step: 1,
    subjectLine: 'Welcome to Carolina Futons — here\'s 10% off your first order',
    previewText: 'Family-owned since 1991 in Hendersonville, NC. Your 10% discount code is inside.',
    variables: ['firstName', 'discountCode', 'email'],
    category: 'onboarding',
  },
  welcome_series_2: {
    id: 'welcome_series_2',
    name: 'Welcome — Buying Guide',
    sequence: 'welcome',
    step: 2,
    subjectLine: 'How to choose the perfect futon for your space',
    previewText: 'Frame styles, mattress types, and sizing — our expert guide.',
    variables: ['firstName', 'email'],
    category: 'onboarding',
  },
  welcome_series_3: {
    id: 'welcome_series_3',
    name: 'Welcome — First Purchase Nudge',
    sequence: 'welcome',
    step: 3,
    subjectLine: 'Your 10% off expires soon — shop Carolina Futons now',
    previewText: 'Your welcome discount is still active. Don\'t miss out.',
    variables: ['firstName', 'discountCode', 'email'],
    category: 'onboarding',
  },
  welcome_series_4: {
    id: 'welcome_series_4',
    name: 'Welcome — Day 14 Browse Reminder',
    sequence: 'welcome',
    step: 4,
    subjectLine: 'Still exploring? Let us help you find the perfect futon',
    previewText: 'Day 14 check-in — helpful tips to make your decision easier.',
    variables: ['firstName', 'email'],
    category: 'onboarding',
  },
  welcome_series_5: {
    id: 'welcome_series_5',
    name: 'Welcome — Day 21 Final Value Email',
    sequence: 'welcome',
    step: 5,
    subjectLine: 'Families across the Carolinas trust us — here\'s why',
    previewText: 'Real stories from real customers. A final note from our team.',
    variables: ['firstName', 'email'],
    category: 'onboarding',
  },

  // Abandoned Cart Recovery
  cart_recovery_1: {
    id: 'cart_recovery_1',
    name: 'Cart Recovery — Gentle Reminder',
    sequence: 'cart_recovery',
    step: 1,
    subjectLine: 'You left something behind at Carolina Futons',
    previewText: 'Your cart is saved — come back and finish your order.',
    variables: ['buyerName', 'cartTotal', 'itemSummary', 'checkoutId', 'email',
      'pointsBalance', 'pointsDiscount', 'pointsToEarn', 'nextTierName', 'pointsToNextTier', 'hasLoyalty'],
    category: 'recovery',
  },
  cart_recovery_2: {
    id: 'cart_recovery_2',
    name: 'Cart Recovery — Social Proof',
    sequence: 'cart_recovery',
    step: 2,
    subjectLine: 'Your saved items are popular — don\'t miss out',
    previewText: 'See what other customers say about the items in your cart.',
    variables: ['buyerName', 'cartTotal', 'itemSummary', 'checkoutId', 'email'],
    category: 'recovery',
  },
  cart_recovery_3: {
    id: 'cart_recovery_3',
    name: 'Cart Recovery — Discount Incentive',
    sequence: 'cart_recovery',
    step: 3,
    subjectLine: 'Last chance: Save on your Carolina Futons cart',
    previewText: 'We\'ve added a special discount to help you complete your order.',
    variables: ['buyerName', 'cartTotal', 'itemSummary', 'discountCode', 'checkoutId', 'email'],
    category: 'recovery',
  },

  // Transactional — Order Lifecycle
  order_confirmation: {
    id: 'order_confirmation',
    name: 'Order Confirmation',
    sequence: 'transactional',
    step: 1,
    subjectLine: 'Order #{orderNumber} confirmed — thank you for your purchase!',
    previewText: 'We\'ve received your order and are getting it ready.',
    variables: ['firstName', 'orderNumber', 'total', 'itemSummary', 'estimatedDays', 'email'],
    category: 'transactional',
  },
  order_shipped: {
    id: 'order_shipped',
    name: 'Order Shipped',
    sequence: 'transactional',
    step: 2,
    subjectLine: 'Your order #{orderNumber} is on its way!',
    previewText: 'Your Carolina Futons order has shipped. Track your delivery here.',
    variables: ['firstName', 'orderNumber', 'trackingNumber', 'trackingUrl', 'carrier', 'estimatedDays', 'email'],
    category: 'transactional',
  },
  delivery_confirmation: {
    id: 'delivery_confirmation',
    name: 'Delivery Confirmation',
    sequence: 'transactional',
    step: 3,
    subjectLine: 'Your order #{orderNumber} has been delivered!',
    previewText: 'Your furniture has arrived. Let us know if you need any help with setup.',
    variables: ['firstName', 'orderNumber', 'email'],
    category: 'transactional',
  },

  // Post-Purchase Care Sequence (Day 3/7/30)
  post_purchase_1: {
    id: 'post_purchase_1',
    name: 'Post-Purchase — Assembly Follow-Up',
    sequence: 'post_purchase',
    step: 1,
    subjectLine: 'How\'s setup going, {firstName}? Need help with assembly?',
    previewText: 'Quick-start guide and video walkthrough for easy setup. We\'re here to help.',
    variables: ['firstName', 'orderNumber', 'total', 'productNames', 'assemblyGuideUrl', 'email'],
    category: 'transactional',
  },
  post_purchase_2: {
    id: 'post_purchase_2',
    name: 'Post-Purchase — Review Solicitation',
    sequence: 'post_purchase',
    step: 2,
    subjectLine: "How's your new {productNames}? Share your experience",
    previewText: 'Leave a review and earn 50 loyalty points.',
    variables: ['firstName', 'orderNumber', 'productNames', 'reviewUrl', 'email', 'pointsReward', 'photoBonusPoints'],
    category: 'transactional',
  },
  post_purchase_3: {
    id: 'post_purchase_3',
    name: 'Post-Purchase — Care Guide + Upsell',
    sequence: 'post_purchase',
    step: 3,
    subjectLine: 'Keep your furniture looking great — care tips inside',
    previewText: 'Maintenance guide plus accessories that complement your purchase.',
    variables: ['firstName', 'orderNumber', 'productNames', 'email'],
    category: 'transactional',
  },
  post_purchase_review_reward: {
    id: 'post_purchase_review_reward',
    name: 'Post-Purchase — Review Reward (Day 14)',
    sequence: 'post_purchase',
    step: 4,
    subjectLine: "How's your new {productNames}? Earn points for a review",
    previewText: 'Leave a review and earn 100 loyalty points. Photo bonus available.',
    variables: ['firstName', 'orderNumber', 'productNames', 'reviewUrl', 'pointsReward', 'photoBonusPoints', 'email'],
    category: 'transactional',
  },
  post_purchase_referral: {
    id: 'post_purchase_referral',
    name: 'Post-Purchase — Referral Invite (Day 15)',
    sequence: 'post_purchase',
    step: 5,
    subjectLine: 'Love your new furniture, {firstName}? Share the love — earn $25',
    previewText: 'Give friends $25 off their first order. You earn $25 store credit when they buy.',
    variables: ['firstName', 'referralUrl', 'referralCode', 'email'],
    category: 'transactional',
  },

  // Contact form auto-reply (cf-hafn / cf-icww F6)
  // Customer-side acknowledgement after submitting the contact form. Owner
  // notification is the existing `contact_form_submission` template (in the
  // Wix CRM Triggered Emails dashboard, not registered here as the dashboard
  // is the source of truth for that one). This auto-reply closes the
  // silent-confirmation gap surfaced in cf-icww F6 — submitters were getting
  // a UI "thanks" but no inbox confirmation, leading to repeat submissions.
  contact_form_auto_reply: {
    id: 'contact_form_auto_reply',
    name: 'Contact Form — Customer Auto-Reply',
    sequence: 'contact',
    step: 1,
    subjectLine: 'We got your message — Carolina Futons',
    previewText: 'A real human will reply within 1 business day. Here\'s what you sent.',
    variables: ['customerName', 'subject', 'message', 'replyEta', 'supportPhone', 'email'],
    category: 'transactional',
  },

  // Promotional
  promotional_sale: {
    id: 'promotional_sale',
    name: 'Promotional — Sale Announcement',
    sequence: 'promotional',
    step: 1,
    subjectLine: '{saleName} at Carolina Futons — up to {discountPercent}% off',
    previewText: 'Limited-time savings on futon frames, mattresses, and more.',
    variables: ['firstName', 'saleName', 'discountPercent', 'startDate', 'endDate', 'promoCode', 'email'],
    category: 'marketing',
  },
  promotional_new_arrival: {
    id: 'promotional_new_arrival',
    name: 'Promotional — New Arrival',
    sequence: 'promotional',
    step: 1,
    subjectLine: 'Just arrived: {productName}',
    previewText: 'Be the first to see our newest addition.',
    variables: ['firstName', 'productName', 'productUrl', 'productImage', 'productPrice', 'email'],
    category: 'marketing',
  },
  promotional_seasonal: {
    id: 'promotional_seasonal',
    name: 'Promotional — Seasonal Campaign',
    sequence: 'promotional',
    step: 1,
    subjectLine: '{seasonName} furniture refresh — new arrivals inside',
    previewText: 'Fresh styles for the new season at Carolina Futons.',
    variables: ['firstName', 'seasonName', 'heroImage', 'ctaUrl', 'email'],
    category: 'marketing',
  },

  // Re-engagement
  reengagement_1: {
    id: 'reengagement_1',
    name: 'Re-engagement — We Miss You',
    sequence: 'reengagement',
    step: 1,
    subjectLine: 'We miss you, {firstName} — here\'s a special offer',
    previewText: 'It\'s been a while! Come back with an exclusive discount.',
    variables: ['firstName', 'discountCode', 'discountAvailable', 'email'],
    category: 'recovery',
  },

  reengagement_2: {
    id: 'reengagement_2',
    name: "Re-engagement — Here's a Deal",
    sequence: 'reengagement',
    step: 2,
    subjectLine: "Still looking, {firstName}? Here's a deal",
    previewText: "See what's new at Carolina Futons — your offer is still waiting.",
    variables: ['firstName', 'discountCode', 'discountAvailable', 'email'],
    category: 'recovery',
  },

  reengagement_3: {
    id: 'reengagement_3',
    name: 'Re-engagement — Last Chance',
    sequence: 'reengagement',
    step: 3,
    subjectLine: 'Last chance, {firstName} — your offer expires soon',
    previewText: "This is your final reminder. Your exclusive offer won't last.",
    variables: ['firstName', 'discountCode', 'discountAvailable', 'email'],
    category: 'recovery',
  },
};



// ── queuePromotionalEmail (admin trigger; called by contentScheduler cron) ──

/**
 * Queue a promotional email for a list of recipients. Honors the
 * Unsubscribes table (`sequenceType: 'all' | 'promotional'` blocks the
 * recipient). Only templates with `category === 'marketing'` are
 * acceptable — the registry above is filtered to those entries.
 *
 * @param {string} templateId      — promotional_sale | promotional_new_arrival | promotional_seasonal
 * @param {Array}  recipients      — [{ email, firstName?, contactId? }, ...]
 * @param {Object} [campaignVariables] — extra template variables (saleName, discountPercent, etc.)
 * @returns {Promise<{success: boolean, queued: number, skipped: number}>}
 */
export const queuePromotionalEmail = webMethod(
  Permissions.Admin,
  async (templateId, recipients, campaignVariables = {}) => {
    try {
      const template = TEMPLATE_REGISTRY[sanitize(templateId, 100)];
      if (!template || template.category !== 'marketing') {
        return { success: false, queued: 0, skipped: 0 };
      }

      let queued = 0;
      let skipped = 0;

      for (const recipient of (recipients || [])) {
        const email = sanitize(recipient.email || '', 254).toLowerCase();
        if (!email) { skipped++; continue; }

        // Check unsubscribe
        const unsubs = await wixData.query('Unsubscribes')
          .eq('email', email)
          .find();

        if (unsubs.items.some(u => u.sequenceType === 'all' || u.sequenceType === 'promotional')) {
          skipped++;
          continue;
        }

        const variables = {
          ...campaignVariables,
          firstName: sanitize(recipient.firstName || '', 200),
          email,
        };

        await wixData.insert('EmailQueue', {
          templateId: template.id,
          recipientEmail: email,
          recipientContactId: sanitize(recipient.contactId || '', 50),
          variables,
          sequenceType: 'promotional',
          sequenceStep: 1,
          status: 'pending',
          scheduledFor: new Date(),
          sentAt: null,
          attempt: 0,
          lastError: '',
          abVariant: null,
          createdAt: new Date(),
        });
        queued++;
      }

      return { success: true, queued, skipped };
    } catch (err) {
      console.error('[emailTemplates] Error queuing promotional email:', err);
      return { success: false, queued: 0, skipped: 0 };
    }
  }
);

// Test export — used by tests/provisionEmailTemplates.test.js + tests/contactFormAutoReply.cfhafn.test.js
// to cross-validate the manifest. Not for production import.
export const _TEMPLATE_REGISTRY = TEMPLATE_REGISTRY;
