/**
 * @module tradeProgram
 * @description Trade/commercial program backend for Carolina Futons.
 * Provides bulk pricing tiers, net-30 invoicing, trade account management,
 * and tax-exempt checkout for verified business accounts.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create CMS collections:
 *
 * 1. `TradeAccounts`:
 *    memberId (text, indexed), businessName (text), contactName (text),
 *    contactEmail (text, indexed), phone (text), taxId (text),
 *    taxExemptVerified (boolean), taxExemptCertUrl (text),
 *    status (text: pending|approved|rejected|suspended),
 *    tier (text: bronze|silver|gold|platinum),
 *    accountManagerName (text), accountManagerEmail (text),
 *    creditLimit (number), paymentTerms (number, default 30),
 *    rejectionReason (text), approvedAt (dateTime), _createdDate (dateTime)
 *
 * 2. `TradeInvoices`:
 *    tradeAccountId (text, indexed), orderId (text), invoiceNumber (text),
 *    subtotal (number), tax (number), total (number),
 *    dueDate (dateTime), status (text: pending|paid|overdue|void),
 *    issuedAt (dateTime), paidAt (dateTime)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const TRADE_TIERS = {
  bronze:   { discount: 10, minUnits: 10,  description: '10-24 units/year — 10% off, net-30 terms' },
  silver:   { discount: 15, minUnits: 25,  description: '25-99 units/year — 15% off, net-30, priority support' },
  gold:     { discount: 20, minUnits: 100, description: '100-249 units/year — 20% off, net-30, dedicated account manager' },
  platinum: { discount: 25, minUnits: 250, description: '250+ units/year — 25% off, net-30, free white-glove delivery' },
};

const VALID_TIERS = Object.keys(TRADE_TIERS);
const VALID_INVOICE_STATUSES = ['pending', 'paid', 'overdue', 'void'];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_QUANTITY = 9999;
const DEFAULT_PAYMENT_TERMS = 30;

// ── Helpers ──────────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function getMember() {
  try {
    return await currentMember.getMember();
  } catch {
    return null;
  }
}

async function getTradeAccountByMemberId(memberId) {
  const result = await wixData.query('TradeAccounts')
    .eq('memberId', memberId)
    .limit(1)
    .find();
  return result.items?.[0] || null;
}

async function getTradeAccountByEmail(email) {
  const result = await wixData.query('TradeAccounts')
    .eq('contactEmail', email)
    .limit(1)
    .find();
  return result.items?.[0] || null;
}

function generateInvoiceNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CF-INV-${ts}-${rand}`;
}

// ── Public API (Anyone) ──────────────────────────────────────────────

/**
 * Submit a trade account application.
 * @param {Object} application
 * @param {string} application.businessName
 * @param {string} application.contactName
 * @param {string} application.contactEmail
 * @param {string} [application.phone]
 * @param {string} [application.taxId]
 * @param {string} [application.businessType]
 * @param {number} [application.estimatedAnnualUnits]
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const applyForTradeAccount = webMethod(
  Permissions.Anyone,
  async (application) => {
    try {
      if (!application) return { success: false, error: 'Application data required' };

      const businessName = sanitize(application.businessName || '', 200);
      const contactName = sanitize(application.contactName || '', 200);
      const contactEmail = sanitize(application.contactEmail || '', 254).toLowerCase();
      const phone = sanitize(application.phone || '', 20);
      const taxId = sanitize(application.taxId || '', 20);
      const businessType = sanitize(application.businessType || '', 100);
      const estimatedAnnualUnits = Math.max(0, Math.min(99999, Math.round(Number(application.estimatedAnnualUnits) || 0)));

      if (!businessName) return { success: false, error: 'Business name is required' };
      if (!contactName) return { success: false, error: 'Contact name is required' };
      if (!contactEmail || !validateEmail(contactEmail)) return { success: false, error: 'Valid email is required' };

      // Check for existing application
      const existing = await getTradeAccountByEmail(contactEmail);
      if (existing) {
        return { success: false, error: 'An application already exists for this email' };
      }

      await wixData.insert('TradeAccounts', {
        businessName,
        contactName,
        contactEmail,
        phone,
        taxId,
        businessType,
        estimatedAnnualUnits,
        taxExemptVerified: false,
        status: 'pending',
        tier: 'bronze',
        creditLimit: 0,
        paymentTerms: DEFAULT_PAYMENT_TERMS,
        _createdDate: new Date().toISOString(),
      });

      return { success: true, message: 'Application submitted. We will review within 2-3 business days.' };
    } catch (err) {
      console.error('applyForTradeAccount error:', err);
      return { success: false, error: 'Failed to submit application. Please try again.' };
    }
  }
);

/**
 * Check trade account application status by email.
 * @param {string} email
 * @returns {Promise<{success: boolean, status?: string, error?: string}>}
 */
export const getTradeAccountStatus = webMethod(
  Permissions.Anyone,
  async (email) => {
    try {
      if (!email) return { success: false, error: 'Email is required' };
      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) return { success: false, error: 'Valid email is required' };

      const account = await getTradeAccountByEmail(cleanEmail);
      if (!account) return { success: false, error: 'Application not found' };

      return {
        success: true,
        status: account.status,
        tier: account.status === 'approved' ? account.tier : null,
        businessName: account.businessName,
      };
    } catch (err) {
      console.error('getTradeAccountStatus error:', err);
      return { success: false, error: 'Failed to check status' };
    }
  }
);

/**
 * Get all trade pricing tiers (informational).
 * @returns {Promise<{success: boolean, tiers: Array}>}
 */
export const getTradePricingTiers = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const tiers = VALID_TIERS.map(name => ({
        name,
        discount: TRADE_TIERS[name].discount,
        minUnits: TRADE_TIERS[name].minUnits,
        description: TRADE_TIERS[name].description,
      }));
      return { success: true, tiers };
    } catch (err) {
      console.error('getTradePricingTiers error:', err);
      return { success: false, tiers: [] };
    }
  }
);

// ── SiteMember API ───────────────────────────────────────────────────

/**
 * Get the current member's trade account details.
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export const getMyTradeAccount = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await getMember();
      if (!member) return { success: false, error: 'Not authenticated' };

      const account = await getTradeAccountByMemberId(member._id);
      if (!account) return { success: false, error: 'No trade account found' };

      return {
        success: true,
        account: {
          businessName: account.businessName,
          contactName: account.contactName,
          contactEmail: account.contactEmail,
          phone: account.phone,
          status: account.status,
          tier: account.tier,
          tierDiscount: TRADE_TIERS[account.tier]?.discount || 0,
          tierDescription: TRADE_TIERS[account.tier]?.description || '',
          accountManagerName: account.accountManagerName || null,
          accountManagerEmail: account.accountManagerEmail || null,
          creditLimit: account.creditLimit,
          paymentTerms: account.paymentTerms,
          taxExemptVerified: account.taxExemptVerified,
          approvedAt: account.approvedAt,
        },
      };
    } catch (err) {
      console.error('getMyTradeAccount error:', err);
      return { success: false, error: 'Failed to load trade account' };
    }
  }
);

/**
 * Calculate trade pricing for a product.
 * @param {number} unitPrice - Product price
 * @param {number} quantity - Number of units
 * @returns {Promise<{success: boolean, originalPrice?: number, discountPercent?: number, discountedPrice?: number, lineTotal?: number}>}
 */
export const getMyTradePricing = webMethod(
  Permissions.SiteMember,
  async (unitPrice, quantity) => {
    try {
      const member = await getMember();
      if (!member) return { success: false, error: 'Not authenticated' };

      const price = Number(unitPrice);
      let qty = Math.round(Number(quantity));

      if (!isFinite(price) || price <= 0) return { success: false, error: 'Valid price required' };
      if (!isFinite(qty) || qty <= 0) return { success: false, error: 'Valid quantity required' };
      qty = Math.min(qty, MAX_QUANTITY);

      const account = await getTradeAccountByMemberId(member._id);
      if (!account || account.status !== 'approved') {
        return { success: false, error: 'Trade account not approved' };
      }

      const discountPercent = TRADE_TIERS[account.tier]?.discount || 0;
      const discountedPrice = round2(price * (1 - discountPercent / 100));
      const lineTotal = round2(discountedPrice * qty);

      return {
        success: true,
        originalPrice: price,
        quantity: qty,
        discountPercent,
        discountedPrice,
        lineTotal,
        tier: account.tier,
      };
    } catch (err) {
      console.error('getMyTradePricing error:', err);
      return { success: false, error: 'Failed to calculate pricing' };
    }
  }
);

/**
 * Get paginated invoices for the current trade member.
 * @param {Object} [options]
 * @param {number} [options.pageSize=20]
 * @param {number} [options.skip=0]
 * @returns {Promise<{success: boolean, invoices?: Array, totalCount?: number}>}
 */
export const getMyTradeInvoices = webMethod(
  Permissions.SiteMember,
  async (options = {}) => {
    try {
      const member = await getMember();
      if (!member) return { success: false, error: 'Not authenticated' };

      const account = await getTradeAccountByMemberId(member._id);
      if (!account) return { success: false, error: 'No trade account found' };

      const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(options.pageSize) || DEFAULT_PAGE_SIZE));
      const skip = Math.max(0, Number(options.skip) || 0);

      const result = await wixData.query('TradeInvoices')
        .eq('tradeAccountId', account._id)
        .descending('issuedAt')
        .limit(pageSize)
        .skip(skip)
        .find();

      return {
        success: true,
        invoices: result.items || [],
        totalCount: result.totalCount || 0,
      };
    } catch (err) {
      console.error('getMyTradeInvoices error:', err);
      return { success: false, error: 'Failed to load invoices' };
    }
  }
);

/**
 * Check if the current member has verified tax-exempt status.
 * @returns {Promise<{success: boolean, taxExempt: boolean}>}
 */
export const checkTaxExemptStatus = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await getMember();
      if (!member) return { success: false, error: 'Not authenticated' };

      const account = await getTradeAccountByMemberId(member._id);
      return { success: true, taxExempt: account?.taxExemptVerified === true };
    } catch (err) {
      console.error('checkTaxExemptStatus error:', err);
      return { success: false, error: 'Failed to check tax-exempt status' };
    }
  }
);

/**
 * Submit a tax-exempt certificate for review.
 * @param {Object} params
 * @param {string} params.certUrl - URL to uploaded certificate file
 * @param {string} [params.taxId] - Tax ID number
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const submitTaxExemptCert = webMethod(
  Permissions.SiteMember,
  async (params) => {
    try {
      if (!params) return { success: false, error: 'Certificate data required' };

      const member = await getMember();
      if (!member) return { success: false, error: 'Not authenticated' };

      const certUrl = sanitize(params.certUrl || '', 500);
      if (!certUrl) return { success: false, error: 'Certificate URL is required' };

      const account = await getTradeAccountByMemberId(member._id);
      if (!account) return { success: false, error: 'No trade account found' };

      const taxId = params.taxId ? sanitize(params.taxId, 20) : account.taxId;

      await wixData.update('TradeAccounts', {
        ...account,
        taxExemptCertUrl: certUrl,
        taxId,
      });

      return { success: true, message: 'Certificate submitted for review' };
    } catch (err) {
      console.error('submitTaxExemptCert error:', err);
      return { success: false, error: 'Failed to submit certificate' };
    }
  }
);

// ── Admin API ────────────────────────────────────────────────────────

/**
 * Approve a trade account application.
 * @param {string} memberId
 * @param {Object} [options]
 * @param {string} [options.tier='bronze']
 * @param {number} [options.creditLimit=50000]
 * @param {string} [options.accountManagerName]
 * @param {string} [options.accountManagerEmail]
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const approveTradeAccount = webMethod(
  Permissions.Admin,
  async (memberId, options = {}) => {
    try {
      if (!memberId) return { success: false, error: 'Member ID is required' };

      const cleanId = sanitize(memberId, 50);
      const account = await getTradeAccountByMemberId(cleanId);
      if (!account) return { success: false, error: 'Trade account not found' };

      const tier = (options.tier || 'bronze').toLowerCase();
      if (!VALID_TIERS.includes(tier)) {
        return { success: false, error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` };
      }

      await wixData.update('TradeAccounts', {
        ...account,
        status: 'approved',
        tier,
        creditLimit: Number(options.creditLimit) || 50000,
        accountManagerName: options.accountManagerName ? sanitize(options.accountManagerName, 200) : account.accountManagerName,
        accountManagerEmail: options.accountManagerEmail ? sanitize(options.accountManagerEmail, 254) : account.accountManagerEmail,
        approvedAt: new Date().toISOString(),
      });

      return { success: true, message: `Account approved at ${tier} tier` };
    } catch (err) {
      console.error('approveTradeAccount error:', err);
      return { success: false, error: 'Failed to approve account' };
    }
  }
);

/**
 * Reject a trade account application.
 * @param {string} memberId
 * @param {string} reason
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const rejectTradeAccount = webMethod(
  Permissions.Admin,
  async (memberId, reason) => {
    try {
      if (!memberId) return { success: false, error: 'Member ID is required' };

      const cleanId = sanitize(memberId, 50);
      const account = await getTradeAccountByMemberId(cleanId);
      if (!account) return { success: false, error: 'Trade account not found' };

      await wixData.update('TradeAccounts', {
        ...account,
        status: 'rejected',
        rejectionReason: sanitize(reason || '', 500),
      });

      return { success: true, message: 'Account rejected' };
    } catch (err) {
      console.error('rejectTradeAccount error:', err);
      return { success: false, error: 'Failed to reject account' };
    }
  }
);

/**
 * Create a net-30 invoice for a trade order.
 * @param {Object} params
 * @param {string} params.tradeAccountId
 * @param {string} params.orderId
 * @param {number} params.subtotal
 * @param {number} [params.tax=0]
 * @returns {Promise<{success: boolean, invoiceNumber?: string, error?: string}>}
 */
export const createTradeInvoice = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      if (!params) return { success: false, error: 'Invoice data required' };

      const tradeAccountId = sanitize(params.tradeAccountId || '', 50);
      const orderId = sanitize(params.orderId || '', 50);
      const subtotal = Number(params.subtotal);
      const tax = Number(params.tax) || 0;

      if (!tradeAccountId) return { success: false, error: 'Trade account ID is required' };
      if (!orderId) return { success: false, error: 'Order ID is required' };
      if (!isFinite(subtotal) || subtotal <= 0) return { success: false, error: 'Valid subtotal required' };

      // Verify account exists and is approved
      const account = await wixData.get('TradeAccounts', tradeAccountId);
      if (!account) return { success: false, error: 'Trade account not found' };
      if (account.status !== 'approved') return { success: false, error: 'Trade account not approved' };

      const total = round2(subtotal + tax);

      // Check credit limit
      if (account.creditLimit > 0 && total > account.creditLimit) {
        return { success: false, error: `Invoice total ($${total}) exceeds credit limit ($${account.creditLimit})` };
      }

      const paymentTerms = account.paymentTerms || DEFAULT_PAYMENT_TERMS;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentTerms);

      const invoiceNumber = generateInvoiceNumber();

      await wixData.insert('TradeInvoices', {
        tradeAccountId,
        orderId,
        invoiceNumber,
        subtotal: round2(subtotal),
        tax: round2(tax),
        total,
        dueDate: dueDate.toISOString(),
        status: 'pending',
        issuedAt: new Date().toISOString(),
        paidAt: null,
      });

      return { success: true, invoiceNumber, dueDate: dueDate.toISOString(), total };
    } catch (err) {
      console.error('createTradeInvoice error:', err);
      return { success: false, error: 'Failed to create invoice' };
    }
  }
);

/**
 * Update an invoice status.
 * @param {string} invoiceId
 * @param {string} status - pending|paid|overdue|void
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateInvoiceStatus = webMethod(
  Permissions.Admin,
  async (invoiceId, status) => {
    try {
      if (!invoiceId) return { success: false, error: 'Invoice ID is required' };
      if (!VALID_INVOICE_STATUSES.includes(status)) {
        return { success: false, error: `Invalid status. Must be one of: ${VALID_INVOICE_STATUSES.join(', ')}` };
      }

      const cleanId = sanitize(invoiceId, 50);
      const invoice = await wixData.get('TradeInvoices', cleanId);
      if (!invoice) return { success: false, error: 'Invoice not found' };

      const updates = { ...invoice, status };
      if (status === 'paid') {
        updates.paidAt = new Date().toISOString();
      }

      await wixData.update('TradeInvoices', updates);
      return { success: true, message: `Invoice marked as ${status}` };
    } catch (err) {
      console.error('updateInvoiceStatus error:', err);
      return { success: false, error: 'Failed to update invoice' };
    }
  }
);

/**
 * Verify or revoke tax-exempt status for a trade account.
 * @param {string} memberId
 * @param {boolean} verified
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const verifyTaxExempt = webMethod(
  Permissions.Admin,
  async (memberId, verified) => {
    try {
      if (!memberId) return { success: false, error: 'Member ID is required' };

      const cleanId = sanitize(memberId, 50);
      const account = await getTradeAccountByMemberId(cleanId);
      if (!account) return { success: false, error: 'Trade account not found' };

      await wixData.update('TradeAccounts', {
        ...account,
        taxExemptVerified: Boolean(verified),
      });

      return { success: true, message: verified ? 'Tax-exempt status verified' : 'Tax-exempt status revoked' };
    } catch (err) {
      console.error('verifyTaxExempt error:', err);
      return { success: false, error: 'Failed to update tax-exempt status' };
    }
  }
);
