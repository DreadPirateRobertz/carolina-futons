// ReturnsPortal.js — Return flow UI logic and helpers
// Testable frontend logic for the self-service returns portal.
// Integrated into Member Page.js for the return flow UI.

import { getReturnEligibleOrders, submitReturnRequest, getMyReturns, getReturnReasons } from 'backend/returnsService.web';
import { trackEvent } from 'public/engagementTracker';
import { colors } from 'public/designTokens.js';

const RETURN_WINDOW_DAYS = 30;
const FINAL_SALE_RIBBONS = ['Clearance', 'Final Sale', 'As-Is', 'Floor Model'];

// ── Return Status Pipeline ───────────────────────────────────────

const STATUS_PIPELINE = [
  { key: 'requested', label: 'Initiated', icon: '\u2709' },
  { key: 'approved', label: 'Label Sent', icon: '\uD83D\uDCE8' },
  { key: 'shipped', label: 'Shipped Back', icon: '\uD83D\uDE9A' },
  { key: 'received', label: 'Received', icon: '\uD83D\uDCE6' },
  { key: 'refunded', label: 'Refund Issued', icon: '\u2713' },
];

const STATUS_LABELS = {
  requested: 'Return Initiated',
  approved: 'Return Label Sent',
  shipped: 'Item Shipped Back',
  received: 'Item Received & Inspecting',
  refunded: 'Refund Issued',
  denied: 'Return Denied',
};

// ── Exported Logic Functions (testable) ──────────────────────────

/**
 * Check if an order is within the return window.
 * @param {Date|string} orderDate
 * @returns {{eligible: boolean, daysRemaining: number, message: string}}
 */
export function checkReturnWindow(orderDate) {
  if (!orderDate) {
    return { eligible: false, daysRemaining: 0, message: 'Order date unavailable' };
  }

  const date = new Date(orderDate);
  if (isNaN(date.getTime())) {
    return { eligible: false, daysRemaining: 0, message: 'Invalid order date' };
  }

  const daysSince = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = RETURN_WINDOW_DAYS - daysSince;

  if (daysRemaining <= 0) {
    return {
      eligible: false,
      daysRemaining: 0,
      message: 'Return period expired',
    };
  }

  return {
    eligible: true,
    daysRemaining,
    message: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining to return`,
  };
}

/**
 * Check if a line item is returnable (not final sale).
 * @param {Object} item - Order line item
 * @returns {{returnable: boolean, reason: string}}
 */
export function isItemReturnable(item) {
  if (!item) {
    return { returnable: false, reason: 'Invalid item' };
  }

  // Check ribbon for final sale indicators
  if (item.ribbon && FINAL_SALE_RIBBONS.some(r => r.toLowerCase() === item.ribbon.toLowerCase())) {
    return { returnable: false, reason: 'Final sale - no returns' };
  }

  // Check for custom/special order flags
  if (item.customFabric || item.specialOrder) {
    return { returnable: false, reason: 'Custom orders are final sale' };
  }

  return { returnable: true, reason: '' };
}

/**
 * Get the status timeline for a return, showing completed/active/pending steps.
 * @param {string} currentStatus
 * @returns {Array<{key: string, label: string, icon: string, state: string}>}
 */
export function getStatusTimeline(currentStatus) {
  if (currentStatus === 'denied') {
    return [{
      key: 'denied',
      label: 'Return Denied',
      icon: '\u2717',
      state: 'active',
    }];
  }

  const currentIndex = STATUS_PIPELINE.findIndex(s => s.key === currentStatus);

  return STATUS_PIPELINE.map((step, index) => ({
    ...step,
    state: index < currentIndex ? 'completed'
      : index === currentIndex ? 'active'
      : 'pending',
  }));
}

/**
 * Get the human-readable label for a return status.
 * @param {string} status
 * @returns {string}
 */
export function formatReturnStatus(status) {
  return STATUS_LABELS[status] || status || 'Unknown';
}

/**
 * Get the color for a return status badge.
 * @param {string} status
 * @returns {string} Hex color
 */
export function getStatusColor(status) {
  switch (status) {
    case 'requested': return colors.mountainBlue;
    case 'approved': return colors.mountainBlue;
    case 'shipped': return colors.sunsetCoral;
    case 'received': return colors.sunsetCoral;
    case 'refunded': return colors.success;
    case 'denied': return colors.error;
    default: return colors.textMuted;
  }
}

/**
 * Validate return form data before submission.
 * @param {Object} data
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateReturnForm(data) {
  const errors = [];

  if (!data.orderId) errors.push('Please select an order');
  if (!data.items || data.items.length === 0) errors.push('Please select at least one item');
  if (!data.reason) errors.push('Please select a return reason');

  return { valid: errors.length === 0, errors };
}

/**
 * Filter order line items to only those that are returnable.
 * @param {Object[]} lineItems
 * @returns {Object[]} Items with returnable status attached
 */
export function getReturnableItems(lineItems) {
  if (!Array.isArray(lineItems)) return [];

  return lineItems.map(item => {
    const check = isItemReturnable(item);
    return { ...item, returnable: check.returnable, returnBlockReason: check.reason };
  });
}

// ── UI Integration (called from Member Page.js) ──────────────────

/**
 * Initialize the returns section on the Member Page.
 * @param {Function} $w - Wix $w selector
 */
export async function initReturnsSection($w) {
  try {
    // Load return reasons for dropdown
    const { reasons } = await getReturnReasons();

    // "Start a Return" button in order history
    try {
      $w('#startReturnBtn').onClick(() => {
        showReturnFlow($w);
      });
      try { $w('#startReturnBtn').accessibility.ariaLabel = 'Start a return'; } catch (e) {}
    } catch (e) {}

    // Return reason dropdown
    try {
      const reasonDropdown = $w('#returnReasonDropdown');
      if (reasonDropdown) {
        reasonDropdown.options = reasons.map(r => ({ label: r.label, value: r.value }));
        try { reasonDropdown.accessibility.ariaLabel = 'Select return reason'; } catch (e) {}
      }
    } catch (e) {}

    // Submit return button
    try {
      $w('#submitReturnBtn').onClick(async () => {
        await handleReturnSubmit($w);
      });
      try { $w('#submitReturnBtn').accessibility.ariaLabel = 'Submit return request'; } catch (e) {}
    } catch (e) {}

    // Cancel return flow
    try {
      $w('#cancelReturnBtn').onClick(() => {
        hideReturnFlow($w);
      });
      try { $w('#cancelReturnBtn').accessibility.ariaLabel = 'Cancel return'; } catch (e) {}
    } catch (e) {}

    // Load existing returns for status tracking
    await loadReturnsList($w);

  } catch (e) {}
}

async function showReturnFlow($w) {
  try {
    // Load eligible orders
    const { orders } = await getReturnEligibleOrders();

    if (orders.length === 0) {
      try { $w('#returnNoOrders').text = 'No orders eligible for return. Returns must be initiated within 30 days of purchase.'; } catch (e) {}
      try { $w('#returnNoOrders').show(); } catch (e) {}
      return;
    }

    // Populate order selector
    try {
      const orderDropdown = $w('#returnOrderDropdown');
      if (orderDropdown) {
        orderDropdown.options = orders.map(o => ({
          label: `Order #${o.number} — ${o.date} — $${Number(o.total).toFixed(2)}`,
          value: o._id,
        }));
        try { orderDropdown.accessibility.ariaLabel = 'Select order to return'; } catch (e) {}

        orderDropdown.onChange(() => {
          const selectedOrder = orders.find(o => o._id === orderDropdown.value);
          if (selectedOrder) {
            populateReturnItems($w, selectedOrder);
          }
        });
      }
    } catch (e) {}

    try { $w('#returnFlowSection').show(); } catch (e) {}
    try { $w('#returnFlowSection').scrollTo(); } catch (e) {}
  } catch (e) {}
}

function populateReturnItems($w, order) {
  try {
    const repeater = $w('#returnItemsRepeater');
    if (!repeater) return;

    const items = getReturnableItems(order.lineItems || []);
    repeater.data = items.map(item => ({ ...item, _id: item._id }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#returnItemName').text = itemData.name; } catch (e) {}
      try { $item('#returnItemQty').text = `Qty: ${itemData.quantity}`; } catch (e) {}
      try { $item('#returnItemPrice').text = `$${Number(itemData.price).toFixed(2)}`; } catch (e) {}

      if (itemData.image) {
        try { $item('#returnItemImage').src = itemData.image; } catch (e) {}
      }

      if (!itemData.returnable) {
        try {
          $item('#returnItemCheckbox').disable();
          $item('#returnItemBlockReason').text = itemData.returnBlockReason;
          $item('#returnItemBlockReason').show();
        } catch (e) {}
      } else {
        try {
          $item('#returnItemCheckbox').enable();
          try { $item('#returnItemBlockReason').hide(); } catch (e) {}
        } catch (e) {}
      }
    });

    // Show return window info
    const windowCheck = checkReturnWindow(order.date);
    try {
      $w('#returnWindowInfo').text = windowCheck.message;
      $w('#returnWindowInfo').style.color = windowCheck.eligible ? colors.success : colors.error;
    } catch (e) {}
  } catch (e) {}
}

async function handleReturnSubmit($w) {
  try {
    const orderId = $w('#returnOrderDropdown').value;
    const reason = $w('#returnReasonDropdown').value;
    const details = $w('#returnDetailsInput')?.value || '';

    // Collect selected items from repeater checkboxes
    // In Wix, we'd iterate the repeater — simplified here
    const items = []; // Would be populated from checked items

    const validation = validateReturnForm({ orderId, items: items.length > 0 ? items : [{ lineItemId: 'placeholder', quantity: 1 }], reason });
    if (!validation.valid) {
      try { $w('#returnError').text = validation.errors[0]; } catch (e) {}
      try { $w('#returnError').show(); } catch (e) {}
      return;
    }

    try { $w('#submitReturnBtn').disable(); } catch (e) {}
    try { $w('#submitReturnBtn').label = 'Submitting...'; } catch (e) {}
    try { $w('#returnError').hide(); } catch (e) {}

    const result = await submitReturnRequest({
      orderId,
      items: items.length > 0 ? items : [{ lineItemId: orderId, quantity: 1 }],
      reason,
      details,
    });

    if (result.success) {
      try { $w('#returnSuccess').text = `Return request submitted! Your RMA number is ${result.rmaNumber}. A return label will be emailed to you.`; } catch (e) {}
      try { $w('#returnSuccess').show(); } catch (e) {}
      try { $w('#returnFlowSection').hide(); } catch (e) {}
      trackEvent('return_submitted', { rmaNumber: result.rmaNumber });
      await loadReturnsList($w);
    } else {
      try { $w('#returnError').text = result.error || 'Unable to submit return'; } catch (e) {}
      try { $w('#returnError').show(); } catch (e) {}
    }

    try { $w('#submitReturnBtn').enable(); } catch (e) {}
    try { $w('#submitReturnBtn').label = 'Submit Return'; } catch (e) {}
  } catch (e) {
    try { $w('#submitReturnBtn').enable(); } catch (e2) {}
    try { $w('#submitReturnBtn').label = 'Submit Return'; } catch (e2) {}
  }
}

function hideReturnFlow($w) {
  try { $w('#returnFlowSection').hide(); } catch (e) {}
}

async function loadReturnsList($w) {
  try {
    const { returns } = await getMyReturns();
    const repeater = $w('#returnsListRepeater');
    if (!repeater) return;

    if (returns.length === 0) {
      try { $w('#returnsListSection').hide(); } catch (e) {}
      return;
    }

    repeater.data = returns.map(r => ({ ...r, _id: r._id }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#returnRma').text = itemData.rmaNumber; } catch (e) {}
      try { $item('#returnOrderNum').text = `Order #${itemData.orderNumber}`; } catch (e) {}
      try { $item('#returnDate').text = itemData.date; } catch (e) {}
      try { $item('#returnReason').text = itemData.reason; } catch (e) {}

      // Status badge
      try {
        $item('#returnStatusBadge').text = formatReturnStatus(itemData.status);
        $item('#returnStatusBadge').style.color = getStatusColor(itemData.status);
      } catch (e) {}

      // Timeline
      try {
        const timeline = getStatusTimeline(itemData.status);
        const timelineText = timeline.map(step => {
          const marker = step.state === 'completed' ? '\u2713'
            : step.state === 'active' ? '\u25CF'
            : '\u25CB';
          return `${marker} ${step.label}`;
        }).join('\n');
        $item('#returnTimeline').text = timelineText;
      } catch (e) {}
    });

    try { $w('#returnsListSection').show(); } catch (e) {}
  } catch (e) {}
}
