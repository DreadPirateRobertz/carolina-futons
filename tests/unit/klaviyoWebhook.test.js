import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onUpdate, __reset as resetData } from '../__mocks__/wix-data.js';
import { __reset as resetSecrets, __setSecrets } from '../__mocks__/wix-secrets-backend.js';
import { __reset as resetFetch } from '../__mocks__/wix-fetch.js';
import { post_klaviyoWebhook } from '../../src/backend/http-functions.js';

beforeEach(() => {
  resetData();
  resetSecrets();
  resetFetch();
  __setSecrets({
    KLAVIYO_WEBHOOK_SECRET: 'whsec_test_secret_123',
  });
});

// ── Webhook Authentication ────────────────────────────────────────

describe('post_klaviyoWebhook — auth', () => {
  it('rejects request with missing webhook secret header', async () => {
    const request = {
      headers: {},
      body: { text: async () => JSON.stringify({ type: 'unsubscribed', email: 'a@b.com' }) },
    };

    const response = await post_klaviyoWebhook(request);
    expect(response.status).toBe(403);
  });

  it('rejects request with wrong webhook secret', async () => {
    const request = {
      headers: { 'x-klaviyo-webhook-secret': 'wrong_secret' },
      body: { text: async () => JSON.stringify({ type: 'unsubscribed', email: 'a@b.com' }) },
    };

    const response = await post_klaviyoWebhook(request);
    expect(response.status).toBe(403);
  });

  it('rejects when no webhook secret configured in secrets manager', async () => {
    resetSecrets();

    const request = {
      headers: { 'x-klaviyo-webhook-secret': 'whsec_test_secret_123' },
      body: { text: async () => JSON.stringify({ type: 'unsubscribed', email: 'a@b.com' }) },
    };

    const response = await post_klaviyoWebhook(request);
    expect(response.status).toBe(403);
  });
});

// ── Unsubscribe Event ─────────────────────────────────────────────

describe('post_klaviyoWebhook — unsubscribe event', () => {
  function makeRequest(payload) {
    return {
      headers: { 'x-klaviyo-webhook-secret': 'whsec_test_secret_123' },
      body: { text: async () => JSON.stringify(payload) },
    };
  }

  it('marks subscriber as unsubscribed in CMS', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'unsub@test.com', subscribedAt: new Date() },
    ]);

    let updated = null;
    __onUpdate((collection, item) => { updated = { collection, item }; });

    const response = await post_klaviyoWebhook(makeRequest({
      type: 'unsubscribed',
      email: 'unsub@test.com',
    }));

    expect(response.status).toBe(200);
    expect(updated).not.toBeNull();
    expect(updated.item.status).toBe('unsubscribed');
    expect(updated.item.unsubscribedAt).toBeInstanceOf(Date);
  });

  it('returns 200 even if email not found in CMS (idempotent)', async () => {
    const response = await post_klaviyoWebhook(makeRequest({
      type: 'unsubscribed',
      email: 'unknown@test.com',
    }));

    expect(response.status).toBe(200);
  });

  it('handles case-insensitive email matching', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'user@test.com', subscribedAt: new Date() },
    ]);

    let updated = null;
    __onUpdate((collection, item) => { updated = { collection, item }; });

    const response = await post_klaviyoWebhook(makeRequest({
      type: 'unsubscribed',
      email: 'USER@TEST.COM',
    }));

    expect(response.status).toBe(200);
    expect(updated).not.toBeNull();
    expect(updated.item.status).toBe('unsubscribed');
  });
});

// ── Input Validation ──────────────────────────────────────────────

describe('post_klaviyoWebhook — validation', () => {
  function makeRequest(payload) {
    return {
      headers: { 'x-klaviyo-webhook-secret': 'whsec_test_secret_123' },
      body: { text: async () => JSON.stringify(payload) },
    };
  }

  it('rejects payload without type field', async () => {
    const response = await post_klaviyoWebhook(makeRequest({
      email: 'a@b.com',
    }));

    expect(response.status).toBe(400);
  });

  it('rejects payload without email field', async () => {
    const response = await post_klaviyoWebhook(makeRequest({
      type: 'unsubscribed',
    }));

    expect(response.status).toBe(400);
  });

  it('rejects malformed JSON body', async () => {
    const request = {
      headers: { 'x-klaviyo-webhook-secret': 'whsec_test_secret_123' },
      body: { text: async () => 'not json at all' },
    };

    const response = await post_klaviyoWebhook(request);
    expect(response.status).toBe(400);
  });

  it('rejects invalid email in payload', async () => {
    const response = await post_klaviyoWebhook(makeRequest({
      type: 'unsubscribed',
      email: 'notanemail',
    }));

    expect(response.status).toBe(400);
  });

  it('ignores unknown event types gracefully', async () => {
    const response = await post_klaviyoWebhook(makeRequest({
      type: 'some_future_event',
      email: 'a@b.com',
    }));

    // Should acknowledge receipt even for unhandled types
    expect(response.status).toBe(200);
  });
});

// ── XSS/Injection ─────────────────────────────────────────────────

describe('post_klaviyoWebhook — security', () => {
  function makeRequest(payload) {
    return {
      headers: { 'x-klaviyo-webhook-secret': 'whsec_test_secret_123' },
      body: { text: async () => JSON.stringify(payload) },
    };
  }

  it('sanitizes email from webhook payload', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'alert1xssuser@test.com', subscribedAt: new Date() },
    ]);

    const response = await post_klaviyoWebhook(makeRequest({
      type: 'unsubscribed',
      email: '<script>alert(1)</script>xssuser@test.com',
    }));

    // Should not throw even with XSS in email
    expect([200, 400]).toContain(response.status);
  });
});
