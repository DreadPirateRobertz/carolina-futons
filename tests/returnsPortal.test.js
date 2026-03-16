import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkReturnWindow,
  isItemReturnable,
  getStatusTimeline,
  formatReturnStatus,
  getStatusColor,
  validateReturnForm,
  getReturnableItems,
  initReturnsSection,
} from '../src/public/ReturnsPortal.js';
import { colors } from '../src/public/designTokens.js';

vi.mock('backend/returnsService.web', () => ({
  getReturnReasons: vi.fn(),
  getReturnEligibleOrders: vi.fn(),
  submitReturnRequest: vi.fn(),
  getMyReturns: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

import { getReturnReasons, getReturnEligibleOrders, submitReturnRequest, getMyReturns } from 'backend/returnsService.web';

// ── checkReturnWindow ──────────────────────────────────────────

describe('checkReturnWindow', () => {
  it('returns eligible with days remaining for recent order', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const result = checkReturnWindow(twoDaysAgo);
    expect(result.eligible).toBe(true);
    expect(result.daysRemaining).toBe(28);
    expect(result.message).toContain('28 days remaining');
  });

  it('returns ineligible when past 30 days', () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const result = checkReturnWindow(fortyDaysAgo);
    expect(result.eligible).toBe(false);
    expect(result.daysRemaining).toBe(0);
    expect(result.message).toBe('Return period expired');
  });

  it('handles null orderDate', () => {
    const result = checkReturnWindow(null);
    expect(result.eligible).toBe(false);
    expect(result.message).toBe('Order date unavailable');
  });

  it('handles undefined orderDate', () => {
    const result = checkReturnWindow(undefined);
    expect(result.eligible).toBe(false);
    expect(result.message).toBe('Order date unavailable');
  });

  it('handles invalid date string', () => {
    const result = checkReturnWindow('not-a-date');
    expect(result.eligible).toBe(false);
    expect(result.message).toBe('Invalid order date');
  });

  it('accepts ISO date strings', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = checkReturnWindow(recent);
    expect(result.eligible).toBe(true);
    expect(result.daysRemaining).toBe(25);
  });

  it('returns singular "day" for 1 day remaining', () => {
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const result = checkReturnWindow(twentyNineDaysAgo);
    expect(result.eligible).toBe(true);
    expect(result.daysRemaining).toBe(1);
    expect(result.message).toBe('1 day remaining to return');
  });

  it('returns ineligible on exactly 30 days', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = checkReturnWindow(thirtyDaysAgo);
    expect(result.eligible).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });

  it('handles order placed today (day 0)', () => {
    const today = new Date();
    const result = checkReturnWindow(today);
    expect(result.eligible).toBe(true);
    expect(result.daysRemaining).toBe(30);
    expect(result.message).toContain('30 days remaining');
  });
});

// ── isItemReturnable ───────────────────────────────────────────

describe('isItemReturnable', () => {
  it('returns returnable for normal items', () => {
    const result = isItemReturnable({ name: 'Futon Frame', price: 499 });
    expect(result.returnable).toBe(true);
    expect(result.reason).toBe('');
  });

  it('blocks Clearance items', () => {
    const result = isItemReturnable({ name: 'Futon', ribbon: 'Clearance' });
    expect(result.returnable).toBe(false);
    expect(result.reason).toBe('Final sale - no returns');
  });

  it('blocks Final Sale items', () => {
    const result = isItemReturnable({ name: 'Futon', ribbon: 'Final Sale' });
    expect(result.returnable).toBe(false);
    expect(result.reason).toContain('Final sale');
  });

  it('blocks As-Is items', () => {
    const result = isItemReturnable({ name: 'Futon', ribbon: 'As-Is' });
    expect(result.returnable).toBe(false);
  });

  it('blocks Floor Model items', () => {
    const result = isItemReturnable({ name: 'Futon', ribbon: 'Floor Model' });
    expect(result.returnable).toBe(false);
  });

  it('ribbon check is case-insensitive', () => {
    const result = isItemReturnable({ name: 'Futon', ribbon: 'clearance' });
    expect(result.returnable).toBe(false);
  });

  it('blocks custom fabric orders', () => {
    const result = isItemReturnable({ name: 'Futon', customFabric: true });
    expect(result.returnable).toBe(false);
    expect(result.reason).toBe('Custom orders are final sale');
  });

  it('blocks special orders', () => {
    const result = isItemReturnable({ name: 'Futon', specialOrder: true });
    expect(result.returnable).toBe(false);
    expect(result.reason).toBe('Custom orders are final sale');
  });

  it('returns invalid for null item', () => {
    const result = isItemReturnable(null);
    expect(result.returnable).toBe(false);
    expect(result.reason).toBe('Invalid item');
  });

  it('returns invalid for undefined item', () => {
    const result = isItemReturnable(undefined);
    expect(result.returnable).toBe(false);
    expect(result.reason).toBe('Invalid item');
  });

  it('allows items with non-final-sale ribbon', () => {
    const result = isItemReturnable({ name: 'Futon', ribbon: 'Best Seller' });
    expect(result.returnable).toBe(true);
  });
});

// ── getStatusTimeline ──────────────────────────────────────────

describe('getStatusTimeline', () => {
  it('marks requested as active, rest as pending', () => {
    const timeline = getStatusTimeline('requested');
    expect(timeline).toHaveLength(5);
    expect(timeline[0].state).toBe('active');
    expect(timeline[0].key).toBe('requested');
    expect(timeline[1].state).toBe('pending');
    expect(timeline[4].state).toBe('pending');
  });

  it('marks shipped as active with prior steps completed', () => {
    const timeline = getStatusTimeline('shipped');
    expect(timeline[0].state).toBe('completed'); // requested
    expect(timeline[1].state).toBe('completed'); // approved
    expect(timeline[2].state).toBe('active');     // shipped
    expect(timeline[3].state).toBe('pending');    // received
    expect(timeline[4].state).toBe('pending');    // refunded
  });

  it('marks all steps completed for refunded', () => {
    const timeline = getStatusTimeline('refunded');
    expect(timeline[0].state).toBe('completed');
    expect(timeline[1].state).toBe('completed');
    expect(timeline[2].state).toBe('completed');
    expect(timeline[3].state).toBe('completed');
    expect(timeline[4].state).toBe('active');
  });

  it('returns single denied entry for denied status', () => {
    const timeline = getStatusTimeline('denied');
    expect(timeline).toHaveLength(1);
    expect(timeline[0].key).toBe('denied');
    expect(timeline[0].state).toBe('active');
    expect(timeline[0].label).toBe('Return Denied');
  });

  it('handles unknown status — all steps pending', () => {
    const timeline = getStatusTimeline('unknown_status');
    expect(timeline).toHaveLength(5);
    // findIndex returns -1, so no step has index < -1 or === -1 → all pending
    timeline.forEach(step => {
      expect(step.state).toBe('pending');
    });
  });

  it('includes icons for each pipeline step', () => {
    const timeline = getStatusTimeline('requested');
    timeline.forEach(step => {
      expect(step.icon).toBeDefined();
      expect(typeof step.icon).toBe('string');
    });
  });
});

// ── formatReturnStatus ─────────────────────────────────────────

describe('formatReturnStatus', () => {
  it('formats requested status', () => {
    expect(formatReturnStatus('requested')).toBe('Return Initiated');
  });

  it('formats approved status', () => {
    expect(formatReturnStatus('approved')).toBe('Return Label Sent');
  });

  it('formats refunded status', () => {
    expect(formatReturnStatus('refunded')).toBe('Refund Issued');
  });

  it('formats denied status', () => {
    expect(formatReturnStatus('denied')).toBe('Return Denied');
  });

  it('returns raw status for unknown keys', () => {
    expect(formatReturnStatus('pending_review')).toBe('pending_review');
  });

  it('returns Unknown for null/undefined', () => {
    expect(formatReturnStatus(null)).toBe('Unknown');
    expect(formatReturnStatus(undefined)).toBe('Unknown');
  });

  it('returns Unknown for empty string', () => {
    expect(formatReturnStatus('')).toBe('Unknown');
  });
});

// ── getStatusColor ─────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns mountainBlue for requested', () => {
    expect(getStatusColor('requested')).toBe(colors.mountainBlue);
  });

  it('returns mountainBlue for approved', () => {
    expect(getStatusColor('approved')).toBe(colors.mountainBlue);
  });

  it('returns sunsetCoral for shipped', () => {
    expect(getStatusColor('shipped')).toBe(colors.sunsetCoral);
  });

  it('returns success for refunded', () => {
    expect(getStatusColor('refunded')).toBe(colors.success);
  });

  it('returns error for denied', () => {
    expect(getStatusColor('denied')).toBe(colors.error);
  });

  it('returns textMuted for unknown status', () => {
    expect(getStatusColor('something_else')).toBe(colors.textMuted);
  });
});

// ── validateReturnForm ─────────────────────────────────────────

describe('validateReturnForm', () => {
  it('passes with all required fields', () => {
    const result = validateReturnForm({
      orderId: 'order-1',
      items: [{ lineItemId: 'item-1', quantity: 1 }],
      reason: 'wrong_size',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails without orderId', () => {
    const result = validateReturnForm({
      items: [{ lineItemId: 'item-1' }],
      reason: 'damaged',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please select an order');
  });

  it('fails without items', () => {
    const result = validateReturnForm({
      orderId: 'order-1',
      reason: 'damaged',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please select at least one item');
  });

  it('fails with empty items array', () => {
    const result = validateReturnForm({
      orderId: 'order-1',
      items: [],
      reason: 'damaged',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please select at least one item');
  });

  it('fails without reason', () => {
    const result = validateReturnForm({
      orderId: 'order-1',
      items: [{ lineItemId: 'item-1' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Please select a return reason');
  });

  it('collects multiple errors at once', () => {
    const result = validateReturnForm({});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});

// ── getReturnableItems ─────────────────────────────────────────

describe('getReturnableItems', () => {
  it('marks normal items as returnable', () => {
    const items = getReturnableItems([{ name: 'Futon', price: 499 }]);
    expect(items).toHaveLength(1);
    expect(items[0].returnable).toBe(true);
    expect(items[0].returnBlockReason).toBe('');
  });

  it('marks final sale items as not returnable', () => {
    const items = getReturnableItems([{ name: 'Futon', ribbon: 'Clearance' }]);
    expect(items).toHaveLength(1);
    expect(items[0].returnable).toBe(false);
    expect(items[0].returnBlockReason).toBe('Final sale - no returns');
  });

  it('handles mixed items', () => {
    const items = getReturnableItems([
      { name: 'Futon Frame', price: 499 },
      { name: 'Clearance Mattress', ribbon: 'Clearance' },
      { name: 'Custom Sofa', customFabric: true },
    ]);
    expect(items).toHaveLength(3);
    expect(items[0].returnable).toBe(true);
    expect(items[1].returnable).toBe(false);
    expect(items[2].returnable).toBe(false);
  });

  it('returns empty array for non-array input', () => {
    expect(getReturnableItems(null)).toEqual([]);
    expect(getReturnableItems(undefined)).toEqual([]);
    expect(getReturnableItems('string')).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(getReturnableItems([])).toEqual([]);
  });

  it('preserves original item properties', () => {
    const items = getReturnableItems([{ name: 'Futon', price: 499, _id: 'abc' }]);
    expect(items[0].name).toBe('Futon');
    expect(items[0].price).toBe(499);
    expect(items[0]._id).toBe('abc');
  });
});

// ── getStatusColor — additional ────────────────────────────────────

describe('getStatusColor — additional', () => {
  it('returns sunsetCoral for received', () => {
    expect(getStatusColor('received')).toBe(colors.sunsetCoral);
  });
});

// ── getStatusTimeline — additional ─────────────────────────────────

describe('getStatusTimeline — additional', () => {
  it('marks approved as active with requested completed', () => {
    const timeline = getStatusTimeline('approved');
    expect(timeline[0].state).toBe('completed');
    expect(timeline[1].state).toBe('active');
    expect(timeline[2].state).toBe('pending');
  });

  it('marks received as active with prior three completed', () => {
    const timeline = getStatusTimeline('received');
    expect(timeline[0].state).toBe('completed');
    expect(timeline[1].state).toBe('completed');
    expect(timeline[2].state).toBe('completed');
    expect(timeline[3].state).toBe('active');
    expect(timeline[4].state).toBe('pending');
  });

  it('denied timeline has cross icon', () => {
    const timeline = getStatusTimeline('denied');
    expect(timeline[0].icon).toBe('\u2717');
  });
});

// ── initReturnsSection ─────────────────────────────────────────────

describe('initReturnsSection', () => {
  function mock$w() {
    const store = {};
    const $w = (selector) => {
      if (!store[selector]) {
        store[selector] = {
          id: selector, text: '', value: '', style: {},
          onClick: vi.fn(), onChange: vi.fn(),
          show: vi.fn(), hide: vi.fn(),
          expand: vi.fn(), collapse: vi.fn(),
          scrollTo: vi.fn(),
          enable: vi.fn(), disable: vi.fn(),
          label: '', options: [], data: null,
          onItemReady: vi.fn(),
          accessibility: {},
          src: '', alt: '',
        };
      }
      return store[selector];
    };
    $w._store = store;
    return $w;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads return reasons and sets up button handlers', async () => {
    getReturnReasons.mockResolvedValue({
      reasons: [{ label: 'Wrong Size', value: 'wrong_size' }, { label: 'Damaged', value: 'damaged' }],
    });
    getMyReturns.mockResolvedValue({ returns: [] });

    const $w = mock$w();
    await initReturnsSection($w);

    // Reason dropdown should be populated
    expect($w._store['#returnReasonDropdown'].options).toEqual([
      { label: 'Wrong Size', value: 'wrong_size' },
      { label: 'Damaged', value: 'damaged' },
    ]);

    // Start return button should have onClick
    expect($w._store['#startReturnBtn'].onClick).toHaveBeenCalled();

    // Submit and cancel buttons registered
    expect($w._store['#submitReturnBtn'].onClick).toHaveBeenCalled();
    expect($w._store['#cancelReturnBtn'].onClick).toHaveBeenCalled();
  });

  it('sets accessibility labels on buttons', async () => {
    getReturnReasons.mockResolvedValue({ reasons: [] });
    getMyReturns.mockResolvedValue({ returns: [] });

    const $w = mock$w();
    await initReturnsSection($w);

    expect($w._store['#startReturnBtn'].accessibility.ariaLabel).toBe('Start a return');
    expect($w._store['#submitReturnBtn'].accessibility.ariaLabel).toBe('Submit return request');
    expect($w._store['#cancelReturnBtn'].accessibility.ariaLabel).toBe('Cancel return');
  });

  it('hides returns list section when no returns exist', async () => {
    getReturnReasons.mockResolvedValue({ reasons: [] });
    getMyReturns.mockResolvedValue({ returns: [] });

    const $w = mock$w();
    await initReturnsSection($w);

    expect($w._store['#returnsListSection'].hide).toHaveBeenCalled();
  });

  it('renders existing returns in the returns list', async () => {
    getReturnReasons.mockResolvedValue({ reasons: [] });
    getMyReturns.mockResolvedValue({
      returns: [
        { _id: 'r1', rmaNumber: 'RMA-001', orderNumber: '1001', date: '2026-03-01', reason: 'Wrong Size', status: 'requested' },
      ],
    });

    const $w = mock$w();
    await initReturnsSection($w);

    expect($w._store['#returnsListRepeater'].data).toHaveLength(1);
    expect($w._store['#returnsListRepeater'].onItemReady).toHaveBeenCalled();
    expect($w._store['#returnsListSection'].show).toHaveBeenCalled();
  });

  it('onItemReady renders return data in repeater items', async () => {
    getReturnReasons.mockResolvedValue({ reasons: [] });
    getMyReturns.mockResolvedValue({
      returns: [
        { _id: 'r1', rmaNumber: 'RMA-001', orderNumber: '1001', date: '2026-03-01', reason: 'Wrong Size', status: 'approved' },
      ],
    });

    const $w = mock$w();
    await initReturnsSection($w);

    const onItemReadyFn = $w._store['#returnsListRepeater'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    const itemData = { rmaNumber: 'RMA-001', orderNumber: '1001', date: '2026-03-01', reason: 'Wrong Size', status: 'approved' };
    onItemReadyFn($item, itemData);

    expect($item._store['#returnRma'].text).toBe('RMA-001');
    expect($item._store['#returnOrderNum'].text).toBe('Order #1001');
    expect($item._store['#returnDate'].text).toBe('2026-03-01');
    expect($item._store['#returnReason'].text).toBe('Wrong Size');
    expect($item._store['#returnStatusBadge'].text).toBe('Return Label Sent');
    expect($item._store['#returnTimeline'].text).toContain('\u2713'); // completed marker
  });

  it('cancel button hides return flow section', async () => {
    getReturnReasons.mockResolvedValue({ reasons: [] });
    getMyReturns.mockResolvedValue({ returns: [] });

    const $w = mock$w();
    await initReturnsSection($w);

    const cancelHandler = $w._store['#cancelReturnBtn'].onClick.mock.calls[0][0];
    cancelHandler();

    expect($w._store['#returnFlowSection'].hide).toHaveBeenCalled();
  });

  it('does not throw when getReturnReasons fails', async () => {
    getReturnReasons.mockRejectedValue(new Error('backend error'));
    const $w = mock$w();
    await expect(initReturnsSection($w)).resolves.not.toThrow();
  });

  it('start return button triggers showReturnFlow and populates orders', async () => {
    getReturnReasons.mockResolvedValue({ reasons: [] });
    getMyReturns.mockResolvedValue({ returns: [] });
    getReturnEligibleOrders.mockResolvedValue({
      orders: [
        { _id: 'o1', number: '1001', date: '2026-03-10', total: 499, lineItems: [{ _id: 'li1', name: 'Futon', quantity: 1, price: 499 }] },
      ],
    });

    const $w = mock$w();
    await initReturnsSection($w);

    const startHandler = $w._store['#startReturnBtn'].onClick.mock.calls[0][0];
    await startHandler();

    // Order dropdown should be populated
    expect($w._store['#returnOrderDropdown'].options).toHaveLength(1);
    expect($w._store['#returnOrderDropdown'].options[0].label).toContain('1001');
    expect($w._store['#returnFlowSection'].show).toHaveBeenCalled();
  });

  it('shows no-orders message when no eligible orders', async () => {
    getReturnReasons.mockResolvedValue({ reasons: [] });
    getMyReturns.mockResolvedValue({ returns: [] });
    getReturnEligibleOrders.mockResolvedValue({ orders: [] });

    const $w = mock$w();
    await initReturnsSection($w);

    const startHandler = $w._store['#startReturnBtn'].onClick.mock.calls[0][0];
    await startHandler();

    expect($w._store['#returnNoOrders'].text).toContain('No orders eligible');
    expect($w._store['#returnNoOrders'].show).toHaveBeenCalled();
  });

  it('order dropdown onChange populates return items', async () => {
    getReturnReasons.mockResolvedValue({ reasons: [] });
    getMyReturns.mockResolvedValue({ returns: [] });
    const orders = [
      { _id: 'o1', number: '1001', date: new Date(Date.now() - 5 * 86400000).toISOString(), total: 499, lineItems: [{ _id: 'li1', name: 'Futon', quantity: 1, price: 499 }] },
    ];
    getReturnEligibleOrders.mockResolvedValue({ orders });

    const $w = mock$w();
    await initReturnsSection($w);

    const startHandler = $w._store['#startReturnBtn'].onClick.mock.calls[0][0];
    await startHandler();

    // Simulate selecting the order
    $w._store['#returnOrderDropdown'].value = 'o1';
    const changeHandler = $w._store['#returnOrderDropdown'].onChange.mock.calls[0][0];
    changeHandler();

    expect($w._store['#returnItemsRepeater'].data).toHaveLength(1);
    expect($w._store['#returnItemsRepeater'].onItemReady).toHaveBeenCalled();
  });

  it('populateReturnItems renders item details and handles non-returnable items', async () => {
    getReturnReasons.mockResolvedValue({ reasons: [] });
    getMyReturns.mockResolvedValue({ returns: [] });
    const orders = [
      {
        _id: 'o1', number: '1001', date: new Date(Date.now() - 5 * 86400000).toISOString(), total: 998,
        lineItems: [
          { _id: 'li1', name: 'Futon Frame', quantity: 1, price: 499, image: 'futon.jpg' },
          { _id: 'li2', name: 'Clearance Item', quantity: 1, price: 199, ribbon: 'Clearance' },
        ],
      },
    ];
    getReturnEligibleOrders.mockResolvedValue({ orders });

    const $w = mock$w();
    await initReturnsSection($w);

    const startHandler = $w._store['#startReturnBtn'].onClick.mock.calls[0][0];
    await startHandler();

    $w._store['#returnOrderDropdown'].value = 'o1';
    const changeHandler = $w._store['#returnOrderDropdown'].onChange.mock.calls[0][0];
    changeHandler();

    // Simulate onItemReady for returnable item
    const onItemReadyFn = $w._store['#returnItemsRepeater'].onItemReady.mock.calls[0][0];
    const $returnableItem = mock$w();
    onItemReadyFn($returnableItem, { _id: 'li1', name: 'Futon Frame', quantity: 1, price: 499, image: 'futon.jpg', returnable: true, returnBlockReason: '' });

    expect($returnableItem._store['#returnItemName'].text).toBe('Futon Frame');
    expect($returnableItem._store['#returnItemQty'].text).toBe('Qty: 1');
    expect($returnableItem._store['#returnItemPrice'].text).toBe('$499.00');
    expect($returnableItem._store['#returnItemImage'].src).toBe('futon.jpg');
    expect($returnableItem._store['#returnItemCheckbox'].enable).toHaveBeenCalled();

    // Simulate onItemReady for non-returnable item
    const $nonReturnableItem = mock$w();
    onItemReadyFn($nonReturnableItem, { _id: 'li2', name: 'Clearance Item', quantity: 1, price: 199, returnable: false, returnBlockReason: 'Final sale - no returns' });

    expect($nonReturnableItem._store['#returnItemCheckbox'].disable).toHaveBeenCalled();
    expect($nonReturnableItem._store['#returnItemBlockReason'].text).toBe('Final sale - no returns');
    expect($nonReturnableItem._store['#returnItemBlockReason'].show).toHaveBeenCalled();
  });
});
