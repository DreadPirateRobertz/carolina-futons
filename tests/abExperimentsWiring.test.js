/**
 * @file abExperimentsWiring.test.js
 * @description Tests for the frontend A/B experiment wiring module (cf-c75d).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  initExperiment,
  trackConversion,
  getActiveVariant,
  initExperiments,
  applyVariant,
  _reset,
} from '../src/public/abExperiments.js';

beforeEach(() => {
  __reset();
  _reset();
  __seed('AbTests', [
    {
      _id: 'test-1', testName: 'hero_cta_test', active: true,
      variants: JSON.stringify([{ id: 'A', name: 'Control' }, { id: 'B', name: 'Variant B' }]),
      trafficPercent: 100,
    },
    {
      _id: 'test-2', testName: 'cart_layout', active: false,
      variants: JSON.stringify([{ id: 'A', name: 'Default' }, { id: 'B', name: 'Compact' }]),
      winnerVariant: 'B',
    },
  ]);
  __seed('AbEvents', []);
});

// ── initExperiment ──────────────────────────────────────────────────

describe('initExperiment', () => {
  it('returns a variant for an active test', async () => {
    const variant = await initExperiment('hero_cta_test', 'Home');
    expect(variant).toBeTruthy();
    expect(variant.id).toMatch(/^[AB]$/);
    expect(variant.name).toBeTruthy();
  });

  it('fires an impression event (async, fire-and-forget)', async () => {
    await initExperiment('hero_cta_test', 'Home');
    // Impression is fire-and-forget — allow microtask to complete
    await new Promise(r => setTimeout(r, 10));

    const events = __getInserted('AbEvents');
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].testName).toBe('hero_cta_test');
    expect(events[0].eventType).toBe('impression');
  });

  it('caches variant — returns same on second call', async () => {
    const v1 = await initExperiment('hero_cta_test', 'Home');
    const v2 = await initExperiment('hero_cta_test', 'Home');
    expect(v1.id).toBe(v2.id);
  });

  it('returns winner for concluded test', async () => {
    const variant = await initExperiment('cart_layout', 'Cart');
    expect(variant).toBeTruthy();
    expect(variant.id).toBe('B');
  });

  it('returns null for unknown test', async () => {
    expect(await initExperiment('nonexistent', 'Home')).toBeNull();
  });

  it('returns null for empty test name', async () => {
    expect(await initExperiment('', 'Home')).toBeNull();
  });
});

// ── trackConversion ─────────────────────────────────────────────────

describe('trackConversion', () => {
  it('tracks conversion for initialized test', async () => {
    await initExperiment('hero_cta_test', 'Home');
    await trackConversion('hero_cta_test', 'Home');

    const conversions = __getInserted('AbEvents').filter(e => e.eventType === 'conversion');
    expect(conversions).toHaveLength(1);
  });

  it('silently skips uninitialized test', async () => {
    await trackConversion('hero_cta_test', 'Home');
    expect(__getInserted('AbEvents')).toHaveLength(0);
  });
});

// ── getActiveVariant ────────────────────────────────────────────────

describe('getActiveVariant', () => {
  it('returns cached variant after init', async () => {
    await initExperiment('hero_cta_test', 'Home');
    const variant = getActiveVariant('hero_cta_test');
    expect(variant).toBeTruthy();
  });

  it('returns null before init', () => {
    expect(getActiveVariant('hero_cta_test')).toBeNull();
  });
});

// ── initExperiments (batch) ─────────────────────────────────────────

describe('initExperiments', () => {
  it('initializes multiple experiments in parallel', async () => {
    const results = await initExperiments([
      { testName: 'hero_cta_test', page: 'Home' },
      { testName: 'cart_layout', page: 'Cart' },
    ]);

    expect(results.hero_cta_test).toBeTruthy();
    expect(results.cart_layout).toBeTruthy();
  });

  it('handles empty array', async () => {
    expect(await initExperiments([])).toEqual({});
  });
});

// ── applyVariant ────────────────────────────────────────────────────

describe('applyVariant', () => {
  it('calls matching variant handler', async () => {
    await initExperiment('hero_cta_test', 'Home');
    const variant = getActiveVariant('hero_cta_test');

    const handler = vi.fn();
    const result = applyVariant('hero_cta_test', { [variant.id]: handler });

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith(variant);
  });

  it('returns false for uninitialized test', () => {
    expect(applyVariant('unknown', { A: () => {} })).toBe(false);
  });
});
