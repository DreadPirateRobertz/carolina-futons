// ProductOptions.js - Variant selector, swatch grid, swatch gallery modal
import { getProductVariants } from 'public/cartService';
import { getProductSwatches, getSwatchCount, getAllSwatchFamilies } from 'backend/swatchService.web';
import { colors } from 'public/designTokens.js';
import { formatCurrency } from 'public/productPageUtils.js';
import { updateStickyPrice } from 'public/AddToCart.js';

// ── Variant Selector ──────────────────────────────────────────────────

export function initVariantSelector($w, state) {
  try {
    const size = $w('#sizeDropdown');
    const finish = $w('#finishDropdown');
    if (size) size.onChange(() => handleCustomVariantChange($w, state));
    if (finish) finish.onChange(() => handleCustomVariantChange($w, state));
    try {
      $w('#productDataset').onCurrentIndexChanged(() => {
        const updated = $w('#productDataset').getCurrentItem();
        if (updated) state.product = updated;
      });
    } catch (e) {}
  } catch (e) {}
}

export async function handleCustomVariantChange($w, state) {
  try {
    const size = $w('#sizeDropdown').value;
    const finish = $w('#finishDropdown').value;
    if (!size && !finish) return;
    const choices = {};
    if (size) choices['Size'] = size;
    if (finish) choices['Finish'] = finish;
    const variants = await getProductVariants(state.product._id, choices);
    if (variants?.length > 0) {
      const selected = variants[0];
      updateVariantDisplay($w, state, selected);
      updateStickyPrice($w, selected);
    }
  } catch (e) {
    console.error('Error handling variant change:', e);
  }
}

function updateVariantDisplay($w, state, selected) {
  // Price
  try {
    if (selected.variant?.price) {
      $w('#productPrice').text = formatCurrency(selected.variant.price);
    }
    if (selected.variant?.comparePrice) {
      try { $w('#productComparePrice').text = formatCurrency(selected.variant.comparePrice); $w('#productComparePrice').show(); } catch (e) {}
    } else {
      try { $w('#productComparePrice').hide(); } catch (e) {}
    }
  } catch (e) {}
  // Stock status
  try {
    const badge = $w('#stockStatus');
    if (badge) {
      badge.text = selected.inStock ? 'In Stock' : 'Special Order';
      badge.style.color = selected.inStock ? colors.success : colors.sunsetCoral;
      badge.show();
    }
  } catch (e) {}
  // Variant image
  try {
    if (selected.imageSrc) $w('#productMainImage').src = selected.imageSrc;
    if (selected.mediaItems?.length > 0) {
      try {
        const gallery = $w('#productGallery');
        if (gallery) {
          gallery.items = selected.mediaItems.map(item => ({
            type: 'image', src: item.src || item.url, alt: item.alt || state.product?.name || '',
          }));
        }
      } catch (e) {}
    }
  } catch (e) {}
}

// ── Swatch Selector (Inline Grid) ────────────────────────────────────

export async function initSwatchSelector($w, state) {
  try {
    const section = $w('#swatchSection');
    if (!section || !state.product) {
      try { $w('#swatchSection').collapse(); } catch (e) {}
      return;
    }
    const [swatches, totalCount, families] = await Promise.all([
      getProductSwatches(state.product._id),
      getSwatchCount(state.product._id),
      getAllSwatchFamilies(),
    ]);
    if (!swatches || swatches.length === 0) { section.collapse(); return; }
    try { $w('#swatchCount').text = `Showing ${swatches.length} of ${totalCount}+ available fabrics`; } catch (e) {}
    initSwatchColorFilter($w, state, families);
    renderSwatchGrid($w, state, swatches);
    try { $w('#swatchViewAll').onClick(() => openSwatchGallery($w, state)); } catch (e) {}
    try {
      $w('#swatchRequestLink').onClick(() => {
        import('wix-location-frontend').then(({ to }) => to('/request-swatches'));
      });
    } catch (e) {}
    section.expand();
  } catch (e) {
    console.error('Error initializing swatch selector:', e);
    try { $w('#swatchSection').collapse(); } catch (e2) {}
  }
}

function initSwatchColorFilter($w, state, families) {
  try {
    const filter = $w('#swatchColorFilter');
    if (!filter || !families?.length) return;
    filter.options = [{ label: 'All', value: '' }, ...families.filter(Boolean).map(f => ({
      label: f.charAt(0).toUpperCase() + f.slice(1), value: f,
    }))];
    filter.value = '';
    filter.onChange(async () => {
      const filtered = await getProductSwatches(state.product._id, filter.value || null);
      renderSwatchGrid($w, state, filtered);
    });
  } catch (e) {}
}

function renderSwatchGrid($w, state, swatches) {
  try {
    const grid = $w('#swatchGrid');
    if (!grid) return;
    grid.data = swatches.map((s, i) => ({ ...s, _id: s._id || `swatch-${i}` }));
    grid.onItemReady(($item, itemData) => {
      try {
        if (itemData.swatchImage) { $item('#swatchThumb').src = itemData.swatchImage; $item('#swatchThumb').alt = itemData.swatchName || 'Fabric swatch'; }
        else if (itemData.colorHex) { $item('#swatchThumb').style.backgroundColor = itemData.colorHex; }
      } catch (e) {}
      try { $item('#swatchLabel').text = itemData.swatchName || ''; } catch (e) {}
      try { $item('#swatchThumb').onClick(() => selectSwatch($w, state, itemData)); } catch (e) {}
      try {
        const isSel = state.selectedSwatchId === itemData._id;
        $item('#swatchThumb').style.borderColor = isSel ? colors.mountainBlue : colors.sandDark;
        $item('#swatchThumb').style.borderWidth = isSel ? '3px' : '1px';
      } catch (e) {}
    });
  } catch (e) {}
}

export async function selectSwatch($w, state, swatch) {
  state.selectedSwatchId = swatch._id;
  try { const grid = $w('#swatchGrid'); if (grid?.data) grid.data = [...grid.data]; } catch (e) {}
  try {
    const finish = $w('#finishDropdown');
    if (finish?.options) {
      const match = finish.options.find(o => o.label.toLowerCase() === swatch.swatchName.toLowerCase());
      if (match) { finish.value = match.value; await handleCustomVariantChange($w, state); return; }
    }
  } catch (e) {}
  applySwatchTint($w, swatch.colorHex);
}

function applySwatchTint($w, colorHex) {
  if (!colorHex) return;
  try {
    const overlay = $w('#swatchTintOverlay');
    if (overlay) { overlay.style.backgroundColor = colorHex; overlay.style.opacity = 0.25; overlay.show('fade', { duration: 200 }); }
  } catch (e) {}
}

// ── Full Swatch Gallery Modal ─────────────────────────────────────────

let _swatchGalleryEscHandler = null;

async function openSwatchGallery($w, state) {
  try {
    const modal = $w('#swatchGalleryModal');
    if (!modal) return;
    const allSwatches = await getProductSwatches(state.product._id, null, 500);
    if (!allSwatches?.length) return;
    renderSwatchGalleryGrid($w, state, allSwatches);
    try {
      $w('#swatchSearch').onInput((event) => {
        const q = (event.target.value || '').toLowerCase();
        const filtered = allSwatches.filter(s =>
          (s.swatchName || '').toLowerCase().includes(q) ||
          (s.colorFamily || '').toLowerCase().includes(q) ||
          (s.material || '').toLowerCase().includes(q));
        renderSwatchGalleryGrid($w, state, filtered);
      });
    } catch (e) {}

    const closeModal = () => {
      modal.hide('fade', { duration: 200 });
      // Restore focus to the "View All" button that opened the modal
      try { $w('#swatchViewAll').focus(); } catch (e) {}
      // Remove Escape handler
      if (_swatchGalleryEscHandler && typeof document !== 'undefined') {
        document.removeEventListener('keydown', _swatchGalleryEscHandler);
        _swatchGalleryEscHandler = null;
      }
    };

    try { $w('#swatchGalleryClose').onClick(closeModal); } catch (e) {}

    // ARIA dialog attributes
    try { modal.accessibility.role = 'dialog'; } catch (e) {}
    try { modal.accessibility.ariaModal = true; } catch (e) {}
    try { modal.accessibility.ariaLabel = 'Swatch gallery'; } catch (e) {}

    modal.show('fade', { duration: 200 });

    // Focus the search input (first focusable element) for focus trapping
    try { $w('#swatchSearch').focus(); } catch (e) {}

    // Escape key closes modal
    if (typeof document !== 'undefined') {
      _swatchGalleryEscHandler = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      document.addEventListener('keydown', _swatchGalleryEscHandler);
    }
  } catch (e) { console.error('Error opening swatch gallery:', e); }
}

function renderSwatchGalleryGrid($w, state, swatches) {
  try {
    const grid = $w('#swatchGalleryGrid');
    if (!grid) return;
    grid.data = swatches.map((s, i) => ({ ...s, _id: s._id || `sg-${i}` }));
    grid.onItemReady(($item, itemData) => {
      try {
        if (itemData.swatchImage) { $item('#sgThumb').src = itemData.swatchImage; $item('#sgThumb').alt = itemData.swatchName || 'Fabric swatch'; }
        else if (itemData.colorHex) { $item('#sgThumb').style.backgroundColor = itemData.colorHex; }
      } catch (e) {}
      try { $item('#sgName').text = itemData.swatchName || ''; } catch (e) {}
      try { $item('#sgMaterial').text = itemData.material || ''; } catch (e) {}
      try { $item('#sgThumb').onClick(() => { selectSwatch($w, state, itemData); showSwatchDetail($w, itemData); }); } catch (e) {}
      try {
        const isSel = state.selectedSwatchId === itemData._id;
        $item('#sgThumb').style.borderColor = isSel ? colors.mountainBlue : colors.sandDark;
        $item('#sgThumb').style.borderWidth = isSel ? '3px' : '1px';
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
    try {
      $w('#swatchDetailFamily').text = swatch.colorFamily
        ? `Color Family: ${swatch.colorFamily.charAt(0).toUpperCase() + swatch.colorFamily.slice(1)}` : '';
    } catch (e) {}
    if (swatch.swatchImage) {
      try { $w('#swatchDetailImage').src = swatch.swatchImage; $w('#swatchDetailImage').show(); } catch (e) {}
    }
    detail.expand();
  } catch (e) {}
}
