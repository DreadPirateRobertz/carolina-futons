/**
 * SwatchRequestFlow.js — Swatch request selection and submission flow.
 * Allows customers to select up to 6 fabric swatches, enter shipping info,
 * and submit a free swatch request. Used on the product page.
 */
import { submitSwatchRequest } from 'backend/emailService.web';
import { getProductSwatches } from 'backend/swatchService.web';
import { colors } from 'public/designTokens.js';

export const MAX_SWATCHES = 6;

// Module-level selection state
let _selectedSwatches = [];

/**
 * Toggle a swatch in the selection list.
 * @param {Object} swatch - Swatch object with _id and swatchName.
 * @returns {{selected: boolean, limitReached?: boolean, error?: string}}
 */
export function toggleSwatchSelection(swatch) {
  if (!swatch || !swatch._id) {
    return { selected: false, error: 'Invalid swatch' };
  }

  const idx = _selectedSwatches.findIndex(s => s._id === swatch._id);

  // Deselect
  if (idx !== -1) {
    _selectedSwatches.splice(idx, 1);
    return { selected: false };
  }

  // Limit check
  if (_selectedSwatches.length >= MAX_SWATCHES) {
    return { selected: false, limitReached: true };
  }

  // Select
  _selectedSwatches.push({ _id: swatch._id, swatchName: swatch.swatchName });
  return { selected: true };
}

/**
 * Get currently selected swatches.
 * @returns {Array<{_id: string, swatchName: string}>}
 */
export function getSelectedSwatches() {
  return [..._selectedSwatches];
}

/**
 * Clear all selected swatches.
 */
export function clearSelectedSwatches() {
  _selectedSwatches = [];
}

/**
 * Validate the swatch request form fields.
 * @param {{name: string, email: string, address: string}} form
 * @returns {Array<{field: string, message: string}>} Validation errors.
 */
export function validateRequestForm({ name, email, address }) {
  const errors = [];
  const trimmedName = (name || '').trim();
  const trimmedEmail = (email || '').trim();
  const trimmedAddress = (address || '').trim();

  if (!trimmedName) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (trimmedName.length > 200) {
    errors.push({ field: 'name', message: 'Name must be under 200 characters' });
  }

  if (!trimmedEmail) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(trimmedEmail)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  }

  if (!trimmedAddress) {
    errors.push({ field: 'address', message: 'Mailing address is required' });
  } else if (trimmedAddress.length > 500) {
    errors.push({ field: 'address', message: 'Address must be under 500 characters' });
  }

  return errors;
}

/**
 * Submit the swatch request.
 * @param {{name, email, address, productId, productName}} formData
 * @returns {Promise<{success: boolean, message?: string, errors?: Array}>}
 */
export async function submitRequest(formData) {
  try {
    const selected = getSelectedSwatches();
    if (selected.length === 0) {
      return { success: false, message: 'Please select at least one swatch' };
    }

    const errors = validateRequestForm(formData);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    const result = await submitSwatchRequest({
      name: formData.name.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      productId: formData.productId,
      productName: formData.productName,
      swatchNames: selected.map(s => s.swatchName),
    });

    if (result.success) {
      clearSelectedSwatches();
    }

    return result;
  } catch (err) {
    console.error('Error submitting swatch request:', err);
    return { success: false, message: 'Failed to submit request. Please try calling us at (828) 252-9449.' };
  }
}

/**
 * Initialize the swatch request flow UI on the product page.
 * Sets up the swatch selection grid, counter, and submit handler.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Page state with product data.
 */
export async function initSwatchRequestFlow($w, state) {
  try {
    clearSelectedSwatches();
    const section = $w('#swatchRequestSection');
    if (!state?.product) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    const swatches = await getProductSwatches(state.product._id);
    if (!swatches || swatches.length === 0) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    // Set up grid
    const grid = $w('#swatchRequestGrid');
    try { grid.accessibility.ariaLabel = 'Select fabric swatches to request'; } catch (e) {}
    grid.data = swatches.map((s, i) => ({ ...s, _id: s._id || `sr-${i}` }));
    grid.onItemReady(($item, itemData) => {
      try {
        if (itemData.swatchImage) {
          $item('#srThumb').src = itemData.swatchImage;
          $item('#srThumb').alt = itemData.swatchName || 'Fabric swatch';
        } else if (itemData.colorHex) {
          $item('#srThumb').style.backgroundColor = itemData.colorHex;
        }
      } catch (e) {}
      try { $item('#srLabel').text = itemData.swatchName || ''; } catch (e) {}
      try {
        $item('#srThumb').onClick(() => {
          const result = toggleSwatchSelection(itemData);
          updateSwatchSelectionUI($w, grid);
          if (result.limitReached) {
            try { $w('#swatchRequestError').text = `Maximum ${MAX_SWATCHES} swatches allowed`; $w('#swatchRequestError').show(); } catch (e) {}
          } else {
            try { $w('#swatchRequestError').hide(); } catch (e) {}
          }
        });
      } catch (e) {}
    });

    // Counter
    updateSwatchSelectionUI($w, grid);

    // Submit button
    try {
      $w('#swatchRequestSubmit').onClick(async () => {
        const formData = {
          name: $w('#srName').value || '',
          email: $w('#srEmail').value || '',
          address: $w('#srAddress').value || '',
          productId: state.product._id,
          productName: state.product.name,
        };
        const result = await submitRequest(formData);
        if (result.success) {
          try { $w('#swatchRequestConfirmation').expand(); } catch (e) {}
          try { $w('#swatchRequestForm').collapse(); } catch (e) {}
        } else if (result.errors) {
          try { $w('#swatchRequestError').text = result.errors[0].message; $w('#swatchRequestError').show(); } catch (e) {}
        } else if (result.message) {
          try { $w('#swatchRequestError').text = result.message; $w('#swatchRequestError').show(); } catch (e) {}
        }
      });
    } catch (e) {}

    section.expand();
  } catch (e) {
    console.error('Error initializing swatch request flow:', e);
    try { $w('#swatchRequestSection').collapse(); } catch (e2) {}
  }
}

/**
 * Update the selection counter and visual state of swatch grid items.
 * @param {Function} $w - Wix selector.
 * @param {Object} grid - The swatch request grid element.
 */
function updateSwatchSelectionUI($w, grid) {
  const selected = getSelectedSwatches();
  try {
    $w('#swatchRequestCount').text = `${selected.length} of ${MAX_SWATCHES} selected`;
  } catch (e) {}

  // Re-render grid to update selection borders
  try { if (grid?.data) grid.data = [...grid.data]; } catch (e) {}
}
