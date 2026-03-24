/**
 * CF-ofi: Spin wheel section integration — Member Page.js
 *
 * Tests: initSpinSection init, eligibility-driven UI, spin button click,
 * pending prizes panel, safeSession prize cache.
 */
import { describe, it, expect, vi } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';

// ── $w mock ──────────────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', value: 0, label: '', src: '', alt: '', data: [],
    collapsed: false,
    style: { color: '', borderColor: '', opacity: 1 },
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
    play: vi.fn(),
    stop: vi.fn(),
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
  { onReady: (fn) => { onReadyHandler = fn; } },
);

// ── Hoist spin mocks ──────────────────────────────────────────────────────────

const spinMocks = vi.hoisted(() => ({
  spinWheel: vi.fn(),
  getSpinEligibility: vi.fn(),
}));

// ── vi.mock calls ─────────────────────────────────────────────────────────────

vi.mock('backend/spinWheel.web', () => ({
  spinWheel: spinMocks.spinWheel,
  getSpinEligibility: spinMocks.getSpinEligibility,
}));

// Standard Member Page deps
vi.mock('backend/loyaltyService.web', () => ({
  getMyLoyaltyAccount: vi.fn().mockResolvedValue({
    points: 500, tier: 'Silver', progress: 50, accountId: 'acc-1',
    nextTier: 'Gold', pointsToNext: 1000,
  }),
  getAvailableRewards: vi.fn().mockResolvedValue([]),
  getLoyaltyTiers: vi.fn().mockResolvedValue([]),
  redeemReward: vi.fn().mockResolvedValue({ success: true }),
  getMyStreakData: vi.fn().mockResolvedValue({ currentStreakDays: 0, streakMultiplier: 1, streakStartDate: null, lastActivityDate: null }),
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
  GIFT_CARD_DENOMINATIONS: [{ amount: 25, label: '' }],
  initGiftCardDashboard: vi.fn(),
}));
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

vi.mock('wix-location-frontend', () => ({ to: vi.fn(), baseUrl: 'https://www.carolinafutons.com' }));
vi.mock('wix-window-frontend', () => ({ copyToClipboard: vi.fn(), openUrl: vi.fn(), reducedMotion: false }));

// ── Import page module once ──────────────────────────────────────────────────

await import('../src/pages/Member Page.js');

const { trackEvent } = await import('public/engagementTracker');

// ── Prize fixture ────────────────────────────────────────────────────────────

const POINTS_PRIZE = {
  _id: 'sp-1', active: true, weight: 10,
  prizeType: 'POINTS', pointsAwarded: 50, label: '50 Points', name: '50 Points',
};

const SPIN_SUCCESS = {
  success: true, spinType: 'DAILY',
  prize: { type: 'POINTS', label: '50 Points', pointsAwarded: 50 },
  isFallback: false,
};

// ── Init helper ──────────────────────────────────────────────────────────────

async function initPage(overrides = {}) {
  elements.clear();
  vi.clearAllMocks();

  spinMocks.getSpinEligibility.mockResolvedValue(
    overrides.eligibility ?? { eligible: true, spinType: 'DAILY', nextETMidnightMs: 3600 * 1000 }
  );

  if (overrides.prizes) __seed('SpinPrizes', overrides.prizes);
  if (overrides.pendingPrizes) __seed('MemberPendingPrizes', overrides.pendingPrizes);

  if (onReadyHandler) await onReadyHandler();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Member Page — initSpinSection', () => {
  // ── Section init ──────────────────────────────────────────────────────────

  it('expands #spinWheelSection on init', async () => {
    await initPage();
    expect(getEl('#spinWheelSection').expand).toHaveBeenCalled();
  });

  it('calls getSpinEligibility with memberId on mount', async () => {
    await initPage();
    expect(spinMocks.getSpinEligibility).toHaveBeenCalledWith('mem-1');
  });

  it('renders SVG wheel when SpinPrizes exist', async () => {
    await initPage({ prizes: [POINTS_PRIZE] });
    // SVG data URI assigned to #spinWheelSVG.src
    expect(getEl('#spinWheelSVG').src).toMatch(/^data:image\/svg\+xml/);
  });

  it('does not set SVG src when no prizes', async () => {
    await initPage({ prizes: [] });
    expect(getEl('#spinWheelSVG').src).toBe('');
  });

  // ── updateSpinUI — ineligible ─────────────────────────────────────────────

  describe('updateSpinUI — ineligible', () => {
    it('disables spin button when ineligible', async () => {
      await initPage({
        eligibility: { eligible: false, reason: 'ALREADY_SPUN', nextETMidnightMs: 2 * 3600 * 1000 },
      });
      expect(getEl('#spinButton').disable).toHaveBeenCalled();
    });

    it('shows countdown text when ineligible', async () => {
      await initPage({
        eligibility: { eligible: false, reason: 'ALREADY_SPUN', nextETMidnightMs: 2 * 3600 * 1000 },
      });
      expect(getEl('#spinCountdown').show).toHaveBeenCalled();
      expect(getEl('#spinCountdown').text).toMatch(/Next spin in/);
    });

    it('hides bonus chip when ineligible', async () => {
      await initPage({
        eligibility: { eligible: false, reason: 'ALREADY_SPUN', nextETMidnightMs: 0 },
      });
      expect(getEl('#spinBonusChip').hide).toHaveBeenCalled();
    });
  });

  // ── updateSpinUI — eligible DAILY ────────────────────────────────────────

  describe('updateSpinUI — eligible DAILY', () => {
    it('enables spin button', async () => {
      await initPage();
      expect(getEl('#spinButton').enable).toHaveBeenCalled();
    });

    it('hides countdown', async () => {
      await initPage();
      expect(getEl('#spinCountdown').hide).toHaveBeenCalled();
    });

    it('hides bonus chip for DAILY spin', async () => {
      await initPage();
      expect(getEl('#spinBonusChip').hide).toHaveBeenCalled();
    });
  });

  // ── updateSpinUI — eligible BONUS ────────────────────────────────────────

  describe('updateSpinUI — eligible BONUS', () => {
    it('shows bonus chip with remaining count', async () => {
      await initPage({
        eligibility: {
          eligible: true, spinType: 'BONUS',
          bonusSpinsRemaining: 2, nextETMidnightMs: 3600 * 1000,
        },
      });
      expect(getEl('#spinBonusChip').show).toHaveBeenCalled();
      expect(getEl('#spinBonusChip').text).toContain('2');
    });

    it('enables button for BONUS spin', async () => {
      await initPage({
        eligibility: { eligible: true, spinType: 'BONUS', bonusSpinsRemaining: 1, nextETMidnightMs: 0 },
      });
      expect(getEl('#spinButton').enable).toHaveBeenCalled();
    });
  });

  // ── Spin button onClick ───────────────────────────────────────────────────

  describe('spin button onClick', () => {
    it('registers onClick handler exactly once', async () => {
      await initPage();
      expect(getEl('#spinButton').onClick).toHaveBeenCalledTimes(1);
    });

    it('calls spinWheel with memberId on click', async () => {
      spinMocks.spinWheel.mockResolvedValue(SPIN_SUCCESS);
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(spinMocks.spinWheel).toHaveBeenCalledWith('mem-1');
    });

    it('shows win headline with points amount on success', async () => {
      spinMocks.spinWheel.mockResolvedValue(SPIN_SUCCESS);
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#spinResultText').text).toContain('50');
      expect(getEl('#spinResultText').show).toHaveBeenCalled();
    });

    it('shows win headline with prize name for non-points prize', async () => {
      spinMocks.spinWheel.mockResolvedValue({
        success: true, spinType: 'DAILY',
        prize: { type: 'FREE_SHIP', label: 'Free Shipping', pointsAwarded: 0 },
        isFallback: false,
      });
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#spinResultText').text).toContain('Free Shipping');
    });

    it('shows RACE_CONDITION message on that error', async () => {
      spinMocks.spinWheel.mockResolvedValue({ success: false, error: 'RACE_CONDITION' });
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#spinResultText').text).toBe('Already spun today!');
    });

    it('shows generic fail message on other errors', async () => {
      spinMocks.spinWheel.mockResolvedValue({ success: false, error: 'NOT_ELIGIBLE' });
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#spinResultText').text).toContain('try again');
    });

    it('re-queries eligibility after successful spin', async () => {
      spinMocks.spinWheel.mockResolvedValue(SPIN_SUCCESS);
      spinMocks.getSpinEligibility.mockResolvedValue({
        eligible: false, reason: 'ALREADY_SPUN', nextETMidnightMs: 3600 * 1000,
      });
      await initPage();
      const initialCalls = spinMocks.getSpinEligibility.mock.calls.length;
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(spinMocks.getSpinEligibility.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    it('plays confetti Lottie on win', async () => {
      spinMocks.spinWheel.mockResolvedValue(SPIN_SUCCESS);
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#spinLottieConfetti').play).toHaveBeenCalled();
    });

    it('shows #spinConfettiOverlay on win', async () => {
      spinMocks.spinWheel.mockResolvedValue(SPIN_SUCCESS);
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#spinConfettiOverlay').show).toHaveBeenCalled();
    });

    it('re-enables button and sets Try Again label when spinWheel throws', async () => {
      spinMocks.spinWheel.mockRejectedValue(new Error('network timeout'));
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#spinButton').enable).toHaveBeenCalled();
      expect(getEl('#spinButton').label).toBe('Try Again');
    });

    it('calls trackEvent with spinType, prizeType, isFallback on success', async () => {
      spinMocks.spinWheel.mockResolvedValue(SPIN_SUCCESS);
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(vi.mocked(trackEvent)).toHaveBeenCalledWith('spin_wheel', {
        spinType: 'DAILY',
        prizeType: 'POINTS',
        isFallback: false,
      });
    });

    it('does not call trackEvent(spin_wheel) on failed spin', async () => {
      spinMocks.spinWheel.mockResolvedValue({ success: false, error: 'NOT_ELIGIBLE' });
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(vi.mocked(trackEvent)).not.toHaveBeenCalledWith('spin_wheel', expect.anything());
    });
  });

  // ── Pending prizes panel ──────────────────────────────────────────────────

  describe('pending prizes panel', () => {
    it('collapses repeater when no pending prizes', async () => {
      await initPage();
      expect(getEl('#pendingPrizesRepeater').collapse).toHaveBeenCalled();
    });

    it('populates and expands repeater when prizes exist', async () => {
      await initPage({
        pendingPrizes: [
          { _id: 'pp-1', memberId: 'mem-1', status: 'PENDING', prizeType: 'FREE_SHIP' },
        ],
      });
      expect(getEl('#pendingPrizesRepeater').expand).toHaveBeenCalled();
      expect(getEl('#pendingPrizesRepeater').data).toHaveLength(1);
    });

    it('excludes REDEEMED prizes from panel', async () => {
      await initPage({
        pendingPrizes: [
          { _id: 'pp-1', memberId: 'mem-1', status: 'REDEEMED', prizeType: 'FREE_SHIP' },
        ],
      });
      expect(getEl('#pendingPrizesRepeater').collapse).toHaveBeenCalled();
    });
  });

  // ── safeSession / SpinPrizes cache ────────────────────────────────────────

  describe('SpinPrizes session cache', () => {
    it('caches prizes in sessionStorage after load', async () => {
      __seed('SpinPrizes', [POINTS_PRIZE]);
      await initPage({ prizes: [POINTS_PRIZE] });
      const cached = sessionStorage.getItem('spinPrizes_v1');
      expect(cached).not.toBeNull();
      const { prizes } = JSON.parse(cached);
      expect(prizes).toHaveLength(1);
      expect(prizes[0]._id).toBe('sp-1');
    });

    it('re-fetches from wix-data when cache TTL has expired', async () => {
      // Pre-seed a stale cache entry (6 min old, beyond 5-min TTL)
      const staleTs = Date.now() - 6 * 60 * 1000;
      sessionStorage.setItem('spinPrizes_v1', JSON.stringify({ ts: staleTs, prizes: [] }));
      await initPage({ prizes: [POINTS_PRIZE] });
      // Cache should now hold the freshly fetched prize
      const cached = JSON.parse(sessionStorage.getItem('spinPrizes_v1'));
      expect(cached.prizes).toHaveLength(1);
      expect(cached.prizes[0]._id).toBe('sp-1');
    });

    it('uses in-memory fallback when sessionStorage is unavailable', async () => {
      const orig = globalThis.sessionStorage;
      globalThis.sessionStorage = {
        getItem: () => null,
        setItem: () => { throw new Error('SecurityError'); },
        removeItem: () => {},
        clear: () => {},
      };
      try {
        await initPage({ prizes: [POINTS_PRIZE] });
        // Page still renders the wheel even without a working sessionStorage
        expect(getEl('#spinWheelSVG').src).toMatch(/^data:image\/svg\+xml/);
        // Nothing was persisted to the mocked sessionStorage
        expect(globalThis.sessionStorage.getItem('spinPrizes_v1')).toBeNull();
      } finally {
        globalThis.sessionStorage = orig;
      }
    });
  });

  // ── RATE_LIMITED ──────────────────────────────────────────────────────────

  describe('RATE_LIMITED', () => {
    it('disables button and shows countdown when eligibility reason is RATE_LIMITED', async () => {
      await initPage({
        eligibility: { eligible: false, reason: 'RATE_LIMITED', nextETMidnightMs: 3600 * 1000 },
      });
      expect(getEl('#spinButton').disable).toHaveBeenCalled();
      expect(getEl('#spinCountdown').show).toHaveBeenCalled();
      expect(getEl('#spinCountdown').text).toMatch(/Next spin in/);
    });

    it('shows generic fail message when spinWheel returns RATE_LIMITED error', async () => {
      spinMocks.spinWheel.mockResolvedValue({ success: false, error: 'RATE_LIMITED' });
      await initPage();
      const handler = getEl('#spinButton').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#spinResultText').text).toContain('try again');
    });
  });

  // ── Confetti overlay timer ────────────────────────────────────────────────

  describe('confetti overlay timer', () => {
    it('auto-hides #spinConfettiOverlay after 3 s', async () => {
      spinMocks.spinWheel.mockResolvedValue(SPIN_SUCCESS);
      await initPage();
      vi.useFakeTimers();
      try {
        const handler = getEl('#spinButton').onClick.mock.calls[0][0];
        await handler();
        expect(getEl('#spinConfettiOverlay').show).toHaveBeenCalled();
        await vi.runAllTimersAsync();
        expect(getEl('#spinConfettiOverlay').hide).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ── Reduced-motion ────────────────────────────────────────────────────────

  describe('reduced-motion', () => {
    it('skips confetti Lottie play when prefers-reduced-motion is active', async () => {
      globalThis.window = { matchMedia: () => ({ matches: true }) };
      try {
        spinMocks.spinWheel.mockResolvedValue(SPIN_SUCCESS);
        await initPage();
        const handler = getEl('#spinButton').onClick.mock.calls[0][0];
        await handler();
        expect(getEl('#spinLottieConfetti').play).not.toHaveBeenCalled();
      } finally {
        delete globalThis.window;
      }
    });
  });
});

vi.mock('public/ZipLeaderboardDisplay.js', () => ({ initZipLeaderboardSection: vi.fn().mockResolvedValue(undefined) }));
vi.mock('backend/zipLeaderboard.web.js', () => ({ getZipLeaderboard: vi.fn().mockResolvedValue({ leaderboard: [], myRank: null, zipPrefix: null }) }));
