/**
 * Tests for SVG export pipeline — Figma → SVGO optimize → brand token injection → Wix integration.
 * cf-gtep: P1 infrastructure for Figma-first illustration pivot.
 */
import { describe, it, expect } from 'vitest';

import {
  optimizeSvg,
  injectBrandTokens,
  buildColorMap,
  wrapForWixHtmlComponent,
  processSvgPipeline,
} from '../../scripts/svgPipeline.js';

// ── buildColorMap ─────────────────────────────────────────────────────

describe('buildColorMap', () => {
  it('returns a map of hex colors to sharedTokens variable names', () => {
    const map = buildColorMap();
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBeGreaterThanOrEqual(10);
  });

  it('maps sand base color', () => {
    const map = buildColorMap();
    expect(map.get('#e8d5b7')).toBe('colors.sandBase');
  });

  it('maps espresso color', () => {
    const map = buildColorMap();
    expect(map.get('#3a2518')).toBe('colors.espresso');
  });

  it('maps mountain blue', () => {
    const map = buildColorMap();
    expect(map.get('#5b8fa8')).toBe('colors.mountainBlue');
  });

  it('maps sunset coral', () => {
    const map = buildColorMap();
    expect(map.get('#e8845c')).toBe('colors.sunsetCoral');
  });

  it('all keys are lowercase hex', () => {
    const map = buildColorMap();
    for (const key of map.keys()) {
      expect(key).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ── optimizeSvg ───────────────────────────────────────────────────────

describe('optimizeSvg', () => {
  const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Figma (export) -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <metadata>Figma metadata here</metadata>
  <defs>
    <style>/* empty style */</style>
  </defs>
  <rect x="10" y="10" width="80" height="80" fill="#E8D5B7"/>
</svg>`;

  it('removes XML declaration', () => {
    const result = optimizeSvg(testSvg);
    expect(result).not.toContain('<?xml');
  });

  it('removes Figma comments', () => {
    const result = optimizeSvg(testSvg);
    expect(result).not.toContain('Generator: Figma');
  });

  it('removes metadata elements', () => {
    const result = optimizeSvg(testSvg);
    expect(result.toLowerCase()).not.toContain('<metadata');
  });

  it('preserves SVG structure', () => {
    const result = optimizeSvg(testSvg);
    expect(result).toContain('<svg');
    expect(result).toContain('</svg>');
    expect(result).toContain('<rect');
  });

  it('preserves viewBox', () => {
    const result = optimizeSvg(testSvg);
    expect(result).toContain('viewBox="0 0 100 100"');
  });

  it('returns empty string for invalid input', () => {
    expect(optimizeSvg('')).toBe('');
    expect(optimizeSvg(null)).toBe('');
    expect(optimizeSvg(undefined)).toBe('');
  });

  it('reduces file size', () => {
    const result = optimizeSvg(testSvg);
    expect(result.length).toBeLessThan(testSvg.length);
  });
});

// ── injectBrandTokens ─────────────────────────────────────────────────

describe('injectBrandTokens', () => {
  it('replaces hardcoded hex with token variable comments', () => {
    const svg = '<rect fill="#E8D5B7"/>';
    const result = injectBrandTokens(svg);
    // Should add a data attribute or comment indicating the token
    expect(result).toContain('colors.sandBase');
  });

  it('replaces multiple colors in one SVG', () => {
    const svg = '<rect fill="#E8D5B7"/><circle fill="#3A2518"/>';
    const result = injectBrandTokens(svg);
    expect(result).toContain('colors.sandBase');
    expect(result).toContain('colors.espresso');
  });

  it('handles case-insensitive hex matching', () => {
    const svg = '<rect fill="#e8d5b7"/>';
    const result = injectBrandTokens(svg);
    expect(result).toContain('colors.sandBase');
  });

  it('replaces colors in stroke attributes too', () => {
    const svg = '<path stroke="#5B8FA8" fill="none"/>';
    const result = injectBrandTokens(svg);
    expect(result).toContain('colors.mountainBlue');
  });

  it('returns replacement report', () => {
    const svg = '<rect fill="#E8D5B7"/><circle fill="#3A2518"/>';
    const result = injectBrandTokens(svg, { report: true });
    expect(result).toHaveProperty('svg');
    expect(result).toHaveProperty('replacements');
    expect(Array.isArray(result.replacements)).toBe(true);
    expect(result.replacements.length).toBe(2);
  });

  it('leaves non-brand hex colors unchanged', () => {
    const svg = '<rect fill="#FF0000"/>';
    const result = injectBrandTokens(svg);
    expect(result).toContain('#FF0000');
  });

  it('handles empty/null input', () => {
    expect(injectBrandTokens('')).toBe('');
    expect(injectBrandTokens(null)).toBe('');
  });
});

// ── wrapForWixHtmlComponent ───────────────────────────────────────────

describe('wrapForWixHtmlComponent', () => {
  it('wraps SVG in HTML document for HtmlComponent', () => {
    const svg = '<svg viewBox="0 0 100 100"><rect fill="#E8D5B7"/></svg>';
    const result = wrapForWixHtmlComponent(svg);
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html');
    expect(result).toContain(svg);
  });

  it('includes responsive CSS to fill container', () => {
    const svg = '<svg viewBox="0 0 100 100"><rect/></svg>';
    const result = wrapForWixHtmlComponent(svg);
    expect(result).toContain('width: 100%');
  });

  it('includes message listener for dynamic updates', () => {
    const svg = '<svg viewBox="0 0 100 100"><rect/></svg>';
    const result = wrapForWixHtmlComponent(svg);
    expect(result).toContain('addEventListener');
    expect(result).toContain('message');
  });

  it('returns empty string for empty input', () => {
    expect(wrapForWixHtmlComponent('')).toBe('');
  });
});

// ── processSvgPipeline (end-to-end) ──────────────────────────────────

describe('processSvgPipeline', () => {
  const figmaSvg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by Figma -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" width="800" height="200">
  <metadata>
    <figma:metadata>test</figma:metadata>
  </metadata>
  <rect x="0" y="0" width="800" height="200" fill="#B8D4E3"/>
  <path d="M0 150 Q200 100 400 130 Q600 160 800 120 L800 200 L0 200Z" fill="#5B8FA8"/>
  <path d="M0 170 Q200 140 400 160 Q600 180 800 150 L800 200 L0 200Z" fill="#3A2518" opacity="0.3"/>
  <circle cx="700" cy="50" r="30" fill="#E8845C"/>
</svg>`;

  it('optimizes, injects tokens, and returns processed SVG', () => {
    const result = processSvgPipeline(figmaSvg);
    expect(result).toHaveProperty('optimized');
    expect(result).toHaveProperty('tokenized');
    expect(result).toHaveProperty('wixHtml');
    expect(result).toHaveProperty('report');
  });

  it('optimized output is smaller than input', () => {
    const result = processSvgPipeline(figmaSvg);
    expect(result.optimized.length).toBeLessThan(figmaSvg.length);
  });

  it('tokenized output has brand token references', () => {
    const result = processSvgPipeline(figmaSvg);
    expect(result.tokenized).toContain('colors.skyGradientTop');
    expect(result.tokenized).toContain('colors.mountainBlue');
    expect(result.tokenized).toContain('colors.espresso');
    expect(result.tokenized).toContain('colors.sunsetCoral');
  });

  it('wixHtml wraps for HtmlComponent', () => {
    const result = processSvgPipeline(figmaSvg);
    expect(result.wixHtml).toContain('<!DOCTYPE html>');
    expect(result.wixHtml).toContain('<svg');
  });

  it('report lists all replacements', () => {
    const result = processSvgPipeline(figmaSvg);
    expect(result.report.replacements.length).toBe(4);
  });

  it('report includes file size stats', () => {
    const result = processSvgPipeline(figmaSvg);
    expect(result.report).toHaveProperty('originalSize');
    expect(result.report).toHaveProperty('optimizedSize');
    expect(result.report.optimizedSize).toBeLessThan(result.report.originalSize);
  });

  it('handles empty input', () => {
    const result = processSvgPipeline('');
    expect(result).toBeNull();
  });
});
