/**
 * CF-rr8d: UGC Upload ClickFix Hardening Tests
 *
 * Verifies 5 security controls on the UGC photo upload pipeline:
 * 1. EXIF strip — Wix media URL validation ensures images go through Wix Media Manager
 * 2. UUID filenames — toUUIDFilename replaces user-supplied names with UUIDs
 * 3. Caption sanitization — stripUrlsFromCaption removes URLs/links from captions
 * 4. Deep link domain allowlist — validateDeepLinkRoute rejects unknown routes
 * 5. CSP guidance — documented; Wix platform controls CSP headers
 *
 * Reference: Dutch ClickFix patterns (CF-n2gh)
 */
import { describe, it, expect } from 'vitest';

import { isWixMediaUrl, generateUUIDFilename } from '../src/backend/utils/sanitize.js';
import {
  sanitizeGalleryFilename,
  stripUrlsFromCaption,
  validateDeepLinkRoute,
  toUUIDFilename,
} from '../src/backend/communityGalleryService.web.js';

// ── Check 1: EXIF Strip (Wix Media URL Validation) ─────────────────────

describe('CF-rr8d Check 1: isWixMediaUrl — EXIF strip via Wix Media Manager enforcement', () => {
  it('accepts wix:image:// protocol URLs', () => {
    expect(isWixMediaUrl('wix:image://v1/abc123/photo.jpg')).toBe(true);
  });

  it('accepts wix:video:// protocol URLs', () => {
    expect(isWixMediaUrl('wix:video://v1/abc123/clip.mp4')).toBe(true);
  });

  it('accepts static.wixstatic.com CDN URLs', () => {
    expect(isWixMediaUrl('https://static.wixstatic.com/media/abc123_photo.jpg')).toBe(true);
  });

  it('accepts *.wixmp.com user upload CDN URLs', () => {
    expect(isWixMediaUrl('https://images.wixmp.com/abc123_photo.jpg')).toBe(true);
  });

  it('rejects arbitrary https URLs', () => {
    expect(isWixMediaUrl('https://evil.com/malware.jpg')).toBe(false);
  });

  it('rejects http URLs', () => {
    expect(isWixMediaUrl('http://example.com/photo.jpg')).toBe(false);
  });

  it('rejects data: URIs (potential XSS vector)', () => {
    expect(isWixMediaUrl('data:image/svg+xml,<svg onload="alert(1)">')).toBe(false);
  });

  it('rejects javascript: URIs', () => {
    expect(isWixMediaUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isWixMediaUrl('')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isWixMediaUrl(null)).toBe(false);
    expect(isWixMediaUrl(undefined)).toBe(false);
    expect(isWixMediaUrl(123)).toBe(false);
  });

  it('rejects URL with wix domain as substring of another domain', () => {
    expect(isWixMediaUrl('https://notwixstatic.com/media/photo.jpg')).toBe(false);
  });
});

// ── Check 2: UUID Filenames ──────────────────────────────────────────────

describe('CF-rr8d Check 2: UUID filename generation', () => {
  describe('generateUUIDFilename', () => {
    it('generates a filename with UUID format and extension', () => {
      const name = generateUUIDFilename('png');
      expect(name).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/);
    });

    it('defaults to .jpg extension', () => {
      const name = generateUUIDFilename();
      expect(name).toMatch(/\.jpg$/);
    });

    it('strips special characters from extension', () => {
      const name = generateUUIDFilename('../../../etc');
      // Slashes and dots stripped, leaving 'etc'
      expect(name).toMatch(/\.etc$/);
    });

    it('handles null extension', () => {
      const name = generateUUIDFilename(null);
      expect(name).toMatch(/\.jpg$/);
    });
  });

  describe('toUUIDFilename', () => {
    it('replaces valid filename with UUID', () => {
      const result = toUUIDFilename('my-vacation-photo.jpg');
      expect(result.safe).toBe(true);
      expect(result.filename).not.toBe('my-vacation-photo.jpg');
      expect(result.filename).toMatch(/^[0-9a-f-]+\.jpg$/);
    });

    it('preserves file extension from original', () => {
      const result = toUUIDFilename('photo.png');
      expect(result.safe).toBe(true);
      expect(result.filename).toMatch(/\.png$/);
    });

    it('rejects filenames with path traversal', () => {
      const result = toUUIDFilename('../../etc/passwd');
      expect(result.safe).toBe(false);
    });

    it('rejects filenames with embedded URLs', () => {
      const result = toUUIDFilename('https://evil.com.jpg');
      expect(result.safe).toBe(false);
    });

    it('rejects non-image extensions', () => {
      const result = toUUIDFilename('payload.exe');
      expect(result.safe).toBe(false);
    });

    it('rejects empty filename', () => {
      const result = toUUIDFilename('');
      expect(result.safe).toBe(false);
    });

    it('generates unique UUIDs per call', () => {
      const r1 = toUUIDFilename('a.jpg');
      const r2 = toUUIDFilename('a.jpg');
      expect(r1.filename).not.toBe(r2.filename);
    });
  });
});

// ── Check 3: Caption Sanitization ────────────────────────────────────────

describe('CF-rr8d Check 3: stripUrlsFromCaption — caption sanitization', () => {
  it('strips https URLs', () => {
    expect(stripUrlsFromCaption('Check out https://evil.com/payload for more')).toBe('Check out for more');
  });

  it('strips http URLs', () => {
    expect(stripUrlsFromCaption('Visit http://malware.org now')).toBe('Visit now');
  });

  it('strips ftp URLs', () => {
    expect(stripUrlsFromCaption('Get it at ftp://files.evil.com/data')).toBe('Get it at');
  });

  it('strips bare domain patterns', () => {
    expect(stripUrlsFromCaption('Go to evil.com for prizes')).toBe('Go to for prizes');
  });

  it('strips email addresses', () => {
    expect(stripUrlsFromCaption('Contact phish@evil.com for details')).toBe('Contact for details');
  });

  it('strips multiple URL patterns', () => {
    const input = 'Visit https://a.com and http://b.org and evil.net';
    const result = stripUrlsFromCaption(input);
    expect(result).not.toContain('https://');
    expect(result).not.toContain('http://');
    expect(result).not.toContain('evil.net');
  });

  it('preserves normal caption text', () => {
    expect(stripUrlsFromCaption('Love this futon! Perfect for my dorm.')).toBe('Love this futon! Perfect for my dorm.');
  });

  it('truncates to 200 chars', () => {
    const long = 'A'.repeat(300);
    expect(stripUrlsFromCaption(long).length).toBe(200);
  });

  it('handles non-string input', () => {
    expect(stripUrlsFromCaption(null)).toBe('');
    expect(stripUrlsFromCaption(undefined)).toBe('');
    expect(stripUrlsFromCaption(123)).toBe('');
  });

  it('collapses whitespace from removed URLs', () => {
    const result = stripUrlsFromCaption('before   https://evil.com   after');
    expect(result).not.toMatch(/\s{2,}/);
  });
});

// ── Check 4: Deep Link Domain Allowlist ──────────────────────────────────

describe('CF-rr8d Check 4: validateDeepLinkRoute — domain allowlist', () => {
  it('accepts /gallery route', () => {
    const result = validateDeepLinkRoute('/gallery', { roomType: 'bedroom' });
    expect(result.valid).toBe(true);
    expect(result.route).toBe('/gallery');
  });

  it('accepts /gallery/photo route with id param', () => {
    const result = validateDeepLinkRoute('/gallery/photo', { id: 'abc123' });
    expect(result.valid).toBe(true);
  });

  it('accepts /product-page route with slug param', () => {
    const result = validateDeepLinkRoute('/product-page', { slug: 'futon-deluxe' });
    expect(result.valid).toBe(true);
  });

  it('rejects unknown routes', () => {
    const result = validateDeepLinkRoute('/admin/dashboard', {});
    expect(result.valid).toBe(false);
    expect(result.route).toBe('/gallery');
  });

  it('rejects disallowed param names on valid routes', () => {
    const result = validateDeepLinkRoute('/gallery', { admin: 'true', roomType: 'bedroom' });
    expect(result.valid).toBe(false);
  });

  it('rejects external URLs as routes', () => {
    const result = validateDeepLinkRoute('https://evil.com', {});
    expect(result.valid).toBe(false);
  });

  it('sanitizes param values', () => {
    const result = validateDeepLinkRoute('/gallery', { roomType: '<script>alert(1)</script>' });
    expect(result.valid).toBe(true);
    expect(result.params.roomType).not.toContain('<script>');
  });

  it('handles non-string route', () => {
    const result = validateDeepLinkRoute(null, {});
    expect(result.valid).toBe(false);
  });

  it('returns safe fallback on rejection', () => {
    const result = validateDeepLinkRoute('/evil', { payload: 'xss' });
    expect(result.route).toBe('/gallery');
    expect(result.params).toEqual({});
  });
});

// ── Check 5: CSP (Content-Security-Policy) ──────────────────────────────

describe('CF-rr8d Check 5: CSP documentation', () => {
  // CSP headers on Wix-hosted sites are controlled by the Wix platform, not Velo code.
  // This test documents the security posture and expected behavior.

  it('Wix Media Manager URLs follow a known CDN pattern', () => {
    // UGC images served through Wix CDN are covered by Wix's default CSP.
    // The isWixMediaUrl check ensures we never store non-Wix URLs that would
    // violate CSP img-src directives.
    expect(isWixMediaUrl('https://static.wixstatic.com/media/test.jpg')).toBe(true);
    expect(isWixMediaUrl('https://evil.com/photo.jpg')).toBe(false);
  });

  it('external URLs blocked at storage time prevent CSP violations at render time', () => {
    // By rejecting non-Wix URLs in submitUGCPhoto and submitPhotoReview,
    // we guarantee that img src values in the gallery will always be Wix CDN URLs,
    // which are included in Wix's default CSP img-src directive.
    const externalUrls = [
      'https://attacker.com/track.gif',
      'data:image/svg+xml,<svg onload="alert(1)">',
      'javascript:alert(document.cookie)',
    ];
    for (const url of externalUrls) {
      expect(isWixMediaUrl(url)).toBe(false);
    }
  });
});

// ── Filename sanitization (existing function coverage) ───────────────────

describe('CF-rr8d: sanitizeGalleryFilename hardening', () => {
  it('accepts valid image filenames', () => {
    expect(sanitizeGalleryFilename('photo.jpg')).toEqual({ safe: true, filename: 'photo.jpg' });
    expect(sanitizeGalleryFilename('my-room.png')).toEqual({ safe: true, filename: 'my-room.png' });
    expect(sanitizeGalleryFilename('IMG_1234.webp')).toEqual({ safe: true, filename: 'IMG_1234.webp' });
  });

  it('rejects path traversal attempts', () => {
    expect(sanitizeGalleryFilename('../../etc/passwd')).toEqual({ safe: false, filename: '' });
    expect(sanitizeGalleryFilename('..\\..\\windows\\system32')).toEqual({ safe: false, filename: '' });
  });

  it('rejects URLs embedded in filenames', () => {
    expect(sanitizeGalleryFilename('https://evil.com/payload.jpg')).toEqual({ safe: false, filename: '' });
  });

  it('rejects non-image extensions', () => {
    expect(sanitizeGalleryFilename('malware.exe')).toEqual({ safe: false, filename: '' });
    expect(sanitizeGalleryFilename('script.js')).toEqual({ safe: false, filename: '' });
    expect(sanitizeGalleryFilename('page.html')).toEqual({ safe: false, filename: '' });
  });

  it('rejects filenames with multiple dots', () => {
    expect(sanitizeGalleryFilename('file.name.jpg')).toEqual({ safe: false, filename: '' });
  });

  it('rejects hidden files (leading dot)', () => {
    expect(sanitizeGalleryFilename('.htaccess')).toEqual({ safe: false, filename: '' });
  });

  it('rejects empty and non-string input', () => {
    expect(sanitizeGalleryFilename('')).toEqual({ safe: false, filename: '' });
    expect(sanitizeGalleryFilename(null)).toEqual({ safe: false, filename: '' });
    expect(sanitizeGalleryFilename(undefined)).toEqual({ safe: false, filename: '' });
  });
});
