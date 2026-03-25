/**
 * @file postPurchaseRewardPrompt.test.js
 * @description Tests for CF-fawn: PostPurchaseRewardPrompt — referral + points
 * combo prompt on Thank You page.
 *
 * Covers:
 *  - Points earned text shown correctly
 *  - Referral link and CTA shown
 *  - Copy button copies referral URL
 *  - Non-member graceful degradation (section stays collapsed)
 *  - Backend error graceful degradation
 *  - Zero-point purchase still shows referral
 *  - Section expanded on success
 *
 * CF-fawn
 */
import { describe, it, expect, vi } from 'vitest';
import {
  initPostPurchaseRewardPrompt,
} from '../src/public/PostPurchaseRewardPrompt.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    label: '',
    _visible: true,
    _onClick: null,
    show:     vi.fn(function () { this._visible = true; }),
    hide:     vi.fn(function () { this._visible = false; }),
    expand:   vi.fn(function () { this._visible = true; }),
    collapse: vi.fn(function () { this._visible = false; }),
    onClick:  vi.fn(function (cb) { this._onClick = cb; }),
  };
}

function make$w() {
  const els = {
    '#rewardPromptSection': makeEl(),
    '#rewardPointsText':    makeEl(),
    '#rewardReferralText':  makeEl(),
    '#rewardReferralLink':  makeEl(),
    '#rewardCopyBtn':       makeEl(),
  };
  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSummary(overrides = {}) {
  return {
    pointsEarned: 1798,
    referralUrl: 'https://www.carolinafutons.com/shop?ref=ABC123',
    referralCode: 'ABC123',
    referralBonusPoints: 500,
    ...overrides,
  };
}

function makeOpts($w, summary) {
  return {
    $w,
    getPostPurchaseRewardSummary: vi.fn().mockResolvedValue(summary),
    copyToClipboard: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Points display ───────────────────────────────────────────────────────────

describe('PostPurchaseRewardPrompt — points display', () => {
  it('shows points earned text', async () => {
    const $w = make$w();
    await initPostPurchaseRewardPrompt(899, makeOpts($w, makeSummary({ pointsEarned: 1798 })));
    expect($w._els['#rewardPointsText'].text).toContain('1798 points');
  });

  it('shows zero points gracefully', async () => {
    const $w = make$w();
    await initPostPurchaseRewardPrompt(0, makeOpts($w, makeSummary({ pointsEarned: 0 })));
    expect($w._els['#rewardPointsText'].text).toBe('');
  });
});

// ── Referral CTA ─────────────────────────────────────────────────────────────

describe('PostPurchaseRewardPrompt — referral CTA', () => {
  it('shows referral link', async () => {
    const $w = make$w();
    await initPostPurchaseRewardPrompt(899, makeOpts($w, makeSummary()));
    expect($w._els['#rewardReferralLink'].text).toBe('https://www.carolinafutons.com/shop?ref=ABC123');
  });

  it('shows referral bonus text', async () => {
    const $w = make$w();
    await initPostPurchaseRewardPrompt(899, makeOpts($w, makeSummary()));
    expect($w._els['#rewardReferralText'].text).toContain('500 bonus points');
  });

  it('wires copy button', async () => {
    const $w = make$w();
    await initPostPurchaseRewardPrompt(899, makeOpts($w, makeSummary()));
    expect($w._els['#rewardCopyBtn'].onClick).toHaveBeenCalled();
  });

  it('copy button calls copyToClipboard with referral URL', async () => {
    const $w = make$w();
    const copyFn = vi.fn().mockResolvedValue(undefined);
    const opts = makeOpts($w, makeSummary());
    opts.copyToClipboard = copyFn;
    await initPostPurchaseRewardPrompt(899, opts);

    const handler = $w._els['#rewardCopyBtn']._onClick;
    await handler();
    expect(copyFn).toHaveBeenCalledWith('https://www.carolinafutons.com/shop?ref=ABC123');
  });

  it('passes orderTotal to backend', async () => {
    const $w = make$w();
    const opts = makeOpts($w, makeSummary());
    await initPostPurchaseRewardPrompt(1299, opts);
    expect(opts.getPostPurchaseRewardSummary).toHaveBeenCalledWith(1299);
  });
});

// ── Section visibility ───────────────────────────────────────────────────────

describe('PostPurchaseRewardPrompt — section visibility', () => {
  it('expands section on successful load', async () => {
    const $w = make$w();
    await initPostPurchaseRewardPrompt(899, makeOpts($w, makeSummary()));
    expect($w._els['#rewardPromptSection'].expand).toHaveBeenCalled();
  });

  it('collapses section initially', async () => {
    const $w = make$w();
    await initPostPurchaseRewardPrompt(899, makeOpts($w, makeSummary()));
    expect($w._els['#rewardPromptSection'].collapse).toHaveBeenCalled();
  });
});

// ── Graceful degradation ─────────────────────────────────────────────────────

describe('PostPurchaseRewardPrompt — graceful degradation', () => {
  it('does not expand section for non-members (null summary)', async () => {
    const $w = make$w();
    await initPostPurchaseRewardPrompt(899, makeOpts($w, null));
    expect($w._els['#rewardPromptSection'].expand).not.toHaveBeenCalled();
  });

  it('does not expand section on backend rejection', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getPostPurchaseRewardSummary: vi.fn().mockRejectedValue(new Error('fail')),
      copyToClipboard: vi.fn(),
    };
    await initPostPurchaseRewardPrompt(899, opts);
    expect($w._els['#rewardPromptSection'].expand).not.toHaveBeenCalled();
  });

  it('does not throw on backend rejection', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getPostPurchaseRewardSummary: vi.fn().mockRejectedValue(new Error('fail')),
      copyToClipboard: vi.fn(),
    };
    await expect(initPostPurchaseRewardPrompt(899, opts)).resolves.not.toThrow();
  });
});
