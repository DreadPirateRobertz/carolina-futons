/**
 * @module postPurchaseCare
 * @description Post-purchase care guides and contextual upsell recommendations.
 * Maps products to care guides (fabric care, assembly, warranty). Delivers
 * contextual guides based on ordered products. Tracks guide engagement.
 * Recommends complementary items 3-7 days post-purchase.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `ProductCareGuides` with fields:
 *   productCategory (Text, indexed) - e.g. 'futon-frames', 'mattresses', 'covers'
 *   guideType (Text, indexed) - 'fabric_care'|'assembly'|'warranty'|'maintenance'|'cleaning'
 *   title (Text) - Guide display title
 *   summary (Text) - Short description (max 300 chars)
 *   content (Text) - Full guide content (max 5000 chars)
 *   steps (Text) - JSON array of step-by-step instructions
 *   videoUrl (Text) - Optional instructional video URL
 *   imageUrl (Image) - Optional guide image
 *   priority (Number) - Display order (lower = first)
 *   active (Boolean) - Whether guide is published
 *
 * Create CMS collection `PostPurchaseUpsells` with fields:
 *   sourceCategory (Text, indexed) - Category of purchased product
 *   sourceProductId (Text, indexed) - Specific product ID (optional, for targeted recs)
 *   recommendedProductId (Text) - Product to recommend
 *   recommendedProductName (Text) - Display name
 *   recommendedCategory (Text) - Category of recommended product
 *   reason (Text) - Why this recommendation (max 200 chars)
 *   discount (Number) - Optional discount percentage for post-purchase offer
 *   delayDays (Number) - Days after purchase to show (default 3)
 *   priority (Number) - Display order
 *   active (Boolean) - Whether recommendation is active
 *
 * Create CMS collection `GuideEngagement` with fields:
 *   memberId (Text, indexed) - Member who viewed
 *   guideId (Text, indexed) - Guide that was viewed
 *   orderId (Text, indexed) - Associated order
 *   productCategory (Text) - Category context
 *   action (Text) - 'view'|'complete'|'video_play'|'share'
 *   viewedAt (Date, indexed) - When engagement occurred
 *   duration (Number) - Seconds spent on guide (optional)
 *
 * Create CMS collection `UpsellConversions` with fields:
 *   memberId (Text, indexed) - Member who converted
 *   sourceOrderId (Text, indexed) - Original order
 *   sourceProductId (Text) - Product that triggered recommendation
 *   recommendedProductId (Text) - Product that was recommended
 *   convertedAt (Date, indexed) - When conversion happened
 *   discount (Number) - Discount applied
 *   revenue (Number) - Revenue from upsell
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

async function requireMember() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return member._id;
}

/**
 * Get care guides for a specific product category.
 * Returns active guides sorted by priority.
 *
 * @param {string} productCategory - Product category slug.
 * @param {string} [guideType] - Optional filter by guide type.
 * @returns {Promise<{success: boolean, guides: Array}>}
 */
export const getProductGuides = webMethod(
  Permissions.Anyone,
  async (productCategory, guideType) => {
    try {
      const category = sanitize(productCategory, 100);
      if (!category) {
        return { success: false, error: 'Product category is required.', guides: [] };
      }

      let query = wixData.query('ProductCareGuides')
        .eq('productCategory', category)
        .eq('active', true)
        .ascending('priority')
        .limit(20);

      if (guideType) {
        query = query.eq('guideType', sanitize(guideType, 50));
      }

      const result = await query.find();

      const guides = result.items.map(item => ({
        _id: item._id,
        productCategory: item.productCategory,
        guideType: item.guideType,
        title: item.title,
        summary: item.summary,
        content: item.content,
        steps: parseSteps(item.steps),
        videoUrl: item.videoUrl || '',
        imageUrl: item.imageUrl || '',
        priority: item.priority,
      }));

      return { success: true, guides };
    } catch (err) {
      console.error('[postPurchaseCare] Error getting product guides:', err);
      return { success: false, error: 'Failed to load care guides.', guides: [] };
    }
  }
);

/**
 * Deliver care guides relevant to an order's products.
 * Looks up guides for each product category in the order.
 *
 * @param {string} orderId - The order ID.
 * @param {string[]} productCategories - Categories of products in the order.
 * @returns {Promise<{success: boolean, guidesByCategory: Object}>}
 */
export const deliverGuidesForOrder = webMethod(
  Permissions.SiteMember,
  async (orderId, productCategories) => {
    try {
      await requireMember();

      const cleanOrderId = validateId(orderId);
      if (!cleanOrderId) {
        return { success: false, error: 'Valid order ID is required.', guidesByCategory: {} };
      }

      if (!Array.isArray(productCategories) || productCategories.length === 0) {
        return { success: false, error: 'Product categories are required.', guidesByCategory: {} };
      }

      const categories = productCategories
        .slice(0, 10)
        .map(c => sanitize(c, 100))
        .filter(Boolean);

      if (categories.length === 0) {
        return { success: false, error: 'No valid categories provided.', guidesByCategory: {} };
      }

      const result = await wixData.query('ProductCareGuides')
        .hasSome('productCategory', categories)
        .eq('active', true)
        .ascending('priority')
        .limit(50)
        .find();

      const guidesByCategory = {};
      for (const item of result.items) {
        const cat = item.productCategory;
        if (!guidesByCategory[cat]) {
          guidesByCategory[cat] = [];
        }
        guidesByCategory[cat].push({
          _id: item._id,
          guideType: item.guideType,
          title: item.title,
          summary: item.summary,
          content: item.content,
          steps: parseSteps(item.steps),
          videoUrl: item.videoUrl || '',
          imageUrl: item.imageUrl || '',
        });
      }

      return { success: true, guidesByCategory };
    } catch (err) {
      console.error('[postPurchaseCare] Error delivering guides for order:', err);
      return { success: false, error: 'Failed to load order guides.', guidesByCategory: {} };
    }
  }
);

/**
 * Get upsell recommendations based on purchased product category.
 * Filters by delay window (3-7 days post-purchase).
 *
 * @param {string} productCategory - Category of purchased product.
 * @param {string} [productId] - Specific product ID for targeted recs.
 * @param {number} [daysSincePurchase=3] - Days since order was placed.
 * @returns {Promise<{success: boolean, recommendations: Array}>}
 */
export const getUpsellRecommendations = webMethod(
  Permissions.Anyone,
  async (productCategory, productId, daysSincePurchase = 3) => {
    try {
      const category = sanitize(productCategory, 100);
      if (!category) {
        return { success: false, error: 'Product category is required.', recommendations: [] };
      }

      const days = Math.max(0, Math.min(30, Math.round(Number(daysSincePurchase) || 3)));

      let query = wixData.query('PostPurchaseUpsells')
        .eq('sourceCategory', category)
        .eq('active', true)
        .le('delayDays', days)
        .ascending('priority')
        .limit(10);

      if (productId) {
        const cleanId = validateId(productId);
        if (cleanId) {
          // Try product-specific recs first, then fall back to category-level
          const specificResult = await wixData.query('PostPurchaseUpsells')
            .eq('sourceProductId', cleanId)
            .eq('active', true)
            .le('delayDays', days)
            .ascending('priority')
            .limit(10)
            .find();

          if (specificResult.items.length > 0) {
            return {
              success: true,
              recommendations: specificResult.items.map(formatRecommendation),
            };
          }
        }
      }

      const result = await query.find();

      return {
        success: true,
        recommendations: result.items.map(formatRecommendation),
      };
    } catch (err) {
      console.error('[postPurchaseCare] Error getting upsell recommendations:', err);
      return { success: false, error: 'Failed to load recommendations.', recommendations: [] };
    }
  }
);

/**
 * Track engagement with a care guide (view, complete, video play, share).
 *
 * @param {Object} data
 * @param {string} data.guideId - Care guide ID.
 * @param {string} [data.orderId] - Associated order ID.
 * @param {string} [data.productCategory] - Category context.
 * @param {string} data.action - 'view'|'complete'|'video_play'|'share'
 * @param {number} [data.duration] - Seconds spent on guide.
 * @returns {Promise<{success: boolean}>}
 */
export const trackGuideEngagement = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      const guideId = validateId(data.guideId);
      if (!guideId) {
        return { success: false, error: 'Valid guide ID is required.' };
      }

      const validActions = ['view', 'complete', 'video_play', 'share'];
      const action = sanitize(data.action, 20);
      if (!validActions.includes(action)) {
        return { success: false, error: 'Invalid action. Must be view, complete, video_play, or share.' };
      }

      const record = {
        memberId,
        guideId,
        orderId: data.orderId ? validateId(data.orderId) : '',
        productCategory: sanitize(data.productCategory || '', 100),
        action,
        viewedAt: new Date(),
        duration: Math.max(0, Math.min(3600, Math.round(Number(data.duration) || 0))),
      };

      await wixData.insert('GuideEngagement', record);
      return { success: true };
    } catch (err) {
      console.error('[postPurchaseCare] Error tracking guide engagement:', err);
      return { success: false, error: 'Failed to track engagement.' };
    }
  }
);

/**
 * Log an upsell conversion when a customer purchases a recommended product.
 *
 * @param {Object} data
 * @param {string} data.sourceOrderId - Original order that triggered the recommendation.
 * @param {string} data.sourceProductId - Product from the original order.
 * @param {string} data.recommendedProductId - Product that was purchased from recommendation.
 * @param {number} [data.discount] - Discount percentage applied.
 * @param {number} [data.revenue] - Revenue from the upsell purchase.
 * @returns {Promise<{success: boolean}>}
 */
export const logUpsellConversion = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      const sourceOrderId = validateId(data.sourceOrderId);
      if (!sourceOrderId) {
        return { success: false, error: 'Valid source order ID is required.' };
      }

      const sourceProductId = validateId(data.sourceProductId);
      const recommendedProductId = validateId(data.recommendedProductId);
      if (!recommendedProductId) {
        return { success: false, error: 'Valid recommended product ID is required.' };
      }

      const record = {
        memberId,
        sourceOrderId,
        sourceProductId: sourceProductId || '',
        recommendedProductId,
        convertedAt: new Date(),
        discount: Math.max(0, Math.min(100, Math.round(Number(data.discount) || 0))),
        revenue: Math.max(0, Number(data.revenue) || 0),
      };

      await wixData.insert('UpsellConversions', record);
      return { success: true };
    } catch (err) {
      console.error('[postPurchaseCare] Error logging upsell conversion:', err);
      return { success: false, error: 'Failed to log conversion.' };
    }
  }
);

// ── Day 3/7 Post-Purchase Care Helpers ────────────────────────────────

const SITE_URL = 'https://www.carolinafutons.com';
const SUPPORT_PHONE = '(828) 252-9449';
const SUPPORT_EMAIL = 'support@carolinafutons.com';

/**
 * Get assembly follow-up data for Day 3 email (72h post-purchase).
 * Returns assembly guides relevant to the ordered products plus support info.
 *
 * @param {string} orderId - The order ID.
 * @param {string[]} productCategories - Categories of products in the order.
 * @returns {Promise<{success: boolean, guides: Array, supportPhone: string, supportEmail: string, error?: string}>}
 */
export const getAssemblyFollowUpData = webMethod(
  Permissions.Anyone,
  async (orderId, productCategories) => {
    try {
      const cleanOrderId = validateId(orderId);
      if (!cleanOrderId) {
        return { success: false, error: 'Valid order ID is required.', guides: [], supportPhone: '', supportEmail: '' };
      }

      if (!Array.isArray(productCategories) || productCategories.length === 0) {
        return { success: false, error: 'Product categories are required.', guides: [], supportPhone: '', supportEmail: '' };
      }

      const categories = productCategories
        .slice(0, 10)
        .map(c => sanitize(c, 100))
        .filter(Boolean);

      if (categories.length === 0) {
        return { success: true, guides: [], supportPhone: SUPPORT_PHONE, supportEmail: SUPPORT_EMAIL };
      }

      const result = await wixData.query('ProductCareGuides')
        .hasSome('productCategory', categories)
        .eq('guideType', 'assembly')
        .eq('active', true)
        .ascending('priority')
        .limit(20)
        .find();

      const guides = result.items.map(item => ({
        _id: item._id,
        productCategory: item.productCategory,
        title: item.title,
        summary: item.summary,
        content: item.content,
        steps: parseSteps(item.steps),
        videoUrl: item.videoUrl || '',
        imageUrl: item.imageUrl || '',
      }));

      return { success: true, guides, supportPhone: SUPPORT_PHONE, supportEmail: SUPPORT_EMAIL };
    } catch (err) {
      console.error('[postPurchaseCare] Error getting assembly follow-up data:', err);
      return { success: false, error: 'Failed to load assembly data.', guides: [], supportPhone: '', supportEmail: '' };
    }
  }
);

/**
 * Get review solicitation data for Day 7 email (168h post-purchase).
 * Returns review URLs and product info for the email template.
 *
 * @param {string} orderId - The order ID.
 * @param {string} customerName - Customer first name.
 * @param {Array<{name: string, productId: string}>} products - Products from the order.
 * @returns {Promise<{success: boolean, reviewUrl: string, customerName: string, products: Array, error?: string}>}
 */
export const getReviewSolicitationData = webMethod(
  Permissions.Anyone,
  async (orderId, customerName, products) => {
    try {
      const cleanOrderId = validateId(orderId);
      if (!cleanOrderId) {
        return { success: false, error: 'Valid order ID is required.', reviewUrl: '', customerName: '', products: [] };
      }

      const cleanName = sanitize(customerName || '', 200);
      const reviewUrl = `${SITE_URL}/product-page/${cleanOrderId}#reviews`;

      const productList = (products || []).slice(0, 20).map(p => ({
        name: sanitize(p.name || '', 200),
        productId: sanitize(p.productId || '', 50),
        reviewUrl: p.productId ? `${SITE_URL}/product-page/${sanitize(p.productId, 50)}#reviews` : reviewUrl,
      }));

      return { success: true, reviewUrl, customerName: cleanName, products: productList };
    } catch (err) {
      console.error('[postPurchaseCare] Error getting review solicitation data:', err);
      return { success: false, error: 'Failed to load review data.', reviewUrl: '', customerName: '', products: [] };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

function parseSteps(stepsJson) {
  if (!stepsJson) return [];
  try {
    const parsed = JSON.parse(stepsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatRecommendation(item) {
  return {
    _id: item._id,
    recommendedProductId: item.recommendedProductId,
    recommendedProductName: item.recommendedProductName,
    recommendedCategory: item.recommendedCategory,
    reason: item.reason,
    discount: item.discount || 0,
    delayDays: item.delayDays || 3,
    priority: item.priority,
  };
}
