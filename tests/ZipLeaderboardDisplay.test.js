/**
 * @file ZipLeaderboardDisplay.test.js
 * Tests for ZipLeaderboardDisplay public module (cf-shr).
 *
 * Renders the ZIP micro-leaderboard on Member Page:
 * - Shows top-10 members in caller's 3-digit ZIP prefix ranked by totalPoints
 * - Highlights the caller's own row (isMe: true)
 * - Hides section when leaderboard is empty or zipPrefix is null
 * - Shows myRank in a summary element when caller is in top 10
 * - Shows "outside top 10" message when myRank is null but leaderboard is non-empty
 */

import { describe, it, expect, vi } from 'vitest';
import {
  renderZipLeaderboard,
  initZipLeaderboardSection,
} from '../src/public/ZipLeaderboardDisplay.js';

// ── Element helpers ───────────────────────────────────────────────────────────

function makeText() {
  let val = '';
  return { set text(v) { val = v; }, get text() { return val; }, hide: vi.fn(), show: vi.fn() };
}

function makeBox() {
  return { hide: vi.fn(), show: vi.fn(), collapse: vi.fn(), expand: vi.fn() };
}

function makeRepeater() {
  let data = [];
  const onItemReadyFn = vi.fn();
  return {
    get data() { return data; },
    set data(v) { data = v; },
    onItemReady: vi.fn((fn) => { onItemReadyFn.mockImplementation(fn); }),
    _onItemReadyFn: onItemReadyFn,
  };
}

function makeEntry(overrides = {}) {
  return {
    rank: 1,
    memberId: 'mem-1',
    displayName: 'Alice',
    totalPoints: 1000,
    isMe: false,
    ...overrides,
  };
}

// ── renderZipLeaderboard ──────────────────────────────────────────────────────

describe('renderZipLeaderboard — empty / null state', () => {
  it('hides section when leaderboard is empty', () => {
    const $section = makeBox();
    renderZipLeaderboard({ $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() }, { leaderboard: [], myRank: null, zipPrefix: null });
    expect($section.hide).toHaveBeenCalled();
  });

  it('hides section when zipPrefix is null', () => {
    const $section = makeBox();
    renderZipLeaderboard({ $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() }, { leaderboard: [], myRank: null, zipPrefix: null });
    expect($section.hide).toHaveBeenCalled();
  });

  it('shows emptyMessage and hides section when leaderboard is empty but zipPrefix is set', () => {
    const $section = makeBox();
    const $emptyMessage = makeBox();
    renderZipLeaderboard({ $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage }, { leaderboard: [], myRank: null, zipPrefix: '282' });
    expect($section.hide).toHaveBeenCalled();
  });
});

describe('renderZipLeaderboard — populated state', () => {
  function makeElements() {
    return {
      $section: makeBox(),
      $repeater: makeRepeater(),
      $myRankText: makeText(),
      $zipPrefixText: makeText(),
      $emptyMessage: makeBox(),
    };
  }

  const leaderboard = [
    makeEntry({ rank: 1, memberId: 'mem-2', displayName: 'Dave', totalPoints: 1200, isMe: false }),
    makeEntry({ rank: 2, memberId: 'mem-1', displayName: 'Alice', totalPoints: 1000, isMe: true }),
    makeEntry({ rank: 3, memberId: 'mem-3', displayName: 'Bob', totalPoints: 750, isMe: false }),
  ];

  it('shows section when leaderboard has entries', () => {
    const els = makeElements();
    renderZipLeaderboard(els, { leaderboard, myRank: 2, zipPrefix: '282' });
    expect(els.$section.show).toHaveBeenCalled();
  });

  it('sets repeater data to leaderboard entries', () => {
    const els = makeElements();
    renderZipLeaderboard(els, { leaderboard, myRank: 2, zipPrefix: '282' });
    expect(els.$repeater.data).toHaveLength(3);
    expect(els.$repeater.data[0].memberId).toBe('mem-2');
  });

  it('sets zipPrefixText to the zipPrefix value', () => {
    const els = makeElements();
    renderZipLeaderboard(els, { leaderboard, myRank: 2, zipPrefix: '282' });
    expect(els.$zipPrefixText.text).toContain('282');
  });

  it('sets myRankText when caller is in top 10', () => {
    const els = makeElements();
    renderZipLeaderboard(els, { leaderboard, myRank: 2, zipPrefix: '282' });
    expect(els.$myRankText.text).toContain('2');
  });

  it('shows myRankText when myRank is not null', () => {
    const els = makeElements();
    renderZipLeaderboard(els, { leaderboard, myRank: 2, zipPrefix: '282' });
    expect(els.$myRankText.show).toHaveBeenCalled();
  });

  it('hides myRankText when myRank is null (caller outside top 10)', () => {
    const els = makeElements();
    renderZipLeaderboard(els, { leaderboard, myRank: null, zipPrefix: '282' });
    expect(els.$myRankText.hide).toHaveBeenCalled();
  });

  it('registers onItemReady on the repeater', () => {
    const els = makeElements();
    renderZipLeaderboard(els, { leaderboard, myRank: 2, zipPrefix: '282' });
    expect(els.$repeater.onItemReady).toHaveBeenCalled();
  });
});

// ── renderZipLeaderboard — rate limit response ────────────────────────────────

describe('renderZipLeaderboard — rate limit', () => {
  it('hides section on 429 status response', () => {
    const $section = makeBox();
    renderZipLeaderboard(
      { $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() },
      { status: 429, error: 'Rate limit exceeded' }
    );
    expect($section.hide).toHaveBeenCalled();
  });
});

// ── initZipLeaderboardSection ─────────────────────────────────────────────────

describe('initZipLeaderboardSection', () => {
  it('calls getZipLeaderboard and renders result', async () => {
    const leaderboard = [makeEntry({ rank: 1, isMe: true, totalPoints: 500 })];
    const getZipLeaderboard = vi.fn().mockResolvedValue({ leaderboard, myRank: 1, zipPrefix: '282' });
    const $section = makeBox();
    const els = { $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() };

    await initZipLeaderboardSection(els, getZipLeaderboard);
    expect(getZipLeaderboard).toHaveBeenCalledOnce();
    expect($section.show).toHaveBeenCalled();
  });

  it('hides section gracefully when getZipLeaderboard throws', async () => {
    const getZipLeaderboard = vi.fn().mockRejectedValue(new Error('network error'));
    const $section = makeBox();
    const els = { $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() };

    await initZipLeaderboardSection(els, getZipLeaderboard);
    expect($section.hide).toHaveBeenCalled();
  });

  it('hides section when result has status 429', async () => {
    const getZipLeaderboard = vi.fn().mockResolvedValue({ status: 429, error: 'Rate limit exceeded' });
    const $section = makeBox();
    const els = { $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() };

    await initZipLeaderboardSection(els, getZipLeaderboard);
    expect($section.hide).toHaveBeenCalled();
  });
});
