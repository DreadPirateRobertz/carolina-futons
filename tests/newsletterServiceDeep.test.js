import { describe, it, expect, vi, beforeEach } from 'vitest';

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

let _espKey = 'pk_test_key';
let _listId = 'list_123';
vi.mock('wix-secrets-backend', () => ({
  getSecret: async (name) => {
    if (name === 'ESP_API_KEY') return _espKey;
    if (name === 'ESP_LIST_ID') return _listId;
    throw new Error('unknown secret');
  },
}));

let _fetchResponses = [];
let _fetchCallCount = 0;
vi.mock('wix-fetch', () => ({
  fetch: vi.fn(async () => {
    const idx = _fetchCallCount++;
    if (_fetchResponses[idx]) return _fetchResponses[idx];
    return { ok: true, status: 200, json: async () => ({ data: { id: 'profile_1' } }) };
  }),
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    skip: (n) => { filters._skip = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit' || field === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
      }
      const skip = filters._skip || 0;
      const limit = filters._limit || items.length;
      items = items.slice(skip, skip + limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

let _memberLoginEmail = 'test@example.com';
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () =>
      _memberLoginEmail ? { loginEmail: _memberLoginEmail } : null,
  },
}));

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === item._id);
      if (idx >= 0) col[idx] = { ...item };
      return item;
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _espKey = 'pk_test_key';
  _listId = 'list_123';
  _fetchResponses = [];
  _fetchCallCount = 0;
  _memberLoginEmail = 'test@example.com';
  vi.resetModules();
  mod = await import('../src/backend/newsletterService.web.js');
});

// ── subscribeToNewsletter ──────────────────────────────────────────

describe('subscribeToNewsletter', () => {
  it('rejects empty email', async () => {
    const r = await mod.subscribeToNewsletter('');
    expect(r.success).toBe(false);
    expect(r.message).toContain('required');
  });

  it('rejects null email', async () => {
    const r = await mod.subscribeToNewsletter(null);
    expect(r.success).toBe(false);
  });

  it('rejects non-string email', async () => {
    const r = await mod.subscribeToNewsletter(123);
    expect(r.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const r = await mod.subscribeToNewsletter('not-an-email');
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid email');
  });

  it('subscribes valid email', async () => {
    const r = await mod.subscribeToNewsletter('test@example.com');
    expect(r.success).toBe(true);
    expect(r.discountCode).toBe('WELCOME10');
  });

  it('inserts into NewsletterSubscribers', async () => {
    await mod.subscribeToNewsletter('test@example.com');
    expect(_collections['NewsletterSubscribers']).toHaveLength(1);
    expect(_collections['NewsletterSubscribers'][0].email).toBe('test@example.com');
    expect(_collections['NewsletterSubscribers'][0].loyaltyTier).toBe('Bronze');
  });

  it('lowercases and trims email', async () => {
    await mod.subscribeToNewsletter('  Test@EXAMPLE.com  ');
    expect(_collections['NewsletterSubscribers'][0].email).toBe('test@example.com');
  });

  it('deduplicates existing subscribers silently', async () => {
    __seed('NewsletterSubscribers', [{ _id: 'sub1', email: 'test@example.com' }]);
    const r = await mod.subscribeToNewsletter('test@example.com');
    expect(r.success).toBe(true);
    expect(r.discountCode).toBe('WELCOME10');
    // Should not insert a second record
    expect(_collections['NewsletterSubscribers']).toHaveLength(1);
  });

  it('uses source from options', async () => {
    await mod.subscribeToNewsletter('test@example.com', { source: 'footer' });
    expect(_collections['NewsletterSubscribers'][0].source).toBe('footer');
  });

  it('defaults source to exit_intent_popup', async () => {
    await mod.subscribeToNewsletter('test@example.com');
    expect(_collections['NewsletterSubscribers'][0].source).toBe('exit_intent_popup');
  });
});

// ── syncToESP ──────────────────────────────────────────────────────

describe('syncToESP', () => {
  it('rejects invalid email', async () => {
    const r = await mod.syncToESP('', 'footer');
    expect(r.synced).toBe(false);
    expect(r.reason).toBe('invalid_email');
  });

  it('returns no_esp_configured when no key', async () => {
    _espKey = null;
    vi.resetModules();
    mod = await import('../src/backend/newsletterService.web.js');
    const r = await mod.syncToESP('test@example.com', 'footer');
    expect(r.synced).toBe(false);
    expect(r.reason).toBe('no_esp_configured');
  });

  it('syncs valid email to ESP', async () => {
    const r = await mod.syncToESP('test@example.com', 'footer');
    expect(r.synced).toBe(true);
  });

  it('handles rate limiting (429)', async () => {
    _fetchResponses = [{ ok: false, status: 429 }];
    const r = await mod.syncToESP('test@example.com', 'footer');
    expect(r.synced).toBe(false);
    expect(r.reason).toBe('esp_rate_limited');
  });

  it('handles API error', async () => {
    _fetchResponses = [{ ok: false, status: 500 }];
    const r = await mod.syncToESP('test@example.com', 'footer');
    expect(r.synced).toBe(false);
    expect(r.reason).toBe('esp_api_error');
  });

  it('rejects when caller email does not match', async () => {
    _memberLoginEmail = 'other@example.com';
    const r = await mod.syncToESP('test@example.com', 'footer');
    expect(r.synced).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });

  it('rejects when no member session', async () => {
    _memberLoginEmail = null;
    const r = await mod.syncToESP('test@example.com', 'footer');
    expect(r.synced).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });
});

// ── unsubscribeFromESP ─────────────────────────────────────────────

describe('unsubscribeFromESP', () => {
  it('rejects invalid email', async () => {
    const r = await mod.unsubscribeFromESP('not-email');
    expect(r.unsubscribed).toBe(false);
    expect(r.reason).toBe('invalid_email');
  });

  it('returns no_esp_configured when no key', async () => {
    _espKey = null;
    vi.resetModules();
    mod = await import('../src/backend/newsletterService.web.js');
    const r = await mod.unsubscribeFromESP('test@example.com');
    expect(r.unsubscribed).toBe(false);
    expect(r.reason).toBe('no_esp_configured');
  });

  it('unsubscribes and updates CMS record', async () => {
    __seed('NewsletterSubscribers', [{ _id: 'sub1', email: 'test@example.com', status: 'active' }]);
    const r = await mod.unsubscribeFromESP('test@example.com');
    expect(r.unsubscribed).toBe(true);
    expect(_collections['NewsletterSubscribers'][0].status).toBe('unsubscribed');
  });

  it('succeeds even without CMS record', async () => {
    const r = await mod.unsubscribeFromESP('test@example.com');
    expect(r.unsubscribed).toBe(true);
  });

  it('handles ESP API error', async () => {
    _fetchResponses = [{ ok: false, status: 500 }];
    const r = await mod.unsubscribeFromESP('test@example.com');
    expect(r.unsubscribed).toBe(false);
    expect(r.reason).toBe('esp_api_error');
  });

  it('rejects when caller email does not match', async () => {
    _memberLoginEmail = 'other@example.com';
    const r = await mod.unsubscribeFromESP('test@example.com');
    expect(r.unsubscribed).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });

  it('rejects when no member session', async () => {
    _memberLoginEmail = null;
    const r = await mod.unsubscribeFromESP('test@example.com');
    expect(r.unsubscribed).toBe(false);
    expect(r.reason).toBe('unauthorized');
  });
});

// ── getESPStatus ───────────────────────────────────────────────────

describe('getESPStatus', () => {
  it('returns configured with provider when key exists', async () => {
    const r = await mod.getESPStatus();
    expect(r.configured).toBe(true);
    expect(r.provider).toBe('klaviyo');
  });

  it('returns not configured when no key', async () => {
    _espKey = null;
    vi.resetModules();
    mod = await import('../src/backend/newsletterService.web.js');
    const r = await mod.getESPStatus();
    expect(r.configured).toBe(false);
  });
});

// ── captureExitIntentEmail ─────────────────────────────────────────

describe('captureExitIntentEmail', () => {
  it('rejects empty email', async () => {
    const r = await mod.captureExitIntentEmail('');
    expect(r.success).toBe(false);
  });

  it('rejects null email', async () => {
    const r = await mod.captureExitIntentEmail(null);
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const r = await mod.captureExitIntentEmail('bad-email');
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid email');
  });

  it('queues 3 welcome series emails', async () => {
    const r = await mod.captureExitIntentEmail('test@example.com');
    expect(r.success).toBe(true);
    expect(r.discountCode).toBe('WELCOME10');
    expect(r.queued).toBe(3);
    expect(_collections['EmailQueue']).toHaveLength(3);
  });

  it('queued emails have correct template IDs', async () => {
    await mod.captureExitIntentEmail('test@example.com');
    const templates = _collections['EmailQueue'].map(e => e.templateId);
    expect(templates).toContain('welcome_series_1');
    expect(templates).toContain('welcome_series_2');
    expect(templates).toContain('welcome_series_3');
  });

  it('queued emails include discount code in variables', async () => {
    await mod.captureExitIntentEmail('test@example.com');
    expect(_collections['EmailQueue'][0].variables.discountCode).toBe('WELCOME10');
  });

  it('deduplicates already queued emails', async () => {
    __seed('EmailQueue', [{
      _id: 'eq1', recipientEmail: 'test@example.com',
      sequenceType: 'welcome', sequenceStep: 1,
    }]);
    const r = await mod.captureExitIntentEmail('test@example.com');
    expect(r.success).toBe(true);
    expect(r.queued).toBe(0);
  });

  it('lowercases and trims email', async () => {
    await mod.captureExitIntentEmail('  Test@EXAMPLE.com  ');
    expect(_collections['EmailQueue'][0].recipientEmail).toBe('test@example.com');
  });
});
