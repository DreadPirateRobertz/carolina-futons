import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '', backgroundColor: '' },
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

vi.mock('wix-location-frontend', () => ({
  default: { to: vi.fn(), query: {} },
  to: vi.fn(),
}));

vi.mock('backend/returnsService.web', () => ({
  getAdminReturns: vi.fn(),
  getReturnStats: vi.fn(),
  updateReturnStatus: vi.fn(),
  generateReturnLabel: vi.fn(),
  processRefund: vi.fn(),
  trackReturnShipment: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { sunsetCoral: '#E07A5F', espresso: '#3C2415', success: '#4A7C59', error: '#C1292E' },
}));

vi.mock('public/ReturnsAdmin.js', () => ({
  getAdminStatusLabel: vi.fn((s) => s),
  getNextStatuses: vi.fn(() => []),
  getStatusFilterOptions: vi.fn(() => []),
  formatAdminReturnRow: vi.fn((r) => r),
  formatReturnStats: vi.fn(() => ({})),
  validateRefund: vi.fn(() => ({ valid: true, errors: [] })),
  canGenerateLabel: vi.fn(() => ({ canGenerate: false, reason: '' })),
  needsAction: vi.fn(() => false),
  sortAdminReturns: vi.fn((arr) => arr),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

// ── Import page (registers onReady handler) ─────────────────────────

beforeAll(async () => {
  await import('../src/pages/Admin Returns.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// wix-members-frontend uses a vitest alias to __mocks__/wix-members-frontend.js
// which returns getMember() → null. This means the page always redirects non-members
// home. We can only test the auth gate behavior, not dashboard functionality.

describe('Admin Returns page – auth gate (member is null)', () => {
  it('registers an onReady handler', () => {
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('page loads without throwing', async () => {
    await expect(onReadyHandler()).resolves.not.toThrow();
  });

  it('redirects to "/" when no member found', async () => {
    const loc = await import('wix-location-frontend');
    await onReadyHandler();
    expect(loc.to).toHaveBeenCalledWith('/');
  });

  it('does NOT call initBackToTop (returns before dashboard init)', async () => {
    const { initBackToTop } = await import('public/mobileHelpers');
    await onReadyHandler();
    expect(initBackToTop).not.toHaveBeenCalled();
  });

  it('does NOT call trackEvent (returns before dashboard init)', async () => {
    const { trackEvent } = await import('public/engagementTracker');
    await onReadyHandler();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does NOT call getAdminReturns (returns before dashboard load)', async () => {
    const { getAdminReturns } = await import('backend/returnsService.web');
    await onReadyHandler();
    expect(getAdminReturns).not.toHaveBeenCalled();
  });
});
