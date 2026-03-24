/**
 * dailyChallengeWidget.test.js
 * CF-ti2e — DailyChallengeWidget: active quest progress on member dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initDailyChallengeWidget, refreshChallenges } from '../src/public/DailyChallengeWidget.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
  };
}

function makeRepeaterItem() {
  return {
    '#challengeTitle':        makeEl(),
    '#challengeProgress':     makeEl(),
    '#challengeCompleteIcon': makeEl(),
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
    '#challengeRepeater':  repeater,
    '#noChallengesMsg':    makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._repeater = repeater;
  return $w;
}

// ── Quest data helpers ────────────────────────────────────────────────────────

function makeQuest(questId, title, current, target) {
  return { questId, title, current, target };
}

const MEMBER_ID = 'mem-challenge-1';

function makeOpts($w, quests) {
  return {
    $w,
    getActiveQuests: vi.fn().mockResolvedValue(quests),
  };
}

// ── No quests state ───────────────────────────────────────────────────────────

describe('initDailyChallengeWidget — no quests', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('shows #noChallengesMsg when no quests', async () => {
    const opts = makeOpts($w, []);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    expect($w('#noChallengesMsg').show).toHaveBeenCalled();
  });

  it('hides #challengeRepeater when no quests', async () => {
    const opts = makeOpts($w, []);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    expect($w('#challengeRepeater').hide).toHaveBeenCalled();
  });
});

// ── Quests present ────────────────────────────────────────────────────────────

describe('initDailyChallengeWidget — quests present', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('hides #noChallengesMsg when quests exist', async () => {
    const opts = makeOpts($w, [makeQuest('q1', 'Write a Review', 0, 1)]);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    expect($w('#noChallengesMsg').hide).toHaveBeenCalled();
  });

  it('shows #challengeRepeater when quests exist', async () => {
    const opts = makeOpts($w, [makeQuest('q1', 'Write a Review', 0, 1)]);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    expect($w('#challengeRepeater').show).toHaveBeenCalled();
  });

  it('sets repeater data to quest list', async () => {
    const quests = [makeQuest('q1', 'Write a Review', 0, 1), makeQuest('q2', 'Share a Photo', 1, 2)];
    const opts = makeOpts($w, quests);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    expect($w('#challengeRepeater').data).toEqual(quests);
  });
});

// ── Repeater item rendering ───────────────────────────────────────────────────

describe('initDailyChallengeWidget — repeater item rendering', () => {
  let $w;
  let onItemReadyCb;

  beforeEach(() => {
    $w = make$w();
    $w('#challengeRepeater').onItemReady.mockImplementation(function (cb) {
      onItemReadyCb = cb;
    });
  });

  function fireItemReady(quest) {
    const $item = makeRepeaterItem();
    const itemSelector = (id) => $item[id] ?? makeEl();
    onItemReadyCb($item, itemSelector, quest);
    return { $item, itemSelector };
  }

  it('sets title text from quest.title', async () => {
    const opts = makeOpts($w, [makeQuest('q1', 'Write a Review', 0, 1)]);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(makeQuest('q1', 'Write a Review', 0, 1));
    expect(itemSelector('#challengeTitle').text).toBe('Write a Review');
  });

  it('falls back to questId when title is absent', async () => {
    const quest = { questId: 'q-photo', current: 0, target: 1 };
    const opts = makeOpts($w, [quest]);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(quest);
    expect(itemSelector('#challengeTitle').text).toBe('q-photo');
  });

  it('sets progress text as "N / M completed"', async () => {
    const opts = makeOpts($w, [makeQuest('q1', 'Share a Photo', 1, 3)]);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(makeQuest('q1', 'Share a Photo', 1, 3));
    expect(itemSelector('#challengeProgress').text).toBe('1 / 3 completed');
  });

  it('shows #challengeCompleteIcon when current >= target', async () => {
    const quest = makeQuest('q1', 'Done', 2, 2);
    const opts = makeOpts($w, [quest]);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(quest);
    expect(itemSelector('#challengeCompleteIcon').show).toHaveBeenCalled();
  });

  it('hides #challengeCompleteIcon when current < target', async () => {
    const quest = makeQuest('q1', 'In Progress', 1, 3);
    const opts = makeOpts($w, [quest]);
    await initDailyChallengeWidget(MEMBER_ID, opts);
    const { itemSelector } = fireItemReady(quest);
    expect(itemSelector('#challengeCompleteIcon').hide).toHaveBeenCalled();
  });
});

// ── Error handling ─────────────────────────────────────────────────────────────

describe('initDailyChallengeWidget — error handling', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('does not throw when getActiveQuests rejects', async () => {
    const opts = makeOpts($w, []);
    opts.getActiveQuests.mockRejectedValue(new Error('Service down'));
    await expect(initDailyChallengeWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('shows #noChallengesMsg on getActiveQuests error', async () => {
    const opts = makeOpts($w, []);
    opts.getActiveQuests.mockRejectedValue(new Error('Service down'));
    await initDailyChallengeWidget(MEMBER_ID, opts);
    expect($w('#noChallengesMsg').show).toHaveBeenCalled();
  });

  it('passes memberId to getActiveQuests', async () => {
    const opts = makeOpts($w, []);
    await initDailyChallengeWidget('specific-member', opts);
    expect(opts.getActiveQuests).toHaveBeenCalledWith('specific-member');
  });
});

// ── refreshChallenges ─────────────────────────────────────────────────────────

describe('refreshChallenges', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('re-calls getActiveQuests with memberId', async () => {
    const opts = makeOpts($w, []);
    await refreshChallenges(MEMBER_ID, opts);
    expect(opts.getActiveQuests).toHaveBeenCalledWith(MEMBER_ID);
  });

  it('updates repeater with new quests on refresh', async () => {
    const quests = [makeQuest('q1', 'Write a Review', 1, 1)];
    const opts = makeOpts($w, quests);
    await refreshChallenges(MEMBER_ID, opts);
    expect($w('#challengeRepeater').data).toEqual(quests);
  });
});
