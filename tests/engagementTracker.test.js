import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackEvent,
  flushEvents,
  getFunnelProgress,
  getEngagementScore,
  getSessionSummary,
  trackProductPageView,
  trackCartAdd,
  trackSocialShare,
  trackNewsletterSignup,
  trackQuizStep,
  trackQuizComplete,
} from '../src/public/engagementTracker.js';

// Reset session storage between tests
beforeEach(() => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
});

// ── trackEvent ───────────────────────────────────────────────────────

describe('trackEvent', () => {
  it('queues events without throwing', () => {
    expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow();
  });

  it('handles null data gracefully', () => {
    expect(() => trackEvent('test_event')).not.toThrow();
  });
});

// ── getFunnelProgress ────────────────────────────────────────────────

describe('getFunnelProgress', () => {
  it('returns 0% for unknown funnel', () => {
    const result = getFunnelProgress('nonexistent');
    expect(result.steps).toEqual([]);
    expect(result.completionPct).toBe(0);
  });

  it('returns defined steps for purchase funnel', () => {
    const result = getFunnelProgress('purchase');
    expect(result.steps).toContain('page_view');
    expect(result.steps).toContain('purchase_complete');
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('returns defined steps for social funnel', () => {
    const result = getFunnelProgress('social');
    expect(result.steps).toContain('social_share');
  });

  it('returns defined steps for quiz funnel', () => {
    const result = getFunnelProgress('quiz');
    expect(result.steps).toContain('quiz_start');
    expect(result.steps).toContain('quiz_complete');
  });
});

// ── getEngagementScore ───────────────────────────────────────────────

describe('getEngagementScore', () => {
  it('returns 0 for empty session', () => {
    expect(getEngagementScore()).toBe(0);
  });

  it('returns a score between 0 and 100', () => {
    // Manually seed session events
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('cf_session_events', JSON.stringify([
        { type: 'page_view', timestamp: Date.now() - 60000 },
        { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() - 50000 },
        { type: 'add_to_cart', data: { productId: 'p1' }, timestamp: Date.now() - 40000 },
      ]));
    }
    const score = getEngagementScore();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ── getSessionSummary ────────────────────────────────────────────────

describe('getSessionSummary', () => {
  it('returns summary object with required fields', () => {
    const summary = getSessionSummary();
    expect(summary).toHaveProperty('eventCount');
    expect(summary).toHaveProperty('uniqueProducts');
    expect(summary).toHaveProperty('score');
    expect(summary).toHaveProperty('topFunnel');
  });

  it('returns zero counts for empty session', () => {
    const summary = getSessionSummary();
    expect(summary.eventCount).toBe(0);
    expect(summary.uniqueProducts).toBe(0);
    expect(summary.score).toBe(0);
  });
});

// ── Pre-Built Event Helpers ──────────────────────────────────────────

describe('event helper functions', () => {
  it('trackProductPageView handles null product', () => {
    expect(() => trackProductPageView(null)).not.toThrow();
  });

  it('trackProductPageView handles product without _id', () => {
    expect(() => trackProductPageView({ name: 'Test' })).not.toThrow();
  });

  it('trackProductPageView accepts valid product', () => {
    expect(() => trackProductPageView({
      _id: 'p1', name: 'Test', collections: ['futon-frames'], price: 299,
    })).not.toThrow();
  });

  it('trackCartAdd does not throw', () => {
    expect(() => trackCartAdd('p1', 'Product 1', 'Queen')).not.toThrow();
  });

  it('trackSocialShare does not throw', () => {
    expect(() => trackSocialShare('facebook', 'purchase')).not.toThrow();
  });

  it('trackNewsletterSignup does not throw', () => {
    expect(() => trackNewsletterSignup('thank_you_page')).not.toThrow();
  });

  it('trackQuizStep does not throw', () => {
    expect(() => trackQuizStep(1, { room: 'living' })).not.toThrow();
  });

  it('trackQuizComplete does not throw', () => {
    expect(() => trackQuizComplete({ room: 'living' }, 3)).not.toThrow();
  });
});
