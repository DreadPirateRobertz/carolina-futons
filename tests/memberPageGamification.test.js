/**
 * @file memberPageGamification.test.js
 * @description TDD tests for CF-fla: achievements + daily quests wiring in Member Page.js.
 *
 * Covers:
 *  - On page load: achievements badges shown in #achievementsBadgeRepeater
 *  - On page load: #achievementsSection hidden when no achievements
 *  - On page load: daily quests populate #dailyQuestsRepeater
 *  - On page load: #questsCompleteText shows 'N of 3 complete'
 *  - On page load: #dailyQuestsSection hidden on error
 *
 * NOTE: webMethod implementation tests live in loyaltyService.test.js.
 * Follows memberPageStreak.test.js pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('public/ChallengesDisplay.js', async () => await vi.importActual('../src/public/ChallengesDisplay.js'));
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

const gamificationReceiverMocks = vi.hoisted(() => ({
  getActiveChallenges: vi.fn().mockResolvedValue({ challenges: [] }),
}));

const membersMocks = vi.hoisted(() => ({
  getMember: vi.fn(),
}));

const loyaltyMocks = vi.hoisted(() => ({
  getMyLoyaltyAccount: vi.fn().mockResolvedValue({
    points: 0, tier: 'Trail Blazer', nextTier: null, progress: 0, pointsToNext: 0,
  }),
  getAvailableRewards: vi.fn().mockResolvedValue([]),
  getLoyaltyTiers: vi.fn().mockResolvedValue([]),
  redeemReward: vi.fn().mockResolvedValue({ success: true }),
  getMyStreakData: vi.fn().mockResolvedValue({
    currentStreakDays: 0, streakMultiplier: 1, streakStartDate: null, lastActivityDate: null,
  }),
  getMyAchievements: vi.fn().mockResolvedValue({ achievements: [] }),
  getMyDailyQuests: vi.fn().mockResolvedValue({
    quests: [
      { id: 'purchase', title: 'Place an order today', action: 'purchase', pointReward: 50, completed: false, completedAt: null },
      { id: 'review', title: 'Write a product review', action: 'review', pointReward: 30, completed: false, completedAt: null },
      { id: 'referral', title: 'Refer a friend', action: 'referral', pointReward: 75, completed: false, completedAt: null },
    ],
    date: '2026-03-23',
  }),
}));

const spinMocks = vi.hoisted(() => ({
  getSpinEligibility: vi.fn().mockResolvedValue({ eligible: false, reason: 'ALREADY_SPUN', nextETMidnightMs: Date.now() + 3600000 }),
  spinWheel: vi.fn().mockResolvedValue({ success: true }),
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
  getMyStreakData: loyaltyMocks.getMyStreakData,
  getMyAchievements: loyaltyMocks.getMyAchievements,
  getMyDailyQuests: loyaltyMocks.getMyDailyQuests,
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

vi.mock('backend/gamificationEventReceiver.web', () => ({
  getActiveChallenges: gamificationReceiverMocks.getActiveChallenges,
  receiveGamificationEvent: vi.fn().mockResolvedValue({ success: true, newTotal: 0, tierChanged: false, newTier: 'Trail Blazer', pointsEarned: 0, badgeUnlocked: null }),
}));
vi.mock('backend/errorMonitoring.web', () => ({ logError: vi.fn() }));
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

const zipLeaderboardDisplayMocks = vi.hoisted(() => ({
  initZipLeaderboardSection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/ZipLeaderboardDisplay.js', () => ({
  initZipLeaderboardSection: zipLeaderboardDisplayMocks.initZipLeaderboardSection,
}));

vi.mock('backend/zipLeaderboard.web.js', () => ({
  getZipLeaderboard: vi.fn().mockResolvedValue({ leaderboard: [], myRank: null, zipPrefix: null }),
}));

vi.mock('public/StreakDisplay.js', () => ({
  buildStreakChipText: streakDisplayMocks.buildStreakChipText,
  buildMultiplierBadgeText: streakDisplayMocks.buildMultiplierBadgeText,
  buildToastText: streakDisplayMocks.buildToastText,
  shouldShowStreakChip: streakDisplayMocks.shouldShowStreakChip,
  updateStreakDisplay: streakDisplayMocks.updateStreakDisplay,
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: { getMember: membersMocks.getMember },
  authentication: { onLogin: vi.fn(), onLogout: vi.fn() },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: membersMocks.getMember },
}));

vi.mock('wix-location-frontend', () => ({ to: vi.fn(), baseUrl: 'https://www.carolinafutons.com' }));
vi.mock('wix-window-frontend', () => ({ openLightbox: vi.fn(), reducedMotion: false }));

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  __reset();
  vi.clearAllMocks();

  membersMocks.getMember.mockResolvedValue({
    _id: 'mem-1',
    contactDetails: { firstName: 'Jane', emails: ['jane@test.com'], addresses: [] },
    profile: { nickname: 'Jane', photo: { url: '' } },
    loginEmail: 'jane@test.com',
  });

  loyaltyMocks.getMyLoyaltyAccount.mockResolvedValue({
    points: 0, tier: 'Trail Blazer', nextTier: null, progress: 0, pointsToNext: 0,
  });
  loyaltyMocks.getAvailableRewards.mockResolvedValue([]);
  loyaltyMocks.getLoyaltyTiers.mockResolvedValue([]);
  loyaltyMocks.getMyStreakData.mockResolvedValue({
    currentStreakDays: 0, streakMultiplier: 1, streakStartDate: null, lastActivityDate: null,
  });
  loyaltyMocks.getMyAchievements.mockResolvedValue({ achievements: [] });
  loyaltyMocks.getMyDailyQuests.mockResolvedValue({
    quests: [
      { id: 'purchase', title: 'Place an order today', action: 'purchase', pointReward: 50, completed: false, completedAt: null },
      { id: 'review', title: 'Write a product review', action: 'review', pointReward: 30, completed: false, completedAt: null },
      { id: 'referral', title: 'Refer a friend', action: 'referral', pointReward: 75, completed: false, completedAt: null },
    ],
    date: '2026-03-23',
  });

  gamificationReceiverMocks.getActiveChallenges.mockResolvedValue({ challenges: [] });
  spinMocks.getSpinEligibility.mockResolvedValue({ eligible: false, reason: 'ALREADY_SPUN', nextETMidnightMs: Date.now() + 3600000 });
  streakDisplayMocks.shouldShowStreakChip.mockImplementation((d) => typeof d === 'number' && d >= 1);
  streakDisplayMocks.buildStreakChipText.mockImplementation((d) => `🔥 ${d}-day streak`);
  streakDisplayMocks.buildMultiplierBadgeText.mockImplementation((m) => m > 1 ? `${m}× points` : '');
  streakDisplayMocks.buildToastText.mockImplementation(() => 'Streak extended!');
});

async function loadPage() {
// ── Auto-added by cf-obz ──────────────────────────────────────────
vi.mock('public/productCardHelpers.js', () => ({
  renderSimplePrice: vi.fn(),
  setCardImage: vi.fn(),
  styleCardContainer: vi.fn(),
  styleBadge: vi.fn(),
}));
// ChallengesDisplay NOT mocked — tests assert real getActiveChallenges
// call and #challengesList repeater population.
// ── End auto-added ─────────────────────────────────────────────────
  await import('../src/pages/Member Page.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Achievements section ──────────────────────────────────────────────────────

describe('Member Page — achievements section on load', () => {
  it('populates #achievementsBadgeRepeater with earned badges', async () => {
    loyaltyMocks.getMyAchievements.mockResolvedValue({
      achievements: [
        { milestone: 7, badgeLabel: 'Week Warrior', earnedAt: new Date('2026-03-16') },
        { milestone: 14, badgeLabel: 'Fortnight Fighter', earnedAt: new Date('2026-03-22') },
      ],
    });
    await loadPage();
    const repeater = getEl('#achievementsBadgeRepeater');
    expect(repeater.data).toHaveLength(2);
    expect(repeater.data[0].badgeLabel).toBe('Week Warrior');
    expect(repeater.data[1].badgeLabel).toBe('Fortnight Fighter');
  });

  it('shows #achievementsSection when achievements are present', async () => {
    loyaltyMocks.getMyAchievements.mockResolvedValue({
      achievements: [{ milestone: 7, badgeLabel: 'Week Warrior', earnedAt: new Date() }],
    });
    await loadPage();
    expect(getEl('#achievementsSection').show).toHaveBeenCalled();
    expect(getEl('#achievementsSection').hide).not.toHaveBeenCalled();
  });

  it('hides #achievementsSection when no achievements earned', async () => {
    loyaltyMocks.getMyAchievements.mockResolvedValue({ achievements: [] });
    await loadPage();
    expect(getEl('#achievementsSection').hide).toHaveBeenCalled();
  });

  it('hides #achievementsSection on getMyAchievements error', async () => {
    loyaltyMocks.getMyAchievements.mockRejectedValue(new Error('network error'));
    await loadPage();
    expect(getEl('#achievementsSection').hide).toHaveBeenCalled();
  });

  it('does not throw when getMyAchievements fails', async () => {
    loyaltyMocks.getMyAchievements.mockRejectedValue(new Error('network error'));
    await expect(loadPage()).resolves.not.toThrow();
  });

  it('calls onItemReady on #achievementsBadgeRepeater when achievements present', async () => {
    loyaltyMocks.getMyAchievements.mockResolvedValue({
      achievements: [{ milestone: 7, badgeLabel: 'Week Warrior', earnedAt: new Date() }],
    });
    await loadPage();
    expect(getEl('#achievementsBadgeRepeater').onItemReady).toHaveBeenCalled();
  });

  it('registers onItemReady before setting repeater.data (achievements)', async () => {
    loyaltyMocks.getMyAchievements.mockResolvedValue({
      achievements: [{ milestone: 7, badgeLabel: 'Week Warrior', earnedAt: new Date() }],
    });
    const repeater = getEl('#achievementsBadgeRepeater');
    let dataAtRegistration;
    repeater.onItemReady.mockImplementationOnce(() => {
      dataAtRegistration = repeater.data;
    });
    await loadPage();
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(dataAtRegistration).toEqual([]); // data was empty when onItemReady was registered
  });

  it('hides #achievementsSection when getMyAchievements returns rate-limit response (no achievements key)', async () => {
    loyaltyMocks.getMyAchievements.mockResolvedValue({ status: 429, error: 'Rate limit exceeded' });
    await loadPage();
    expect(getEl('#achievementsSection').hide).toHaveBeenCalled();
  });
});

// ── Daily quests section ──────────────────────────────────────────────────────

describe('Member Page — daily quests section on load', () => {
  it('populates #dailyQuestsRepeater with quest data', async () => {
    await loadPage();
    const repeater = getEl('#dailyQuestsRepeater');
    expect(repeater.data).toHaveLength(3);
    expect(repeater.data[0].title).toBe('Place an order today');
    expect(repeater.data[0].pointReward).toBe(50);
  });

  it('shows #questsCompleteText with correct count of completed quests', async () => {
    loyaltyMocks.getMyDailyQuests.mockResolvedValue({
      quests: [
        { id: 'purchase', title: 'Place an order today', action: 'purchase', pointReward: 50, completed: true, completedAt: new Date() },
        { id: 'review', title: 'Write a product review', action: 'review', pointReward: 30, completed: false, completedAt: null },
        { id: 'referral', title: 'Refer a friend', action: 'referral', pointReward: 75, completed: false, completedAt: null },
      ],
      date: '2026-03-23',
    });
    await loadPage();
    const progressText = getEl('#questsCompleteText');
    expect(progressText.text).toBe('1 of 3 complete');
  });

  it('shows "0 of 3 complete" when no quests done', async () => {
    await loadPage();
    expect(getEl('#questsCompleteText').text).toBe('0 of 3 complete');
  });

  it('shows "3 of 3 complete" when all quests done', async () => {
    loyaltyMocks.getMyDailyQuests.mockResolvedValue({
      quests: [
        { id: 'purchase', title: 'Place an order today', action: 'purchase', pointReward: 50, completed: true, completedAt: new Date() },
        { id: 'review', title: 'Write a product review', action: 'review', pointReward: 30, completed: true, completedAt: new Date() },
        { id: 'referral', title: 'Refer a friend', action: 'referral', pointReward: 75, completed: true, completedAt: new Date() },
      ],
      date: '2026-03-23',
    });
    await loadPage();
    expect(getEl('#questsCompleteText').text).toBe('3 of 3 complete');
  });

  it('hides #dailyQuestsSection on getMyDailyQuests error', async () => {
    loyaltyMocks.getMyDailyQuests.mockRejectedValue(new Error('service unavailable'));
    await loadPage();
    expect(getEl('#dailyQuestsSection').hide).toHaveBeenCalled();
  });

  it('does not throw when getMyDailyQuests fails', async () => {
    loyaltyMocks.getMyDailyQuests.mockRejectedValue(new Error('service unavailable'));
    await expect(loadPage()).resolves.not.toThrow();
  });

  it('hides #dailyQuestsSection when quests is null (feature flag off)', async () => {
    loyaltyMocks.getMyDailyQuests.mockResolvedValue({ quests: null });
    await loadPage();
    expect(getEl('#dailyQuestsSection').hide).toHaveBeenCalled();
  });

  it('shows #dailyQuestsSection on happy path', async () => {
    await loadPage();
    expect(getEl('#dailyQuestsSection').show).toHaveBeenCalled();
  });

  it('calls onItemReady on #dailyQuestsRepeater when quests present', async () => {
    await loadPage();
    expect(getEl('#dailyQuestsRepeater').onItemReady).toHaveBeenCalled();
  });

  it('registers onItemReady before setting repeater.data (quests)', async () => {
    const repeater = getEl('#dailyQuestsRepeater');
    let dataAtRegistration;
    repeater.onItemReady.mockImplementationOnce(() => {
      dataAtRegistration = repeater.data;
    });
    await loadPage();
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(dataAtRegistration).toEqual([]); // data was empty when onItemReady was registered
  });

  it('hides #dailyQuestsSection when getMyDailyQuests returns rate-limit response (no quests key)', async () => {
    loyaltyMocks.getMyDailyQuests.mockResolvedValue({ status: 429, error: 'Rate limit exceeded' });
    await loadPage();
    expect(getEl('#dailyQuestsSection').hide).toHaveBeenCalled();
  });
});

// ── Challenges display section (CF-wire2) ─────────────────────────────────────

describe('Member Page — challenges display section on load', () => {
  it('shows #challengesSection and populates #challengesList when challenges exist', async () => {
    gamificationReceiverMocks.getActiveChallenges.mockResolvedValue({
      challenges: [
        { challengeId: 'ch-1', title: 'Order 3 Times', description: '', progressValue: 1, targetCount: 3, rewardPoints: 50, expiresAt: '2026-04-01T00:00:00Z', completedAt: null },
        { challengeId: 'ch-2', title: 'Write a Review', description: '', progressValue: 0, targetCount: 1, rewardPoints: 25, expiresAt: '2026-04-01T00:00:00Z', completedAt: null },
      ],
    });

    await loadPage();

    expect(getEl('#challengesSection').show).toHaveBeenCalled();
    expect(getEl('#challengesList').data).toHaveLength(2);
    expect(getEl('#challengesList').data[0]._id).toBe('ch-1');
    expect(getEl('#challengesList').data[1]._id).toBe('ch-2');
  });

  it('hides #challengesSection when no challenges returned', async () => {
    gamificationReceiverMocks.getActiveChallenges.mockResolvedValue({ challenges: [] });

    await loadPage();

    expect(getEl('#challengesSection').hide).toHaveBeenCalled();
    expect(getEl('#challengesSection').show).not.toHaveBeenCalled();
  });

  it('hides #challengesSection on getActiveChallenges error', async () => {
    gamificationReceiverMocks.getActiveChallenges.mockRejectedValue(new Error('service unavailable'));

    await loadPage();

    expect(getEl('#challengesSection').hide).toHaveBeenCalled();
  });

  it('does not throw when getActiveChallenges fails', async () => {
    gamificationReceiverMocks.getActiveChallenges.mockRejectedValue(new Error('service unavailable'));
    await expect(loadPage()).resolves.not.toThrow();
  });

  it('calls getActiveChallenges with the current member ID', async () => {
    gamificationReceiverMocks.getActiveChallenges.mockResolvedValue({ challenges: [] });

    await loadPage();

    expect(gamificationReceiverMocks.getActiveChallenges).toHaveBeenCalledWith('mem-1');
  });

  it('wires onItemReady on #challengesList repeater when challenges present', async () => {
    gamificationReceiverMocks.getActiveChallenges.mockResolvedValue({
      challenges: [
        { challengeId: 'ch-1', title: 'Test', description: '', progressValue: 0, targetCount: 1, rewardPoints: 10, expiresAt: null, completedAt: null },
      ],
    });

    await loadPage();

    expect(getEl('#challengesList').onItemReady).toHaveBeenCalled();
  });
});

// ── ZIP Leaderboard section (cf-shr) ──────────────────────────────────────────

describe('Member Page — ZIP leaderboard section on load', () => {
  it('calls initZipLeaderboardSection on page load', async () => {
    await loadPage();
    expect(zipLeaderboardDisplayMocks.initZipLeaderboardSection).toHaveBeenCalledOnce();
  });

  it('passes #zipLeaderboardSection element to initZipLeaderboardSection', async () => {
    await loadPage();
    const [els] = zipLeaderboardDisplayMocks.initZipLeaderboardSection.mock.calls[0];
    expect(els.$section).toBeDefined();
  });

  it('passes getZipLeaderboard as the fetch function', async () => {
    await loadPage();
    const [, fetchFn] = zipLeaderboardDisplayMocks.initZipLeaderboardSection.mock.calls[0];
    expect(typeof fetchFn).toBe('function');
  });

  it('does not throw when initZipLeaderboardSection rejects', async () => {
    zipLeaderboardDisplayMocks.initZipLeaderboardSection.mockRejectedValueOnce(new Error('network'));
    await expect(loadPage()).resolves.not.toThrow();
  });
});
