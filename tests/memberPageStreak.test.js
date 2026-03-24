/**
 * @file memberPageStreak.test.js
 * @description TDD tests for CF-64k: streak display wiring in Member Page.js.
 *
 * Covers:
 *  - On page load: streak chip shows currentStreakDays when >= 1
 *  - On page load: streak chip hidden when streak = 0 or member has no streak data
 *  - On page load: multiplier badge shows when streakMultiplier > 1
 *  - On page load: multiplier badge hidden when multiplier = 1 (no bonus)
 *
 * NOTE: getMyStreakData backend webMethod tests live in getMyStreakData.test.js.
 * vi.importActual loads the real module into the shared module cache, which
 * bypasses vi.mock for dynamic imports here — keeping them separate avoids this.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset } from './__mocks__/wix-data.js';

// ── $w mock infrastructure ─────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    collapsed: false,
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onMessage: vi.fn(),
    postMessage: vi.fn(),
    scrollTo: vi.fn(),
    value: '',
    data: [],
    src: '',
    alt: '',
    label: '',
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

// ── Hoisted mock refs ─────────────────────────────────────────────────────────

const membersMocks = vi.hoisted(() => ({
  getMember: vi.fn(),
}));

const streakMocks = vi.hoisted(() => ({
  getMyStreakData: vi.fn(),
}));

const gamificationMocks = vi.hoisted(() => ({
  getActiveChallenges: vi.fn().mockResolvedValue([]),
  recoverStreak: vi.fn(),
}));

const loyaltyMocks = vi.hoisted(() => ({
  getMyLoyaltyAccount: vi.fn().mockResolvedValue({
    points: 0, tier: 'Trail Blazer', nextTier: null, progress: 0, pointsToNext: 0,
  }),
  getAvailableRewards: vi.fn().mockResolvedValue([]),
  getLoyaltyTiers: vi.fn().mockResolvedValue([]),
  redeemReward: vi.fn().mockResolvedValue({ success: true }),
}));

const spinMocks = vi.hoisted(() => ({
  getSpinEligibility: vi.fn().mockResolvedValue({ eligible: false, reason: 'ALREADY_SPUN', nextETMidnightMs: Date.now() + 3600000 }),
  spinWheel: vi.fn().mockResolvedValue({ success: false }),
}));

const streakDisplayMocks = vi.hoisted(() => ({
  buildStreakChipText: vi.fn((d) => `🔥 ${d}-day streak`),
  buildMultiplierBadgeText: vi.fn((m) => m > 1 ? `${m}× points` : ''),
  buildToastText: vi.fn(() => 'Streak extended!'),
  shouldShowStreakChip: vi.fn((d) => typeof d === 'number' && d >= 1),
  updateStreakDisplay: vi.fn(),
}));

// ── vi.mock calls ─────────────────────────────────────────────────────────────

vi.mock('backend/loyaltyService.web', () => ({
  getMyLoyaltyAccount: loyaltyMocks.getMyLoyaltyAccount,
  getAvailableRewards: loyaltyMocks.getAvailableRewards,
  getLoyaltyTiers: loyaltyMocks.getLoyaltyTiers,
  redeemReward: loyaltyMocks.redeemReward,
  getMyStreakData: streakMocks.getMyStreakData,
}));

vi.mock('backend/spinWheel.web', () => ({
  getSpinEligibility: spinMocks.getSpinEligibility,
  spinWheel: spinMocks.spinWheel,
}));

vi.mock('backend/accountDashboard.web', () => ({
  getOrderHistory: vi.fn().mockResolvedValue({ success: true, data: { orders: [], hasNext: false } }),
  getActiveDeliveries: vi.fn().mockResolvedValue({ success: true, data: { deliveries: [] } }),
  getWishlist: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
  moveWishlistToCart: vi.fn().mockResolvedValue({ success: true }),
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
vi.mock('backend/gamificationEventReceiver.web', () => ({
  getActiveChallenges: gamificationMocks.getActiveChallenges,
  recoverStreak: gamificationMocks.recoverStreak,
}));
vi.mock('backend/notificationService.web', () => ({ toggleProductAlerts: vi.fn() }));

vi.mock('public/engagementTracker', () => ({ trackEvent: vi.fn() }));
vi.mock('public/a11yHelpers', () => ({ announce: vi.fn() }));
vi.mock('public/designTokens.js', () => ({
  colors: { mountain: '#5B8FA8', forest: '#2E4A38' },
}));
vi.mock('public/mobileHelpers', () => ({ collapseOnMobile: vi.fn(), initBackToTop: vi.fn() }));
vi.mock('public/ReturnsPortal.js', () => ({ initReturnsSection: vi.fn() }));
vi.mock('public/storeCreditHelpers.js', () => ({ initStoreCreditDashboard: vi.fn() }));
vi.mock('public/giftCardHelpers.js', () => ({
  initGiftCardDashboard: vi.fn(),
  getGiftCardBalance: vi.fn().mockResolvedValue({ balance: 0 }),
}));
vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));
vi.mock('public/cartService', () => ({ addToCart: vi.fn() }));

vi.mock('public/loyaltyHelpers.js', () => ({
  formatPoints: vi.fn((p) => `${p} pts`),
  formatProgressText: vi.fn(() => ''),
  getProgressPercent: vi.fn(() => 0),
  getTierColor: vi.fn(() => '#333'),
  getTierIcon: vi.fn(() => '⭐'),
  canAffordReward: vi.fn(() => false),
  formatRewardCost: vi.fn(() => ''),
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
  safeSessionGet: vi.fn(() => null),
  safeSessionSet: vi.fn(),
  safeSessionRemove: vi.fn(),
}));

vi.mock('public/SpinWheel.js', () => ({
  buildWheelSegments: vi.fn(() => []),
  computeCountdown: vi.fn(() => '23:59:59'),
  renderPendingPrizes: vi.fn(() => []),
  renderSpinResult: vi.fn(() => ({})),
}));

vi.mock('public/StreakDisplay.js', () => ({
  buildStreakChipText: streakDisplayMocks.buildStreakChipText,
  buildMultiplierBadgeText: streakDisplayMocks.buildMultiplierBadgeText,
  buildToastText: streakDisplayMocks.buildToastText,
  shouldShowStreakChip: streakDisplayMocks.shouldShowStreakChip,
  updateStreakDisplay: streakDisplayMocks.updateStreakDisplay,
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: membersMocks.getMember,
  },
  authentication: {
    onLogin: vi.fn(),
    onLogout: vi.fn(),
  },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: membersMocks.getMember,
  },
}));

vi.mock('wix-location-frontend', () => ({ to: vi.fn(), baseUrl: 'https://www.carolinafutons.com' }));
vi.mock('wix-window-frontend', () => ({ openLightbox: vi.fn(), reducedMotion: false }));

beforeEach(() => {
  elements.clear();
  // onReadyHandler is preserved so the cached module's $w.onReady handler stays registered
  __reset();
  vi.clearAllMocks();
  // Re-apply getMember (vi.clearAllMocks resets vi.fn implementations in Vitest 4)
  membersMocks.getMember.mockResolvedValue({
    _id: 'mem-1',
    contactDetails: { firstName: 'Jane', emails: ['jane@test.com'], addresses: [] },
    profile: { nickname: 'Jane', photo: { url: '' } },
    loginEmail: 'jane@test.com',
  });
  streakMocks.getMyStreakData.mockResolvedValue({
    currentStreakDays: 0,
    streakMultiplier: 1,
    streakStartDate: null,
    lastActivityDate: null,
    totalPoints: 0,
    lastStreakRecoveryDate: null,
  });
  gamificationMocks.getActiveChallenges.mockResolvedValue([]);
  gamificationMocks.recoverStreak.mockResolvedValue({ success: true, newTotal: 50, currentStreakDays: 1 });
  // Re-apply default mocks after clearAllMocks
  loyaltyMocks.getMyLoyaltyAccount.mockResolvedValue({
    points: 0, tier: 'Trail Blazer', nextTier: null, progress: 0, pointsToNext: 0,
  });
  loyaltyMocks.getAvailableRewards.mockResolvedValue([]);
  loyaltyMocks.getLoyaltyTiers.mockResolvedValue([]);
  spinMocks.getSpinEligibility.mockResolvedValue({
    eligible: false, reason: 'ALREADY_SPUN', nextETMidnightMs: Date.now() + 3600000,
  });
  // Re-apply StreakDisplay helper implementations (vi.clearAllMocks resets them in Vitest 4)
  streakDisplayMocks.shouldShowStreakChip.mockImplementation((d) => typeof d === 'number' && d >= 1);
  streakDisplayMocks.buildStreakChipText.mockImplementation((d) => `🔥 ${d}-day streak`);
  streakDisplayMocks.buildMultiplierBadgeText.mockImplementation((m) => m > 1 ? `${m}× points` : '');
  streakDisplayMocks.buildToastText.mockImplementation(() => 'Streak extended!');
});

async function loadPage() {
  await import('../src/pages/Member Page.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Member Page.js — streak display on page load ─────────────────────────────

describe('Member Page — streak display on load', () => {
  it('shows #streakCountChip when currentStreakDays >= 1', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 3, streakMultiplier: 1.5,
      streakStartDate: '2026-03-20', lastActivityDate: '2026-03-22',
    });
    await loadPage();
    const chip = getEl('#streakCountChip');
    expect(chip.show).toHaveBeenCalled();
    expect(chip.text).toContain('3');
  });

  it('hides #streakCountChip when currentStreakDays = 0', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: null,
    });
    await loadPage();
    const chip = getEl('#streakCountChip');
    expect(chip.hide).toHaveBeenCalled();
  });

  it('shows #streakMultiplierBadge when streakMultiplier > 1', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 7, streakMultiplier: 2,
      streakStartDate: '2026-03-16', lastActivityDate: '2026-03-22',
    });
    await loadPage();
    const badge = getEl('#streakMultiplierBadge');
    expect(badge.show).toHaveBeenCalled();
    expect(badge.text).toContain('2×');
  });

  it('hides #streakMultiplierBadge when streakMultiplier = 1', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 2, streakMultiplier: 1,
      streakStartDate: '2026-03-21', lastActivityDate: '2026-03-22',
    });
    await loadPage();
    const badge = getEl('#streakMultiplierBadge');
    expect(badge.hide).toHaveBeenCalled();
  });

  it('does not throw when streak elements are missing (graceful degradation)', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 5, streakMultiplier: 1.5,
      streakStartDate: '2026-03-18', lastActivityDate: '2026-03-22',
    });
    // Make $w('#streakCountChip').show throw to simulate missing element
    getEl('#streakCountChip').show = vi.fn().mockRejectedValue(new Error('element not found'));
    await expect(loadPage()).resolves.not.toThrow();
  });

  it('does not show streak chip when getMyStreakData fails', async () => {
    streakMocks.getMyStreakData.mockRejectedValue(new Error('Network error'));
    await loadPage();
    const chip = getEl('#streakCountChip');
    expect(chip.show).not.toHaveBeenCalled();
  });
});

vi.mock('public/ZipLeaderboardDisplay.js', () => ({ initZipLeaderboardSection: vi.fn().mockResolvedValue(undefined) }));
vi.mock('backend/zipLeaderboard.web.js', () => ({ getZipLeaderboard: vi.fn().mockResolvedValue({ leaderboard: [], myRank: null, zipPrefix: null }) }));

// ── Streak recovery CTA ───────────────────────────────────────────────────────

describe('Member Page — streak recovery CTA', () => {
  it('shows #streakRecoveryCTA when streak=0, points>=50, no cooldown', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: null,
      totalPoints: 100, lastStreakRecoveryDate: null,
    });
    await loadPage();
    expect(getEl('#streakRecoveryCTA').show).toHaveBeenCalled();
  });

  it('hides #streakRecoveryCTA when streak is active (>0)', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 3, streakMultiplier: 1.5,
      streakStartDate: '2026-03-21', lastActivityDate: '2026-03-23',
      totalPoints: 200, lastStreakRecoveryDate: null,
    });
    await loadPage();
    expect(getEl('#streakRecoveryCTA').hide).toHaveBeenCalled();
  });

  it('hides #streakRecoveryCTA when points < 50', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: null,
      totalPoints: 20, lastStreakRecoveryDate: null,
    });
    await loadPage();
    expect(getEl('#streakRecoveryCTA').hide).toHaveBeenCalled();
  });

  it('hides #streakRecoveryCTA when recovery is on 30-day cooldown', async () => {
    // lastStreakRecoveryDate is 5 days ago — cooldown not elapsed
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const dateStr = fiveDaysAgo.toISOString().slice(0, 10);
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: null,
      totalPoints: 200, lastStreakRecoveryDate: dateStr,
    });
    await loadPage();
    expect(getEl('#streakRecoveryCTA').hide).toHaveBeenCalled();
  });

  it('shows #streakRecoveryCTA when prior recovery was >30 days ago', async () => {
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    const dateStr = thirtyOneDaysAgo.toISOString().slice(0, 10);
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: null,
      totalPoints: 100, lastStreakRecoveryDate: dateStr,
    });
    await loadPage();
    expect(getEl('#streakRecoveryCTA').show).toHaveBeenCalled();
  });

  it('calls recoverStreak with memberId on CTA click', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: null,
      totalPoints: 100, lastStreakRecoveryDate: null,
    });
    await loadPage();
    const cta = getEl('#streakRecoveryCTA');
    // Simulate click
    const clickHandler = cta.onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();
    await clickHandler();
    expect(gamificationMocks.recoverStreak).toHaveBeenCalledWith('mem-1');
  });

  it('hides CTA and shows streak chip after successful recovery', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: null,
      totalPoints: 100, lastStreakRecoveryDate: null,
    });
    gamificationMocks.recoverStreak.mockResolvedValue({ success: true, newTotal: 50, currentStreakDays: 1 });
    await loadPage();
    const cta = getEl('#streakRecoveryCTA');
    const clickHandler = cta.onClick.mock.calls[0]?.[0];
    await clickHandler();
    expect(cta.hide).toHaveBeenCalled();
    expect(getEl('#streakCountChip').show).toHaveBeenCalled();
  });

  it('re-enables CTA when recoverStreak returns success:false', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: null,
      totalPoints: 100, lastStreakRecoveryDate: null,
    });
    gamificationMocks.recoverStreak.mockResolvedValue({ success: false, error: 'cooldown' });
    await loadPage();
    const cta = getEl('#streakRecoveryCTA');
    const clickHandler = cta.onClick.mock.calls[0]?.[0];
    await clickHandler();
    expect(cta.enable).toHaveBeenCalled();
  });

  it('re-enables CTA when recoverStreak throws', async () => {
    streakMocks.getMyStreakData.mockResolvedValue({
      currentStreakDays: 0, streakMultiplier: 1,
      streakStartDate: null, lastActivityDate: null,
      totalPoints: 100, lastStreakRecoveryDate: null,
    });
    gamificationMocks.recoverStreak.mockRejectedValue(new Error('network'));
    await loadPage();
    const cta = getEl('#streakRecoveryCTA');
    const clickHandler = cta.onClick.mock.calls[0]?.[0];
    await clickHandler();
    expect(cta.enable).toHaveBeenCalled();
  });
});
