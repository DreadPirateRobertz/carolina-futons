import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    style: {}, accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onKeyPress: vi.fn(),
    items: [],
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

const $w = (sel) => getEl(sel);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/cartService', () => ({
  getProductVariants: vi.fn(() => Promise.resolve([])),
}));

vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn(() => Promise.resolve()),
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({ items: [] })),
    })),
  },
}));

const { getProductVariants } = await import('public/cartService');

// ── Import Module Under Test ────────────────────────────────────────

const {
  initProductInfoAccordion,
  initProductVideo,
  initStockUrgency,
  initDeliveryEstimate,
  initBackInStockNotification,
} = await import('../src/public/product/productDetails.js');

// ── Tests ───────────────────────────────────────────────────────────

describe('initProductInfoAccordion', () => {
  beforeEach(() => { elements.clear(); });

  it('expands Description by default', () => {
    initProductInfoAccordion($w);
    expect(getEl('#infoContentDescription').expand).toHaveBeenCalled();
  });

  it('collapses Dimensions, Care, Shipping by default', () => {
    initProductInfoAccordion($w);
    expect(getEl('#infoContentDimensions').collapse).toHaveBeenCalled();
    expect(getEl('#infoContentCare').collapse).toHaveBeenCalled();
    expect(getEl('#infoContentShipping').collapse).toHaveBeenCalled();
  });

  it('sets Description arrow to minus', () => {
    initProductInfoAccordion($w);
    expect(getEl('#infoArrowDescription').text).toBe('\u2212');
  });

  it('sets non-Description arrows to plus', () => {
    initProductInfoAccordion($w);
    expect(getEl('#infoArrowDimensions').text).toBe('+');
    expect(getEl('#infoArrowCare').text).toBe('+');
  });

  it('sets ARIA labels on section headers', () => {
    initProductInfoAccordion($w);
    expect(getEl('#infoHeaderDescription').accessibility.ariaLabel).toBe('Description section');
    expect(getEl('#infoHeaderDimensions').accessibility.ariaLabel).toBe('Dimensions section');
  });

  it('sets ariaExpanded true for Description header', () => {
    initProductInfoAccordion($w);
    expect(getEl('#infoHeaderDescription').accessibility.ariaExpanded).toBe(true);
  });

  it('sets ariaExpanded false for other headers', () => {
    initProductInfoAccordion($w);
    expect(getEl('#infoHeaderDimensions').accessibility.ariaExpanded).toBe(false);
  });

  it('toggles section on header click', () => {
    initProductInfoAccordion($w);
    const clickHandler = getEl('#infoHeaderDescription').onClick.mock.calls[0][0];
    // Description starts expanded, clicking should collapse
    clickHandler();
    expect(getEl('#infoContentDescription').collapse).toHaveBeenCalled();
    expect(getEl('#infoArrowDescription').text).toBe('+');
  });

  it('toggles closed section open on click', () => {
    initProductInfoAccordion($w);
    const clickHandler = getEl('#infoHeaderDimensions').onClick.mock.calls[0][0];
    // Dimensions starts collapsed, clicking should expand
    clickHandler();
    expect(getEl('#infoContentDimensions').expand).toHaveBeenCalled();
    expect(getEl('#infoArrowDimensions').text).toBe('\u2212');
  });

  it('sets shipping info text', () => {
    initProductInfoAccordion($w);
    expect(getEl('#infoContentShipping').text).toContain('Free standard shipping');
  });
});

describe('initProductVideo', () => {
  beforeEach(() => { elements.clear(); });

  it('collapses video section when no video media', () => {
    const product = { mediaItems: [{ mediaType: 'image' }] };
    initProductVideo($w, product);
    expect(getEl('#productVideoSection').collapse).toHaveBeenCalled();
  });

  it('expands video section when video media exists', () => {
    const product = { mediaItems: [{ mediaType: 'video', src: 'video.mp4' }] };
    initProductVideo($w, product);
    expect(getEl('#productVideoSection').expand).toHaveBeenCalled();
  });

  it('sets video title', () => {
    const product = { mediaItems: [{ mediaType: 'video', src: 'v.mp4' }] };
    initProductVideo($w, product);
    expect(getEl('#productVideoTitle').text).toBe('See It In Action');
  });

  it('sets video src from src property', () => {
    const product = { mediaItems: [{ mediaType: 'video', src: 'video.mp4' }] };
    initProductVideo($w, product);
    expect(getEl('#productVideo').src).toBe('video.mp4');
  });

  it('sets video src from url property as fallback', () => {
    const product = { mediaItems: [{ mediaType: 'video', url: 'video2.mp4' }] };
    initProductVideo($w, product);
    expect(getEl('#productVideo').src).toBe('video2.mp4');
  });

  it('mutes the video player', () => {
    const player = getEl('#productVideo');
    player.mute = vi.fn();
    const product = { mediaItems: [{ mediaType: 'video', src: 'v.mp4' }] };
    initProductVideo($w, product);
    expect(player.mute).toHaveBeenCalled();
  });

  it('does nothing when no product', () => {
    initProductVideo($w, null);
    // Should not throw
  });

  it('registers click on viewAllVideosLink', () => {
    const product = { mediaItems: [{ mediaType: 'video', src: 'v.mp4' }] };
    initProductVideo($w, product);
    expect(getEl('#viewAllVideosLink').onClick).toHaveBeenCalled();
  });
});

describe('initStockUrgency', () => {
  beforeEach(() => { elements.clear(); });

  it('shows urgency for low stock (1-4)', async () => {
    const product = { _id: 'p1', quantityInStock: 3 };
    await initStockUrgency($w, product);
    expect(getEl('#stockUrgency').text).toBe('Only 3 left in stock');
    expect(getEl('#stockUrgency').show).toHaveBeenCalled();
  });

  it('hides urgency for adequate stock', async () => {
    const product = { _id: 'p1', quantityInStock: 10 };
    await initStockUrgency($w, product);
    expect(getEl('#stockUrgency').hide).toHaveBeenCalled();
  });

  it('hides urgency for zero stock', async () => {
    const product = { _id: 'p1', quantityInStock: 0 };
    await initStockUrgency($w, product);
    expect(getEl('#stockUrgency').hide).toHaveBeenCalled();
  });

  it('does nothing without product', async () => {
    await initStockUrgency($w, null);
    // Should not throw
  });
});

describe('initDeliveryEstimate', () => {
  beforeEach(() => { elements.clear(); });

  it('sets delivery estimate text', () => {
    const product = { _id: 'p1' };
    initDeliveryEstimate($w, product);
    expect(getEl('#deliveryEstimate').text).toContain('Estimated delivery:');
  });

  it('shows delivery estimate element', () => {
    const product = { _id: 'p1' };
    initDeliveryEstimate($w, product);
    expect(getEl('#deliveryEstimate').show).toHaveBeenCalled();
  });

  it('shows white-glove note for heavy items', () => {
    const product = { _id: 'p1', weight: 100 };
    initDeliveryEstimate($w, product);
    expect(getEl('#whiteGloveNote').text).toContain('White-glove delivery');
    expect(getEl('#whiteGloveNote').show).toHaveBeenCalled();
  });

  it('shows white-glove note for futon collections', () => {
    const product = { _id: 'p1', weight: 10, collections: ['futon-frames'] };
    initDeliveryEstimate($w, product);
    expect(getEl('#whiteGloveNote').text).toContain('White-glove');
  });

  it('does nothing without product', () => {
    initDeliveryEstimate($w, null);
    // Should not throw
  });
});

describe('initBackInStockNotification', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('collapses section initially', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    expect(getEl('#backInStockSection').collapse).toHaveBeenCalled();
  });

  it('hides success message initially', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    expect(getEl('#backInStockSuccess').hide).toHaveBeenCalled();
  });

  it('registers onChange on size/finish dropdowns', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    expect(getEl('#sizeDropdown').onChange).toHaveBeenCalled();
    expect(getEl('#finishDropdown').onChange).toHaveBeenCalled();
  });

  it('registers onClick on submit button', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    expect(getEl('#backInStockBtn').onClick).toHaveBeenCalled();
  });

  it('ignores invalid email on submit', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    const clickHandler = getEl('#backInStockBtn').onClick.mock.calls[0][0];
    getEl('#backInStockEmail').value = 'invalid';
    await clickHandler();
    // submitContactForm should not be called
    const { submitContactForm } = await import('backend/contactSubmissions.web');
    expect(submitContactForm).not.toHaveBeenCalled();
  });

  it('does nothing without required elements', async () => {
    // Clear all elements so section/emailInput/submitBtn are missing
    elements.clear();
    elements.set('#backInStockSection', null);
    const localW = (sel) => elements.get(sel) || null;
    await initBackInStockNotification(localW, { _id: 'p1', name: 'Test' });
    // Should not throw
  });

  it('submits back-in-stock request for valid email', async () => {
    const product = { _id: 'p1', name: 'Comfy Futon' };
    await initBackInStockNotification($w, product);
    const clickHandler = getEl('#backInStockBtn').onClick.mock.calls[0][0];
    getEl('#backInStockEmail').value = 'test@example.com';
    await clickHandler();
    const { submitContactForm } = await import('backend/contactSubmissions.web');
    expect(submitContactForm).toHaveBeenCalledWith(expect.objectContaining({
      email: 'test@example.com',
      source: 'back_in_stock',
      productId: 'p1',
      productName: 'Comfy Futon',
    }));
  });

  it('shows success message after valid submission', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    const clickHandler = getEl('#backInStockBtn').onClick.mock.calls[0][0];
    getEl('#backInStockEmail').value = 'test@example.com';
    await clickHandler();
    expect(getEl('#backInStockSuccess').text).toContain('back in stock');
    expect(getEl('#backInStockSuccess').show).toHaveBeenCalled();
  });

  it('hides button and input after submission', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    const clickHandler = getEl('#backInStockBtn').onClick.mock.calls[0][0];
    getEl('#backInStockEmail').value = 'test@example.com';
    await clickHandler();
    expect(getEl('#backInStockBtn').hide).toHaveBeenCalled();
    expect(getEl('#backInStockEmail').hide).toHaveBeenCalled();
  });

  it('trims whitespace from email', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    const clickHandler = getEl('#backInStockBtn').onClick.mock.calls[0][0];
    getEl('#backInStockEmail').value = '  test@example.com  ';
    await clickHandler();
    const { submitContactForm } = await import('backend/contactSubmissions.web');
    expect(submitContactForm).toHaveBeenCalledWith(expect.objectContaining({
      email: 'test@example.com',
    }));
  });

  it('ignores empty email on submit', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    const clickHandler = getEl('#backInStockBtn').onClick.mock.calls[0][0];
    getEl('#backInStockEmail').value = '';
    await clickHandler();
    const { submitContactForm } = await import('backend/contactSubmissions.web');
    expect(submitContactForm).not.toHaveBeenCalled();
  });

  it('onChange triggers updateBackInStockVisibility for size dropdown', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    expect(getEl('#sizeDropdown').onChange).toHaveBeenCalled();
    // Simulate dropdown change with out-of-stock variant
    getProductVariants.mockResolvedValueOnce([{ inStock: false }]);
    getEl('#sizeDropdown').value = 'Full';
    const onChangeHandler = getEl('#sizeDropdown').onChange.mock.calls[0][0];
    await onChangeHandler();
    expect(getEl('#backInStockSection').expand).toHaveBeenCalled();
  });

  it('collapses back-in-stock when variant is in stock', async () => {
    const product = { _id: 'p1', name: 'Test' };
    await initBackInStockNotification($w, product);
    getProductVariants.mockResolvedValueOnce([{ inStock: true }]);
    getEl('#sizeDropdown').value = 'Twin';
    const onChangeHandler = getEl('#sizeDropdown').onChange.mock.calls[0][0];
    await onChangeHandler();
    // collapse called at init + on change
    expect(getEl('#backInStockSection').collapse).toHaveBeenCalledTimes(2);
  });
});

describe('initStockUrgency — popularity badge', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows popularity badge when weekSales > 0', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockReturnValueOnce({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({
        items: [{ weekSales: 12 }],
      })),
    });
    const product = { _id: 'p1', quantityInStock: 10 };
    await initStockUrgency($w, product);
    expect(getEl('#popularityBadge').text).toContain('12 sold this week');
    expect(getEl('#popularityBadge').show).toHaveBeenCalled();
  });

  it('hides popularity badge when no sales data', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockReturnValueOnce({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({ items: [] })),
    });
    const product = { _id: 'p1', quantityInStock: 10 };
    await initStockUrgency($w, product);
    expect(getEl('#popularityBadge').hide).toHaveBeenCalled();
  });

  it('hides popularity badge when weekSales is 0', async () => {
    const wixData = (await import('wix-data')).default;
    wixData.query.mockReturnValueOnce({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({
        items: [{ weekSales: 0 }],
      })),
    });
    const product = { _id: 'p1', quantityInStock: 10 };
    await initStockUrgency($w, product);
    expect(getEl('#popularityBadge').hide).toHaveBeenCalled();
  });
});

describe('initDeliveryEstimate — collection matching', () => {
  beforeEach(() => { elements.clear(); });

  it('shows white-glove for murphy collections', () => {
    const product = { _id: 'p1', weight: 10, collections: ['murphy-cabinet-beds'] };
    initDeliveryEstimate($w, product);
    expect(getEl('#whiteGloveNote').text).toContain('White-glove');
  });

  it('shows white-glove for platform-beds', () => {
    const product = { _id: 'p1', weight: 10, collections: ['platform-beds'] };
    initDeliveryEstimate($w, product);
    expect(getEl('#whiteGloveNote').text).toContain('White-glove');
  });

  it('does not show white-glove for small items not in furniture collections', () => {
    const product = { _id: 'p1', weight: 5, collections: ['accessories'] };
    initDeliveryEstimate($w, product);
    expect(getEl('#whiteGloveNote').show).not.toHaveBeenCalled();
  });

  it('includes date range in estimate', () => {
    const product = { _id: 'p1' };
    initDeliveryEstimate($w, product);
    const text = getEl('#deliveryEstimate').text;
    // Should match pattern "Estimated delivery: <date> – <date>"
    expect(text).toMatch(/Estimated delivery: .+ – .+/);
  });
});

describe('initProductInfoAccordion — double toggle', () => {
  beforeEach(() => { elements.clear(); });

  it('double-click re-opens a collapsed section', () => {
    initProductInfoAccordion($w);
    const handler = getEl('#infoHeaderDescription').onClick.mock.calls[0][0];
    handler(); // collapse
    handler(); // re-expand
    expect(getEl('#infoArrowDescription').text).toBe('\u2212');
    expect(getEl('#infoHeaderDescription').accessibility.ariaExpanded).toBe(true);
  });

  it('updates ariaExpanded on toggle', () => {
    initProductInfoAccordion($w);
    const handler = getEl('#infoHeaderDimensions').onClick.mock.calls[0][0];
    handler(); // expand
    expect(getEl('#infoHeaderDimensions').accessibility.ariaExpanded).toBe(true);
    handler(); // collapse
    expect(getEl('#infoHeaderDimensions').accessibility.ariaExpanded).toBe(false);
  });
});

describe('initProductVideo — type fallback', () => {
  beforeEach(() => { elements.clear(); });

  it('finds video by type property', () => {
    const product = { mediaItems: [{ type: 'video', src: 'alt-video.mp4' }] };
    initProductVideo($w, product);
    expect(getEl('#productVideoSection').expand).toHaveBeenCalled();
    expect(getEl('#productVideo').src).toBe('alt-video.mp4');
  });

  it('collapses section when product has empty mediaItems', () => {
    const product = { mediaItems: [] };
    initProductVideo($w, product);
    expect(getEl('#productVideoSection').collapse).toHaveBeenCalled();
  });
});
