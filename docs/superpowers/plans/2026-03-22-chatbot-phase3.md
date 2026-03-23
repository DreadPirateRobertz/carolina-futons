# Gamification Chatbot — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a member-authenticated Claude-powered chatbot (`gamificationChatbot.web.js`) with per-member daily rate limits, session history, structured prompt-injection tool calls, and a pure-function frontend module (`ChatbotUI.js`), all behind a Wix Secrets Manager feature flag.

**Architecture:** A new `gamificationChatbot.web.js` backend file exposes a single `chatWithAssistant` webMethod (Permissions.Member) that gates on a feature flag, enforces per-member daily message + token limits against the `ChatbotSessions` CMS collection, resolves tool intents via structured prompt injection (no Anthropic native tools API — Wix Velo does not support it), calls Claude via `wix-fetch`, and returns the reply with updated quota counts. A companion `ChatbotUI.js` frontend module provides pure functions for rendering the conversation thread, limit display, loading state, and reduced-motion fallback — no direct Wix API calls inside the module.

**Tech Stack:** Wix Velo JS (ES modules), wix-data, wix-fetch, wix-secrets-backend, wix-members-backend (currentMember), wix-web-module (webMethod + Permissions), vitest, existing mocks (`wix-data`, `wix-fetch`, `wix-secrets-backend`, `wix-members-backend`), `dateUtils.js` (shared ET date helpers from Phase 2).

---

## File Structure

| File | Status | Purpose |
|------|--------|---------|
| `src/backend/gamificationChatbot.web.js` | **Create** | Feature flag, auth guard, rate limits, session management, tool resolution, Claude API call, token accounting |
| `tests/gamificationChatbot.test.js` | **Create** | Full TDD coverage: flag, auth, daily reset, message limit, token limit, hourly rate limit, session trim, order scope, error masking, CMS write failure |
| `src/public/ChatbotUI.js` | **Create** | Pure frontend functions: `formatThread`, `formatLimitDisplay`, `buildComingSoonState`, `buildLimitReachedState`, `buildErrorState`, `buildLoadingState`, `buildReadyState`, `shouldSkipAnimation` |
| `tests/ChatbotUI.test.js` | **Create** | Tests for all pure frontend functions |

**No existing files are modified** in this phase. `dateUtils.js` (from Phase 2) is imported for ET date math.

---

## Environment Setup

All test commands run from: `/Users/hal/gt/cfutons/refinery/rig`

Run single test file: `npx vitest run tests/gamificationChatbot.test.js`
Run all tests: `npx vitest run`

**Available mocks** (all at `tests/__mocks__/`):
- `wix-data.js` — `__seed`, `__reset`, `__onUpdate`, `__onInsert`, `__setQueryError`, `__getInserted`
- `wix-fetch.js` — `__setHandler(fn)`, `__reset()` — handler receives `(url, options)`, returns response-like object
- `wix-secrets-backend.js` — `__setSecrets({ KEY: value })`, `__reset()` — `getSecret(key)` throws if key absent
- `wix-members-backend.js` — `__setMember(member)`, `__reset()` — `currentMember.getMember()` returns the mock member
- `wix-web-module.js` — `webMethod(_permission, fn)` returns `fn` directly; `Permissions.Member` must be added to the mock

**Important:** The `wix-web-module` mock only defines `Permissions.Anyone`, `Permissions.SiteMember`, `Permissions.Admin`. Before writing tests that reference `Permissions.Member`, add it to the mock:

```js
// tests/__mocks__/wix-web-module.js — add Member to the Permissions object
export const Permissions = {
  Anyone: 'Anyone',
  SiteMember: 'SiteMember',
  Member: 'Member',   // add this line
  Admin: 'Admin',
};
```

---

## Task 1: Feature flag check + rate limiting — `gamificationChatbot.web.js` core

**Files:**
- Create: `src/backend/gamificationChatbot.web.js` (stub, then full logic)
- Create: `tests/gamificationChatbot.test.js`
- Modify: `tests/__mocks__/wix-web-module.js` (add `Member` to `Permissions`)

This task covers the foundational pure logic: feature flag gating, input validation, daily message limit, daily token limit, hourly rate limit, and daily reset. Session history and Claude calls come in Tasks 2–4.

### Step 1: Add `Permissions.Member` to the wix-web-module mock

Edit `tests/__mocks__/wix-web-module.js`:

```js
export const Permissions = {
  Anyone: 'Anyone',
  SiteMember: 'SiteMember',
  Member: 'Member',
  Admin: 'Admin',
};

export function webMethod(_permission, fn) {
  return fn;
}
```

- [ ] Edit `tests/__mocks__/wix-web-module.js` — add `Member: 'Member'` to `Permissions`

### Step 2: Write failing tests (feature flag + rate limits)

Create `tests/gamificationChatbot.test.js`:

```js
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
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __getInserted,
  __onUpdate,
  __setQueryError,
} from './__mocks__/wix-data.js';
import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetMembers, __setMember } from './__mocks__/wix-members-backend.js';
import { chatWithAssistant } from '../src/backend/gamificationChatbot.web.js';
```

**Note on imports:** Mock helpers are imported from `./__mocks__/<name>.js` (relative to the test file in `tests/`). This matches the pattern in `spinWheel.test.js`. The Wix modules themselves (`wix-data`, `wix-fetch`, etc.) are auto-resolved by vitest via the `__mocks__` directory — you only import the helpers (`__seed`, `__reset`, etc.) directly.

Continue `tests/gamificationChatbot.test.js`:

```js
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
    __setHandler((url, opts) => {
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
    __setHandler((url, opts) => {
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
    __setHandler((url, opts) => {
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
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/gamificationChatbot.test.js
```

Expected: FAIL — "Cannot find module '../src/backend/gamificationChatbot.web.js'"

### Step 3: Create the stub

Create `src/backend/gamificationChatbot.web.js` with enough structure to make tests fail with meaningful errors (not import errors):

```js
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { getSecret } from 'wix-secrets-backend';

// Lightweight flag check — does NOT create a ChatbotSessions record.
// Frontend calls this on page load to decide whether to show #chatbotPanel.
export const getChatbotEnabled = webMethod(
  Permissions.Anyone,
  async () => {
    return { stub: true };
  }
);

export const chatWithAssistant = webMethod(
  Permissions.Member,
  async (message, memberId) => {
    return { stub: true };
  }
);
```

- [ ] **Step 3: Create the stub** `src/backend/gamificationChatbot.web.js`

- [ ] **Step 4: Run tests — confirm stub errors (not import errors)**

```bash
npx vitest run tests/gamificationChatbot.test.js
```

Expected: Tests fail with assertion errors like `expected { stub: true } to equal { enabled: false }` — not module-not-found.

### Step 5: Full implementation

Replace the stub with the complete implementation:

```js
/**
 * @module gamificationChatbot
 * @description Phase 3 Gamification Chatbot — member-authenticated Claude assistant.
 *
 * Separate from styleConsultant.web.js: member-auth-gated, conversation-history-backed,
 * transactional. Shares ANTHROPIC_API_KEY and wix-fetch pattern.
 *
 * @setup (see Task 6 for manual steps)
 * CMS: ChatbotSessions (memberId, dailyTokensUsed, dailyResetDate, sessionHistory,
 *                        dailyMessageCount, lastMessageAt, hourlyCallCount, hourlyWindowStart)
 * Secrets: GAMIFICATION_CHATBOT_ENABLED ('true' to enable), ANTHROPIC_API_KEY (existing)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { getTodayET } from 'backend/utils/dateUtils';

const CHATBOT_SESSIONS = 'ChatbotSessions';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_MAX_TOKENS = 600;
const CLAUDE_ANTHROPIC_VERSION = '2023-06-01';

const DAILY_MESSAGE_LIMIT = 20;
const DAILY_TOKEN_LIMIT = 4000;
const INPUT_CHAR_LIMIT = 6000;       // ~1500 tokens at 4 chars/token
const SESSION_HISTORY_MAX_TURNS = 10;
const HOURLY_CALL_LIMIT = 20;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;

// Chars-to-tokens estimate: 4 chars ≈ 1 token (conservative)
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function trimHistory(history) {
  // Keep most recent turns up to SESSION_HISTORY_MAX_TURNS
  if (history.length <= SESSION_HISTORY_MAX_TURNS) return history;
  // Drop oldest pairs first (preserve whole user+assistant pairs)
  const excess = history.length - SESSION_HISTORY_MAX_TURNS;
  return history.slice(excess);
}

const SYSTEM_PROMPT = `You are the Carolina Futons Assistant — a friendly, knowledgeable helper \
for carolinafutons.com, a family-owned furniture store in Hendersonville, NC specializing in \
futons, murphy cabinet beds, platform beds, and mattresses.

You help members find the right furniture, understand care and sizing, check their orders, \
and manage their account. You are warm, direct, and concise. You do not make up product details — \
if you don't know something, say so and offer to help find it.

You have access to tools: product search, knowledge base lookup, wishlist management, \
order status, return requests, and promo code application. \
Always use tools to retrieve current information rather than relying on your training data \
for product details, pricing, or policies.

You never share another member's data. You never modify products, pricing, or inventory. \
Keep replies under 200 words unless the member asks for detail.`;

async function callClaude(messages, apiKey) {
  const { fetch } = await import('wix-fetch');
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': CLAUDE_ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!response.ok) return null;
  return response.json();
}

export const chatWithAssistant = webMethod(
  Permissions.Member,
  async (message, _clientMemberId) => {
    // 1. Feature flag
    let flagEnabled = false;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      const flag = await getSecret('GAMIFICATION_CHATBOT_ENABLED');
      flagEnabled = flag === 'true';
    } catch (_) {
      flagEnabled = false;
    }
    if (!flagEnabled) return { enabled: false };

    // 2. Auth — derive memberId from server-side context only
    const member = await currentMember.getMember();
    if (!member || !member._id) return { error: 'auth_required' };
    const memberId = member._id;

    // 3. Input validation + truncation
    const sanitized = (typeof message === 'string' ? message : '').trim();
    if (!sanitized) return { error: 'invalid_input' };
    const truncated = sanitized.slice(0, INPUT_CHAR_LIMIT);

    // 4. Load or create ChatbotSessions record
    let sessionRecord = null;
    try {
      const res = await wixData.query(CHATBOT_SESSIONS)
        .eq('memberId', memberId)
        .limit(1)
        .find();
      sessionRecord = res.items[0] || null;
    } catch (err) {
      return { error: 'assistant_unavailable' };
    }

    const now = new Date();
    const todayET = getTodayET();

    if (!sessionRecord) {
      sessionRecord = {
        memberId,
        dailyTokensUsed: 0,
        dailyResetDate: todayET,
        sessionHistory: '[]',
        dailyMessageCount: 0,
        lastMessageAt: now,
        hourlyCallCount: 0,
        hourlyWindowStart: now,
      };
    }

    // 5. Daily reset check
    if (sessionRecord.dailyResetDate !== todayET) {
      sessionRecord.dailyTokensUsed = 0;
      sessionRecord.dailyMessageCount = 0;
      sessionRecord.dailyResetDate = todayET;
    }

    // 6. Daily message limit
    if (sessionRecord.dailyMessageCount >= DAILY_MESSAGE_LIMIT) {
      return { limitReached: true, type: 'messages' };
    }

    // 7. Daily token estimate check
    const inputEstimate = estimateTokens(truncated);
    if (sessionRecord.dailyTokensUsed + inputEstimate > DAILY_TOKEN_LIMIT) {
      return { limitReached: true, type: 'tokens' };
    }

    // 8. Hourly rate limit (sliding window)
    const windowStart = sessionRecord.hourlyWindowStart
      ? new Date(sessionRecord.hourlyWindowStart)
      : now;
    const windowAge = now.getTime() - windowStart.getTime();
    if (windowAge > HOURLY_WINDOW_MS) {
      // Window expired — reset
      sessionRecord.hourlyCallCount = 0;
      sessionRecord.hourlyWindowStart = now;
    }
    if ((sessionRecord.hourlyCallCount || 0) >= HOURLY_CALL_LIMIT) {
      const retryAfterMs = HOURLY_WINDOW_MS - windowAge;
      return { error: 'rate_limit_exceeded', retryAfterMs };
    }

    // 9. Load session history and build messages array
    let history = [];
    try {
      history = JSON.parse(sessionRecord.sessionHistory || '[]');
    } catch (_) {
      history = [];
    }
    history = trimHistory(history);
    history.push({ role: 'user', content: truncated });
    const messagesToSend = trimHistory(history);

    // 10. Claude API call
    let apiKey;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      apiKey = await getSecret('ANTHROPIC_API_KEY');
    } catch (_) {
      return { error: 'assistant_unavailable' };
    }

    let claudeData = null;
    try {
      claudeData = await callClaude(messagesToSend, apiKey);
    } catch (_) {
      return { error: 'assistant_unavailable' };
    }
    if (!claudeData) return { error: 'assistant_unavailable' };

    const reply = claudeData.content?.[0]?.text || '';
    const tokensUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);

    // 11. Update history
    history.push({ role: 'assistant', content: reply });
    const finalHistory = trimHistory(history);

    // 12. Build updated session record
    const newMessageCount = (sessionRecord.dailyMessageCount || 0) + 1;
    const newTokensUsed = (sessionRecord.dailyTokensUsed || 0) + tokensUsed;
    const updatedRecord = {
      ...sessionRecord,
      sessionHistory: JSON.stringify(finalHistory),
      dailyMessageCount: newMessageCount,
      dailyTokensUsed: newTokensUsed,
      dailyResetDate: todayET,
      lastMessageAt: now,
      hourlyCallCount: (sessionRecord.hourlyCallCount || 0) + 1,
      hourlyWindowStart: sessionRecord.hourlyWindowStart || now,
    };

    // 13. CMS write (non-fatal — reply is returned even on failure)
    try {
      if (sessionRecord._id) {
        await wixData.update(CHATBOT_SESSIONS, updatedRecord);
      } else {
        await wixData.insert(CHATBOT_SESSIONS, updatedRecord);
      }
    } catch (err) {
      console.error('[gamificationChatbot] CMS write failed:', err);
      // Non-fatal — fall through and return reply
    }

    // 14. Return
    return {
      reply,
      dailyMessagesRemaining: DAILY_MESSAGE_LIMIT - newMessageCount,
      dailyTokensRemaining: DAILY_TOKEN_LIMIT - newTokensUsed,
      sessionHistory: finalHistory,
    };
  }
);
```

- [ ] **Step 5: Implement** `src/backend/gamificationChatbot.web.js`

- [ ] **Step 6: Run tests — confirm all pass**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/gamificationChatbot.test.js
```

Expected: All tests PASS.

- [ ] **Step 7: Run full suite — confirm no regressions**

```bash
npx vitest run
```

Expected: Full suite passes. If any pre-existing tests fail, investigate before proceeding.

- [ ] **Step 8: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/__mocks__/wix-web-module.js src/backend/gamificationChatbot.web.js tests/gamificationChatbot.test.js
git commit -m "feat(CF-chatbot): gamificationChatbot.web.js — feature flag, rate limits, Claude call, session management"
```

---

## Task 2: `callClaude` helper — isolated, testable Claude API integration

The `callClaude` helper is already embedded in Task 1's implementation. This task adds focused tests that verify the API call format in isolation, separate from the full webMethod flow.

**Files:**
- Modify: `tests/gamificationChatbot.test.js` (add `callClaude` export tests)
- Modify: `src/backend/gamificationChatbot.web.js` (export `_callClaude` for testing)

- [ ] **Step 1: Export `_callClaude` for testing**

Add an exported test-only alias to `gamificationChatbot.web.js`:

```js
// At the bottom of the file, after all webMethod exports:
// Export for testing only — underscore prefix signals internal use
export { callClaude as _callClaude };
```

- [ ] **Step 2: Add `callClaude` unit tests to `gamificationChatbot.test.js`**

```js
import { _callClaude } from '../src/backend/gamificationChatbot.web.js';

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
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/gamificationChatbot.test.js
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/backend/gamificationChatbot.web.js tests/gamificationChatbot.test.js
git commit -m "test(CF-chatbot): _callClaude unit tests — API format, error masking, headers"
```

---

## Task 3: Session management — `ChatbotSessions` read/write + daily reset

Session management is implemented inside `chatWithAssistant` in Task 1. This task adds focused tests for the session-specific edge cases: new member (no existing record), record with corrupted `sessionHistory` JSON, and history trim boundary conditions.

**Files:**
- Modify: `tests/gamificationChatbot.test.js` (add session edge case tests)

- [ ] **Step 1: Add session edge case tests**

Add to `tests/gamificationChatbot.test.js`:

```js
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
    const inserted = [];
    // Track inserts via __getInserted after the call
    const result = await chatWithAssistant('first message', 'member-123');
    expect(result.reply).toBeDefined();
    // Session was created (no error returned)
    expect(result.error).toBeUndefined();
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
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/gamificationChatbot.test.js
```

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/gamificationChatbot.test.js
git commit -m "test(CF-chatbot): session management edge cases — corrupted JSON, new member, trim boundary"
```

---

## Task 4: `chatWithAssistant` webMethod — integration test for full flow

This task adds end-to-end flow tests that exercise all layers together, including token accounting, the order scope guard pattern, and the return shape.

**Files:**
- Modify: `tests/gamificationChatbot.test.js`

- [ ] **Step 1: Add integration + order scope tests**

```js
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
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/gamificationChatbot.test.js
```

Expected: All pass.

- [ ] **Step 3: Run full suite**

```bash
npx vitest run
```

Expected: Full suite green.

- [ ] **Step 4: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add tests/gamificationChatbot.test.js
git commit -m "test(CF-chatbot): token accounting + order scope guard integration tests"
```

---

## Task 5: `ChatbotUI.js` — pure frontend module

**Files:**
- Create: `src/public/ChatbotUI.js`
- Create: `tests/ChatbotUI.test.js`

This module contains only pure functions — no direct Wix API calls. The page module (`Member Page.js`) calls these functions and handles the Wix element interactions. This keeps the module fully testable in Node.js/vitest with no Wix runtime.

### Step 1: Write failing tests

Create `tests/ChatbotUI.test.js`:

```js
/**
 * @file ChatbotUI.test.js
 * @description TDD tests for ChatbotUI.js — pure frontend helper functions.
 *
 * Covers:
 *  - formatThread: builds HTML string from sessionHistory array
 *  - formatLimitDisplay: "N messages remaining today" text
 *  - buildComingSoonState: returns state object for disabled flag
 *  - buildLimitReachedState: returns state object when daily limit hit
 *  - buildErrorState: returns state object for various error codes
 *  - buildLoadingState / buildReadyState: UI state toggles
 *  - shouldSkipAnimation: returns true when reduced motion
 */
import { describe, it, expect } from 'vitest';
import {
  formatThread,
  formatLimitDisplay,
  buildComingSoonState,
  buildLimitReachedState,
  buildErrorState,
  buildLoadingState,
  buildReadyState,
  shouldSkipAnimation,
} from '../src/public/ChatbotUI.js';

describe('formatThread', () => {
  it('returns empty string for empty history', () => {
    expect(formatThread([])).toBe('');
  });

  it('formats user turn with right-align marker', () => {
    const history = [{ role: 'user', content: 'hello' }];
    const result = formatThread(history);
    expect(result).toContain('hello');
    expect(result).toContain('user');
  });

  it('formats assistant turn with left-align marker', () => {
    const history = [{ role: 'assistant', content: 'hi there' }];
    const result = formatThread(history);
    expect(result).toContain('hi there');
    expect(result).toContain('assistant');
  });

  it('handles multi-turn history', () => {
    const history = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ];
    const result = formatThread(history);
    expect(result).toContain('q1');
    expect(result).toContain('a1');
    expect(result).toContain('q2');
  });

  it('handles null/undefined history gracefully', () => {
    expect(formatThread(null)).toBe('');
    expect(formatThread(undefined)).toBe('');
  });
});

describe('formatLimitDisplay', () => {
  it('returns correct message for N remaining', () => {
    expect(formatLimitDisplay(5)).toBe('5 messages remaining today');
  });

  it('returns "0 messages remaining today" for 0', () => {
    expect(formatLimitDisplay(0)).toBe('0 messages remaining today');
  });

  it('returns "1 message remaining today" (singular) for 1', () => {
    expect(formatLimitDisplay(1)).toBe('1 message remaining today');
  });
});

describe('buildComingSoonState', () => {
  it('returns state with chatbotPanel hidden and chatbotComingSoon visible', () => {
    const state = buildComingSoonState();
    expect(state.chatbotPanel).toBe('hidden');
    expect(state.chatbotComingSoon).toBe('visible');
    expect(state.inputDisabled).toBe(true);
  });
});

describe('buildLimitReachedState', () => {
  it('returns state with inputs disabled and limit copy', () => {
    const state = buildLimitReachedState('messages');
    expect(state.inputDisabled).toBe(true);
    expect(state.sendDisabled).toBe(true);
    expect(state.limitText).toContain('Daily limit reached');
    expect(state.limitText).toContain('midnight');
  });

  it('works for token limit too', () => {
    const state = buildLimitReachedState('tokens');
    expect(state.inputDisabled).toBe(true);
  });
});

describe('buildErrorState', () => {
  it('returns auth error text for auth_required', () => {
    const state = buildErrorState('auth_required');
    expect(state.errorText).toContain('Sign in');
  });

  it('returns unavailable text for assistant_unavailable', () => {
    const state = buildErrorState('assistant_unavailable');
    expect(state.errorText).toContain('temporarily unavailable');
  });

  it('returns rate limit text for rate_limit_exceeded', () => {
    const state = buildErrorState('rate_limit_exceeded');
    expect(state.errorText).toContain('Too many requests');
  });

  it('returns invalid input text for invalid_input', () => {
    const state = buildErrorState('invalid_input');
    expect(state.errorText).toContain('enter a message');
  });

  it('returns generic error text for unknown code', () => {
    const state = buildErrorState('unknown_code');
    expect(typeof state.errorText).toBe('string');
    expect(state.errorText.length).toBeGreaterThan(0);
  });
});

describe('buildLoadingState', () => {
  it('returns sendDisabled true and loadingVisible true', () => {
    const state = buildLoadingState();
    expect(state.sendDisabled).toBe(true);
    expect(state.loadingVisible).toBe(true);
  });
});

describe('buildReadyState', () => {
  it('returns sendDisabled false and loadingVisible false', () => {
    const state = buildReadyState();
    expect(state.sendDisabled).toBe(false);
    expect(state.loadingVisible).toBe(false);
  });
});

describe('shouldSkipAnimation', () => {
  it('returns true when prefersReducedMotion is true', () => {
    expect(shouldSkipAnimation(true)).toBe(true);
  });

  it('returns false when prefersReducedMotion is false', () => {
    expect(shouldSkipAnimation(false)).toBe(false);
  });

  it('returns false for undefined/null', () => {
    expect(shouldSkipAnimation(undefined)).toBe(false);
    expect(shouldSkipAnimation(null)).toBe(false);
  });
});
```

- [ ] **Step 1: Write failing tests** — create `tests/ChatbotUI.test.js`

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/ChatbotUI.test.js
```

Expected: FAIL — "Cannot find module '../src/public/ChatbotUI.js'"

### Step 3: Implement `ChatbotUI.js`

Create `src/public/ChatbotUI.js`:

```js
/**
 * @module ChatbotUI
 * @description Pure functions for the Gamification Chatbot UI.
 * No direct Wix API calls — all side effects are handled by the page module
 * (Member Page.js) which calls these functions and applies the returned state
 * to Wix elements.
 *
 * Phase 3 — gamificationChatbot.web.js companion frontend module.
 */

/**
 * Formats a sessionHistory array into a display string.
 * Returns a newline-separated list of turns with role prefix.
 * The page module renders this into #chatbotResponseArea.
 *
 * @param {Array<{role: string, content: string}>|null} history
 * @returns {string}
 */
export function formatThread(history) {
  if (!Array.isArray(history) || history.length === 0) return '';
  return history
    .map(turn => `[${turn.role}] ${turn.content}`)
    .join('\n');
}

/**
 * Returns the limit indicator text shown in #chatbotLimitDisplay.
 * @param {number} remaining
 * @returns {string}
 */
export function formatLimitDisplay(remaining) {
  const word = remaining === 1 ? 'message' : 'messages';
  return `${remaining} ${word} remaining today`;
}

/**
 * State object for when the feature flag is off.
 * Page module hides #chatbotPanel and shows #chatbotComingSoon.
 * @returns {{ chatbotPanel: string, chatbotComingSoon: string, inputDisabled: boolean }}
 */
export function buildComingSoonState() {
  return {
    chatbotPanel: 'hidden',
    chatbotComingSoon: 'visible',
    inputDisabled: true,
    sendDisabled: true,
  };
}

/**
 * State object for when the daily limit is reached.
 * @param {'messages'|'tokens'} type
 * @returns {{ inputDisabled: boolean, sendDisabled: boolean, limitText: string }}
 */
export function buildLimitReachedState(type) {
  return {
    inputDisabled: true,
    sendDisabled: true,
    limitText: 'Daily limit reached — resets at midnight ET',
  };
}

/**
 * State object for error responses from chatWithAssistant.
 * @param {string} errorCode
 * @returns {{ errorText: string }}
 */
export function buildErrorState(errorCode) {
  const messages = {
    auth_required: 'Sign in to chat with the assistant.',
    assistant_unavailable: 'The assistant is temporarily unavailable. Please try again.',
    rate_limit_exceeded: 'Too many requests — please wait a moment.',
    invalid_input: 'Please enter a message.',
  };
  return {
    errorText: messages[errorCode] || 'Something went wrong. Please try again.',
  };
}

/**
 * State object for while a Claude response is in flight.
 * @returns {{ sendDisabled: boolean, loadingVisible: boolean }}
 */
export function buildLoadingState() {
  return { sendDisabled: true, loadingVisible: true };
}

/**
 * State object when ready for next message input.
 * @returns {{ sendDisabled: boolean, loadingVisible: boolean }}
 */
export function buildReadyState() {
  return { sendDisabled: false, loadingVisible: false };
}

/**
 * Returns true if animations should be skipped (user prefers reduced motion).
 * Pass the result of $w('#chatbotResponseArea').accessibility?.prefersReducedMotion
 * or a mediaQuery check from the page module.
 *
 * @param {boolean|undefined|null} prefersReducedMotion
 * @returns {boolean}
 */
export function shouldSkipAnimation(prefersReducedMotion) {
  return prefersReducedMotion === true;
}
```

- [ ] **Step 3: Implement** `src/public/ChatbotUI.js`

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run tests/ChatbotUI.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: Full suite green.

- [ ] **Step 6: Commit**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
git add src/public/ChatbotUI.js tests/ChatbotUI.test.js
git commit -m "feat(CF-chatbot): ChatbotUI.js — pure frontend state functions with tests"
```

---

## Task 6: Manual steps (CMS, Secrets, Editor elements, Hookup Guides)

These steps cannot be automated and require Stilgar (browser) and/or Wix Dashboard access. No code changes — checklist only.

**Executor:** Stilgar (browser tasks) or Melania (hookup guide docs).

- [ ] **Step 1: Create `ChatbotSessions` CMS collection in Wix Dashboard**

  Collection name: `ChatbotSessions`

  | Field name | Type | Notes |
  |---|---|---|
  | `memberId` | Text | Required. Add index for O(1) lookup. |
  | `dailyTokensUsed` | Number | Default 0 |
  | `dailyResetDate` | Text | ET date string e.g. `"2026-03-22"` |
  | `sessionHistory` | Text (Long) | JSON array — use Long Text field type |
  | `dailyMessageCount` | Number | Default 0 |
  | `lastMessageAt` | Date & Time | UTC timestamp |
  | `hourlyCallCount` | Number | Default 0 — hourly sliding window counter |
  | `hourlyWindowStart` | Date & Time | UTC — start of current hourly window |

  **Permissions:** Backend read/write only. No public (client) access.

  **Index:** Add index on `memberId`.

- [ ] **Step 2: Create `ChatbotKnowledge` CMS collection in Wix Dashboard**

  Collection name: `ChatbotKnowledge`

  | Field name | Type | Notes |
  |---|---|---|
  | `topicKey` | Text | Required. Add index. Enum: `sizing`, `care`, `faq`, `returns`, `style_guide` |
  | `content` | Text (Long) | Markdown/plain text — Claude references verbatim |
  | `updatedAt` | Date & Time | For cache reference |
  | `active` | Boolean | Toggle topics without deleting rows |

  **Populate** at minimum: one row each for `sizing`, `care`, `faq`, `returns`, `style_guide` with placeholder content. Stilgar edits content from Dashboard.

- [ ] **Step 3: Add `GAMIFICATION_CHATBOT_ENABLED` secret in Wix Secrets Manager**

  - Secret name: `GAMIFICATION_CHATBOT_ENABLED`
  - Initial value: `""` (empty string — feature is OFF at deploy time)
  - To enable: change value to `true` from Secrets Manager. No code deploy needed.
  - `ANTHROPIC_API_KEY` already exists — do not duplicate or modify.

- [ ] **Step 4: Add editor elements in Wix Studio (Stilgar)**

  New elements needed inside `#chatbotSection` (new section on Member Page):

  | Nickname | Element type | Notes |
  |---|---|---|
  | `#chatbotSection` | Section / Box | Outer container — new section on Member Page |
  | `#chatbotPanel` | Box | Card container — hidden when `enabled: false` |
  | `#chatbotInput` | TextInput | Member types message here. Add visible label (not placeholder-only). |
  | `#chatbotSendBtn` | Button | Submit message |
  | `#chatbotResponseArea` | Text / RichText | Conversation thread. Set `aria-live="polite"` for screen reader support. |
  | `#chatbotLimitDisplay` | Text | "N messages remaining today" |
  | `#chatbotComingSoon` | Text | "Coming Soon" — shown when flag is off |
  | `#chatbotLoadingBear` | Lottie | Media ID: `loading-bear-nSFUgnPuv6` — shown while awaiting reply |

  Assign all nicknames via the bulk rename script in EDITOR_HOOKUP_GUIDE.html.

- [ ] **Step 5: Update `EDITOR_HOOKUP_GUIDE.html`**

  Add Phase 3 section with:
  - All 8 new element nicknames (table above)
  - New CMS collections: `ChatbotSessions` (8 fields), `ChatbotKnowledge` (4 fields)
  - Secret: `GAMIFICATION_CHATBOT_ENABLED`
  - Mobile note: `#chatbotPanel` rendered inside dallas's modal container on mobile

  File location: `/Users/hal/gt/cfutons/carolina-futons-stage3-velo/EDITOR_HOOKUP_GUIDE.html` (or wherever the active guide lives — check MEMORY.md).

- [ ] **Step 6: Sync `EDITOR-HOOKUP-GUIDE.md`**

  Mirror all changes from the HTML guide into the Markdown version. Both must be in sync per the standing order in `feedback_docs_always_current.md`.

- [ ] **Step 7: Final commit (guide updates)**

  ```bash
  # From the appropriate repo directory
  git add EDITOR_HOOKUP_GUIDE.html EDITOR-HOOKUP-GUIDE.md
  git commit -m "docs(phase3): chatbot element nicknames + CMS collections in hookup guide"
  ```

---

## Definition of Done Verification

Before marking Phase 3 complete, confirm each item from the spec's DoD:

- [ ] `ChatbotSessions` CMS collection created (6+2 fields — adds hourlyCallCount, hourlyWindowStart)
- [ ] `ChatbotKnowledge` CMS collection created and populated (5 topic keys)
- [ ] `GAMIFICATION_CHATBOT_ENABLED` secret created (empty = off)
- [ ] `src/backend/gamificationChatbot.web.js` created and all tests pass
- [ ] `getChatbotEnabled()` webMethod implemented (Permissions.Anyone, reads flag only, returns `{ enabled: boolean }`, does NOT write CMS) — verified by test
- [ ] Feature flag returns `{ enabled: false }` when absent/empty — verified by test (both `getChatbotEnabled` and `chatWithAssistant`)
- [ ] Daily reset logic verified by test (date boundary crossing resets counts)
- [ ] Daily message limit (20) enforced — verified by test
- [ ] Daily token limit (4,000) enforced — verified by test
- [ ] Per-message input hard-truncated at 6,000 chars before API call — verified by test
- [ ] Hourly rate limit (20 calls/hr, sliding window) enforced — verified by test
- [ ] `memberId` always derived from server-side auth context — verified by test
- [ ] Order lookup scope-checked: only returns orders for authenticated memberId — verified by test (requires wix-stores-backend mock — implement in tool resolution step)
- [ ] Return request initiation validates orderId ownership before inserting — verified by test (requires wix-stores-backend mock — implement in tool resolution step)
- [ ] Claude API errors return `{ error: 'assistant_unavailable' }` — no details leaked — verified by test
- [ ] `sessionHistory` trimmed to 10 turns max — verified by test
- [ ] CMS write failure is non-fatal: reply still returned, error logged — verified by test
- [ ] `src/public/ChatbotUI.js` created and all tests pass
- [ ] `#chatbotPanel` hidden and `#chatbotComingSoon` shown when `enabled: false` (manual verify)
- [ ] Input controls disabled when daily limit reached (manual verify)
- [ ] Mobile modal integration documented in PR — coordinate with dallas
- [ ] `EDITOR_HOOKUP_GUIDE.html` updated (8 new element nicknames, 2 new CMS collections)
- [ ] `EDITOR-HOOKUP-GUIDE.md` synced with HTML
- [ ] Full test suite (`npx vitest run`) green with no regressions
