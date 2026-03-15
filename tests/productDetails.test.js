import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame, murphyBed } from './fixtures/products.js';

vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn().mockResolvedValue('{"@type":"Product"}'),
  generateAltText: vi.fn(),
  getBreadcrumbSchema: vi.fn().mockResolvedValue('{"@type":"BreadcrumbList"}'),
  getProductOgTags: vi.fn().mockResolvedValue('<meta property="og:title" content="Test">'),
  getProductFaqSchema: vi.fn().mockResolvedValue(null),
}));

vi.mock('backend/emailService.web', () => ({
  submitSwatchRequest: vi.fn().mockResolvedValue({}),
}));

vi.mock('public/productPageUtils.js', () => ({
  formatCurrency: vi.fn((n) => `$${Number(n).toFixed(2)}`),
  getCategoryFromCollections: vi.fn((colls) => {
    if (!colls) return { label: 'Shop', path: '/shop-main' };
    const arr = Array.isArray(colls) ? colls : [colls];
    if (arr.some(c => c.includes('futon'))) return { label: 'Futon Frames', path: '/futon-frames' };
    if (arr.some(c => c.includes('murphy'))) return { label: 'Murphy Cabinet Beds', path: '/murphy-cabinet-beds' };
    return { label: 'Shop', path: '/shop-main' };
  }),
  addBusinessDays: vi.fn((date, days) => {
    const r = new Date(date);
    r.setDate(r.getDate() + days + 2); // rough approx for test
    return r;
  }),
  HEART_FILLED_SVG: 'filled', HEART_OUTLINE_SVG: 'outline',
  isCallForPrice: vi.fn((product) => (product?.price ?? Infinity) <= 1),
  CALL_FOR_PRICE_TEXT: 'Call for Pricing \u2014 (828) 327-8030',
}));

vi.mock('public/engagementTracker', () => ({
  trackProductPageView: vi.fn(), trackCartAdd: vi.fn(), trackGalleryInteraction: vi.fn(), trackSwatchView: vi.fn(), trackSocialShare: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  makeClickable: vi.fn((el, handler, opts) => {
    if (el && handler) el.onClick(handler);
    if (el && opts?.ariaLabel) try { el.accessibility.ariaLabel = opts.ariaLabel; } catch (e) {}
  }),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { success: '#22c55e', sunsetCoral: '#E8845C', mountainBlue: '#5B8FA8', sandDark: '#c9b99a', espresso: '#3A2518', sandLight: '#F2E8D5', offWhite: '#FAF7F2' },
  spacing: { md: 16 },
  shadows: { nav: '0 2px 4px rgba(0,0,0,0.1)' },
}));

vi.mock('public/DeliveryEstimator.js', () => ({
  estimateDelivery: vi.fn().mockResolvedValue({
    success: true,
    deliveryText: 'Delivered by Mar 25 – Mar 30',
    shippingText: 'UPS Ground — $49.99',
    whiteGloveText: null,
  }),
}));

vi.mock('public/validators.js', () => ({
  validateEmail: vi.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
}));

import { initBreadcrumbs, initProductInfoAccordion, initSocialShare, initDeliveryEstimate, injectProductSchema, initSwatchRequest, initSwatchCTA } from '../src/public/ProductDetails.js';
import { estimateDelivery } from 'public/DeliveryEstimator.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(), onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), postMessage: vi.fn(), forEachItem: vi.fn(),
    onKeyPress: vi.fn(), onInput: vi.fn(),
    accessibility: {},
    productOptions: [],
    disable: vi.fn(), enable: vi.fn(),
    focus: vi.fn(),
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

describe('ProductDetails', () => {
  let $w, state;
  beforeEach(() => {
    $w = create$w();
    state = { product: { ...futonFrame, collections: ['futon-frames'] } };
  });

  describe('initBreadcrumbs', () => {
    it('sets Home as first breadcrumb', async () => {
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb1').text).toBe('Home');
    });

    it('sets category as second breadcrumb', async () => {
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb2').text).toBe('Futon Frames');
    });

    it('sets product name as third breadcrumb', async () => {
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb3').text).toBe(futonFrame.name);
    });

    it('registers click handlers on breadcrumbs', async () => {
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb1').onClick).toHaveBeenCalled();
      expect($w('#breadcrumb2').onClick).toHaveBeenCalled();
    });

    it('injects breadcrumb schema', async () => {
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumbSchemaHtml').postMessage).toHaveBeenCalledWith('{"@type":"BreadcrumbList"}');
    });

    it('returns early when product is null', async () => {
      state.product = null;
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb1').text).toBe('');
    });

    it('uses Murphy category for murphy collections', async () => {
      state.product = { ...state.product, collections: ['murphy-cabinet-beds'] };
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb2').text).toBe('Murphy Cabinet Beds');
    });

    it('does not throw when schema is null', async () => {
      const { getBreadcrumbSchema } = await import('backend/seoHelpers.web');
      getBreadcrumbSchema.mockResolvedValueOnce(null);
      await expect(initBreadcrumbs($w, state)).resolves.toBeUndefined();
    });
  });

  describe('initProductInfoAccordion', () => {
    it('expands Description section by default', () => {
      initProductInfoAccordion($w);
      expect($w('#infoContentDescription').expand).toHaveBeenCalled();
    });

    it('collapses non-Description sections by default', () => {
      initProductInfoAccordion($w);
      expect($w('#infoContentDimensions').collapse).toHaveBeenCalled();
      expect($w('#infoContentCare').collapse).toHaveBeenCalled();
      expect($w('#infoContentShipping').collapse).toHaveBeenCalled();
    });

    it('registers click handlers on all section headers', () => {
      initProductInfoAccordion($w);
      expect($w('#infoHeaderDescription').onClick).toHaveBeenCalled();
      expect($w('#infoHeaderDimensions').onClick).toHaveBeenCalled();
      expect($w('#infoHeaderCare').onClick).toHaveBeenCalled();
      expect($w('#infoHeaderShipping').onClick).toHaveBeenCalled();
    });

    it('sets shipping info text', () => {
      initProductInfoAccordion($w);
      expect($w('#infoContentShipping').text).toContain('Free standard shipping');
    });

    it('sets Description arrow to minus sign', () => {
      initProductInfoAccordion($w);
      expect($w('#infoArrowDescription').text).toBe('\u2212');
    });

    it('sets non-Description arrows to plus sign', () => {
      initProductInfoAccordion($w);
      expect($w('#infoArrowDimensions').text).toBe('+');
      expect($w('#infoArrowCare').text).toBe('+');
      expect($w('#infoArrowShipping').text).toBe('+');
    });

    it('toggles section on header click', () => {
      initProductInfoAccordion($w);
      // Dimensions starts collapsed — clicking should expand
      const clickCb = $w('#infoHeaderDimensions').onClick.mock.calls[0][0];
      clickCb();
      expect($w('#infoContentDimensions').expand).toHaveBeenCalled();
      expect($w('#infoArrowDimensions').text).toBe('\u2212');
    });

    it('collapses section on second click', () => {
      initProductInfoAccordion($w);
      const clickCb = $w('#infoHeaderDimensions').onClick.mock.calls[0][0];
      clickCb(); // expand
      clickCb(); // collapse
      expect($w('#infoContentDimensions').collapse).toHaveBeenCalledTimes(2); // once in init + once on toggle
      expect($w('#infoArrowDimensions').text).toBe('+');
    });

    it('registers keyboard handler for Enter/Space', () => {
      initProductInfoAccordion($w);
      expect($w('#infoHeaderDescription').onKeyPress).toHaveBeenCalled();
    });

    it('sets ariaExpanded true for expanded Description', () => {
      initProductInfoAccordion($w);
      expect($w('#infoHeaderDescription').accessibility.ariaExpanded).toBe(true);
    });

    it('sets ariaExpanded false for collapsed sections', () => {
      initProductInfoAccordion($w);
      expect($w('#infoHeaderDimensions').accessibility.ariaExpanded).toBe(false);
    });

    it('sets ariaLabel on section headers', () => {
      initProductInfoAccordion($w);
      expect($w('#infoHeaderDescription').accessibility.ariaLabel).toBe('Description section');
    });
  });

  describe('initSocialShare', () => {
    it('registers click handlers for share buttons', () => {
      initSocialShare($w, state);
      expect($w('#shareFacebook').onClick).toHaveBeenCalled();
      expect($w('#sharePinterest').onClick).toHaveBeenCalled();
      expect($w('#shareEmail').onClick).toHaveBeenCalled();
      expect($w('#shareCopyLink').onClick).toHaveBeenCalled();
    });

    it('sets aria labels on share buttons', () => {
      initSocialShare($w, state);
      expect($w('#shareFacebook').accessibility.ariaLabel).toBe('Share on Facebook');
      expect($w('#sharePinterest').accessibility.ariaLabel).toBe('Share on Pinterest');
      expect($w('#shareEmail').accessibility.ariaLabel).toBe('Share via email');
      expect($w('#shareCopyLink').accessibility.ariaLabel).toBe('Copy product link');
    });

    it('returns early when product is null', () => {
      state.product = null;
      initSocialShare($w, state);
      expect($w('#shareFacebook').onClick).not.toHaveBeenCalled();
    });
  });

  describe('initDeliveryEstimate', () => {
    it('shows delivery estimate text', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryEstimate').text).toContain('Estimated delivery:');
      expect($w('#deliveryEstimate').show).toHaveBeenCalled();
    });

    it('shows white-glove note for large furniture', () => {
      state.product = { ...murphyBed, collections: ['murphy-cabinet-beds'], weight: 100 };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').text).toContain('White-glove');
    });

    it('returns early when product is null', () => {
      state.product = null;
      initDeliveryEstimate($w, state);
      expect($w('#deliveryEstimate').show).not.toHaveBeenCalled();
    });

    it('does not show white-glove note for light products', () => {
      state.product = { ...futonFrame, collections: ['casegoods-accessories'], weight: 10 };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').show).not.toHaveBeenCalled();
    });

    it('registers zip input button click handler', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipBtn').onClick).toHaveBeenCalled();
    });

    it('sets aria label on zip input', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipInput').accessibility.ariaLabel).toContain('zip code');
    });

    it('registers Enter key handler on zip input', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipInput').onKeyPress).toHaveBeenCalled();
    });
  });

  describe('injectProductSchema', () => {
    it('posts product schema to HTML element', async () => {
      await injectProductSchema($w, state);
      expect($w('#productSchemaHtml').postMessage).toHaveBeenCalledWith('{"@type":"Product"}');
    });

    it('posts OG tags when available', async () => {
      await injectProductSchema($w, state);
      expect($w('#productOgHtml').postMessage).toHaveBeenCalled();
    });

    it('returns early when product is null', async () => {
      state.product = null;
      await injectProductSchema($w, state);
      expect($w('#productSchemaHtml').postMessage).not.toHaveBeenCalled();
    });

    it('does not post FAQ schema when null', async () => {
      await injectProductSchema($w, state);
      // Default mock returns null for FAQ — should not throw
      expect($w('#productFaqSchemaHtml').postMessage).not.toHaveBeenCalled();
    });

    it('posts FAQ schema when available', async () => {
      const { getProductFaqSchema } = await import('backend/seoHelpers.web');
      getProductFaqSchema.mockResolvedValueOnce('{"@type":"FAQPage"}');
      await injectProductSchema($w, state);
      expect($w('#productFaqSchemaHtml').postMessage).toHaveBeenCalledWith('{"@type":"FAQPage"}');
    });

    it('does not throw when schema is null', async () => {
      const { getProductSchema } = await import('backend/seoHelpers.web');
      getProductSchema.mockResolvedValueOnce(null);
      await expect(injectProductSchema($w, state)).resolves.toBeUndefined();
    });
  });

  describe('initSwatchRequest', () => {
    it('hides button when product has no fabric options', () => {
      state.product.productOptions = [{ name: 'Size', choices: [] }];
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').hide).toHaveBeenCalled();
    });

    it('shows button when product has fabric options', () => {
      state.product.productOptions = [{ name: 'Finish', choices: [{ value: 'Natural' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').show).toHaveBeenCalled();
    });

    it('returns early when product is null', () => {
      state.product = null;
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').show).not.toHaveBeenCalled();
      expect($w('#swatchRequestBtn').hide).not.toHaveBeenCalled();
    });

    it('registers click handler to open swatch modal', () => {
      state.product.productOptions = [{ name: 'Fabric', choices: [{ value: 'Canvas' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').onClick).toHaveBeenCalled();
    });

    it('registers submit handler on swatchSubmit button', () => {
      state.product.productOptions = [{ name: 'Cover', choices: [{ value: 'Denim' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchSubmit').onClick).toHaveBeenCalled();
    });

    it('hides swatch modal initially', () => {
      state.product.productOptions = [{ name: 'Color', choices: [{ value: 'Red' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchModal').hide).toHaveBeenCalled();
    });

    it('matches fabric option case-insensitively', () => {
      state.product.productOptions = [{ name: 'FINISH', choices: [{ value: 'Oak' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').show).toHaveBeenCalled();
    });

    it('hides button when product only has size options', () => {
      state.product.productOptions = [{ name: 'Size', choices: [{ value: 'Full' }, { value: 'Queen' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').hide).toHaveBeenCalled();
    });
  });

  describe('initSwatchCTA', () => {
    it('shows CTA button with "Get Free Swatches" for fabric products', () => {
      state.product.productOptions = [{ name: 'Fabric', choices: [{ value: 'Canvas' }] }];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').label).toBe('Get Free Swatches');
      expect($w('#swatchCTABtn').show).toHaveBeenCalled();
    });

    it('shows "Request Free Swatches" for non-fabric products', () => {
      state.product.productOptions = [{ name: 'Size', choices: [] }];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').label).toBe('Request Free Swatches');
    });

    it('returns early when product is null', () => {
      state.product = null;
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').show).not.toHaveBeenCalled();
    });

    it('registers click handler on CTA button', () => {
      state.product.productOptions = [{ name: 'Finish', choices: [{ value: 'Oak' }] }];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').onClick).toHaveBeenCalled();
    });

    it('sets accessibility ariaLabel', () => {
      state.product.productOptions = [];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').accessibility.ariaLabel).toContain('fabric swatches');
    });

    it('applies sunsetCoral background color', () => {
      state.product.productOptions = [];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').style.backgroundColor).toBe('#E8845C');
    });

    it('does nothing when state has no product key', () => {
      initSwatchCTA($w, {});
      expect($w('#swatchCTABtn').show).not.toHaveBeenCalled();
    });
  });

  // ── initBreadcrumbs — extended ─────────────────────────────

  describe('initBreadcrumbs (extended)', () => {
    it('handles murphy bed category breadcrumb', async () => {
      state.product = { ...futonFrame, collections: ['murphy-cabinet-beds'], name: 'Murphy Bed' };
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb2').text).toBe('Murphy Cabinet Beds');
    });
  });

  // ── initProductInfoAccordion — extended ────────────────────

  describe('initProductInfoAccordion (extended)', () => {
    it('keyboard Space key toggles section', () => {
      initProductInfoAccordion($w);
      const keyHandler = $w('#infoHeaderDimensions').onKeyPress.mock.calls[0][0];
      keyHandler({ key: ' ' });
      expect($w('#infoContentDimensions').expand).toHaveBeenCalled();
    });

    it('ignores non-Enter/Space key presses', () => {
      initProductInfoAccordion($w);
      const expandBefore = $w('#infoContentDimensions').expand.mock.calls.length;
      const keyHandler = $w('#infoHeaderDimensions').onKeyPress.mock.calls[0][0];
      keyHandler({ key: 'Tab' });
      expect($w('#infoContentDimensions').expand.mock.calls.length).toBe(expandBefore);
    });

    it('shipping text mentions white-glove delivery pricing', () => {
      initProductInfoAccordion($w);
      expect($w('#infoContentShipping').text).toContain('$149 local');
      expect($w('#infoContentShipping').text).toContain('$249 regional');
    });

    it('shipping text includes phone number', () => {
      initProductInfoAccordion($w);
      expect($w('#infoContentShipping').text).toContain('(828) 252-9449');
    });

    it('toggles ariaExpanded on click', () => {
      initProductInfoAccordion($w);
      const handler = $w('#infoHeaderDescription').onClick.mock.calls[0][0];
      handler(); // collapse Description
      expect($w('#infoHeaderDescription').accessibility.ariaExpanded).toBe(false);
    });
  });

  // ── initDeliveryEstimate — extended ────────────────────────

  describe('initDeliveryEstimate (extended)', () => {
    it('shows white-glove for platform bed collections', () => {
      state.product = { ...futonFrame, collections: ['platform-beds'], weight: 80 };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').text).toContain('White-glove');
      expect($w('#whiteGloveNote').show).toHaveBeenCalled();
    });

    it('zip button calls estimateDelivery for valid zip', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '28801';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(estimateDelivery).toHaveBeenCalledWith('28801', state.product);
    });

    it('shows error for invalid short zip code', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '123';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#deliveryEstimateError').text).toContain('valid 5-digit');
    });

    it('shows error for empty zip code', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#deliveryEstimateError').text).toContain('valid 5-digit');
    });

    it('strips non-numeric characters from zip input', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '28-801';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(estimateDelivery).toHaveBeenCalledWith('28801', state.product);
    });

    it('updates delivery estimate text from result', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '28801';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#deliveryEstimate').text).toBe('Delivered by Mar 25 – Mar 30');
    });

    it('shows error when estimateDelivery fails', async () => {
      estimateDelivery.mockResolvedValueOnce({ success: false, error: 'Service unavailable' });
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '90210';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#deliveryEstimateError').text).toContain('Service unavailable');
    });

    it('shows white-glove text from estimateDelivery result', async () => {
      estimateDelivery.mockResolvedValueOnce({
        success: true,
        deliveryText: 'Delivered by Mar 22 – Mar 27',
        shippingText: 'Free shipping',
        whiteGloveText: 'White-glove delivery: $149',
      });
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '28801';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#whiteGloveNote').text).toBe('White-glove delivery: $149');
    });

    it('Enter key on zip input triggers estimate', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '28801';
      const keyHandler = $w('#deliveryZipInput').onKeyPress.mock.calls[0][0];
      await keyHandler({ key: 'Enter' });
      expect(estimateDelivery).toHaveBeenCalled();
    });

    it('sets aria label on zip button', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipBtn').accessibility.ariaLabel).toContain('delivery estimate');
    });
  });

  // ── initSwatchRequest — extended ───────────────────────────

  describe('initSwatchRequest (extended)', () => {
    it('detects Cover as swatch-eligible option name', () => {
      state.product.productOptions = [{ name: 'Cover Style', choices: [{ value: 'Linen' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').show).toHaveBeenCalled();
    });

    it('hides button when productOptions is undefined', () => {
      state.product.productOptions = undefined;
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').hide).toHaveBeenCalled();
    });
  });
});
