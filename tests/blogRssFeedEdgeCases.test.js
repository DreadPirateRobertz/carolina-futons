/**
 * Edge case tests for get_blogRssFeed in http-functions.js.
 * Isolated from httpFunctions.test.js so vi.mock can control getAllBlogPosts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wix-http-functions to capture response shape ──────────────────
vi.mock('wix-http-functions', () => ({
  ok: vi.fn((opts) => ({ status: 200, ...opts })),
  serverError: vi.fn((opts) => ({ status: 500, ...opts })),
  forbidden: vi.fn((opts) => ({ status: 403, ...opts })),
  badRequest: vi.fn((opts) => ({ status: 400, ...opts })),
}));

// ── Control getAllBlogPosts per-test ───────────────────────────────────
const mockGetAllBlogPosts = vi.fn(() => [
  { title: 'Post A', slug: 'post-a', excerpt: 'Exc', publishDate: '2026-01-01' },
]);
vi.mock('backend/blogContent', () => ({
  getAllBlogPosts: () => mockGetAllBlogPosts(),
}));

// Mock all other http-functions dependencies to avoid side effects
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
vi.mock('backend/seoHelpers.web', () => ({
  getSitemapData: vi.fn(() => Promise.resolve([])),
  buildSitemapXml: vi.fn(() => ''),
  getRobotsTxtContent: vi.fn(() => ''),
}));
vi.mock('wix-data', () => ({
  default: { query: vi.fn(() => ({ find: vi.fn(() => Promise.resolve({ items: [], totalCount: 0 })) })) },
}));
vi.mock('public/sharedTokens', () => ({ colors: {} }));
vi.mock('backend/utils/sanitize', () => ({ sanitize: vi.fn((s) => s), validateEmail: vi.fn(() => true) }));
vi.mock('backend/facebookCatalog.web', () => ({
  getEnhancedCatalogFields: vi.fn(), exportCustomerAudienceData: vi.fn(),
}));
vi.mock('backend/utils/httpHelpers', () => ({
  timingSafeEqual: vi.fn(() => true),
  decodeHtmlEntities: vi.fn((s) => s),
  stripHtmlSafe: vi.fn((s) => s),
  escapeXml: vi.fn((s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')),
}));

import { get_blogRssFeed } from '../src/backend/http-functions.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllBlogPosts.mockReturnValue([
    { title: 'Post A', slug: 'post-a', excerpt: 'Exc', publishDate: '2026-01-01' },
  ]);
});

// ── RSS edge cases ─────────────────────────────────────────────────────

describe('get_blogRssFeed — empty/null posts', () => {
  it('returns 200 with valid RSS structure when getAllBlogPosts returns empty array', () => {
    mockGetAllBlogPosts.mockReturnValue([]);
    const result = get_blogRssFeed();
    expect(result.status).toBe(200);
    expect(result.body).toContain('<rss version="2.0"');
    expect(result.body).toContain('<channel>');
    expect(result.body).toContain('</channel>');
    expect(result.body).toContain('</rss>');
  });

  it('returns empty feed (no <item>) when posts array is empty', () => {
    mockGetAllBlogPosts.mockReturnValue([]);
    const result = get_blogRssFeed();
    expect(result.body).not.toContain('<item>');
  });

  it('returns 200 with valid RSS structure when getAllBlogPosts returns null', () => {
    mockGetAllBlogPosts.mockReturnValue(null);
    const result = get_blogRssFeed();
    expect(result.status).toBe(200);
    expect(result.body).toContain('<rss version="2.0"');
    expect(result.body).not.toContain('<item>');
  });
});

describe('get_blogRssFeed — error path', () => {
  it('returns 500 when getAllBlogPosts throws', () => {
    mockGetAllBlogPosts.mockImplementation(() => { throw new Error('blogContent failed'); });
    const result = get_blogRssFeed();
    expect(result.status).toBe(500);
  });

  it('returns text/plain content type on error', () => {
    mockGetAllBlogPosts.mockImplementation(() => { throw new Error('boom'); });
    const result = get_blogRssFeed();
    expect(result.headers['Content-Type']).toContain('text/plain');
  });
});

describe('get_blogRssFeed — slug URI encoding', () => {
  it('URI-encodes slugs with special characters in post URLs', () => {
    mockGetAllBlogPosts.mockReturnValue([
      { title: 'A & B', slug: 'a & b', excerpt: 'x', publishDate: '2026-01-01' },
    ]);
    const result = get_blogRssFeed();
    expect(result.body).toContain(encodeURIComponent('a & b'));
  });
});
