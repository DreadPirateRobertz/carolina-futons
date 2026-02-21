import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert } from './__mocks__/wix-data.js';
import {
  getOfficeHoursStatus,
  getCannedResponses,
  matchCannedResponse,
  createSupportTicket,
  getChatContext,
} from '../src/backend/liveChat.web.js';

beforeEach(() => {
  __seed('ChatConfig', []);
  __seed('SupportTickets', []);
  __seed('Members/PrivateMembersData', []);
  __seed('Stores/Orders', []);
});

// ── getOfficeHoursStatus ────────────────────────────────────────────

describe('getOfficeHoursStatus', () => {
  it('returns online/offline status', async () => {
    const result = await getOfficeHoursStatus();
    expect(typeof result.isOnline).toBe('boolean');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('returns a message regardless of online status', async () => {
    const result = await getOfficeHoursStatus();
    expect(result.message).toBeTruthy();
  });

  it('includes closesAt when online', async () => {
    const result = await getOfficeHoursStatus();
    if (result.isOnline) {
      expect(result.closesAt).toBeTruthy();
    }
  });

  it('includes nextOpen when offline', async () => {
    const result = await getOfficeHoursStatus();
    if (!result.isOnline) {
      // nextOpen may be null on certain edge cases (no schedule found)
      expect(result).toHaveProperty('nextOpen');
    }
  });

  it('uses custom office hours from CMS when available', async () => {
    __seed('ChatConfig', [{
      _id: 'config-hours',
      key: 'officeHours',
      value: JSON.stringify({
        timezone: 'America/New_York',
        schedule: {
          0: { open: '00:00', close: '23:59' }, // Sunday: open all day
          1: { open: '00:00', close: '23:59' },
          2: { open: '00:00', close: '23:59' },
          3: { open: '00:00', close: '23:59' },
          4: { open: '00:00', close: '23:59' },
          5: { open: '00:00', close: '23:59' },
          6: { open: '00:00', close: '23:59' },
        },
      }),
    }]);

    const result = await getOfficeHoursStatus();
    expect(result.isOnline).toBe(true);
    expect(result.message).toContain('online');
  });

  it('falls back to defaults on invalid CMS config', async () => {
    __seed('ChatConfig', [{
      _id: 'config-hours',
      key: 'officeHours',
      value: 'invalid-json',
    }]);

    // Should not throw, should fall back to defaults
    const result = await getOfficeHoursStatus();
    expect(typeof result.isOnline).toBe('boolean');
  });

  it('handles gracefully when CMS is unavailable', async () => {
    // Empty ChatConfig should just use defaults
    const result = await getOfficeHoursStatus();
    expect(result).toBeDefined();
    expect(typeof result.isOnline).toBe('boolean');
  });
});

// ── getCannedResponses ──────────────────────────────────────────────

describe('getCannedResponses', () => {
  it('returns default canned responses', async () => {
    const result = await getCannedResponses();
    expect(result.success).toBe(true);
    expect(result.responses.length).toBeGreaterThan(0);
  });

  it('includes shipping response', async () => {
    const result = await getCannedResponses();
    const shipping = result.responses.find(r => r.id === 'shipping');
    expect(shipping).toBeDefined();
    expect(shipping.response).toContain('UPS');
  });

  it('includes returns response', async () => {
    const result = await getCannedResponses();
    const returns = result.responses.find(r => r.id === 'returns');
    expect(returns).toBeDefined();
    expect(returns.response).toContain('30 days');
  });

  it('includes assembly response', async () => {
    const result = await getCannedResponses();
    const assembly = result.responses.find(r => r.id === 'assembly');
    expect(assembly).toBeDefined();
    expect(assembly.response).toContain('assembly');
  });

  it('includes fabrics response', async () => {
    const result = await getCannedResponses();
    const fabrics = result.responses.find(r => r.id === 'fabrics');
    expect(fabrics).toBeDefined();
    expect(fabrics.response).toContain('700+');
  });

  it('includes store hours response', async () => {
    const result = await getCannedResponses();
    const hours = result.responses.find(r => r.id === 'store-hours');
    expect(hours).toBeDefined();
    expect(hours.response).toContain('Hendersonville');
  });

  it('includes warranty response', async () => {
    const result = await getCannedResponses();
    const warranty = result.responses.find(r => r.id === 'warranty');
    expect(warranty).toBeDefined();
    expect(warranty.response).toContain('warranty');
  });

  it('each response has id, category, title, and response', async () => {
    const result = await getCannedResponses();
    result.responses.forEach(r => {
      expect(r.id).toBeTruthy();
      expect(r.category).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.response).toBeTruthy();
    });
  });

  it('uses custom responses from CMS when available', async () => {
    const custom = [{ id: 'custom', category: 'Custom', title: 'Custom Q', trigger: 'custom', response: 'Custom answer' }];
    __seed('ChatConfig', [{
      _id: 'config-canned',
      key: 'cannedResponses',
      value: JSON.stringify(custom),
    }]);

    const result = await getCannedResponses();
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].id).toBe('custom');
  });
});

// ── matchCannedResponse ─────────────────────────────────────────────

describe('matchCannedResponse', () => {
  it('matches shipping question', async () => {
    const result = await matchCannedResponse('How much does shipping cost?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('shipping');
  });

  it('matches return question', async () => {
    const result = await matchCannedResponse('What is your return policy?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('returns');
  });

  it('matches assembly question', async () => {
    const result = await matchCannedResponse('Is assembly difficult?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('assembly');
  });

  it('matches fabric question', async () => {
    const result = await matchCannedResponse('Can I get fabric samples?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('fabrics');
  });

  it('matches hours question', async () => {
    const result = await matchCannedResponse('What are your hours?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('store-hours');
  });

  it('matches warranty question', async () => {
    const result = await matchCannedResponse('Is there a warranty on this frame?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('warranty');
  });

  it('matches pricing question', async () => {
    const result = await matchCannedResponse('How much does the Eureka frame cost?');
    expect(result.matched).toBe(true);
    expect(result.response.id).toBe('pricing');
  });

  it('matches "how much" question', async () => {
    const result = await matchCannedResponse('How much is that murphy bed?');
    expect(result.matched).toBe(true);
  });

  it('is case insensitive', async () => {
    const result = await matchCannedResponse('SHIPPING QUESTION');
    expect(result.matched).toBe(true);
  });

  it('returns matched:false for unrecognized message', async () => {
    const result = await matchCannedResponse('Tell me about your company history');
    expect(result.matched).toBe(false);
  });

  it('returns matched:false for empty message', async () => {
    const result = await matchCannedResponse('');
    expect(result.matched).toBe(false);
  });

  it('sanitizes message with HTML', async () => {
    const result = await matchCannedResponse('<script>alert(1)</script>shipping');
    expect(result.matched).toBe(true);
  });

  it('matched response has title and response text', async () => {
    const result = await matchCannedResponse('shipping info');
    expect(result.response.title).toBeTruthy();
    expect(result.response.response).toBeTruthy();
  });
});

// ── createSupportTicket ─────────────────────────────────────────────

describe('createSupportTicket', () => {
  it('creates a support ticket', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    const result = await createSupportTicket({
      name: 'Jane Smith',
      email: 'jane@example.com',
      message: 'I need help with my order',
      page: '/product-page/eureka',
    });

    expect(result.success).toBe(true);
    expect(result.ticketId).toBeTruthy();
    expect(result.message).toContain('received');
    expect(inserted.name).toBe('Jane Smith');
    expect(inserted.email).toBe('jane@example.com');
    expect(inserted.status).toBe('new');
  });

  it('creates ticket with anonymous name when not provided', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    await createSupportTicket({
      message: 'Help please',
    });

    expect(inserted.name).toBe('Anonymous');
  });

  it('creates ticket without email', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    const result = await createSupportTicket({
      name: 'Jane',
      message: 'Question about shipping',
    });

    expect(result.success).toBe(true);
    expect(inserted.email).toBe('');
  });

  it('rejects empty message', async () => {
    const result = await createSupportTicket({
      name: 'Jane',
      email: 'jane@example.com',
      message: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects invalid email format', async () => {
    const result = await createSupportTicket({
      message: 'Help',
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('stores the page where chat was initiated', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    await createSupportTicket({
      message: 'Question',
      page: '/futon-frames',
    });

    expect(inserted.page).toBe('/futon-frames');
  });

  it('sanitizes message with HTML', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    await createSupportTicket({
      message: '<script>alert("xss")</script>Real question',
    });

    expect(inserted.message).not.toContain('<script>');
    expect(inserted.message).toContain('Real question');
  });

  it('sanitizes name with HTML', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    await createSupportTicket({
      name: '<img onerror=alert(1)>Jane',
      message: 'Question',
    });

    expect(inserted.name).not.toContain('<img');
  });

  it('handles null ticket data gracefully', async () => {
    const result = await createSupportTicket(null);
    expect(result.success).toBe(false);
  });

  it('sets initial status to new', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    await createSupportTicket({ message: 'Help' });
    expect(inserted.status).toBe('new');
    expect(inserted.assignedTo).toBe('');
  });
});

// ── getChatContext ───────────────────────────────────────────────────

describe('getChatContext', () => {
  it('returns basic context without member', async () => {
    const result = await getChatContext({ currentPage: '/futon-frames' });
    expect(result.success).toBe(true);
    expect(result.context.page).toBe('/futon-frames');
    expect(result.context.isLoggedIn).toBe(false);
    expect(result.context.userName).toBe('');
  });

  it('returns member context when logged in', async () => {
    __seed('Members/PrivateMembersData', [{
      _id: 'member-001',
      name: 'Jane Smith',
      loginEmail: 'jane@example.com',
    }]);

    const result = await getChatContext({
      memberId: 'member-001',
      currentPage: '/product-page/eureka',
    });

    expect(result.success).toBe(true);
    expect(result.context.isLoggedIn).toBe(true);
    expect(result.context.userName).toBe('Jane Smith');
    expect(result.context.userEmail).toBe('jane@example.com');
  });

  it('returns recent orders for logged-in member', async () => {
    __seed('Members/PrivateMembersData', [{
      _id: 'member-001',
      name: 'Jane',
      loginEmail: 'jane@example.com',
    }]);
    __seed('Stores/Orders', [{
      _id: 'order-001',
      number: '10042',
      buyerInfo: { memberId: 'member-001' },
      _createdDate: new Date(),
      fulfillmentStatus: 'NOT_FULFILLED',
    }]);

    const result = await getChatContext({ memberId: 'member-001' });
    expect(result.context.recentOrders.length).toBe(1);
    expect(result.context.recentOrders[0].number).toBe('10042');
  });

  it('returns empty orders for member with no orders', async () => {
    __seed('Members/PrivateMembersData', [{
      _id: 'member-002',
      name: 'Bob',
      loginEmail: 'bob@example.com',
    }]);

    const result = await getChatContext({ memberId: 'member-002' });
    expect(result.context.recentOrders).toHaveLength(0);
  });

  it('handles unknown member ID gracefully', async () => {
    const result = await getChatContext({ memberId: 'nonexistent' });
    expect(result.success).toBe(true);
    expect(result.context.isLoggedIn).toBe(false);
  });

  it('handles null session info', async () => {
    const result = await getChatContext(null);
    expect(result.success).toBe(true);
    expect(result.context.page).toBe('');
  });

  it('handles empty session info', async () => {
    const result = await getChatContext({});
    expect(result.success).toBe(true);
  });

  it('sanitizes current page', async () => {
    const result = await getChatContext({ currentPage: '<script>alert(1)</script>/page' });
    expect(result.context.page).not.toContain('<script>');
  });

  it('returns correct structure', async () => {
    const result = await getChatContext({});
    expect(result.context).toHaveProperty('page');
    expect(result.context).toHaveProperty('userName');
    expect(result.context).toHaveProperty('userEmail');
    expect(result.context).toHaveProperty('isLoggedIn');
    expect(result.context).toHaveProperty('recentOrders');
  });
});
