import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildAffiliateUrl,
  getSocialShareUrls,
  formatCurrency,
  formatPercentage,
  getTierInfo,
  copyToClipboard,
  initAffiliateDashboard,
  initAffiliateLinkItem,
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

  it('elite tier has gold color', () => {
    const info = getTierInfo('elite', 0, 0);
    expect(info.color).toBe('#C9A848');
  });

  it('pro nextRequirement mentions $2,000', () => {
    const info = getTierInfo('pro', 0, 0);
    expect(info.nextRequirement).toContain('$2,000');
  });

  it('starter nextRequirement mentions 20 conversions', () => {
    const info = getTierInfo('starter', 0, 0);
    expect(info.nextRequirement).toContain('20 conversions');
  });

  it('elite nextRequirement is null', () => {
    const info = getTierInfo('elite', 0, 0);
    expect(info.nextRequirement).toBeNull();
  });

  it('handles zero revenue and conversions for starter', () => {
    const info = getTierInfo('starter', 0, 0);
    expect(info.salesProgress).toBe(0);
    expect(info.conversionProgress).toBe(0);
  });
});

// ── copyToClipboard ─────────────────────────────────────────────────

describe('copyToClipboard', () => {
  let savedNavigator;
  let savedDocument;

  beforeEach(() => {
    savedNavigator = globalThis.navigator;
    savedDocument = globalThis.document;
  });

  afterEach(() => {
    if (savedNavigator === undefined) delete globalThis.navigator;
    else Object.defineProperty(globalThis, 'navigator', { value: savedNavigator, writable: true, configurable: true });
    if (savedDocument === undefined) delete globalThis.document;
    else Object.defineProperty(globalThis, 'document', { value: savedDocument, writable: true, configurable: true });
    vi.restoreAllMocks();
  });

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } }, writable: true, configurable: true,
    });
    const result = await copyToClipboard('test text');
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('test text');
  });

  it('falls back to textarea + execCommand when clipboard API unavailable', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {}, writable: true, configurable: true,
    });
    const mockTextarea = { value: '', style: {}, select: vi.fn() };
    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: vi.fn(() => mockTextarea),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        execCommand: vi.fn(() => true),
      },
      writable: true, configurable: true,
    });

    const result = await copyToClipboard('fallback text');
    expect(result).toBe(true);
    expect(globalThis.document.createElement).toHaveBeenCalledWith('textarea');
    expect(mockTextarea.value).toBe('fallback text');
    expect(mockTextarea.select).toHaveBeenCalled();
    expect(globalThis.document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('returns false when execCommand returns false', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {}, writable: true, configurable: true,
    });
    const mockTextarea = { value: '', style: {}, select: vi.fn() };
    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: vi.fn(() => mockTextarea),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        execCommand: vi.fn(() => false),
      },
      writable: true, configurable: true,
    });

    const result = await copyToClipboard('text');
    expect(result).toBe(false);
  });

  it('returns false when clipboard.writeText throws', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } },
      writable: true, configurable: true,
    });
    const result = await copyToClipboard('text');
    expect(result).toBe(false);
  });

  it('positions fallback textarea offscreen', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {}, writable: true, configurable: true,
    });
    const mockTextarea = { value: '', style: {}, select: vi.fn() };
    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: vi.fn(() => mockTextarea),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        execCommand: vi.fn(() => true),
      },
      writable: true, configurable: true,
    });

    await copyToClipboard('text');
    expect(mockTextarea.style.position).toBe('fixed');
    expect(mockTextarea.style.left).toBe('-9999px');
  });
});

// ── initAffiliateDashboard ──────────────────────────────────────────

describe('initAffiliateDashboard', () => {
  function mock$w() {
    const elements = {};
    const $w = (selector) => {
      if (!elements[selector]) {
        elements[selector] = { id: selector, text: '', style: {}, collapse: vi.fn() };
      }
      return elements[selector];
    };
    $w._elements = elements;
    return $w;
  }

  it('returns early for null dashboardData', () => {
    const $w = mock$w();
    expect(() => initAffiliateDashboard($w, null)).not.toThrow();
  });

  it('returns early for dashboardData without dashboard property', () => {
    const $w = mock$w();
    expect(() => initAffiliateDashboard($w, {})).not.toThrow();
  });

  it('sets summary card values from dashboard data', () => {
    const $w = mock$w();
    const dashboardData = {
      dashboard: {
        totalEarned: 1234.56,
        availableBalance: 500,
        totalClicks: 100,
        totalConversions: 15,
        conversionRate: 15,
        commissionRate: 8,
        pendingCommissions: 200,
        tier: 'pro',
        totalRevenue: 3000,
      },
    };
    initAffiliateDashboard($w, dashboardData);
    expect($w._elements['#affiliateEarnings'].text).toBe('$1,234.56');
    expect($w._elements['#affiliateBalance'].text).toBe('$500.00');
    expect($w._elements['#affiliateClicks'].text).toBe('100');
    expect($w._elements['#affiliateConversions'].text).toBe('15');
    expect($w._elements['#affiliateRate'].text).toBe('15%');
    expect($w._elements['#affiliateCommissionRate'].text).toBe('8%');
    expect($w._elements['#affiliatePending'].text).toBe('$200.00');
  });

  it('sets tier label and badge color', () => {
    const $w = mock$w();
    const dashboardData = {
      dashboard: {
        totalEarned: 0, availableBalance: 0, totalClicks: 0,
        totalConversions: 0, conversionRate: 0, commissionRate: 5,
        pendingCommissions: 0, tier: 'starter', totalRevenue: 0,
      },
    };
    initAffiliateDashboard($w, dashboardData);
    expect($w._elements['#affiliateTierLabel'].text).toBe('Starter');
  });

  it('shows next tier info for non-elite tiers', () => {
    const $w = mock$w();
    const dashboardData = {
      dashboard: {
        totalEarned: 0, availableBalance: 0, totalClicks: 0,
        totalConversions: 0, conversionRate: 0, commissionRate: 5,
        pendingCommissions: 0, tier: 'starter', totalRevenue: 0,
      },
    };
    initAffiliateDashboard($w, dashboardData);
    expect($w._elements['#affiliateNextTier'].text).toContain('Next: Pro');
  });

  it('collapses tier progress for elite tier', () => {
    const $w = mock$w();
    const dashboardData = {
      dashboard: {
        totalEarned: 5000, availableBalance: 2000, totalClicks: 500,
        totalConversions: 100, conversionRate: 20, commissionRate: 12,
        pendingCommissions: 0, tier: 'elite', totalRevenue: 50000,
      },
    };
    initAffiliateDashboard($w, dashboardData);
    expect($w._elements['#affiliateTierProgress'].collapse).toHaveBeenCalled();
  });

  it('handles $w throwing for a selector gracefully', () => {
    let callCount = 0;
    const $w = (selector) => {
      callCount++;
      if (selector === '#affiliateEarnings') throw new Error('element not found');
      return { id: selector, text: '', style: {}, collapse: vi.fn() };
    };
    const dashboardData = {
      dashboard: {
        totalEarned: 100, availableBalance: 0, totalClicks: 0,
        totalConversions: 0, conversionRate: 0, commissionRate: 5,
        pendingCommissions: 0, tier: 'starter', totalRevenue: 0,
      },
    };
    // Should not throw — error is caught internally
    expect(() => initAffiliateDashboard($w, dashboardData)).not.toThrow();
  });
});

// ── initAffiliateLinkItem ───────────────────────────────────────────

describe('initAffiliateLinkItem', () => {
  function mock$item() {
    const elements = {};
    const $item = (selector) => {
      if (!elements[selector]) {
        elements[selector] = {
          id: selector, text: '', style: {},
          onClick: vi.fn(), src: '', alt: '',
        };
      }
      return elements[selector];
    };
    $item._elements = elements;
    return $item;
  }

  it('sets link URL, clicks, conversions, and revenue', () => {
    const $w = vi.fn();
    const $item = mock$item();
    const linkData = {
      linkCode: 'CODE001',
      productId: 'prod-1',
      clicks: 42,
      conversions: 5,
      revenue: 2500,
    };
    initAffiliateLinkItem($w, $item, linkData);
    expect($item._elements['#linkUrl'].text).toContain('carolinafutons.com');
    expect($item._elements['#linkUrl'].text).toContain('ref=CODE001');
    expect($item._elements['#linkClicks'].text).toBe('42');
    expect($item._elements['#linkConversions'].text).toBe('5');
    expect($item._elements['#linkRevenue'].text).toBe('$2,500.00');
  });

  it('registers copy button onClick handler', () => {
    const $w = vi.fn();
    const $item = mock$item();
    const linkData = { linkCode: 'CODE001', clicks: 0, conversions: 0, revenue: 0 };
    initAffiliateLinkItem($w, $item, linkData);
    expect($item._elements['#copyLinkBtn'].onClick).toHaveBeenCalled();
  });

  it('registers social share button handlers', () => {
    const $w = vi.fn();
    const $item = mock$item();
    const linkData = { linkCode: 'CODE001', clicks: 0, conversions: 0, revenue: 0 };
    initAffiliateLinkItem($w, $item, linkData);
    expect($item._elements['#shareFacebook'].onClick).toHaveBeenCalled();
    expect($item._elements['#shareTwitter'].onClick).toHaveBeenCalled();
    expect($item._elements['#sharePinterest'].onClick).toHaveBeenCalled();
    expect($item._elements['#shareEmail'].onClick).toHaveBeenCalled();
  });

  it('builds store URL when productId is _store', () => {
    const $w = vi.fn();
    const $item = mock$item();
    const linkData = { linkCode: 'CODE001', productId: '_store', clicks: 0, conversions: 0, revenue: 0 };
    initAffiliateLinkItem($w, $item, linkData);
    expect($item._elements['#linkUrl'].text).toBe('https://www.carolinafutons.com?ref=CODE001');
  });

  it('handles missing element gracefully (no id)', () => {
    const $item = (selector) => {
      if (selector === '#copyLinkBtn') return { /* no id */ };
      return { id: selector, text: '', style: {}, onClick: vi.fn() };
    };
    const linkData = { linkCode: 'CODE001', clicks: 0, conversions: 0, revenue: 0 };
    expect(() => initAffiliateLinkItem(vi.fn(), $item, linkData)).not.toThrow();
  });

  it('handles $item throwing for social buttons', () => {
    const $item = (selector) => {
      if (selector.startsWith('#share')) throw new Error('not found');
      return { id: selector, text: '', style: {}, onClick: vi.fn() };
    };
    const linkData = { linkCode: 'CODE001', clicks: 0, conversions: 0, revenue: 0 };
    expect(() => initAffiliateLinkItem(vi.fn(), $item, linkData)).not.toThrow();
  });
});
