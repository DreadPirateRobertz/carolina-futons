/**
 * @module giftCards
 * @description Backend web module for gift card management.
 * Custom implementation: generate codes, track balances, handle redemption.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create 'GiftCards' CMS collection with fields:
 *   code (Text, unique), balance (Number), initialAmount (Number),
 *   purchaserEmail (Text), recipientEmail (Text), recipientName (Text),
 *   message (Text), status (Text: 'active'|'redeemed'|'expired'),
 *   createdDate (Date), expirationDate (Date), lastUsedDate (Date)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { triggeredEmails, contacts } from 'wix-crm-backend';

const GIFT_CARD_AMOUNTS = [25, 50, 100, 150, 200, 500];
const EXPIRATION_DAYS = 365;

/**
 * Purchase a new gift card.
 *
 * @function purchaseGiftCard
 * @param {Object} data - Gift card data
 * @param {number} data.amount - Gift card amount (must be in allowed list)
 * @param {string} data.purchaserEmail - Buyer's email
 * @param {string} data.recipientEmail - Recipient's email
 * @param {string} [data.recipientName] - Recipient's name
 * @param {string} [data.message] - Personal message
 * @returns {Promise<Object>} { success, code?, giftCardId? }
 * @permission SiteMember
 */
export const purchaseGiftCard = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      if (!data || !data.amount || !data.purchaserEmail || !data.recipientEmail) {
        return { success: false, message: 'Amount, purchaser email, and recipient email required' };
      }

      const amount = Number(data.amount);
      if (!isFinite(amount) || !GIFT_CARD_AMOUNTS.includes(amount)) {
        return { success: false, message: `Amount must be one of: $${GIFT_CARD_AMOUNTS.join(', $')}` };
      }

      const purchaserEmail = sanitize(data.purchaserEmail, 254).toLowerCase();
      const recipientEmail = sanitize(data.recipientEmail, 254).toLowerCase();

      if (!validateEmail(purchaserEmail) || !validateEmail(recipientEmail)) {
        return { success: false, message: 'Invalid email format' };
      }

      const code = generateGiftCardCode();
      const expirationDate = new Date(Date.now() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

      const giftCard = await wixData.insert('GiftCards', {
        code,
        balance: amount,
        initialAmount: amount,
        purchaserEmail,
        recipientEmail,
        recipientName: sanitize(data.recipientName || '', 200),
        message: sanitize(data.message || '', 500),
        status: 'active',
        createdDate: new Date(),
        expirationDate,
      });

      // Fire-and-forget email delivery — don't block purchase on email
      sendGiftCardEmails({
        code,
        amount,
        purchaserEmail,
        recipientEmail,
        recipientName: sanitize(data.recipientName || '', 200),
        message: sanitize(data.message || '', 500),
        expirationDate: expirationDate.toISOString(),
      }).catch(err => console.error('Gift card email delivery failed:', err));

      return {
        success: true,
        code,
        giftCardId: giftCard._id,
        amount,
        expirationDate: expirationDate.toISOString(),
      };
    } catch (err) {
      console.error('Error purchasing gift card:', err);
      return { success: false, message: 'Failed to create gift card' };
    }
  }
);

/**
 * Check gift card balance by code.
 *
 * @function checkBalance
 * @param {string} code - Gift card code
 * @returns {Promise<Object>} { found, balance?, status?, expirationDate? }
 * @permission Anyone — balance check is public
 */
export const checkBalance = webMethod(
  Permissions.Anyone,
  async (code) => {
    try {
      if (!code) return { found: false };
      const cleanCode = sanitize(code, 30).toUpperCase();

      const result = await wixData.query('GiftCards')
        .eq('code', cleanCode)
        .find();

      if (result.items.length === 0) {
        return { found: false };
      }

      const card = result.items[0];

      // Check expiration
      if (card.expirationDate && new Date(card.expirationDate) < new Date()) {
        if (card.status !== 'expired') {
          await wixData.update('GiftCards', { ...card, status: 'expired' });
        }
        return { found: true, balance: 0, status: 'expired' };
      }

      return {
        found: true,
        balance: card.balance,
        status: card.status,
        expirationDate: card.expirationDate,
        initialAmount: card.initialAmount,
      };
    } catch (err) {
      console.error('Error checking gift card balance:', err);
      return { found: false };
    }
  }
);

/**
 * Redeem (deduct from) a gift card during checkout.
 *
 * @function redeemGiftCard
 * @param {string} code - Gift card code
 * @param {number} amount - Amount to deduct
 * @returns {Promise<Object>} { success, remainingBalance?, amountApplied? }
 * @permission SiteMember
 */
export const redeemGiftCard = webMethod(
  Permissions.SiteMember,
  async (code, amount) => {
    try {
      if (!code || !amount) {
        return { success: false, message: 'Code and amount required' };
      }

      const cleanCode = sanitize(code, 30).toUpperCase();
      const redeemAmount = Number(amount);

      if (!isFinite(redeemAmount) || redeemAmount <= 0) {
        return { success: false, message: 'Invalid amount' };
      }

      const result = await wixData.query('GiftCards')
        .eq('code', cleanCode)
        .eq('status', 'active')
        .find();

      if (result.items.length === 0) {
        return { success: false, message: 'Gift card not found or inactive' };
      }

      const card = result.items[0];

      // Check expiration
      if (card.expirationDate && new Date(card.expirationDate) < new Date()) {
        await wixData.update('GiftCards', { ...card, status: 'expired' });
        return { success: false, message: 'Gift card has expired' };
      }

      if (card.balance <= 0) {
        return { success: false, message: 'Gift card has no remaining balance' };
      }

      // RACE FIX: Use unique claimId to detect concurrent modifications.
      // Each request stamps a unique token; on re-read, only the winner's token persists.
      const claimId = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const originalBalance = card.balance;
      await wixData.update('GiftCards', { ...card, status: 'processing', claimId });

      // Re-read to confirm we won the claim — only one request's claimId can be current
      const claimed = await wixData.get('GiftCards', card._id);
      if (claimed.claimId !== claimId || claimed.balance !== originalBalance) {
        return { success: false, message: 'Gift card was modified concurrently, please retry' };
      }

      const amountApplied = Math.min(redeemAmount, claimed.balance);
      const newBalance = claimed.balance - amountApplied;

      await wixData.update('GiftCards', {
        ...claimed,
        balance: newBalance,
        status: newBalance <= 0 ? 'redeemed' : 'active',
        lastUsedDate: new Date(),
      });

      return {
        success: true,
        amountApplied,
        remainingBalance: newBalance,
      };
    } catch (err) {
      console.error('Error redeeming gift card:', err);
      return { success: false, message: 'Failed to redeem gift card' };
    }
  }
);

/**
 * Get available gift card denominations.
 *
 * @function getGiftCardOptions
 * @returns {Promise<Array>} Available denominations
 * @permission Anyone
 */
export const getGiftCardOptions = webMethod(
  Permissions.Anyone,
  async () => {
    return GIFT_CARD_AMOUNTS.map(amount => ({
      amount,
      label: `$${amount}`,
    }));
  }
);

/**
 * Send gift card confirmation emails to purchaser and recipient.
 * Internal only — NOT a webMethod. Called by purchaseGiftCard after insert.
 *
 * @param {Object} data - Already-sanitized gift card data
 * @param {string} data.code - Gift card code
 * @param {number} data.amount - Gift card amount
 * @param {string} data.purchaserEmail - Buyer's email
 * @param {string} data.recipientEmail - Recipient's email
 * @param {string} [data.recipientName] - Recipient name
 * @param {string} [data.message] - Personal message
 * @param {string} [data.expirationDate] - ISO expiration date
 * @returns {Promise<{success: boolean, purchaserSent: boolean, recipientSent: boolean}>}
 */
async function sendGiftCardEmails(data) {
  if (!data || !data.code || !data.purchaserEmail || !data.recipientEmail || !data.amount) {
    return { success: false, purchaserSent: false, recipientSent: false, message: 'Missing required email data' };
  }

  const formattedAmount = `$${Number(data.amount).toFixed(2)}`;
  let purchaserSent = false;
  let recipientSent = false;

  // Send purchaser confirmation first — independent of recipient
  try {
    const purchaserContact = await contacts.appendOrCreateContact({
      emails: [{ email: data.purchaserEmail }],
    });
    await triggeredEmails.emailContact(
      'gift_card_purchase_confirmation',
      purchaserContact.contactId,
      {
        variables: {
          code: data.code,
          amount: formattedAmount,
          recipientEmail: data.recipientEmail,
          recipientName: data.recipientName || 'your recipient',
          expirationDate: data.expirationDate || '',
        },
      }
    );
    purchaserSent = true;
  } catch (err) {
    console.error('Error sending purchaser gift card email:', err);
  }

  // Send recipient notification — independent of purchaser
  try {
    const recipientContact = await contacts.appendOrCreateContact({
      emails: [{ email: data.recipientEmail }],
    });
    await triggeredEmails.emailContact(
      'gift_card_received',
      recipientContact.contactId,
      {
        variables: {
          code: data.code,
          amount: formattedAmount,
          recipientName: data.recipientName || '',
          message: data.message || '',
          purchaserEmail: data.purchaserEmail,
          expirationDate: data.expirationDate || '',
        },
      }
    );
    recipientSent = true;
  } catch (err) {
    console.error('Error sending recipient gift card email:', err);
  }

  return { success: purchaserSent || recipientSent, purchaserSent, recipientSent };
}

/**
 * Get gift cards associated with a member's email.
 * Returns both purchased and received cards.
 *
 * @function getMyGiftCards
 * @param {string} email - Member's email address
 * @returns {Promise<{success: boolean, purchased: Array, received: Array}>}
 * @permission SiteMember
 */
export const getMyGiftCards = webMethod(
  Permissions.SiteMember,
  async (email) => {
    try {
      if (!email) return { success: false, message: 'Email required' };
      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) {
        return { success: false, message: 'Invalid email' };
      }

      const [purchasedResult, receivedResult] = await Promise.all([
        wixData.query('GiftCards')
          .eq('purchaserEmail', cleanEmail)
          .descending('createdDate')
          .find(),
        wixData.query('GiftCards')
          .eq('recipientEmail', cleanEmail)
          .descending('createdDate')
          .find(),
      ]);

      return {
        success: true,
        purchased: purchasedResult.items.map(sanitizeCardForFrontend),
        received: receivedResult.items.map(sanitizeCardForFrontend),
      };
    } catch (err) {
      console.error('Error fetching gift cards:', err);
      return { success: false, message: 'Failed to fetch gift cards' };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Mask a gift card code, showing only prefix and last segment.
 * @param {string} code - Full code e.g. "CF-ABCD-EFGH-JKLM-NPQR"
 * @returns {string} Masked code e.g. "CF-****-****-****-NPQR"
 */
function maskCode(code) {
  if (!code || typeof code !== 'string') return '****';
  const parts = code.split('-');
  if (parts.length !== 5) return '****';
  return `${parts[0]}-****-****-****-${parts[4]}`;
}

/**
 * Strip internal wixData fields and mask code for frontend display.
 * @param {Object} card - Raw wixData item
 * @returns {Object} Safe card object for frontend
 */
function sanitizeCardForFrontend(card) {
  return {
    _id: card._id,
    maskedCode: maskCode(card.code),
    balance: card.balance,
    initialAmount: card.initialAmount,
    status: card.status,
    expirationDate: card.expirationDate,
    createdDate: card.createdDate,
  };
}

// Exported for testing only — NOT a webMethod, not callable from frontend
export { sendGiftCardEmails as _sendGiftCardEmails };

function generateGiftCardCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CF-';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (i < 3) code += '-';
  }
  return code; // e.g. CF-ABCD-EFGH-JKLM-NPQR
}
