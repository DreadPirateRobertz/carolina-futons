// giftCardHelpers.js — Testable logic extracted from Gift Cards page
// Pure functions for gift card validation, formatting, and display.

import { colors } from 'public/designTokens.js';

/** Available gift card denominations (must match backend GIFT_CARD_AMOUNTS) */
export const GIFT_CARD_DENOMINATIONS = [
  { amount: 25, label: '$25' },
  { amount: 50, label: '$50' },
  { amount: 100, label: '$100' },
  { amount: 150, label: '$150' },
  { amount: 200, label: '$200' },
  { amount: 500, label: '$500' },
];

const VALID_AMOUNTS = new Set(GIFT_CARD_DENOMINATIONS.map(d => d.amount));

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const CODE_RE = /^CF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

/**
 * Validate the gift card purchase form.
 * @param {Object|null|undefined} form
 * @param {number} form.amount - Selected denomination
 * @param {string} form.purchaserEmail - Buyer email
 * @param {string} form.recipientEmail - Recipient email
 * @param {string} [form.recipientName] - Recipient name
 * @param {string} [form.message] - Personal message
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validatePurchaseForm(form) {
  if (!form) {
    return {
      valid: false,
      errors: [
        { field: 'amount', message: 'Please select an amount' },
        { field: 'purchaserEmail', message: 'Your email is required' },
        { field: 'recipientEmail', message: 'Recipient email is required' },
      ],
    };
  }

  const errors = [];
  const amount = Number(form.amount);

  if (!form.amount || !isFinite(amount) || !VALID_AMOUNTS.has(amount)) {
    errors.push({ field: 'amount', message: 'Please select a valid gift card amount' });
  }

  const buyerEmail = (form.purchaserEmail || '').trim();
  if (!buyerEmail) {
    errors.push({ field: 'purchaserEmail', message: 'Your email is required' });
  } else if (!EMAIL_RE.test(buyerEmail)) {
    errors.push({ field: 'purchaserEmail', message: 'Please enter a valid email address' });
  }

  const recipientEmail = (form.recipientEmail || '').trim();
  if (!recipientEmail) {
    errors.push({ field: 'recipientEmail', message: 'Recipient email is required' });
  } else if (!EMAIL_RE.test(recipientEmail)) {
    errors.push({ field: 'recipientEmail', message: 'Please enter a valid recipient email' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a gift card code format.
 * @param {string|null|undefined} code
 * @returns {boolean}
 */
export function validateGiftCardCode(code) {
  if (!code || typeof code !== 'string') return false;
  return CODE_RE.test(code.trim());
}

/**
 * Format a balance amount for display.
 * @param {number|string|null|undefined} amount
 * @returns {string} Formatted dollar amount
 */
export function formatBalance(amount) {
  const num = Number(amount);
  if (!isFinite(num) || num < 0) return '$0.00';
  return `$${num.toFixed(2)}`;
}

/**
 * Format an expiration date for display.
 * @param {string|Date|null|undefined} dateValue
 * @returns {string} Formatted date or empty string
 */
export function formatExpirationDate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Get the display properties for a balance check result status.
 * @param {Object|null} result - Balance check result from backend
 * @returns {{ label: string, color: string }}
 */
export function getBalanceStatusDisplay(result) {
  if (!result || !result.found) {
    return { label: 'Not Found', color: colors.error };
  }

  switch (result.status) {
    case 'active':
      return { label: 'Active', color: colors.success };
    case 'expired':
      return { label: 'Expired', color: colors.error };
    case 'redeemed':
      return { label: 'Fully Redeemed', color: colors.muted };
    default:
      return { label: 'Unknown', color: colors.muted };
  }
}

/**
 * Build the usage text showing remaining vs initial balance.
 * @param {number|null} balance - Current balance
 * @param {number|null} initialAmount - Original amount
 * @returns {string}
 */
export function getCardUsageText(balance, initialAmount) {
  const bal = formatBalance(balance);
  const initial = formatBalance(initialAmount);
  return `${bal} remaining of ${initial}`;
}

/**
 * Normalize a gift card code for display/submission (uppercase, trimmed).
 * @param {string|null|undefined} code
 * @returns {string}
 */
export function formatGiftCardCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

/**
 * Build the display text for an applied gift card discount.
 * @param {number|null} amount - Amount applied
 * @returns {string}
 */
export function buildGiftCardAppliedText(amount) {
  return `-${formatBalance(amount)} Gift Card`;
}

/**
 * Calculate how much gift card balance to apply to a subtotal.
 * @param {number|null} balance - Gift card balance
 * @param {number|null} subtotal - Order subtotal
 * @returns {{ amountToApply: number, remainingSubtotal: number }}
 */
export function calculateGiftCardDiscount(balance, subtotal) {
  const bal = Math.max(0, Number(balance) || 0);
  const sub = Math.max(0, Number(subtotal) || 0);
  const amountToApply = Math.min(bal, sub);
  return {
    amountToApply,
    remainingSubtotal: sub - amountToApply,
  };
}

// Shared state for gift card applied at checkout — readable by Checkout page
let _giftCardState = { applied: false, amountApplied: 0, code: '' };

/**
 * Get the current gift card applied state at checkout.
 * @returns {{ applied: boolean, amountApplied: number, code: string }}
 */
export function getCheckoutGiftCardState() {
  return { ..._giftCardState };
}

/**
 * Get the error message for a failed balance check.
 * @param {Object} balanceResult - Result from checkBalance
 * @returns {string}
 */
export function getBalanceCheckError(balanceResult) {
  if (!balanceResult.found) {
    return 'Gift card not found.';
  }
  if (balanceResult.status === 'expired') {
    return 'This gift card has expired.';
  }
  return 'This gift card has no remaining balance.';
}

/**
 * Initialize gift card code entry at checkout.
 * Uses shared state pattern — caller reads state via getCheckoutGiftCardState().
 *
 * @param {Function} $w - Wix Velo selector
 * @param {Function} getSubtotal - Returns current subtotal at call time
 * @returns {Promise<void>}
 */
export async function initCheckoutGiftCard($w, getSubtotal) {
  try {
    const applyBtn = $w('#giftCardApplyBtn');
    if (!applyBtn) return;

    _giftCardState = { applied: false, amountApplied: 0, code: '' };

    try { $w('#giftCardCodeInput').accessibility.ariaLabel = 'Enter gift card code'; } catch (_) {}
    try { applyBtn.accessibility.ariaLabel = 'Apply gift card to order'; } catch (_) {}

    applyBtn.onClick(async () => {
      try { $w('#giftCardCheckoutError').hide(); } catch (_) {}
      try { $w('#giftCardAppliedSection').hide(); } catch (_) {}

      const rawCode = ($w('#giftCardCodeInput').value || '').trim();
      const code = formatGiftCardCode(rawCode);

      if (!validateGiftCardCode(code)) {
        try {
          $w('#giftCardCheckoutError').text = 'Please enter a valid gift card code (CF-XXXX-XXXX-XXXX-XXXX).';
          $w('#giftCardCheckoutError').show();
        } catch (_) {}
        return;
      }

      applyBtn.disable();
      applyBtn.label = 'Checking...';

      try {
        const { checkBalance, redeemGiftCard } = await import('backend/giftCards.web');
        const balanceResult = await checkBalance(code);

        if (!balanceResult.found || balanceResult.status !== 'active' || balanceResult.balance <= 0) {
          try {
            $w('#giftCardCheckoutError').text = getBalanceCheckError(balanceResult);
            $w('#giftCardCheckoutError').show();
          } catch (_) {}
          return;
        }

        // Read subtotal at click time, not init time
        const currentSubtotal = typeof getSubtotal === 'function' ? getSubtotal() : (Number(getSubtotal) || 0);
        const { amountToApply } = calculateGiftCardDiscount(balanceResult.balance, currentSubtotal);

        // Deduct balance before updating UI — only show success if redemption works
        const redeemResult = await redeemGiftCard(code, amountToApply);
        if (!redeemResult.success) {
          try {
            $w('#giftCardCheckoutError').text = redeemResult.message || 'Unable to apply gift card. Please try again.';
            $w('#giftCardCheckoutError').show();
          } catch (_) {}
          return;
        }

        try {
          $w('#giftCardAppliedAmount').text = buildGiftCardAppliedText(amountToApply);
          $w('#giftCardAppliedSection').show('fade', { duration: 250 });
          try { $w('#orderSummaryGiftCard').text = `-${formatBalance(amountToApply)}`; } catch (_) {}
          try { $w('#orderSummaryGiftCardRow').show(); } catch (_) {}
        } catch (_) {}

        _giftCardState = { applied: true, amountApplied: amountToApply, code };

        const { announce } = await import('public/a11yHelpers');
        announce($w, `${formatBalance(amountToApply)} gift card applied to your order`);
      } catch (err) {
        console.error('[Checkout] Error applying gift card:', err);
        try {
          $w('#giftCardCheckoutError').text = 'Unable to apply gift card. Please try again.';
          $w('#giftCardCheckoutError').show();
        } catch (_) {}
      } finally {
        applyBtn.enable();
        applyBtn.label = 'Apply';
      }
    });

    try { $w('#giftCardCheckoutSection').show('fade', { duration: 250 }); } catch (_) {}
  } catch (err) {
    console.error('[giftCardHelpers] Error initializing checkout gift card:', err);
  }
}

/**
 * Initialize the gift card dashboard on Member Page.
 * Shows purchased and received gift cards with balances.
 * @param {Function} $w - Wix Velo selector
 * @returns {Promise<void>}
 */
export async function initGiftCardDashboard($w) {
  try {
    const { getMyGiftCards } = await import('backend/giftCards.web');
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();

    if (!member || !member.loginEmail) {
      try { $w('#giftCardDashboardSection').hide(); } catch (_) {}
      return;
    }

    const result = await getMyGiftCards(member.loginEmail);

    if (!result.success) {
      try { $w('#giftCardDashboardSection').hide(); } catch (_) {}
      return;
    }

    const allCards = [...(result.purchased || []), ...(result.received || [])];

    if (allCards.length === 0) {
      try { $w('#giftCardDashboardSection').hide(); } catch (_) {}
      return;
    }

    const activeCards = allCards.filter(c => c.status === 'active' && c.balance > 0);
    const totalBalance = activeCards.reduce((sum, c) => sum + (c.balance || 0), 0);

    try { $w('#giftCardTotalBalance').text = formatBalance(totalBalance); } catch (_) {}
    try { $w('#giftCardCount').text = `${activeCards.length} active card${activeCards.length !== 1 ? 's' : ''}`; } catch (_) {}

    try {
      const repeater = $w('#giftCardRepeater');
      if (repeater) {
        repeater.onItemReady(($item, itemData) => {
          try { $item('#gcDashCode').text = itemData.maskedCode || '****'; } catch (_) {}
          try { $item('#gcDashBalance').text = formatBalance(itemData.balance); } catch (_) {}
          try {
            const statusDisplay = getBalanceStatusDisplay({ found: true, ...itemData });
            $item('#gcDashStatus').text = statusDisplay.label;
          } catch (_) {}
          try { $item('#gcDashExpiry').text = formatExpirationDate(itemData.expirationDate); } catch (_) {}
        });

        repeater.data = allCards.map((card, i) => ({
          ...card,
          _id: card._id || `gc-dash-${i}`,
        }));
      }
    } catch (_) {}

    try { $w('#giftCardDashboardSection').show('fade', { duration: 250 }); } catch (_) {}
  } catch (err) {
    console.error('[giftCardHelpers] Error initializing gift card dashboard:', err);
    try { $w('#giftCardDashboardSection').hide(); } catch (_) {}
  }
}
