/**
 * Unit tests for getProductUGCPhotos in src/backend/ugcService.web.js
 *
 * CF-rw9i.2
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockWixDataQuery = vi.fn();

vi.mock('wix-data', () => ({
  default: {
    query: (...a) => mockWixDataQuery(...a),
    get:   vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    count:  vi.fn(),
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(), getRoles: vi.fn() },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize:      (v) => v,
  validateId:    (v) => v || null,
  isWixMediaUrl: () => true,
}));

const { getProductUGCPhotos } = await import('../src/backend/ugcService.web.js');

// ── Helpers ───────────────────────────────────────────────────────────

function makeQueryChain(items, totalCount = items.length) {
  const chain = {
    hasSome:    vi.fn().mockReturnThis(),
    eq:         vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    limit:      vi.fn().mockReturnThis(),
    find:       vi.fn().mockResolvedValue({ items, totalCount }),
  };
  mockWixDataQuery.mockReturnValue(chain);
  return chain;
}

function makePhoto(overrides = {}) {
  return {
    _id: 'ph-1',
    photoUrl: 'wix:image://abc.jpg',
    productId: 'prod-1',
    status: 'approved',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('getProductUGCPhotos', () => {
  it('returns photos for a valid productId', async () => {
    makeQueryChain([makePhoto()], 1);

    const result = await getProductUGCPhotos('prod-1');

    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('filters by productId', async () => {
    const chain = makeQueryChain([]);
    await getProductUGCPhotos('prod-abc');
    expect(chain.eq).toHaveBeenCalledWith('productId', 'prod-abc');
  });

  it('filters to approved and featured status', async () => {
    const chain = makeQueryChain([]);
    await getProductUGCPhotos('prod-1');
    expect(chain.hasSome).toHaveBeenCalledWith('status', ['approved', 'featured']);
  });

  it('defaults to descending submittedAt (recent sort)', async () => {
    const chain = makeQueryChain([]);
    await getProductUGCPhotos('prod-1');
    expect(chain.descending).toHaveBeenCalledWith('submittedAt');
  });

  it('sorts by voteCount when sort=votes', async () => {
    const chain = makeQueryChain([]);
    await getProductUGCPhotos('prod-1', { sort: 'votes' });
    expect(chain.descending).toHaveBeenCalledWith('voteCount');
  });

  it('clamps limit to 50 max', async () => {
    const chain = makeQueryChain([]);
    await getProductUGCPhotos('prod-1', { limit: 999 });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('uses default limit of 20', async () => {
    const chain = makeQueryChain([]);
    await getProductUGCPhotos('prod-1');
    expect(chain.limit).toHaveBeenCalledWith(20);
  });

  it('returns error when productId is empty', async () => {
    const result = await getProductUGCPhotos('');
    expect(result.success).toBe(false);
    expect(result.photos).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('returns error on DB failure', async () => {
    mockWixDataQuery.mockReturnValue({
      hasSome:    vi.fn().mockReturnThis(),
      eq:         vi.fn().mockReturnThis(),
      descending: vi.fn().mockReturnThis(),
      limit:      vi.fn().mockReturnThis(),
      find:       vi.fn().mockRejectedValue(new Error('DB down')),
    });

    const result = await getProductUGCPhotos('prod-1');
    expect(result.success).toBe(false);
    expect(result.photos).toEqual([]);
  });
});
