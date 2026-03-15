import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── Element mock registry ──────────────────────────────────────────
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

// ── Dependency mocks ───────────────────────────────────────────────

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn(() => Promise.resolve('')),
  getWebSiteSchema: vi.fn(() => Promise.resolve('')),
}));

vi.mock('backend/promotions.web', () => ({
  getActivePromotion: vi.fn(() => Promise.resolve(null)),
  getFlashSales: vi.fn(() => Promise.resolve([])),
}));

vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: [], to: vi.fn(), query: {}, url: 'https://www.carolinafutons.com', onChange: vi.fn() },
}));

vi.mock('wix-seo-frontend', () => ({
  head: { setLinks: vi.fn() },
}));

const mockGetCurrentCart = vi.fn(() => Promise.resolve({ lineItems: [] }));
const mockOnCartChanged = vi.fn();
const mockGetShippingProgress = vi.fn(() => ({ remaining: 999 }));
vi.mock('public/cartService', () => ({
  getCurrentCart: mockGetCurrentCart,
  onCartChanged: mockOnCartChanged,
  getShippingProgress: mockGetShippingProgress,
}));

vi.mock('public/performanceHelpers', () => ({
  sharePromise: vi.fn((fn) => fn),
  deferInit: vi.fn((cb) => cb()),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  getViewport: vi.fn(() => 'desktop'),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: vi.fn(),
  initScrollDepthTracking: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {},
  typography: { body: { family: 'sans-serif' }, h2: { weight: 700 } },
  spacing: {},
}));

const mockCaptureInstallPrompt = vi.fn();
vi.mock('public/pwaHelpers', () => ({
  captureInstallPrompt: mockCaptureInstallPrompt,
  canShowInstallPrompt: vi.fn(() => false),
  showInstallPrompt: vi.fn(),
  isInstalledPWA: vi.fn(() => false),
}));

vi.mock('backend/coreWebVitals.web', () => ({
  reportMetrics: vi.fn(() => Promise.resolve()),
}));

const mockInitFooter = vi.fn();
vi.mock('public/FooterSection', () => ({
  initFooter: mockInitFooter,
}));

vi.mock('public/carolinaFutonsLogo', () => ({
  getLogoImageUrl: vi.fn(() => 'logo.png'),
}));

const mockInitSkipNav = vi.fn();
const mockSetupAccessibleDialog = vi.fn(() => ({ open: vi.fn(), close: vi.fn(), destroy: vi.fn() }));
const mockMakeClickable = vi.fn();
vi.mock('public/a11yHelpers', () => ({
  initSkipNav: mockInitSkipNav,
  setupAccessibleDialog: mockSetupAccessibleDialog,
  announce: vi.fn(),
  makeClickable: mockMakeClickable,
}));

const mockApplyActiveNavState = vi.fn();
const mockInitMegaMenu = vi.fn();
const mockInitMobileDrawer = vi.fn();
const mockInitFooterAccordions = vi.fn();
const mockInitAnnouncementBarHelper = vi.fn();
const mockInitBackToTopHelper = vi.fn();
const mockInitStickyNav = vi.fn();
const mockBreadcrumbsFromPath = vi.fn(() => []);
const mockRenderBreadcrumbs = vi.fn();
vi.mock('public/navigationHelpers', () => ({
  applyActiveNavState: mockApplyActiveNavState,
  initMegaMenu: mockInitMegaMenu,
  initMobileDrawer: mockInitMobileDrawer,
  initFooterAccordions: mockInitFooterAccordions,
  initAnnouncementBar: mockInitAnnouncementBarHelper,
  initBackToTop: mockInitBackToTopHelper,
  initStickyNav: mockInitStickyNav,
  breadcrumbsFromPath: mockBreadcrumbsFromPath,
  renderBreadcrumbs: mockRenderBreadcrumbs,
}));

vi.mock('public/tikTokPixel', () => ({
  initTikTokPixel: vi.fn(),
}));

vi.mock('public/LiveChat.js', () => ({
  initLiveChat: vi.fn(),
}));

vi.mock('public/flashSaleHelpers', () => ({
  buildAnnouncementMessage: vi.fn(() => null),
}));

// ── Import page & run onReady ──────────────────────────────────────

describe('masterPage handlers', () => {
  beforeAll(async () => {
    await import('../src/pages/masterPage.js');
    expect(onReadyHandler).toBeTypeOf('function');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  async function runOnReady() {
    await onReadyHandler();
  }

  // ── Tests ──────────────────────────────────────────────────────────

  it('does not throw when $w.onReady fires', async () => {
    await expect(runOnReady()).resolves.not.toThrow();
  });

  it('calls captureInstallPrompt on ready', async () => {
    await runOnReady();
    expect(mockCaptureInstallPrompt).toHaveBeenCalled();
  });

  it('calls initSkipNav for accessibility setup', async () => {
    await runOnReady();
    expect(mockInitSkipNav).toHaveBeenCalledWith($w, '#mainContent', '#skipToContent');
  });

  it('calls applyActiveNavState for enhanced navigation', async () => {
    await runOnReady();
    expect(mockApplyActiveNavState).toHaveBeenCalledWith($w, '/');
  });

  it('calls initFooter with $w', async () => {
    await runOnReady();
    expect(mockInitFooter).toHaveBeenCalledWith($w);
  });

  it('calls getCurrentCart for cart badge', async () => {
    await runOnReady();
    expect(mockGetCurrentCart).toHaveBeenCalled();
  });

  it('calls initMegaMenu on desktop', async () => {
    await runOnReady();
    expect(mockInitMegaMenu).toHaveBeenCalledWith($w);
  });

  it('calls initMobileDrawer for mobile nav', async () => {
    await runOnReady();
    expect(mockInitMobileDrawer).toHaveBeenCalledWith($w, '/');
  });

  it('calls initStickyNav for scroll shadow', async () => {
    await runOnReady();
    expect(mockInitStickyNav).toHaveBeenCalledWith($w);
  });

  it('calls initBackToTopHelper', async () => {
    await runOnReady();
    expect(mockInitBackToTopHelper).toHaveBeenCalledWith($w);
  });

  it('registers onCartChanged callback for badge updates', async () => {
    await runOnReady();
    expect(mockOnCartChanged).toHaveBeenCalled();
  });

  it('calls makeClickable for cart icon accessibility', async () => {
    await runOnReady();
    expect(mockMakeClickable).toHaveBeenCalled();
  });
});
