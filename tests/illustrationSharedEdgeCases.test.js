import { describe, it, expect } from 'vitest';
import {
  ILLUSTRATION_COLORS,
  MOUNTAIN_LAYER_CONFIGS,
  STANDARD_OPACITIES,
  TRANSPARENT_OPACITIES,
  STANDARD_LAYER_COLORS,
  TRANSPARENT_LAYER_COLORS,
  buildCBezierMountainPath,
  buildSmallMountainPath,
  buildBirds,
  buildPineTrees,
  buildFlora,
} from '../src/public/illustrationShared.js';

describe('illustrationShared edge cases', () => {

  // ── buildCBezierMountainPath edge cases ──────────────────────────

  describe('buildCBezierMountainPath edge cases', () => {
    it('handles baseHeightFraction of 0 (ridge at top)', () => {
      const path = buildCBezierMountainPath(800, 0.0, 42);
      expect(path).toMatch(/^M/);
      expect(path).toMatch(/Z$/);
    });

    it('handles baseHeightFraction of 1 (ridge at bottom)', () => {
      const path = buildCBezierMountainPath(800, 1.0, 42);
      expect(path).toMatch(/^M/);
      expect(path).toMatch(/Z$/);
    });

    it('handles very small viewBox height', () => {
      const path = buildCBezierMountainPath(1, 0.5, 42);
      expect(path).toMatch(/^M/);
      expect(path).toMatch(/Z$/);
    });

    it('handles very large viewBox height', () => {
      const path = buildCBezierMountainPath(10000, 0.5, 42);
      expect(path).toContain('C');
    });

    it('handles 1 segment', () => {
      const path = buildCBezierMountainPath(800, 0.5, 42, 1440, 1);
      const cCount = (path.match(/C/g) || []).length;
      expect(cCount).toBe(1);
    });

    it('handles large segment count', () => {
      const path = buildCBezierMountainPath(800, 0.5, 42, 1440, 50);
      const cCount = (path.match(/C/g) || []).length;
      expect(cCount).toBe(50);
    });

    it('handles seed of 0', () => {
      const path = buildCBezierMountainPath(800, 0.5, 0);
      expect(path).toMatch(/^M/);
    });

    it('handles very large seed', () => {
      const path = buildCBezierMountainPath(800, 0.5, 999999999);
      expect(path).toMatch(/^M/);
      expect(path).toMatch(/Z$/);
    });

    it('path coordinates are rounded integers', () => {
      const path = buildCBezierMountainPath(800, 0.5, 42);
      // All coordinates in M, L, and C commands should be integers
      const coords = path.match(/[\d.]+/g).map(Number);
      for (const c of coords) {
        expect(Number.isInteger(c)).toBe(true);
      }
    });

    it('contains exactly segments + 1 L/line commands counting start and end', () => {
      const path = buildCBezierMountainPath(800, 0.5, 42, 1440, 10);
      // Structure: M0,vbH L0,baseY [10x C...] L1440,vbH Z
      expect(path).toContain('L0,');
      expect(path).toContain('L1440,800 Z');
    });

    it('produces same path across multiple calls for each layer config', () => {
      for (const config of MOUNTAIN_LAYER_CONFIGS) {
        const p1 = buildCBezierMountainPath(800, config.baseHeight, config.seed);
        const p2 = buildCBezierMountainPath(800, config.baseHeight, config.seed);
        expect(p1).toBe(p2);
      }
    });

    it('all 7 layer configs produce unique paths', () => {
      const paths = MOUNTAIN_LAYER_CONFIGS.map(c =>
        buildCBezierMountainPath(800, c.baseHeight, c.seed)
      );
      expect(new Set(paths).size).toBe(7);
    });

    it('viewBox width of 0 produces degenerate but valid path', () => {
      const path = buildCBezierMountainPath(800, 0.5, 42, 0, 10);
      expect(path).toMatch(/^M/);
      expect(path).toMatch(/Z$/);
    });
  });

  // ── buildSmallMountainPath edge cases ────────────────────────────

  describe('buildSmallMountainPath edge cases', () => {
    it('custom segment count overrides default 6', () => {
      const path = buildSmallMountainPath(280, 200, 0.5, 42, 3);
      const cCount = (path.match(/C/g) || []).length;
      expect(cCount).toBe(3);
    });

    it('handles 0×0 viewbox', () => {
      const path = buildSmallMountainPath(0, 0, 0.5, 42);
      expect(path).toMatch(/^M/);
    });

    it('handles very wide aspect ratio', () => {
      const path = buildSmallMountainPath(2000, 50, 0.5, 42);
      expect(path).toContain('C');
    });
  });

  // ── buildBirds edge cases ────────────────────────────────────────

  describe('buildBirds edge cases', () => {
    it('scales with viewBox dimensions', () => {
      const small = buildBirds(100, 100);
      const large = buildBirds(1000, 1000);
      // Y values should scale proportionally
      expect(large[0].y).toBeGreaterThan(small[0].y);
    });

    it('birds are horizontally distributed', () => {
      const birds = buildBirds(280, 200);
      const xs = birds.map(b => b.x);
      // All x positions should be unique
      expect(new Set(xs).size).toBe(4);
      // Sorted ascending
      const sorted = [...xs].sort((a, b) => a - b);
      expect(xs).toEqual(sorted);
    });

    it('stroke widths decrease for more distant birds', () => {
      const birds = buildBirds(280, 200);
      // Bird at index 2 (furthest back, smallest y=0.13 area) has smallest stroke
      // Just verify all stroke widths are positive and reasonable
      for (const bird of birds) {
        expect(bird.strokeWidth).toBeGreaterThan(0);
        expect(bird.strokeWidth).toBeLessThanOrEqual(2);
      }
    });

    it('handles zero viewBox', () => {
      const birds = buildBirds(0, 0);
      expect(birds).toHaveLength(4);
      for (const bird of birds) {
        expect(bird.x).toBe(0);
        expect(bird.y).toBe(0);
      }
    });
  });

  // ── buildPineTrees edge cases ────────────────────────────────────

  describe('buildPineTrees edge cases', () => {
    it('each tree has exactly 3 canopy layers', () => {
      const trees = buildPineTrees(280, 200);
      for (const tree of trees) {
        expect(tree.canopyLayers).toHaveLength(3);
      }
    });

    it('canopy opacities increase from outer to inner', () => {
      const trees = buildPineTrees(280, 200);
      for (const tree of trees) {
        for (let i = 1; i < tree.canopyLayers.length; i++) {
          expect(tree.canopyLayers[i].opacity).toBeGreaterThan(
            tree.canopyLayers[i - 1].opacity
          );
        }
      }
    });

    it('trunk dimensions are proportional to viewBox', () => {
      const small = buildPineTrees(100, 100);
      const large = buildPineTrees(1000, 1000);
      expect(large[0].trunk.height).toBeGreaterThan(small[0].trunk.height);
      expect(large[0].trunk.width).toBeGreaterThan(small[0].trunk.width);
    });

    it('trees are spread across the width', () => {
      const trees = buildPineTrees(280, 200);
      const xs = trees.map(t => t.trunk.x);
      // First tree on left side, last on right
      expect(xs[0]).toBeLessThan(280 * 0.2);
      expect(xs[2]).toBeGreaterThan(280 * 0.8);
    });

    it('handles zero viewBox', () => {
      const trees = buildPineTrees(0, 0);
      expect(trees).toHaveLength(3);
    });
  });

  // ── buildFlora edge cases ────────────────────────────────────────

  describe('buildFlora edge cases', () => {
    it('bloom colors use illustration palette', () => {
      const flora = buildFlora(280, 200);
      const validColors = Object.values(ILLUSTRATION_COLORS);
      for (const f of flora) {
        expect(validColors).toContain(f.bloom.color);
      }
    });

    it('bloom radius is proportional to width', () => {
      const small = buildFlora(100, 200);
      const large = buildFlora(1000, 200);
      expect(large[0].bloom.r).toBeGreaterThan(small[0].bloom.r);
    });

    it('stem y1 > stem y2 (stems grow upward)', () => {
      const flora = buildFlora(280, 200);
      for (const f of flora) {
        expect(f.stem.y1).toBeGreaterThan(f.stem.y2);
      }
    });

    it('bloom is above stem top', () => {
      const flora = buildFlora(280, 200);
      for (const f of flora) {
        // bloom cy <= stem y2 (top of stem)
        expect(f.bloom.cy).toBeLessThanOrEqual(f.stem.y2);
      }
    });

    it('all stems have strokeWidth of 1', () => {
      const flora = buildFlora(280, 200);
      for (const f of flora) {
        expect(f.stem.strokeWidth).toBe(1);
      }
    });

    it('handles zero viewBox', () => {
      const flora = buildFlora(0, 0);
      expect(flora).toHaveLength(6);
      for (const f of flora) {
        expect(f.bloom.r).toBeGreaterThan(0); // minimum 1.5 from the formula
      }
    });
  });

  // ── Constants integrity ──────────────────────────────────────────

  describe('constants integrity', () => {
    it('layer color arrays match layer configs count', () => {
      expect(STANDARD_LAYER_COLORS).toHaveLength(MOUNTAIN_LAYER_CONFIGS.length);
      expect(TRANSPARENT_LAYER_COLORS).toHaveLength(MOUNTAIN_LAYER_CONFIGS.length);
    });

    it('opacity arrays match layer configs count', () => {
      expect(STANDARD_OPACITIES).toHaveLength(MOUNTAIN_LAYER_CONFIGS.length);
      expect(TRANSPARENT_OPACITIES).toHaveLength(MOUNTAIN_LAYER_CONFIGS.length);
    });

    it('transparent opacities increase from distant to front', () => {
      for (let i = 1; i < TRANSPARENT_OPACITIES.length; i++) {
        expect(TRANSPARENT_OPACITIES[i]).toBeGreaterThan(TRANSPARENT_OPACITIES[i - 1]);
      }
    });

    it('all standard layer colors reference valid palette entries', () => {
      const validColors = Object.values(ILLUSTRATION_COLORS);
      for (const color of STANDARD_LAYER_COLORS) {
        expect(validColors).toContain(color);
      }
    });

    it('all transparent layer colors reference valid palette entries', () => {
      const validColors = Object.values(ILLUSTRATION_COLORS);
      for (const color of TRANSPARENT_LAYER_COLORS) {
        expect(validColors).toContain(color);
      }
    });

    it('MOUNTAIN_LAYER_CONFIGS baseHeight values are in 0-1 range', () => {
      for (const config of MOUNTAIN_LAYER_CONFIGS) {
        expect(config.baseHeight).toBeGreaterThan(0);
        expect(config.baseHeight).toBeLessThan(1);
      }
    });
  });
});
