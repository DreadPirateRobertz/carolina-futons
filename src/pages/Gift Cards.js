// Gift Cards.js - Gift Card Purchase, Redemption & Balance Check Page
// Three-section page: purchase a gift card, check balance, and redemption info
import { purchaseGiftCard, checkBalance, getGiftCardOptions } from 'backend/giftCards.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce } from 'public/a11yHelpers';
import {
  GIFT_CARD_DENOMINATIONS,
  validatePurchaseForm,
  validateGiftCardCode,
  formatBalance,
  formatExpirationDate,
  getBalanceStatusDisplay,
  getCardUsageText,
  formatGiftCardCode,
} from 'public/giftCardHelpers.js';

let selectedAmount = null;

$w.onReady(async function () {
  initBackToTop($w);
  initDenominationPicker();
  initPurchaseForm();
  initBalanceChecker();
  trackEvent('page_view', { page: 'gift-cards' });
});

// ── Denomination Picker ─────────────────────────────────────────────

function initDenominationPicker() {
  try {
    const repeater = $w('#gcDenomRepeater');
    if (!repeater) return;

    try { repeater.accessibility.ariaLabel = 'Gift card amount options'; } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      $item('#gcDenomLabel').text = itemData.label;
      try { $item('#gcDenomLabel').accessibility.role = 'radio'; } catch (e) {}
      try { $item('#gcDenomLabel').accessibility.ariaLabel = `Select ${itemData.label} gift card`; } catch (e) {}
      try { $item('#gcDenomLabel').accessibility.tabIndex = 0; } catch (e) {}

      const select = () => {
        selectedAmount = itemData.amount;
        announce($w, `${itemData.label} selected`);
        trackEvent('gift_card_amount_select', { amount: itemData.amount });
      };

      $item('#gcDenomLabel').onClick(select);
      try {
        $item('#gcDenomLabel').onKeyPress((event) => {
          if (event.key === 'Enter' || event.key === ' ') select();
        });
      } catch (e) {}
    });

    repeater.data = GIFT_CARD_DENOMINATIONS.map((d, i) => ({
      ...d,
      _id: `denom-${i}`,
    }));
  } catch (e) {}
}

// ── Purchase Form ───────────────────────────────────────────────────

function initPurchaseForm() {
  try {
    const submitBtn = $w('#gcPurchaseBtn');
    if (!submitBtn) return;

    // ARIA labels
    try { $w('#gcPurchaserEmail').accessibility.ariaLabel = 'Your email address'; } catch (e) {}
    try { $w('#gcPurchaserEmail').accessibility.ariaRequired = true; } catch (e) {}
    try { $w('#gcRecipientEmail').accessibility.ariaLabel = 'Recipient email address'; } catch (e) {}
    try { $w('#gcRecipientEmail').accessibility.ariaRequired = true; } catch (e) {}
    try { $w('#gcRecipientName').accessibility.ariaLabel = 'Recipient name (optional)'; } catch (e) {}
    try { $w('#gcMessage').accessibility.ariaLabel = 'Personal message (optional)'; } catch (e) {}
    try { submitBtn.accessibility.ariaLabel = 'Purchase gift card'; } catch (e) {}

    submitBtn.onClick(async () => {
      hidePurchaseMessages();

      const formData = {
        amount: selectedAmount,
        purchaserEmail: ($w('#gcPurchaserEmail').value || '').trim(),
        recipientEmail: ($w('#gcRecipientEmail').value || '').trim(),
        recipientName: ($w('#gcRecipientName').value || '').trim(),
        message: ($w('#gcMessage').value || '').trim(),
      };

      const validation = validatePurchaseForm(formData);
      if (!validation.valid) {
        const messages = validation.errors.map(e => e.message).join('. ');
        showPurchaseError(messages);
        announce($w, 'Please fix the errors in the form');
        return;
      }

      submitBtn.disable();
      submitBtn.label = 'Processing...';

      try {
        const result = await purchaseGiftCard(formData);

        if (result.success) {
          trackEvent('gift_card_purchase', { amount: formData.amount });
          showPurchaseSuccess(result);
          announce($w, `Gift card purchased! Code: ${result.code}`);
        } else {
          showPurchaseError(result.message || 'Unable to process purchase. Please try again.');
          announce($w, 'Purchase failed. Please try again.');
        }
      } catch (err) {
        console.error('Error purchasing gift card:', err);
        showPurchaseError('Something went wrong. Please try again or call (828) 252-9449.');
      } finally {
        submitBtn.enable();
        submitBtn.label = 'Purchase Gift Card';
      }
    });
  } catch (e) {}
}

function showPurchaseSuccess(result) {
  try {
    $w('#gcPurchaseSuccess').text =
      `Gift card purchased! Your code is: ${result.code}\n` +
      `Amount: ${formatBalance(result.amount)}\n` +
      `Expires: ${formatExpirationDate(result.expirationDate)}\n\n` +
      'A confirmation email has been sent to you and the recipient.';
    $w('#gcPurchaseForm').hide('fade', { duration: 250 });
    $w('#gcPurchaseSuccess').show('fade', { duration: 250 });
  } catch (e) {}
}

function showPurchaseError(message) {
  try {
    $w('#gcPurchaseError').text = message;
    $w('#gcPurchaseError').show();
  } catch (e) {}
}

function hidePurchaseMessages() {
  try { $w('#gcPurchaseError').hide(); } catch (e) {}
  try { $w('#gcPurchaseSuccess').hide(); } catch (e) {}
}

// ── Balance Checker ─────────────────────────────────────────────────

function initBalanceChecker() {
  try {
    const checkBtn = $w('#gcCheckBalanceBtn');
    if (!checkBtn) return;

    try { $w('#gcCodeInput').accessibility.ariaLabel = 'Enter gift card code'; } catch (e) {}
    try { $w('#gcCodeInput').accessibility.ariaRequired = true; } catch (e) {}
    try { checkBtn.accessibility.ariaLabel = 'Check gift card balance'; } catch (e) {}

    checkBtn.onClick(async () => {
      hideBalanceMessages();

      const rawCode = ($w('#gcCodeInput').value || '').trim();
      const code = formatGiftCardCode(rawCode);

      if (!validateGiftCardCode(code)) {
        showBalanceError('Please enter a valid gift card code (format: CF-XXXX-XXXX-XXXX-XXXX).');
        announce($w, 'Invalid gift card code format');
        return;
      }

      checkBtn.disable();
      checkBtn.label = 'Checking...';

      try {
        const result = await checkBalance(code);
        const statusDisplay = getBalanceStatusDisplay(result);

        if (result.found) {
          const usageText = getCardUsageText(result.balance, result.initialAmount);
          const expiry = result.expirationDate
            ? `Expires: ${formatExpirationDate(result.expirationDate)}`
            : '';

          try {
            $w('#gcBalanceAmount').text = formatBalance(result.balance);
            $w('#gcBalanceStatus').text = statusDisplay.label;
            $w('#gcBalanceUsage').text = usageText;
            if (expiry) $w('#gcBalanceExpiry').text = expiry;
            $w('#gcBalanceResult').show('fade', { duration: 250 });
          } catch (e) {}

          trackEvent('gift_card_balance_check', { status: result.status });
          announce($w, `Balance: ${formatBalance(result.balance)}. Status: ${statusDisplay.label}`);
        } else {
          showBalanceError('Gift card not found. Please check the code and try again.');
          announce($w, 'Gift card not found');
        }
      } catch (err) {
        console.error('Error checking balance:', err);
        showBalanceError('Unable to check balance. Please try again.');
      } finally {
        checkBtn.enable();
        checkBtn.label = 'Check Balance';
      }
    });
  } catch (e) {}
}

function showBalanceError(message) {
  try {
    $w('#gcBalanceError').text = message;
    $w('#gcBalanceError').show();
  } catch (e) {}
}

function hideBalanceMessages() {
  try { $w('#gcBalanceError').hide(); } catch (e) {}
  try { $w('#gcBalanceResult').hide(); } catch (e) {}
}
