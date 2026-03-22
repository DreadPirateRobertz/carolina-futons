import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockGetProductBadges = vi.fn();
const mockGetBatchProductBadges = vi.fn();

vi.mock('backend/badgeService.web', () => ({
  getProductBadges: (...args) => mockGetProductBadges(...args),
  getBatchProductBadges: (...args) => mockGetBatchProductBadges(...args),
}));

// ── $w mock factory ──────────────────────────────────────────────────

function makeMockEl(id) {
  return {
    _id: id,
    text: '',
    style: {},
    show: vi.fn(),
    hide: vi.fn(),
  };
}

function create$w() {
  const els = new Map();
  const $w = vi.fn((sel) => {
    if (!els.has(sel)) els.set(sel, makeMockEl(sel));
    return els.get(sel);
  });
  $w._get = (sel) => els.get(sel);
  return $w;
}

// ── Import SUT ───────────────────────────────────────────────────────

const { initCmsBadgePDP, batchLoadCmsBadges, renderCardCmsBadge } = await import('../src/public/badgeHelpers.js');

// ════════════════════════════════════════════════════════════════════
// initCmsBadgePDP
// ════════════════════════════════════════════════════════════════════

describe('initCmsBadgePDP', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    state = { product: { _id: 'prod-1', comparePrice: null, quantityInStock: 20 } };
  });

  it('does nothing when state.product is null', async () => {
    state.product = null;
    await initCmsBadgePDP($w, state);
    expect(mockGetProductBadges).not.toHaveBeenCalled();
  });

  it('does nothing when product has no _id', async () => {
    state.product = { name: 'Frame' };
    await initCmsBadgePDP($w, state);
    expect(mockGetProductBadges).not.toHaveBeenCalled();
  });

  it('calls getProductBadges with product id and data', async () => {
    mockGetProductBadges.mockResolvedValue({ success: false, error: 'err' });
    await initCmsBadgePDP($w, state);
    expect(mockGetProductBadges).toHaveBeenCalledWith('prod-1', {
      comparePrice: null,
      quantityInStock: 20,
    });
  });

  it('hides container when API returns no badge', async () => {
    mockGetProductBadges.mockResolvedValue({ success: true, badge: null, source: 'none' });
    await initCmsBadgePDP($w, state);
    expect($w('#pdpBadgeContainer').hide).toHaveBeenCalled();
  });

  it('shows container and sets text when badge is returned', async () => {
    mockGetProductBadges.mockResolvedValue({
      success: true,
      badge: { type: 'NEW', label: 'New', bgColor: '#5B8FA8', textColor: '#FFFFFF' },
      source: 'cms',
    });
    await initCmsBadgePDP($w, state);
    expect($w('#pdpBadgeText').text).toBe('New');
    expect($w('#pdpBadgeContainer').show).toHaveBeenCalled();
  });

  it('sets bgColor on container when badge is returned', async () => {
    mockGetProductBadges.mockResolvedValue({
      success: true,
      badge: { type: 'BESTSELLER', label: 'Bestseller', bgColor: '#1E3A5F', textColor: '#FFFFFF' },
      source: 'cms',
    });
    await initCmsBadgePDP($w, state);
    expect($w('#pdpBadgeContainer').style.backgroundColor).toBe('#1E3A5F');
  });

  it('hides container on API failure', async () => {
    mockGetProductBadges.mockResolvedValue({ success: false, error: 'DB down' });
    await initCmsBadgePDP($w, state);
    expect($w('#pdpBadgeContainer').hide).toHaveBeenCalled();
  });

  it('does not throw when API rejects', async () => {
    mockGetProductBadges.mockRejectedValue(new Error('network'));
    await expect(initCmsBadgePDP($w, state)).resolves.not.toThrow();
  });

  it('falls back to container.text when #pdpBadgeText is not wired', async () => {
    mockGetProductBadges.mockResolvedValue({
      success: true,
      badge: { type: 'SALE', label: 'Sale', bgColor: '#4A7D94', textColor: '#FFFFFF' },
      source: 'cms',
    });
    // Create a $w that returns null for #pdpBadgeText only
    const els = new Map();
    const $wNull = vi.fn((sel) => {
      if (sel === '#pdpBadgeText') return null;
      if (!els.has(sel)) els.set(sel, makeMockEl(sel));
      return els.get(sel);
    });
    await initCmsBadgePDP($wNull, state);
    // Should fall back: container.text = label
    expect(els.get('#pdpBadgeContainer').text).toBe('Sale');
    expect(els.get('#pdpBadgeContainer').show).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// batchLoadCmsBadges
// ════════════════════════════════════════════════════════════════════

describe('batchLoadCmsBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty Map for empty array', async () => {
    const map = await batchLoadCmsBadges([]);
    expect(map.size).toBe(0);
  });

  it('returns empty Map for null input', async () => {
    const map = await batchLoadCmsBadges(null);
    expect(map.size).toBe(0);
  });

  it('calls getBatchProductBadges with product ids and data map', async () => {
    mockGetBatchProductBadges.mockResolvedValue({ success: true, badges: {} });
    const products = [
      { _id: 'p1', comparePrice: 100, quantityInStock: 3 },
      { _id: 'p2', comparePrice: null, quantityInStock: 20 },
    ];
    await batchLoadCmsBadges(products);
    expect(mockGetBatchProductBadges).toHaveBeenCalledWith(
      ['p1', 'p2'],
      { p1: { comparePrice: 100, quantityInStock: 3 }, p2: { comparePrice: null, quantityInStock: 20 } }
    );
  });

  it('maps returned badges into a Map keyed by productId', async () => {
    const newBadge = { type: 'NEW', label: 'New', bgColor: '#5B8FA8', textColor: '#FFFFFF' };
    mockGetBatchProductBadges.mockResolvedValue({
      success: true,
      badges: { p1: newBadge, p2: null },
    });
    const map = await batchLoadCmsBadges([{ _id: 'p1' }, { _id: 'p2' }]);
    expect(map.get('p1')).toEqual(newBadge);
    expect(map.get('p2')).toBeNull();
  });

  it('returns empty Map on API failure', async () => {
    mockGetBatchProductBadges.mockResolvedValue({ success: false, error: 'err' });
    const map = await batchLoadCmsBadges([{ _id: 'p1' }]);
    expect(map.size).toBe(0);
  });

  it('returns empty Map when API rejects', async () => {
    mockGetBatchProductBadges.mockRejectedValue(new Error('network'));
    const map = await batchLoadCmsBadges([{ _id: 'p1' }]);
    expect(map.size).toBe(0);
  });

  it('filters out products with no _id', async () => {
    mockGetBatchProductBadges.mockResolvedValue({ success: true, badges: {} });
    await batchLoadCmsBadges([{ _id: 'p1' }, { name: 'no-id' }]);
    const [ids] = mockGetBatchProductBadges.mock.calls[0];
    expect(ids).toEqual(['p1']);
  });
});

// ════════════════════════════════════════════════════════════════════
// renderCardCmsBadge
// ════════════════════════════════════════════════════════════════════

describe('renderCardCmsBadge', () => {
  it('hides element when badge is null', () => {
    const el = makeMockEl('#productBadgeRepeater');
    renderCardCmsBadge(el, null);
    expect(el.hide).toHaveBeenCalled();
    expect(el.show).not.toHaveBeenCalled();
  });

  it('sets text, bgColor, textColor and shows when badge is provided', () => {
    const el = makeMockEl('#productBadgeRepeater');
    const badge = { type: 'SALE', label: 'Sale', bgColor: '#4A7D94', textColor: '#FFFFFF' };
    renderCardCmsBadge(el, badge);
    expect(el.text).toBe('Sale');
    expect(el.style.backgroundColor).toBe('#4A7D94');
    expect(el.style.color).toBe('#FFFFFF');
    expect(el.show).toHaveBeenCalled();
  });

  it('does not throw when $el is null', () => {
    expect(() => renderCardCmsBadge(null, { label: 'New' })).not.toThrow();
  });

  it('hides element when badge is undefined', () => {
    const el = makeMockEl('#productBadgeRepeater');
    renderCardCmsBadge(el, undefined);
    expect(el.hide).toHaveBeenCalled();
  });
});
