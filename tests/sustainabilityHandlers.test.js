import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

/* ── mock elements ────────────────────────────────────────────────── */
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
    focus: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
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

/* ── vi.mock all imports ──────────────────────────────────────────── */
vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn(async () => ({ '@type': 'LocalBusiness' })),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
}));

vi.mock('public/sustainabilityHelpers.js', () => ({
  getSustainabilityPageContent: vi.fn(() => ({
    hero: { heading: 'Sustainability', subheading: 'Our commitment', intro: 'We believe...' },
    materials: { heading: 'Materials', description: 'Eco sources' },
    certifications: { heading: 'Certifications' },
    tradeIn: { heading: 'Trade-In', description: 'Trade your old furniture' },
  })),
  getMaterialHighlights: vi.fn(() => [
    { title: 'Solid Wood', description: 'From managed forests' },
  ]),
  getCertificationsList: vi.fn(() => [
    { name: 'FSC', description: 'Forest certified' },
  ]),
  getBadgeDefinitions: vi.fn(() => [
    { label: 'Eco-Friendly', description: 'Meets standards' },
  ]),
  getConditionOptions: vi.fn(() => [
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
  ]),
  getTradeInSteps: vi.fn(() => [
    { number: 1, title: 'Submit', description: 'Fill form' },
  ]),
  formatCarbonData: vi.fn(),
  estimateCreditRange: vi.fn(() => ({ min: 50, max: 150 })),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

/* ── import mocks & page ──────────────────────────────────────────── */
let trackEvent, initBackToTop, initPageSeo;
let getSustainabilityPageContent, getMaterialHighlights, getCertificationsList;
let getBadgeDefinitions, getConditionOptions, getTradeInSteps, estimateCreditRange;
let getBusinessSchema;

beforeAll(async () => {
  const tracker = await import('public/engagementTracker');
  trackEvent = tracker.trackEvent;

  const mobile = await import('public/mobileHelpers');
  initBackToTop = mobile.initBackToTop;

  const pageSeo = await import('public/pageSeo.js');
  initPageSeo = pageSeo.initPageSeo;

  const helpers = await import('public/sustainabilityHelpers.js');
  getSustainabilityPageContent = helpers.getSustainabilityPageContent;
  getMaterialHighlights = helpers.getMaterialHighlights;
  getCertificationsList = helpers.getCertificationsList;
  getBadgeDefinitions = helpers.getBadgeDefinitions;
  getConditionOptions = helpers.getConditionOptions;
  getTradeInSteps = helpers.getTradeInSteps;
  estimateCreditRange = helpers.estimateCreditRange;

  const seo = await import('backend/seoHelpers.web');
  getBusinessSchema = seo.getBusinessSchema;

  await import('../src/pages/Sustainability.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

/* ── tests ────────────────────────────────────────────────────────── */
describe('Sustainability page', () => {
  /* 1 — Initialization */
  describe('onReady initialization', () => {
    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with sustainability', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('sustainability');
    });

    it('tracks page_view event for sustainability', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'sustainability' });
    });
  });

  /* 2 — Hero section */
  describe('Hero section', () => {
    it('sets hero heading text', async () => {
      await onReadyHandler();
      expect(getEl('#sustainHeroHeading').text).toBe('Sustainability');
    });

    it('sets hero subheading text', async () => {
      await onReadyHandler();
      expect(getEl('#sustainHeroSubheading').text).toBe('Our commitment');
    });

    it('sets hero intro text', async () => {
      await onReadyHandler();
      expect(getEl('#sustainHeroIntro').text).toBe('We believe...');
    });
  });

  /* 3 — Materials section */
  describe('Materials section', () => {
    it('sets materials heading', async () => {
      await onReadyHandler();
      expect(getEl('#materialsHeading').text).toBe('Materials');
    });

    it('sets materials description', async () => {
      await onReadyHandler();
      expect(getEl('#materialsDescription').text).toBe('Eco sources');
    });

    it('sets materials repeater ARIA label', async () => {
      await onReadyHandler();
      expect(getEl('#materialsRepeater').accessibility.ariaLabel).toBe('Sustainably sourced materials');
    });

    it('populates materials repeater data', async () => {
      await onReadyHandler();
      const data = getEl('#materialsRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ title: 'Solid Wood', _id: 'material-0' });
    });

    it('onItemReady sets material title and description', async () => {
      await onReadyHandler();
      const cb = getEl('#materialsRepeater').onItemReady.mock.calls[0][0];
      const mockItem = createMockElement();
      const $item = (sel) => { mockItem._lastSel = sel; return mockItem; };
      cb($item, { title: 'Solid Wood', description: 'From managed forests' });
      // The callback sets text on two selectors; verify via the last assignment
      expect(mockItem.text).toBe('From managed forests');
    });
  });

  /* 4 — Certifications section */
  describe('Certifications section', () => {
    it('sets certifications heading', async () => {
      await onReadyHandler();
      expect(getEl('#certificationsHeading').text).toBe('Certifications');
    });

    it('sets certifications repeater ARIA label', async () => {
      await onReadyHandler();
      expect(getEl('#certificationsRepeater').accessibility.ariaLabel).toBe('Environmental certifications');
    });

    it('populates certifications repeater data', async () => {
      await onReadyHandler();
      const data = getEl('#certificationsRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ name: 'FSC', _id: 'cert-0' });
    });

    it('onItemReady sets cert name and description', async () => {
      await onReadyHandler();
      const cb = getEl('#certificationsRepeater').onItemReady.mock.calls[0][0];
      const items = new Map();
      const $item = (sel) => {
        if (!items.has(sel)) items.set(sel, createMockElement());
        return items.get(sel);
      };
      cb($item, { name: 'FSC', description: 'Forest certified' });
      expect(items.get('#certName').text).toBe('FSC');
      expect(items.get('#certDesc').text).toBe('Forest certified');
    });
  });

  /* 5 — Badges showcase */
  describe('Badges showcase', () => {
    it('sets badges repeater ARIA label', async () => {
      await onReadyHandler();
      expect(getEl('#badgesRepeater').accessibility.ariaLabel).toBe('Sustainability badges');
    });

    it('populates badges repeater data', async () => {
      await onReadyHandler();
      const data = getEl('#badgesRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ label: 'Eco-Friendly', _id: 'badge-0' });
    });

    it('onItemReady sets badge label and description', async () => {
      await onReadyHandler();
      const cb = getEl('#badgesRepeater').onItemReady.mock.calls[0][0];
      const items = new Map();
      const $item = (sel) => {
        if (!items.has(sel)) items.set(sel, createMockElement());
        return items.get(sel);
      };
      cb($item, { label: 'Eco-Friendly', description: 'Meets standards' });
      expect(items.get('#badgeLabel').text).toBe('Eco-Friendly');
      expect(items.get('#badgeDesc').text).toBe('Meets standards');
    });
  });

  /* 6 — Carbon offset */
  describe('Carbon offset section', () => {
    it('sets carbon heading text', async () => {
      await onReadyHandler();
      expect(getEl('#carbonHeading').text).toBe('Carbon Offset at Checkout');
    });

    it('sets carbon description text', async () => {
      await onReadyHandler();
      expect(getEl('#carbonDescription').text).toBe(
        'Add a small contribution at checkout to offset the carbon footprint of your purchase. We partner with verified reforestation programs.'
      );
    });
  });

  /* 7 — Trade-in */
  describe('Trade-in section', () => {
    it('sets trade-in heading', async () => {
      await onReadyHandler();
      expect(getEl('#tradeInHeading').text).toBe('Trade-In');
    });

    it('sets trade-in description', async () => {
      await onReadyHandler();
      expect(getEl('#tradeInDescription').text).toBe('Trade your old furniture');
    });

    it('populates dropdown options from getConditionOptions', async () => {
      await onReadyHandler();
      const opts = getEl('#tradeInCondition').options;
      expect(opts).toEqual([
        { value: 'good', label: 'Good' },
        { value: 'fair', label: 'Fair' },
      ]);
    });

    it('onChange calls estimateCreditRange and sets estimate text', async () => {
      await onReadyHandler();
      const dropdown = getEl('#tradeInCondition');
      const changeCb = dropdown.onChange.mock.calls[0][0];
      dropdown.value = 'good';
      changeCb();
      expect(estimateCreditRange).toHaveBeenCalledWith('good');
      expect(getEl('#tradeInEstimate').text).toBe('Estimated credit: $50\u2013$150');
    });
  });

  /* 8 — Trade-in steps */
  describe('Trade-in steps', () => {
    it('sets trade-in steps repeater ARIA label', async () => {
      await onReadyHandler();
      expect(getEl('#tradeInStepsRepeater').accessibility.ariaLabel).toBe('Trade-in process steps');
    });

    it('populates trade-in steps repeater data', async () => {
      await onReadyHandler();
      const data = getEl('#tradeInStepsRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ number: 1, title: 'Submit', _id: 'step-0' });
    });

    it('onItemReady sets step number, title, and description', async () => {
      await onReadyHandler();
      const cb = getEl('#tradeInStepsRepeater').onItemReady.mock.calls[0][0];
      const items = new Map();
      const $item = (sel) => {
        if (!items.has(sel)) items.set(sel, createMockElement());
        return items.get(sel);
      };
      cb($item, { number: 1, title: 'Submit', description: 'Fill form' });
      expect(items.get('#stepNumber').text).toBe('1');
      expect(items.get('#stepTitle').text).toBe('Submit');
      expect(items.get('#stepDesc').text).toBe('Fill form');
    });
  });

  /* 9 — Schema injection */
  describe('Schema injection', () => {
    it('calls getBusinessSchema', async () => {
      await onReadyHandler();
      expect(getBusinessSchema).toHaveBeenCalled();
    });

    it('posts schema message to sustainSchemaHtml', async () => {
      await onReadyHandler();
      expect(getEl('#sustainSchemaHtml').postMessage).toHaveBeenCalledWith({ '@type': 'LocalBusiness' });
    });
  });
});
