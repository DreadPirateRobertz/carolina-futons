import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// wix-members-frontend uses a vitest alias to __mocks__/wix-members-frontend.js
// which returns getMember() → null. The page always takes the logged-out path
// (calls promptLogin). We test pre-member-check inits and logged-out behavior.

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
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { success: '#28a745', sunsetCoral: '#ff6b6b' },
}));

vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
}));

vi.mock('public/ReturnsPortal.js', () => ({
  initReturnsSection: vi.fn(),
}));

vi.mock('public/storeCreditHelpers.js', () => ({
  initStoreCreditDashboard: vi.fn(),
}));

vi.mock('public/giftCardHelpers.js', () => ({
  initGiftCardDashboard: vi.fn(),
}));

vi.mock('public/loyaltyHelpers.js', () => ({
  formatPoints: vi.fn(),
  formatProgressText: vi.fn(),
  getProgressPercent: vi.fn(),
  getTierColor: vi.fn(),
  getTierIcon: vi.fn(),
  canAffordReward: vi.fn(),
  formatRewardCost: vi.fn(),
  buildTierComparisonData: vi.fn(),
  getNextMilestone: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Load Page & Capture Handler ─────────────────────────────────────

let collapseOnMobile;
let initBackToTop;
let initPageSeo;
let trackEvent;

beforeAll(async () => {
  ({ collapseOnMobile } = await import('public/mobileHelpers'));
  ({ initBackToTop } = await import('public/mobileHelpers'));
  ({ initPageSeo } = await import('public/pageSeo.js'));
  ({ trackEvent } = await import('public/engagementTracker'));

  await import('../src/pages/Member Page.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Member Page – onReady handler (logged-out path)', () => {
  it('captures the onReady handler', () => {
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls collapseOnMobile with correct selectors', async () => {
    await onReadyHandler();
    expect(collapseOnMobile).toHaveBeenCalledWith(
      $w,
      ['#ordersRepeater', '#wishlistRepeater', '#addressBook']
    );
  });

  it('calls initBackToTop with $w', async () => {
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });

  it('calls initPageSeo with "member"', async () => {
    await onReadyHandler();
    expect(initPageSeo).toHaveBeenCalledWith('member');
  });

  it('calls trackEvent for page_view with member_account', async () => {
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'member_account' });
  });

  it('calls authentication.promptLogin when member is null', async () => {
    const { authentication } = await import('wix-members-frontend');
    const spy = vi.spyOn(authentication, 'promptLogin');
    await onReadyHandler();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not throw during onReady execution', async () => {
    await expect(onReadyHandler()).resolves.not.toThrow();
  });
});
