/**
 * surveyService.test.js
 * CF-1mlj — NPS/CSAT post-purchase survey system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wix-data ────────────────────────────────────────────────────────────

vi.mock('wix-data', () => ({
  default: {
    insert: vi.fn(),
    update: vi.fn(),
    query: vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
      ge: vi.fn().mockReturnThis(),
      isNotEmpty: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      count: vi.fn(),
      find: vi.fn(),
    })),
  },
}));

// ── Mock wix-members-backend ─────────────────────────────────────────────────

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn() },
}));

// ── Mock utils ───────────────────────────────────────────────────────────────

vi.mock('backend/utils/sanitize', () => ({
  sanitize: vi.fn((val, max) => (val ? String(val).slice(0, max ?? val.length) : '')),
  validateId: vi.fn((v) => v || null),
}));

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  scheduleSurvey,
  submitSurveyResponse,
  getSurveyForOrder,
  getNpsStats,
} from '../src/backend/surveyService.web.js';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

const mockInsert = vi.mocked(wixData.insert);
const mockUpdate = vi.mocked(wixData.update);
const mockGetMember = vi.mocked(currentMember.getMember);

let mockFind;
let mockCount;

function setupQueryMocks() {
  mockFind = vi.fn().mockResolvedValue({ items: [] });
  mockCount = vi.fn().mockResolvedValue(0);
  vi.mocked(wixData.query).mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    ge: vi.fn().mockReturnThis(),
    isNotEmpty: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    count: mockCount,
    find: mockFind,
  });
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-survey-1';
const ORDER_ID = 'order-survey-1';

function makeSurveyRecord(overrides = {}) {
  return {
    _id: 'survey-001',
    memberId: MEMBER_ID,
    orderId: ORDER_ID,
    npsScore: null,
    comment: null,
    sentAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

// ── scheduleSurvey ───────────────────────────────────────────────────────────

describe('scheduleSurvey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryMocks();
    mockInsert.mockResolvedValue({ _id: 'survey-001' });
    mockCount.mockResolvedValue(0);
  });

  it('creates survey record and queues email', async () => {
    const result = await scheduleSurvey({ memberId: MEMBER_ID, orderId: ORDER_ID });
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(2); // SurveyResponses + EmailQueue
  });

  it('rejects when memberId is missing', async () => {
    const result = await scheduleSurvey({ orderId: ORDER_ID });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/memberId/i);
  });

  it('rejects when orderId is missing', async () => {
    const result = await scheduleSurvey({ memberId: MEMBER_ID });
    expect(result.success).toBe(false);
  });

  it('is idempotent — skips if survey already exists (duplicate ID)', async () => {
    mockInsert.mockRejectedValueOnce(new Error('WD_DUPLICATE: item already exists'));
    const result = await scheduleSurvey({ memberId: MEMBER_ID, orderId: ORDER_ID });
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(false);
  });

  it('schedules email for 7 days after deliveredAt', async () => {
    const deliveredAt = new Date('2026-04-01T00:00:00Z');
    await scheduleSurvey({ memberId: MEMBER_ID, orderId: ORDER_ID, deliveredAt });

    const emailQueueCall = mockInsert.mock.calls.find(
      ([collection]) => collection === 'EmailQueue'
    );
    expect(emailQueueCall).toBeDefined();
    const emailRecord = emailQueueCall[1];
    const scheduledFor = new Date(emailRecord.scheduledFor);
    expect(scheduledFor.toISOString().slice(0, 10)).toBe('2026-04-08');
  });

  it('still succeeds even if email queue insert fails', async () => {
    mockInsert
      .mockResolvedValueOnce({ _id: 'survey-001' }) // SurveyResponses
      .mockRejectedValueOnce(new Error('email error')); // EmailQueue

    const result = await scheduleSurvey({ memberId: MEMBER_ID, orderId: ORDER_ID });
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(true);
  });

  it('returns error when SurveyResponses insert fails', async () => {
    mockInsert.mockRejectedValueOnce(new Error('db error'));
    const result = await scheduleSurvey({ memberId: MEMBER_ID, orderId: ORDER_ID });
    expect(result.success).toBe(false);
  });
});

// ── submitSurveyResponse ─────────────────────────────────────────────────────

describe('submitSurveyResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryMocks();
    mockGetMember.mockResolvedValue({ _id: MEMBER_ID });
    mockFind.mockResolvedValue({ items: [makeSurveyRecord()] });
    mockUpdate.mockResolvedValue({});
  });

  it('submits valid NPS score', async () => {
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 9 });
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('accepts score 0 (minimum)', async () => {
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts score 10 (maximum)', async () => {
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 10 });
    expect(result.success).toBe(true);
  });

  it('rejects score 11 (out of range)', async () => {
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 11 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/0.*10/);
  });

  it('rejects score -1 (out of range)', async () => {
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects fractional scores', async () => {
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 7.5 });
    expect(result.success).toBe(false);
  });

  it('accepts optional comment', async () => {
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 8, comment: 'Great service!' });
    expect(result.success).toBe(true);
    const updateCall = mockUpdate.mock.calls[0][1];
    expect(updateCall.comment).toBe('Great service!');
  });

  it('rejects when not authenticated', async () => {
    mockGetMember.mockResolvedValue(null);
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 9 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth/i);
  });

  it('rejects when orderId is missing', async () => {
    const result = await submitSurveyResponse({ npsScore: 9 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/orderId/i);
  });

  it('returns error when survey not found for order', async () => {
    mockFind.mockResolvedValue({ items: [] });
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no survey/i);
  });

  it('rejects double submission', async () => {
    mockFind.mockResolvedValue({ items: [makeSurveyRecord({ completedAt: new Date() })] });
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 9 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already completed/i);
  });

  it('returns error when update fails', async () => {
    mockUpdate.mockRejectedValue(new Error('db error'));
    const result = await submitSurveyResponse({ orderId: ORDER_ID, npsScore: 9 });
    expect(result.success).toBe(false);
  });
});

// ── getSurveyForOrder ────────────────────────────────────────────────────────

describe('getSurveyForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryMocks();
    mockGetMember.mockResolvedValue({ _id: MEMBER_ID });
    mockFind.mockResolvedValue({ items: [] });
  });

  it('returns null survey when none found', async () => {
    const result = await getSurveyForOrder(ORDER_ID);
    expect(result.success).toBe(true);
    expect(result.survey).toBeNull();
  });

  it('returns survey with isCompleted=false when not done', async () => {
    mockFind.mockResolvedValue({ items: [makeSurveyRecord()] });
    const result = await getSurveyForOrder(ORDER_ID);
    expect(result.success).toBe(true);
    expect(result.survey.isCompleted).toBe(false);
  });

  it('returns survey with isCompleted=true when done', async () => {
    mockFind.mockResolvedValue({ items: [makeSurveyRecord({ completedAt: new Date(), npsScore: 8 })] });
    const result = await getSurveyForOrder(ORDER_ID);
    expect(result.survey.isCompleted).toBe(true);
    expect(result.survey.npsScore).toBe(8);
  });

  it('rejects when not authenticated', async () => {
    mockGetMember.mockResolvedValue(null);
    const result = await getSurveyForOrder(ORDER_ID);
    expect(result.success).toBe(false);
  });

  it('rejects when orderId is missing', async () => {
    const result = await getSurveyForOrder('');
    expect(result.success).toBe(false);
  });
});

// ── getNpsStats ──────────────────────────────────────────────────────────────

describe('getNpsStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryMocks();
    mockFind.mockResolvedValue({ items: [] });
  });

  it('returns zeroed stats when no responses', async () => {
    const result = await getNpsStats();
    expect(result.success).toBe(true);
    expect(result.stats.count).toBe(0);
    expect(result.stats.npsScore).toBeNull();
  });

  it('computes NPS from promoters - detractors', async () => {
    // 4 promoters (9-10), 2 passives (7-8), 4 detractors (0-6) → NPS = (4-4)/10 = 0
    const scores = [10, 9, 9, 10, 8, 7, 6, 5, 4, 3];
    mockFind.mockResolvedValue({
      items: scores.map((npsScore, i) => makeSurveyRecord({ _id: `s-${i}`, npsScore, completedAt: new Date() })),
    });

    const result = await getNpsStats();
    expect(result.success).toBe(true);
    expect(result.stats.count).toBe(10);
    expect(result.stats.npsScore).toBe(0);
    expect(result.stats.promoters).toBe(4);
    expect(result.stats.passives).toBe(2);
    expect(result.stats.detractors).toBe(4);
  });

  it('computes positive NPS when mostly promoters', async () => {
    const scores = [10, 10, 10, 9, 9];
    mockFind.mockResolvedValue({
      items: scores.map((npsScore, i) => makeSurveyRecord({ _id: `s-${i}`, npsScore, completedAt: new Date() })),
    });

    const result = await getNpsStats();
    expect(result.stats.npsScore).toBe(100); // (5-0)/5 = 100%
  });

  it('clamps days to 365 max', async () => {
    const result = await getNpsStats({ days: 9999 });
    expect(result.success).toBe(true);
  });

  it('clamps days to 1 min', async () => {
    const result = await getNpsStats({ days: 0 });
    expect(result.success).toBe(true);
  });

  it('handles query failure gracefully', async () => {
    mockFind.mockRejectedValue(new Error('db error'));
    const result = await getNpsStats();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
