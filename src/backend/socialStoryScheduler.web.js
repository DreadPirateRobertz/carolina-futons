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

// Day-of-week content rotation: 0=Sun, 1=Mon, ..., 6=Sat
const CONTENT_ROTATION = {
  0: 'weekend_promo',    // Sunday
  1: 'featured_product', // Monday
  2: 'review_highlight', // Tuesday
  3: 'featured_product', // Wednesday
  4: 'review_highlight', // Thursday
  5: 'featured_product', // Friday
  6: 'furniture_tip',    // Saturday
};

const FURNITURE_CARE_TIPS = [
  { title: 'Rotate your futon mattress monthly', tip: 'Flip and rotate your futon mattress every month to ensure even wear and extend its life by years.' },
  { title: 'Protect from direct sunlight', tip: 'Keep your futon frame away from direct sunlight. UV rays can fade and crack wood finishes over time.' },
  { title: 'Clean spills immediately', tip: 'Blot spills right away with a clean cloth. Never rub — rubbing pushes the stain deeper into the fabric.' },
  { title: 'Tighten bolts every 6 months', tip: 'Check and tighten all bolts every 6 months. A loose bolt is the #1 cause of a squeaky futon frame.' },
  { title: 'Use a mattress pad', tip: 'A quality mattress pad protects your futon cover from daily wear and can extend mattress life by years.' },
  { title: 'Vacuum bi-weekly', tip: 'Vacuum your futon mattress with an upholstery attachment every two weeks to remove dust and allergens.' },
  { title: 'Air it out monthly', tip: 'Stand your futon mattress on its side outdoors for a few hours monthly — fresh air prevents mold and odors.' },
];

const WEEKEND_PROMO = {
  title: 'Weekend at Carolina Futons',
  message: 'Stop in this weekend and browse our full showroom in Hendersonville, NC. Our craftspeople are here to help you find the perfect piece.',
  hours: 'Mon–Sat 10am–6pm · Sun 12pm–5pm',
  url: 'carolinafutons.com',
};

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

/**
 * Cron-callable: query catalog for new arrivals (past 24h) and price drops (past 24h),
 * then schedule social stories across all platforms.
 *
 * Called daily by jobs.config. Runs in Wix cron/system context with Admin permissions.
 *
 * @returns {Promise<{success: boolean, newArrivals: {scheduled:number, skipped:number, rateLimited:number, errors:string[]}, priceDrops: {scheduled:number, skipped:number, rateLimited:number, errors:string[]}, errors: string[]}>}
 */
export const runDailySocialStories = webMethod(
  Permissions.Admin,
  async () => {
    const errors = [];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // --- New arrivals ---
    let newArrivalResult = { scheduled: 0, skipped: 0, rateLimited: 0, errors: [] };
    try {
      const newProducts = await wixData.query('Stores/Products')
        .ge('_createdDate', since)
        .limit(100)
        .find();

      for (const product of newProducts.items) {
        const result = await scheduleNewArrivalStoriesInternal(product);
        newArrivalResult.scheduled += result.scheduled;
        newArrivalResult.skipped += result.skipped;
        newArrivalResult.rateLimited += result.rateLimited;
        if (result.errors.length) newArrivalResult.errors.push(...result.errors);
      }
    } catch (err) {
      const msg = `new_arrivals query failed: ${err.message}`;
      console.error('[socialStoryScheduler] runDailySocialStories', msg);
      errors.push(msg);
    }

    // --- Price drops (products updated in last 24h where price decreased) ---
    let priceDropResult = { scheduled: 0, skipped: 0, rateLimited: 0, errors: [] };
    try {
      const updatedProducts = await wixData.query('Stores/Products')
        .ge('_updatedDate', since)
        .limit(100)
        .find();

      for (const product of updatedProducts.items) {
        if (product.comparePrice != null && Number(product.comparePrice) > Number(product.price)) {
          const productWithDrop = {
            ...product,
            previousPrice: product.comparePrice,
          };
          const result = await schedulePriceDropStoriesInternal(productWithDrop);
          priceDropResult.scheduled += result.scheduled;
          priceDropResult.skipped += result.skipped;
          priceDropResult.rateLimited += result.rateLimited;
          if (result.errors.length) priceDropResult.errors.push(...result.errors);
        }
      }
    } catch (err) {
      const msg = `price_drops query failed: ${err.message}`;
      console.error('[socialStoryScheduler] runDailySocialStories', msg);
      errors.push(msg);
    }

    const hasInsertErrors = newArrivalResult.errors.length > 0 || priceDropResult.errors.length > 0;
    const summary = {
      success: errors.length === 0 && !hasInsertErrors,
      newArrivals: newArrivalResult,
      priceDrops: priceDropResult,
      errors,
    };
    console.log('[socialStoryScheduler] runDailySocialStories complete:', JSON.stringify(summary));
    return summary;
  }
);

// Internal (non-authenticated) versions for use within cron context
async function scheduleNewArrivalStoriesInternal(product) {
  if (!product || !product.name) {
    return { scheduled: 0, skipped: 0, rateLimited: 0, errors: ['Product with name is required'] };
  }

  const productId = product._id || product.slug || sanitize(product.name, 50);
  let scheduled = 0;
  let skipped = 0;
  let rateLimited = 0;
  const errors = [];

  for (const platform of PLATFORMS) {
    if (await isProductDuplicate(productId, platform)) { skipped++; continue; }
    if (!(await isWithinRateLimit(platform))) {
      rateLimited++;
      errors.push(`${platform}: daily rate limit reached`);
      continue;
    }
    const content = buildPlatformContent(product, platform, 'new_arrival');
    if (!content) { errors.push(`${platform}: failed to build content`); continue; }
    const scheduledAt = getNextEngagementWindow(platform) || new Date();
    try {
      await wixData.insert('ContentSchedule', {
        contentType: 'social_story', platform, productId,
        productName: sanitize(product.name, 200), eventType: 'new_arrival',
        priority: 3, status: 'pending', scheduledAt,
        payload: JSON.stringify(content),
        createdBy: `new_arrival-${productId}-${new Date().toISOString().slice(0, 10)}`,
        processedAt: null, error: '',
      });
      scheduled++;
    } catch (insertErr) {
      errors.push(`${platform}: failed to queue — ${insertErr.message}`);
    }
  }
  return { scheduled, skipped, rateLimited, errors };
}

async function schedulePriceDropStoriesInternal(product) {
  if (!product || !product.name || product.price == null || product.previousPrice == null) {
    return { scheduled: 0, skipped: 0, rateLimited: 0, errors: ['Incomplete product data'] };
  }
  // Defensive guard — outer caller pre-filters, but this ensures correctness if called directly
  if (Number(product.price) >= Number(product.previousPrice)) {
    return { scheduled: 0, skipped: 0, rateLimited: 0, errors: [] };
  }

  const productId = product._id || product.slug || sanitize(product.name, 50);
  let scheduled = 0;
  let skipped = 0;
  let rateLimited = 0;
  const errors = [];

  for (const platform of PLATFORMS) {
    if (await isProductDuplicate(productId, platform)) { skipped++; continue; }
    if (!(await isWithinRateLimit(platform))) {
      rateLimited++;
      errors.push(`${platform}: daily rate limit reached`);
      continue;
    }
    const content = buildPlatformContent(product, platform, 'price_drop');
    if (!content) { errors.push(`${platform}: failed to build content`); continue; }
    content.previousPrice = `$${Number(product.previousPrice).toFixed(2)}`;
    content.savings = `$${(Number(product.previousPrice) - Number(product.price)).toFixed(2)}`;
    const scheduledAt = getNextEngagementWindow(platform) || new Date();
    try {
      await wixData.insert('ContentSchedule', {
        contentType: 'social_story', platform, productId,
        productName: sanitize(product.name, 200), eventType: 'price_drop',
        priority: 2, status: 'pending', scheduledAt,
        payload: JSON.stringify(content),
        createdBy: `price_drop-${productId}-${new Date().toISOString().slice(0, 10)}`,
        processedAt: null, error: '',
      });
      scheduled++;
    } catch (insertErr) {
      errors.push(`${platform}: failed to queue — ${insertErr.message}`);
    }
  }
  return { scheduled, skipped, rateLimited, errors };
}

// ── Content Rotation Internals ──────────────────────────────────────────

/**
 * Pick the rotation content type for a given day of week.
 * @param {number} dayOfWeek - 0=Sun...6=Sat
 * @returns {string}
 */
function getDayRotationContent(dayOfWeek) {
  return CONTENT_ROTATION[dayOfWeek] || 'featured_product';
}

/**
 * Pick a featured product: prefer ribbon-tagged products, fall back to newest.
 * Returns null if catalog is empty.
 */
async function pickFeaturedProduct() {
  // Try ribbon-tagged products first
  const featured = await wixData.query('Stores/Products')
    .isNotEmpty('ribbon')
    .descending('_updatedDate')
    .limit(1)
    .find();

  if (featured.items.length > 0) return featured.items[0];

  // Fall back to most recently updated product
  const fallback = await wixData.query('Stores/Products')
    .descending('_updatedDate')
    .limit(1)
    .find();

  return fallback.items.length > 0 ? fallback.items[0] : null;
}

/**
 * Pick a recent high-rated review. Returns null if none found.
 */
async function pickRecentReview() {
  const result = await wixData.query('ProductReviews')
    .ge('rating', 4)
    .descending('_createdDate')
    .limit(1)
    .find();
  return result.items.length > 0 ? result.items[0] : null;
}

/**
 * Schedule content-rotation stories across platforms.
 * @param {string} contentType - featured_product | review_highlight | furniture_tip | weekend_promo
 * @param {Object} payload - content data for the post
 * @param {string} eventType - CMS eventType field value
 */
async function scheduleRotationContentInternal(contentType, payload, eventType, dateStr) {
  let scheduled = 0;
  let rateLimited = 0;
  const errors = [];

  for (const platform of PLATFORMS) {
    if (!(await isWithinRateLimit(platform))) {
      rateLimited++;
      errors.push(`${platform}: daily rate limit reached`);
      continue;
    }

    const content = {
      contentType,
      platform,
      payload,
    };

    const caption = buildRotationCaption(platform, contentType, payload);
    const scheduledAt = getNextEngagementWindow(platform) || new Date();

    try {
      await wixData.insert('ContentSchedule', {
        contentType: 'social_story',
        platform,
        productId: payload.productId || `rotation-${eventType}-${new Date().toISOString().slice(0, 10)}`,
        productName: sanitize(payload.title || payload.productName || contentType, 200),
        eventType,
        priority: 3,
        status: 'pending',
        scheduledAt,
        payload: JSON.stringify({ ...content, caption }),
        createdBy: `rotation-${eventType}-${dateStr || new Date().toISOString().slice(0, 10)}`,
        processedAt: null,
        error: '',
      });
      scheduled++;
    } catch (insertErr) {
      errors.push(`${platform}: failed to queue — ${insertErr.message}`);
    }
  }
  return { scheduled, rateLimited, errors };
}

/**
 * Build a platform-appropriate caption for rotation content.
 */
function buildRotationCaption(platform, contentType, payload) {
  switch (contentType) {
    case 'featured_product': {
      const price = payload.price != null ? `$${Number(payload.price).toFixed(2)}` : '';
      const lines = [`Featured: ${payload.productName}`];
      if (price) lines.push(`Starting at ${price}`);
      if (platform !== 'pinterest') lines.push('Shop at carolinafutons.com');
      if (platform === 'instagram') lines.push('#CarolinaFutons #HendersonvilleNC #FutonLiving');
      return lines.filter(Boolean).join('\n');
    }
    case 'review_highlight': {
      const lines = [];
      if (payload.reviewerName) lines.push(`"${payload.reviewText}" — ${payload.reviewerName}`);
      else lines.push(payload.reviewText || 'Our customers love their Carolina Futons pieces!');
      if (payload.productName) lines.push(`Product: ${payload.productName}`);
      if (platform !== 'pinterest') lines.push('carolinafutons.com');
      return lines.filter(Boolean).join('\n');
    }
    case 'furniture_tip': {
      const lines = [`Did you know? ${payload.title}`, payload.tip];
      if (platform !== 'pinterest') lines.push('More tips at carolinafutons.com');
      if (platform === 'instagram') lines.push('#FurnitureCare #FutonLife #HomeDecor');
      return lines.filter(Boolean).join('\n');
    }
    case 'weekend_promo': {
      const lines = [payload.title, payload.message];
      if (payload.hours) lines.push(payload.hours);
      lines.push(payload.url || 'carolinafutons.com');
      return lines.filter(Boolean).join('\n');
    }
    default:
      return payload.message || '';
  }
}

/**
 * Cron-callable: run the day-of-week content rotation (featured product / review highlight /
 * furniture tip / weekend promo). Called once daily, separate from new arrivals/price drops.
 *
 * Content schedule:
 *   Mon/Wed/Fri  → Featured product with price + link
 *   Tue/Thu      → Customer review highlight
 *   Sat          → "Did you know?" furniture care tip
 *   Sun          → Weekend promo / store hours
 *
 * @returns {Promise<{success: boolean, contentType: string, scheduled: number, rateLimited: number, errors: string[]}>}
 */
export const runDailyContentRotation = webMethod(
  Permissions.Admin,
  async () => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay();
    const contentType = getDayRotationContent(dayOfWeek);

    let rotationPayload = null;
    const errors = [];

    try {
      if (contentType === 'featured_product') {
        const product = await pickFeaturedProduct();
        if (!product) {
          const msg = 'featured_product: no products found in catalog';
          console.warn('[socialStoryScheduler] runDailyContentRotation:', msg);
          return { success: false, contentType, scheduled: 0, rateLimited: 0, errors: [msg] };
        }
        rotationPayload = {
          productId: product._id || product.slug || '',
          productName: product.name,
          price: product.price,
          imageUrl: (product.images && product.images[0]) || '',
          title: product.name,
        };

      } else if (contentType === 'review_highlight') {
        const review = await pickRecentReview();
        if (review) {
          rotationPayload = {
            reviewText: sanitize(review.content || review.text || review.review || 'Wonderful quality and craftsmanship!', 280),
            reviewerName: review.authorName || review.memberName || '',
            rating: review.rating || 5,
            productName: review.productName || '',
            productId: review.productId || `review-${todayStr}`,
            title: 'Customer Review',
          };
        } else {
          // Fallback: brand testimonial when no reviews in DB
          rotationPayload = {
            reviewText: 'Wonderful quality and craftsmanship — exactly what we needed for our home.',
            reviewerName: 'Happy Customer',
            rating: 5,
            productName: '',
            productId: `review-fallback-${todayStr}`,
            title: 'Customer Review',
          };
        }

      } else if (contentType === 'furniture_tip') {
        const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
        const tip = FURNITURE_CARE_TIPS[weekIndex % FURNITURE_CARE_TIPS.length];
        rotationPayload = {
          ...tip,
          productId: `tip-${weekIndex % FURNITURE_CARE_TIPS.length}`,
        };

      } else if (contentType === 'weekend_promo') {
        rotationPayload = {
          ...WEEKEND_PROMO,
          productId: `promo-${todayStr}`,
        };
      }

      if (!rotationPayload) {
        return { success: false, contentType, scheduled: 0, rateLimited: 0, errors: [`No payload for contentType: ${contentType}`] };
      }

      const result = await scheduleRotationContentInternal(contentType, rotationPayload, contentType, todayStr);
      errors.push(...result.errors);

      const summary = { success: result.scheduled > 0, contentType, ...result, errors };
      console.log('[socialStoryScheduler] runDailyContentRotation complete:', JSON.stringify(summary));
      return summary;

    } catch (err) {
      console.error('[socialStoryScheduler] runDailyContentRotation error:', err);
      return { success: false, contentType, scheduled: 0, rateLimited: 0, errors: [err.message] };
    }
  }
);

// Export internals for testing
export const _DEDUP_WINDOW_MS = DEDUP_WINDOW_MS;
export const _PLATFORMS = PLATFORMS;
export const _ENGAGEMENT_WINDOWS = ENGAGEMENT_WINDOWS;
export const _DAILY_RATE_LIMITS = DAILY_RATE_LIMITS;
export const _CONTENT_ROTATION = CONTENT_ROTATION;
export const _FURNITURE_CARE_TIPS = FURNITURE_CARE_TIPS;
export const _WEEKEND_PROMO = WEEKEND_PROMO;
export { getNextEngagementWindow as _getNextEngagementWindow };
export { buildPlatformContent as _buildPlatformContent };
export { isProductDuplicate as _isProductDuplicate };
export { isWithinRateLimit as _isWithinRateLimit };
export { getDayRotationContent as _getDayRotationContent };
export { buildRotationCaption as _buildRotationCaption };
