/**
 * @file conversionDashboard.test.js
 * @description Tests for the conversion funnel dashboard (cf-9dhf).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import {
  getConversionFunnel,
  getDailyConversionTrend,
  getCategoryConversion,
  getDashboardSummary,
  _FUNNEL_STEPS,
} from '../src/backend/conversionDashboard.web.js';

beforeEach(() => {
  __reset();
});

const NOW = new Date();
const SAMPLE_EVENTS = [
  { eventType: 'product_view', timestamp: NOW, payload: '{"category":"futon-frames"}' },
  { eventType: 'product_view', timestamp: NOW, payload: '{"category":"futon-frames"}' },
  { eventType: 'product_view', timestamp: NOW, payload: '{"category":"mattresses"}' },
  { eventType: 'product_view', timestamp: NOW, payload: '{"category":"futon-frames"}' },
  { eventType: 'product_view', timestamp: NOW, payload: '{"category":"futon-frames"}' },
  { eventType: 'add_to_cart', timestamp: NOW, payload: '{"category":"futon-frames"}' },
  { eventType: 'add_to_cart', timestamp: NOW, payload: '{"category":"futon-frames"}' },
  { eventType: 'add_to_cart', timestamp: NOW, payload: '{"category":"mattresses"}' },
  { eventType: 'checkout', timestamp: NOW, payload: '{"category":"futon-frames"}' },
  { eventType: 'checkout', timestamp: NOW, payload: '{"category":"mattresses"}' },
  { eventType: 'purchase', timestamp: NOW, payload: '{"category":"futon-frames"}' },
];

// ── Funnel Steps ────────────────────────────────────────────────────

describe('funnel steps', () => {
  it('defines 4 funnel steps in order', () => {
    expect(_FUNNEL_STEPS).toEqual(['product_view', 'add_to_cart', 'checkout', 'purchase']);
  });
});

// ── getConversionFunnel ─────────────────────────────────────────────

describe('getConversionFunnel', () => {
  it('returns step-by-step funnel with conversion rates', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    __seed('ProductAnalytics', []);

    const result = await getConversionFunnel({ days: 7 });
    expect(result.success).toBe(true);
    expect(result.funnel.steps).toHaveLength(4);

    const steps = result.funnel.steps;
    expect(steps[0].step).toBe('product_view');
    expect(steps[0].count).toBe(5);
    expect(steps[1].step).toBe('add_to_cart');
    expect(steps[1].count).toBe(3);
    expect(steps[3].step).toBe('purchase');
    expect(steps[3].count).toBe(1);
  });

  it('calculates step conversion rates', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    __seed('ProductAnalytics', []);

    const result = await getConversionFunnel({ days: 7 });
    const steps = result.funnel.steps;

    // add_to_cart / product_view = 3/5 = 60%
    expect(steps[1].stepConversionRate).toBe(60);
  });

  it('calculates drop-off rates', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    __seed('ProductAnalytics', []);

    const result = await getConversionFunnel({ days: 7 });
    const steps = result.funnel.steps;

    // Drop from view (5) to cart (3) = 2 dropped, 40%
    expect(steps[1].dropOff).toBe(2);
    expect(steps[1].dropOffRate).toBe(40);
  });

  it('calculates overall conversion rate', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    __seed('ProductAnalytics', []);

    const result = await getConversionFunnel({ days: 7 });
    // 1 purchase / 5 views = 20%
    expect(result.funnel.overallConversion).toBe(20);
  });

  it('identifies biggest drop-off step', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    __seed('ProductAnalytics', []);

    const result = await getConversionFunnel({ days: 7 });
    expect(result.funnel.biggestDropOff).toBeTruthy();
    expect(result.funnel.biggestDropOff.step).toBeTruthy();
  });

  it('handles empty events', async () => {
    __seed('AnalyticsEvents', []);
    __seed('ProductAnalytics', []);

    const result = await getConversionFunnel({ days: 7 });
    expect(result.success).toBe(true);
    expect(result.funnel.overallConversion).toBe(0);
  });
});

// ── getDailyConversionTrend ─────────────────────────────────────────

describe('getDailyConversionTrend', () => {
  it('returns daily breakdown with rates', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);

    const result = await getDailyConversionTrend(7);
    expect(result.success).toBe(true);
    expect(result.trend.length).toBeGreaterThanOrEqual(1);

    const day = result.trend[0];
    expect(day).toHaveProperty('date');
    expect(day).toHaveProperty('product_view');
    expect(day).toHaveProperty('add_to_cart');
    expect(day).toHaveProperty('viewToCartRate');
  });

  it('handles empty period', async () => {
    __seed('AnalyticsEvents', []);
    const result = await getDailyConversionTrend(7);
    expect(result.trend).toEqual([]);
  });
});

// ── getCategoryConversion ───────────────────────────────────────────

describe('getCategoryConversion', () => {
  it('breaks down funnel by category', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);

    const result = await getCategoryConversion(7);
    expect(result.success).toBe(true);
    expect(result.categories.length).toBeGreaterThanOrEqual(1);

    const futons = result.categories.find(c => c.category === 'futon-frames');
    expect(futons).toBeTruthy();
    expect(futons.product_view).toBe(4);
    expect(futons.add_to_cart).toBe(2);
    expect(futons.purchase).toBe(1);
  });

  it('sorts by most views first', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);

    const result = await getCategoryConversion(7);
    expect(result.categories[0].category).toBe('futon-frames');
  });
});

// ── getDashboardSummary ─────────────────────────────────────────────

describe('getDashboardSummary', () => {
  it('returns key metrics', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    __seed('ProductAnalytics', []);

    const result = await getDashboardSummary(7);
    expect(result.success).toBe(true);
    expect(result.summary.totalViews).toBe(5);
    expect(result.summary.totalPurchases).toBe(1);
    expect(result.summary.overallConversion).toBe(20);
    expect(result.summary.viewToCartRate).toBe(60);
  });

  it('identifies biggest drop-off', async () => {
    __seed('AnalyticsEvents', SAMPLE_EVENTS);
    __seed('ProductAnalytics', []);

    const result = await getDashboardSummary(7);
    expect(result.summary.biggestDropOff).toBeTruthy();
    expect(result.summary.biggestDropOff.rate).toBeGreaterThan(0);
  });
});
