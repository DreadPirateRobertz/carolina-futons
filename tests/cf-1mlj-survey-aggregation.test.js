/**
 * @file cf-1mlj-survey-aggregation.test.js
 * @description Tests for getSurveyResponseAggregation (CF-1mlj response aggregation).
 *
 * Covers:
 *  - returns scoreDistribution histogram keyed 0–10
 *  - all histogram buckets initialized to 0
 *  - correctly increments score buckets for completed responses
 *  - calculates completionRate = completed / scheduled * 100
 *  - returns 0 completionRate when nothing scheduled
 *  - returns recentComments sorted newest-first
 *  - excludes null/empty comments from recentComments
 *  - respects commentLimit option
 *  - returns totalScheduled and totalCompleted counts
 *  - clamps days lookback to [1, 365]
 *  - defaults to 90-day window and commentLimit 10
 *  - returns error on DB failure
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __setQueryError } from './__mocks__/wix-data.js';
import { getSurveyResponseAggregation } from '../src/backend/surveyService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCompleted(npsScore, comment = null, daysAgo = 5) {
  const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const sentAt = new Date(Date.now() - (daysAgo + 7) * 24 * 60 * 60 * 1000);
  return {
    _id: `c-${Math.random().toString(36).slice(2)}`,
    memberId: 'mem-1',
    orderId: `ord-${Math.random().toString(36).slice(2)}`,
    npsScore,
    comment,
    sentAt,
    completedAt,
  };
}

function makeScheduled(daysAgo = 3) {
  const sentAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    _id: `s-${Math.random().toString(36).slice(2)}`,
    memberId: 'mem-2',
    orderId: `ord-s-${Math.random().toString(36).slice(2)}`,
    npsScore: null,
    comment: null,
    sentAt,
    completedAt: null,
  };
}

beforeEach(() => {
  __reset();
  __seed('SurveyResponses', []);
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe('getSurveyResponseAggregation — empty data', () => {
  it('returns success: true', async () => {
    const { success } = await getSurveyResponseAggregation();
    expect(success).toBe(true);
  });

  it('returns scoreDistribution with keys 0–10', async () => {
    const { aggregation } = await getSurveyResponseAggregation();
    for (let i = 0; i <= 10; i++) {
      expect(aggregation.scoreDistribution).toHaveProperty(String(i));
    }
    expect(Object.keys(aggregation.scoreDistribution)).toHaveLength(11);
  });

  it('all scoreDistribution buckets are 0 with no data', async () => {
    const { aggregation } = await getSurveyResponseAggregation();
    for (let i = 0; i <= 10; i++) {
      expect(aggregation.scoreDistribution[i]).toBe(0);
    }
  });

  it('returns totalScheduled 0 and totalCompleted 0', async () => {
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.totalScheduled).toBe(0);
    expect(aggregation.totalCompleted).toBe(0);
  });

  it('returns completionRate 0', async () => {
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.completionRate).toBe(0);
  });

  it('returns empty recentComments array', async () => {
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.recentComments).toEqual([]);
  });
});

// ── Score distribution ────────────────────────────────────────────────────────

describe('getSurveyResponseAggregation — scoreDistribution', () => {
  it('increments correct bucket for each response', async () => {
    __seed('SurveyResponses', [
      makeCompleted(9),
      makeCompleted(9),
      makeCompleted(7),
      makeCompleted(3),
    ]);
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.scoreDistribution[9]).toBe(2);
    expect(aggregation.scoreDistribution[7]).toBe(1);
    expect(aggregation.scoreDistribution[3]).toBe(1);
    expect(aggregation.scoreDistribution[10]).toBe(0);
  });

  it('counts all scores from 0 to 10', async () => {
    const responses = Array.from({ length: 11 }, (_, i) => makeCompleted(i));
    __seed('SurveyResponses', responses);
    const { aggregation } = await getSurveyResponseAggregation();
    for (let i = 0; i <= 10; i++) {
      expect(aggregation.scoreDistribution[i]).toBe(1);
    }
  });
});

// ── Completion rate ───────────────────────────────────────────────────────────

describe('getSurveyResponseAggregation — completionRate', () => {
  it('calculates 100% when all scheduled surveys are completed', async () => {
    const completed = [makeCompleted(8), makeCompleted(9)];
    __seed('SurveyResponses', completed);
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.completionRate).toBe(100);
  });

  it('calculates 50% when half completed', async () => {
    __seed('SurveyResponses', [
      makeCompleted(9),
      makeScheduled(),
    ]);
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.completionRate).toBe(50);
  });

  it('returns 0 when no surveys scheduled', async () => {
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.completionRate).toBe(0);
  });

  it('reports totalCompleted correctly', async () => {
    __seed('SurveyResponses', [makeCompleted(7), makeCompleted(8), makeScheduled()]);
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.totalCompleted).toBe(2);
  });

  it('reports totalScheduled correctly (includes both completed and pending)', async () => {
    __seed('SurveyResponses', [makeCompleted(7), makeScheduled(), makeScheduled()]);
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.totalScheduled).toBe(3);
  });
});

// ── Recent comments ───────────────────────────────────────────────────────────

describe('getSurveyResponseAggregation — recentComments', () => {
  it('includes comment text and npsScore', async () => {
    __seed('SurveyResponses', [makeCompleted(9, 'Love the futon!')]);
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.recentComments[0]).toMatchObject({
      npsScore: 9,
      comment: 'Love the futon!',
    });
  });

  it('excludes null comments', async () => {
    __seed('SurveyResponses', [makeCompleted(5, null)]);
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.recentComments).toHaveLength(0);
  });

  it('excludes empty-string comments', async () => {
    __seed('SurveyResponses', [makeCompleted(5, '   ')]);
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.recentComments).toHaveLength(0);
  });

  it('sorts comments newest-first', async () => {
    __seed('SurveyResponses', [
      makeCompleted(6, 'Older comment', 20),
      makeCompleted(9, 'Newer comment', 2),
    ]);
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.recentComments[0].comment).toBe('Newer comment');
    expect(aggregation.recentComments[1].comment).toBe('Older comment');
  });

  it('respects commentLimit option', async () => {
    __seed('SurveyResponses', [
      makeCompleted(9, 'Comment 1', 1),
      makeCompleted(9, 'Comment 2', 2),
      makeCompleted(9, 'Comment 3', 3),
    ]);
    const { aggregation } = await getSurveyResponseAggregation({ commentLimit: 2 });
    expect(aggregation.recentComments).toHaveLength(2);
  });

  it('defaults to at most 10 recent comments', async () => {
    __seed('SurveyResponses', Array.from({ length: 15 }, (_, i) =>
      makeCompleted(9, `Comment ${i}`, i + 1)
    ));
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.recentComments.length).toBeLessThanOrEqual(10);
  });
});

// ── Lookback window ───────────────────────────────────────────────────────────

describe('getSurveyResponseAggregation — lookback window', () => {
  it('defaults periodDays to 90', async () => {
    const { aggregation } = await getSurveyResponseAggregation();
    expect(aggregation.periodDays).toBe(90);
  });

  it('accepts custom days', async () => {
    const { aggregation } = await getSurveyResponseAggregation({ days: 30 });
    expect(aggregation.periodDays).toBe(30);
  });

  it('clamps days below 1 to 1', async () => {
    const { aggregation } = await getSurveyResponseAggregation({ days: 0 });
    expect(aggregation.periodDays).toBe(1);
  });

  it('clamps days above 365 to 365', async () => {
    const { aggregation } = await getSurveyResponseAggregation({ days: 500 });
    expect(aggregation.periodDays).toBe(365);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('getSurveyResponseAggregation — error handling', () => {
  it('returns success: false on DB error', async () => {
    __setQueryError('SurveyResponses', new Error('DB timeout'));
    const result = await getSurveyResponseAggregation();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
