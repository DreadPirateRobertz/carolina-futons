import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    html: '',
    data: [],
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', role: '' },
    background: { src: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
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

// ── Mock Backend Modules ────────────────────────────────────────────

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  isMobile: vi.fn().mockReturnValue(false),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
    if (opts?.ariaLabel) {
      try { el.accessibility.ariaLabel = opts.ariaLabel; } catch (e) {}
    }
  }),
  announce: vi.fn(),
}));

vi.mock('public/deliveryHelpers.js', async () => {
  const actual = await vi.importActual('../src/public/deliveryHelpers.js');
  return actual;
});

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn().mockResolvedValue(null),
}));

// ── Load Page ──────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
});

describe('Getting It Home Page', () => {
  beforeEach(async () => {
    await import('../src/pages/Getting It Home.js');
  });

  it('registers an onReady handler', () => {
    expect(onReadyHandler).toBeInstanceOf(Function);
  });

  describe('page initialization', () => {
    it('tracks page view event', async () => {
      await onReadyHandler();
      const { trackEvent } = await import('public/engagementTracker');
      expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'getting-it-home' }));
    });

    it('initializes page SEO', async () => {
      await onReadyHandler();
      const { initPageSeo } = await import('public/pageSeo.js');
      expect(initPageSeo).toHaveBeenCalledWith('getting-it-home');
    });

    it('initializes back to top button', async () => {
      await onReadyHandler();
      const { initBackToTop } = await import('public/mobileHelpers');
      expect(initBackToTop).toHaveBeenCalled();
    });
  });

  describe('intro section', () => {
    it('sets intro text on the intro element', async () => {
      await onReadyHandler();
      const intro = getEl('#deliveryIntro');
      expect(intro.text).toContain("don't add the cost");
    });
  });

  describe('service tiers', () => {
    it('populates service tier repeater with 4 items', async () => {
      await onReadyHandler();
      const repeater = getEl('#serviceTierRepeater');
      expect(repeater.data).toHaveLength(4);
    });

    it('sets onItemReady callback on repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#serviceTierRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets tier title, price, and description', async () => {
      await onReadyHandler();
      const repeater = getEl('#serviceTierRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`_item_${sel}`);
      const tierData = {
        _id: 'diy',
        title: 'Do It Yourself',
        price: 'Free',
        description: 'Test description for DIY tier',
        icon: 'wrench',
      };

      itemReadyCb($item, tierData);

      expect(getEl('_item_#tierTitle').text).toBe('Do It Yourself');
      expect(getEl('_item_#tierPrice').text).toBe('Free');
      expect(getEl('_item_#tierDescription').text).toBe('Test description for DIY tier');
    });

    it('repeater has accessible label', async () => {
      await onReadyHandler();
      const repeater = getEl('#serviceTierRepeater');
      expect(repeater.accessibility.ariaLabel).toContain('service');
    });
  });

  describe('delivery rates', () => {
    it('sets minimum delivery charge text', async () => {
      await onReadyHandler();
      const chargeEl = getEl('#deliveryMinCharge');
      expect(chargeEl.text).toContain('$25');
    });

    it('sets delivery rate note', async () => {
      await onReadyHandler();
      const noteEl = getEl('#deliveryRateNote');
      expect(noteEl.text).toContain('Contact us');
    });
  });

  describe('navigation links', () => {
    it('wires FAQ link click handler', async () => {
      await onReadyHandler();
      const faqLink = getEl('#deliveryFaqLink');
      expect(faqLink.onClick).toHaveBeenCalled();
    });

    it('wires contact link click handler', async () => {
      await onReadyHandler();
      const contactLink = getEl('#deliveryContactLink');
      expect(contactLink.onClick).toHaveBeenCalled();
    });
  });
});
