/**
 * Tests for URL-percent-encoded slugs at GET /_functions/topicCluster/{slug}.
 *
 * Wix may pass raw URL path segments to request.path[0]. The handler calls
 * validateSlug() which rejects any character outside [a-z0-9-]. Percent signs
 * and hex digits in encoded sequences are therefore invalid → 400.
 *
 * These tests complement the existing slug-injection suite in
 * topicClusterEndpoint.test.js and verify the specific 400-not-404 boundary
 * for URL-encoded input.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wix-http-functions ────────────────────────────────────────────
vi.mock('wix-http-functions', () => ({
  ok: vi.fn((opts) => ({ status: 200, ...opts })),
  notFound: vi.fn((opts) => ({ status: 404, ...opts })),
  serverError: vi.fn((opts) => ({ status: 500, ...opts })),
  forbidden: vi.fn((opts) => ({ status: 403, ...opts })),
  badRequest: vi.fn((opts) => ({ status: 400, ...opts })),
}));

// ── Mock all other http-functions dependencies ────────────────────────
vi.mock('backend/googleMerchantFeed.web', () => ({ generateFeed: vi.fn() }));
vi.mock('backend/utils/mediaHelpers', () => ({ getImageUrl: vi.fn() }));
vi.mock('backend/notificationService.web', () => ({
  recordPriceSnapshots: vi.fn(), checkWishlistAlerts: vi.fn(),
}));
vi.mock('backend/browseAbandonment.web', () => ({ triggerBrowseRecovery: vi.fn() }));
vi.mock('backend/emailAutomation.web', () => ({
  triggerAbandonedCartRecovery: vi.fn(), processEmailQueue: vi.fn(),
  triggerReengagement: vi.fn(), triggerPostPurchaseSequence: vi.fn(),
  getCampaignAnalytics: vi.fn(),
}));
vi.mock('backend/contentScheduler.web', () => ({ processContentSchedule: vi.fn() }));
vi.mock('backend/postPurchaseCare.web', () => ({ getAssemblyFollowUpData: vi.fn() }));
vi.mock('backend/blogContent', () => ({ getAllBlogPosts: vi.fn(() => []) }));
vi.mock('backend/seoHelpers.web', () => ({
  getSitemapData: vi.fn(() => Promise.resolve([])),
  buildSitemapXml: vi.fn(() => ''),
  getRobotsTxtContent: vi.fn(() => ''),
}));
vi.mock('backend/blogRssFeed.web', () => ({ generateBlogRssFeed: vi.fn() }));
vi.mock('wix-data', () => ({
  default: { query: vi.fn(() => ({ find: vi.fn(() => Promise.resolve({ items: [], totalCount: 0 })) })) },
}));
vi.mock('public/sharedTokens', () => ({ colors: {} }));
vi.mock('backend/facebookCatalog.web', () => ({
  getEnhancedCatalogFields: vi.fn(), exportCustomerAudienceData: vi.fn(),
}));
vi.mock('backend/utils/httpHelpers', () => ({
  timingSafeEqual: vi.fn(() => true),
  decodeHtmlEntities: vi.fn((s) => s),
  stripHtmlSafe: vi.fn((s) => s),
  escapeXml: vi.fn((s) => String(s)),
}));

import { get_topicCluster } from '../src/backend/http-functions.js';

function makeRequest(slug) {
  return { path: slug != null ? [slug] : [], headers: {}, query: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── URL-percent-encoded slugs ──────────────────────────────────────────
//
// validateSlug enforces ^[a-z0-9-]+$. The percent sign (%) is not in that
// set, so any percent-encoded sequence fails validation → 400 Bad Request.
// This is intentional: decoding happens at the application layer above us;
// by the time the handler runs, the slug should already be clean.

describe('get_topicCluster — URL-percent-encoded slugs', () => {
  it('returns 400 for slug with percent-encoded space (%20)', () => {
    // 'futon%20frames' contains '%' which fails validateSlug
    const result = get_topicCluster(makeRequest('futon%20frames'));
    expect(result.status).toBe(400);
  });

  it('returns 400 for slug with percent-encoded hyphen (%2D)', () => {
    // 'futon%2Dframes' decodes to 'futon-frames' but validateSlug sees '%'
    const result = get_topicCluster(makeRequest('futon%2Dframes'));
    expect(result.status).toBe(400);
  });

  it('returns 400 for slug with percent-encoded first character (%66 = f)', () => {
    // '%66uton-frames' decodes to 'futon-frames' but validateSlug rejects '%'
    const result = get_topicCluster(makeRequest('%66uton-frames'));
    expect(result.status).toBe(400);
  });

  it('returns 400 for slug with percent-encoded ampersand (%26)', () => {
    // 'covers%26guide' contains '%' → invalid
    const result = get_topicCluster(makeRequest('covers%26guide'));
    expect(result.status).toBe(400);
  });

  it('returns 400 for slug with percent-encoded forward slash (%2F)', () => {
    // 'futon%2Fframes' would decode to a path traversal attempt — must be 400
    const result = get_topicCluster(makeRequest('futon%2Fframes'));
    expect(result.status).toBe(400);
  });

  it('400 response for encoded slug has JSON body with success: false', () => {
    const result = get_topicCluster(makeRequest('futon%20frames'));
    expect(result.headers['Content-Type']).toContain('application/json');
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });
});
