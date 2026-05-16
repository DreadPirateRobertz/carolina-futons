/**
 * cf-44qt sibling — events.js observability cleanup.
 * All 26 raw console.error catches migrated to logError with structured
 * `[events] <handler> <reason>` tags for greppable on-call surface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  redactEmail: (e) => e ? e.replace(/^(.{2}).*@/, '$1***@') : '',
}));
vi.mock('backend/emailAutomation.web', () => ({
  triggerWelcomeSequence: vi.fn(async () => { throw new Error('email-automation failure'); }),
  triggerPostPurchaseSequence: vi.fn(async () => undefined),
  triggerRestockNotifications: vi.fn(async () => ({ success: true, count: 0 })),
  cancelCareSequence: vi.fn(async () => undefined),
}));
vi.mock('backend/contentOrchestrator.web', () => ({
  triggerEventOrchestration: vi.fn(async () => ({ success: true, scheduled: [] })),
}));
vi.mock('backend/gamificationEventReceiver.web', () => ({
  seedWelcomePoints: vi.fn(async () => undefined),
  receiveGamificationEvent: vi.fn(async () => ({ success: true })),
}));

import {
  __reset as resetData,
  __seed,
  __onInsert,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — events.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('wixEcom_onAbandonedCheckoutCreated wires logError on AbandonedCarts insert throw', async () => {
    __seed('AbandonedCarts', []);
    __onInsert(() => { throw new Error('DB down'); });
    const mod = await import('../src/backend/events.js');
    await mod.wixEcom_onAbandonedCheckoutCreated({
      entity: {
        _id: 'co-1',
        buyerInfo: { email: 'alice@test.com' },
      },
    });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/\[events\]/);
    expect(allTags).toMatch(/wixEcom_onAbandonedCheckoutCreated/);
    // Redaction preserved through logError context.
    expect(allTags).toContain('al***@test.com');
    expect(allTags).not.toContain('alice@test.com');
  });

  it('wixMembers_onMemberCreated wires logError on welcome-sequence throw', async () => {
    const mod = await import('../src/backend/events.js');
    await mod.wixMembers_onMemberCreated({
      entity: { _id: 'member-1', loginEmail: 'new@test.com' },
    });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/\[events\]/);
    expect(allTags).toMatch(/wixMembers_onMemberCreated/);
  });
});
