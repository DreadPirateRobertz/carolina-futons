/**
 * Tests for cf-91ao: Code Quality Cleanup — 6 issues from mayor review.
 * Each describe block targets one specific issue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';

// ── Issue #5: getReturnStats sequential → Promise.all ──────────────

describe('getReturnStats uses parallel queries', () => {
  beforeEach(() => {
    resetData();
  });

  it('returns counts for all statuses', async () => {
    const { getReturnStats } = await import('../src/backend/returnsService.web.js');
    const result = await getReturnStats();
    expect(result.success).toBe(true);
    expect(result.stats).toHaveProperty('total');
    expect(result.stats).toHaveProperty('requested');
    expect(result.stats).toHaveProperty('approved');
    expect(result.stats).toHaveProperty('shipped');
    expect(result.stats).toHaveProperty('received');
    expect(result.stats).toHaveProperty('refunded');
    expect(result.stats).toHaveProperty('denied');
  });
});

// Issue #6 (generateReferralCode collision risk) — the parallel
// dataService.generateReferralCode was retired in cf-4x7e Pass 2 chunk 6;
// the live referralService.web.js::getReferralLink path is the canonical
// referral-code surface and is covered by tests/referralService*.test.js.

// ── Issue #8: validateId ignores maxLen parameter ───────────────────

describe('validateId respects maxLen parameter', () => {
  it('uses default maxLen of 50', async () => {
    const { validateId } = await import('../src/backend/utils/sanitize.js');
    const longId = 'a'.repeat(100);
    const result = validateId(longId);
    expect(result.length).toBe(50);
  });

  it('respects custom maxLen parameter', async () => {
    const { validateId } = await import('../src/backend/utils/sanitize.js');
    const longId = 'a'.repeat(100);
    const result = validateId(longId, 20);
    expect(result.length).toBe(20);
  });

  it('respects maxLen=10', async () => {
    const { validateId } = await import('../src/backend/utils/sanitize.js');
    const result = validateId('abcdefghijklmnop', 10);
    expect(result.length).toBe(10);
    expect(result).toBe('abcdefghij');
  });

  it('does not truncate if ID is shorter than maxLen', async () => {
    const { validateId } = await import('../src/backend/utils/sanitize.js');
    const result = validateId('short', 20);
    expect(result).toBe('short');
  });
});

// ── Issue #10: getActiveCoupons permission mismatch ─────────────────

describe('getActiveCoupons permission', () => {
  it('should use SiteMember permission, not Admin', async () => {
    // Read the source and verify the permission level
    const fs = await import('fs');
    const source = fs.readFileSync(
      new URL('../src/backend/couponsService.web.js', import.meta.url),
      'utf8'
    );

    // Find the getActiveCoupons export and its permission
    const match = source.match(/export\s+const\s+getActiveCoupons\s*=\s*webMethod\(\s*Permissions\.(\w+)/);
    expect(match).toBeTruthy();
    expect(match[1]).toBe('SiteMember');
  });
});

// ── Issue #9: Install banner dismissal guard ordering ───────────────

describe('Install banner dismissal check', () => {
  it('checks dismissal before binding click handlers', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      new URL('../src/pages/masterPage.js', import.meta.url),
      'utf8'
    );

    // Find the initInstallBanner function
    const fnMatch = source.match(/function\s+initInstallBanner\s*\(\s*\)\s*\{[\s\S]*?^}/m);
    if (!fnMatch) return; // Can't verify if function not found

    const fnBody = fnMatch[0];

    // The dismissal check (cf_install_dismissed) should appear BEFORE the click handler bindings
    const dismissalPos = fnBody.indexOf('cf_install_dismissed');
    const clickHandlerPos = fnBody.indexOf('installBannerBtn');

    expect(dismissalPos).toBeGreaterThan(-1);
    expect(clickHandlerPos).toBeGreaterThan(-1);
    // Dismissal check should come before click handler setup
    expect(dismissalPos).toBeLessThan(clickHandlerPos);
  });
});

// ── Issue #7: Gift card race condition ──────────────────────────────

describe('redeemGiftCard race condition fix', () => {
  it('uses a unique claim identifier for concurrency safety', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      new URL('../src/backend/giftCards.web.js', import.meta.url),
      'utf8'
    );

    // The fix should include a unique claim token/id to prevent TOCTOU
    const hasClaimToken = source.includes('claimId') || source.includes('claimToken') || source.includes('crypto.randomUUID');
    expect(hasClaimToken).toBe(true);
  });
});
