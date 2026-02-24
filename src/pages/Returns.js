// Returns.js - Self-Service Returns & Exchanges Page
// Guest-accessible: lookup by order number + email, initiate returns,
// track return shipment status via RMA number
import { lookupReturn, submitGuestReturn, trackReturnShipment, getReturnReasons } from 'backend/returnsService.web';
import { trackEvent } from 'public/engagementTracker';
import { colors, typography } from 'public/designTokens.js';
import { checkReturnWindow, isItemReturnable, getStatusTimeline, formatReturnStatus, getStatusColor, getReturnableItems } from 'public/ReturnsPortal.js';
import { initBackToTop } from 'public/mobileHelpers';
import { announce } from 'public/a11yHelpers.js';

let _currentOrder = null;
let _currentReturns = [];
let _reasons = [];

$w.onReady(async function () {
  initBackToTop($w);
  await loadReturnReasons();
  initLookupForm();
  initRmaTracker();
  initReturnForm();
  initResultsSections();
  prefillFromQueryParams();
  trackEvent('page_view', { page: 'returns' });
});

// ── Return Reasons ──────────────────────────────────────────────────

async function loadReturnReasons() {
  try {
    const { reasons } = await getReturnReasons();
    _reasons = reasons || [];
  } catch (e) {}
}

// ── Lookup Form ─────────────────────────────────────────────────────

function initLookupForm() {
  try {
    $w('#returnsTitle').text = 'Returns & Exchanges';
    $w('#returnsSubtitle').text = 'Start a return, exchange, or check the status of an existing return.';
  } catch (e) {}

  try { $w('#returnOrderNumberInput').accessibility.ariaLabel = 'Order number'; } catch (e) {}
  try { $w('#returnEmailInput').accessibility.ariaLabel = 'Email address used for this order'; } catch (e) {}
  try { $w('#lookupReturnBtn').accessibility.ariaLabel = 'Look up order for return'; } catch (e) {}

  try {
    $w('#lookupReturnBtn').onClick(() => handleLookup());
  } catch (e) {}

  // Enter key submits
  try {
    $w('#returnEmailInput').onKeyPress((event) => {
      if (event.key === 'Enter') handleLookup();
    });
    $w('#returnOrderNumberInput').onKeyPress((event) => {
      if (event.key === 'Enter') handleLookup();
    });
  } catch (e) {}
}

// ── RMA Tracker ─────────────────────────────────────────────────────

function initRmaTracker() {
  try { $w('#rmaInput').accessibility.ariaLabel = 'RMA number'; } catch (e) {}
  try { $w('#trackRmaBtn').accessibility.ariaLabel = 'Track return by RMA number'; } catch (e) {}

  try {
    $w('#trackRmaBtn').onClick(() => handleRmaTrack());
  } catch (e) {}

  try {
    $w('#rmaInput').onKeyPress((event) => {
      if (event.key === 'Enter') handleRmaTrack();
    });
  } catch (e) {}
}

// ── Prefill from URL ────────────────────────────────────────────────

async function prefillFromQueryParams() {
  try {
    const wixLocation = await import('wix-location-frontend');
    const query = wixLocation.query;
    if (query.order) {
      $w('#returnOrderNumberInput').value = query.order;
      if (query.email) {
        $w('#returnEmailInput').value = query.email;
        handleLookup();
      }
    }
    if (query.rma) {
      $w('#rmaInput').value = query.rma;
      handleRmaTrack();
    }
  } catch (e) {}
}

// ── Lookup Handler ──────────────────────────────────────────────────

async function handleLookup() {
  const orderNumber = ($w('#returnOrderNumberInput').value || '').trim();
  const email = ($w('#returnEmailInput').value || '').trim();

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
    const result = await lookupReturn(orderNumber, email);

    if (!result.success) {
      showError(result.error || 'Order not found. Please check your details and try again.');
      showLoading(false);
      return;
    }

    _currentOrder = result.order;
    _currentReturns = result.returns || [];

    renderOrderDetails(result.order);

    if (_currentReturns.length > 0) {
      renderExistingReturns(_currentReturns);
    } else {
      renderReturnForm(result.order);
    }

    showLoading(false);
    try { $w('#returnResultsSection').expand(); } catch (e) {}
    try { $w('#returnResultsSection').scrollTo(); } catch (e) {}
    announce($w, `Order ${orderNumber} found. ${_currentReturns.length > 0 ? _currentReturns.length + ' existing return' + (_currentReturns.length > 1 ? 's' : '') + ' found.' : 'You can start a new return.'}`);
    trackEvent('return_lookup', { orderNumber });
  } catch (err) {
    console.error('[Returns] Lookup error:', err);
    showError('Something went wrong. Please try again.');
    showLoading(false);
  }
}

// ── RMA Tracking Handler ────────────────────────────────────────────

async function handleRmaTrack() {
  const rmaNumber = ($w('#rmaInput').value || '').trim();

  if (!rmaNumber) {
    showError('Please enter your RMA number.');
    return;
  }

  showLoading(true);
  hideError();

  try {
    const result = await trackReturnShipment(rmaNumber);

    if (!result.success) {
      showError(result.error || 'Return not found.');
      showLoading(false);
      return;
    }

    renderRmaStatus(result);
    showLoading(false);
    try { $w('#rmaResultsSection').expand(); } catch (e) {}
    try { $w('#rmaResultsSection').scrollTo(); } catch (e) {}
    announce($w, `Return ${rmaNumber} status: ${result.status || 'found'}`);
    trackEvent('rma_tracked', { rmaNumber });
  } catch (err) {
    console.error('[Returns] RMA tracking error:', err);
    showError('Something went wrong. Please try again.');
    showLoading(false);
  }
}

// ── Render Order Details ────────────────────────────────────────────

function renderOrderDetails(order) {
  try {
    $w('#returnOrderNumber').text = `Order #${order.number}`;
  } catch (e) {}

  try {
    $w('#returnOrderDate').text = order.date || '';
  } catch (e) {}

  try {
    $w('#returnOrderTotal').text = `$${Number(order.total).toFixed(2)}`;
  } catch (e) {}

  // Return window status
  try {
    const windowCheck = checkReturnWindow(order.date);
    $w('#returnWindowStatus').text = windowCheck.message;
    $w('#returnWindowStatus').style.color = windowCheck.eligible ? colors.success : colors.error;
  } catch (e) {}
}

// ── Render Existing Returns ─────────────────────────────────────────

function renderExistingReturns(returns) {
  try {
    const repeater = $w('#existingReturnsRepeater');
    if (!repeater) return;

    repeater.data = returns.map(r => ({ ...r, _id: r._id }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#existingRma').text = itemData.rmaNumber; } catch (e) {}
      try { $item('#existingReturnDate').text = itemData.date; } catch (e) {}
      try { $item('#existingReturnType').text = itemData.type === 'exchange' ? 'Exchange' : 'Return'; } catch (e) {}
      try { $item('#existingReturnReason').text = itemData.reason; } catch (e) {}

      // Status badge
      try {
        const statusText = formatReturnStatus(itemData.status);
        $item('#existingReturnStatus').text = statusText;
        $item('#existingReturnStatus').style.color = getStatusColor(itemData.status);
        try { $item('#existingReturnStatus').accessibility.ariaLabel = `Return status: ${statusText}`; } catch (e) {}
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
        $item('#existingReturnTimeline').text = timelineText;
        try { $item('#existingReturnTimeline').accessibility.ariaLabel = 'Return progress timeline'; } catch (e) {}
        try { $item('#existingReturnTimeline').accessibility.role = 'list'; } catch (e) {}
      } catch (e) {}

      // Tracking number
      try {
        if (itemData.returnTrackingNumber) {
          $item('#existingTrackingNumber').text = `Tracking: ${itemData.returnTrackingNumber}`;
          $item('#existingTrackingNumber').show();
        } else {
          $item('#existingTrackingNumber').hide();
        }
      } catch (e) {}
    });

    try { $w('#existingReturnsSection').expand(); } catch (e) {}
    try { $w('#returnFormSection').collapse(); } catch (e) {}
  } catch (e) {}
}

// ── Render Return Form ──────────────────────────────────────────────

function renderReturnForm(order) {
  try { $w('#existingReturnsSection').collapse(); } catch (e) {}

  // Populate reason dropdown
  try {
    const reasonDropdown = $w('#returnReasonSelect');
    if (reasonDropdown) {
      reasonDropdown.options = _reasons.map(r => ({ label: r.label, value: r.value }));
      try { reasonDropdown.accessibility.ariaLabel = 'Select return reason'; } catch (e) {}
    }
  } catch (e) {}

  // Populate return type
  try {
    const typeDropdown = $w('#returnTypeSelect');
    if (typeDropdown) {
      typeDropdown.options = [
        { label: 'Return (refund)', value: 'return' },
        { label: 'Exchange', value: 'exchange' },
      ];
      try { typeDropdown.accessibility.ariaLabel = 'Return or exchange'; } catch (e) {}
    }
  } catch (e) {}

  // Populate items repeater
  try {
    const repeater = $w('#returnItemsSelector');
    if (!repeater) return;

    const items = getReturnableItems(order.lineItems || []);
    repeater.data = items.map(item => ({ ...item, _id: item._id }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#selectItemName').text = itemData.name; } catch (e) {}
      try { $item('#selectItemQty').text = `Qty: ${itemData.quantity}`; } catch (e) {}
      try { $item('#selectItemPrice').text = `$${Number(itemData.price).toFixed(2)}`; } catch (e) {}

      if (itemData.image) {
        try { $item('#selectItemImage').src = itemData.image; } catch (e) {}
        try { $item('#selectItemImage').alt = `${itemData.name} product image`; } catch (e) {}
      }

      try { $item('#selectItemCheckbox').accessibility.ariaLabel = `Select ${itemData.name} for return`; } catch (e) {}

      if (!itemData.returnable) {
        try {
          $item('#selectItemCheckbox').disable();
          $item('#selectItemBlockReason').text = itemData.returnBlockReason;
          $item('#selectItemBlockReason').show();
        } catch (e) {}
      } else {
        try {
          $item('#selectItemCheckbox').enable();
          try { $item('#selectItemBlockReason').hide(); } catch (e) {}
        } catch (e) {}
      }
    });
  } catch (e) {}

  try { $w('#returnFormSection').expand(); } catch (e) {}
}

// ── Init Return Form Submit ─────────────────────────────────────────

function initReturnForm() {
  try {
    $w('#submitGuestReturnBtn').onClick(async () => {
      await handleGuestReturnSubmit();
    });
    try { $w('#submitGuestReturnBtn').accessibility.ariaLabel = 'Submit return request'; } catch (e) {}
  } catch (e) {}

  try {
    $w('#cancelReturnFormBtn').onClick(() => {
      try { $w('#returnFormSection').collapse(); } catch (e) {}
      try { $w('#returnResultsSection').collapse(); } catch (e) {}
    });
    try { $w('#cancelReturnFormBtn').accessibility.ariaLabel = 'Cancel return'; } catch (e) {}
  } catch (e) {}
}

async function handleGuestReturnSubmit() {
  try {
    const orderNumber = ($w('#returnOrderNumberInput').value || '').trim();
    const email = ($w('#returnEmailInput').value || '').trim();
    const reason = $w('#returnReasonSelect')?.value || '';
    try { $w('#returnDetailsTextbox').accessibility.ariaLabel = 'Additional return details'; } catch (e) {}
    const details = $w('#returnDetailsTextbox')?.value || '';
    const returnType = $w('#returnTypeSelect')?.value || 'return';

    if (!reason) {
      showFormError('Please select a return reason.');
      return;
    }

    // Collect selected items (placeholder — in Wix, iterate repeater)
    const items = _currentOrder?.lineItems
      ?.filter(li => {
        const check = isItemReturnable(li);
        return check.returnable;
      })
      .map(li => ({ lineItemId: li._id, quantity: li.quantity })) || [];

    if (items.length === 0) {
      showFormError('No returnable items found.');
      return;
    }

    try { $w('#submitGuestReturnBtn').disable(); } catch (e) {}
    try { $w('#submitGuestReturnBtn').label = 'Submitting...'; } catch (e) {}
    hideFormError();

    const result = await submitGuestReturn({
      orderNumber,
      email,
      items,
      reason,
      details,
      type: returnType,
    });

    if (result.success) {
      try {
        $w('#returnSuccessMessage').text = `Return request submitted! Your RMA number is ${result.rmaNumber}. Keep this number to track your return status.`;
        try { $w('#returnSuccessMessage').accessibility.role = 'status'; } catch (e) {}
        $w('#returnSuccessMessage').show();
      } catch (e) {}
      try { $w('#returnFormSection').collapse(); } catch (e) {}
      announce($w, `Return submitted successfully. RMA number: ${result.rmaNumber}`);
      trackEvent('guest_return_submitted', { rmaNumber: result.rmaNumber, type: returnType });
    } else {
      showFormError(result.error || 'Unable to submit return.');
    }

    try { $w('#submitGuestReturnBtn').enable(); } catch (e) {}
    try { $w('#submitGuestReturnBtn').label = 'Submit Return'; } catch (e) {}
  } catch (e) {
    showFormError('Something went wrong. Please try again.');
    try { $w('#submitGuestReturnBtn').enable(); } catch (e2) {}
    try { $w('#submitGuestReturnBtn').label = 'Submit Return'; } catch (e2) {}
  }
}

// ── Render RMA Status ───────────────────────────────────────────────

function renderRmaStatus(result) {
  try {
    $w('#rmaStatusNumber').text = `RMA: ${result.rmaNumber}`;
  } catch (e) {}

  try {
    const statusText = formatReturnStatus(result.status);
    $w('#rmaStatusLabel').text = statusText;
    $w('#rmaStatusLabel').style.color = getStatusColor(result.status);
    try { $w('#rmaStatusLabel').accessibility.ariaLabel = `Return status: ${statusText}`; } catch (e) {}
  } catch (e) {}

  // Timeline
  try {
    const timeline = getStatusTimeline(result.status);
    const timelineText = timeline.map(step => {
      const marker = step.state === 'completed' ? '\u2713'
        : step.state === 'active' ? '\u25CF'
        : '\u25CB';
      return `${marker} ${step.label}`;
    }).join('\n');
    $w('#rmaTimeline').text = timelineText;
    try { $w('#rmaTimeline').accessibility.ariaLabel = 'Return progress timeline'; } catch (e) {}
    try { $w('#rmaTimeline').accessibility.role = 'list'; } catch (e) {}
  } catch (e) {}

  // Tracking info
  if (result.tracking) {
    try {
      $w('#rmaTrackingNumber').text = `Tracking: ${result.tracking.trackingNumber}`;
      $w('#rmaTrackingStatus').text = result.tracking.status || '';
      $w('#rmaTrackingSection').expand();
    } catch (e) {}

    // Activity log
    try {
      const repeater = $w('#rmaActivityRepeater');
      if (repeater && result.tracking.activities?.length > 0) {
        repeater.data = result.tracking.activities.map((act, idx) => ({
          _id: `rma-act-${idx}`,
          ...act,
        }));

        repeater.onItemReady(($item, itemData) => {
          try { $item('#rmaActivityStatus').text = itemData.status || ''; } catch (e) {}
          try { $item('#rmaActivityLocation').text = itemData.location || ''; } catch (e) {}
          try {
            const dateStr = itemData.date || '';
            let formatted = '';
            if (dateStr && dateStr.length >= 8) {
              const year = dateStr.substring(0, 4);
              const month = dateStr.substring(4, 6);
              const day = dateStr.substring(6, 8);
              const d = new Date(`${year}-${month}-${day}`);
              formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            $item('#rmaActivityDate').text = formatted;
          } catch (e) {}
        });
      }
    } catch (e) {}
  } else {
    try { $w('#rmaTrackingSection').collapse(); } catch (e) {}
    if (result.message) {
      try {
        $w('#rmaNoTracking').text = result.message;
        $w('#rmaNoTracking').show();
      } catch (e) {}
    }
  }
}

// ── Results Section Visibility ──────────────────────────────────────

function initResultsSections() {
  try { $w('#returnResultsSection').collapse(); } catch (e) {}
  try { $w('#existingReturnsSection').collapse(); } catch (e) {}
  try { $w('#returnFormSection').collapse(); } catch (e) {}
  try { $w('#rmaResultsSection').collapse(); } catch (e) {}
  try { $w('#rmaTrackingSection').collapse(); } catch (e) {}
  try { $w('#returnError').hide(); } catch (e) {}
  try { $w('#returnFormError').hide(); } catch (e) {}
  try { $w('#returnSuccessMessage').hide(); } catch (e) {}
  try { $w('#returnLoader').hide(); } catch (e) {}
  try { $w('#rmaNoTracking').hide(); } catch (e) {}

  // New search button
  try {
    try { $w('#newReturnSearchBtn').accessibility.ariaLabel = 'Start a new return lookup'; } catch (e) {}
    $w('#newReturnSearchBtn').onClick(() => {
      try { $w('#returnResultsSection').collapse(); } catch (e) {}
      try { $w('#rmaResultsSection').collapse(); } catch (e) {}
      try { $w('#returnSuccessMessage').hide(); } catch (e) {}
      _currentOrder = null;
      _currentReturns = [];
      $w('#returnOrderNumberInput').value = '';
      $w('#returnEmailInput').value = '';
      try { $w('#returnOrderNumberInput').focus(); } catch (e) {}
    });
  } catch (e) {}
}

// ── Error & Loading States ──────────────────────────────────────────

function showError(message) {
  try {
    $w('#returnError').text = message;
    try { $w('#returnError').accessibility.role = 'alert'; } catch (e) {}
    try { $w('#returnError').accessibility.ariaLive = 'assertive'; } catch (e) {}
    $w('#returnError').show('fade', { duration: 200 });
    $w('#returnError').style.color = colors.sunsetCoral;
  } catch (e) {}
}

function hideError() {
  try { $w('#returnError').hide('fade', { duration: 200 }); } catch (e) {}
}

function showFormError(message) {
  try {
    $w('#returnFormError').text = message;
    try { $w('#returnFormError').accessibility.role = 'alert'; } catch (e) {}
    try { $w('#returnFormError').accessibility.ariaLive = 'assertive'; } catch (e) {}
    $w('#returnFormError').show('fade', { duration: 200 });
    $w('#returnFormError').style.color = colors.sunsetCoral;
  } catch (e) {}
}

function hideFormError() {
  try { $w('#returnFormError').hide('fade', { duration: 200 }); } catch (e) {}
}

function showLoading(loading) {
  try {
    if (loading) {
      $w('#lookupReturnBtn').disable();
      $w('#lookupReturnBtn').label = 'Looking up...';
      $w('#returnLoader').show();
    } else {
      $w('#lookupReturnBtn').enable();
      $w('#lookupReturnBtn').label = 'Look Up Order';
      $w('#returnLoader').hide();
    }
  } catch (e) {}
}
