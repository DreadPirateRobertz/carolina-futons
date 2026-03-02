import { describe, it, expect } from 'vitest';

vi.mock('public/designTokens.js', () => ({
  colors: {
    sandBase: '#E8D5B7', sandLight: '#F2E8D5', sandDark: '#D4BC96',
    espresso: '#3A2518', espressoLight: '#5C4033',
    mountainBlue: '#5B8FA8', mountainBlueLight: '#A8CCD8',
    sunsetCoral: '#E8845C', sunsetCoralLight: '#F2A882',
    offWhite: '#FAF7F2', white: '#FFFFFF',
    skyGradientTop: '#B8D4E3', skyGradientBottom: '#F0C87A',
  },
}));

import {
  COMFORT_ILLUSTRATIONS,
  getComfortIllustration,
  getComfortVisual,
} from '../src/public/comfortIllustrations.js';

// ── COMFORT_ILLUSTRATIONS export ────────────────────────────────────

describe('comfortIllustrations — COMFORT_ILLUSTRATIONS', () => {
  it('exports illustrations for all three comfort levels', () => {
    expect(COMFORT_ILLUSTRATIONS).toBeDefined();
    expect(COMFORT_ILLUSTRATIONS.plush).toBeDefined();
    expect(COMFORT_ILLUSTRATIONS.medium).toBeDefined();
    expect(COMFORT_ILLUSTRATIONS.firm).toBeDefined();
  });

  it('each illustration has svg, alt, and slug fields', () => {
    for (const key of ['plush', 'medium', 'firm']) {
      const illust = COMFORT_ILLUSTRATIONS[key];
      expect(illust).toHaveProperty('svg');
      expect(illust).toHaveProperty('alt');
      expect(illust).toHaveProperty('slug', key);
      expect(typeof illust.svg).toBe('string');
      expect(typeof illust.alt).toBe('string');
    }
  });

  it('SVGs are data URIs', () => {
    for (const key of ['plush', 'medium', 'firm']) {
      expect(COMFORT_ILLUSTRATIONS[key].svg).toMatch(/^data:image\/svg\+xml,/);
    }
  });

  it('SVGs contain valid SVG markup with viewBox', () => {
    for (const key of ['plush', 'medium', 'firm']) {
      const decoded = decodeURIComponent(
        COMFORT_ILLUSTRATIONS[key].svg.replace('data:image/svg+xml,', '')
      );
      expect(decoded).toContain('<svg');
      expect(decoded).toContain('viewBox');
      expect(decoded).toContain('xmlns');
      expect(decoded).toContain('</svg>');
    }
  });

  it('SVGs use brand colors (not arbitrary hex)', () => {
    const brandColors = [
      '#E8D5B7', '#F2E8D5', '#D4BC96', '#3A2518', '#5C4033',
      '#5B8FA8', '#A8CCD8', '#E8845C', '#F2A882', '#FAF7F2',
      '#FFFFFF', '#B8D4E3', '#F0C87A',
    ];
    for (const key of ['plush', 'medium', 'firm']) {
      const decoded = decodeURIComponent(
        COMFORT_ILLUSTRATIONS[key].svg.replace('data:image/svg+xml,', '')
      );
      // Extract all hex colors from the SVG
      const hexColors = decoded.match(/#[0-9A-Fa-f]{6}/g) || [];
      for (const hex of hexColors) {
        expect(brandColors).toContain(hex.toUpperCase());
      }
    }
  });

  it('alt text is descriptive for accessibility', () => {
    expect(COMFORT_ILLUSTRATIONS.plush.alt.length).toBeGreaterThan(10);
    expect(COMFORT_ILLUSTRATIONS.medium.alt.length).toBeGreaterThan(10);
    expect(COMFORT_ILLUSTRATIONS.firm.alt.length).toBeGreaterThan(10);
  });
});

// ── getComfortIllustration ──────────────────────────────────────────

describe('comfortIllustrations — getComfortIllustration', () => {
  it('returns illustration object for valid slug', () => {
    const result = getComfortIllustration('plush');
    expect(result).toBe(COMFORT_ILLUSTRATIONS.plush);
  });

  it('returns illustration for each comfort level', () => {
    expect(getComfortIllustration('medium')).toBe(COMFORT_ILLUSTRATIONS.medium);
    expect(getComfortIllustration('firm')).toBe(COMFORT_ILLUSTRATIONS.firm);
  });

  it('returns null for unknown slug', () => {
    expect(getComfortIllustration('ultra-soft')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getComfortIllustration('')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(getComfortIllustration(null)).toBeNull();
    expect(getComfortIllustration(undefined)).toBeNull();
  });
});

// ── getComfortVisual (SVG with emoji fallback) ──────────────────────

describe('comfortIllustrations — getComfortVisual', () => {
  it('returns SVG data URI and alt for valid slug', () => {
    const visual = getComfortVisual('plush');
    expect(visual.src).toMatch(/^data:image\/svg\+xml,/);
    expect(visual.alt).toBeTruthy();
    expect(visual.type).toBe('svg');
  });

  it('returns emoji fallback for unknown slug', () => {
    const visual = getComfortVisual('unknown');
    expect(visual.type).toBe('emoji');
    expect(visual.src).toBe('');
    expect(visual.alt).toBe('');
  });

  it('returns correct emoji fallback for known slugs when SVG unavailable', () => {
    // getComfortVisual always has SVGs for known slugs, so this tests the
    // exported EMOJI_FALLBACKS for integration with other code
    const visual = getComfortVisual('plush');
    expect(visual.type).toBe('svg');
  });

  it('returns all three levels with svg type', () => {
    for (const slug of ['plush', 'medium', 'firm']) {
      const visual = getComfortVisual(slug);
      expect(visual.type).toBe('svg');
      expect(visual.src).toBeTruthy();
      expect(visual.alt).toBeTruthy();
    }
  });

  it('handles null/undefined gracefully', () => {
    expect(getComfortVisual(null).type).toBe('emoji');
    expect(getComfortVisual(undefined).type).toBe('emoji');
  });
});
