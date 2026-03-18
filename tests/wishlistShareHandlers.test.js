/**
 * Wishlist Share Page — $onReady handler tests (CF-y24r S1)
 * Tests the $w() wiring in 'Wishlist Share.js' via a mock $w environment.
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validResult = {
  valid: true,
  ownerName: 'Alice',
  memberId: 'mem-001',
  items: [
    { productId: 'p-001', productName: 'Eureka Frame', productImage: 'https://example.com/eureka.jpg' },
    { productId: 'p-002', productName: 'Dillon Frame', productImage: 'https://example.com/dillon.jpg' },
  ],
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Wishlist Share Page — $onReady handler', () => {
  beforeAll(async () => {
    await import('../src/pages/Wishlist Share.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    mockResolveShareToken.mockResolvedValue(validResult);
  });

  // ── S1: Token extraction ──────────────────────────────────────────────────

  it('calls resolveShareToken with the share query param', async () => {
    await onReadyHandler();
    expect(mockResolveShareToken).toHaveBeenCalledWith('share-abc123');
  });

  it('shows invalid section when share param is absent', async () => {
    const { default: wixLoc } = await import('wix-location-frontend');
    wixLoc.query = {};
    mockResolveShareToken.mockResolvedValue({ valid: false, reason: 'missing_token' });
    await onReadyHandler();
    expect(getEl('#wishlistShareInvalidSection').show).toHaveBeenCalled();
    wixLoc.query = { share: 'share-abc123' };
  });

  it('shows invalid section when token is not found', async () => {
    mockResolveShareToken.mockResolvedValue({ valid: false, reason: 'not_found' });
    await onReadyHandler();
    expect(getEl('#wishlistShareInvalidSection').show).toHaveBeenCalled();
  });

  it('sets invalid text message when token not found', async () => {
    mockResolveShareToken.mockResolvedValue({ valid: false, reason: 'not_found' });
    await onReadyHandler();
    expect(getEl('#wishlistShareInvalidText').text).toBeTruthy();
  });

  it('shows invalid section when token is expired', async () => {
    mockResolveShareToken.mockResolvedValue({ valid: false, reason: 'expired' });
    await onReadyHandler();
    expect(getEl('#wishlistShareInvalidSection').show).toHaveBeenCalled();
  });

  it('sets expired message when token is expired', async () => {
    mockResolveShareToken.mockResolvedValue({ valid: false, reason: 'expired' });
    await onReadyHandler();
    expect(getEl('#wishlistShareInvalidText').text.toLowerCase()).toContain('expired');
  });

  it('shows invalid section on fetch error', async () => {
    mockResolveShareToken.mockRejectedValue(new Error('Network error'));
    await onReadyHandler();
    expect(getEl('#wishlistShareInvalidSection').show).toHaveBeenCalled();
  });

  // ── S1: Success state ─────────────────────────────────────────────────────

  it('hides invalid section on valid result', async () => {
    await onReadyHandler();
    expect(getEl('#wishlistShareInvalidSection').hide).toHaveBeenCalled();
  });

  it('sets page title with owner name on valid result', async () => {
    await onReadyHandler();
    expect(getEl('#wishlistShareTitle').text).toContain('Alice');
  });

  it('sets product count in subtitle', async () => {
    await onReadyHandler();
    expect(getEl('#wishlistShareSubtitle').text).toContain('2');
  });

  it('populates shareRepeater data with wishlist items', async () => {
    await onReadyHandler();
    expect(getEl('#wishlistShareRepeater').data).toHaveLength(2);
  });

  it('shows wishlist content section on valid result', async () => {
    await onReadyHandler();
    expect(getEl('#wishlistShareContentSection').show).toHaveBeenCalled();
  });

  it('shows empty state section when valid but no items', async () => {
    mockResolveShareToken.mockResolvedValue({
      valid: true,
      ownerName: 'Bob',
      memberId: 'mem-002',
      items: [],
    });
    await onReadyHandler();
    expect(getEl('#wishlistShareEmptySection').show).toHaveBeenCalled();
  });

  // ── S1: Loading skeleton ──────────────────────────────────────────────────

  it('sets grid opacity to 0.4 during load and restores to 1', async () => {
    await onReadyHandler();
    expect(getEl('#wishlistShareContentSection').style.opacity).toBe('1');
  });

  // ── S1: Shop link ─────────────────────────────────────────────────────────

  it('registers onClick on shop button in invalid state', async () => {
    await onReadyHandler();
    expect(getEl('#wishlistShareShopBtn').onClick).toHaveBeenCalled();
  });
});
