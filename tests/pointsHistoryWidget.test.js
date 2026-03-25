/**
 * pointsHistoryWidget.test.js
 * CF-ptth — frontend: PointsHistoryWidget
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initPointsHistoryWidget } from '../src/public/PointsHistoryWidget.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _class: '',
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    addClass: vi.fn(function (cls) { this._class = cls; }),
    removeClass: vi.fn(),
  };
}

function makeScopedSelector() {
  const els = {
    '#historyPoints': makeEl(),
    '#historyReason': makeEl(),
    '#historyDate':   makeEl(),
  };
  const $item = (id) => els[id] ?? makeEl();
  $item._els = els;
  $item._class = '';
  $item.addClass = vi.fn(function (cls) { this._class = cls; });
  return $item;
}

function make$w() {
  const repeater = {
    ...makeEl(),
    data: null,
    _onItemReadyCb: null,
    onItemReady: vi.fn(function (cb) { this._onItemReadyCb = cb; }),
  };

  const els = {
    '#historyRepeater': repeater,
    '#noHistoryMsg':    makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._repeater = repeater;
  return $w;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-hist-1';

function makeTx(points, reason, date, type) {
  return { points, reason, date, type };
}

function makeOpts($w, transactions) {
  return {
    $w,
    getRecentPointsHistory: vi.fn().mockResolvedValue({ transactions }),
  };
}

// ── No transactions ───────────────────────────────────────────────────────────

describe('initPointsHistoryWidget — no transactions', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('shows #noHistoryMsg when no transactions', async () => {
    const opts = makeOpts($w, []);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    expect($w('#noHistoryMsg').show).toHaveBeenCalled();
  });

  it('hides #historyRepeater when no transactions', async () => {
    const opts = makeOpts($w, []);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    expect($w('#historyRepeater').hide).toHaveBeenCalled();
  });
});

// ── Transactions present ──────────────────────────────────────────────────────

describe('initPointsHistoryWidget — transactions present', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('hides #noHistoryMsg when transactions exist', async () => {
    const opts = makeOpts($w, [makeTx(100, 'Purchase', '2026-03-20', 'earn')]);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    expect($w('#noHistoryMsg').hide).toHaveBeenCalled();
  });

  it('shows #historyRepeater when transactions exist', async () => {
    const opts = makeOpts($w, [makeTx(100, 'Purchase', '2026-03-20', 'earn')]);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    expect($w('#historyRepeater').show).toHaveBeenCalled();
  });

  it('sets repeater data to transactions list', async () => {
    const txs = [makeTx(100, 'Purchase', '2026-03-20', 'earn')];
    const opts = makeOpts($w, txs);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    expect($w('#historyRepeater').data).toEqual(txs);
  });
});

// ── Repeater item rendering ───────────────────────────────────────────────────

describe('initPointsHistoryWidget — repeater item rendering', () => {
  let $w;
  let onItemReadyCb;

  beforeEach(() => {
    $w = make$w();
    $w('#historyRepeater').onItemReady.mockImplementation(function (cb) {
      onItemReadyCb = cb;
    });
  });

  function fireItemReady(itemData) {
    const $item = makeScopedSelector();
    onItemReadyCb($item, itemData);
    return $item;
  }

  it('shows "+N pts" for positive points', async () => {
    const opts = makeOpts($w, [makeTx(100, 'Purchase', '2026-03-20', 'earn')]);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    const $item = fireItemReady(makeTx(100, 'Purchase', '2026-03-20', 'earn'));
    expect($item('#historyPoints').text).toBe('+100 pts');
  });

  it('shows "-N pts" for negative points', async () => {
    const opts = makeOpts($w, [makeTx(-50, 'Redemption', '2026-03-19', 'spend')]);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    const $item = fireItemReady(makeTx(-50, 'Redemption', '2026-03-19', 'spend'));
    expect($item('#historyPoints').text).toBe('-50 pts');
  });

  it('adds points-earned class for positive points', async () => {
    const opts = makeOpts($w, [makeTx(100, 'Purchase', '2026-03-20', 'earn')]);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    const $item = fireItemReady(makeTx(100, 'Purchase', '2026-03-20', 'earn'));
    expect($item.addClass).toHaveBeenCalledWith('points-earned');
  });

  it('adds points-spent class for negative points', async () => {
    const opts = makeOpts($w, [makeTx(-50, 'Redemption', '2026-03-19', 'spend')]);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    const $item = fireItemReady(makeTx(-50, 'Redemption', '2026-03-19', 'spend'));
    expect($item.addClass).toHaveBeenCalledWith('points-spent');
  });

  it('sets historyReason text', async () => {
    const opts = makeOpts($w, [makeTx(100, 'Product Review', '2026-03-20', 'earn')]);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    const $item = fireItemReady(makeTx(100, 'Product Review', '2026-03-20', 'earn'));
    expect($item('#historyReason').text).toBe('Product Review');
  });

  it('formats historyDate as MM/DD/YYYY', async () => {
    const opts = makeOpts($w, [makeTx(100, 'Purchase', '2026-03-20', 'earn')]);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    const $item = fireItemReady(makeTx(100, 'Purchase', '2026-03-20', 'earn'));
    expect($item('#historyDate').text).toBe('03/20/2026');
  });

  it('formats ISO datetime string correctly', async () => {
    const opts = makeOpts($w, [makeTx(100, 'Purchase', '2026-03-20T14:30:00.000Z', 'earn')]);
    await initPointsHistoryWidget(MEMBER_ID, opts);
    const $item = fireItemReady(makeTx(100, 'Purchase', '2026-03-20T14:30:00.000Z', 'earn'));
    expect($item('#historyDate').text).toBe('03/20/2026');
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('initPointsHistoryWidget — error handling', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('does not throw when getRecentPointsHistory rejects', async () => {
    const opts = makeOpts($w, []);
    opts.getRecentPointsHistory.mockRejectedValue(new Error('Service down'));
    await expect(initPointsHistoryWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('shows #noHistoryMsg on fetch error', async () => {
    const opts = makeOpts($w, []);
    opts.getRecentPointsHistory.mockRejectedValue(new Error('Service down'));
    await initPointsHistoryWidget(MEMBER_ID, opts);
    expect($w('#noHistoryMsg').show).toHaveBeenCalled();
  });

  it('passes memberId to getRecentPointsHistory', async () => {
    const opts = makeOpts($w, []);
    await initPointsHistoryWidget('specific-member', opts);
    expect(opts.getRecentPointsHistory).toHaveBeenCalledWith('specific-member');
  });
});
