import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    collapsed: false,
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', role: '', ariaExpanded: undefined },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    data: [],
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

// ── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.clearAllMocks();
});

describe('Refund Policy Page', () => {
  beforeEach(async () => {
    vi.resetModules();
    await import('../src/pages/Refund Policy.js');
  });

  it('registers an onReady handler', () => {
    expect(onReadyHandler).toBeInstanceOf(Function);
  });

  describe('page initialization', () => {
    it('calls initPageSeo with refundPolicy', async () => {
      await onReadyHandler();
      const { initPageSeo } = await import('public/pageSeo.js');
      expect(initPageSeo).toHaveBeenCalledWith('refundPolicy');
    });

    it('calls initBackToTop', async () => {
      await onReadyHandler();
      const { initBackToTop } = await import('public/mobileHelpers');
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('registers onItemReady on policy repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('populates repeater with 5 policy sections', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      expect(repeater.data).toHaveLength(5);
    });

    it('includes Return Eligibility section', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      expect(repeater.data[0].title).toBe('Return Eligibility');
    });

    it('includes How to Initiate a Return section', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      expect(repeater.data[1].title).toBe('How to Initiate a Return');
    });

    it('includes Refund Processing section', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      expect(repeater.data[2].title).toBe('Refund Processing');
    });

    it('includes Damaged or Defective Items section', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      expect(repeater.data[3].title).toBe('Damaged or Defective Items');
    });

    it('includes Exchange Policy section', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      expect(repeater.data[4].title).toBe('Exchange Policy');
    });
  });

  describe('repeater onItemReady', () => {
    it('sets title and content text', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_rp1_${sel}`);
      itemReadyCb($item, { _id: '1', title: 'Return Eligibility', content: 'Items may be returned within 30 days.' });

      expect(getEl('_rp1_#policyTitle').text).toBe('Return Eligibility');
      expect(getEl('_rp1_#policyContent').text).toBe('Items may be returned within 30 days.');
    });

    it('starts content collapsed', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_rp2_${sel}`);
      itemReadyCb($item, { _id: '2', title: 'Test', content: 'Content' });

      expect(getEl('_rp2_#policyContent').collapse).toHaveBeenCalled();
    });

    it('sets toggle text to + initially', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_rp3_${sel}`);
      itemReadyCb($item, { _id: '3', title: 'Test', content: 'Content' });

      expect(getEl('_rp3_#policyToggle').text).toBe('+');
    });

    it('sets ARIA role button on title', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_rp4_${sel}`);
      itemReadyCb($item, { _id: '4', title: 'Return Eligibility', content: 'Content' });

      expect(getEl('_rp4_#policyTitle').accessibility.role).toBe('button');
    });

    it('sets ARIA label on title', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_rp5_${sel}`);
      itemReadyCb($item, { _id: '5', title: 'Refund Processing', content: 'Content' });

      expect(getEl('_rp5_#policyTitle').accessibility.ariaLabel).toBe('Toggle Refund Processing');
    });

    it('sets ARIA label on toggle', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_rp6_${sel}`);
      itemReadyCb($item, { _id: '6', title: 'Exchange Policy', content: 'Content' });

      expect(getEl('_rp6_#policyToggle').accessibility.ariaLabel).toBe('Toggle Exchange Policy');
    });

    it('sets ariaExpanded to false initially', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_rp7_${sel}`);
      itemReadyCb($item, { _id: '7', title: 'Test', content: 'Content' });

      expect(getEl('_rp7_#policyToggle').accessibility.ariaExpanded).toBe(false);
    });

    it('registers onClick on title', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_rp8_${sel}`);
      itemReadyCb($item, { _id: '8', title: 'Test', content: 'Content' });

      expect(getEl('_rp8_#policyTitle').onClick).toHaveBeenCalled();
    });
  });

  describe('accordion toggle behavior', () => {
    it('expands content when collapsed and title clicked', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_tog1_${sel}`);
      itemReadyCb($item, { _id: 't1', title: 'Test', content: 'Content' });

      // Content starts collapsed
      const content = getEl('_tog1_#policyContent');
      content.collapsed = true;

      const titleClickCb = getEl('_tog1_#policyTitle').onClick.mock.calls[0][0];
      titleClickCb();

      expect(content.expand).toHaveBeenCalled();
    });

    it('sets toggle to minus sign when expanded', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_tog2_${sel}`);
      itemReadyCb($item, { _id: 't2', title: 'Test', content: 'Content' });

      const content = getEl('_tog2_#policyContent');
      content.collapsed = true;

      const titleClickCb = getEl('_tog2_#policyTitle').onClick.mock.calls[0][0];
      titleClickCb();

      expect(getEl('_tog2_#policyToggle').text).toBe('\u2212');
    });

    it('sets ariaExpanded to true when expanded', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_tog3_${sel}`);
      itemReadyCb($item, { _id: 't3', title: 'Test', content: 'Content' });

      const content = getEl('_tog3_#policyContent');
      content.collapsed = true;

      const titleClickCb = getEl('_tog3_#policyTitle').onClick.mock.calls[0][0];
      titleClickCb();

      expect(getEl('_tog3_#policyToggle').accessibility.ariaExpanded).toBe(true);
    });

    it('collapses content when expanded and title clicked', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_tog4_${sel}`);
      itemReadyCb($item, { _id: 't4', title: 'Test', content: 'Content' });

      const content = getEl('_tog4_#policyContent');
      content.collapsed = false; // Already expanded

      const titleClickCb = getEl('_tog4_#policyTitle').onClick.mock.calls[0][0];
      titleClickCb();

      expect(content.collapse).toHaveBeenCalledTimes(2); // Once on init, once on click
    });

    it('sets toggle back to + when collapsed', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_tog5_${sel}`);
      itemReadyCb($item, { _id: 't5', title: 'Test', content: 'Content' });

      const content = getEl('_tog5_#policyContent');
      content.collapsed = false;

      const titleClickCb = getEl('_tog5_#policyTitle').onClick.mock.calls[0][0];
      titleClickCb();

      expect(getEl('_tog5_#policyToggle').text).toBe('+');
    });

    it('sets ariaExpanded to false when collapsed', async () => {
      await onReadyHandler();
      const repeater = getEl('#policyRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_tog6_${sel}`);
      itemReadyCb($item, { _id: 't6', title: 'Test', content: 'Content' });

      const content = getEl('_tog6_#policyContent');
      content.collapsed = false;

      const titleClickCb = getEl('_tog6_#policyTitle').onClick.mock.calls[0][0];
      titleClickCb();

      expect(getEl('_tog6_#policyToggle').accessibility.ariaExpanded).toBe(false);
    });
  });
});
