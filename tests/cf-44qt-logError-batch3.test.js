/**
 * @file cf-44qt-logError-batch3.test.js
 * @description TDD red → green for cf-44qt batch3: verify console.error sites
 * in coreWebVitals, customEvents, emailQueueService, emailTemplates, and
 * gamificationChatbot are migrated to the canonical logError from
 * backend/utils/errorHandler.
 *
 * All tests are RED until source migration is applied.
 * cf-tok3 (cf-44qt wave batch3)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __setInsertError,
  __setQueryError,
  __onUpdate,
} from './__mocks__/wix-data.js';
import { __reset as resetCRM } from './__mocks__/wix-crm-backend.js';
import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __reset as resetMembers, __setMember } from './__mocks__/wix-members-backend.js';

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));
vi.mock('backend/utils/analyticsEvents', () => ({
  insertAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
}));

import { logError } from '../src/backend/utils/errorHandler.js';
import { insertAnalyticsEvent } from '../src/backend/utils/analyticsEvents.js';
import { reportMetrics } from '../src/backend/coreWebVitals.web.js';
import { trackCustomEvent } from '../src/backend/customEvents.web.js';
import { enqueueEmail, processQueue, cancelQueuedEmails } from '../src/backend/emailQueueService.web.js';
import { queuePromotionalEmail } from '../src/backend/emailTemplates.web.js';
import { chatWithAssistant } from '../src/backend/gamificationChatbot.web.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

function makeQueueItem(overrides = {}) {
  return {
    _id: 'qi-1',
    templateId: 'welcome_series_1',
    recipientEmail: 'test@example.com',
    recipientContactId: 'contact-1',
    variables: '{}',
    sequenceType: 'welcome',
    sequenceStep: 1,
    status: 'pending',
    scheduledFor: new Date(Date.now() - 1000),
    attempt: 0,
    ...overrides,
  };
}

function makeMember(id = 'member-123') {
  return { _id: id, contactId: id };
}

function makeSession(overrides = {}) {
  return {
    _id: 'session-1',
    memberId: 'member-123',
    dailyTokensUsed: 0,
    dailyResetDate: '2026-03-22',
    sessionHistory: '[]',
    dailyMessageCount: 0,
    lastMessageAt: new Date('2026-03-22T10:00:00Z'),
    hourlyCallCount: 0,
    hourlyWindowStart: new Date(),
    ...overrides,
  };
}

function makeClaudeOkResponse(text = 'ok') {
  return {
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text }],
      usage: { input_tokens: 50, output_tokens: 20 },
    }),
  };
}

beforeEach(() => {
  resetData();
  resetCRM();
  vi.mocked(logError).mockClear();
  vi.mocked(insertAnalyticsEvent).mockResolvedValue(undefined);
});

// ── coreWebVitals ─────────────────────────────────────────────────────────────

describe('coreWebVitals.reportMetrics', () => {
  it('calls canonical logError when wixData.insert fails', async () => {
    __seed('PerformanceMetrics', []);
    // Rate limit insert to MetricsReportRateLimit is unaffected (different collection)
    __setInsertError('PerformanceMetrics', new Error('DB unavailable'));

    const result = await reportMetrics({
      sessionId: 'sess-abc',
      page: '/test',
      deviceType: 'desktop',
      lcp: 1800,
    });

    expect(result).toEqual({ success: false, error: 'Failed to report metrics' });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[coreWebVitals]'),
      expect.any(Error),
    );
  });
});

// ── customEvents ──────────────────────────────────────────────────────────────

describe('customEvents.trackCustomEvent', () => {
  it('calls canonical logError when insertAnalyticsEvent throws', async () => {
    vi.mocked(insertAnalyticsEvent).mockRejectedValueOnce(new Error('analytics write failed'));

    const result = await trackCustomEvent('quiz_started', { source: 'quiz' });

    expect(result).toEqual({ success: false });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[customEvents]'),
      expect.any(Error),
    );
  });
});

// ── emailQueueService ────────────────────────────────────────────────────────

describe('emailQueueService', () => {
  it('enqueueEmail: calls canonical logError on insert failure', async () => {
    __seed('EmailQueue', []);
    __setInsertError('EmailQueue', new Error('insert failed'));

    const result = await enqueueEmail({
      templateId: 'welcome_series_1',
      recipientEmail: 'user@example.com',
      recipientContactId: 'c-1',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      scheduledFor: new Date(),
    });

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[emailQueueService]'),
      expect.any(Error),
    );
  });

  it('processQueue: calls canonical logError when queue query fails', async () => {
    __setQueryError('EmailQueue', new Error('query exploded'));

    const result = await processQueue();

    expect(result).toEqual(expect.objectContaining({ sent: 0, failed: 0 }));
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[emailQueueService]'),
      expect.any(Error),
    );
  });

  it('cancelQueuedEmails: calls canonical logError when query fails', async () => {
    __setQueryError('EmailQueue', new Error('DB offline'));

    const result = await cancelQueuedEmails('user@example.com', 'welcome');

    expect(result).toEqual({ cancelled: 0 });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[emailQueueService]'),
      expect.any(Error),
    );
  });
});

// ── emailTemplates ─────────────────────────────────────────────────────────────

describe('emailTemplates.queuePromotionalEmail', () => {
  it('calls canonical logError when EmailQueue insert fails', async () => {
    __seed('Unsubscribes', []);
    __seed('EmailQueue', []);
    __setInsertError('EmailQueue', new Error('insert failed'));

    const result = await queuePromotionalEmail(
      'promotional_sale',
      [{ email: 'buyer@example.com', firstName: 'Alex' }],
      { saleName: 'Spring Sale', discountPercent: '15' },
    );

    expect(result).toEqual({ success: false, queued: 0, skipped: 0 });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[emailTemplates]'),
      expect.any(Error),
    );
  });
});

// ── gamificationChatbot ────────────────────────────────────────────────────────

describe('gamificationChatbot.chatWithAssistant', () => {
  beforeEach(() => {
    resetFetch();
    resetSecrets();
    resetMembers();
  });

  it('calls canonical logError on CMS write failure but still returns reply', async () => {
    __setSecrets({
      GAMIFICATION_CHATBOT_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    });
    __setMember(makeMember());
    __seed('ChatbotSessions', [makeSession()]);
    __setHandler(() => makeClaudeOkResponse('great answer'));

    // Force CMS update to throw — non-fatal path
    __onUpdate((col) => {
      if (col === 'ChatbotSessions') throw new Error('DB write failed');
    });

    const result = await chatWithAssistant('hello there', 'member-123');

    expect(result.reply).toBe('great answer');
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[gamificationChatbot]'),
      expect.any(Error),
    );
  });
});
