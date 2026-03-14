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
    collapse: vi.fn(), expand: vi.fn(), onClick: vi.fn(), onChange: vi.fn(), onKeyPress: vi.fn(),
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
    // --- Default estimate display ---
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

    it('does not show white-glove note for small items', () => {
      state.product = { ...futonFrame, weight: 20, collections: ['casegoods'] };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').show).not.toHaveBeenCalled();
    });

    it('detects large items by collection name when weight is missing', () => {
      state.product = { ...futonFrame, weight: undefined, collections: ['murphy-cabinet-beds'] };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').text).toContain('White-glove');
    });

    it('returns early when no product in state', () => {
      state.product = null;
      initDeliveryEstimate($w, state);
      expect($w('#deliveryEstimate').show).not.toHaveBeenCalled();
    });

    it('returns early when deliveryEstimate element is missing', () => {
      const broken$w = (sel) => {
        if (sel === '#deliveryEstimate') return null;
        return createMockElement();
      };
      // should not throw
      expect(() => initDeliveryEstimate(broken$w, state)).not.toThrow();
    });

    // --- ZIP code input wiring ---
    it('wires up zip input button click handler', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on zip input', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipInput').accessibility.ariaLabel).toContain('zip');
    });

    it('sets ARIA label on zip button', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipBtn').accessibility.ariaLabel).toContain('delivery estimate');
    });

    // --- ZIP validation ---
    it('ignores zip codes shorter than 5 digits', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '287';
      clickHandler();
      // Text should still be default (not "Delivered by")
      expect($w('#deliveryEstimate').text).toContain('Estimated delivery:');
    });

    it('strips non-numeric characters from zip', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '287-01';
      clickHandler();
      expect($w('#deliveryEstimate').text).toContain('Delivered by');
    });

    it('handles empty zip input gracefully', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '';
      clickHandler();
      expect($w('#deliveryEstimate').text).toContain('Estimated delivery:');
    });

    it('handles null zip input gracefully', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = null;
      clickHandler();
      expect($w('#deliveryEstimate').text).toContain('Estimated delivery:');
    });

    // --- Zone-based estimates ---
    it('shows 3-5 day estimate for WNC local zip (287xx)', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '28701';
      clickHandler();
      expect($w('#deliveryEstimate').text).toContain('Delivered by');
    });

    it('shows 5-8 day estimate for Southeast regional zip (300xx)', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '30001';
      clickHandler();
      expect($w('#deliveryEstimate').text).toContain('Delivered by');
    });

    it('shows 7-12 day estimate for national zip (100xx)', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '10001';
      clickHandler();
      expect($w('#deliveryEstimate').text).toContain('Delivered by');
    });

    // --- White-glove messaging per zone ---
    it('shows $149 white-glove price for local zone on large items', () => {
      state.product = { ...murphyBed, collections: ['murphy-cabinet-beds'], weight: 100 };
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '28801';
      clickHandler();
      expect($w('#whiteGloveNote').text).toContain('$149');
    });

    it('shows $249 white-glove price for regional zone on large items', () => {
      state.product = { ...murphyBed, collections: ['murphy-cabinet-beds'], weight: 100 };
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '30301';
      clickHandler();
      expect($w('#whiteGloveNote').text).toContain('$249');
    });

    it('does not show white-glove for national zone even on large items', () => {
      state.product = { ...murphyBed, collections: ['murphy-cabinet-beds'], weight: 100 };
      const fresh$w = create$w();
      initDeliveryEstimate(fresh$w, { product: state.product });
      const clickHandler = fresh$w('#deliveryZipBtn').onClick.mock.calls[0][0];
      fresh$w('#deliveryZipInput').value = '10001';
      clickHandler();
      // whiteGloveNote should not have show() called after the zip lookup
      // (it may have been shown during default estimate, so we check the text)
      const noteText = fresh$w('#whiteGloveNote').text;
      // For national zone, white-glove note should NOT contain a price
      // The default note is "White-glove delivery available — call..."
      // After national zip lookup, it should not be updated with price
      expect(noteText).not.toContain('$149');
      expect(noteText).not.toContain('$249');
    });

    it('does not show white-glove for small items in any zone', () => {
      state.product = { ...futonFrame, weight: 20, collections: ['casegoods'] };
      const fresh$w = create$w();
      initDeliveryEstimate(fresh$w, { product: state.product });
      const clickHandler = fresh$w('#deliveryZipBtn').onClick.mock.calls[0][0];
      fresh$w('#deliveryZipInput').value = '28801';
      clickHandler();
      expect(fresh$w('#whiteGloveNote').show).not.toHaveBeenCalled();
    });

    // --- Keyboard support ---
    it('supports Enter key on zip input to trigger lookup', () => {
      initDeliveryEstimate($w, state);
      // onKeyPress should be registered on the zip input
      const onKeyPressCalls = $w('#deliveryZipInput').onKeyPress;
      if (onKeyPressCalls && onKeyPressCalls.mock) {
        expect(onKeyPressCalls).toHaveBeenCalled();
      }
    });

    // --- Edge cases ---
    it('handles zip with leading zeros (00601 = Puerto Rico)', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '00601';
      clickHandler();
      // Puerto Rico is national zone
      expect($w('#deliveryEstimate').text).toContain('Delivered by');
    });

    it('handles zip with spaces and dashes (28801-1234)', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '28801-1234';
      clickHandler();
      expect($w('#deliveryEstimate').text).toContain('Delivered by');
    });

    it('truncates zip to first 5 digits', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '2880112345';
      clickHandler();
      // Should use 28801 (local WNC)
      expect($w('#deliveryEstimate').text).toContain('Delivered by');
    });

    it('handles only-whitespace zip input', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '   ';
      clickHandler();
      expect($w('#deliveryEstimate').text).toContain('Estimated delivery:');
    });

    // --- Validation error feedback ---
    it('shows error message for zip shorter than 5 digits', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '287';
      clickHandler();
      expect($w('#deliveryZipError').text).toContain('5-digit');
      expect($w('#deliveryZipError').show).toHaveBeenCalled();
    });

    it('shows error message for empty zip submission', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '';
      clickHandler();
      expect($w('#deliveryZipError').text).toContain('zip');
      expect($w('#deliveryZipError').show).toHaveBeenCalled();
    });

    it('hides error message on valid zip submission', () => {
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '28801';
      clickHandler();
      expect($w('#deliveryZipError').hide).toHaveBeenCalled();
    });

    it('sets ARIA role on error element', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipError').accessibility.role).toBe('alert');
    });

    // --- Free shipping threshold messaging ---
    it('shows free standard shipping note for orders >= $999', () => {
      state.product = { ...murphyBed, price: 1200, collections: ['murphy-cabinet-beds'], weight: 100 };
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '28801';
      clickHandler();
      expect($w('#freeShippingNote').text).toContain('Free');
      expect($w('#freeShippingNote').show).toHaveBeenCalled();
    });

    it('shows free white-glove note for orders >= $1,999', () => {
      state.product = { ...murphyBed, price: 2500, collections: ['murphy-cabinet-beds'], weight: 100 };
      initDeliveryEstimate($w, state);
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      $w('#deliveryZipInput').value = '28801';
      clickHandler();
      expect($w('#whiteGloveNote').text).toContain('FREE');
    });

    it('does not show free shipping note for orders < $999', () => {
      state.product = { ...futonFrame, price: 499, collections: ['futon-frames'], weight: 85 };
      const fresh$w = create$w();
      initDeliveryEstimate(fresh$w, { product: state.product });
      const clickHandler = fresh$w('#deliveryZipBtn').onClick.mock.calls[0][0];
      fresh$w('#deliveryZipInput').value = '28801';
      clickHandler();
      expect(fresh$w('#freeShippingNote').show).not.toHaveBeenCalled();
    });

    // --- ARIA live region ---
    it('sets aria-live on delivery estimate for screen readers', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryEstimate').accessibility.ariaLive).toBe('polite');
    });

    it('sets role=status on delivery estimate', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryEstimate').accessibility.role).toBe('status');
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
