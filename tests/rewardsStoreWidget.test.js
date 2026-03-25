import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initRewardsStoreWidget } from 'public/RewardsStoreWidget.js';

// ── $w mock ───────────────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    label: '',
    data: [],
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    forEachItem: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

function mock$w(sel) { return getEl(sel); }

// ── Test data ─────────────────────────────────────────────────────────────────

const CATALOG = [
  { rewardId: 'discount-5', name: '$5 Off', description: '$5 off your next order', pointsCost: 500, type: 'DISCOUNT_5', value: 5, stock: null, imageUrl: 'img1.jpg' },
  { rewardId: 'discount-15', name: '$15 Off', description: '$15 off your next order', pointsCost: 1200, type: 'DISCOUNT_15', value: 15, stock: 10, imageUrl: 'img2.jpg' },
  { rewardId: 'free-shipping', name: 'Free Shipping', description: 'Free shipping on next order', pointsCost: 800, type: 'FREE_SHIPPING', value: 0, stock: null, imageUrl: null },
  { rewardId: 'double-points', name: '2x Points (24h)', description: 'Double points for 24 hours', pointsCost: 600, type: 'DOUBLE_POINTS_24H', value: 0, stock: 5, imageUrl: 'img4.jpg' },
  { rewardId: 'early-access', name: 'Early Access', description: 'Exclusive early access to sales', pointsCost: 2000, type: 'EXCLUSIVE_EARLY_ACCESS', value: 0, stock: 3, imageUrl: 'img5.jpg' },
];

const HISTORY = [
  { rewardId: 'discount-5', redeemedAt: '2026-03-20T10:00:00Z', couponCode: 'CF-ABC123', status: 'active' },
  { rewardId: 'free-shipping', redeemedAt: '2026-03-15T08:00:00Z', couponCode: 'CF-DEF456', status: 'used' },
];

// ── Helper: trigger item ready + get item scope ───────────────────────────────

function callOnItemReady(itemData) {
  const onItemReadyCb = getEl('#storeRepeater').onItemReady.mock.calls[0][0];
  const itemElements = new Map();
  const $item = (sel) => {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  };
  $item._elements = itemElements;
  onItemReadyCb($item, itemData);
  return $item;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RewardsStoreWidget (CF-n932)', () => {
  let getRewardsCatalog, redeemReward, getRedemptionHistory;

  beforeEach(() => {
    elements.clear();
    getRewardsCatalog = vi.fn().mockResolvedValue(CATALOG);
    redeemReward = vi.fn().mockResolvedValue({ success: true, couponCode: 'CF-NEW789', newBalance: 500 });
    getRedemptionHistory = vi.fn().mockResolvedValue(HISTORY);
  });

  async function init(memberId = 'member-1', overrides = {}) {
    await initRewardsStoreWidget(memberId, {
      getRewardsCatalog,
      redeemReward,
      getRedemptionHistory,
      $w: mock$w,
      initialBalance: 1000,
      ...overrides,
    });
  }

  it('sets #storeTitle to "Rewards Store"', async () => {
    await init();
    expect(getEl('#storeTitle').text).toBe('Rewards Store');
  });

  it('displays current balance', async () => {
    await init();
    expect(getEl('#storeBalance').text).toBe('Your balance: 1,000 pts');
  });

  it('renders all catalog items in repeater', async () => {
    await init();
    const repeater = getEl('#storeRepeater');
    expect(repeater.data).toHaveLength(5);
    expect(repeater.data.map(d => d._id)).toEqual([
      'discount-5', 'discount-15', 'free-shipping', 'double-points', 'early-access',
    ]);
  });

  it('registers onItemReady before setting data', async () => {
    await init();
    expect(getEl('#storeRepeater').onItemReady).toHaveBeenCalled();
  });

  it('registers modal handlers exactly once during init', async () => {
    await init();
    expect(getEl('#modalConfirmBtn').onClick).toHaveBeenCalledTimes(1);
    expect(getEl('#modalCancelBtn').onClick).toHaveBeenCalledTimes(1);
  });

  describe('onItemReady callback', () => {
    beforeEach(async () => {
      await init();
    });

    it('sets reward name, description, and cost', () => {
      const $item = callOnItemReady(CATALOG[0]);
      expect($item('#rewardName').text).toBe('$5 Off');
      expect($item('#rewardDesc').text).toBe('$5 off your next order');
      expect($item('#rewardCost').text).toBe('500 pts');
    });

    it('sets reward image when available', () => {
      const $item = callOnItemReady(CATALOG[0]);
      expect($item('#rewardImage').src).toBe('img1.jpg');
    });

    it('shows "Unlimited" for null stock', () => {
      const $item = callOnItemReady(CATALOG[0]); // stock: null
      expect($item('#rewardStock').text).toBe('Unlimited');
    });

    it('shows stock count for limited items', () => {
      const $item = callOnItemReady(CATALOG[1]); // stock: 10
      expect($item('#rewardStock').text).toBe('10 left');
    });

    it('enables redeem button when balance is sufficient', () => {
      const $item = callOnItemReady(CATALOG[0]); // 500 pts, balance is 1000
      const btn = $item('#rewardRedeemBtn');
      expect(btn.label).toBe('Redeem');
      expect(btn.enable).toHaveBeenCalled();
    });

    it('disables redeem button when balance is insufficient', () => {
      const $item = callOnItemReady(CATALOG[1]); // 1200 pts, balance is 1000
      const btn = $item('#rewardRedeemBtn');
      expect(btn.label).toBe('Not enough points');
      expect(btn.disable).toHaveBeenCalled();
    });

    it('registers onClick on redeem button', () => {
      const $item = callOnItemReady(CATALOG[0]);
      expect($item('#rewardRedeemBtn').onClick).toHaveBeenCalled();
    });
  });

  describe('redeem flow', () => {
    it('shows confirmation modal on redeem click', async () => {
      await init();
      const $item = callOnItemReady(CATALOG[0]);
      await $item('#rewardRedeemBtn').onClick.mock.calls[0][0]();
      expect(getEl('#storeRedeemModal').text).toContain('$5 Off');
      expect(getEl('#storeRedeemModal').show).toHaveBeenCalled();
    });

    it('calls redeemReward on modal confirm', async () => {
      await init();
      const $item = callOnItemReady(CATALOG[0]);
      await $item('#rewardRedeemBtn').onClick.mock.calls[0][0]();
      // Modal confirm handler registered once during init
      await getEl('#modalConfirmBtn').onClick.mock.calls[0][0]();
      expect(redeemReward).toHaveBeenCalledWith('member-1', 'discount-5');
    });

    it('shows coupon code on successful redeem', async () => {
      await init();
      const $item = callOnItemReady(CATALOG[0]);
      await $item('#rewardRedeemBtn').onClick.mock.calls[0][0]();
      await getEl('#modalConfirmBtn').onClick.mock.calls[0][0]();
      expect(getEl('#storeStatus').text).toContain('CF-NEW789');
    });

    it('updates balance after successful redeem', async () => {
      await init();
      const $item = callOnItemReady(CATALOG[0]);
      await $item('#rewardRedeemBtn').onClick.mock.calls[0][0]();
      await getEl('#modalConfirmBtn').onClick.mock.calls[0][0]();
      expect(getEl('#storeBalance').text).toBe('Your balance: 500 pts');
    });

    it('hides modal on cancel', async () => {
      await init();
      const $item = callOnItemReady(CATALOG[0]);
      await $item('#rewardRedeemBtn').onClick.mock.calls[0][0]();
      // Cancel handler registered once during init
      getEl('#modalCancelBtn').onClick.mock.calls[0][0]();
      expect(getEl('#storeRedeemModal').hide).toHaveBeenCalled();
    });

    it('shows error on failed redeem', async () => {
      redeemReward.mockResolvedValue({ success: false, error: 'Insufficient points' });
      await init();
      const $item = callOnItemReady(CATALOG[0]);
      await $item('#rewardRedeemBtn').onClick.mock.calls[0][0]();
      await getEl('#modalConfirmBtn').onClick.mock.calls[0][0]();
      expect(getEl('#storeStatus').text).toBe('Insufficient points');
    });

    it('shows error on redeem exception', async () => {
      redeemReward.mockRejectedValue(new Error('Network error'));
      await init();
      const $item = callOnItemReady(CATALOG[0]);
      await $item('#rewardRedeemBtn').onClick.mock.calls[0][0]();
      await getEl('#modalConfirmBtn').onClick.mock.calls[0][0]();
      expect(getEl('#storeStatus').text).toContain('Redemption failed');
    });

    it('does not double-spend: redeem → cancel → redeem → confirm calls backend once', async () => {
      await init();
      const $item = callOnItemReady(CATALOG[0]);
      const clickRedeem = $item('#rewardRedeemBtn').onClick.mock.calls[0][0];
      const clickConfirm = getEl('#modalConfirmBtn').onClick.mock.calls[0][0];
      const clickCancel = getEl('#modalCancelBtn').onClick.mock.calls[0][0];

      // First: click redeem, then cancel
      await clickRedeem();
      clickCancel();

      // Second: click redeem again, then confirm
      await clickRedeem();
      await clickConfirm();

      // Backend should only be called once (the second attempt)
      expect(redeemReward).toHaveBeenCalledTimes(1);
    });

    it('confirm without pending redeem is a no-op', async () => {
      await init();
      // Click confirm without clicking any redeem button first
      await getEl('#modalConfirmBtn').onClick.mock.calls[0][0]();
      expect(redeemReward).not.toHaveBeenCalled();
    });
  });

  describe('redemption history', () => {
    it('shows history when redemptions exist', async () => {
      await init();
      const historyEl = getEl('#storeHistory');
      expect(historyEl.text).toContain('CF-ABC123');
      expect(historyEl.text).toContain('CF-DEF456');
      expect(historyEl.show).toHaveBeenCalled();
    });

    it('collapses history when no redemptions', async () => {
      getRedemptionHistory.mockResolvedValue([]);
      await init();
      expect(getEl('#storeHistory').collapse).toHaveBeenCalled();
    });

    it('collapses history on error', async () => {
      getRedemptionHistory.mockRejectedValue(new Error('fail'));
      await init();
      expect(getEl('#storeHistory').collapse).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('shows error when catalog fails to load', async () => {
      getRewardsCatalog.mockRejectedValue(new Error('Network error'));
      await init();
      expect(getEl('#storeStatus').text).toContain('Unable to load rewards');
      expect(getEl('#storeRepeater').collapse).toHaveBeenCalled();
    });

    it('shows message when catalog is empty', async () => {
      getRewardsCatalog.mockResolvedValue([]);
      await init();
      expect(getEl('#storeStatus').text).toContain('No rewards available');
    });

    it('does not throw on any error path', async () => {
      getRewardsCatalog.mockRejectedValue(new Error('fail'));
      await expect(init()).resolves.toBeUndefined();
    });
  });
});
