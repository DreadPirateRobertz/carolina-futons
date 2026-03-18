import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement(id = '') {
  const el = {
    id,
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    href: '',
    style: {},
    accessibility: {},
    _hidden: false,
    _collapsed: false,
    _disabled: false,
    _onClickFn: null,
    _onItemReadyFn: null,
    _data: [],
    show: vi.fn(function () { this._hidden = false; return Promise.resolve(); }),
    hide: vi.fn(function () { this._hidden = true; return Promise.resolve(); }),
    expand: vi.fn(function () { this._collapsed = false; return Promise.resolve(); }),
    collapse: vi.fn(function () { this._collapsed = true; return Promise.resolve(); }),
    enable: vi.fn(function () { this._disabled = false; }),
    disable: vi.fn(function () { this._disabled = true; }),
    onClick: vi.fn(function (fn) { this._onClickFn = fn; }),
    onItemReady: vi.fn(function (fn) { this._onItemReadyFn = fn; }),
    get data() { return this._data; },
    set data(v) {
      this._data = v;
      if (this._onItemReadyFn) {
        v.forEach(item => this._onItemReadyFn(createItemScope(), item));
      }
    },
  };
  return el;
}

function createItemScope() {
  const itemEls = new Map();
  return function $item(sel) {
    if (!itemEls.has(sel)) itemEls.set(sel, createMockElement(sel));
    return itemEls.get(sel);
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement(sel));
  return elements.get(sel);
}

const $w = vi.fn((sel) => getEl(sel));

// ── Module Mocks ──────────────────────────────────────────────────

let mockWishlistResult = { items: [] };
let mockMemberName = null;
let mockPath = ['wishlist', 'test-token-123'];

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve(mockWishlistResult)),
    })),
  },
}));

vi.mock('wix-location-frontend', () => ({
  default: {
    get path() { return mockPath; },
    get baseUrl() { return 'https://www.carolinafutons.com'; },
  },
}));

vi.mock('wix-seo-frontend', () => ({
  default: {
    setTitle: vi.fn(),
    setMetaTags: vi.fn(),
    setLinks: vi.fn(),
  },
}));

vi.mock('wix-window-frontend', () => ({
  default: {
    trackEvent: vi.fn(),
    openUrl: vi.fn(),
  },
}));

vi.mock('public/designTokens.js', () => ({
  colors: { sunsetCoral: '#E8845C', espresso: '#3A2518', success: '#4CAF50' },
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn(() => Promise.resolve({ success: true })),
  openCartPanel: vi.fn(),
}));

// Cart mock — Wix Stores frontend
vi.mock('wix-stores-frontend', () => ({
  cart: {
    addToCart: vi.fn(() => Promise.resolve()),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────

function makeWishlistItem(overrides = {}) {
  return {
    _id: 'item-1',
    productId: 'prod-abc',
    name: 'Sunset Futon Frame',
    slug: 'sunset-futon-frame',
    mainMedia: 'https://example.com/img.jpg',
    price: 499.99,
    formattedPrice: '$499.99',
    comparePrice: null,
    ribbon: null,
    inStock: true,
    callForPrice: false,
    ...overrides,
  };
}

function makeWishlistRecord(overrides = {}) {
  return {
    _id: 'wl-1',
    shareToken: 'test-token-123',
    isPublic: true,
    memberName: 'Jane',
    memberAvatar: null,
    items: [makeWishlistItem()],
    ...overrides,
  };
}

// ── Test Isolation ─────────────────────────────────────────────────

let pageModule;

beforeEach(async () => {
  elements.clear();
  $w.mockClear();
  mockWishlistResult = { items: [] };
  mockMemberName = null;
  mockPath = ['wishlist', 'test-token-123'];
  vi.resetModules();
  pageModule = await import('../../src/public/sharedWishlistHelpers.js');
});

afterEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════
// S2 — Wishlist Rendering
// ══════════════════════════════════════════════════════════════════

describe('S2 — Wishlist Rendering', () => {
  describe('renderWishlist(wishlist, $w)', () => {
    it('sets sharedWishTitle to "[Name]\'s Wishlist"', async () => {
      const { renderWishlist } = pageModule;
      const wishlist = makeWishlistRecord({ memberName: 'Jane' });
      await renderWishlist(wishlist, $w);
      expect($w('#sharedWishTitle').text).toBe("Jane's Wishlist");
    });

    it('falls back to "A Curated Wishlist" when memberName is absent', async () => {
      const { renderWishlist } = pageModule;
      const wishlist = makeWishlistRecord({ memberName: null });
      await renderWishlist(wishlist, $w);
      expect($w('#sharedWishTitle').text).toBe('A Curated Wishlist');
    });

    it('falls back to "A Curated Wishlist" when memberName is empty string', async () => {
      const { renderWishlist } = pageModule;
      const wishlist = makeWishlistRecord({ memberName: '' });
      await renderWishlist(wishlist, $w);
      expect($w('#sharedWishTitle').text).toBe('A Curated Wishlist');
    });

    it('sets sharedWishSubtitle to "X items" (plural)', async () => {
      const { renderWishlist } = pageModule;
      const wishlist = makeWishlistRecord({
        items: [makeWishlistItem(), makeWishlistItem({ _id: 'item-2' })],
      });
      await renderWishlist(wishlist, $w);
      expect($w('#sharedWishSubtitle').text).toBe('2 items');
    });

    it('sets sharedWishSubtitle to "1 item" (singular)', async () => {
      const { renderWishlist } = pageModule;
      const wishlist = makeWishlistRecord({ items: [makeWishlistItem()] });
      await renderWishlist(wishlist, $w);
      expect($w('#sharedWishSubtitle').text).toBe('1 item');
    });

    it('sets sharedWishSubtitle to "0 items" when empty', async () => {
      const { renderWishlist } = pageModule;
      const wishlist = makeWishlistRecord({ items: [] });
      await renderWishlist(wishlist, $w);
      expect($w('#sharedWishSubtitle').text).toBe('0 items');
    });

    it('sets repeater data from wishlist items', async () => {
      const { renderWishlist } = pageModule;
      const item1 = makeWishlistItem({ _id: 'item-1', name: 'Futon A' });
      const item2 = makeWishlistItem({ _id: 'item-2', name: 'Futon B' });
      const wishlist = makeWishlistRecord({ items: [item1, item2] });
      await renderWishlist(wishlist, $w);
      expect($w('#sharedWishRepeater').data).toHaveLength(2);
    });

    it('shows sharedWishEmpty and hides repeater when 0 items', async () => {
      const { renderWishlist } = pageModule;
      const wishlist = makeWishlistRecord({ items: [] });
      await renderWishlist(wishlist, $w);
      expect($w('#sharedWishEmpty').show).toHaveBeenCalled();
      expect($w('#sharedWishSection').hide).toHaveBeenCalled();
    });

    it('shows repeater section and hides empty when items exist', async () => {
      const { renderWishlist } = pageModule;
      const wishlist = makeWishlistRecord({ items: [makeWishlistItem()] });
      await renderWishlist(wishlist, $w);
      expect($w('#sharedWishSection').show).toHaveBeenCalled();
      expect($w('#sharedWishEmpty').hide).toHaveBeenCalled();
    });
  });

  describe('populateCard($item, itemData) — repeater item rendering', () => {
    it('sets image src and alt on sharedWishImage', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ name: 'Espresso Frame', mainMedia: 'https://example.com/img.jpg' });
      populateCard($item, item);
      expect($item('#sharedWishImage').src).toBe('https://example.com/img.jpg');
      expect($item('#sharedWishImage').alt).toMatch(/Espresso Frame/);
    });

    it('sets product name text on sharedWishName', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ name: 'Walnut Futon' });
      populateCard($item, item);
      expect($item('#sharedWishName').text).toBe('Walnut Futon');
    });

    it('sets formatted price on sharedWishPrice', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ formattedPrice: '$349.99' });
      populateCard($item, item);
      expect($item('#sharedWishPrice').text).toBe('$349.99');
    });

    it('hides sharedWishOrigPrice when not on sale', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ comparePrice: null });
      populateCard($item, item);
      expect($item('#sharedWishOrigPrice').hide).toHaveBeenCalled();
    });

    it('shows sharedWishOrigPrice when comparePrice > price', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ price: 299.99, comparePrice: 399.99 });
      populateCard($item, item);
      expect($item('#sharedWishOrigPrice').show).toHaveBeenCalled();
      expect($item('#sharedWishOrigPrice').text).toMatch(/399\.99/);
    });

    it('does not show origPrice when comparePrice equals price', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ price: 299.99, comparePrice: 299.99 });
      populateCard($item, item);
      expect($item('#sharedWishOrigPrice').hide).toHaveBeenCalled();
    });

    it('hides sharedWishBadge when ribbon is absent', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ ribbon: null });
      populateCard($item, item);
      expect($item('#sharedWishBadge').hide).toHaveBeenCalled();
    });

    it('shows sharedWishBadge with ribbon text when present', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ ribbon: 'Sale' });
      populateCard($item, item);
      expect($item('#sharedWishBadge').show).toHaveBeenCalled();
      expect($item('#sharedWishBadge').text).toBe('Sale');
    });

    it('wires image onClick to navigate to product page', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ slug: 'sunset-futon' });
      populateCard($item, item);
      expect($item('#sharedWishImage').onClick).toHaveBeenCalled();
    });

    it('wires name onClick to navigate to product page', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ slug: 'sunset-futon' });
      populateCard($item, item);
      expect($item('#sharedWishName').onClick).toHaveBeenCalled();
    });

    it('wires sharedWishViewBtn onClick to product page', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ slug: 'sunset-futon' });
      populateCard($item, item);
      expect($item('#sharedWishViewBtn').onClick).toHaveBeenCalled();
    });
  });

  describe('Add to Cart from shared view', () => {
    it('sets button label to "Add to Cart" initially', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ callForPrice: false });
      populateCard($item, item);
      expect($item('#sharedWishAddCart').label).toBe('Add to Cart');
    });

    it('disables and sets "Call for Pricing" for callForPrice items', () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ callForPrice: true });
      populateCard($item, item);
      expect($item('#sharedWishAddCart').label).toBe('Call for Pricing');
      expect($item('#sharedWishAddCart').disable).toHaveBeenCalled();
    });

    it('cycles button label through Adding... → Added! on successful add', async () => {
      const { populateCard } = pageModule;
      const $item = createItemScope();
      const item = makeWishlistItem({ productId: 'prod-xyz' });
      populateCard($item, item);

      const clickFn = $item('#sharedWishAddCart')._onClickFn;
      expect(clickFn).toBeTruthy();

      await clickFn();

      expect($item('#sharedWishAddCart').label).toBe('Added!');
    });
  });

  // ── S1 interface stub ──────────────────────────────────────────
  describe('fetchWishlistByToken(token) — S1 interface (stubbed)', () => {
    it('exports fetchWishlistByToken function', () => {
      expect(typeof pageModule.fetchWishlistByToken).toBe('function');
    });

    it('returns { status: "not_found" } when no record matches token', async () => {
      mockWishlistResult = { items: [] };
      const { fetchWishlistByToken } = pageModule;
      const result = await fetchWishlistByToken('bad-token');
      expect(result.status).toBe('not_found');
    });

    it('returns { status: "private" } when isPublic is false', async () => {
      mockWishlistResult = { items: [{ ...makeWishlistRecord(), isPublic: false }] };
      const { fetchWishlistByToken } = pageModule;
      const result = await fetchWishlistByToken('test-token-123');
      expect(result.status).toBe('private');
    });

    it('returns { status: "ok", wishlist } when found and public', async () => {
      mockWishlistResult = { items: [makeWishlistRecord()] };
      const { fetchWishlistByToken } = pageModule;
      const result = await fetchWishlistByToken('test-token-123');
      expect(result.status).toBe('ok');
      expect(result.wishlist).toBeDefined();
      expect(result.wishlist.shareToken).toBe('test-token-123');
    });
  });

  // ── State management ─────────────────────────────────────────────
  describe('showState($w, state)', () => {
    it('exports showState function', () => {
      expect(typeof pageModule.showState).toBe('function');
    });

    it('collapses all state sections and shows not_found', async () => {
      const { showState } = pageModule;
      await showState($w, 'not_found');
      expect($w('#sharedWishNotFound').show).toHaveBeenCalled();
      expect($w('#sharedWishPrivate').hide).toHaveBeenCalled();
      expect($w('#sharedWishEmpty').hide).toHaveBeenCalled();
    });

    it('collapses all state sections and shows private', async () => {
      const { showState } = pageModule;
      await showState($w, 'private');
      expect($w('#sharedWishPrivate').show).toHaveBeenCalled();
      expect($w('#sharedWishNotFound').hide).toHaveBeenCalled();
      expect($w('#sharedWishEmpty').hide).toHaveBeenCalled();
    });
  });

  describe('itemCount(items)', () => {
    it('exports itemCount helper', () => {
      expect(typeof pageModule.itemCount).toBe('function');
    });

    it('returns "0 items" for empty array', () => {
      expect(pageModule.itemCount([])).toBe('0 items');
    });

    it('returns "1 item" for single item', () => {
      expect(pageModule.itemCount([makeWishlistItem()])).toBe('1 item');
    });

    it('returns "5 items" for five items', () => {
      const items = Array.from({ length: 5 }, (_, i) => makeWishlistItem({ _id: `item-${i}` }));
      expect(pageModule.itemCount(items)).toBe('5 items');
    });
  });

  describe('ownerName(wishlist)', () => {
    it('exports ownerName helper', () => {
      expect(typeof pageModule.ownerName).toBe('function');
    });

    it('returns "Jane\'s Wishlist" when memberName is Jane', () => {
      expect(pageModule.ownerName({ memberName: 'Jane' })).toBe("Jane's Wishlist");
    });

    it('returns "A Curated Wishlist" when memberName is null', () => {
      expect(pageModule.ownerName({ memberName: null })).toBe('A Curated Wishlist');
    });

    it('returns "A Curated Wishlist" when memberName is empty', () => {
      expect(pageModule.ownerName({ memberName: '' })).toBe('A Curated Wishlist');
    });

    it("handles name ending in 's' with 's' suffix (Jane's → Jane's)", () => {
      expect(pageModule.ownerName({ memberName: "James" })).toBe("James's Wishlist");
    });
  });
});
