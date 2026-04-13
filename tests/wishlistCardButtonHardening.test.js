import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initCardWishlistButton,
  batchCheckWishlistStatus,
} from '../src/public/WishlistCardButton.js';

// ── Mock wix-members-frontend ──────────────────────────────────────
let mockMember = { _id: 'member-123' };
let mockAuthentication = { promptLogin: vi.fn() };

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(mockMember)),
  },
  authentication: mockAuthentication,
}));

// ── Mock wix-data ──────────────────────────────────────────────────
const mockWixData = {
  query: vi.fn(),
  insert: vi.fn().mockResolvedValue({}),
  remove: vi.fn().mockResolvedValue({}),
};

function createQueryBuilder(items = []) {
  const qb = {
    eq: vi.fn().mockReturnThis(),
    hasSome: vi.fn().mockReturnThis(),
    find: vi.fn().mockResolvedValue({ items }),
  };
  return qb;
}

vi.mock('wix-data', () => ({
  default: mockWixData,
}));

// ── Mock engagement tracker ────────────────────────────────────────
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireAddToWishlist: vi.fn(),
}));

import { trackEvent } from 'public/engagementTracker';

// ── Helpers ────────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '',
    src: '',
    value: '',
    label: '',
    style: { color: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    accessibility: {},
    ...overrides,
  };
}

function createCard$item() {
  const els = new Map();
  const $item = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $item._els = els;
  return $item;
}

let cardElements;

beforeEach(() => {
  cardElements = createCard$item();
  vi.clearAllMocks();
  mockMember = { _id: 'member-123' };
  mockWixData.query.mockReturnValue(createQueryBuilder([]));
  mockWixData.insert.mockResolvedValue({});
  mockWixData.remove.mockResolvedValue({});
});

const product = {
  _id: 'prod-1',
  name: 'Eureka Futon Frame',
  mainMedia: 'https://example.com/eureka.jpg',
};

// ═══════════════════════════════════════════════════════════════════
// 1. DEDUP ON ADD (new behavior)
// ═══════════════════════════════════════════════════════════════════

describe('WishlistCardButton dedup on add', () => {
  it('checks for existing wishlist entry before inserting', async () => {
    // First query returns empty (dedup check), second would be for the actual add
    const qb = createQueryBuilder([]);
    mockWixData.query.mockReturnValue(qb);

    initCardWishlistButton(cardElements, product, false);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();

    // Should have queried Wishlist for dedup
    expect(mockWixData.query).toHaveBeenCalledWith('Wishlist');
  });

  it('skips insert if product already in wishlist (stale UI)', async () => {
    // Dedup query returns existing item
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { _id: 'wish-existing', productId: 'prod-1', memberId: 'member-123' },
    ]));

    initCardWishlistButton(cardElements, product, false); // UI says not wishlisted
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();

    // Should NOT insert since dedup found existing
    expect(mockWixData.insert).not.toHaveBeenCalled();
  });

  it('still updates UI to wishlisted state after dedup skip', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { _id: 'wish-existing', productId: 'prod-1', memberId: 'member-123' },
    ]));

    initCardWishlistButton(cardElements, product, false);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();

    // Heart should be filled after the operation
    const src = decodeURIComponent(cardElements('#gridWishlistIcon').src);
    expect(src).toContain('fill=');
    expect(src).not.toContain('fill="none"');
  });

  it('tracks wishlist_add event even on dedup skip', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { _id: 'wish-existing', productId: 'prod-1', memberId: 'member-123' },
    ]));

    initCardWishlistButton(cardElements, product, false);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();

    expect(trackEvent).toHaveBeenCalledWith('wishlist_add', expect.objectContaining({
      productId: 'prod-1',
    }));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. TOGGLE ROUND-TRIP (add then remove)
// ═══════════════════════════════════════════════════════════════════

describe('WishlistCardButton toggle round-trip', () => {
  it('can add then remove in sequence', async () => {
    // First click: add (dedup returns empty, insert succeeds)
    mockWixData.query.mockReturnValueOnce(createQueryBuilder([]));
    initCardWishlistButton(cardElements, product, false);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];

    await handler(); // add
    expect(mockWixData.insert).toHaveBeenCalledTimes(1);

    // Second click: remove (query returns the item)
    mockWixData.query.mockReturnValueOnce(createQueryBuilder([
      { _id: 'wish-1', productId: 'prod-1', memberId: 'member-123' },
    ]));
    await handler(); // remove
    expect(mockWixData.remove).toHaveBeenCalledWith('Wishlist', 'wish-1');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. ERROR RECOVERY
// ═══════════════════════════════════════════════════════════════════

describe('WishlistCardButton error recovery', () => {
  it('reverts heart icon on remove failure', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { _id: 'wish-1', productId: 'prod-1', memberId: 'member-123' },
    ]));
    mockWixData.remove.mockRejectedValueOnce(new Error('Remove failed'));

    initCardWishlistButton(cardElements, product, true);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();

    // Should revert to filled heart (still wishlisted)
    const src = decodeURIComponent(cardElements('#gridWishlistIcon').src);
    expect(src).toContain('fill=');
    expect(src).not.toContain('fill="none"');
  });

  it('reverts heart icon on add failure', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([]));
    mockWixData.insert.mockRejectedValueOnce(new Error('Insert failed'));

    initCardWishlistButton(cardElements, product, false);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();

    // Should revert to outline heart (not wishlisted)
    const src = decodeURIComponent(cardElements('#gridWishlistIcon').src);
    expect(src).toContain('fill="none"');
  });

  it('re-enables busy flag after error', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([]));
    mockWixData.insert.mockRejectedValueOnce(new Error('fail'));

    initCardWishlistButton(cardElements, product, false);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler(); // fails

    // Should be able to click again (busy flag reset)
    mockWixData.insert.mockResolvedValueOnce({});
    mockWixData.query.mockReturnValueOnce(createQueryBuilder([]));
    await handler(); // succeeds
    expect(mockWixData.insert).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. ANONYMOUS USER HANDLING
// ═══════════════════════════════════════════════════════════════════

describe('WishlistCardButton anonymous user', () => {
  it('prompts login and skips wishlist operations', async () => {
    mockMember = null;
    initCardWishlistButton(cardElements, product, false);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();

    expect(mockAuthentication.promptLogin).toHaveBeenCalled();
    expect(mockWixData.insert).not.toHaveBeenCalled();
    expect(mockWixData.remove).not.toHaveBeenCalled();
  });

  it('does not change heart icon for anonymous user', async () => {
    mockMember = null;
    initCardWishlistButton(cardElements, product, false);

    const srcBefore = cardElements('#gridWishlistIcon').src;
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();
    const srcAfter = cardElements('#gridWishlistIcon').src;

    expect(srcAfter).toBe(srcBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. BATCH CHECK — EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('batchCheckWishlistStatus edge cases', () => {
  it('handles query returning duplicate product IDs', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { productId: 'prod-1', memberId: 'member-123' },
      { productId: 'prod-1', memberId: 'member-123' }, // duplicate
    ]));

    const result = await batchCheckWishlistStatus(['prod-1']);
    expect(result.size).toBe(1); // Set deduplicates
    expect(result.has('prod-1')).toBe(true);
  });

  it('handles large product ID array', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `prod-${i}`);
    mockWixData.query.mockReturnValue(createQueryBuilder([]));

    const result = await batchCheckWishlistStatus(ids);
    expect(result instanceof Set).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. ARIA & ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════════

describe('WishlistCardButton accessibility', () => {
  it('updates ARIA label after adding to wishlist', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([]));
    initCardWishlistButton(cardElements, product, false);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();

    expect(cardElements('#gridWishlistBtn').accessibility.ariaLabel).toContain('Remove');
    expect(cardElements('#gridWishlistBtn').accessibility.ariaLabel).toContain('Eureka Futon Frame');
  });

  it('updates ARIA label after removing from wishlist', async () => {
    mockWixData.query.mockReturnValue(createQueryBuilder([
      { _id: 'wish-1', productId: 'prod-1', memberId: 'member-123' },
    ]));
    initCardWishlistButton(cardElements, product, true);
    const handler = cardElements('#gridWishlistBtn').onClick.mock.calls[0][0];
    await handler();

    expect(cardElements('#gridWishlistBtn').accessibility.ariaLabel).toContain('Add');
  });

  it('handles product with empty name in ARIA label', () => {
    const noNameProduct = { _id: 'prod-1', name: '', mainMedia: '' };
    initCardWishlistButton(cardElements, noNameProduct, false);
    expect(cardElements('#gridWishlistBtn').accessibility.ariaLabel).toContain('Add');
  });

  it('handles product with undefined name gracefully', () => {
    const undefinedNameProduct = { _id: 'prod-1', mainMedia: '' };
    // Should not throw
    expect(() => initCardWishlistButton(cardElements, undefinedNameProduct, false)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. NULL/UNDEFINED PRODUCT GUARDS
// ═══════════════════════════════════════════════════════════════════

describe('WishlistCardButton null guards', () => {
  it('handles null product without throwing', () => {
    expect(() => initCardWishlistButton(cardElements, null, false)).not.toThrow();
  });

  it('handles undefined product without throwing', () => {
    expect(() => initCardWishlistButton(cardElements, undefined, false)).not.toThrow();
  });

  it('does not register onClick for null product', () => {
    initCardWishlistButton(cardElements, null, false);
    expect(cardElements('#gridWishlistBtn').onClick).not.toHaveBeenCalled();
  });
});
