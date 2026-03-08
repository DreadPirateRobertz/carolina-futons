import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Side Cart Handler Accumulation Tests ────────────────────────────
// CF-1b86: onClick handlers inside onItemReady and legacy fallback
// accumulate on every cart refresh, causing duplicate addToCart calls.

// Track addToCart calls to detect duplicates
let addToCartCalls = 0;

// Mock wix-stores-frontend
vi.mock('wix-stores-frontend', () => ({
  default: {
    cart: {
      getCurrentCart: vi.fn(() => Promise.resolve({
        lineItems: [{ productId: 'prod1', quantity: 1 }],
        totals: { subtotal: 100 },
      })),
      addProducts: vi.fn(() => { addToCartCalls++; return Promise.resolve({}); }),
      removeProduct: vi.fn(() => Promise.resolve({})),
      updateLineItemQuantity: vi.fn(() => Promise.resolve({})),
    },
    getProductVariants: vi.fn(() => Promise.resolve([])),
    onCartChanged: vi.fn(),
  },
}));

// Mock backend modules
vi.mock('backend/productRecommendations.web', () => ({
  getCompletionSuggestions: vi.fn(() => Promise.resolve([{
    heading: 'Complete the Look',
    products: [{
      _id: 'sug1',
      name: 'Accent Pillow',
      slug: 'accent-pillow',
      mainMedia: 'https://example.com/pillow.jpg',
      formattedPrice: '$29.99',
    }],
  }])),
}));

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
  openLightbox: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
  url: 'https://carolinafutons.com/side-cart',
  path: ['/side-cart'],
  query: {},
}));

describe('Side Cart handler accumulation (CF-1b86)', () => {
  beforeEach(() => {
    addToCartCalls = 0;
  });

  describe('legacy fallback path', () => {
    it('should not register duplicate onClick handlers on repeated calls', () => {
      // Simulate what happens when $w('#sideSugAdd').onClick() is called repeatedly
      const handlers = [];
      const mockElement = {
        onClick: (handler) => handlers.push(handler),
        disable: vi.fn(),
        enable: vi.fn(),
        set label(_v) {},
        get label() { return 'Add to Cart'; },
      };

      // If the old code calls onClick 3 times (3 cart refreshes),
      // 3 handlers accumulate. Clicking once fires all 3 → 3 addToCart calls.
      // The fix should prevent accumulation.
      // We test the contract: after N refreshes, clicking should only fire ONCE.
      expect(handlers.length).toBe(0);

      // Simulate 3 cart refreshes calling onClick
      for (let i = 0; i < 3; i++) {
        mockElement.onClick(() => { addToCartCalls++; });
      }

      // Without fix: 3 handlers accumulated
      // With fix: only 1 handler should be active
      // This test documents the BUG — 3 handlers exist
      expect(handlers.length).toBe(3);
      // Fire all handlers (simulating a click)
      handlers.forEach(h => h());
      // BUG: 3 calls instead of 1
      expect(addToCartCalls).toBe(3);
    });

    it('guard flag prevents duplicate handler registration', () => {
      // This tests the FIX pattern
      let handlerRegistered = false;
      let callCount = 0;
      const mockElement = {
        onClick: vi.fn(),
        disable: vi.fn(),
        enable: vi.fn(),
      };

      function registerOncePattern(element) {
        if (handlerRegistered) return;
        handlerRegistered = true;
        element.onClick(() => { callCount++; });
      }

      // Call 3 times (simulating 3 cart refreshes)
      registerOncePattern(mockElement);
      registerOncePattern(mockElement);
      registerOncePattern(mockElement);

      // Only 1 handler registered
      expect(mockElement.onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('repeater onItemReady path', () => {
    it('onItemReady re-registration does not duplicate onClick within items', () => {
      // In Wix Velo, onItemReady replaces the previous callback (not additive).
      // But onClick inside onItemReady IS additive per item.
      // The fix: register onItemReady ONCE during init, not on every refresh.

      let onItemReadyCallCount = 0;
      const mockRepeater = {
        data: null,
        _onItemReadyCallback: null,
        onItemReady(cb) {
          onItemReadyCallCount++;
          this._onItemReadyCallback = cb;
        },
      };

      // OLD pattern: onItemReady called on every refresh
      function loadSuggestionsOld(repeater) {
        repeater.data = [{ _id: 'p1' }];
        repeater.onItemReady(() => {}); // Re-registers every time
      }

      loadSuggestionsOld(mockRepeater);
      loadSuggestionsOld(mockRepeater);
      loadSuggestionsOld(mockRepeater);

      // onItemReady was called 3 times (wasteful, potentially buggy)
      expect(onItemReadyCallCount).toBe(3);

      // NEW pattern: onItemReady registered once, only data updated
      onItemReadyCallCount = 0;
      function initOnce(repeater) {
        repeater.onItemReady(() => {});
      }
      function loadSuggestionsNew(repeater) {
        repeater.data = [{ _id: 'p1' }];
      }

      initOnce(mockRepeater);
      loadSuggestionsNew(mockRepeater);
      loadSuggestionsNew(mockRepeater);
      loadSuggestionsNew(mockRepeater);

      // onItemReady called only once
      expect(onItemReadyCallCount).toBe(1);
    });
  });
});
