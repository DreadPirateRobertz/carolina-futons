/**
 * @file leaderboardWidget.test.js
 * @description Tests for CF-ttcd, CF-bs92: LeaderboardWidget — top 10 + user rank outside top 10.
 *
 * CF-ttcd, CF-bs92
 */
import { describe, it, expect, vi } from 'vitest';
import { initLeaderboardWidget } from '../src/public/LeaderboardWidget.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    src: '',
    _visible: true,
    _classes: [],
    show:     vi.fn(function () { this._visible = true; }),
    hide:     vi.fn(function () { this._visible = false; }),
    addClass: vi.fn(function (cls) { this._classes.push(cls); }),
  };
}

function make$w() {
  const repeater = {
    ...makeEl(),
    data: null,
    _onItemReady: null,
    onItemReady: vi.fn(function (cb) { this._onItemReady = cb; }),
  };

  const els = {
    '#leaderboardTitle':    makeEl(),
    '#leaderboardRepeater': repeater,
    '#leaderboardYourRank': makeEl(),
    '#leaderboardEmpty':    makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  $w._repeater = repeater;
  return $w;
}

function fireItemReady($w, itemData) {
  const $item = (sel) => {
    if (!$item._els[sel]) $item._els[sel] = makeEl();
    return $item._els[sel];
  };
  $item._els = {};
  $item._classes = [];
  $item.addClass = vi.fn((cls) => { $item._classes.push(cls); });

  $w._repeater._onItemReady?.($item, itemData);
  return $item;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-current';

function makeEntry(rank, overrides = {}) {
  return {
    rank,
    nickname: `Player ${rank}`,
    totalPoints: (11 - rank) * 1000,
    avatarUrl: `https://example.com/avatar${rank}.png`,
    memberId: `mem-${rank}`,
    ...overrides,
  };
}

function makeTop10(currentMemberRank = null) {
  return Array.from({ length: 10 }, (_, i) => {
    const rank = i + 1;
    const overrides = rank === currentMemberRank ? { memberId: MEMBER_ID } : {};
    return makeEntry(rank, overrides);
  });
}

function makeResult(entries, currentUserRank = null, pointsToTopTen = 0) {
  return { entries, currentUserRank, pointsToTopTen };
}

function makeOpts($w, result, extra = {}) {
  return {
    $w,
    getLeaderboard: vi.fn().mockResolvedValue(result),
    ...extra,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('title', () => {
  it('sets #leaderboardTitle to "Community Leaderboard"', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    expect($w._els['#leaderboardTitle'].text).toBe('Community Leaderboard');
  });
});

describe('renders top 10', () => {
  it('sets repeater data to entries array', async () => {
    const $w = make$w();
    const entries = makeTop10();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(entries)));
    expect($w._repeater.data).toBe(entries);
  });

  it('shows repeater when entries exist', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    expect($w._repeater.show).toHaveBeenCalled();
  });

  it('hides #leaderboardEmpty when entries exist', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    expect($w._els['#leaderboardEmpty'].hide).toHaveBeenCalled();
  });

  it('sets #leaderRank text for rank 1', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(1));
    expect($item._els['#leaderRank'].text).toBe('Gold');
  });

  it('sets #leaderName text', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(5, { nickname: 'TestUser' }));
    expect($item._els['#leaderName'].text).toBe('TestUser');
  });

  it('sets #leaderPoints with comma formatting and "pts" suffix', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(1, { totalPoints: 10000 }));
    expect($item._els['#leaderPoints'].text).toBe('10,000 pts');
  });

  it('sets #leaderAvatar src', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(1, { avatarUrl: 'https://example.com/av.png' }));
    expect($item._els['#leaderAvatar'].src).toBe('https://example.com/av.png');
  });

  it('calls getLeaderboard with limit 10 and memberId', async () => {
    const $w = make$w();
    const opts = makeOpts($w, makeResult(makeTop10()));
    await initLeaderboardWidget(MEMBER_ID, opts);
    expect(opts.getLeaderboard).toHaveBeenCalledWith(10, MEMBER_ID);
  });
});

describe('top 3 styling', () => {
  it('adds "rank-gold" class for rank 1', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(1));
    expect($item._els['#leaderRank'].addClass).toHaveBeenCalledWith('rank-gold');
  });

  it('adds "rank-silver" class for rank 2', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(2));
    expect($item._els['#leaderRank'].addClass).toHaveBeenCalledWith('rank-silver');
  });

  it('adds "rank-bronze" class for rank 3', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(3));
    expect($item._els['#leaderRank'].addClass).toHaveBeenCalledWith('rank-bronze');
  });

  it('rank labels: Gold, Silver, Bronze for 1-3', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    expect(fireItemReady($w, makeEntry(1))._els['#leaderRank'].text).toBe('Gold');
    expect(fireItemReady($w, makeEntry(2))._els['#leaderRank'].text).toBe('Silver');
    expect(fireItemReady($w, makeEntry(3))._els['#leaderRank'].text).toBe('Bronze');
  });

  it('rank label "#N" for rank 4+', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(7));
    expect($item._els['#leaderRank'].text).toBe('#7');
  });

  it('does not add rank class for rank 4+', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(5));
    expect($item._els['#leaderRank'].addClass).not.toHaveBeenCalled();
  });
});

describe('highlights current user', () => {
  it('adds "current-member" class when item memberId matches', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10(3), 3)));
    const $item = fireItemReady($w, makeEntry(3, { memberId: MEMBER_ID }));
    expect($item.addClass).toHaveBeenCalledWith('current-member');
  });

  it('does not add "current-member" class for other members', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10())));
    const $item = fireItemReady($w, makeEntry(5));
    expect($item.addClass).not.toHaveBeenCalledWith('current-member');
  });
});

describe('your rank display (CF-bs92)', () => {
  it('shows "Your rank: #N" when current member is in top 10', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10(5), 5)));
    expect($w._els['#leaderboardYourRank'].text).toBe('Your rank: #5');
    expect($w._els['#leaderboardYourRank'].show).toHaveBeenCalled();
  });

  it('shows "You are #N — X pts to reach top 10" when outside top 10', async () => {
    const $w = make$w();
    // Member not in top 10, rank 47, 230 pts gap
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10(), 47, 230)));
    expect($w._els['#leaderboardYourRank'].text).toBe('You are #47 \u2014 230 pts to reach top 10');
    expect($w._els['#leaderboardYourRank'].show).toHaveBeenCalled();
  });

  it('shows correct gap when outside top 10 with large gap', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10(), 150, 5000)));
    expect($w._els['#leaderboardYourRank'].text).toBe('You are #150 \u2014 5000 pts to reach top 10');
  });

  it('hides #leaderboardYourRank when no rank data', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult(makeTop10(), null, 0)));
    expect($w._els['#leaderboardYourRank'].hide).toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('shows #leaderboardEmpty when result is null', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#leaderboardEmpty'].show).toHaveBeenCalled();
  });

  it('shows #leaderboardEmpty when entries are empty', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult([])));
    expect($w._els['#leaderboardEmpty'].show).toHaveBeenCalled();
  });

  it('hides repeater on empty data', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult([])));
    expect($w._repeater.hide).toHaveBeenCalled();
  });

  it('hides #leaderboardYourRank on empty data', async () => {
    const $w = make$w();
    await initLeaderboardWidget(MEMBER_ID, makeOpts($w, makeResult([])));
    expect($w._els['#leaderboardYourRank'].hide).toHaveBeenCalled();
  });

  it('shows #leaderboardEmpty when getLeaderboard rejects', async () => {
    const $w = make$w();
    const opts = { $w, getLeaderboard: vi.fn().mockRejectedValue(new Error('API down')) };
    await initLeaderboardWidget(MEMBER_ID, opts);
    expect($w._els['#leaderboardEmpty'].show).toHaveBeenCalled();
  });

  it('does not throw when getLeaderboard rejects', async () => {
    const $w = make$w();
    const opts = { $w, getLeaderboard: vi.fn().mockRejectedValue(new Error('API down')) };
    await expect(initLeaderboardWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});
