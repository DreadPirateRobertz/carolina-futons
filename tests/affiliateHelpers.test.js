import { describe, it, expect } from 'vitest';
import {
  buildAffiliateUrl,
  getSocialShareUrls,
  formatCurrency,
  formatPercentage,
  getTierInfo,
} from '../src/public/affiliateHelpers.js';

// ── buildAffiliateUrl ───────────────────────────────────────────────

describe('buildAffiliateUrl', () => {
  it('builds product-specific affiliate URL', () => {
    const url = buildAffiliateUrl('CODE000001', 'product-123');
    expect(url).toBe('https://www.carolinafutons.com/product/product-123?ref=CODE000001');
  });

  it('builds general store URL for _store productId', () => {
    const url = buildAffiliateUrl('CODE000001', '_store');
    expect(url).toBe('https://www.carolinafutons.com?ref=CODE000001');
  });

  it('builds general store URL when no productId', () => {
    const url = buildAffiliateUrl('CODE000001');
    expect(url).toBe('https://www.carolinafutons.com?ref=CODE000001');
  });

  it('returns empty string for missing link code', () => {
    expect(buildAffiliateUrl('')).toBe('');
    expect(buildAffiliateUrl(null)).toBe('');
    expect(buildAffiliateUrl(undefined)).toBe('');
  });
});

// ── getSocialShareUrls ──────────────────────────────────────────────

describe('getSocialShareUrls', () => {
  const testUrl = 'https://www.carolinafutons.com?ref=CODE000001';

  it('returns URLs for all social platforms', () => {
    const urls = getSocialShareUrls(testUrl);
    expect(urls.facebook).toContain('facebook.com/sharer');
    expect(urls.twitter).toContain('twitter.com/intent/tweet');
    expect(urls.pinterest).toContain('pinterest.com/pin/create');
    expect(urls.email).toContain('mailto:');
  });

  it('includes encoded affiliate URL in share links', () => {
    const urls = getSocialShareUrls(testUrl);
    const encodedUrl = encodeURIComponent(testUrl);
    expect(urls.facebook).toContain(encodedUrl);
    expect(urls.twitter).toContain(encodedUrl);
    expect(urls.pinterest).toContain(encodedUrl);
    expect(urls.email).toContain(encodedUrl);
  });

  it('uses custom message when provided', () => {
    const urls = getSocialShareUrls(testUrl, 'My custom message');
    const encodedMsg = encodeURIComponent('My custom message');
    expect(urls.twitter).toContain(encodedMsg);
  });

  it('uses default message when no message provided', () => {
    const urls = getSocialShareUrls(testUrl);
    expect(urls.twitter).toContain('Carolina%20Futons');
  });
});

// ── formatCurrency ──────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats whole dollar amounts', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });

  it('formats amounts with cents', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('adds thousand separators', () => {
    expect(formatCurrency(10000)).toBe('$10,000.00');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles NaN and invalid input', () => {
    expect(formatCurrency(NaN)).toBe('$0.00');
    expect(formatCurrency(undefined)).toBe('$0.00');
    expect(formatCurrency('not a number')).toBe('$0.00');
  });
});

// ── formatPercentage ────────────────────────────────────────────────

describe('formatPercentage', () => {
  it('formats percentage values', () => {
    expect(formatPercentage(8)).toBe('8%');
    expect(formatPercentage(12.5)).toBe('12.5%');
  });

  it('handles zero', () => {
    expect(formatPercentage(0)).toBe('0%');
  });

  it('handles NaN and invalid input', () => {
    expect(formatPercentage(NaN)).toBe('0%');
    expect(formatPercentage(undefined)).toBe('0%');
  });
});

// ── getTierInfo ─────────────────────────────────────────────────────

describe('getTierInfo', () => {
  it('returns starter tier info with progress', () => {
    const info = getTierInfo('starter', 250, 10);
    expect(info.label).toBe('Starter');
    expect(info.rate).toBe(5);
    expect(info.nextTier).toBe('Pro');
    expect(info.salesProgress).toBe(50); // 250/500 * 100
    expect(info.conversionProgress).toBe(50); // 10/20 * 100
  });

  it('returns pro tier info with progress', () => {
    const info = getTierInfo('pro', 1000, 30);
    expect(info.label).toBe('Pro');
    expect(info.rate).toBe(8);
    expect(info.nextTier).toBe('Elite');
    expect(info.salesProgress).toBe(50); // 1000/2000 * 100
    expect(info.conversionProgress).toBe(60); // 30/50 * 100
  });

  it('returns elite tier info with no next tier', () => {
    const info = getTierInfo('elite', 5000, 100);
    expect(info.label).toBe('Elite');
    expect(info.rate).toBe(12);
    expect(info.nextTier).toBeNull();
    expect(info.salesProgress).toBe(100);
    expect(info.conversionProgress).toBe(100);
  });

  it('caps progress at 100%', () => {
    const info = getTierInfo('starter', 1000, 50);
    expect(info.salesProgress).toBe(100);
    expect(info.conversionProgress).toBe(100);
  });

  it('defaults to starter for invalid tier', () => {
    const info = getTierInfo('invalid', 0, 0);
    expect(info.label).toBe('Starter');
    expect(info.rate).toBe(5);
  });
});
