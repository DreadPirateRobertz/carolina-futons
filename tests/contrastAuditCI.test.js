/**
 * CI Gate: Design Token Contrast Audit
 *
 * Ensures ALL brand color pairs used on the site meet WCAG 2.1 AA
 * contrast requirements. If any pair fails, CI fails.
 *
 * This test runs auditDesignTokenContrast() and asserts every pair passes.
 * Add new pairs to a11yHelpers.auditDesignTokenContrast() when new
 * foreground/background combinations are introduced.
 */
import { describe, it, expect } from 'vitest';
import { auditDesignTokenContrast } from '../src/public/a11yHelpers.js';

describe('CI: Design Token Contrast Audit', () => {
  const results = auditDesignTokenContrast();

  it('audits at least 10 color pairs', () => {
    expect(results.length).toBeGreaterThanOrEqual(10);
  });

  it('every color pair meets WCAG AA contrast requirements', () => {
    const failures = results
      .filter(r => !r.passes)
      .map(f => `${f.pair}: ${f.ratio}:1 (needs ${f.textSize === 'large' ? '3' : '4.5'}:1)`);
    expect(failures).toEqual([]);
  });

  it.each(results.map(r => [r.pair, r]))('%s passes contrast check', (pair, result) => {
    expect(result.passes).toBe(true);
  });
});
