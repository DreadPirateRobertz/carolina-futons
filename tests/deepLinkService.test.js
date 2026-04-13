import { describe, it, expect } from 'vitest';
import { buildDeepLink, DEEP_LINK_TYPES } from '../src/backend/deepLinkService.web.js';

// ── DEEP_LINK_TYPES ───────────────────────────────────────────────────────────

describe('DEEP_LINK_TYPES', () => {
  it('defines CHALLENGE, TRAIL, PRODUCT, LEADERBOARD, BADGE', () => {
    expect(typeof DEEP_LINK_TYPES.CHALLENGE).toBe('string');
    expect(typeof DEEP_LINK_TYPES.TRAIL).toBe('string');
    expect(typeof DEEP_LINK_TYPES.PRODUCT).toBe('string');
    expect(typeof DEEP_LINK_TYPES.LEADERBOARD).toBe('string');
    expect(typeof DEEP_LINK_TYPES.BADGE).toBe('string');
  });

  it('all values are non-empty strings', () => {
    for (const val of Object.values(DEEP_LINK_TYPES)) {
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    }
  });

  it('all values are unique', () => {
    const vals = Object.values(DEEP_LINK_TYPES);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

// ── buildDeepLink — CHALLENGE ─────────────────────────────────────────────────

describe('buildDeepLink — CHALLENGE', () => {
  it('returns success: true', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.CHALLENGE, { challengeId: 'ch-001' });
    expect(result.success).toBe(true);
  });

  it('appUrl contains carolinafutons:// scheme', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.CHALLENGE, { challengeId: 'ch-001' });
    expect(result.appUrl).toMatch(/^carolinafutons:\/\//);
  });

  it('appUrl contains challengeId', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.CHALLENGE, { challengeId: 'ch-001' });
    expect(result.appUrl).toContain('ch-001');
  });

  it('webFallback is a string', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.CHALLENGE, { challengeId: 'ch-001' });
    expect(typeof result.webFallback).toBe('string');
    expect(result.webFallback.length).toBeGreaterThan(0);
  });
});

// ── buildDeepLink — TRAIL ─────────────────────────────────────────────────────

describe('buildDeepLink — TRAIL', () => {
  it('appUrl contains trailId', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.TRAIL, { trailId: 'trail-spring' });
    expect(result.appUrl).toContain('trail-spring');
  });

  it('returns success: true', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.TRAIL, { trailId: 'trail-spring' });
    expect(result.success).toBe(true);
  });
});

// ── buildDeepLink — PRODUCT ───────────────────────────────────────────────────

describe('buildDeepLink — PRODUCT', () => {
  it('appUrl contains productId', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.PRODUCT, { productId: 'p-123', slug: 'oak-futon' });
    expect(result.appUrl).toContain('p-123');
  });

  it('webFallback contains slug', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.PRODUCT, { productId: 'p-123', slug: 'oak-futon' });
    expect(result.webFallback).toContain('oak-futon');
  });

  it('returns success: true', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.PRODUCT, { productId: 'p-123', slug: 'oak-futon' });
    expect(result.success).toBe(true);
  });
});

// ── buildDeepLink — LEADERBOARD ───────────────────────────────────────────────

describe('buildDeepLink — LEADERBOARD', () => {
  it('appUrl contains leaderboard', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.LEADERBOARD, {});
    expect(result.appUrl).toContain('leaderboard');
  });

  it('returns success: true', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.LEADERBOARD, {});
    expect(result.success).toBe(true);
  });
});

// ── buildDeepLink — BADGE ─────────────────────────────────────────────────────

describe('buildDeepLink — BADGE', () => {
  it('appUrl contains badgeId', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.BADGE, { badgeId: 'first-purchase' });
    expect(result.appUrl).toContain('first-purchase');
  });

  it('returns success: true', () => {
    const result = buildDeepLink(DEEP_LINK_TYPES.BADGE, { badgeId: 'first-purchase' });
    expect(result.success).toBe(true);
  });
});

// ── buildDeepLink — error handling ───────────────────────────────────────────

describe('buildDeepLink — error handling', () => {
  it('returns success: false for unknown type', () => {
    const result = buildDeepLink('unknown_type', {});
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('error message includes the unknown type', () => {
    const result = buildDeepLink('fax_machine', {});
    expect(result.error).toContain('fax_machine');
  });

  it('all valid types return both appUrl and webFallback', () => {
    const params = {
      [DEEP_LINK_TYPES.CHALLENGE]: { challengeId: 'ch-1' },
      [DEEP_LINK_TYPES.TRAIL]: { trailId: 'trail-1' },
      [DEEP_LINK_TYPES.PRODUCT]: { productId: 'p-1', slug: 'futon' },
      [DEEP_LINK_TYPES.LEADERBOARD]: {},
      [DEEP_LINK_TYPES.BADGE]: { badgeId: 'badge-1' },
    };
    for (const [type, p] of Object.entries(params)) {
      const result = buildDeepLink(type, p);
      expect(result.appUrl).toBeTruthy();
      expect(result.webFallback).toBeTruthy();
    }
  });
});
