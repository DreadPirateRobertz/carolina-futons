import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    html: '',
    data: [],
    style: { color: '', fontWeight: '', backgroundColor: '' },
    accessibility: {},
    hidden: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    postMessage: vi.fn(),
    scrollTo: vi.fn(),
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

const mockGetAllAssemblyGuides = vi.fn();
const mockGetDeliveryInstructions = vi.fn();
const mockGetProductGuides = vi.fn();
const mockGetAvailableDeliverySlots = vi.fn();
const mockGetBusinessSchema = vi.fn();

vi.mock('backend/deliveryExperience.web', () => ({
  getAllAssemblyGuides: mockGetAllAssemblyGuides,
  getDeliveryInstructions: mockGetDeliveryInstructions,
}));

vi.mock('backend/postPurchaseCare.web', () => ({
  getProductGuides: mockGetProductGuides,
}));

vi.mock('backend/deliveryScheduling.web', () => ({
  getAvailableDeliverySlots: mockGetAvailableDeliverySlots,
}));

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: mockGetBusinessSchema,
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

vi.mock('public/designTokens.js', () => ({
  colors: {
    sand: '#E8D5B7',
    espresso: '#3A2518',
    mountainBlue: '#5B8FA8',
    coral: '#E8845C',
    success: '#28a745',
    sandLight: '#F2E8D5',
    offWhite: '#FAF7F2',
  },
  spacing: { sm: 8, md: 16, lg: 24 },
}));

import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { initBackToTop } from 'public/mobileHelpers';

// ── Test Data ───────────────────────────────────────────────────────

const mockAssemblyGuides = {
  'futon-frames': {
    title: 'Futon Frame Assembly Guide',
    estimatedTime: '30-60 minutes',
    toolsNeeded: ['Phillips screwdriver', 'Allen wrench (included)'],
    steps: [
      'Unbox all components.',
      'Attach side rails.',
      'Connect back frame.',
      'Install arm rests.',
      'Test fold mechanism.',
    ],
    videoUrl: '',
  },
  'murphy-cabinet-beds': {
    title: 'Murphy Cabinet Bed Setup',
    estimatedTime: 'Under 2 minutes (daily use)',
    toolsNeeded: [],
    steps: ['Position cabinet.', 'Open doors.', 'Pull platform forward.'],
    videoUrl: '',
  },
  'platform-beds': {
    title: 'Platform Bed Assembly Guide',
    estimatedTime: '45-90 minutes',
    toolsNeeded: ['Phillips screwdriver', 'Allen wrench (included)', 'Rubber mallet (optional)'],
    steps: ['Lay out parts.', 'Assemble headboard.', 'Connect rails.', 'Install support.', 'Place slats.'],
    videoUrl: '',
  },
  'mattresses': {
    title: 'Mattress Care Guide',
    estimatedTime: 'N/A',
    toolsNeeded: [],
    steps: ['Remove packaging.', 'Allow expansion.', 'Rotate regularly.'],
    videoUrl: '',
  },
};

const mockCareGuides = [
  {
    _id: 'g-1',
    productCategory: 'futon-frames',
    guideType: 'maintenance',
    title: 'Futon Frame Maintenance',
    summary: 'Keep your futon frame in top shape.',
    content: 'Regular care for your futon frame...',
    steps: ['Tighten bolts quarterly.', 'Oil pivot points annually.'],
    videoUrl: '',
    imageUrl: '',
  },
  {
    _id: 'g-2',
    productCategory: 'futon-frames',
    guideType: 'fabric_care',
    title: 'Futon Cover Care',
    summary: 'Tips for cleaning your futon cover.',
    content: 'Machine washable covers...',
    steps: ['Remove cover.', 'Machine wash cold.', 'Air dry.'],
    videoUrl: 'https://example.com/video.mp4',
    imageUrl: '',
  },
];

const mockDeliveryInstructions = {
  title: 'Standard Curbside Delivery',
  instructions: [
    'Your order ships via freight carrier.',
    'Carrier will contact you.',
    'Delivery is curbside.',
    'Inspect packaging before signing.',
    'Note damage on delivery receipt.',
  ],
  tips: [
    'Have a helper available.',
    'Keep packaging until verified.',
    'Contact within 48 hours if damaged.',
  ],
};

const mockSlots = [
  { date: '2026-03-11', dayOfWeek: 'Wednesday', window: 'morning', startTime: '9:00 AM', endTime: '12:00 PM', available: true },
  { date: '2026-03-11', dayOfWeek: 'Wednesday', window: 'afternoon', startTime: '1:00 PM', endTime: '5:00 PM', available: true },
  { date: '2026-03-12', dayOfWeek: 'Thursday', window: 'morning', startTime: '9:00 AM', endTime: '12:00 PM', available: false },
];

// ── Setup ───────────────────────────────────────────────────────────

describe('Shipping Policy / Getting It Home Page', () => {
  beforeAll(async () => {
    // Set up default mocks before module import
    mockGetAllAssemblyGuides.mockResolvedValue({ success: true, guides: mockAssemblyGuides });
    mockGetDeliveryInstructions.mockResolvedValue({ success: true, data: mockDeliveryInstructions });
    mockGetProductGuides.mockResolvedValue({ success: true, guides: mockCareGuides });
    mockGetAvailableDeliverySlots.mockResolvedValue({ success: true, slots: mockSlots });
    mockGetBusinessSchema.mockResolvedValue('{"@context":"https://schema.org"}');

    await import('../src/pages/Shipping Policy.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();

    mockGetAllAssemblyGuides.mockResolvedValue({ success: true, guides: mockAssemblyGuides });
    mockGetDeliveryInstructions.mockResolvedValue({ success: true, data: mockDeliveryInstructions });
    mockGetProductGuides.mockResolvedValue({ success: true, guides: mockCareGuides });
    mockGetAvailableDeliverySlots.mockResolvedValue({ success: true, slots: mockSlots });
    mockGetBusinessSchema.mockResolvedValue('{"@context":"https://schema.org"}');
  });

  // ── Page Initialization ────────────────────────────────────────

  describe('page initialization', () => {
    it('registers $w.onReady handler', () => {
      expect(onReadyHandler).not.toBeNull();
    });

    it('initializes back-to-top button', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('tracks page view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'shipping_policy' });
    });

    it('does not crash if backend calls fail', async () => {
      mockGetAllAssemblyGuides.mockRejectedValue(new Error('Network error'));
      mockGetProductGuides.mockRejectedValue(new Error('Network error'));
      mockGetDeliveryInstructions.mockRejectedValue(new Error('Network error'));
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });

  // ── Shipping Calculator ────────────────────────────────────────

  describe('shipping calculator', () => {
    it('sets ARIA labels on zip input and calc button', async () => {
      await onReadyHandler();
      expect(getEl('#shippingZipInput').accessibility.ariaLabel).toMatch(/ZIP/i);
      expect(getEl('#shippingCalcBtn').accessibility.ariaLabel).toMatch(/shipping/i);
    });

    it('validates ZIP code format', async () => {
      await onReadyHandler();
      const handler = getEl('#shippingCalcBtn').onClick.mock.calls[0][0];

      // Invalid ZIP
      getEl('#shippingZipInput').value = 'abc';
      handler();
      expect(getEl('#shippingResult').text).toMatch(/valid.*ZIP/i);

      // Empty ZIP
      getEl('#shippingZipInput').value = '';
      handler();
      expect(getEl('#shippingResult').text).toMatch(/valid.*ZIP/i);
    });

    it('identifies local delivery zone for Henderson County ZIPs', async () => {
      await onReadyHandler();
      const handler = getEl('#shippingCalcBtn').onClick.mock.calls[0][0];

      getEl('#shippingZipInput').value = '28792';
      handler();
      expect(getEl('#shippingResult').text).toMatch(/local/i);
      expect(trackEvent).toHaveBeenCalledWith('shipping_calculator', expect.objectContaining({ zone: 'local' }));
    });

    it('identifies regional zone for Southeast US', async () => {
      await onReadyHandler();
      const handler = getEl('#shippingCalcBtn').onClick.mock.calls[0][0];

      getEl('#shippingZipInput').value = '30301'; // Atlanta GA
      handler();
      expect(getEl('#shippingResult').text).toMatch(/free shipping/i);
      expect(trackEvent).toHaveBeenCalledWith('shipping_calculator', expect.objectContaining({ zone: 'regional' }));
    });

    it('identifies national zone for other US ZIPs', async () => {
      await onReadyHandler();
      const handler = getEl('#shippingCalcBtn').onClick.mock.calls[0][0];

      getEl('#shippingZipInput').value = '90210'; // CA
      handler();
      expect(getEl('#shippingResult').text).toMatch(/nationwide/i);
      expect(trackEvent).toHaveBeenCalledWith('shipping_calculator', expect.objectContaining({ zone: 'national' }));
    });

    it('announces result for screen readers', async () => {
      await onReadyHandler();
      const handler = getEl('#shippingCalcBtn').onClick.mock.calls[0][0];

      getEl('#shippingZipInput').value = '28792';
      handler();
      expect(announce).toHaveBeenCalled();
    });
  });

  // ── Delivery Methods ───────────────────────────────────────────

  describe('delivery methods', () => {
    it('populates delivery methods repeater with 4 methods', async () => {
      await onReadyHandler();
      const repeater = getEl('#deliveryRepeater');
      expect(repeater.data).toHaveLength(4);
      expect(repeater.data[0].title).toBe('Standard Shipping');
      expect(repeater.data[3].title).toBe('White Glove Delivery');
    });

    it('sets item-ready handler for repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#deliveryRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('populates repeater items with title and description', async () => {
      await onReadyHandler();
      const repeater = getEl('#deliveryRepeater');
      const itemReadyHandler = repeater.onItemReady.mock.calls[0][0];

      const mockItem = (sel) => getEl(`item-${sel}`);
      const itemData = { title: 'White Glove Delivery', description: 'Full assembly service.' };
      itemReadyHandler(mockItem, itemData);

      expect(getEl('item-#deliveryTitle').text).toBe('White Glove Delivery');
      expect(getEl('item-#deliveryDesc').text).toBe('Full assembly service.');
    });
  });

  // ── Assembly Guides Section ────────────────────────────────────

  describe('assembly guides section', () => {
    it('loads assembly guides from backend on page init', async () => {
      await onReadyHandler();
      expect(mockGetAllAssemblyGuides).toHaveBeenCalled();
    });

    it('populates assembly guides repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#assemblyGuidesRepeater');
      expect(repeater.data.length).toBeGreaterThanOrEqual(4);
    });

    it('sets item-ready handler with guide title, time, and tools', async () => {
      await onReadyHandler();
      const repeater = getEl('#assemblyGuidesRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();

      const handler = repeater.onItemReady.mock.calls[0][0];
      const mockItem = (sel) => getEl(`guide-${sel}`);
      const guideData = {
        _id: 'futon-frames',
        title: 'Futon Frame Assembly Guide',
        estimatedTime: '30-60 minutes',
        toolsNeeded: ['Phillips screwdriver', 'Allen wrench (included)'],
        steps: ['Unbox all components.', 'Attach side rails.'],
      };
      handler(mockItem, guideData);

      expect(getEl('guide-#guideTitle').text).toBe('Futon Frame Assembly Guide');
      expect(getEl('guide-#guideTime').text).toMatch(/30-60 minutes/);
      expect(getEl('guide-#guideTools').text).toMatch(/Phillips screwdriver/);
    });

    it('renders step list in guide detail', async () => {
      await onReadyHandler();
      const repeater = getEl('#assemblyGuidesRepeater');
      const handler = repeater.onItemReady.mock.calls[0][0];

      const mockItem = (sel) => getEl(`guide2-${sel}`);
      const guideData = {
        _id: 'futon-frames',
        title: 'Futon Frame Assembly Guide',
        estimatedTime: '30-60 min',
        toolsNeeded: [],
        steps: ['Step 1', 'Step 2', 'Step 3'],
      };
      handler(mockItem, guideData);

      expect(getEl('guide2-#guideSteps').text).toContain('Step 1');
      expect(getEl('guide2-#guideSteps').text).toContain('Step 2');
    });

    it('sets ARIA labels on guide cards', async () => {
      await onReadyHandler();
      const repeater = getEl('#assemblyGuidesRepeater');
      const handler = repeater.onItemReady.mock.calls[0][0];

      const mockItem = (sel) => getEl(`guide-aria-${sel}`);
      handler(mockItem, {
        _id: 'futon-frames',
        title: 'Futon Frame Assembly Guide',
        estimatedTime: '30 min',
        toolsNeeded: [],
        steps: [],
      });

      expect(getEl('guide-aria-#guideTitle').accessibility.ariaLabel).toMatch(/Futon Frame/);
    });

    it('handles empty assembly guides gracefully', async () => {
      mockGetAllAssemblyGuides.mockResolvedValue({ success: true, guides: {} });
      await onReadyHandler();
      const repeater = getEl('#assemblyGuidesRepeater');
      expect(repeater.data).toHaveLength(0);
    });

    it('handles assembly guides API failure', async () => {
      mockGetAllAssemblyGuides.mockResolvedValue({ success: false, error: 'Failed' });
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('tracks assembly guide view event on expand click', async () => {
      await onReadyHandler();
      const repeater = getEl('#assemblyGuidesRepeater');
      const handler = repeater.onItemReady.mock.calls[0][0];

      const mockItem = (sel) => getEl(`track-${sel}`);
      handler(mockItem, {
        _id: 'futon-frames',
        title: 'Futon Frame Assembly Guide',
        estimatedTime: '30 min',
        toolsNeeded: [],
        steps: ['Step 1'],
      });

      const expandHandler = getEl('track-#guideExpandBtn').onClick.mock.calls[0][0];
      expandHandler();
      expect(trackEvent).toHaveBeenCalledWith('assembly_guide_view', expect.objectContaining({ category: 'futon-frames' }));
    });
  });

  // ── Care Tips Section ──────────────────────────────────────────

  describe('care tips section', () => {
    it('loads care guides for futon-frames category by default', async () => {
      await onReadyHandler();
      expect(mockGetProductGuides).toHaveBeenCalledWith('futon-frames');
    });

    it('populates care tips repeater with guides', async () => {
      await onReadyHandler();
      const repeater = getEl('#careTipsRepeater');
      expect(repeater.data).toHaveLength(2);
      expect(repeater.data[0].title).toBe('Futon Frame Maintenance');
    });

    it('sets item-ready handler with guide title and summary', async () => {
      await onReadyHandler();
      const repeater = getEl('#careTipsRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();

      const handler = repeater.onItemReady.mock.calls[0][0];
      const mockItem = (sel) => getEl(`care-${sel}`);
      handler(mockItem, mockCareGuides[0]);

      expect(getEl('care-#careTipTitle').text).toBe('Futon Frame Maintenance');
      expect(getEl('care-#careTipSummary').text).toBe('Keep your futon frame in top shape.');
    });

    it('renders care guide steps when available', async () => {
      await onReadyHandler();
      const repeater = getEl('#careTipsRepeater');
      const handler = repeater.onItemReady.mock.calls[0][0];

      const mockItem = (sel) => getEl(`care-steps-${sel}`);
      handler(mockItem, mockCareGuides[0]);

      expect(getEl('care-steps-#careTipSteps').text).toContain('Tighten bolts quarterly');
    });

    it('shows video link when videoUrl is present', async () => {
      await onReadyHandler();
      const repeater = getEl('#careTipsRepeater');
      const handler = repeater.onItemReady.mock.calls[0][0];

      // Guide with video
      const mockItemWithVideo = (sel) => getEl(`vid-${sel}`);
      handler(mockItemWithVideo, mockCareGuides[1]);
      expect(getEl('vid-#careTipVideoLink').show).toHaveBeenCalled();

      // Guide without video
      const mockItemNoVideo = (sel) => getEl(`novid-${sel}`);
      handler(mockItemNoVideo, mockCareGuides[0]);
      expect(getEl('novid-#careTipVideoLink').hide).toHaveBeenCalled();
    });

    it('handles care guides API failure gracefully', async () => {
      mockGetProductGuides.mockResolvedValue({ success: false, error: 'Failed', guides: [] });
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('handles empty care guides', async () => {
      mockGetProductGuides.mockResolvedValue({ success: true, guides: [] });
      await onReadyHandler();
      const repeater = getEl('#careTipsRepeater');
      expect(repeater.data).toHaveLength(0);
    });

    it('allows category switching via dropdown', async () => {
      await onReadyHandler();
      const dropdown = getEl('#careCategoryDropdown');
      expect(dropdown.onChange).toHaveBeenCalled();

      const changeHandler = dropdown.onChange.mock.calls[0][0];

      mockGetProductGuides.mockResolvedValue({
        success: true,
        guides: [{ _id: 'g-3', productCategory: 'mattresses', guideType: 'maintenance', title: 'Mattress Care', summary: 'Care for your mattress.', steps: [], videoUrl: '', imageUrl: '' }],
      });

      await changeHandler({ target: { value: 'mattresses' } });
      expect(mockGetProductGuides).toHaveBeenCalledWith('mattresses');
      const repeater = getEl('#careTipsRepeater');
      expect(repeater.data[0].title).toBe('Mattress Care');
    });

    it('tracks care guide category change', async () => {
      await onReadyHandler();
      const changeHandler = getEl('#careCategoryDropdown').onChange.mock.calls[0][0];

      mockGetProductGuides.mockResolvedValue({ success: true, guides: [] });
      await changeHandler({ target: { value: 'mattresses' } });

      expect(trackEvent).toHaveBeenCalledWith('care_guide_category', { category: 'mattresses' });
    });
  });

  // ── Delivery Prep Section ──────────────────────────────────────

  describe('delivery preparation section', () => {
    it('loads standard delivery instructions by default', async () => {
      await onReadyHandler();
      expect(mockGetDeliveryInstructions).toHaveBeenCalledWith('standard');
    });

    it('displays preparation instructions', async () => {
      await onReadyHandler();
      const instructionsEl = getEl('#deliveryPrepInstructions');
      expect(instructionsEl.text).toContain('freight carrier');
    });

    it('displays delivery tips', async () => {
      await onReadyHandler();
      const tipsEl = getEl('#deliveryPrepTips');
      expect(tipsEl.text).toContain('helper available');
    });

    it('allows switching delivery tier via dropdown', async () => {
      await onReadyHandler();
      const dropdown = getEl('#deliveryTierDropdown');
      expect(dropdown.onChange).toHaveBeenCalled();

      const whiteGloveData = {
        title: 'White Glove Local Delivery',
        instructions: ['Our team will call 24 hours before.', 'Clear a path.'],
        tips: ['Measure doorways.', 'Have someone available.'],
      };
      mockGetDeliveryInstructions.mockResolvedValue({ success: true, data: whiteGloveData });

      const handler = dropdown.onChange.mock.calls[0][0];
      await handler({ target: { value: 'white_glove_local' } });

      expect(mockGetDeliveryInstructions).toHaveBeenCalledWith('white_glove_local');
      expect(getEl('#deliveryPrepInstructions').text).toContain('call 24 hours');
    });

    it('handles delivery instructions API failure', async () => {
      mockGetDeliveryInstructions.mockResolvedValue({ success: false, error: 'Failed' });
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('sets ARIA on delivery tier dropdown', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryTierDropdown').accessibility.ariaLabel).toMatch(/delivery/i);
    });
  });

  // ── Delivery Scheduling CTA ────────────────────────────────────

  describe('delivery scheduling section', () => {
    it('loads available delivery slots on init', async () => {
      await onReadyHandler();
      expect(mockGetAvailableDeliverySlots).toHaveBeenCalledWith('white_glove_local');
    });

    it('displays next available slot info', async () => {
      await onReadyHandler();
      const nextSlotEl = getEl('#nextAvailableSlot');
      expect(nextSlotEl.text).toMatch(/Wednesday|March/i);
    });

    it('sets up schedule button click handler', async () => {
      await onReadyHandler();
      const btn = getEl('#scheduleDeliveryBtn');
      expect(btn.onClick).toHaveBeenCalled();
    });

    it('handles no available slots gracefully', async () => {
      mockGetAvailableDeliverySlots.mockResolvedValue({ success: true, slots: [] });
      await onReadyHandler();
      const nextSlotEl = getEl('#nextAvailableSlot');
      expect(nextSlotEl.text).toMatch(/call|contact/i);
    });

    it('handles scheduling API failure', async () => {
      mockGetAvailableDeliverySlots.mockResolvedValue({ success: false, error: 'Failed' });
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });

  // ── Schema Injection ───────────────────────────────────────────

  describe('schema injection', () => {
    it('injects business schema into HTML element', async () => {
      await onReadyHandler();
      expect(mockGetBusinessSchema).toHaveBeenCalled();
      expect(getEl('#shippingSchemaHtml').postMessage).toHaveBeenCalledWith(
        '{"@context":"https://schema.org"}'
      );
    });

    it('handles schema load failure', async () => {
      mockGetBusinessSchema.mockRejectedValue(new Error('Schema error'));
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });

  // ── Accessibility ──────────────────────────────────────────────

  describe('accessibility', () => {
    it('sets ARIA labels on interactive elements', async () => {
      await onReadyHandler();
      expect(getEl('#shippingZipInput').accessibility.ariaLabel).toBeTruthy();
      expect(getEl('#shippingCalcBtn').accessibility.ariaLabel).toBeTruthy();
      expect(getEl('#careCategoryDropdown').accessibility.ariaLabel).toBeTruthy();
      expect(getEl('#deliveryTierDropdown').accessibility.ariaLabel).toBeTruthy();
    });

    it('uses announce for dynamic content updates', async () => {
      await onReadyHandler();
      const handler = getEl('#shippingCalcBtn').onClick.mock.calls[0][0];
      getEl('#shippingZipInput').value = '28792';
      handler();
      expect(announce).toHaveBeenCalledWith($w, expect.any(String));
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles all backend calls rejecting simultaneously', async () => {
      mockGetAllAssemblyGuides.mockRejectedValue(new Error('down'));
      mockGetDeliveryInstructions.mockRejectedValue(new Error('down'));
      mockGetProductGuides.mockRejectedValue(new Error('down'));
      mockGetAvailableDeliverySlots.mockRejectedValue(new Error('down'));
      mockGetBusinessSchema.mockRejectedValue(new Error('down'));
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('handles null/undefined return values from backends', async () => {
      mockGetAllAssemblyGuides.mockResolvedValue(null);
      mockGetProductGuides.mockResolvedValue(undefined);
      mockGetDeliveryInstructions.mockResolvedValue(null);
      mockGetAvailableDeliverySlots.mockResolvedValue(null);
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('does not crash when optional page elements are missing', async () => {
      const origW = globalThis.$w;
      globalThis.$w = Object.assign(
        (sel) => {
          if (sel === '#assemblyGuidesRepeater') return null;
          return getEl(sel);
        },
        { onReady: origW.onReady }
      );
      await expect(onReadyHandler()).resolves.not.toThrow();
      globalThis.$w = origW;
    });

    it('ZIP input with whitespace is trimmed', async () => {
      await onReadyHandler();
      const handler = getEl('#shippingCalcBtn').onClick.mock.calls[0][0];
      getEl('#shippingZipInput').value = '  28792  ';
      handler();
      expect(getEl('#shippingResult').text).toMatch(/local/i);
    });

    it('ZIP with non-5-digit format rejected', async () => {
      await onReadyHandler();
      const handler = getEl('#shippingCalcBtn').onClick.mock.calls[0][0];

      getEl('#shippingZipInput').value = '1234'; // too short
      handler();
      expect(getEl('#shippingResult').text).toMatch(/valid.*ZIP/i);

      getEl('#shippingZipInput').value = '123456'; // too long
      handler();
      expect(getEl('#shippingResult').text).toMatch(/valid.*ZIP/i);
    });

    it('special characters in ZIP are rejected', async () => {
      await onReadyHandler();
      const handler = getEl('#shippingCalcBtn').onClick.mock.calls[0][0];
      getEl('#shippingZipInput').value = '2879<script>';
      handler();
      expect(getEl('#shippingResult').text).toMatch(/valid.*ZIP/i);
    });
  });
});
