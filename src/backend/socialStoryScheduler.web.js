/**
 * @module socialStoryScheduler
 * @description Connects socialStoryHelpers story generation to the content scheduler.
 * Provides functions to auto-schedule stories for new arrivals, price drops,
 * and seasonal promos with platform-specific formatting, rate limit awareness,
 * engagement window scheduling, and 7-day product dedup.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires backend/utils/sanitize
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PLATFORMS = ['instagram', 'facebook', 'pinterest'];

// Engagement windows (hours, server time) — optimal posting times per platform
const ENGAGEMENT_WINDOWS = {
  instagram: { start: 11, end: 13 },  // 11am-1pm
  facebook: { start: 10, end: 12 },   // 10am-12pm
  pinterest: { start: 20, end: 22 },  // 8pm-10pm
};

// Rate limits (posts per day per platform)
const DAILY_RATE_LIMITS = {
  instagram: 25,
  facebook: 25,
  pinterest: 50,
};

async function requireAdmin() {
  const member = await currentMember.getMember();
  if (!member || !member._id) throw new Error('Authentication required.');
  const roles = await currentMember.getRoles();
  const isAdmin = roles.some(r => r.title === 'Admin' || r._id === 'admin');
  if (!isAdmin) throw new Error('Admin access required.');
  return member._id;
}

/**
 * Check if a product was already scheduled for social stories within 7-day window.
 */
async function isProductDuplicate(productId, platform) {
  if (!productId) return false;
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  const result = await wixData.query('ContentSchedule')
    .eq('productId', productId)
    .eq('contentType', 'social_story')
    .eq('platform', platform)
    .hasSome('status', ['pending', 'sent'])
    .gt('scheduledAt', cutoff)
    .limit(1)
    .find();
  return result.items.length > 0;
}

/**
 * Count today's scheduled posts for a platform to enforce rate limits.
 */
async function getTodayPostCount(platform) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const result = await wixData.query('ContentSchedule')
    .eq('contentType', 'social_story')
    .eq('platform', platform)
    .hasSome('status', ['pending', 'sent'])
    .ge('scheduledAt', startOfDay)
    .le('scheduledAt', endOfDay)
    .limit(500)
    .find();
  return result.items.length;
}

/**
 * Check if a platform is within its daily rate limit.
 */
async function isWithinRateLimit(platform) {
  const limit = DAILY_RATE_LIMITS[platform];
  if (!limit) return false;
  const count = await getTodayPostCount(platform);
  return count < limit;
}

/**
 * Get the next optimal posting time for a platform.
 * If current time is within the engagement window, schedule for now.
 * Otherwise, schedule for the next window start.
 */
function getNextEngagementWindow(platform, baseDate) {
  const d = baseDate ? new Date(baseDate) : new Date();
  if (isNaN(d.getTime())) return null;

  const window = ENGAGEMENT_WINDOWS[platform];
  if (!window) return null;

  const currentHour = d.getHours();

  // If within window, use current time
  if (currentHour >= window.start && currentHour < window.end) {
    return new Date(d);
  }

  // If before window today, schedule for today's window start
  if (currentHour < window.start) {
    const scheduled = new Date(d);
    scheduled.setHours(window.start, 0, 0, 0);
    return scheduled;
  }

  // Past window today — schedule for tomorrow's window start
  const tomorrow = new Date(d);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(window.start, 0, 0, 0);
  return tomorrow;
}

/**
 * Build platform-specific content from a product.
 */
function buildPlatformContent(product, platform, storyType) {
  if (!product || !product.name) return null;

  const price = product.price != null ? `$${Number(product.price).toFixed(2)}` : '';
  const imageUrl = (product.images && product.images[0]) || '';

  const base = {
    productName: product.name,
    productId: product._id || product.slug || '',
    price,
    imageUrl,
    category: product.category || '',
    storyType,
  };

  switch (platform) {
    case 'instagram':
      return {
        ...base,
        caption: formatInstagramCaption(product, storyType),
        format: 'story',
        aspectRatio: '9:16',
        width: 1080,
        height: 1920,
      };
    case 'facebook':
      return {
        ...base,
        caption: formatFacebookCaption(product, storyType),
        format: 'post',
        width: 1200,
        height: 630,
      };
    case 'pinterest':
      return {
        ...base,
        caption: formatPinterestDescription(product, storyType),
        format: 'pin',
        aspectRatio: '2:3',
        width: 1000,
        height: 1500,
      };
    default:
      return null;
  }
}

function formatInstagramCaption(product, storyType) {
  const price = product.price != null ? `$${Number(product.price).toFixed(2)}` : '';
  const lines = [];

  if (storyType === 'new_arrival') {
    lines.push(`NEW: ${product.name}`);
  } else if (storyType === 'price_drop') {
    lines.push(`PRICE DROP: ${product.name}`);
  } else if (storyType === 'seasonal_promo') {
    lines.push(product.name);
  } else {
    lines.push(product.name);
  }

  if (price) lines.push(`Starting at ${price}`);
  if (product.description) lines.push(product.description.slice(0, 120));
  lines.push('Shop at carolinafutons.com');
  lines.push('#CarolinaFutons #HendersonvilleNC #FutonLiving #HandcraftedFurniture');
  return lines.filter(Boolean).join('\n');
}

function formatFacebookCaption(product, storyType) {
  const price = product.price != null ? `$${Number(product.price).toFixed(2)}` : '';
  const lines = [];

  if (storyType === 'new_arrival') {
    lines.push(`Just arrived: ${product.name}`);
  } else if (storyType === 'price_drop') {
    lines.push(`Great news — ${product.name} just got more affordable!`);
  } else {
    lines.push(product.name);
  }

  if (price) lines.push(`Starting at ${price}`);
  if (product.description) lines.push(product.description.slice(0, 300));
  lines.push('');
  lines.push('Shop now at carolinafutons.com');
  return lines.filter(Boolean).join('\n');
}

function formatPinterestDescription(product, storyType) {
  const price = product.price != null ? `$${Number(product.price).toFixed(2)}` : '';
  const lines = [];

  lines.push(product.name);
  if (price) lines.push(price);
  if (product.description) lines.push(product.description.slice(0, 200));
  lines.push('Carolina Futons — Hendersonville, NC since 1991');
  return lines.filter(Boolean).join('. ');
}

// ── WebMethods ──────────────────────────────────────────────────────

/**
 * Schedule social stories for a new product arrival across all platforms.
 *
 * @param {Object} product - Product from catalog-MASTER.json
 * @param {Object} [options]
 * @param {string[]} [options.platforms] - Platforms to post to (defaults to all)
 * @param {number} [options.priority=3] - Queue priority (1=highest)
 * @returns {Promise<{success: boolean, scheduled: number, skipped: number, rateLimited: number, errors: string[]}>}
 */
export const scheduleNewArrivalStories = webMethod(
  Permissions.Admin,
  async (product, options = {}) => {
    try {
      await requireAdmin();

      if (!product || !product.name) {
        return { success: false, scheduled: 0, skipped: 0, rateLimited: 0, errors: ['Product with name is required'] };
      }

      const platforms = (options.platforms || PLATFORMS).filter(p => PLATFORMS.includes(p));
      const priority = Math.min(10, Math.max(1, Number(options.priority) || 3));
      const productId = product._id || product.slug || sanitize(product.name, 50);

      let scheduled = 0;
      let skipped = 0;
      let rateLimited = 0;
      const errors = [];

      for (const platform of platforms) {
        // Dedup check
        if (await isProductDuplicate(productId, platform)) {
          skipped++;
          continue;
        }

        // Rate limit check
        if (!(await isWithinRateLimit(platform))) {
          rateLimited++;
          errors.push(`${platform}: daily rate limit reached`);
          continue;
        }

        const content = buildPlatformContent(product, platform, 'new_arrival');
        if (!content) {
          errors.push(`${platform}: failed to build content`);
          continue;
        }

        const scheduledAt = getNextEngagementWindow(platform) || new Date();

        try {
          await wixData.insert('ContentSchedule', {
            contentType: 'social_story',
            platform,
            productId,
            productName: sanitize(product.name, 200),
            eventType: 'new_arrival',
            priority,
            status: 'pending',
            scheduledAt,
            payload: JSON.stringify(content),
            createdBy: `new_arrival-${productId}-${new Date().toISOString().slice(0, 10)}`,
            processedAt: null,
            error: '',
          });
          scheduled++;
        } catch (insertErr) {
          errors.push(`${platform}: failed to queue — ${insertErr.message}`);
        }
      }

      return { success: true, scheduled, skipped, rateLimited, errors };
    } catch (err) {
      console.error('[socialStoryScheduler] Error scheduling new arrival:', err);
      return { success: false, scheduled: 0, skipped: 0, rateLimited: 0, errors: [err.message] };
    }
  }
);

/**
 * Schedule social stories for a price drop across all platforms.
 *
 * @param {Object} product - Product with name, price (new), previousPrice
 * @param {Object} [options]
 * @param {string[]} [options.platforms] - Platforms to post to
 * @param {number} [options.priority=2] - Queue priority (price drops are higher priority)
 * @returns {Promise<{success: boolean, scheduled: number, skipped: number, rateLimited: number, errors: string[]}>}
 */
export const schedulePriceDropStories = webMethod(
  Permissions.Admin,
  async (product, options = {}) => {
    try {
      await requireAdmin();

      if (!product || !product.name) {
        return { success: false, scheduled: 0, skipped: 0, rateLimited: 0, errors: ['Product with name is required'] };
      }

      if (product.price == null || product.previousPrice == null) {
        return { success: false, scheduled: 0, skipped: 0, rateLimited: 0, errors: ['Both price and previousPrice are required'] };
      }

      if (Number(product.price) >= Number(product.previousPrice)) {
        return { success: false, scheduled: 0, skipped: 0, rateLimited: 0, errors: ['New price must be lower than previous price'] };
      }

      const platforms = (options.platforms || PLATFORMS).filter(p => PLATFORMS.includes(p));
      const priority = Math.min(10, Math.max(1, Number(options.priority) || 2));
      const productId = product._id || product.slug || sanitize(product.name, 50);

      let scheduled = 0;
      let skipped = 0;
      let rateLimited = 0;
      const errors = [];

      for (const platform of platforms) {
        if (await isProductDuplicate(productId, platform)) {
          skipped++;
          continue;
        }

        if (!(await isWithinRateLimit(platform))) {
          rateLimited++;
          errors.push(`${platform}: daily rate limit reached`);
          continue;
        }

        const content = buildPlatformContent(product, platform, 'price_drop');
        if (!content) {
          errors.push(`${platform}: failed to build content`);
          continue;
        }

        content.previousPrice = `$${Number(product.previousPrice).toFixed(2)}`;
        content.savings = `$${(Number(product.previousPrice) - Number(product.price)).toFixed(2)}`;

        const scheduledAt = getNextEngagementWindow(platform) || new Date();

        try {
          await wixData.insert('ContentSchedule', {
            contentType: 'social_story',
            platform,
            productId,
            productName: sanitize(product.name, 200),
            eventType: 'price_drop',
            priority,
            status: 'pending',
            scheduledAt,
            payload: JSON.stringify(content),
            createdBy: `price_drop-${productId}-${new Date().toISOString().slice(0, 10)}`,
            processedAt: null,
            error: '',
          });
          scheduled++;
        } catch (insertErr) {
          errors.push(`${platform}: failed to queue — ${insertErr.message}`);
        }
      }

      return { success: true, scheduled, skipped, rateLimited, errors };
    } catch (err) {
      console.error('[socialStoryScheduler] Error scheduling price drop:', err);
      return { success: false, scheduled: 0, skipped: 0, rateLimited: 0, errors: [err.message] };
    }
  }
);

/**
 * Schedule seasonal promotion stories across platforms.
 *
 * @param {Object} params
 * @param {string} params.seasonName - e.g., "Spring Sale", "Summer Refresh"
 * @param {string} params.promoText - Promotion description
 * @param {string} [params.promoCode] - Discount code
 * @param {Array<Object>} [params.featuredProducts] - Up to 3 products to feature
 * @param {Object} [options]
 * @param {string[]} [options.platforms]
 * @param {number} [options.priority=1] - Seasonal promos are highest priority
 * @returns {Promise<{success: boolean, scheduled: number, rateLimited: number, errors: string[]}>}
 */
export const scheduleSeasonalPromo = webMethod(
  Permissions.Admin,
  async (params, options = {}) => {
    try {
      await requireAdmin();

      if (!params || !params.seasonName) {
        return { success: false, scheduled: 0, rateLimited: 0, errors: ['seasonName is required'] };
      }

      if (!params.promoText) {
        return { success: false, scheduled: 0, rateLimited: 0, errors: ['promoText is required'] };
      }

      const platforms = (options.platforms || PLATFORMS).filter(p => PLATFORMS.includes(p));
      const priority = Math.min(10, Math.max(1, Number(options.priority) || 1));

      let scheduled = 0;
      let rateLimited = 0;
      const errors = [];

      const featuredProducts = (params.featuredProducts || []).filter(p => p && p.name).slice(0, 3);

      for (const platform of platforms) {
        if (!(await isWithinRateLimit(platform))) {
          rateLimited++;
          errors.push(`${platform}: daily rate limit reached`);
          continue;
        }

        const productLines = featuredProducts.map(p => {
          const price = p.price != null ? ` — $${Number(p.price).toFixed(2)}` : '';
          return `${p.name}${price}`;
        });

        const caption = [
          params.seasonName,
          params.promoText,
          ...productLines,
          params.promoCode ? `Use code ${params.promoCode}` : '',
          'carolinafutons.com',
        ].filter(Boolean).join('\n');

        const content = {
          seasonName: sanitize(params.seasonName, 100),
          promoText: sanitize(params.promoText, 500),
          promoCode: params.promoCode ? sanitize(params.promoCode, 50) : '',
          caption,
          platform,
          featuredProducts: productLines,
          storyType: 'seasonal_promo',
        };

        const scheduledAt = getNextEngagementWindow(platform) || new Date();

        try {
          await wixData.insert('ContentSchedule', {
            contentType: 'social_story',
            platform,
            productId: `promo-${sanitize(params.seasonName, 30)}`,
            productName: sanitize(params.seasonName, 200),
            eventType: 'seasonal_promo',
            priority,
            status: 'pending',
            scheduledAt,
            payload: JSON.stringify(content),
            createdBy: `seasonal-${sanitize(params.seasonName, 30)}-${new Date().toISOString().slice(0, 10)}`,
            processedAt: null,
            error: '',
          });
          scheduled++;
        } catch (insertErr) {
          errors.push(`${platform}: failed to queue — ${insertErr.message}`);
        }
      }

      return { success: true, scheduled, rateLimited, errors };
    } catch (err) {
      console.error('[socialStoryScheduler] Error scheduling seasonal promo:', err);
      return { success: false, scheduled: 0, rateLimited: 0, errors: [err.message] };
    }
  }
);

/**
 * Get rate limit status for all platforms.
 * @returns {Promise<{success: boolean, platforms: Object}>}
 */
export const getRateLimitStatus = webMethod(
  Permissions.Admin,
  async () => {
    try {
      await requireAdmin();

      const result = {};
      for (const platform of PLATFORMS) {
        const count = await getTodayPostCount(platform);
        const limit = DAILY_RATE_LIMITS[platform];
        result[platform] = {
          postsToday: count,
          dailyLimit: limit,
          remaining: Math.max(0, limit - count),
          withinLimit: count < limit,
        };
      }

      return { success: true, platforms: result };
    } catch (err) {
      console.error('[socialStoryScheduler] Error getting rate limits:', err);
      return { success: false, platforms: {}, error: err.message };
    }
  }
);

/**
 * Get engagement window info for all platforms.
 * @returns {{success: boolean, windows: Object}}
 */
export const getEngagementWindows = webMethod(
  Permissions.Anyone,
  async () => {
    const windows = {};
    for (const platform of PLATFORMS) {
      const w = ENGAGEMENT_WINDOWS[platform];
      const next = getNextEngagementWindow(platform);
      windows[platform] = {
        startHour: w.start,
        endHour: w.end,
        nextWindow: next ? next.toISOString() : null,
      };
    }
    return { success: true, windows };
  }
);

// Export internals for testing
export const _DEDUP_WINDOW_MS = DEDUP_WINDOW_MS;
export const _PLATFORMS = PLATFORMS;
export const _ENGAGEMENT_WINDOWS = ENGAGEMENT_WINDOWS;
export const _DAILY_RATE_LIMITS = DAILY_RATE_LIMITS;
export { getNextEngagementWindow as _getNextEngagementWindow };
export { buildPlatformContent as _buildPlatformContent };
export { isProductDuplicate as _isProductDuplicate };
export { isWithinRateLimit as _isWithinRateLimit };
