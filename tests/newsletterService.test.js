import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __onInsert, __reset as resetData } from './__mocks__/wix-data.js';
import { __reset as resetCrm, __getEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';
import { __reset as resetMarketing, coupons } from './__mocks__/wix-marketing-backend.js';
import { subscribeToNewsletter, syncToESP, unsubscribeFromESP, getESPStatus, captureExitIntentEmail } from '../src/backend/newsletterService.web.js';
import { __setSecrets, __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler, __reset as resetFetch } from './__mocks__/wix-fetch.js';

beforeEach(() => {
  resetData();
  resetCrm();
  resetMarketing();
  resetSecrets();
  resetFetch();
});

// ── subscribeToNewsletter ────────────────────────────────────────

describe('subscribeToNewsletter', () => {
  // ── Happy path ──────────────────────────────────────────────────

  it('returns success with discount code for valid email', async () => {
    const result = await subscribeToNewsletter('customer@example.com');
    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
  });

  it('persists subscriber to NewsletterSubscribers collection', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('jane@test.com');

    expect(inserted).not.toBeNull();
    expect(inserted.collection).toBe('NewsletterSubscribers');
    expect(inserted.item.email).toBe('jane@test.com');
    expect(inserted.item.source).toBe('exit_intent_popup');
    expect(inserted.item.subscribedAt).toBeInstanceOf(Date);
  });

  it('normalizes email to lowercase', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('USER@Example.COM');
    expect(inserted.item.email).toBe('user@example.com');
  });

  it('trims whitespace from email', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('  test@test.com  ');
    expect(inserted.item.email).toBe('test@test.com');
  });

  it('accepts custom source parameter', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('user@test.com', { source: 'homepage_footer' });
    expect(inserted.item.source).toBe('homepage_footer');
  });

  // ── Duplicate prevention ────────────────────────────────────────

  it('returns success silently for duplicate email (no info leak)', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'existing', email: 'dupe@test.com', subscribedAt: new Date() },
    ]);

    const result = await subscribeToNewsletter('dupe@test.com');
    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
  });

  it('does not insert a second record for duplicate email', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'existing', email: 'dupe@test.com', subscribedAt: new Date() },
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    await subscribeToNewsletter('dupe@test.com');
    expect(insertCount).toBe(0);
  });

  it('treats duplicate check case-insensitively', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'existing', email: 'user@test.com', subscribedAt: new Date() },
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    await subscribeToNewsletter('USER@TEST.COM');
    expect(insertCount).toBe(0);
  });

  // ── Email validation ────────────────────────────────────────────

  it('rejects empty string', async () => {
    const result = await subscribeToNewsletter('');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email is required');
  });

  it('rejects null/undefined', async () => {
    const result = await subscribeToNewsletter(null);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email is required');
  });

  it('rejects whitespace-only string', async () => {
    const result = await subscribeToNewsletter('   ');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email is required');
  });

  it('rejects email without @ sign', async () => {
    const result = await subscribeToNewsletter('notanemail');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email format');
  });

  it('rejects email without domain', async () => {
    const result = await subscribeToNewsletter('user@');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email format');
  });

  it('rejects email with spaces', async () => {
    const result = await subscribeToNewsletter('user @test.com');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email format');
  });

  // ── XSS/injection ──────────────────────────────────────────────

  it('sanitizes HTML in email (strips tags before storing)', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    // sanitize strips <script> tags → "alert(\"xss\")user@test.com" is valid email format
    const result = await subscribeToNewsletter('<script>alert("xss")</script>user@test.com');
    if (result.success && inserted) {
      expect(inserted.item.email).not.toContain('<script>');
      expect(inserted.item.email).not.toContain('</script>');
    }
  });

  it('sanitizes source parameter', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('user@test.com', { source: '<img onerror=alert(1)>popup' });
    if (inserted) {
      expect(inserted.item.source).not.toContain('<img');
    }
  });

  // ── Loyalty Bronze auto-enroll ──────────────────────────────────

  it('records loyalty tier as Bronze for new subscriber', async () => {
    let inserted = null;
    __onInsert((collection, item) => { inserted = { collection, item }; });

    await subscribeToNewsletter('loyal@test.com');
    expect(inserted.item.loyaltyTier).toBe('Bronze');
  });

  // ── Error handling ──────────────────────────────────────────────

  it('returns failure gracefully when data insert throws', async () => {
    // Seed to avoid duplicate path, then cause an insert failure
    // by making the email pass validation but using a broken mock
    const originalInsert = (await import('wix-data')).default.insert;
    const wixData = (await import('wix-data')).default;
    wixData.insert = async () => { throw new Error('Database unavailable'); };

    const result = await subscribeToNewsletter('fail@test.com');
    expect(result.success).toBe(false);

    wixData.insert = originalInsert; // restore
  });

  it('does not leak internal error details to caller', async () => {
    const wixData = (await import('wix-data')).default;
    const originalInsert = wixData.insert;
    wixData.insert = async () => { throw new Error('Sensitive DB error details'); };

    const result = await subscribeToNewsletter('error@test.com');
    expect(result.message || '').not.toContain('Sensitive');

    wixData.insert = originalInsert;
  });
});

// ── subscribeToNewsletter triggers ESP sync internally ──────────────

describe('subscribeToNewsletter — ESP sync integration', () => {
  it('calls ESP sync for new subscribers when ESP is configured', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_abc', ESP_LIST_ID: 'LIST_test' });
    const espCalls = [];
    __setHandler((url, options) => {
      espCalls.push({ url, method: options.method });
      return { ok: true, status: 200, async json() { return { data: { id: 'p1' } }; } };
    });

    const result = await subscribeToNewsletter('espuser@test.com');
    // Wait for non-blocking sync to settle
    await new Promise(r => setTimeout(r, 50));

    expect(result.success).toBe(true);
    expect(espCalls.length).toBeGreaterThan(0);
    expect(espCalls[0].url).toContain('klaviyo.com');
  });

  it('does not block subscription if ESP sync fails', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_abc' });
    __setHandler(() => { throw new Error('ESP down'); });

    const result = await subscribeToNewsletter('espfail@test.com');
    // Wait for non-blocking sync to settle
    await new Promise(r => setTimeout(r, 50));

    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
  });

  it('does not attempt ESP sync for duplicate subscribers', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'existing', email: 'dupe@test.com', subscribedAt: new Date() },
    ]);
    __setSecrets({ ESP_API_KEY: 'pk_test_abc' });
    const espCalls = [];
    __setHandler((url) => {
      espCalls.push(url);
      return { ok: true, status: 200, async json() { return { data: { id: 'p1' } }; } };
    });

    await subscribeToNewsletter('dupe@test.com');
    await new Promise(r => setTimeout(r, 50));

    expect(espCalls.length).toBe(0);
  });
});

// ── syncToESP ────────────────────────────────────────────────────────

describe('syncToESP', () => {
  it('returns skipped when no ESP config is set', async () => {
    const result = await syncToESP('test@example.com', 'exit_intent_popup');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('no_esp_configured');
  });

  it('rejects invalid email', async () => {
    const result = await syncToESP('notanemail', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects empty email', async () => {
    const result = await syncToESP('', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects null email', async () => {
    const result = await syncToESP(null, 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects undefined email', async () => {
    const result = await syncToESP(undefined, 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects numeric email', async () => {
    const result = await syncToESP(12345, 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('sanitizes source parameter', async () => {
    const result = await syncToESP('test@example.com', '<script>xss</script>');
    // Should not throw even with malicious source
    expect(result.synced).toBe(false);
  });

  it('syncs successfully when ESP is configured', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_abc', ESP_LIST_ID: 'LIST_123' });
    __setHandler((url, options) => ({
      ok: true,
      status: 200,
      async json() { return { data: { id: 'profile_1' } }; },
    }));

    const result = await syncToESP('user@example.com', 'footer');
    expect(result.synced).toBe(true);
  });

  it('sends profile creation to Klaviyo profiles endpoint', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    const calls = [];
    __setHandler((url, options) => {
      calls.push({ url, method: options.method, body: JSON.parse(options.body) });
      return { ok: true, status: 200, async json() { return { data: { id: 'p1' } }; } };
    });

    await syncToESP('test@example.com', 'homepage');
    expect(calls[0].url).toContain('/profiles/');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body.data.attributes.email).toBe('test@example.com');
    expect(calls[0].body.data.attributes.properties.source).toBe('homepage');
  });

  it('subscribes to list when listId is configured', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key', ESP_LIST_ID: 'LIST_abc' });
    const calls = [];
    __setHandler((url, options) => {
      calls.push({ url, method: options.method });
      return { ok: true, status: 200, async json() { return { data: { id: 'p1' } }; } };
    });

    await syncToESP('test@example.com', 'popup');
    // Should make 2 calls: profile creation + list subscription
    expect(calls.length).toBe(2);
    expect(calls[1].url).toContain('/lists/LIST_abc/relationships/profiles/');
  });

  it('skips list subscription when no listId', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    const calls = [];
    __setHandler((url) => {
      calls.push(url);
      return { ok: true, status: 200, async json() { return { data: { id: 'p1' } }; } };
    });

    await syncToESP('test@example.com', 'popup');
    // Only profile creation, no list subscription
    expect(calls.length).toBe(1);
  });

  it('returns rate_limited when Klaviyo returns 429 on profile', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    __setHandler(() => ({
      ok: false,
      status: 429,
      async json() { return {}; },
    }));

    const result = await syncToESP('user@example.com', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('esp_rate_limited');
  });

  it('returns api_error for non-429 failure', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    __setHandler(() => ({
      ok: false,
      status: 500,
      async json() { return {}; },
    }));

    const result = await syncToESP('user@example.com', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('esp_api_error');
  });

  it('returns rate_limited when list subscription returns 429', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key', ESP_LIST_ID: 'LIST_abc' });
    let callCount = 0;
    __setHandler(() => {
      callCount++;
      if (callCount === 1) {
        return { ok: true, status: 200, async json() { return { data: { id: 'p1' } }; } };
      }
      return { ok: false, status: 429, async json() { return {}; } };
    });

    const result = await syncToESP('user@example.com', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('esp_rate_limited');
  });

  it('normalizes email to lowercase', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    const calls = [];
    __setHandler((url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true, status: 200, async json() { return { data: { id: 'p1' } }; } };
    });

    await syncToESP('USER@EXAMPLE.COM', 'footer');
    expect(calls[0].data.attributes.email).toBe('user@example.com');
  });

  it('handles empty source gracefully', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    __setHandler(() => ({
      ok: true, status: 200,
      async json() { return { data: { id: 'p1' } }; },
    }));

    const result = await syncToESP('user@example.com', '');
    expect(result.synced).toBe(true);
  });

  it('returns sync_failed on network error', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    __setHandler(() => { throw new Error('Network timeout'); });

    const result = await syncToESP('user@example.com', 'footer');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('sync_failed');
  });
});

// ── unsubscribeFromESP ──────────────────────────────────────────────

describe('unsubscribeFromESP', () => {
  it('rejects invalid email', async () => {
    const result = await unsubscribeFromESP('notanemail');
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects null email', async () => {
    const result = await unsubscribeFromESP(null);
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('rejects empty string', async () => {
    const result = await unsubscribeFromESP('');
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('invalid_email');
  });

  it('returns no_esp_configured when secrets missing', async () => {
    const result = await unsubscribeFromESP('user@example.com');
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('no_esp_configured');
  });

  it('sends suppression request to Klaviyo', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    const calls = [];
    __setHandler((url, options) => {
      calls.push({ url, method: options.method, body: JSON.parse(options.body) });
      return { ok: true, status: 200, async json() { return {}; } };
    });

    const result = await unsubscribeFromESP('user@example.com');
    expect(result.unsubscribed).toBe(true);
    expect(calls[0].url).toContain('/suppression/');
    expect(calls[0].method).toBe('POST');
  });

  it('updates CMS record status to unsubscribed', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    __setHandler(() => ({ ok: true, status: 200, async json() { return {}; } }));

    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'user@example.com', status: 'active', subscribedAt: new Date() },
    ]);

    let updated = null;
    const wixData = (await import('wix-data')).default;
    const originalUpdate = wixData.update;
    wixData.update = async (collection, item) => {
      updated = { collection, item };
      return item;
    };

    await unsubscribeFromESP('user@example.com');
    expect(updated).not.toBeNull();
    expect(updated.collection).toBe('NewsletterSubscribers');
    expect(updated.item.status).toBe('unsubscribed');
    expect(updated.item.unsubscribedAt).toBeInstanceOf(Date);

    wixData.update = originalUpdate;
  });

  it('succeeds even when no CMS record exists', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    __setHandler(() => ({ ok: true, status: 200, async json() { return {}; } }));

    const result = await unsubscribeFromESP('nonexistent@example.com');
    expect(result.unsubscribed).toBe(true);
  });

  it('returns esp_api_error on suppression failure', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    __setHandler(() => ({ ok: false, status: 500, async json() { return {}; } }));

    const result = await unsubscribeFromESP('user@example.com');
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('esp_api_error');
  });

  it('normalizes email to lowercase', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    const calls = [];
    __setHandler((url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true, status: 200, async json() { return {}; } };
    });

    await unsubscribeFromESP('USER@EXAMPLE.COM');
    const email = calls[0].data.attributes.profiles.data[0].attributes.email;
    expect(email).toBe('user@example.com');
  });

  it('returns unsubscribe_failed on exception', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });
    __setHandler(() => { throw new Error('Network error'); });

    const result = await unsubscribeFromESP('user@example.com');
    expect(result.unsubscribed).toBe(false);
    expect(result.reason).toBe('unsubscribe_failed');
  });
});

// ── getESPStatus ────────────────────────────────────────────────────

describe('getESPStatus', () => {
  it('returns not configured when no secrets', async () => {
    const result = await getESPStatus();
    expect(result.configured).toBe(false);
    expect(result.provider).toBeUndefined();
  });

  it('returns configured with provider when ESP key exists', async () => {
    __setSecrets({ ESP_API_KEY: 'pk_test_key' });

    const result = await getESPStatus();
    expect(result.configured).toBe(true);
    expect(result.provider).toBe('klaviyo');
  });
});

// ── captureExitIntentEmail ───────────────────────────────────────

describe('captureExitIntentEmail', () => {
  it('returns success with discount code and queued count for valid email', async () => {
    const result = await captureExitIntentEmail('visitor@example.com');
    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
    expect(result.queued).toBe(3);
  });

  it('does not insert into NewsletterSubscribers (that is subscribeToNewsletter responsibility)', async () => {
    const inserts = [];
    __onInsert((collection, item) => { inserts.push({ collection, item }); });

    await captureExitIntentEmail('visitor@test.com');

    const newsletterInserts = inserts.filter(i => i.collection === 'NewsletterSubscribers');
    expect(newsletterInserts).toHaveLength(0);
  });

  it('also queues welcome_series_1 into EmailQueue', async () => {
    const inserts = [];
    __onInsert((collection, item) => { inserts.push({ collection, item }); });

    await captureExitIntentEmail('visitor@test.com');

    const emailQueueInsert = inserts.find(i => i.collection === 'EmailQueue');
    expect(emailQueueInsert).toBeDefined();
    expect(emailQueueInsert.item.templateId).toBe('welcome_series_1');
    expect(emailQueueInsert.item.recipientEmail).toBe('visitor@test.com');
    expect(emailQueueInsert.item.sequenceType).toBe('welcome');
    expect(emailQueueInsert.item.status).toBe('pending');
  });

  it('queues all 3 welcome series steps into EmailQueue', async () => {
    const inserts = [];
    __onInsert((collection, item) => { inserts.push({ collection, item }); });

    await captureExitIntentEmail('visitor@test.com');

    const emailQueueInserts = inserts.filter(i => i.collection === 'EmailQueue');
    expect(emailQueueInserts).toHaveLength(3);
    expect(emailQueueInserts[0].item.templateId).toBe('welcome_series_1');
    expect(emailQueueInserts[1].item.templateId).toBe('welcome_series_2');
    expect(emailQueueInserts[2].item.templateId).toBe('welcome_series_3');
  });

  it('sets delayed scheduledFor for steps 2 and 3', async () => {
    const inserts = [];
    __onInsert((collection, item) => { inserts.push({ collection, item }); });

    await captureExitIntentEmail('visitor@test.com');

    const emailQueueInserts = inserts.filter(i => i.collection === 'EmailQueue');
    const step1Time = emailQueueInserts[0].item.scheduledFor.getTime();
    const step2Time = emailQueueInserts[1].item.scheduledFor.getTime();
    const step3Time = emailQueueInserts[2].item.scheduledFor.getTime();

    // Step 2 should be delayed (72 hours = 259200000ms)
    expect(step2Time - step1Time).toBeGreaterThanOrEqual(259200000 - 1000);
    // Step 3 should be delayed further (168 hours = 604800000ms)
    expect(step3Time - step1Time).toBeGreaterThanOrEqual(604800000 - 1000);
  });

  it('returns error for invalid email', async () => {
    const result = await captureExitIntentEmail('bad');
    expect(result.success).toBe(false);
  });

  it('returns error for empty email', async () => {
    const result = await captureExitIntentEmail('');
    expect(result.success).toBe(false);
  });

  it('deduplicates — does not re-queue if welcome step 1 already in EmailQueue', async () => {
    __seed('EmailQueue', [
      { _id: 'eq1', recipientEmail: 'existing@test.com', sequenceType: 'welcome', sequenceStep: 1, status: 'pending' },
    ]);

    const inserts = [];
    __onInsert((collection, item) => { inserts.push({ collection, item }); });

    await captureExitIntentEmail('existing@test.com');

    // Should NOT insert into EmailQueue since step 1 already queued
    const emailQueueInserts = inserts.filter(i => i.collection === 'EmailQueue');
    expect(emailQueueInserts).toHaveLength(0);
  });

  it('still returns success for duplicate (prevents email enumeration)', async () => {
    __seed('EmailQueue', [
      { _id: 'eq1', recipientEmail: 'existing@test.com', sequenceType: 'welcome', sequenceStep: 1, status: 'pending' },
    ]);

    const result = await captureExitIntentEmail('existing@test.com');
    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
  });

  it('includes discountCode variable in welcome_series_1 queue item', async () => {
    const inserts = [];
    __onInsert((collection, item) => { inserts.push({ collection, item }); });

    await captureExitIntentEmail('visitor@test.com');

    const step1 = inserts.find(i => i.collection === 'EmailQueue' && i.item.templateId === 'welcome_series_1');
    expect(step1.item.variables).toBeDefined();
    expect(step1.item.variables.discountCode).toBe('WELCOME10');
    expect(step1.item.variables.email).toBe('visitor@test.com');
  });

  it('normalizes email to lowercase and trims whitespace', async () => {
    const inserts = [];
    __onInsert((collection, item) => { inserts.push({ collection, item }); });

    await captureExitIntentEmail('  Visitor@EXAMPLE.com  ');

    const step1 = inserts.find(i => i.collection === 'EmailQueue');
    expect(step1.item.recipientEmail).toBe('visitor@example.com');
  });

  it('returns error for null/undefined input', async () => {
    expect((await captureExitIntentEmail(null)).success).toBe(false);
    expect((await captureExitIntentEmail(undefined)).success).toBe(false);
    expect((await captureExitIntentEmail(123)).success).toBe(false);
  });

  it('returns graceful error when CMS query throws', async () => {
    // Seed a broken state — force wixData.query to throw by seeding invalid data
    // The catch-all in captureExitIntentEmail should handle this
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Override wixData query to throw
    const wixData = await import('wix-data');
    const origQuery = wixData.default.query;
    wixData.default.query = () => { throw new Error('CMS unavailable'); };

    const result = await captureExitIntentEmail('visitor@test.com');
    expect(result.success).toBe(false);
    expect(result.message).toContain('failed');

    wixData.default.query = origQuery;
    vi.restoreAllMocks();
  });
});
