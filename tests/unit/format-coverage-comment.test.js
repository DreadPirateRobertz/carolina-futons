import { describe, it, expect } from 'vitest';
import { formatCoverageComment } from '../../.github/scripts/format-coverage-comment.js';

describe('formatCoverageComment', () => {
  const baseSummary = {
    total: {
      lines: { pct: 82.5 },
      branches: { pct: 71.3 },
      functions: { pct: 85.0 },
      statements: { pct: 83.1 },
    },
  };

  const thresholds = { lines: 70, branches: 60, functions: 70 };

  it('returns markdown string with coverage percentages', () => {
    const result = formatCoverageComment(baseSummary, thresholds);

    expect(result).toContain('82.5%');
    expect(result).toContain('71.3%');
    expect(result).toContain('85%');
    expect(result).toContain('83.1%');
  });

  it('includes threshold values', () => {
    const result = formatCoverageComment(baseSummary, thresholds);

    expect(result).toContain('70%');
    expect(result).toContain('60%');
  });

  it('shows pass indicators when above thresholds', () => {
    const result = formatCoverageComment(baseSummary, thresholds);

    // All metrics are above thresholds, so no failures
    expect(result).not.toContain('Below threshold');
  });

  it('shows fail indicators when below thresholds', () => {
    const failing = {
      total: {
        lines: { pct: 50.0 },
        branches: { pct: 40.0 },
        functions: { pct: 55.0 },
        statements: { pct: 51.0 },
      },
    };

    const result = formatCoverageComment(failing, thresholds);

    expect(result).toContain('Below threshold');
  });

  it('includes a header identifying it as coverage report', () => {
    const result = formatCoverageComment(baseSummary, thresholds);

    expect(result).toMatch(/coverage/i);
  });

  it('handles zero coverage gracefully', () => {
    const zero = {
      total: {
        lines: { pct: 0 },
        branches: { pct: 0 },
        functions: { pct: 0 },
        statements: { pct: 0 },
      },
    };

    const result = formatCoverageComment(zero, thresholds);

    expect(result).toContain('0%');
    expect(result).toContain('Below threshold');
  });

  it('handles 100% coverage', () => {
    const perfect = {
      total: {
        lines: { pct: 100 },
        branches: { pct: 100 },
        functions: { pct: 100 },
        statements: { pct: 100 },
      },
    };

    const result = formatCoverageComment(perfect, thresholds);

    expect(result).toContain('100%');
    expect(result).not.toContain('Below threshold');
  });

  it('handles missing thresholds by omitting threshold column', () => {
    const result = formatCoverageComment(baseSummary, null);

    expect(result).toContain('82.5%');
    expect(result).not.toContain('Threshold');
  });
});
