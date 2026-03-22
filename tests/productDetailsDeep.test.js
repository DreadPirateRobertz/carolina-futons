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
    r.setDate(r.getDate() + days + 2);
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

vi.mock('backend/deliveryEstimator.web', () => ({
  getDeliveryEstimate: vi.fn().mockResolvedValue({
    success: true,
    estimate: '5-7 business days',
    minDays: 5,
    maxDays: 7,
    minDate: '2026-04-01',
    maxDate: '2026-04-05',
    source: 'ups',
    service: 'UPS Ground',
  }),
}));

vi.mock('public/validators.js', () => ({
  validateEmail: vi.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
}));

import {
  initBreadcrumbs, initProductInfoAccordion, initSocialShare,
  initDeliveryEstimate, injectProductSchema, initSwatchRequest, initSwatchCTA,
} from '../src/public/ProductDetails.js';
import { submitSwatchRequest } from 'backend/emailService.web';
import { getDeliveryEstimate } from 'backend/deliveryEstimator.web';
import { trackSocialShare } from 'public/engagementTracker';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    style: { color: '', backgroundColor: '', animation: '' },
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(), onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), postMessage: vi.fn(), forEachItem: vi.fn(),
    onKeyPress: vi.fn(), onInput: vi.fn(),
    accessibility: {},
    productOptions: [],
    disable: vi.fn(), enable: vi.fn(),
    focus: vi.fn(),
    checked: false,
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

describe('ProductDetails — deep coverage', () => {
  let $w, state;
  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    state = { product: { ...futonFrame, collections: ['futon-frames'], _id: 'prod-1', slug: 'test-futon', mainMedia: 'img.jpg', productOptions: [] } };
  });

  // ── openSwatchModal (triggered via initSwatchRequest btn click) ──

  describe('swatch modal flow', () => {
    beforeEach(() => {
      state.product.productOptions = [
        { name: 'Finish', choices: [
          { value: 'Natural', description: 'Natural Oak' },
          { value: 'Walnut', description: 'Dark Walnut' },
        ]},
      ];
    });

    it('opens modal on swatchRequestBtn click', () => {
      initSwatchRequest($w, state);
      const clickHandler = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect($w('#swatchModal').show).toHaveBeenCalledWith('fade', { duration: 200 });
    });

    it('sets product name in modal', () => {
      initSwatchRequest($w, state);
      const clickHandler = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect($w('#swatchProductName').text).toBe(state.product.name);
    });

    it('populates swatch options repeater with matching choices', () => {
      initSwatchRequest($w, state);
      const clickHandler = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect($w('#swatchOptions').data).toHaveLength(2);
      expect($w('#swatchOptions').data[0].label).toBe('Natural Oak');
      expect($w('#swatchOptions').data[1].label).toBe('Dark Walnut');
    });

    it('sets onItemReady for swatch checkbox labels', () => {
      initSwatchRequest($w, state);
      const clickHandler = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect($w('#swatchOptions').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets checkbox label and unchecked state', () => {
      initSwatchRequest($w, state);
      const clickHandler = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickHandler();
      const itemReady = $w('#swatchOptions').onItemReady.mock.calls[0][0];
      const $item = create$w();
      itemReady($item, { label: 'Natural Oak', checked: false });
      expect($item('#swatchCheckbox').label).toBe('Natural Oak');
      expect($item('#swatchCheckbox').checked).toBe(false);
    });

    it('clears form fields on modal open', () => {
      $w('#swatchName').value = 'Old Value';
      $w('#swatchEmail').value = 'old@test.com';
      $w('#swatchAddress').value = '123 Old St';
      initSwatchRequest($w, state);
      const clickHandler = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect($w('#swatchName').value).toBe('');
      expect($w('#swatchEmail').value).toBe('');
      expect($w('#swatchAddress').value).toBe('');
    });

    it('hides success message on modal open', () => {
      initSwatchRequest($w, state);
      const clickHandler = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect($w('#swatchSuccess').hide).toHaveBeenCalled();
    });

    it('uses choice.value as fallback description', () => {
      state.product.productOptions = [
        { name: 'Color', choices: [{ value: 'Red' }] },
      ];
      initSwatchRequest($w, state);
      const clickHandler = $w('#swatchRequestBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect($w('#swatchOptions').data[0].label).toBe('Red');
    });
  });

  // ── handleSwatchSubmit ──

  describe('swatch submit flow', () => {
    beforeEach(() => {
      state.product.productOptions = [
        { name: 'Finish', choices: [{ value: 'Natural', description: 'Natural Oak' }] },
      ];
    });

    it('returns early when name is empty', async () => {
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = '';
      $w('#swatchEmail').value = 'test@example.com';
      $w('#swatchAddress').value = '123 Main St';
      await submitHandler();
      expect(submitSwatchRequest).not.toHaveBeenCalled();
    });

    it('returns early when address is empty', async () => {
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = 'John';
      $w('#swatchEmail').value = 'test@example.com';
      $w('#swatchAddress').value = '';
      await submitHandler();
      expect(submitSwatchRequest).not.toHaveBeenCalled();
    });

    it('shows error for invalid email', async () => {
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = 'John';
      $w('#swatchEmail').value = 'invalid-email';
      $w('#swatchAddress').value = '123 Main St';
      await submitHandler();
      expect($w('#swatchError').text).toBe('Please enter a valid email address.');
      expect($w('#swatchError').show).toHaveBeenCalled();
    });

    it('shows error for empty email', async () => {
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = 'John';
      $w('#swatchEmail').value = '';
      $w('#swatchAddress').value = '123 Main St';
      await submitHandler();
      expect($w('#swatchError').text).toBe('Please enter a valid email address.');
    });

    it('returns early when no swatches are checked', async () => {
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = 'John';
      $w('#swatchEmail').value = 'test@example.com';
      $w('#swatchAddress').value = '123 Main St';
      // forEachItem doesn't check any checkboxes
      $w('#swatchOptions').forEachItem.mockImplementation(() => {});
      await submitHandler();
      expect(submitSwatchRequest).not.toHaveBeenCalled();
    });

    it('submits with checked swatches', async () => {
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = 'John Doe';
      $w('#swatchEmail').value = 'john@example.com';
      $w('#swatchAddress').value = '456 Elm St, Asheville NC 28801';

      // Mock forEachItem to simulate checked swatches
      $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
        const $item = create$w();
        $item('#swatchCheckbox').checked = true;
        cb($item, { label: 'Natural Oak' });
      });

      await submitHandler();
      expect(submitSwatchRequest).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        address: '456 Elm St, Asheville NC 28801',
        productId: state.product._id,
        productName: state.product.name,
        swatchNames: ['Natural Oak'],
      });
    });

    it('disables submit button during submission', async () => {
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = 'John';
      $w('#swatchEmail').value = 'john@example.com';
      $w('#swatchAddress').value = '123 Main St';
      $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
        const $item = create$w();
        $item('#swatchCheckbox').checked = true;
        cb($item, { label: 'Oak' });
      });
      await submitHandler();
      expect($w('#swatchSubmit').disable).toHaveBeenCalled();
    });

    it('shows success message after submission', async () => {
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = 'John';
      $w('#swatchEmail').value = 'john@example.com';
      $w('#swatchAddress').value = '123 Main St';
      $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
        const $item = create$w();
        $item('#swatchCheckbox').checked = true;
        cb($item, { label: 'Oak' });
      });
      await submitHandler();
      expect($w('#swatchSuccess').show).toHaveBeenCalled();
    });

    it('shows error on submitSwatchRequest failure', async () => {
      submitSwatchRequest.mockRejectedValueOnce(new Error('Server error'));
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = 'John';
      $w('#swatchEmail').value = 'john@example.com';
      $w('#swatchAddress').value = '123 Main St';
      $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
        const $item = create$w();
        $item('#swatchCheckbox').checked = true;
        cb($item, { label: 'Oak' });
      });
      await submitHandler();
      expect($w('#swatchError').text).toContain('Something went wrong');
      expect($w('#swatchSubmit').enable).toHaveBeenCalled();
    });

    it('trims whitespace from form fields', async () => {
      initSwatchRequest($w, state);
      const submitHandler = $w('#swatchSubmit').onClick.mock.calls[0][0];
      $w('#swatchName').value = '  John  ';
      $w('#swatchEmail').value = '  john@example.com  ';
      $w('#swatchAddress').value = '  123 Main  ';
      $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
        const $item = create$w();
        $item('#swatchCheckbox').checked = true;
        cb($item, { label: 'Oak' });
      });
      await submitHandler();
      expect(submitSwatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John',
          email: 'john@example.com',
          address: '123 Main',
        })
      );
    });
  });

  // ── Social share click handlers ──

  describe('social share click execution', () => {
    it('tracks facebook share on click', () => {
      initSocialShare($w, state);
      const clickHandler = $w('#shareFacebook').onClick.mock.calls[0][0];
      clickHandler();
      expect(trackSocialShare).toHaveBeenCalledWith('facebook', 'product', state.product._id);
    });

    it('tracks pinterest share on click', () => {
      initSocialShare($w, state);
      const clickHandler = $w('#sharePinterest').onClick.mock.calls[0][0];
      clickHandler();
      expect(trackSocialShare).toHaveBeenCalledWith('pinterest', 'product', state.product._id);
    });

    it('tracks email share on click', () => {
      initSocialShare($w, state);
      const clickHandler = $w('#shareEmail').onClick.mock.calls[0][0];
      clickHandler();
      expect(trackSocialShare).toHaveBeenCalledWith('email', 'product', state.product._id);
    });

    it('tracks copy_link share on click', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      initSocialShare($w, state);
      const clickHandler = $w('#shareCopyLink').onClick.mock.calls[0][0];
      clickHandler();
      expect(trackSocialShare).toHaveBeenCalledWith('copy_link', 'product', state.product._id);
      vi.unstubAllGlobals();
    });

    it('copies URL to clipboard and changes label', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      initSocialShare($w, state);
      const clickHandler = $w('#shareCopyLink').onClick.mock.calls[0][0];
      clickHandler();
      await new Promise(r => setTimeout(r, 10));
      expect(writeText).toHaveBeenCalledWith(
        `https://www.carolinafutons.com/product-page/${state.product.slug}`
      );
      expect($w('#shareCopyLink').label).toBe('Copied!');
      vi.unstubAllGlobals();
    });

    it('handles missing product._id gracefully', () => {
      state.product._id = undefined;
      initSocialShare($w, state);
      const clickHandler = $w('#shareFacebook').onClick.mock.calls[0][0];
      clickHandler();
      expect(trackSocialShare).toHaveBeenCalledWith('facebook', 'product', '');
    });
  });

  // ── Delivery estimate — hide white-glove when null ──

  describe('delivery estimate zip — UPS response handling', () => {
    it('shows deliveryEstimateText and deliveryEstimateBox on success', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '10001';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#deliveryEstimateText').text).toContain('Estimated delivery:');
      expect($w('#deliveryEstimateBox').show).toHaveBeenCalled();
    });

    it('formats estimate text from minDate/maxDate when UPS responds', async () => {
      getDeliveryEstimate.mockResolvedValueOnce({
        success: true, estimate: '5-7 business days', minDays: 5, maxDays: 7,
        minDate: '2026-04-01', maxDate: '2026-04-05', source: 'ups', service: 'UPS Ground',
      });
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '10001';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#deliveryEstimateText').text).toContain('Estimated delivery:');
    });

    it('hides error on valid zip before fetching', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '28801';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#deliveryEstimateError').hide).toHaveBeenCalled();
    });

    it('handles null rawZip gracefully', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = null;
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#deliveryEstimateError').text).toContain('valid 5-digit');
    });

    it('truncates zip to 5 digits', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '288011234';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getDeliveryEstimate).toHaveBeenCalledWith('28801', [state.product._id]);
    });

    it('shows default error message when getDeliveryEstimate returns no error field', async () => {
      getDeliveryEstimate.mockResolvedValueOnce({ success: false });
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '90210';
      const clickHandler = $w('#deliveryZipBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#deliveryEstimateError').text).toBe('Unable to estimate delivery');
    });
  });

  // ── Delivery estimate — deliveryZipSubmit button ──

  describe('delivery zip submit button', () => {
    it('binds deliveryZipSubmit button when it exists', () => {
      initDeliveryEstimate($w, state);
      expect($w('#deliveryZipSubmit').onClick).toHaveBeenCalled();
    });

    it('deliveryZipSubmit triggers getDeliveryEstimate', async () => {
      initDeliveryEstimate($w, state);
      $w('#deliveryZipInput').value = '28801';
      const clickHandler = $w('#deliveryZipSubmit').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getDeliveryEstimate).toHaveBeenCalledWith('28801', [state.product._id]);
    });
  });

  // ── Breadcrumb edge cases ──

  describe('breadcrumbs edge cases', () => {
    it('uses Shop category for unknown collections', async () => {
      state.product.collections = ['accessories-stuff'];
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb2').text).toBe('Shop');
    });

    it('handles product with no collections', async () => {
      state.product.collections = undefined;
      await initBreadcrumbs($w, state);
      expect($w('#breadcrumb2').text).toBe('Shop');
    });
  });

  // ── initDeliveryEstimate — missing element guard ──

  describe('delivery estimate missing elements', () => {
    it('does not throw when deliveryEstimateBox element is missing', () => {
      const nullW = (sel) => {
        if (sel === '#deliveryEstimateBox') return null;
        return create$w()(sel);
      };
      expect(() => initDeliveryEstimate(nullW, state)).not.toThrow();
    });

    it('returns early when product is null', () => {
      state.product = null;
      initDeliveryEstimate($w, state);
      expect($w('#deliveryEstimateBox').show).not.toHaveBeenCalled();
    });
  });

  // ── Accordion keyboard Enter key ──

  describe('accordion keyboard toggle', () => {
    it('Enter key toggles Dimensions section', () => {
      initProductInfoAccordion($w);
      const keyHandler = $w('#infoHeaderDimensions').onKeyPress.mock.calls[0][0];
      keyHandler({ key: 'Enter' });
      expect($w('#infoContentDimensions').expand).toHaveBeenCalled();
    });

    it('does not toggle on Tab key', () => {
      initProductInfoAccordion($w);
      const expandBefore = $w('#infoContentDimensions').expand.mock.calls.length;
      const keyHandler = $w('#infoHeaderDimensions').onKeyPress.mock.calls[0][0];
      keyHandler({ key: 'Tab' });
      expect($w('#infoContentDimensions').expand.mock.calls.length).toBe(expandBefore);
    });

    it('toggles all 4 sections independently', () => {
      initProductInfoAccordion($w);
      const sections = ['Description', 'Dimensions', 'Care', 'Shipping'];
      for (const section of sections) {
        const handler = $w(`#infoHeader${section}`).onClick.mock.calls[0][0];
        handler();
      }
      // Description was open, now closed; others were closed, now open
      expect($w('#infoArrowDescription').text).toBe('+');
      expect($w('#infoArrowDimensions').text).toBe('\u2212');
      expect($w('#infoArrowCare').text).toBe('\u2212');
      expect($w('#infoArrowShipping').text).toBe('\u2212');
    });
  });

  // ── injectProductSchema edge cases ──

  describe('injectProductSchema edge cases', () => {
    it('handles all three schemas being non-null', async () => {
      const { getProductFaqSchema, getProductOgTags } = await import('backend/seoHelpers.web');
      getProductFaqSchema.mockResolvedValueOnce('{"@type":"FAQPage"}');
      getProductOgTags.mockResolvedValueOnce('<meta og:type>');
      await injectProductSchema($w, state);
      expect($w('#productSchemaHtml').postMessage).toHaveBeenCalled();
      expect($w('#productFaqSchemaHtml').postMessage).toHaveBeenCalledWith('{"@type":"FAQPage"}');
      expect($w('#productOgHtml').postMessage).toHaveBeenCalledWith('<meta og:type>');
    });

    it('handles getProductSchema throwing', async () => {
      const { getProductSchema } = await import('backend/seoHelpers.web');
      getProductSchema.mockRejectedValueOnce(new Error('Backend error'));
      await expect(injectProductSchema($w, state)).resolves.toBeUndefined();
    });
  });

  // ── initSwatchCTA — CTA opens modal ──

  describe('swatch CTA triggers modal', () => {
    it('CTA button click opens swatch modal', () => {
      state.product.productOptions = [{ name: 'Finish', choices: [{ value: 'Oak' }] }];
      initSwatchCTA($w, state);
      const clickHandler = $w('#swatchCTABtn').onClick.mock.calls[0][0];
      clickHandler();
      expect($w('#swatchModal').show).toHaveBeenCalled();
    });
  });

  // ── White-glove for frame collections ──

  describe('white-glove collection matching', () => {
    it('shows white-glove for products with "frame" in collections', () => {
      state.product = { ...futonFrame, collections: ['bed-frames'], weight: 60 };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').text).toContain('White-glove');
    });

    it('does not show white-glove for light casegoods', () => {
      state.product = { ...futonFrame, collections: ['casegoods'], weight: 10 };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').show).not.toHaveBeenCalled();
    });

    it('shows white-glove based on weight alone (> 50)', () => {
      state.product = { ...futonFrame, collections: ['accessories'], weight: 75 };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').text).toContain('White-glove');
    });

    it('does not show white-glove for exactly 50 lb item', () => {
      state.product = { ...futonFrame, collections: ['accessories'], weight: 50 };
      initDeliveryEstimate($w, state);
      expect($w('#whiteGloveNote').show).not.toHaveBeenCalled();
    });
  });
});
