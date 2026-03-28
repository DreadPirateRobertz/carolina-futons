/**
 * @file analyticsDigest.test.js
 * @description Tests for the weekly analytics digest module (cf-w62s).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import { generateWeeklyDigest } from '../src/backend/analyticsDigest.web.js';

beforeEach(() => {
  __reset();
});

const NOW = new Date();
const YESTERDAY = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
const TWO_DAYS_AGO = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);

const SAMPLE_EVENTS = [
  { eventType: 'quiz_started', source: 'quiz', timestamp: YESTERDAY, memberId: 'mem-1', payload: '{}' },
  { eventType: 'quiz_started', source: 'quiz', timestamp: YESTERDAY, memberId: 'mem-2', payload: '{}' },
  { eventType: 'quiz_completed', source: 'quiz', timestamp: YESTERDAY, memberId: 'mem-1', payload: '{}' },
  { eventType: 'quiz_lead_captured', source: 'quiz', timestamp: YESTERDAY, memberId: 'mem-1', payload: '{}' },
  { eventType: 'spin_played', source: 'spin', timestamp: TWO_DAYS_AGO, memberId: 'mem-3', payload: '{}' },
  { eventType: 'spin_won', source: 'spin', timestamp: TWO_DAYS_AGO, memberId: 'mem-3', payload: '{}' },
  { eventType: 'financing_calculated', source: 'financing', timestamp: YESTERDAY, memberId: null, payload: '{}' },
  { eventType: 'review_submitted', source: 'review', timestamp: TWO_DAYS_AGO, memberId: 'mem-4', payload: '{}' },
];

describe('generateWeeklyDigest', () => {
  it('generates a digest with event counts', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest();
    expect(result.success).toBe(true);
    expect(result.digest.totalEvents).toBe(8);
  });

  it('counts unique event types', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest();
    expect(result.digest.uniqueEventTypes).toBe(7);
  });

  it('ranks top events by count descending', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest();
    const topEvents = result.digest.topEvents;
    expect(topEvents[0].event).toBe('quiz_started');
    expect(topEvents[0].count).toBe(2);
  });

  it('includes event descriptions from taxonomy', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest();
    const quizEvent = result.digest.topEvents.find(e => e.event === 'quiz_started');
    expect(quizEvent.description).toContain('quiz');
    expect(quizEvent.category).toBe('quiz');
  });

  it('computes quiz funnel metrics', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest();
    const quiz = result.digest.funnelMetrics.quiz;
    expect(quiz.started).toBe(2);
    expect(quiz.completed).toBe(1);
    expect(quiz.completionRate).toBe(50);
  });

  it('computes spin funnel metrics', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest();
    const spin = result.digest.funnelMetrics.spin;
    expect(spin.played).toBe(1);
    expect(spin.won).toBe(1);
  });

  it('includes daily trend data', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest();
    expect(result.digest.dailyTrend.length).toBeGreaterThanOrEqual(1);
    expect(result.digest.dailyTrend[0]).toHaveProperty('date');
    expect(result.digest.dailyTrend[0]).toHaveProperty('count');
  });

  it('includes source breakdown', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest();
    expect(result.digest.bySource.length).toBeGreaterThanOrEqual(1);
    const quizSource = result.digest.bySource.find(s => s.source === 'quiz');
    expect(quizSource.count).toBe(4);
  });

  it('includes period metadata', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest();
    expect(result.digest.period.days).toBe(7);
    expect(result.digest.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('logs to AuditLog', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    await generateWeeklyDigest();
    const audits = __getInserted('AuditLog');
    expect(audits).toHaveLength(1);
    expect(audits[0].collection).toBe('AnalyticsDigest');
  });

  it('handles empty events', async () => {
    __seed('AnalyticsEvents', []);
    const result = await generateWeeklyDigest();
    expect(result.success).toBe(true);
    expect(result.digest.totalEvents).toBe(0);
    expect(result.digest.topEvents).toEqual([]);
  });

  it('accepts custom day range', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    const result = await generateWeeklyDigest({ days: 30 });
    expect(result.digest.period.days).toBe(30);
  });

  it('clamps days to 1-90 range', async () => {
    __seed('AnalyticsEvents', []);
    const result = await generateWeeklyDigest({ days: 200 });
    expect(result.digest.period.days).toBe(90);
  });
});
