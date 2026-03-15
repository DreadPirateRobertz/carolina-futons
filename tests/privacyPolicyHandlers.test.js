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

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    el._clickHandler = handler;
    el._a11yOpts = opts;
  }),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

const { initBackToTop, collapseOnMobile } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');

// ── Import Page ─────────────────────────────────────────────────────

describe('Privacy Policy Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Privacy Policy.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initPageSeo with privacyPolicy', () => {
      onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('privacyPolicy');
    });

    it('calls initBackToTop', () => {
      onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls collapseOnMobile with policyTocRepeater', () => {
      onReadyHandler();
      expect(collapseOnMobile).toHaveBeenCalledWith($w, ['#policyTocRepeater']);
    });
  });

  // ── Policy Content ────────────────────────────────────────────

  describe('policy content', () => {
    it('sets policy title', () => {
      onReadyHandler();
      expect(getEl('#policyTitle').text).toBe('Privacy Policy');
    });

    it('sets effective date', () => {
      onReadyHandler();
      expect(getEl('#policyEffectiveDate').text).toMatch(/Effective Date/);
    });

    it('sets intro text mentioning Carolina Futons', () => {
      onReadyHandler();
      expect(getEl('#policyIntro').text).toMatch(/Carolina Futons/);
    });

    it('registers onItemReady on policy repeater', () => {
      onReadyHandler();
      expect(getEl('#policyRepeater').onItemReady).toHaveBeenCalled();
    });

    it('sets repeater data with 9 policy sections', () => {
      onReadyHandler();
      expect(getEl('#policyRepeater').data).toHaveLength(9);
    });

    it('first section is Information We Collect', () => {
      onReadyHandler();
      expect(getEl('#policyRepeater').data[0].title).toBe('Information We Collect');
    });

    it('last section is Contact Us', () => {
      onReadyHandler();
      const data = getEl('#policyRepeater').data;
      expect(data[data.length - 1].title).toBe('Contact Us');
    });

    it('each section has _id, title, content, and anchor', () => {
      onReadyHandler();
      for (const section of getEl('#policyRepeater').data) {
        expect(section._id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.content).toBeTruthy();
        expect(section.anchor).toMatch(/^#policy/);
      }
    });
  });

  // ── onItemReady behavior ──────────────────────────────────────

  describe('policy section onItemReady', () => {
    function setupSectionItem(sectionData) {
      onReadyHandler();
      const repeater = getEl('#policyRepeater');
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
      const $item = setupSectionItem({ _id: '1', title: 'Information We Collect', content: 'Test content', anchor: '#policyCollect' });
      expect($item('#sectionTitle').text).toBe('Information We Collect');
    });

    it('sets section content text', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Some policy text', anchor: '#policyTest' });
      expect($item('#sectionContent').text).toBe('Some policy text');
    });

    it('starts sections collapsed', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#policyTest' });
      expect($item('#sectionContent').collapse).toHaveBeenCalled();
      expect($item('#sectionToggle').text).toBe('+');
    });

    it('sets ARIA role button on section title', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#policyTest' });
      expect($item('#sectionTitle').accessibility.role).toBe('button');
    });

    it('sets ariaExpanded false on toggle initially', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#policyTest' });
      expect($item('#sectionToggle').accessibility.ariaExpanded).toBe(false);
    });

    it('registers onClick on section title', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#policyTest' });
      expect($item('#sectionTitle').onClick).toHaveBeenCalled();
    });

    it('clicking title expands collapsed content', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#policyTest' });
      // Content starts collapsed
      $item('#sectionContent').collapsed = true;
      const clickHandler = $item('#sectionTitle').onClick.mock.calls[0][0];
      clickHandler();
      expect($item('#sectionContent').expand).toHaveBeenCalled();
      expect($item('#sectionToggle').text).toBe('\u2212');
      expect($item('#sectionToggle').accessibility.ariaExpanded).toBe(true);
    });

    it('clicking title collapses expanded content', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Test', content: 'Content', anchor: '#policyTest' });
      // Simulate expanded state
      $item('#sectionContent').collapsed = false;
      const clickHandler = $item('#sectionTitle').onClick.mock.calls[0][0];
      clickHandler();
      expect($item('#sectionContent').collapse).toHaveBeenCalledTimes(2); // once on init, once on click
      expect($item('#sectionToggle').text).toBe('+');
      expect($item('#sectionToggle').accessibility.ariaExpanded).toBe(false);
    });
  });

  // ── TOC Navigation ────────────────────────────────────────────

  describe('table of contents', () => {
    it('registers onItemReady on TOC repeater', () => {
      onReadyHandler();
      expect(getEl('#policyTocRepeater').onItemReady).toHaveBeenCalled();
    });

    it('sets TOC repeater data matching policy sections', () => {
      onReadyHandler();
      const tocData = getEl('#policyTocRepeater').data;
      expect(tocData).toHaveLength(9);
      expect(tocData[0].title).toBe('Information We Collect');
    });

    it('sets ARIA label on TOC repeater', () => {
      onReadyHandler();
      expect(getEl('#policyTocRepeater').accessibility.ariaLabel).toBe('Privacy policy table of contents');
    });

    describe('TOC onItemReady', () => {
      function setupTocItem(itemData) {
        onReadyHandler();
        const tocRepeater = getEl('#policyTocRepeater');
        const cb = tocRepeater.onItemReady.mock.calls[0][0];
        const itemEls = new Map();
        const $item = (sel) => {
          if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
          return itemEls.get(sel);
        };
        cb($item, itemData);
        return $item;
      }

      it('sets TOC link text to section title', () => {
        const $item = setupTocItem({ _id: '1', title: 'Data Security', anchor: '#policySecurity' });
        expect($item('#tocLink').text).toBe('Data Security');
      });

      it('sets ARIA label on TOC link', () => {
        const $item = setupTocItem({ _id: '1', title: 'Data Security', anchor: '#policySecurity' });
        expect($item('#tocLink').accessibility.ariaLabel).toBe('Jump to Data Security');
      });

      it('clicking TOC link scrolls to anchor', () => {
        const $item = setupTocItem({ _id: '1', title: 'Data Security', anchor: '#policySecurity' });
        const clickHandler = $item('#tocLink').onClick.mock.calls[0][0];
        clickHandler();
        expect(getEl('#policySecurity').scrollTo).toHaveBeenCalled();
      });
    });
  });
});
