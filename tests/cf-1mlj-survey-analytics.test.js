/**
 * @file cf-1mlj-survey-analytics.test.js
 * @description Tests for NPS dashboard section in analyticsDashboard.web.js (CF-1mlj).
 *
 * Covers getNpsDashboardSection:
 *  - returns null npsScore and zero counts when no responses
 *  - counts promoters (9–10), passives (7–8), detractors (0–6)
 *  - calculates NPS score correctly: (promoters - detractors) / total * 100
 *  - calculates promoterPct, passivePct, detractorPct
 *  - clamps lookback to [1, 365]
 *  - defaults to 90-day window
 *  - returns error-safe defaults when query fails
 *
 * Covers getDashboardSummary:
 *  - includes npsScore and npsResponseCount in result
 *  - npsScore is null when no survey responses
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __setQueryError } from './__mocks__/wix-data.js';
import { getNpsDashboardSection, getDashboardSummary } from '../src/backend/analyticsDashboard.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeResponse(npsScore, daysAgo = 10) {
  const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    _id: `resp-${Math.random().toString(36).slice(2)}`,
    npsScore,
    comment: npsScore >= 9 ? 'Great!' : null,
    completedAt,
  };
}

beforeEach(() => {
  __reset();
  __seed('SurveyResponses', []);
  __seed('ProductAnalytics', []);
  __seed('EmailQueue', []);
  __seed('Stores/Products', []);
});

// ── getNpsDashboardSection ────────────────────────────────────────────────────

describe('getNpsDashboardSection — no responses', () => {
  it('returns npsScore null when no completed responses', async () => {
    const result = await getNpsDashboardSection();
    expect(result.npsScore).toBeNull();
  });

  it('returns count 0 when no responses', async () => {
    const result = await getNpsDashboardSection();
    expect(result.count).toBe(0);
  });

  it('returns zero pct fields when no responses', async () => {
    const result = await getNpsDashboardSection();
    expect(result.promoterPct).toBe(0);
    expect(result.detractorPct).toBe(0);
    expect(result.passivePct).toBe(0);
  });
});

describe('getNpsDashboardSection — NPS calculation', () => {
  it('classifies 9–10 as promoters', async () => {
    __seed('SurveyResponses', [makeResponse(9), makeResponse(10)]);
    const result = await getNpsDashboardSection();
    expect(result.promoters).toBe(2);
    expect(result.detractors).toBe(0);
  });

  it('classifies 7–8 as passives', async () => {
    __seed('SurveyResponses', [makeResponse(7), makeResponse(8)]);
    const result = await getNpsDashboardSection();
    expect(result.passives).toBe(2);
  });

  it('classifies 0–6 as detractors', async () => {
    __seed('SurveyResponses', [makeResponse(0), makeResponse(3), makeResponse(6)]);
    const result = await getNpsDashboardSection();
    expect(result.detractors).toBe(3);
  });

  it('calculates npsScore = (promoters - detractors) / total * 100', async () => {
    // 4 promoters, 2 passives, 2 detractors → (4-2)/8 * 100 = 25
    __seed('SurveyResponses', [
      makeResponse(10), makeResponse(9), makeResponse(9), makeResponse(10),
      makeResponse(7), makeResponse(8),
      makeResponse(3), makeResponse(5),
    ]);
    const result = await getNpsDashboardSection();
    expect(result.npsScore).toBe(25);
    expect(result.count).toBe(8);
  });

  it('returns -100 for all-detractor responses', async () => {
    __seed('SurveyResponses', [makeResponse(1), makeResponse(2)]);
    const result = await getNpsDashboardSection();
    expect(result.npsScore).toBe(-100);
  });

  it('returns 100 for all-promoter responses', async () => {
    __seed('SurveyResponses', [makeResponse(9), makeResponse(10)]);
    const result = await getNpsDashboardSection();
    expect(result.npsScore).toBe(100);
  });

  it('calculates promoterPct correctly', async () => {
    // 3 promoters out of 4
    __seed('SurveyResponses', [makeResponse(10), makeResponse(9), makeResponse(10), makeResponse(2)]);
    const result = await getNpsDashboardSection();
    expect(result.promoterPct).toBe(75);
  });

  it('calculates detractorPct correctly', async () => {
    __seed('SurveyResponses', [makeResponse(10), makeResponse(9), makeResponse(10), makeResponse(2)]);
    const result = await getNpsDashboardSection();
    expect(result.detractorPct).toBe(25);
  });
});

describe('getNpsDashboardSection — lookback window', () => {
  it('defaults to 90-day periodDays', async () => {
    const result = await getNpsDashboardSection();
    expect(result.periodDays).toBe(90);
  });

  it('accepts custom days parameter', async () => {
    const result = await getNpsDashboardSection(30);
    expect(result.periodDays).toBe(30);
  });

  it('clamps days below 1 to 1', async () => {
    const result = await getNpsDashboardSection(0);
    expect(result.periodDays).toBe(1);
  });

  it('clamps days above 365 to 365', async () => {
    const result = await getNpsDashboardSection(999);
    expect(result.periodDays).toBe(365);
  });
});

describe('getNpsDashboardSection — error handling', () => {
  it('returns safe defaults when query fails', async () => {
    __setQueryError('SurveyResponses', new Error('DB timeout'));
    const result = await getNpsDashboardSection();
    expect(result.npsScore).toBeNull();
    expect(result.count).toBe(0);
  });
});

// ── getNpsDashboardSection — null score guard (radahn review #2) ──────────────

describe('getNpsDashboardSection — null/non-finite score guard', () => {
  it('does not count null npsScore as a detractor', async () => {
    // A row with npsScore=null should be skipped entirely
    __seed('SurveyResponses', [
      { _id: 'r1', npsScore: null, completedAt: new Date() },
      makeResponse(9),
    ]);
    const result = await getNpsDashboardSection();
    expect(result.detractors).toBe(0);
    expect(result.promoters).toBe(1);
    expect(result.count).toBe(1); // null row excluded from count
  });

  it('returns null npsScore when only null-score rows exist', async () => {
    __seed('SurveyResponses', [
      { _id: 'r1', npsScore: null, completedAt: new Date() },
    ]);
    const result = await getNpsDashboardSection();
    expect(result.npsScore).toBeNull();
    expect(result.count).toBe(0);
  });
});

// ── getDashboardSummary NPS fields ────────────────────────────────────────────

describe('getDashboardSummary — NPS integration', () => {
  it('includes npsScore in summary result', async () => {
    const result = await getDashboardSummary();
    expect(result).toHaveProperty('npsScore');
  });

  it('includes npsResponseCount in summary result', async () => {
    const result = await getDashboardSummary();
    expect(result).toHaveProperty('npsResponseCount');
  });

  it('npsScore is null when no survey responses exist', async () => {
    const result = await getDashboardSummary();
    expect(result.npsScore).toBeNull();
  });

  it('npsScore reflects actual survey data', async () => {
    __seed('SurveyResponses', [makeResponse(10), makeResponse(9)]);
    const result = await getDashboardSummary();
    expect(result.npsScore).toBe(100);
    expect(result.npsResponseCount).toBe(2);
  });

  it('uses at least a 90-day NPS window even when days param is smaller (radahn review #3)', async () => {
    // Seed a response 60 days ago — visible under 90-day window but not 30-day
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    __seed('SurveyResponses', [{ _id: 'r1', npsScore: 10, completedAt: sixtyDaysAgo }]);
    // getDashboardSummary(30) must still pick up the 60-day-old response
    const result = await getDashboardSummary(30);
    expect(result.npsScore).toBe(100);
    expect(result.npsResponseCount).toBe(1);
  });

  it('npsScore is null in error-fallback response', async () => {
    __setQueryError('SurveyResponses', new Error('timeout'));
    __setQueryError('ProductAnalytics', new Error('timeout'));
    __setQueryError('EmailQueue', new Error('timeout'));
    const result = await getDashboardSummary();
    expect(result.npsScore).toBeNull();
    expect(result.npsResponseCount).toBe(0);
  });
});
