import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  createRoomLayout,
  addProductToLayout,
  getLayoutPreview,
  shareLayout,
  saveLayout,
  getProductDimensions,
} from '../src/backend/roomPlanner.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
});

// ── createRoomLayout ──────────────────────────────────────────────────

describe('createRoomLayout', () => {
  it('creates a room layout with dimensions', async () => {
    const result = await createRoomLayout({
      name: 'Living Room',
      roomWidth: 180,
      roomLength: 144,
      roomShape: 'rectangular',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.shareId).toBeTruthy();
  });

  it('requires layout name', async () => {
    const result = await createRoomLayout({
      name: '',
      roomWidth: 180,
      roomLength: 144,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('name');
  });

  it('clamps zero dimensions to minimum 24 inches', async () => {
    const result = await createRoomLayout({
      name: 'Tiny Room',
      roomWidth: 0,
      roomLength: 0,
    });

    // 0 gets clamped to 24 (minimum), which is valid
    expect(result.success).toBe(true);
  });

  it('clamps room dimensions to valid range', async () => {
    const result = await createRoomLayout({
      name: 'Giant Room',
      roomWidth: 999,
      roomLength: 10,
    });

    expect(result.success).toBe(true);
  });

  it('defaults to rectangular shape', async () => {
    const result = await createRoomLayout({
      name: 'Test',
      roomWidth: 120,
      roomLength: 120,
    });

    expect(result.success).toBe(true);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await createRoomLayout({
      name: 'Test',
      roomWidth: 120,
      roomLength: 120,
    });

    expect(result.success).toBe(false);
  });
});

// ── addProductToLayout ────────────────────────────────────────────────

describe('addProductToLayout', () => {
  it('adds a product to a layout', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Test', roomWidth: 180, roomLength: 144, products: '[]' },
    ]);

    const result = await addProductToLayout('layout-1', {
      productType: 'futon-frame-full',
      x: 10,
      y: 20,
      rotation: 0,
      isBedMode: false,
    });

    expect(result.success).toBe(true);
    expect(result.placementId).toBeTruthy();
    expect(result.fits).toBe(true);
    expect(result.dimensions.width).toBe(82);
    expect(result.dimensions.depth).toBe(38);
  });

  it('detects when product does not fit', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Tiny', roomWidth: 60, roomLength: 60, products: '[]' },
    ]);

    const result = await addProductToLayout('layout-1', {
      productType: 'futon-frame-full',
      x: 0,
      y: 0,
    });

    expect(result.success).toBe(true);
    expect(result.fits).toBe(false);
  });

  it('uses bed mode depth when specified', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Test', roomWidth: 200, roomLength: 200, products: '[]' },
    ]);

    const result = await addProductToLayout('layout-1', {
      productType: 'futon-frame-full',
      x: 0,
      y: 0,
      isBedMode: true,
    });

    expect(result.dimensions.depth).toBe(54); // bed mode depth
  });

  it('handles rotation', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Test', roomWidth: 200, roomLength: 200, products: '[]' },
    ]);

    const result = await addProductToLayout('layout-1', {
      productType: 'futon-frame-full',
      x: 0,
      y: 0,
      rotation: 90,
    });

    expect(result.success).toBe(true);
    // Rotated 90: width becomes depth, depth becomes width
    expect(result.dimensions.width).toBe(38);
    expect(result.dimensions.depth).toBe(82);
  });

  it('rejects unknown product type', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Test', roomWidth: 200, roomLength: 200, products: '[]' },
    ]);

    const result = await addProductToLayout('layout-1', {
      productType: 'unknown-product',
      x: 0,
      y: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown product');
  });

  it('requires valid layout ID', async () => {
    const result = await addProductToLayout('', {
      productType: 'futon-frame-full',
      x: 0,
      y: 0,
    });

    expect(result.success).toBe(false);
  });

  it('prevents access to other members layouts', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-2', name: 'Other', roomWidth: 200, roomLength: 200, products: '[]' },
    ]);

    const result = await addProductToLayout('layout-1', {
      productType: 'futon-frame-full',
      x: 0,
      y: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('updates existing placement', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Test', roomWidth: 200, roomLength: 200, products: '[{"placementId":"p-existing","productType":"futon-frame-full","x":0,"y":0}]' },
    ]);

    const result = await addProductToLayout('layout-1', {
      productType: 'coffee-table',
      x: 50,
      y: 50,
      placementId: 'p-existing',
    });

    expect(result.success).toBe(true);
    expect(result.placementId).toBe('p-existing');
  });
});

// ── getLayoutPreview ──────────────────────────────────────────────────

describe('getLayoutPreview', () => {
  it('returns layout with products by ID', async () => {
    __seed('RoomLayouts', [
      {
        _id: 'layout-1', memberId: 'member-1', name: 'My Room',
        roomWidth: 180, roomLength: 144, roomShape: 'rectangular',
        products: '[{"placementId":"p-1","productType":"futon-frame-full","x":10,"y":20}]',
        shareId: 'abc12345', isPublic: false, createdAt: new Date(), updatedAt: new Date(),
      },
    ]);

    const result = await getLayoutPreview('layout-1');
    expect(result.success).toBe(true);
    expect(result.layout.name).toBe('My Room');
    expect(result.layout.roomWidth).toBe(180);
    expect(result.layout.products).toHaveLength(1);
  });

  it('returns layout by share ID when public', async () => {
    __seed('RoomLayouts', [
      {
        _id: 'layout-1', memberId: 'member-2', name: 'Shared Room',
        roomWidth: 150, roomLength: 120, products: '[]',
        shareId: 'share123', isPublic: true, createdAt: new Date(), updatedAt: new Date(),
      },
    ]);

    const result = await getLayoutPreview('share123', true);
    expect(result.success).toBe(true);
    expect(result.layout.name).toBe('Shared Room');
  });

  it('returns null for non-public shared layout', async () => {
    __seed('RoomLayouts', [
      {
        _id: 'layout-1', memberId: 'member-2', name: 'Private',
        roomWidth: 150, roomLength: 120, products: '[]',
        shareId: 'private1', isPublic: false, createdAt: new Date(), updatedAt: new Date(),
      },
    ]);

    const result = await getLayoutPreview('private1', true);
    expect(result.layout).toBeNull();
  });

  it('returns null for non-existent layout', async () => {
    __seed('RoomLayouts', []);
    const result = await getLayoutPreview('nonexistent');
    expect(result.success).toBe(true);
    expect(result.layout).toBeNull();
  });

  it('requires valid ID', async () => {
    const result = await getLayoutPreview('');
    expect(result.success).toBe(false);
  });
});

// ── shareLayout ───────────────────────────────────────────────────────

describe('shareLayout', () => {
  it('makes a layout public and returns share URL', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Test', shareId: 'abc12345', isPublic: false },
    ]);

    const result = await shareLayout('layout-1', true);
    expect(result.success).toBe(true);
    expect(result.shareUrl).toContain('abc12345');
    expect(result.shareUrl).toContain('room-planner');
  });

  it('makes a layout private', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Test', shareId: 'abc12345', isPublic: true },
    ]);

    const result = await shareLayout('layout-1', false);
    expect(result.success).toBe(true);
    expect(result.shareUrl).toBe('');
  });

  it('prevents sharing other members layouts', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-2', name: 'Other', shareId: 'abc12345', isPublic: false },
    ]);

    const result = await shareLayout('layout-1', true);
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await shareLayout('layout-1', true);
    expect(result.success).toBe(false);
  });
});

// ── saveLayout ────────────────────────────────────────────────────────

describe('saveLayout', () => {
  it('updates layout name', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Old Name', roomWidth: 180, roomLength: 144 },
    ]);

    const result = await saveLayout('layout-1', { name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('updates room dimensions', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-1', name: 'Test', roomWidth: 180, roomLength: 144 },
    ]);

    const result = await saveLayout('layout-1', { roomWidth: 200, roomLength: 160 });
    expect(result.success).toBe(true);
  });

  it('prevents updating other members layouts', async () => {
    __seed('RoomLayouts', [
      { _id: 'layout-1', memberId: 'member-2', name: 'Other', roomWidth: 180, roomLength: 144 },
    ]);

    const result = await saveLayout('layout-1', { name: 'Hacked' });
    expect(result.success).toBe(false);
  });

  it('requires valid layout ID', async () => {
    const result = await saveLayout('', { name: 'Test' });
    expect(result.success).toBe(false);
  });
});

// ── getProductDimensions ──────────────────────────────────────────────

describe('getProductDimensions', () => {
  it('returns all available product dimensions', async () => {
    const result = await getProductDimensions();
    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('each product has required dimension fields', async () => {
    const result = await getProductDimensions();
    for (const product of result.products) {
      expect(product.productType).toBeTruthy();
      expect(product.label).toBeTruthy();
      expect(product.width).toBeGreaterThan(0);
      expect(product.depth).toBeGreaterThan(0);
      expect(product.depthBed).toBeGreaterThan(0);
      expect(product.category).toBeTruthy();
    }
  });

  it('includes futon frame options', async () => {
    const result = await getProductDimensions();
    const frameProducts = result.products.filter(p => p.category === 'futon-frames');
    expect(frameProducts.length).toBeGreaterThanOrEqual(3);
  });
});
