/**
 * FabricSampleRequest.js — Fabric sample request modal for PDP and Fabric Customizer.
 * Handles swatch selection (up to 3), form validation, submission, and UI state.
 *
 * Elements:
 *   #swatchRequestBtn    — Button to open the modal
 *   #swatchModal         — Modal container (collapsed by default)
 *   #swatchSelectRepeater— Repeater for swatch choices
 *   #swatchNameInput     — Customer name input
 *   #swatchEmailInput    — Customer email input
 *   #swatchAddressInput  — Shipping address input
 *   #swatchSubmitBtn     — Submit button
 *   #swatchSuccess       — Success message box
 *   #swatchError         — Error message text element
 */
import { getAvailableSwatches, submitFabricSample } from 'backend/fabricSampleService.web';

const MAX_SWATCHES = 3;

// Module-level selection state (reset per initFabricSampleRequest call via clearSwatchSelections)
let _selectedSwatchIds = [];
let _productId = null;

/**
 * Get the number of currently selected swatches.
 * Exported for testing.
 */
export function getSelectedSwatchCount() {
  return _selectedSwatchIds.length;
}

/**
 * Clear all swatch selections.
 * Exported for testing.
 */
export function clearSwatchSelections() {
  _selectedSwatchIds = [];
}

/**
 * Programmatically select a swatch by ID.
 * Returns true if selected, false if limit reached or already selected.
 * Exported for testing.
 */
export function selectSwatch(swatchId) {
  if (_selectedSwatchIds.includes(swatchId)) return false;
  if (_selectedSwatchIds.length >= MAX_SWATCHES) return false;
  _selectedSwatchIds.push(swatchId);
  return true;
}

/**
 * Initialize the fabric sample request modal on a product page.
 *
 * @param {Function} $w       - Wix selector function.
 * @param {string}   productId - Current product ID (passed to backend for tracking).
 */
export async function initFabricSampleRequest($w, productId) {
  _productId = productId || null;
  _selectedSwatchIds = [];

  // Collapse modal initially
  try { $w('#swatchModal').collapse(); } catch (e) {}

  // Load available swatches
  try {
    const result = await getAvailableSwatches();
    if (result.success && result.data?.swatches?.length > 0) {
      $w('#swatchSelectRepeater').data = result.data.swatches;
      $w('#swatchSelectRepeater').onItemReady(($item, itemData) => {
        _setupSwatchItem($item, itemData, $w);
      });
    } else if (!result.success) {
      try { $w('#swatchRequestBtn').disable(); } catch (e2) {}
      console.error('[FabricSampleRequest] Swatches unavailable:', result.error);
    }
  } catch (e) {
    console.error('[FabricSampleRequest] Failed to load swatches:', e);
    try { $w('#swatchRequestBtn').disable(); } catch (e2) {}
  }

  // Open modal button
  try {
    $w('#swatchRequestBtn').onClick(() => {
      _openModal($w);
    });
  } catch (e) {
    console.error('[FabricSampleRequest] Failed to bind swatchRequestBtn:', e);
  }

  // Submit button
  try {
    $w('#swatchSubmitBtn').onClick(async () => {
      await _handleSubmit($w);
    });
  } catch (e) {
    console.error('[FabricSampleRequest] Failed to bind swatchSubmitBtn:', e);
  }
}

function _openModal($w) {
  try { $w('#swatchSuccess').hide(); } catch (e) {}
  try { $w('#swatchError').hide(); } catch (e) {}
  try { $w('#swatchModal').expand(); } catch (e) {}
}

function _setupSwatchItem($item, itemData, $w) {
  try {
    $item('#swatchItemName').text = itemData.swatchName || '';
  } catch (e) {}

  try {
    $item('#swatchItemBtn').onClick(() => {
      const idx = _selectedSwatchIds.indexOf(itemData._id);
      if (idx !== -1) {
        _selectedSwatchIds.splice(idx, 1);
        try { $item('#swatchItemBtn').label = 'Select'; } catch (e2) {}
      } else if (_selectedSwatchIds.length < MAX_SWATCHES) {
        _selectedSwatchIds.push(itemData._id);
        try { $item('#swatchItemBtn').label = 'Selected ✓'; } catch (e2) {}
      } else {
        try {
          $w('#swatchError').text = `You can select up to ${MAX_SWATCHES} swatches.`;
          $w('#swatchError').show();
        } catch (e2) {}
      }
    });
  } catch (e) {}
}

async function _handleSubmit($w) {
  // Clear previous messages
  try { $w('#swatchError').hide(); } catch (e) {}
  try { $w('#swatchSuccess').hide(); } catch (e) {}

  // Read form values
  const name    = ($w('#swatchNameInput').value    || '').trim();
  const email   = ($w('#swatchEmailInput').value   || '').trim();
  const address = ($w('#swatchAddressInput').value || '').trim();

  // Client-side validation
  if (!name) {
    try { $w('#swatchError').text = 'Please enter your name.'; } catch (e) {}
    try { $w('#swatchError').show(); } catch (e) {}
    return;
  }
  if (!email) {
    try { $w('#swatchError').text = 'Please enter your email address.'; } catch (e) {}
    try { $w('#swatchError').show(); } catch (e) {}
    return;
  }
  if (!address) {
    try { $w('#swatchError').text = 'Please enter your shipping address.'; } catch (e) {}
    try { $w('#swatchError').show(); } catch (e) {}
    return;
  }
  if (_selectedSwatchIds.length === 0) {
    try { $w('#swatchError').text = 'Please select at least one swatch.'; } catch (e) {}
    try { $w('#swatchError').show(); } catch (e) {}
    return;
  }

  // Disable submit while in flight
  try { $w('#swatchSubmitBtn').disable(); } catch (e) {}
  try { $w('#swatchSubmitBtn').label = 'Sending...'; } catch (e) {}

  try {
    const result = await submitFabricSample({
      swatchIds:   [..._selectedSwatchIds],
      contactInfo: { name, email, address },
      productId:   _productId || undefined,
    });

    if (result.success) {
      // Clear form
      try { $w('#swatchNameInput').value    = ''; } catch (e) {}
      try { $w('#swatchEmailInput').value   = ''; } catch (e) {}
      try { $w('#swatchAddressInput').value = ''; } catch (e) {}
      _selectedSwatchIds = [];

      try { $w('#swatchSuccess').text = 'Your swatches are on their way! Check your email for confirmation.'; } catch (e) {}
      try { $w('#swatchSuccess').show(); } catch (e) {}
    } else {
      try { $w('#swatchError').text = result.error || 'Something went wrong. Please try again.'; } catch (e) {}
      try { $w('#swatchError').show(); } catch (e) {}
    }
  } catch (err) {
    console.error('[FabricSampleRequest] submitFabricSample threw:', err);
    try { $w('#swatchError').text = 'Something went wrong. Please try again.'; } catch (e) {}
    try { $w('#swatchError').show(); } catch (e) {}
  }

  // Re-enable submit
  try { $w('#swatchSubmitBtn').enable(); } catch (e) {}
  try { $w('#swatchSubmitBtn').label = 'Request Free Swatches'; } catch (e) {}
}
