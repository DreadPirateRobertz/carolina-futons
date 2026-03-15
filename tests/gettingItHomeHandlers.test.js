import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
    accessibility: {},
    hidden: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onPlay: vi.fn(), onPause: vi.fn(), onEnded: vi.fn(),
    play: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    setFilter: vi.fn(), setSort: vi.fn(),
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

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn((el, handler, opts) => {
    el._clickHandler = handler;
    el._a11yOpts = opts;
  }),
}));

vi.mock('public/deliveryHelpers.js', () => ({
  getIntroText: vi.fn(() => 'Free local delivery on orders over $499'),
  getServiceTiers: vi.fn(() => [
    { _id: 'tier-1', title: 'Curbside Drop-off', price: 'Free', description: 'We deliver to your curb' },
    { _id: 'tier-2', title: 'Room of Choice', price: '$49', description: 'We place it in any room' },
    { _id: 'tier-3', title: 'White Glove Assembly', price: '$149', description: 'Full setup and haul-away' },
  ]),
  getDeliveryRates: vi.fn(() => ({
    minimumRadius: '30 miles',
    minimumCharge: '$79',
    note: 'Rates vary by distance',
  })),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

const { initPageSeo } = await import('public/pageSeo.js');
const { trackEvent } = await import('public/engagementTracker');
const { initBackToTop } = await import('public/mobileHelpers');
const { makeClickable } = await import('public/a11yHelpers.js');
const { getIntroText, getServiceTiers, getDeliveryRates } = await import('public/deliveryHelpers.js');

// ── Import Page ─────────────────────────────────────────────────────

describe('Getting It Home — Assembly & Delivery Information', () => {
  beforeAll(async () => {
    await import('../src/pages/Getting It Home.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with getting-it-home', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('getting-it-home');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'getting-it-home' });
    });
  });

  // ── Intro Text ──────────────────────────────────────────────────

  describe('initIntro', () => {
    it('sets deliveryIntro text from getIntroText', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryIntro').text).toBe('Free local delivery on orders over $499');
    });
  });

  // ── Service Tiers ───────────────────────────────────────────────

  describe('initServiceTiers', () => {
    it('sets repeater data from getServiceTiers', async () => {
      await onReadyHandler();
      const repeater = getEl('#serviceTierRepeater');
      expect(repeater.data).toHaveLength(3);
      expect(repeater.data[0].title).toBe('Curbside Drop-off');
    });

    it('sets ARIA label on service tier repeater', async () => {
      await onReadyHandler();
      expect(getEl('#serviceTierRepeater').accessibility.ariaLabel).toBe(
        'Delivery and assembly service options'
      );
    });

    it('registers onItemReady handler on repeater', async () => {
      await onReadyHandler();
      expect(getEl('#serviceTierRepeater').onItemReady).toHaveBeenCalled();
    });

    describe('onItemReady', () => {
      async function setupTierItem(itemData) {
        await onReadyHandler();
        const repeater = getEl('#serviceTierRepeater');
        const cb = repeater.onItemReady.mock.calls[0][0];
        const itemEls = new Map();
        const $item = (sel) => {
          if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
          return itemEls.get(sel);
        };
        cb($item, itemData);
        return $item;
      }

      it('sets tierTitle text', async () => {
        const $item = await setupTierItem({ _id: 'tier-1', title: 'Curbside Drop-off', price: 'Free', description: 'We deliver to your curb' });
        expect($item('#tierTitle').text).toBe('Curbside Drop-off');
      });

      it('sets tierPrice text', async () => {
        const $item = await setupTierItem({ _id: 'tier-2', title: 'Room of Choice', price: '$49', description: 'We place it in any room' });
        expect($item('#tierPrice').text).toBe('$49');
      });

      it('sets tierDescription text', async () => {
        const $item = await setupTierItem({ _id: 'tier-3', title: 'White Glove Assembly', price: '$149', description: 'Full setup and haul-away' });
        expect($item('#tierDescription').text).toBe('Full setup and haul-away');
      });
    });
  });

  // ── Delivery Rates ──────────────────────────────────────────────

  describe('initDeliveryRates', () => {
    it('sets deliveryMinCharge text with radius and charge from getDeliveryRates', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryMinCharge').text).toBe(
        'Minimum local charge (up to approx. 30 miles radius from our store) $79'
      );
    });

    it('sets deliveryRateNote text from getDeliveryRates', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryRateNote').text).toBe('Rates vary by distance');
    });
  });

  // ── Nav Links ───────────────────────────────────────────────────

  describe('initNavLinks', () => {
    it('registers makeClickable on deliveryFaqLink with correct ARIA label', async () => {
      await onReadyHandler();
      const faqCalls = makeClickable.mock.calls.filter(
        c => c[0] === getEl('#deliveryFaqLink')
      );
      expect(faqCalls).toHaveLength(1);
      expect(faqCalls[0][2]).toEqual({ ariaLabel: 'View assembly videos and FAQs' });
    });

    it('registers makeClickable on deliveryContactLink with correct ARIA label', async () => {
      await onReadyHandler();
      const contactCalls = makeClickable.mock.calls.filter(
        c => c[0] === getEl('#deliveryContactLink')
      );
      expect(contactCalls).toHaveLength(1);
      expect(contactCalls[0][2]).toEqual({ ariaLabel: 'Contact us about delivery rates' });
    });

    it('deliveryFaqLink click handler navigates to /faq', async () => {
      const wixLocation = await import('wix-location-frontend');
      await onReadyHandler();
      const faqEl = getEl('#deliveryFaqLink');
      await faqEl._clickHandler();
      await new Promise(r => setTimeout(r, 10));
      expect(wixLocation.to).toHaveBeenCalledWith('/faq');
    });

    it('deliveryContactLink click handler navigates to /contact', async () => {
      const wixLocation = await import('wix-location-frontend');
      await onReadyHandler();
      const contactEl = getEl('#deliveryContactLink');
      await contactEl._clickHandler();
      await new Promise(r => setTimeout(r, 10));
      expect(wixLocation.to).toHaveBeenCalledWith('/contact');
    });
  });
});
