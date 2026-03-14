/**
 * Tests for carolinaFutonsLogo.js — brand logo SVG generation.
 * Covers header logo, footer logo, data URI encoding, and customization options.
 */
import { describe, it, expect } from 'vitest';
import {
  getLogoSvg,
  getLogoDataUri,
  getFooterLogoSvg,
  getFooterLogoDataUri,
} from '../src/public/carolinaFutonsLogo';

// ── getLogoSvg ──────────────────────────────────────────────────────

describe('getLogoSvg', () => {
  it('returns valid SVG string', () => {
    const svg = getLogoSvg();
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('contains "Carolina" and "Futons" text', () => {
    const svg = getLogoSvg();
    expect(svg).toContain('Carolina');
    expect(svg).toContain('Futons');
  });

  it('uses espresso color by default', () => {
    const svg = getLogoSvg();
    expect(svg).toContain('#3A2518');
  });

  it('includes Playfair Display font', () => {
    const svg = getLogoSvg();
    expect(svg).toContain('Playfair Display');
  });

  it('has accessible aria-label', () => {
    const svg = getLogoSvg();
    expect(svg).toContain('aria-label="Carolina Futons"');
  });

  it('uses default dimensions 180x60', () => {
    const svg = getLogoSvg();
    expect(svg).toContain('width="180"');
    expect(svg).toContain('height="60"');
  });

  it('accepts custom color', () => {
    const svg = getLogoSvg({ color: '#FF0000' });
    expect(svg).toContain('#FF0000');
    expect(svg).not.toContain('#3A2518');
  });

  it('accepts custom dimensions', () => {
    const svg = getLogoSvg({ width: 240, height: 80 });
    expect(svg).toContain('width="240"');
    expect(svg).toContain('height="80"');
  });

  it('handles empty options object', () => {
    const svg = getLogoSvg({});
    expect(svg).toContain('Carolina');
    expect(svg).toContain('#3A2518');
  });

  it('handles undefined options', () => {
    const svg = getLogoSvg(undefined);
    expect(svg).toContain('Carolina');
  });
});

// ── getLogoDataUri ──────────────────────────────────────────────────

describe('getLogoDataUri', () => {
  it('returns data URI with SVG MIME type', () => {
    const uri = getLogoDataUri();
    expect(uri).toMatch(/^data:image\/svg\+xml,/);
  });

  it('contains encoded SVG content', () => {
    const uri = getLogoDataUri();
    expect(uri).toContain(encodeURIComponent('Carolina'));
    expect(uri).toContain(encodeURIComponent('Futons'));
  });

  it('passes options through to getLogoSvg', () => {
    const uri = getLogoDataUri({ color: '#FFFFFF' });
    expect(uri).toContain(encodeURIComponent('#FFFFFF'));
  });

  it('handles no arguments', () => {
    const uri = getLogoDataUri();
    expect(typeof uri).toBe('string');
    expect(uri.length).toBeGreaterThan(50);
  });
});

// ── getFooterLogoSvg ────────────────────────────────────────────────

describe('getFooterLogoSvg', () => {
  it('returns valid SVG string', () => {
    const svg = getFooterLogoSvg();
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('contains "Carolina Futons" on single line', () => {
    const svg = getFooterLogoSvg();
    expect(svg).toContain('Carolina Futons');
  });

  it('uses espresso color by default', () => {
    const svg = getFooterLogoSvg();
    expect(svg).toContain('#3A2518');
  });

  it('uses smaller default dimensions (160x30)', () => {
    const svg = getFooterLogoSvg();
    expect(svg).toContain('width="160"');
    expect(svg).toContain('height="30"');
  });

  it('has accessible aria-label', () => {
    const svg = getFooterLogoSvg();
    expect(svg).toContain('aria-label="Carolina Futons"');
  });

  it('accepts custom color', () => {
    const svg = getFooterLogoSvg({ color: '#FFFFFF' });
    expect(svg).toContain('#FFFFFF');
  });

  it('accepts custom dimensions', () => {
    const svg = getFooterLogoSvg({ width: 200, height: 40 });
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="40"');
  });
});

// ── getFooterLogoDataUri ────────────────────────────────────────────

describe('getFooterLogoDataUri', () => {
  it('returns data URI with SVG MIME type', () => {
    const uri = getFooterLogoDataUri();
    expect(uri).toMatch(/^data:image\/svg\+xml,/);
  });

  it('contains encoded footer logo content', () => {
    const uri = getFooterLogoDataUri();
    expect(uri).toContain(encodeURIComponent('Carolina Futons'));
  });

  it('passes options through', () => {
    const uri = getFooterLogoDataUri({ color: '#000000' });
    expect(uri).toContain(encodeURIComponent('#000000'));
  });
});

// ── Cross-cutting ───────────────────────────────────────────────────

describe('logo consistency', () => {
  it('header and footer logos use same espresso default', () => {
    const header = getLogoSvg();
    const footer = getFooterLogoSvg();
    expect(header).toContain('#3A2518');
    expect(footer).toContain('#3A2518');
  });

  it('header logo is larger than footer logo', () => {
    const header = getLogoSvg();
    const footer = getFooterLogoSvg();
    const headerWidth = parseInt(header.match(/width="(\d+)"/)[1]);
    const footerWidth = parseInt(footer.match(/width="(\d+)"/)[1]);
    expect(headerWidth).toBeGreaterThan(footerWidth);
  });

  it('both logos have role="img" for accessibility', () => {
    expect(getLogoSvg()).toContain('role="img"');
    expect(getFooterLogoSvg()).toContain('role="img"');
  });
});
