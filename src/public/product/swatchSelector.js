// swatchSelector.js - Fabric Swatch Selection & Gallery
// Displays available fabric swatches below the gallery. Clicking a swatch
// either switches to that variant's images or applies a color tint overlay.
// Includes full swatch gallery lightbox with search and detail view,
// and "Request Free Swatches" modal with form submission.

import { getProductSwatches, getSwatchCount, getAllSwatchFamilies } from 'backend/swatchService.web';
import { submitSwatchRequest } from 'backend/emailService.web';
import { colors } from 'public/designTokens.js';

let selectedSwatchId = null;

/**
 * Initialize fabric swatch selector section.
 * @param {Function} $w - Wix selector
 * @param {Object} product - Current product
 * @param {Object} [options]
 * @param {Function} [options.onSelectVariant] - Called to trigger variant change when swatch matches a finish
 */
export async function initSwatchSelector($w, product, { onSelectVariant } = {}) {
  // Reset module state on init to prevent SPA navigation bleed
  selectedSwatchId = null;

  try {
    const swatchSection = $w('#swatchSection');
    if (!swatchSection || !product) {
      try { $w('#swatchSection').collapse(); } catch (e) {}
      return;
    }

    const [swatches, totalCount, families] = await Promise.all([
      getProductSwatches(product._id),
      getSwatchCount(product._id),
      getAllSwatchFamilies(),
    ]);

    if (!swatches || swatches.length === 0) {
      swatchSection.collapse();
      return;
    }

    try {
      $w('#swatchCount').text = `Showing ${swatches.length} of ${totalCount}+ available fabrics`;
    } catch (e) {}

    initSwatchColorFilter($w, product, families);
    renderSwatchGrid($w, product, swatches, onSelectVariant);

    try {
      $w('#swatchViewAll').onClick(() => openSwatchGallery($w, product, onSelectVariant));
    } catch (e) {}

    try {
      $w('#swatchRequestLink').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to('/request-swatches');
        });
      });
    } catch (e) {}

    swatchSection.expand();
  } catch (e) {
    console.error('Error initializing swatch selector:', e);
    try { $w('#swatchSection').collapse(); } catch (e2) {}
  }
}

function initSwatchColorFilter($w, product, families) {
  try {
    const filter = $w('#swatchColorFilter');
    if (!filter || !families || families.length === 0) return;

    const options = [{ label: 'All', value: '' }];
    families.forEach(family => {
      if (family) {
        const label = family.charAt(0).toUpperCase() + family.slice(1);
        options.push({ label, value: family });
      }
    });

    filter.options = options;
    filter.value = '';

    filter.onChange(async () => {
      const colorFamily = filter.value || null;
      const filtered = await getProductSwatches(product._id, colorFamily);
      renderSwatchGrid($w, product, filtered);
    });
  } catch (e) {}
}

function renderSwatchGrid($w, product, swatches, onSelectVariant) {
  try {
    const grid = $w('#swatchGrid');
    if (!grid) return;

    grid.data = swatches.map((s, i) => ({
      ...s,
      _id: s._id || `swatch-${i}`,
    }));

    grid.onItemReady(($item, itemData) => {
      try {
        if (itemData.swatchImage) {
          $item('#swatchThumb').src = itemData.swatchImage;
          $item('#swatchThumb').alt = itemData.swatchName || 'Fabric swatch';
        } else if (itemData.colorHex) {
          $item('#swatchThumb').style.backgroundColor = itemData.colorHex;
        }
      } catch (e) {}

      try {
        $item('#swatchLabel').text = itemData.swatchName || '';
      } catch (e) {}

      try {
        $item('#swatchThumb').onClick(() => selectSwatch($w, product, itemData, onSelectVariant));
      } catch (e) {}

      try {
        if (selectedSwatchId === itemData._id) {
          $item('#swatchThumb').style.borderColor = colors.mountainBlue;
          $item('#swatchThumb').style.borderWidth = '3px';
        } else {
          $item('#swatchThumb').style.borderColor = colors.sandDark;
          $item('#swatchThumb').style.borderWidth = '1px';
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error('Error rendering swatch grid:', e);
  }
}

async function selectSwatch($w, product, swatch, onSelectVariant) {
  selectedSwatchId = swatch._id;

  try {
    const grid = $w('#swatchGrid');
    if (grid && grid.data) {
      grid.data = [...grid.data];
    }
  } catch (e) {}

  // Try to match a product variant with this fabric/finish name
  try {
    const finishDropdown = $w('#finishDropdown');
    if (finishDropdown && finishDropdown.options) {
      const matchingOption = finishDropdown.options.find(
        opt => opt.label.toLowerCase() === swatch.swatchName.toLowerCase()
      );
      if (matchingOption) {
        finishDropdown.value = matchingOption.value;
        if (onSelectVariant) await onSelectVariant();
        return;
      }
    }
  } catch (e) {}

  // Fallback: apply color tint overlay
  applySwatchTint($w, swatch.colorHex);
}

function applySwatchTint($w, colorHex) {
  if (!colorHex) return;

  try {
    const tintOverlay = $w('#swatchTintOverlay');
    if (tintOverlay) {
      tintOverlay.style.backgroundColor = colorHex;
      tintOverlay.style.opacity = 0.25;
      tintOverlay.show('fade', { duration: 200 });
    }
  } catch (e) {}
}

// ── Full Swatch Gallery Lightbox ──────────────────────────────────────

async function openSwatchGallery($w, product, onSelectVariant) {
  try {
    const modal = $w('#swatchGalleryModal');
    if (!modal) return;

    const allSwatches = await getProductSwatches(product._id, null, 500);
    if (!allSwatches || allSwatches.length === 0) return;

    renderSwatchGalleryGrid($w, product, allSwatches, onSelectVariant);

    try {
      $w('#swatchSearch').onInput((event) => {
        const query = (event.target.value || '').toLowerCase();
        const filtered = allSwatches.filter(s =>
          (s.swatchName || '').toLowerCase().includes(query) ||
          (s.colorFamily || '').toLowerCase().includes(query) ||
          (s.material || '').toLowerCase().includes(query)
        );
        renderSwatchGalleryGrid($w, product, filtered, onSelectVariant);
      });
    } catch (e) {}

    try {
      $w('#swatchGalleryClose').onClick(() => {
        modal.hide('fade', { duration: 200 });
      });
    } catch (e) {}

    modal.show('fade', { duration: 200 });
  } catch (e) {
    console.error('Error opening swatch gallery:', e);
  }
}

function renderSwatchGalleryGrid($w, product, swatches, onSelectVariant) {
  try {
    const grid = $w('#swatchGalleryGrid');
    if (!grid) return;

    grid.data = swatches.map((s, i) => ({
      ...s,
      _id: s._id || `sg-${i}`,
    }));

    grid.onItemReady(($item, itemData) => {
      try {
        if (itemData.swatchImage) {
          $item('#sgThumb').src = itemData.swatchImage;
          $item('#sgThumb').alt = itemData.swatchName || 'Fabric swatch';
        } else if (itemData.colorHex) {
          $item('#sgThumb').style.backgroundColor = itemData.colorHex;
        }
      } catch (e) {}

      try { $item('#sgName').text = itemData.swatchName || ''; } catch (e) {}
      try { $item('#sgMaterial').text = itemData.material || ''; } catch (e) {}

      try {
        $item('#sgThumb').onClick(() => {
          selectSwatch($w, product, itemData, onSelectVariant);
          showSwatchDetail($w, itemData);
        });
      } catch (e) {}

      try {
        if (selectedSwatchId === itemData._id) {
          $item('#sgThumb').style.borderColor = colors.mountainBlue;
          $item('#sgThumb').style.borderWidth = '3px';
        } else {
          $item('#sgThumb').style.borderColor = colors.sandDark;
          $item('#sgThumb').style.borderWidth = '1px';
        }
      } catch (e) {}
    });
  } catch (e) {}
}

function showSwatchDetail($w, swatch) {
  try {
    const detail = $w('#swatchDetail');
    if (!detail) return;

    try { $w('#swatchDetailName').text = swatch.swatchName || ''; } catch (e) {}
    try { $w('#swatchDetailMaterial').text = swatch.material ? `Material: ${swatch.material}` : ''; } catch (e) {}
    try { $w('#swatchDetailCare').text = swatch.careInstructions ? `Care: ${swatch.careInstructions}` : ''; } catch (e) {}
    try { $w('#swatchDetailFamily').text = swatch.colorFamily ? `Color Family: ${swatch.colorFamily.charAt(0).toUpperCase() + swatch.colorFamily.slice(1)}` : ''; } catch (e) {}

    if (swatch.swatchImage) {
      try {
        $w('#swatchDetailImage').src = swatch.swatchImage;
        $w('#swatchDetailImage').alt = `${swatch.swatchName || 'Fabric'} swatch - enlarged view`;
        $w('#swatchDetailImage').show();
      } catch (e) {}
    }

    detail.expand();
  } catch (e) {}
}

// ── Swatch Request Modal ──────────────────────────────────────────────

/**
 * Initialize "Request Free Swatches" button + modal.
 */
export function initSwatchRequest($w, product) {
  try {
    const swatchBtn = $w('#swatchRequestBtn');
    if (!swatchBtn || !product) return;

    const hasOptions = product.productOptions?.some(
      opt => /finish|fabric|color|cover/i.test(opt.name)
    );

    if (!hasOptions) {
      swatchBtn.hide();
      return;
    }

    swatchBtn.show();

    swatchBtn.onClick(() => {
      openSwatchModal($w, product);
    });

    try {
      $w('#swatchSubmit').onClick(() => handleSwatchSubmit($w, product));
    } catch (e) {}
  } catch (e) {}
}

function openSwatchModal($w, product) {
  try {
    const modal = $w('#swatchModal');
    if (!modal) return;

    try {
      $w('#swatchProductName').text = product.name;
    } catch (e) {}

    try {
      const optionsRepeater = $w('#swatchOptions');
      if (optionsRepeater) {
        const fabricOptions = [];
        (product.productOptions || []).forEach(opt => {
          if (/finish|fabric|color|cover/i.test(opt.name)) {
            (opt.choices || []).forEach(choice => {
              fabricOptions.push({
                _id: choice.value,
                label: choice.description || choice.value,
                optionName: opt.name,
                checked: false,
              });
            });
          }
        });

        optionsRepeater.data = fabricOptions;
        optionsRepeater.onItemReady(($item, itemData) => {
          try {
            $item('#swatchCheckbox').label = itemData.label;
            $item('#swatchCheckbox').checked = false;
          } catch (e) {}
        });
      }
    } catch (e) {}

    try { $w('#swatchName').value = ''; } catch (e) {}
    try { $w('#swatchEmail').value = ''; } catch (e) {}
    try { $w('#swatchAddress').value = ''; } catch (e) {}
    try { $w('#swatchSuccess').hide(); } catch (e) {}

    modal.show('fade', { duration: 200 });
  } catch (e) {}
}

async function handleSwatchSubmit($w, product) {
  try {
    const name = $w('#swatchName').value?.trim();
    const email = $w('#swatchEmail').value?.trim();
    const address = $w('#swatchAddress').value?.trim();

    if (!name || !email || !address) return;

    const selectedSwatches = [];
    try {
      const optionsRepeater = $w('#swatchOptions');
      optionsRepeater.forEachItem(($item, itemData) => {
        try {
          if ($item('#swatchCheckbox').checked) {
            selectedSwatches.push(itemData.label);
          }
        } catch (e) {}
      });
    } catch (e) {}

    if (selectedSwatches.length === 0) return;

    $w('#swatchSubmit').disable();

    await submitSwatchRequest({
      name,
      email,
      address,
      productId: product._id,
      productName: product.name,
      swatchNames: selectedSwatches,
    });

    try {
      $w('#swatchSuccess').show('fade', { duration: 300 });
    } catch (e) {}

    setTimeout(() => {
      try {
        $w('#swatchModal').hide('fade', { duration: 200 });
        $w('#swatchSubmit').enable();
      } catch (e) {}
    }, 3000);
  } catch (err) {
    console.error('Error submitting swatch request:', err);
    try {
      $w('#swatchSubmit').enable();
      const errorMsg = $w('#swatchError');
      if (errorMsg) {
        errorMsg.text = 'Something went wrong. Please call us at (828) 252-9449.';
        errorMsg.show('fade', { duration: 300 });
      }
    } catch (e) {}
  }
}
