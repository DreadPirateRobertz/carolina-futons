/**
 * Tests for pages/Returns.js — onReady initialization
 * Covers: page init calls, lookup form setup, RMA tracker setup,
 * return form setup, results section visibility, new search button.
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
    checked: false, forEachItem: vi.fn(),
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

// ── Dependency Mocks ────────────────────────────────────────────────

vi.mock('backend/returnsService.web', () => ({
  getReturnReasons: vi.fn(() => Promise.resolve({ reasons: [{ label: 'Defective', value: 'defective' }] })),
  lookupReturn: vi.fn(() => Promise.resolve({ success: true, order: { number: '1001' }, returns: [] })),
  submitGuestReturn: vi.fn(() => Promise.resolve({ success: true, rmaNumber: 'RMA-001' })),
  trackReturnShipment: vi.fn(() => Promise.resolve({ success: true, status: 'in_transit', rmaNumber: 'RMA-001' })),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { success: '#22c55e', error: '#ef4444' },
  typography: {},
}));

vi.mock('public/ReturnsPortal.js', () => ({
  checkReturnWindow: vi.fn(() => ({ eligible: true, message: 'Within window' })),
  getStatusTimeline: vi.fn(() => [
    { label: 'Requested', state: 'completed' },
    { label: 'Received', state: 'active' },
    { label: 'Processed', state: 'pending' },
  ]),
  formatReturnStatus: vi.fn((s) => s || 'Unknown'),
  getStatusColor: vi.fn(() => '#22c55e'),
  getReturnableItems: vi.fn((items) => items),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/validators', () => ({
  sanitizeText: vi.fn((text) => text),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  query: {},
}));

// ── Import mock references ──────────────────────────────────────────

const { initBackToTop } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');
const { trackEvent } = await import('public/engagementTracker');
const { getReturnReasons } = await import('backend/returnsService.web');

// ── Load page module (captures onReadyHandler) ─────────────────────

beforeAll(async () => {
  await import('../src/pages/Returns.js');
});

beforeEach(() => {
  elements.forEach((el) => {
    el.text = '';
    el.value = '';
    el.label = '';
    el.collapsed = false;
    el.hidden = false;
    el.accessibility = {};
    el.style = { color: '', fontWeight: '' };
    vi.mocked(el.show).mockClear();
    vi.mocked(el.hide).mockClear();
    vi.mocked(el.collapse).mockClear();
    vi.mocked(el.expand).mockClear();
    vi.mocked(el.onClick).mockClear();
    vi.mocked(el.onKeyPress).mockClear();
    vi.mocked(el.focus).mockClear();
    vi.mocked(el.disable).mockClear();
    vi.mocked(el.enable).mockClear();
  });
  vi.mocked(initBackToTop).mockClear();
  vi.mocked(initPageSeo).mockClear();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(getReturnReasons).mockClear();
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Returns page — onReady initialization', () => {
  // ── 1. Init calls ──────────────────────────────────────────────────

  describe('page init', () => {
    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with "returns"', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('returns');
    });

    it('fires page_view trackEvent', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'returns' });
    });

    it('loads return reasons via getReturnReasons', async () => {
      await onReadyHandler();
      expect(getReturnReasons).toHaveBeenCalled();
    });
  });

  // ── 2. Lookup form ────────────────────────────────────────────────

  describe('lookup form', () => {
    it('sets title text', async () => {
      await onReadyHandler();
      expect(getEl('#returnsTitle').text).toBe('Returns & Exchanges');
    });

    it('sets subtitle text', async () => {
      await onReadyHandler();
      expect(getEl('#returnsSubtitle').text).toBe(
        'Start a return, exchange, or check the status of an existing return.'
      );
    });

    it('sets ARIA label on order number input', async () => {
      await onReadyHandler();
      expect(getEl('#returnOrderNumberInput').accessibility.ariaLabel).toBe('Order number');
    });

    it('sets ARIA label on email input', async () => {
      await onReadyHandler();
      expect(getEl('#returnEmailInput').accessibility.ariaLabel).toBe('Email address used for this order');
    });

    it('sets ARIA label on lookup button', async () => {
      await onReadyHandler();
      expect(getEl('#lookupReturnBtn').accessibility.ariaLabel).toBe('Look up order for return');
    });

    it('registers onClick on lookupReturnBtn', async () => {
      await onReadyHandler();
      expect(getEl('#lookupReturnBtn').onClick).toHaveBeenCalled();
    });

    it('registers onKeyPress on email input', async () => {
      await onReadyHandler();
      expect(getEl('#returnEmailInput').onKeyPress).toHaveBeenCalled();
    });

    it('registers onKeyPress on order number input', async () => {
      await onReadyHandler();
      expect(getEl('#returnOrderNumberInput').onKeyPress).toHaveBeenCalled();
    });
  });

  // ── 3. RMA tracker ───────────────────────────────────────────────

  describe('RMA tracker', () => {
    it('sets ARIA label on rmaInput', async () => {
      await onReadyHandler();
      expect(getEl('#rmaInput').accessibility.ariaLabel).toBe('RMA number');
    });

    it('sets ARIA label on trackRmaBtn', async () => {
      await onReadyHandler();
      expect(getEl('#trackRmaBtn').accessibility.ariaLabel).toBe('Track return by RMA number');
    });

    it('registers onClick on trackRmaBtn', async () => {
      await onReadyHandler();
      expect(getEl('#trackRmaBtn').onClick).toHaveBeenCalled();
    });

    it('registers onKeyPress on rmaInput', async () => {
      await onReadyHandler();
      expect(getEl('#rmaInput').onKeyPress).toHaveBeenCalled();
    });
  });

  // ── 4. Return form ───────────────────────────────────────────────

  describe('return form', () => {
    it('registers onClick on submitGuestReturnBtn', async () => {
      await onReadyHandler();
      expect(getEl('#submitGuestReturnBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on submitGuestReturnBtn', async () => {
      await onReadyHandler();
      expect(getEl('#submitGuestReturnBtn').accessibility.ariaLabel).toBe('Submit return request');
    });

    it('registers onClick on cancelReturnFormBtn', async () => {
      await onReadyHandler();
      expect(getEl('#cancelReturnFormBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on cancelReturnFormBtn', async () => {
      await onReadyHandler();
      expect(getEl('#cancelReturnFormBtn').accessibility.ariaLabel).toBe('Cancel return');
    });
  });

  // ── 5. Results sections ───────────────────────────────────────────

  describe('results sections', () => {
    it('collapses returnResultsSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#returnResultsSection').collapse).toHaveBeenCalled();
    });

    it('collapses existingReturnsSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#existingReturnsSection').collapse).toHaveBeenCalled();
    });

    it('collapses returnFormSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#returnFormSection').collapse).toHaveBeenCalled();
    });

    it('collapses rmaResultsSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#rmaResultsSection').collapse).toHaveBeenCalled();
    });

    it('collapses rmaTrackingSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#rmaTrackingSection').collapse).toHaveBeenCalled();
    });

    it('hides returnError on init', async () => {
      await onReadyHandler();
      expect(getEl('#returnError').hide).toHaveBeenCalled();
    });

    it('hides returnLoader on init', async () => {
      await onReadyHandler();
      expect(getEl('#returnLoader').hide).toHaveBeenCalled();
    });

    it('hides returnSuccessMessage on init', async () => {
      await onReadyHandler();
      expect(getEl('#returnSuccessMessage').hide).toHaveBeenCalled();
    });
  });

  // ── 6. New search button ──────────────────────────────────────────

  describe('new search button', () => {
    it('registers onClick on newReturnSearchBtn', async () => {
      await onReadyHandler();
      expect(getEl('#newReturnSearchBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on newReturnSearchBtn', async () => {
      await onReadyHandler();
      expect(getEl('#newReturnSearchBtn').accessibility.ariaLabel).toBe('Start a new return lookup');
    });
  });
});
