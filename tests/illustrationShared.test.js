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

// ── ILLUSTRATION_COLORS ─────────────────────────────────────────

describe('ILLUSTRATION_COLORS', () => {
  it('exports the warm Blue Ridge Mountain palette (not UI palette)', () => {
    // The illustration palette uses warm browns/corals, distinct from the blue/navy UI tokens
    expect(ILLUSTRATION_COLORS.espresso).toBe('#3A2518');
    expect(ILLUSTRATION_COLORS.sandBase).toBe('#E8D5B7');
    expect(ILLUSTRATION_COLORS.sunsetCoral).toBe('#E8845C');
  });

  it('includes all required color tokens', () => {
    const required = [
      'sandBase', 'sandLight', 'sandDark',
      'espresso', 'espressoLight',
      'mountainBlue', 'mountainBlueDark', 'mountainBlueLight',
      'sunsetCoral', 'sunsetCoralDark', 'sunsetCoralLight',
      'skyGradientTop', 'skyGradientBottom',
      'offWhite', 'white',
    ];
    for (const key of required) {
      expect(ILLUSTRATION_COLORS[key]).toBeDefined();
      expect(typeof ILLUSTRATION_COLORS[key]).toBe('string');
    }
  });

  it('all color values are valid hex codes', () => {
    for (const [key, value] of Object.entries(ILLUSTRATION_COLORS)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ── MOUNTAIN_LAYER_CONFIGS ──────────────────────────────────────

describe('MOUNTAIN_LAYER_CONFIGS', () => {
  it('has 7 layers', () => {
    expect(MOUNTAIN_LAYER_CONFIGS).toHaveLength(7);
  });

  it('each layer has name, baseHeight, and seed', () => {
    for (const layer of MOUNTAIN_LAYER_CONFIGS) {
      expect(typeof layer.name).toBe('string');
      expect(typeof layer.baseHeight).toBe('number');
      expect(typeof layer.seed).toBe('number');
    }
  });

  it('baseHeight values increase from back to front', () => {
    for (let i = 1; i < MOUNTAIN_LAYER_CONFIGS.length; i++) {
      expect(MOUNTAIN_LAYER_CONFIGS[i].baseHeight).toBeGreaterThan(
        MOUNTAIN_LAYER_CONFIGS[i - 1].baseHeight,
      );
    }
  });

  it('all seeds are unique', () => {
    const seeds = MOUNTAIN_LAYER_CONFIGS.map(l => l.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

// ── Opacity arrays ──────────────────────────────────────────────

describe('opacity arrays', () => {
  it('STANDARD_OPACITIES has 7 entries matching layer count', () => {
    expect(STANDARD_OPACITIES).toHaveLength(7);
  });

  it('TRANSPARENT_OPACITIES has 7 entries matching layer count', () => {
    expect(TRANSPARENT_OPACITIES).toHaveLength(7);
  });

  it('all opacity values are between 0 and 1', () => {
    for (const o of [...STANDARD_OPACITIES, ...TRANSPARENT_OPACITIES]) {
      expect(o).toBeGreaterThan(0);
      expect(o).toBeLessThanOrEqual(1);
    }
  });

  it('opacities increase from distant to front (atmospheric perspective)', () => {
    for (let i = 1; i < STANDARD_OPACITIES.length; i++) {
      expect(STANDARD_OPACITIES[i]).toBeGreaterThan(STANDARD_OPACITIES[i - 1]);
    }
  });
});

// ── Layer color arrays ──────────────────────────────────────────

describe('layer color arrays', () => {
  it('STANDARD_LAYER_COLORS has 7 entries', () => {
    expect(STANDARD_LAYER_COLORS).toHaveLength(7);
  });

  it('TRANSPARENT_LAYER_COLORS has 7 entries', () => {
    expect(TRANSPARENT_LAYER_COLORS).toHaveLength(7);
  });

  it('uses mountain blue for distant layers and espresso for near layers', () => {
    expect(STANDARD_LAYER_COLORS[0]).toBe(ILLUSTRATION_COLORS.mountainBlue);
    expect(STANDARD_LAYER_COLORS[6]).toBe(ILLUSTRATION_COLORS.espresso);
  });
});

// ── buildCBezierMountainPath ────────────────────────────────────

describe('buildCBezierMountainPath', () => {
  it('returns a valid SVG path string starting with M and ending with Z', () => {
    const path = buildCBezierMountainPath(800, 0.5, 42);
    expect(path).toMatch(/^M/);
    expect(path).toMatch(/Z$/);
  });

  it('is deterministic — same inputs produce same output', () => {
    const path1 = buildCBezierMountainPath(800, 0.5, 42);
    const path2 = buildCBezierMountainPath(800, 0.5, 42);
    expect(path1).toBe(path2);
  });

  it('different seeds produce different paths', () => {
    const path1 = buildCBezierMountainPath(800, 0.5, 42);
    const path2 = buildCBezierMountainPath(800, 0.5, 17);
    expect(path1).not.toBe(path2);
  });

  it('contains cubic Bezier commands (C)', () => {
    const path = buildCBezierMountainPath(800, 0.5, 42);
    expect(path).toContain('C');
  });

  it('uses custom viewBox width when provided', () => {
    const narrow = buildCBezierMountainPath(800, 0.5, 42, 280);
    const wide = buildCBezierMountainPath(800, 0.5, 42, 1440);
    // Different widths should produce different paths
    expect(narrow).not.toBe(wide);
  });

  it('uses custom segment count when provided', () => {
    const few = buildCBezierMountainPath(800, 0.5, 42, 1440, 4);
    const many = buildCBezierMountainPath(800, 0.5, 42, 1440, 10);
    // More segments = more C commands
    const fewCs = (few.match(/C/g) || []).length;
    const manyCs = (many.match(/C/g) || []).length;
    expect(manyCs).toBeGreaterThan(fewCs);
  });

  it('closes the path at the bottom of viewBox', () => {
    const vbH = 800;
    const path = buildCBezierMountainPath(vbH, 0.5, 42);
    // Path should start at bottom-left M0,800 and end closing to bottom
    expect(path).toContain(`M0,${vbH}`);
  });
});

// ── buildSmallMountainPath ──────────────────────────────────────

describe('buildSmallMountainPath', () => {
  it('returns a valid SVG path for 280×200 viewbox', () => {
    const path = buildSmallMountainPath(280, 200, 0.5, 42);
    expect(path).toMatch(/^M/);
    expect(path).toMatch(/Z$/);
  });

  it('uses 6 segments by default (6 cubic commands)', () => {
    const path = buildSmallMountainPath(280, 200, 0.5, 42);
    const cCount = (path.match(/C/g) || []).length;
    expect(cCount).toBe(6);
  });

  it('is consistent with buildCBezierMountainPath', () => {
    const small = buildSmallMountainPath(280, 200, 0.5, 42, 6);
    const direct = buildCBezierMountainPath(200, 0.5, 42, 280, 6);
    expect(small).toBe(direct);
  });
});

// ── buildBirds ──────────────────────────────────────────────────

describe('buildBirds', () => {
  it('returns 4 bird configs', () => {
    const birds = buildBirds(280, 200);
    expect(birds).toHaveLength(4);
  });

  it('each bird has path, strokeWidth, x, and y', () => {
    const birds = buildBirds(280, 200);
    for (const bird of birds) {
      expect(typeof bird.path).toBe('string');
      expect(typeof bird.strokeWidth).toBe('number');
      expect(typeof bird.x).toBe('number');
      expect(typeof bird.y).toBe('number');
    }
  });

  it('birds are in the upper sky region (y < 50% of height)', () => {
    const birds = buildBirds(280, 200);
    for (const bird of birds) {
      expect(bird.y).toBeLessThan(200 * 0.5);
    }
  });

  it('bird paths contain cubic Bezier commands', () => {
    const birds = buildBirds(280, 200);
    for (const bird of birds) {
      expect(bird.path).toContain('C');
    }
  });
});

// ── buildPineTrees ──────────────────────────────────────────────

describe('buildPineTrees', () => {
  it('returns 3 tree configs', () => {
    const trees = buildPineTrees(280, 200);
    expect(trees).toHaveLength(3);
  });

  it('each tree has trunk and canopyLayers', () => {
    const trees = buildPineTrees(280, 200);
    for (const tree of trees) {
      expect(tree.trunk).toBeDefined();
      expect(tree.trunk.x).toBeDefined();
      expect(tree.trunk.y).toBeDefined();
      expect(tree.trunk.width).toBeDefined();
      expect(tree.trunk.height).toBeDefined();
      expect(tree.canopyLayers).toBeInstanceOf(Array);
      expect(tree.canopyLayers.length).toBeGreaterThan(0);
    }
  });

  it('each canopy layer has path and opacity', () => {
    const trees = buildPineTrees(280, 200);
    for (const tree of trees) {
      for (const layer of tree.canopyLayers) {
        expect(typeof layer.path).toBe('string');
        expect(typeof layer.opacity).toBe('number');
      }
    }
  });
});

// ── buildFlora ──────────────────────────────────────────────────

describe('buildFlora', () => {
  it('returns 6 flora elements', () => {
    const flora = buildFlora(280, 200);
    expect(flora).toHaveLength(6);
  });

  it('each element has stem and bloom', () => {
    const flora = buildFlora(280, 200);
    for (const f of flora) {
      expect(f.stem).toBeDefined();
      expect(f.stem.x1).toBeDefined();
      expect(f.stem.y1).toBeDefined();
      expect(f.bloom).toBeDefined();
      expect(f.bloom.cx).toBeDefined();
      expect(f.bloom.cy).toBeDefined();
      expect(f.bloom.r).toBeGreaterThan(0);
      expect(typeof f.bloom.color).toBe('string');
    }
  });

  it('flora are in the lower portion of the viewbox', () => {
    const flora = buildFlora(280, 200);
    for (const f of flora) {
      expect(f.stem.y1).toBeGreaterThan(200 * 0.7);
    }
  });
});
