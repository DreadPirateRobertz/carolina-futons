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
  colors: { success: '#4A7C59' },
}));

vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
}));

vi.mock('public/referralPageHelpers.js', () => ({
  formatReferralLink: vi.fn((code) => `https://carolinafutons.com/ref/${code}`),
  formatCreditAmount: vi.fn((amt) => `$${amt}`),
  getHowItWorksSteps: vi.fn(() => [
    { _id: 's1', title: 'Share', description: 'Share your link', icon: '🔗' },
  ]),
  getSocialShareLinks: vi.fn(() => ({
    email: 'mailto:...',
    sms: 'sms:...',
    facebook: 'https://fb.com',
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

// wix-members-frontend uses a vitest alias to __mocks__/wix-members-frontend.js
// which returns getMember() → null. This means the page always takes the
// logged-out path. We test pre-member-check inits and logged-out behavior.

vi.mock('backend/referralService.web', () => ({
  getReferralLink: vi.fn(() => Promise.resolve({ success: true, referralCode: 'ABC123' })),
  getReferralStats: vi.fn(() => Promise.resolve({ success: true, stats: {} })),
  getMyReferrals: vi.fn(() => Promise.resolve({ success: true, referrals: [{ _id: 'r1' }] })),
}));

// ── Import Mock Refs ────────────────────────────────────────────────

const { trackEvent } = await import('public/engagementTracker');
const { collapseOnMobile, initBackToTop } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');

// ── Tests ───────────────────────────────────────────────────────────

describe('Referral Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Referral Page.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Pre-member-check initialization ────────────────────────────

  it('calls collapseOnMobile with correct selectors', async () => {
    await onReadyHandler();
    expect(collapseOnMobile).toHaveBeenCalledWith(
      $w,
      ['#referralHistorySection', '#referralStatsSection']
    );
  });

  it('calls initBackToTop', async () => {
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });

  it('calls initPageSeo with "referral"', async () => {
    await onReadyHandler();
    expect(initPageSeo).toHaveBeenCalledWith('referral');
  });

  it('tracks page_view event', async () => {
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'referral' });
  });

  // ── Logged-out state (member mock returns null) ────────────────

  it('shows #referralLoggedOutBox when no member', async () => {
    await onReadyHandler();
    expect(getEl('#referralLoggedOutBox').show).toHaveBeenCalled();
  });

  it('collapses #referralMainContent when no member', async () => {
    await onReadyHandler();
    expect(getEl('#referralMainContent').collapse).toHaveBeenCalled();
  });

  it('registers onClick on #referralLoginBtn', async () => {
    await onReadyHandler();
    expect(getEl('#referralLoginBtn').onClick).toHaveBeenCalled();
  });

  it('sets ARIA label on #referralLoginBtn', async () => {
    await onReadyHandler();
    expect(getEl('#referralLoginBtn').accessibility.ariaLabel).toBeDefined();
  });
});
