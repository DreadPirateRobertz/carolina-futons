import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '', backgroundColor: '' },
    accessibility: {},
    hidden: false, collapsed: false, checked: false,
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

vi.mock('backend/orderTracking.web', () => ({
  lookupOrder: vi.fn(() => Promise.resolve()),
  subscribeToNotifications: vi.fn(() => Promise.resolve()),
  unsubscribeFromNotifications: vi.fn(() => Promise.resolve()),
  getTrackingTimeline: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    success: '#2E7D32',
    error: '#C62828',
    mountainBlue: '#4A90D9',
    sunsetCoral: '#E8734A',
    muted: '#B0B0B0',
    mutedBrown: '#8B7355',
    espresso: '#3E2723',
  },
  typography: {
    h3: { weight: 700 },
    h4: { weight: 600 },
  },
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  isMobile: vi.fn(() => false),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  query: {},
}));

// ── Import Mock Refs ────────────────────────────────────────────────

const { lookupOrder, subscribeToNotifications, unsubscribeFromNotifications, getTrackingTimeline } = await import('backend/orderTracking.web');
const { trackEvent } = await import('public/engagementTracker');
const { announce } = await import('public/a11yHelpers');
const { colors, typography } = await import('public/designTokens.js');
const { initBackToTop, isMobile } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');

// ── Load Page Module ────────────────────────────────────────────────

beforeAll(async () => {
  await import('../src/pages/Order Tracking.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Order Tracking page', () => {
  // ── Initialization ──────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with orderTracking', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('orderTracking');
    });

    it('tracks page_view event for order_tracking', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'order_tracking' });
    });
  });

  // ── Lookup Form ─────────────────────────────────────────────────

  describe('initLookupForm', () => {
    it('sets tracking title text', async () => {
      await onReadyHandler();
      expect(getEl('#trackingTitle').text).toBe('Track Your Order');
    });

    it('sets tracking subtitle text', async () => {
      await onReadyHandler();
      expect(getEl('#trackingSubtitle').text).toBe(
        'Enter your order number and email address to view your shipment status.'
      );
    });

    it('sets ARIA label on orderNumberInput', async () => {
      await onReadyHandler();
      expect(getEl('#orderNumberInput').accessibility.ariaLabel).toBe('Order number');
    });

    it('sets ARIA label on emailInput', async () => {
      await onReadyHandler();
      expect(getEl('#emailInput').accessibility.ariaLabel).toBe('Email address used for this order');
    });

    it('sets ARIA label on trackOrderBtn', async () => {
      await onReadyHandler();
      expect(getEl('#trackOrderBtn').accessibility.ariaLabel).toBe('Track order');
    });

    it('registers onClick handler on trackOrderBtn', async () => {
      await onReadyHandler();
      expect(getEl('#trackOrderBtn').onClick).toHaveBeenCalledTimes(1);
      expect(typeof getEl('#trackOrderBtn').onClick.mock.calls[0][0]).toBe('function');
    });

    it('registers onKeyPress handler on emailInput', async () => {
      await onReadyHandler();
      expect(getEl('#emailInput').onKeyPress).toHaveBeenCalledTimes(1);
      expect(typeof getEl('#emailInput').onKeyPress.mock.calls[0][0]).toBe('function');
    });

    it('registers onKeyPress handler on orderNumberInput', async () => {
      await onReadyHandler();
      expect(getEl('#orderNumberInput').onKeyPress).toHaveBeenCalledTimes(1);
      expect(typeof getEl('#orderNumberInput').onKeyPress.mock.calls[0][0]).toBe('function');
    });
  });

  // ── Results Section Init ────────────────────────────────────────

  describe('initResultsSection', () => {
    it('collapses trackingResultsSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#trackingResultsSection').collapse).toHaveBeenCalled();
    });

    it('collapses activitySection on init', async () => {
      await onReadyHandler();
      expect(getEl('#activitySection').collapse).toHaveBeenCalled();
    });

    it('collapses lineItemsSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#lineItemsSection').collapse).toHaveBeenCalled();
    });

    it('collapses notificationSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#notificationSection').collapse).toHaveBeenCalled();
    });

    it('hides noTrackingMessage on init', async () => {
      await onReadyHandler();
      expect(getEl('#noTrackingMessage').hide).toHaveBeenCalled();
    });

    it('hides trackingError on init', async () => {
      await onReadyHandler();
      expect(getEl('#trackingError').hide).toHaveBeenCalled();
    });

    it('hides trackingLoader on init', async () => {
      await onReadyHandler();
      expect(getEl('#trackingLoader').hide).toHaveBeenCalled();
    });
  });

  // ── New Search Button ───────────────────────────────────────────

  describe('newSearchBtn', () => {
    it('registers onClick handler on newSearchBtn', async () => {
      await onReadyHandler();
      expect(getEl('#newSearchBtn').onClick).toHaveBeenCalledTimes(1);
      expect(typeof getEl('#newSearchBtn').onClick.mock.calls[0][0]).toBe('function');
    });

    it('sets ARIA label on newSearchBtn', async () => {
      await onReadyHandler();
      expect(getEl('#newSearchBtn').accessibility.ariaLabel).toBe('Track a different order');
    });
  });

  // ── Refresh Button ──────────────────────────────────────────────

  describe('refreshTrackingBtn', () => {
    it('registers onClick handler on refreshTrackingBtn', async () => {
      await onReadyHandler();
      expect(getEl('#refreshTrackingBtn').onClick).toHaveBeenCalledTimes(1);
      expect(typeof getEl('#refreshTrackingBtn').onClick.mock.calls[0][0]).toBe('function');
    });

    it('sets ARIA label on refreshTrackingBtn', async () => {
      await onReadyHandler();
      expect(getEl('#refreshTrackingBtn').accessibility.ariaLabel).toBe('Refresh tracking status');
    });
  });
});
