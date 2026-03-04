/**
 * @module storeCreditService
 * @description Backend web module for store credit & refund wallet management.
 * Handles credit issuance (from returns/refunds/promotions), balance queries,
 * auto-apply at checkout, gifting between members, and expiration tracking.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create 'StoreCredits' CMS collection with fields:
 *   memberId (Text, indexed), balance (Number), initialAmount (Number),
 *   reason (Text: 'return'|'refund'|'promotion'|'admin_gift'|'goodwill'|'gift_received'),
 *   orderReference (Text), status (Text: 'active'|'used'|'expired'),
 *   createdDate (Date), expirationDate (Date), lastUsedDate (Date),
 *   transactions (Text - JSON array of {type, amount, date, orderId?, fromMemberId?}),
 *   giftMessage (Text)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';

// ── Constants ──────────────────────────────────────────────────────

const COLLECTION = 'StoreCredits';
const EXPIRATION_DAYS = 365;
const MAX_CREDIT_AMOUNT = 10000;
const VALID_REASONS = ['return', 'refund', 'promotion', 'admin_gift', 'goodwill', 'gift_received'];

// ── Public API ─────────────────────────────────────────────────────

/**
 * Issue store credit to a member (admin action).
 *
 * @function issueStoreCredit
 * @param {Object} data
 * @param {string} data.memberId - Target member ID
 * @param {number} data.amount - Credit amount to issue
 * @param {string} data.reason - Reason: 'return'|'refund'|'promotion'|'admin_gift'|'goodwill'
 * @param {string} [data.orderReference] - Related order ID
 * @returns {Promise<{success: boolean, creditId?: string, balance?: number, expirationDate?: string}>}
 * @permission Admin
 */
export const issueStoreCredit = webMethod(
  Permissions.Admin,
  async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Credit data is required.' };
      }

      const memberId = validateId(data.memberId);
      if (!memberId) {
        return { success: false, message: 'Member ID is required and must be valid.' };
      }

      const amount = Number(data.amount);
      if (!isFinite(amount) || amount <= 0) {
        return { success: false, message: 'A positive amount is required.' };
      }
      if (amount > MAX_CREDIT_AMOUNT) {
        return { success: false, message: `Amount cannot exceed $${MAX_CREDIT_AMOUNT.toLocaleString()}.` };
      }

      const reason = sanitize(data.reason || '', 30);
      if (!VALID_REASONS.includes(reason)) {
        return { success: false, message: `Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}` };
      }

      const roundedAmount = round2(amount);
      const expirationDate = new Date(Date.now() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
      const now = new Date();

      const initialTransaction = {
        type: 'issue',
        amount: roundedAmount,
        date: now.toISOString(),
        reason,
      };

      const credit = await wixData.insert(COLLECTION, {
        memberId,
        balance: roundedAmount,
        initialAmount: roundedAmount,
        reason,
        orderReference: sanitize(data.orderReference || '', 100),
        status: 'active',
        createdDate: now,
        expirationDate,
        lastUsedDate: null,
        transactions: JSON.stringify([initialTransaction]),
        giftMessage: '',
      });

      return {
        success: true,
        creditId: credit._id,
        balance: roundedAmount,
        expirationDate: expirationDate.toISOString(),
      };
    } catch (err) {
      console.error('[storeCreditService] Error issuing store credit:', err);
      return { success: false, message: 'Failed to issue store credit.' };
    }
  }
);

/**
 * Get current member's active store credit balance and entries.
 *
 * @function getMyStoreCredit
 * @param {string} memberId - Member ID
 * @returns {Promise<{success: boolean, totalBalance?: number, credits?: Array}>}
 * @permission SiteMember
 */
export const getMyStoreCredit = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    try {
      if (!memberId || typeof memberId !== 'string' || !memberId.trim()) {
        return { success: false, message: 'Member ID is required.' };
      }

      const cleanId = sanitize(memberId, 50);

      const result = await wixData.query(COLLECTION)
        .eq('memberId', cleanId)
        .eq('status', 'active')
        .find();

      const now = new Date();
      const activeCredits = [];
      let totalBalance = 0;

      for (const credit of result.items) {
        // Auto-expire past-due credits
        if (credit.expirationDate && new Date(credit.expirationDate) < now) {
          await wixData.update(COLLECTION, { ...credit, status: 'expired', balance: 0 });
          continue;
        }

        if (credit.balance > 0) {
          activeCredits.push({
            _id: credit._id,
            memberId: credit.memberId,
            balance: credit.balance,
            initialAmount: credit.initialAmount,
            reason: credit.reason,
            status: credit.status,
            createdDate: credit.createdDate,
            expirationDate: credit.expirationDate,
          });
          totalBalance = round2(totalBalance + credit.balance);
        }
      }

      return {
        success: true,
        totalBalance,
        credits: activeCredits,
      };
    } catch (err) {
      console.error('[storeCreditService] Error getting store credit:', err);
      return { success: false, message: 'Failed to retrieve store credit.' };
    }
  }
);

/**
 * Apply store credit to an order at checkout. Uses credits expiring soonest first.
 *
 * @function applyStoreCredit
 * @param {string} memberId - Member ID
 * @param {number} orderAmount - Amount to apply credit toward
 * @returns {Promise<{success: boolean, amountApplied?: number, remainingOrderBalance?: number, creditsUsed?: Array}>}
 * @permission SiteMember
 */
export const applyStoreCredit = webMethod(
  Permissions.SiteMember,
  async (memberId, orderAmount) => {
    try {
      if (!memberId || typeof memberId !== 'string' || !memberId.trim()) {
        return { success: false, message: 'Member ID is required.' };
      }

      const amount = Number(orderAmount);
      if (!isFinite(amount) || amount <= 0) {
        return { success: false, message: 'A positive order amount is required.' };
      }

      const cleanId = sanitize(memberId, 50);
      const now = new Date();

      // Get active credits sorted by expiration (soonest first)
      const result = await wixData.query(COLLECTION)
        .eq('memberId', cleanId)
        .eq('status', 'active')
        .ascending('expirationDate')
        .find();

      let remaining = round2(amount);
      let totalApplied = 0;
      const creditsUsed = [];

      for (const credit of result.items) {
        if (remaining <= 0) break;

        // Skip expired credits
        if (credit.expirationDate && new Date(credit.expirationDate) < now) {
          await wixData.update(COLLECTION, { ...credit, status: 'expired', balance: 0 });
          continue;
        }

        if (credit.balance <= 0) continue;

        const deduction = round2(Math.min(remaining, credit.balance));
        const newBalance = round2(credit.balance - deduction);

        // Parse existing transactions
        let transactions = [];
        try { transactions = JSON.parse(credit.transactions || '[]'); } catch (_) { /* empty */ }

        transactions.push({
          type: 'redeem',
          amount: deduction,
          date: now.toISOString(),
        });

        await wixData.update(COLLECTION, {
          ...credit,
          balance: newBalance,
          status: newBalance <= 0 ? 'used' : 'active',
          lastUsedDate: now,
          transactions: JSON.stringify(transactions),
        });

        remaining = round2(remaining - deduction);
        totalApplied = round2(totalApplied + deduction);
        creditsUsed.push({ creditId: credit._id, amountUsed: deduction, remainingBalance: newBalance });
      }

      return {
        success: true,
        amountApplied: totalApplied,
        remainingOrderBalance: remaining,
        creditsUsed,
      };
    } catch (err) {
      console.error('[storeCreditService] Error applying store credit:', err);
      return { success: false, message: 'Failed to apply store credit.' };
    }
  }
);

/**
 * Get full store credit history for a member (all statuses).
 *
 * @function getStoreCreditHistory
 * @param {string} memberId - Member ID
 * @returns {Promise<{success: boolean, credits?: Array}>}
 * @permission SiteMember
 */
export const getStoreCreditHistory = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    try {
      if (!memberId || typeof memberId !== 'string' || !memberId.trim()) {
        return { success: false, message: 'Member ID is required.' };
      }

      const cleanId = sanitize(memberId, 50);

      const result = await wixData.query(COLLECTION)
        .eq('memberId', cleanId)
        .descending('createdDate')
        .find();

      const credits = result.items.map(credit => {
        let transactions = [];
        try { transactions = JSON.parse(credit.transactions || '[]'); } catch (_) { /* empty */ }

        return {
          _id: credit._id,
          memberId: credit.memberId,
          balance: credit.balance,
          initialAmount: credit.initialAmount,
          reason: credit.reason,
          orderReference: credit.orderReference,
          status: credit.status,
          createdDate: credit.createdDate,
          expirationDate: credit.expirationDate,
          transactions,
        };
      });

      return { success: true, credits };
    } catch (err) {
      console.error('[storeCreditService] Error getting credit history:', err);
      return { success: false, message: 'Failed to retrieve credit history.' };
    }
  }
);

/**
 * Gift store credit from one member to another.
 * Deducts from giver's balance and creates new credit for recipient.
 *
 * @function giftStoreCredit
 * @param {Object} data
 * @param {string} data.fromMemberId - Giver's member ID
 * @param {string} data.toMemberId - Recipient's member ID
 * @param {number} data.amount - Amount to gift
 * @param {string} [data.message] - Personal message
 * @returns {Promise<{success: boolean, giftedAmount?: number, newCreditId?: string}>}
 * @permission SiteMember
 */
export const giftStoreCredit = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Gift data is required.' };
      }

      const fromId = sanitize(data.fromMemberId || '', 50);
      const toId = sanitize(data.toMemberId || '', 50);

      if (!fromId) {
        return { success: false, message: 'Giver member ID is required.' };
      }
      if (!toId) {
        return { success: false, message: 'Recipient member ID is required.' };
      }
      if (fromId === toId) {
        return { success: false, message: 'You cannot gift store credit to yourself.' };
      }

      const amount = Number(data.amount);
      if (!isFinite(amount) || amount <= 0) {
        return { success: false, message: 'A positive gift amount is required.' };
      }

      const giftAmount = round2(amount);
      const now = new Date();

      // Get giver's active credits, expiring soonest first
      const giverCredits = await wixData.query(COLLECTION)
        .eq('memberId', fromId)
        .eq('status', 'active')
        .ascending('expirationDate')
        .find();

      // Calculate total available balance
      let availableBalance = 0;
      for (const c of giverCredits.items) {
        if (c.expirationDate && new Date(c.expirationDate) < now) continue;
        availableBalance = round2(availableBalance + c.balance);
      }

      if (availableBalance < giftAmount) {
        return { success: false, message: `Insufficient store credit balance. Available: $${availableBalance.toFixed(2)}` };
      }

      // Deduct from giver's credits (soonest expiring first)
      let remaining = giftAmount;
      for (const credit of giverCredits.items) {
        if (remaining <= 0) break;
        if (credit.expirationDate && new Date(credit.expirationDate) < now) continue;
        if (credit.balance <= 0) continue;

        const deduction = round2(Math.min(remaining, credit.balance));
        const newBalance = round2(credit.balance - deduction);

        let transactions = [];
        try { transactions = JSON.parse(credit.transactions || '[]'); } catch (_) { /* empty */ }
        transactions.push({
          type: 'gift_sent',
          amount: deduction,
          date: now.toISOString(),
          toMemberId: toId,
        });

        await wixData.update(COLLECTION, {
          ...credit,
          balance: newBalance,
          status: newBalance <= 0 ? 'used' : 'active',
          lastUsedDate: now,
          transactions: JSON.stringify(transactions),
        });

        remaining = round2(remaining - deduction);
      }

      // Create new credit for recipient
      const expirationDate = new Date(Date.now() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
      const newCredit = await wixData.insert(COLLECTION, {
        memberId: toId,
        balance: giftAmount,
        initialAmount: giftAmount,
        reason: 'gift_received',
        orderReference: '',
        status: 'active',
        createdDate: now,
        expirationDate,
        lastUsedDate: null,
        transactions: JSON.stringify([{
          type: 'gift_received',
          amount: giftAmount,
          date: now.toISOString(),
          fromMemberId: fromId,
        }]),
        giftMessage: sanitize(data.message || '', 500),
      });

      return {
        success: true,
        giftedAmount: giftAmount,
        newCreditId: newCredit._id,
      };
    } catch (err) {
      console.error('[storeCreditService] Error gifting store credit:', err);
      return { success: false, message: 'Failed to gift store credit.' };
    }
  }
);

/**
 * Get credits expiring within a given number of days.
 *
 * @function getExpiringCredits
 * @param {string} memberId - Member ID
 * @param {number} [withinDays=30] - Look-ahead window in days
 * @returns {Promise<{success: boolean, expiringCredits?: Array, expiringTotal?: number}>}
 * @permission SiteMember
 */
export const getExpiringCredits = webMethod(
  Permissions.SiteMember,
  async (memberId, withinDays = 30) => {
    try {
      if (!memberId || typeof memberId !== 'string' || !memberId.trim()) {
        return { success: false, message: 'Member ID is required.' };
      }

      const cleanId = sanitize(memberId, 50);
      const days = Math.max(1, Math.min(365, Math.round(Number(withinDays) || 30)));
      const now = new Date();
      const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const result = await wixData.query(COLLECTION)
        .eq('memberId', cleanId)
        .eq('status', 'active')
        .ascending('expirationDate')
        .find();

      const expiring = [];
      let expiringTotal = 0;

      for (const credit of result.items) {
        if (!credit.expirationDate) continue;
        const expDate = new Date(credit.expirationDate);
        if (expDate < now) continue; // already expired
        if (expDate <= cutoff && credit.balance > 0) {
          expiring.push(credit);
          expiringTotal = round2(expiringTotal + credit.balance);
        }
      }

      return {
        success: true,
        expiringCredits: expiring,
        expiringTotal,
      };
    } catch (err) {
      console.error('[storeCreditService] Error getting expiring credits:', err);
      return { success: false, message: 'Failed to retrieve expiring credits.' };
    }
  }
);

// ── Internal helpers ────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}
