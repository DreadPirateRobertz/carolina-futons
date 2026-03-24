/**
 * @file ZipLeaderboardDisplay.test.js
 * Tests for ZipLeaderboardDisplay public module (cf-shr).
 *
 * Renders the ZIP micro-leaderboard on Member Page:
 * - Shows top-10 members in caller's 3-digit ZIP prefix ranked by totalPoints
 * - Highlights the caller's own row (isMe: true) using colors.sand token
 * - Hides section when zipPrefix is null or 429
 * - Shows emptyMessage when zipPrefix set but no opted-in neighbors
 * - Shows myRank in a summary element when caller is in top 10
 * - Shows "outside top 10" message when myRank is null but leaderboard is non-empty
 */

import { describe, it, expect, vi } from 'vitest';
import {
  renderZipLeaderboard,
  initZipLeaderboardSection,
} from '../src/public/ZipLeaderboardDisplay.js';

vi.mock('public/designTokens.js', () => ({
  colors: { sand: '#E8D5B7', espresso: '#3A2518', mountainBlue: '#5B8FA8' },
}));

// ── Element helpers ───────────────────────────────────────────────────────────

function makeText() {
  let val = '';
  return { set text(v) { val = v; }, get text() { return val; }, hide: vi.fn(), show: vi.fn() };
}

function makeBox() {
  return {
    hide: vi.fn(), show: vi.fn(), collapse: vi.fn(), expand: vi.fn(),
    style: { backgroundColor: '' },
  };
}

function makeItemFn() {
  const elements = {};
  return (id) => {
    if (!elements[id]) elements[id] = makeBox();
    return elements[id];
  };
}

function makeRepeater() {
  let data = [];
  let onItemReadyCb = null;
  return {
    get data() { return data; },
    set data(v) { data = v; },
    onItemReady: vi.fn((fn) => { onItemReadyCb = fn; }),
    // Helper to fire the onItemReady callback for a given item
    _fireItemReady($item, itemData) { if (onItemReadyCb) onItemReadyCb($item, itemData); },
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

// ── renderZipLeaderboard — empty / null / 429 state ───────────────────────────

describe('renderZipLeaderboard — hides section', () => {
  it('hides section when zipPrefix is null', () => {
    const $section = makeBox();
    renderZipLeaderboard(
      { $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() },
      { leaderboard: [], myRank: null, zipPrefix: null }
    );
    expect($section.hide).toHaveBeenCalled();
  });

  it('hides section on 429 status response', () => {
    const $section = makeBox();
    renderZipLeaderboard(
      { $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() },
      { status: 429, error: 'Rate limit exceeded' }
    );
    expect($section.hide).toHaveBeenCalled();
  });

  it('hides section when result is null/undefined', () => {
    const $section = makeBox();
    renderZipLeaderboard(
      { $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() },
      null
    );
    expect($section.hide).toHaveBeenCalled();
  });
});

// ── renderZipLeaderboard — empty leaderboard with valid zipPrefix ──────────────

describe('renderZipLeaderboard — empty leaderboard with valid zipPrefix', () => {
  it('shows section when zipPrefix is set even if leaderboard is empty', () => {
    const $section = makeBox();
    renderZipLeaderboard(
      { $section, $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() },
      { leaderboard: [], myRank: null, zipPrefix: '282' }
    );
    expect($section.show).toHaveBeenCalled();
  });

  it('shows emptyMessage when leaderboard is empty but zipPrefix is set', () => {
    const $emptyMessage = makeBox();
    renderZipLeaderboard(
      { $section: makeBox(), $repeater: makeRepeater(), $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage },
      { leaderboard: [], myRank: null, zipPrefix: '282' }
    );
    expect($emptyMessage.show).toHaveBeenCalled();
  });
});

// ── renderZipLeaderboard — populated state ────────────────────────────────────

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

  it('sets zipPrefixText to include the zipPrefix value', () => {
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

  it('shows myRankText with rank 1 for top member', () => {
    const els = makeElements();
    renderZipLeaderboard(els, { leaderboard, myRank: 1, zipPrefix: '282' });
    expect(els.$myRankText.text).toContain('1');
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

  it('hides emptyMessage when leaderboard has entries', () => {
    const els = makeElements();
    renderZipLeaderboard(els, { leaderboard, myRank: 2, zipPrefix: '282' });
    expect(els.$emptyMessage.hide).toHaveBeenCalled();
  });
});

// ── renderZipLeaderboard — onItemReady callback ───────────────────────────────

describe('renderZipLeaderboard — onItemReady callback', () => {
  it('sets backgroundColor to colors.sand on isMe row', () => {
    const $repeater = makeRepeater();
    renderZipLeaderboard(
      { $section: makeBox(), $repeater, $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() },
      { leaderboard: [makeEntry({ isMe: true, rank: 1, totalPoints: 500 })], myRank: 1, zipPrefix: '282' }
    );
    const $item = makeItemFn();
    $repeater._fireItemReady($item, { rank: 1, displayName: 'Alice', totalPoints: 500, isMe: true });
    expect($item('#zipEntryBox').style.backgroundColor).toBe('#E8D5B7');
  });

  it('sets backgroundColor to empty string on non-isMe rows', () => {
    const $repeater = makeRepeater();
    renderZipLeaderboard(
      { $section: makeBox(), $repeater, $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() },
      { leaderboard: [makeEntry({ isMe: false, rank: 2, totalPoints: 300 })], myRank: null, zipPrefix: '282' }
    );
    const $item = makeItemFn();
    $repeater._fireItemReady($item, { rank: 2, displayName: 'Bob', totalPoints: 300, isMe: false });
    expect($item('#zipEntryBox').style.backgroundColor).toBe('');
  });

  it('falls back displayName to "Member" when missing', () => {
    const $repeater = makeRepeater();
    renderZipLeaderboard(
      { $section: makeBox(), $repeater, $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() },
      { leaderboard: [makeEntry({ displayName: '', rank: 1 })], myRank: 1, zipPrefix: '282' }
    );
    const $item = makeItemFn();
    $repeater._fireItemReady($item, { rank: 1, displayName: '', totalPoints: 100, isMe: false });
    expect($item('#zipDisplayNameText').text).toBe('Member');
  });

  it('passes isMe field through to repeater data', () => {
    const $repeater = makeRepeater();
    const entry = makeEntry({ isMe: true, memberId: 'mem-1' });
    renderZipLeaderboard(
      { $section: makeBox(), $repeater, $myRankText: makeText(), $zipPrefixText: makeText(), $emptyMessage: makeBox() },
      { leaderboard: [entry], myRank: 1, zipPrefix: '282' }
    );
    expect($repeater.data[0].isMe).toBe(true);
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
