/**
 * @module accountDashboard
 * @description Member account dashboard backend. Aggregates order history,
 * active deliveries, wishlist, loyalty, and communication preferences into
 * efficient backend calls for the Member Page.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Uses existing CMS collections:
 *   Stores/Orders - Wix Stores native orders
 *   Wishlist - memberId, productId, productName, productPrice, imageUrl, addedAt
 *   DeliveryTracking - orderId, memberId, status, estimatedDelivery, trackingNumber
 *   MemberPreferences - memberId, newsletter, saleAlerts, backInStock
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const ORDER_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const WISHLIST_PAGE_SIZE = 20;

const VALID_SORT_FIELDS = ['_createdDate', 'number', 'totals.total'];
const VALID_SORT_DIRS = ['asc', 'desc'];
const VALID_PREF_KEYS = ['newsletter', 'saleAlerts', 'backInStock'];

// ── Helpers ──────────────────────────────────────────────────────────

async function getMember() {
  try {
    const member = await currentMember.getMember();
    return member;
  } catch {
    return null;
  }
}

// ── getAccountSummary ────────────────────────────────────────────────

/**
 * Returns aggregated account summary: order count, wishlist count,
 * active deliveries count, and loyalty points.
 */
export const getAccountSummary = webMethod(Permissions.SiteMember, async () => {
  try {
    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const memberId = member._id;

    const [orderCount, wishlistCount, activeDeliveries] = await Promise.all([
      wixData.query('Stores/Orders')
        .eq('buyerInfo.id', memberId)
        .count(),
      wixData.query('Wishlist')
        .eq('memberId', memberId)
        .count(),
      wixData.query('DeliveryTracking')
        .eq('memberId', memberId)
        .ne('status', 'delivered')
        .count(),
    ]);

    return {
      success: true,
      data: {
        orderCount,
        wishlistCount,
        activeDeliveries,
        memberId,
        memberName: member.contactDetails?.firstName || 'Member',
        memberEmail: member.loginEmail || '',
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load account summary' };
  }
});

// ── getOrderHistory ──────────────────────────────────────────────────

/**
 * Returns paginated order history for the authenticated member.
 * @param {Object} opts - { page, pageSize, sortField, sortDir }
 */
export const getOrderHistory = webMethod(Permissions.SiteMember, async (opts = {}) => {
  try {
    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const page = Math.max(1, Math.round(Number(opts.page) || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.round(Number(opts.pageSize) || ORDER_PAGE_SIZE)));
    const sortField = VALID_SORT_FIELDS.includes(opts.sortField) ? opts.sortField : '_createdDate';
    const sortDir = VALID_SORT_DIRS.includes(opts.sortDir) ? opts.sortDir : 'desc';

    let query = wixData.query('Stores/Orders')
      .eq('buyerInfo.id', member._id);

    query = sortDir === 'asc' ? query.ascending(sortField) : query.descending(sortField);
    query = query.skip((page - 1) * pageSize).limit(pageSize);

    const result = await query.find();

    const orders = result.items.map(order => ({
      _id: order._id,
      number: order.number,
      createdDate: order._createdDate,
      status: order.fulfillmentStatus || 'Processing',
      total: order.totals?.total || 0,
      subtotal: order.totals?.subtotal || 0,
      itemCount: (order.lineItems || []).length,
      trackingNumber: order.shippingInfo?.trackingNumber || null,
      lineItems: (order.lineItems || []).map(li => ({
        name: li.name,
        quantity: li.quantity,
        price: li.price,
        imageUrl: li.mediaItem?.src || null,
      })),
    }));

    return {
      success: true,
      data: {
        orders,
        page,
        pageSize,
        totalCount: result.totalCount,
        totalPages: Math.ceil(result.totalCount / pageSize),
        hasNext: result.totalCount > page * pageSize,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load order history' };
  }
});

// ── getActiveDeliveries ──────────────────────────────────────────────

/**
 * Returns all in-flight deliveries for the authenticated member.
 */
export const getActiveDeliveries = webMethod(Permissions.SiteMember, async () => {
  try {
    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const result = await wixData.query('DeliveryTracking')
      .eq('memberId', member._id)
      .ne('status', 'delivered')
      .descending('_createdDate')
      .limit(20)
      .find();

    const deliveries = result.items.map(d => ({
      _id: d._id,
      orderId: d.orderId,
      status: d.status,
      deliveryTier: d.deliveryTier || 'standard',
      trackingNumber: d.trackingNumber || null,
      estimatedDelivery: d.estimatedDelivery || null,
      milestones: safeParse(d.milestones),
    }));

    return { success: true, data: { deliveries, count: deliveries.length } };
  } catch (err) {
    return { success: false, error: 'Failed to load active deliveries' };
  }
});

// ── getWishlist ──────────────────────────────────────────────────────

/**
 * Returns paginated wishlist for the authenticated member.
 * @param {Object} opts - { page, pageSize, sort }
 */
export const getWishlist = webMethod(Permissions.SiteMember, async (opts = {}) => {
  try {
    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const page = Math.max(1, Math.round(Number(opts.page) || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.round(Number(opts.pageSize) || WISHLIST_PAGE_SIZE)));
    const sort = opts.sort === 'price-asc' ? 'price-asc'
      : opts.sort === 'price-desc' ? 'price-desc'
      : opts.sort === 'name' ? 'name'
      : 'date-desc';

    let query = wixData.query('Wishlist')
      .eq('memberId', member._id);

    if (sort === 'price-asc') query = query.ascending('productPrice');
    else if (sort === 'price-desc') query = query.descending('productPrice');
    else if (sort === 'name') query = query.ascending('productName');
    else query = query.descending('addedAt');

    query = query.skip((page - 1) * pageSize).limit(pageSize);

    const result = await query.find();

    const items = result.items.map(w => ({
      _id: w._id,
      productId: w.productId,
      productName: w.productName,
      productPrice: w.productPrice,
      imageUrl: w.imageUrl || null,
      addedAt: w.addedAt,
    }));

    return {
      success: true,
      data: {
        items,
        page,
        pageSize,
        totalCount: result.totalCount,
        totalPages: Math.ceil(result.totalCount / pageSize),
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load wishlist' };
  }
});

// ── removeFromWishlist ───────────────────────────────────────────────

/**
 * Removes a product from the authenticated member's wishlist.
 * @param {string} wishlistItemId - The wishlist item ID to remove
 */
export const removeFromWishlist = webMethod(Permissions.SiteMember, async (wishlistItemId) => {
  try {
    if (!validateId(wishlistItemId)) return { success: false, error: 'Invalid item ID' };

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    // Verify ownership before deleting
    const item = await wixData.get('Wishlist', wishlistItemId);
    if (!item || item.memberId !== member._id) {
      return { success: false, error: 'Item not found' };
    }

    await wixData.remove('Wishlist', wishlistItemId);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to remove wishlist item' };
  }
});

// ── updatePreferences ────────────────────────────────────────────────

/**
 * Updates communication preferences for the authenticated member.
 * @param {Object} prefs - { newsletter, saleAlerts, backInStock }
 */
export const updatePreferences = webMethod(Permissions.SiteMember, async (prefs) => {
  try {
    if (!prefs || typeof prefs !== 'object') {
      return { success: false, error: 'Invalid preferences data' };
    }

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    // Validate — only allow known preference keys with boolean values
    const updates = {};
    for (const key of VALID_PREF_KEYS) {
      if (key in prefs) {
        updates[key] = Boolean(prefs[key]);
      }
    }

    if (Object.keys(updates).length === 0) {
      return { success: false, error: 'No valid preferences provided' };
    }

    // Upsert into MemberPreferences
    const existing = await wixData.query('MemberPreferences')
      .eq('memberId', member._id)
      .find();

    if (existing.items.length > 0) {
      const record = { ...existing.items[0], ...updates, updatedAt: new Date() };
      await wixData.update('MemberPreferences', record);
    } else {
      await wixData.insert('MemberPreferences', {
        memberId: member._id,
        newsletter: true,
        saleAlerts: true,
        backInStock: true,
        ...updates,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return { success: true, data: updates };
  } catch (err) {
    return { success: false, error: 'Failed to update preferences' };
  }
});

// ── getPreferences ───────────────────────────────────────────────────

/**
 * Returns communication preferences for the authenticated member.
 */
export const getPreferences = webMethod(Permissions.SiteMember, async () => {
  try {
    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const result = await wixData.query('MemberPreferences')
      .eq('memberId', member._id)
      .find();

    const prefs = result.items[0] || {
      newsletter: true,
      saleAlerts: true,
      backInStock: true,
    };

    return {
      success: true,
      data: {
        newsletter: prefs.newsletter !== false,
        saleAlerts: prefs.saleAlerts !== false,
        backInStock: prefs.backInStock !== false,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load preferences' };
  }
});

// ── getReorderItems ──────────────────────────────────────────────────

/**
 * Returns line items from a past order for re-ordering.
 * @param {string} orderId - The order ID to get items from
 */
export const getReorderItems = webMethod(Permissions.SiteMember, async (orderId) => {
  try {
    if (!validateId(orderId)) return { success: false, error: 'Invalid order ID' };

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const result = await wixData.query('Stores/Orders')
      .eq('_id', orderId)
      .eq('buyerInfo.id', member._id)
      .find();

    if (result.items.length === 0) {
      return { success: false, error: 'Order not found' };
    }

    const order = result.items[0];
    const items = (order.lineItems || []).map(li => ({
      productId: li.productId,
      name: li.name,
      quantity: li.quantity,
      price: li.price,
      options: li.options || [],
      imageUrl: li.mediaItem?.src || null,
    }));

    return { success: true, data: { orderId, orderNumber: order.number, items } };
  } catch (err) {
    return { success: false, error: 'Failed to load order items' };
  }
});

// ── Utilities ────────────────────────────────────────────────────────

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}
