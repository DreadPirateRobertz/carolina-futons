/**
 * Wishlist Share S5 — SEO page wiring (CF-muzy)
 * Tests: dynamic title, OG tags, noindex for invalid/private wishlists
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { __getTitle, __getMetaTags, __getLinks } from './__mocks__/wix-seo.js';

// ── $w mock ───────────────────────────────────────────────────────────────────

const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', label: '', data: [], html: '',
    style: { opacity: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onItemReady: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
    postMessage: vi.fn(),
  };
}
function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockResolveShareToken = vi.fn();
vi.mock('backend/wishlistShare.web.js', () => ({
  resolveShareToken: (...args) => mockResolveShareToken(...args),
}));

vi.mock('wix-location-frontend', () => ({
  default: {
    to: vi.fn(),
    query: { share: 'share-abc123' },
    baseUrl: 'https://carolinafutons.com',
  },
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn(() => Promise.resolve()),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validResult = {
  valid: true,
  ownerName: 'Alice',
  memberId: 'mem-001',
  items: [
    { _id: 'w-001', productId: 'p-001', productName: 'Eureka Frame', productImage: 'https://example.com/eureka.jpg' },
    { _id: 'w-002', productId: 'p-002', productName: 'Dillon Frame', productImage: 'https://example.com/dillon.jpg' },
  ],
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Wishlist Share S5 — SEO wiring', () => {
  beforeAll(async () => {
    await import('../src/pages/Wishlist Share.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    mockResolveShareToken.mockResolvedValue(validResult);
  });

  // ── Valid wishlist: dynamic SEO ───────────────────────────────────────────

  it('sets page title with owner name on valid wishlist', async () => {
    await onReadyHandler();
    expect(__getTitle()).toContain('Alice');
  });

  it('page title includes Carolina Futons brand', async () => {
    await onReadyHandler();
    expect(__getTitle()).toContain('Carolina Futons');
  });

  it('sets og:title meta tag', async () => {
    await onReadyHandler();
    const ogTitle = __getMetaTags().find(t => t.property === 'og:title');
    expect(ogTitle).toBeTruthy();
    expect(ogTitle.content).toContain('Alice');
  });

  it('sets og:description meta tag', async () => {
    await onReadyHandler();
    const ogDesc = __getMetaTags().find(t => t.property === 'og:description');
    expect(ogDesc).toBeTruthy();
    expect(ogDesc.content.length).toBeGreaterThan(0);
  });

  it('og:description mentions owner name and item count', async () => {
    await onReadyHandler();
    const ogDesc = __getMetaTags().find(t => t.property === 'og:description');
    expect(ogDesc.content).toContain('Alice');
    expect(ogDesc.content).toContain('2');
  });

  it('sets og:image to first product image', async () => {
    await onReadyHandler();
    const ogImage = __getMetaTags().find(t => t.property === 'og:image');
    expect(ogImage).toBeTruthy();
    expect(ogImage.content).toBe('https://example.com/eureka.jpg');
  });

  it('does NOT add noindex for valid public wishlist', async () => {
    await onReadyHandler();
    const robots = __getMetaTags().find(t => t.name === 'robots');
    // Either no robots tag at all, or one that does not say noindex
    if (robots) {
      expect(robots.content).not.toContain('noindex');
    } else {
      expect(robots).toBeUndefined();
    }
  });

  // ── Invalid wishlist: noindex ─────────────────────────────────────────────

  it('adds noindex when token is not found', async () => {
    mockResolveShareToken.mockResolvedValue({ valid: false, reason: 'not_found' });
    await onReadyHandler();
    const robots = __getMetaTags().find(t => t.name === 'robots');
    expect(robots?.content).toContain('noindex');
  });

  it('adds noindex when token is expired', async () => {
    mockResolveShareToken.mockResolvedValue({ valid: false, reason: 'expired' });
    await onReadyHandler();
    const robots = __getMetaTags().find(t => t.name === 'robots');
    expect(robots?.content).toContain('noindex');
  });

  it('adds noindex when no share token in URL', async () => {
    const { default: wixLoc } = await import('wix-location-frontend');
    wixLoc.query = {};
    mockResolveShareToken.mockResolvedValue({ valid: false, reason: 'missing_token' });
    await onReadyHandler();
    const robots = __getMetaTags().find(t => t.name === 'robots');
    expect(robots?.content).toContain('noindex');
    wixLoc.query = { share: 'share-abc123' };
  });

  it('adds noindex on fetch error', async () => {
    mockResolveShareToken.mockRejectedValue(new Error('Network error'));
    await onReadyHandler();
    const robots = __getMetaTags().find(t => t.name === 'robots');
    expect(robots?.content).toContain('noindex');
  });

  it('sets generic title for invalid wishlist', async () => {
    mockResolveShareToken.mockResolvedValue({ valid: false, reason: 'not_found' });
    await onReadyHandler();
    const title = __getTitle();
    expect(title).toContain('Carolina Futons');
    expect(title.length).toBeGreaterThan(0);
  });

  // ── Empty valid wishlist ─────────────────────────────────────────────────

  it('sets SEO for valid wishlist with no items (no og:image)', async () => {
    mockResolveShareToken.mockResolvedValue({
      valid: true, ownerName: 'Bob', memberId: 'mem-002', items: [],
    });
    await onReadyHandler();
    expect(__getTitle()).toContain('Bob');
    const ogImage = __getMetaTags().find(t => t.property === 'og:image');
    expect(ogImage).toBeFalsy();
  });
});
