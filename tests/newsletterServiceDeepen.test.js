import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateEmail: (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },
}));

vi.mock('wix-data', () => import('./__mocks__/wix-data.js'));

let _secretOverrides = {};
vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async (key) => {
    if (key in _secretOverrides) return _secretOverrides[key];
    if (key === 'ESP_API_KEY') return 'pk_test_key';
    if (key === 'ESP_LIST_ID') return 'list-123';
    return '';
  }),
}));

let _fetchResponse = { ok: true, status: 200, json: async () => ({ data: { id: 'profile-123' } }) };
vi.mock('wix-fetch', () => ({
  fetch: vi.fn(async () => _fetchResponse),
}));

import { __seed, __reset, __onInsert } from './__mocks__/wix-data.js';
import {
  subscribeToNewsletter,
  captureExitIntentEmail,
  syncToESP,
  unsubscribeFromESP,
  getESPStatus,
} from '../src/backend/newsletterService.web.js';

beforeEach(() => {
  __reset();
  __seed('NewsletterSubscribers', []);
  __seed('EmailQueue', []);
  _secretOverrides = {};
  _fetchResponse = { ok: true, status: 200, json: async () => ({ data: { id: 'profile-123' } }) };
  vi.clearAllMocks();
});

// ── subscribeToNewsletter ──────────────────────────────────────────

describe('subscribeToNewsletter', () => {
  it('inserts new subscriber with Bronze tier and returns discount code', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const res = await subscribeToNewsletter('Test@Example.com', { source: 'footer' });

    expect(res).toEqual({ success: true, discountCode: 'WELCOME10' });
    const sub = inserts.find(i => i.col === 'NewsletterSubscribers');
    expect(sub).toBeTruthy();
    expect(sub.item.email).toBe('test@example.com');
    expect(sub.item.loyaltyTier).toBe('Bronze');
    expect(sub.item.source).toBe('footer');
  });

  it('dedup: existing subscriber gets success + discount, no insert', async () => {
    __seed('NewsletterSubscribers', [{ _id: 's1', email: 'dup@test.com' }]);
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const res = await subscribeToNewsletter('dup@test.com');

    expect(res).toEqual({ success: true, discountCode: 'WELCOME10' });
    expect(inserts.filter(i => i.col === 'NewsletterSubscribers')).toHaveLength(0);
  });

  it('defaults source to exit_intent_popup when options.source missing', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    await subscribeToNewsletter('new@test.com');

    const sub = inserts.find(i => i.col === 'NewsletterSubscribers');
    expect(sub.item.source).toBe('exit_intent_popup');
  });

  it('defaults source when options is undefined', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    await subscribeToNewsletter('new@test.com', undefined);

    const sub = inserts.find(i => i.col === 'NewsletterSubscribers');
    expect(sub.item.source).toBe('exit_intent_popup');
  });

  it('rejects empty string email', async () => {
    const res = await subscribeToNewsletter('');
    expect(res.success).toBe(false);
    expect(res.message).toBe('Email is required');
  });

  it('rejects null email', async () => {
    const res = await subscribeToNewsletter(null);
    expect(res.success).toBe(false);
    expect(res.message).toBe('Email is required');
  });

  it('rejects non-string email (number)', async () => {
    const res = await subscribeToNewsletter(12345);
    expect(res.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const res = await subscribeToNewsletter('not-an-email');
    expect(res.success).toBe(false);
    expect(res.message).toBe('Invalid email format');
  });

  it('sanitizes and lowercases email', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    await subscribeToNewsletter('  UPPER@CASE.COM  ');

    const sub = inserts.find(i => i.col === 'NewsletterSubscribers');
    expect(sub.item.email).toBe('upper@case.com');
  });

  it('ESP sync failure does not break subscription', async () => {
    _fetchResponse = { ok: false, status: 500, json: async () => ({}) };

    const res = await subscribeToNewsletter('esp-fail@test.com');
    expect(res).toEqual({ success: true, discountCode: 'WELCOME10' });
  });
});

// ── captureExitIntentEmail ─────────────────────────────────────────

describe('captureExitIntentEmail', () => {
  it('queues 3 welcome steps and returns discount code', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const res = await captureExitIntentEmail('visitor@test.com');

    expect(res).toEqual({ success: true, discountCode: 'WELCOME10', queued: 3 });
    const queued = inserts.filter(i => i.col === 'EmailQueue');
    expect(queued).toHaveLength(3);
    expect(queued[0].item.sequenceStep).toBe(1);
    expect(queued[1].item.sequenceStep).toBe(2);
    expect(queued[2].item.sequenceStep).toBe(3);
  });

  it('step scheduling: 0h, 72h, 168h offsets from now', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const before = Date.now();
    await captureExitIntentEmail('timing@test.com');
    const after = Date.now();

    const queued = inserts.filter(i => i.col === 'EmailQueue');
    const t1 = queued[0].item.scheduledFor.getTime();
    const t2 = queued[1].item.scheduledFor.getTime();
    const t3 = queued[2].item.scheduledFor.getTime();

    // Step 1 is immediate (within test execution window)
    expect(t1).toBeGreaterThanOrEqual(before);
    expect(t1).toBeLessThanOrEqual(after);

    // Step 2 is 72 hours later
    const h72 = 72 * 60 * 60 * 1000;
    expect(t2 - t1).toBe(h72);

    // Step 3 is 168 hours later
    const h168 = 168 * 60 * 60 * 1000;
    expect(t3 - t1).toBe(h168);
  });

  it('dedup: already-queued email returns queued: 0', async () => {
    __seed('EmailQueue', [{
      _id: 'eq1',
      recipientEmail: 'already@test.com',
      sequenceType: 'welcome',
      sequenceStep: 1,
    }]);

    const res = await captureExitIntentEmail('already@test.com');
    expect(res).toEqual({ success: true, discountCode: 'WELCOME10', queued: 0 });
  });

  it('deduplicates against EmailQueue, not NewsletterSubscribers', async () => {
    // Email exists in NewsletterSubscribers but NOT in EmailQueue
    __seed('NewsletterSubscribers', [{ _id: 's1', email: 'sub@test.com' }]);
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    const res = await captureExitIntentEmail('sub@test.com');
    expect(res.queued).toBe(3);
    expect(inserts.filter(i => i.col === 'EmailQueue')).toHaveLength(3);
  });

  it('queued items have correct template IDs', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    await captureExitIntentEmail('tmpl@test.com');

    const queued = inserts.filter(i => i.col === 'EmailQueue');
    expect(queued[0].item.templateId).toBe('welcome_series_1');
    expect(queued[1].item.templateId).toBe('welcome_series_2');
    expect(queued[2].item.templateId).toBe('welcome_series_3');
  });

  it('queued items carry WELCOME10 discount in variables', async () => {
    const inserts = [];
    __onInsert((col, item) => inserts.push({ col, item }));

    await captureExitIntentEmail('vars@test.com');

    const queued = inserts.filter(i => i.col === 'EmailQueue');
    for (const q of queued) {
      expect(q.item.variables.discountCode).toBe('WELCOME10');
    }
  });

  it('rejects invalid email', async () => {
    const res = await captureExitIntentEmail('bad');
    expect(res.success).toBe(false);
    expect(res.message).toBe('Invalid email format');
  });

  it('rejects null email', async () => {
    const res = await captureExitIntentEmail(null);
    expect(res.success).toBe(false);
    expect(res.message).toBe('Email is required');
  });

  it('rejects empty string email', async () => {
    const res = await captureExitIntentEmail('  ');
    expect(res.success).toBe(false);
    expect(res.message).toBe('Email is required');
  });
});

// ── unsubscribeFromESP ─────────────────────────────────────────────

describe('unsubscribeFromESP', () => {
  it('invalid email returns invalid_email reason', async () => {
    const res = await unsubscribeFromESP('not-email');
    expect(res).toEqual({ unsubscribed: false, reason: 'invalid_email' });
  });

  it('null email returns invalid_email', async () => {
    const res = await unsubscribeFromESP(null);
    expect(res).toEqual({ unsubscribed: false, reason: 'invalid_email' });
  });

  it('no ESP key returns no_esp_configured', async () => {
    _secretOverrides.ESP_API_KEY = '';
    const res = await unsubscribeFromESP('test@test.com');
    expect(res).toEqual({ unsubscribed: false, reason: 'no_esp_configured' });
  });

  it('suppress API error returns esp_api_error', async () => {
    _fetchResponse = { ok: false, status: 500, json: async () => ({}) };
    const res = await unsubscribeFromESP('test@test.com');
    expect(res).toEqual({ unsubscribed: false, reason: 'esp_api_error' });
  });

  it('updates CMS record status to unsubscribed', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'ns1', email: 'unsub@test.com', status: 'active' },
    ]);
    const updates = [];
    const { __onUpdate } = await import('./__mocks__/wix-data.js');
    __onUpdate((col, item) => updates.push({ col, item }));

    const res = await unsubscribeFromESP('unsub@test.com');

    expect(res).toEqual({ unsubscribed: true });
    const upd = updates.find(u => u.col === 'NewsletterSubscribers');
    expect(upd).toBeTruthy();
    expect(upd.item.status).toBe('unsubscribed');
    expect(upd.item.unsubscribedAt).toBeInstanceOf(Date);
  });

  it('handles no existing CMS record gracefully', async () => {
    // No records seeded — suppress succeeds, no update needed
    const res = await unsubscribeFromESP('nobody@test.com');
    expect(res).toEqual({ unsubscribed: true });
  });

  it('lowercases and trims email before suppress', async () => {
    const { fetch } = await import('wix-fetch');

    await unsubscribeFromESP('  UPPER@Test.COM  ');

    const call = fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.data.attributes.profiles.data[0].attributes.email).toBe('upper@test.com');
  });
});

// ── syncToESP ──────────────────────────────────────────────────────

describe('syncToESP', () => {
  it('successful sync returns { synced: true }', async () => {
    const res = await syncToESP('sync@test.com', 'footer');
    expect(res).toEqual({ synced: true });
  });

  it('rate limited (429) returns esp_rate_limited', async () => {
    _fetchResponse = { ok: false, status: 429, json: async () => ({}) };
    const res = await syncToESP('sync@test.com', 'footer');
    expect(res).toEqual({ synced: false, reason: 'esp_rate_limited' });
  });

  it('API error (non-429) returns esp_api_error', async () => {
    _fetchResponse = { ok: false, status: 500, json: async () => ({}) };
    const res = await syncToESP('sync@test.com', 'footer');
    expect(res).toEqual({ synced: false, reason: 'esp_api_error' });
  });

  it('no ESP key returns no_esp_configured', async () => {
    _secretOverrides.ESP_API_KEY = '';
    const res = await syncToESP('sync@test.com', 'footer');
    expect(res).toEqual({ synced: false, reason: 'no_esp_configured' });
  });

  it('invalid email returns invalid_email', async () => {
    const res = await syncToESP('bad', 'footer');
    expect(res).toEqual({ synced: false, reason: 'invalid_email' });
  });

  it('null email returns invalid_email', async () => {
    const res = await syncToESP(null, 'footer');
    expect(res).toEqual({ synced: false, reason: 'invalid_email' });
  });

  it('list subscription step skipped when no listId', async () => {
    _secretOverrides.ESP_LIST_ID = '';
    const { fetch } = await import('wix-fetch');
    const res = await syncToESP('sync@test.com', 'footer');
    expect(res).toEqual({ synced: true });
    // Only 1 fetch call (profile create), no list subscribe
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain('/profiles/');
  });

  it('makes profile create call with correct headers', async () => {
    const { fetch } = await import('wix-fetch');

    await syncToESP('headers@test.com', 'footer');

    const call = fetch.mock.calls[0];
    expect(call[1].headers['Authorization']).toBe('Klaviyo-API-Key pk_test_key');
    expect(call[1].headers['revision']).toBe('2024-10-15');
  });

  it('rate limited on list subscribe returns esp_rate_limited', async () => {
    const { fetch } = await import('wix-fetch');
    let callCount = 0;
    fetch.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: true, status: 200, json: async () => ({ data: { id: 'p-1' } }) };
      }
      return { ok: false, status: 429, json: async () => ({}) };
    });

    try {
      const res = await syncToESP('sync@test.com', 'footer');
      expect(res).toEqual({ synced: false, reason: 'esp_rate_limited' });
    } finally {
      fetch.mockImplementation(async () => _fetchResponse);
    }
  });
});

// ── getESPStatus ───────────────────────────────────────────────────

describe('getESPStatus', () => {
  it('returns configured: true with provider when key exists', async () => {
    const res = await getESPStatus();
    expect(res).toEqual({ configured: true, provider: 'klaviyo' });
  });

  it('returns configured: false when no key', async () => {
    _secretOverrides.ESP_API_KEY = '';
    const res = await getESPStatus();
    expect(res).toEqual({ configured: false });
  });
});
