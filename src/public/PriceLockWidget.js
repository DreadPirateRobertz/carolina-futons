/**
 * @module PriceLockWidget
 * @description PDP widget for Price Lock Guarantee. Shows "Lock this price"
 * button that opens a tier selector. Members can lock the current price for
 * 30/60/90 days with a $25 refundable deposit.
 *
 * Element IDs:
 *   #priceLockSection       — Container section (collapsed for non-members)
 *   #priceLockBtn           — "Lock This Price" CTA button
 *   #priceLockBadge         — "Price locked at $X" badge (shown when active lock exists)
 *   #priceLockBadgeText     — Badge text element
 *   #priceLockExpiry        — "Expires in X days" text
 *   #priceLockModal         — Tier selector modal overlay
 *   #priceLockModalContent  — Modal content box
 *   #priceLockClose         — Modal close button
 *   #priceLock30            — 30-day tier button
 *   #priceLock60            — 60-day tier button
 *   #priceLock90            — 90-day tier button
 *   #priceLockDeposit       — Deposit amount text ("$25 refundable deposit")
 *   #priceLockSuccess       — Success message after lock creation
 *
 * CF-tjf0
 */

import { colors } from 'public/designTokens.js';
import { announce } from 'public/a11yHelpers.js';

/**
 * Initialize the Price Lock widget on the PDP.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} product - Current product from dataset
 * @param {string|null} memberId - Current member ID (null if not logged in)
 */
export async function initPriceLockWidget($w, product, memberId) {
  if (!product) return;

  try {
    // Non-members: collapse section entirely
    if (!memberId) {
      try { $w('#priceLockSection').collapse(); } catch (_) {}
      return;
    }

    // Check for existing lock
    const { checkPriceLock } = await import('backend/priceLock.web');
    const lockStatus = await checkPriceLock(product._id, memberId);

    if (lockStatus.hasLock) {
      showLockedBadge($w, lockStatus.lock);
    } else {
      showLockButton($w, product, memberId);
    }

    $w('#priceLockSection').expand();
  } catch (err) {
    try { $w('#priceLockSection').collapse(); } catch (_) {}
  }
}

/**
 * Show the "Price locked at $X" badge when an active lock exists.
 */
function showLockedBadge($w, lock) {
  try {
    $w('#priceLockBtn').collapse();
    $w('#priceLockBadge').expand();
    $w('#priceLockBadgeText').text = `Price locked at $${lock.lockedPrice.toFixed(2)}`;
    $w('#priceLockExpiry').text = `Expires in ${lock.daysRemaining} day${lock.daysRemaining !== 1 ? 's' : ''} • $${lock.deposit} deposit applied at checkout`;

    try {
      $w('#priceLockBadgeText').style.color = colors.success;
      $w('#priceLockBadge').style.borderColor = colors.success;
    } catch (_) {}

    try {
      $w('#priceLockBadge').accessibility.role = 'status';
      $w('#priceLockBadge').accessibility.ariaLabel =
        `Price locked at $${lock.lockedPrice.toFixed(2)}, expires in ${lock.daysRemaining} days`;
    } catch (_) {}
  } catch (_) {}
}

/**
 * Show the "Lock This Price" button + set up modal.
 */
function showLockButton($w, product, memberId) {
  try {
    $w('#priceLockBadge').collapse();
    $w('#priceLockBtn').expand();
    $w('#priceLockBtn').label = `Lock This Price — $25 Deposit`;

    try {
      $w('#priceLockBtn').style.backgroundColor = colors.mountainBlue;
      $w('#priceLockBtn').style.color = colors.white;
    } catch (_) {}

    // Button opens modal
    $w('#priceLockBtn').onClick(() => {
      openTierModal($w, product, memberId);
    });

    try {
      $w('#priceLockBtn').accessibility.ariaLabel =
        `Lock the price of ${product.name} at $${product.price?.toFixed(2)} with a $25 refundable deposit`;
    } catch (_) {}
  } catch (_) {}
}

/**
 * Open the tier selection modal.
 */
function openTierModal($w, product, memberId) {
  try {
    $w('#priceLockModal').expand();
    $w('#priceLockModalContent').expand();
    $w('#priceLockSuccess').collapse();

    $w('#priceLockDeposit').text = `$25 refundable deposit • Applied as credit when you purchase`;

    // Set up tier buttons
    for (const tier of ['30', '60', '90']) {
      try {
        const btn = $w(`#priceLock${tier}`);
        btn.label = `${tier} Days`;
        btn.onClick(async () => {
          await handleTierSelect($w, product, memberId, Number(tier));
        });
      } catch (_) {}
    }

    // Close button
    try {
      $w('#priceLockClose').onClick(() => {
        $w('#priceLockModal').collapse();
      });
    } catch (_) {}

    try {
      $w('#priceLockModalContent').accessibility.role = 'dialog';
      $w('#priceLockModalContent').accessibility.ariaLabel = 'Choose price lock duration';
    } catch (_) {}
  } catch (_) {}
}

/**
 * Handle tier button click — create the price lock.
 */
async function handleTierSelect($w, product, memberId, tier) {
  try {
    // Disable all tier buttons during request
    for (const t of ['30', '60', '90']) {
      try { $w(`#priceLock${t}`).disable(); } catch (_) {}
    }

    const { createPriceLock } = await import('backend/priceLock.web');
    const result = await createPriceLock({
      productId: product._id,
      currentPrice: product.price,
      productName: product.name,
      email: '',
      tier,
    }, memberId);

    if (result.success) {
      // Show success message
      try {
        $w('#priceLockSuccess').text =
          `Price locked at $${result.data.lockedPrice.toFixed(2)} for ${tier} days! Your $25 deposit will be credited at checkout.`;
        $w('#priceLockSuccess').expand();
        $w('#priceLockSuccess').style.color = colors.success;
      } catch (_) {}

      announce($w, `Price locked successfully for ${tier} days`);

      // After 2 seconds, close modal and show badge
      setTimeout(() => {
        try { $w('#priceLockModal').collapse(); } catch (_) {}
        showLockedBadge($w, {
          lockedPrice: result.data.lockedPrice,
          daysRemaining: tier,
          deposit: result.data.deposit,
        });
      }, 2000);
    } else {
      announce($w, result.error || 'Failed to create price lock');
      // Re-enable buttons on failure
      for (const t of ['30', '60', '90']) {
        try { $w(`#priceLock${t}`).enable(); } catch (_) {}
      }
    }
  } catch (err) {
    for (const t of ['30', '60', '90']) {
      try { $w(`#priceLock${t}`).enable(); } catch (_) {}
    }
  }
}
