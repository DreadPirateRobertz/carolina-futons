/**
 * @module socialStoryHelpers
 * @description Pure helpers for social media story generation pipeline.
 * Template data builders, schedule logic, caption formatting, and hashtag management.
 */

// ── Story Types ──────────────────────────────────────────────────────

export const STORY_TYPES = {
  DID_YOU_KNOW: 'did_you_know',
  CARE_TIP: 'care_tip',
  WEEKEND_VISIT: 'weekend_visit',
  NEW_ARRIVAL: 'new_arrival',
  CUSTOMER_SPOTLIGHT: 'customer_spotlight',
};

const STORY_TYPE_SET = new Set(Object.values(STORY_TYPES));

// ── Brand Hashtags ───────────────────────────────────────────────────

const BASE_HASHTAGS = [
  '#CarolinaFutons', '#HandcraftedComfort', '#HendersonvilleNC',
  '#FutonLiving', '#SmallSpaceLiving',
];

const TYPE_HASHTAGS = {
  [STORY_TYPES.DID_YOU_KNOW]: ['#FurnitureFacts', '#DidYouKnow', '#HomeDesignTips'],
  [STORY_TYPES.CARE_TIP]: ['#FurnitureCare', '#HomeTips', '#CleanLiving'],
  [STORY_TYPES.WEEKEND_VISIT]: ['#ShopLocal', '#WeekendVibes', '#NCMountains'],
  [STORY_TYPES.NEW_ARRIVAL]: ['#NewArrival', '#JustDropped', '#HomeDecor'],
  [STORY_TYPES.CUSTOMER_SPOTLIGHT]: ['#CustomerLove', '#HappyCustomer', '#Testimonial'],
};

// ── Schedule ─────────────────────────────────────────────────────────

const POSTING_SCHEDULE = {
  0: [],                          // Sunday — rest
  1: [STORY_TYPES.DID_YOU_KNOW],  // Monday
  2: [STORY_TYPES.CARE_TIP],      // Tuesday
  3: [STORY_TYPES.NEW_ARRIVAL],   // Wednesday
  4: [STORY_TYPES.DID_YOU_KNOW],  // Thursday
  5: [STORY_TYPES.WEEKEND_VISIT], // Friday
  6: [STORY_TYPES.CUSTOMER_SPOTLIGHT], // Saturday
};

const DEFAULT_POST_HOUR = 10; // 10 AM ET

// ── Public API ───────────────────────────────────────────────────────

/**
 * Validate a story type string.
 * @param {string} type
 * @returns {boolean}
 */
export function isValidStoryType(type) {
  return STORY_TYPE_SET.has(type);
}

/**
 * Get hashtags for a story type (base + type-specific).
 * @param {string} storyType
 * @returns {string[]}
 */
export function getHashtags(storyType) {
  const typeSpecific = TYPE_HASHTAGS[storyType] || [];
  return [...BASE_HASHTAGS, ...typeSpecific];
}

/**
 * Format a caption with optional hashtags.
 * @param {string} text - Caption text
 * @param {string} storyType - Story type for hashtags
 * @param {Object} [options]
 * @param {boolean} [options.includeHashtags=true]
 * @param {number} [options.maxLength=2200] - Instagram caption limit
 * @returns {string}
 */
export function formatCaption(text, storyType, options = {}) {
  const { includeHashtags = true, maxLength = 2200 } = options;
  if (!text) return '';

  const trimmed = text.trim();
  if (!includeHashtags) {
    return trimmed.slice(0, maxLength);
  }

  const tags = getHashtags(storyType).join(' ');
  const caption = `${trimmed}\n\n${tags}`;
  return caption.slice(0, maxLength);
}

/**
 * Get scheduled story types for a given date.
 * @param {Date|string} date
 * @returns {string[]} Story types to post
 */
export function getScheduledStories(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return [];
  const day = d.getDay();
  return [...(POSTING_SCHEDULE[day] || [])];
}

/**
 * Get the next scheduled posting time for a given date.
 * @param {Date|string} date
 * @returns {Date|null} Next posting time or null if no posts scheduled
 */
export function getNextPostTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const stories = getScheduledStories(d);
  if (stories.length === 0) return null;

  const postTime = new Date(d);
  postTime.setHours(DEFAULT_POST_HOUR, 0, 0, 0);
  return postTime;
}

/**
 * Build template data for a story type.
 * @param {string} storyType
 * @param {Object} data - Content-specific data
 * @returns {Object|null} Template data or null if invalid type
 */
export function buildTemplateData(storyType, data = {}) {
  if (!isValidStoryType(storyType)) return null;

  const base = {
    type: storyType,
    width: 1080,
    height: 1920,
    brandName: 'Carolina Futons',
    tagline: 'Handcrafted comfort at mountain-town prices',
    timestamp: new Date().toISOString(),
  };

  switch (storyType) {
    case STORY_TYPES.DID_YOU_KNOW:
      return {
        ...base,
        headline: data.headline || 'Did You Know?',
        fact: data.fact || '',
        source: data.source || '',
      };
    case STORY_TYPES.CARE_TIP:
      return {
        ...base,
        title: data.title || 'Care Tip',
        tip: data.tip || '',
        productName: data.productName || '',
      };
    case STORY_TYPES.WEEKEND_VISIT:
      return {
        ...base,
        heading: 'Visit Us This Weekend',
        address: '537 N Main St, Hendersonville, NC',
        hours: data.hours || 'Mon-Sat 10am-6pm',
        promo: data.promo || '',
      };
    case STORY_TYPES.NEW_ARRIVAL:
      return {
        ...base,
        productName: data.productName || '',
        price: data.price || '',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
      };
    case STORY_TYPES.CUSTOMER_SPOTLIGHT:
      return {
        ...base,
        customerName: data.customerName || '',
        quote: data.quote || '',
        productName: data.productName || '',
        rating: Math.min(5, Math.max(0, Number(data.rating) || 5)),
      };
    default:
      return null;
  }
}

/**
 * Build Meta Graph API payload for a story post.
 * @param {Object} params
 * @param {string} params.imageUrl - Public URL of the story image
 * @param {string} [params.caption] - Optional caption
 * @param {string} params.pageId - Facebook Page ID
 * @returns {Object|null} API payload or null if missing required fields
 */
export function buildMetaStoryPayload({ imageUrl, caption, pageId }) {
  if (!imageUrl || !pageId) return null;

  return {
    url: imageUrl,
    caption: caption || '',
    published: true,
    endpoint: `/${pageId}/photo_stories`,
  };
}

/**
 * Calculate optimal posting window based on engagement data.
 * Returns the default schedule hour if no data provided.
 * @param {Array<{hour: number, engagement: number}>} [engagementData]
 * @returns {number} Best hour to post (0-23)
 */
export function getOptimalPostHour(engagementData) {
  if (!engagementData || engagementData.length === 0) {
    return DEFAULT_POST_HOUR;
  }

  let bestHour = DEFAULT_POST_HOUR;
  let bestEngagement = -1;

  for (const entry of engagementData) {
    const hour = Number(entry.hour);
    const eng = Number(entry.engagement);
    if (isFinite(hour) && isFinite(eng) && eng > bestEngagement) {
      bestEngagement = eng;
      bestHour = hour;
    }
  }

  return bestHour;
}
