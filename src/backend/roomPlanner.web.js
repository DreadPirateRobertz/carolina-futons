/**
 * @module roomPlanner
 * @description Virtual room planner: 2D layout with product dimensions.
 * Customers input room dimensions, place futons and furniture, compare
 * layouts, save/share configurations.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `RoomLayouts` with fields:
 *   memberId (Text, indexed) - Owner of the layout
 *   name (Text) - Layout name
 *   roomWidth (Number) - Room width in inches
 *   roomLength (Number) - Room length in inches
 *   roomShape (Text) - 'rectangular'|'l-shaped'|'custom'
 *   products (Text) - JSON array of placed products with positions
 *   layoutData (Text) - JSON layout metadata (walls, doors, windows)
 *   shareId (Text, indexed) - Unique share identifier
 *   thumbnail (Text) - Generated preview image URL
 *   createdAt (Date, indexed)
 *   updatedAt (Date)
 *   isPublic (Boolean) - Whether layout is publicly shareable
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

async function requireMember() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return member._id;
}

// Product dimension catalog (inches) — source of truth for room planner
const PRODUCT_DIMENSIONS = {
  'futon-frame-full': { width: 82, depth: 38, depthBed: 54, label: 'Full Futon Frame', category: 'futon-frames' },
  'futon-frame-queen': { width: 88, depth: 40, depthBed: 60, label: 'Queen Futon Frame', category: 'futon-frames' },
  'futon-frame-twin': { width: 82, depth: 32, depthBed: 39, label: 'Twin Futon Frame', category: 'futon-frames' },
  'futon-wallhugger-full': { width: 82, depth: 38, depthBed: 54, label: 'Full Wall Hugger', category: 'futon-frames' },
  'storage-drawer-full': { width: 75, depth: 20, depthBed: 20, label: 'Storage Drawer (Full)', category: 'storage' },
  'storage-ottoman': { width: 36, depth: 18, depthBed: 18, label: 'Storage Ottoman', category: 'storage' },
  'end-table': { width: 20, depth: 20, depthBed: 20, label: 'End Table', category: 'accessories' },
  'coffee-table': { width: 48, depth: 24, depthBed: 24, label: 'Coffee Table', category: 'accessories' },
};

function generateShareId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Create a new room layout.
 *
 * @param {Object} data
 * @param {string} data.name - Layout name.
 * @param {number} data.roomWidth - Room width in inches.
 * @param {number} data.roomLength - Room length in inches.
 * @param {string} [data.roomShape] - 'rectangular'|'l-shaped'|'custom'
 * @param {Object} [data.layoutData] - Additional layout metadata.
 * @returns {Promise<{success: boolean, id?: string, shareId?: string}>}
 */
export const createRoomLayout = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      const name = sanitize(data.name, 100);
      if (!name) {
        return { success: false, error: 'Layout name is required.' };
      }

      const roomWidth = Math.max(24, Math.min(600, Math.round(Number(data.roomWidth) || 0)));
      const roomLength = Math.max(24, Math.min(600, Math.round(Number(data.roomLength) || 0)));
      if (roomWidth === 0 || roomLength === 0) {
        return { success: false, error: 'Valid room dimensions are required (24-600 inches).' };
      }

      const validShapes = ['rectangular', 'l-shaped', 'custom'];
      const roomShape = sanitize(data.roomShape || 'rectangular', 20);

      const shareId = generateShareId();

      const record = {
        memberId,
        name,
        roomWidth,
        roomLength,
        roomShape: validShapes.includes(roomShape) ? roomShape : 'rectangular',
        products: '[]',
        layoutData: JSON.stringify(data.layoutData || {}),
        shareId,
        thumbnail: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: false,
      };

      const inserted = await wixData.insert('RoomLayouts', record);
      return { success: true, id: inserted._id, shareId };
    } catch (err) {
      console.error('[roomPlanner] Error creating room layout:', err);
      return { success: false, error: 'Failed to create layout.' };
    }
  }
);

/**
 * Add or update a product placement in a layout.
 *
 * @param {string} layoutId - Layout ID.
 * @param {Object} product
 * @param {string} product.productType - Product type key from dimensions catalog.
 * @param {number} product.x - X position in inches from left wall.
 * @param {number} product.y - Y position in inches from top wall.
 * @param {number} [product.rotation] - Rotation in degrees (0, 90, 180, 270).
 * @param {boolean} [product.isBedMode] - Whether futon is in bed position.
 * @param {string} [product.placementId] - Existing placement ID to update.
 * @returns {Promise<{success: boolean, placementId?: string, fits: boolean, dimensions: Object}>}
 */
export const addProductToLayout = webMethod(
  Permissions.SiteMember,
  async (layoutId, product) => {
    try {
      const memberId = await requireMember();

      const cleanLayoutId = validateId(layoutId);
      if (!cleanLayoutId) {
        return { success: false, error: 'Valid layout ID is required.' };
      }

      const layout = await wixData.get('RoomLayouts', cleanLayoutId);
      if (!layout || layout.memberId !== memberId) {
        return { success: false, error: 'Layout not found.' };
      }

      const productType = sanitize(product.productType, 50);
      const dims = PRODUCT_DIMENSIONS[productType];
      if (!dims) {
        return { success: false, error: 'Unknown product type.' };
      }

      const x = Math.max(0, Number(product.x) || 0);
      const y = Math.max(0, Number(product.y) || 0);
      const rotation = [0, 90, 180, 270].includes(Number(product.rotation)) ? Number(product.rotation) : 0;
      const isBedMode = Boolean(product.isBedMode);

      const actualDepth = isBedMode ? dims.depthBed : dims.depth;
      const actualWidth = (rotation === 90 || rotation === 270) ? actualDepth : dims.width;
      const actualHeight = (rotation === 90 || rotation === 270) ? dims.width : actualDepth;

      const fits = (x + actualWidth <= layout.roomWidth) && (y + actualHeight <= layout.roomLength);

      const placementId = product.placementId || `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const products = parseJson(layout.products);
      const existingIndex = products.findIndex(p => p.placementId === placementId);

      const placement = {
        placementId,
        productType,
        label: dims.label,
        category: dims.category,
        x,
        y,
        rotation,
        isBedMode,
        width: actualWidth,
        depth: actualHeight,
      };

      if (existingIndex >= 0) {
        products[existingIndex] = placement;
      } else {
        products.push(placement);
      }

      layout.products = JSON.stringify(products);
      layout.updatedAt = new Date();
      await wixData.update('RoomLayouts', layout);

      return {
        success: true,
        placementId,
        fits,
        dimensions: { width: actualWidth, depth: actualHeight, label: dims.label },
      };
    } catch (err) {
      console.error('[roomPlanner] Error adding product to layout:', err);
      return { success: false, error: 'Failed to update layout.' };
    }
  }
);

/**
 * Get a layout preview with all placed products and room dimensions.
 *
 * @param {string} layoutId - Layout ID or share ID.
 * @param {boolean} [isShareId=false] - Whether the ID is a share ID.
 * @returns {Promise<{success: boolean, layout: Object}>}
 */
export const getLayoutPreview = webMethod(
  Permissions.Anyone,
  async (layoutId, isShareId = false) => {
    try {
      let layout;

      if (isShareId) {
        const cleanShareId = sanitize(layoutId, 20);
        if (!cleanShareId) {
          return { success: false, error: 'Valid share ID is required.', layout: null };
        }

        const result = await wixData.query('RoomLayouts')
          .eq('shareId', cleanShareId)
          .eq('isPublic', true)
          .limit(1)
          .find();

        layout = result.items[0];
      } else {
        const cleanId = validateId(layoutId);
        if (!cleanId) {
          return { success: false, error: 'Valid layout ID is required.', layout: null };
        }
        layout = await wixData.get('RoomLayouts', cleanId);
      }

      if (!layout) {
        return { success: true, layout: null };
      }

      const products = parseJson(layout.products);

      return {
        success: true,
        layout: {
          _id: layout._id,
          name: layout.name,
          roomWidth: layout.roomWidth,
          roomLength: layout.roomLength,
          roomShape: layout.roomShape,
          products,
          shareId: layout.shareId,
          isPublic: layout.isPublic,
          createdAt: layout.createdAt,
          updatedAt: layout.updatedAt,
        },
      };
    } catch (err) {
      console.error('[roomPlanner] Error getting layout preview:', err);
      return { success: false, error: 'Failed to load layout.', layout: null };
    }
  }
);

/**
 * Toggle public sharing for a layout and return the share URL.
 *
 * @param {string} layoutId - Layout ID.
 * @param {boolean} isPublic - Whether to make the layout public.
 * @returns {Promise<{success: boolean, shareUrl?: string}>}
 */
export const shareLayout = webMethod(
  Permissions.SiteMember,
  async (layoutId, isPublic) => {
    try {
      const memberId = await requireMember();

      const cleanId = validateId(layoutId);
      if (!cleanId) {
        return { success: false, error: 'Valid layout ID is required.' };
      }

      const layout = await wixData.get('RoomLayouts', cleanId);
      if (!layout || layout.memberId !== memberId) {
        return { success: false, error: 'Layout not found.' };
      }

      layout.isPublic = Boolean(isPublic);
      layout.updatedAt = new Date();
      await wixData.update('RoomLayouts', layout);

      const shareUrl = isPublic
        ? `https://www.carolinafutons.com/room-planner?share=${layout.shareId}`
        : '';

      return { success: true, shareUrl };
    } catch (err) {
      console.error('[roomPlanner] Error sharing layout:', err);
      return { success: false, error: 'Failed to update sharing.' };
    }
  }
);

/**
 * Save/update a layout (name, room dimensions, layout data).
 *
 * @param {string} layoutId - Layout ID.
 * @param {Object} updates - Fields to update.
 * @param {string} [updates.name] - New layout name.
 * @param {number} [updates.roomWidth] - New room width.
 * @param {number} [updates.roomLength] - New room length.
 * @returns {Promise<{success: boolean}>}
 */
export const saveLayout = webMethod(
  Permissions.SiteMember,
  async (layoutId, updates) => {
    try {
      const memberId = await requireMember();

      const cleanId = validateId(layoutId);
      if (!cleanId) {
        return { success: false, error: 'Valid layout ID is required.' };
      }

      const layout = await wixData.get('RoomLayouts', cleanId);
      if (!layout || layout.memberId !== memberId) {
        return { success: false, error: 'Layout not found.' };
      }

      if (updates.name) layout.name = sanitize(updates.name, 100);
      if (updates.roomWidth) layout.roomWidth = Math.max(24, Math.min(600, Math.round(Number(updates.roomWidth))));
      if (updates.roomLength) layout.roomLength = Math.max(24, Math.min(600, Math.round(Number(updates.roomLength))));

      layout.updatedAt = new Date();
      await wixData.update('RoomLayouts', layout);

      return { success: true };
    } catch (err) {
      console.error('[roomPlanner] Error saving layout:', err);
      return { success: false, error: 'Failed to save layout.' };
    }
  }
);

/**
 * Get the product dimensions catalog for the room planner UI.
 *
 * @returns {Promise<{success: boolean, products: Array}>}
 */
export const getProductDimensions = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const products = Object.entries(PRODUCT_DIMENSIONS).map(([key, dims]) => ({
        productType: key,
        label: dims.label,
        category: dims.category,
        width: dims.width,
        depth: dims.depth,
        depthBed: dims.depthBed,
      }));

      return { success: true, products };
    } catch (err) {
      console.error('[roomPlanner] Error getting product dimensions:', err);
      return { success: false, error: 'Failed to load dimensions.', products: [] };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

function parseJson(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
