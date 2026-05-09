/**
 * Tests for GET /_functions/topicCluster/{slug} in http-functions.js
 *
 * The endpoint reads the slug from request.path[0], looks up the static
 * CLUSTERS map, and returns JSON. It cannot call topicClusters.web.js
 * (webMethod restriction) so logic is inlined from the shared data module.
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

// ── Mock unused http-functions dependencies ───────────────────────────
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
import { ok } from 'wix-http-functions';

/** Build a minimal Wix-style request object with a path segment */
function makeRequest(slug) {
  return { path: slug != null ? [slug] : [], headers: {}, query: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Happy path ─────────────────────────────────────────────────────────

describe('get_topicCluster — known slugs', () => {
  it('returns status 200 for a valid cluster slug', () => {
    const result = get_topicCluster(makeRequest('futon-frames'));
    expect(result.status).toBe(200);
  });

  it('returns application/json content type', () => {
    const result = get_topicCluster(makeRequest('futon-frames'));
    expect(result.headers['Content-Type']).toContain('application/json');
  });

  it('body is valid JSON with success: true', () => {
    const result = get_topicCluster(makeRequest('futon-frames'));
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });

  it('cluster has pillarSlug, pillarTitle, topic, keywords, spokePages, spokeCount', () => {
    const result = get_topicCluster(makeRequest('futon-frames'));
    const { cluster } = JSON.parse(result.body);
    expect(cluster.pillarSlug).toBe('futon-frames');
    expect(cluster.pillarTitle).toBe('The Complete Futon Frame Buying Guide');
    expect(cluster.topic).toBe('futon frames');
    expect(Array.isArray(cluster.keywords)).toBe(true);
    expect(Array.isArray(cluster.spokePages)).toBe(true);
    expect(cluster.spokeCount).toBe(cluster.spokePages.length);
  });

  it('pillarUrl points to /buying-guides/{slug}', () => {
    const result = get_topicCluster(makeRequest('futon-frames'));
    const { cluster } = JSON.parse(result.body);
    expect(cluster.pillarUrl).toBe('https://www.carolinafutons.com/buying-guides/futon-frames');
  });

  it('each spokePage has slug, title, type, and url', () => {
    const result = get_topicCluster(makeRequest('futon-frames'));
    const { cluster } = JSON.parse(result.body);
    for (const spoke of cluster.spokePages) {
      expect(spoke.slug).toBeTruthy();
      expect(spoke.title).toBeTruthy();
      expect(spoke.type).toBeTruthy();
      expect(spoke.url).toContain('/buying-guides/');
    }
  });

  it('has Cache-Control header', () => {
    const result = get_topicCluster(makeRequest('futon-frames'));
    expect(result.headers['Cache-Control']).toContain('max-age=3600');
  });

  it('works for all 8 defined cluster slugs', () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const result = get_topicCluster(makeRequest(slug));
      expect(result.status).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.cluster.pillarSlug).toBe(slug);
    }
  });
});

// ── 404 — unknown slug ─────────────────────────────────────────────────

describe('get_topicCluster — unknown slug', () => {
  it('returns status 404 for an unknown slug', () => {
    const result = get_topicCluster(makeRequest('not-a-real-cluster'));
    expect(result.status).toBe(404);
  });

  it('body has success: false and cluster: null', () => {
    const result = get_topicCluster(makeRequest('not-a-real-cluster'));
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.cluster).toBeNull();
  });
});

// ── 400 — missing slug ─────────────────────────────────────────────────

describe('get_topicCluster — missing slug', () => {
  it('returns status 400 when path is empty', () => {
    const result = get_topicCluster({ path: [], headers: {}, query: {} });
    expect(result.status).toBe(400);
  });

  it('returns status 400 when request is null', () => {
    const result = get_topicCluster(null);
    expect(result.status).toBe(400);
  });

  it('returns status 400 when slug is empty string', () => {
    const result = get_topicCluster(makeRequest(''));
    expect(result.status).toBe(400);
  });
});

// ── Response format ────────────────────────────────────────────────────

describe('get_topicCluster — response format', () => {
  it('returns JSON for 404 responses too', () => {
    const result = get_topicCluster(makeRequest('unknown'));
    expect(result.headers['Content-Type']).toContain('application/json');
    expect(() => JSON.parse(result.body)).not.toThrow();
  });

  it('returns JSON for 400 responses', () => {
    const result = get_topicCluster({ path: [], headers: {}, query: {} });
    expect(result.headers['Content-Type']).toContain('application/json');
    expect(() => JSON.parse(result.body)).not.toThrow();
  });

  it('mattresses cluster has 4 spoke pages', () => {
    const result = get_topicCluster(makeRequest('mattresses'));
    const { cluster } = JSON.parse(result.body);
    expect(cluster.spokeCount).toBe(4);
    expect(cluster.spokePages).toHaveLength(4);
  });

  it('spokeCount matches spokePages.length for all 8 clusters', () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const { cluster } = JSON.parse(get_topicCluster(makeRequest(slug)).body);
      expect(cluster.spokeCount).toBe(cluster.spokePages.length);
    }
  });

  it('top-level slug matches requested slug', () => {
    const body = JSON.parse(get_topicCluster(makeRequest('futon-frames')).body);
    expect(body.slug).toBe('futon-frames');
  });

  it('top-level topic matches cluster topic', () => {
    const body = JSON.parse(get_topicCluster(makeRequest('futon-frames')).body);
    expect(body.topic).toBe('futon frames');
  });

  it('top-level pillarContent is a non-empty string', () => {
    const body = JSON.parse(get_topicCluster(makeRequest('futon-frames')).body);
    expect(typeof body.pillarContent).toBe('string');
    expect(body.pillarContent.length).toBeGreaterThan(0);
  });

  it('top-level internalLinks is an array', () => {
    const body = JSON.parse(get_topicCluster(makeRequest('futon-frames')).body);
    expect(Array.isArray(body.internalLinks)).toBe(true);
    expect(body.internalLinks.length).toBeGreaterThan(0);
  });

  it('each internalLink has anchor, url, targetSlug', () => {
    const body = JSON.parse(get_topicCluster(makeRequest('futon-frames')).body);
    for (const link of body.internalLinks) {
      expect(typeof link.anchor).toBe('string');
      expect(link.url).toContain('/guides/');
      expect(typeof link.targetSlug).toBe('string');
    }
  });

  it('top-level spokePages is an array matching cluster.spokePages', () => {
    const body = JSON.parse(get_topicCluster(makeRequest('futon-frames')).body);
    expect(Array.isArray(body.spokePages)).toBe(true);
    expect(body.spokePages.length).toBe(body.cluster.spokePages.length);
  });

  it('all 8 clusters have pillarContent and internalLinks at top level', () => {
    const slugs = ['futon-frames', 'mattresses', 'covers', 'pillows', 'storage', 'outdoor', 'accessories', 'bundle-deals'];
    for (const slug of slugs) {
      const body = JSON.parse(get_topicCluster(makeRequest(slug)).body);
      expect(body.slug).toBe(slug);
      expect(typeof body.pillarContent).toBe('string');
      expect(Array.isArray(body.internalLinks)).toBe(true);
    }
  });
});

// ── Security / injection ────────────────────────────────────────────────
// validateSlug enforces ^[a-z0-9-]+$ — invalid chars → empty string → 400.
// Uppercase is normalized to lowercase, so mixed-case known slugs still match.

describe('get_topicCluster — slug injection', () => {
  it('returns 400 for path-traversal slug (invalid chars fail validateSlug)', () => {
    const result = get_topicCluster(makeRequest('../etc/passwd'));
    expect(result.status).toBe(400);
  });

  it('returns 400 for HTML-injected slug (invalid chars fail validateSlug)', () => {
    const result = get_topicCluster(makeRequest('<script>alert(1)</script>'));
    expect(result.status).toBe(400);
  });

  it('returns 200 for uppercase slug (validateSlug normalizes to lowercase)', () => {
    expect(get_topicCluster(makeRequest('Futon-Frames')).status).toBe(200);
  });

  it('returns 400 for slug with only whitespace', () => {
    expect(get_topicCluster(makeRequest('   ')).status).toBe(400);
  });

  it('returns 400 for slug with embedded space (invalid chars fail validateSlug)', () => {
    expect(get_topicCluster(makeRequest('hello world')).status).toBe(400);
  });

  it('returns 400 for slug with dot-dot traversal variant (invalid chars fail validateSlug)', () => {
    expect(get_topicCluster(makeRequest('../admin')).status).toBe(400);
  });
});

// ── 500 error path ──────────────────────────────────────────────────────

describe('get_topicCluster — server error', () => {
  it('returns status 500 when ok() throws unexpectedly', () => {
    ok.mockImplementationOnce(() => { throw new Error('forced'); });
    const result = get_topicCluster(makeRequest('futon-frames'));
    expect(result.status).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
  });
});
