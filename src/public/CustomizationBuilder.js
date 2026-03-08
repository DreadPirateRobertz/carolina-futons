// CustomizationBuilder.js — Product customization builder
// Fabric/color swatch selector, preview visualization, pricing, saved configs
import { getCustomizationOptions, calculateCustomizationPrice, saveConfiguration, getSavedConfigurations } from 'backend/customizationService.web';
import { colors } from 'public/designTokens.js';
import { formatCurrency } from 'public/productPageUtils.js';
import { isMobile } from 'public/mobileHelpers.js';
import { announce } from 'public/a11yHelpers.js';

/** @type {Array} Cached pricing rules for session */
let _pricingRules = [];

/**
 * Initialize the product customization builder section.
 * @param {Function} $w - Wix selector
 * @param {Object} state - Page state with product
 */
export async function initCustomizationBuilder($w, state) {
  try {
    if (!state.product) {
      try { $w('#custBuilderSection').collapse(); } catch (e) {}
      return;
    }

    const { swatches, pricingRules } = await getCustomizationOptions(state.product._id);

    if (!swatches || swatches.length === 0) {
      try { $w('#custBuilderSection').collapse(); } catch (e) {}
      return;
    }

    _pricingRules = pricingRules;
    state.customization = null;

    // Set ARIA labels
    try { $w('#custSwatchGrid').accessibility.ariaLabel = 'Fabric selection grid'; } catch (e) {}
    try { $w('#custPreviewArea').accessibility.ariaLabel = 'Product customization preview'; } catch (e) {}

    // Render swatch grid
    renderCustomizationSwatches($w, state, swatches);

    // Set up color family filter
    initFabricFilter($w, state, swatches);

    // Show base price
    try { $w('#custBasePrice').text = formatCurrency(state.product.price); } catch (e) {}
    try { $w('#custTotalPrice').text = formatCurrency(state.product.price); } catch (e) {}
    try { $w('#custSurchargeSection').collapse(); } catch (e) {}

    // Pricing section
    try { $w('#custPricingSection').expand(); } catch (e) {}

    // Save button
    try {
      $w('#custSaveBtn').disable();
      $w('#custSaveBtn').onClick(() => saveCustomization($w, state));
    } catch (e) {}

    // Load saved configurations
    loadSavedCustomizations($w, state).catch(() => {});

    // Preview: show product image as base
    try {
      if (state.product.mainMedia) {
        $w('#custPreviewImage').src = state.product.mainMedia;
      }
    } catch (e) {}

    try { $w('#custBuilderSection').expand(); } catch (e) {}
  } catch (err) {
    console.error('Error initializing customization builder:', err);
    try { $w('#custBuilderSection').collapse(); } catch (e) {}
  }
}

/**
 * Render the fabric swatch grid.
 * @param {Function} $w - Wix selector
 * @param {Object} state - Page state
 * @param {Array} swatches - Available swatches
 */
function renderCustomizationSwatches($w, state, swatches) {
  try {
    const grid = $w('#custSwatchGrid');
    if (!grid) return;

    grid.data = swatches.map((s, i) => ({ ...s, _id: s._id || `cust-sw-${i}` }));
    grid.onItemReady(($item, itemData) => {
      // Thumbnail
      try {
        if (itemData.swatchImage) {
          $item('#custSwThumb').src = itemData.swatchImage;
          $item('#custSwThumb').alt = `${itemData.swatchName} fabric swatch`;
        } else if (itemData.colorHex) {
          $item('#custSwThumb').style.backgroundColor = itemData.colorHex;
        }
      } catch (e) {}

      // Label
      try { $item('#custSwLabel').text = itemData.swatchName || ''; } catch (e) {}

      // Material badge
      try { $item('#custSwMaterial').text = itemData.material || ''; } catch (e) {}

      // Price tier indicator
      try {
        if (itemData.priceTier === 'premium') {
          $item('#custSwTierBadge').text = '+15%';
          $item('#custSwTierBadge').show();
        } else if (itemData.priceTier === 'luxury') {
          $item('#custSwTierBadge').text = '+$75';
          $item('#custSwTierBadge').show();
        } else {
          $item('#custSwTierBadge').hide();
        }
      } catch (e) {}

      // Click handler
      try {
        $item('#custSwThumb').onClick(() => selectCustomizationSwatch($w, state, itemData, _pricingRules));
      } catch (e) {}

      // Selection state
      try {
        const isSel = state.customization?.fabricSwatchId === itemData._id;
        $item('#custSwThumb').style.borderColor = isSel ? colors.mountainBlue : colors.sandDark;
        $item('#custSwThumb').style.borderWidth = isSel ? '3px' : '1px';
      } catch (e) {}
    });
  } catch (e) {
    console.error('Error rendering customization swatches:', e);
  }
}

/**
 * Initialize the fabric color family filter dropdown.
 * @param {Function} $w - Wix selector
 * @param {Object} state - Page state
 * @param {Array} allSwatches - All available swatches
 */
function initFabricFilter($w, state, allSwatches) {
  try {
    const filter = $w('#custFabricFilter');
    if (!filter) return;

    const families = [...new Set(allSwatches.map(s => s.colorFamily).filter(Boolean))];
    filter.options = [
      { label: 'All Fabrics', value: '' },
      ...families.map(f => ({
        label: f.charAt(0).toUpperCase() + f.slice(1),
        value: f,
      })),
    ];
    filter.value = '';

    filter.onChange(() => {
      const val = filter.value;
      const filtered = val ? allSwatches.filter(s => s.colorFamily === val) : allSwatches;
      renderCustomizationSwatches($w, state, filtered);
    });
  } catch (e) {}
}

/**
 * Handle swatch selection in the customization builder.
 * @param {Function} $w - Wix selector
 * @param {Object} state - Page state
 * @param {Object} swatch - Selected swatch data
 * @param {Array} pricingRules - Pricing rules
 */
export function selectCustomizationSwatch($w, state, swatch, pricingRules) {
  state.customization = {
    fabricSwatchId: swatch._id,
    fabricName: swatch.swatchName,
    fabricColorHex: swatch.colorHex,
    priceTier: swatch.priceTier || 'standard',
    totalPrice: state.product?.price || 0,
  };

  // Update selected display
  try { $w('#custSelectedName').text = swatch.swatchName || ''; } catch (e) {}
  try { $w('#custSelectedMaterial').text = swatch.material ? `Material: ${swatch.material}` : ''; } catch (e) {}

  // Update preview
  updateCustomizationPreview($w, state, swatch.colorHex, swatch.swatchImage);

  // Update pricing
  updateCustomizationPrice($w, state, swatch.priceTier || 'standard', pricingRules);

  // Re-render grid to show selection border
  try {
    const grid = $w('#custSwatchGrid');
    if (grid?.data) grid.data = [...grid.data];
  } catch (e) {}

  // Enable save button
  try { $w('#custSaveBtn').enable(); } catch (e) {}

  // Screen reader announcement
  try { announce($w, `Selected ${swatch.swatchName} fabric`); } catch (e) {}
}

/**
 * Update the preview visualization with selected fabric.
 * @param {Function} $w - Wix selector
 * @param {Object} state - Page state
 * @param {string} colorHex - Hex color code
 * @param {string|null} swatchImage - Swatch texture image URL
 */
export function updateCustomizationPreview($w, state, colorHex, swatchImage) {
  try {
    // Color overlay on product image
    try {
      const overlay = $w('#custPreviewOverlay');
      if (overlay) {
        overlay.style.backgroundColor = colorHex || '';
        overlay.style.opacity = '0.25';
        overlay.show('fade', { duration: 200 });
      }
    } catch (e) {}

    // Swatch texture thumbnail
    try {
      if (swatchImage) {
        $w('#custPreviewSwatch').src = swatchImage;
        $w('#custPreviewSwatch').alt = 'Selected fabric swatch preview';
        $w('#custPreviewSwatch').show('fade', { duration: 200 });
      } else {
        $w('#custPreviewSwatch').hide();
      }
    } catch (e) {}
  } catch (e) {
    // Preview elements may not exist — fail silently
  }
}

/**
 * Update the customization pricing display.
 * @param {Function} $w - Wix selector
 * @param {Object} state - Page state
 * @param {string} priceTier - Selected fabric price tier
 * @param {Array} pricingRules - Pricing rules
 */
export function updateCustomizationPrice($w, state, priceTier, pricingRules) {
  try {
    const basePrice = state.product?.price || 0;
    const result = calculateCustomizationPrice(basePrice, priceTier, pricingRules);

    if (state.customization) {
      state.customization.totalPrice = result.totalPrice;
    }

    try { $w('#custBasePrice').text = formatCurrency(result.basePrice); } catch (e) {}
    try { $w('#custTotalPrice').text = formatCurrency(result.totalPrice); } catch (e) {}

    if (result.surcharge > 0) {
      try { $w('#custSurcharge').text = `+${formatCurrency(result.surcharge)}`; } catch (e) {}
      try { $w('#custSurchargeLabel').text = result.surchargeLabel; } catch (e) {}
      try { $w('#custSurchargeSection').expand(); } catch (e) {}
    } else {
      try { $w('#custSurchargeSection').collapse(); } catch (e) {}
    }
  } catch (e) {
    console.error('Error updating customization price:', e);
  }
}

/**
 * Save the current customization configuration.
 * @param {Function} $w - Wix selector
 * @param {Object} state - Page state
 */
export async function saveCustomization($w, state) {
  if (!state.customization) {
    try {
      $w('#custSaveError').text = 'Please select a fabric first.';
      $w('#custSaveError').show('fade', { duration: 200 });
    } catch (e) {}
    return;
  }

  try { $w('#custSaveBtn').disable(); } catch (e) {}
  try { $w('#custSaveError').hide(); } catch (e) {}
  try { $w('#custSaveSuccess').hide(); } catch (e) {}

  try {
    let memberId = null;
    try {
      const wixMembers = await import('wix-members-frontend');
      const memberApi = wixMembers.default?.currentMember || wixMembers.currentMember;
      const member = await memberApi?.getMember();
      memberId = member?._id;
    } catch (e) {
      // Members module unavailable
    }

    let configName = '';
    try { const name = $w('#custConfigName')?.value; if (name) configName = name; } catch (e) {}

    if (memberId) {
      // Logged-in member — save to Wix Data
      const result = await saveConfiguration({
        productId: state.product._id,
        memberId,
        configName: configName || 'My Configuration',
        fabricSwatchId: state.customization.fabricSwatchId,
        fabricName: state.customization.fabricName,
        fabricColorHex: state.customization.fabricColorHex,
        finishOption: state.customization.finishOption || '',
        totalPrice: state.customization.totalPrice,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      try {
        $w('#custSaveSuccess').text = 'Configuration saved!';
        $w('#custSaveSuccess').show('fade', { duration: 200 });
      } catch (e) {}
    } else {
      // Anonymous user — save to local storage
      const wixStorage = await import('wix-storage-frontend');
      const storageLocal = wixStorage.default?.local || wixStorage.local;
      const existing = JSON.parse(storageLocal.getItem('cf_saved_configs') || '[]');
      existing.unshift({
        _id: `local-${Date.now()}`,
        productId: state.product._id,
        ...state.customization,
        configName: configName || 'My Configuration',
        _createdDate: new Date(),
      });
      storageLocal.setItem('cf_saved_configs', JSON.stringify(existing.slice(0, 20)));

      try {
        $w('#custSaveSuccess').text = 'Configuration saved locally.';
        $w('#custSaveSuccess').show('fade', { duration: 200 });
      } catch (e) {}
    }

    try { announce($w, 'Configuration saved successfully'); } catch (e) {}

    // Reload saved list
    loadSavedCustomizations($w, state).catch(() => {});
  } catch (err) {
    console.error('Error saving customization:', err);
    try {
      $w('#custSaveError').text = 'Could not save configuration. Please try again.';
      $w('#custSaveError').show('fade', { duration: 200 });
    } catch (e) {}
  } finally {
    try { $w('#custSaveBtn').enable(); } catch (e) {}
  }
}

/**
 * Load and display saved customization configurations.
 * @param {Function} $w - Wix selector
 * @param {Object} state - Page state
 */
export async function loadSavedCustomizations($w, state) {
  try {
    let memberId = null;
    try {
      const wixMembers = await import('wix-members-frontend');
      const memberApi = wixMembers.default?.currentMember || wixMembers.currentMember;
      const member = await memberApi?.getMember();
      memberId = member?._id;
    } catch (e) {}

    let configs = [];

    if (memberId) {
      configs = await getSavedConfigurations(state.product._id, memberId);
    } else {
      // Try local storage
      try {
        const wixStorage = await import('wix-storage-frontend');
        const localStorage = wixStorage.default?.local || wixStorage.local;
        const localConfigs = JSON.parse(localStorage.getItem('cf_saved_configs') || '[]');
        configs = localConfigs.filter(c => c.productId === state.product._id);
      } catch (e) {}
    }

    if (!configs || configs.length === 0) {
      try { $w('#custSavedSection').collapse(); } catch (e) {}
      return;
    }

    try {
      const list = $w('#custSavedList');
      list.data = configs.map((c, i) => ({ ...c, _id: c._id || `saved-${i}` }));
      list.onItemReady(($item, itemData) => {
        try { $item('#savedConfigName').text = itemData.configName || 'Untitled'; } catch (e) {}
        try { $item('#savedFabricName').text = itemData.fabricName || ''; } catch (e) {}
        try {
          if (itemData.fabricColorHex) {
            $item('#savedColorDot').style.backgroundColor = itemData.fabricColorHex;
          }
        } catch (e) {}
        try { $item('#savedPrice').text = formatCurrency(itemData.totalPrice || 0); } catch (e) {}
        try {
          $item('#savedLoadBtn').onClick(() => {
            applySavedConfig($w, state, itemData);
          });
        } catch (e) {}
      });
      $w('#custSavedSection').expand();
    } catch (e) {}
  } catch (err) {
    console.error('Error loading saved configurations:', err);
    try { $w('#custSavedSection').collapse(); } catch (e) {}
  }
}

/**
 * Apply a saved configuration to the current state.
 * @param {Function} $w - Wix selector
 * @param {Object} state - Page state
 * @param {Object} config - Saved configuration
 */
function applySavedConfig($w, state, config) {
  const swatch = {
    _id: config.fabricSwatchId,
    swatchName: config.fabricName,
    colorHex: config.fabricColorHex,
    priceTier: config.priceTier || 'standard',
    swatchImage: null,
  };

  selectCustomizationSwatch($w, state, swatch, _pricingRules);
  try { announce($w, `Loaded configuration: ${config.configName}`); } catch (e) {}
}
