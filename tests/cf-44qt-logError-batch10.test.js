/**
 * TDD tests pinning logError migration for batch10:
 *   cartRecovery.web.js        (6 sites)
 *   videoReviewService.web.js  (5 sites)
 *   swatchKitService.web.js    (5 sites)
 *   productReviews.web.js      (5 sites)
 *   liveChat.web.js            (5 sites)
 *
 * cf-44qt
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── vi.hoisted mocks ─────────────────────────────────────────────────

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }));
const { mockGamificationEvent } = vi.hoisted(() => ({ mockGamificationEvent: vi.fn() }));

// ── Static mocks ─────────────────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/errorHandler', () => ({ logError: mockLogError }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : ''),
  validateEmail: (v) => (typeof v === 'string' && v.includes('@') ? v.trim() : ''),
  validateId: (v) => (typeof v === 'string' && v.length > 0 ? v.trim() : ''),
  isWixMediaUrl: (v) => typeof v === 'string' && v.startsWith('wix:image://'),
}));

vi.mock('backend/utils/safeParse', () => ({
  safeParse: (v) => { try { return JSON.parse(v); } catch { return null; } },
}));

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('backend/utils/auditLog', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn().mockResolvedValue({ _id: 'mem-1', nickname: 'Tester' }) },
}));

vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailMember: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('backend/couponsService.web', () => ({
  generateRecoveryCoupon: vi.fn().mockResolvedValue('COUPON-123'),
}));

vi.mock('backend/gamificationCore.web', () => ({
  findMemberRecord: vi.fn().mockResolvedValue(null),
  computeTierInfo: vi.fn().mockReturnValue({ tier: 'bronze' }),
}));

vi.mock('backend/emailTemplates.web', () => ({
  resolveTemplateId: vi.fn().mockResolvedValue('template-1'),
}));

vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: mockGamificationEvent,
}));

vi.mock('backend/storeCreditService.web', () => ({
  issueStoreCredit: vi.fn().mockResolvedValue({ success: true, creditId: 'credit-1' }),
}));

import { __seed, __setQueryError, __setInsertError, __reset } from './__mocks__/wix-data.js';

// ── Import SUT ───────────────────────────────────────────────────────

const { getAbandonedCartStats, getRecoverableCarts, markRecoveryEmailSent, exposeCartAbandonPayload } =
  await import('../src/backend/cartRecovery.web.js');
const { getVideoReviews, submitVideoReview } =
  await import('../src/backend/videoReviewService.web.js');
const { getSwatchKitCreditStatus, markCreditApplied } =
  await import('../src/backend/swatchKitService.web.js');
const { getUnifiedReviews, getModerationQueue } =
  await import('../src/backend/productReviews.web.js');
const { createSupportTicket, getChatContext } =
  await import('../src/backend/liveChat.web.js');

// ════════════════════════════════════════════════════════════════════
// cartRecovery
// ════════════════════════════════════════════════════════════════════

describe('cartRecovery — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('getAbandonedCartStats calls logError on query failure', async () => {
    __setQueryError('AbandonedCarts', new Error('db fail'));
    await getAbandonedCartStats();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('cartRecovery'),
      expect.any(Error),
    );
  });

  it('getRecoverableCarts calls logError on query failure', async () => {
    __setQueryError('AbandonedCarts', new Error('db fail'));
    const r = await getRecoverableCarts();
    expect(Array.isArray(r)).toBe(true);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('cartRecovery'),
      expect.any(Error),
    );
  });

  it('exposeCartAbandonPayload calls logError on query failure', async () => {
    __setQueryError('AbandonedCarts', new Error('db fail'));
    const r = await exposeCartAbandonPayload({ memberId: 'member-1' });
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('cartRecovery'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// videoReviewService
// ════════════════════════════════════════════════════════════════════

describe('videoReviewService — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('getVideoReviews calls logError on query failure', async () => {
    __setQueryError('VideoReviews', new Error('db fail'));
    const r = await getVideoReviews('prod-1');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('videoReviewService'),
      expect.any(Error),
    );
  });

  it('submitVideoReview calls logError on insert failure', async () => {
    __setInsertError('VideoReviews', new Error('db fail'));
    const r = await submitVideoReview('prod-1', 'wix:image://v1/test.jpg', 'nice');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('videoReviewService'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// swatchKitService
// ════════════════════════════════════════════════════════════════════

describe('swatchKitService — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('getSwatchKitCreditStatus calls logError on query failure', async () => {
    __setQueryError('SwatchKitOrders', new Error('db fail'));
    const r = await getSwatchKitCreditStatus('order-1', 'test@example.com');
    expect(r.hasPendingCredit).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('swatchKitService'),
      expect.any(Error),
    );
  });

  it('markCreditApplied calls logError on query failure', async () => {
    __setQueryError('SwatchKitOrders', new Error('db fail'));
    const r = await markCreditApplied('order-1', 'checkout-1');
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('swatchKitService'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// productReviews
// ════════════════════════════════════════════════════════════════════

describe('productReviews — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('getUnifiedReviews calls logError on query failure', async () => {
    __setQueryError('Reviews', new Error('db fail'));
    const r = await getUnifiedReviews('prod-1');
    expect(Array.isArray(r.reviews)).toBe(true);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('productReviews'),
      expect.any(Error),
    );
  });

  it('getModerationQueue calls logError on query failure', async () => {
    __setQueryError('Reviews', new Error('db fail'));
    const r = await getModerationQueue();
    expect(Array.isArray(r.reviews)).toBe(true);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('productReviews'),
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// liveChat
// ════════════════════════════════════════════════════════════════════

describe('liveChat — logError migration', () => {
  beforeEach(() => { __reset(); mockLogError.mockClear(); });

  it('createSupportTicket calls logError on insert failure', async () => {
    __setInsertError('SupportTickets', new Error('db fail'));
    const r = await createSupportTicket({ email: 'test@example.com', message: 'Hello' });
    expect(r.success).toBe(false);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('liveChat'),
      expect.any(Error),
    );
  });

  it('getChatContext calls logError on query failure', async () => {
    __setQueryError('Stores/Orders', new Error('db fail'));
    const r = await getChatContext('prod-1');
    expect(r.success).toBe(true);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('liveChat'),
      expect.any(Error),
    );
  });
});
