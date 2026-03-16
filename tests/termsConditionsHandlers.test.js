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
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(),
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

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  collapseOnMobile: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

const { initBackToTop, collapseOnMobile } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');

// ── Import Page ─────────────────────────────────────────────────────

describe('Terms & Conditions Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Terms & Conditions.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initPageSeo with termsConditions', () => {
      onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('termsConditions');
    });

    it('calls initBackToTop', () => {
      onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls collapseOnMobile with termsTocRepeater', () => {
      onReadyHandler();
      expect(collapseOnMobile).toHaveBeenCalledWith($w, ['#termsTocRepeater']);
    });
  });

  // ── Terms Content ─────────────────────────────────────────────

  describe('terms content', () => {
    it('sets terms title', () => {
      onReadyHandler();
      expect(getEl('#termsTitle').text).toBe('Terms & Conditions');
    });

    it('sets effective date', () => {
      onReadyHandler();
      expect(getEl('#termsEffectiveDate').text).toMatch(/Effective Date/);
    });

    it('sets intro text mentioning carolinafutons.com', () => {
      onReadyHandler();
      expect(getEl('#termsIntro').text).toMatch(/carolinafutons\.com/);
    });

    it('sets repeater data with 10 terms sections', () => {
      onReadyHandler();
      expect(getEl('#termsRepeater').data).toHaveLength(10);
    });

    it('first section is Acceptance of Terms', () => {
      onReadyHandler();
      expect(getEl('#termsRepeater').data[0].title).toBe('Acceptance of Terms');
    });

    it('last section is Contact Information', () => {
      onReadyHandler();
      const data = getEl('#termsRepeater').data;
      expect(data[data.length - 1].title).toBe('Contact Information');
    });

    it('each section has _id, title, content, and anchor', () => {
      onReadyHandler();
      for (const section of getEl('#termsRepeater').data) {
        expect(section._id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.content).toBeTruthy();
        expect(section.anchor).toMatch(/^#terms/);
      }
    });

    it('includes Products & Pricing section', () => {
      onReadyHandler();
      const titles = getEl('#termsRepeater').data.map(s => s.title);
      expect(titles).toContain('Products & Pricing');
    });

    it('includes Returns & Refunds section', () => {
      onReadyHandler();
      const titles = getEl('#termsRepeater').data.map(s => s.title);
      expect(titles).toContain('Returns & Refunds');
    });

    it('includes Warranties section', () => {
      onReadyHandler();
      const titles = getEl('#termsRepeater').data.map(s => s.title);
      expect(titles).toContain('Warranties');
    });
  });

  // ── onItemReady behavior ──────────────────────────────────────

  describe('terms section onItemReady', () => {
    function setupSectionItem(sectionData) {
      onReadyHandler();
      const repeater = getEl('#termsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, sectionData);
      return $item;
    }

    it('sets section title text', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Acceptance of Terms', content: 'By accessing...', anchor: '#termsAcceptance' });
      expect($item('#sectionTitle').text).toBe('Acceptance of Terms');
    });

    it('sets section content text', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Policy text here', anchor: '#termsTest' });
      expect($item('#sectionContent').text).toBe('Policy text here');
    });

    it('starts sections collapsed with + toggle', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#termsTest' });
      expect($item('#sectionContent').collapse).toHaveBeenCalled();
      expect($item('#sectionToggle').text).toBe('+');
    });

    it('sets ARIA role button on title', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#termsTest' });
      expect($item('#sectionTitle').accessibility.role).toBe('button');
    });

    it('sets ariaExpanded false initially', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#termsTest' });
      expect($item('#sectionToggle').accessibility.ariaExpanded).toBe(false);
    });

    it('clicking title expands collapsed content', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#termsTest' });
      $item('#sectionContent').collapsed = true;
      $item('#sectionTitle').onClick.mock.calls[0][0]();
      expect($item('#sectionContent').expand).toHaveBeenCalled();
      expect($item('#sectionToggle').text).toBe('\u2212');
      expect($item('#sectionToggle').accessibility.ariaExpanded).toBe(true);
    });

    it('clicking title collapses expanded content', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#termsTest' });
      $item('#sectionContent').collapsed = false;
      $item('#sectionTitle').onClick.mock.calls[0][0]();
      expect($item('#sectionContent').collapse).toHaveBeenCalledTimes(2);
      expect($item('#sectionToggle').text).toBe('+');
      expect($item('#sectionToggle').accessibility.ariaExpanded).toBe(false);
    });
  });

  // ── TOC Navigation ────────────────────────────────────────────

  describe('table of contents', () => {
    it('sets TOC repeater data with 10 entries', () => {
      onReadyHandler();
      expect(getEl('#termsTocRepeater').data).toHaveLength(10);
    });

    it('sets ARIA label on TOC repeater', () => {
      onReadyHandler();
      expect(getEl('#termsTocRepeater').accessibility.ariaLabel).toBe('Terms and conditions table of contents');
    });

    describe('TOC onItemReady', () => {
      function setupTocItem(itemData) {
        onReadyHandler();
        const tocRepeater = getEl('#termsTocRepeater');
        const cb = tocRepeater.onItemReady.mock.calls[0][0];
        const itemEls = new Map();
        const $item = (sel) => {
          if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
          return itemEls.get(sel);
        };
        cb($item, itemData);
        return $item;
      }

      it('sets TOC link text', () => {
        const $item = setupTocItem({ _id: '1', title: 'Warranties', anchor: '#termsWarranties' });
        expect($item('#tocLink').text).toBe('Warranties');
      });

      it('sets ARIA label on TOC link', () => {
        const $item = setupTocItem({ _id: '1', title: 'Warranties', anchor: '#termsWarranties' });
        expect($item('#tocLink').accessibility.ariaLabel).toBe('Jump to Warranties');
      });

      it('clicking TOC link scrolls to anchor', () => {
        const $item = setupTocItem({ _id: '1', title: 'Warranties', anchor: '#termsWarranties' });
        $item('#tocLink').onClick.mock.calls[0][0]();
        expect(getEl('#termsWarranties').scrollTo).toHaveBeenCalled();
      });
    });
  });
});
