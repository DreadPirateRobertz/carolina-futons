/**
 * Tests for Shared Wishlist page (src/pages/Shared Wishlist.js)
 * Covers: S1 token resolution, S2 rendering, S3 add-to-cart, S5 SEO
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __setQuery } from 'wix-location-frontend';

// ── $w mock (must be set up before dynamic page import) ───────────────

const elements = new Map();

function createEl(id) {
  return {
    id,
    text: '',
    src: '',
    label: '',
    _expanded: true,
    data: [],
    _itemReadyCb: null,
    _clickHandler: null,
    style: {},
    accessibility: { ariaLabel: '' },
    show:     vi.fn(function () { return Promise.resolve(); }),
    hide:     vi.fn(function () { return Promise.resolve(); }),
    expand:   vi.fn(function () { this._expanded = true;  return Promise.resolve(); }),
    collapse: vi.fn(function () { this._expanded = false; return Promise.resolve(); }),
    enable:   vi.fn(),
    disable:  vi.fn(),
    onClick:  vi.fn(function (fn) { this._clickHandler = fn; }),
    onItemReady: vi.fn(function (cb) { this._itemReadyCb = cb; }),
  };
}

function getEl(sel) {
  const key = sel.replace(/^#/, '');
  if (!elements.has(key)) elements.set(key, createEl(key));
  return elements.get(key);
}

let onReadyHandler = null;
globalThis.$w = Object.assign((sel) => getEl(sel), {
  onReady: (fn) => { onReadyHandler = fn; },
});

// ── Mocks ─────────────────────────────────────────────────────────────

const mockResolveShareToken = vi.fn();

vi.mock('backend/wishlistShare.web', () => ({
  resolveShareToken: (...args) => mockResolveShareToken(...args),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  setupAccessibleDialog: vi.fn(() => ({ open: vi.fn(), close: vi.fn() })),
}));

const mockAddToCart = vi.fn(async () => ({ cart: { lineItems: [{}] } }));

vi.mock('wix-stores-frontend', () => ({
  default: { cart: { addToCart: (...a) => mockAddToCart(...a) } },
  cart:    { addToCart: (...a) => mockAddToCart(...a) },
}));

// ── Dynamic import of page module (so $w is defined when it loads) ────

const mod = await import('../src/pages/Shared Wishlist.js');
const { _resolveAndRender } = mod;

// ── Test helpers ──────────────────────────────────────────────────────

function makeItem(overrides = {}) {
  return {
    _id: 'p1',
    productId: 'prod-1',
    productName: 'Sofa Bed',
    productImage: 'https://img.jpg',
    price: 599,
    slug: 'sofa-bed',
    ...overrides,
  };
}

beforeEach(() => {
  elements.clear();
  mockResolveShareToken.mockReset();
  mockAddToCart.mockReset();
  mockAddToCart.mockResolvedValue({ cart: { lineItems: [{}] } });
  __setQuery({});
});

// ── S1: Token resolution ──────────────────────────────────────────────

describe('_resolveAndRender — token resolution', () => {
  it('shows error state when no ?share param in URL', async () => {
    __setQuery({});
    await _resolveAndRender();

    expect(getEl('shareErrorSection')._expanded).toBe(true);
    expect(getEl('shareLoadingSection')._expanded).toBe(false);
    expect(getEl('shareContentSection')._expanded).toBe(false);
  });

  it('calls resolveShareToken with the ?share query param', async () => {
    __setQuery({ share: 'abc123' });
    mockResolveShareToken.mockResolvedValue({
      items: [],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(mockResolveShareToken).toHaveBeenCalledWith('abc123');
  });

  it('shows expired message when resolveShareToken returns Token expired', async () => {
    __setQuery({ share: 'old-token' });
    mockResolveShareToken.mockResolvedValue({ error: 'Token expired' });

    await _resolveAndRender();

    expect(getEl('shareErrorSection')._expanded).toBe(true);
    expect(getEl('shareErrorText').text).toContain('expired');
  });

  it('shows not-found message when resolveShareToken returns Invalid token', async () => {
    __setQuery({ share: 'bad' });
    mockResolveShareToken.mockResolvedValue({ error: 'Invalid token' });

    await _resolveAndRender();

    expect(getEl('shareErrorSection')._expanded).toBe(true);
    expect(getEl('shareErrorText').text).toContain('not found');
  });
});

// ── S2: Wishlist rendering ────────────────────────────────────────────

describe('_resolveAndRender — wishlist rendering', () => {
  it('shows owner name in header', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Jordan',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareOwnerName').text).toContain('Jordan');
  });

  it('shows item count in header', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem(), makeItem({ _id: 'p2', productName: 'Chair' })],
      ownerName: 'Sam',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareItemCount').text).toContain('2');
  });

  it('populates repeater data with wishlist items', async () => {
    __setQuery({ share: 'valid-tok' });
    const items = [makeItem(), makeItem({ _id: 'p2', productName: 'Loveseat' })];
    mockResolveShareToken.mockResolvedValue({
      items,
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareRepeater').data).toHaveLength(2);
    expect(getEl('shareRepeater').data[0]._id).toBe('p1');
    expect(getEl('shareRepeater').data[1]._id).toBe('p2');
  });

  it('shows empty state when wishlist has no items', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareEmptyState')._expanded).toBe(true);
  });

  it('collapses empty state when there are items', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareEmptyState')._expanded).toBe(false);
  });

  it('shows content section after successful resolution', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareContentSection')._expanded).toBe(true);
    expect(getEl('shareErrorSection')._expanded).toBe(false);
  });
});

// ── S3: Add to cart ───────────────────────────────────────────────────

describe('add to cart from shared view', () => {
  it('onItemReady registers callback on #shareRepeater', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(typeof getEl('shareRepeater')._itemReadyCb).toBe('function');
  });

  it('onItemReady sets product name text on card', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem({ productName: 'Recliner' })],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    const itemEls = new Map();
    const $item = (sel) => {
      const key = sel.replace(/^#/, '');
      if (!itemEls.has(key)) itemEls.set(key, createEl(key));
      return itemEls.get(key);
    };

    getEl('shareRepeater')._itemReadyCb($item, makeItem({ productName: 'Recliner' }));

    expect(itemEls.get('shareProductName').text).toBe('Recliner');
  });

  it('onItemReady sets product image src', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem({ productImage: 'https://cdn.wix.com/img.jpg' })],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    const itemEls = new Map();
    const $item = (sel) => {
      const key = sel.replace(/^#/, '');
      if (!itemEls.has(key)) itemEls.set(key, createEl(key));
      return itemEls.get(key);
    };

    getEl('shareRepeater')._itemReadyCb($item, makeItem({ productImage: 'https://cdn.wix.com/img.jpg' }));

    expect(itemEls.get('shareProductImage').src).toBe('https://cdn.wix.com/img.jpg');
  });

  it('onItemReady registers onClick on shareAddCart button', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    const itemEls = new Map();
    const $item = (sel) => {
      const key = sel.replace(/^#/, '');
      if (!itemEls.has(key)) itemEls.set(key, createEl(key));
      return itemEls.get(key);
    };

    getEl('shareRepeater')._itemReadyCb($item, makeItem());

    expect(itemEls.get('shareAddCart').onClick).toHaveBeenCalled();
  });

  it('clicking shareAddCart calls cart.addToCart with productId', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem({ productId: 'prod-42' })],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    const itemEls = new Map();
    const $item = (sel) => {
      const key = sel.replace(/^#/, '');
      if (!itemEls.has(key)) itemEls.set(key, createEl(key));
      return itemEls.get(key);
    };

    getEl('shareRepeater')._itemReadyCb($item, makeItem({ productId: 'prod-42' }));

    const addBtn = itemEls.get('shareAddCart');
    expect(addBtn._clickHandler).toBeTypeOf('function');

    await addBtn._clickHandler();

    expect(mockAddToCart).toHaveBeenCalledWith('prod-42');
  });

  it('button shows Added! then resets to Add to Cart on success', async () => {
    vi.useFakeTimers();
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockAddToCart.mockResolvedValue({ cart: { lineItems: [{}, {}] } });

    await _resolveAndRender();

    const itemEls = new Map();
    const $item = (sel) => {
      const key = sel.replace(/^#/, '');
      if (!itemEls.has(key)) itemEls.set(key, createEl(key));
      return itemEls.get(key);
    };

    getEl('shareRepeater')._itemReadyCb($item, makeItem());
    const addBtn = itemEls.get('shareAddCart');
    await addBtn._clickHandler();

    expect(addBtn.label).toBe('Added!');

    vi.advanceTimersByTime(2100);
    expect(addBtn.label).toBe('Add to Cart');
    expect(addBtn.enable).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('button shows Try Again on cart failure and re-enables', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockAddToCart.mockRejectedValue(new Error('out of stock'));

    await _resolveAndRender();

    const itemEls = new Map();
    const $item = (sel) => {
      const key = sel.replace(/^#/, '');
      if (!itemEls.has(key)) itemEls.set(key, createEl(key));
      return itemEls.get(key);
    };

    getEl('shareRepeater')._itemReadyCb($item, makeItem());
    const addBtn = itemEls.get('shareAddCart');
    await addBtn._clickHandler();

    expect(addBtn.label).toBe('Try Again');
    expect(addBtn.enable).toHaveBeenCalled();
  });
});

// ── S5: SEO ───────────────────────────────────────────────────────────

describe('SEO', () => {
  it('sets meta title element with owner name', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Morgan',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareMetaTitle').text).toContain("Morgan's");
  });

  it('expands noindex element for invalid tokens', async () => {
    __setQuery({ share: 'bad-tok' });
    mockResolveShareToken.mockResolvedValue({ error: 'Invalid token' });

    await _resolveAndRender();

    expect(getEl('shareNoIndex')._expanded).toBe(true);
  });

  it('collapses noindex element for valid tokens', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareNoIndex')._expanded).toBe(false);
  });

  it('expands noindex when no ?share param present', async () => {
    __setQuery({});
    await _resolveAndRender();
    expect(getEl('shareNoIndex')._expanded).toBe(true);
  });

  it('shows "1 item" singular when wishlist has exactly one item', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem()],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareItemCount').text).toBe('1 item');
  });

  it('shows plural "items" for two items', async () => {
    __setQuery({ share: 'valid-tok' });
    mockResolveShareToken.mockResolvedValue({
      items: [makeItem(), makeItem({ _id: 'p2' })],
      ownerName: 'Alex',
      expiresAt: new Date(Date.now() + 86400000),
    });

    await _resolveAndRender();

    expect(getEl('shareItemCount').text).toBe('2 items');
  });
});

// ── Error from thrown resolveShareToken (not resolved error) ──────────

describe('_resolveAndRender — resolveShareToken throws', () => {
  it('shows generic error when resolveShareToken rejects', async () => {
    __setQuery({ share: 'tok' });
    mockResolveShareToken.mockRejectedValue(new Error('network error'));

    await _resolveAndRender();

    expect(getEl('shareErrorSection')._expanded).toBe(true);
    expect(getEl('shareErrorText').text).toContain('wrong');
  });
});
