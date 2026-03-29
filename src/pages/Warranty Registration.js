/**
 * Warranty Registration page controller.
 * Allows members to register products for warranty coverage.
 * Auto-populates from query params (orderId, productId, productName).
 *
 * Elements:
 *   #warrantyRegForm        — Registration form container
 *   #warrantyProductName    — Product name input (Text input)
 *   #warrantyProductId      — Hidden product ID (Text input, hidden)
 *   #warrantyOrderId        — Order ID input (Text input)
 *   #warrantyPurchaseDate   — Purchase date picker (Date picker)
 *   #warrantySerialNumber   — Serial number input (Text input, optional)
 *   #warrantySubmitBtn      — Submit button
 *   #warrantySuccessMsg     — Success message (collapsed by default)
 *   #warrantyErrorMsg       — Error message (collapsed by default)
 *   #warrantyLoadingIndicator — Loading spinner (hidden by default)
 *   #warrantyRegistrationId — Shows the registration ID after success
 *
 * URL params:
 *   orderId     — pre-fills the order ID field
 *   productId   — pre-fills the product ID (hidden field)
 *   productName — pre-fills the product name field
 *
 * CF-46ct
 */
import { registerWarranty } from 'backend/warrantyService.web';
import wixLocation from 'wix-location';
import { safeCall, safeCollapse, safeExpand, safeText } from 'public/safeInit';

$w.onReady(async function () {
  await initWarrantyRegistrationPage($w);
});

/**
 * Initialize the Warranty Registration page.
 *
 * @param {Function} $w - Wix selector function
 */
export async function initWarrantyRegistrationPage($w) {
  // Read query params for pre-population
  const query = wixLocation.query || {};
  const { orderId = '', productId = '', productName = '' } = query;

  // Pre-populate fields from URL params
  if (productName) safeCall(() => { $w('#warrantyProductName').value = decodeURIComponent(productName); });
  if (productId)   safeCall(() => { $w('#warrantyProductId').value = decodeURIComponent(productId); });
  if (orderId)     safeCall(() => { $w('#warrantyOrderId').value = decodeURIComponent(orderId); });

  // Wire submit button
  safeCall(() => {
    $w('#warrantySubmitBtn').onClick(async () => {
      await _handleSubmit($w);
    });
  });

  // Collapse status messages on init
  safeCollapse($w, '#warrantySuccessMsg');
  safeCollapse($w, '#warrantyErrorMsg');
  safeCall(() => $w('#warrantyLoadingIndicator').hide());
}

/**
 * Handle form submission — validate, call backend, show result.
 *
 * @param {Function} $w
 */
async function _handleSubmit($w) {
  safeCollapse($w, '#warrantySuccessMsg');
  safeCollapse($w, '#warrantyErrorMsg');

  const productName = _getFieldValue($w, '#warrantyProductName');
  const productId   = _getFieldValue($w, '#warrantyProductId');
  const orderId     = _getFieldValue($w, '#warrantyOrderId');
  const serialNumber = _getFieldValue($w, '#warrantySerialNumber');

  let purchaseDate = null;
  safeCall(() => {
    const datePicker = $w('#warrantyPurchaseDate');
    if (datePicker?.value) purchaseDate = datePicker.value;
  });

  if (!productName || productName.trim().length === 0) {
    _showError($w, 'Please enter the product name.');
    return;
  }

  safeCall(() => $w('#warrantySubmitBtn').disable());
  safeCall(() => $w('#warrantyLoadingIndicator').show());

  try {
    const result = await registerWarranty({
      productId: productId || 'unknown',
      productName: productName.trim(),
      orderId: orderId || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : null,
      serialNumber: serialNumber || null,
    });

    if (result.success) {
      safeCall(() => $w('#warrantyLoadingIndicator').hide());
      safeCollapse($w, '#warrantyRegForm');
      safeExpand($w, '#warrantySuccessMsg');
      safeText($w, '#warrantyRegistrationId', `Registration ID: ${result.registrationId}`);
    } else {
      safeCall(() => $w('#warrantyLoadingIndicator').hide());
      safeCall(() => $w('#warrantySubmitBtn').enable());
      _showError($w, result.error || 'Registration failed. Please try again.');
    }
  } catch (err) {
    console.error('[WarrantyRegistration] Unexpected error:', err);
    safeCall(() => $w('#warrantyLoadingIndicator').hide());
    safeCall(() => $w('#warrantySubmitBtn').enable());
    _showError($w, 'An unexpected error occurred. Please try again.');
  }
}

function _getFieldValue($w, selector) {
  let value = '';
  safeCall(() => { value = $w(selector)?.value || ''; });
  return value;
}

function _showError($w, message) {
  safeExpand($w, '#warrantyErrorMsg');
  safeText($w, '#warrantyErrorMsg', message);
}
