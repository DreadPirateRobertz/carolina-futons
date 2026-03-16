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
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
      }
      const limit = filters._limit || items.length;
      items = items.slice(0, limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/liveChatService.web.js');
});

// ── isOnline ───────────────────────────────────────────────────────

describe('isOnline', () => {
  it('returns online status', async () => {
    const r = await mod.isOnline();
    expect(typeof r.online).toBe('boolean');
    expect(typeof r.message).toBe('string');
  });

  it('includes message text', async () => {
    const r = await mod.isOnline();
    expect(r.message.length).toBeGreaterThan(0);
  });
});

// ── getCannedResponses ─────────────────────────────────────────────

describe('getCannedResponses', () => {
  it('returns all canned response topics', async () => {
    const r = await mod.getCannedResponses();
    expect(r.length).toBeGreaterThan(0);
    const keys = r.map(item => item.key);
    expect(keys).toContain('shipping');
    expect(keys).toContain('returns');
    expect(keys).toContain('assembly');
    expect(keys).toContain('fabrics');
    expect(keys).toContain('hours');
    expect(keys).toContain('financing');
  });

  it('each topic has key and label', async () => {
    const r = await mod.getCannedResponses();
    for (const item of r) {
      expect(item.key).toBeTruthy();
      expect(item.label).toBeTruthy();
    }
  });
});

// ── getCannedResponse ──────────────────────────────────────────────

describe('getCannedResponse', () => {
  it('returns null for null topic', async () => {
    const r = await mod.getCannedResponse(null);
    expect(r).toBeNull();
  });

  it('returns null for unknown topic', async () => {
    const r = await mod.getCannedResponse('unknown-topic');
    expect(r).toBeNull();
  });

  it('returns shipping response', async () => {
    const r = await mod.getCannedResponse('shipping');
    expect(r.label).toBe('Shipping & Delivery');
    expect(r.response).toContain('5-10 business days');
  });

  it('returns returns response', async () => {
    const r = await mod.getCannedResponse('returns');
    expect(r.label).toBe('Returns & Exchanges');
    expect(r.response).toContain('30 days');
  });

  it('returns assembly response', async () => {
    const r = await mod.getCannedResponse('assembly');
    expect(r.response).toContain('30-45 minutes');
  });

  it('returns financing response', async () => {
    const r = await mod.getCannedResponse('financing');
    expect(r.response).toContain('0% APR');
  });
});

// ── sendMessage ────────────────────────────────────────────────────

describe('sendMessage', () => {
  it('rejects missing session ID', async () => {
    const r = await mod.sendMessage({ message: 'Hello' });
    expect(r.success).toBe(false);
  });

  it('rejects missing message', async () => {
    const r = await mod.sendMessage({ sessionId: 'sess1' });
    expect(r.success).toBe(false);
  });

  it('sends valid message', async () => {
    const r = await mod.sendMessage({ sessionId: 'sess1', message: 'Hello, I need help' });
    expect(r.success).toBe(true);
    expect(r.messageId).toBeTruthy();
    expect(_collections['ChatMessages']).toHaveLength(1);
    expect(_collections['ChatMessages'][0].message).toBe('Hello, I need help');
  });

  it('stores sender info', async () => {
    await mod.sendMessage({ sessionId: 'sess1', message: 'Hi', senderName: 'Jane', senderEmail: 'jane@test.com' });
    expect(_collections['ChatMessages'][0].senderName).toBe('Jane');
    expect(_collections['ChatMessages'][0].senderEmail).toBe('jane@test.com');
  });

  it('strips HTML from message', async () => {
    await mod.sendMessage({ sessionId: 'sess1', message: '<script>alert("xss")</script>Help me' });
    expect(_collections['ChatMessages'][0].message).not.toContain('<script>');
  });

  it('ignores invalid email', async () => {
    await mod.sendMessage({ sessionId: 'sess1', message: 'Hi', senderEmail: 'bad' });
    expect(_collections['ChatMessages'][0].senderEmail).toBe('');
  });
});

// ── getChatHistory ─────────────────────────────────────────────────

describe('getChatHistory', () => {
  it('returns empty for no session', async () => {
    const r = await mod.getChatHistory('');
    expect(r).toEqual([]);
  });

  it('returns messages for session', async () => {
    __seed('ChatMessages', [
      { _id: 'm1', sessionId: 'sess1', message: 'Hello', sender: 'customer', timestamp: new Date() },
      { _id: 'm2', sessionId: 'sess1', message: 'Hi there!', sender: 'agent', timestamp: new Date() },
      { _id: 'm3', sessionId: 'sess2', message: 'Other', sender: 'customer', timestamp: new Date() },
    ]);
    const r = await mod.getChatHistory('sess1');
    expect(r).toHaveLength(2);
  });

  it('caps limit at 200', async () => {
    const r = await mod.getChatHistory('sess1', 500);
    expect(r).toEqual([]);
  });
});

// ── createSupportTicket ────────────────────────────────────────────

describe('createSupportTicket', () => {
  it('rejects missing email', async () => {
    const r = await mod.createSupportTicket({ message: 'Help' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('email');
  });

  it('rejects invalid email', async () => {
    const r = await mod.createSupportTicket({ email: 'bad', message: 'Help' });
    expect(r.success).toBe(false);
  });

  it('rejects missing message', async () => {
    const r = await mod.createSupportTicket({ email: 'test@example.com' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Message');
  });

  it('creates ticket', async () => {
    const r = await mod.createSupportTicket({
      name: 'Jane', email: 'jane@test.com', message: 'Need help with order', sessionId: 'sess1',
    });
    expect(r.success).toBe(true);
    expect(r.ticketId).toBeTruthy();
    expect(_collections['SupportTickets']).toHaveLength(1);
    expect(_collections['SupportTickets'][0].status).toBe('open');
    expect(_collections['SupportTickets'][0].source).toBe('live_chat');
  });
});
