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

vi.mock('backend/priceMatchService.web', () => ({
  submitPriceMatchRequest: vi.fn(() => Promise.resolve({ success: true, request: { claimNumber: 'PM-001' } })),
  getMyPriceMatches: vi.fn(() => Promise.resolve({ requests: [] })),
  getCompetitorSources: vi.fn(() => Promise.resolve({ competitors: [] })),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { success: '#4A7C59', error: '#C0392B' },
}));

vi.mock('public/priceMatchHelpers.js', () => ({
  validatePriceMatchFields: vi.fn(() => ({ valid: true, errors: [] })),
  getCompetitorOptions: vi.fn(() => [{ label: 'Amazon', value: 'amazon' }]),
  formatClaimStatus: vi.fn((s) => s),
  getStatusColor: vi.fn(() => '#333'),
  formatPrice: vi.fn((p) => `$${p}`),
  calculateSavings: vi.fn(() => ({ amount: 50, percentage: 10 })),
  getPriceMatchPolicy: vi.fn(() => ({
    title: 'Price Match',
    description: 'We match prices',
    rules: ['Same item'],
    exclusions: ['Clearance'],
  })),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/validators', () => ({
  sanitizeText: vi.fn((v) => v || ''),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Import Mock Refs ─────────────────────────────────────────────────

const { initBackToTop } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');
const { trackEvent } = await import('public/engagementTracker');
const { submitPriceMatchRequest } = await import('backend/priceMatchService.web');
const { validatePriceMatchFields, getCompetitorOptions, getPriceMatchPolicy } = await import('public/priceMatchHelpers.js');

// ── Tests ────────────────────────────────────────────────────────────

describe('Price Match Guarantee page handlers', () => {
  beforeAll(async () => {
    await import('../src/pages/Price Match Guarantee.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ────────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initPageSeo with priceMatch', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('priceMatch');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'price_match' });
    });

    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });
  });

  // ── Policy Section ────────────────────────────────────────────────

  describe('initPolicySection', () => {
    it('sets policy title text', async () => {
      await onReadyHandler();
      expect(getEl('#priceMatchTitle').text).toBe('Price Match');
    });

    it('sets policy description text', async () => {
      await onReadyHandler();
      expect(getEl('#priceMatchDescription').text).toBe('We match prices');
    });

    it('sets policy rules repeater data from getPriceMatchPolicy', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRulesRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0].text).toBe('Same item');
      expect(repeater.data[0]._id).toBe('rule-0');
    });

    it('policy rules onItemReady sets policyRuleText', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRulesRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'rule-0', text: 'Same item' });
      expect($item('#policyRuleText').text).toBe('Same item');
    });

    it('sets policy exclusions repeater data from getPriceMatchPolicy', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyExclusionsRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0].text).toBe('Clearance');
      expect(repeater.data[0]._id).toBe('excl-0');
    });

    it('exclusions onItemReady sets exclusionText', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyExclusionsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'excl-0', text: 'Clearance' });
      expect($item('#exclusionText').text).toBe('Clearance');
    });
  });

  // ── Form Section ──────────────────────────────────────────────────

  describe('initFormSection', () => {
    it('sets ARIA labels on form inputs', async () => {
      await onReadyHandler();
      expect(getEl('#pmProductName').accessibility.ariaLabel).toBe('Product name');
      expect(getEl('#pmOurPrice').accessibility.ariaLabel).toBe('Our price for this product');
      expect(getEl('#pmCompetitorSelect').accessibility.ariaLabel).toBe('Select competitor retailer');
      expect(getEl('#pmCompetitorPrice').accessibility.ariaLabel).toBe('Competitor price');
      expect(getEl('#pmCompetitorUrl').accessibility.ariaLabel).toBe('Link to competitor listing (optional)');
      expect(getEl('#pmNotes').accessibility.ariaLabel).toBe('Additional notes (optional)');
      expect(getEl('#pmSubmitBtn').accessibility.ariaLabel).toBe('Submit price match request');
    });

    it('populates competitor dropdown options from getCompetitorOptions', async () => {
      await onReadyHandler();
      expect(getEl('#pmCompetitorSelect').options).toEqual([{ label: 'Amazon', value: 'amazon' }]);
    });

    it('registers onInput on price inputs', async () => {
      await onReadyHandler();
      expect(getEl('#pmOurPrice').onInput).toHaveBeenCalled();
      expect(getEl('#pmCompetitorPrice').onInput).toHaveBeenCalled();
    });

    it('registers onClick on submit button', async () => {
      await onReadyHandler();
      expect(getEl('#pmSubmitBtn').onClick).toHaveBeenCalled();
    });
  });

  // ── Error State Initialization ────────────────────────────────────

  describe('initErrorStates', () => {
    it('hides pmFormError on init', async () => {
      await onReadyHandler();
      expect(getEl('#pmFormError').hide).toHaveBeenCalled();
    });

    it('hides pmSuccessSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#pmSuccessSection').hide).toHaveBeenCalled();
    });

    it('hides pmSavingsPreview on init', async () => {
      await onReadyHandler();
      expect(getEl('#pmSavingsPreview').hide).toHaveBeenCalled();
    });
  });

  // ── Requests Section ──────────────────────────────────────────────

  describe('initRequestsSection', () => {
    it('collapses pmRequestsSection on init', async () => {
      await onReadyHandler();
      expect(getEl('#pmRequestsSection').collapse).toHaveBeenCalled();
    });

    it('registers onClick on pmNewRequestBtn', async () => {
      await onReadyHandler();
      expect(getEl('#pmNewRequestBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on pmNewRequestBtn', async () => {
      await onReadyHandler();
      expect(getEl('#pmNewRequestBtn').accessibility.ariaLabel).toBe('Submit another price match request');
    });
  });

  // ── handleSubmit ──────────────────────────────────────────────────

  describe('handleSubmit', () => {
    async function triggerSubmit() {
      await onReadyHandler();
      const submitBtn = getEl('#pmSubmitBtn');
      const clickHandler = submitBtn.onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('calls submitPriceMatchRequest when validation passes', async () => {
      validatePriceMatchFields.mockReturnValue({ valid: true, errors: [] });
      await triggerSubmit();
      expect(submitPriceMatchRequest).toHaveBeenCalled();
    });

    it('shows success message on successful submit', async () => {
      validatePriceMatchFields.mockReturnValue({ valid: true, errors: [] });
      submitPriceMatchRequest.mockResolvedValue({ success: true, request: { claimNumber: 'PM-001' } });
      await triggerSubmit();
      expect(getEl('#pmSuccessMessage').text).toContain('PM-001');
    });

    it('hides form section and shows success section on success', async () => {
      validatePriceMatchFields.mockReturnValue({ valid: true, errors: [] });
      submitPriceMatchRequest.mockResolvedValue({ success: true, request: { claimNumber: 'PM-001' } });
      await triggerSubmit();
      expect(getEl('#pmFormSection').hide).toHaveBeenCalled();
      expect(getEl('#pmSuccessSection').show).toHaveBeenCalled();
    });

    it('tracks price_match_submitted event on success', async () => {
      validatePriceMatchFields.mockReturnValue({ valid: true, errors: [] });
      submitPriceMatchRequest.mockResolvedValue({ success: true, request: { claimNumber: 'PM-001' } });
      await triggerSubmit();
      expect(trackEvent).toHaveBeenCalledWith('price_match_submitted', expect.any(Object));
    });

    it('does not call submitPriceMatchRequest when validation fails', async () => {
      validatePriceMatchFields.mockReturnValue({
        valid: false,
        errors: [{ field: 'productName', message: 'Required' }],
      });
      await triggerSubmit();
      expect(submitPriceMatchRequest).not.toHaveBeenCalled();
    });
  });
});
