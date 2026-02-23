/**
 * @module giftRegistry
 * @description Gift registry system for occasions (wedding, housewarming,
 * dorm, baby, holiday). Members create shareable registries with product
 * wish-lists; guests can mark items as purchased.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `GiftRegistries` with fields:
 *   memberId (Text, indexed) - Registry owner
 *   title (Text) - Registry name
 *   slug (Text, indexed, unique) - URL-safe shareable ID
 *   occasion (Text) - 'wedding'|'housewarming'|'dorm'|'baby'|'holiday'|'other'
 *   eventDate (Date) - Target date
 *   message (Text) - Personal message to guests
 *   isPublic (Boolean) - Whether publicly discoverable
 *   _createdDate (Date) - Auto
 *
 * Create CMS collection `GiftRegistryItems` with fields:
 *   registryId (Text, indexed) - Parent registry
 *   productId (Text) - Wix product ID
 *   productName (Text) - Product name
 *   productPrice (Number) - Price at time of adding
 *   imageUrl (Text) - Product image
 *   quantity (Number) - Desired quantity
 *   purchasedQuantity (Number) - How many purchased
 *   purchasedBy (Text) - Buyer name (optional, for thank-you notes)
 *   priority (Number) - 1=must-have, 2=nice-to-have, 3=dream
 *   notes (Text) - Item-specific notes (e.g. "prefer walnut finish")
 *   _createdDate (Date) - Auto
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId, validateSlug } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const VALID_OCCASIONS = ['wedding', 'housewarming', 'dorm', 'baby', 'holiday', 'other'];
const VALID_PRIORITIES = [1, 2, 3];
const MAX_REGISTRIES_PER_MEMBER = 10;
const MAX_ITEMS_PER_REGISTRY = 50;
const MAX_MESSAGE_LENGTH = 500;
const MAX_NOTES_LENGTH = 200;
const MAX_TITLE_LENGTH = 100;

// ── Helpers ──────────────────────────────────────────────────────────

async function getMember() {
  try {
    const member = await currentMember.getMember();
    return member;
  } catch {
    return null;
  }
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    + '-' + Date.now().toString(36);
}

// ── createRegistry ───────────────────────────────────────────────────

/**
 * Creates a new gift registry.
 * @param {Object} data - { title, occasion, eventDate, message, isPublic }
 */
export const createRegistry = webMethod(Permissions.SiteMember, async (data) => {
  try {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid registry data' };
    }

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const title = sanitize(data.title, MAX_TITLE_LENGTH);
    if (!title) return { success: false, error: 'Title is required' };

    const occasion = VALID_OCCASIONS.includes(data.occasion) ? data.occasion : 'other';
    const message = sanitize(data.message || '', MAX_MESSAGE_LENGTH);
    const isPublic = Boolean(data.isPublic);

    // Check registry limit
    const existingCount = await wixData.query('GiftRegistries')
      .eq('memberId', member._id)
      .count();

    if (existingCount >= MAX_REGISTRIES_PER_MEMBER) {
      return { success: false, error: `Maximum ${MAX_REGISTRIES_PER_MEMBER} registries allowed` };
    }

    // Generate unique slug
    const slug = generateSlug(title);

    const registry = await wixData.insert('GiftRegistries', {
      memberId: member._id,
      title,
      slug,
      occasion,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      message,
      isPublic,
    });

    return { success: true, data: { _id: registry._id, slug: registry.slug, title } };
  } catch (err) {
    return { success: false, error: 'Failed to create registry' };
  }
});

// ── getMyRegistries ──────────────────────────────────────────────────

/**
 * Returns all registries owned by the authenticated member.
 */
export const getMyRegistries = webMethod(Permissions.SiteMember, async () => {
  try {
    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const result = await wixData.query('GiftRegistries')
      .eq('memberId', member._id)
      .descending('_createdDate')
      .limit(MAX_REGISTRIES_PER_MEMBER)
      .find();

    const settled = await Promise.allSettled(result.items.map(async (r) => {
      const itemCount = await wixData.query('GiftRegistryItems')
        .eq('registryId', r._id)
        .count();

      return {
        _id: r._id,
        title: r.title,
        slug: r.slug,
        occasion: r.occasion,
        eventDate: r.eventDate,
        isPublic: r.isPublic,
        itemCount,
        createdDate: r._createdDate,
      };
    }));

    const registries = settled
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    return { success: true, data: { registries } };
  } catch (err) {
    return { success: false, error: 'Failed to load registries' };
  }
});

// ── getRegistry ──────────────────────────────────────────────────────

/**
 * Returns a registry by ID with its items. Owner sees full detail.
 * @param {string} registryId - Registry ID
 */
export const getRegistry = webMethod(Permissions.SiteMember, async (registryId) => {
  try {
    if (!validateId(registryId)) return { success: false, error: 'Invalid registry ID' };

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const registry = await wixData.get('GiftRegistries', registryId);
    if (!registry || registry.memberId !== member._id) {
      return { success: false, error: 'Registry not found' };
    }

    const itemsResult = await wixData.query('GiftRegistryItems')
      .eq('registryId', registryId)
      .ascending('priority')
      .limit(MAX_ITEMS_PER_REGISTRY)
      .find();

    return {
      success: true,
      data: {
        ...registry,
        items: itemsResult.items.map(i => ({
          _id: i._id,
          productId: i.productId,
          productName: i.productName,
          productPrice: i.productPrice,
          imageUrl: i.imageUrl,
          quantity: i.quantity || 1,
          purchasedQuantity: i.purchasedQuantity || 0,
          purchasedBy: i.purchasedBy || null,
          priority: i.priority || 2,
          notes: i.notes || '',
        })),
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load registry' };
  }
});

// ── getPublicRegistry ────────────────────────────────────────────────

/**
 * Returns a public registry by slug. Available to anyone with the link.
 * Hides purchasedBy to preserve surprise.
 * @param {string} slug - Registry slug
 */
export const getPublicRegistry = webMethod(Permissions.Anyone, async (slug) => {
  try {
    if (!slug || typeof slug !== 'string') {
      return { success: false, error: 'Invalid registry slug' };
    }

    const cleanSlug = sanitize(slug, 60);

    const result = await wixData.query('GiftRegistries')
      .eq('slug', cleanSlug)
      .find();

    if (result.items.length === 0) {
      return { success: false, error: 'Registry not found' };
    }

    const registry = result.items[0];

    const itemsResult = await wixData.query('GiftRegistryItems')
      .eq('registryId', registry._id)
      .ascending('priority')
      .limit(MAX_ITEMS_PER_REGISTRY)
      .find();

    return {
      success: true,
      data: {
        title: registry.title,
        occasion: registry.occasion,
        eventDate: registry.eventDate,
        message: registry.message,
        items: itemsResult.items.map(i => ({
          _id: i._id,
          productId: i.productId,
          productName: i.productName,
          productPrice: i.productPrice,
          imageUrl: i.imageUrl,
          quantity: i.quantity || 1,
          purchasedQuantity: i.purchasedQuantity || 0,
          remaining: Math.max(0, (i.quantity || 1) - (i.purchasedQuantity || 0)),
          priority: i.priority || 2,
          notes: i.notes || '',
        })),
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load registry' };
  }
});

// ── addRegistryItem ──────────────────────────────────────────────────

/**
 * Adds a product to a registry.
 * @param {string} registryId - Registry ID
 * @param {Object} item - { productId, productName, productPrice, imageUrl, quantity, priority, notes }
 */
export const addRegistryItem = webMethod(Permissions.SiteMember, async (registryId, item) => {
  try {
    if (!validateId(registryId)) return { success: false, error: 'Invalid registry ID' };
    if (!item || typeof item !== 'object') return { success: false, error: 'Invalid item data' };

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    // Verify ownership
    const registry = await wixData.get('GiftRegistries', registryId);
    if (!registry || registry.memberId !== member._id) {
      return { success: false, error: 'Registry not found' };
    }

    // Check item limit
    const itemCount = await wixData.query('GiftRegistryItems')
      .eq('registryId', registryId)
      .count();

    if (itemCount >= MAX_ITEMS_PER_REGISTRY) {
      return { success: false, error: `Maximum ${MAX_ITEMS_PER_REGISTRY} items per registry` };
    }

    const productName = sanitize(item.productName, MAX_TITLE_LENGTH);
    if (!productName) return { success: false, error: 'Product name is required' };

    const quantity = Math.max(1, Math.min(10, Math.round(Number(item.quantity) || 1)));
    const priority = VALID_PRIORITIES.includes(Number(item.priority)) ? Number(item.priority) : 2;

    const inserted = await wixData.insert('GiftRegistryItems', {
      registryId,
      productId: sanitize(item.productId || '', 50),
      productName,
      productPrice: Math.max(0, Number(item.productPrice) || 0),
      imageUrl: sanitize(item.imageUrl || '', 500),
      quantity,
      purchasedQuantity: 0,
      priority,
      notes: sanitize(item.notes || '', MAX_NOTES_LENGTH),
    });

    return { success: true, data: { _id: inserted._id, productName, quantity } };
  } catch (err) {
    return { success: false, error: 'Failed to add item' };
  }
});

// ── removeRegistryItem ───────────────────────────────────────────────

/**
 * Removes an item from a registry. Owner only.
 * @param {string} registryId - Registry ID
 * @param {string} itemId - Item ID to remove
 */
export const removeRegistryItem = webMethod(Permissions.SiteMember, async (registryId, itemId) => {
  try {
    if (!validateId(registryId) || !validateId(itemId)) {
      return { success: false, error: 'Invalid ID' };
    }

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    // Verify registry ownership
    const registry = await wixData.get('GiftRegistries', registryId);
    if (!registry || registry.memberId !== member._id) {
      return { success: false, error: 'Registry not found' };
    }

    // Verify item belongs to registry
    const item = await wixData.get('GiftRegistryItems', itemId);
    if (!item || item.registryId !== registryId) {
      return { success: false, error: 'Item not found' };
    }

    await wixData.remove('GiftRegistryItems', itemId);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to remove item' };
  }
});

// ── markItemPurchased ────────────────────────────────────────────────

/**
 * Marks a registry item as purchased (by a guest). Available to anyone.
 * @param {string} itemId - Item ID
 * @param {Object} data - { buyerName, quantity }
 */
export const markItemPurchased = webMethod(Permissions.Anyone, async (itemId, data) => {
  try {
    if (!validateId(itemId)) return { success: false, error: 'Invalid item ID' };
    if (!data || typeof data !== 'object') return { success: false, error: 'Invalid data' };

    const item = await wixData.get('GiftRegistryItems', itemId);
    if (!item) return { success: false, error: 'Item not found' };

    const remaining = (item.quantity || 1) - (item.purchasedQuantity || 0);
    if (remaining <= 0) {
      return { success: false, error: 'Item already fully purchased' };
    }

    const purchaseQty = Math.min(remaining, Math.max(1, Math.round(Number(data.quantity) || 1)));
    const buyerName = sanitize(data.buyerName || 'Anonymous', 50);

    await wixData.update('GiftRegistryItems', {
      ...item,
      purchasedQuantity: (item.purchasedQuantity || 0) + purchaseQty,
      purchasedBy: buyerName,
    });

    return { success: true, data: { purchasedQuantity: purchaseQty, remaining: remaining - purchaseQty } };
  } catch (err) {
    return { success: false, error: 'Failed to mark item as purchased' };
  }
});

// ── deleteRegistry ───────────────────────────────────────────────────

/**
 * Deletes a registry and all its items. Owner only.
 * @param {string} registryId - Registry ID
 */
export const deleteRegistry = webMethod(Permissions.SiteMember, async (registryId) => {
  try {
    if (!validateId(registryId)) return { success: false, error: 'Invalid registry ID' };

    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const registry = await wixData.get('GiftRegistries', registryId);
    if (!registry || registry.memberId !== member._id) {
      return { success: false, error: 'Registry not found' };
    }

    // Remove all items first
    const items = await wixData.query('GiftRegistryItems')
      .eq('registryId', registryId)
      .limit(MAX_ITEMS_PER_REGISTRY)
      .find();

    for (const item of items.items) {
      await wixData.remove('GiftRegistryItems', item._id);
    }

    await wixData.remove('GiftRegistries', registryId);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete registry' };
  }
});
