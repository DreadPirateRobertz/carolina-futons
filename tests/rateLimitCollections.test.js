/**
 * @file rateLimitCollections.test.js
 * @description cf-3ldu.F2 (P2) — verifyRateLimitCollections pre-cutover probe
 * + canonical RATE_LIMIT_COLLECTIONS list integrity.
 *
 * The shared `checkRateLimit` helper fails OPEN on wixData errors. If a
 * rate-limit collection doesn't exist in production, every endpoint that
 * uses it silently has zero protection. This test pins the canonical list
 * + the probe behavior so cf-3qt.8 cutover gates can rely on it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import wixData, {
  __setQueryError,
  __reset as resetData,
} from './__mocks__/wix-data.js';
import {
  RATE_LIMIT_COLLECTIONS,
  verifyRateLimitCollections,
} from '../src/backend/utils/rateLimit.js';

beforeEach(() => {
  resetData();
});

describe('RATE_LIMIT_COLLECTIONS — canonical list', () => {
  it('contains the 46 known rate-limit collections (cf-3ldu audit + cf-3ldu.1 + F4)', () => {
    expect(RATE_LIMIT_COLLECTIONS.length).toBe(46);
  });

  it('is frozen (Object.freeze) so callers cannot mutate the canonical list', () => {
    expect(Object.isFrozen(RATE_LIMIT_COLLECTIONS)).toBe(true);
  });

  it('includes ReturnsRateLimit (cf-3ldu.1 wired this PR)', () => {
    expect(RATE_LIMIT_COLLECTIONS).toContain('ReturnsRateLimit');
  });

  it('includes NewsletterRateLimit (F4 — newsletterService custom impl)', () => {
    expect(RATE_LIMIT_COLLECTIONS).toContain('NewsletterRateLimit');
  });

  it('includes the only-plural ContactRateLimits (F5 quirk preserved)', () => {
    expect(RATE_LIMIT_COLLECTIONS).toContain('ContactRateLimits');
  });

  it('has no duplicate entries', () => {
    const set = new Set(RATE_LIMIT_COLLECTIONS);
    expect(set.size).toBe(RATE_LIMIT_COLLECTIONS.length);
  });

  it('every entry matches the canonical naming pattern (CamelCase + RateLimit suffix)', () => {
    const re = /^[A-Z][A-Za-z]+(RateLimits?)$/;
    for (const c of RATE_LIMIT_COLLECTIONS) {
      expect(c, `${c} doesn't match RateLimit naming convention`).toMatch(re);
    }
  });
});

describe('verifyRateLimitCollections — probe behavior', () => {
  it('reports all collections as existing when wixData succeeds', async () => {
    const report = await verifyRateLimitCollections();
    expect(report.total).toBe(RATE_LIMIT_COLLECTIONS.length);
    expect(report.existing).toHaveLength(RATE_LIMIT_COLLECTIONS.length);
    expect(report.missing).toHaveLength(0);
    expect(report.errored).toHaveLength(0);
  });

  it('classifies "Collection does not exist" rejections as missing', async () => {
    __setQueryError('QARateLimit', new Error('Collection does not exist: QARateLimit'));
    const report = await verifyRateLimitCollections();
    expect(report.missing.map((m) => m.collection)).toContain('QARateLimit');
    expect(report.missing.find((m) => m.collection === 'QARateLimit').error).toMatch(/does not exist/);
    expect(report.existing).not.toContain('QARateLimit');
  });

  it('classifies "WD_COLLECTION_NOT_FOUND" rejections as missing', async () => {
    __setQueryError('ReviewRateLimit', new Error('WD_COLLECTION_NOT_FOUND'));
    const report = await verifyRateLimitCollections();
    expect(report.missing.map((m) => m.collection)).toContain('ReviewRateLimit');
  });

  it('classifies "not found" rejections as missing (case-insensitive)', async () => {
    __setQueryError('SwatchRequestRateLimit', new Error('Wix Data: collection NOT FOUND'));
    const report = await verifyRateLimitCollections();
    expect(report.missing.map((m) => m.collection)).toContain('SwatchRequestRateLimit');
  });

  it('classifies non-missing errors (network, auth) as errored, not missing', async () => {
    __setQueryError('ChatMessageRateLimit', new Error('Network timeout'));
    const report = await verifyRateLimitCollections();
    expect(report.errored.map((e) => e.collection)).toContain('ChatMessageRateLimit');
    expect(report.missing.map((m) => m.collection)).not.toContain('ChatMessageRateLimit');
  });

  it('separates multiple missing collections + multiple errors in one pass', async () => {
    __setQueryError('QARateLimit', new Error('Collection does not exist'));
    __setQueryError('ReviewRateLimit', new Error('not found'));
    __setQueryError('ChatMessageRateLimit', new Error('Auth failure'));
    const report = await verifyRateLimitCollections();
    expect(report.missing.map((m) => m.collection).sort()).toEqual(['QARateLimit', 'ReviewRateLimit']);
    expect(report.errored.map((e) => e.collection)).toEqual(['ChatMessageRateLimit']);
    expect(report.existing).toHaveLength(RATE_LIMIT_COLLECTIONS.length - 3);
  });

  it('captures the verbatim error message so ops can debug', async () => {
    const msg = 'Collection does not exist (WD_COLLECTION_NOT_FOUND): foo';
    __setQueryError('AchievementsRateLimit', new Error(msg));
    const report = await verifyRateLimitCollections();
    const entry = report.missing.find((m) => m.collection === 'AchievementsRateLimit');
    expect(entry.error).toBe(msg);
  });
});
