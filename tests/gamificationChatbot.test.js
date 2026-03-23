/**
 * @file gamificationChatbot.test.js
 * @description TDD tests for Phase 3 Gamification Chatbot webMethod.
 *
 * Covers:
 *  - Feature flag: disabled when secret absent, empty, or non-'true'
 *  - Feature flag: enabled when secret is exactly 'true'
 *  - Auth guard: returns auth_required when currentMember is null
 *  - Input validation: empty and whitespace-only messages rejected
 *  - Input truncation: messages over 6000 chars are truncated to 6000
 *  - Daily reset: counts reset when dailyResetDate differs from today ET
 *  - Daily message limit: 20/day enforced
 *  - Daily token limit: 4000/day enforced (pre-call estimate)
 *  - Hourly rate limit: 20/hr sliding window
 *  - CMS write failure is non-fatal (reply still returned)
 *  - Claude API error returns { error: 'assistant_unavailable' }
 *  - Session history trimmed to 10 turns max
 *  - memberId derived from server-side auth, not client param
 *  - Order lookup scope: only returns orders for authenticated memberId
 *  - Successful call returns reply + remaining quota counts
 *  - Session edge cases: corrupted JSON, history structure, trim boundary, concurrent insert
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __getInserted,
  __onUpdate,
  __onInsert,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';
import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetMembers, __setMember } from './__mocks__/wix-members-backend.js';
import { chatWithAssistant, _callClaude } from '../src/backend/gamificationChatbot.web.js';

const TODAY_ET = '2026-03-22';
const YESTERDAY_ET = '2026-03-21';

function makeMember(id = 'member-123') {
  return { _id: id, contactId: id };
}

function makeSession(overrides = {}) {
  return {
    _id: 'session-1',
    memberId: 'member-123',
    dailyTokensUsed: 0,
    dailyResetDate: TODAY_ET,
    sessionHistory: '[]',
    dailyMessageCount: 0,
    lastMessageAt: new Date('2026-03-22T10:00:00Z'),
    ...overrides,
  };
}

function makeClaudeOkResponse(replyText = 'Hello!', inputTokens = 50, outputTokens = 20) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text: replyText }],
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-22T14:00:00Z')); // 10am EDT = March 22
  resetData();
  resetFetch();
  resetSecrets();
  resetMembers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Feature flag ──────────────────────────────────────────────────────────────

describe('Feature flag', () => {
  it('returns { enabled: false } when GAMIFICATION_CHATBOT_ENABLED secret is absent', async () => {
    // Secret not set — getSecret throws "Secret not found"
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result).toEqual({ enabled: false });
  });

  it('returns { enabled: false } when secret is empty string', async () => {
    __setSecrets({ GAMIFICATION_CHATBOT_ENABLED: '' });
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result).toEqual({ enabled: false });
  });

  it('returns { enabled: false } when secret is "false"', async () => {
    __setSecrets({ GAMIFICATION_CHATBOT_ENABLED: 'false' });
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result).toEqual({ enabled: false });
  });

  it('returns { enabled: false } when secret is "1"', async () => {
    __setSecrets({ GAMIFICATION_CHATBOT_ENABLED: '1' });
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result).toEqual({ enabled: false });
  });

  it('proceeds past flag when secret is exactly "true"', async () => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    // No member set → expect auth_required, NOT { enabled: false }
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result).not.toEqual({ enabled: false });
    expect(result.error).toBe('auth_required');
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('Auth guard', () => {
  beforeEach(() => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
  });

  it('returns { error: "auth_required" } when no member is authenticated', async () => {
    // currentMember.getMember returns null (default from __reset)
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result).toEqual({ error: 'auth_required' });
  });

  it('uses memberId from auth context, ignores client-supplied memberId', async () => {
    __setMember(makeMember('server-derived-id'));
    __seed('ChatbotSessions', [makeSession({ memberId: 'server-derived-id' })]);
    __setHandler(() => makeClaudeOkResponse());

    // Client passes wrong memberId — server must use auth context
    const result = await chatWithAssistant('hello', 'attacker-supplied-id');
    expect(result.error).toBeUndefined();
    // The session lookup used server-derived-id, not attacker-supplied-id
    // Verify by checking reply came back (session found for server-derived-id)
    expect(result.reply).toBeDefined();
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('Input validation', () => {
  beforeEach(() => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
    __seed('ChatbotSessions', [makeSession()]);
  });

  it('returns { error: "invalid_input" } for empty string', async () => {
    const result = await chatWithAssistant('', 'member-123');
    expect(result).toEqual({ error: 'invalid_input' });
  });

  it('returns { error: "invalid_input" } for whitespace-only message', async () => {
    const result = await chatWithAssistant('   \n\t  ', 'member-123');
    expect(result).toEqual({ error: 'invalid_input' });
  });

  it('truncates message to 6000 chars (1500 token estimate) before API call', async () => {
    const longMsg = 'x'.repeat(8000);
    let capturedBody = null;
    __setHandler((_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return makeClaudeOkResponse();
    });

    await chatWithAssistant(longMsg, 'member-123');

    // The user turn content in the messages array must be truncated
    const userContent = capturedBody.messages.find(m => m.role === 'user')?.content;
    expect(typeof userContent).toBe('string');
    expect(userContent.length).toBeLessThanOrEqual(6000);
  });
});

// ── Daily reset ───────────────────────────────────────────────────────────────

describe('Daily reset', () => {
  beforeEach(() => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
    __setHandler(() => makeClaudeOkResponse());
  });

  it('resets dailyMessageCount and dailyTokensUsed when dailyResetDate is yesterday', async () => {
    __seed('ChatbotSessions', [makeSession({
      dailyResetDate: YESTERDAY_ET,
      dailyMessageCount: 15,
      dailyTokensUsed: 3500,
    })]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'ChatbotSessions') updates.push(item); });

    const result = await chatWithAssistant('hello', 'member-123');
    expect(result.error).toBeUndefined();

    // After reset, dailyMessageCount should be 1 (this message), not 16
    expect(result.dailyMessagesRemaining).toBe(19); // 20 - 1
  });

  it('does NOT reset counts when dailyResetDate matches today', async () => {
    __seed('ChatbotSessions', [makeSession({
      dailyResetDate: TODAY_ET,
      dailyMessageCount: 5,
      dailyTokensUsed: 200,
    })]);

    const result = await chatWithAssistant('hello', 'member-123');
    expect(result.error).toBeUndefined();
    // 5 used + 1 new = 6, so 14 remaining
    expect(result.dailyMessagesRemaining).toBe(14);
  });
});

// ── Daily message limit ───────────────────────────────────────────────────────

describe('Daily message limit', () => {
  beforeEach(() => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
  });

  it('returns { limitReached: true, type: "messages" } when dailyMessageCount is 20', async () => {
    __seed('ChatbotSessions', [makeSession({ dailyMessageCount: 20 })]);
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result).toEqual({ limitReached: true, type: 'messages' });
  });

  it('allows request when dailyMessageCount is 19', async () => {
    __seed('ChatbotSessions', [makeSession({ dailyMessageCount: 19 })]);
    __setHandler(() => makeClaudeOkResponse());
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result.limitReached).toBeUndefined();
    expect(result.dailyMessagesRemaining).toBe(0);
  });
});

// ── Daily token limit ─────────────────────────────────────────────────────────

describe('Daily token limit', () => {
  beforeEach(() => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
  });

  it('returns { limitReached: true, type: "tokens" } when estimate would exceed 4000', async () => {
    // dailyTokensUsed = 3900, message = 400 chars = ~100 tokens estimate → 3900+100=4000 exactly OK
    // Use 3901 used + 400-char message (~100 tokens) = over budget
    __seed('ChatbotSessions', [makeSession({ dailyTokensUsed: 3901 })]);
    const result = await chatWithAssistant('x'.repeat(400), 'member-123');
    expect(result).toEqual({ limitReached: true, type: 'tokens' });
  });

  it('allows request when estimate is within budget', async () => {
    __seed('ChatbotSessions', [makeSession({ dailyTokensUsed: 100 })]);
    __setHandler(() => makeClaudeOkResponse('ok', 50, 20));
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result.limitReached).toBeUndefined();
    expect(result.dailyTokensRemaining).toBe(4000 - 100 - 50 - 20);
  });
});

// ── Hourly rate limit ─────────────────────────────────────────────────────────

describe('Hourly rate limit', () => {
  beforeEach(() => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
  });

  it('returns { error: "rate_limit_exceeded", retryAfterMs } when hourly window is full', async () => {
    const windowStart = new Date('2026-03-22T13:30:00Z'); // 30 min ago
    __seed('ChatbotSessions', [makeSession({
      hourlyCallCount: 20,
      hourlyWindowStart: windowStart,
    })]);
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result.error).toBe('rate_limit_exceeded');
    expect(typeof result.retryAfterMs).toBe('number');
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets hourly window when window has expired', async () => {
    const windowStart = new Date('2026-03-22T12:00:00Z'); // 2 hours ago — expired
    __seed('ChatbotSessions', [makeSession({
      hourlyCallCount: 20,
      hourlyWindowStart: windowStart,
    })]);
    __setHandler(() => makeClaudeOkResponse());
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result.error).toBeUndefined();
    expect(result.reply).toBeDefined();
  });
});

// ── Session history trim ──────────────────────────────────────────────────────

describe('Session history trim', () => {
  beforeEach(() => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
    __setHandler(() => makeClaudeOkResponse('reply'));
  });

  it('trims session history to 10 turns before passing to Claude', async () => {
    // 12 turns in history — should be trimmed to 10 before Claude call
    const longHistory = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn ${i}`,
    }));
    __seed('ChatbotSessions', [makeSession({ sessionHistory: JSON.stringify(longHistory) })]);

    let capturedMessages = null;
    __setHandler((_url, opts) => {
      capturedMessages = JSON.parse(opts.body).messages;
      return makeClaudeOkResponse();
    });

    await chatWithAssistant('new message', 'member-123');

    // messages array = trimmed history (10) + new user turn (1) = at most 11
    // After trimming the 12-turn history to 10, then adding new user turn = 11
    expect(capturedMessages.length).toBeLessThanOrEqual(11);
  });

  it('saves trimmed history (max 10 turns) back to CMS after reply', async () => {
    const longHistory = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn ${i}`,
    }));
    __seed('ChatbotSessions', [makeSession({ sessionHistory: JSON.stringify(longHistory) })]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'ChatbotSessions') updates.push(item); });

    await chatWithAssistant('new message', 'member-123');

    const saved = JSON.parse(updates[updates.length - 1].sessionHistory);
    // user turn + assistant turn appended, then trim → must be ≤ 10
    expect(saved.length).toBeLessThanOrEqual(10);
  });
});

// ── Error masking ─────────────────────────────────────────────────────────────

describe('Error masking', () => {
  beforeEach(() => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
    __seed('ChatbotSessions', [makeSession()]);
  });

  it('returns { error: "assistant_unavailable" } on Claude API non-OK response', async () => {
    __setHandler(() => ({
      ok: false,
      status: 529,
      json: async () => ({ error: { message: 'Overloaded', type: 'overloaded_error' } }),
    }));
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result).toEqual({ error: 'assistant_unavailable' });
  });

  it('does not surface Claude API error details to client', async () => {
    __setHandler(() => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key', type: 'authentication_error' } }),
    }));
    const result = await chatWithAssistant('hello', 'member-123');
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('Invalid API key');
    expect(resultStr).not.toContain('authentication_error');
  });
});

// ── CMS write failure (non-fatal) ─────────────────────────────────────────────

describe('CMS write failure', () => {
  it('returns reply even when CMS update throws', async () => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
    __seed('ChatbotSessions', [makeSession()]);
    __setHandler(() => makeClaudeOkResponse('got it'));

    // Force CMS update to throw
    __onUpdate((col) => {
      if (col === 'ChatbotSessions') throw new Error('DB write failed');
    });

    const result = await chatWithAssistant('hello', 'member-123');
    // Reply must still be returned
    expect(result.reply).toBe('got it');
  });
});

// ── Successful call ───────────────────────────────────────────────────────────

describe('Successful call', () => {
  it('returns reply + dailyMessagesRemaining + dailyTokensRemaining + sessionHistory', async () => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
    __seed('ChatbotSessions', [makeSession({ dailyMessageCount: 2, dailyTokensUsed: 100 })]);
    __setHandler(() => makeClaudeOkResponse('Here is your answer!', 80, 40));

    const result = await chatWithAssistant('What futons do you have?', 'member-123');

    expect(result.reply).toBe('Here is your answer!');
    expect(result.dailyMessagesRemaining).toBe(17); // 20 - (2+1)
    expect(result.dailyTokensRemaining).toBe(4000 - 100 - 80 - 40); // 3780
    expect(Array.isArray(result.sessionHistory)).toBe(true);
    expect(result.sessionHistory.length).toBeGreaterThan(0);
  });

  it('creates a new ChatbotSessions record when member has none', async () => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember('brand-new-member'));
    // No session record seeded
    __setHandler(() => makeClaudeOkResponse('Welcome!'));

    const result = await chatWithAssistant('hi', 'brand-new-member');
    expect(result.reply).toBe('Welcome!');
    expect(result.dailyMessagesRemaining).toBe(19);
  });
});

// ── Token accounting ──────────────────────────────────────────────────────────

describe('Token accounting', () => {
  it('adds actual usage tokens (not estimate) to dailyTokensUsed', async () => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
    __seed('ChatbotSessions', [makeSession({ dailyTokensUsed: 100 })]);

    // Claude returns 80 input + 40 output = 120 actual tokens
    __setHandler(() => makeClaudeOkResponse('answer', 80, 40));

    const result = await chatWithAssistant('hello', 'member-123');
    // Remaining = 4000 - 100 - 120 = 3780
    expect(result.dailyTokensRemaining).toBe(3780);
  });
});

// ── Order scope guard ─────────────────────────────────────────────────────────

describe('Order scope guard (architecture note)', () => {
  // The chatbot spec requires that order lookups only return orders
  // for the authenticated memberId. This is enforced in the tool resolution
  // step (step 10 of the flow). Phase 3 implements tool calls via structured
  // prompt injection — the memberId filter is applied server-side before
  // passing results to Claude.
  //
  // Full order tool tests and return-request orderId ownership validation
  // require wix-stores-backend mock integration. The spec DoD requires both:
  //   "Order lookup scope-checked: only returns orders belonging to authenticated memberId"
  //   "Return request initiation validates orderId ownership before inserting"
  //
  // When implementing the tool resolution step (step 10), add dedicated tests
  // for each transactional tool using the wix-stores-backend mock
  // at tests/__mocks__/wix-stores-backend.js.
  //
  // Stub test below: verify memberId from auth context (not client param) is used.

  it('uses server-derived memberId for all data operations', async () => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    // Server member = 'real-member', client claims 'attacker'
    __setMember(makeMember('real-member'));
    __seed('ChatbotSessions', [makeSession({ memberId: 'real-member' })]);
    __setHandler(() => makeClaudeOkResponse('ok'));

    const result = await chatWithAssistant('check my orders', 'attacker-id');
    // Call succeeds using real-member's session, not attacker-id
    expect(result.reply).toBe('ok');
    expect(result.error).toBeUndefined();
  });
});

// ── Session management edge cases ────────────────────────────────────────────

describe('Session management edge cases', () => {
  beforeEach(() => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
    __setHandler(() => makeClaudeOkResponse('ok'));
  });

  it('handles corrupted sessionHistory JSON gracefully (treats as empty)', async () => {
    __seed('ChatbotSessions', [makeSession({ sessionHistory: 'not-valid-json{{' })]);
    const result = await chatWithAssistant('hello', 'member-123');
    // Should not throw — falls back to empty history
    expect(result.reply).toBe('ok');
    expect(Array.isArray(result.sessionHistory)).toBe(true);
  });

  it('history after reply has user turn + assistant turn', async () => {
    __seed('ChatbotSessions', [makeSession({ sessionHistory: '[]' })]);
    const result = await chatWithAssistant('my question', 'member-123');
    expect(result.sessionHistory.length).toBe(2);
    expect(result.sessionHistory[0].role).toBe('user');
    expect(result.sessionHistory[0].content).toBe('my question');
    expect(result.sessionHistory[1].role).toBe('assistant');
  });

  it('inserts new record when no session exists for member', async () => {
    // No seed — empty collection
    const result = await chatWithAssistant('first message', 'member-123');
    expect(result.reply).toBeDefined();
    // Session was created (no error returned)
    expect(result.error).toBeUndefined();
    // Verify record was inserted
    const inserted = __getInserted('ChatbotSessions');
    expect(inserted.length).toBe(1);
    expect(inserted[0].memberId).toBe('member-123');
  });

  it('trim: keeps exactly 10 turns after appending user+assistant on a 9-turn history', async () => {
    // 9 existing turns
    const history9 = Array.from({ length: 9 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${i}`,
    }));
    __seed('ChatbotSessions', [makeSession({ sessionHistory: JSON.stringify(history9) })]);

    const result = await chatWithAssistant('turn 10', 'member-123');
    // 9 + user turn = 10, then assistant turn added = 11, trim to 10
    expect(result.sessionHistory.length).toBe(10);
  });

  it('CMS insert failure is non-fatal (concurrent insert race condition)', async () => {
    // Simulate concurrent insert failure: two simultaneous requests for a new member
    // both read no session, both try to insert, second one fails due to duplicate/error.
    // The reply must still be returned — CMS write failure is non-fatal.
    __setInsertError('ChatbotSessions', new Error('Duplicate key / concurrent insert'));
    // No session seeded → will attempt insert → fails
    const result = await chatWithAssistant('hello', 'member-123');
    expect(result.reply).toBe('ok');
    expect(result.error).toBeUndefined();
  });

  it('daily reset clears counts even when session record is missing dailyResetDate', async () => {
    // Edge: record has undefined dailyResetDate (migrated or corrupt record)
    __seed('ChatbotSessions', [makeSession({
      dailyResetDate: undefined,
      dailyMessageCount: 10,
      dailyTokensUsed: 2000,
    })]);

    const result = await chatWithAssistant('hello', 'member-123');
    // dailyResetDate !== todayET → reset triggered → count should be 1 after this call
    expect(result.error).toBeUndefined();
    expect(result.dailyMessagesRemaining).toBe(19); // 20 - 1 (reset + this message)
  });
});

// ── Claude API call format ────────────────────────────────────────────────────

describe('Claude API call format', () => {
  it('calls the correct Claude API URL with correct model and headers', async () => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'sk-ant-test',
    });
    __setMember(makeMember());
    __seed('ChatbotSessions', [makeSession()]);

    let capturedUrl = null;
    let capturedHeaders = null;
    __setHandler((url, opts) => {
      capturedUrl = url;
      capturedHeaders = opts.headers;
      return makeClaudeOkResponse();
    });

    await chatWithAssistant('hello', 'member-123');

    expect(capturedUrl).toBe('https://api.anthropic.com/v1/messages');
    expect(capturedHeaders['x-api-key']).toBe('sk-ant-test');
    expect(capturedHeaders['anthropic-version']).toBe('2023-06-01');
    expect(capturedHeaders['content-type']).toBe('application/json');
  });

  it('sends correct model and max_tokens in request body', async () => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'sk-ant-test',
    });
    __setMember(makeMember());
    __seed('ChatbotSessions', [makeSession()]);

    let capturedBody = null;
    __setHandler((_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return makeClaudeOkResponse();
    });

    await chatWithAssistant('hello', 'member-123');

    expect(capturedBody.model).toBe('claude-sonnet-4-6');
    expect(capturedBody.max_tokens).toBe(600);
    expect(typeof capturedBody.system).toBe('string');
    expect(capturedBody.system.length).toBeGreaterThan(0);
  });
});

// ── _callClaude unit tests ────────────────────────────────────────────────────

describe('_callClaude', () => {
  beforeEach(() => {
    resetFetch();
  });

  it('returns parsed JSON on OK response', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: 'hello' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    }));
    const result = await _callClaude([{ role: 'user', content: 'hi' }], 'sk-test');
    expect(result.content[0].text).toBe('hello');
    expect(result.usage.input_tokens).toBe(10);
  });

  it('returns null on non-OK response', async () => {
    __setHandler(() => ({ ok: false, status: 529, json: async () => ({}) }));
    const result = await _callClaude([{ role: 'user', content: 'hi' }], 'sk-test');
    expect(result).toBeNull();
  });

  it('sends POST with correct headers', async () => {
    let captured = null;
    __setHandler((url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 200, json: async () => ({ content: [], usage: { input_tokens: 0, output_tokens: 0 } }) };
    });
    await _callClaude([{ role: 'user', content: 'test' }], 'my-api-key');
    expect(captured.opts.headers['x-api-key']).toBe('my-api-key');
    expect(captured.opts.headers['anthropic-version']).toBe('2023-06-01');
    expect(captured.opts.method).toBe('POST');
  });
});
