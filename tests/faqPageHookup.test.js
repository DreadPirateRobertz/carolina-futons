/**
 * Tests for pages/FAQ.js
 * Covers: page init, heading, category filters, FAQ accordion (expand/collapse),
 * search with debounce, contact CTA, filter application, no-results state, SEO.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    data: [],
    collapsed: false,
    style: { color: '' },
    accessibility: { ariaLabel: '', ariaLive: '', role: '', ariaExpanded: false, tabIndex: -1 },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onItemReady: vi.fn(),
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

// ── Mock Data ───────────────────────────────────────────────────────

const mockFaqData = [
  { _id: 'faq-1', question: 'What is a futon?', answer: 'A futon is a convertible sofa-bed that folds flat for sleeping.', category: 'products' },
  { _id: 'faq-2', question: 'Do you offer free shipping?', answer: 'Yes, we offer free shipping on orders over $999 to the contiguous US.', category: 'shipping' },
  { _id: 'faq-3', question: 'What is your return policy?', answer: 'We accept returns within 30 days of delivery with original packaging.', category: 'returns' },
  { _id: 'faq-4', question: 'Can I visit the showroom?', answer: 'Yes! Our Hendersonville showroom is open Wednesday through Saturday.', category: 'showroom' },
];

const mockCategories = [
  { id: 'products', label: 'Products', description: 'Product FAQs' },
  { id: 'shipping', label: 'Shipping', description: 'Shipping FAQs' },
  { id: 'returns', label: 'Returns', description: 'Returns FAQs' },
  { id: 'showroom', label: 'Showroom', description: 'Showroom FAQs' },
];

// ── Mock Dependencies ───────────────────────────────────────────────

const trackEvent = vi.fn();
vi.mock('public/engagementTracker', () => ({
  trackEvent: (...args) => trackEvent(...args),
}));

vi.mock('public/mobileHelpers', () => ({ initBackToTop: vi.fn() }));

const announce = vi.fn();
vi.mock('public/a11yHelpers', () => ({
  announce: (...args) => announce(...args),
}));

vi.mock('public/faqSeo.js', () => ({
  injectFaqSeo: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));

vi.mock('public/faqHelpers.js', () => ({
  getFaqData: vi.fn(() => mockFaqData),
  getFaqCategories: vi.fn(() => mockCategories),
  filterFaqsByCategory: vi.fn((faqs, cat) => {
    if (!cat) return faqs;
    return faqs.filter(f => f.category === cat);
  }),
  searchFaqs: vi.fn((faqs, query) => {
    if (!query) return faqs;
    return faqs.filter(f =>
      f.question.toLowerCase().includes(query) ||
      f.answer.toLowerCase().includes(query)
    );
  }),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
}));

// ── Import Page ─────────────────────────────────────────────────────

describe('FAQ Page', () => {
  beforeAll(async () => {
    await import('../src/pages/FAQ.js');
  });

  beforeEach(() => {
    elements.clear();
    trackEvent.mockClear();
    announce.mockClear();
  });

  // ── Page Init ───────────────────────────────────────────────────

  describe('page initialization', () => {
    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'faq' });
    });

    it('sets FAQ title heading', async () => {
      await onReadyHandler();
      expect(getEl('#faqTitle').text).toBe('Frequently Asked Questions');
    });

    it('sets FAQ subtitle with showroom info', async () => {
      await onReadyHandler();
      expect(getEl('#faqSubtitle').text).toContain('Hendersonville showroom');
    });
  });

  // ── Category Filters ────────────────────────────────────────────

  describe('category filters', () => {
    it('populates category repeater with categories + All option', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#faqCategoryRepeater');
      // 4 categories + 1 "All" = 5
      expect(catRepeater.data).toHaveLength(5);
      expect(catRepeater.data[0].label).toBe('All');
    });

    it('registers onItemReady on category repeater', async () => {
      await onReadyHandler();
      expect(getEl('#faqCategoryRepeater').onItemReady).toHaveBeenCalled();
    });

    it('sets ARIA label and role on category repeater', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#faqCategoryRepeater');
      expect(catRepeater.accessibility.ariaLabel).toContain('category');
      expect(catRepeater.accessibility.role).toBe('tablist');
    });

    it('onItemReady sets category label text', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqCategoryRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', accessibility: { role: '', ariaLabel: '', tabIndex: -1 },
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, { _id: 'cat-products', id: 'products', label: 'Products' });
      expect(itemEls['#categoryLabel'].text).toBe('Products');
    });

    it('onItemReady sets ARIA role=tab on category label', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqCategoryRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', accessibility: { role: '', ariaLabel: '', tabIndex: -1 },
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, { _id: 'cat-products', id: 'products', label: 'Products' });
      expect(itemEls['#categoryLabel'].accessibility.role).toBe('tab');
    });

    it('onItemReady registers onClick for category selection', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqCategoryRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', accessibility: { role: '', ariaLabel: '', tabIndex: -1 },
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, { _id: 'cat-products', id: 'products', label: 'Products' });
      expect(itemEls['#categoryLabel'].onClick).toHaveBeenCalled();
    });

    it('category click triggers tracking and announcement', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqCategoryRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', accessibility: { role: '', ariaLabel: '', tabIndex: -1 },
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, { _id: 'cat-shipping', id: 'shipping', label: 'Shipping' });

      trackEvent.mockClear();
      announce.mockClear();
      const clickHandler = itemEls['#categoryLabel'].onClick.mock.calls[0][0];
      clickHandler();

      expect(trackEvent).toHaveBeenCalledWith('faq_category', { category: 'Shipping' });
      expect(announce).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Shipping'));
    });

    it('category click filters FAQ repeater data', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqCategoryRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', accessibility: { role: '', ariaLabel: '', tabIndex: -1 },
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, { _id: 'cat-shipping', id: 'shipping', label: 'Shipping' });
      const clickHandler = itemEls['#categoryLabel'].onClick.mock.calls[0][0];
      clickHandler();

      const faqRepeater = getEl('#faqRepeater');
      expect(faqRepeater.data).toHaveLength(1);
      expect(faqRepeater.data[0].category).toBe('shipping');
    });
  });

  // ── FAQ Accordion ───────────────────────────────────────────────

  describe('FAQ accordion', () => {
    it('populates FAQ repeater with data', async () => {
      await onReadyHandler();
      expect(getEl('#faqRepeater').data).toHaveLength(4);
    });

    it('registers onItemReady on FAQ repeater', async () => {
      await onReadyHandler();
      expect(getEl('#faqRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets question and answer text', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', collapsed: false,
          accessibility: { role: '', ariaLabel: '', ariaExpanded: false, tabIndex: -1 },
          collapse: vi.fn(function () { this.collapsed = true; }),
          expand: vi.fn(function () { this.collapsed = false; }),
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, mockFaqData[0]);
      expect(itemEls['#faqQuestion'].text).toBe('What is a futon?');
      expect(itemEls['#faqAnswer'].text).toContain('convertible sofa-bed');
    });

    it('onItemReady starts FAQ answer collapsed', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', collapsed: false,
          accessibility: { role: '', ariaLabel: '', ariaExpanded: false, tabIndex: -1 },
          collapse: vi.fn(function () { this.collapsed = true; }),
          expand: vi.fn(function () { this.collapsed = false; }),
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, mockFaqData[0]);
      expect(itemEls['#faqAnswer'].collapse).toHaveBeenCalled();
      expect(itemEls['#faqToggle'].text).toBe('+');
    });

    it('onItemReady sets ARIA role=button on question', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', collapsed: false,
          accessibility: { role: '', ariaLabel: '', ariaExpanded: false, tabIndex: -1 },
          collapse: vi.fn(function () { this.collapsed = true; }),
          expand: vi.fn(function () { this.collapsed = false; }),
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, mockFaqData[0]);
      expect(itemEls['#faqQuestion'].accessibility.role).toBe('button');
    });

    it('onItemReady sets ariaExpanded=false on toggle initially', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', collapsed: false,
          accessibility: { role: '', ariaLabel: '', ariaExpanded: false, tabIndex: -1 },
          collapse: vi.fn(function () { this.collapsed = true; }),
          expand: vi.fn(function () { this.collapsed = false; }),
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, mockFaqData[0]);
      expect(itemEls['#faqToggle'].accessibility.ariaExpanded).toBe(false);
    });

    it('clicking question expands answer and updates toggle', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', collapsed: false,
          accessibility: { role: '', ariaLabel: '', ariaExpanded: false, tabIndex: -1 },
          collapse: vi.fn(function () { this.collapsed = true; }),
          expand: vi.fn(function () { this.collapsed = false; }),
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, mockFaqData[0]);
      // Answer starts collapsed
      itemEls['#faqAnswer'].collapse();

      // Click the question
      const questionClick = itemEls['#faqQuestion'].onClick.mock.calls[0][0];
      questionClick();

      expect(itemEls['#faqAnswer'].expand).toHaveBeenCalled();
      expect(itemEls['#faqToggle'].text).toBe('\u2212'); // minus sign
      expect(itemEls['#faqToggle'].accessibility.ariaExpanded).toBe(true);
    });

    it('clicking toggle collapses already-expanded answer', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', collapsed: false,
          accessibility: { role: '', ariaLabel: '', ariaExpanded: false, tabIndex: -1 },
          collapse: vi.fn(function () { this.collapsed = true; }),
          expand: vi.fn(function () { this.collapsed = false; }),
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, mockFaqData[0]);
      // Start collapsed, then expand
      itemEls['#faqAnswer'].collapse();
      const questionClick = itemEls['#faqQuestion'].onClick.mock.calls[0][0];
      questionClick(); // expand
      questionClick(); // collapse again

      expect(itemEls['#faqToggle'].text).toBe('+');
      expect(itemEls['#faqToggle'].accessibility.ariaExpanded).toBe(false);
    });

    it('expanding FAQ tracks faq_expand event', async () => {
      await onReadyHandler();
      trackEvent.mockClear();
      const itemReadyCb = getEl('#faqRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', collapsed: false,
          accessibility: { role: '', ariaLabel: '', ariaExpanded: false, tabIndex: -1 },
          collapse: vi.fn(function () { this.collapsed = true; }),
          expand: vi.fn(function () { this.collapsed = false; }),
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, mockFaqData[0]);
      itemEls['#faqAnswer'].collapse();

      const questionClick = itemEls['#faqQuestion'].onClick.mock.calls[0][0];
      questionClick();

      expect(trackEvent).toHaveBeenCalledWith('faq_expand', { question: 'What is a futon?' });
    });

    it('registers onClick on both question and toggle', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#faqRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = {
          text: '', collapsed: false,
          accessibility: { role: '', ariaLabel: '', ariaExpanded: false, tabIndex: -1 },
          collapse: vi.fn(function () { this.collapsed = true; }),
          expand: vi.fn(function () { this.collapsed = false; }),
          onClick: vi.fn(), onKeyPress: vi.fn(),
        };
        return itemEls[sel];
      };

      itemReadyCb($item, mockFaqData[0]);
      expect(itemEls['#faqQuestion'].onClick).toHaveBeenCalled();
      expect(itemEls['#faqToggle'].onClick).toHaveBeenCalled();
    });
  });

  // ── Search ──────────────────────────────────────────────────────

  describe('search', () => {
    it('registers onKeyPress on search input', async () => {
      await onReadyHandler();
      expect(getEl('#faqSearchInput').onKeyPress).toHaveBeenCalled();
    });

    it('sets ARIA label on search input', async () => {
      await onReadyHandler();
      expect(getEl('#faqSearchInput').accessibility.ariaLabel).toContain('Search');
    });

    it('debounced search filters FAQ list', async () => {
      await onReadyHandler();
      const searchInput = getEl('#faqSearchInput');
      const keyPressCb = searchInput.onKeyPress.mock.calls[0][0];

      searchInput.value = 'futon';
      keyPressCb();

      await new Promise(r => setTimeout(r, 400));

      const { searchFaqs } = await import('public/faqHelpers.js');
      expect(searchFaqs).toHaveBeenCalled();
      // Repeater should have fewer items after filtering
      const faqRepeater = getEl('#faqRepeater');
      expect(faqRepeater.data.length).toBeLessThan(mockFaqData.length);
    });

    it('search tracks faq_search event with result count', async () => {
      await onReadyHandler();
      trackEvent.mockClear();
      const searchInput = getEl('#faqSearchInput');
      const keyPressCb = searchInput.onKeyPress.mock.calls[0][0];

      searchInput.value = 'shipping';
      keyPressCb();
      await new Promise(r => setTimeout(r, 350));

      expect(trackEvent).toHaveBeenCalledWith('faq_search', {
        query: 'shipping',
        resultCount: expect.any(Number),
      });
    });

    it('no-results shows message and announces', async () => {
      await onReadyHandler();
      announce.mockClear();
      const searchInput = getEl('#faqSearchInput');
      const keyPressCb = searchInput.onKeyPress.mock.calls[0][0];

      searchInput.value = 'nonexistent-xyz';
      keyPressCb();
      await new Promise(r => setTimeout(r, 350));

      expect(getEl('#faqNoResults').text).toContain('No FAQs match');
      expect(getEl('#faqNoResults').expand).toHaveBeenCalled();
      expect(announce).toHaveBeenCalledWith(expect.anything(), 'No FAQs found');
    });

  });

  // ── Contact CTA ─────────────────────────────────────────────────

  describe('contact CTA', () => {
    it('sets contact section title', async () => {
      await onReadyHandler();
      expect(getEl('#faqContactTitle').text).toBe('Still Have Questions?');
    });

    it('sets contact body with phone and showroom info', async () => {
      await onReadyHandler();
      expect(getEl('#faqContactBody').text).toContain('(828) 252-9449');
      expect(getEl('#faqContactBody').text).toContain('Hendersonville');
    });

    it('sets contact button label', async () => {
      await onReadyHandler();
      expect(getEl('#faqContactBtn').label).toBe('Contact Us');
    });

    it('registers onClick on contact button', async () => {
      await onReadyHandler();
      expect(getEl('#faqContactBtn').onClick).toHaveBeenCalled();
    });

    it('contact button click navigates to /contact', async () => {
      const wixLocation = await import('wix-location-frontend');
      wixLocation.to.mockClear();

      await onReadyHandler();
      const clickHandler = getEl('#faqContactBtn').onClick.mock.calls[0][0];
      clickHandler();
      // Wait for dynamic import().then() to resolve
      await new Promise(r => setTimeout(r, 50));

      expect(wixLocation.to).toHaveBeenCalledWith('/contact');
    });

    it('sets contact button ARIA label', async () => {
      await onReadyHandler();
      expect(getEl('#faqContactBtn').accessibility.ariaLabel).toContain('Contact Carolina Futons');
    });

    it('sets phone button label with phone number', async () => {
      await onReadyHandler();
      expect(getEl('#faqPhoneBtn').label).toBe('(828) 252-9449');
    });

    it('registers onClick on phone button', async () => {
      await onReadyHandler();
      expect(getEl('#faqPhoneBtn').onClick).toHaveBeenCalled();
    });

    it('phone button click opens tel: URL', async () => {
      const wixWindow = await import('wix-window-frontend');
      wixWindow.openUrl.mockClear();

      await onReadyHandler();
      const clickHandler = getEl('#faqPhoneBtn').onClick.mock.calls[0][0];
      clickHandler();
      // Wait for dynamic import().then() to resolve
      await new Promise(r => setTimeout(r, 50));

      expect(wixWindow.openUrl).toHaveBeenCalledWith('tel:+18282529449');
    });

    it('phone button has ARIA label with phone number', async () => {
      await onReadyHandler();
      expect(getEl('#faqPhoneBtn').accessibility.ariaLabel).toContain('(828) 252-9449');
    });
  });

  // ── Error Resilience ────────────────────────────────────────────

  describe('error resilience', () => {
    it('does not throw when FAQ repeater is missing', async () => {
      const original = globalThis.$w;
      const throwingSelector = Object.assign(
        (sel) => {
          if (sel === '#faqRepeater') return null;
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = throwingSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();

      globalThis.$w = original;
    });

    it('does not throw when search input is missing', async () => {
      const original = globalThis.$w;
      const throwingSelector = Object.assign(
        (sel) => {
          if (sel === '#faqSearchInput') return null;
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = throwingSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();

      globalThis.$w = original;
    });
  });
});
