import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks – declared BEFORE any page import                           */
/* ------------------------------------------------------------------ */

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/faqSeo.js', () => ({
  injectFaqSeo: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

const mockFaqData = [
  { _id: 'faq-1', question: 'What sizes?', answer: 'Full, Queen, King', category: 'products' },
  { _id: 'faq-2', question: 'Shipping time?', answer: '5-7 business days', category: 'shipping' },
];

const mockCategories = [
  { id: 'products', label: 'Products' },
  { id: 'shipping', label: 'Shipping' },
];

vi.mock('public/faqHelpers.js', () => ({
  getFaqData: vi.fn(() => mockFaqData),
  getFaqCategories: vi.fn(() => mockCategories),
  filterFaqsByCategory: vi.fn((faqs, cat) => cat ? faqs.filter(f => f.category === cat) : faqs),
  searchFaqs: vi.fn((faqs, query) => query ? faqs.filter(f => f.question.toLowerCase().includes(query)) : faqs),
}));

vi.mock('wix-location-frontend', () => ({ to: vi.fn() }));
vi.mock('wix-window-frontend', () => ({ openUrl: vi.fn() }));

/* ------------------------------------------------------------------ */
/*  $w mock                                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Import helpers + page                                             */
/* ------------------------------------------------------------------ */

let trackEvent, initBackToTop, announce, injectFaqSeo, initPageSeo;
let getFaqData, getFaqCategories, filterFaqsByCategory, searchFaqs;

beforeAll(async () => {
  ({ trackEvent } = await import('public/engagementTracker'));
  ({ initBackToTop } = await import('public/mobileHelpers'));
  ({ announce } = await import('public/a11yHelpers'));
  ({ injectFaqSeo } = await import('public/faqSeo.js'));
  ({ initPageSeo } = await import('public/pageSeo.js'));
  ({ getFaqData, getFaqCategories, filterFaqsByCategory, searchFaqs } = await import('public/faqHelpers.js'));
  await import('../src/pages/FAQ.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  getFaqData.mockReturnValue(mockFaqData);
  getFaqCategories.mockReturnValue(mockCategories);
  filterFaqsByCategory.mockImplementation((faqs, cat) => cat ? faqs.filter(f => f.category === cat) : faqs);
  searchFaqs.mockImplementation((faqs, query) => query ? faqs.filter(f => f.question.toLowerCase().includes(query)) : faqs);
  injectFaqSeo.mockReturnValue(Promise.resolve());
});

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('FAQ Page', () => {
  /* 1 — Initialization */
  describe('initialization', () => {
    it('calls initBackToTop, initPageSeo, injectFaqSeo, and tracks page_view', async () => {
      await onReadyHandler();

      expect(initBackToTop).toHaveBeenCalledWith($w);
      expect(initPageSeo).toHaveBeenCalledWith('faq');
      expect(injectFaqSeo).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'faq' });
    });
  });

  /* 2 — Page heading */
  describe('page heading', () => {
    it('sets faqTitle and faqSubtitle text', async () => {
      await onReadyHandler();

      expect(getEl('#faqTitle').text).toBe('Frequently Asked Questions');
      expect(getEl('#faqSubtitle').text).toContain('Find answers about our futons');
    });
  });

  /* 3 — Category filters: repeater setup */
  describe('category filters', () => {
    it('sets repeater ARIA label/role and data includes All + categories', async () => {
      await onReadyHandler();

      const catRepeater = getEl('#faqCategoryRepeater');
      expect(catRepeater.accessibility.ariaLabel).toBe('FAQ category filters');
      expect(catRepeater.accessibility.role).toBe('tablist');

      expect(catRepeater.data).toHaveLength(3);
      expect(catRepeater.data[0]).toMatchObject({ label: 'All' });
      expect(catRepeater.data[1]).toMatchObject({ label: 'Products' });
      expect(catRepeater.data[2]).toMatchObject({ label: 'Shipping' });
    });

    it('onItemReady sets label text with tab role', async () => {
      await onReadyHandler();

      const catRepeater = getEl('#faqCategoryRepeater');
      const onItemReadyCb = catRepeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`catItem-${sel}`);
      const itemData = { id: 'products', label: 'Products' };
      onItemReadyCb($item, itemData);

      expect(getEl('catItem-#categoryLabel').text).toBe('Products');
      expect(getEl('catItem-#categoryLabel').accessibility.role).toBe('tab');
      expect(getEl('catItem-#categoryLabel').accessibility.ariaLabel).toBe('Filter FAQs: Products');
      expect(getEl('catItem-#categoryLabel').accessibility.tabIndex).toBe(0);
    });
  });

  /* 4 — Category filter click */
  describe('category filter click', () => {
    it('tracks faq_category event and announces selection', async () => {
      await onReadyHandler();

      const catRepeater = getEl('#faqCategoryRepeater');
      const onItemReadyCb = catRepeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      const itemData = { id: 'products', label: 'Products' };
      onItemReadyCb($item, itemData);

      const clickHandler = itemElements.get('#categoryLabel').onClick.mock.calls[0][0];
      clickHandler();

      expect(trackEvent).toHaveBeenCalledWith('faq_category', { category: 'Products' });
      expect(announce).toHaveBeenCalledWith($w, 'Showing Products FAQs');
    });
  });

  /* 5 — FAQ accordion: repeater data and item setup */
  describe('FAQ accordion', () => {
    it('sets repeater data from getFaqData, onItemReady sets question/answer, starts collapsed with +', async () => {
      await onReadyHandler();

      const repeater = getEl('#faqRepeater');
      expect(repeater.data).toEqual(mockFaqData);

      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, mockFaqData[0]);

      expect(itemElements.get('#faqQuestion').text).toBe('What sizes?');
      expect(itemElements.get('#faqAnswer').text).toBe('Full, Queen, King');
      expect(itemElements.get('#faqAnswer').collapse).toHaveBeenCalled();
      expect(itemElements.get('#faqToggle').text).toBe('+');
    });
  });

  /* 6 — FAQ accordion ARIA */
  describe('FAQ accordion ARIA', () => {
    it('sets question role=button and toggle ariaExpanded=false', async () => {
      await onReadyHandler();

      const repeater = getEl('#faqRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, mockFaqData[0]);

      expect(itemElements.get('#faqQuestion').accessibility.role).toBe('button');
      expect(itemElements.get('#faqQuestion').accessibility.ariaLabel).toBe('Toggle answer: What sizes?');
      expect(itemElements.get('#faqToggle').accessibility.ariaExpanded).toBe(false);
      expect(itemElements.get('#faqToggle').accessibility.ariaLabel).toBe('Toggle answer: What sizes?');
    });
  });

  /* 7 — Toggle expand */
  describe('toggle expand', () => {
    it('expands answer, changes toggle to minus, sets ariaExpanded=true, tracks faq_expand', async () => {
      await onReadyHandler();

      const repeater = getEl('#faqRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, mockFaqData[0]);

      // Answer starts collapsed
      expect(itemElements.get('#faqAnswer').collapsed).toBe(true);

      // Get click handler from faqQuestion
      const clickHandler = itemElements.get('#faqQuestion').onClick.mock.calls[0][0];
      clickHandler();

      expect(itemElements.get('#faqAnswer').expand).toHaveBeenCalled();
      expect(itemElements.get('#faqAnswer').collapsed).toBe(false);
      expect(itemElements.get('#faqToggle').text).toBe('\u2212');
      expect(itemElements.get('#faqToggle').accessibility.ariaExpanded).toBe(true);
      expect(trackEvent).toHaveBeenCalledWith('faq_expand', { question: 'What sizes?' });
    });
  });

  /* 8 — Toggle collapse */
  describe('toggle collapse', () => {
    it('collapses expanded answer, changes toggle to +, sets ariaExpanded=false', async () => {
      await onReadyHandler();

      const repeater = getEl('#faqRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, mockFaqData[0]);

      const clickHandler = itemElements.get('#faqQuestion').onClick.mock.calls[0][0];

      // First click: expand
      clickHandler();
      expect(itemElements.get('#faqAnswer').collapsed).toBe(false);

      // Second click: collapse
      clickHandler();
      expect(itemElements.get('#faqAnswer').collapse).toHaveBeenCalled();
      expect(itemElements.get('#faqAnswer').collapsed).toBe(true);
      expect(itemElements.get('#faqToggle').text).toBe('+');
      expect(itemElements.get('#faqToggle').accessibility.ariaExpanded).toBe(false);
    });
  });

  /* 9 — FAQ search */
  describe('FAQ search', () => {
    it('sets ARIA label on search input and registers onKeyPress', async () => {
      await onReadyHandler();

      const searchInput = getEl('#faqSearchInput');
      expect(searchInput.accessibility.ariaLabel).toBe('Search frequently asked questions');
      expect(searchInput.onKeyPress).toHaveBeenCalled();
    });
  });

  /* 10 — Contact CTA */
  describe('contact CTA', () => {
    it('sets title/body text, button labels, onClick handlers, and ARIA labels', async () => {
      await onReadyHandler();

      expect(getEl('#faqContactTitle').text).toBe('Still Have Questions?');
      expect(getEl('#faqContactBody').text).toContain('Our team is happy to help');
      expect(getEl('#faqContactBody').text).toContain('(828) 252-9449');

      const contactBtn = getEl('#faqContactBtn');
      expect(contactBtn.label).toBe('Contact Us');
      expect(contactBtn.onClick).toHaveBeenCalled();
      expect(contactBtn.accessibility.ariaLabel).toBe('Contact Carolina Futons');

      const phoneBtn = getEl('#faqPhoneBtn');
      expect(phoneBtn.label).toBe('(828) 252-9449');
      expect(phoneBtn.onClick).toHaveBeenCalled();
      expect(phoneBtn.accessibility.ariaLabel).toBe('Call Carolina Futons at (828) 252-9449');
    });
  });
});
