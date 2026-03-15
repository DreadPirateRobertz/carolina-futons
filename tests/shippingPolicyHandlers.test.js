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

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn(() => Promise.resolve({ '@type': 'LocalBusiness' })),
}));

vi.mock('backend/deliveryExperience.web', () => ({
  getAllAssemblyGuides: vi.fn(() => Promise.resolve({
    success: true,
    guides: {
      'futon-frames': {
        title: 'Futon Frame Assembly',
        estimatedTime: '45-60 minutes',
        toolsNeeded: ['Phillips screwdriver', 'Allen wrench'],
        steps: ['Unbox all parts', 'Attach side rails', 'Install slats'],
        videoUrl: 'https://cdn/assembly.mp4',
      },
    },
  })),
  getDeliveryInstructions: vi.fn(() => Promise.resolve({
    success: true,
    data: {
      instructions: ['Clear the delivery path', 'Measure doorways'],
      tips: ['Remove old furniture first', 'Have someone help'],
    },
  })),
}));

vi.mock('backend/postPurchaseCare.web', () => ({
  getProductGuides: vi.fn(() => Promise.resolve({
    success: true,
    guides: [
      { _id: 'care-1', title: 'Wood Care', summary: 'Keep wood clean', steps: ['Dust regularly', 'Apply polish'], videoUrl: '' },
    ],
  })),
}));

vi.mock('backend/deliveryScheduling.web', () => ({
  getAvailableDeliverySlots: vi.fn(() => Promise.resolve({
    success: true,
    slots: [
      { available: true, dayOfWeek: 'Wednesday', date: '2026-03-18', startTime: '10:00 AM', endTime: '2:00 PM' },
      { available: false, dayOfWeek: 'Thursday', date: '2026-03-19', startTime: '10:00 AM', endTime: '2:00 PM' },
    ],
  })),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

const { trackEvent } = await import('public/engagementTracker');
const { announce } = await import('public/a11yHelpers');
const { initBackToTop } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');
const { getBusinessSchema } = await import('backend/seoHelpers.web');
const { getAllAssemblyGuides, getDeliveryInstructions } = await import('backend/deliveryExperience.web');
const { getProductGuides } = await import('backend/postPurchaseCare.web');
const { getAvailableDeliverySlots } = await import('backend/deliveryScheduling.web');

// ── Import Page ─────────────────────────────────────────────────────

describe('Shipping Policy Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Shipping Policy.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initBackToTop', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with shippingPolicy', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('shippingPolicy');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'shipping_policy' });
    });
  });

  // ── Shipping Calculator ───────────────────────────────────────

  describe('shipping calculator', () => {
    it('sets ARIA label on zip input', async () => {
      await onReadyHandler();
      expect(getEl('#shippingZipInput').accessibility.ariaLabel).toMatch(/ZIP code/);
    });

    it('sets ARIA label on calc button', async () => {
      await onReadyHandler();
      expect(getEl('#shippingCalcBtn').accessibility.ariaLabel).toMatch(/shipping cost/i);
    });

    it('registers onClick on calc button', async () => {
      await onReadyHandler();
      expect(getEl('#shippingCalcBtn').onClick).toHaveBeenCalled();
    });

    it('shows error for invalid zip', async () => {
      await onReadyHandler();
      getEl('#shippingZipInput').value = 'abc';
      getEl('#shippingCalcBtn').onClick.mock.calls[0][0]();
      expect(getEl('#shippingResult').text).toMatch(/valid 5-digit ZIP/);
    });

    it('shows error for empty zip', async () => {
      await onReadyHandler();
      getEl('#shippingZipInput').value = '';
      getEl('#shippingCalcBtn').onClick.mock.calls[0][0]();
      expect(getEl('#shippingResult').text).toMatch(/valid 5-digit ZIP/);
    });

    it('returns local zone for Henderson County zip (28792)', async () => {
      await onReadyHandler();
      getEl('#shippingZipInput').value = '28792';
      getEl('#shippingCalcBtn').onClick.mock.calls[0][0]();
      expect(getEl('#shippingResult').text).toMatch(/Local delivery/i);
      expect(trackEvent).toHaveBeenCalledWith('shipping_calculator', { zip: '28792', zone: 'local' });
    });

    it('returns regional zone for SC zip (29201)', async () => {
      await onReadyHandler();
      getEl('#shippingZipInput').value = '29201';
      getEl('#shippingCalcBtn').onClick.mock.calls[0][0]();
      expect(getEl('#shippingResult').text).toMatch(/Standard shipping/i);
      expect(trackEvent).toHaveBeenCalledWith('shipping_calculator', { zip: '29201', zone: 'regional' });
    });

    it('returns national zone for CA zip (90210)', async () => {
      await onReadyHandler();
      getEl('#shippingZipInput').value = '90210';
      getEl('#shippingCalcBtn').onClick.mock.calls[0][0]();
      expect(getEl('#shippingResult').text).toMatch(/ship nationwide/i);
      expect(trackEvent).toHaveBeenCalledWith('shipping_calculator', { zip: '90210', zone: 'national' });
    });

    it('announces the result', async () => {
      await onReadyHandler();
      getEl('#shippingZipInput').value = '28792';
      getEl('#shippingCalcBtn').onClick.mock.calls[0][0]();
      expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/Local delivery/i));
    });
  });

  // ── Delivery Info Repeater ────────────────────────────────────

  describe('delivery info', () => {
    it('sets repeater data with 4 delivery methods', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryRepeater').data).toHaveLength(4);
    });

    it('includes Standard Shipping, Local Delivery, In-Store Pickup, White Glove', async () => {
      await onReadyHandler();
      const titles = getEl('#deliveryRepeater').data.map(d => d.title);
      expect(titles).toContain('Standard Shipping');
      expect(titles).toContain('Local Delivery');
      expect(titles).toContain('In-Store Pickup');
      expect(titles).toContain('White Glove Delivery');
    });

    it('registers onItemReady on delivery repeater', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryRepeater').onItemReady).toHaveBeenCalled();
    });

    describe('delivery onItemReady', () => {
      async function setupDeliveryItem(itemData) {
        await onReadyHandler();
        const repeater = getEl('#deliveryRepeater');
        const cb = repeater.onItemReady.mock.calls[0][0];
        const itemEls = new Map();
        const $item = (sel) => {
          if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
          return itemEls.get(sel);
        };
        cb($item, itemData);
        return $item;
      }

      it('sets delivery title', async () => {
        const $item = await setupDeliveryItem({ _id: '1', title: 'Standard Shipping', description: 'Delivered to your door', icon: 'truck' });
        expect($item('#deliveryTitle').text).toBe('Standard Shipping');
      });

      it('sets delivery description', async () => {
        const $item = await setupDeliveryItem({ _id: '1', title: 'Standard', description: 'Delivered to your door', icon: 'truck' });
        expect($item('#deliveryDesc').text).toBe('Delivered to your door');
      });

      it('sets combined ARIA label', async () => {
        const $item = await setupDeliveryItem({ _id: '1', title: 'White Glove', description: 'Full assembly', icon: 'star' });
        expect($item('#deliveryTitle').accessibility.ariaLabel).toBe('White Glove: Full assembly');
      });
    });

    it('sets assembly tips text', async () => {
      await onReadyHandler();
      expect(getEl('#assemblyTips').text).toMatch(/KD Frames/);
      expect(getEl('#assemblyTips').text).toMatch(/Night & Day/);
    });
  });

  // ── Assembly Guides (backend) ─────────────────────────────────

  describe('assembly guides', () => {
    it('calls getAllAssemblyGuides', async () => {
      await onReadyHandler();
      expect(getAllAssemblyGuides).toHaveBeenCalled();
    });

    it('sets assembly guides repeater data', async () => {
      await onReadyHandler();
      const repeater = getEl('#assemblyGuidesRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0].title).toBe('Futon Frame Assembly');
    });

    describe('assembly guide onItemReady', () => {
      async function setupGuideItem(itemData) {
        await onReadyHandler();
        const repeater = getEl('#assemblyGuidesRepeater');
        const cb = repeater.onItemReady.mock.calls[0][0];
        const itemEls = new Map();
        const $item = (sel) => {
          if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
          return itemEls.get(sel);
        };
        cb($item, itemData);
        return $item;
      }

      it('sets guide title', async () => {
        const $item = await setupGuideItem({ _id: 'frames', title: 'Futon Frame Assembly', estimatedTime: '45 min', toolsNeeded: ['Wrench'], steps: ['Step 1'] });
        expect($item('#guideTitle').text).toBe('Futon Frame Assembly');
      });

      it('sets estimated time', async () => {
        const $item = await setupGuideItem({ _id: 'frames', title: 'Test', estimatedTime: '30 min', toolsNeeded: [], steps: [] });
        expect($item('#guideTime').text).toBe('Estimated time: 30 min');
      });

      it('lists tools when provided', async () => {
        const $item = await setupGuideItem({ _id: 'frames', title: 'Test', estimatedTime: '30 min', toolsNeeded: ['Phillips screwdriver', 'Allen wrench'], steps: [] });
        expect($item('#guideTools').text).toBe('Tools needed: Phillips screwdriver, Allen wrench');
      });

      it('shows no tools required when empty', async () => {
        const $item = await setupGuideItem({ _id: 'frames', title: 'Test', estimatedTime: '30 min', toolsNeeded: [], steps: [] });
        expect($item('#guideTools').text).toBe('No tools required');
      });

      it('formats steps as numbered list', async () => {
        const $item = await setupGuideItem({ _id: 'frames', title: 'Test', estimatedTime: '30 min', toolsNeeded: [], steps: ['Unbox', 'Attach rails'] });
        expect($item('#guideSteps').text).toBe('1. Unbox\n2. Attach rails');
      });
    });
  });

  // ── Care Tips (backend) ───────────────────────────────────────

  describe('care tips', () => {
    it('calls getProductGuides with default category', async () => {
      await onReadyHandler();
      expect(getProductGuides).toHaveBeenCalledWith('futon-frames');
    });

    it('sets ARIA label on care category dropdown', async () => {
      await onReadyHandler();
      expect(getEl('#careCategoryDropdown').accessibility.ariaLabel).toMatch(/care guides/i);
    });

    it('sets care tips repeater data', async () => {
      await onReadyHandler();
      const repeater = getEl('#careTipsRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0].title).toBe('Wood Care');
    });

    it('registers onChange on category dropdown', async () => {
      await onReadyHandler();
      expect(getEl('#careCategoryDropdown').onChange).toHaveBeenCalled();
    });
  });

  // ── Delivery Prep (backend) ───────────────────────────────────

  describe('delivery prep', () => {
    it('calls getDeliveryInstructions with default tier', async () => {
      await onReadyHandler();
      expect(getDeliveryInstructions).toHaveBeenCalledWith('standard');
    });

    it('sets ARIA label on delivery tier dropdown', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryTierDropdown').accessibility.ariaLabel).toMatch(/delivery type/i);
    });

    it('sets numbered instructions text', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryPrepInstructions').text).toBe('1. Clear the delivery path\n2. Measure doorways');
    });

    it('sets bulleted tips text', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryPrepTips').text).toBe('• Remove old furniture first\n• Have someone help');
    });
  });

  // ── Delivery Scheduling (backend) ─────────────────────────────

  describe('delivery scheduling', () => {
    it('calls getAvailableDeliverySlots', async () => {
      await onReadyHandler();
      expect(getAvailableDeliverySlots).toHaveBeenCalledWith('white_glove_local');
    });

    it('shows next available slot', async () => {
      await onReadyHandler();
      expect(getEl('#nextAvailableSlot').text).toMatch(/Wednesday/);
      expect(getEl('#nextAvailableSlot').text).toMatch(/10:00 AM.*2:00 PM/);
    });

    it('registers onClick on schedule button', async () => {
      await onReadyHandler();
      expect(getEl('#scheduleDeliveryBtn').onClick).toHaveBeenCalled();
    });

    it('shows fallback message when no slots available', async () => {
      getAvailableDeliverySlots.mockResolvedValueOnce({
        success: true,
        slots: [{ available: false }],
      });
      await onReadyHandler();
      expect(getEl('#nextAvailableSlot').text).toMatch(/828.*252.*9449/);
    });

    it('shows fallback message on API failure', async () => {
      getAvailableDeliverySlots.mockResolvedValueOnce({ success: false });
      await onReadyHandler();
      expect(getEl('#nextAvailableSlot').text).toMatch(/828.*252.*9449/);
    });
  });

  // ── Schema Injection ──────────────────────────────────────────

  describe('schema injection', () => {
    it('calls getBusinessSchema', async () => {
      await onReadyHandler();
      expect(getBusinessSchema).toHaveBeenCalled();
    });

    it('posts schema to HTML element', async () => {
      await onReadyHandler();
      expect(getEl('#shippingSchemaHtml').postMessage).toHaveBeenCalledWith({ '@type': 'LocalBusiness' });
    });
  });
});
