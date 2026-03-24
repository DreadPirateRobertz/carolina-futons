/**
 * postPurchaseReveal.test.js
 * CF-wndq — post-purchase gamification reveal + share CTA on Thank You Page
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initPostPurchaseReveal } from '../src/public/PostPurchaseReveal.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    value: 0,
    _visible: true,
    _expanded: false,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    expand: vi.fn(function () { this._expanded = true; }),
    collapse: vi.fn(function () { this._expanded = false; }),
    onClick: vi.fn(),
    accessibility: {},
    style: {},
  };
}

function make$w() {
  const els = {
    '#postPurchaseReveal': makeEl(),
    '#revealPointsText': makeEl(),
    '#revealTierBar': makeEl(),
    '#revealTierText': makeEl(),
    '#revealRankText': makeEl(),
    '#revealShareBtn': makeEl(),
    '#revealJoinCta': makeEl(),
  };
  return (id) => els[id] ?? makeEl();
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MEMBER_ACCOUNT = {
  points: 450,
  tier: 'Trail Blazer',
  tierDiscount: 5,
  nextTier: 'Mountain Guide',
  pointsToNext: 50,
  progress: 90,
};

const MAX_TIER_ACCOUNT = {
  points: 2500,
  tier: 'Summit Legend',
  tierDiscount: 20,
  nextTier: null,
  pointsToNext: 0,
  progress: 100,
};

const LEADERBOARD_WITH_RANK = { leaderboard: [], myRank: 8, zipPrefix: '287' };
const LEADERBOARD_NO_RANK = { leaderboard: [], myRank: null, zipPrefix: '287' };

// ── Non-member / guest state ──────────────────────────────────────────────────

describe('initPostPurchaseReveal — non-member (getLoyaltyAccount throws)', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockRejectedValue(new Error('Permissions error'));
  const getLeaderboard = vi.fn().mockResolvedValue(LEADERBOARD_NO_RANK);

  beforeEach(() => { $w = make$w(); });

  it('expands the reveal section', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 300, getLoyaltyAccount, getLeaderboard });
    expect($w('#postPurchaseReveal').expand).toHaveBeenCalled();
  });

  it('shows join CTA with estimated points', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 300, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealJoinCta').show).toHaveBeenCalled();
    expect($w('#revealJoinCta').text).toBe('Join rewards to earn 600 pts — sign up free');
  });

  it('hides all member-only elements', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 300, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealPointsText').hide).toHaveBeenCalled();
    expect($w('#revealTierBar').hide).toHaveBeenCalled();
    expect($w('#revealTierText').hide).toHaveBeenCalled();
    expect($w('#revealRankText').hide).toHaveBeenCalled();
    expect($w('#revealShareBtn').hide).toHaveBeenCalled();
  });

  it('rounds fractional order total in join CTA', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 149.99, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealJoinCta').text).toBe('Join rewards to earn 300 pts — sign up free');
  });
});

// ── Member state — with next tier, no leaderboard rank ────────────────────────

describe('initPostPurchaseReveal — member, no leaderboard rank', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(MEMBER_ACCOUNT);
  const getLeaderboard = vi.fn().mockResolvedValue(LEADERBOARD_NO_RANK);

  beforeEach(() => { $w = make$w(); });

  it('expands the reveal section', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#postPurchaseReveal').expand).toHaveBeenCalled();
  });

  it('hides join CTA', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealJoinCta').hide).toHaveBeenCalled();
  });

  it('shows points text with order preview (2 pts per $1)', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealPointsText').show).toHaveBeenCalled();
    expect($w('#revealPointsText').text).toBe("You're earning 400 pts on this order!");
  });

  it('sets tier bar to loyalty account progress', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealTierBar').value).toBe(90);
  });

  it('shows tier text with tier name and points-to-next', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealTierText').show).toHaveBeenCalled();
    expect($w('#revealTierText').text).toBe('Trail Blazer · 50 pts to Mountain Guide');
  });

  it('hides rank text when myRank is null', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealRankText').hide).toHaveBeenCalled();
  });

  it('shows share button with generic text', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealShareBtn').show).toHaveBeenCalled();
    expect($w('#revealShareBtn').text).toBe('Share your milestone');
  });

  it('wires onClick handler on share button', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealShareBtn').onClick).toHaveBeenCalled();
  });
});

// ── Member state — with leaderboard rank ──────────────────────────────────────

describe('initPostPurchaseReveal — member with leaderboard rank', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(MEMBER_ACCOUNT);
  const getLeaderboard = vi.fn().mockResolvedValue(LEADERBOARD_WITH_RANK);

  beforeEach(() => { $w = make$w(); });

  it('shows rank text with rank and zip prefix', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealRankText').show).toHaveBeenCalled();
    expect($w('#revealRankText').text).toBe("You're #8 in the 287XX area");
  });

  it('shows share button with rank-specific text', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealShareBtn').text).toBe("Share your #8 ranking");
  });

  it('wires onClick handler on share button', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 200, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealShareBtn').onClick).toHaveBeenCalled();
  });
});

// ── Member state — at max tier ────────────────────────────────────────────────

describe('initPostPurchaseReveal — member at max tier', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(MAX_TIER_ACCOUNT);
  const getLeaderboard = vi.fn().mockResolvedValue(LEADERBOARD_NO_RANK);

  beforeEach(() => { $w = make$w(); });

  it('sets tier bar to 100', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 100, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealTierBar').value).toBe(100);
  });

  it('shows tier text without upsell at max tier', async () => {
    await initPostPurchaseReveal($w, { orderTotal: 100, getLoyaltyAccount, getLeaderboard });
    expect($w('#revealTierText').text).toBe('Summit Legend — top tier!');
  });
});

// ── Error resilience ──────────────────────────────────────────────────────────

describe('initPostPurchaseReveal — error resilience', () => {
  it('still shows member reveal when getLeaderboard throws', async () => {
    const $w = make$w();
    const getLoyaltyAccount = vi.fn().mockResolvedValue(MEMBER_ACCOUNT);
    const getLeaderboard = vi.fn().mockRejectedValue(new Error('leaderboard error'));

    await initPostPurchaseReveal($w, { orderTotal: 100, getLoyaltyAccount, getLeaderboard });

    // Section still expands, member state shown, rank hidden
    expect($w('#postPurchaseReveal').expand).toHaveBeenCalled();
    expect($w('#revealPointsText').show).toHaveBeenCalled();
    expect($w('#revealRankText').hide).toHaveBeenCalled();
  });

  it('collapses section when getLoyaltyAccount returns null', async () => {
    const $w = make$w();
    const getLoyaltyAccount = vi.fn().mockResolvedValue(null);
    const getLeaderboard = vi.fn().mockResolvedValue(LEADERBOARD_NO_RANK);

    await initPostPurchaseReveal($w, { orderTotal: 100, getLoyaltyAccount, getLeaderboard });
    expect($w('#postPurchaseReveal').collapse).toHaveBeenCalled();
  });
});
