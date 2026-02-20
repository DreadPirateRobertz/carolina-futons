import { describe, it, expect } from 'vitest';
import { getImageUrl } from '../src/backend/utils/mediaHelpers.js';

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
});
