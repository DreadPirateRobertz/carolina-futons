// ProductSizeGuide.js - Dimension display, room fit checker, and size comparison
// Shows product dimensions with unit toggle, "Will It Fit?" calculator,
// and comparison table against similar products.
// Integrates with sizeGuide.web.js backend.

import { announce, makeClickable } from 'public/a11yHelpers.js';
import { validateDimension } from 'public/validators.js';
import { isMobile } from 'public/mobileHelpers';
import { colors } from 'public/sharedTokens.js';

let _currentUnit = 'in';
let _overlayVisible = false;

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

// ── Dimension Overlay ────────────────────────────────────────────────

/**
 * Initialize a toggleable SVG dimension overlay on the product gallery image.
 * Shows width/depth/height callouts over the main product image.
 * On mobile, skips the overlay (dimensions already shown inline).
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product and state.dimensions.
 */
export function initDimensionOverlay($w, state) {
  try {
    if (!state.product || !state.dimensions) return;
    if (isMobile()) return;

    _overlayVisible = false;

    try { $w('#dimensionOverlaySvg').hide(); } catch (e) {}

    try {
      const btn = $w('#dimensionOverlayBtn');
      btn.label = 'Show Dimensions';
      try { btn.accessibility.ariaLabel = 'Toggle dimension overlay on product image'; } catch (e) {}

      btn.onClick(() => {
        try {
          _overlayVisible = !_overlayVisible;
          if (_overlayVisible) {
            $w('#dimensionOverlaySvg').html = buildDimensionOverlaySvg(state.dimensions);
            $w('#dimensionOverlaySvg').show();
            btn.label = 'Hide Dimensions';
          } else {
            $w('#dimensionOverlaySvg').hide();
            btn.label = 'Show Dimensions';
          }
        } catch (e) {}
      });
    } catch (e) {}
  } catch (e) {}
}

// ── Doorway Presets ─────────────────────────────────────────────────

/**
 * Set up quick-check buttons for standard US door sizes (30", 32", 36").
 * Clicking a preset auto-fills the doorway width/height fields.
 *
 * @param {Function} $w - Wix selector function.
 */
export function initDoorwayPresets($w) {
  try {
    const STANDARD_DOOR_HEIGHT = '80';
    const presets = [
      { id: '#doorPreset30', width: '30', label: '30" Door', ariaLabel: 'Check fit for 30 inch standard door' },
      { id: '#doorPreset32', width: '32', label: '32" Door', ariaLabel: 'Check fit for 32 inch standard door' },
      { id: '#doorPreset36', width: '36', label: '36" Door', ariaLabel: 'Check fit for 36 inch standard door' },
    ];

    for (const preset of presets) {
      try {
        const btn = $w(preset.id);
        btn.label = preset.label;
        try { btn.accessibility.ariaLabel = preset.ariaLabel; } catch (e) {}

        btn.onClick(() => {
          try {
            $w('#doorwayWidth').value = preset.width;
            $w('#doorwayHeight').value = STANDARD_DOOR_HEIGHT;

            // Highlight active preset
            for (const p of presets) {
              try {
                $w(p.id).style.backgroundColor = p.id === preset.id
                  ? colors.sandLight
                  : '';
              } catch (e) {}
            }
          } catch (e) {}
        });
      } catch (e) {}
    }
  } catch (e) {}
}

// ── Shipping Dimensions ─────────────────────────────────────────────

/**
 * Display shipping (boxed) dimensions alongside assembled dimensions.
 * Shows the product's packaged/folded measurements for delivery planning.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product and state.dimensions.
 */
export function initShippingDimensions($w, state) {
  try {
    if (!state.product) return;

    const dims = state.dimensions;
    if (!dims || !dims.shipping) {
      try { $w('#shippingDimsRow').hide(); } catch (e) {}
      return;
    }

    const shipping = dims.shipping;
    const unit = dims.unit === 'cm' ? 'cm' : '"';
    const fmt = (v) => v != null ? `${v}${unit}` : '—';

    try { $w('#shippingDimsLabel').text = 'Shipping (Boxed)'; } catch (e) {}
    try { $w('#shippingDims').text = `${fmt(shipping.width)} W × ${fmt(shipping.depth)} D × ${fmt(shipping.height)} H`; } catch (e) {}

    if (shipping.weight) {
      try { $w('#shippingWeight').text = `Shipping Weight: ${shipping.weight} lbs`; } catch (e) {}
    }

    try { $w('#shippingDimsRow').show(); } catch (e) {}
  } catch (e) {}
}

// ── Visual Size Comparison ──────────────────────────────────────────

/**
 * Render an SVG scale diagram showing the product next to a 6ft person
 * for visual size reference. Uses design token colors.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Product page state with state.product and state.dimensions.
 */
export function initVisualSizeComparison($w, state) {
  try {
    if (!state.product || !state.dimensions) return;

    const dims = state.dimensions;
    const closed = dims.closed || {};
    const productHeight = closed.height || 0;
    const productWidth = closed.width || 0;
    const productName = state.product.name || 'Product';
    const unit = dims.unit === 'cm' ? 'cm' : '"';
    const fmt = (v) => v != null ? `${v}${unit}` : '—';

    try { $w('#sizeComparisonTitle').text = 'Size Reference'; } catch (e) {}

    const svgHtml = buildSizeComparisonSvg(productWidth, productHeight, productName, fmt);
    try { $w('#sizeComparisonVisual').html = svgHtml; } catch (e) {}
  } catch (e) {}
}

// ── Internal Helpers ──────────────────────────────────────────────────

function buildDimensionOverlaySvg(dims) {
  const closed = dims.closed || {};
  const unit = dims.unit === 'cm' ? 'cm' : '"';
  const fmt = (v) => v != null ? `${v}${unit}` : '—';

  const w = fmt(closed.width);
  const d = fmt(closed.depth);
  const h = fmt(closed.height);
  const espresso = colors.espresso;
  const ariaLabel = `Product dimensions: ${w} wide, ${d} deep, ${h} high`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" role="img" aria-label="${ariaLabel}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
  <style>text{font-family:Source Sans 3,sans-serif;font-size:13px;fill:${espresso};}</style>
  <!-- Width arrow (bottom) -->
  <line x1="40" y1="170" x2="260" y2="170" stroke="${espresso}" stroke-width="1.5" marker-start="url(#arrowL)" marker-end="url(#arrowR)"/>
  <text x="150" y="190" text-anchor="middle">${w} W</text>
  <!-- Height arrow (right) -->
  <line x1="270" y1="30" x2="270" y2="160" stroke="${espresso}" stroke-width="1.5" marker-start="url(#arrowU)" marker-end="url(#arrowD)"/>
  <text x="280" y="100" text-anchor="start">${h} H</text>
  <!-- Depth arrow (top) -->
  <line x1="40" y1="20" x2="200" y2="20" stroke="${espresso}" stroke-width="1.5" marker-start="url(#arrowL)" marker-end="url(#arrowR)"/>
  <text x="120" y="15" text-anchor="middle">${d} D</text>
  <defs>
    <marker id="arrowR" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="${espresso}"/></marker>
    <marker id="arrowL" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto"><path d="M8,0 L0,3 L8,6" fill="${espresso}"/></marker>
    <marker id="arrowU" markerWidth="6" markerHeight="8" refX="3" refY="0" orient="auto"><path d="M0,8 L3,0 L6,8" fill="${espresso}"/></marker>
    <marker id="arrowD" markerWidth="6" markerHeight="8" refX="3" refY="8" orient="auto"><path d="M0,0 L3,8 L6,0" fill="${espresso}"/></marker>
  </defs>
</svg>`;
}

function buildSizeComparisonSvg(productWidth, productHeight, productName, fmt) {
  const PERSON_HEIGHT = 72; // 6ft in inches
  const SVG_HEIGHT = 200;
  const SVG_WIDTH = 350;
  const FLOOR_Y = SVG_HEIGHT - 20;
  const espresso = colors.espresso;
  const sand = colors.sandBase;

  // Scale: person is always full height reference
  const scale = (FLOOR_Y - 30) / PERSON_HEIGHT;
  const personH = PERSON_HEIGHT * scale;
  const prodH = (productHeight || 0) * scale;
  const prodW = Math.max((productWidth || 0) * scale * 0.6, 30); // 0.6 for front-view perspective

  // Person position (left side)
  const personX = 60;
  const personTopY = FLOOR_Y - personH;

  // Product position (right side)
  const productX = 180;
  const productTopY = FLOOR_Y - prodH;

  const ariaLabel = `Size reference: ${productName} at ${fmt(productHeight)} tall next to a 6 foot person`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="${ariaLabel}">
  <style>text{font-family:Source Sans 3,sans-serif;font-size:11px;fill:${espresso};}</style>
  <!-- Floor line -->
  <line x1="10" y1="${FLOOR_Y}" x2="${SVG_WIDTH - 10}" y2="${FLOOR_Y}" stroke="${espresso}" stroke-width="1" stroke-dasharray="4,3"/>
  <!-- Person silhouette -->
  <circle cx="${personX}" cy="${personTopY + 10}" r="10" fill="none" stroke="${espresso}" stroke-width="1.5"/>
  <line x1="${personX}" y1="${personTopY + 20}" x2="${personX}" y2="${FLOOR_Y - 30}" stroke="${espresso}" stroke-width="1.5"/>
  <line x1="${personX}" y1="${FLOOR_Y - 30}" x2="${personX - 12}" y2="${FLOOR_Y}" stroke="${espresso}" stroke-width="1.5"/>
  <line x1="${personX}" y1="${FLOOR_Y - 30}" x2="${personX + 12}" y2="${FLOOR_Y}" stroke="${espresso}" stroke-width="1.5"/>
  <line x1="${personX}" y1="${personTopY + 40}" x2="${personX - 18}" y2="${personTopY + 65}" stroke="${espresso}" stroke-width="1.5"/>
  <line x1="${personX}" y1="${personTopY + 40}" x2="${personX + 18}" y2="${personTopY + 65}" stroke="${espresso}" stroke-width="1.5"/>
  <text x="${personX}" y="${FLOOR_Y + 15}" text-anchor="middle">6'0"</text>
  <!-- Product rectangle -->
  <rect x="${productX - prodW / 2}" y="${productTopY}" width="${prodW}" height="${prodH}" fill="${sand}" stroke="${espresso}" stroke-width="1.5" rx="3"/>
  <text x="${productX}" y="${productTopY - 8}" text-anchor="middle" font-weight="bold">${productName}</text>
  <text x="${productX}" y="${FLOOR_Y + 15}" text-anchor="middle">${fmt(productHeight)} H</text>
</svg>`;
}

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
