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

import { initBreadcrumbs, initProductInfoAccordion, initSocialShare, initDeliveryEstimate, injectProductSchema, initSwatchRequest } from '../src/public/ProductDetails.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    style: { color: '' },
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(), onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), postMessage: vi.fn(), forEachItem: vi.fn(),
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
  });
});
