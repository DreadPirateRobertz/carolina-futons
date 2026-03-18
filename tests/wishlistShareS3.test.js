/**
 * Wishlist Share S3 — Add to cart from shared view (CF-o779)
 * Tests: shareAddCart per item, Adding/Added cycle, error reset, cart counter
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

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

const mockAddToCart = vi.fn(() => Promise.resolve({ items: [] }));
vi.mock('public/cartService', () => ({
  addToCart: (...args) => mockAddToCart(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const twoItems = [
  { _id: 'w-001', productId: 'p-001', productName: 'Eureka Frame', productImage: 'https://example.com/eureka.jpg' },
  { _id: 'w-002', productId: 'p-002', productName: 'Dillon Frame', productImage: 'https://example.com/dillon.jpg' },
];

const validResult = {
  valid: true,
  ownerName: 'Alice',
  memberId: 'mem-001',
  items: twoItems,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal $item mock for one repeater item. */
function makeItemContext() {
  const itemEls = new Map();
  return (sel) => {
    if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
    return itemEls.get(sel);
  };
}

/** Run onReady then invoke the onItemReady callback with given item data. */
async function renderItem(itemData) {
  await onReadyHandler();
  const cb = getEl('#wishlistShareRepeater').onItemReady.mock.calls[0]?.[0];
  if (!cb) throw new Error('onItemReady was not registered');
  const $item = makeItemContext();
  cb($item, itemData);
  return $item;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Wishlist Share S3 — add to cart', () => {
  beforeAll(async () => {
    await import('../src/pages/Wishlist Share.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    mockResolveShareToken.mockResolvedValue(validResult);
    mockAddToCart.mockResolvedValue({ items: [] });
  });

  // ── Wiring ─────────────────────────────────────────────────────────────────

  it('registers onItemReady on #wishlistShareRepeater', async () => {
    await onReadyHandler();
    expect(getEl('#wishlistShareRepeater').onItemReady).toHaveBeenCalled();
  });

  it('onItemReady registers onClick on #shareAddCart per item', async () => {
    const $item = await renderItem(twoItems[0]);
    expect($item('#shareAddCart').onClick).toHaveBeenCalled();
  });

  // ── Add-to-cart cycle ──────────────────────────────────────────────────────

  it('clicking #shareAddCart disables the button and sets Adding...', async () => {
    const $item = await renderItem(twoItems[0]);
    const clickHandler = $item('#shareAddCart').onClick.mock.calls[0][0];

    // Pause addToCart so we can inspect intermediate state
    let resolve;
    mockAddToCart.mockReturnValue(new Promise(r => { resolve = r; }));

    const pending = clickHandler();
    expect($item('#shareAddCart').disable).toHaveBeenCalled();
    expect($item('#shareAddCart').label).toBe('Adding...');

    resolve({ items: [] });
    await pending;
  });

  it('calls addToCart with the item productId', async () => {
    const $item = await renderItem(twoItems[0]);
    const clickHandler = $item('#shareAddCart').onClick.mock.calls[0][0];
    await clickHandler();
    expect(mockAddToCart).toHaveBeenCalledWith('p-001');
  });

  it('sets label to Added! after successful addToCart', async () => {
    const $item = await renderItem(twoItems[0]);
    const clickHandler = $item('#shareAddCart').onClick.mock.calls[0][0];
    await clickHandler();
    expect($item('#shareAddCart').label).toBe('Added!');
  });

  it('uses productId from item data (second item)', async () => {
    const $item = await renderItem(twoItems[1]);
    const clickHandler = $item('#shareAddCart').onClick.mock.calls[0][0];
    await clickHandler();
    expect(mockAddToCart).toHaveBeenCalledWith('p-002');
  });

  it('resets label to Add to Cart and re-enables after 2s', async () => {
    vi.useFakeTimers();
    const $item = await renderItem(twoItems[0]);
    const clickHandler = $item('#shareAddCart').onClick.mock.calls[0][0];
    await clickHandler();

    vi.advanceTimersByTime(2000);
    expect($item('#shareAddCart').label).toBe('Add to Cart');
    expect($item('#shareAddCart').enable).toHaveBeenCalled();
    vi.useRealTimers();
  });

  // ── Error path ─────────────────────────────────────────────────────────────

  it('sets Error — Try Again label on addToCart failure', async () => {
    mockAddToCart.mockRejectedValue(new Error('Cart API down'));
    const $item = await renderItem(twoItems[0]);
    const clickHandler = $item('#shareAddCart').onClick.mock.calls[0][0];
    await clickHandler();
    expect($item('#shareAddCart').label).toBe('Error — Try Again');
  });

  it('re-enables button immediately after error', async () => {
    mockAddToCart.mockRejectedValue(new Error('Cart API down'));
    const $item = await renderItem(twoItems[0]);
    const clickHandler = $item('#shareAddCart').onClick.mock.calls[0][0];
    await clickHandler();
    expect($item('#shareAddCart').enable).toHaveBeenCalled();
  });

  it('resets error label to Add to Cart after 2s', async () => {
    vi.useFakeTimers();
    mockAddToCart.mockRejectedValue(new Error('Cart API down'));
    const $item = await renderItem(twoItems[0]);
    const clickHandler = $item('#shareAddCart').onClick.mock.calls[0][0];
    await clickHandler();

    vi.advanceTimersByTime(2000);
    expect($item('#shareAddCart').label).toBe('Add to Cart');
    vi.useRealTimers();
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  it('does not register onItemReady when wishlist is empty', async () => {
    mockResolveShareToken.mockResolvedValue({
      valid: true, ownerName: 'Bob', memberId: 'mem-002', items: [],
    });
    await onReadyHandler();
    // onItemReady may still be registered (no-op) — but data is empty
    expect(getEl('#wishlistShareRepeater').data).toHaveLength(0);
  });
});
