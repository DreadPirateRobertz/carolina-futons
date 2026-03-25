/**
 * dailyQuestsWidget.test.js
 * CF-8t8z — DailyQuestsWidget: daily quests with progress on member dashboard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initDailyQuestsWidget } from '../src/public/DailyQuestsWidget.js';

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

function makeRepeaterItemEls() {
  return {
    '#questName':      makeEl(),
    '#questDesc':      makeEl(),
    '#questProgress':  makeEl(),
    '#questReward':    makeEl(),
    '#questCheckmark': makeEl(),
  };
}

function make$w() {
  const repeater = {
    ...makeEl(),
    data: null,
    _onItemReadyCb: null,
    onItemReady: vi.fn(function (cb) { this._onItemReadyCb = cb; }),
  };

  const els = {
    '#questsTitle':    makeEl(),
    '#questsRepeater': repeater,
    '#questsTimer':    makeEl(),
    '#questsError':    makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._repeater = repeater;
  return $w;
}

// ── Quest data helpers ────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-quests-1';

function makeQuest(overrides = {}) {
  return {
    questId: 'q-review',
    title: 'Write a Review',
    description: 'Leave a review on any product',
    currentProgress: 0,
    targetProgress: 1,
    pointsReward: 50,
    isComplete: false,
    expiresAt: '2026-03-25T04:00:00.000Z',
    ...overrides,
  };
}

function makeOpts($w, quests) {
  return {
    $w,
    getDailyQuests: vi.fn().mockResolvedValue(quests),
  };
}

// ── Rendering: quests list ───────────────────────────────────────────────────

describe('initDailyQuestsWidget — rendering', () => {
  let $w;
  beforeEach(() => { vi.clearAllMocks(); $w = make$w(); });

  it('sets #questsTitle text to "Daily Quests"', async () => {
    const opts = makeOpts($w, [makeQuest()]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsTitle').text).toBe('Daily Quests');
  });

  it('shows #questsRepeater when quests exist', async () => {
    const opts = makeOpts($w, [makeQuest()]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsRepeater').show).toHaveBeenCalled();
  });

  it('sets repeater data to quests array', async () => {
    const quests = [makeQuest(), makeQuest({ questId: 'q-share', title: 'Share a Photo' })];
    const opts = makeOpts($w, quests);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsRepeater').data).toEqual(quests);
  });

  it('hides #questsError on successful load', async () => {
    const opts = makeOpts($w, [makeQuest()]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsError').hide).toHaveBeenCalled();
  });

  it('passes memberId to getDailyQuests', async () => {
    const opts = makeOpts($w, []);
    await initDailyQuestsWidget('specific-member', opts);
    expect(opts.getDailyQuests).toHaveBeenCalledWith('specific-member');
  });
});

// ── Rendering: empty state ──────────────────────────────────────────────────

describe('initDailyQuestsWidget — empty state', () => {
  let $w;
  beforeEach(() => { vi.clearAllMocks(); $w = make$w(); });

  it('hides #questsRepeater when no quests', async () => {
    const opts = makeOpts($w, []);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsRepeater').hide).toHaveBeenCalled();
  });

  it('sets #questsTitle to "No Quests Today" when empty', async () => {
    const opts = makeOpts($w, []);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsTitle').text).toBe('No Quests Today');
  });
});

// ── Repeater item rendering ──────────────────────────────────────────────────
// Wix onItemReady callback signature: ($item, itemData) where $item is the
// scoped selector function. Tests must match this 2-param shape.

describe('initDailyQuestsWidget — repeater items', () => {
  let $w, onItemReadyCb;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
    $w('#questsRepeater').onItemReady.mockImplementation(function (cb) {
      onItemReadyCb = cb;
    });
  });

  function fireItemReady(quest) {
    const $itemEls = makeRepeaterItemEls();
    const $item = (id) => $itemEls[id] ?? makeEl();
    onItemReadyCb($item, quest);
    return { $itemEls, $item };
  }

  it('sets #questName to quest title', async () => {
    const quest = makeQuest({ title: 'Share a Photo' });
    const opts = makeOpts($w, [quest]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    const { $item } = fireItemReady(quest);
    expect($item('#questName').text).toBe('Share a Photo');
  });

  it('falls back to questId when title is absent', async () => {
    const quest = makeQuest({ title: undefined, questId: 'q-fallback' });
    const opts = makeOpts($w, [quest]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    const { $item } = fireItemReady(quest);
    expect($item('#questName').text).toBe('q-fallback');
  });

  it('sets #questDesc to quest description', async () => {
    const quest = makeQuest({ description: 'Review any product' });
    const opts = makeOpts($w, [quest]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    const { $item } = fireItemReady(quest);
    expect($item('#questDesc').text).toBe('Review any product');
  });

  it('sets #questProgress to "N / M" format', async () => {
    const quest = makeQuest({ currentProgress: 2, targetProgress: 5 });
    const opts = makeOpts($w, [quest]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    const { $item } = fireItemReady(quest);
    expect($item('#questProgress').text).toBe('2 / 5');
  });

  it('sets #questReward to points reward text', async () => {
    const quest = makeQuest({ pointsReward: 100 });
    const opts = makeOpts($w, [quest]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    const { $item } = fireItemReady(quest);
    expect($item('#questReward').text).toBe('100 pts');
  });

  it('shows #questCheckmark when quest is complete', async () => {
    const quest = makeQuest({ isComplete: true, currentProgress: 1, targetProgress: 1 });
    const opts = makeOpts($w, [quest]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    const { $item } = fireItemReady(quest);
    expect($item('#questCheckmark').show).toHaveBeenCalled();
  });

  it('hides #questCheckmark when quest is incomplete', async () => {
    const quest = makeQuest({ isComplete: false, currentProgress: 0, targetProgress: 1 });
    const opts = makeOpts($w, [quest]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    const { $item } = fireItemReady(quest);
    expect($item('#questCheckmark').hide).toHaveBeenCalled();
  });
});

// ── Countdown timer ──────────────────────────────────────────────────────────

describe('initDailyQuestsWidget — timer', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = make$w();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets #questsTimer text on init', async () => {
    vi.setSystemTime(new Date('2026-03-24T20:00:00.000Z'));
    const opts = makeOpts($w, [makeQuest()]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsTimer').text).toMatch(/\d+h \d+m/);
  });

  it('updates timer text after interval tick', async () => {
    vi.setSystemTime(new Date('2026-03-24T22:30:00.000Z'));
    const opts = makeOpts($w, [makeQuest()]);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    vi.advanceTimersByTime(60_000);
    expect($w('#questsTimer').text).toMatch(/\d+h \d+m/);
  });

  it('does not set timer when quests are empty', async () => {
    const opts = makeOpts($w, []);
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsTimer').text).toBe('');
  });
});

// ── Error handling ───────────────────────────────────────────────────────────

describe('initDailyQuestsWidget — error handling', () => {
  let $w;
  beforeEach(() => { vi.clearAllMocks(); $w = make$w(); });

  it('does not throw when getDailyQuests rejects', async () => {
    const opts = makeOpts($w, []);
    opts.getDailyQuests.mockRejectedValue(new Error('Service down'));
    await expect(initDailyQuestsWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('shows #questsError on getDailyQuests rejection', async () => {
    const opts = makeOpts($w, []);
    opts.getDailyQuests.mockRejectedValue(new Error('Service down'));
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsError').show).toHaveBeenCalled();
  });

  it('hides #questsRepeater on error', async () => {
    const opts = makeOpts($w, []);
    opts.getDailyQuests.mockRejectedValue(new Error('Service down'));
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsRepeater').hide).toHaveBeenCalled();
  });

  it('hides #questsTimer on error', async () => {
    const opts = makeOpts($w, []);
    opts.getDailyQuests.mockRejectedValue(new Error('Service down'));
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsTimer').hide).toHaveBeenCalled();
  });

  it('shows #questsError when getDailyQuests returns error shape', async () => {
    const opts = makeOpts($w, []);
    opts.getDailyQuests.mockResolvedValue({ error: 'auth_required' });
    await initDailyQuestsWidget(MEMBER_ID, opts);
    expect($w('#questsError').show).toHaveBeenCalled();
  });
});
