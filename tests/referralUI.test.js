/**
 * Tests for referralUI.js — Referral program public UI
 * Covers: fetchReferralLink, buildShareUrls, copyToClipboard,
 *         formatStats, initReferralPage, initPostCheckoutReferralWidget,
 *         initReferralDashboard
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __setHandler } from './__mocks__/wix-fetch.js';
import {
  fetchReferralLink,
  buildShareUrls,
  copyToClipboard,
  formatStats,
  initReferralPage,
  initPostCheckoutReferralWidget,
  initReferralDashboard,
} from '../src/public/referralUI.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeElement(overrides = {}) {
  return {
    setText: vi.fn(),
    setAttributes: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
    ...overrides,
  };
}

function make$w(elements = {}) {
  return (selector) => elements[selector] ?? makeElement();
}

beforeEach(() => {
  __reset();
  vi.restoreAllMocks();
});

// ── fetchReferralLink ─────────────────────────────────────────────────

describe('fetchReferralLink', () => {
  it('returns referralCode, shareUrl, and stats on success', async () => {
    __setHandler(() => ({
      ok: true,
      async json() {
        return {
          referralCode: 'TESTCODE',
          shareUrl: 'https://carolinafutons.com/?ref=TESTCODE',
          stats: { totalReferrals: 2, pendingRewards: 0, earnedRewards: 50 },
        };
      },
    }));

    const result = await fetchReferralLink();
    expect(result.referralCode).toBe('TESTCODE');
    expect(result.shareUrl).toContain('TESTCODE');
    expect(result.stats.totalReferrals).toBe(2);
  });

  it('calls the generateReferralLink endpoint', async () => {
    const urls = [];
    __setHandler((url) => {
      urls.push(url);
      return { ok: true, async json() { return { referralCode: 'X', shareUrl: 'Y', stats: {} }; } };
    });

    await fetchReferralLink();
    expect(urls[0]).toContain('generateReferralLink');
  });

  it('throws on 401 (unauthenticated)', async () => {
    __setHandler(() => ({
      ok: false,
      status: 401,
      async json() { return { error: 'Authentication required' }; },
    }));

    await expect(fetchReferralLink()).rejects.toThrow();
  });

  it('throws on 500 (server error)', async () => {
    __setHandler(() => ({
      ok: false,
      status: 500,
      async json() { return { error: 'Internal server error' }; },
    }));

    await expect(fetchReferralLink()).rejects.toThrow();
  });

  it('throws on network failure', async () => {
    __setHandler(() => { throw new Error('Network error'); });
    await expect(fetchReferralLink()).rejects.toThrow('Network error');
  });
});

// ── buildShareUrls ────────────────────────────────────────────────────

describe('buildShareUrls', () => {
  const VALID_URL = 'https://carolinafutons.com/?ref=ABC123';

  it('returns Facebook share URL', () => {
    const urls = buildShareUrls(VALID_URL);
    expect(urls.facebook).toContain('facebook.com');
    expect(urls.facebook).toContain(encodeURIComponent(VALID_URL));
  });

  it('returns Twitter share URL', () => {
    const urls = buildShareUrls(VALID_URL);
    expect(urls.twitter).toMatch(/twitter\.com|x\.com/);
    expect(urls.twitter).toContain(encodeURIComponent(VALID_URL));
  });

  it('returns SMS share URL', () => {
    const urls = buildShareUrls(VALID_URL);
    expect(urls.sms).toContain('sms:');
    expect(urls.sms).toContain(encodeURIComponent(VALID_URL));
  });

  it('rejects non-allowlisted share URL (open redirect guard)', () => {
    const malicious = 'https://evil.com/redirect?to=carolinafutons.com';
    expect(() => buildShareUrls(malicious)).toThrow();
  });

  it('rejects http:// share URL (must be https)', () => {
    expect(() => buildShareUrls('http://carolinafutons.com/?ref=X')).toThrow();
  });

  it('rejects null/undefined shareUrl', () => {
    expect(() => buildShareUrls(null)).toThrow();
    expect(() => buildShareUrls(undefined)).toThrow();
  });

  it('rejects empty string shareUrl', () => {
    expect(() => buildShareUrls('')).toThrow();
  });
});

// ── copyToClipboard ───────────────────────────────────────────────────

describe('copyToClipboard', () => {
  it('calls navigator.clipboard.writeText with provided text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await copyToClipboard('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('returns true on success', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const result = await copyToClipboard('abc');
    expect(result).toBe(true);
  });

  it('returns false when clipboard API unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const result = await copyToClipboard('abc');
    expect(result).toBe(false);
  });

  it('returns false on clipboard write rejection', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) },
    });
    const result = await copyToClipboard('abc');
    expect(result).toBe(false);
  });
});

// ── formatStats ───────────────────────────────────────────────────────

describe('formatStats', () => {
  it('returns formatted strings for all stat fields', () => {
    const result = formatStats({ totalReferrals: 3, pendingRewards: 25, earnedRewards: 100 });
    expect(result.totalReferrals).toBe('3');
    expect(result.pendingRewards).toBe('$25');
    expect(result.earnedRewards).toBe('$100');
  });

  it('returns zeros for null stats', () => {
    const result = formatStats(null);
    expect(result.totalReferrals).toBe('0');
    expect(result.pendingRewards).toBe('$0');
    expect(result.earnedRewards).toBe('$0');
  });

  it('returns zeros for undefined stats', () => {
    const result = formatStats(undefined);
    expect(result.totalReferrals).toBe('0');
  });

  it('handles missing individual fields gracefully', () => {
    const result = formatStats({});
    expect(result.totalReferrals).toBe('0');
    expect(result.earnedRewards).toBe('$0');
  });

  it('formats fractional reward amounts', () => {
    const result = formatStats({ totalReferrals: 1, pendingRewards: 12.5, earnedRewards: 0 });
    expect(result.pendingRewards).toBe('$12.50');
  });
});

// ── initReferralPage ──────────────────────────────────────────────────

describe('initReferralPage', () => {
  it('populates link text element with shareUrl on success', async () => {
    __setHandler(() => ({
      ok: true,
      async json() {
        return {
          referralCode: 'CODE1',
          shareUrl: 'https://carolinafutons.com/?ref=CODE1',
          stats: { totalReferrals: 0, pendingRewards: 0, earnedRewards: 0 },
        };
      },
    }));

    const linkEl = makeElement();
    const $w = make$w({ '#referralLink': linkEl });
    await initReferralPage($w);
    expect(linkEl.setText).toHaveBeenCalledWith(expect.stringContaining('CODE1'));
  });

  it('hides the loading state after fetch completes', async () => {
    __setHandler(() => ({
      ok: true,
      async json() {
        return { referralCode: 'X', shareUrl: 'Y', stats: {} };
      },
    }));

    const loadingEl = makeElement();
    const $w = make$w({ '#loadingState': loadingEl });
    await initReferralPage($w);
    expect(loadingEl.hide).toHaveBeenCalled();
  });

  it('shows error state on fetch failure', async () => {
    __setHandler(() => { throw new Error('fetch failed'); });

    const errorEl = makeElement();
    const $w = make$w({ '#errorState': errorEl });
    await initReferralPage($w);
    expect(errorEl.show).toHaveBeenCalled();
  });
});

// ── initPostCheckoutReferralWidget ────────────────────────────────────

describe('initPostCheckoutReferralWidget', () => {
  it('shows widget after successful fetch', async () => {
    __setHandler(() => ({
      ok: true,
      async json() {
        return { referralCode: 'WGT1', shareUrl: 'https://carolinafutons.com/?ref=WGT1', stats: {} };
      },
    }));

    const widget = makeElement();
    const $w = make$w({ '#referralWidget': widget });
    await initPostCheckoutReferralWidget($w);
    expect(widget.show).toHaveBeenCalled();
  });

  it('hides widget silently when fetch fails (non-critical UI)', async () => {
    __setHandler(() => ({ ok: false, status: 401, async json() { return {}; } }));

    const widget = makeElement();
    const $w = make$w({ '#referralWidget': widget });
    await initPostCheckoutReferralWidget($w);
    expect(widget.show).not.toHaveBeenCalled();
  });
});

// ── initReferralDashboard ─────────────────────────────────────────────

describe('initReferralDashboard', () => {
  it('populates stats elements with formatted values', async () => {
    __setHandler(() => ({
      ok: true,
      async json() {
        return {
          referralCode: 'DASH1',
          shareUrl: 'https://carolinafutons.com/?ref=DASH1',
          stats: { totalReferrals: 5, pendingRewards: 50, earnedRewards: 150 },
        };
      },
    }));

    const totalEl = makeElement();
    const earnedEl = makeElement();
    const $w = make$w({ '#totalReferrals': totalEl, '#earnedRewards': earnedEl });
    await initReferralDashboard($w);
    expect(totalEl.setText).toHaveBeenCalledWith('5');
    expect(earnedEl.setText).toHaveBeenCalledWith('$150');
  });

  it('shows error state when fetch fails', async () => {
    __setHandler(() => { throw new Error('DB down'); });

    const errorEl = makeElement();
    const $w = make$w({ '#dashboardError': errorEl });
    await initReferralDashboard($w);
    expect(errorEl.show).toHaveBeenCalled();
  });
});
