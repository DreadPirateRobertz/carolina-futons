import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { __setSecrets, __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler, __reset as resetFetch } from './__mocks__/wix-fetch.js';
import { validatePhone, formatPhoneE164 } from '../src/backend/utils/sanitize.js';
import {
  sendOrderConfirmationSMS,
  sendShippingUpdateSMS,
  sendDeliveryReminderSMS,
  sendBackInStockSMS,
  updateSMSPreferences,
  getSMSPreferences,
} from '../src/backend/smsService.web.js';

beforeEach(() => {
  resetData();
  resetSecrets();
  resetFetch();
  __setSecrets({
    TWILIO_ACCOUNT_SID: 'AC_test_sid',
    TWILIO_AUTH_TOKEN: 'test_auth_token',
    TWILIO_PHONE_NUMBER: '+18005551234',
  });
});

// ── Phone Validation (sanitize utility) ─────────────────────────────

describe('validatePhone', () => {
  it('accepts valid 10-digit US phone', () => {
    expect(validatePhone('8285551234')).toBe(true);
  });

  it('accepts phone with dashes', () => {
    expect(validatePhone('828-555-1234')).toBe(true);
  });

  it('accepts phone with parentheses and spaces', () => {
    expect(validatePhone('(828) 555-1234')).toBe(true);
  });

  it('accepts phone with +1 prefix', () => {
    expect(validatePhone('+18285551234')).toBe(true);
  });

  it('accepts phone with 1 prefix', () => {
    expect(validatePhone('18285551234')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validatePhone('')).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(validatePhone(null)).toBe(false);
    expect(validatePhone(undefined)).toBe(false);
  });

  it('rejects non-string', () => {
    expect(validatePhone(12345)).toBe(false);
  });

  it('rejects too few digits', () => {
    expect(validatePhone('82855')).toBe(false);
  });

  it('rejects too many digits', () => {
    expect(validatePhone('828555123456789')).toBe(false);
  });

  it('rejects letters', () => {
    expect(validatePhone('828-ABC-1234')).toBe(false);
  });

  it('rejects XSS vectors', () => {
    expect(validatePhone('<script>alert(1)</script>')).toBe(false);
  });
});

describe('formatPhoneE164', () => {
  it('formats 10-digit to E.164', () => {
    expect(formatPhoneE164('8285551234')).toBe('+18285551234');
  });

  it('formats phone with dashes', () => {
    expect(formatPhoneE164('828-555-1234')).toBe('+18285551234');
  });

  it('formats phone with parens/spaces', () => {
    expect(formatPhoneE164('(828) 555-1234')).toBe('+18285551234');
  });

  it('passes through valid E.164', () => {
    expect(formatPhoneE164('+18285551234')).toBe('+18285551234');
  });

  it('handles 11-digit with leading 1', () => {
    expect(formatPhoneE164('18285551234')).toBe('+18285551234');
  });

  it('returns empty for invalid input', () => {
    expect(formatPhoneE164('')).toBe('');
    expect(formatPhoneE164(null)).toBe('');
    expect(formatPhoneE164('abc')).toBe('');
  });
});

// ── sendOrderConfirmationSMS ────────────────────────────────────────

describe('sendOrderConfirmationSMS', () => {
  it('sends order confirmation to customer phone', async () => {
    let sentBody = null;
    __setHandler((url, opts) => {
      sentBody = opts.body;
      return { ok: true, status: 201, async json() { return { sid: 'SM_test' }; } };
    });

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, orderConfirmations: true, phone: '+18285551234' },
    ]);

    const result = await sendOrderConfirmationSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      orderTotal: 599.00,
    });

    expect(result.success).toBe(true);
    expect(sentBody).toContain('CF-1001');
    expect(sentBody).toContain('599.00');
  });

  it('skips send when member opted out of order confirmations', async () => {
    let fetchCalled = false;
    __setHandler(() => {
      fetchCalled = true;
      return { ok: true, status: 201, async json() { return { sid: 'SM_test' }; } };
    });

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, orderConfirmations: false, phone: '+18285551234' },
    ]);

    const result = await sendOrderConfirmationSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      orderTotal: 599.00,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('opted_out');
    expect(fetchCalled).toBe(false);
  });

  it('skips send when SMS globally disabled', async () => {
    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: false, orderConfirmations: true, phone: '+18285551234' },
    ]);

    const result = await sendOrderConfirmationSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      orderTotal: 599.00,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('sms_disabled');
  });

  it('skips send when no phone number on file', async () => {
    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, orderConfirmations: true, phone: '' },
    ]);

    const result = await sendOrderConfirmationSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      orderTotal: 599.00,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_phone');
  });

  it('skips send when no SMS preferences exist for member', async () => {
    __seed('SMSPreferences', []);

    const result = await sendOrderConfirmationSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      orderTotal: 599.00,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_preferences');
  });

  it('handles Twilio API failure gracefully', async () => {
    __setHandler(() => {
      return { ok: false, status: 500, async json() { return { message: 'Service unavailable' }; } };
    });

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, orderConfirmations: true, phone: '+18285551234' },
    ]);

    const result = await sendOrderConfirmationSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      orderTotal: 599.00,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('send_failed');
  });

  it('logs SMS to SMSLog collection on success', async () => {
    let insertedLog = null;
    __onInsert((collection, item) => {
      if (collection === 'SMSLog') insertedLog = item;
    });

    __setHandler(() => ({
      ok: true, status: 201, async json() { return { sid: 'SM_test123' }; },
    }));

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, orderConfirmations: true, phone: '+18285551234' },
    ]);

    await sendOrderConfirmationSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      orderTotal: 599.00,
    });

    expect(insertedLog).toBeTruthy();
    expect(insertedLog.memberId).toBe('member-1');
    expect(insertedLog.messageType).toBe('order_confirmation');
    expect(insertedLog.twilioSid).toBe('SM_test123');
  });

  it('rejects missing memberId', async () => {
    const result = await sendOrderConfirmationSMS({
      orderNumber: 'CF-1001',
      orderTotal: 599.00,
    });

    expect(result.success).toBe(false);
  });

  it('sanitizes order number against injection', async () => {
    let sentBody = null;
    __setHandler((url, opts) => {
      sentBody = opts.body;
      return { ok: true, status: 201, async json() { return { sid: 'SM_test' }; } };
    });

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, orderConfirmations: true, phone: '+18285551234' },
    ]);

    await sendOrderConfirmationSMS({
      memberId: 'member-1',
      orderNumber: '<script>alert(1)</script>CF-1001',
      orderTotal: 599.00,
    });

    expect(sentBody).not.toContain('<script>');
  });
});

// ── sendShippingUpdateSMS ───────────────────────────────────────────

describe('sendShippingUpdateSMS', () => {
  it('sends shipping update with tracking info', async () => {
    let sentBody = null;
    __setHandler((url, opts) => {
      sentBody = opts.body;
      return { ok: true, status: 201, async json() { return { sid: 'SM_ship' }; } };
    });

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, shippingUpdates: true, phone: '+18285551234' },
    ]);

    const result = await sendShippingUpdateSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      status: 'out_for_delivery',
      trackingNumber: '1Z999AA10123456784',
    });

    expect(result.success).toBe(true);
    const decoded = decodeURIComponent(sentBody);
    expect(decoded).toContain('CF-1001');
    expect(decoded).toContain('out for delivery');
  });

  it('skips when member opted out of shipping updates', async () => {
    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, shippingUpdates: false, phone: '+18285551234' },
    ]);

    const result = await sendShippingUpdateSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      status: 'shipped',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('opted_out');
  });

  it('handles unknown status gracefully', async () => {
    __setHandler(() => ({
      ok: true, status: 201, async json() { return { sid: 'SM_ship' }; },
    }));

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, shippingUpdates: true, phone: '+18285551234' },
    ]);

    const result = await sendShippingUpdateSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      status: 'some_unknown_status',
    });

    expect(result.success).toBe(true);
  });
});

// ── sendDeliveryReminderSMS ─────────────────────────────────────────

describe('sendDeliveryReminderSMS', () => {
  it('sends delivery reminder with date and time window', async () => {
    let sentBody = null;
    __setHandler((url, opts) => {
      sentBody = opts.body;
      return { ok: true, status: 201, async json() { return { sid: 'SM_del' }; } };
    });

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, deliveryReminders: true, phone: '+18285551234' },
    ]);

    const result = await sendDeliveryReminderSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      deliveryDate: '2026-03-05',
      timeWindow: 'morning',
    });

    expect(result.success).toBe(true);
    expect(sentBody).toContain('CF-1001');
    expect(sentBody).toContain('morning');
  });

  it('skips when member opted out of delivery reminders', async () => {
    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, deliveryReminders: false, phone: '+18285551234' },
    ]);

    const result = await sendDeliveryReminderSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      deliveryDate: '2026-03-05',
      timeWindow: 'afternoon',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('opted_out');
  });

  it('includes time window description in message', async () => {
    let sentBody = null;
    __setHandler((url, opts) => {
      sentBody = opts.body;
      return { ok: true, status: 201, async json() { return { sid: 'SM_del' }; } };
    });

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, deliveryReminders: true, phone: '+18285551234' },
    ]);

    await sendDeliveryReminderSMS({
      memberId: 'member-1',
      orderNumber: 'CF-1001',
      deliveryDate: '2026-03-05',
      timeWindow: 'afternoon',
    });

    expect(sentBody).toContain('afternoon');
  });
});

// ── sendBackInStockSMS ──────────────────────────────────────────────

describe('sendBackInStockSMS', () => {
  it('sends back-in-stock alert with product name', async () => {
    let sentBody = null;
    __setHandler((url, opts) => {
      sentBody = opts.body;
      return { ok: true, status: 201, async json() { return { sid: 'SM_bis' }; } };
    });

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, backInStockAlerts: true, phone: '+18285551234' },
    ]);

    const result = await sendBackInStockSMS({
      memberId: 'member-1',
      productName: 'Eureka Futon',
      productSlug: 'eureka-futon',
    });

    expect(result.success).toBe(true);
    const decoded = decodeURIComponent(sentBody);
    expect(decoded).toContain('Eureka Futon');
    expect(decoded).toContain('back in stock');
  });

  it('skips when member opted out of back-in-stock alerts', async () => {
    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, backInStockAlerts: false, phone: '+18285551234' },
    ]);

    const result = await sendBackInStockSMS({
      memberId: 'member-1',
      productName: 'Eureka Futon',
      productSlug: 'eureka-futon',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('opted_out');
  });

  it('respects SMS cooldown — no duplicate within 24 hours', async () => {
    __setHandler(() => ({
      ok: true, status: 201, async json() { return { sid: 'SM_bis' }; },
    }));

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, backInStockAlerts: true, phone: '+18285551234' },
    ]);

    // Already sent a back-in-stock SMS for this product within 24 hours
    __seed('SMSLog', [
      {
        _id: 'log-1',
        memberId: 'member-1',
        messageType: 'back_in_stock',
        productId: 'prod-eureka',
        sentAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    ]);

    const result = await sendBackInStockSMS({
      memberId: 'member-1',
      productName: 'Eureka Futon',
      productSlug: 'eureka-futon',
      productId: 'prod-eureka',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('cooldown');
  });

  it('sends if cooldown period has passed', async () => {
    __setHandler(() => ({
      ok: true, status: 201, async json() { return { sid: 'SM_bis2' }; },
    }));

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, backInStockAlerts: true, phone: '+18285551234' },
    ]);

    // Sent 25 hours ago — past cooldown
    __seed('SMSLog', [
      {
        _id: 'log-1',
        memberId: 'member-1',
        messageType: 'back_in_stock',
        productId: 'prod-eureka',
        sentAt: new Date(Date.now() - 90000000), // 25 hours ago
      },
    ]);

    const result = await sendBackInStockSMS({
      memberId: 'member-1',
      productName: 'Eureka Futon',
      productSlug: 'eureka-futon',
      productId: 'prod-eureka',
    });

    expect(result.success).toBe(true);
  });

  it('includes product URL in message', async () => {
    let sentBody = null;
    __setHandler((url, opts) => {
      sentBody = opts.body;
      return { ok: true, status: 201, async json() { return { sid: 'SM_bis' }; } };
    });

    __seed('SMSPreferences', [
      { _id: 'sp-1', memberId: 'member-1', smsEnabled: true, backInStockAlerts: true, phone: '+18285551234' },
    ]);

    await sendBackInStockSMS({
      memberId: 'member-1',
      productName: 'Eureka Futon',
      productSlug: 'eureka-futon',
    });

    expect(sentBody).toContain('carolinafutons.com');
  });
});

// ── updateSMSPreferences ────────────────────────────────────────────

describe('updateSMSPreferences', () => {
  beforeEach(() => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
  });

  it('creates new preferences when none exist', async () => {
    __seed('SMSPreferences', []);

    const result = await updateSMSPreferences({
      phone: '(828) 555-1234',
      smsEnabled: true,
      orderConfirmations: true,
      shippingUpdates: true,
      deliveryReminders: true,
      backInStockAlerts: false,
    });

    expect(result.success).toBe(true);
  });

  it('updates existing preferences', async () => {
    __seed('SMSPreferences', [
      {
        _id: 'sp-1',
        memberId: 'member-1',
        smsEnabled: true,
        orderConfirmations: true,
        shippingUpdates: true,
        deliveryReminders: true,
        backInStockAlerts: true,
        phone: '+18285551234',
      },
    ]);

    const result = await updateSMSPreferences({
      phone: '(828) 555-1234',
      smsEnabled: true,
      orderConfirmations: false,
      shippingUpdates: true,
      deliveryReminders: true,
      backInStockAlerts: false,
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid phone number', async () => {
    const result = await updateSMSPreferences({
      phone: 'not-a-phone',
      smsEnabled: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('phone');
  });

  it('rejects unauthenticated user', async () => {
    __setMember(null);

    const result = await updateSMSPreferences({
      phone: '(828) 555-1234',
      smsEnabled: true,
    });

    expect(result.success).toBe(false);
  });

  it('stores phone in E.164 format', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'SMSPreferences') insertedItem = item;
    });

    __seed('SMSPreferences', []);

    await updateSMSPreferences({
      phone: '(828) 555-1234',
      smsEnabled: true,
      orderConfirmations: true,
      shippingUpdates: true,
      deliveryReminders: true,
      backInStockAlerts: true,
    });

    expect(insertedItem.phone).toBe('+18285551234');
  });

  it('rejects XSS in phone field', async () => {
    const result = await updateSMSPreferences({
      phone: '<script>alert(1)</script>',
      smsEnabled: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('phone');
  });
});

// ── getSMSPreferences ───────────────────────────────────────────────

describe('getSMSPreferences', () => {
  it('returns preferences for authenticated member', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });

    __seed('SMSPreferences', [
      {
        _id: 'sp-1',
        memberId: 'member-1',
        smsEnabled: true,
        orderConfirmations: true,
        shippingUpdates: true,
        deliveryReminders: false,
        backInStockAlerts: true,
        phone: '+18285551234',
      },
    ]);

    const result = await getSMSPreferences();
    expect(result.success).toBe(true);
    expect(result.preferences.smsEnabled).toBe(true);
    expect(result.preferences.deliveryReminders).toBe(false);
    expect(result.preferences.phone).toBe('+18285551234');
  });

  it('returns defaults when no preferences exist', async () => {
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
    __seed('SMSPreferences', []);

    const result = await getSMSPreferences();
    expect(result.success).toBe(true);
    expect(result.preferences.smsEnabled).toBe(false);
  });

  it('returns failure for unauthenticated user', async () => {
    __setMember(null);

    const result = await getSMSPreferences();
    expect(result.success).toBe(false);
  });
});
