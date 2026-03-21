/**
 * @module visualSearch
 * @description Visual search backend — S1 spike.
 * Accepts an image URL, calls Google Cloud Vision API to extract labels,
 * maps labels to furniture style tags, and returns mock product matches.
 *
 * S2 will replace mock product matches with real Wix Stores catalog queries.
 *
 * @setup
 * Add to Wix Secrets Manager:
 *   GOOGLE_VISION_API_KEY — Google Cloud Vision API key
 */
import { Permissions, webMethod } from 'wix-web-module';
import { sanitize } from 'backend/utils/sanitize';

const VISION_API_BASE = 'https://vision.googleapis.com/v1/images:annotate';
const MAX_RESULTS = 20;

// ── Rate limiting (in-memory, per server instance) ───────────────────
// Limits analyzeRoomPhoto to RATE_LIMIT_MAX calls per RATE_LIMIT_WINDOW_MS.
// Resets automatically when the window expires. Not distributed — sufficient
// for SSRF/abuse protection on a Wix backend function (single-instance).
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

let _rateLimitCount = 0;
let _rateLimitResetAt = Date.now() + RATE_LIMIT_WINDOW_MS;

// Exported for testing only.
export function _resetRateLimit() {
  _rateLimitCount = 0;
  _rateLimitResetAt = Date.now() + RATE_LIMIT_WINDOW_MS;
}

function _checkRateLimit() {
  const now = Date.now();
  if (now >= _rateLimitResetAt) {
    _rateLimitCount = 0;
    _rateLimitResetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  if (_rateLimitCount >= RATE_LIMIT_MAX) return false;
  _rateLimitCount++;
  return true;
}

// Private/loopback IP ranges that must never be forwarded to Vision API.
// Prevents SSRF attacks where a crafted URL could reach internal services.
// Covers: localhost, 127.x.x.x, 0.x.x.x, 10.x.x.x, 169.254.x.x (link-local/AWS metadata),
//         172.16-31.x.x, 192.168.x.x, ::1, fc/fd IPv6.
const PRIVATE_IP_RE = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|0(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|\[?(?:::1|fc[\da-f]{2}:|fd[\da-f]{2}:))(?::\d+)?(?:\/|$)/i;

// Style tags we extract and surface to the frontend
export const STYLE_TAGS = ['modern', 'rustic', 'industrial', 'mid-century', 'coastal', 'traditional', 'minimalist', 'bohemian'];

// Keyword-to-style mappings: Vision API labels → style tags
const LABEL_STYLE_MAP = {
  // Modern
  modern: 'modern', contemporary: 'modern', sleek: 'modern', clean: 'modern', minimalist: 'minimalist',
  glass: 'modern', chrome: 'modern', metal: 'industrial', steel: 'industrial',
  // Rustic
  rustic: 'rustic', farmhouse: 'rustic', barn: 'rustic', wood: 'rustic', wooden: 'rustic',
  reclaimed: 'rustic', distressed: 'rustic', weathered: 'rustic', natural: 'rustic',
  // Industrial
  industrial: 'industrial', warehouse: 'industrial', pipe: 'industrial', iron: 'industrial',
  brick: 'industrial', loft: 'industrial',
  // Mid-century
  'mid-century': 'mid-century', retro: 'mid-century', vintage: 'mid-century', teak: 'mid-century',
  walnut: 'mid-century', tapered: 'mid-century',
  // Coastal
  coastal: 'coastal', beach: 'coastal', nautical: 'coastal', white: 'coastal', light: 'coastal',
  wicker: 'coastal', rattan: 'coastal', jute: 'coastal',
  // Traditional
  traditional: 'traditional', classic: 'traditional', ornate: 'traditional', formal: 'traditional',
  dark: 'traditional', mahogany: 'traditional', cherry: 'traditional',
  // Bohemian
  bohemian: 'bohemian', boho: 'bohemian', eclectic: 'bohemian', colorful: 'bohemian',
  pattern: 'bohemian', textile: 'bohemian',
};

// Mock product catalog per style (S1). S2 will query Wix Stores.
const MOCK_PRODUCTS_BY_STYLE = {
  modern: [
    { _id: 'mock-modern-1', name: 'Eureka Futon Frame', slug: 'eureka-futon-frame', price: 499, matchScore: 0.9 },
    { _id: 'mock-modern-2', name: 'Dillon Wall Hugger', slug: 'dillon-wall-hugger-frame', price: 699, matchScore: 0.8 },
  ],
  rustic: [
    { _id: 'mock-rustic-1', name: 'Weathered Oak Futon Frame', slug: 'weathered-oak-futon-frame', price: 599, matchScore: 0.9 },
    { _id: 'mock-rustic-2', name: 'Barn Wood Sofa Sleeper', slug: 'barn-wood-sofa-sleeper', price: 799, matchScore: 0.7 },
  ],
  industrial: [
    { _id: 'mock-industrial-1', name: 'Iron Pipe Futon Frame', slug: 'iron-pipe-futon-frame', price: 549, matchScore: 0.9 },
  ],
  'mid-century': [
    { _id: 'mock-midcentury-1', name: 'Teak Mid-Century Futon', slug: 'teak-mid-century-futon', price: 749, matchScore: 0.9 },
    { _id: 'mock-midcentury-2', name: 'Walnut Loveseat Sleeper', slug: 'walnut-loveseat-sleeper', price: 649, matchScore: 0.75 },
  ],
  coastal: [
    { _id: 'mock-coastal-1', name: 'Driftwood Platform Bed', slug: 'driftwood-platform-bed', price: 899, matchScore: 0.85 },
    { _id: 'mock-coastal-2', name: 'White Rattan Daybed', slug: 'white-rattan-daybed', price: 599, matchScore: 0.8 },
  ],
  traditional: [
    { _id: 'mock-traditional-1', name: 'Cherry Wood Futon Frame', slug: 'cherry-wood-futon-frame', price: 699, matchScore: 0.9 },
  ],
  minimalist: [
    { _id: 'mock-minimalist-1', name: 'Platform Bed Low Profile', slug: 'platform-bed-low-profile', price: 849, matchScore: 0.88 },
  ],
  bohemian: [
    { _id: 'mock-bohemian-1', name: 'Woven Textile Futon', slug: 'woven-textile-futon', price: 529, matchScore: 0.82 },
  ],
};

/**
 * Load Google Vision API key from Wix Secrets Manager.
 * @returns {Promise<string|null>}
 */
async function loadVisionKey() {
  try {
    const { getSecret } = await import('wix-secrets-backend');
    return await getSecret('GOOGLE_VISION_API_KEY');
  } catch (_) {
    return null;
  }
}

/**
 * Validate that a string is a plausible image URL.
 * Allows http/https with common image extensions or Wix media URLs.
 * @param {string} url
 * @returns {boolean}
 */
export function isValidImageUrl(url) {
  if (typeof url !== 'string') return false;
  const cleaned = url.trim();
  if (!cleaned.startsWith('https://')) return false; // https only — no cleartext http://
  if (cleaned.length > 2000) return false;
  if (PRIVATE_IP_RE.test(cleaned)) return false; // block SSRF via private/loopback IPs
  return true;
}

/**
 * Map an array of Vision API label descriptions to style tags.
 * Returns deduplicated list of matched STYLE_TAGS in order of first match.
 *
 * @param {Array<{description: string, score: number}>} labels
 * @returns {string[]} matched style tags (may be empty)
 */
export function extractStyleTags(labels) {
  if (!Array.isArray(labels) || labels.length === 0) return [];
  const found = new Set();
  for (const label of labels) {
    const desc = (label.description || '').toLowerCase().trim();
    const tag = LABEL_STYLE_MAP[desc];
    if (tag) found.add(tag);
  }
  return [...found];
}

/**
 * Call Google Cloud Vision API to get label annotations for an image URL.
 * Returns raw label objects: [{description, score, topicality}]
 *
 * @param {string} imageUrl
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
export async function callVisionAPI(imageUrl, apiKey) {
  const { fetch } = await import('wix-fetch');
  const res = await fetch(`${VISION_API_BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { source: { imageUri: imageUrl } },
        features: [{ type: 'LABEL_DETECTION', maxResults: MAX_RESULTS }],
      }],
    }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 400) throw new Error('vision_bad_request');
    if (status === 403) throw new Error('vision_auth_error');
    if (status === 429) throw new Error('vision_rate_limited');
    throw new Error(`vision_api_error_${status}`);
  }

  const data = await res.json();
  const annotations = data?.responses?.[0]?.labelAnnotations;
  return Array.isArray(annotations) ? annotations : [];
}

/**
 * Get mock product matches for the detected style tags (S1 spike).
 * Returns up to 5 products, weighted by first-matched style.
 *
 * @param {string[]} tags
 * @returns {Array}
 */
export function getMockProducts(tags) {
  if (!tags || tags.length === 0) return [];
  const seen = new Set();
  const results = [];
  for (const tag of tags) {
    const products = MOCK_PRODUCTS_BY_STYLE[tag] || [];
    for (const p of products) {
      if (!seen.has(p._id) && results.length < 5) {
        seen.add(p._id);
        results.push({ ...p, matchedStyle: tag });
      }
    }
  }
  return results;
}

/**
 * Analyze a room photo and return furniture style tags + matching products.
 * S1 spike: uses Google Vision API for tags, mock product matches.
 *
 * @function analyzeRoomPhoto
 * @param {string} imageUrl - Publicly accessible image URL
 * @returns {Promise<{success: boolean, tags: string[], products: Array, provider: string}>}
 * @permission Anyone — called from PDP photo upload UI
 */
export const analyzeRoomPhoto = webMethod(
  Permissions.Anyone,
  async (imageUrl) => {
    try {
      if (!_checkRateLimit()) {
        return { success: false, tags: [], products: [], error: 'rate_limit_exceeded' };
      }

      const cleanUrl = sanitize(imageUrl || '', 2000);
      if (!isValidImageUrl(cleanUrl)) {
        return { success: false, tags: [], products: [], error: 'invalid_image_url' };
      }

      const apiKey = await loadVisionKey();
      if (!apiKey) {
        return { success: false, tags: [], products: [], error: 'no_vision_key' };
      }

      const labels = await callVisionAPI(cleanUrl, apiKey);
      const tags = extractStyleTags(labels);
      const products = getMockProducts(tags);

      return {
        success: true,
        tags,
        products,
        provider: 'google_vision',
        labelCount: labels.length,
      };
    } catch (err) {
      console.error('[visualSearch] analyzeRoomPhoto error:', err?.message ?? err);
      const reason = err?.message?.startsWith('vision_') ? err.message : 'analysis_failed';
      return { success: false, tags: [], products: [], error: reason };
    }
  }
);
