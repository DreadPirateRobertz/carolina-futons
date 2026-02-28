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

      // RACE FIX: Claim card by setting status='processing' BEFORE calculating.
      // Concurrent requests querying status='active' will not find this card.
      const originalBalance = card.balance;
      await wixData.update('GiftCards', { ...card, status: 'processing' });

      // Re-read to confirm we won the claim (another request may have set processing first)
      const claimed = await wixData.get('GiftCards', card._id);
      if (claimed.status !== 'processing' || claimed.balance !== originalBalance) {
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

// ── Internal helpers ──────────────────────────────────────────────────

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
