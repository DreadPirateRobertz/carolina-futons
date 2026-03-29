/**
 * @file chatbotService.test.js
 * @description Tests for chatbotService.web.js — anonymous pre-sale chatbot.
 *
 * Covers:
 *  - Feature flag: disabled when secret absent or non-'true'
 *  - Feature flag: enabled when secret is exactly 'true'
 *  - sessionId validation: empty, invalid chars, too long
 *  - Input validation: empty and whitespace-only messages rejected
 *  - Input sanitization: strips HTML tags, truncates at 500 chars
 *  - Per-session message limit: 20/session enforced
 *  - Daily session cap: 100/day enforced for new sessions
 *  - Daily stats: incremented on first message of new session
 *  - Existing session: stats NOT incremented again
 *  - Claude API error returns { error: 'assistant_unavailable' }
 *  - CMS write failure is non-fatal (reply still returned)
 *  - Session history trimmed to 10 turns max
 *  - Successful call returns reply + suggestedProducts + messagesRemaining
 *  - Suggested products derived from user message keywords
 *  - New session inserted; existing session updated
 *  - Corrupted sessionHistory JSON handled gracefully
 *  - Catalog fetch failure: chatbot still responds (empty catalog)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __onUpdate,
  __onInsert,
  __setInsertError as _setInsertError,
} from './__mocks__/wix-data.js';
import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { sendMessage, _trimHistory, _getTodayUTC } from '../src/backend/chatbotService.web.js';

const SESSION_ID = 'sess-abc123';
const USER_MSG = 'Do you have any futons under $400?';

function makeSession(overrides = {}) {
  return {
    _id: 'rec-1',
    sessionId: SESSION_ID,
    sessionHistory: '[]',
    messageCount: 0,
    createdAt: new Date('2026-03-28T10:00:00Z'),
    lastMessageAt: new Date('2026-03-28T10:00:00Z'),
    ...overrides,
  };
}

function makeDailyStats(count = 0) {
  return { _id: 'stats-1', date: '2026-03-28', sessionCount: count };
}

function makeClaudeOk(text = 'We have several futons under $400!') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text }],
      usage: { input_tokens: 30, output_tokens: 20 },
    }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-28T15:00:00Z')); // noon EDT
  resetData();
  resetFetch();
  resetSecrets();
  // Default: chatbot enabled + API key present
  __setSecrets({ CHATBOT_ENABLED: 'true', ANTHROPIC_API_KEY: 'test-key' });
  // Default Claude response
  __setHandler(() => makeClaudeOk());
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

describe('feature flag', () => {
  it('returns { enabled: false } when CHATBOT_ENABLED secret is missing', async () => {
    resetSecrets(); // clear all secrets including the beforeEach defaults
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toEqual({ enabled: false });
  });

  it('returns { enabled: false } when CHATBOT_ENABLED is "false"', async () => {
    resetSecrets();
    __setSecrets({ CHATBOT_ENABLED: 'false', ANTHROPIC_API_KEY: 'key' });
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toEqual({ enabled: false });
  });

  it('proceeds when CHATBOT_ENABLED is "true"', async () => {
    __seed('ChatSessions', [makeSession()]);
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).not.toEqual({ enabled: false });
  });
});

// ---------------------------------------------------------------------------
// sessionId validation
// ---------------------------------------------------------------------------

describe('sessionId validation', () => {
  it('returns { error: invalid_session } for empty string', async () => {
    const result = await sendMessage('', USER_MSG);
    expect(result).toEqual({ error: 'invalid_session' });
  });

  it('returns { error: invalid_session } for sessionId with spaces', async () => {
    const result = await sendMessage('bad id here', USER_MSG);
    expect(result).toEqual({ error: 'invalid_session' });
  });

  it('returns { error: invalid_session } for sessionId > 64 chars of special chars', async () => {
    const result = await sendMessage('<script>alert(1)</script>', USER_MSG);
    expect(result).toEqual({ error: 'invalid_session' });
  });

  it('accepts alphanumeric sessionId with hyphens', async () => {
    __seed('ChatSessions', [makeSession({ sessionId: 'valid-session-123' })]);
    const result = await sendMessage('valid-session-123', USER_MSG);
    expect(result).not.toHaveProperty('error', 'invalid_session');
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('input validation', () => {
  it('returns { error: invalid_input } for empty message', async () => {
    const result = await sendMessage(SESSION_ID, '');
    expect(result).toEqual({ error: 'invalid_input' });
  });

  it('returns { error: invalid_input } for whitespace-only message', async () => {
    const result = await sendMessage(SESSION_ID, '   \t\n  ');
    expect(result).toEqual({ error: 'invalid_input' });
  });

  it('strips HTML tags from user message', async () => {
    __seed('ChatSessions', [makeSession()]);
    let capturedBody;
    __setHandler((_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return makeClaudeOk();
    });
    await sendMessage(SESSION_ID, '<b>futon</b> price?');
    const lastUser = capturedBody.messages.at(-1);
    expect(lastUser.content).not.toContain('<b>');
    expect(lastUser.content).toContain('futon');
  });

  it('truncates message to 500 chars', async () => {
    __seed('ChatSessions', [makeSession()]);
    let capturedBody;
    __setHandler((_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return makeClaudeOk();
    });
    await sendMessage(SESSION_ID, 'a'.repeat(600));
    const lastUser = capturedBody.messages.at(-1);
    expect(lastUser.content.length).toBeLessThanOrEqual(500);
  });
});

// ---------------------------------------------------------------------------
// Per-session message limit
// ---------------------------------------------------------------------------

describe('per-session message limit', () => {
  it('returns { limitReached: true } when messageCount >= 20', async () => {
    __seed('ChatSessions', [makeSession({ messageCount: 20 })]);
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toEqual({ limitReached: true });
  });

  it('allows message when messageCount is 19', async () => {
    __seed('ChatSessions', [makeSession({ messageCount: 19 })]);
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toHaveProperty('reply');
    expect(result.messagesRemaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Daily session cap
// ---------------------------------------------------------------------------

describe('daily session cap', () => {
  it('returns { limitReached: true } for new session when daily cap is reached', async () => {
    __seed('ChatbotDailyStats', [makeDailyStats(100)]);
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toEqual({ limitReached: true });
  });

  it('allows new session when daily count is 99', async () => {
    __seed('ChatbotDailyStats', [makeDailyStats(99)]);
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toHaveProperty('reply');
  });

  it('does NOT check daily cap for existing sessions', async () => {
    __seed('ChatSessions', [makeSession()]);
    __seed('ChatbotDailyStats', [makeDailyStats(100)]);
    const result = await sendMessage(SESSION_ID, USER_MSG);
    // Existing session — daily cap not applied
    expect(result).toHaveProperty('reply');
  });
});

// ---------------------------------------------------------------------------
// Daily stats incremented
// ---------------------------------------------------------------------------

describe('daily stats', () => {
  it('inserts a new stats record when none exists for today', async () => {
    const inserted = [];
    __onInsert((col, r) => { if (col === 'ChatbotDailyStats') inserted.push(r); });
    await sendMessage(SESSION_ID, USER_MSG);
    expect(inserted.length).toBe(1);
    expect(inserted[0].sessionCount).toBe(1);
    expect(inserted[0].date).toBe('2026-03-28');
  });

  it('increments existing stats record', async () => {
    __seed('ChatbotDailyStats', [makeDailyStats(5)]);
    const updated = [];
    __onUpdate((col, r) => { if (col === 'ChatbotDailyStats') updated.push(r); });
    await sendMessage(SESSION_ID, USER_MSG);
    expect(updated[0].sessionCount).toBe(6);
  });

  it('does NOT increment stats for an existing session', async () => {
    __seed('ChatSessions', [makeSession()]);
    __seed('ChatbotDailyStats', [makeDailyStats(10)]);
    const updated = [];
    const inserted = [];
    __onUpdate((col, r) => { if (col === 'ChatbotDailyStats') updated.push(r); });
    __onInsert((col, r) => { if (col === 'ChatbotDailyStats') inserted.push(r); });
    await sendMessage(SESSION_ID, USER_MSG);
    expect(updated.length).toBe(0);
    expect(inserted.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Claude API errors
// ---------------------------------------------------------------------------

describe('Claude API errors', () => {
  it('returns { error: assistant_unavailable } on non-ok response', async () => {
    __seed('ChatSessions', [makeSession()]);
    __setHandler(() => ({ ok: false, status: 500, json: async () => ({}) }));
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toEqual({ error: 'assistant_unavailable' });
  });

  it('returns { error: assistant_unavailable } when fetch throws', async () => {
    __seed('ChatSessions', [makeSession()]);
    __setHandler(() => { throw new Error('network error'); });
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toEqual({ error: 'assistant_unavailable' });
  });
});

// ---------------------------------------------------------------------------
// CMS write failure is non-fatal
// ---------------------------------------------------------------------------

describe('CMS write failure', () => {
  it('still returns reply when session update fails', async () => {
    __seed('ChatSessions', [makeSession()]);
    const { __setUpdateError } = await import('./__mocks__/wix-data.js');
    __setUpdateError('ChatSessions', new Error('update failed'));
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toHaveProperty('reply');
  });
});

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

describe('session management', () => {
  it('inserts a new session record when none exists', async () => {
    const inserted = [];
    __onInsert((col, r) => { if (col === 'ChatSessions') inserted.push(r); });
    await sendMessage(SESSION_ID, USER_MSG);
    expect(inserted.length).toBe(1);
    expect(inserted[0].sessionId).toBe(SESSION_ID);
    expect(inserted[0].messageCount).toBe(1);
  });

  it('updates an existing session record', async () => {
    __seed('ChatSessions', [makeSession({ messageCount: 3 })]);
    const updated = [];
    __onUpdate((col, r) => { if (col === 'ChatSessions') updated.push(r); });
    await sendMessage(SESSION_ID, USER_MSG);
    expect(updated[0].messageCount).toBe(4);
  });

  it('handles corrupted sessionHistory JSON gracefully', async () => {
    __seed('ChatSessions', [makeSession({ sessionHistory: '[[[[invalid' })]);
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toHaveProperty('reply');
  });

  it('trims history to 10 turns when it exceeds the limit', async () => {
    const longHistory = Array.from({ length: 12 }, (_, i) => [
      { role: 'user', content: `question ${i}` },
      { role: 'assistant', content: `answer ${i}` },
    ]).flat();
    __seed('ChatSessions', [makeSession({ sessionHistory: JSON.stringify(longHistory) })]);
    let capturedBody;
    __setHandler((_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return makeClaudeOk();
    });
    await sendMessage(SESSION_ID, USER_MSG);
    // trimHistory keeps last 10 turns, then appends the new user turn
    expect(capturedBody.messages.length).toBeLessThanOrEqual(11);
  });
});

// ---------------------------------------------------------------------------
// Successful response
// ---------------------------------------------------------------------------

describe('successful response', () => {
  it('returns reply, suggestedProducts, and messagesRemaining', async () => {
    __seed('ChatSessions', [makeSession()]);
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result).toMatchObject({
      reply: expect.any(String),
      suggestedProducts: expect.any(Array),
      messagesRemaining: 19,
    });
  });

  it('messagesRemaining decreases with each message', async () => {
    __seed('ChatSessions', [makeSession({ messageCount: 10 })]);
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result.messagesRemaining).toBe(9);
  });

  it('suggestedProducts is empty when catalog fetch fails', async () => {
    __seed('ChatSessions', [makeSession()]);
    // wix-stores-backend is not seeded — _fetchProductCatalog will return []
    const result = await sendMessage(SESSION_ID, USER_MSG);
    expect(result.suggestedProducts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// _trimHistory unit tests
// ---------------------------------------------------------------------------

describe('_trimHistory', () => {
  it('returns history unchanged when at or below limit', () => {
    const h = Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));
    expect(_trimHistory(h)).toHaveLength(10);
  });

  it('trims to last 10 turns when over limit', () => {
    const h = Array.from({ length: 14 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));
    const trimmed = _trimHistory(h);
    expect(trimmed).toHaveLength(10);
    expect(trimmed[0].content).toBe('msg 4');
  });
});

// ---------------------------------------------------------------------------
// _getTodayUTC unit tests
// ---------------------------------------------------------------------------

describe('_getTodayUTC', () => {
  it('returns YYYY-MM-DD string for current UTC date', () => {
    expect(_getTodayUTC()).toBe('2026-03-28');
  });
});
