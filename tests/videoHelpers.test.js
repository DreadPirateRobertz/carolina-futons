/**
 * @file videoHelpers.test.js
 * @description Tests for buildYouTubeEmbed — URL parsing, iframe generation, sanitization.
 */
import { describe, it, expect } from 'vitest';
import { buildYouTubeEmbed, extractYouTubeId } from '../src/public/videoHelpers.js';

// ── extractYouTubeId ──────────────────────────────────────────────────

describe('extractYouTubeId', () => {
  it('extracts ID from standard youtube.com/watch?v= URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from youtu.be short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from youtube.com/embed/ URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from URL with extra query params', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=abc123XYZ_9&t=30s&list=PL123')).toBe('abc123XYZ_9');
  });

  it('extracts ID from youtu.be short URL with query params', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for a playlist URL without a video ID', () => {
    expect(extractYouTubeId('https://www.youtube.com/playlist?list=PLabcdef')).toBeNull();
  });

  it('returns null for a non-YouTube URL', () => {
    expect(extractYouTubeId('https://vimeo.com/123456789')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractYouTubeId('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(extractYouTubeId(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(extractYouTubeId(undefined)).toBeNull();
  });

  it('returns null for a plain string with no URL structure', () => {
    expect(extractYouTubeId('not a url at all')).toBeNull();
  });
});

// ── buildYouTubeEmbed ─────────────────────────────────────────────────

describe('buildYouTubeEmbed — valid URLs', () => {
  it('returns an iframe string for a valid youtube.com URL', () => {
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(html).toContain('<iframe');
    expect(html).toContain('dQw4w9WgXcQ');
    expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('returns an iframe string for a youtu.be short URL', () => {
    const html = buildYouTubeEmbed('https://youtu.be/dQw4w9WgXcQ');
    expect(html).toContain('<iframe');
    expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('includes allow attribute for autoplay and fullscreen', () => {
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v=abc123VWXYZ');
    expect(html).toContain('allowfullscreen');
  });

  it('sets width and height attributes', () => {
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v=abc123VWXYZ');
    expect(html).toMatch(/width=/);
    expect(html).toMatch(/height=/);
  });

  it('sets title attribute for accessibility', () => {
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v=abc123VWXYZ');
    expect(html).toContain('title=');
  });

  it('uses https src (not http)', () => {
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v=abc123VWXYZ');
    expect(html).toContain('https://www.youtube.com/embed/');
    expect(html).not.toContain('http://');
  });

  it('uses nocookie domain when privacy option is set', () => {
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v=abc123VWXYZ', { privacyEnhanced: true });
    expect(html).toContain('youtube-nocookie.com/embed/');
  });

  it('appends enablejsapi=0 to embed URL by default', () => {
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v=abc123VWXYZ');
    expect(html).toContain('enablejsapi=0');
  });
});

describe('buildYouTubeEmbed — invalid / edge-case URLs', () => {
  it('returns null for a non-YouTube URL', () => {
    expect(buildYouTubeEmbed('https://vimeo.com/123456')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(buildYouTubeEmbed('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(buildYouTubeEmbed(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(buildYouTubeEmbed(undefined)).toBeNull();
  });

  it('returns null for a playlist-only URL (no video ID)', () => {
    expect(buildYouTubeEmbed('https://www.youtube.com/playlist?list=PLabc')).toBeNull();
  });
});

describe('buildYouTubeEmbed — XSS / injection sanitization', () => {
  it('does not include javascript: protocol in the output', () => {
    // Attacker might craft a URL that tricks the parser
    const html = buildYouTubeEmbed('javascript:alert(1)');
    expect(html).toBeNull();
  });

  it('encodes special characters in the video ID position', () => {
    // ID with special chars should not produce unescaped HTML
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v="><script>alert(1)</script>');
    // Should return null (invalid ID chars) or produce safe output
    if (html !== null) {
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('javascript:');
    }
  });

  it('does not allow data: URL schemes through', () => {
    expect(buildYouTubeEmbed('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('does not allow vbscript: scheme', () => {
    expect(buildYouTubeEmbed('vbscript:msgbox(1)')).toBeNull();
  });
});

describe('buildYouTubeEmbed — output structure', () => {
  it('returns a self-contained HTML string (no wrapping div required)', () => {
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v=abc123VWXYZ');
    expect(typeof html).toBe('string');
    expect(html.trim()).toMatch(/^<iframe/);
  });

  it('closes the iframe tag properly', () => {
    const html = buildYouTubeEmbed('https://www.youtube.com/watch?v=abc123VWXYZ');
    expect(html).toContain('</iframe>');
  });
});
