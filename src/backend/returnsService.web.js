/**
 * @module returnsService
 * @description Backend web module for self-service returns and exchanges.
 * Members can request returns on eligible orders, track RMA status,
 * and receive email notifications at each stage.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection "Returns" in Wix Dashboard with fields:
 * - orderId (Text) - Reference to Stores/Orders
 * - orderNumber (Text) - Display order number
 * - memberId (Text) - Reference to Members
 * - memberEmail (Text) - For notifications
 * - memberName (Text) - Display name
 * - items (Text/JSON) - Stringified array of returned items
 * - reason (Text) - Return reason category
 * - details (Text) - Customer explanation
 * - type (Text) - "return" | "exchange"
 * - status (Text) - "requested" | "approved" | "shipped" | "received" | "refunded" | "denied"
 * - rmaNumber (Text) - Generated RMA number
 * - adminNotes (Text) - Internal notes
 * - _createdDate (DateTime) - Auto
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

const COLLECTION = 'Returns';
const RETURN_WINDOW_DAYS = 30;
const MAX_DETAILS_LEN = 2000;

const VALID_REASONS = [
  'wrong_size',
  'wrong_color',
  'defective',
  'damaged_in_shipping',
  'not_as_described',
  'changed_mind',
  'found_better_price',
  'other',
];

const REASON_LABELS = {
  wrong_size: 'Wrong size',
  wrong_color: 'Wrong color/finish',
  defective: 'Product defect',
  damaged_in_shipping: 'Damaged in shipping',
  not_as_described: 'Not as described',
  changed_mind: 'Changed my mind',
  found_better_price: 'Found a better price',
  other: 'Other',
};

// ─── Public Methods ─────────────────────────────────────────────────

/**
 * Get orders eligible for return by the current member.
 * Returns orders within the return window that haven't been fully returned.
 *
 * @returns {Promise<{orders: Array, error?: string}>}
 */
export const getReturnEligibleOrders = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { orders: [] };

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETURN_WINDOW_DAYS);

      const result = await wixData.query('Stores/Orders')
        .eq('buyerInfo.id', member._id)
        .ge('_createdDate', cutoffDate)
        .eq('paymentStatus', 'PAID')
        .descending('_createdDate')
        .limit(50)
        .find();

      // Filter out orders that already have a return request
      const existingReturns = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .find();

      const returnedOrderIds = new Set(existingReturns.items.map(r => r.orderId));

      const orders = result.items
        .filter(order => !returnedOrderIds.has(order._id))
        .map(formatOrderForReturn);

      return { orders };
    } catch (err) {
      console.error('[returnsService] getReturnEligibleOrders error:', err);
      return { orders: [], error: 'Unable to load orders.' };
    }
  }
);

/**
 * Submit a return or exchange request.
 *
 * @param {Object} data
 * @param {string} data.orderId - Order to return
 * @param {Array<{lineItemId: string, quantity: number}>} data.items - Items to return
 * @param {string} data.reason - Reason category
 * @param {string} [data.details] - Additional explanation
 * @param {string} [data.type="return"] - "return" or "exchange"
 * @returns {Promise<{success: boolean, rmaNumber?: string, error?: string}>}
 */
export const submitReturnRequest = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Please log in.' };

      const orderId = validateId(data.orderId);
      if (!orderId) return { success: false, error: 'Invalid order.' };

      // Validate reason
      const reason = data.reason;
      if (!VALID_REASONS.includes(reason)) {
        return { success: false, error: 'Please select a valid return reason.' };
      }

      // Validate items
      if (!Array.isArray(data.items) || data.items.length === 0) {
        return { success: false, error: 'Please select at least one item to return.' };
      }

      // Verify order exists and belongs to member
      const order = await wixData.get('Stores/Orders', orderId);
      if (!order || order.buyerInfo?.id !== member._id) {
        return { success: false, error: 'Order not found.' };
      }

      // Check return window
      const orderDate = new Date(order._createdDate);
      const daysSinceOrder = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceOrder > RETURN_WINDOW_DAYS) {
        return { success: false, error: `Returns must be initiated within ${RETURN_WINDOW_DAYS} days of purchase.` };
      }

      // Check for duplicate return
      const existing = await wixData.query(COLLECTION)
        .eq('orderId', orderId)
        .eq('memberId', member._id)
        .find();

      if (existing.items.length > 0) {
        return { success: false, error: 'A return request already exists for this order.' };
      }

      // Validate return items against order line items
      const orderLineIds = new Set((order.lineItems || []).map(li => li._id || li.productId));
      const validItems = data.items.filter(item => {
        const id = validateId(item.lineItemId);
        return id && orderLineIds.has(id) && item.quantity > 0;
      });

      if (validItems.length === 0) {
        return { success: false, error: 'No valid items selected for return.' };
      }

      const returnType = data.type === 'exchange' ? 'exchange' : 'return';
      const details = sanitize(data.details || '', MAX_DETAILS_LEN);
      const rmaNumber = generateRmaNumber();
      const memberName = buildMemberName(member);

      const record = {
        orderId,
        orderNumber: String(order.number || ''),
        memberId: member._id,
        memberEmail: member.loginEmail || '',
        memberName,
        items: JSON.stringify(validItems.map(item => ({
          lineItemId: validateId(item.lineItemId),
          quantity: Math.max(1, Math.floor(Number(item.quantity))),
        }))),
        reason,
        reasonLabel: REASON_LABELS[reason] || reason,
        details,
        type: returnType,
        status: 'requested',
        rmaNumber,
        adminNotes: '',
      };

      await wixData.insert(COLLECTION, record);
      return { success: true, rmaNumber };
    } catch (err) {
      console.error('[returnsService] submitReturnRequest error:', err);
      return { success: false, error: 'Unable to submit return request. Please try again.' };
    }
  }
);

/**
 * Get return requests for the current member.
 *
 * @returns {Promise<{returns: Array}>}
 */
export const getMyReturns = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { returns: [] };

      const result = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .descending('_createdDate')
        .limit(50)
        .find();

      return {
        returns: result.items.map(formatReturn),
      };
    } catch (err) {
      console.error('[returnsService] getMyReturns error:', err);
      return { returns: [] };
    }
  }
);

/**
 * Get a specific return by RMA number (member must own it).
 *
 * @param {string} rmaNumber
 * @returns {Promise<{returnRequest: Object|null}>}
 */
export const getReturnByRma = webMethod(
  Permissions.SiteMember,
  async (rmaNumber) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { returnRequest: null };

      const rma = sanitize(rmaNumber, 20);
      if (!rma) return { returnRequest: null };

      const result = await wixData.query(COLLECTION)
        .eq('rmaNumber', rma)
        .eq('memberId', member._id)
        .find();

      if (result.items.length === 0) return { returnRequest: null };

      return { returnRequest: formatReturn(result.items[0]) };
    } catch (err) {
      console.error('[returnsService] getReturnByRma error:', err);
      return { returnRequest: null };
    }
  }
);

/**
 * Get available return reasons for display.
 *
 * @returns {{reasons: Array<{value: string, label: string}>}}
 */
export const getReturnReasons = webMethod(
  Permissions.Anyone,
  () => {
    return {
      reasons: VALID_REASONS.map(r => ({ value: r, label: REASON_LABELS[r] })),
    };
  }
);

/**
 * Admin: Update return status.
 *
 * @param {string} returnId
 * @param {string} status
 * @param {string} [notes]
 * @returns {Promise<{success: boolean}>}
 */
export const updateReturnStatus = webMethod(
  Permissions.Admin,
  async (returnId, status, notes) => {
    try {
      const validStatuses = ['requested', 'approved', 'shipped', 'received', 'refunded', 'denied'];
      if (!validStatuses.includes(status)) return { success: false };

      const rid = validateId(returnId);
      if (!rid) return { success: false };

      const record = await wixData.get(COLLECTION, rid);
      if (!record) return { success: false };

      record.status = status;
      if (notes) record.adminNotes = sanitize(notes, 2000);

      await wixData.update(COLLECTION, record);
      return { success: true };
    } catch (err) {
      console.error('[returnsService] updateReturnStatus error:', err);
      return { success: false };
    }
  }
);

// ─── Internal Helpers ───────────────────────────────────────────────

function generateRmaNumber() {
  const prefix = 'RMA';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function buildMemberName(member) {
  const first = member.contactDetails?.firstName || '';
  const last = member.contactDetails?.lastName || '';
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  return 'Customer';
}

function formatOrderForReturn(order) {
  return {
    _id: order._id,
    number: order.number,
    date: order._createdDate
      ? new Date(order._createdDate).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : '',
    total: order.totals?.total || 0,
    lineItems: (order.lineItems || []).map(item => ({
      _id: item._id || item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      sku: item.sku || '',
      image: item.mediaItem?.src || '',
    })),
  };
}

function formatReturn(record) {
  let items = [];
  try { items = JSON.parse(record.items || '[]'); } catch (e) {}

  return {
    _id: record._id,
    rmaNumber: record.rmaNumber,
    orderNumber: record.orderNumber,
    type: record.type,
    reason: record.reasonLabel || record.reason,
    details: record.details || '',
    status: record.status,
    items,
    date: record._createdDate
      ? new Date(record._createdDate).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : '',
  };
}
