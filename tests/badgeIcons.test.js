import { describe, it, expect } from 'vitest';
import { renderBadgeIcon, getBadgeIcon, getStreakChipIcon } from '../src/public/badgeIcons.js';
import { BADGE_REGISTRY } from '../src/public/gamificationTokens.js';

describe('renderBadgeIcon', () => {
  describe('null safety', () => {
    it('returns empty string for null', () => {
      expect(renderBadgeIcon(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(renderBadgeIcon(undefined)).toBe('');
    });

    it('returns empty string for empty object', () => {
      expect(renderBadgeIcon({})).toBe('');
    });
  });

  describe('emoji fallback', () => {
    it('returns the icon emoji when no svgPath present', () => {
      expect(renderBadgeIcon({ icon: '🏔️', label: 'Voice of the Mountain' })).toBe('🏔️');
    });

    it('returns empty string when no icon and no svgPath', () => {
      expect(renderBadgeIcon({ label: 'Test' })).toBe('');
    });
  });

  describe('SVG structure', () => {
    const badge = {
      label: 'First Step',
      icon: '🥾',
      svgPath: 'M10 30 L24 10 L38 30Z',
      svgColor: '#E8634B',
      svgLabel: 'Eastern Bluebird',
    };

    it('returns a string starting with <svg', () => {
      expect(renderBadgeIcon(badge)).toMatch(/^<svg/);
    });

    it('contains viewBox="0 0 48 48"', () => {
      expect(renderBadgeIcon(badge)).toContain('viewBox="0 0 48 48"');
    });

    it('has role="img" for accessibility', () => {
      expect(renderBadgeIcon(badge)).toContain('role="img"');
    });

    it('has aria-label from svgLabel', () => {
      expect(renderBadgeIcon(badge)).toContain('aria-label="Eastern Bluebird"');
    });

    it('aria-label falls back to badge label when svgLabel absent', () => {
      const b = { label: 'First Step', svgPath: 'M10 30Z', svgColor: '#E8634B' };
      expect(renderBadgeIcon(b)).toContain('aria-label="First Step"');
    });

    it('embeds the svgPath in a <path> element', () => {
      expect(renderBadgeIcon(badge)).toContain(`d="${badge.svgPath}"`);
    });

    it('embeds svgColor as the path fill', () => {
      expect(renderBadgeIcon(badge)).toContain(`fill="${badge.svgColor}"`);
    });

    it('includes a background circle element', () => {
      expect(renderBadgeIcon(badge)).toContain('<circle');
    });
  });

  describe('XSS safety', () => {
    it('encodes double-quotes in svgColor as &quot; entities so attributes cannot be broken', () => {
      const badge = { label: 'Test', svgPath: 'M0 0Z', svgColor: '"injected', svgLabel: 'Test' };
      const svg = renderBadgeIcon(badge);
      // If escaping failed, fill attribute would be broken: fill="" (empty then unquoted)
      expect(svg).not.toContain('fill=""');
      // Correct form: the " is entity-encoded
      expect(svg).toContain('&quot;');
    });

    it('escapes angle brackets in svgLabel to prevent tag injection', () => {
      const badge = { label: 'Test', svgPath: 'M0 0Z', svgColor: '#fff', svgLabel: '<script>alert(1)</script>' };
      expect(renderBadgeIcon(badge)).not.toContain('<script>');
    });

    it('escapes malicious svgPath that attempts attribute break and tag injection', () => {
      const badge = { label: 'Test', svgPath: 'M0 0" /><img src=x onerror=alert(1)>', svgColor: '#fff', svgLabel: 'Test' };
      const svg = renderBadgeIcon(badge);
      // " in svgPath must be encoded as &quot; so the d="" attribute cannot be prematurely closed
      expect(svg).toContain('&quot;');
      // < must be encoded so no raw HTML tags can be injected into the SVG
      expect(svg).not.toContain('<img');
    });
  });
});

describe('getBadgeIcon', () => {
  it('returns empty string for an unknown badge key', () => {
    expect(getBadgeIcon('not_a_real_badge')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(getBadgeIcon(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(getBadgeIcon(undefined)).toBe('');
  });

  it('returns the emoji icon for voice_of_mountain (no SVG)', () => {
    expect(getBadgeIcon('voice_of_mountain')).toBe(BADGE_REGISTRY.voice_of_mountain.icon);
  });

  it('returns SVG for first_step', () => {
    expect(getBadgeIcon('first_step')).toMatch(/^<svg/);
  });

  it('returns SVG for trail_regular', () => {
    expect(getBadgeIcon('trail_regular')).toMatch(/^<svg/);
  });

  it('returns SVG for visualizer', () => {
    expect(getBadgeIcon('visualizer')).toMatch(/^<svg/);
  });

  it('returns SVG for curator', () => {
    expect(getBadgeIcon('curator')).toMatch(/^<svg/);
  });

  it('returns SVG for week_wanderer', () => {
    expect(getBadgeIcon('week_wanderer')).toMatch(/^<svg/);
  });

  it('embeds Coral color for first_step (Eastern Bluebird)', () => {
    expect(getBadgeIcon('first_step')).toContain('#E8634B');
  });

  it('embeds Espresso color for trail_regular (Black Bear)', () => {
    expect(getBadgeIcon('trail_regular')).toContain('#3D1C02');
  });

  it('embeds Mountain Blue for visualizer (Great Horned Owl)', () => {
    expect(getBadgeIcon('visualizer')).toContain('#5B8FA8');
  });

  it('embeds Forest Blue for curator (Luna Moth)', () => {
    expect(getBadgeIcon('curator')).toContain('#2B5FA5');
  });

  it('embeds Gold color for week_wanderer (Red-Tailed Hawk)', () => {
    expect(getBadgeIcon('week_wanderer')).toContain('#C8960C');
  });

  it('each SVG badge has a unique path (animals are distinct)', () => {
    const paths = ['first_step', 'trail_regular', 'visualizer', 'curator', 'week_wanderer']
      .map((key) => BADGE_REGISTRY[key].svgPath);
    const unique = new Set(paths);
    expect(unique.size).toBe(5);
  });
});

describe('getStreakChipIcon', () => {
  it('returns a string starting with <svg', () => {
    expect(getStreakChipIcon()).toMatch(/^<svg/);
  });

  it('contains a <path> element', () => {
    expect(getStreakChipIcon()).toContain('<path');
  });

  it('has aria-label mentioning Sharp-shinned Hawk', () => {
    expect(getStreakChipIcon()).toContain('Sharp-shinned Hawk');
  });

  it('has role="img"', () => {
    expect(getStreakChipIcon()).toContain('role="img"');
  });

  it('has viewBox="0 0 48 48"', () => {
    expect(getStreakChipIcon()).toContain('viewBox="0 0 48 48"');
  });

  it('uses an amber hex color', () => {
    expect(getStreakChipIcon()).toContain('#D4860A');
  });

  it('streak hawk path differs from week_wanderer Red-Tailed Hawk path', () => {
    const streakSvg = getStreakChipIcon();
    const weekWandererSvg = getBadgeIcon('week_wanderer');
    // Extract d= attributes
    const getPath = (svg) => svg.match(/d="([^"]+)"/)?.[1];
    expect(getPath(streakSvg)).not.toBe(getPath(weekWandererSvg));
  });
});
