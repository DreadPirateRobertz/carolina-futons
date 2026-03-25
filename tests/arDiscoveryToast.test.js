/**
 * arDiscoveryToast.test.js
 * CF-0gly — AR-to-Gamification bridge: first AR session discovery bonus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showARDiscoveryToast } from 'public/ARDiscoveryToast.js';

// ── $w mock ───────────────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

function mock$w(sel) { return getEl(sel); }

// ── Storage mock ──────────────────────────────────────────────────────────────

function createMockStorage() {
  const store = new Map();
  return {
    getItem: vi.fn(k => store.get(k) ?? null),
    setItem: vi.fn((k, v) => store.set(k, v)),
    removeItem: vi.fn(k => store.delete(k)),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ARDiscoveryToast (CF-0gly)', () => {
  let receiveGamificationEvent;
  let storage;

  beforeEach(() => {
    elements.clear();
    storage = createMockStorage();
    receiveGamificationEvent = vi.fn().mockResolvedValue({
      success: true,
      pointsEarned: 25,
      newTotal: 125,
    });
  });

  async function init(memberId = 'mem-1', overrides = {}) {
    return showARDiscoveryToast(memberId, {
      $w: mock$w,
      receiveGamificationEvent,
      storage,
      ...overrides,
    });
  }

  it('calls receiveGamificationEvent with ar_discovery event', async () => {
    await init();
    expect(receiveGamificationEvent).toHaveBeenCalledWith(
      'gamification_ar_discovery',
      {},
      'mem-1',
    );
  });

  it('returns awarded: true with pointsEarned on first use', async () => {
    const result = await init();
    expect(result.awarded).toBe(true);
    expect(result.pointsEarned).toBe(25);
  });

  it('shows toast with points message', async () => {
    await init();
    expect(getEl('#arDiscoveryText').text).toContain('25 points');
    expect(getEl('#arDiscoveryToast').show).toHaveBeenCalled();
  });

  it('registers dismiss handler', async () => {
    await init();
    expect(getEl('#arDiscoveryDismiss').onClick).toHaveBeenCalled();
  });

  it('dismiss handler hides toast', async () => {
    await init();
    const dismissHandler = getEl('#arDiscoveryDismiss').onClick.mock.calls[0][0];
    dismissHandler();
    expect(getEl('#arDiscoveryToast').hide).toHaveBeenCalled();
  });

  it('sets localStorage key after awarding', async () => {
    await init();
    expect(storage.setItem).toHaveBeenCalledWith('ar_discovery_awarded', '1');
  });

  it('skips backend call when localStorage shows already awarded', async () => {
    storage.getItem.mockReturnValue('1');
    const result = await init();
    expect(result.awarded).toBe(false);
    expect(result.reason).toBe('already_shown');
    expect(receiveGamificationEvent).not.toHaveBeenCalled();
  });

  it('returns already_earned when backend returns 0 points', async () => {
    receiveGamificationEvent.mockResolvedValue({ success: true, pointsEarned: 0 });
    const result = await init();
    expect(result.awarded).toBe(false);
    expect(result.reason).toBe('already_earned');
  });

  it('does not show toast when 0 points earned', async () => {
    receiveGamificationEvent.mockResolvedValue({ success: true, pointsEarned: 0 });
    await init();
    expect(getEl('#arDiscoveryToast').show).not.toHaveBeenCalled();
  });

  it('still sets localStorage when 0 points (prevents repeated calls)', async () => {
    receiveGamificationEvent.mockResolvedValue({ success: true, pointsEarned: 0 });
    await init();
    expect(storage.setItem).toHaveBeenCalledWith('ar_discovery_awarded', '1');
  });

  it('returns error on backend failure', async () => {
    receiveGamificationEvent.mockRejectedValue(new Error('Network'));
    const result = await init();
    expect(result.awarded).toBe(false);
    expect(result.reason).toBe('error');
  });

  it('does not throw on any error path', async () => {
    receiveGamificationEvent.mockRejectedValue(new Error('fail'));
    await expect(init()).resolves.toBeDefined();
  });
});
