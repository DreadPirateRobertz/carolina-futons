import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame, wallHuggerFrame, futonMattress, murphyBed, casegoodsItem } from './fixtures/products.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────
// Product Page uses global $w for all Wix Velo element access.
// We mock $w before importing the page so onReady captures the handler.

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    options: [],
    data: [],
    style: { color: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onCurrentIndexChanged: vi.fn(),
    getCurrentItem: vi.fn(() => ({ ...futonFrame, collections: ['futon-frames'] })),
    getTotalCount: vi.fn(() => 10),
    getItems: vi.fn(() => ({ items: [] })),
    setSort: vi.fn(),
    setFilter: vi.fn(),
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

const mockRelated = [
  { ...futonMattress, _id: 'rel-1' },
  { ...casegoodsItem, _id: 'rel-2' },
];
const mockCollection = [
  { ...wallHuggerFrame, _id: 'col-1' },
];

vi.mock('public/InventoryDisplay.js', () => ({
  initInventoryDisplay: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/BrowseReminder.js', () => ({
  initBrowseTracking: vi.fn(),
  showRemindMePopup: vi.fn(),
  _createBrowseState: vi.fn(() => ({ sessionId: '', startTime: Date.now(), productsViewed: [] })),
}));

vi.mock('public/ProductPagePolish.js', () => ({
  styleReviewStars: vi.fn((rating) => {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const filled = Math.floor(r);
    const half = r - filled >= 0.5;
    const empty = 5 - filled - (half ? 1 : 0);
    return { filled, half, empty, filledColor: '#E8845C', emptyColor: '#D4BC96' };
  }),
  styleReviewCard: vi.fn(),
  applyProductPageTokens: vi.fn(),
}));

vi.mock('backend/productRecommendations.web', () => ({
  getRelatedProducts: vi.fn().mockResolvedValue(mockRelated),
  getSameCollection: vi.fn().mockResolvedValue(mockCollection),
  getBundleSuggestion: vi.fn().mockResolvedValue(null),
}));

vi.mock('public/ProductFinancing.js', () => ({
  initFinancingOptions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/ProductQA.js', () => ({
  initProductQA: vi.fn().mockResolvedValue(undefined),
}));

const mockSeoHead = {
  setTitle: vi.fn(),
  setMetaTag: vi.fn(),
  setLinks: vi.fn(),
  setStructuredData: vi.fn(),
};

vi.mock('wix-seo-frontend', () => ({
  head: mockSeoHead,
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getProductPinData: vi.fn(() => ({ success: false, meta: null })),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn().mockReturnValue('{"@context":"https://schema.org","@type":"Product"}'),
  generateAltText: vi.fn().mockResolvedValue('Eureka Futon Frame - Night & Day - Carolina Futons'),
  getBreadcrumbSchema: vi.fn().mockReturnValue('{"@context":"https://schema.org","@type":"BreadcrumbList"}'),
  getProductFaqSchema: vi.fn().mockReturnValue('{"@context":"https://schema.org","@type":"FAQPage"}'),
  getProductOgTags: vi.fn().mockReturnValue(null),
  getPageTitle: vi.fn().mockReturnValue('Eureka Futon Frame | Carolina Futons'),
  getPageMetaDescription: vi.fn().mockReturnValue('Solid hardwood futon frame.'),
  getCanonicalUrl: vi.fn().mockReturnValue('https://www.carolinafutons.com/product-page/eureka-futon-frame'),
}));

vi.mock('public/ProductVideoSection.js', () => ({
  initProductVideoSection: vi.fn().mockResolvedValue({ destroy() {} }),
}));

vi.mock('public/Product360Viewer.js', () => ({
  initProduct360Viewer: vi.fn().mockResolvedValue({ destroy() {} }),
}));

vi.mock('public/ProductQA.js', () => ({
  initProductQA: vi.fn().mockResolvedValue(undefined),
}));

// ── Import Page ─────────────────────────────────────────────────────

describe('Product Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Product Page.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('initialization', () => {
    it('accesses the product dataset and reads current product', async () => {
      await onReadyHandler();
      const dataset = getEl('#productDataset');
      expect(dataset.onReady).toHaveBeenCalled();
      expect(dataset.getCurrentItem).toHaveBeenCalled();
    });

    it('sets up variant selector dropdowns', async () => {
      await onReadyHandler();
      // sizeDropdown and finishDropdown are accessed in try/catch
      // If they exist, onChange is registered
      expect(elements.has('#sizeDropdown') || elements.has('#finishDropdown')).toBe(true);
    });

    it('initializes the image gallery', async () => {
      await onReadyHandler();
      // Gallery gets an onItemClicked handler
      expect(elements.has('#productGallery')).toBe(true);
      expect(getEl('#productGallery').onItemClicked).toHaveBeenCalled();
    });

    it('injects product structured data via wix-seo-frontend', async () => {
      await onReadyHandler();
      expect(mockSeoHead.setStructuredData).toHaveBeenCalled();
      const schemas = mockSeoHead.setStructuredData.mock.calls[0][0];
      const productSchema = schemas.find(s => s['@type'] === 'Product');
      expect(productSchema).toBeDefined();
      expect(productSchema['@context']).toBe('https://schema.org');
    });

    it('sets SEO-optimized alt text on main product image', async () => {
      await onReadyHandler();
      // generateAltText is called and result applied to mainImage
      expect(elements.has('#productMainImage')).toBe(true);
    });
  });

  // ── Related Products ──────────────────────────────────────────────

  describe('related products', () => {
    it('populates related products repeater with data', async () => {
      await onReadyHandler();
      const repeater = getEl('#relatedRepeater');
      expect(repeater.data).toEqual(mockRelated);
    });

    it('registers onItemReady for related product cards', async () => {
      await onReadyHandler();
      const repeater = getEl('#relatedRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('onItemReady populates name, price, and image', async () => {
      await onReadyHandler();
      const repeater = getEl('#relatedRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      // Create a mini mock for $item
      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, mockRelated[0]);
      expect(itemElements['#relatedImage'].src).toBe(mockRelated[0].mainMedia);
      expect(itemElements['#relatedName'].text).toBe(mockRelated[0].name);
      expect(itemElements['#relatedPrice'].text).toBe(mockRelated[0].formattedPrice);
    });
  });

  // ── Same Collection Products ──────────────────────────────────────

  describe('same collection products', () => {
    it('populates collection repeater with data', async () => {
      await onReadyHandler();
      const repeater = getEl('#collectionRepeater');
      expect(repeater.data).toEqual(mockCollection);
    });
  });

  // ── Breadcrumbs ───────────────────────────────────────────────────

  describe('breadcrumb generation', () => {
    it('sets Home as first breadcrumb', async () => {
      await onReadyHandler();
      expect(getEl('#breadcrumb1').text).toBe('Home');
    });

    it('sets category as second breadcrumb based on collections', async () => {
      await onReadyHandler();
      // futonFrame has collections: ['futon-frames'] → 'Futon Frames'
      expect(getEl('#breadcrumb2').text).toBe('Futon Frames');
    });

    it('sets product name as third breadcrumb', async () => {
      await onReadyHandler();
      expect(getEl('#breadcrumb3').text).toBe(futonFrame.name);
    });

    it('registers click handlers on breadcrumbs', async () => {
      await onReadyHandler();
      expect(getEl('#breadcrumb1').onClick).toHaveBeenCalled();
      expect(getEl('#breadcrumb2').onClick).toHaveBeenCalled();
    });

    it('injects breadcrumb schema via wix-seo-frontend', async () => {
      await onReadyHandler();
      expect(mockSeoHead.setStructuredData).toHaveBeenCalled();
      const schemas = mockSeoHead.setStructuredData.mock.calls[0][0];
      const breadcrumbSchema = schemas.find(s => s['@type'] === 'BreadcrumbList');
      expect(breadcrumbSchema).toBeDefined();
    });
  });

  // ── Variant Change ────────────────────────────────────────────────

  describe('variant selector', () => {
    it('registers onChange handler on size dropdown', async () => {
      await onReadyHandler();
      expect(getEl('#sizeDropdown').onChange).toHaveBeenCalled();
    });

    it('registers onChange handler on finish dropdown', async () => {
      await onReadyHandler();
      expect(getEl('#finishDropdown').onChange).toHaveBeenCalled();
    });
  });

  // ── Gallery ───────────────────────────────────────────────────────

  describe('image gallery', () => {
    it('registers onItemClicked on gallery for thumbnail switching', async () => {
      await onReadyHandler();
      expect(getEl('#productGallery').onItemClicked).toHaveBeenCalled();
    });

    it('gallery click updates main image src', async () => {
      await onReadyHandler();
      const clickCb = getEl('#productGallery').onItemClicked.mock.calls[0][0];

      // Simulate thumbnail click
      clickCb({ item: { src: 'https://example.com/thumb2.jpg' } });
      expect(getEl('#productMainImage').src).toBe('https://example.com/thumb2.jpg');
    });
  });

  // ── Add to Cart Enhancement ───────────────────────────────────────

  describe('add to cart', () => {
    it('sets up cart changed listener for success feedback', async () => {
      const wixStoresFrontend = (await import('wix-stores-frontend')).default;
      await onReadyHandler();
      expect(elements.has('#addToCartButton')).toBe(true);
    });
  });
});
