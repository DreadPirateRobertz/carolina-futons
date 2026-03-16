/**
 * Tests for Referral Page.js — logged-in member flows.
 * Covers: initHowItWorks, initReferralLink, initShareButtons.
 * Stats/History sections use dynamic imports that resist vi.mock in
 * this page-level test setup — those are covered by referralService tests.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
  trackReferralAction: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { success: '#4A7C59', muted: '#999' },
}));

vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
}));

vi.mock('public/referralPageHelpers.js', () => ({
  formatReferralLink: vi.fn((code) => `https://carolinafutons.com?ref=${code}`),
  formatCreditAmount: vi.fn((amt) => `$${amt}`),
  getHowItWorksSteps: vi.fn(() => [
    { _id: 's1', title: 'Share', description: 'Share your link', icon: '🔗' },
    { _id: 's2', title: 'Friend Shops', description: 'They get $25 off', icon: '🛒' },
    { _id: 's3', title: 'Earn Credit', description: 'You get $50', icon: '💰' },
  ]),
  getSocialShareLinks: vi.fn(() => ({
    email: 'mailto:?subject=Check%20out%20Carolina%20Futons&body=REF123',
    sms: 'sms:?body=REF123',
    facebook: 'https://facebook.com/share?url=REF123',
  })),
  calculateReferralProgress: vi.fn(() => ({
    totalFriends: 3, successRate: 67, totalEarned: 75, availableCredit: 25,
  })),
  buildReferralHistoryItems: vi.fn(() => [
    { _id: 'h1', friendName: 'Jane', statusLabel: 'Completed', statusColor: '#4A7C59', creditText: '$25', dateText: 'Mar 1, 2026' },
  ]),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// Mock wix-members-frontend to return a logged-in member
vi.mock('wix-members-frontend', () => ({
  currentMember: { getMember: vi.fn().mockResolvedValue({ _id: 'member-1', loginEmail: 'test@example.com', profile: { nickname: 'Tester' } }) },
  authentication: { promptLogin: vi.fn(), onLogin: vi.fn() },
}));

vi.mock('backend/referralService.web', () => ({
  getReferralLink: vi.fn(() => Promise.resolve({ success: true, referralCode: 'REF123' })),
  getReferralStats: vi.fn(() => Promise.resolve({ success: true, stats: { totalReferrals: 3 } })),
  getMyReferrals: vi.fn(() => Promise.resolve({ success: true, referrals: [{ _id: 'r1', refereeName: 'Jane', status: 'credited' }] })),
}));

// ── Import Mock Refs ────────────────────────────────────────────────

const { trackReferralAction } = await import('public/engagementTracker');
const { announce } = await import('public/a11yHelpers');
const { getReferralLink } = await import('backend/referralService.web');

// ── Tests ───────────────────────────────────────────────────────────

describe('Referral Page (logged-in)', () => {
  beforeAll(async () => {
    await import('../src/pages/Referral Page.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ── How It Works ──────────────────────────────────────────────────

  describe('How It Works section', () => {
    it('sets repeater data to steps from helper', async () => {
      await onReadyHandler();
      const repeater = getEl('#howItWorksRepeater');
      expect(repeater.data).toHaveLength(3);
    });

    it('registers onItemReady for steps repeater', async () => {
      await onReadyHandler();
      expect(getEl('#howItWorksRepeater').onItemReady).toHaveBeenCalled();
    });

    it('renders step title, description, and icon', async () => {
      await onReadyHandler();
      const handler = getEl('#howItWorksRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`item-${sel}`);
      handler($item, { _id: 's1', title: 'Share', description: 'Share your link', icon: '🔗' });
      expect(getEl('item-#stepTitle').text).toBe('Share');
      expect(getEl('item-#stepDescription').text).toBe('Share your link');
      expect(getEl('item-#stepIcon').text).toBe('🔗');
    });
  });

  // ── Referral Link ─────────────────────────────────────────────────

  describe('Referral Link', () => {
    it('calls getReferralLink from backend', async () => {
      await onReadyHandler();
      expect(getReferralLink).toHaveBeenCalled();
    });

    it('displays the referral link text', async () => {
      await onReadyHandler();
      expect(getEl('#referralLinkText').text).toContain('REF123');
    });

    it('displays the referral code', async () => {
      await onReadyHandler();
      expect(getEl('#referralCodeText').text).toBe('REF123');
    });

    it('registers onClick on copy link button', async () => {
      await onReadyHandler();
      expect(getEl('#copyLinkBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on copy link button', async () => {
      await onReadyHandler();
      expect(getEl('#copyLinkBtn').accessibility.ariaLabel).toContain('clipboard');
    });

    it('registers onClick on copy code button', async () => {
      await onReadyHandler();
      expect(getEl('#copyCodeBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on copy code button', async () => {
      await onReadyHandler();
      expect(getEl('#copyCodeBtn').accessibility.ariaLabel).toContain('code');
    });

    it('shows error when getReferralLink fails', async () => {
      getReferralLink.mockResolvedValueOnce({ success: false, error: 'No account' });
      await onReadyHandler();
      expect(getEl('#referralLinkError').show).toHaveBeenCalled();
      expect(getEl('#referralLinkError').text).toContain('No account');
    });
  });

  // ── Share Buttons ─────────────────────────────────────────────────

  describe('Share Buttons', () => {
    it('registers onClick on email share button', async () => {
      await onReadyHandler();
      expect(getEl('#shareEmailBtn').onClick).toHaveBeenCalled();
    });

    it('registers onClick on SMS share button', async () => {
      await onReadyHandler();
      expect(getEl('#shareSmsBtn').onClick).toHaveBeenCalled();
    });

    it('registers onClick on Facebook share button', async () => {
      await onReadyHandler();
      expect(getEl('#shareFacebookBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA labels on share buttons', async () => {
      await onReadyHandler();
      expect(getEl('#shareEmailBtn').accessibility.ariaLabel).toContain('email');
      expect(getEl('#shareSmsBtn').accessibility.ariaLabel).toContain('text');
      expect(getEl('#shareFacebookBtn').accessibility.ariaLabel).toContain('Facebook');
    });

    it('email share button tracks referral action', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#shareEmailBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect(trackReferralAction).toHaveBeenCalledWith('share_email');
    });

    it('SMS share button tracks referral action', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#shareSmsBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect(trackReferralAction).toHaveBeenCalledWith('share_sms');
    });

    it('Facebook share button tracks referral action', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#shareFacebookBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect(trackReferralAction).toHaveBeenCalledWith('share_facebook');
    });
  });

  // ── Error Resilience ──────────────────────────────────────────────

  describe('error resilience', () => {
    it('does not throw when section init fails', async () => {
      getReferralLink.mockRejectedValueOnce(new Error('Network error'));
      // Should not throw — page uses Promise.allSettled
      await onReadyHandler();
    });

    it('does not show logged-out box for logged-in member', async () => {
      await onReadyHandler();
      expect(getEl('#referralLoggedOutBox').show).not.toHaveBeenCalled();
    });
  });
});
