// ProductSizeGuide.js - Dimension display, room fit checker, and size comparison
// Shows product dimensions with unit toggle, "Will It Fit?" calculator,
// and comparison table against similar products.
// Integrates with sizeGuide.web.js backend.

import { announce, makeClickable } from 'public/a11yHelpers.js';
import { validateDimension } from 'public/validators.js';
import { isMobile } from 'public/mobileHelpers';

let _currentUnit = 'in';

// ── Dimension Display ─────────────────────────────────────────────────

/**
 * Initialize the dimension display section on a product page.
 * Shows closed/open position measurements, weight, seat height, mattress size.
 * Includes unit toggle for inches/centimeters.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product.
 */
export async function initDimensionDisplay($w, state) {
  try {
    if (!state.product) return;

    const { getProductDimensions } = await import('backend/sizeGuide.web');
    const dims = await getProductDimensions(state.product._id, 'in');

    if (!dims) {
      try { $w('#dimensionSection').expand(); } catch (e) {}
      try { $w('#dimensionTitle').text = 'Dimensions'; } catch (e) {}
      try { $w('#dimensionPlaceholder').text = 'Dimensions coming soon'; } catch (e) {}
      try { $w('#dimensionPlaceholder').show(); } catch (e) {}
      try { $w('#dimensionGrid').hide(); } catch (e) {}
      return;
    }

    state.dimensions = dims;

    try { $w('#dimensionSection').expand(); } catch (e) {}
    try { $w('#dimensionTitle').text = 'Dimensions'; } catch (e) {}
    try { $w('#dimensionPlaceholder').hide(); } catch (e) {}
    try { $w('#dimensionGrid').show(); } catch (e) {}

    renderDimensions($w, dims);

    // Unit toggle (in/cm)
    try {
      const unitToggle = $w('#unitToggle');
      if (unitToggle) {
        unitToggle.options = [
          { label: 'Inches', value: 'in' },
          { label: 'Centimeters', value: 'cm' },
        ];
        unitToggle.value = 'in';
        try { unitToggle.accessibility.ariaLabel = 'Switch dimension units'; } catch (e) {}

        let _unitToggleTimer = null;
        unitToggle.onChange(() => {
          clearTimeout(_unitToggleTimer);
          _unitToggleTimer = setTimeout(async () => {
            _currentUnit = unitToggle.value;
            const converted = await getProductDimensions(state.product._id, _currentUnit);
            if (converted) {
              state.dimensions = converted;
              renderDimensions($w, converted);
            }
          }, 300);
        });
      }
    } catch (e) {}

    // Weight display
    if (dims.weight) {
      try { $w('#productWeight').text = `Weight: ${dims.weight} lbs`; } catch (e) {}
    }

    // Mattress size
    if (dims.mattressSize) {
      try { $w('#mattressSize').text = `Mattress Size: ${dims.mattressSize}`; } catch (e) {}
    }
  } catch (e) {
    console.error('[ProductSizeGuide] Failed to load dimensions:', e?.message || e);
    try { $w('#dimensionSection').expand(); } catch (e2) {}
    try { $w('#dimensionPlaceholder').text = 'Dimensions temporarily unavailable'; } catch (e2) {}
    try { $w('#dimensionPlaceholder').show(); } catch (e2) {}
    try { $w('#dimensionGrid').hide(); } catch (e2) {}
  }
}

// ── Room Fit Checker ──────────────────────────────────────────────────

/**
 * Initialize the "Will It Fit?" room fit checker form.
 * Accepts doorway, hallway, and room dimensions and checks product fit.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product.
 */
export async function initRoomFitChecker($w, state) {
  try {
    if (!state.product) return;

    try { $w('#roomFitTitle').text = 'Will It Fit?'; } catch (e) {}
    try { $w('#roomFitTitle').accessibility.ariaLabel = 'Room fit checker'; } catch (e) {}

    // ARIA labels for input fields
    try { $w('#doorwayWidth').accessibility.ariaLabel = 'Doorway width in inches'; } catch (e) {}
    try { $w('#doorwayHeight').accessibility.ariaLabel = 'Doorway height in inches'; } catch (e) {}
    try { $w('#hallwayWidth').accessibility.ariaLabel = 'Hallway width in inches'; } catch (e) {}
    try { $w('#roomWidth').accessibility.ariaLabel = 'Room width in inches'; } catch (e) {}
    try { $w('#roomDepth').accessibility.ariaLabel = 'Room depth in inches'; } catch (e) {}

    // Check fit button
    try {
      $w('#checkFitBtn').onClick(async () => {
        try {
          $w('#checkFitBtn').disable();
          $w('#checkFitBtn').label = 'Checking...';

          const roomDims = {};
          let hasValidInput = false;
          try {
            const dw = parseFloat($w('#doorwayWidth').value);
            const dh = parseFloat($w('#doorwayHeight').value);
            if (validateDimension(dw, 1, 120) && validateDimension(dh, 1, 120)) {
              roomDims.doorwayWidth = dw;
              roomDims.doorwayHeight = dh;
              hasValidInput = true;
            }
          } catch (e) {}

          try {
            const hw = parseFloat($w('#hallwayWidth').value);
            if (validateDimension(hw, 1, 240)) {
              roomDims.hallwayWidth = hw;
              hasValidInput = true;
            }
          } catch (e) {}

          try {
            const rw = parseFloat($w('#roomWidth').value);
            const rd = parseFloat($w('#roomDepth').value);
            if (validateDimension(rw, 1, 600) && validateDimension(rd, 1, 600)) {
              roomDims.roomWidth = rw;
              roomDims.roomDepth = rd;
              hasValidInput = true;
            }
          } catch (e) {}

          if (!hasValidInput) {
            try { $w('#fitResultText').text = 'Please enter valid dimensions (positive numbers within realistic ranges).'; } catch (e) {}
            try { $w('#fitResultSection').show(); } catch (e) {}
            $w('#checkFitBtn').label = 'Check Fit';
            $w('#checkFitBtn').enable();
            return;
          }

          const { checkRoomFit } = await import('backend/sizeGuide.web');
          const result = await checkRoomFit(state.product._id, roomDims);
          displayFitResults($w, result);

          $w('#checkFitBtn').label = 'Check Fit';
          $w('#checkFitBtn').enable();
        } catch (e) {
          try { $w('#checkFitBtn').label = 'Check Fit'; } catch (e2) {}
          try { $w('#checkFitBtn').enable(); } catch (e2) {}
        }
      });
      try { $w('#checkFitBtn').accessibility.ariaLabel = 'Check if product fits your space'; } catch (e) {}
    } catch (e) {}
  } catch (e) {}
}

// ── Size Comparison Table ─────────────────────────────────────────────

/**
 * Initialize the size comparison table showing current product vs similar products.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product.
 */
export async function initSizeComparisonTable($w, state) {
  try {
    if (!state.product) return;

    const { getComparisonTable } = await import('backend/sizeGuide.web');
    const maxProducts = isMobile() ? 3 : 5;
    const data = await getComparisonTable(state.product._id, _currentUnit, maxProducts);

    if (!data.success || data.products.length < 2) {
      try { $w('#sizeCompareSection').collapse(); } catch (e) {}
      return;
    }

    try { $w('#sizeCompareSection').expand(); } catch (e) {}
    try { $w('#sizeCompareTitle').text = 'Compare Sizes'; } catch (e) {}
    try { $w('#sizeCompareTitle').accessibility.ariaLabel = 'Size comparison table for similar products'; } catch (e) {}

    renderSizeComparisonTable($w, data);
  } catch (e) {}
}

// ── Internal Helpers ──────────────────────────────────────────────────

function renderDimensions($w, dims) {
  const unit = dims.unit === 'cm' ? 'cm' : '"';
  const fmt = (v) => v != null ? `${v}${unit}` : '—';

  try { $w('#closedDimsLabel').text = 'Closed (Sofa Position)'; } catch (e) {}
  try { $w('#closedDims').text = `${fmt(dims.closed.width)} W × ${fmt(dims.closed.depth)} D × ${fmt(dims.closed.height)} H`; } catch (e) {}
  try { $w('#openDimsLabel').text = 'Open (Bed Position)'; } catch (e) {}
  try { $w('#openDims').text = `${fmt(dims.open.width)} W × ${fmt(dims.open.depth)} D × ${fmt(dims.open.height)} H`; } catch (e) {}

  if (dims.seatHeight) {
    try { $w('#seatHeight').text = `Seat Height: ${fmt(dims.seatHeight)}`; } catch (e) {}
  }
}

function displayFitResults($w, result) {
  try {
    if (!result.success) {
      try { $w('#fitResultText').text = result.error || 'Unable to check fit'; } catch (e) {}
      try { $w('#fitResultSection').show(); } catch (e) {}
      return;
    }

    const { allFit, anyTight, checks } = result;
    const lines = [];

    for (const check of checks) {
      const icon = check.fits ? (check.tight ? '\u26A0' : '\u2713') : '\u2717';
      const label = check.check === 'doorway' ? 'Doorway'
        : check.check === 'hallway' ? 'Hallway'
        : 'Room';
      const detail = check.fits
        ? (check.tight ? 'Tight fit — measure carefully' : 'Good fit')
        : 'Will not fit';
      lines.push(`${icon} ${label}: ${detail}`);
    }

    if (allFit && !anyTight) {
      lines.unshift('Great news — this product fits your space!');
    } else if (allFit && anyTight) {
      lines.unshift('This product fits, but some areas are tight (< 2" clearance).');
    } else {
      lines.unshift('This product may not fit your space.');
    }

    try { $w('#fitResultText').text = lines.join('\n'); } catch (e) {}
    try { $w('#fitResultSection').show(); } catch (e) {}
    try { $w('#fitResultSection').accessibility.ariaLive = 'polite'; } catch (e) {}
    announce($w, lines[0]);
  } catch (e) {}
}

function renderSizeComparisonTable($w, data) {
  try {
    const repeater = $w('#sizeCompareRepeater');
    if (!repeater) return;

    const unit = data.unit === 'cm' ? 'cm' : '"';
    const fmt = (v) => v != null ? `${v}${unit}` : '—';

    repeater.data = data.products.map(p => ({
      _id: p.productId,
      ...p,
    }));

    repeater.onItemReady(($item, itemData) => {
      try {
        $item('#compareProductName').text = itemData.name;
        if (itemData.isCurrent) {
          try { $item('#compareProductName').style.fontWeight = 'bold'; } catch (e) {}
          try { $item('#compareCurrentBadge').show(); } catch (e) {}
        } else {
          try { $item('#compareCurrentBadge').hide(); } catch (e) {}
        }
      } catch (e) {}

      try {
        $item('#compareClosedDims').text = itemData.closed
          ? `${fmt(itemData.closed.width)} W × ${fmt(itemData.closed.depth)} D × ${fmt(itemData.closed.height)} H`
          : '—';
      } catch (e) {}

      try {
        $item('#compareOpenDims').text = itemData.open
          ? `${fmt(itemData.open.width)} W × ${fmt(itemData.open.depth)} D × ${fmt(itemData.open.height)} H`
          : '—';
      } catch (e) {}

      try {
        $item('#compareWeight').text = itemData.weight ? `${itemData.weight} lbs` : '—';
        if (isMobile()) $item('#compareWeight').collapse();
      } catch (e) {}

      try {
        $item('#compareMattressSize').text = itemData.mattressSize || '—';
        if (isMobile()) $item('#compareMattressSize').collapse();
      } catch (e) {}

      // Navigate to product on click (unless current)
      if (!itemData.isCurrent && itemData.slug) {
        try {
          const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${itemData.slug}`));
          makeClickable($item('#compareProductName'), nav, { ariaLabel: `View ${itemData.name}`, role: 'link' });
        } catch (e) {}
      }
    });
  } catch (e) {}
}
