/**
 * leaderboardWidget.test.js
 * CF-9svi — LeaderboardWidget: top-10 display with opt-in toggle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initLeaderboardWidget } from '../src/public/LeaderboardWidget.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _class: '',
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    onChange: vi.fn(),
    checked: true,
    addClass: vi.fn(function (cls) { this._class = cls; }),
    removeClass: vi.fn(),
  };
}

function makeRepeaterItem() {
  return {
    '#rankText':   makeEl(),
    '#nickText':   makeEl(),
    '#pointsText': makeEl(),
    _class: '',
    addClass: vi.fn(function (cls) { this._class = cls; }),
    removeClass: vi.fn(),
  };
}

function make$w() {
  const repeaterItems = [];

  const repeater = {
    ...makeEl(),
    data: null,
    _forEachCb: null,
    onItemReady: vi.fn(function (cb) { this._forEachCb = cb; }),
  };

  const els = {
    '#leaderboardRepeater':  repeater,
    '#leaderboardOptInToggle': makeEl(),
    '#leaderboardOptOutMsg': makeEl(),
  };

  const $w = (id) => {
    if (els[id]) return els[id];
    return makeEl();
  };

  // Allow tests to retrieve captured item callbacks
  $w._repeater = repeater;
  $w._items = repeaterItems;
  return $w;
}

// ── Leaderboard data helpers ──────────────────────────────────────────────────

function makeEntry(rank, nickname, points, memberId = null) {
  return { rank, nickname, points, memberId: memberId ?? `mem-${rank}` };
}

function makeTop10(currentMemberId = null) {
  return Array.from({ length: 10 }, (_, i) => {
    const rank = i + 1;
    const id = rank === 5 && currentMemberId ? currentMemberId : `mem-${rank}`;
    return makeEntry(rank, `Player${rank}`, (11 - rank) * 100, id);
  });
}

const MEMBER_ID = 'mem-current';

function makeOpts($w, entries, optedIn = true) {
  return {
    $w,
    getLeaderboard: vi.fn().mockResolvedValue(entries),
    setLeaderboardOptIn: vi.fn().mockResolvedValue(undefined),
    getLeaderboardOptIn: vi.fn().mockResolvedValue(optedIn),
  };
}

// ── Repeater rendering ────────────────────────────────────────────────────────

describe('initLeaderboardWidget — repeater data', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('sets repeater data to top-10 entries', async () => {
    const entries = makeTop10();
    const opts = makeOpts($w, entries);
    await initLeaderboardWidget(MEMBER_ID, opts);
    expect($w('#leaderboardRepeater').data).toEqual(entries);
  });

  it('calls getLeaderboard with no arguments', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    expect(opts.getLeaderboard).toHaveBeenCalledWith();
  });
});

// ── Rank labels ───────────────────────────────────────────────────────────────

describe('initLeaderboardWidget — rank labels', () => {
  let $w;
  let onItemReadyCb;

  beforeEach(() => {
    $w = make$w();
    $w('#leaderboardRepeater').onItemReady.mockImplementation(function (cb) {
      onItemReadyCb = cb;
    });
  });

  function fireItemReady(rank, memberId = `mem-${rank}`) {
    const item = makeEntry(rank, `Player${rank}`, (11 - rank) * 100, memberId);
    const $item = makeRepeaterItem();
    const itemSelector = (id) => $item[id] ?? makeEl();
    onItemReadyCb($item, itemSelector, item);
    return { $item, itemSelector };
  }

  it('rank 1 shows Gold label', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(1);
    expect(itemSelector('#rankText').text).toBe('Gold');
  });

  it('rank 2 shows Silver label', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(2);
    expect(itemSelector('#rankText').text).toBe('Silver');
  });

  it('rank 3 shows Bronze label', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(3);
    expect(itemSelector('#rankText').text).toBe('Bronze');
  });

  it('rank 4 shows numeric label "#4"', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(4);
    expect(itemSelector('#rankText').text).toBe('#4');
  });

  it('rank 10 shows numeric label "#10"', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(10);
    expect(itemSelector('#rankText').text).toBe('#10');
  });

  it('sets nickname text', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(3);
    expect(itemSelector('#nickText').text).toBe('Player3');
  });

  it('sets points text', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(3);
    expect(itemSelector('#pointsText').text).toBe('800');
  });
});

// ── Current member highlight ──────────────────────────────────────────────────

describe('initLeaderboardWidget — current member highlight', () => {
  let $w;
  let onItemReadyCb;

  beforeEach(() => {
    $w = make$w();
    $w('#leaderboardRepeater').onItemReady.mockImplementation(function (cb) {
      onItemReadyCb = cb;
    });
  });

  function fireItemReady(rank, memberId) {
    const item = makeEntry(rank, `Player${rank}`, (11 - rank) * 100, memberId);
    const $item = makeRepeaterItem();
    const itemSelector = (id) => $item[id] ?? makeEl();
    onItemReadyCb($item, itemSelector, item);
    return { $item, itemSelector };
  }

  it('adds current-member class to row when memberId matches', async () => {
    const entries = makeTop10(MEMBER_ID);  // rank 5 is current member
    const opts = makeOpts($w, entries);
    await initLeaderboardWidget(MEMBER_ID, opts);
    const { $item } = fireItemReady(5, MEMBER_ID);
    expect($item.addClass).toHaveBeenCalledWith('current-member');
  });

  it('does not add current-member class to other rows', async () => {
    const entries = makeTop10(MEMBER_ID);
    const opts = makeOpts($w, entries);
    await initLeaderboardWidget(MEMBER_ID, opts);
    const { $item } = fireItemReady(1, 'mem-1');
    expect($item.addClass).not.toHaveBeenCalledWith('current-member');
  });
});

// ── Opt-in toggle ─────────────────────────────────────────────────────────────

describe('initLeaderboardWidget — opt-in toggle', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('wires onChange on #leaderboardOptInToggle', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    expect($w('#leaderboardOptInToggle').onChange).toHaveBeenCalled();
  });

  it('shows repeater when member is opted in', async () => {
    const opts = makeOpts($w, makeTop10(), true);
    await initLeaderboardWidget(MEMBER_ID, opts);
    expect($w('#leaderboardRepeater').show).toHaveBeenCalled();
    expect($w('#leaderboardOptOutMsg').hide).toHaveBeenCalled();
  });

  it('hides repeater and shows opt-out message when member is opted out', async () => {
    const opts = makeOpts($w, makeTop10(), false);
    await initLeaderboardWidget(MEMBER_ID, opts);
    expect($w('#leaderboardRepeater').hide).toHaveBeenCalled();
    expect($w('#leaderboardOptOutMsg').show).toHaveBeenCalled();
  });

  it('toggle onChange calls setLeaderboardOptIn with memberId and new value', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    const handler = $w('#leaderboardOptInToggle').onChange.mock.calls[0][0];
    await handler({ target: { checked: false } });
    expect(opts.setLeaderboardOptIn).toHaveBeenCalledWith(MEMBER_ID, false);
  });

  it('toggle onChange shows opt-out message when unchecked', async () => {
    const opts = makeOpts($w, makeTop10());
    await initLeaderboardWidget(MEMBER_ID, opts);
    const handler = $w('#leaderboardOptInToggle').onChange.mock.calls[0][0];
    await handler({ target: { checked: false } });
    expect($w('#leaderboardRepeater').hide).toHaveBeenCalled();
    expect($w('#leaderboardOptOutMsg').show).toHaveBeenCalled();
  });

  it('toggle onChange hides opt-out message when checked', async () => {
    const opts = makeOpts($w, makeTop10(), false);
    await initLeaderboardWidget(MEMBER_ID, opts);
    const handler = $w('#leaderboardOptInToggle').onChange.mock.calls[0][0];
    await handler({ target: { checked: true } });
    expect($w('#leaderboardRepeater').show).toHaveBeenCalled();
    expect($w('#leaderboardOptOutMsg').hide).toHaveBeenCalled();
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('initLeaderboardWidget — error handling', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('does not throw when getLeaderboard rejects', async () => {
    const opts = makeOpts($w, []);
    opts.getLeaderboard.mockRejectedValue(new Error('Service down'));
    await expect(initLeaderboardWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('hides repeater on getLeaderboard error', async () => {
    const opts = makeOpts($w, []);
    opts.getLeaderboard.mockRejectedValue(new Error('Service down'));
    await initLeaderboardWidget(MEMBER_ID, opts);
    expect($w('#leaderboardRepeater').hide).toHaveBeenCalled();
  });

  it('does not throw when getLeaderboardOptIn rejects', async () => {
    const opts = makeOpts($w, makeTop10());
    opts.getLeaderboardOptIn.mockRejectedValue(new Error('Service down'));
    await expect(initLeaderboardWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});
