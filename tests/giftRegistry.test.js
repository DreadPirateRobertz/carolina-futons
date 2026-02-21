import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate, __onRemove } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  createRegistry,
  getMyRegistries,
  getRegistry,
  getPublicRegistry,
  addRegistryItem,
  removeRegistryItem,
  markItemPurchased,
  deleteRegistry,
} from '../src/backend/giftRegistry.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'alice@example.com', contactDetails: { firstName: 'Alice' } });
});

// ── createRegistry ───────────────────────────────────────────────────

describe('createRegistry', () => {
  it('creates a registry with valid data', async () => {
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });
    __seed('GiftRegistries', []);

    const result = await createRegistry({
      title: 'Our Wedding Registry',
      occasion: 'wedding',
      eventDate: '2026-06-15',
      message: 'Help us furnish our new home!',
      isPublic: true,
    });

    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Our Wedding Registry');
    expect(result.data.slug).toBeTruthy();
    expect(inserted.occasion).toBe('wedding');
    expect(inserted.isPublic).toBe(true);
    expect(inserted.message).toBe('Help us furnish our new home!');
  });

  it('generates URL-safe slug from title', async () => {
    __seed('GiftRegistries', []);
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await createRegistry({ title: 'Alice & Bob Wedding!', occasion: 'wedding' });
    expect(inserted.slug).toMatch(/^alice-bob-wedding-[a-z0-9]+$/);
  });

  it('defaults occasion to other for invalid value', async () => {
    __seed('GiftRegistries', []);
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await createRegistry({ title: 'My Registry', occasion: 'graduation' });
    expect(inserted.occasion).toBe('other');
  });

  it('requires title', async () => {
    __seed('GiftRegistries', []);
    const result = await createRegistry({ title: '', occasion: 'wedding' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Title');
  });

  it('rejects null data', async () => {
    const result = await createRegistry(null);
    expect(result.success).toBe(false);
  });

  it('enforces registry limit', async () => {
    const registries = Array.from({ length: 10 }, (_, i) => ({
      _id: `r-${i}`, memberId: 'member-1', title: `Registry ${i}`,
    }));
    __seed('GiftRegistries', registries);

    const result = await createRegistry({ title: 'One Too Many', occasion: 'other' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum');
  });

  it('sanitizes HTML in message', async () => {
    __seed('GiftRegistries', []);
    let inserted = null;
    __onInsert((col, item) => { inserted = item; });

    await createRegistry({ title: 'Test', message: '<script>alert(1)</script>Nice' });
    expect(inserted.message).not.toContain('<script>');
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await createRegistry({ title: 'Test', occasion: 'wedding' });
    expect(result.success).toBe(false);
  });
});

// ── getMyRegistries ──────────────────────────────────────────────────

describe('getMyRegistries', () => {
  it('returns all registries with item counts', async () => {
    __seed('GiftRegistries', [
      { _id: 'r-1', memberId: 'member-1', title: 'Wedding', slug: 'wedding-abc', occasion: 'wedding', _createdDate: new Date() },
      { _id: 'r-2', memberId: 'member-1', title: 'Housewarming', slug: 'house-def', occasion: 'housewarming', _createdDate: new Date() },
    ]);
    __seed('GiftRegistryItems', [
      { _id: 'i-1', registryId: 'r-1', productName: 'Futon' },
      { _id: 'i-2', registryId: 'r-1', productName: 'Mattress' },
      { _id: 'i-3', registryId: 'r-2', productName: 'Pillow' },
    ]);

    const result = await getMyRegistries();
    expect(result.success).toBe(true);
    expect(result.data.registries).toHaveLength(2);
    expect(result.data.registries[0].itemCount).toBeDefined();
  });

  it('returns empty for new member', async () => {
    __seed('GiftRegistries', []);
    __seed('GiftRegistryItems', []);

    const result = await getMyRegistries();
    expect(result.success).toBe(true);
    expect(result.data.registries).toHaveLength(0);
  });

  it('only returns own registries', async () => {
    __seed('GiftRegistries', [
      { _id: 'r-1', memberId: 'other-member', title: 'Other', _createdDate: new Date() },
    ]);
    __seed('GiftRegistryItems', []);

    const result = await getMyRegistries();
    expect(result.data.registries).toHaveLength(0);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getMyRegistries();
    expect(result.success).toBe(false);
  });
});

// ── getRegistry ──────────────────────────────────────────────────────

describe('getRegistry', () => {
  it('returns registry with items for owner', async () => {
    __seed('GiftRegistries', [
      { _id: 'r-1', memberId: 'member-1', title: 'Wedding', slug: 'wedding-abc', occasion: 'wedding' },
    ]);
    __seed('GiftRegistryItems', [
      { _id: 'i-1', registryId: 'r-1', productName: 'Futon Frame', productPrice: 549, quantity: 1, purchasedQuantity: 0, priority: 1 },
      { _id: 'i-2', registryId: 'r-1', productName: 'Mattress', productPrice: 299, quantity: 2, purchasedQuantity: 1, priority: 2 },
    ]);

    const result = await getRegistry('r-1');
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Wedding');
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[0].productName).toBe('Futon Frame');
    expect(result.data.items[1].purchasedQuantity).toBe(1);
  });

  it('rejects access from non-owner', async () => {
    __seed('GiftRegistries', [
      { _id: 'r-1', memberId: 'other-member', title: 'Not Mine' },
    ]);

    const result = await getRegistry('r-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails for invalid ID', async () => {
    const result = await getRegistry('');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await getRegistry('r-1');
    expect(result.success).toBe(false);
  });
});

// ── getPublicRegistry ────────────────────────────────────────────────

describe('getPublicRegistry', () => {
  it('returns public registry by slug', async () => {
    __seed('GiftRegistries', [
      { _id: 'r-1', memberId: 'other-member', title: 'Wedding', slug: 'wedding-abc', occasion: 'wedding', message: 'Help us!', eventDate: new Date('2026-06-15') },
    ]);
    __seed('GiftRegistryItems', [
      { _id: 'i-1', registryId: 'r-1', productName: 'Futon', productPrice: 549, quantity: 2, purchasedQuantity: 1, priority: 1 },
    ]);

    const result = await getPublicRegistry('wedding-abc');
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Wedding');
    expect(result.data.message).toBe('Help us!');
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].remaining).toBe(1);
  });

  it('does not expose memberId', async () => {
    __seed('GiftRegistries', [
      { _id: 'r-1', memberId: 'secret-member', title: 'Wedding', slug: 'test-slug' },
    ]);
    __seed('GiftRegistryItems', []);

    const result = await getPublicRegistry('test-slug');
    expect(result.data.memberId).toBeUndefined();
  });

  it('fails for non-existent slug', async () => {
    __seed('GiftRegistries', []);
    const result = await getPublicRegistry('nonexistent');
    expect(result.success).toBe(false);
  });

  it('fails for empty slug', async () => {
    const result = await getPublicRegistry('');
    expect(result.success).toBe(false);
  });

  it('calculates remaining quantity', async () => {
    __seed('GiftRegistries', [
      { _id: 'r-1', memberId: 'member-1', title: 'Test', slug: 'test-slug' },
    ]);
    __seed('GiftRegistryItems', [
      { _id: 'i-1', registryId: 'r-1', productName: 'Item', quantity: 3, purchasedQuantity: 2, priority: 1 },
    ]);

    const result = await getPublicRegistry('test-slug');
    expect(result.data.items[0].remaining).toBe(1);
  });
});

// ── addRegistryItem ──────────────────────────────────────────────────

describe('addRegistryItem', () => {
  it('adds item to registry', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'GiftRegistryItems') inserted = item; });
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'member-1' }]);
    __seed('GiftRegistryItems', []);

    const result = await addRegistryItem('r-1', {
      productId: 'p-1',
      productName: 'Futon Frame',
      productPrice: 549,
      imageUrl: 'https://img.com/futon.jpg',
      quantity: 2,
      priority: 1,
      notes: 'Prefer walnut finish',
    });

    expect(result.success).toBe(true);
    expect(result.data.productName).toBe('Futon Frame');
    expect(inserted.quantity).toBe(2);
    expect(inserted.priority).toBe(1);
    expect(inserted.notes).toBe('Prefer walnut finish');
    expect(inserted.purchasedQuantity).toBe(0);
  });

  it('clamps quantity to 1-10', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'GiftRegistryItems') inserted = item; });
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'member-1' }]);
    __seed('GiftRegistryItems', []);

    await addRegistryItem('r-1', { productName: 'Test', quantity: 99 });
    expect(inserted.quantity).toBe(10);
  });

  it('defaults priority to 2', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'GiftRegistryItems') inserted = item; });
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'member-1' }]);
    __seed('GiftRegistryItems', []);

    await addRegistryItem('r-1', { productName: 'Test' });
    expect(inserted.priority).toBe(2);
  });

  it('requires product name', async () => {
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'member-1' }]);
    __seed('GiftRegistryItems', []);

    const result = await addRegistryItem('r-1', { productName: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product name');
  });

  it('rejects non-owner', async () => {
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'other-member' }]);
    __seed('GiftRegistryItems', []);

    const result = await addRegistryItem('r-1', { productName: 'Futon' });
    expect(result.success).toBe(false);
  });

  it('enforces item limit', async () => {
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'member-1' }]);
    const items = Array.from({ length: 50 }, (_, i) => ({ _id: `i-${i}`, registryId: 'r-1' }));
    __seed('GiftRegistryItems', items);

    const result = await addRegistryItem('r-1', { productName: 'One Too Many' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum');
  });

  it('fails for invalid registry ID', async () => {
    const result = await addRegistryItem('', { productName: 'Test' });
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await addRegistryItem('r-1', { productName: 'Test' });
    expect(result.success).toBe(false);
  });
});

// ── removeRegistryItem ───────────────────────────────────────────────

describe('removeRegistryItem', () => {
  it('removes item from own registry', async () => {
    let removed = null;
    __onRemove((col, id) => { removed = { col, id }; });
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'member-1' }]);
    __seed('GiftRegistryItems', [{ _id: 'i-1', registryId: 'r-1', productName: 'Futon' }]);

    const result = await removeRegistryItem('r-1', 'i-1');
    expect(result.success).toBe(true);
    expect(removed.col).toBe('GiftRegistryItems');
  });

  it('rejects non-owner', async () => {
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'other-member' }]);
    __seed('GiftRegistryItems', [{ _id: 'i-1', registryId: 'r-1' }]);

    const result = await removeRegistryItem('r-1', 'i-1');
    expect(result.success).toBe(false);
  });

  it('rejects item from different registry', async () => {
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'member-1' }]);
    __seed('GiftRegistryItems', [{ _id: 'i-1', registryId: 'r-2' }]);

    const result = await removeRegistryItem('r-1', 'i-1');
    expect(result.success).toBe(false);
  });

  it('fails for invalid IDs', async () => {
    const result = await removeRegistryItem('', '');
    expect(result.success).toBe(false);
  });
});

// ── markItemPurchased ────────────────────────────────────────────────

describe('markItemPurchased', () => {
  it('marks item as purchased by guest', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('GiftRegistryItems', [
      { _id: 'i-1', registryId: 'r-1', quantity: 2, purchasedQuantity: 0 },
    ]);

    const result = await markItemPurchased('i-1', { buyerName: 'Bob', quantity: 1 });
    expect(result.success).toBe(true);
    expect(result.data.purchasedQuantity).toBe(1);
    expect(result.data.remaining).toBe(1);
    expect(updated.purchasedBy).toBe('Bob');
  });

  it('prevents over-purchasing', async () => {
    __seed('GiftRegistryItems', [
      { _id: 'i-1', registryId: 'r-1', quantity: 2, purchasedQuantity: 2 },
    ]);

    const result = await markItemPurchased('i-1', { buyerName: 'Bob', quantity: 1 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('fully purchased');
  });

  it('clamps purchase quantity to remaining', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('GiftRegistryItems', [
      { _id: 'i-1', registryId: 'r-1', quantity: 3, purchasedQuantity: 2 },
    ]);

    const result = await markItemPurchased('i-1', { buyerName: 'Charlie', quantity: 5 });
    expect(result.success).toBe(true);
    expect(result.data.purchasedQuantity).toBe(1);
    expect(updated.purchasedQuantity).toBe(3);
  });

  it('defaults buyer name to Anonymous', async () => {
    let updated = null;
    __onUpdate((col, item) => { updated = item; });
    __seed('GiftRegistryItems', [
      { _id: 'i-1', registryId: 'r-1', quantity: 1, purchasedQuantity: 0 },
    ]);

    await markItemPurchased('i-1', { quantity: 1 });
    expect(updated.purchasedBy).toBe('Anonymous');
  });

  it('fails for non-existent item', async () => {
    __seed('GiftRegistryItems', []);
    const result = await markItemPurchased('nonexistent', { quantity: 1 });
    expect(result.success).toBe(false);
  });

  it('fails for invalid item ID', async () => {
    const result = await markItemPurchased('', { quantity: 1 });
    expect(result.success).toBe(false);
  });

  it('fails with null data', async () => {
    const result = await markItemPurchased('i-1', null);
    expect(result.success).toBe(false);
  });
});

// ── deleteRegistry ───────────────────────────────────────────────────

describe('deleteRegistry', () => {
  it('deletes registry and all items', async () => {
    const removals = [];
    __onRemove((col, id) => { removals.push({ col, id }); });
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'member-1', title: 'Wedding' }]);
    __seed('GiftRegistryItems', [
      { _id: 'i-1', registryId: 'r-1' },
      { _id: 'i-2', registryId: 'r-1' },
    ]);

    const result = await deleteRegistry('r-1');
    expect(result.success).toBe(true);
    // Should have removed 2 items + 1 registry = 3 removals
    expect(removals.length).toBe(3);
  });

  it('rejects non-owner', async () => {
    __seed('GiftRegistries', [{ _id: 'r-1', memberId: 'other-member' }]);
    const result = await deleteRegistry('r-1');
    expect(result.success).toBe(false);
  });

  it('fails for invalid ID', async () => {
    const result = await deleteRegistry('');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await deleteRegistry('r-1');
    expect(result.success).toBe(false);
  });
});
