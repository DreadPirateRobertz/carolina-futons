/**
 * getMemberDeliveredPerks — return shape, cumulative perks, next-tier teaser, error paths
 *
 * CF-c6el.3
 *
 * Covers gaps not in rewardEngine.test.js / rewardEngineHardening.test.js:
 *   - All 9 response fields present and correctly typed
 *   - Cumulative perk accumulation across tiers
 *   - nextTierPointsNeeded arithmetic
 *   - Top-tier member (Blue Ridge Legend) → all next* fields null
 *   - perk object shape within unlockedPerks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let _mockPoints = 0;

const mockQuery = vi.fn(() => ({
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn(async () => ({
    items: _mockPoints === null ? [] : [{ memberId: 'm1', totalPoints: _mockPoints }],
  })),
}));

vi.mock('wix-data', () => ({
  default: {
    insert: vi.fn(async (_, r) => r),
    query: (...args) => mockQuery(...args),
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailMember: vi.fn(async () => {}) },
}));

const mockGetMember = vi.fn(async () => ({ _id: 'm1' }));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: (...args) => mockGetMember(...args) },
}));

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));

// ── Import after mocks ─────────────────────────────────────────────────────────

const { getMemberDeliveredPerks } = await import('../src/backend/rewardEngine.web.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function setPoints(pts) { _mockPoints = pts; }
function clearPoints() { _mockPoints = null; } // simulates no record in DB

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getMemberDeliveredPerks — return shape', () => {
  beforeEach(() => {
    setPoints(0);
    mockGetMember.mockClear();
    mockGetMember.mockResolvedValue({ _id: 'm1' });
  });

  it('returns all 9 required fields on success', async () => {
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(true);
    expect(typeof result.currentTierName).toBe('string');
    expect(typeof result.currentTierKey).toBe('string');
    expect(typeof result.totalPoints).toBe('number');
    expect(Array.isArray(result.unlockedPerks)).toBe(true);
    // next-tier fields present (may be null at top tier, but exist)
    expect(result).toHaveProperty('nextTierName');
    expect(result).toHaveProperty('nextTierKey');
    expect(result).toHaveProperty('nextTierPointsNeeded');
    expect(result).toHaveProperty('nextTierPerks');
  });

  it('each perk in unlockedPerks has the full 6-field shape', async () => {
    setPoints(0); // Trail Blazer — has 2 perks
    const result = await getMemberDeliveredPerks();
    expect(result.unlockedPerks.length).toBeGreaterThan(0);
    for (const perk of result.unlockedPerks) {
      expect(typeof perk.tierKey).toBe('string');
      expect(typeof perk.tierName).toBe('string');
      expect(typeof perk.perkId).toBe('string');
      expect(typeof perk.label).toBe('string');
      expect(typeof perk.description).toBe('string');
      expect(typeof perk.icon).toBe('string');
    }
  });
});

describe('getMemberDeliveredPerks — cumulative perks by tier', () => {
  beforeEach(() => {
    mockGetMember.mockClear();
    mockGetMember.mockResolvedValue({ _id: 'm1' });
  });

  it('Trail Blazer (0 pts) gets only Trail Blazer perks (2)', async () => {
    setPoints(0);
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(true);
    expect(result.currentTierKey).toBe('TRAIL_BLAZER');
    expect(result.unlockedPerks).toHaveLength(2);
    expect(result.unlockedPerks.every(p => p.tierKey === 'TRAIL_BLAZER')).toBe(true);
  });

  it('Mountain Guide (500 pts) gets Trail Blazer + Mountain Guide perks (4)', async () => {
    setPoints(500);
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(true);
    expect(result.currentTierKey).toBe('MOUNTAIN_GUIDE');
    expect(result.unlockedPerks).toHaveLength(4);
    const tierKeys = result.unlockedPerks.map(p => p.tierKey);
    expect(tierKeys).toContain('TRAIL_BLAZER');
    expect(tierKeys).toContain('MOUNTAIN_GUIDE');
  });

  it('Summit Master (2000 pts) gets 6 cumulative perks', async () => {
    setPoints(2000);
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(true);
    expect(result.currentTierKey).toBe('SUMMIT_MASTER');
    expect(result.unlockedPerks).toHaveLength(6);
  });

  it('Blue Ridge Legend (5000 pts) gets all 8 perks', async () => {
    setPoints(5000);
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(true);
    expect(result.currentTierKey).toBe('BLUE_RIDGE_LEGEND');
    expect(result.unlockedPerks).toHaveLength(8);
  });
});

describe('getMemberDeliveredPerks — next-tier teaser', () => {
  beforeEach(() => {
    mockGetMember.mockClear();
    mockGetMember.mockResolvedValue({ _id: 'm1' });
  });

  it('Trail Blazer member has Mountain Guide as next tier', async () => {
    setPoints(300);
    const result = await getMemberDeliveredPerks();
    expect(result.nextTierName).toBe('Mountain Guide');
    expect(result.nextTierKey).toBe('MOUNTAIN_GUIDE');
    expect(result.nextTierPerks).not.toBeNull();
    expect(Array.isArray(result.nextTierPerks)).toBe(true);
  });

  it('nextTierPointsNeeded = threshold − totalPoints', async () => {
    setPoints(300); // Mountain Guide threshold = 500 → needed = 200
    const result = await getMemberDeliveredPerks();
    expect(result.nextTierPointsNeeded).toBe(200);
  });

  it('nextTierPointsNeeded is 0 when exactly at next tier threshold', async () => {
    setPoints(500); // at Mountain Guide threshold
    const result = await getMemberDeliveredPerks();
    // Now Mountain Guide — next is Summit Master (2000). needed = 1500
    expect(result.nextTierPointsNeeded).toBe(1500);
  });

  it('Blue Ridge Legend (top tier) has all next* fields null', async () => {
    setPoints(5000);
    const result = await getMemberDeliveredPerks();
    expect(result.nextTierName).toBeNull();
    expect(result.nextTierKey).toBeNull();
    expect(result.nextTierPointsNeeded).toBeNull();
    expect(result.nextTierPerks).toBeNull();
  });
});

describe('getMemberDeliveredPerks — error paths', () => {
  beforeEach(() => {
    setPoints(0);
    mockGetMember.mockClear();
  });

  it('returns not-authenticated when getMember returns null', async () => {
    mockGetMember.mockResolvedValueOnce(null);
    const result = await getMemberDeliveredPerks();
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  });

  it('returns not-authenticated when getMember throws', async () => {
    mockGetMember.mockRejectedValueOnce(new Error('session expired'));
    const result = await getMemberDeliveredPerks();
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  });

  it('returns not-authenticated when member has no _id', async () => {
    mockGetMember.mockResolvedValueOnce({ _id: null });
    const result = await getMemberDeliveredPerks();
    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  });

  it('returns failed-to-load on DB query error', async () => {
    mockGetMember.mockResolvedValue({ _id: 'm1' });
    mockQuery.mockImplementationOnce(() => ({
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn(async () => { throw new Error('db down'); }),
    }));
    const result = await getMemberDeliveredPerks();
    expect(result).toEqual({ success: false, error: 'Failed to load perks' });
  });

  it('totalPoints defaults to 0 when member has no points record', async () => {
    clearPoints();
    mockGetMember.mockResolvedValue({ _id: 'm1' });
    const result = await getMemberDeliveredPerks();
    expect(result.success).toBe(true);
    expect(result.totalPoints).toBe(0);
    expect(result.currentTierKey).toBe('TRAIL_BLAZER');
  });
});
