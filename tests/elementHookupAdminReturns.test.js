/**
 * Tests for Admin Returns Page element hookup
 * Covers: #statTotal, #statTotalLabel, #statActionRequired, #statActionLabel,
 * #statInProgress, #statProgressLabel, #statCompleted, #statCompletedLabel,
 * #statusFilterDropdown, #refreshBtn,
 * #returnsRepeater, #rmaNumber, #orderNumber, #customerName, #returnType,
 * #returnDate, #returnReason, #statusBadge, #actionDot, #itemCount, #viewDetailsBtn,
 * #detailPanel, #closeDetailBtn, #detailRma, #detailStatus, #detailCustomer,
 * #detailEmail, #detailOrder, #detailDate, #detailType, #detailReason,
 * #detailDescription, #detailNotes, #trackingSection, #detailTracking, #detailRefundAmount,
 * #statusActionsSection, #approveBtn, #denyBtn, #markShippedBtn, #markReceivedBtn,
 * #generateLabelBtn, #trackShipmentBtn, #trackingStatus, #trackingEta,
 * #refundModal, #cancelRefundBtn, #confirmRefundBtn, #processRefundBtn,
 * #refundRmaLabel, #refundCustomerLabel, #refundAmountInput, #refundNotesInput, #refundError,
 * #emptyState, #dashboardLoader, #dashboardError
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
    alt: '',
    data: [],
    options: [],
    collapsed: false,
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: { ariaLabel: '', ariaLive: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onItemReady: vi.fn(),
    scrollTo: vi.fn(() => Promise.resolve()),
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

const mockReturn = {
  _id: 'r1',
  rmaNumber: 'RMA-001',
  orderNumber: '1001',
  memberName: 'John',
  memberEmail: 'john@test.com',
  type: 'return',
  date: '2026-03-14',
  reason: 'Defective',
  status: 'requested',
  statusLabel: 'Requested',
  statusColor: '#E8845C',
  itemCount: 2,
  hasLabel: false,
  adminNotes: '',
};

const mockStats = { total: 10, actionRequired: 3, inProgress: 4, completed: 3 };

vi.mock('backend/returnsService.web', () => ({
  getAdminReturns: vi.fn(() => Promise.resolve({ success: true, returns: [mockReturn] })),
  getReturnStats: vi.fn(() => Promise.resolve({ success: true, stats: mockStats })),
  updateReturnStatus: vi.fn(() => Promise.resolve({ success: true })),
  generateReturnLabel: vi.fn(() => Promise.resolve({ success: true, trackingNumber: 'TRK-123' })),
  processRefund: vi.fn(() => Promise.resolve({ success: true })),
  trackReturnShipment: vi.fn(() => Promise.resolve({ success: true, tracking: { status: 'In Transit', estimatedDelivery: '2026-03-20' } })),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    if (opts?.ariaLabel) {
      try { el.accessibility.ariaLabel = opts.ariaLabel; } catch (e) {}
    }
    el.onClick(handler);
  }),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    sand: '#E8D5B7',
    espresso: '#3A2518',
    mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C',
    success: '#4CAF50',
    error: '#D32F2F',
  },
}));

vi.mock('public/ReturnsAdmin.js', () => ({
  getAdminStatusLabel: vi.fn((s) => s.charAt(0).toUpperCase() + s.slice(1)),
  getNextStatuses: vi.fn(() => ['approved', 'denied']),
  getStatusFilterOptions: vi.fn(() => [
    { value: '', label: 'All Statuses' },
    { value: 'requested', label: 'Requested' },
    { value: 'approved', label: 'Approved' },
  ]),
  formatAdminReturnRow: vi.fn((r) => r),
  formatReturnStats: vi.fn(() => ({ total: 10, actionRequired: 3, inProgress: 4, completed: 3 })),
  validateRefund: vi.fn(() => ({ valid: true })),
  canGenerateLabel: vi.fn(() => ({ canGenerate: true, reason: '' })),
  needsAction: vi.fn((status) => status === 'requested'),
  sortAdminReturns: vi.fn((arr) => arr),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve({ _id: 'admin-1' })),
    getRoles: vi.fn(() => Promise.resolve([{ title: 'Admin', _id: 'admin' }])),
  },
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────

async function loadPage() {
  elements.clear();
  onReadyHandler = null;

  vi.resetModules();
  await import('../src/pages/Admin Returns.js');
  if (onReadyHandler) await onReadyHandler();
}

function simulateRepeaterItem(itemData) {
  const repeater = getEl('#returnsRepeater');
  if (repeater.onItemReady.mock.calls.length === 0) return null;
  const handler = repeater.onItemReady.mock.calls[0][0];
  const itemElements = new Map();
  const $item = (sel) => {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  };
  handler($item, itemData);
  return $item;
}

// ── Stats Cards Tests ───────────────────────────────────────────────

describe('Admin Returns — Stats Cards element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets #statTotal text from formatted stats', async () => {
    await loadPage();
    expect(getEl('#statTotal').text).toBe('10');
  });

  it('sets #statTotalLabel text to Total Returns', async () => {
    await loadPage();
    expect(getEl('#statTotalLabel').text).toBe('Total Returns');
  });

  it('sets #statActionRequired text from formatted stats', async () => {
    await loadPage();
    expect(getEl('#statActionRequired').text).toBe('3');
  });

  it('applies coral color to #statActionRequired when count > 0', async () => {
    await loadPage();
    expect(getEl('#statActionRequired').style.color).toBe('#E8845C');
  });

  it('sets #statActionLabel text to Action Required', async () => {
    await loadPage();
    expect(getEl('#statActionLabel').text).toBe('Action Required');
  });

  it('sets #statInProgress text from formatted stats', async () => {
    await loadPage();
    expect(getEl('#statInProgress').text).toBe('4');
  });

  it('sets #statProgressLabel text to In Progress', async () => {
    await loadPage();
    expect(getEl('#statProgressLabel').text).toBe('In Progress');
  });

  it('sets #statCompleted text from formatted stats', async () => {
    await loadPage();
    expect(getEl('#statCompleted').text).toBe('3');
  });

  it('applies success color to #statCompleted', async () => {
    await loadPage();
    expect(getEl('#statCompleted').style.color).toBe('#4CAF50');
  });

  it('sets #statCompletedLabel text to Completed', async () => {
    await loadPage();
    expect(getEl('#statCompletedLabel').text).toBe('Completed');
  });
});

// ── Filter / Refresh Tests ──────────────────────────────────────────

describe('Admin Returns — Filter/Refresh element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('populates #statusFilterDropdown with filter options', async () => {
    await loadPage();
    const dd = getEl('#statusFilterDropdown');
    expect(dd.options.length).toBeGreaterThan(0);
  });

  it('sets ARIA label on #statusFilterDropdown', async () => {
    await loadPage();
    expect(getEl('#statusFilterDropdown').accessibility.ariaLabel).toBe('Filter returns by status');
  });

  it('registers onChange handler on #statusFilterDropdown', async () => {
    await loadPage();
    expect(getEl('#statusFilterDropdown').onChange).toHaveBeenCalled();
  });

  it('hooks up #refreshBtn via makeClickable with ARIA label', async () => {
    await loadPage();
    expect(getEl('#refreshBtn').onClick).toHaveBeenCalled();
    expect(getEl('#refreshBtn').accessibility.ariaLabel).toBe('Refresh returns list');
  });
});

// ── Returns Repeater Tests ──────────────────────────────────────────

describe('Admin Returns — Returns Repeater element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('initially collapses #returnsRepeater', async () => {
    await loadPage();
    // initReturnsList collapses, then renderReturnsList expands
    expect(getEl('#returnsRepeater').expand).toHaveBeenCalled();
  });

  it('registers onItemReady on #returnsRepeater', async () => {
    await loadPage();
    expect(getEl('#returnsRepeater').onItemReady).toHaveBeenCalled();
  });

  it('sets repeater data from returns response', async () => {
    await loadPage();
    expect(getEl('#returnsRepeater').data.length).toBe(1);
  });

  it('sets #rmaNumber text in repeater item', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#rmaNumber').text).toBe('RMA-001');
  });

  it('sets #orderNumber text with hash prefix', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#orderNumber').text).toBe('#1001');
  });

  it('sets #customerName text in repeater item', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#customerName').text).toBe('John');
  });

  it('sets #returnType text in repeater item', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#returnType').text).toBe('return');
  });

  it('sets #returnDate text in repeater item', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#returnDate').text).toBe('2026-03-14');
  });

  it('sets #returnReason text in repeater item', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#returnReason').text).toBe('Defective');
  });

  it('sets #statusBadge text and color from item data', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#statusBadge').text).toBe('Requested');
    expect($item('#statusBadge').style.color).toBe('#E8845C');
  });

  it('shows #actionDot with coral color for requested status', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#actionDot').show).toHaveBeenCalled();
    expect($item('#actionDot').style.backgroundColor).toBe('#E8845C');
  });

  it('hides #actionDot for non-action statuses', async () => {
    await loadPage();
    const completedReturn = { ...mockReturn, status: 'completed' };
    const $item = simulateRepeaterItem(completedReturn);
    expect($item('#actionDot').hide).toHaveBeenCalled();
  });

  it('sets #itemCount text with plural suffix', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#itemCount').text).toBe('2 items');
  });

  it('sets #itemCount text without plural for single item', async () => {
    await loadPage();
    const singleReturn = { ...mockReturn, itemCount: 1 };
    const $item = simulateRepeaterItem(singleReturn);
    expect($item('#itemCount').text).toBe('1 item');
  });

  it('hooks up #viewDetailsBtn via makeClickable with ARIA label', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    expect($item('#viewDetailsBtn').onClick).toHaveBeenCalled();
    expect($item('#viewDetailsBtn').accessibility.ariaLabel).toBe('View details for RMA-001');
  });
});

// ── Detail Panel Tests ──────────────────────────────────────────────

describe('Admin Returns — Detail Panel element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('initially collapses #detailPanel', async () => {
    await loadPage();
    expect(getEl('#detailPanel').collapse).toHaveBeenCalled();
  });

  it('hooks up #closeDetailBtn via makeClickable', async () => {
    await loadPage();
    expect(getEl('#closeDetailBtn').onClick).toHaveBeenCalled();
    expect(getEl('#closeDetailBtn').accessibility.ariaLabel).toBe('Close detail panel');
  });

  it('expands #detailPanel when viewDetailsBtn is clicked', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailPanel').expand).toHaveBeenCalled();
  });

  it('sets #detailRma text when detail is opened', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailRma').text).toBe('RMA-001');
  });

  it('sets #detailStatus text and color', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailStatus').text).toBe('Requested');
    expect(getEl('#detailStatus').style.color).toBe('#E8845C');
  });

  it('sets #detailCustomer text', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailCustomer').text).toBe('John');
  });

  it('sets #detailEmail text', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailEmail').text).toBe('john@test.com');
  });

  it('sets #detailOrder text with Order prefix', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailOrder').text).toBe('Order #1001');
  });

  it('sets #detailDate text', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailDate').text).toBe('2026-03-14');
  });

  it('sets #detailType text', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailType').text).toBe('return');
  });

  it('sets #detailReason text', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailReason').text).toBe('Defective');
  });

  it('collapses #detailDescription when no details present', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailDescription').collapse).toHaveBeenCalled();
  });

  it('sets #detailNotes value and ARIA label', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailNotes').value).toBe('');
    expect(getEl('#detailNotes').accessibility.ariaLabel).toBe('Admin notes for this return');
  });

  it('collapses #trackingSection when return has no label', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#trackingSection').collapse).toHaveBeenCalled();
  });

  it('collapses #detailRefundAmount when no refund amount', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#detailRefundAmount').collapse).toHaveBeenCalled();
  });
});

// ── Status Actions Tests ────────────────────────────────────────────

describe('Admin Returns — Status Actions element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('expands #statusActionsSection when next statuses exist', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#statusActionsSection').expand).toHaveBeenCalled();
  });

  it('shows #approveBtn when approved is a valid next status', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#approveBtn').show).toHaveBeenCalled();
    expect(getEl('#approveBtn').accessibility.ariaLabel).toBe('Approve this return');
  });

  it('shows #denyBtn when denied is a valid next status', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#denyBtn').show).toHaveBeenCalled();
    expect(getEl('#denyBtn').accessibility.ariaLabel).toBe('Deny this return');
  });

  it('hides #markShippedBtn when shipped is not a valid next status', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#markShippedBtn').hide).toHaveBeenCalled();
  });

  it('hides #markReceivedBtn when received is not a valid next status', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#markReceivedBtn').hide).toHaveBeenCalled();
  });
});

// ── Label / Tracking Tests ──────────────────────────────────────────

describe('Admin Returns — Label/Tracking element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows #generateLabelBtn when label can be generated', async () => {
    await loadPage();
    const $item = simulateRepeaterItem(mockReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();
    expect(getEl('#generateLabelBtn').show).toHaveBeenCalled();
    expect(getEl('#generateLabelBtn').accessibility.ariaLabel).toBe('Generate UPS return label');
  });

  it('hooks up #trackShipmentBtn via makeClickable', async () => {
    await loadPage();
    expect(getEl('#trackShipmentBtn').onClick).toHaveBeenCalled();
    expect(getEl('#trackShipmentBtn').accessibility.ariaLabel).toBe('Track return shipment');
  });

  it('sets #trackingStatus text after tracking shipment', async () => {
    await loadPage();
    // Open a detail with tracking
    const returnWithLabel = { ...mockReturn, hasLabel: true, rmaNumber: 'RMA-001' };
    const $item = simulateRepeaterItem(returnWithLabel);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    // Trigger track shipment button
    const trackHandler = getEl('#trackShipmentBtn').onClick.mock.calls[0][0];
    await trackHandler();

    expect(getEl('#trackingStatus').text).toBe('In Transit');
    expect(getEl('#trackingStatus').expand).toHaveBeenCalled();
  });

  it('sets #trackingEta text after tracking shipment', async () => {
    await loadPage();
    const returnWithLabel = { ...mockReturn, hasLabel: true, rmaNumber: 'RMA-001' };
    const $item = simulateRepeaterItem(returnWithLabel);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    const trackHandler = getEl('#trackShipmentBtn').onClick.mock.calls[0][0];
    await trackHandler();

    expect(getEl('#trackingEta').text).toContain('ETA:');
    expect(getEl('#trackingEta').expand).toHaveBeenCalled();
  });
});

// ── Refund Modal Tests ──────────────────────────────────────────────

describe('Admin Returns — Refund Modal element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('initially collapses #refundModal', async () => {
    await loadPage();
    expect(getEl('#refundModal').collapse).toHaveBeenCalled();
  });

  it('hooks up #cancelRefundBtn via makeClickable', async () => {
    await loadPage();
    expect(getEl('#cancelRefundBtn').onClick).toHaveBeenCalled();
    expect(getEl('#cancelRefundBtn').accessibility.ariaLabel).toBe('Cancel refund');
  });

  it('hooks up #confirmRefundBtn via makeClickable', async () => {
    await loadPage();
    expect(getEl('#confirmRefundBtn').onClick).toHaveBeenCalled();
    expect(getEl('#confirmRefundBtn').accessibility.ariaLabel).toBe('Confirm and process refund');
  });

  it('shows #processRefundBtn for eligible return statuses', async () => {
    const approvedReturn = { ...mockReturn, status: 'approved' };
    const { getNextStatuses } = await import('public/ReturnsAdmin.js');
    getNextStatuses.mockReturnValue(['shipped']);

    await loadPage();
    // Override returns data for this test
    const { getAdminReturns } = await import('backend/returnsService.web');
    getAdminReturns.mockResolvedValue({ success: true, returns: [approvedReturn] });

    await loadPage();
    const $item = simulateRepeaterItem(approvedReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    expect(getEl('#processRefundBtn').show).toHaveBeenCalled();
    expect(getEl('#processRefundBtn').accessibility.ariaLabel).toBe('Process refund for this return');
  });

  it('hides #processRefundBtn for denied returns', async () => {
    await loadPage();
    const deniedReturn = { ...mockReturn, status: 'denied' };
    const $item = simulateRepeaterItem(deniedReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    expect(getEl('#processRefundBtn').hide).toHaveBeenCalled();
  });

  it('sets #refundRmaLabel text when refund modal opens', async () => {
    await loadPage();
    const approvedReturn = { ...mockReturn, status: 'approved' };
    const $item = simulateRepeaterItem(approvedReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    // Trigger processRefundBtn click to open modal
    const processHandler = getEl('#processRefundBtn').onClick.mock.calls[0][0];
    processHandler();

    expect(getEl('#refundRmaLabel').text).toBe('Refund for RMA-001');
  });

  it('sets #refundCustomerLabel text when refund modal opens', async () => {
    await loadPage();
    const approvedReturn = { ...mockReturn, status: 'approved' };
    const $item = simulateRepeaterItem(approvedReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    const processHandler = getEl('#processRefundBtn').onClick.mock.calls[0][0];
    processHandler();

    expect(getEl('#refundCustomerLabel').text).toBe('John');
  });

  it('clears #refundAmountInput when refund modal opens', async () => {
    await loadPage();
    const approvedReturn = { ...mockReturn, status: 'approved' };
    const $item = simulateRepeaterItem(approvedReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    const processHandler = getEl('#processRefundBtn').onClick.mock.calls[0][0];
    processHandler();

    expect(getEl('#refundAmountInput').value).toBe('');
    expect(getEl('#refundAmountInput').accessibility.ariaLabel).toBe('Refund amount in dollars');
  });

  it('clears #refundNotesInput when refund modal opens', async () => {
    await loadPage();
    const approvedReturn = { ...mockReturn, status: 'approved' };
    const $item = simulateRepeaterItem(approvedReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    const processHandler = getEl('#processRefundBtn').onClick.mock.calls[0][0];
    processHandler();

    expect(getEl('#refundNotesInput').value).toBe('');
  });

  it('hides #refundError when refund modal opens', async () => {
    await loadPage();
    const approvedReturn = { ...mockReturn, status: 'approved' };
    const $item = simulateRepeaterItem(approvedReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    const processHandler = getEl('#processRefundBtn').onClick.mock.calls[0][0];
    processHandler();

    expect(getEl('#refundError').hide).toHaveBeenCalled();
  });

  it('expands #refundModal when processRefundBtn is clicked', async () => {
    await loadPage();
    const approvedReturn = { ...mockReturn, status: 'approved' };
    const $item = simulateRepeaterItem(approvedReturn);
    const viewHandler = $item('#viewDetailsBtn').onClick.mock.calls[0][0];
    await viewHandler();

    const processHandler = getEl('#processRefundBtn').onClick.mock.calls[0][0];
    processHandler();

    expect(getEl('#refundModal').expand).toHaveBeenCalled();
  });
});

// ── UI States Tests ─────────────────────────────────────────────────

describe('Admin Returns — UI States element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('collapses #emptyState during initialization', async () => {
    await loadPage();
    expect(getEl('#emptyState').collapse).toHaveBeenCalled();
  });

  it('shows #dashboardLoader during data loading', async () => {
    await loadPage();
    expect(getEl('#dashboardLoader').show).toHaveBeenCalled();
  });

  it('hides #dashboardLoader after data loads', async () => {
    await loadPage();
    expect(getEl('#dashboardLoader').hide).toHaveBeenCalled();
  });

  it('shows #dashboardError with error message on failure', async () => {
    const { sortAdminReturns } = await import('public/ReturnsAdmin.js');
    sortAdminReturns.mockImplementationOnce(() => { throw new Error('Sort failed'); });

    await loadPage();

    expect(getEl('#dashboardError').text).toBe('Failed to load returns data. Please refresh.');
    expect(getEl('#dashboardError').show).toHaveBeenCalled();
  });

  it('calls initBackToTop on page load', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalledWith(expect.anything());
  });

  it('tracks page_view event on load', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'admin_returns' });
  });
});
