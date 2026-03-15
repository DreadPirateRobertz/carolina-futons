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

import { initBreadcrumbs, initProductInfoAccordion, initSocialShare, initDeliveryEstimate, injectProductSchema, initSwatchRequest, initSwatchCTA } from '../src/public/ProductDetails.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    style: { color: '' },
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(), onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onKeyPress: vi.fn(), postMessage: vi.fn(), forEachItem: vi.fn(), focus: vi.fn(),
    accessibility: {},
    productOptions: [],
    disable: vi.fn(), enable: vi.fn(),
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

    it('defaults to Shop category when collections is undefined', async () => {
      state.product = { ...futonFrame, collections: undefined };
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb2').text).toBe('Shop');
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

    it('sets minus sign on expanded Description arrow', () => {
      initProductInfoAccordion($w);
      expect($w('#infoArrowDescription').text).toBe('\u2212');
    });

    it('sets plus sign on collapsed section arrows', () => {
      initProductInfoAccordion($w);
      expect($w('#infoArrowDimensions').text).toBe('+');
      expect($w('#infoArrowCare').text).toBe('+');
    });

    it('sets aria-expanded true on Description header', () => {
      initProductInfoAccordion($w);
      expect($w('#infoHeaderDescription').accessibility.ariaExpanded).toBe(true);
    });

    it('sets aria-expanded false on collapsed headers', () => {
      initProductInfoAccordion($w);
      expect($w('#infoHeaderDimensions').accessibility.ariaExpanded).toBe(false);
    });

    it('toggles section on header click', () => {
      initProductInfoAccordion($w);
      // Get the click handler registered on Dimensions header
      const clickHandler = $w('#infoHeaderDimensions').onClick.mock.calls[0][0];
      // First click expands
      clickHandler();
      expect($w('#infoContentDimensions').expand).toHaveBeenCalled();
      expect($w('#infoArrowDimensions').text).toBe('\u2212');
      // Second click collapses
      clickHandler();
      expect($w('#infoContentDimensions').collapse).toHaveBeenCalledTimes(2); // initial + toggle
      expect($w('#infoArrowDimensions').text).toBe('+');
    });

    it('registers keyboard handler on section headers', () => {
      initProductInfoAccordion($w);
      expect($w('#infoHeaderDescription').onKeyPress).toHaveBeenCalled();
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

    it('does nothing when product is null', () => {
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

    it('does not show white-glove for lightweight accessories', () => {
      state.product = { ...futonFrame, collections: ['accessories'], weight: 5 };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').show).not.toHaveBeenCalled();
    });

    it('registers zip code button click handler', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipBtn').onClick).toHaveBeenCalled();
    });

    it('registers zip code Enter key handler', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipInput').onKeyPress).toHaveBeenCalled();
    });

    it('returns early when product is null', () => {
      state.product = null;
      initDeliveryEstimate($w, state);
      expect($w('#deliveryEstimate').show).not.toHaveBeenCalled();
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

    it('does not post FAQ schema when it returns null', async () => {
      await injectProductSchema($w, state);
      expect($w('#productFaqSchemaHtml').postMessage).not.toHaveBeenCalled();
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

    it('matches Color option name', () => {
      state.product.productOptions = [{ name: 'Color', choices: [{ value: 'Red' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').show).toHaveBeenCalled();
    });

    it('matches Cover option name', () => {
      state.product.productOptions = [{ name: 'Cover', choices: [{ value: 'Suede' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').show).toHaveBeenCalled();
    });

    it('registers onClick handler on swatch request button', () => {
      state.product.productOptions = [{ name: 'Finish', choices: [{ value: 'Natural' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').onClick).toHaveBeenCalled();
    });

    it('registers onClick handler on swatchSubmit button', () => {
      state.product.productOptions = [{ name: 'Finish', choices: [{ value: 'Natural' }] }];
      initSwatchRequest($w, state);
      expect($w('#swatchSubmit').onClick).toHaveBeenCalled();
    });

    it('returns early when product is null', () => {
      state.product = null;
      initSwatchRequest($w, state);
      expect($w('#swatchRequestBtn').show).not.toHaveBeenCalled();
      expect($w('#swatchRequestBtn').hide).not.toHaveBeenCalled();
    });
  });

  describe('initSwatchCTA', () => {
    it('shows button with "Get Free Swatches" for fabric-option products', () => {
      state.product.productOptions = [{ name: 'Fabric', choices: [{ value: 'Linen' }] }];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').label).toBe('Get Free Swatches');
      expect($w('#swatchCTABtn').show).toHaveBeenCalled();
    });

    it('shows button with "Request Free Swatches" for non-fabric products', () => {
      state.product.productOptions = [{ name: 'Size', choices: [{ value: 'Full' }] }];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').label).toBe('Request Free Swatches');
    });

    it('sets brand styling on CTA button', () => {
      state.product.productOptions = [{ name: 'Finish', choices: [] }];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').style.backgroundColor).toBeTruthy();
    });

    it('sets accessibility label on CTA button', () => {
      state.product.productOptions = [{ name: 'Finish', choices: [] }];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').accessibility.ariaLabel).toContain('free fabric swatches');
    });

    it('registers onClick handler', () => {
      state.product.productOptions = [{ name: 'Finish', choices: [] }];
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').onClick).toHaveBeenCalled();
    });

    it('returns early when product is null', () => {
      state.product = null;
      initSwatchCTA($w, state);
      expect($w('#swatchCTABtn').show).not.toHaveBeenCalled();
    });
  });
});
