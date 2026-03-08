import { describe, it, expect } from 'vitest';

import {
  getRoomPlannerContent,
  getDefaultRoomPresets,
  getRoomShapeOptions,
  formatDimensions,
  calculateScale,
  getProductPalette,
  formatPlacementLabel,
} from '../../src/public/roomPlannerHelpers.js';

// ── getRoomPlannerContent ─────────────────────────────────────────────

describe('getRoomPlannerContent', () => {
  it('returns page content with hero and instructions', () => {
    const content = getRoomPlannerContent();
    expect(content).toHaveProperty('hero');
    expect(content.hero).toHaveProperty('heading');
    expect(content.hero).toHaveProperty('subheading');
    expect(content.hero.heading.length).toBeGreaterThan(0);
  });

  it('hero references room planning or furniture layout', () => {
    const content = getRoomPlannerContent();
    const combined = `${content.hero.heading} ${content.hero.subheading}`.toLowerCase();
    expect(combined).toMatch(/room|plan|layout|furniture|space/);
  });

  it('includes instructions section', () => {
    const content = getRoomPlannerContent();
    expect(content).toHaveProperty('instructions');
    expect(content.instructions).toHaveProperty('heading');
    expect(content.instructions).toHaveProperty('steps');
    expect(Array.isArray(content.instructions.steps)).toBe(true);
    expect(content.instructions.steps.length).toBeGreaterThanOrEqual(3);
  });
});

// ── getDefaultRoomPresets ─────────────────────────────────────────────

describe('getDefaultRoomPresets', () => {
  it('returns array of room preset configs', () => {
    const presets = getDefaultRoomPresets();
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThanOrEqual(3);
  });

  it('each preset has name, width, length, and shape', () => {
    const presets = getDefaultRoomPresets();
    for (const p of presets) {
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('width');
      expect(p).toHaveProperty('length');
      expect(p).toHaveProperty('shape');
      expect(typeof p.width).toBe('number');
      expect(typeof p.length).toBe('number');
      expect(p.width).toBeGreaterThan(0);
      expect(p.length).toBeGreaterThan(0);
    }
  });

  it('includes a living room preset', () => {
    const presets = getDefaultRoomPresets();
    const living = presets.find(p => p.name.toLowerCase().includes('living'));
    expect(living).toBeTruthy();
  });
});

// ── getRoomShapeOptions ───────────────────────────────────────────────

describe('getRoomShapeOptions', () => {
  it('returns array of shape options', () => {
    const shapes = getRoomShapeOptions();
    expect(Array.isArray(shapes)).toBe(true);
    expect(shapes.length).toBeGreaterThanOrEqual(2);
  });

  it('each option has value and label', () => {
    const shapes = getRoomShapeOptions();
    for (const s of shapes) {
      expect(s).toHaveProperty('value');
      expect(s).toHaveProperty('label');
    }
  });

  it('includes rectangular shape', () => {
    const shapes = getRoomShapeOptions();
    const rect = shapes.find(s => s.value === 'rectangular');
    expect(rect).toBeTruthy();
  });
});

// ── formatDimensions ──────────────────────────────────────────────────

describe('formatDimensions', () => {
  it('formats inches as feet and inches string', () => {
    const result = formatDimensions(120, 144);
    expect(result).toMatch(/10/); // 120 inches = 10 feet
    expect(result).toMatch(/12/); // 144 inches = 12 feet
  });

  it('handles dimensions with remaining inches', () => {
    const result = formatDimensions(125, 100);
    expect(result).toMatch(/10.*5/); // 125 = 10'5"
  });

  it('returns empty string for zero or negative', () => {
    expect(formatDimensions(0, 0)).toBe('');
    expect(formatDimensions(-1, 100)).toBe('');
  });
});

// ── calculateScale ────────────────────────────────────────────────────

describe('calculateScale', () => {
  it('calculates pixels-per-inch to fit room in container', () => {
    const scale = calculateScale(120, 144, 600, 500);
    expect(typeof scale).toBe('number');
    expect(scale).toBeGreaterThan(0);
  });

  it('room fits within container at calculated scale', () => {
    const containerW = 600;
    const containerH = 500;
    const roomW = 120;
    const roomH = 200;
    const scale = calculateScale(roomW, roomH, containerW, containerH);
    expect(roomW * scale).toBeLessThanOrEqual(containerW);
    expect(roomH * scale).toBeLessThanOrEqual(containerH);
  });

  it('maximizes one dimension to fill container', () => {
    const scale = calculateScale(100, 200, 400, 800);
    // 200 * 4 = 800, exactly fills height
    expect(scale).toBe(4);
  });

  it('returns 1 for invalid inputs', () => {
    expect(calculateScale(0, 100, 400, 400)).toBe(1);
    expect(calculateScale(100, 0, 400, 400)).toBe(1);
  });
});

// ── getProductPalette ─────────────────────────────────────────────────

describe('getProductPalette', () => {
  it('returns grouped products for the drag palette', () => {
    const palette = getProductPalette();
    expect(Array.isArray(palette)).toBe(true);
    expect(palette.length).toBeGreaterThanOrEqual(2);
  });

  it('each category has name and items array', () => {
    const palette = getProductPalette();
    for (const group of palette) {
      expect(group).toHaveProperty('category');
      expect(group).toHaveProperty('items');
      expect(Array.isArray(group.items)).toBe(true);
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it('each item has productType, label, width, depth', () => {
    const palette = getProductPalette();
    for (const group of palette) {
      for (const item of group.items) {
        expect(item).toHaveProperty('productType');
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('width');
        expect(item).toHaveProperty('depth');
        expect(typeof item.width).toBe('number');
      }
    }
  });

  it('includes futon frames category', () => {
    const palette = getProductPalette();
    const futons = palette.find(g => g.category.toLowerCase().includes('futon'));
    expect(futons).toBeTruthy();
  });
});

// ── formatPlacementLabel ──────────────────────────────────────────────

describe('formatPlacementLabel', () => {
  it('formats placement with label and dimensions', () => {
    const result = formatPlacementLabel({
      label: 'Full Futon Frame',
      width: 82,
      depth: 38,
      isBedMode: false,
    });
    expect(result).toMatch(/Full Futon Frame/);
    expect(result).toMatch(/82/);
  });

  it('indicates bed mode when applicable', () => {
    const result = formatPlacementLabel({
      label: 'Full Futon Frame',
      width: 82,
      depth: 54,
      isBedMode: true,
    });
    expect(result.toLowerCase()).toMatch(/bed/);
  });

  it('handles missing label gracefully', () => {
    const result = formatPlacementLabel({ width: 40, depth: 20 });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
