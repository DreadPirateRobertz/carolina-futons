import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __onInsert } from '../__mocks__/wix-data.js';
import {
  isOnline,
  getCannedResponses,
  getCannedResponse,
  sendMessage,
  getChatHistory,
  createSupportTicket,
} from '../../src/backend/liveChatService.web.js';

beforeEach(() => {
  __seed('ChatMessages', []);
  __seed('SupportTickets', []);
});

// ── isOnline ─────────────────────────────────────────────────────

describe('isOnline', () => {
  it('returns online status object with expected fields', async () => {
    const status = await isOnline();
    expect(status).toHaveProperty('online');
    expect(status).toHaveProperty('message');
    expect(typeof status.online).toBe('boolean');
    expect(typeof status.message).toBe('string');
  });

  it('provides nextOpen when offline', async () => {
    const status = await isOnline();
    if (!status.online) {
      expect(status.nextOpen).toBeTruthy();
      expect(status.nextOpen).toContain('at');
      expect(status.nextOpen).toContain('ET');
    }
  });

  it('returns message string regardless of online status', async () => {
    const status = await isOnline();
    expect(status.message.length).toBeGreaterThan(0);
  });
});

// ── getCannedResponses ───────────────────────────────────────────

describe('getCannedResponses', () => {
  it('returns list of canned response topics', async () => {
    const topics = await getCannedResponses();
    expect(Array.isArray(topics)).toBe(true);
    expect(topics.length).toBeGreaterThanOrEqual(4);
  });

  it('each topic has key and label', async () => {
    const topics = await getCannedResponses();
    for (const topic of topics) {
      expect(topic).toHaveProperty('key');
      expect(topic).toHaveProperty('label');
      expect(typeof topic.key).toBe('string');
      expect(typeof topic.label).toBe('string');
    }
  });

  it('includes shipping, returns, assembly, and fabrics topics', async () => {
    const topics = await getCannedResponses();
    const keys = topics.map(t => t.key);
    expect(keys).toContain('shipping');
    expect(keys).toContain('returns');
    expect(keys).toContain('assembly');
    expect(keys).toContain('fabrics');
  });
});

// ── getCannedResponse ────────────────────────────────────────────

describe('getCannedResponse', () => {
  it('returns response for valid topic', async () => {
    const response = await getCannedResponse('shipping');
    expect(response).not.toBeNull();
    expect(response.label).toBe('Shipping & Delivery');
    expect(response.response).toContain('free shipping');
  });

  it('returns null for unknown topic', async () => {
    const response = await getCannedResponse('unknown-topic');
    expect(response).toBeNull();
  });

  it('returns null for null topic', async () => {
    const response = await getCannedResponse(null);
    expect(response).toBeNull();
  });

  it('returns null for empty string', async () => {
    const response = await getCannedResponse('');
    expect(response).toBeNull();
  });

  it('returns response for all known topics', async () => {
    const topics = await getCannedResponses();
    for (const topic of topics) {
      const response = await getCannedResponse(topic.key);
      expect(response).not.toBeNull();
      expect(response.response.length).toBeGreaterThan(0);
    }
  });

  it('fabrics response mentions 700 fabric options', async () => {
    const response = await getCannedResponse('fabrics');
    expect(response.response).toContain('700');
  });

  it('assembly response mentions futon frames', async () => {
    const response = await getCannedResponse('assembly');
    expect(response.response).toContain('futon frame');
  });
});

// ── sendMessage ──────────────────────────────────────────────────

describe('sendMessage', () => {
  it('persists message to ChatMessages collection', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'ChatMessages') inserted = item;
    });

    const result = await sendMessage({
      sessionId: 'sess-001',
      message: 'Hello, I need help',
      senderName: 'Jane',
      senderEmail: 'jane@example.com',
      sender: 'customer',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(inserted.sessionId).toBe('sess-001');
    expect(inserted.message).toBe('Hello, I need help');
    expect(inserted.senderName).toBe('Jane');
    expect(inserted.sender).toBe('customer');
  });

  it('returns error when session ID missing', async () => {
    const result = await sendMessage({ message: 'Hello' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Session ID');
  });

  it('returns error when message missing', async () => {
    const result = await sendMessage({ sessionId: 'sess-001' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('message');
  });

  it('sanitizes message (strips HTML)', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'ChatMessages') inserted = item;
    });

    await sendMessage({
      sessionId: 'sess-001',
      message: '<script>alert("xss")</script>Hello',
      sender: 'customer',
    });

    expect(inserted.message).toBe('alert("xss")Hello');
  });

  it('defaults sender to customer', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'ChatMessages') inserted = item;
    });

    await sendMessage({
      sessionId: 'sess-001',
      message: 'Hello',
    });

    expect(inserted.sender).toBe('customer');
  });

  it('validates email format', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'ChatMessages') inserted = item;
    });

    await sendMessage({
      sessionId: 'sess-001',
      message: 'Hello',
      senderEmail: 'not-an-email',
    });

    expect(inserted.senderEmail).toBe('');
  });

  it('accepts valid email', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'ChatMessages') inserted = item;
    });

    await sendMessage({
      sessionId: 'sess-001',
      message: 'Hello',
      senderEmail: 'valid@example.com',
    });

    expect(inserted.senderEmail).toBe('valid@example.com');
  });
});

// ── getChatHistory ───────────────────────────────────────────────

describe('getChatHistory', () => {
  it('returns messages for a session', async () => {
    __seed('ChatMessages', [
      { _id: 'msg-1', sessionId: 'sess-001', message: 'Hello', sender: 'customer', senderName: 'Jane', timestamp: new Date('2025-06-15T10:00:00'), read: false },
      { _id: 'msg-2', sessionId: 'sess-001', message: 'Hi!', sender: 'agent', senderName: 'Support', timestamp: new Date('2025-06-15T10:01:00'), read: true },
    ]);

    const history = await getChatHistory('sess-001');
    expect(history).toHaveLength(2);
    expect(history[0].message).toBe('Hello');
    expect(history[1].message).toBe('Hi!');
  });

  it('returns empty array for empty session', async () => {
    const history = await getChatHistory('nonexistent');
    expect(history).toEqual([]);
  });

  it('returns empty array for null session ID', async () => {
    const history = await getChatHistory(null);
    expect(history).toEqual([]);
  });

  it('limits results', async () => {
    __seed('ChatMessages', [
      { _id: 'msg-1', sessionId: 'sess-001', message: 'First', sender: 'customer', timestamp: new Date('2025-06-15T10:00:00') },
      { _id: 'msg-2', sessionId: 'sess-001', message: 'Second', sender: 'customer', timestamp: new Date('2025-06-15T10:01:00') },
      { _id: 'msg-3', sessionId: 'sess-001', message: 'Third', sender: 'customer', timestamp: new Date('2025-06-15T10:02:00') },
    ]);

    const history = await getChatHistory('sess-001', 2);
    expect(history).toHaveLength(2);
  });

  it('does not return messages from other sessions', async () => {
    __seed('ChatMessages', [
      { _id: 'msg-1', sessionId: 'sess-001', message: 'Hello', sender: 'customer', timestamp: new Date() },
      { _id: 'msg-2', sessionId: 'sess-002', message: 'Other', sender: 'customer', timestamp: new Date() },
    ]);

    const history = await getChatHistory('sess-001');
    expect(history).toHaveLength(1);
    expect(history[0].message).toBe('Hello');
  });

  it('maps expected fields', async () => {
    __seed('ChatMessages', [
      { _id: 'msg-1', sessionId: 'sess-001', message: 'Test', sender: 'customer', senderName: 'Jane', timestamp: new Date(), read: false, extraField: 'hidden' },
    ]);

    const history = await getChatHistory('sess-001');
    expect(history[0]).toHaveProperty('_id');
    expect(history[0]).toHaveProperty('message');
    expect(history[0]).toHaveProperty('senderName');
    expect(history[0]).toHaveProperty('sender');
    expect(history[0]).toHaveProperty('timestamp');
    expect(history[0]).toHaveProperty('read');
    expect(history[0]).not.toHaveProperty('extraField');
  });
});

// ── createSupportTicket ──────────────────────────────────────────

describe('createSupportTicket', () => {
  it('creates a support ticket in CMS', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    const result = await createSupportTicket({
      name: 'Jane Smith',
      email: 'jane@example.com',
      message: 'I need help with my order',
      sessionId: 'sess-001',
    });

    expect(result.success).toBe(true);
    expect(result.ticketId).toBeDefined();
    expect(inserted.customerName).toBe('Jane Smith');
    expect(inserted.customerEmail).toBe('jane@example.com');
    expect(inserted.message).toBe('I need help with my order');
    expect(inserted.status).toBe('open');
    expect(inserted.source).toBe('live_chat');
  });

  it('returns error for invalid email', async () => {
    const result = await createSupportTicket({
      name: 'Jane',
      email: 'not-valid',
      message: 'Help!',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('returns error for missing email', async () => {
    const result = await createSupportTicket({
      name: 'Jane',
      message: 'Help!',
    });
    expect(result.success).toBe(false);
  });

  it('returns error for missing message', async () => {
    const result = await createSupportTicket({
      name: 'Jane',
      email: 'jane@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Message');
  });

  it('sanitizes ticket fields', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    await createSupportTicket({
      name: '<b>Jane</b>',
      email: 'jane@example.com',
      message: '<script>alert(1)</script>Help me',
    });

    expect(inserted.customerName).toBe('Jane');
    expect(inserted.message).toBe('alert(1)Help me');
  });

  it('handles missing sessionId gracefully', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'SupportTickets') inserted = item;
    });

    const result = await createSupportTicket({
      name: 'Jane',
      email: 'jane@example.com',
      message: 'No session',
    });

    expect(result.success).toBe(true);
    expect(inserted.sessionId).toBe('');
  });
});
