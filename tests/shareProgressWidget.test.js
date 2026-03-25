import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initShareProgressWidget } from 'public/ShareProgressWidget.js';

// ── $w mock ───────────────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

function mock$w(sel) { return getEl(sel); }

// ── Test data ─────────────────────────────────────────────────────────────────

const PROGRESS = {
  tierName: 'Gold',
  totalPoints: 2500,
  streak: 12,
  topBadges: ['Top Reviewer', 'Streak Master'],
  shareText: "I'm a Gold member at Carolina Futons with 2,500 points and a 12-day streak! 🏆",
  shareUrl: 'https://www.carolinafutons.com/referral',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ShareProgressWidget (CF-fxby)', () => {
  let getShareableProgress;
  let mockNavigator;

  beforeEach(() => {
    elements.clear();
    getShareableProgress = vi.fn().mockResolvedValue(PROGRESS);
    mockNavigator = { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }, share: null };
  });

  async function init(memberId = 'member-1', overrides = {}) {
    await initShareProgressWidget(memberId, {
      getShareableProgress,
      $w: mock$w,
      navigator: mockNavigator,
      ...overrides,
    });
  }

  it('calls getShareableProgress with memberId', async () => {
    await init('member-99');
    expect(getShareableProgress).toHaveBeenCalledWith('member-99');
  });

  describe('share card rendering', () => {
    it('sets #shareTitle to tier member text', async () => {
      await init();
      expect(getEl('#shareTitle').text).toBe('Gold Member');
    });

    it('sets #shareTierBadge to tier name', async () => {
      await init();
      expect(getEl('#shareTierBadge').text).toBe('Gold');
    });

    it('sets #shareStats with points, streak, and badges', async () => {
      await init();
      expect(getEl('#shareStats').text).toContain('2,500 points');
      expect(getEl('#shareStats').text).toContain('12-day streak');
      expect(getEl('#shareStats').text).toContain('Top Reviewer');
    });

    it('omits streak from stats when streak is 0', async () => {
      getShareableProgress.mockResolvedValue({ ...PROGRESS, streak: 0 });
      await init();
      expect(getEl('#shareStats').text).not.toContain('streak');
    });

    it('omits badges from stats when topBadges is empty', async () => {
      getShareableProgress.mockResolvedValue({ ...PROGRESS, topBadges: [] });
      await init();
      expect(getEl('#shareStats').text).not.toContain('Top Reviewer');
    });
  });

  describe('Facebook share', () => {
    it('registers onClick on #shareFacebook', async () => {
      await init();
      expect(getEl('#shareFacebook').onClick).toHaveBeenCalled();
    });

    it('opens Facebook share URL on click', async () => {
      globalThis.open = vi.fn();
      await init();
      const handler = getEl('#shareFacebook').onClick.mock.calls[0][0];
      handler();
      expect(globalThis.open).toHaveBeenCalledWith(
        expect.stringContaining('facebook.com/sharer'),
        '_blank'
      );
      delete globalThis.open;
    });
  });

  describe('Twitter share', () => {
    it('registers onClick on #shareTwitter', async () => {
      await init();
      expect(getEl('#shareTwitter').onClick).toHaveBeenCalled();
    });

    it('opens Twitter intent URL on click', async () => {
      globalThis.open = vi.fn();
      await init();
      const handler = getEl('#shareTwitter').onClick.mock.calls[0][0];
      handler();
      expect(globalThis.open).toHaveBeenCalledWith(
        expect.stringContaining('twitter.com/intent/tweet'),
        '_blank'
      );
      delete globalThis.open;
    });
  });

  describe('copy link', () => {
    it('registers onClick on #shareCopyLink', async () => {
      await init();
      expect(getEl('#shareCopyLink').onClick).toHaveBeenCalled();
    });

    it('copies URL to clipboard on click', async () => {
      await init();
      const handler = getEl('#shareCopyLink').onClick.mock.calls[0][0];
      await handler();
      expect(mockNavigator.clipboard.writeText).toHaveBeenCalledWith(PROGRESS.shareUrl);
      expect(getEl('#shareStatus').text).toBe('Link copied!');
      expect(getEl('#shareStatus').show).toHaveBeenCalled();
    });

    it('falls back to showing URL when clipboard unavailable', async () => {
      mockNavigator.clipboard = null;
      await init();
      const handler = getEl('#shareCopyLink').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#shareStatus').text).toBe(PROGRESS.shareUrl);
    });
  });

  describe('Web Share API', () => {
    it('registers onClick on #shareCard when navigator.share exists', async () => {
      mockNavigator.share = vi.fn().mockResolvedValue(undefined);
      await init();
      expect(getEl('#shareCard').onClick).toHaveBeenCalled();
    });

    it('calls navigator.share with correct data', async () => {
      mockNavigator.share = vi.fn().mockResolvedValue(undefined);
      await init();
      const handler = getEl('#shareCard').onClick.mock.calls[0][0];
      await handler();
      expect(mockNavigator.share).toHaveBeenCalledWith({
        title: 'Gold Member at Carolina Futons',
        text: PROGRESS.shareText,
        url: PROGRESS.shareUrl,
      });
    });

    it('does not register shareCard click when navigator.share unavailable', async () => {
      mockNavigator.share = null;
      await init();
      expect(getEl('#shareCard').onClick).not.toHaveBeenCalled();
    });

    it('shows "Shared!" status on successful share', async () => {
      mockNavigator.share = vi.fn().mockResolvedValue(undefined);
      await init();
      const handler = getEl('#shareCard').onClick.mock.calls[0][0];
      await handler();
      expect(getEl('#shareStatus').text).toBe('Shared!');
    });

    it('does not throw when user cancels share', async () => {
      mockNavigator.share = vi.fn().mockRejectedValue(new Error('Share cancelled'));
      await init();
      const handler = getEl('#shareCard').onClick.mock.calls[0][0];
      await expect(handler()).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('shows error and collapses card on getShareableProgress rejection', async () => {
      getShareableProgress.mockRejectedValue(new Error('Network error'));
      await init();
      expect(getEl('#shareStatus').text).toContain('Unable to load progress');
      expect(getEl('#shareStatus').show).toHaveBeenCalled();
      expect(getEl('#shareCard').collapse).toHaveBeenCalled();
    });

    it('does not throw when getShareableProgress rejects', async () => {
      getShareableProgress.mockRejectedValue(new Error('fail'));
      await expect(init()).resolves.toBeUndefined();
    });
  });
});
