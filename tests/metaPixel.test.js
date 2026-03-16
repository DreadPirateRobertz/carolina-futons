import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fireMetaViewContent,
  fireMetaAddToCart,
  fireMetaInitiateCheckout,
  fireMetaPurchase,
  fireMetaSearch,
  fireMetaCompleteRegistration,
  fireMetaAddToWishlist,
  fireMetaLead,
  buildEnhancedMatchParams,
} from '../src/public/metaPixel.js';
import { trackEvent } from 'wix-window-frontend';

beforeEach(() => {
  trackEvent.mockClear();
});

// ── fireMetaViewContent ─────────────────────────────────────────────

describe('fireMetaViewContent', () => {
  it('does not throw with valid product', async () => {
    await expect(fireMetaViewContent({
      _id: 'p1',
      name: 'Kodiak Futon Frame',
      price: 899,
      collections: ['futon-frames'],
    })).resolves.not.toThrow();
  });

  it('does not throw with null product', async () => {
    await expect(fireMetaViewContent(null)).resolves.not.toThrow();
  });

  it('does not throw with undefined', async () => {
    await expect(fireMetaViewContent(undefined)).resolves.not.toThrow();
  });

  it('does not throw with empty object', async () => {
    await expect(fireMetaViewContent({})).resolves.not.toThrow();
  });

  it('handles product without collections', async () => {
    await expect(fireMetaViewContent({
      _id: 'p1',
      name: 'Test',
      price: 100,
    })).resolves.not.toThrow();
  });

  it('handles zero price', async () => {
    await expect(fireMetaViewContent({
      _id: 'p1',
      name: 'Free Item',
      price: 0,
    })).resolves.not.toThrow();
  });

  it('handles negative price gracefully', async () => {
    await expect(fireMetaViewContent({
      _id: 'p1',
      name: 'Bad Price',
      price: -50,
    })).resolves.not.toThrow();
  });
});

// ── fireMetaAddToCart ───────────────────────────────────────────────

describe('fireMetaAddToCart', () => {
  it('does not throw with valid product and quantity', async () => {
    await expect(fireMetaAddToCart({
      _id: 'p1',
      name: 'Monterey Frame',
      price: 699,
    }, 2)).resolves.not.toThrow();
  });

  it('does not throw with null product', async () => {
    await expect(fireMetaAddToCart(null)).resolves.not.toThrow();
  });

  it('defaults quantity to 1', async () => {
    await expect(fireMetaAddToCart({
      _id: 'p1',
      name: 'Test',
      price: 100,
    })).resolves.not.toThrow();
  });

  it('handles zero quantity', async () => {
    await expect(fireMetaAddToCart({
      _id: 'p1',
      name: 'Test',
      price: 100,
    }, 0)).resolves.not.toThrow();
  });

  it('handles missing price', async () => {
    await expect(fireMetaAddToCart({
      _id: 'p1',
      name: 'No Price',
    })).resolves.not.toThrow();
  });
});

// ── fireMetaInitiateCheckout ────────────────────────────────────────

describe('fireMetaInitiateCheckout', () => {
  it('does not throw with cart items and total', async () => {
    await expect(fireMetaInitiateCheckout(
      [{ productId: 'p1', quantity: 1, price: 499 }, { productId: 'p2', quantity: 2, price: 299 }],
      1097
    )).resolves.not.toThrow();
  });

  it('does not throw with empty cart', async () => {
    await expect(fireMetaInitiateCheckout([], 0)).resolves.not.toThrow();
  });

  it('does not throw with null values', async () => {
    await expect(fireMetaInitiateCheckout(null, null)).resolves.not.toThrow();
  });

  it('handles items without productId', async () => {
    await expect(fireMetaInitiateCheckout(
      [{ _id: 'item1', quantity: 1 }],
      500
    )).resolves.not.toThrow();
  });
});

// ── fireMetaPurchase ────────────────────────────────────────────────

describe('fireMetaPurchase', () => {
  it('does not throw with valid order', async () => {
    await expect(fireMetaPurchase({
      _id: 'order-001',
      number: '10042',
      totals: { total: 877.99 },
      lineItems: [
        { productId: 'p1', name: 'Frame', price: 499, quantity: 1 },
      ],
    })).resolves.not.toThrow();
  });

  it('does not throw with null order', async () => {
    await expect(fireMetaPurchase(null)).resolves.not.toThrow();
  });

  it('does not throw with empty order', async () => {
    await expect(fireMetaPurchase({})).resolves.not.toThrow();
  });

  it('handles order without lineItems', async () => {
    await expect(fireMetaPurchase({
      _id: 'order-002',
      totals: { total: 100 },
    })).resolves.not.toThrow();
  });

  it('handles order without totals', async () => {
    await expect(fireMetaPurchase({
      _id: 'order-003',
      lineItems: [{ productId: 'p1', price: 100 }],
    })).resolves.not.toThrow();
  });
});

// ── fireMetaSearch ──────────────────────────────────────────────────

describe('fireMetaSearch', () => {
  it('does not throw with valid query', async () => {
    await expect(fireMetaSearch('futon frame', 12)).resolves.not.toThrow();
  });

  it('does not throw with empty query', async () => {
    await expect(fireMetaSearch('', 0)).resolves.not.toThrow();
  });

  it('does not throw with null values', async () => {
    await expect(fireMetaSearch(null, null)).resolves.not.toThrow();
  });

  it('sanitizes XSS in search query', async () => {
    await expect(fireMetaSearch('<script>alert(1)</script>', 0)).resolves.not.toThrow();
  });
});

// ── fireMetaCompleteRegistration ────────────────────────────────────

describe('fireMetaCompleteRegistration', () => {
  it('does not throw with valid data', async () => {
    await expect(fireMetaCompleteRegistration({
      method: 'email',
      content_name: 'Newsletter Signup',
    })).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireMetaCompleteRegistration(null)).resolves.not.toThrow();
  });

  it('does not throw with empty object', async () => {
    await expect(fireMetaCompleteRegistration({})).resolves.not.toThrow();
  });
});

// ── fireMetaAddToWishlist ───────────────────────────────────────────

describe('fireMetaAddToWishlist', () => {
  it('does not throw with valid product', async () => {
    await expect(fireMetaAddToWishlist({
      _id: 'p1',
      name: 'Test Product',
      price: 499,
    })).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireMetaAddToWishlist(null)).resolves.not.toThrow();
  });
});

// ── fireMetaLead ────────────────────────────────────────────────────

describe('fireMetaLead', () => {
  it('does not throw with valid data', async () => {
    await expect(fireMetaLead({
      content_name: 'Room Consultation',
      content_category: 'consultation',
      value: 0,
    })).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireMetaLead(null)).resolves.not.toThrow();
  });
});

// ── buildEnhancedMatchParams ────────────────────────────────────────

describe('buildEnhancedMatchParams', () => {
  it('returns empty object for null input', () => {
    expect(buildEnhancedMatchParams(null)).toEqual({});
  });

  it('returns empty object for undefined', () => {
    expect(buildEnhancedMatchParams(undefined)).toEqual({});
  });

  it('returns empty object for empty object', () => {
    expect(buildEnhancedMatchParams({})).toEqual({});
  });

  it('lowercases and trims email', () => {
    const result = buildEnhancedMatchParams({ email: '  Jane@Example.COM  ' });
    expect(result.em).toBe('jane@example.com');
  });

  it('normalizes phone to digits only', () => {
    const result = buildEnhancedMatchParams({ phone: '(828) 555-1234' });
    expect(result.ph).toBe('8285551234');
  });

  it('lowercases and trims first name', () => {
    const result = buildEnhancedMatchParams({ firstName: ' Jane ' });
    expect(result.fn).toBe('jane');
  });

  it('lowercases and trims last name', () => {
    const result = buildEnhancedMatchParams({ lastName: ' Smith ' });
    expect(result.ln).toBe('smith');
  });

  it('handles city', () => {
    const result = buildEnhancedMatchParams({ city: 'Asheville' });
    expect(result.ct).toBe('asheville');
  });

  it('handles state', () => {
    const result = buildEnhancedMatchParams({ state: 'NC' });
    expect(result.st).toBe('nc');
  });

  it('handles zip code', () => {
    const result = buildEnhancedMatchParams({ zip: '28801' });
    expect(result.zp).toBe('28801');
  });

  it('skips empty string values', () => {
    const result = buildEnhancedMatchParams({ email: '', phone: '' });
    expect(result).toEqual({});
  });

  it('combines multiple fields', () => {
    const result = buildEnhancedMatchParams({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '8285551234',
    });
    expect(result.em).toBe('jane@example.com');
    expect(result.fn).toBe('jane');
    expect(result.ln).toBe('smith');
    expect(result.ph).toBe('8285551234');
  });

  it('ignores unknown fields', () => {
    const result = buildEnhancedMatchParams({ ssn: '123-45-6789', email: 'a@b.com' });
    expect(result).toEqual({ em: 'a@b.com' });
    expect(result.ssn).toBeUndefined();
  });

  it('handles non-string inputs gracefully', () => {
    const result = buildEnhancedMatchParams({ email: 12345, phone: true });
    expect(result).toEqual({});
  });

  it('returns empty object for non-object input (string)', () => {
    expect(buildEnhancedMatchParams('not an object')).toEqual({});
  });

  it('returns empty object for non-object input (number)', () => {
    expect(buildEnhancedMatchParams(42)).toEqual({});
  });

  it('returns empty object for array input', () => {
    expect(buildEnhancedMatchParams([1, 2, 3])).toEqual({});
  });

  it('skips whitespace-only email', () => {
    const result = buildEnhancedMatchParams({ email: '   ' });
    expect(result.em).toBeUndefined();
  });

  it('strips non-digits from phone leaving empty → skips', () => {
    const result = buildEnhancedMatchParams({ phone: '---' });
    expect(result.ph).toBeUndefined();
  });

  it('skips whitespace-only firstName', () => {
    const result = buildEnhancedMatchParams({ firstName: '  ' });
    expect(result.fn).toBeUndefined();
  });

  it('skips whitespace-only lastName', () => {
    const result = buildEnhancedMatchParams({ lastName: '  ' });
    expect(result.ln).toBeUndefined();
  });

  it('skips whitespace-only city', () => {
    const result = buildEnhancedMatchParams({ city: '  ' });
    expect(result.ct).toBeUndefined();
  });

  it('skips whitespace-only state', () => {
    const result = buildEnhancedMatchParams({ state: '  ' });
    expect(result.st).toBeUndefined();
  });

  it('skips whitespace-only zip', () => {
    const result = buildEnhancedMatchParams({ zip: '  ' });
    expect(result.zp).toBeUndefined();
  });

  it('trims zip but does not lowercase', () => {
    const result = buildEnhancedMatchParams({ zip: '  28801-1234  ' });
    expect(result.zp).toBe('28801-1234');
  });
});

// ── trackEvent parameter verification ────────────────────────────────

describe('fireMetaViewContent trackEvent params', () => {
  it('fires ViewContent with product_group for multi-variant product', async () => {
    await fireMetaViewContent({
      _id: 'p1',
      name: 'Kodiak Frame',
      price: 899,
      variants: [{ _id: 'v1' }, { _id: 'v2' }],
      collections: ['futon-frames'],
    });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      content_type: 'product_group',
    }));
  });

  it('fires ViewContent with product for single-variant product', async () => {
    await fireMetaViewContent({
      _id: 'p1',
      name: 'Test',
      price: 100,
      variants: [{ _id: 'v1' }],
    });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      content_type: 'product',
    }));
  });

  it('fires ViewContent with product for no-variant product', async () => {
    await fireMetaViewContent({
      _id: 'p1',
      name: 'Test',
      price: 100,
    });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      content_type: 'product',
    }));
  });

  it('uses discountedPrice over price when available', async () => {
    await fireMetaViewContent({
      _id: 'p1',
      name: 'Sale Item',
      price: 899,
      discountedPrice: 699,
    });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      value: 699,
    }));
  });

  it('falls back to price when no discountedPrice', async () => {
    await fireMetaViewContent({
      _id: 'p1',
      name: 'Full Price',
      price: 899,
    });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      value: 899,
    }));
  });

  it('clamps negative price to 0 via Math.max', async () => {
    await fireMetaViewContent({
      _id: 'p1',
      name: 'Negative',
      price: -50,
    });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      value: 0,
    }));
  });

  it('uses first collection as content_category', async () => {
    await fireMetaViewContent({
      _id: 'p1',
      name: 'Test',
      price: 100,
      collections: ['futon-frames', 'sale'],
    });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      content_category: 'futon-frames',
    }));
  });

  it('uses empty string for content_category when no collections', async () => {
    await fireMetaViewContent({
      _id: 'p1',
      name: 'Test',
      price: 100,
    });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      content_category: '',
    }));
  });

  it('sanitizes HTML from product name', async () => {
    await fireMetaViewContent({
      _id: 'p1',
      name: '<b>Bold</b> Frame',
      price: 100,
    });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      content_name: 'Bold Frame',
    }));
  });

  it('uses empty string for missing _id', async () => {
    await fireMetaViewContent({ name: 'No ID', price: 100 });
    expect(trackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
      content_ids: [''],
    }));
  });
});

describe('fireMetaAddToCart trackEvent params', () => {
  it('fires AddToCart with product_group for multi-variant', async () => {
    await fireMetaAddToCart({
      _id: 'p1',
      name: 'Frame',
      price: 699,
      variants: [{ _id: 'v1' }, { _id: 'v2' }],
    }, 2);
    expect(trackEvent).toHaveBeenCalledWith('AddToCart', expect.objectContaining({
      content_type: 'product_group',
      num_items: 2,
    }));
  });

  it('uses discountedPrice over price', async () => {
    await fireMetaAddToCart({
      _id: 'p1',
      name: 'Sale',
      price: 699,
      discountedPrice: 499,
    });
    expect(trackEvent).toHaveBeenCalledWith('AddToCart', expect.objectContaining({
      value: 499,
    }));
  });

  it('clamps zero quantity to 1 via fallback', async () => {
    await fireMetaAddToCart({
      _id: 'p1',
      name: 'Test',
      price: 100,
    }, 0);
    // Math.max(0, 0 || 1) = Math.max(0, 1) = 1
    expect(trackEvent).toHaveBeenCalledWith('AddToCart', expect.objectContaining({
      num_items: 1,
    }));
  });

  it('clamps negative value to 0', async () => {
    await fireMetaAddToCart({
      _id: 'p1',
      name: 'Test',
      price: -10,
    });
    expect(trackEvent).toHaveBeenCalledWith('AddToCart', expect.objectContaining({
      value: 0,
    }));
  });
});

describe('fireMetaInitiateCheckout trackEvent params', () => {
  it('maps productId from cart items into content_ids', async () => {
    await fireMetaInitiateCheckout(
      [{ productId: 'p1' }, { productId: 'p2' }],
      500,
    );
    expect(trackEvent).toHaveBeenCalledWith('InitiateCheckout', expect.objectContaining({
      content_ids: ['p1', 'p2'],
      num_items: 2,
      value: 500,
    }));
  });

  it('falls back to _id when no productId', async () => {
    await fireMetaInitiateCheckout(
      [{ _id: 'item-1' }],
      200,
    );
    expect(trackEvent).toHaveBeenCalledWith('InitiateCheckout', expect.objectContaining({
      content_ids: ['item-1'],
    }));
  });

  it('filters out items with no productId or _id', async () => {
    await fireMetaInitiateCheckout(
      [{ productId: 'p1' }, { quantity: 1 }, { productId: 'p3' }],
      700,
    );
    expect(trackEvent).toHaveBeenCalledWith('InitiateCheckout', expect.objectContaining({
      content_ids: ['p1', 'p3'],
      num_items: 3,
    }));
  });

  it('clamps negative cartTotal to 0', async () => {
    await fireMetaInitiateCheckout([], -100);
    expect(trackEvent).toHaveBeenCalledWith('InitiateCheckout', expect.objectContaining({
      value: 0,
    }));
  });
});

describe('fireMetaPurchase trackEvent params', () => {
  it('maps lineItem productId into content_ids', async () => {
    await fireMetaPurchase({
      _id: 'order-1',
      totals: { total: 500 },
      lineItems: [{ productId: 'p1' }, { productId: 'p2' }],
    });
    expect(trackEvent).toHaveBeenCalledWith('Purchase', expect.objectContaining({
      content_ids: ['p1', 'p2'],
      value: 500,
      order_id: 'order-1',
    }));
  });

  it('falls back to _id then sku for lineItem content_ids', async () => {
    await fireMetaPurchase({
      _id: 'order-2',
      totals: { total: 300 },
      lineItems: [{ _id: 'li-1' }, { sku: 'SKU-99' }],
    });
    expect(trackEvent).toHaveBeenCalledWith('Purchase', expect.objectContaining({
      content_ids: ['li-1', 'SKU-99'],
    }));
  });

  it('filters out lineItems with no productId/_id/sku', async () => {
    await fireMetaPurchase({
      _id: 'order-3',
      totals: { total: 100 },
      lineItems: [{ productId: 'p1' }, { name: 'no-id' }],
    });
    expect(trackEvent).toHaveBeenCalledWith('Purchase', expect.objectContaining({
      content_ids: ['p1'],
      num_items: 2,
    }));
  });

  it('falls back to order.number when no _id', async () => {
    await fireMetaPurchase({
      number: '10042',
      totals: { total: 200 },
      lineItems: [],
    });
    expect(trackEvent).toHaveBeenCalledWith('Purchase', expect.objectContaining({
      order_id: '10042',
    }));
  });

  it('uses 0 for value when totals.total missing', async () => {
    await fireMetaPurchase({
      _id: 'order-4',
      lineItems: [{ productId: 'p1' }],
    });
    expect(trackEvent).toHaveBeenCalledWith('Purchase', expect.objectContaining({
      value: 0,
    }));
  });
});

describe('fireMetaSearch trackEvent params', () => {
  it('passes sanitized query and result count', async () => {
    await fireMetaSearch('futon frame', 12);
    expect(trackEvent).toHaveBeenCalledWith('Search', expect.objectContaining({
      search_string: 'futon frame',
      num_items: 12,
    }));
  });

  it('strips HTML tags from query', async () => {
    await fireMetaSearch('<script>alert(1)</script>queen', 5);
    expect(trackEvent).toHaveBeenCalledWith('Search', expect.objectContaining({
      search_string: 'alert(1)queen',
    }));
  });

  it('uses empty string for null query', async () => {
    await fireMetaSearch(null, 0);
    expect(trackEvent).toHaveBeenCalledWith('Search', expect.objectContaining({
      search_string: '',
    }));
  });

  it('clamps negative resultCount to 0', async () => {
    await fireMetaSearch('test', -5);
    expect(trackEvent).toHaveBeenCalledWith('Search', expect.objectContaining({
      num_items: 0,
    }));
  });
});

describe('fireMetaCompleteRegistration trackEvent params', () => {
  it('passes method and content_name from params', async () => {
    await fireMetaCompleteRegistration({
      method: 'email',
      content_name: 'Newsletter Signup',
    });
    expect(trackEvent).toHaveBeenCalledWith('CompleteRegistration', expect.objectContaining({
      content_name: 'Newsletter Signup',
      method: 'email',
      status: true,
    }));
  });

  it('uses empty strings for non-object params (string)', async () => {
    await fireMetaCompleteRegistration('not-an-object');
    expect(trackEvent).toHaveBeenCalledWith('CompleteRegistration', expect.objectContaining({
      content_name: '',
      method: '',
    }));
  });

  it('uses empty strings for non-object params (number)', async () => {
    await fireMetaCompleteRegistration(42);
    expect(trackEvent).toHaveBeenCalledWith('CompleteRegistration', expect.objectContaining({
      content_name: '',
      method: '',
    }));
  });

  it('defaults missing fields to empty strings', async () => {
    await fireMetaCompleteRegistration({});
    expect(trackEvent).toHaveBeenCalledWith('CompleteRegistration', expect.objectContaining({
      content_name: '',
      method: '',
    }));
  });
});

describe('fireMetaAddToWishlist trackEvent params', () => {
  it('uses discountedPrice when available', async () => {
    await fireMetaAddToWishlist({
      _id: 'p1',
      name: 'Sale Frame',
      price: 899,
      discountedPrice: 699,
      collections: ['sale'],
    });
    expect(trackEvent).toHaveBeenCalledWith('AddToWishlist', expect.objectContaining({
      value: 699,
      content_category: 'sale',
    }));
  });

  it('uses first collection for content_category', async () => {
    await fireMetaAddToWishlist({
      _id: 'p1',
      name: 'Test',
      price: 100,
      collections: ['frames', 'sale'],
    });
    expect(trackEvent).toHaveBeenCalledWith('AddToWishlist', expect.objectContaining({
      content_category: 'frames',
    }));
  });

  it('defaults content_category to empty string when no collections', async () => {
    await fireMetaAddToWishlist({
      _id: 'p1',
      name: 'Test',
      price: 100,
    });
    expect(trackEvent).toHaveBeenCalledWith('AddToWishlist', expect.objectContaining({
      content_category: '',
    }));
  });

  it('clamps negative price to 0', async () => {
    await fireMetaAddToWishlist({
      _id: 'p1',
      name: 'Test',
      price: -50,
    });
    expect(trackEvent).toHaveBeenCalledWith('AddToWishlist', expect.objectContaining({
      value: 0,
    }));
  });

  it('sanitizes HTML from name', async () => {
    await fireMetaAddToWishlist({
      _id: 'p1',
      name: '<em>Fancy</em> Frame',
      price: 500,
    });
    expect(trackEvent).toHaveBeenCalledWith('AddToWishlist', expect.objectContaining({
      content_name: 'Fancy Frame',
    }));
  });
});

describe('fireMetaLead trackEvent params', () => {
  it('passes content_name, content_category, and value', async () => {
    await fireMetaLead({
      content_name: 'Room Consultation',
      content_category: 'consultation',
      value: 150,
    });
    expect(trackEvent).toHaveBeenCalledWith('Lead', expect.objectContaining({
      content_name: 'Room Consultation',
      content_category: 'consultation',
      value: 150,
    }));
  });

  it('uses empty strings for non-object params', async () => {
    await fireMetaLead('not-object');
    expect(trackEvent).toHaveBeenCalledWith('Lead', expect.objectContaining({
      content_name: '',
      content_category: '',
      value: 0,
    }));
  });

  it('defaults missing fields', async () => {
    await fireMetaLead({});
    expect(trackEvent).toHaveBeenCalledWith('Lead', expect.objectContaining({
      content_name: '',
      content_category: '',
      value: 0,
    }));
  });

  it('clamps negative value to 0', async () => {
    await fireMetaLead({ value: -100 });
    expect(trackEvent).toHaveBeenCalledWith('Lead', expect.objectContaining({
      value: 0,
    }));
  });

  it('sanitizes HTML in content_name and content_category', async () => {
    await fireMetaLead({
      content_name: '<b>Bold</b> Lead',
      content_category: '<script>x</script>cat',
    });
    expect(trackEvent).toHaveBeenCalledWith('Lead', expect.objectContaining({
      content_name: 'Bold Lead',
      content_category: 'xcat',
    }));
  });
});
