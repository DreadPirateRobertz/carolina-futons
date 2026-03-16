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

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

const { initBackToTop } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');

// ── Import Page ─────────────────────────────────────────────────────

describe('Refund Policy Page handlers', () => {
  beforeAll(async () => {
    await import('../src/pages/Refund Policy.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initPageSeo with refundPolicy', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('refundPolicy');
    });

    it('calls initBackToTop', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });
  });

  // ── Repeater data ────────────────────────────────────────────────

  describe('policy repeater data', () => {
    it('sets repeater data with 5 sections', async () => {
      await onReadyHandler();
      expect(getEl('#policyRepeater').data).toHaveLength(5);
    });
  });

  // ── onItemReady behavior ─────────────────────────────────────────

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

    it('sets title text', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Return Eligibility', content: 'Items may be returned within 30 days...' });
      expect($item('#policyTitle').text).toBe('Return Eligibility');
    });

    it('sets content text', () => {
      const $item = setupSectionItem({ _id: '2', title: 'How to Initiate a Return', content: 'Contact us at (828) 252-9449...' });
      expect($item('#policyContent').text).toBe('Contact us at (828) 252-9449...');
    });

    it('starts content collapsed with + toggle', () => {
      const $item = setupSectionItem({ _id: '3', title: 'Refund Processing', content: 'Refunds are processed within 5-7 business days...' });
      expect($item('#policyContent').collapse).toHaveBeenCalled();
      expect($item('#policyToggle').text).toBe('+');
    });

    it('sets ARIA role button on title', () => {
      const $item = setupSectionItem({ _id: '4', title: 'Damaged or Defective Items', content: 'If your item arrives damaged...' });
      expect($item('#policyTitle').accessibility.role).toBe('button');
    });

    it('sets ariaExpanded false on toggle initially', () => {
      const $item = setupSectionItem({ _id: '5', title: 'Exchange Policy', content: 'We are happy to facilitate exchanges...' });
      expect($item('#policyToggle').accessibility.ariaExpanded).toBe(false);
    });
  });

  // ── Accordion toggle behavior ────────────────────────────────────

  describe('accordion toggle behavior', () => {
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

    it('clicking title when collapsed expands content and sets minus sign', () => {
      const $item = setupSectionItem({ _id: '1', title: 'Return Eligibility', content: 'Items may be returned within 30 days...' });
      $item('#policyContent').collapsed = true;
      const clickHandler = $item('#policyTitle').onClick.mock.calls[0][0];
      clickHandler();
      expect($item('#policyContent').expand).toHaveBeenCalled();
      expect($item('#policyToggle').text).toBe('\u2212');
    });

    it('clicking title when expanded collapses content and sets +', () => {
      const $item = setupSectionItem({ _id: '2', title: 'How to Initiate a Return', content: 'Contact us at (828) 252-9449...' });
      $item('#policyContent').collapsed = false;
      const clickHandler = $item('#policyTitle').onClick.mock.calls[0][0];
      clickHandler();
      expect($item('#policyContent').collapse).toHaveBeenCalledTimes(2); // once on init, once on click
      expect($item('#policyToggle').text).toBe('+');
    });

    it('toggle ariaExpanded updates to true on expand click', () => {
      const $item = setupSectionItem({ _id: '3', title: 'Refund Processing', content: 'Refunds are processed within 5-7 business days...' });
      $item('#policyContent').collapsed = true;
      const clickHandler = $item('#policyTitle').onClick.mock.calls[0][0];
      clickHandler();
      expect($item('#policyToggle').accessibility.ariaExpanded).toBe(true);
    });

    it('toggle ariaExpanded updates to false on collapse click', () => {
      const $item = setupSectionItem({ _id: '4', title: 'Damaged or Defective Items', content: 'If your item arrives damaged...' });
      $item('#policyContent').collapsed = false;
      const clickHandler = $item('#policyTitle').onClick.mock.calls[0][0];
      clickHandler();
      expect($item('#policyToggle').accessibility.ariaExpanded).toBe(false);
    });
  });
});
