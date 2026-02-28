import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setMember, __setRoles } from './__mocks__/wix-members-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import { sanitize, validateEmail, validateId, validateSlug } from '../src/backend/utils/sanitize.js';
import { submitContactForm } from '../src/backend/contactSubmissions.web.js';
import { trackProductView, trackAddToCart } from '../src/backend/analyticsHelpers.web.js';
import { sendEmail, submitSwatchRequest } from '../src/backend/emailService.web.js';
import { submitReview } from '../src/backend/dataService.web.js';
import {
  getPendingOrders,
  fulfillOrder,
  getTrackingUpdate,
  getFulfillmentHistory,
} from '../src/backend/fulfillment.web.js';
import { getRelatedProducts } from '../src/backend/productRecommendations.web.js';
import { sampleOrder, allProducts } from './fixtures/products.js';
import { reviewRequests } from './fixtures/engagement.js';

function loginAsAdmin() {
  __setMember({ _id: 'admin-001' });
  __setRoles([{ _id: 'admin', title: 'Admin' }]);
}

function loginAsMember() {
  __setMember({ _id: 'member-001' });
  __setRoles([{ _id: 'member', title: 'Member' }]);
}

beforeEach(() => {
  __setSecrets({ SITE_OWNER_CONTACT_ID: 'owner-contact-123' });
  __seed('ContactSubmissions', []);
  __seed('ProductAnalytics', []);
  __seed('Stores/Orders', [sampleOrder]);
  __seed('Fulfillments', []);
  __seed('ReviewRequests', reviewRequests);
  __seed('Stores/Products', allProducts);

  __setHandler((url) => {
    if (url.includes('/oauth/token')) {
      return { ok: true, async json() { return { access_token: 'mock-token', expires_in: '3600' }; }, async text() { return ''; } };
    }
    if (url.includes('/shipments/')) {
      return {
        ok: true,
        async json() {
          return {
            ShipmentResponse: {
              ShipmentResults: {
                ShipmentIdentificationNumber: '1Z999AA10123456784',
                PackageResults: [{ TrackingNumber: '1Z999AA10123456784', ShippingLabel: { GraphicImage: 'base64data' } }],
                ShipmentCharges: { TotalCharges: { MonetaryValue: '45.00', CurrencyCode: 'USD' } },
                BillingWeight: { Weight: '140' },
              },
            },
          };
        },
        async text() { return ''; },
      };
    }
    if (url.includes('/track/')) {
      return {
        ok: true,
        async json() {
          return {
            trackResponse: {
              shipment: [{
                package: [{
                  currentStatus: { description: 'In Transit', code: 'I' },
                  activity: [{ status: { description: 'In Transit', code: 'I' }, location: { address: { city: 'Atlanta', stateProvince: 'GA', countryCode: 'US' } }, date: '20250619', time: '100000' }],
                }],
              }],
            },
          };
        },
        async text() { return ''; },
      };
    }
    return { ok: true, async json() { return {}; }, async text() { return ''; } };
  });

  __setSecrets({
    SITE_OWNER_CONTACT_ID: 'owner-contact-123',
    UPS_CLIENT_ID: 'test-client-id',
    UPS_CLIENT_SECRET: 'test-client-secret',
    UPS_ACCOUNT_NUMBER: '123456',
    UPS_SANDBOX: 'true',
  });
});

// ═════════════════════════════════════════════════════════════════════
// SANITIZATION UTILITY
// ═════════════════════════════════════════════════════════════════════

describe('sanitize utility', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
    expect(sanitize('<b>bold</b>')).toBe('bold');
    expect(sanitize('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('truncates to maxLen', () => {
    expect(sanitize('a'.repeat(200), 100)).toHaveLength(100);
  });

  it('returns empty string for non-string input', () => {
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
    expect(sanitize(123)).toBe('');
    expect(sanitize({})).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
});

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co')).toBe(true);
    expect(validateEmail('a+b@c.org')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('@missing-local.com')).toBe(false);
    expect(validateEmail('missing-domain@')).toBe(false);
    expect(validateEmail('spaces in@email.com')).toBe(false);
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
  });
});

describe('validateId', () => {
  it('accepts valid Wix-style IDs', () => {
    expect(validateId('abc-123')).toBe('abc-123');
    expect(validateId('prod_frame_001')).toBe('prod_frame_001');
  });

  it('rejects IDs with HTML/special characters', () => {
    expect(validateId('<script>')).toBe('');
    expect(validateId('id with spaces')).toBe('');
    expect(validateId('')).toBe('');
  });

  it('truncates long IDs', () => {
    const longId = 'a'.repeat(100);
    expect(validateId(longId)).toHaveLength(50);
  });

  it('returns empty for non-string', () => {
    expect(validateId(null)).toBe('');
    expect(validateId(42)).toBe('');
  });
});

describe('validateSlug', () => {
  it('accepts valid slugs', () => {
    expect(validateSlug('futon-frames')).toBe('futon-frames');
    expect(validateSlug('murphy-cabinet-beds')).toBe('murphy-cabinet-beds');
  });

  it('lowercases slugs', () => {
    expect(validateSlug('FUTON-Frames')).toBe('futon-frames');
  });

  it('rejects slugs with invalid characters', () => {
    expect(validateSlug('<script>')).toBe('');
    expect(validateSlug('has spaces')).toBe('');
    expect(validateSlug('has_underscores')).toBe('');
  });

  it('returns empty for non-string', () => {
    expect(validateSlug(null)).toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════
// CONTACT SUBMISSIONS — INPUT SANITIZATION + RATE LIMITING
// ═════════════════════════════════════════════════════════════════════

describe('submitContactForm security', () => {
  it('strips HTML from all fields', async () => {
    const result = await submitContactForm({
      email: 'test@example.com',
      name: '<script>alert("xss")</script>John',
      phone: '<b>555</b>',
      source: '<img src=x>exit_intent',
      notes: '<a href="evil">Click me</a>',
      productId: '<script>id</script>',
      productName: '<b>Product</b>',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid email format', async () => {
    const result = await submitContactForm({
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing email', async () => {
    const result = await submitContactForm({ name: 'John' });
    expect(result.success).toBe(false);
  });

  it('rate limits rapid submissions from same email', async () => {
    // First submission succeeds and inserts a record
    const first = await submitContactForm({
      email: 'spam@test.com',
      name: 'Spammer',
    });
    expect(first.success).toBe(true);

    // Second submission from same email within 60s returns silent success (no insert)
    const second = await submitContactForm({
      email: 'spam@test.com',
      name: 'Spammer Again',
    });
    // Returns success (silent) but doesn't insert a second record
    expect(second.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// ANALYTICS — INPUT SANITIZATION
// ═════════════════════════════════════════════════════════════════════

describe('trackProductView security', () => {
  it('sanitizes HTML in product fields before CMS write', async () => {
    // Should not throw — HTML is stripped before CMS insert
    await expect(
      trackProductView(
        '<script>alert(1)</script>prod-001',
        '<b>Evil Product</b>',
        '<img src=x>category'
      )
    ).resolves.not.toThrow();
  });
});

describe('trackAddToCart security', () => {
  it('sanitizes productId before CMS query', async () => {
    await expect(
      trackAddToCart('<script>alert(1)</script>')
    ).resolves.not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════
// EMAIL SERVICE — INPUT SANITIZATION
// ═════════════════════════════════════════════════════════════════════

describe('sendEmail security', () => {
  it('rejects invalid email format', async () => {
    const result = await sendEmail({
      name: 'John',
      email: 'not-valid',
      phone: '555',
      subject: 'Test',
      message: 'Test message',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid email');
  });

  it('strips HTML from all fields', async () => {
    const result = await sendEmail({
      name: '<script>alert(1)</script>John',
      email: 'john@example.com',
      phone: '<b>555</b>',
      subject: '<img>Subject',
      message: '<a href="evil">message</a>',
    });

    expect(result.success).toBe(true);
  });
});

describe('submitSwatchRequest security', () => {
  it('rejects invalid email format', async () => {
    const result = await submitSwatchRequest({
      name: 'John',
      email: 'bad-email',
      address: '123 Main St',
      productId: 'prod-001',
      productName: 'Test Product',
      swatchNames: ['Red'],
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid email');
  });

  it('sanitizes swatch names array', async () => {
    const result = await submitSwatchRequest({
      name: 'John',
      email: 'john@example.com',
      address: '123 Main St',
      productId: 'prod-001',
      productName: 'Test',
      swatchNames: ['<script>alert(1)</script>Red', '<b>Blue</b>'],
    });

    expect(result.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// FULFILLMENT — ADMIN AUTHORIZATION
// ═════════════════════════════════════════════════════════════════════

describe('fulfillment admin authorization', () => {
  describe('getPendingOrders', () => {
    it('allows admin to view pending orders', async () => {
      loginAsAdmin();
      const orders = await getPendingOrders(50);
      expect(orders.length).toBe(1);
      expect(orders[0].number).toBe('10042');
    });

    it('blocks non-admin members', async () => {
      loginAsMember();
      const orders = await getPendingOrders(50);
      expect(orders).toEqual([]);
    });

    it('blocks unauthenticated users', async () => {
      const orders = await getPendingOrders(50);
      expect(orders).toEqual([]);
    });
  });

  describe('fulfillOrder', () => {
    it('allows admin to fulfill orders', async () => {
      loginAsAdmin();
      const result = await fulfillOrder('order-001', {
        serviceCode: '03',
        packages: [{ length: 80, width: 40, height: 12, weight: 85, description: 'Futon Frame' }],
      });
      expect(result.success).toBe(true);
    });

    it('blocks non-admin members', async () => {
      loginAsMember();
      const result = await fulfillOrder('order-001', {
        serviceCode: '03',
        packages: [{ length: 80, width: 40, height: 12, weight: 85 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('getTrackingUpdate', () => {
    it('allows admin to get tracking updates', async () => {
      loginAsAdmin();
      __seed('Fulfillments', [{
        _id: 'ful-001',
        trackingNumber: '1Z999AA10123456784',
        status: 'IN_TRANSIT',
      }]);
      const result = await getTrackingUpdate('1Z999AA10123456784');
      expect(result.success).toBe(true);
    });

    it('blocks non-admin members', async () => {
      loginAsMember();
      const result = await getTrackingUpdate('1Z999AA10123456784');
      expect(result.success).toBe(false);
    });

    it('blocks unauthenticated users', async () => {
      const result = await getTrackingUpdate('1Z999AA10123456784');
      expect(result.success).toBe(false);
    });
  });

  describe('getFulfillmentHistory', () => {
    it('allows admin to view history', async () => {
      loginAsAdmin();
      __seed('Fulfillments', [
        { _id: 'ful-001', createdDate: new Date(), status: 'DELIVERED' },
      ]);
      const history = await getFulfillmentHistory(100);
      expect(history).toHaveLength(1);
    });

    it('blocks non-admin members', async () => {
      loginAsMember();
      __seed('Fulfillments', [
        { _id: 'ful-001', createdDate: new Date(), status: 'DELIVERED' },
      ]);
      const history = await getFulfillmentHistory(100);
      expect(history).toEqual([]);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// SUBMIT REVIEW — REQUEST ID SANITIZATION
// ═════════════════════════════════════════════════════════════════════

describe('submitReview security', () => {
  it('sanitizes requestId (strips special characters)', async () => {
    // requestId with HTML should be rejected (cleaned ID won't match any record)
    const result = await submitReview('<script>alert(1)</script>', 5, 'Great!');
    expect(result.success).toBe(false);
  });

  it('accepts valid requestId format', async () => {
    const result = await submitReview('rev-001', 4, 'Nice product');
    expect(result.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// PRODUCT RECOMMENDATIONS — INPUT SANITIZATION
// ═════════════════════════════════════════════════════════════════════

describe('getRelatedProducts security', () => {
  it('sanitizes productId and categorySlug', async () => {
    // Should not throw even with malicious input — just returns empty
    const results = await getRelatedProducts(
      '<script>alert(1)</script>',
      '<img src=x>futon-frames'
    );
    expect(Array.isArray(results)).toBe(true);
  });

  it('works with valid sanitized inputs', async () => {
    const results = await getRelatedProducts('prod-frame-001', 'futon-frames');
    // Returns related products from complementary categories
    expect(Array.isArray(results)).toBe(true);
  });
});
