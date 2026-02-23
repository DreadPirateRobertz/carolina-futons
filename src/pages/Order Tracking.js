// Order Tracking.js - Customer Order Tracking Page
// Order lookup by order number + email, real-time UPS tracking with timeline,
// delivery activity history, and notification opt-in/out
import { lookupOrder, subscribeToNotifications, unsubscribeFromNotifications, getTrackingTimeline } from 'backend/orderTracking.web';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
import { colors, typography } from 'public/designTokens.js';
import { initBackToTop } from 'public/mobileHelpers';

let _currentOrder = null;
let _autoRefreshTimer = null;

$w.onReady(async function () {
  initBackToTop($w);
  initLookupForm();
  initResultsSection();
  prefillFromQueryParams();
  trackEvent('page_view', { page: 'order_tracking' });
});

// ── Lookup Form ────────────────────────────────────────────────────

function initLookupForm() {
  try {
    $w('#trackingTitle').text = 'Track Your Order';
    $w('#trackingSubtitle').text = 'Enter your order number and email address to view your shipment status.';
  } catch (e) {}

  try { $w('#orderNumberInput').accessibility.ariaLabel = 'Order number'; } catch (e) {}
  try { $w('#emailInput').accessibility.ariaLabel = 'Email address used for this order'; } catch (e) {}
  try { $w('#trackOrderBtn').accessibility.ariaLabel = 'Track order'; } catch (e) {}

  $w('#trackOrderBtn').onClick(() => handleLookup());

  // Enter key submits the form
  try {
    $w('#emailInput').onKeyPress((event) => {
      if (event.key === 'Enter') handleLookup();
    });
    $w('#orderNumberInput').onKeyPress((event) => {
      if (event.key === 'Enter') handleLookup();
    });
  } catch (e) {}
}

// ── Prefill from URL ───────────────────────────────────────────────
// Member Page links to /tracking?order=XXXX

async function prefillFromQueryParams() {
  try {
    const wixLocation = await import('wix-location-frontend');
    const query = wixLocation.query;
    if (query.order) {
      $w('#orderNumberInput').value = query.order;
      // If email is in query, auto-submit
      if (query.email) {
        $w('#emailInput').value = query.email;
        handleLookup();
      }
    }
  } catch (e) {}
}

// ── Lookup Handler ─────────────────────────────────────────────────

async function handleLookup() {
  const orderNumber = ($w('#orderNumberInput').value || '').trim();
  const email = ($w('#emailInput').value || '').trim();

  // Client-side validation
  if (!orderNumber) {
    showError('Please enter your order number.');
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('Please enter a valid email address.');
    return;
  }

  showLoading(true);
  hideError();

  try {
    const result = await lookupOrder(orderNumber, email);

    if (!result.success) {
      showError(result.error || 'Order not found. Please check your details and try again.');
      showLoading(false);
      return;
    }

    _currentOrder = result;
    renderResults(result);
    showLoading(false);
    showResults(true);
    announce($w, `Order ${orderNumber} found. Status: ${result.order.status}`);
    trackEvent('order_tracked', { orderNumber, status: result.order.fulfillmentStatus });

    // Start auto-refresh for active shipments
    startAutoRefresh(result);
  } catch (err) {
    console.error('[OrderTracking] Lookup error:', err);
    showError('Something went wrong. Please try again.');
    showLoading(false);
  }
}

// ── Render Results ─────────────────────────────────────────────────

function renderResults(data) {
  renderOrderSummary(data);
  renderTimeline(data.timeline, data.order);
  renderShippingDetails(data.shipping);
  renderLineItems(data.lineItems);
  renderOrderTotals(data.totals);
  renderActivityLog(data.tracking);
  renderNotificationToggle(data);
}

// ── Order Summary ──────────────────────────────────────────────────

function renderOrderSummary(data) {
  try {
    $w('#resultOrderNumber').text = `Order #${data.order.number}`;
  } catch (e) {}

  try {
    const dateStr = new Date(data.order.createdDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    $w('#resultOrderDate').text = `Placed ${dateStr}`;
  } catch (e) {}

  try {
    $w('#resultStatus').text = data.order.status;
    const statusColor = getStatusColor(data.order.fulfillmentStatus);
    $w('#resultStatus').style.color = statusColor;
  } catch (e) {}

  try {
    $w('#resultStatusDescription').text = data.order.statusDescription || '';
  } catch (e) {}
}

// ── Timeline Visualization ─────────────────────────────────────────

function renderTimeline(timeline, order) {
  try {
    const timelineContainer = $w('#trackingTimeline');
    if (!timelineContainer) return;

    const isException = order.fulfillmentStatus === 'EXCEPTION' || order.fulfillmentStatus === 'RETURNED';

    try { timelineContainer.accessibility.role = 'list'; } catch (e) {}
    try { timelineContainer.accessibility.ariaLabel = 'Order tracking timeline'; } catch (e) {}

    timeline.forEach((step, idx) => {
      try {
        const stepEl = $w(`#timelineStep${idx}`);
        const dotEl = $w(`#timelineDot${idx}`);
        const labelEl = $w(`#timelineLabel${idx}`);

        if (labelEl) labelEl.text = step.label;

        if (dotEl) {
          if (isException && step.current) {
            dotEl.style.backgroundColor = colors.sunsetCoral;
          } else if (step.completed) {
            dotEl.style.backgroundColor = colors.success;
          } else if (step.current) {
            dotEl.style.backgroundColor = colors.mountainBlue;
          } else {
            dotEl.style.backgroundColor = colors.muted || '#D1D5DB';
          }
        }

        if (labelEl) {
          if (step.current) {
            labelEl.style.fontWeight = String(typography.h4.weight);
            labelEl.style.color = isException ? colors.sunsetCoral : colors.mountainBlue;
            try { labelEl.accessibility.ariaLabel = `Current step: ${step.label}`; } catch (e) {}
          } else if (step.completed) {
            labelEl.style.color = colors.success;
            try { labelEl.accessibility.ariaLabel = `Completed: ${step.label}`; } catch (e) {}
          } else {
            labelEl.style.color = colors.mutedBrown || colors.muted || '#9CA3AF';
            try { labelEl.accessibility.ariaLabel = `Pending: ${step.label}`; } catch (e) {}
          }
        }
      } catch (e) {}
    });

    timelineContainer.expand();
  } catch (e) {}
}

// ── Shipping Details ───────────────────────────────────────────────

function renderShippingDetails(shipping) {
  try {
    const section = $w('#shippingDetailsSection');
    if (!section) return;

    if (shipping.trackingNumber) {
      try { $w('#carrierName').text = shipping.carrier || 'UPS'; } catch (e) {}
      try { $w('#serviceName').text = shipping.serviceName || ''; } catch (e) {}
      try { $w('#trackingNumberText').text = shipping.trackingNumber; } catch (e) {}

      // Estimated delivery
      try {
        if (shipping.estimatedDelivery) {
          const estDate = new Date(shipping.estimatedDelivery);
          $w('#estimatedDelivery').text = `Estimated delivery: ${estDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}`;
        } else {
          $w('#estimatedDelivery').text = 'Estimated delivery: Pending';
        }
      } catch (e) {}

      // Shipping destination
      try {
        const addr = shipping.shippingAddress;
        if (addr.city && addr.state) {
          $w('#shippingDestination').text = `Delivering to ${addr.city}, ${addr.state} ${addr.postalCode}`;
        }
      } catch (e) {}

      // UPS tracking link button
      try {
        try { $w('#upsTrackingBtn').accessibility.ariaLabel = 'View on UPS website'; } catch (e) {}
        $w('#upsTrackingBtn').onClick(() => {
          import('wix-window-frontend').then(({ openUrl }) => {
            openUrl(`https://www.ups.com/track?tracknum=${shipping.trackingNumber}`, '_blank');
          });
          trackEvent('ups_tracking_click', { trackingNumber: shipping.trackingNumber });
        });
      } catch (e) {}

      section.expand();
    } else {
      // No tracking yet — show a message
      try {
        $w('#noTrackingMessage').text = 'Your order is being prepared. Tracking information will appear here once your items ship.';
        $w('#noTrackingMessage').show();
      } catch (e) {}
      section.expand();
    }
  } catch (e) {}
}

// ── Line Items ─────────────────────────────────────────────────────

function renderLineItems(lineItems) {
  try {
    const repeater = $w('#trackingItemsRepeater');
    if (!repeater || !lineItems.length) return;

    repeater.onItemReady(($item, itemData) => {
      try { $item('#itemImage').src = itemData.image || ''; } catch (e) {}
      try { $item('#itemImage').alt = `${itemData.name} product image`; } catch (e) {}
      try { $item('#itemName').text = itemData.name; } catch (e) {}
      try { $item('#itemQty').text = `Qty: ${itemData.quantity}`; } catch (e) {}
      try { $item('#itemPrice').text = `$${Number(itemData.price).toFixed(2)}`; } catch (e) {}
      try { $item('#itemSku').text = itemData.sku ? `SKU: ${itemData.sku}` : ''; } catch (e) {}
    });

    repeater.data = lineItems.map((item, idx) => ({
      _id: `item-${idx}`,
      ...item,
    }));

    try { $w('#lineItemsSection').expand(); } catch (e) {}
  } catch (e) {}
}

// ── Order Totals ───────────────────────────────────────────────────

function renderOrderTotals(totals) {
  try {
    $w('#totalSubtotal').text = `$${Number(totals.subtotal).toFixed(2)}`;
  } catch (e) {}
  try {
    $w('#totalShipping').text = totals.shipping > 0 ? `$${Number(totals.shipping).toFixed(2)}` : 'Free';
  } catch (e) {}
  try {
    $w('#totalAmount').text = `$${Number(totals.total).toFixed(2)}`;
    $w('#totalAmount').style.fontWeight = String(typography.h3.weight);
  } catch (e) {}
}

// ── Activity Log ───────────────────────────────────────────────────

function renderActivityLog(tracking) {
  try {
    const repeater = $w('#activityRepeater');
    if (!repeater) return;

    if (!tracking || !tracking.activities || tracking.activities.length === 0) {
      try { $w('#activitySection').collapse(); } catch (e) {}
      return;
    }

    repeater.onItemReady(($item, itemData) => {
      try { $item('#activityStatus').text = itemData.status || ''; } catch (e) {}
      try { $item('#activityLocation').text = itemData.location || ''; } catch (e) {}
      try {
        const dateStr = itemData.date || '';
        const timeStr = itemData.time || '';
        let formatted = '';
        if (dateStr) {
          // UPS date format: YYYYMMDD → readable
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          const d = new Date(`${year}-${month}-${day}`);
          formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        if (timeStr && timeStr.length >= 4) {
          const h = parseInt(timeStr.substring(0, 2));
          const m = timeStr.substring(2, 4);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
          formatted += ` ${h12}:${m} ${ampm}`;
        }
        $item('#activityDateTime').text = formatted;
      } catch (e) {}
    });

    repeater.data = tracking.activities.map((act, idx) => ({
      _id: `activity-${idx}`,
      ...act,
    }));

    try { $w('#activitySection').expand(); } catch (e) {}
  } catch (e) {}
}

// ── Notification Toggle ────────────────────────────────────────────

function renderNotificationToggle(data) {
  try {
    const section = $w('#notificationSection');
    if (!section) return;

    // Only show if there's a tracking number
    if (!data.shipping?.trackingNumber) {
      section.collapse();
      return;
    }

    const toggle = $w('#notificationToggle');
    if (!toggle) return;

    toggle.checked = data.notificationsEnabled;
    try { toggle.accessibility.ariaLabel = 'Email notifications for shipment updates'; } catch (e) {}

    try {
      $w('#notificationLabel').text = data.notificationsEnabled
        ? 'You\'ll receive email updates about this shipment'
        : 'Get email updates about this shipment';
    } catch (e) {}

    toggle.onChange(async () => {
      try {
        const orderNumber = data.order.number;
        const email = ($w('#emailInput').value || '').trim().toLowerCase();

        if (toggle.checked) {
          const result = await subscribeToNotifications(orderNumber, email);
          if (result.success) {
            try { $w('#notificationLabel').text = 'You\'ll receive email updates about this shipment'; } catch (e) {}
            trackEvent('tracking_notifications_on', { orderNumber });
          }
        } else {
          const result = await unsubscribeFromNotifications(orderNumber, email);
          if (result.success) {
            try { $w('#notificationLabel').text = 'Get email updates about this shipment'; } catch (e) {}
            trackEvent('tracking_notifications_off', { orderNumber });
          }
        }
      } catch (err) {
        console.error('[OrderTracking] Notification toggle error:', err);
        // Revert toggle on failure
        toggle.checked = !toggle.checked;
      }
    });

    section.expand();
  } catch (e) {}
}

// ── Auto-Refresh ───────────────────────────────────────────────────
// Refresh tracking every 5 minutes for in-transit shipments

function startAutoRefresh(data) {
  clearAutoRefresh();

  const activeStatuses = ['LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];
  if (!activeStatuses.includes(data.order.fulfillmentStatus)) return;
  if (!data.shipping?.trackingNumber) return;

  _autoRefreshTimer = setInterval(async () => {
    try {
      const result = await getTrackingTimeline(data.shipping.trackingNumber);
      if (result.success) {
        renderTimeline(result.timeline, { fulfillmentStatus: result.fulfillmentStatus });
        renderActivityLog({ activities: result.activities });

        // Update status display
        try {
          $w('#resultStatus').text = result.statusLabel;
          $w('#resultStatus').style.color = getStatusColor(result.fulfillmentStatus);
        } catch (e) {}

        // Update estimated delivery
        try {
          if (result.estimatedDelivery) {
            const estDate = new Date(result.estimatedDelivery);
            $w('#estimatedDelivery').text = `Estimated delivery: ${estDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}`;
          }
        } catch (e) {}

        // Stop refresh if delivered
        if (result.fulfillmentStatus === 'DELIVERED') {
          clearAutoRefresh();
        }
      }
    } catch (e) {
      console.error('[OrderTracking] Auto-refresh error:', e);
    }
  }, 300000); // 5 minutes
}

function clearAutoRefresh() {
  if (_autoRefreshTimer) {
    clearInterval(_autoRefreshTimer);
    _autoRefreshTimer = null;
  }
}

// ── Results Section Visibility ─────────────────────────────────────

function initResultsSection() {
  try { $w('#trackingResultsSection').collapse(); } catch (e) {}
  try { $w('#activitySection').collapse(); } catch (e) {}
  try { $w('#lineItemsSection').collapse(); } catch (e) {}
  try { $w('#notificationSection').collapse(); } catch (e) {}
  try { $w('#noTrackingMessage').hide(); } catch (e) {}
  try { $w('#trackingError').hide(); } catch (e) {}
  try { $w('#trackingLoader').hide(); } catch (e) {}

  // New search button (visible after results)
  try {
    try { $w('#newSearchBtn').accessibility.ariaLabel = 'Track a different order'; } catch (e) {}
    $w('#newSearchBtn').onClick(() => {
      showResults(false);
      clearAutoRefresh();
      _currentOrder = null;
      $w('#orderNumberInput').value = '';
      $w('#emailInput').value = '';
      try { $w('#orderNumberInput').focus(); } catch (e) {}
    });
  } catch (e) {}

  // Refresh button
  try {
    try { $w('#refreshTrackingBtn').accessibility.ariaLabel = 'Refresh tracking status'; } catch (e) {}
    $w('#refreshTrackingBtn').onClick(() => handleLookup());
  } catch (e) {}
}

function showResults(visible) {
  try {
    if (visible) {
      $w('#trackingResultsSection').expand();
      $w('#trackingResultsSection').scrollTo();
    } else {
      $w('#trackingResultsSection').collapse();
    }
  } catch (e) {}
}

// ── Error & Loading States ─────────────────────────────────────────

function showError(message) {
  try {
    $w('#trackingError').text = message;
    $w('#trackingError').show('fade', { duration: 200 });
    $w('#trackingError').style.color = colors.sunsetCoral;
    announce($w, message);
  } catch (e) {}
}

function hideError() {
  try { $w('#trackingError').hide('fade', { duration: 200 }); } catch (e) {}
}

function showLoading(loading) {
  try {
    if (loading) {
      $w('#trackOrderBtn').disable();
      $w('#trackOrderBtn').label = 'Looking up...';
      $w('#trackingLoader').show();
    } else {
      $w('#trackOrderBtn').enable();
      $w('#trackOrderBtn').label = 'Track Order';
      $w('#trackingLoader').hide();
    }
  } catch (e) {}
}

// ── Status Color Helper ────────────────────────────────────────────

function getStatusColor(fulfillmentStatus) {
  switch (fulfillmentStatus) {
    case 'DELIVERED': return colors.success;
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
    case 'PICKED_UP':
    case 'LABEL_CREATED': return colors.mountainBlue;
    case 'EXCEPTION':
    case 'RETURNED': return colors.sunsetCoral;
    default: return colors.mutedBrown || colors.muted || '#6B7280';
  }
}
