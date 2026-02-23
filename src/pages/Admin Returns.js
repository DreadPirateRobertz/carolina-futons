// Admin Returns.js - Returns Management Dashboard (Admin Only)
// View all return requests, update statuses, generate labels, process refunds
import { getAdminReturns, getReturnStats, updateReturnStatus, generateReturnLabel, processRefund, trackReturnShipment } from 'backend/returnsService.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { colors, typography } from 'public/designTokens.js';
import { getAdminStatusLabel, getAdminStatusColor, getNextStatuses, isValidTransition, getStatusFilterOptions, formatAdminReturnRow, formatReturnStats, validateRefund, canGenerateLabel, needsAction, sortAdminReturns } from 'public/ReturnsAdmin.js';
import { initBackToTop } from 'public/mobileHelpers';

let _returns = [];
let _stats = {};
let _currentFilter = '';
let _selectedReturn = null;

$w.onReady(async function () {
  initBackToTop($w);
  initFilterDropdown();
  initReturnsList();
  initDetailPanel();
  initRefundModal();
  await loadDashboard();
  trackEvent('page_view', { page: 'admin_returns' });
});

// ── Load Dashboard ────────────────────────────────────────────────

async function loadDashboard() {
  showLoading(true);
  try {
    const [returnsSettled, statsSettled] = await Promise.allSettled([
      getAdminReturns({ status: _currentFilter || undefined }),
      getReturnStats(),
    ]);

    if (returnsSettled.status === 'fulfilled' && returnsSettled.value.success) {
      _returns = sortAdminReturns((returnsSettled.value.returns || []).map(formatAdminReturnRow));
      renderReturnsList();
    } else if (returnsSettled.status === 'rejected') {
      console.error('[AdminReturns] Failed to load returns:', returnsSettled.reason);
    }

    if (statsSettled.status === 'fulfilled' && statsSettled.value.success) {
      _stats = statsSettled.value.stats;
      renderStats();
    } else if (statsSettled.status === 'rejected') {
      console.error('[AdminReturns] Failed to load stats:', statsSettled.reason);
    }
  } catch (err) {
    console.error('[AdminReturns] Load error:', err);
    showError('Failed to load returns data. Please refresh.');
  }
  showLoading(false);
}

// ── Stats Cards ───────────────────────────────────────────────────

function renderStats() {
  const formatted = formatReturnStats(_stats);

  try { $w('#statTotal').text = String(formatted.total); } catch (e) {}
  try { $w('#statTotalLabel').text = 'Total Returns'; } catch (e) {}

  try {
    $w('#statActionRequired').text = String(formatted.actionRequired);
    $w('#statActionRequired').style.color = formatted.actionRequired > 0 ? colors.sunsetCoral : colors.espresso;
  } catch (e) {}
  try { $w('#statActionLabel').text = 'Action Required'; } catch (e) {}

  try { $w('#statInProgress').text = String(formatted.inProgress); } catch (e) {}
  try { $w('#statProgressLabel').text = 'In Progress'; } catch (e) {}

  try {
    $w('#statCompleted').text = String(formatted.completed);
    $w('#statCompleted').style.color = colors.success;
  } catch (e) {}
  try { $w('#statCompletedLabel').text = 'Completed'; } catch (e) {}
}

// ── Filter Dropdown ───────────────────────────────────────────────

function initFilterDropdown() {
  try {
    const dropdown = $w('#statusFilterDropdown');
    if (!dropdown) return;

    dropdown.options = getStatusFilterOptions();
    dropdown.value = '';
    try { dropdown.accessibility.ariaLabel = 'Filter returns by status'; } catch (e) {}

    dropdown.onChange(() => {
      _currentFilter = dropdown.value;
      loadDashboard();
      trackEvent('admin_returns_filter', { status: _currentFilter || 'all' });
    });
  } catch (e) {}

  try {
    try { $w('#refreshBtn').accessibility.ariaLabel = 'Refresh returns list'; } catch (e) {}
    $w('#refreshBtn').onClick(() => loadDashboard());
  } catch (e) {}
}

// ── Returns List (Repeater) ───────────────────────────────────────

function initReturnsList() {
  try { $w('#returnsRepeater').collapse(); } catch (e) {}
  try { $w('#emptyState').collapse(); } catch (e) {}
}

function renderReturnsList() {
  try {
    const repeater = $w('#returnsRepeater');
    if (!repeater) return;

    if (_returns.length === 0) {
      repeater.collapse();
      try {
        $w('#emptyState').text = _currentFilter
          ? `No ${getAdminStatusLabel(_currentFilter).toLowerCase()} returns found.`
          : 'No return requests yet.';
        $w('#emptyState').expand();
      } catch (e) {}
      return;
    }

    try { $w('#emptyState').collapse(); } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      try { $item('#rmaNumber').text = itemData.rmaNumber; } catch (e) {}
      try { $item('#orderNumber').text = `#${itemData.orderNumber}`; } catch (e) {}
      try { $item('#customerName').text = itemData.memberName; } catch (e) {}
      try { $item('#returnType').text = itemData.type; } catch (e) {}
      try { $item('#returnDate').text = itemData.date; } catch (e) {}
      try { $item('#returnReason').text = itemData.reason; } catch (e) {}

      // Status badge
      try {
        $item('#statusBadge').text = itemData.statusLabel;
        $item('#statusBadge').style.color = itemData.statusColor;
      } catch (e) {}

      // Action-required indicator
      try {
        if (needsAction(itemData.status)) {
          $item('#actionDot').show();
          try { $item('#actionDot').style.backgroundColor = colors.sunsetCoral; } catch (e) {}
        } else {
          $item('#actionDot').hide();
        }
      } catch (e) {}

      // Item count
      try { $item('#itemCount').text = `${itemData.itemCount} item${itemData.itemCount !== 1 ? 's' : ''}`; } catch (e) {}

      // View details button
      try {
        try { $item('#viewDetailsBtn').accessibility.ariaLabel = `View details for ${itemData.rmaNumber}`; } catch (e) {}
        $item('#viewDetailsBtn').onClick(() => openDetail(itemData));
      } catch (e) {}
    });

    repeater.data = _returns.map(r => ({ ...r, _id: r._id }));
    repeater.expand();
  } catch (e) {}
}

// ── Detail Panel ──────────────────────────────────────────────────

function initDetailPanel() {
  try { $w('#detailPanel').collapse(); } catch (e) {}

  try {
    try { $w('#closeDetailBtn').accessibility.ariaLabel = 'Close detail panel'; } catch (e) {}
    $w('#closeDetailBtn').onClick(() => closeDetail());
  } catch (e) {}
}

function openDetail(ret) {
  _selectedReturn = ret;
  renderDetail(ret);
  try { $w('#detailPanel').expand(); } catch (e) {}
  try { $w('#detailPanel').scrollTo(); } catch (e) {}
  announce($w, `Viewing return ${ret.rmaNumber}`);
}

function closeDetail() {
  _selectedReturn = null;
  try { $w('#detailPanel').collapse(); } catch (e) {}
}

function renderDetail(ret) {
  // Header
  try { $w('#detailRma').text = ret.rmaNumber; } catch (e) {}
  try {
    $w('#detailStatus').text = ret.statusLabel;
    $w('#detailStatus').style.color = ret.statusColor;
  } catch (e) {}

  // Customer info
  try { $w('#detailCustomer').text = ret.memberName; } catch (e) {}
  try { $w('#detailEmail').text = ret.memberEmail; } catch (e) {}
  try { $w('#detailOrder').text = `Order #${ret.orderNumber}`; } catch (e) {}
  try { $w('#detailDate').text = ret.date; } catch (e) {}

  // Return info
  try { $w('#detailType').text = ret.type; } catch (e) {}
  try { $w('#detailReason').text = ret.reason; } catch (e) {}
  try {
    if (ret.details) {
      $w('#detailDescription').text = ret.details;
      $w('#detailDescription').expand();
    } else {
      $w('#detailDescription').collapse();
    }
  } catch (e) {}

  // Admin notes
  try {
    $w('#detailNotes').value = ret.adminNotes;
    try { $w('#detailNotes').accessibility.ariaLabel = 'Admin notes for this return'; } catch (e) {}
  } catch (e) {}

  // Tracking info
  try {
    if (ret.hasLabel) {
      $w('#trackingSection').expand();
      $w('#detailTracking').text = ret.trackingNumber;
    } else {
      $w('#trackingSection').collapse();
    }
  } catch (e) {}

  // Refund info
  try {
    if (ret.refundAmount) {
      $w('#detailRefundAmount').text = `Refund: $${Number(ret.refundAmount).toFixed(2)}`;
      $w('#detailRefundAmount').expand();
    } else {
      $w('#detailRefundAmount').collapse();
    }
  } catch (e) {}

  // Status transition buttons
  renderStatusActions(ret);

  // Label generation button
  renderLabelAction(ret);

  // Refund button
  renderRefundAction(ret);
}

// ── Status Actions ────────────────────────────────────────────────

function renderStatusActions(ret) {
  try {
    const nextStatuses = getNextStatuses(ret.status);

    if (nextStatuses.length === 0) {
      try { $w('#statusActionsSection').collapse(); } catch (e) {}
      return;
    }

    // Approve button
    try {
      if (nextStatuses.includes('approved')) {
        $w('#approveBtn').show();
        try { $w('#approveBtn').accessibility.ariaLabel = 'Approve this return'; } catch (e) {}
        $w('#approveBtn').onClick(() => handleStatusUpdate(ret._id, 'approved'));
      } else {
        $w('#approveBtn').hide();
      }
    } catch (e) {}

    // Deny button
    try {
      if (nextStatuses.includes('denied')) {
        $w('#denyBtn').show();
        try { $w('#denyBtn').accessibility.ariaLabel = 'Deny this return'; } catch (e) {}
        $w('#denyBtn').onClick(() => handleStatusUpdate(ret._id, 'denied'));
      } else {
        $w('#denyBtn').hide();
      }
    } catch (e) {}

    // Mark shipped button
    try {
      if (nextStatuses.includes('shipped')) {
        $w('#markShippedBtn').show();
        try { $w('#markShippedBtn').accessibility.ariaLabel = 'Mark return as shipped'; } catch (e) {}
        $w('#markShippedBtn').onClick(() => handleStatusUpdate(ret._id, 'shipped'));
      } else {
        $w('#markShippedBtn').hide();
      }
    } catch (e) {}

    // Mark received button
    try {
      if (nextStatuses.includes('received')) {
        $w('#markReceivedBtn').show();
        try { $w('#markReceivedBtn').accessibility.ariaLabel = 'Mark return as received'; } catch (e) {}
        $w('#markReceivedBtn').onClick(() => handleStatusUpdate(ret._id, 'received'));
      } else {
        $w('#markReceivedBtn').hide();
      }
    } catch (e) {}

    try { $w('#statusActionsSection').expand(); } catch (e) {}
  } catch (e) {}
}

async function handleStatusUpdate(returnId, newStatus) {
  try {
    const notes = (() => { try { return $w('#detailNotes').value || ''; } catch (e) { return ''; } })();

    setActionLoading(true);

    const result = await updateReturnStatus(returnId, newStatus, notes || undefined);

    if (result.success) {
      announce($w, `Return status updated to ${getAdminStatusLabel(newStatus)}`);
      trackEvent('admin_return_status_update', { returnId, status: newStatus });
      await loadDashboard();
      closeDetail();
    } else {
      showError(result.error || 'Failed to update status.');
    }
  } catch (err) {
    console.error('[AdminReturns] Status update error:', err);
    showError('Failed to update status.');
  }
  setActionLoading(false);
}

// ── Label Generation ──────────────────────────────────────────────

function renderLabelAction(ret) {
  try {
    const { canGenerate, reason } = canGenerateLabel(ret);
    if (canGenerate) {
      $w('#generateLabelBtn').show();
      try { $w('#generateLabelBtn').accessibility.ariaLabel = 'Generate UPS return label'; } catch (e) {}
      $w('#generateLabelBtn').onClick(() => handleGenerateLabel(ret._id));
    } else {
      $w('#generateLabelBtn').hide();
    }
  } catch (e) {}
}

async function handleGenerateLabel(returnId) {
  try {
    setActionLoading(true);
    const result = await generateReturnLabel(returnId);

    if (result.success) {
      announce($w, `Return label generated. Tracking: ${result.trackingNumber}`);
      try {
        $w('#trackingSection').expand();
        $w('#detailTracking').text = result.trackingNumber;
      } catch (e) {}
      trackEvent('admin_return_label_generated', { returnId, trackingNumber: result.trackingNumber });
      await loadDashboard();
    } else {
      showError(result.error || 'Failed to generate label.');
    }
  } catch (err) {
    console.error('[AdminReturns] Label generation error:', err);
    showError('Failed to generate return label.');
  }
  setActionLoading(false);
}

// ── Track Return Shipment ─────────────────────────────────────────

function initTrackingButton() {
  try {
    $w('#trackShipmentBtn').onClick(async () => {
      if (!_selectedReturn || !_selectedReturn.rmaNumber) return;
      try {
        $w('#trackShipmentBtn').disable();
        $w('#trackShipmentBtn').label = 'Tracking...';
      } catch (e) {}

      const result = await trackReturnShipment(_selectedReturn.rmaNumber);

      if (result.success && result.tracking) {
        try {
          $w('#trackingStatus').text = result.tracking.status || 'Unknown';
          $w('#trackingStatus').expand();
        } catch (e) {}
        if (result.tracking.estimatedDelivery) {
          try {
            const estDate = new Date(result.tracking.estimatedDelivery);
            $w('#trackingEta').text = `ETA: ${estDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            $w('#trackingEta').expand();
          } catch (e) {}
        }
      }

      try {
        $w('#trackShipmentBtn').enable();
        $w('#trackShipmentBtn').label = 'Track Shipment';
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Refund Modal ──────────────────────────────────────────────────

function initRefundModal() {
  try { $w('#refundModal').collapse(); } catch (e) {}

  try {
    try { $w('#cancelRefundBtn').accessibility.ariaLabel = 'Cancel refund'; } catch (e) {}
    $w('#cancelRefundBtn').onClick(() => {
      try { $w('#refundModal').collapse(); } catch (e) {}
    });
  } catch (e) {}

  try {
    try { $w('#confirmRefundBtn').accessibility.ariaLabel = 'Confirm and process refund'; } catch (e) {}
    $w('#confirmRefundBtn').onClick(() => handleProcessRefund());
  } catch (e) {}
}

function renderRefundAction(ret) {
  try {
    const canRefund = ret.status !== 'refunded' && ret.status !== 'denied' && ret.status !== 'requested';
    if (canRefund) {
      $w('#processRefundBtn').show();
      try { $w('#processRefundBtn').accessibility.ariaLabel = 'Process refund for this return'; } catch (e) {}
      $w('#processRefundBtn').onClick(() => openRefundModal(ret));
    } else {
      $w('#processRefundBtn').hide();
    }
  } catch (e) {}
}

function openRefundModal(ret) {
  try {
    $w('#refundRmaLabel').text = `Refund for ${ret.rmaNumber}`;
    $w('#refundCustomerLabel').text = ret.memberName;
    $w('#refundAmountInput').value = '';
    try { $w('#refundAmountInput').accessibility.ariaLabel = 'Refund amount in dollars'; } catch (e) {}
    $w('#refundNotesInput').value = '';
    try { $w('#refundError').hide(); } catch (e) {}
    $w('#refundModal').expand();
  } catch (e) {}
}

async function handleProcessRefund() {
  if (!_selectedReturn) return;

  try {
    const amount = $w('#refundAmountInput').value;
    const notes = (() => { try { return $w('#refundNotesInput').value || ''; } catch (e) { return ''; } })();

    const validation = validateRefund(_selectedReturn, amount);
    if (!validation.valid) {
      try {
        $w('#refundError').text = validation.errors[0];
        $w('#refundError').show('fade', { duration: 200 });
        $w('#refundError').style.color = colors.sunsetCoral;
      } catch (e) {}
      return;
    }

    setActionLoading(true);
    try { $w('#refundError').hide(); } catch (e) {}

    const result = await processRefund(_selectedReturn._id, Number(amount), notes || undefined);

    if (result.success) {
      try { $w('#refundModal').collapse(); } catch (e) {}
      announce($w, `Refund of $${Number(amount).toFixed(2)} processed`);
      trackEvent('admin_return_refund', { returnId: _selectedReturn._id, amount: Number(amount) });
      await loadDashboard();
      closeDetail();
    } else {
      try {
        $w('#refundError').text = result.error || 'Failed to process refund.';
        $w('#refundError').show('fade', { duration: 200 });
        $w('#refundError').style.color = colors.sunsetCoral;
      } catch (e) {}
    }
  } catch (err) {
    console.error('[AdminReturns] Refund error:', err);
    try {
      $w('#refundError').text = 'Failed to process refund.';
      $w('#refundError').show('fade', { duration: 200 });
    } catch (e) {}
  }
  setActionLoading(false);
}

// ── Loading & Error States ────────────────────────────────────────

function showLoading(loading) {
  try {
    if (loading) {
      $w('#dashboardLoader').show();
    } else {
      $w('#dashboardLoader').hide();
    }
  } catch (e) {}
}

function setActionLoading(loading) {
  const buttons = ['#approveBtn', '#denyBtn', '#markShippedBtn', '#markReceivedBtn', '#generateLabelBtn', '#processRefundBtn', '#confirmRefundBtn'];
  buttons.forEach(id => {
    try {
      if (loading) {
        $w(id).disable();
      } else {
        $w(id).enable();
      }
    } catch (e) {}
  });
}

function showError(message) {
  try {
    $w('#dashboardError').text = message;
    $w('#dashboardError').show('fade', { duration: 200 });
    $w('#dashboardError').style.color = colors.sunsetCoral;
    announce($w, message);
  } catch (e) {}
}
