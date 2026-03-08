import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __reset as resetData, __onUpdate } from '../__mocks__/wix-data.js';
import { __reset as resetSecrets, __setSecrets } from '../__mocks__/wix-secrets-backend.js';
import { __reset as resetFetch, __setHandler } from '../__mocks__/wix-fetch.js';
import { syncToESP, unsubscribeFromESP, getESPStatus } from '../../src/backend/newsletterService.web.js';

beforeEach(() => {
  resetData();
  resetSecrets();
  resetFetch();
});

// ── syncToESP with Klaviyo ─────────────────────────────────────────

describe('syncToESP — Klaviyo wired', () => {
  beforeEach(() => {
    __setSecrets({
      ESP_API_KEY: 'pk_test_abc123',
      ESP_LIST_ID: 'LIST_test_xyz',
    });
  });

  // ── Happy path ──────────────────────────────────────────────────

  it('calls Klaviyo profiles API to create/update profile', async () => {
    const calls = [];
    __setHandler((url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async json() { return { data: { id: 'profile_123' } }; } };
    });

    const result = await syncToESP('test@example.com', 'footer');

    expect(result.synced).toBe(true);
    expect(calls[0].url).toContain('klaviyo.com');
    expect(calls[0].options.method).toBe('POST');
    expect(calls[0].options.headers['Authorization']).toContain('Klaviyo-API-Key');
    expect(calls[0].options.headers['revision']).toBe('2024-10-15');
  });

  it('includes email and source in Klaviyo payload', async () => {
    const capturedBodies = [];
    __setHandler((url, options) => {
      capturedBodies.push(JSON.parse(options.body));
      return { ok: true, status: 200, async json() { return { data: { id: 'profile_123' } }; } };
    });

    await syncToESP('user@test.com', 'exit_intent_popup');

    const profileBody = capturedBodies[0];
    expect(profileBody.data.type).toBe('profile');
    expect(profileBody.data.attributes.email).toBe('user@test.com');
    expect(profileBody.data.attributes.properties.source).toBe('exit_intent_popup');
  });

  it('subscribes profile to the configured list', async () => {
    const calls = [];
    __setHandler((url, options) => {
      calls.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : null });
      return { ok: true, status: 200, async json() { return { data: { id: 'profile_123' } }; } };
    });

    await syncToESP('user@test.com', 'homepage_footer');

    // Should have at least a subscribe-to-list call
    const subscribeCall = calls.find(c => c.url.includes('/lists/') || c.url.includes('subscribe'));
    expect(subscribeCall).toBeTruthy();
  });

  // ── Error handling ──────────────────────────────────────────────

  it('returns synced:false when Klaviyo API returns error', async () => {
    __setHandler(() => ({
      ok: false,
      status: 500,
      async json() { return { errors: [{ detail: 'Internal server error' }] }; },
    }));

    const result = await syncToESP('test@example.com', 'footer');

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('esp_api_error');
  });

  it('returns synced:false when Klaviyo rate-limits (429)', async () => {
    __setHandler(() => ({
      ok: false,
      status: 429,
      async json() { return { errors: [{ detail: 'Rate limited' }] }; },
    }));

    const result = await syncToESP('test@example.com', 'footer');

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('esp_rate_limited');
  });

  it('returns synced:false when fetch throws (network error)', async () => {
    __setHandler(() => { throw new Error('Network failure'); });

    const result = await syncToESP('test@example.com', 'footer');

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('sync_failed');
  });

  it('does not leak API key in error responses', async () => {
    __setHandler(() => { throw new Error('pk_test_abc123 leaked'); });

    const result = await syncToESP('test@example.com', 'footer');

    expect(JSON.stringify(result)).not.toContain('pk_test_abc123');
  });

  // ── Input validation (still works) ────────────────────────────

  it('rejects invalid email even when ESP is configured', async () => {
    const result = await syncToESP('notanemail', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects empty email even when ESP is configured', async () => {
    const result = await syncToESP('', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects null email even when ESP is configured', async () => {
    const result = await syncToESP(null, 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('sanitizes source in Klaviyo payload', async () => {
    const capturedBodies = [];
    __setHandler((url, options) => {
      capturedBodies.push(JSON.parse(options.body));
      return { ok: true, status: 200, async json() { return { data: { id: 'p1' } }; } };
    });

    await syncToESP('test@example.com', '<script>alert("xss")</script>popup');

    const profileBody = capturedBodies[0];
    const source = profileBody.data.attributes.properties.source;
    expect(source).not.toContain('<script>');
  });
});

// ── syncToESP without ESP config (backward compat) ────────────────

describe('syncToESP — no ESP configured', () => {
  it('still returns no_esp_configured when secrets missing', async () => {
    const result = await syncToESP('test@example.com', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('no_esp_configured');
  });
});

// ── unsubscribeFromESP ────────────────────────────────────────────

describe('unsubscribeFromESP', () => {
  beforeEach(() => {
    __setSecrets({
      ESP_API_KEY: 'pk_test_abc123',
      ESP_LIST_ID: 'LIST_test_xyz',
    });
  });

  it('calls Klaviyo unsubscribe endpoint', async () => {
    let capturedUrl = null;
    __setHandler((url, options) => {
      capturedUrl = url;
      return { ok: true, status: 200, async json() { return {}; } };
    });

    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'unsub@test.com', subscribedAt: new Date() },
    ]);

    const result = await unsubscribeFromESP('unsub@test.com');

    expect(result.unsubscribed).toBe(true);
    expect(capturedUrl).toContain('klaviyo.com');
  });

  it('updates CMS record with unsubscribed status', async () => {
    __setHandler(() => ({
      ok: true, status: 200, async json() { return {}; },
    }));

    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'unsub@test.com', subscribedAt: new Date() },
    ]);

    let updated = null;
    __onUpdate((collection, item) => { updated = { collection, item }; });

    await unsubscribeFromESP('unsub@test.com');

    expect(updated).not.toBeNull();
    expect(updated.collection).toBe('NewsletterSubscribers');
    expect(updated.item.unsubscribedAt).toBeInstanceOf(Date);
    expect(updated.item.status).toBe('unsubscribed');
  });

  it('returns success even if email not in CMS (idempotent)', async () => {
    __setHandler(() => ({
      ok: true, status: 200, async json() { return {}; },
    }));

    const result = await unsubscribeFromESP('unknown@test.com');

    expect(result.unsubscribed).toBe(true);
  });

  it('rejects invalid email', async () => {
    const result = await unsubscribeFromESP('notvalid');
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects empty email', async () => {
    const result = await unsubscribeFromESP('');
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('handles Klaviyo API failure gracefully', async () => {
    __setHandler(() => ({
      ok: false, status: 500, async json() { return { errors: [] }; },
    }));

    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'unsub@test.com', subscribedAt: new Date() },
    ]);

    const result = await unsubscribeFromESP('unsub@test.com');
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('esp_api_error');
  });

  it('returns no_esp_configured when secrets missing', async () => {
    resetSecrets();
    const result = await unsubscribeFromESP('test@test.com');
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('no_esp_configured');
  });
});

// ── getESPStatus ──────────────────────────────────────────────────

describe('getESPStatus', () => {
  it('returns configured:false when no ESP key', async () => {
    const result = await getESPStatus();
    expect(result.configured).toBe(false);
    expect(result.provider).toBeUndefined();
  });

  it('returns configured:true with provider when ESP key set', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_abc123' });
    const result = await getESPStatus();
    expect(result.configured).toBe(true);
    expect(result.provider).toBe('klaviyo');
  });
});
