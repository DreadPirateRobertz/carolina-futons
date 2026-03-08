import { describe, it, expect } from 'vitest';
import { getImageUrl } from '../../src/backend/utils/mediaHelpers.js';

describe('getImageUrl', () => {
  it('returns empty string for null/undefined', () => {
    expect(getImageUrl(null)).toBe('');
    expect(getImageUrl(undefined)).toBe('');
    expect(getImageUrl('')).toBe('');
  });

  it('passes through HTTP URLs unchanged', () => {
    expect(getImageUrl('https://example.com/img.jpg')).toBe('https://example.com/img.jpg');
    expect(getImageUrl('http://example.com/img.jpg')).toBe('http://example.com/img.jpg');
  });

  it('converts wix:image:// URIs to static.wixstatic.com URLs', () => {
    const wixUri = 'wix:image://v1/abc123.jpg/image.jpg#originWidth=800&originHeight=600';
    const result = getImageUrl(wixUri);
    expect(result).toBe('https://static.wixstatic.com/media/abc123.jpg');
  });

  it('handles wix:image:// without extra path segments', () => {
    const wixUri = 'wix:image://v1/simple.jpg';
    const result = getImageUrl(wixUri);
    expect(result).toContain('static.wixstatic.com/media/simple.jpg');
  });

  it('extracts src from media objects', () => {
    const media = { src: 'https://example.com/photo.jpg' };
    expect(getImageUrl(media)).toBe('https://example.com/photo.jpg');
  });

  it('extracts url from media objects', () => {
    const media = { url: 'https://example.com/photo.jpg' };
    expect(getImageUrl(media)).toBe('https://example.com/photo.jpg');
  });

  it('recursively resolves src with wix:image:// URI', () => {
    const media = { src: 'wix:image://v1/nested.jpg/photo.jpg#w=400' };
    const result = getImageUrl(media);
    expect(result).toBe('https://static.wixstatic.com/media/nested.jpg');
  });

  it('returns non-URL strings as-is', () => {
    expect(getImageUrl('just-a-string')).toBe('just-a-string');
  });

  // --- wix:image edge cases ---

  it('handles wix:image URI with multiple path segments after mediaId', () => {
    const uri = 'wix:image://v1/abc123.jpg/some/nested/path.jpg#originWidth=1200';
    expect(getImageUrl(uri)).toBe('https://static.wixstatic.com/media/abc123.jpg');
  });

  it('handles wix:image URI with no hash params', () => {
    const uri = 'wix:image://v1/nohash.png/display.png';
    expect(getImageUrl(uri)).toBe('https://static.wixstatic.com/media/nohash.png');
  });

  it('handles wix:image URI with special characters in filename', () => {
    const uri = 'wix:image://v1/my%20image%2B1.jpg/display.jpg#w=500';
    expect(getImageUrl(uri)).toBe('https://static.wixstatic.com/media/my%20image%2B1.jpg');
  });

  it('handles wix:image URI with just v1/ prefix and mediaId only', () => {
    const uri = 'wix:image://v1/onlymedia.jpg';
    expect(getImageUrl(uri)).toBe('https://static.wixstatic.com/media/onlymedia.jpg');
  });

  it('handles wix:image URI with hash but no path segments after mediaId', () => {
    const uri = 'wix:image://v1/hashonly.jpg#originWidth=640&originHeight=480';
    expect(getImageUrl(uri)).toBe('https://static.wixstatic.com/media/hashonly.jpg');
  });

  it('handles wix:image URI with underscore and dash in mediaId', () => {
    const uri = 'wix:image://v1/img_file-name.webp/thumb.webp#w=200';
    expect(getImageUrl(uri)).toBe('https://static.wixstatic.com/media/img_file-name.webp');
  });

  // --- Object edge cases ---

  it('prefers src over url when both are present on media object', () => {
    const media = { src: 'https://example.com/from-src.jpg', url: 'https://example.com/from-url.jpg' };
    expect(getImageUrl(media)).toBe('https://example.com/from-src.jpg');
  });

  it('returns empty string for empty object {}', () => {
    expect(getImageUrl({})).toBe('');
  });

  it('falls through to url when src is null', () => {
    const media = { src: null, url: 'https://example.com/fallback.jpg' };
    expect(getImageUrl(media)).toBe('https://example.com/fallback.jpg');
  });

  it('falls through to url when src is empty string', () => {
    const media = { src: '', url: 'https://example.com/fallback2.jpg' };
    expect(getImageUrl(media)).toBe('https://example.com/fallback2.jpg');
  });

  it('recursively resolves nested object {src: {src: url}}', () => {
    const media = { src: { src: 'https://example.com/deep.jpg' } };
    expect(getImageUrl(media)).toBe('https://example.com/deep.jpg');
  });

  it('handles object with numeric src value (truthy, non-string)', () => {
    const media = { src: 42 };
    // 42 is truthy so getImageUrl is called recursively with 42
    // 42 is not falsy, not a string, has no .src or .url → returns ''
    expect(getImageUrl(media)).toBe('');
  });

  it('handles object with url being a wix:image URI (url is returned directly, not recursed)', () => {
    const media = { url: 'wix:image://v1/directurl.jpg/thumb.jpg#w=300' };
    // url property is returned as-is without recursive conversion
    expect(getImageUrl(media)).toBe('wix:image://v1/directurl.jpg/thumb.jpg#w=300');
  });

  it('handles object with boolean src (truthy, non-string, no properties)', () => {
    const media = { src: true };
    // true is truthy so getImageUrl is called recursively with true
    // true is not falsy, not a string, has no .src or .url → returns ''
    expect(getImageUrl(media)).toBe('');
  });

  // --- Type edge cases ---

  it('returns empty string for number input (0 is falsy)', () => {
    expect(getImageUrl(0)).toBe('');
  });

  it('returns empty string for truthy number input', () => {
    // Non-zero number: not falsy, not a string, no .src or .url → ''
    expect(getImageUrl(123)).toBe('');
  });

  it('returns empty string for boolean false', () => {
    expect(getImageUrl(false)).toBe('');
  });

  it('returns empty string for boolean true', () => {
    // true: not falsy, not a string, no .src or .url → ''
    expect(getImageUrl(true)).toBe('');
  });

  it('returns empty string for array input', () => {
    // Array has no .src or .url by default → ''
    expect(getImageUrl([1, 2, 3])).toBe('');
  });

  it('returns empty string for function input', () => {
    expect(getImageUrl(() => 'hello')).toBe('');
  });

  // --- HTTPS vs HTTP passthrough ---

  it('passes through HTTPS URLs unchanged', () => {
    const url = 'https://cdn.example.com/images/hero-banner.webp?w=1920';
    expect(getImageUrl(url)).toBe(url);
  });

  it('passes through HTTP URLs unchanged', () => {
    const url = 'http://legacy.example.com/old-image.gif';
    expect(getImageUrl(url)).toBe(url);
  });

  // --- Whitespace strings ---

  it('returns whitespace-only string as-is (non-empty, non-URL)', () => {
    expect(getImageUrl('   ')).toBe('   ');
  });

  it('returns tab/newline whitespace string as-is', () => {
    expect(getImageUrl('\t\n')).toBe('\t\n');
  });

  // --- Protocol-relative URLs ---

  it('returns protocol-relative URL as-is (does not start with http)', () => {
    const url = '//example.com/img.jpg';
    expect(getImageUrl(url)).toBe('//example.com/img.jpg');
  });

  // --- Data URIs ---

  it('returns data URI as-is (does not start with http)', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    expect(getImageUrl(dataUri)).toBe(dataUri);
  });

  it('returns data URI for SVG as-is', () => {
    const dataUri = 'data:image/svg+xml;charset=utf-8,<svg></svg>';
    expect(getImageUrl(dataUri)).toBe(dataUri);
  });
});
