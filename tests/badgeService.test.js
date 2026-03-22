import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: {
    mountainBlue: '#5B8FA8',
    mountainBlueDark: '#3D6B80',
    espresso: '#1E3A5F',
    sunsetCoral: '#4A7D94',
    white: '#FFFFFF',
  },
}));

const mockFind = vi.fn();
const mockQueryChain = {
  eq: vi.fn().mockReturnThis(),
  hasSome: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: mockFind,
};

vi.mock('wix-data', () => ({
  default: { query: vi.fn(() => ({ ...mockQueryChain })) },
}));

// ── Helpers ──────────────────────────────────────────────────────────

function makeEntry(productId, badgeType, { active = true, expiresAt = null } = {}) {
  return { productId, badgeType, active, expiresAt };
}

// ── Import SUT ───────────────────────────────────────────────────────

const { getProductBadges, getBatchProductBadges } = await import('../src/backend/badgeService.web.js');

// ════════════════════════════════════════════════════════════════════
// getProductBadges
// ════════════════════════════════════════════════════════════════════

describe('getProductBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockResolvedValue({ items: [] });
  });

  it('returns error when productId is missing', async () => {
    const r = await getProductBadges('');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('returns null badge when no CMS entries and no computed triggers', async () => {
    const r = await getProductBadges('prod-1', {});
    expect(r.success).toBe(true);
    expect(r.badge).toBeNull();
    expect(r.source).toBe('none');
  });

  it('returns CMS badge when active entry exists', async () => {
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'NEW')] });
    const r = await getProductBadges('prod-1', {});
    expect(r.success).toBe(true);
    expect(r.badge?.type).toBe('NEW');
    expect(r.badge?.label).toBe('New');
    expect(r.source).toBe('cms');
  });

  it('ignores inactive CMS entries', async () => {
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'BESTSELLER', { active: false })] });
    const r = await getProductBadges('prod-1', {});
    expect(r.badge).toBeNull();
  });

  it('ignores expired CMS entries', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'SALE', { expiresAt: past })] });
    const r = await getProductBadges('prod-1', {});
    expect(r.badge).toBeNull();
  });

  it('respects future expiresAt — badge is still active', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'CF_PLUS_EXCLUSIVE', { expiresAt: future })] });
    const r = await getProductBadges('prod-1', {});
    expect(r.badge?.type).toBe('CF_PLUS_EXCLUSIVE');
  });

  it('returns computed SALE badge when comparePrice is set and no CMS override', async () => {
    const r = await getProductBadges('prod-1', { comparePrice: 299, quantityInStock: 20 });
    expect(r.badge?.type).toBe('SALE');
    expect(r.source).toBe('computed');
  });

  it('returns computed LOW_STOCK badge when inventory < 5', async () => {
    const r = await getProductBadges('prod-1', { quantityInStock: 3 });
    expect(r.badge?.type).toBe('LOW_STOCK');
    expect(r.source).toBe('computed');
  });

  it('does not return LOW_STOCK when inventory is exactly 5', async () => {
    const r = await getProductBadges('prod-1', { quantityInStock: 5 });
    expect(r.badge).toBeNull();
  });

  it('CMS badge takes priority over computed badge', async () => {
    // Product has comparePrice (would compute SALE) but CMS says BESTSELLER
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'BESTSELLER')] });
    const r = await getProductBadges('prod-1', { comparePrice: 299 });
    expect(r.badge?.type).toBe('BESTSELLER');
    expect(r.source).toBe('cms');
  });

  it('CF_PLUS_EXCLUSIVE wins over all other badge types (priority order)', async () => {
    mockFind.mockResolvedValue({ items: [
      makeEntry('prod-1', 'NEW'),
      makeEntry('prod-1', 'CF_PLUS_EXCLUSIVE'),
    ]});
    const r = await getProductBadges('prod-1', { comparePrice: 100 });
    expect(r.badge?.type).toBe('CF_PLUS_EXCLUSIVE');
  });

  it('BESTSELLER beats NEW in priority order', async () => {
    mockFind.mockResolvedValue({ items: [
      makeEntry('prod-1', 'NEW'),
      makeEntry('prod-1', 'BESTSELLER'),
    ]});
    const r = await getProductBadges('prod-1', {});
    expect(r.badge?.type).toBe('BESTSELLER');
  });

  it('badge includes label, bgColor, textColor', async () => {
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'NEW')] });
    const r = await getProductBadges('prod-1', {});
    expect(r.badge).toMatchObject({ type: 'NEW', label: 'New', bgColor: expect.any(String), textColor: expect.any(String) });
  });

  it('returns error shape on wix-data failure', async () => {
    mockFind.mockRejectedValue(new Error('DB error'));
    const r = await getProductBadges('prod-1');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/unable/i);
  });

  it('sanitizes productId — strips HTML tags', async () => {
    const r = await getProductBadges('<script>bad</script>prod-1');
    // sanitize strips tags leaving 'prod-1', query proceeds with no CMS items
    expect(r.success).toBe(true);
  });

  it('returns error for null productId', async () => {
    const r = await getProductBadges(null);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('returns error for undefined productId', async () => {
    const r = await getProductBadges(undefined);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('returns error for numeric productId', async () => {
    const r = await getProductBadges(123);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('unknown CMS badgeType is skipped — valid sibling badge wins', async () => {
    mockFind.mockResolvedValue({ items: [
      makeEntry('prod-1', 'TYPO_BADGE'),
      makeEntry('prod-1', 'NEW'),
    ]});
    const r = await getProductBadges('prod-1', {});
    // TYPO_BADGE is unknown → buildBadge returns null → NEW is selected
    expect(r.badge?.type).toBe('NEW');
  });

  it('unknown CMS badgeType alone returns null badge', async () => {
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'TYPO_BADGE')] });
    const r = await getProductBadges('prod-1', {});
    expect(r.badge).toBeNull();
  });

  it('SALE wins over LOW_STOCK when both computed badges fire', async () => {
    // comparePrice > 0 → SALE; quantityInStock < 5 → LOW_STOCK; SALE has higher priority
    const r = await getProductBadges('prod-1', { comparePrice: 199, quantityInStock: 2 });
    expect(r.badge?.type).toBe('SALE');
  });
});

// ════════════════════════════════════════════════════════════════════
// getBatchProductBadges
// ════════════════════════════════════════════════════════════════════

describe('getBatchProductBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockResolvedValue({ items: [] });
  });

  it('returns empty badges for empty array', async () => {
    const r = await getBatchProductBadges([]);
    expect(r.success).toBe(true);
    expect(r.badges).toEqual({});
  });

  it('returns empty badges for non-array input', async () => {
    const r = await getBatchProductBadges(null);
    expect(r.success).toBe(true);
    expect(r.badges).toEqual({});
  });

  it('returns null badge for products with no CMS entry and no computed triggers', async () => {
    const r = await getBatchProductBadges(['prod-1', 'prod-2']);
    expect(r.badges['prod-1']).toBeNull();
    expect(r.badges['prod-2']).toBeNull();
  });

  it('maps CMS badges to correct product IDs', async () => {
    mockFind.mockResolvedValue({ items: [
      makeEntry('prod-1', 'NEW'),
      makeEntry('prod-2', 'BESTSELLER'),
    ]});
    const r = await getBatchProductBadges(['prod-1', 'prod-2']);
    expect(r.badges['prod-1']?.type).toBe('NEW');
    expect(r.badges['prod-2']?.type).toBe('BESTSELLER');
  });

  it('applies computed SALE badge from productDataMap', async () => {
    const r = await getBatchProductBadges(['prod-3'], { 'prod-3': { comparePrice: 199 } });
    expect(r.badges['prod-3']?.type).toBe('SALE');
  });

  it('applies computed LOW_STOCK badge from productDataMap', async () => {
    const r = await getBatchProductBadges(['prod-4'], { 'prod-4': { quantityInStock: 2 } });
    expect(r.badges['prod-4']?.type).toBe('LOW_STOCK');
  });

  it('ignores inactive CMS badges in batch', async () => {
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'SALE', { active: false })] });
    const r = await getBatchProductBadges(['prod-1']);
    expect(r.badges['prod-1']).toBeNull();
  });

  it('caps batch at 50 product IDs', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `prod-${i}`);
    const r = await getBatchProductBadges(ids);
    const resultIds = Object.keys(r.badges);
    expect(resultIds).toHaveLength(50);
  });

  it('returns error shape on wix-data failure', async () => {
    mockFind.mockRejectedValue(new Error('DB down'));
    const r = await getBatchProductBadges(['prod-1']);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/unable/i);
  });

  it('products missing from CMS get null badge (no crash)', async () => {
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'NEW')] });
    const r = await getBatchProductBadges(['prod-1', 'prod-missing']);
    expect(r.badges['prod-missing']).toBeNull();
  });

  it('CMS beats computed badge in batch', async () => {
    mockFind.mockResolvedValue({ items: [makeEntry('prod-1', 'CF_PLUS_EXCLUSIVE')] });
    const r = await getBatchProductBadges(['prod-1'], { 'prod-1': { comparePrice: 100 } });
    expect(r.badges['prod-1']?.type).toBe('CF_PLUS_EXCLUSIVE');
  });

  it('CMS items with productId not in requested set are ignored (sanitize defence)', async () => {
    // Simulate a CMS row with a different productId than what was requested
    mockFind.mockResolvedValue({ items: [
      makeEntry('prod-1', 'NEW'),
      makeEntry('injected-id', 'BESTSELLER'),
    ]});
    const r = await getBatchProductBadges(['prod-1']);
    expect(r.badges['prod-1']?.type).toBe('NEW');
    expect(r.badges['injected-id']).toBeUndefined(); // not in requested set
  });

  it('query uses .limit() to prevent wix-data silent truncation', async () => {
    // mockQueryChain.limit is already in the chain; verify it was called
    await getBatchProductBadges(['prod-1']);
    expect(mockQueryChain.limit).toHaveBeenCalled();
  });
});
