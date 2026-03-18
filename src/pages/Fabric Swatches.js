/**
 * @page Fabric Swatches
 * @url /swatches
 * @description Swatch request page: browse, filter, select up to 5 fabric
 * swatches, and submit a shipping request with 4-step nurture email sequence.
 *
 * Editor hookup required — see editor-hookup-guide.html for element IDs.
 *
 * CMS collections:
 * - FabricSwatches (read) — connected to #swatchDataset
 * - SwatchRequests (write) — via swatchRequest.web.js
 *
 * URL params:
 * - ?product=<slug> — pre-filter swatches for a specific product referral
 */
import { submitSwatchRequest } from 'backend/swatchRequest.web';
import { setupAccessibleDialog, announce } from 'public/a11yHelpers';
import { colors } from 'public/sharedTokens';
import wixLocationFrontend from 'wix-location-frontend';
import wixData from 'wix-data';

// ── Constants ────────────────────────────────────────────────────────

const MAX_SWATCHES = 5;
const SESSION_KEY  = 'swatchSelections';
const ZIP_RE       = /^\d{5}$/;
const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEBOUNCE_MS  = 250;

// ── Module state ─────────────────────────────────────────────────────

let _selections = []; // [{ _id, name, hexColor }]
let _dialog = null;
let _debounceTimer = null;

// ── Helpers ──────────────────────────────────────────────────────────

function _saveToSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(_selections));
}

function _loadFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[swatchPage] Failed to parse sessionStorage selections:', err);
    return [];
  }
}

function _debounce(fn) {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(fn, DEBOUNCE_MS);
}

function _updateTray() {
  const count = _selections.length;
  $w('#swatchTrayTitle').text = `Your Selections (${count} / ${MAX_SWATCHES})`;

  if (count === 0) {
    $w('#swatchTraySection').collapse();
  } else {
    $w('#swatchTraySection').expand();
  }

  // Update selection repeater data
  $w('#swatchSelectionRepeater').data = _selections.map(s => ({
    _id: s._id,
    swatchTrayName: s.name,
    hexColor: s.hexColor,
  }));
}

function _refreshGrid() {
  try {
    $w('#swatchGridRepeater').refresh();
  } catch {
    // Refresh may not be available in all contexts
  }
}

// ── Selection logic ──────────────────────────────────────────────────

export function addSwatch(swatch) {
  if (_selections.length >= MAX_SWATCHES) return false;
  if (_selections.some(s => s._id === swatch._id)) return true; // dup — ignore
  _selections.push(swatch);
  _saveToSession();
  _updateTray();
  return true;
}

export function removeSwatch(id) {
  _selections = _selections.filter(s => s._id !== id);
  _saveToSession();
  _updateTray();
}

export function clearAll() {
  _selections = [];
  _saveToSession();
  _updateTray();
}

export function getSelections() {
  return _selections;
}

export function openForm() {
  $w('#swatchFormOverlay').expand();
  $w('#swatchFormError').collapse();
  $w('#swatchFormSuccess').collapse();
  if (_dialog?.open) _dialog.open();
}

export async function submitForm() {
  await _handleSubmit();
}

// ── Filter / dataset ─────────────────────────────────────────────────

function _applyFilters() {
  const search   = ($w('#swatchSearchInput').value || '').toLowerCase().trim();
  const color    = $w('#swatchColorFilter').value || '';
  const material = $w('#swatchMaterialFilter').value || '';
  const brand    = $w('#swatchBrandFilter').value || '';

  let filter = wixData.filter().eq('inStock', true);
  if (color)    filter = filter.eq('colorFamily', color);
  if (material) filter = filter.eq('material', material);

  $w('#swatchDataset').setFilter(filter).then(() => {
    // Count shown items (best effort — repeater data may not be updated yet)
    const allItems = $w('#swatchGridRepeater').data || [];
    let visible = allItems;

    if (search) {
      visible = visible.filter(item =>
        (item.name || '').toLowerCase().includes(search) ||
        (item.colorFamily || '').toLowerCase().includes(search)
      );
    }
    if (brand) {
      visible = visible.filter(item => item.brand === brand);
    }

    const count = visible.length;
    $w('#swatchResultCount').text = `${count} swatch${count !== 1 ? 'es' : ''}`;

    if (count === 0) {
      $w('#swatchEmptyState').expand();
    } else {
      $w('#swatchEmptyState').collapse();
    }
  });
}

// ── Form validation ──────────────────────────────────────────────────

function _getFormValues() {
  return {
    firstName: $w('#swatchFirstName').value?.trim() || '',
    lastName:  $w('#swatchLastName').value?.trim() || '',
    email:     $w('#swatchEmail').value?.trim() || '',
    address1:  $w('#swatchAddress1').value?.trim() || '',
    address2:  $w('#swatchAddress2')?.value?.trim() || '',
    city:      $w('#swatchCity').value?.trim() || '',
    state:     $w('#swatchState').value?.trim() || '',
    zip:       $w('#swatchZip').value?.trim() || '',
    phone:     $w('#swatchPhone')?.value?.trim() || '',
  };
}

function _validateForm(f) {
  if (!f.firstName || !f.lastName) return 'First and last name are required.';
  if (!f.email || !EMAIL_RE.test(f.email)) return 'A valid email address is required.';
  if (!f.address1) return 'Street address is required.';
  if (!f.city) return 'City is required.';
  if (!f.state) return 'State is required.';
  if (!ZIP_RE.test(f.zip)) return 'ZIP code must be 5 digits (e.g. 28201).';
  return null;
}

// ── Submit handler ───────────────────────────────────────────────────

async function _handleSubmit() {
  const form = _getFormValues();
  const validationError = _validateForm(form);
  if (validationError) {
    $w('#swatchFormError').text = validationError;
    $w('#swatchFormError').expand();
    return;
  }

  // Cycle button state
  $w('#swatchSubmitBtn').label = 'Sending...';
  $w('#swatchSubmitBtn').disable();
  $w('#swatchFormError').collapse();

  // Read product slug from URL query param
  const productSlug = wixLocationFrontend.query?.product || undefined;

  try {
    const result = await submitSwatchRequest({
      swatchIds:   _selections.map(s => s._id),
      contactInfo: {
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email,
        address1:  form.address1,
        ...(form.address2 ? { address2: form.address2 } : {}),
        city:      form.city,
        state:     form.state,
        zip:       form.zip,
        ...(form.phone ? { phone: form.phone } : {}),
      },
      ...(productSlug ? { productSlug } : {}),
    });

    if (result.success) {
      clearAll();
      $w('#swatchFormSuccess').expand();
      announce('Your swatch request has been submitted successfully.');
    } else {
      throw new Error(result.error || 'Submission failed. Please try again.');
    }
  } catch (err) {
    $w('#swatchFormError').text = err.message || 'Something went wrong. Please try again.';
    $w('#swatchFormError').expand();
  } finally {
    $w('#swatchSubmitBtn').label = 'Send My Swatches';
    $w('#swatchSubmitBtn').enable();
  }
}

// ── JSON-LD schema ───────────────────────────────────────────────────

function _injectSchema() {
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': 'Free Fabric Swatch Program',
    'provider': { '@type': 'Organization', 'name': 'Carolina Futons' },
    'description': 'Request up to 5 free fabric swatches shipped to your door from 700+ available fabrics.',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD',
      'description': 'Free fabric swatches — shipped to your door',
    },
  });
  const el = $w('#swatchSchemaHtml');
  if (el.html !== undefined) el.html = `<script type="application/ld+json">${schema}</script>`;
  else el.value = `<script type="application/ld+json">${schema}</script>`;
}

// ── Page entry point ─────────────────────────────────────────────────

$w.onReady(async function () {
  // Restore any session-persisted selections
  _selections = _loadFromSession().slice(0, MAX_SWATCHES);

  // Initial UI state
  $w('#swatchTraySection').collapse();
  $w('#swatchFormOverlay').collapse();
  $w('#swatchEmptyState').collapse();
  $w('#swatchFormSuccess').collapse();
  $w('#swatchFormError').collapse();

  // Set accessible live region on result count
  $w('#swatchResultCount').accessibility.ariaLive = 'polite';

  // Restore tray if selections exist from session
  if (_selections.length > 0) {
    _updateTray();
  }

  // Accessible dialog for request form
  _dialog = setupAccessibleDialog($w('#swatchFormModal'), $w('#swatchFormClose'));

  // ── Filter controls ──

  $w('#swatchSearchInput').onInput(() => {
    _debounce(() => _applyFilters());
  });

  $w('#swatchColorFilter').onChange(() => _applyFilters());
  $w('#swatchMaterialFilter').onChange(() => _applyFilters());
  $w('#swatchBrandFilter').onChange(() => _applyFilters());

  $w('#swatchClearFilters').onClick(() => {
    $w('#swatchSearchInput').value  = '';
    $w('#swatchColorFilter').value  = '';
    $w('#swatchMaterialFilter').value = '';
    $w('#swatchBrandFilter').value  = '';
    _applyFilters();
  });

  // ── Tray controls ──

  $w('#swatchTrayProceedBtn').onClick(() => {
    openForm();
  });

  $w('#swatchTrayClearBtn').onClick(() => {
    clearAll();
  });

  // ── Selection repeater remove buttons ──

  $w('#swatchSelectionRepeater').onItemReady(($item, itemData) => {
    $item('#swatchTrayDot').style.backgroundColor = itemData.hexColor || '#ccc';
    $item('#swatchTrayName').text = itemData.swatchTrayName;
    $item('#swatchTrayRemove').onClick(() => {
      removeSwatch(itemData._id);
      _refreshGrid();
    });
  });

  // ── Swatch grid repeater ──

  $w('#swatchGridRepeater').onItemReady(($item, itemData) => {
    $item('#swatchColorDot').style.backgroundColor = itemData.hexColor || '#ccc';
    $item('#swatchName').text = itemData.name || '';
    $item('#swatchMaterial').text = itemData.material || '';
    $item('#swatchBrand').text = itemData.brand || '';
    $item('#swatchImage').alt = `${itemData.name} fabric swatch by ${itemData.brand}`;

    const outOfStock = !itemData.inStock;
    if (outOfStock) {
      $item('#swatchOutOfStock').expand();
      $item('#swatchSelectBtn').disable();
    } else {
      $item('#swatchOutOfStock').collapse();
    }

    const isSelected = _selections.some(s => s._id === itemData._id);
    const atMax = _selections.length >= MAX_SWATCHES;

    $item('#swatchSelectBtn').label = isSelected ? 'Remove' : 'Add';

    // Enforce max-5: disable "Add" for unselected cards when limit reached
    if (!isSelected && atMax && !outOfStock) {
      $item('#swatchSelectBtn').disable();
    }

    if (isSelected) {
      $item('#swatchSelectedBadge').expand();
      $item('#swatchCard').style.borderColor = colors.mountainBlue;
      $item('#swatchCard').style.borderWidth = '2px';
    } else {
      $item('#swatchSelectedBadge').collapse();
    }

    $item('#swatchSelectBtn').onClick(() => {
      const alreadySelected = _selections.some(s => s._id === itemData._id);
      if (alreadySelected) {
        removeSwatch(itemData._id);
      } else {
        addSwatch({ _id: itemData._id, name: itemData.name, hexColor: itemData.hexColor });
      }
      _refreshGrid();
    });
  });

  // ── Form close ──

  $w('#swatchFormClose').onClick(() => {
    $w('#swatchFormOverlay').collapse();
    if (_dialog?.close) _dialog.close();
  });

  $w('#swatchSuccessShopBtn').onClick(() => {
    $w('#swatchFormOverlay').collapse();
  });

  // ── Submit ──

  $w('#swatchSubmitBtn').onClick(() => _handleSubmit());
  $w('#swatchSubmitBtn').label = 'Send My Swatches';

  // ── SEO ──

  _injectSchema();
});
