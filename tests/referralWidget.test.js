/**
 * referralWidget.test.js
 * CF-ibn7 — ReferralWidget: referral link, count, and bonus status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initReferralWidget } from '../src/public/ReferralWidget.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    onClick: vi.fn(),
  };
}

function make$w() {
  const els = {
    '#referralLink':       makeEl(),
    '#referralCount':      makeEl(),
    '#referralBonusStatus': makeEl(),
    '#copyLinkBtn':        makeEl(),
    '#referralErrorMsg':   makeEl(),
  };
  return (id) => els[id] ?? makeEl();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-ref-1';
const REFERRAL_URL = 'https://www.carolinafutons.com/shop?ref=ABC123';

function makeStatus(completedReferrals = 0) {
  return { referralUrl: REFERRAL_URL, completedReferrals };
}

function makeOpts($w, status, copyToClipboard = vi.fn().mockResolvedValue(undefined)) {
  return {
    $w,
    getReferralStatus:  vi.fn().mockResolvedValue(status),
    copyToClipboard,
  };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('initReferralWidget — rendering', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('sets #referralLink text to referral URL', async () => {
    const opts = makeOpts($w, makeStatus(3));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralLink').text).toBe(REFERRAL_URL);
  });

  it('sets #referralCount text to "N friends referred"', async () => {
    const opts = makeOpts($w, makeStatus(3));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralCount').text).toBe('3 friends referred');
  });

  it('sets #referralCount text to "1 friend referred" for singular', async () => {
    const opts = makeOpts($w, makeStatus(1));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralCount').text).toBe('1 friend referred');
  });

  it('sets #referralCount to "0 friends referred" when none', async () => {
    const opts = makeOpts($w, makeStatus(0));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralCount').text).toBe('0 friends referred');
  });

  it('sets bonus status to "N x 500 pts earned" when referrals > 0', async () => {
    const opts = makeOpts($w, makeStatus(3));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralBonusStatus').text).toBe('3 x 500 pts earned');
  });

  it('sets bonus status to "Refer a friend to earn 500 pts!" when 0 referrals', async () => {
    const opts = makeOpts($w, makeStatus(0));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralBonusStatus').text).toBe('Refer a friend to earn 500 pts!');
  });

  it('passes memberId to getReferralStatus', async () => {
    const opts = makeOpts($w, makeStatus(0));
    await initReferralWidget('specific-member', opts);
    expect(opts.getReferralStatus).toHaveBeenCalledWith('specific-member');
  });
});

// ── Copy link button ──────────────────────────────────────────────────────────

describe('initReferralWidget — copy link button', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('wires #copyLinkBtn onClick', async () => {
    const opts = makeOpts($w, makeStatus(1));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#copyLinkBtn').onClick).toHaveBeenCalled();
  });

  it('clicking copy button calls copyToClipboard with referral URL', async () => {
    const copyFn = vi.fn().mockResolvedValue(undefined);
    const opts = makeOpts($w, makeStatus(2), copyFn);
    await initReferralWidget(MEMBER_ID, opts);
    const handler = $w('#copyLinkBtn').onClick.mock.calls[0][0];
    await handler();
    expect(copyFn).toHaveBeenCalledWith(REFERRAL_URL);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('initReferralWidget — error handling', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('does not throw when getReferralStatus rejects', async () => {
    const opts = makeOpts($w, null);
    opts.getReferralStatus.mockRejectedValue(new Error('Service down'));
    await expect(initReferralWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('shows #referralErrorMsg on getReferralStatus error', async () => {
    const opts = makeOpts($w, null);
    opts.getReferralStatus.mockRejectedValue(new Error('Service down'));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralErrorMsg').show).toHaveBeenCalled();
  });

  it('hides #referralLink on error', async () => {
    const opts = makeOpts($w, null);
    opts.getReferralStatus.mockRejectedValue(new Error('Service down'));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralLink').hide).toHaveBeenCalled();
  });

  it('hides #referralCount on error', async () => {
    const opts = makeOpts($w, null);
    opts.getReferralStatus.mockRejectedValue(new Error('Service down'));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralCount').hide).toHaveBeenCalled();
  });

  it('hides #copyLinkBtn on error', async () => {
    const opts = makeOpts($w, null);
    opts.getReferralStatus.mockRejectedValue(new Error('Service down'));
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#copyLinkBtn').hide).toHaveBeenCalled();
  });

  it('shows error state on non-throwing error response { error: "auth_required" }', async () => {
    const opts = makeOpts($w, { error: 'auth_required' });
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralErrorMsg').show).toHaveBeenCalled();
    expect($w('#referralLink').hide).toHaveBeenCalled();
    expect($w('#referralCount').hide).toHaveBeenCalled();
    expect($w('#referralBonusStatus').hide).toHaveBeenCalled();
    expect($w('#copyLinkBtn').hide).toHaveBeenCalled();
  });

  it('shows error state on { error: "forbidden" } response', async () => {
    const opts = makeOpts($w, { error: 'forbidden' });
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralErrorMsg').show).toHaveBeenCalled();
    expect($w('#referralLink').hide).toHaveBeenCalled();
  });

  it('does not destructure referralUrl from error response', async () => {
    const opts = makeOpts($w, { error: 'auth_required' });
    await initReferralWidget(MEMBER_ID, opts);
    expect($w('#referralLink').text).toBe('');
  });

  it('does not throw when backend returns {error} shape', async () => {
    const opts = makeOpts($w, { error: 'service_unavailable' });
    await expect(initReferralWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});
