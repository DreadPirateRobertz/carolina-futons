/**
 * CF-yq80: Loyalty tier display on Member Page dashboard.
 * Tests for #loyaltyPointsDisplay, #loyaltyTierDisplay, #loyaltyProgressBar,
 * #loyaltyNextTierText, and #loyaltySection hookup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w mock infrastructure ─────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', value: 0, label: '', src: '', alt: '', data: [],
    collapsed: false,
    style: { color: '', backgroundColor: '', foregroundColor: '', fontWeight: '', borderColor: '', opacity: 1 },
    accessibility: { ariaLabel: '', ariaLive: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    scrollTo: vi.fn(),
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

// ── Hoist loyalty mock refs so they're configurable per-test ───────

const loyaltyMocks = vi.hoisted(() => ({
  getMyLoyaltyAccount: vi.fn(),
  getAvailableRewards: vi.fn().mockResolvedValue([]),
  getLoyaltyTiers: vi.fn().mockResolvedValue([]),
  redeemReward: vi.fn().mockResolvedValue({ success: true }),
}));

// ── All vi.mock calls ──────────────────────────────────────────────

vi.mock('backend/loyaltyService.web', () => ({
  getMyLoyaltyAccount: loyaltyMocks.getMyLoyaltyAccount,
  getAvailableRewards: loyaltyMocks.getAvailableRewards,
  getLoyaltyTiers: loyaltyMocks.getLoyaltyTiers,
  redeemReward: loyaltyMocks.redeemReward,
  getMyStreakData: vi.fn().mockResolvedValue({ currentStreakDays: 0, streakMultiplier: 1, streakStartDate: null, lastActivityDate: null }),
}));

vi.mock('backend/accountDashboard.web', () => ({
  getOrderHistory: vi.fn().mockResolvedValue({ success: true, data: { orders: [], hasNext: false } }),
  getActiveDeliveries: vi.fn().mockResolvedValue({ success: true, data: { deliveries: [] } }),
  getWishlist: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
  moveWishlistToCart: vi.fn().mockResolvedValue({ success: true, data: { productId: 'p1' } }),
  removeFromWishlist: vi.fn().mockResolvedValue({ success: true }),
  getReorderItems: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
  getWishlistAlertHistory: vi.fn().mockResolvedValue({ success: true, data: { alerts: [] } }),
  toggleProductAlerts: vi.fn().mockResolvedValue(),
}));

vi.mock('backend/wishlistShare.web.js', () => ({
  addShareToken: vi.fn().mockResolvedValue({ token: 'tok', shareUrl: 'https://x.com/tok', expiresAt: new Date() }),
  resolveShareToken: vi.fn().mockResolvedValue({ valid: false, reason: 'not_found' }),
}));

vi.mock('backend/errorMonitoring.web', () => ({ logError: vi.fn() }));
vi.mock('backend/notificationService.web', () => ({ toggleProductAlerts: vi.fn() }));

vi.mock('public/engagementTracker', () => ({ trackEvent: vi.fn() }));
vi.mock('public/a11yHelpers', () => ({ announce: vi.fn() }));
vi.mock('public/designTokens.js', () => ({
  colors: { sand: '#E8D5B7', espresso: '#3A2518', mountainBlue: '#5B8FA8', success: '#4CAF50' },
}));
vi.mock('public/mobileHelpers', () => ({ collapseOnMobile: vi.fn(), initBackToTop: vi.fn() }));
vi.mock('public/ReturnsPortal.js', () => ({ initReturnsSection: vi.fn() }));
vi.mock('public/storeCreditHelpers.js', () => ({ initStoreCreditDashboard: vi.fn() }));
vi.mock('public/giftCardHelpers.js', () => ({
  GIFT_CARD_DENOMINATIONS: [{ amount: 25, label: '' }, { amount: 50, label: '' }, { amount: 100, label: '' }, { amount: 150, label: '' }, { amount: 200, label: '' }, { amount: 500, label: '' }], initGiftCardDashboard: vi.fn() }));
vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));
vi.mock('public/cartService', () => ({ addToCart: vi.fn() }));

vi.mock('public/loyaltyHelpers.js', () => ({
  formatPoints: vi.fn((pts) => `${Number(pts).toLocaleString()} pts`),
  formatProgressText: vi.fn(() => '500 more points to Gold'),
  getProgressPercent: vi.fn((acc) => acc?.progress ?? 0),
  getTierColor: vi.fn(() => '#FFD700'),
  getTierIcon: vi.fn(() => '\u2B50'),
  canAffordReward: vi.fn(() => false),
  formatRewardCost: vi.fn(() => '500 pts'),
  buildTierComparisonData: vi.fn(() => []),
  getNextMilestone: vi.fn(() => null),
}));

vi.mock('public/MemberPageHelpers.js', () => ({
  mergeDeliveryStatus: vi.fn((orders) => orders),
  formatOrderDate: vi.fn((d) => d),
  formatOrderTotal: vi.fn(({ total }) => `$${total}`),
  formatOrderNumber: vi.fn((n) => `#${n}`),
  formatDeliveryEstimate: vi.fn((d) => d),
  formatItemCount: vi.fn((c) => `${c} items`),
  getOrderFilterOptions: vi.fn(() => []),
  filterOrdersByStatus: vi.fn((orders) => orders),
  buildTrackingUrl: vi.fn(() => '/tracking/1001'),
  isReturnEligible: vi.fn(() => false),
  buildOrderGalleryItems: vi.fn(() => []),
  getStatusColor: vi.fn(() => '#4CAF50'),
  formatAlertForDisplay: vi.fn((a) => a),
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn().mockResolvedValue({
      _id: 'mem-1',
      contactDetails: { firstName: 'Jane', emails: ['jane@test.com'], addresses: [] },
      loginEmail: 'jane@test.com',
    }),
  },
  authentication: { promptLogin: vi.fn(), logout: vi.fn() },
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({ items: [{ newsletter: true, saleAlerts: true, backInStock: true }] })),
      count: vi.fn(() => Promise.resolve(0)),
    })),
    update: vi.fn(() => Promise.resolve()),
    insert: vi.fn(() => Promise.resolve({ _id: 'pref-1' })),
  },
}));

vi.mock('wix-location-frontend', () => ({ to: vi.fn(), baseUrl: 'https://www.carolinafutons.com' }));
vi.mock('wix-window-frontend', () => ({ copyToClipboard: vi.fn(), openUrl: vi.fn(), reducedMotion: false }));

// ── Import page module ─────────────────────────────────────────────

await import('../src/pages/Member Page.js');

// ── Account fixtures ──────────────────────────────────────────────

const GOLD_ACCOUNT = {
  points: 1500, tier: 'Gold', nextTier: null,
  pointsToNext: 0, progress: 100, accountId: 'acc-gold-1',
};
const SILVER_ACCOUNT = {
  points: 500, tier: 'Silver', nextTier: 'Gold',
  pointsToNext: 1000, progress: 33, accountId: 'acc-silver-1',
};
const BRONZE_ACCOUNT = {
  points: 250, tier: 'Bronze', nextTier: 'Silver',
  pointsToNext: 250, progress: 50, accountId: 'acc-bronze-1',
};
const NEAR_TIER_ACCOUNT = {
  points: 499, tier: 'Bronze', nextTier: 'Silver',
  pointsToNext: 1, progress: 99, accountId: 'acc-near-1',
};
const ZERO_POINTS_ENROLLED = {
  points: 0, tier: 'Bronze', nextTier: 'Silver',
  pointsToNext: 500, progress: 0, accountId: 'acc-zero-1',
};
const NOT_ENROLLED = {
  points: 0, tier: 'Bronze', nextTier: 'Silver',
  pointsToNext: 500, progress: 0,
  // no accountId — default fallback for non-enrolled member
};

// ── Helper ────────────────────────────────────────────────────────

async function initPage(account) {
  elements.clear();
  vi.clearAllMocks();
  loyaltyMocks.getMyLoyaltyAccount.mockResolvedValue(account);
  loyaltyMocks.getAvailableRewards.mockResolvedValue([]);
  loyaltyMocks.getLoyaltyTiers.mockResolvedValue([]);
  if (onReadyHandler) await onReadyHandler();
}

// ── #loyaltyPointsDisplay ──────────────────────────────────────────

describe('#loyaltyPointsDisplay', () => {
  it('shows "1,500 points" for Gold member with 1500 points', async () => {
    await initPage(GOLD_ACCOUNT);
    expect(getEl('#loyaltyPointsDisplay').text).toBe('1,500 points');
  });

  it('shows "500 points" for Silver member', async () => {
    await initPage(SILVER_ACCOUNT);
    expect(getEl('#loyaltyPointsDisplay').text).toBe('500 points');
  });

  it('shows "0 points" for zero-points enrolled member', async () => {
    await initPage(ZERO_POINTS_ENROLLED);
    expect(getEl('#loyaltyPointsDisplay').text).toBe('0 points');
  });

  it('uses locale separators for large point values', async () => {
    await initPage({ ...GOLD_ACCOUNT, points: 12345 });
    expect(getEl('#loyaltyPointsDisplay').text).toBe('12,345 points');
  });
});

// ── #loyaltyTierDisplay ────────────────────────────────────────────

describe('#loyaltyTierDisplay', () => {
  it('shows "Gold Member" for Gold tier', async () => {
    await initPage(GOLD_ACCOUNT);
    expect(getEl('#loyaltyTierDisplay').text).toBe('Gold Member');
  });

  it('shows "Silver Member" for Silver tier', async () => {
    await initPage(SILVER_ACCOUNT);
    expect(getEl('#loyaltyTierDisplay').text).toBe('Silver Member');
  });

  it('shows "Bronze Member" for Bronze tier', async () => {
    await initPage(BRONZE_ACCOUNT);
    expect(getEl('#loyaltyTierDisplay').text).toBe('Bronze Member');
  });
});

// ── #loyaltyProgressBar ────────────────────────────────────────────

describe('#loyaltyProgressBar', () => {
  it('sets value to 75 for 75% progress', async () => {
    await initPage({ ...SILVER_ACCOUNT, progress: 75 });
    expect(getEl('#loyaltyProgressBar').value).toBe(75);
  });

  it('sets value to 0 for zero progress', async () => {
    await initPage({ ...BRONZE_ACCOUNT, progress: 0 });
    expect(getEl('#loyaltyProgressBar').value).toBe(0);
  });

  it('sets value to 100 for Gold (top tier)', async () => {
    await initPage(GOLD_ACCOUNT);
    expect(getEl('#loyaltyProgressBar').value).toBe(100);
  });

  it('sets value to 99 for near-tier member', async () => {
    await initPage(NEAR_TIER_ACCOUNT);
    expect(getEl('#loyaltyProgressBar').value).toBe(99);
  });
});

// ── #loyaltyNextTierText ───────────────────────────────────────────

describe('#loyaltyNextTierText', () => {
  it('shows "1,000 more points to Gold" for Silver member', async () => {
    await initPage(SILVER_ACCOUNT);
    expect(getEl('#loyaltyNextTierText').text).toBe('1,000 more points to Gold');
  });

  it('shows "250 more points to Silver" for Bronze member', async () => {
    await initPage(BRONZE_ACCOUNT);
    expect(getEl('#loyaltyNextTierText').text).toBe('250 more points to Silver');
  });

  it('shows singular "1 more point to Silver" when 1 point away', async () => {
    await initPage(NEAR_TIER_ACCOUNT);
    expect(getEl('#loyaltyNextTierText').text).toBe('1 more point to Silver');
  });

  it('shows top-tier message when nextTier is null (Gold member)', async () => {
    await initPage(GOLD_ACCOUNT);
    expect(getEl('#loyaltyNextTierText').text).toBe("You've reached the top tier!");
  });

  it('shows "500 more points to Silver" for zero-points enrolled Bronze', async () => {
    await initPage(ZERO_POINTS_ENROLLED);
    expect(getEl('#loyaltyNextTierText').text).toBe('500 more points to Silver');
  });
});

// ── #loyaltySection ────────────────────────────────────────────────

describe('#loyaltySection', () => {
  it('expands for enrolled member with points', async () => {
    await initPage(GOLD_ACCOUNT);
    expect(getEl('#loyaltySection').expand).toHaveBeenCalled();
    expect(getEl('#loyaltySection').collapse).not.toHaveBeenCalled();
  });

  it('expands for enrolled member with zero points (has accountId)', async () => {
    await initPage(ZERO_POINTS_ENROLLED);
    expect(getEl('#loyaltySection').expand).toHaveBeenCalled();
  });

  it('collapses for non-enrolled member (no accountId)', async () => {
    await initPage(NOT_ENROLLED);
    expect(getEl('#loyaltySection').collapse).toHaveBeenCalled();
    expect(getEl('#loyaltySection').expand).not.toHaveBeenCalled();
  });
});

// ── Error handling ────────────────────────────────────────────────

describe('loyalty section — error handling', () => {
  it('does not crash when getMyLoyaltyAccount throws', async () => {
    elements.clear();
    vi.clearAllMocks();
    loyaltyMocks.getMyLoyaltyAccount.mockRejectedValueOnce(new Error('Loyalty service down'));
    loyaltyMocks.getAvailableRewards.mockResolvedValue([]);
    loyaltyMocks.getLoyaltyTiers.mockResolvedValue([]);
    await expect(onReadyHandler()).resolves.not.toThrow();
  });

  it('collapses #loyaltySection when getMyLoyaltyAccount throws', async () => {
    elements.clear();
    vi.clearAllMocks();
    loyaltyMocks.getMyLoyaltyAccount.mockRejectedValueOnce(new Error('Loyalty service down'));
    loyaltyMocks.getAvailableRewards.mockResolvedValue([]);
    loyaltyMocks.getLoyaltyTiers.mockResolvedValue([]);
    await onReadyHandler().catch(() => {});
    expect(getEl('#loyaltySection').expand).not.toHaveBeenCalled();
  });
});

// ── Integration scenarios ─────────────────────────────────────────

describe('loyalty section — tier integration', () => {
  it('Bronze enrolled: correct points, tier, progress, next-tier text', async () => {
    await initPage(BRONZE_ACCOUNT);
    expect(getEl('#loyaltyPointsDisplay').text).toBe('250 points');
    expect(getEl('#loyaltyTierDisplay').text).toBe('Bronze Member');
    expect(getEl('#loyaltyProgressBar').value).toBe(50);
    expect(getEl('#loyaltyNextTierText').text).toBe('250 more points to Silver');
    expect(getEl('#loyaltySection').expand).toHaveBeenCalled();
  });

  it('Silver enrolled: correct points, tier, progress, next-tier text', async () => {
    await initPage(SILVER_ACCOUNT);
    expect(getEl('#loyaltyPointsDisplay').text).toBe('500 points');
    expect(getEl('#loyaltyTierDisplay').text).toBe('Silver Member');
    expect(getEl('#loyaltyProgressBar').value).toBe(33);
    expect(getEl('#loyaltyNextTierText').text).toBe('1,000 more points to Gold');
    expect(getEl('#loyaltySection').expand).toHaveBeenCalled();
  });

  it('Gold (top tier): shows top-tier message, 100% bar, section visible', async () => {
    await initPage(GOLD_ACCOUNT);
    expect(getEl('#loyaltyPointsDisplay').text).toBe('1,500 points');
    expect(getEl('#loyaltyTierDisplay').text).toBe('Gold Member');
    expect(getEl('#loyaltyProgressBar').value).toBe(100);
    expect(getEl('#loyaltyNextTierText').text).toBe("You've reached the top tier!");
    expect(getEl('#loyaltySection').expand).toHaveBeenCalled();
  });

  it('Not enrolled: section hidden', async () => {
    await initPage(NOT_ENROLLED);
    expect(getEl('#loyaltySection').collapse).toHaveBeenCalled();
  });
});

vi.mock('public/ZipLeaderboardDisplay.js', () => ({ initZipLeaderboardSection: vi.fn().mockResolvedValue(undefined) }));
vi.mock('backend/zipLeaderboard.web.js', () => ({ getZipLeaderboard: vi.fn().mockResolvedValue({ leaderboard: [], myRank: null, zipPrefix: null }) }));
