import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import { __getEmailLog, __failNextEmail } from '../__mocks__/wix-crm-backend.js';
import {
  checkPriceDrops,
  checkBackInStock,
  checkLowStock,
  getAlertHistory,
} from '../../src/backend/wishlistAlerts.web.js';

beforeEach(() => {
  __seed('PriceHistory', []);
  __seed('WishlistAlertsSent', []);
  __seed('WishlistAlertPrefs', []);
  __seed('Wishlist', []);
  __seed('Stores/Products', []);
  __seed('InventoryThresholds', []);
});

// ── Email notifications on price drop ──────────────────────────────

describe('checkPriceDrops email notifications', () => {
  it('sends email with wishlist_price_drop template when alert is created', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Classic Futon' },
    ]);

    await checkPriceDrops();

    const emails = __getEmailLog();
    expect(emails.length).toBeGreaterThanOrEqual(1);
    const priceDropEmail = emails.find(e => e.templateId === 'wishlist_price_drop');
    expect(priceDropEmail).toBeDefined();
    expect(priceDropEmail.memberId).toBe('member-1');
    expect(priceDropEmail.options.variables.currentPrice).toBe('$400.00');
    expect(priceDropEmail.options.variables.previousHigh).toBe('$500.00');
    expect(priceDropEmail.options.variables.dropPercent).toBe('20');
  });

  it('sends emails to multiple members for the same product', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Futon' },
      { _id: 'w-2', memberId: 'member-2', productId: 'prod-1', name: 'Futon' },
    ]);

    await checkPriceDrops();

    const emails = __getEmailLog().filter(e => e.templateId === 'wishlist_price_drop');
    expect(emails).toHaveLength(2);
    const memberIds = emails.map(e => e.memberId).sort();
    expect(memberIds).toEqual(['member-1', 'member-2']);
  });

  it('does not send email when no price drop detected', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 490, date: day2 }, // 2% — below threshold
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);

    await checkPriceDrops();

    const emails = __getEmailLog().filter(e => e.templateId === 'wishlist_price_drop');
    expect(emails).toHaveLength(0);
  });

  it('still records alert even if email fails', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Futon' },
    ]);

    __failNextEmail();

    let insertedAlerts = [];
    __onInsert((collection, item) => {
      if (collection === 'WishlistAlertsSent') insertedAlerts.push(item);
    });

    const result = await checkPriceDrops();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(1);
    expect(insertedAlerts).toHaveLength(1);
  });

  it('does not send email when member has priceDrops disabled', async () => {
    const day1 = new Date(Date.now() - 10 * 86400000);
    const day2 = new Date(Date.now() - 86400000);
    __seed('PriceHistory', [
      { _id: 'ph-1', productId: 'prod-1', price: 500, date: day1 },
      { _id: 'ph-2', productId: 'prod-1', price: 400, date: day2 },
    ]);
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('WishlistAlertPrefs', [
      { _id: 'pref-1', memberId: 'member-1', productId: 'prod-1', priceDrops: false },
    ]);

    await checkPriceDrops();

    const emails = __getEmailLog().filter(e => e.templateId === 'wishlist_price_drop');
    expect(emails).toHaveLength(0);
  });
});

// ── Email notifications on back in stock ───────────────────────────

describe('checkBackInStock email notifications', () => {
  it('sends email with wishlist_back_in_stock template', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Futon', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Classic Futon', inStock: true },
    ]);

    await checkBackInStock();

    const emails = __getEmailLog().filter(e => e.templateId === 'wishlist_back_in_stock');
    expect(emails).toHaveLength(1);
    expect(emails[0].memberId).toBe('member-1');
    expect(emails[0].options.variables.productName).toBe('Classic Futon');
  });

  it('still records alert and updates wishlist even if email fails', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1', name: 'Futon', inStock: false },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Classic Futon', inStock: true },
    ]);

    __failNextEmail();

    let updatedWishItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'Wishlist') updatedWishItem = item;
    });

    const result = await checkBackInStock();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(1);
    expect(updatedWishItem).not.toBeNull();
    expect(updatedWishItem.inStock).toBe(true);
  });
});

// ── Email notifications on low stock ───────────────────────────────

describe('checkLowStock email notifications', () => {
  it('sends email with wishlist_low_stock template', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Classic Futon', inStock: true, quantityInStock: 3 },
    ]);

    await checkLowStock();

    const emails = __getEmailLog().filter(e => e.templateId === 'wishlist_low_stock');
    expect(emails).toHaveLength(1);
    expect(emails[0].memberId).toBe('member-1');
    expect(emails[0].options.variables.productName).toBe('Classic Futon');
    expect(emails[0].options.variables.quantityInStock).toBe('3');
  });

  it('still records alert even if email fails', async () => {
    __seed('Wishlist', [
      { _id: 'w-1', memberId: 'member-1', productId: 'prod-1' },
    ]);
    __seed('Stores/Products', [
      { _id: 'prod-1', name: 'Classic Futon', inStock: true, quantityInStock: 2 },
    ]);

    __failNextEmail();

    const result = await checkLowStock();
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBe(1);
  });
});

// ── getAlertHistory ────────────────────────────────────────────────

describe('getAlertHistory', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
  });

  it('returns alert history for the current member', async () => {
    const sentAt = new Date(Date.now() - 86400000);
    __seed('WishlistAlertsSent', [
      { _id: 'wa-1', memberId: 'member-1', productId: 'prod-1', alertType: 'price_drop', sentAt, price: 400, previousHigh: 500, dropPercent: 20 },
      { _id: 'wa-2', memberId: 'member-1', productId: 'prod-2', alertType: 'back_in_stock', sentAt, productName: 'Futon Frame' },
      { _id: 'wa-3', memberId: 'other-member', productId: 'prod-1', alertType: 'price_drop', sentAt },
    ]);

    const result = await getAlertHistory();
    expect(result.alerts).toHaveLength(2);
    expect(result.alerts[0].productId).toBe('prod-1');
    expect(result.alerts[1].productId).toBe('prod-2');
  });

  it('returns empty for unauthenticated user', async () => {
    __setMember(null);
    const result = await getAlertHistory();
    expect(result.alerts).toEqual([]);
  });

  it('returns empty when no alerts exist', async () => {
    const result = await getAlertHistory();
    expect(result.alerts).toEqual([]);
  });

  it('limits results to 50 most recent alerts', async () => {
    const alerts = [];
    for (let i = 0; i < 60; i++) {
      alerts.push({
        _id: `wa-${i}`,
        memberId: 'member-1',
        productId: `prod-${i}`,
        alertType: 'price_drop',
        sentAt: new Date(Date.now() - i * 86400000),
        price: 400,
      });
    }
    __seed('WishlistAlertsSent', alerts);

    const result = await getAlertHistory();
    expect(result.alerts.length).toBeLessThanOrEqual(50);
  });
});
