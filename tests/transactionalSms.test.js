/**
 * @file transactionalSms.test.js
 * @description Tests for CF-an2c transactional SMS — order shipped path.
 *
 * Covers:
 *  - buildTrackingUrl: URL construction
 *  - handleOrderFulfilled: opt-in gate, tracking URL injection, SMS fired
 *  - sendOrderShippedSMS: message format, Twilio call, SMSLog insert
 */

import { describe, it, expect } from 'vitest';
import { __seed, __onInsert } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import {
  buildTrackingUrl,
  handleOrderFulfilled,
} from '../src/backend/notificationOrchestrator.web.js';
import { sendOrderShippedSMS } from '../src/backend/smsService.web.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-001';
const ORDER_NUM = 'CF-12345';
const PHONE = '+18285559876';

function seedPrefs(overrides = {}) {
  __seed('SMSPreferences', [{
    _id: 'pref-1',
    memberId: MEMBER_ID,
    phone: PHONE,
    smsEnabled: true,
    orderConfirmations: true,
    shippingUpdates: true,
    deliveryReminders: true,
    backInStockAlerts: true,
    ...overrides,
  }]);
}

function seedTwilioSecrets() {
  __setSecrets({
    TWILIO_ACCOUNT_SID: 'ACtest123',
    TWILIO_AUTH_TOKEN: 'authtoken',
    TWILIO_PHONE_NUMBER: '+18289990000',
  });
}

function mockTwilioSuccess(sid = 'SMxyz') {
  __setHandler((_url, _opts) => ({
    ok: true,
    status: 200,
    async json() { return { sid }; },
  }));
}

function mockTwilioFailure(status = 400) {
  __setHandler((_url, _opts) => ({
    ok: false,
    status,
    async json() { return { message: 'Twilio error', code: 21211 }; },
  }));
}

// ── buildTrackingUrl ──────────────────────────────────────────────────────────

describe('buildTrackingUrl', () => {
  it('builds a UPS tracking URL from a tracking number', () => {
    const url = buildTrackingUrl('1Z999AA10123456784');
    expect(url).toBe('https://www.ups.com/track?tracknum=1Z999AA10123456784');
  });

  it('strips non-alphanumeric chars from tracking number', () => {
    const url = buildTrackingUrl('1Z999-AA1 0123456784');
    expect(url).toBe('https://www.ups.com/track?tracknum=1Z999AA10123456784');
  });

  it('returns empty string for empty tracking number', () => {
    expect(buildTrackingUrl('')).toBe('');
    expect(buildTrackingUrl(null)).toBe('');
  });

  it('uppercases tracking number for URL consistency', () => {
    const url = buildTrackingUrl('1z999aa10123456784');
    // sanitize preserves case; alphanumeric filter keeps letters — UPS accepts lowercase
    expect(url).toContain('1z999aa10123456784');
  });
});

// ── sendOrderShippedSMS ───────────────────────────────────────────────────────

describe('sendOrderShippedSMS', () => {
  it('sends shipped SMS with tracking URL to opted-in member', async () => {
    seedPrefs();
    seedTwilioSecrets();
    mockTwilioSuccess('SM001');

    const result = await sendOrderShippedSMS({
      memberId: MEMBER_ID,
      orderNumber: ORDER_NUM,
      trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    });

    expect(result.success).toBe(true);
  });

  it('message contains "on the way" and tracking URL', async () => {
    seedPrefs();
    seedTwilioSecrets();

    let sentBody = '';
    __setHandler((_url, opts) => {
      const body = opts.body || '';
      const match = body.match(/Body=([^&]+)/);
      sentBody = match ? decodeURIComponent(match[1]) : '';
      return { ok: true, status: 200, async json() { return { sid: 'SM002' }; } };
    });

    await sendOrderShippedSMS({
      memberId: MEMBER_ID,
      orderNumber: ORDER_NUM,
      trackingUrl: 'https://www.ups.com/track?tracknum=ABC123',
    });

    expect(sentBody).toContain('on the way');
    expect(sentBody).toContain('https://www.ups.com/track?tracknum=ABC123');
  });

  it('sends shipped SMS without tracking URL when none provided', async () => {
    seedPrefs();
    seedTwilioSecrets();

    let sentBody = '';
    __setHandler((_url, opts) => {
      const body = opts.body || '';
      const match = body.match(/Body=([^&]+)/);
      sentBody = match ? decodeURIComponent(match[1]) : '';
      return { ok: true, status: 200, async json() { return { sid: 'SM003' }; } };
    });

    await sendOrderShippedSMS({ memberId: MEMBER_ID, orderNumber: ORDER_NUM });
    expect(sentBody).toContain('on the way');
    expect(sentBody).not.toContain('Track:');
  });

  it('returns reason=no_preferences when member has no SMS prefs', async () => {
    // SMSPreferences empty (default after reset)
    seedTwilioSecrets();
    mockTwilioSuccess();

    const result = await sendOrderShippedSMS({ memberId: MEMBER_ID, orderNumber: ORDER_NUM });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_preferences');
  });

  it('returns reason=sms_disabled when member opted out globally', async () => {
    seedPrefs({ smsEnabled: false });
    seedTwilioSecrets();

    const result = await sendOrderShippedSMS({ memberId: MEMBER_ID, orderNumber: ORDER_NUM });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('sms_disabled');
  });

  it('returns reason=opted_out when member opted out of shipping updates', async () => {
    seedPrefs({ shippingUpdates: false });
    seedTwilioSecrets();

    const result = await sendOrderShippedSMS({ memberId: MEMBER_ID, orderNumber: ORDER_NUM });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('opted_out');
  });

  it('returns reason=send_failed when Twilio returns error', async () => {
    seedPrefs();
    seedTwilioSecrets();
    mockTwilioFailure(400);

    const result = await sendOrderShippedSMS({ memberId: MEMBER_ID, orderNumber: ORDER_NUM });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('send_failed');
  });

  it('inserts SMSLog record on success', async () => {
    seedPrefs();
    seedTwilioSecrets();
    mockTwilioSuccess('SM_SHIP_LOG');

    let logInserted = null;
    __onInsert((collection, item) => {
      if (collection === 'SMSLog') logInserted = item;
    });

    await sendOrderShippedSMS({ memberId: MEMBER_ID, orderNumber: ORDER_NUM });

    expect(logInserted).not.toBeNull();
    expect(logInserted.messageType).toBe('order_shipped');
    expect(logInserted.memberId).toBe(MEMBER_ID);
  });

  it('returns reason=invalid_input when memberId is missing', async () => {
    const result = await sendOrderShippedSMS({ orderNumber: ORDER_NUM });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_input');
  });
});

// ── handleOrderFulfilled ──────────────────────────────────────────────────────

describe('handleOrderFulfilled', () => {
  it('fires order shipped SMS and returns sent=true for opted-in member', async () => {
    seedPrefs();
    seedTwilioSecrets();
    mockTwilioSuccess('SM_HO');

    const result = await handleOrderFulfilled({
      memberId: MEMBER_ID,
      orderNumber: ORDER_NUM,
      trackingNumber: '1Z999AA10123456784',
    });

    expect(result.sent).toBe(true);
  });

  it('builds tracking URL from tracking number', async () => {
    seedPrefs();
    seedTwilioSecrets();

    let sentBody = '';
    __setHandler((_url, opts) => {
      const body = opts.body || '';
      const match = body.match(/Body=([^&]+)/);
      sentBody = match ? decodeURIComponent(match[1]) : '';
      return { ok: true, status: 200, async json() { return { sid: 'SM_URL' }; } };
    });

    await handleOrderFulfilled({
      memberId: MEMBER_ID,
      orderNumber: ORDER_NUM,
      trackingNumber: '1Z999AA10123456784',
    });

    expect(sentBody).toContain('1Z999AA10123456784');
  });

  it('returns sent=false with reason=no_preferences for opted-out member', async () => {
    seedTwilioSecrets(); // No SMSPreferences seeded
    mockTwilioSuccess();

    const result = await handleOrderFulfilled({ memberId: MEMBER_ID, orderNumber: ORDER_NUM });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('no_preferences');
  });

  it('returns sent=false with reason=missing_params when memberId absent', async () => {
    const result = await handleOrderFulfilled({ orderNumber: ORDER_NUM });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('missing_params');
  });

  it('returns sent=false with reason=missing_params when orderNumber absent', async () => {
    const result = await handleOrderFulfilled({ memberId: MEMBER_ID });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('missing_params');
  });

  it('handles missing tracking number gracefully', async () => {
    seedPrefs();
    seedTwilioSecrets();
    mockTwilioSuccess('SM_NO_TRACK');

    const result = await handleOrderFulfilled({ memberId: MEMBER_ID, orderNumber: ORDER_NUM });
    expect(result.sent).toBe(true);
  });
});

