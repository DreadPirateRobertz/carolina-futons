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
    name: 'Welcome — First Purchase Nudge',
    sequence: 'welcome',
    step: 3,
    subjectLine: 'Your 10% off expires soon — shop Carolina Futons now',
    previewText: 'Your welcome discount is still active. Don\'t miss out.',
    variables: ['firstName', 'discountCode', 'email'],
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

// ── Category Display Labels ─────────────────────────────────────────
// Maps catalog-MASTER.json category slugs to human-readable labels.

const CATEGORY_LABELS = {
  'futon-frames': 'Futon Frames',
  'murphy-cabinet-beds': 'Murphy Cabinet Beds',
  'platform-beds': 'Platform Beds',
  'mattresses': 'Mattresses',
  'casegoods-accessories': 'Casegoods & Accessories',
  'covers': 'Futon Covers',
  'outdoor-furniture': 'Outdoor Furniture',
  'pillows-702': 'Pillows',
  'log-frames': 'Log Futon Frames',
  'wall-hugger-frames': 'Wall Hugger Frames',
  'front-loading-nesting': 'Front-Loading & Nesting Frames',
};

// ── Product Block Helpers ───────────────────────────────────────────

/**
 * Build an HTML block for a single product card in an email template.
 * Uses inline styles for email client compatibility.
 *
 * @param {Object} product - Product object from catalog-MASTER.json
 * @param {string} product.name - Product name
 * @param {number|null} product.price - Price in dollars
 * @param {string} product.url - Full product URL
 * @param {string[]} product.images - Array of image URLs
 * @returns {string} HTML string for the product card
 */
export function buildProductBlock(product) {
  if (!product || !product.name) return '';

  const name = sanitize(product.name, 200);
  const price = product.price != null ? `$${Number(product.price).toFixed(2)}` : '';
  const url = product.url || `${SITE_URL}/product-page/${product.slug || ''}`;
  const image = (product.images && product.images[0]) || '';

  const imageHtml = image
    ? `<img src="${sanitize(image, 500)}" alt="${name}" width="200" style="display:block;border-radius:4px;max-width:100%;" />`
    : '';

  return `<table cellpadding="0" cellspacing="0" border="0" width="200" style="display:inline-block;vertical-align:top;margin:8px;text-align:center;">
  <tr><td>${imageHtml}</td></tr>
  <tr><td style="padding:8px 4px 2px;font-family:Arial,sans-serif;font-size:14px;color:#333;">${name}</td></tr>
  ${price ? `<tr><td style="padding:2px 4px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#1a1a1a;">${price}</td></tr>` : ''}
  <tr><td style="padding:6px 4px;"><a href="${sanitize(url, 500)}" style="display:inline-block;padding:8px 16px;background-color:#8B4513;color:#fff;text-decoration:none;border-radius:4px;font-family:Arial,sans-serif;font-size:13px;">Shop Now</a></td></tr>
</table>`;
}

/**
 * Generate a "New Arrivals" email section from catalog products.
 * Selects the most recently added products (by array order — newest last in catalog).
 *
 * @function getNewArrivalsSection
 * @param {Array<Object>} products - Products array from catalog-MASTER.json
 * @param {number} [limit=4] - Max products to feature
 * @returns {Promise<string>} HTML section string
 * @permission Anyone
 */
async function _getNewArrivalsSection(products, limit = 4) {
  if (!Array.isArray(products) || products.length === 0) return '';

  const cap = Math.min(Math.max(1, limit), 8);
  // Newest products are at the end of the catalog array
  const arrivals = products
    .filter(p => p.name && p.price != null)
    .slice(-cap)
    .reverse();

  if (arrivals.length === 0) return '';

  const blocks = arrivals.map(p => buildProductBlock(p)).join('\n');

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td style="padding:16px 0 8px;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:#1a1a1a;text-align:center;">New Arrivals</td></tr>
  <tr><td style="text-align:center;">${blocks}</td></tr>
  <tr><td style="text-align:center;padding:12px 0;"><a href="${SITE_URL}/shop-main" style="font-family:Arial,sans-serif;font-size:14px;color:#8B4513;text-decoration:underline;">View all products →</a></td></tr>
</table>`;
}

export const getNewArrivalsSection = webMethod(Permissions.Anyone, _getNewArrivalsSection);

/**
 * Generate a "Category Spotlight" email section featuring products from a specific category.
 *
 * @function getCategorySpotlightSection
 * @param {Array<Object>} products - Products array from catalog-MASTER.json
 * @param {string} categorySlug - Category slug (e.g., 'futon-frames', 'murphy-cabinet-beds')
 * @param {number} [limit=4] - Max products to feature
 * @returns {Promise<string>} HTML section string
 * @permission Anyone
 */
export const getCategorySpotlightSection = webMethod(
  Permissions.Anyone,
  async (products, categorySlug, limit = 4) => {
    if (!Array.isArray(products) || !categorySlug) return '';

    const cleanSlug = sanitize(categorySlug, 100);
    const label = CATEGORY_LABELS[cleanSlug] || cleanSlug;
    const cap = Math.min(Math.max(1, limit), 8);

    const categoryProducts = products
      .filter(p => p.category === cleanSlug && p.name && p.price != null)
      .slice(0, cap);

    if (categoryProducts.length === 0) return '';

    const blocks = categoryProducts.map(p => buildProductBlock(p)).join('\n');

    return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td style="padding:16px 0 8px;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:#1a1a1a;text-align:center;">Spotlight: ${sanitize(label, 100)}</td></tr>
  <tr><td style="text-align:center;">${blocks}</td></tr>
  <tr><td style="text-align:center;padding:12px 0;"><a href="${SITE_URL}/shop-main" style="font-family:Arial,sans-serif;font-size:14px;color:#8B4513;text-decoration:underline;">Browse all ${sanitize(label, 100)} →</a></td></tr>
</table>`;
  }
);

/**
 * Generate a product recommendations block for email templates.
 * Picks a diverse set of products across categories.
 *
 * @function getProductRecommendationBlock
 * @param {Array<Object>} products - Products array from catalog-MASTER.json
 * @param {number} [limit=4] - Max products to feature
 * @returns {Promise<string>} HTML section string
 * @permission Anyone
 */
export const getProductRecommendationBlock = webMethod(
  Permissions.Anyone,
  async (products, limit = 4) => {
    if (!Array.isArray(products) || products.length === 0) return '';

    const cap = Math.min(Math.max(1, limit), 8);
    const eligible = products.filter(p => p.name && p.price != null && p.images && p.images.length > 0);
    if (eligible.length === 0) return '';

    // Pick one product per category for diversity, round-robin
    const byCategory = {};
    for (const p of eligible) {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    }

    const picks = [];
    const cats = Object.keys(byCategory);
    let catIdx = 0;
    while (picks.length < cap && picks.length < eligible.length) {
      const cat = cats[catIdx % cats.length];
      const catProducts = byCategory[cat];
      const pickIdx = Math.floor(picks.length / cats.length);
      if (pickIdx < catProducts.length) {
        picks.push(catProducts[pickIdx]);
      }
      catIdx++;
      // Safety: break if we've cycled through all categories without adding
      if (catIdx > cats.length * cap) break;
    }

    const blocks = picks.map(p => buildProductBlock(p)).join('\n');

    return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td style="padding:16px 0 8px;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:#1a1a1a;text-align:center;">Recommended for You</td></tr>
  <tr><td style="text-align:center;">${blocks}</td></tr>
  <tr><td style="text-align:center;padding:12px 0;"><a href="${SITE_URL}/shop-main" style="font-family:Arial,sans-serif;font-size:14px;color:#8B4513;text-decoration:underline;">Explore our full collection →</a></td></tr>
</table>`;
  }
);

// ── Price Drop Product Block ────────────────────────────────────────

/**
 * Build an HTML block for a price-drop product card.
 * Shows strikethrough previous price, current price, and savings %.
 *
 * @param {Object} product - Product requiring name, price, previousPrice (> price), and optionally url, slug, images
 * @returns {string} HTML string for the price-drop product card, or empty string if product is invalid or price did not drop
 */
function buildPriceDropBlock(product) {
  if (!product || !product.name) return '';
  if (product.price == null || product.previousPrice == null) return '';
  const priceNum = Number(product.price);
  const prevPriceNum = Number(product.previousPrice);
  if (isNaN(priceNum) || isNaN(prevPriceNum)) return '';
  if (prevPriceNum <= priceNum) return '';

  const name = sanitize(product.name, 200);
  const currentPrice = `$${priceNum.toFixed(2)}`;
  const prevPrice = `$${prevPriceNum.toFixed(2)}`;
  const savingsPercent = Math.max(1, Math.round(((prevPriceNum - priceNum) / prevPriceNum) * 100));
  const url = product.url || (product.slug ? `${SITE_URL}/product-page/${product.slug}` : `${SITE_URL}/shop-main`);
  const image = (product.images && product.images[0]) || '';

  const imageHtml = image
    ? `<img src="${sanitize(image, 500)}" alt="${name}" width="200" style="display:block;border-radius:4px;max-width:100%;" />`
    : '';

  return `<table cellpadding="0" cellspacing="0" border="0" width="200" style="display:inline-block;vertical-align:top;margin:8px;text-align:center;">
  <tr><td>${imageHtml}</td></tr>
  <tr><td style="padding:8px 4px 2px;font-family:Arial,sans-serif;font-size:14px;color:#333;">${name}</td></tr>
  <tr><td style="padding:2px 4px;font-family:Arial,sans-serif;font-size:12px;color:#999;text-decoration:line-through;">${prevPrice}</td></tr>
  <tr><td style="padding:2px 4px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#c0392b;">${currentPrice} <span style="font-size:12px;color:#27ae60;">(Save ${savingsPercent}%)</span></td></tr>
  <tr><td style="padding:6px 4px;"><a href="${sanitize(url, 500)}" style="display:inline-block;padding:8px 16px;background-color:#8B4513;color:#fff;text-decoration:none;border-radius:4px;font-family:Arial,sans-serif;font-size:13px;">Shop Now</a></td></tr>
</table>`;
}

/**
 * Generate a "Price Drop" email section from products with reduced prices.
 * Products must have a `previousPrice` field > current `price`.
 *
 * @function getPriceDropSection
 * @param {Array<Object>} products - Products with previousPrice field (must be > price)
 * @param {number} [limit=4] - Max products to feature (clamped to 1-8)
 * @returns {Promise<string>} HTML section string
 * @permission Anyone
 */
async function _getPriceDropSection(products, limit = 4) {
  if (!Array.isArray(products) || products.length === 0) return '';

  const cap = Math.min(Math.max(1, limit), 8);
  const drops = products
    .filter(p => p.name && p.price != null && p.previousPrice != null && p.previousPrice > p.price)
    .slice(0, cap);

  if (drops.length === 0) return '';

  const blocks = drops.map(p => buildPriceDropBlock(p)).join('\n');

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td style="padding:16px 0 8px;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:#1a1a1a;text-align:center;">Price Drop Alert</td></tr>
  <tr><td style="text-align:center;">${blocks}</td></tr>
  <tr><td style="text-align:center;padding:12px 0;"><a href="${SITE_URL}/shop-main" style="font-family:Arial,sans-serif;font-size:14px;color:#8B4513;text-decoration:underline;">View all deals →</a></td></tr>
</table>`;
}

export const getPriceDropSection = webMethod(Permissions.Anyone, _getPriceDropSection);

/**
 * Generate a "Back in Stock" email section from restocked products.
 * Products must have availability='InStock' and a restockedAt field.
 *
 * @function getBackInStockSection
 * @param {Array<Object>} products - Products with availability='InStock' and restockedAt field
 * @param {number} [limit=4] - Max products to feature (clamped to 1-8)
 * @returns {Promise<string>} HTML section string
 * @permission Anyone
 */
async function _getBackInStockSection(products, limit = 4) {
  if (!Array.isArray(products) || products.length === 0) return '';

  const cap = Math.min(Math.max(1, limit), 8);
  const restocked = products
    .filter(p => p.name && p.price != null && p.availability === 'InStock' && p.restockedAt)
    .slice(0, cap);

  if (restocked.length === 0) return '';

  const blocks = restocked.map(p => buildProductBlock(p)).join('\n');

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td style="padding:16px 0 8px;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:#1a1a1a;text-align:center;">Back in Stock</td></tr>
  <tr><td style="text-align:center;">${blocks}</td></tr>
  <tr><td style="text-align:center;padding:12px 0;"><a href="${SITE_URL}/shop-main" style="font-family:Arial,sans-serif;font-size:14px;color:#8B4513;text-decoration:underline;">Shop now before they sell out →</a></td></tr>
</table>`;
}

export const getBackInStockSection = webMethod(Permissions.Anyone, _getBackInStockSection);

// ── Full Email Template Generators ──────────────────────────────────

const EMAIL_FOOTER = `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;border-top:1px solid #e0e0e0;">
  <tr><td style="padding:16px 0;font-family:Arial,sans-serif;font-size:12px;color:#999;text-align:center;">
    Carolina Futons · 120 4th Avenue West · Hendersonville, NC 28792<br/>
    <a href="${SITE_URL}/unsubscribe" style="color:#999;text-decoration:underline;">unsubscribe</a> · <a href="${SITE_URL}/email-preferences" style="color:#999;text-decoration:underline;">email preferences</a>
  </td></tr>
</table>`;

function wrapEmailHtml(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${sanitize(title, 200)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f5f5;">
  <tr><td align="center" style="padding:20px 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#ffffff;border-radius:4px;">
      <tr><td style="padding:24px 20px 8px;text-align:center;">
        <a href="${SITE_URL}" style="font-family:Georgia,serif;font-size:28px;color:#8B4513;text-decoration:none;font-weight:bold;">${SITE_NAME}</a>
      </td></tr>
      <tr><td style="padding:0 20px;">
${bodyContent}
      </td></tr>
      <tr><td style="padding:0 20px 20px;">
${EMAIL_FOOTER}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/**
 * Factory for catalog-driven email generators.
 * Each generator validates input, calls a section builder, and wraps in full HTML.
 */
function makeEmailGenerator(title, sectionFn) {
  return webMethod(
    Permissions.Anyone,
    async (products, limit = 4) => {
      if (!Array.isArray(products) || products.length === 0) return '';
      const section = await sectionFn(products, limit);
      if (!section) return '';
      return wrapEmailHtml(title, section);
    }
  );
}

/** Generate a complete "New Arrivals" HTML email from catalog products. */
export const generateNewArrivalsEmail = makeEmailGenerator(
  'New Arrivals at Carolina Futons', _getNewArrivalsSection
);

/** Generate a complete "Price Drop" HTML email from products with reduced prices. */
export const generatePriceDropEmail = makeEmailGenerator(
  'Price Drops at Carolina Futons', _getPriceDropSection
);

/** Generate a complete "Back in Stock" HTML email from restocked products. */
export const generateBackInStockEmail = makeEmailGenerator(
  'Back in Stock at Carolina Futons', _getBackInStockSection
);

// ── Welcome Series Template Generators ──────────────────────────────
// Returns { subject, previewText, html } for each step of the welcome series.

/**
 * Day 0 welcome email: brand story + 10% discount code.
 * @param {string} firstName
 * @param {string} [discountCode]
 * @returns {{ subject: string, previewText: string, html: string }}
 */
export const getWelcomeDay0Template = webMethod(
  Permissions.Anyone,
  (firstName, discountCode) => {
    const name = sanitize(firstName || '', 200);
    const code = sanitize(discountCode || '', 50);
    const meta = TEMPLATE_REGISTRY.welcome_series_1;

    const discountBlock = code
      ? `<tr><td style="padding:16px;background-color:#F0F4F8;border-radius:4px;text-align:center;margin:16px 0;">
          <p style="font-family:Arial,sans-serif;font-size:14px;color:#1E3A5F;margin:0 0 8px;">Your exclusive welcome discount:</p>
          <p style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#8B4513;margin:0 0 8px;letter-spacing:2px;">${code}</p>
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#666;margin:0;">10% off your first order. No minimum purchase required.</p>
        </td></tr>`
      : '';

    const body = `
      <tr><td style="padding:20px 0 8px;font-family:Georgia,serif;font-size:22px;color:#1E3A5F;">
        ${name ? `Welcome, ${name}!` : 'Welcome to Carolina Futons!'}
      </td></tr>
      <tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
        <p>Thank you for joining us. Carolina Futons has been family-owned and operated in Hendersonville, NC since 1991 — and we're proud to bring you quality futons, sofa beds, and murphy beds direct from our showroom.</p>
        <p>Whether you're furnishing a first apartment, a guest room, or looking to maximize space, our team is here to help you find the perfect fit.</p>
      </td></tr>
      ${discountBlock}
      <tr><td style="padding:16px 0;text-align:center;">
        <a href="${SITE_URL}/shop" style="display:inline-block;padding:14px 32px;background-color:#1E3A5F;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;text-decoration:none;border-radius:4px;">Shop Now</a>
      </td></tr>
      <tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:13px;color:#666;">
        <p>Questions? Call us at ${SUPPORT_PHONE} — we're happy to help.</p>
      </td></tr>`;

    return {
      subject: meta.subjectLine,
      previewText: meta.previewText,
      html: wrapEmailHtml('Welcome to Carolina Futons', `<table cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table>`),
    };
  }
);

/**
 * Day 3 welcome email: futon buying guide.
 * @param {string} firstName
 * @returns {{ subject: string, previewText: string, html: string }}
 */
export const getWelcomeDay3Template = webMethod(
  Permissions.Anyone,
  (firstName) => {
    const name = sanitize(firstName || '', 200);
    const meta = TEMPLATE_REGISTRY.welcome_series_2;

    const body = `
      <tr><td style="padding:20px 0 8px;font-family:Georgia,serif;font-size:22px;color:#1E3A5F;">
        ${name ? `${name}, ready to find your perfect futon?` : 'Ready to find your perfect futon?'}
      </td></tr>
      <tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
        <p>Choosing a futon can feel overwhelming — frame styles, mattress types, cover fabrics, and size options all matter. We've put together a simple buying guide to help you decide.</p>
      </td></tr>
      <tr><td style="padding:8px 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:8px;width:50%;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;color:#333;">
              <strong style="color:#1E3A5F;">Frame Styles</strong><br/>
              Bi-fold, tri-fold, loveseat, and full-size. Wood or metal construction.
            </td>
            <td style="padding:8px;width:50%;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;color:#333;">
              <strong style="color:#1E3A5F;">Mattress Types</strong><br/>
              Cotton, foam, innerspring, and hybrid — each suited for different uses.
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 0;text-align:center;">
        <a href="${SITE_URL}/guides/futon-buying-guide" style="display:inline-block;padding:14px 32px;background-color:#1E3A5F;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;text-decoration:none;border-radius:4px;">Read the Buying Guide</a>
      </td></tr>`;

    return {
      subject: meta.subjectLine,
      previewText: meta.previewText,
      html: wrapEmailHtml('Futon Buying Guide — Carolina Futons', `<table cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table>`),
    };
  }
);

/**
 * Day 7 welcome email: first purchase nudge with urgency framing and discount CTA.
 * @param {string} firstName
 * @param {string} [discountCode]
 * @returns {{ subject: string, previewText: string, html: string }}
 */
export const getWelcomeDay7Template = webMethod(
  Permissions.Anyone,
  (firstName, discountCode) => {
    const name = sanitize(firstName || '', 200);
    const code = sanitize(discountCode || '', 50);
    const meta = TEMPLATE_REGISTRY.welcome_series_3;

    const discountBlock = code
      ? `<tr><td style="padding:16px;background-color:#FFF3CD;border-radius:4px;text-align:center;margin:16px 0;border:1px solid #F0C040;">
          <p style="font-family:Arial,sans-serif;font-size:13px;color:#8B6914;margin:0 0 6px;font-weight:bold;">⏰ YOUR WELCOME DISCOUNT EXPIRES SOON</p>
          <p style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#8B4513;margin:0 0 6px;letter-spacing:2px;">${code}</p>
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#666;margin:0;">10% off your first order — use it before it expires.</p>
        </td></tr>`
      : `<tr><td style="padding:12px 0;font-family:Arial,sans-serif;font-size:14px;color:#8B4513;">
          <strong>Don't wait — great futons at great prices are waiting for you.</strong>
        </td></tr>`;

    const body = `
      <tr><td style="padding:20px 0 8px;font-family:Georgia,serif;font-size:22px;color:#1E3A5F;">
        ${name ? `${name}, your discount won't last forever` : "Your welcome discount won't last forever"}
      </td></tr>
      <tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
        <p>You've explored the buying guide and you know what to look for. Now is the best time to pick your futon — your welcome discount is still active.</p>
      </td></tr>
      ${discountBlock}
      <tr><td style="padding:16px 0;text-align:center;">
        <a href="${SITE_URL}/shop" style="display:inline-block;padding:14px 32px;background-color:#8B4513;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;text-decoration:none;border-radius:4px;">Shop Now &amp; Save 10%</a>
      </td></tr>
      <tr><td style="padding:8px 0;background-color:#F0F4F8;border-radius:4px;">
        <table cellpadding="12" cellspacing="0" border="0" width="100%">
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:#333;font-style:italic;">
            "Excellent quality and the staff was incredibly helpful. My futon has held up perfectly for 3 years."
          </td></tr>
          <tr><td style="font-family:Arial,sans-serif;font-size:12px;color:#666;">— Sarah M., Asheville NC</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:12px 0;font-family:Arial,sans-serif;font-size:13px;color:#666;">
        <p>Questions? Call us at ${SUPPORT_PHONE} — we're happy to help you find the right fit.</p>
      </td></tr>`;

    return {
      subject: meta.subjectLine,
      previewText: meta.previewText,
      html: wrapEmailHtml('Your Welcome Discount — Carolina Futons', `<table cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table>`),
    };
  }
);

// ── Transactional Email Template Generators ─────────────────────────
// Returns { subject, previewText, html } for order lifecycle emails.

/**
 * Order confirmation email sent to the buyer immediately after purchase.
 * @param {Object} order
 * @param {string} order.firstName
 * @param {string} order.orderNumber
 * @param {string} order.total
 * @param {string} [order.itemSummary]
 * @param {number} [order.estimatedDays]
 * @param {string} order.email
 * @returns {{ subject: string, previewText: string, html: string }}
 */
export const getOrderConfirmationTemplate = webMethod(
  Permissions.Anyone,
  ({ firstName, orderNumber, total, itemSummary, estimatedDays, email } = {}) => {
    const name = sanitize(firstName || '', 200);
    const num = sanitize(orderNumber || '', 50);
    const tot = sanitize(total || '', 50);
    const summary = sanitize(itemSummary || '', 500);
    const days = Number.isFinite(Number(estimatedDays)) && Number(estimatedDays) > 0
      ? Number(estimatedDays) : null;
    const meta = TEMPLATE_REGISTRY.order_confirmation;

    const subject = meta.subjectLine.replace('{orderNumber}', num);
    const previewText = meta.previewText;

    const body = `
      <tr><td style="padding:20px 0 8px;font-family:Georgia,serif;font-size:22px;color:#1E3A5F;">
        ${name ? `Thank you, ${name}!` : 'Thank you for your order!'}
      </td></tr>
      <tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
        <p>Your order has been confirmed. Here's a summary:</p>
      </td></tr>
      <tr><td style="padding:12px 16px;background-color:#F0F4F8;border-radius:4px;">
        <table cellpadding="4" cellspacing="0" border="0" width="100%">
          ${num ? `<tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#666;">Order Number</td><td style="font-family:Arial,sans-serif;font-size:14px;color:#1E3A5F;font-weight:bold;">#${num}</td></tr>` : ''}
          ${tot ? `<tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#666;">Order Total</td><td style="font-family:Arial,sans-serif;font-size:14px;color:#1E3A5F;font-weight:bold;">${tot}</td></tr>` : ''}
          ${days ? `<tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#666;">Est. Delivery</td><td style="font-family:Arial,sans-serif;font-size:14px;color:#1E3A5F;">${days} business days</td></tr>` : ''}
          ${summary ? `<tr><td colspan="2" style="font-family:Arial,sans-serif;font-size:13px;color:#555;padding-top:8px;">${summary}</td></tr>` : ''}
        </table>
      </td></tr>
      <tr><td style="padding:16px 0;font-family:Arial,sans-serif;font-size:14px;color:#333;">
        <p>We'll send you a shipping confirmation with tracking information once your order is on its way.</p>
        <p>Questions? Call us at ${SUPPORT_PHONE} or reply to this email.</p>
      </td></tr>
      <tr><td style="padding:8px 0;text-align:center;">
        <a href="${SITE_URL}/account/orders" style="display:inline-block;padding:12px 28px;background-color:#1E3A5F;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;text-decoration:none;border-radius:4px;">View Your Order</a>
      </td></tr>`;

    return {
      subject,
      previewText,
      html: wrapEmailHtml(`Order #${num} Confirmed — Carolina Futons`, `<table cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table>`),
    };
  }
);

/**
 * Shipping notification sent when the order fulfillment is created.
 * @param {Object} order
 * @param {string} order.firstName
 * @param {string} order.orderNumber
 * @param {string} [order.trackingNumber]
 * @param {string} [order.trackingUrl]
 * @param {string} [order.carrier]
 * @param {number} [order.estimatedDays]
 * @param {string} order.email
 * @returns {{ subject: string, previewText: string, html: string }}
 */
export const getOrderShippedTemplate = webMethod(
  Permissions.Anyone,
  ({ firstName, orderNumber, trackingNumber, trackingUrl, carrier, estimatedDays, email } = {}) => {
    const name = sanitize(firstName || '', 200);
    const num = sanitize(orderNumber || '', 50);
    const tracking = sanitize(trackingNumber || '', 100);
    const trackUrl = sanitize(trackingUrl || '', 500);
    const carr = sanitize(carrier || '', 100);
    const days = Number.isFinite(Number(estimatedDays)) && Number(estimatedDays) > 0
      ? Number(estimatedDays) : null;
    const meta = TEMPLATE_REGISTRY.order_shipped;

    const subject = meta.subjectLine.replace('{orderNumber}', num);

    const trackingBlock = tracking
      ? `<tr><td style="padding:12px 16px;background-color:#F0F4F8;border-radius:4px;text-align:center;">
          <p style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin:0 0 6px;">${carr ? `${carr} · ` : ''}Tracking #${tracking}</p>
          ${trackUrl ? `<a href="${trackUrl}" style="display:inline-block;padding:10px 24px;background-color:#1E3A5F;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;text-decoration:none;border-radius:4px;">Track Your Package</a>` : ''}
        </td></tr>`
      : '';

    const body = `
      <tr><td style="padding:20px 0 8px;font-family:Georgia,serif;font-size:22px;color:#1E3A5F;">
        ${name ? `${name}, your order is on its way!` : 'Your order is on its way!'}
      </td></tr>
      <tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
        <p>Great news — order #${num} has shipped${days ? ` and is expected to arrive in ${days} business days` : ''}.</p>
      </td></tr>
      ${trackingBlock}
      <tr><td style="padding:16px 0;font-family:Arial,sans-serif;font-size:14px;color:#333;">
        <p>Need help with assembly or have questions when it arrives? Call us at ${SUPPORT_PHONE}.</p>
      </td></tr>`;

    return {
      subject,
      previewText: meta.previewText,
      html: wrapEmailHtml(`Order #${num} Shipped — Carolina Futons`, `<table cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table>`),
    };
  }
);

/**
 * Delivery confirmation email sent when the order is marked delivered.
 * @param {Object} order
 * @param {string} order.firstName
 * @param {string} order.orderNumber
 * @param {string} order.email
 * @returns {{ subject: string, previewText: string, html: string }}
 */
export const getDeliveryConfirmationTemplate = webMethod(
  Permissions.Anyone,
  ({ firstName, orderNumber, email } = {}) => {
    const name = sanitize(firstName || '', 200);
    const num = sanitize(orderNumber || '', 50);
    const meta = TEMPLATE_REGISTRY.delivery_confirmation;

    const subject = meta.subjectLine.replace('{orderNumber}', num);

    const body = `
      <tr><td style="padding:20px 0 8px;font-family:Georgia,serif;font-size:22px;color:#1E3A5F;">
        ${name ? `${name}, your order has arrived!` : 'Your order has arrived!'}
      </td></tr>
      <tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
        <p>Order #${num} has been delivered. We hope you love your new furniture!</p>
        <p>If anything arrived damaged or you need help with setup, please call us right away at ${SUPPORT_PHONE} — we'll make it right.</p>
      </td></tr>
      <tr><td style="padding:16px 0;text-align:center;">
        <a href="${SITE_URL}/account/orders" style="display:inline-block;padding:12px 28px;background-color:#1E3A5F;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;text-decoration:none;border-radius:4px;">View Your Order</a>
      </td></tr>
      <tr><td style="padding:8px 0;text-align:center;">
        <a href="${SITE_URL}/reviews" style="font-family:Arial,sans-serif;font-size:14px;color:#5B8FA8;text-decoration:underline;">Leave a Review</a>
      </td></tr>`;

    return {
      subject,
      previewText: meta.previewText,
      html: wrapEmailHtml(`Order #${num} Delivered — Carolina Futons`, `<table cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table>`),
    };
  }
);

/**
 * Day 7 post-purchase review request email with loyalty points incentive.
 * CF-i64b
 *
 * @param {Object} params
 * @param {string} params.firstName
 * @param {string} params.productNames - Primary product name(s)
 * @param {string} params.reviewUrl - Direct link to review form
 * @param {string} [params.productImage] - Product image URL
 * @param {string} [params.pointsReward='50'] - Points for text review
 * @param {string} [params.photoBonusPoints='25'] - Bonus points for photo review
 * @returns {{ subject: string, previewText: string, html: string }}
 */
export const getPostPurchaseDay7ReviewTemplate = webMethod(
  Permissions.Anyone,
  ({ firstName, productNames, reviewUrl, productImage, pointsReward, photoBonusPoints } = {}) => {
    const name = sanitize(firstName || '', 200);
    const products = sanitize(productNames || 'furniture', 500);
    const url = sanitize(reviewUrl || `${SITE_URL}/member-page`, 500);
    const image = sanitize(productImage || '', 500);
    const points = sanitize(pointsReward || '50', 10);
    const photoPoints = sanitize(photoBonusPoints || '25', 10);
    const meta = TEMPLATE_REGISTRY.post_purchase_2;

    const subject = (meta.subjectLine || '')
      .replace('{firstName}', name)
      .replace('{productNames}', products);

    const imageBlock = image
      ? `<tr><td style="padding:16px 0;text-align:center;">
          <img src="${image}" alt="${products}" style="max-width:300px;border-radius:4px;" />
        </td></tr>`
      : '';

    const body = `
      <tr><td style="padding:20px 0 8px;font-family:Georgia,serif;font-size:22px;color:#1E3A5F;">
        ${name ? `${name}, how's your new ${products}?` : `How's your new ${products}?`}
      </td></tr>
      <tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
        <p>It's been a week since your order arrived. We'd love to hear how you're enjoying it — your feedback helps other customers find the perfect piece.</p>
      </td></tr>
      ${imageBlock}
      <tr><td style="padding:16px;background-color:#F0F4F8;border-radius:4px;text-align:center;">
        <p style="font-family:Arial,sans-serif;font-size:14px;color:#1E3A5F;margin:0 0 8px;font-weight:bold;">Earn rewards for your review</p>
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#333;margin:0 0 4px;">⭐ Leave a review → <strong>${points} loyalty points</strong></p>
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#333;margin:0;">📸 Add a photo → <strong>${photoPoints} bonus points</strong></p>
      </td></tr>
      <tr><td style="padding:16px 0;text-align:center;">
        <a href="${url}" style="display:inline-block;padding:14px 32px;background-color:#1E3A5F;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;text-decoration:none;border-radius:4px;">Write a Review</a>
      </td></tr>
      <tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:13px;color:#666;">
        <p>It takes less than 2 minutes and helps fellow furniture shoppers make confident choices.</p>
        <p>Questions about your order? Call us at ${SUPPORT_PHONE}.</p>
      </td></tr>`;

    return {
      subject,
      previewText: meta.previewText,
      html: wrapEmailHtml('Review Your Purchase — Carolina Futons', `<table cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table>`),
    };
  }
);

// Export for testing
export const _TEMPLATE_REGISTRY = TEMPLATE_REGISTRY;
export const _CATEGORY_LABELS = CATEGORY_LABELS;
