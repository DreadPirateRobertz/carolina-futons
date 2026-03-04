/**
 * @module emailTemplates
 * @description Email template content and configuration for marketing launch.
 * Provides template metadata, variable schemas, preview content, and subject
 * line helpers for all email sequences: welcome series, abandoned cart recovery,
 * promotional campaigns, and post-purchase follow-up.
 *
 * Works with Wix Triggered Emails — templates are created in Dashboard >
 * Marketing > Triggered Emails using the template IDs and variables defined here.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const SITE_NAME = 'Carolina Futons';
const SUPPORT_PHONE = '(828) 252-9449';

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
    name: 'Welcome — Social Proof',
    sequence: 'welcome',
    step: 3,
    subjectLine: 'See why customers love Carolina Futons',
    previewText: 'Real reviews and photos from happy customers.',
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
    variables: ['buyerName', 'cartTotal', 'itemSummary', 'checkoutId', 'email'],
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
    subjectLine: 'Enjoying your new furniture, {firstName}? Leave a review!',
    previewText: 'Your feedback helps other customers find the perfect piece.',
    variables: ['firstName', 'orderNumber', 'productNames', 'reviewUrl', 'email'],
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
    variables: ['firstName', 'discountCode', 'email'],
    category: 'recovery',
  },
};

// ── Public Web Methods ──────────────────────────────────────────────

/**
 * Get all template metadata for a given sequence type.
 *
 * @function getTemplatesBySequence
 * @param {string} sequenceType - Sequence name: welcome, cart_recovery, post_purchase, promotional, reengagement
 * @returns {Promise<Array<Object>>} Array of template metadata objects, sorted by step.
 * @permission Admin
 */
export const getTemplatesBySequence = webMethod(
  Permissions.Admin,
  async (sequenceType) => {
    const cleanType = sanitize(sequenceType, 50);
    return Object.values(TEMPLATE_REGISTRY)
      .filter(t => t.sequence === cleanType)
      .sort((a, b) => a.step - b.step);
  }
);

/**
 * Get a single template's metadata by its ID.
 *
 * @function getTemplate
 * @param {string} templateId - Template ID (e.g., 'welcome_series_1')
 * @returns {Promise<Object|null>} Template metadata or null if not found.
 * @permission Admin
 */
export const getTemplate = webMethod(
  Permissions.Admin,
  async (templateId) => {
    const cleanId = sanitize(templateId, 100);
    return TEMPLATE_REGISTRY[cleanId] || null;
  }
);

/**
 * Get all available template IDs grouped by sequence.
 *
 * @function getTemplateIndex
 * @returns {Promise<Object>} Map of sequence -> template IDs.
 * @permission Admin
 */
export const getTemplateIndex = webMethod(
  Permissions.Admin,
  async () => {
    const index = {};
    for (const template of Object.values(TEMPLATE_REGISTRY)) {
      if (!index[template.sequence]) index[template.sequence] = [];
      index[template.sequence].push(template.id);
    }
    return index;
  }
);

/**
 * Resolve a subject line template with variables.
 * Replaces {variableName} placeholders with provided values.
 *
 * @function resolveSubjectLine
 * @param {string} templateId - Template ID
 * @param {Object} variables - Variable values to substitute
 * @returns {Promise<string>} Resolved subject line
 * @permission Admin
 */
export const resolveSubjectLine = webMethod(
  Permissions.Admin,
  async (templateId, variables = {}) => {
    const template = TEMPLATE_REGISTRY[sanitize(templateId, 100)];
    if (!template) return '';

    let subject = template.subjectLine;
    for (const [key, value] of Object.entries(variables)) {
      const cleanKey = sanitize(key, 50);
      const cleanVal = sanitize(String(value || ''), 200);
      subject = subject.replace(new RegExp(`\\{${cleanKey}\\}`, 'g'), cleanVal);
    }
    return subject;
  }
);

/**
 * Validate that all required variables are present for a template.
 *
 * @function validateTemplateVariables
 * @param {string} templateId - Template ID
 * @param {Object} variables - Provided variables
 * @returns {Promise<{valid: boolean, missing: string[]}>}
 * @permission Admin
 */
export const validateTemplateVariables = webMethod(
  Permissions.Admin,
  async (templateId, variables = {}) => {
    const template = TEMPLATE_REGISTRY[sanitize(templateId, 100)];
    if (!template) return { valid: false, missing: ['Template not found'] };

    const missing = template.variables.filter(v => !variables[v] && variables[v] !== 0);
    return { valid: missing.length === 0, missing };
  }
);

/**
 * Get email performance summary from EmailQueue for a specific template.
 *
 * @function getTemplatePerformance
 * @param {string} templateId - Template ID
 * @param {number} [days=30] - Lookback window in days
 * @returns {Promise<{sent: number, failed: number, cancelled: number, pending: number}>}
 * @permission Admin
 */
export const getTemplatePerformance = webMethod(
  Permissions.Admin,
  async (templateId, days = 30) => {
    try {
      const cleanId = sanitize(templateId, 100);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await wixData.query('EmailQueue')
        .eq('templateId', cleanId)
        .ge('createdAt', since)
        .find();

      const stats = { sent: 0, failed: 0, cancelled: 0, pending: 0 };
      for (const item of result.items) {
        if (stats[item.status] !== undefined) {
          stats[item.status]++;
        }
      }

      return stats;
    } catch (err) {
      console.error('[emailTemplates] Error fetching template performance:', err);
      return { sent: 0, failed: 0, cancelled: 0, pending: 0 };
    }
  }
);

/**
 * Queue a promotional email to a list of contacts.
 *
 * @function queuePromotionalEmail
 * @param {string} templateId - Promotional template ID
 * @param {Array<{email: string, contactId: string, firstName: string}>} recipients
 * @param {Object} campaignVariables - Shared campaign variables (saleName, discountPercent, etc.)
 * @returns {Promise<{success: boolean, queued: number, skipped: number}>}
 * @permission Admin
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

// Export for testing
export const _TEMPLATE_REGISTRY = TEMPLATE_REGISTRY;
