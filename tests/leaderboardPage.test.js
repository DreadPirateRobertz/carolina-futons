import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/leaderboardService.web', () => ({
  getLeaderboardByPeriod: vi.fn(),
  getMyRank: vi.fn(),
}));

const elements = new Map();
function makeEl() {
  return {
    text: '', style: { backgroundColor: '' }, data: null,
    show: vi.fn(), hide: vi.fn(),
    onClick: vi.fn(), onItemReady: vi.fn(),
  };
}
function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, makeEl());
  return elements.get(sel);
}
let onReadyHandler = null;
globalThis.$w = Object.assign((sel) => getEl(sel), { onReady: (fn) => { onReadyHandler = fn; } });

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  vi.resetModules();
  onReadyHandler = null;
});

async function loadPage() {
  const mod = await import('../src/pages/Leaderboard.js');
  return mod;
}

describe('Leaderboard page', () => {
  it('registers onReady and wires period toggle buttons', async () => {
    const { getLeaderboardByPeriod } = await import('backend/leaderboardService.web');
    getLeaderboardByPeriod.mockResolvedValue([]);
    await loadPage();
    await onReadyHandler();
    expect(getEl('#btnAllTime').onClick).toHaveBeenCalled();
    expect(getEl('#btnWeekly').onClick).toHaveBeenCalled();
  });

  it('shows empty state when no entries', async () => {
    const { getLeaderboardByPeriod } = await import('backend/leaderboardService.web');
    getLeaderboardByPeriod.mockResolvedValue([]);
    await loadPage();
    await onReadyHandler();
    expect(getEl('#leaderboardEmpty').show).toHaveBeenCalled();
  });

  it('populates repeater when entries returned', async () => {
    const { getLeaderboardByPeriod } = await import('backend/leaderboardService.web');
    getLeaderboardByPeriod.mockResolvedValue([
      { rank: 1, displayName: 'Alice', points: 1234, tier: 'Gold' },
    ]);
    await loadPage();
    await onReadyHandler();
    expect(getEl('#leaderboardRepeater').data).toHaveLength(1);
    expect(getEl('#leaderboardRepeater').onItemReady).toHaveBeenCalled();
  });

  it('onItemReady populates item fields incl. defaults for missing name/tier', async () => {
    const { getLeaderboardByPeriod } = await import('backend/leaderboardService.web');
    getLeaderboardByPeriod.mockResolvedValue([{ rank: 2, points: 500 }]);
    await loadPage();
    await onReadyHandler();
    const cb = getEl('#leaderboardRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (s) => { if (!itemEls.has(s)) itemEls.set(s, makeEl()); return itemEls.get(s); };
    cb($item, { rank: 2, points: 500 });
    expect(itemEls.get('#rankText').text).toBe('2');
    expect(itemEls.get('#memberName').text).toBe('Anonymous');
    expect(itemEls.get('#memberPoints').text).toBe('500 pts');
    expect(itemEls.get('#memberTier').text).toBe('');
  });

  it('onItemReady uses provided displayName and tier when present', async () => {
    const { getLeaderboardByPeriod } = await import('backend/leaderboardService.web');
    getLeaderboardByPeriod.mockResolvedValue([{ rank: 1, points: 100, displayName: 'Bob', tier: 'Silver' }]);
    await loadPage();
    await onReadyHandler();
    const cb = getEl('#leaderboardRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (s) => { if (!itemEls.has(s)) itemEls.set(s, makeEl()); return itemEls.get(s); };
    cb($item, { rank: 1, points: 100, displayName: 'Bob', tier: 'Silver' });
    expect(itemEls.get('#memberName').text).toBe('Bob');
    expect(itemEls.get('#memberTier').text).toBe('Silver');
  });

  it('handles non-array response gracefully', async () => {
    const { getLeaderboardByPeriod } = await import('backend/leaderboardService.web');
    getLeaderboardByPeriod.mockResolvedValue(null);
    await loadPage();
    await onReadyHandler();
    expect(getEl('#leaderboardEmpty').show).toHaveBeenCalled();
  });

  it('switchPeriod no-ops when period unchanged', async () => {
    const { getLeaderboardByPeriod } = await import('backend/leaderboardService.web');
    getLeaderboardByPeriod.mockResolvedValue([]);
    await loadPage();
    await onReadyHandler();
    const cb = getEl('#btnAllTime').onClick.mock.calls[0][0];
    getLeaderboardByPeriod.mockClear();
    await cb(); // same period
    expect(getLeaderboardByPeriod).not.toHaveBeenCalled();
  });

  it('switchPeriod reloads on change and toggles style', async () => {
    const { getLeaderboardByPeriod } = await import('backend/leaderboardService.web');
    getLeaderboardByPeriod.mockResolvedValue([]);
    await loadPage();
    await onReadyHandler();
    const weeklyCb = getEl('#btnWeekly').onClick.mock.calls[0][0];
    getLeaderboardByPeriod.mockClear();
    await weeklyCb();
    expect(getLeaderboardByPeriod).toHaveBeenCalledWith('weekly', 20);
    expect(getEl('#btnWeekly').style.backgroundColor).toBe('#333');
    expect(getEl('#btnAllTime').style.backgroundColor).toBe('#eee');
  });

  it('hides myRankSection when no memberId', async () => {
    const { getLeaderboardByPeriod, getMyRank } = await import('backend/leaderboardService.web');
    getLeaderboardByPeriod.mockResolvedValue([]);
    await loadPage();
    await onReadyHandler();
    expect(getMyRank).not.toHaveBeenCalled();
    expect(getEl('#myRankSection').hide).toHaveBeenCalled();
  });
});
