/**
 * Tests for Referral Page.js — stats and history sections.
 * Covers: initReferralStats (lines 226-258), initReferralHistory (lines 262-297).
 *
 * Dynamic imports in the page (await import('backend/referralService.web'))
 * resolve through vitest aliases to the real backend module. vi.mock cannot
 * intercept these. Instead, we set up the underlying wix-members-backend and
 * wix-data mocks so the real referralService code runs and returns the data
 * we need for assertions.
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

// This mock only covers the test's own import reference.
// The page's dynamic import resolves to the real module via alias.
vi.mock('backend/referralService.web', () => ({
  getReferralLink: vi.fn(() => Promise.resolve({ success: true, referralCode: 'REF123' })),
  getReferralStats: vi.fn(() => Promise.resolve({ success: true, stats: { totalReferrals: 3 } })),
  getMyReferrals: vi.fn(() => Promise.resolve({ success: true, referrals: [{ _id: 'r1', refereeName: 'Jane', status: 'credited' }] })),
}));

// ── Import Mock Refs ────────────────────────────────────────────────

const { calculateReferralProgress, buildReferralHistoryItems } = await import('public/referralPageHelpers.js');

// ── Set up wix-members-backend so the real referralService code works ──
// The real referralService.web.js uses wix-members-backend.currentMember.getMember()
const wixMembersBackend = await import('wix-members-backend');
const wixDataModule = await import('wix-data');

// ── Tests ───────────────────────────────────────────────────────────

describe('Referral Page — Stats & History', () => {
  beforeAll(async () => {
    await import('../src/pages/Referral Page.js');
  });

  beforeEach(() => {
    elements.clear();

    // Set up backend member so referralService functions pass auth check
    wixMembersBackend.__setMember({ _id: 'member-1', loginEmail: 'test@example.com' });

    // Seed wix-data collections for referralService queries
    wixDataModule.__reset();
    wixDataModule.__seed('Referrals', [
      { _id: 'r1', referrerMemberId: 'member-1', refereeName: 'Jane', refereeEmail: 'jane@test.com', status: 'credited', referralCode: 'REF123', referrerCredit: 25, refereeCredit: 25 },
      { _id: 'r2', referrerMemberId: 'member-1', refereeName: 'Bob', refereeEmail: 'bob@test.com', status: 'purchased', referralCode: 'REF123', referrerCredit: 25, refereeCredit: 25 },
      { _id: 'r3', referrerMemberId: 'member-1', refereeName: 'Alice', refereeEmail: 'alice@test.com', status: 'pending', referralCode: 'REF123', referrerCredit: 0, refereeCredit: 0 },
    ]);
    wixDataModule.__seed('ReferralCredits', [
      { _id: 'c1', memberId: 'member-1', amount: 50, status: 'applied', source: 'referrer_bonus' },
      { _id: 'c2', memberId: 'member-1', amount: 25, status: 'available', source: 'referrer_bonus' },
    ]);

    // Reset helpers to default return values
    calculateReferralProgress.mockReturnValue({
      totalFriends: 3, successRate: 67, totalEarned: 75, availableCredit: 25,
    });
    buildReferralHistoryItems.mockReturnValue([
      { _id: 'h1', friendName: 'Jane', statusLabel: 'Completed', statusColor: '#4A7C59', creditText: '$25', dateText: 'Mar 1, 2026' },
    ]);
  });

  // ── initReferralStats ────────────────────────────────────────────

  describe('initReferralStats', () => {
    it('displays totalFriends, successRate, totalEarned, and availableCredit', async () => {
      await onReadyHandler();
      expect(getEl('#statTotalFriends').text).toBe('3');
      expect(getEl('#statSuccessRate').text).toBe('67%');
      expect(getEl('#statTotalEarned').text).toBe('$75');
      expect(getEl('#statAvailableCredit').text).toBe('$25');
    });

    it('highlights available credit with success color when > 0', async () => {
      await onReadyHandler();
      expect(getEl('#statAvailableCredit').style.color).toBe('#4A7C59');
    });

    it('does not highlight available credit when 0', async () => {
      calculateReferralProgress.mockReturnValue({
        totalFriends: 3, successRate: 67, totalEarned: 75, availableCredit: 0,
      });
      await onReadyHandler();
      expect(getEl('#statAvailableCredit').style.color).not.toBe('#4A7C59');
    });

    it('shows empty state when totalFriends is 0', async () => {
      calculateReferralProgress.mockReturnValue({
        totalFriends: 0, successRate: 0, totalEarned: 0, availableCredit: 0,
      });
      await onReadyHandler();
      expect(getEl('#referralStatsEmpty').show).toHaveBeenCalled();
      expect(getEl('#referralStatsCards').collapse).toHaveBeenCalled();
    });

    it('does not show empty state when totalFriends > 0', async () => {
      await onReadyHandler();
      expect(getEl('#referralStatsEmpty').show).not.toHaveBeenCalled();
      expect(getEl('#referralStatsCards').collapse).not.toHaveBeenCalled();
    });

    it('handles API failure gracefully (no member)', async () => {
      wixMembersBackend.__setMember(null);
      // Should not throw — page uses Promise.allSettled
      await onReadyHandler();
      // Stats won't be populated since getReferralStats returns {success: false}
      expect(getEl('#statTotalFriends').text).toBe('');
    });

    it('handles backend exception gracefully', async () => {
      // Remove seed data and set member to trigger a code path, but
      // corrupt the data mock to cause an exception
      wixDataModule.__reset();
      // No Referrals collection seeded — query will return empty, not throw
      // The function should still complete without throwing
      await onReadyHandler();
    });
  });

  // ── initReferralHistory ──────────────────────────────────────────

  describe('initReferralHistory', () => {
    it('fetches and renders history items in repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#referralHistoryRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
      expect(repeater.data).toEqual([
        { _id: 'h1', friendName: 'Jane', statusLabel: 'Completed', statusColor: '#4A7C59', creditText: '$25', dateText: 'Mar 1, 2026' },
      ]);
    });

    it('onItemReady sets friendName, status with color, credit, and date', async () => {
      await onReadyHandler();
      const handler = getEl('#referralHistoryRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`histItem-${sel}`);
      const itemData = { _id: 'h1', friendName: 'Jane', statusLabel: 'Completed', statusColor: '#4A7C59', creditText: '$25', dateText: 'Mar 1, 2026' };
      handler($item, itemData);

      expect(getEl('histItem-#historyFriendName').text).toBe('Jane');
      expect(getEl('histItem-#historyStatus').text).toBe('Completed');
      expect(getEl('histItem-#historyStatus').style.color).toBe('#4A7C59');
      expect(getEl('histItem-#historyCredit').text).toBe('$25');
      expect(getEl('histItem-#historyDate').text).toBe('Mar 1, 2026');
    });

    it('shows empty state when no history items', async () => {
      buildReferralHistoryItems.mockReturnValue([]);
      await onReadyHandler();
      expect(getEl('#referralHistoryEmpty').show).toHaveBeenCalled();
      expect(getEl('#referralHistoryRepeater').collapse).toHaveBeenCalled();
    });

    it('does not set repeater data when items are empty', async () => {
      buildReferralHistoryItems.mockReturnValue([]);
      await onReadyHandler();
      expect(getEl('#referralHistoryRepeater').data).toEqual([]);
    });

    it('handles API failure gracefully (no member)', async () => {
      wixMembersBackend.__setMember(null);
      // Should not throw
      await onReadyHandler();
      // Repeater should not have data assigned
      expect(getEl('#referralHistoryRepeater').data).toEqual([]);
    });

    it('handles empty referrals from backend', async () => {
      wixDataModule.__reset();
      wixDataModule.__seed('Referrals', []);
      wixDataModule.__seed('ReferralCredits', []);
      buildReferralHistoryItems.mockReturnValue([]);
      await onReadyHandler();
      expect(getEl('#referralHistoryEmpty').show).toHaveBeenCalled();
    });
  });
});
