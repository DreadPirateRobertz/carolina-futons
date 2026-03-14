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
import { sanitize, validateId, validateEmail } from 'backend/utils/sanitize';
import { safeParse } from 'backend/utils/safeParse';
import { createShipment, trackShipment } from 'backend/ups-shipping.web';

const COLLECTION = 'Returns';
const RETURN_WINDOW_DAYS = 30;
const MAX_DETAILS_LEN = 2000;

// ── Rate Limiting ────────────────────────────────────────────────────
// Sliding window: max 5 attempts per email per 60 seconds.
// Prevents order enumeration via brute-force lookupReturn/submitGuestReturn.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const _rateLimitMap = new Map();

function _checkRateLimit(identifier) {
  const now = Date.now();
  const key = identifier || 'unknown';
  let entry = _rateLimitMap.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    _rateLimitMap.set(key, entry);
  }
  // Evict expired timestamps
  entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (entry.timestamps.length >= RATE_LIMIT_MAX) {
    return false; // rate limited
  }
  entry.timestamps.push(now);
  // Periodic cleanup: remove stale entries when map exceeds 1000 keys
  if (_rateLimitMap.size > 1000) {
    for (const [k, v] of _rateLimitMap) {
      if (v.timestamps.length === 0 || now - v.timestamps[v.timestamps.length - 1] > RATE_LIMIT_WINDOW_MS) {
        _rateLimitMap.delete(k);
      }
    }
  }
  return true; // allowed
}

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
      const orderLineMap = new Map(
        (order.lineItems || []).map(li => [li._id || li.productId, li.quantity || 0])
      );
      const validItems = data.items.filter(item => {
        const id = validateId(item.lineItemId);
        return id && orderLineMap.has(id) && item.quantity > 0;
      });

      if (validItems.length === 0) {
        return { success: false, error: 'No valid items selected for return.' };
      }

      // Validate return quantity does not exceed ordered quantity
      for (const item of validItems) {
        const orderedQty = orderLineMap.get(validateId(item.lineItemId)) || 0;
        const requestedQty = Math.max(1, Math.floor(Number(item.quantity)));
        if (requestedQty > orderedQty) {
          return { success: false, error: `Return quantity exceeds ordered quantity for item ${validateId(item.lineItemId)}.` };
        }
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
          quantity: Math.min(
            Math.max(1, Math.floor(Number(item.quantity))),
            orderLineMap.get(validateId(item.lineItemId)) || 0
          ),
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

// ─── Guest Return Lookup ────────────────────────────────────────────

/**
 * Look up a return by order number + email (no login required).
 * Customers can check return status without creating an account.
 *
 * @param {string} orderNumber - Order number
 * @param {string} email - Email used for the order
 * @returns {Promise<{success: boolean, returns?: Array, error?: string}>}
 */
export const lookupReturn = webMethod(
  Permissions.Anyone,
  async (orderNumber, email) => {
    try {
      const cleanOrderNumber = sanitize(orderNumber, 50).replace(/[^a-zA-Z0-9-]/g, '');
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanOrderNumber) {
        return { success: false, error: 'Order number is required.' };
      }
      if (!cleanEmail || !validateEmail(cleanEmail)) {
        return { success: false, error: 'A valid email address is required.' };
      }

      // Rate limit by email to prevent order enumeration
      if (!_checkRateLimit(cleanEmail)) {
        return { success: false, error: 'Too many attempts. Please try again in a minute.' };
      }

      // Find the order and verify email
      const orderResult = await wixData.query('Stores/Orders')
        .eq('number', cleanOrderNumber)
        .find();

      if (orderResult.items.length === 0) {
        // Use same message for not-found and email-mismatch to prevent order enumeration
        return { success: false, error: 'Order not found. Please check your order number and email.' };
      }

      const order = orderResult.items[0];
      const buyerEmail = (order.buyerInfo?.email || '').toLowerCase();
      if (buyerEmail !== cleanEmail) {
        return { success: false, error: 'Order not found. Please check your order number and email.' };
      }

      // Find return requests for this order
      const returnResult = await wixData.query(COLLECTION)
        .eq('orderId', order._id)
        .descending('_createdDate')
        .find();

      if (returnResult.items.length === 0) {
        return { success: true, returns: [], order: formatOrderForReturn(order) };
      }

      return {
        success: true,
        returns: returnResult.items.map(formatReturn),
        order: formatOrderForReturn(order),
      };
    } catch (err) {
      console.error('[returnsService] lookupReturn error:', err);
      return { success: false, error: 'Unable to look up return status. Please try again.' };
    }
  }
);

/**
 * Submit a return request as a guest (by order number + email).
 *
 * @param {Object} data
 * @param {string} data.orderNumber - Order number
 * @param {string} data.email - Email address on the order
 * @param {Array<{lineItemId: string, quantity: number}>} data.items - Items to return
 * @param {string} data.reason - Reason category
 * @param {string} [data.details] - Additional explanation
 * @param {string} [data.type="return"] - "return" or "exchange"
 * @returns {Promise<{success: boolean, rmaNumber?: string, error?: string}>}
 */
export const submitGuestReturn = webMethod(
  Permissions.Anyone,
  async (data) => {
    try {
      const cleanOrderNumber = sanitize(data.orderNumber, 50).replace(/[^a-zA-Z0-9-]/g, '');
      const cleanEmail = (data.email || '').trim().toLowerCase();

      if (!cleanOrderNumber) {
        return { success: false, error: 'Order number is required.' };
      }
      if (!cleanEmail || !validateEmail(cleanEmail)) {
        return { success: false, error: 'A valid email address is required.' };
      }

      // Rate limit by email to prevent order enumeration
      if (!_checkRateLimit(cleanEmail)) {
        return { success: false, error: 'Too many attempts. Please try again in a minute.' };
      }

      // Validate reason
      if (!VALID_REASONS.includes(data.reason)) {
        return { success: false, error: 'Please select a valid return reason.' };
      }

      // Validate items
      if (!Array.isArray(data.items) || data.items.length === 0) {
        return { success: false, error: 'Please select at least one item to return.' };
      }

      // Find and verify the order
      const orderResult = await wixData.query('Stores/Orders')
        .eq('number', cleanOrderNumber)
        .find();

      if (orderResult.items.length === 0) {
        return { success: false, error: 'Order not found.' };
      }

      const order = orderResult.items[0];
      const buyerEmail = (order.buyerInfo?.email || '').toLowerCase();
      if (buyerEmail !== cleanEmail) {
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
        .eq('orderId', order._id)
        .find();

      if (existing.items.length > 0) {
        return { success: false, error: 'A return request already exists for this order.' };
      }

      // Validate return items against order line items
      const orderLineMap = new Map(
        (order.lineItems || []).map(li => [li._id || li.productId, li.quantity || 0])
      );
      const validItems = data.items.filter(item => {
        const id = validateId(item.lineItemId);
        return id && orderLineMap.has(id) && item.quantity > 0;
      });

      if (validItems.length === 0) {
        return { success: false, error: 'No valid items selected for return.' };
      }

      // Validate return quantity does not exceed ordered quantity
      for (const item of validItems) {
        const orderedQty = orderLineMap.get(validateId(item.lineItemId)) || 0;
        const requestedQty = Math.max(1, Math.floor(Number(item.quantity)));
        if (requestedQty > orderedQty) {
          return { success: false, error: `Return quantity exceeds ordered quantity for item ${validateId(item.lineItemId)}.` };
        }
      }

      const returnType = data.type === 'exchange' ? 'exchange' : 'return';
      const details = sanitize(data.details || '', MAX_DETAILS_LEN);
      const rmaNumber = generateRmaNumber();

      const record = {
        orderId: order._id,
        orderNumber: String(order.number || ''),
        memberId: order.buyerInfo?.id || '',
        memberEmail: cleanEmail,
        memberName: `${order.billingInfo?.firstName || ''} ${order.billingInfo?.lastName || ''}`.trim() || 'Customer',
        items: JSON.stringify(validItems.map(item => ({
          lineItemId: validateId(item.lineItemId),
          quantity: Math.min(
            Math.max(1, Math.floor(Number(item.quantity))),
            orderLineMap.get(validateId(item.lineItemId)) || 0
          ),
        }))),
        reason: data.reason,
        reasonLabel: REASON_LABELS[data.reason] || data.reason,
        details,
        type: returnType,
        status: 'requested',
        rmaNumber,
        adminNotes: '',
      };

      await wixData.insert(COLLECTION, record);
      return { success: true, rmaNumber };
    } catch (err) {
      console.error('[returnsService] submitGuestReturn error:', err);
      return { success: false, error: 'Unable to submit return request. Please try again.' };
    }
  }
);

// ─── Return Label Generation ────────────────────────────────────────

/**
 * Admin: Generate a UPS return label for an approved return.
 * Creates a shipment with ShipFrom = customer, ShipTo = us.
 *
 * @param {string} returnId - Return record ID
 * @returns {Promise<{success: boolean, trackingNumber?: string, error?: string}>}
 */
export const generateReturnLabel = webMethod(
  Permissions.Admin,
  async (returnId) => {
    try {
      const rid = validateId(returnId);
      if (!rid) return { success: false, error: 'Invalid return ID.' };

      const record = await wixData.get(COLLECTION, rid);
      if (!record) return { success: false, error: 'Return not found.' };

      if (record.status !== 'approved') {
        return { success: false, error: 'Return must be approved before generating a label.' };
      }

      // Get the original order for shipping address
      const order = await wixData.get('Stores/Orders', record.orderId);
      if (!order) return { success: false, error: 'Original order not found.' };

      const shippingAddr = order.shippingInfo?.shipmentDetails?.address || {};
      const billingAddr = order.billingInfo || {};

      const customerName = shippingAddr.fullName || order.billingInfo?.contactDetails?.firstName
        ? `${order.billingInfo.contactDetails.firstName} ${order.billingInfo.contactDetails.lastName || ''}`.trim()
        : 'Customer';

      const shipmentResult = await createShipment({
        orderId: record.orderId,
        returnLabel: true, // Swaps ShipFrom (customer) and ShipTo (store)
        recipientName: customerName,
        recipientPhone: shippingAddr.phone || order.billingInfo?.contactDetails?.phone || '',
        addressLine1: shippingAddr.addressLine1 || shippingAddr.addressLine || billingAddr.address?.addressLine1 || '',
        city: shippingAddr.city || billingAddr.address?.city || '',
        state: shippingAddr.subdivision || billingAddr.address?.subdivision || '',
        postalCode: shippingAddr.postalCode || billingAddr.address?.postalCode || '',
        country: 'US',
        serviceCode: '03', // Ground for returns
        packages: [{
          description: `Return - ${record.rmaNumber}`,
          length: 48,
          width: 30,
          height: 12,
          weight: 50,
        }],
      });

      if (!shipmentResult.success) {
        return { success: false, error: shipmentResult.error || 'Unable to generate return label.' };
      }

      // Update the return record with tracking info
      record.returnTrackingNumber = shipmentResult.trackingNumber;
      record.returnLabelBase64 = shipmentResult.labels?.[0]?.labelBase64 || '';
      record.status = 'approved'; // Keep approved, label now attached
      await wixData.update(COLLECTION, record);

      return {
        success: true,
        trackingNumber: shipmentResult.trackingNumber,
        labelBase64: shipmentResult.labels?.[0]?.labelBase64 || '',
      };
    } catch (err) {
      console.error('[returnsService] generateReturnLabel error:', err);
      return { success: false, error: 'Unable to generate return label.' };
    }
  }
);

// ─── Member Return Label Access ──────────────────────────────────────

/**
 * Get the return shipping label for a member's approved return.
 * Returns label data if the return belongs to the current member,
 * has been approved, and a label has been generated.
 *
 * @param {string} rmaNumber - RMA number
 * @returns {Promise<{success: boolean, trackingNumber?: string, labelBase64?: string, error?: string}>}
 */
export const getMyReturnLabel = webMethod(
  Permissions.SiteMember,
  async (rmaNumber) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Please log in.' };

      const rma = sanitize(rmaNumber, 30);
      if (!rma) return { success: false, error: 'RMA number is required.' };

      const result = await wixData.query(COLLECTION)
        .eq('rmaNumber', rma)
        .eq('memberId', member._id)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Return not found.' };
      }

      const record = result.items[0];

      if (record.status !== 'approved' && record.status !== 'shipped') {
        return { success: false, error: 'Return must be approved before a label is available.' };
      }

      if (!record.returnTrackingNumber || !record.returnLabelBase64) {
        return { success: false, error: 'Return label has not yet been generated. Please check back later.' };
      }

      return {
        success: true,
        trackingNumber: record.returnTrackingNumber,
        labelBase64: record.returnLabelBase64,
        rmaNumber: record.rmaNumber,
      };
    } catch (err) {
      console.error('[returnsService] getMyReturnLabel error:', err);
      return { success: false, error: 'Unable to retrieve return label.' };
    }
  }
);

// ─── Return Shipment Tracking ───────────────────────────────────────

/**
 * Track the return shipment by RMA number.
 * Uses UPS tracking on the return label tracking number.
 *
 * @param {string} rmaNumber - RMA number to track
 * @returns {Promise<{success: boolean, tracking?: Object, error?: string}>}
 */
export const trackReturnShipment = webMethod(
  Permissions.Anyone,
  async (rmaNumber) => {
    try {
      const rma = sanitize(rmaNumber, 30);
      if (!rma) return { success: false, error: 'RMA number is required.' };

      const result = await wixData.query(COLLECTION)
        .eq('rmaNumber', rma)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Return not found.' };
      }

      const record = result.items[0];
      if (!record.returnTrackingNumber) {
        return {
          success: true,
          tracking: null,
          status: record.status,
          message: 'Return label has not been generated yet.',
        };
      }

      const trackingResult = await trackShipment(record.returnTrackingNumber);

      return {
        success: true,
        status: record.status,
        rmaNumber: record.rmaNumber,
        tracking: trackingResult.success ? {
          trackingNumber: record.returnTrackingNumber,
          status: trackingResult.status,
          statusCode: trackingResult.statusCode,
          estimatedDelivery: trackingResult.estimatedDelivery,
          activities: trackingResult.activities || [],
        } : null,
      };
    } catch (err) {
      console.error('[returnsService] trackReturnShipment error:', err);
      return { success: false, error: 'Unable to track return shipment.' };
    }
  }
);

// ─── Admin: Return Management Dashboard ─────────────────────────────

/**
 * Admin: Get all return requests with filters.
 *
 * @param {Object} [filters]
 * @param {string} [filters.status] - Filter by status
 * @param {number} [filters.limit=50] - Max results
 * @returns {Promise<{success: boolean, returns?: Array, total?: number}>}
 */
export const getAdminReturns = webMethod(
  Permissions.Admin,
  async (filters = {}) => {
    try {
      let query = wixData.query(COLLECTION);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const limit = Math.min(Math.max(1, filters.limit || 50), 100);

      const result = await query
        .descending('_createdDate')
        .limit(limit)
        .find();

      return {
        success: true,
        returns: result.items.map(formatAdminReturn),
        total: result.totalCount,
      };
    } catch (err) {
      console.error('[returnsService] getAdminReturns error:', err);
      return { success: false, returns: [], total: 0 };
    }
  }
);

/**
 * Admin: Get return statistics.
 *
 * @returns {Promise<{success: boolean, stats?: Object}>}
 */
export const getReturnStats = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const statuses = ['requested', 'approved', 'shipped', 'received', 'refunded', 'denied'];

      const results = await Promise.all(
        statuses.map(status =>
          wixData.query(COLLECTION).eq('status', status).count()
        )
      );

      const counts = {};
      statuses.forEach((status, i) => { counts[status] = results[i]; });
      const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

      return {
        success: true,
        stats: { ...counts, total },
      };
    } catch (err) {
      console.error('[returnsService] getReturnStats error:', err);
      return { success: false, stats: {} };
    }
  }
);

/**
 * Admin: Process refund for a return (mark as refunded with amount).
 *
 * @param {string} returnId
 * @param {number} refundAmount
 * @param {string} [notes]
 * @returns {Promise<{success: boolean}>}
 */
export const processRefund = webMethod(
  Permissions.Admin,
  async (returnId, refundAmount, notes) => {
    try {
      const rid = validateId(returnId);
      if (!rid) return { success: false, error: 'Invalid return ID.' };

      if (typeof refundAmount !== 'number' || refundAmount <= 0) {
        return { success: false, error: 'Valid refund amount required.' };
      }

      const record = await wixData.get(COLLECTION, rid);
      if (!record) return { success: false, error: 'Return not found.' };

      if (record.status === 'refunded') {
        return { success: false, error: 'Refund already processed.' };
      }

      if (record.status === 'denied') {
        return { success: false, error: 'Cannot refund a denied return.' };
      }

      const order = await wixData.get('Stores/Orders', record.orderId);
      if (!order) return { success: false, error: 'Original order not found.' };

      const orderTotal = order.totals?.total || 0;
      if (refundAmount > orderTotal) {
        return { success: false, error: `Refund amount exceeds order total ($${orderTotal}).` };
      }

      record.status = 'refunded';
      record.refundAmount = refundAmount;
      if (notes) record.adminNotes = sanitize(notes, 2000);

      await wixData.update(COLLECTION, record);
      return { success: true };
    } catch (err) {
      console.error('[returnsService] processRefund error:', err);
      return { success: false, error: 'Unable to process refund.' };
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
  let items = safeParse(record.items, [], 'returnsService/formatReturn');

  return {
    _id: record._id,
    rmaNumber: record.rmaNumber,
    orderNumber: record.orderNumber,
    type: record.type,
    reason: record.reasonLabel || record.reason,
    details: record.details || '',
    status: record.status,
    items,
    returnTrackingNumber: record.returnTrackingNumber || null,
    date: record._createdDate
      ? new Date(record._createdDate).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : '',
  };
}

function formatAdminReturn(record) {
  let items = safeParse(record.items, [], 'returnsService/formatAdminReturn');

  return {
    _id: record._id,
    rmaNumber: record.rmaNumber,
    orderId: record.orderId,
    orderNumber: record.orderNumber,
    memberId: record.memberId,
    memberEmail: record.memberEmail,
    memberName: record.memberName,
    type: record.type,
    reason: record.reasonLabel || record.reason,
    details: record.details || '',
    status: record.status,
    items,
    adminNotes: record.adminNotes || '',
    returnTrackingNumber: record.returnTrackingNumber || null,
    refundAmount: record.refundAmount || null,
    date: record._createdDate
      ? new Date(record._createdDate).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : '',
  };
}

// Test-only exports
export { _rateLimitMap, _checkRateLimit, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS };
