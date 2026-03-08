import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import { __setSecrets } from '../__mocks__/wix-secrets-backend.js';
import { __getEmailLog, __reset as resetEmail, __failNextEmail } from '../__mocks__/wix-crm-backend.js';
import {
  recordPriceSnapshots,
  checkWishlistAlerts,
  toggleProductAlerts,
  getNotificationHistory,
} from '../../src/backend/notificationService.web.js';

beforeEach(() => {
  resetData();
  resetEmail();
  __setSecrets({ SITE_OWNER_CONTACT_ID: 'owner-contact-123' });
});

// ── recordPriceSnapshots ──────────────────────────────────────────────

describe('recordPriceSnapshots', () => {
  it('records snapshots for all products', async () => {
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Eureka Futon', price: 599, inStock: true, slug: 'eureka' },
      { _id: 'prod-2', name: 'Phoenix Frame', price: 799, inStock: false, slug: 'phoenix' },
    ]);

    const result = await recordPriceSnapshots();
    expect(result.recorded).toBe(2);
  });

  it('returns 0 when no products exist', async () => {
    __seed('Stores/Products', []);
    const result = await recordPriceSnapshots();
    expect(result.recorded).toBe(0);
  });
});

// ── checkWishlistAlerts ───────────────────────────────────────────────

describe('checkWishlistAlerts', () => {
  it('sends price drop alert when price drops >= 10%', async () => {
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Eureka Futon', price: 499, inStock: true, slug: 'eureka', mainMedia: 'img.jpg' },
    ]);

    // Current snapshot (recorded by recordPriceSnapshots) + previous price
    // Previous $599 → now $499 = 16.7% drop
    __seed('PriceHistory', [
      { _id: 'ph-2', productId: 'prod-1', price: 499, inStock: true, recordedAt: new Date('2026-02-27') },
      { _id: 'ph-1', productId: 'prod-1', price: 599, inStock: true, recordedAt: new Date('2026-02-20') },
    ]);

    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', productName: 'Eureka Futon' },
    ]);

    __seed('MemberPreferences', [
      { _id: 'mp-1', memberId: 'member-1', saleAlerts: true, backInStock: true },
    ]);

    __seed('Members/PrivateMembersData', [
      { _id: 'member-1', contactId: 'contact-1' },
    ]);

    __seed('NotificationLog', []);

    const result = await checkWishlistAlerts();
    expect(result.priceDropAlerts).toBe(1);

    const emails = __getEmailLog();
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('price_drop_alert');
    expect(emails[0].contactId).toBe('contact-1');
    expect(emails[0].options.variables.productName).toBe('Eureka Futon');
    expect(emails[0].options.variables.previousPrice).toBe('$599.00');
    expect(emails[0].options.variables.currentPrice).toBe('$499.00');
  });

  it('does not alert when price drop is < 10%', async () => {
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Eureka Futon', price: 575, inStock: true, slug: 'eureka' },
    ]);

    // Previous $599, now $575 = 4% drop — below threshold
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 599, inStock: true, recordedAt: new Date('2026-02-20') },
    ]);

    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    __seed('MemberPreferences', [
      { _id: 'mp-1', memberId: 'member-1', saleAlerts: true },
    ]);

    __seed('NotificationLog', []);

    const result = await checkWishlistAlerts();
    expect(result.priceDropAlerts).toBe(0);
    expect(__getEmailLog()).toHaveLength(0);
  });

  it('sends back-in-stock alert when product restocks', async () => {
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Phoenix Frame', price: 799, inStock: true, slug: 'phoenix', mainMedia: 'img.jpg' },
    ]);

    // Current snapshot (now in stock) + previous (was out of stock)
    __seed('PriceHistory', [
      { _id: 'ph-2', productId: 'prod-1', price: 799, inStock: true, recordedAt: new Date('2026-02-27') },
      { _id: 'ph-1', productId: 'prod-1', price: 799, inStock: false, recordedAt: new Date('2026-02-20') },
    ]);

    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', productName: 'Phoenix Frame' },
    ]);

    __seed('MemberPreferences', [
      { _id: 'mp-1', memberId: 'member-1', backInStock: true },
    ]);

    __seed('Members/PrivateMembersData', [
      { _id: 'member-1', contactId: 'contact-1' },
    ]);

    __seed('NotificationLog', []);

    const result = await checkWishlistAlerts();
    expect(result.backInStockAlerts).toBe(1);

    const emails = __getEmailLog();
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('back_in_stock_alert');
    expect(emails[0].options.variables.productName).toBe('Phoenix Frame');
  });

  it('respects member opt-out for sale alerts', async () => {
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Eureka Futon', price: 399, inStock: true, slug: 'eureka' },
    ]);

    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 599, inStock: true, recordedAt: new Date('2026-02-20') },
    ]);

    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    // saleAlerts explicitly false
    __seed('MemberPreferences', [
      { _id: 'mp-1', memberId: 'member-1', saleAlerts: false, backInStock: true },
    ]);

    __seed('NotificationLog', []);

    const result = await checkWishlistAlerts();
    expect(result.priceDropAlerts).toBe(0);
  });

  it('respects per-product muteAlerts flag', async () => {
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Eureka Futon', price: 399, inStock: true, slug: 'eureka' },
    ]);

    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 599, inStock: true, recordedAt: new Date('2026-02-20') },
    ]);

    // muteAlerts = true on the wishlist entry
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', muteAlerts: true },
    ]);

    __seed('MemberPreferences', [
      { _id: 'mp-1', memberId: 'member-1', saleAlerts: true },
    ]);

    __seed('NotificationLog', []);

    const result = await checkWishlistAlerts();
    expect(result.priceDropAlerts).toBe(0);
  });

  it('respects 7-day notification cooldown', async () => {
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Eureka Futon', price: 399, inStock: true, slug: 'eureka' },
    ]);

    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 599, inStock: true, recordedAt: new Date('2026-02-20') },
    ]);

    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    __seed('MemberPreferences', [
      { _id: 'mp-1', memberId: 'member-1', saleAlerts: true },
    ]);

    // Already notified 2 days ago — within cooldown window
    __seed('NotificationLog', [
      { _id: 'nl-1', memberId: 'member-1', productId: 'prod-1', alertType: 'price_drop', sentAt: new Date('2026-02-19') },
    ]);

    const result = await checkWishlistAlerts();
    expect(result.priceDropAlerts).toBe(0);
  });

  it('handles email send failure gracefully', async () => {
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Eureka Futon', price: 399, inStock: true, slug: 'eureka', mainMedia: 'img.jpg' },
    ]);

    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 599, inStock: true, recordedAt: new Date('2026-02-20') },
    ]);

    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    __seed('MemberPreferences', [
      { _id: 'mp-1', memberId: 'member-1', saleAlerts: true },
    ]);

    __seed('Members/PrivateMembersData', [
      { _id: 'member-1', contactId: 'contact-1' },
    ]);

    __seed('NotificationLog', []);

    __failNextEmail();

    const result = await checkWishlistAlerts();
    // Should not crash, but alert count stays 0 since send failed
    expect(result.priceDropAlerts).toBe(0);
  });
});

// ── toggleProductAlerts ───────────────────────────────────────────────

describe('toggleProductAlerts', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
  });

  it('mutes alerts for a wishlist item', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', muteAlerts: false },
    ]);

    const result = await toggleProductAlerts('w-1', true);
    expect(result).toEqual({ success: true });
  });

  it('unmutes alerts for a wishlist item', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', muteAlerts: true },
    ]);

    const result = await toggleProductAlerts('w-1', false);
    expect(result).toEqual({ success: true });
  });

  it('returns failure for invalid ID', async () => {
    const result = await toggleProductAlerts('<script>alert(1)</script>', true);
    expect(result).toEqual({ success: false });
  });

  it('returns failure for nonexistent item', async () => {
    __seed('Wishlist', []);
    const result = await toggleProductAlerts('nonexistent', true);
    expect(result).toEqual({ success: false });
  });
});

// ── getNotificationHistory ────────────────────────────────────────────

describe('getNotificationHistory', () => {
  it('returns recent notifications for a member', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
    __seed('NotificationLog', [
      { _id: 'nl-1', memberId: 'member-1', productId: 'prod-1', productName: 'Eureka', alertType: 'price_drop', sentAt: new Date('2026-02-20') },
      { _id: 'nl-2', memberId: 'member-1', productId: 'prod-2', productName: 'Phoenix', alertType: 'back_in_stock', sentAt: new Date('2026-02-19') },
    ]);

    const result = await getNotificationHistory();
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('returns empty for unauthenticated user', async () => {
    __setMember(null);
    const result = await getNotificationHistory();
    expect(result.success).toBe(false);
    expect(result.items).toHaveLength(0);
  });
});
