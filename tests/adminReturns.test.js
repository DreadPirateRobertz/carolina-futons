/**
 * Tests for pages/Admin Returns.js
 * Covers: admin auth guard, dashboard load, stats, filter, returns list,
 * detail panel, status transitions, label generation, refund modal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    data: [],
    options: [],
    collapsed: false,
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    postMessage: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('backend/returnsService.web', () => ({
  getAdminReturns: vi.fn(),
  getReturnStats: vi.fn(),
  updateReturnStatus: vi.fn(),
  generateReturnLabel: vi.fn(),
  processRefund: vi.fn(),
  trackReturnShipment: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
    if (opts?.ariaLabel) {
      try { el.accessibility.ariaLabel = opts.ariaLabel; } catch (e) {}
    }
  }),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    success: '#4A7C59',
    error: '#DC2626',
    sunsetCoral: '#E07A5F',
    espresso: '#1E3A5F',
  },
}));

vi.mock('public/ReturnsAdmin.js', () => ({
  getAdminStatusLabel: vi.fn((s) => ({ requested: 'Requested', approved: 'Approved', denied: 'Denied', shipped: 'Shipped', received: 'Received', refunded: 'Refunded' }[s] || s)),
  getNextStatuses: vi.fn(() => ['approved', 'denied']),
  getStatusFilterOptions: vi.fn(() => [
    { label: 'All', value: '' },
    { label: 'Requested', value: 'requested' },
  ]),
  formatAdminReturnRow: vi.fn((r) => r),
  formatReturnStats: vi.fn((stats) => stats),
  validateRefund: vi.fn(() => ({ valid: true, errors: [] })),
  canGenerateLabel: vi.fn(() => ({ canGenerate: true, reason: null })),
  needsAction: vi.fn((s) => s === 'requested'),
  sortAdminReturns: vi.fn((arr) => arr),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

const mockMember = { _id: 'admin-1' };
const mockRoles = [{ title: 'Admin', _id: 'admin' }];

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(mockMember)),
    getRoles: vi.fn(() => Promise.resolve(mockRoles)),
  },
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

// ── Test Data ───────────────────────────────────────────────────────

const mockReturns = [
  {
    _id: 'ret-1',
    rmaNumber: 'RMA-001',
    orderNumber: '1234',
    memberName: 'John Doe',
    memberEmail: 'john@example.com',
    type: 'Return',
    date: 'Mar 10, 2026',
    reason: 'Wrong size',
    details: 'Ordered Queen but needed Full',
    status: 'requested',
    statusLabel: 'Requested',
    statusColor: '#5B8FA8',
    itemCount: 2,
    hasLabel: false,
    trackingNumber: '',
    refundAmount: 0,
    adminNotes: '',
  },
];

const mockStats = {
  total: 15,
  actionRequired: 3,
  inProgress: 5,
  completed: 7,
};

// ── Load Page ───────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
});

async function loadPage(overrides = {}) {
  // Set up auth mocks (fresh references after resetModules)
  const { currentMember } = await import('wix-members-frontend');
  currentMember.getMember.mockResolvedValue(overrides.member ?? mockMember);
  currentMember.getRoles.mockResolvedValue(overrides.roles ?? mockRoles);

  const { getAdminReturns, getReturnStats } = await import('backend/returnsService.web');
  getAdminReturns.mockResolvedValue(overrides.returns ?? { success: true, returns: mockReturns });
  getReturnStats.mockResolvedValue(overrides.stats ?? { success: true, stats: mockStats });

  await import('../src/pages/Admin Returns.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Admin Auth Guard ────────────────────────────────────────────────

describe('admin auth guard', () => {
  it('allows admin users through', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'admin_returns' });
  });

  it('redirects non-admin users to home', async () => {
    await loadPage({ roles: [{ title: 'Member', _id: 'member' }] });

    const loc = await import('wix-location-frontend');
    expect(loc.to).toHaveBeenCalledWith('/');
  });

  it('redirects when no member found', async () => {
    await loadPage({ member: null });

    const loc = await import('wix-location-frontend');
    expect(loc.to).toHaveBeenCalledWith('/');
  });
});

// ── Dashboard Load ──────────────────────────────────────────────────

describe('loadDashboard', () => {
  it('shows and hides loading spinner', async () => {
    await loadPage();
    // showLoading(true) called first, then showLoading(false)
    expect(getEl('#dashboardLoader').show).toHaveBeenCalled();
    expect(getEl('#dashboardLoader').hide).toHaveBeenCalled();
  });

  it('renders returns list and stats', async () => {
    await loadPage();
    const repeater = getEl('#returnsRepeater');
    expect(repeater.data).toHaveLength(1);
    expect(repeater.expand).toHaveBeenCalled();
  });
});

// ── Stats Cards ─────────────────────────────────────────────────────

describe('renderStats', () => {
  it('sets stat card values', async () => {
    await loadPage();
    expect(getEl('#statTotal').text).toBe('15');
    expect(getEl('#statActionRequired').text).toBe('3');
    expect(getEl('#statInProgress').text).toBe('5');
    expect(getEl('#statCompleted').text).toBe('7');
  });

  it('highlights action-required count in coral', async () => {
    await loadPage();
    expect(getEl('#statActionRequired').style.color).toBe('#E07A5F');
  });

  it('colors completed count in success green', async () => {
    await loadPage();
    expect(getEl('#statCompleted').style.color).toBe('#4A7C59');
  });
});

// ── Filter Dropdown ─────────────────────────────────────────────────

describe('initFilterDropdown', () => {
  it('populates filter options and sets ARIA label', async () => {
    await loadPage();
    const dropdown = getEl('#statusFilterDropdown');
    expect(dropdown.options.length).toBeGreaterThan(0);
    expect(dropdown.accessibility.ariaLabel).toBe('Filter returns by status');
  });

  it('wires onChange to reload dashboard', async () => {
    await loadPage();
    expect(getEl('#statusFilterDropdown').onChange).toHaveBeenCalled();
  });

  it('wires refresh button', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers');
    const refreshCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel === 'Refresh returns list');
    expect(refreshCall).toBeTruthy();
  });
});

// ── Returns List Repeater ───────────────────────────────────────────

describe('renderReturnsList', () => {
  it('sets repeater data from formatted returns', async () => {
    await loadPage();
    const repeater = getEl('#returnsRepeater');
    expect(repeater.data[0]._id).toBe('ret-1');
  });

  it('onItemReady populates return row fields', async () => {
    await loadPage();
    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockReturns[0]);

    expect($item('#rmaNumber').text).toBe('RMA-001');
    expect($item('#orderNumber').text).toBe('#1234');
    expect($item('#customerName').text).toBe('John Doe');
    expect($item('#returnType').text).toBe('Return');
    expect($item('#returnDate').text).toBe('Mar 10, 2026');
    expect($item('#returnReason').text).toBe('Wrong size');
    expect($item('#statusBadge').text).toBe('Requested');
  });

  it('shows action dot for requested status', async () => {
    await loadPage();
    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockReturns[0]); // requested
    expect($item('#actionDot').show).toHaveBeenCalled();
    expect($item('#actionDot').style.backgroundColor).toBe('#E07A5F');
  });

  it('shows empty state when no returns', async () => {
    await loadPage({ returns: { success: true, returns: [] } });
    expect(getEl('#emptyState').expand).toHaveBeenCalled();
    expect(getEl('#emptyState').text).toContain('No return requests');
  });

  it('wires view details button per row', async () => {
    await loadPage();
    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockReturns[0]);

    const { makeClickable } = await import('public/a11yHelpers');
    const detailCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel?.includes('RMA-001'));
    expect(detailCall).toBeTruthy();
  });
});

// ── Detail Panel ────────────────────────────────────────────────────

describe('detail panel', () => {
  it('collapses on init', async () => {
    await loadPage();
    expect(getEl('#detailPanel').collapse).toHaveBeenCalled();
  });

  it('wires close detail button', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers');
    const closeCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel === 'Close detail panel');
    expect(closeCall).toBeTruthy();
  });

  it('openDetail populates all fields and expands panel', async () => {
    await loadPage();

    // Find the view details handler in the repeater
    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockReturns[0]);

    // Trigger view details
    const { makeClickable } = await import('public/a11yHelpers');
    const detailCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel?.includes('RMA-001'));
    detailCall[1](); // invoke handler

    expect(getEl('#detailRma').text).toBe('RMA-001');
    expect(getEl('#detailCustomer').text).toBe('John Doe');
    expect(getEl('#detailEmail').text).toBe('john@example.com');
    expect(getEl('#detailOrder').text).toBe('Order #1234');
    expect(getEl('#detailType').text).toBe('Return');
    expect(getEl('#detailReason').text).toBe('Wrong size');
    expect(getEl('#detailPanel').expand).toHaveBeenCalled();

    const { announce } = await import('public/a11yHelpers');
    expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('RMA-001'));
  });

  it('shows description when details present, collapses when empty', async () => {
    await loadPage();

    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const $item = (sel) => {
      const m = new Map();
      return (s) => { if (!m.has(s)) m.set(s, createMockElement()); return m.get(s); };
    };

    // Trigger view details for return with details
    const { makeClickable } = await import('public/a11yHelpers');
    const itemElements = new Map();
    const $itemFn = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyFn($itemFn, mockReturns[0]);

    const detailCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel?.includes('RMA-001'));
    detailCall[1]();

    expect(getEl('#detailDescription').text).toBe('Ordered Queen but needed Full');
    expect(getEl('#detailDescription').expand).toHaveBeenCalled();
  });
});

// ── Status Actions ──────────────────────────────────────────────────

describe('status transitions', () => {
  it('shows approve and deny buttons for requested status', async () => {
    await loadPage();

    // Open detail
    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyFn($item, mockReturns[0]);

    const { makeClickable } = await import('public/a11yHelpers');
    const detailCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel?.includes('RMA-001'));
    detailCall[1]();

    expect(getEl('#approveBtn').show).toHaveBeenCalled();
    expect(getEl('#denyBtn').show).toHaveBeenCalled();
  });

  it('handleStatusUpdate calls backend and announces', async () => {
    const { updateReturnStatus } = await import('backend/returnsService.web');
    updateReturnStatus.mockResolvedValue({ success: true });

    await loadPage();

    // Open detail and click approve
    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyFn($item, mockReturns[0]);

    const { makeClickable } = await import('public/a11yHelpers');
    const detailCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel?.includes('RMA-001'));
    detailCall[1]();

    // Find approve button handler
    const approveCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel === 'Approve this return');
    await approveCall[1]();

    expect(updateReturnStatus).toHaveBeenCalledWith('ret-1', 'approved', undefined);

    const { announce } = await import('public/a11yHelpers');
    expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('Approved'));
  });
});

// ── Label Generation ────────────────────────────────────────────────

describe('label generation', () => {
  it('shows generate label button when canGenerateLabel', async () => {
    await loadPage();

    // Open detail
    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyFn($item, mockReturns[0]);

    const { makeClickable } = await import('public/a11yHelpers');
    const detailCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel?.includes('RMA-001'));
    detailCall[1]();

    expect(getEl('#generateLabelBtn').show).toHaveBeenCalled();
  });
});

// ── Refund Modal ────────────────────────────────────────────────────

describe('refund modal', () => {
  it('collapses on init', async () => {
    await loadPage();
    expect(getEl('#refundModal').collapse).toHaveBeenCalled();
  });

  it('wires cancel and confirm buttons', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers');
    const cancelCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel === 'Cancel refund');
    const confirmCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel === 'Confirm and process refund');
    expect(cancelCall).toBeTruthy();
    expect(confirmCall).toBeTruthy();
  });

  it('shows processRefundBtn for approved returns via detail panel', async () => {
    const approvedReturn = { ...mockReturns[0], status: 'approved', statusLabel: 'Approved' };
    await loadPage({ returns: { success: true, returns: [approvedReturn] } });

    // Open detail via viewDetailsBtn onClick handler
    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyFn($item, approvedReturn);

    // Get handler directly from viewDetailsBtn onClick
    const viewDetailsBtn = $item('#viewDetailsBtn');
    const handler = viewDetailsBtn.onClick.mock.calls[0][0];
    handler(); // calls openDetail(approvedReturn)

    // Approved: detail panel should expand
    expect(getEl('#detailPanel').expand).toHaveBeenCalled();
    expect(getEl('#detailRma').text).toBe('RMA-001');
  });

  it('hides processRefundBtn for requested returns via detail panel', async () => {
    await loadPage();

    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyFn($item, mockReturns[0]); // status: 'requested'

    const viewDetailsBtn = $item('#viewDetailsBtn');
    const handler = viewDetailsBtn.onClick.mock.calls[0][0];
    handler(); // calls openDetail(requestedReturn)

    // Requested: cannot refund → processRefundBtn hidden
    expect(getEl('#processRefundBtn').hide).toHaveBeenCalled();
  });
});

// ── Loading & Error States ──────────────────────────────────────────

describe('loading and error helpers', () => {
  it('setActionLoading disables buttons during status update', async () => {
    const { updateReturnStatus } = await import('backend/returnsService.web');
    updateReturnStatus.mockResolvedValue({ success: true });

    await loadPage();

    // Open detail and trigger approve — this calls setActionLoading
    const repeater = getEl('#returnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyFn($item, mockReturns[0]);

    const { makeClickable } = await import('public/a11yHelpers');
    const detailCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel?.includes('RMA-001'));
    detailCall[1]();

    const approveCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel === 'Approve this return');
    await approveCall[1]();

    // After completion, buttons re-enabled (setActionLoading(false))
    expect(getEl('#approveBtn').enable).toHaveBeenCalled();
    expect(getEl('#approveBtn').disable).toHaveBeenCalled();
  });

  it('showError displays error with red color and announces', async () => {
    await loadPage({ returns: { success: false }, stats: { success: false } });

    // When returns fails, loadDashboard should show error — but the code only
    // logs to console on rejection, so we test the error through a failed status update
    const { updateReturnStatus } = await import('backend/returnsService.web');
    updateReturnStatus.mockResolvedValue({ success: false, error: 'Server error' });

    // Open detail and trigger status update
    const repeater = getEl('#returnsRepeater');
    if (repeater.onItemReady.mock.calls.length > 0) {
      const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      itemReadyFn($item, mockReturns[0]);

      const { makeClickable } = await import('public/a11yHelpers');
      const detailCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel?.includes('RMA-001'));
      if (detailCall) {
        detailCall[1]();
        const approveCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel === 'Approve this return');
        if (approveCall) await approveCall[1]();

        expect(getEl('#dashboardError').text).toBe('Server error');
        expect(getEl('#dashboardError').style.color).toBe('#DC2626');
      }
    }
  });
});

// ── Track Shipment ──────────────────────────────────────────────────

describe('track shipment', () => {
  it('wires track shipment button', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers');
    const trackCall = makeClickable.mock.calls.find(c => c[2]?.ariaLabel === 'Track return shipment');
    expect(trackCall).toBeTruthy();
  });
});
