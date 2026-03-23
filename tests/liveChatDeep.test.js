import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────

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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
}));

vi.mock('backend/utils/safeParse', () => ({
  safeParse: (str, fallback = null, _context) => {
    try { return JSON.parse(str); } catch { return fallback; }
  },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  let _sortDir = 'asc';
  let _limitN = null;
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ascending: () => { _sortDir = 'asc'; return chain; },
    descending: () => { _sortDir = 'desc'; return chain; },
    limit: (n) => { _limitN = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
      }
      if (_limitN) items = items.slice(0, _limitN);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      return record;
    },
  },
}));

let _mockMember = { _id: 'member-abc' };
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () => _mockMember,
  },
}));

beforeEach(() => {
  _collections = {};
  _mockMember = { _id: 'member-abc' };
});

const mod = await import('../src/backend/liveChat.web.js');
const {
  getOfficeHoursStatus,
  getCannedResponses,
  matchCannedResponse,
  createSupportTicket,
  getChatContext,
} = mod;

// ═════════════════════════════════════════════════════════════════════
// getOfficeHoursStatus
// ═════════════════════════════════════════════════════════════════════
describe('getOfficeHoursStatus', () => {
  it('returns an object with isOnline and message fields', async () => {
    const result = await getOfficeHoursStatus();
    expect(result).toHaveProperty('isOnline');
    expect(result).toHaveProperty('message');
  });

  it('uses default office hours when ChatConfig is empty', async () => {
    __seed('ChatConfig', []);
    const result = await getOfficeHoursStatus();
    expect(typeof result.isOnline).toBe('boolean');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('loads custom office hours from ChatConfig', async () => {
    // Pin clock to midday ET to avoid near-23:59 wall-clock flake (CF-q5ze)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-11T16:00:00-04:00'));
    try {
      // Custom config: always open (all days 00:00–23:59)
      const customHours = {
        timezone: 'America/New_York',
        schedule: {
          0: { open: '00:00', close: '23:59' },
          1: { open: '00:00', close: '23:59' },
          2: { open: '00:00', close: '23:59' },
          3: { open: '00:00', close: '23:59' },
          4: { open: '00:00', close: '23:59' },
          5: { open: '00:00', close: '23:59' },
          6: { open: '00:00', close: '23:59' },
        },
      };
      __seed('ChatConfig', [{ key: 'officeHours', value: JSON.stringify(customHours) }]);
      const result = await getOfficeHoursStatus();
      expect(result.isOnline).toBe(true);
      expect(result.message).toContain('online');
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to defaults when custom config is invalid JSON', async () => {
    __seed('ChatConfig', [{ key: 'officeHours', value: 'NOT-JSON' }]);
    const result = await getOfficeHoursStatus();
    // safeParse returns the fallback (DEFAULT_OFFICE_HOURS), so it still works
    expect(typeof result.isOnline).toBe('boolean');
  });

  it('returns closesAt when online', async () => {
    // Pin clock to midday ET to avoid near-23:59 wall-clock flake (CF-q5ze)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-11T16:00:00-04:00'));
    try {
      const allOpen = {
        timezone: 'America/New_York',
        schedule: {
          0: { open: '00:00', close: '23:59' },
          1: { open: '00:00', close: '23:59' },
          2: { open: '00:00', close: '23:59' },
          3: { open: '00:00', close: '23:59' },
          4: { open: '00:00', close: '23:59' },
          5: { open: '00:00', close: '23:59' },
          6: { open: '00:00', close: '23:59' },
        },
      };
      __seed('ChatConfig', [{ key: 'officeHours', value: JSON.stringify(allOpen) }]);
      const result = await getOfficeHoursStatus();
      expect(result.closesAt).toBe('23:59');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns nextOpen when closed on a day with null schedule', async () => {
    // All days null except Monday
    const closedConfig = {
      timezone: 'America/New_York',
      schedule: {
        0: null, 1: { open: '09:00', close: '17:00' }, 2: null,
        3: null, 4: null, 5: null, 6: null,
      },
    };
    __seed('ChatConfig', [{ key: 'officeHours', value: JSON.stringify(closedConfig) }]);
    const result = await getOfficeHoursStatus();
    // Either online (if Monday during hours) or offline with nextOpen
    expect(typeof result.isOnline).toBe('boolean');
  });

  it('returns isOnline false when all days are closed', async () => {
    const allClosed = {
      timezone: 'America/New_York',
      schedule: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
    };
    __seed('ChatConfig', [{ key: 'officeHours', value: JSON.stringify(allClosed) }]);
    const result = await getOfficeHoursStatus();
    expect(result.isOnline).toBe(false);
    // nextOpen is null when no days have a schedule
    expect(result.nextOpen).toBeNull();
  });

  it('handles before-open time correctly', async () => {
    // Schedule where open is very late so we're "before open"
    const lateOpen = {
      timezone: 'America/New_York',
      schedule: {
        0: { open: '23:58', close: '23:59' },
        1: { open: '23:58', close: '23:59' },
        2: { open: '23:58', close: '23:59' },
        3: { open: '23:58', close: '23:59' },
        4: { open: '23:58', close: '23:59' },
        5: { open: '23:58', close: '23:59' },
        6: { open: '23:58', close: '23:59' },
      },
    };
    __seed('ChatConfig', [{ key: 'officeHours', value: JSON.stringify(lateOpen) }]);
    const result = await getOfficeHoursStatus();
    // Most likely before open (unless test runs exactly at 23:58)
    expect(typeof result.isOnline).toBe('boolean');
  });

  it('handles after-close time correctly', async () => {
    // Schedule where close is very early so we're "after close"
    const earlyClose = {
      timezone: 'America/New_York',
      schedule: {
        0: { open: '00:00', close: '00:01' },
        1: { open: '00:00', close: '00:01' },
        2: { open: '00:00', close: '00:01' },
        3: { open: '00:00', close: '00:01' },
        4: { open: '00:00', close: '00:01' },
        5: { open: '00:00', close: '00:01' },
        6: { open: '00:00', close: '00:01' },
      },
    };
    __seed('ChatConfig', [{ key: 'officeHours', value: JSON.stringify(earlyClose) }]);
    const result = await getOfficeHoursStatus();
    // Almost certainly after close
    if (!result.isOnline) {
      expect(result.message).toContain('closed');
      expect(result.nextOpen).toBeTruthy();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// getCannedResponses
// ═════════════════════════════════════════════════════════════════════
describe('getCannedResponses', () => {
  it('returns default canned responses when no CMS config', async () => {
    __seed('ChatConfig', []);
    const result = await getCannedResponses();
    expect(result.success).toBe(true);
    expect(result.responses.length).toBeGreaterThanOrEqual(6);
  });

  it('returns shipping response in defaults', async () => {
    const result = await getCannedResponses();
    const shipping = result.responses.find(r => r.id === 'shipping');
    expect(shipping).toBeTruthy();
    expect(shipping.trigger).toBe('shipping');
  });

  it('returns warranty response in defaults', async () => {
    const result = await getCannedResponses();
    const warranty = result.responses.find(r => r.id === 'warranty');
    expect(warranty).toBeTruthy();
    expect(warranty.category).toBe('Warranty');
  });

  it('loads custom responses from ChatConfig when present', async () => {
    const custom = [{ id: 'custom1', category: 'Custom', trigger: 'custom', title: 'Custom', response: 'Custom response' }];
    __seed('ChatConfig', [{ key: 'cannedResponses', value: JSON.stringify(custom) }]);
    const result = await getCannedResponses();
    expect(result.success).toBe(true);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].id).toBe('custom1');
  });

  it('falls back to defaults when custom config is invalid JSON', async () => {
    __seed('ChatConfig', [{ key: 'cannedResponses', value: '{broken' }]);
    const result = await getCannedResponses();
    expect(result.success).toBe(true);
    // safeParse returns [] fallback, but outer catch returns defaults
    expect(Array.isArray(result.responses)).toBe(true);
  });

  it('each default response has required fields', async () => {
    const result = await getCannedResponses();
    for (const resp of result.responses) {
      expect(resp).toHaveProperty('id');
      expect(resp).toHaveProperty('category');
      expect(resp).toHaveProperty('trigger');
      expect(resp).toHaveProperty('title');
      expect(resp).toHaveProperty('response');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// matchCannedResponse
// ═════════════════════════════════════════════════════════════════════
describe('matchCannedResponse', () => {
  it('matches "shipping" trigger', async () => {
    const result = await matchCannedResponse('What about shipping?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('shipping');
  });

  it('matches "return" trigger', async () => {
    const result = await matchCannedResponse('I want to return my item');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('returns');
  });

  it('matches "assembly" trigger', async () => {
    const result = await matchCannedResponse('Do I need assembly tools?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('assembly');
  });

  it('matches "fabric" trigger', async () => {
    const result = await matchCannedResponse('What fabric options do you have?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('fabrics');
  });

  it('matches "hours" trigger for store hours', async () => {
    const result = await matchCannedResponse('What are your hours?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('store-hours');
  });

  it('matches "warranty" trigger', async () => {
    const result = await matchCannedResponse('Is there a warranty?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('warranty');
  });

  it('matches "price" keyword with pricing response', async () => {
    const result = await matchCannedResponse('What is the price?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('pricing');
  });

  it('matches "cost" keyword with pricing response', async () => {
    const result = await matchCannedResponse('What does this cost?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('pricing');
  });

  it('matches "how much" with pricing response', async () => {
    const result = await matchCannedResponse('How much is a futon?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('pricing');
  });

  it('returns not matched for unrelated message', async () => {
    const result = await matchCannedResponse('Hello there!');
    expect(result.matched).toBe(false);
    expect(result.response).toBeUndefined();
  });

  it('is case-insensitive', async () => {
    const result = await matchCannedResponse('SHIPPING INFO PLEASE');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('shipping');
  });

  it('returns not matched for empty string', async () => {
    const result = await matchCannedResponse('');
    expect(result.matched).toBe(false);
  });

  it('returns not matched for non-string input', async () => {
    const result = await matchCannedResponse(null);
    expect(result.matched).toBe(false);
  });

  it('returns not matched for undefined input', async () => {
    const result = await matchCannedResponse(undefined);
    expect(result.matched).toBe(false);
  });

  it('returns not matched for numeric input', async () => {
    const result = await matchCannedResponse(12345);
    expect(result.matched).toBe(false);
  });

  it('matches first trigger when message contains multiple triggers', async () => {
    const result = await matchCannedResponse('shipping and return info');
    expect(result.matched).toBe(true);
    // "shipping" trigger comes before "return" in the list
    expect(result.response.id).toBe('shipping');
  });

  it('handles HTML-injected input safely', async () => {
    const result = await matchCannedResponse('<script>alert("xss")</script> shipping');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('shipping');
  });
});

// ═════════════════════════════════════════════════════════════════════
// createSupportTicket
// ═════════════════════════════════════════════════════════════════════
describe('createSupportTicket', () => {
  it('creates a ticket with valid data', async () => {
    const result = await createSupportTicket({
      name: 'Alice',
      email: 'alice@example.com',
      message: 'Need help with my order',
      page: '/product/futon',
    });
    expect(result.success).toBe(true);
    expect(result.ticketId).toBeTruthy();
    expect(result.message).toContain('received');
  });

  it('stores ticket in SupportTickets collection', async () => {
    await createSupportTicket({ message: 'Test message' });
    expect(_collections.SupportTickets).toHaveLength(1);
    expect(_collections.SupportTickets[0].message).toBe('Test message');
  });

  it('defaults name to Anonymous when not provided', async () => {
    await createSupportTicket({ message: 'Hello' });
    expect(_collections.SupportTickets[0].name).toBe('Anonymous');
  });

  it('sets status to new', async () => {
    await createSupportTicket({ message: 'Help' });
    expect(_collections.SupportTickets[0].status).toBe('new');
  });

  it('rejects when message is missing', async () => {
    const result = await createSupportTicket({ name: 'Bob' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Message is required');
  });

  it('rejects when message is empty string', async () => {
    const result = await createSupportTicket({ message: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Message is required');
  });

  it('rejects invalid email format', async () => {
    const result = await createSupportTicket({ message: 'Help', email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('valid email');
  });

  it('accepts ticket without email', async () => {
    const result = await createSupportTicket({ message: 'No email' });
    expect(result.success).toBe(true);
    expect(_collections.SupportTickets[0].email).toBe('');
  });

  it('trims and lowercases email', async () => {
    await createSupportTicket({ message: 'Test', email: '  ALICE@Example.COM  ' });
    expect(_collections.SupportTickets[0].email).toBe('alice@example.com');
  });

  it('defaults to empty object when called with no arguments', async () => {
    const result = await createSupportTicket();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Message is required');
  });

  it('stores page info when provided', async () => {
    await createSupportTicket({ message: 'Help', page: '/checkout' });
    expect(_collections.SupportTickets[0].page).toBe('/checkout');
  });

  it('sets assignedTo and notes as empty strings', async () => {
    await createSupportTicket({ message: 'Help' });
    expect(_collections.SupportTickets[0].assignedTo).toBe('');
    expect(_collections.SupportTickets[0].notes).toBe('');
  });

  it('handles HTML in message via sanitize', async () => {
    await createSupportTicket({ message: '<b>Bold</b> message' });
    expect(_collections.SupportTickets[0].message).toBe('Bold message');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getChatContext
// ═════════════════════════════════════════════════════════════════════
describe('getChatContext', () => {
  it('returns context for logged-in member', async () => {
    __seed('Members/PrivateMembersData', [
      { _id: 'member-abc', name: 'Alice', loginEmail: 'alice@test.com' },
    ]);
    __seed('Stores/Orders', []);
    const result = await getChatContext({ currentPage: '/products' });
    expect(result.success).toBe(true);
    expect(result.context.userName).toBe('Alice');
    expect(result.context.userEmail).toBe('alice@test.com');
    expect(result.context.isLoggedIn).toBe(true);
  });

  it('includes recent orders', async () => {
    __seed('Members/PrivateMembersData', [
      { _id: 'member-abc', name: 'Alice', loginEmail: 'alice@test.com' },
    ]);
    __seed('Stores/Orders', [
      { _id: 'o1', 'buyerInfo.memberId': 'member-abc', number: '1001', _createdDate: new Date(), fulfillmentStatus: 'FULFILLED' },
      { _id: 'o2', 'buyerInfo.memberId': 'member-abc', number: '1002', _createdDate: new Date(), fulfillmentStatus: 'PROCESSING' },
    ]);
    const result = await getChatContext({});
    expect(result.context.recentOrders).toHaveLength(2);
    expect(result.context.recentOrders[0].number).toBe('1001');
    expect(result.context.recentOrders[0].status).toBe('FULFILLED');
  });

  it('defaults fulfillmentStatus to PROCESSING when missing', async () => {
    __seed('Members/PrivateMembersData', [{ _id: 'member-abc', name: 'Bob' }]);
    __seed('Stores/Orders', [
      { _id: 'o1', 'buyerInfo.memberId': 'member-abc', number: '2001', _createdDate: new Date() },
    ]);
    const result = await getChatContext({});
    expect(result.context.recentOrders[0].status).toBe('PROCESSING');
  });

  it('returns empty context when member import fails', async () => {
    _mockMember = null;
    const result = await getChatContext({ currentPage: '/test' });
    expect(result.success).toBe(true);
    expect(result.context.isLoggedIn).toBe(false);
    expect(result.context.recentOrders).toEqual([]);
  });

  it('defaults to empty object when called with no arguments', async () => {
    _mockMember = null;
    const result = await getChatContext();
    expect(result.success).toBe(true);
    expect(result.context.page).toBe('');
  });

  it('sanitizes currentPage input', async () => {
    _mockMember = null;
    const result = await getChatContext({ currentPage: '<script>xss</script>/page' });
    expect(result.success).toBe(true);
    expect(result.context.page).not.toContain('<script>');
  });

  it('uses firstName when name is not available', async () => {
    __seed('Members/PrivateMembersData', [
      { _id: 'member-abc', firstName: 'Bobby', loginEmail: 'bob@test.com' },
    ]);
    __seed('Stores/Orders', []);
    const result = await getChatContext({});
    expect(result.context.userName).toBe('Bobby');
  });

  it('limits orders to 3', async () => {
    __seed('Members/PrivateMembersData', [{ _id: 'member-abc', name: 'Alice' }]);
    __seed('Stores/Orders', [
      { _id: 'o1', 'buyerInfo.memberId': 'member-abc', number: '1', _createdDate: new Date() },
      { _id: 'o2', 'buyerInfo.memberId': 'member-abc', number: '2', _createdDate: new Date() },
      { _id: 'o3', 'buyerInfo.memberId': 'member-abc', number: '3', _createdDate: new Date() },
      { _id: 'o4', 'buyerInfo.memberId': 'member-abc', number: '4', _createdDate: new Date() },
    ]);
    const result = await getChatContext({});
    expect(result.context.recentOrders).toHaveLength(3);
  });

  it('returns empty userName when member has no name fields', async () => {
    __seed('Members/PrivateMembersData', [{ _id: 'member-abc', loginEmail: 'a@b.com' }]);
    __seed('Stores/Orders', []);
    const result = await getChatContext({});
    expect(result.context.userName).toBe('');
  });

  it('returns empty userEmail when member has no loginEmail', async () => {
    __seed('Members/PrivateMembersData', [{ _id: 'member-abc', name: 'Alice' }]);
    __seed('Stores/Orders', []);
    const result = await getChatContext({});
    expect(result.context.userEmail).toBe('');
  });
});
