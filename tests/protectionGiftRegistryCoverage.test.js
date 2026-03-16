/**
 * Tests for protectionPlan.web.js and giftRegistry.web.js
 */
import { describe, it, expect, beforeEach } from 'vitest';
import wixData, {
  __reset as resetData,
  __seed as seed,
  __onInsert,
  __onUpdate,
  __onRemove,
} from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

// ── protectionPlan ─────────────────────────────────────────────────────
import {
  getProtectionPlans,
  addProtectionPlan,
  removeProtectionPlan,
  getProtectionPlanSummary,
  PLAN_TIERS,
} from 'backend/protectionPlan.web';

// ── giftRegistry ───────────────────────────────────────────────────────
import {
  createRegistry,
  getMyRegistries,
  getRegistry,
  getPublicRegistry,
  addRegistryItem,
  removeRegistryItem,
  markItemPurchased,
  deleteRegistry,
} from 'backend/giftRegistry.web';

const MEMBER = { _id: 'member1', loginEmail: 'member@test.com' };
const PRODUCT = {
  _id: 'prod-sofa',
  name: 'Classic Futon Sofa',
  price: 499.99,
};

beforeEach(() => {
  resetData();
  resetMembers();
});

// ═══════════════════════════════════════════════════════════════════════
// protectionPlan.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('protectionPlan — PLAN_TIERS export', () => {
  it('has three tiers', () => {
    expect(Object.keys(PLAN_TIERS)).toEqual(['basic', 'extended', 'premium']);
  });

  it('basic is 1yr at 6%', () => {
    expect(PLAN_TIERS.basic.durationYears).toBe(1);
    expect(PLAN_TIERS.basic.pricePercent).toBe(6);
  });

  it('extended is 3yr at 12%', () => {
    expect(PLAN_TIERS.extended.durationYears).toBe(3);
    expect(PLAN_TIERS.extended.pricePercent).toBe(12);
  });

  it('premium is 5yr at 18%', () => {
    expect(PLAN_TIERS.premium.durationYears).toBe(5);
    expect(PLAN_TIERS.premium.pricePercent).toBe(18);
  });
});

describe('protectionPlan — getProtectionPlans', () => {
  beforeEach(() => {
    seed('Stores/Products', [PRODUCT]);
  });

  it('returns empty for null productIds', async () => {
    const r = await getProtectionPlans(null);
    expect(r.success).toBe(true);
    expect(r.plans).toEqual([]);
  });

  it('returns empty for empty array', async () => {
    const r = await getProtectionPlans([]);
    expect(r.success).toBe(true);
    expect(r.plans).toEqual([]);
  });

  it('returns empty for invalid IDs', async () => {
    const r = await getProtectionPlans(['<script>']);
    expect(r.success).toBe(true);
    expect(r.plans).toEqual([]);
  });

  it('returns plans for valid product', async () => {
    const r = await getProtectionPlans(['prod-sofa']);
    expect(r.success).toBe(true);
    expect(r.plans).toHaveLength(1);
    expect(r.plans[0].productId).toBe('prod-sofa');
    expect(r.plans[0].productName).toBe('Classic Futon Sofa');
    expect(r.plans[0].productPrice).toBe(499.99);
    expect(r.plans[0].tiers).toHaveLength(3);
  });

  it('calculates tier prices correctly', async () => {
    const r = await getProtectionPlans(['prod-sofa']);
    const tiers = r.plans[0].tiers;
    // basic: 499.99 * 6% = 30.00
    expect(tiers[0].price).toBe(30);
    // extended: 499.99 * 12% = 60.00
    expect(tiers[1].price).toBe(60);
    // premium: 499.99 * 18% = 90.00
    expect(tiers[2].price).toBe(90);
  });

  it('skips product with no price', async () => {
    seed('Stores/Products', [{ _id: 'prod-free', name: 'Free Sample', price: 0 }]);
    const r = await getProtectionPlans(['prod-free']);
    expect(r.plans).toHaveLength(0);
  });

  it('skips nonexistent product', async () => {
    const r = await getProtectionPlans(['prod-nonexistent']);
    expect(r.plans).toHaveLength(0);
  });

  it('limits to 10 products', async () => {
    const products = Array.from({ length: 15 }, (_, i) => ({
      _id: `prod-${i}`,
      name: `Product ${i}`,
      price: 100,
    }));
    seed('Stores/Products', products);
    const ids = products.map(p => p._id);
    const r = await getProtectionPlans(ids);
    expect(r.plans.length).toBeLessThanOrEqual(10);
  });

  it('includes existing selection for session', async () => {
    seed('ProtectionPlanSelections', [{
      _id: 'sel-1',
      sessionId: 'sess-123',
      productId: 'prod-sofa',
      tier: 'premium',
    }]);
    const r = await getProtectionPlans(['prod-sofa'], 'sess-123');
    expect(r.plans[0].selectedTier).toBe('premium');
  });

  it('selectedTier is null when no selection', async () => {
    const r = await getProtectionPlans(['prod-sofa']);
    expect(r.plans[0].selectedTier).toBeNull();
  });
});

describe('protectionPlan — addProtectionPlan', () => {
  beforeEach(() => {
    seed('Stores/Products', [PRODUCT]);
  });

  it('rejects missing productId', async () => {
    const r = await addProtectionPlan(null, 'basic', 'sess');
    expect(r.success).toBe(false);
  });

  it('rejects missing tier', async () => {
    const r = await addProtectionPlan('prod-sofa', null, 'sess');
    expect(r.success).toBe(false);
  });

  it('rejects invalid tier', async () => {
    const r = await addProtectionPlan('prod-sofa', 'platinum', 'sess');
    expect(r.success).toBe(false);
  });

  it('rejects invalid productId format', async () => {
    const r = await addProtectionPlan('<script>', 'basic', 'sess');
    expect(r.success).toBe(false);
  });

  it('rejects nonexistent product', async () => {
    const r = await addProtectionPlan('prod-nope', 'basic', 'sess');
    expect(r.success).toBe(false);
  });

  it('adds basic plan', async () => {
    const r = await addProtectionPlan('prod-sofa', 'basic', 'sess-123');
    expect(r.success).toBe(true);
    expect(r.data.tier).toBe('basic');
    expect(r.data.price).toBe(30); // 499.99 * 6%
    expect(r.data.durationYears).toBe(1);
    expect(r.data.planName).toBe('1-Year Basic Protection');
  });

  it('adds premium plan', async () => {
    const r = await addProtectionPlan('prod-sofa', 'premium', 'sess-123');
    expect(r.success).toBe(true);
    expect(r.data.tier).toBe('premium');
    expect(r.data.price).toBe(90); // 499.99 * 18%
    expect(r.data.durationYears).toBe(5);
  });

  it('updates existing selection for same product+session', async () => {
    seed('ProtectionPlanSelections', [{
      _id: 'sel-existing',
      sessionId: 'sess-123',
      productId: 'prod-sofa',
      tier: 'basic',
      price: 30,
    }]);
    let updated = null;
    __onUpdate((coll, item) => { if (coll === 'ProtectionPlanSelections') updated = item; });
    const r = await addProtectionPlan('prod-sofa', 'premium', 'sess-123');
    expect(r.success).toBe(true);
    expect(r.data.tier).toBe('premium');
    expect(updated).not.toBeNull();
    expect(updated.tier).toBe('premium');
  });

  it('inserts new selection if none exists', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'ProtectionPlanSelections') inserted = item; });
    await addProtectionPlan('prod-sofa', 'extended', 'sess-new');
    expect(inserted).not.toBeNull();
    expect(inserted.tier).toBe('extended');
  });
});

describe('protectionPlan — removeProtectionPlan', () => {
  it('rejects missing productId', async () => {
    const r = await removeProtectionPlan(null, 'sess');
    expect(r.success).toBe(false);
  });

  it('rejects invalid productId', async () => {
    const r = await removeProtectionPlan('<script>', 'sess');
    expect(r.success).toBe(false);
  });

  it('succeeds even when no selection exists', async () => {
    const r = await removeProtectionPlan('prod-sofa', 'sess');
    expect(r.success).toBe(true);
  });

  it('removes existing selection', async () => {
    seed('ProtectionPlanSelections', [{
      _id: 'sel-del',
      sessionId: 'sess-123',
      productId: 'prod-sofa',
      tier: 'basic',
    }]);
    let removedId = null;
    __onRemove((coll, id) => { if (coll === 'ProtectionPlanSelections') removedId = id; });
    const r = await removeProtectionPlan('prod-sofa', 'sess-123');
    expect(r.success).toBe(true);
    expect(removedId).toBe('sel-del');
  });
});

describe('protectionPlan — getProtectionPlanSummary', () => {
  it('returns empty for null sessionId', async () => {
    const r = await getProtectionPlanSummary(null);
    expect(r.success).toBe(true);
    expect(r.data.selections).toEqual([]);
    expect(r.data.totalProtectionCost).toBe(0);
  });

  it('returns empty for empty session', async () => {
    const r = await getProtectionPlanSummary('');
    expect(r.success).toBe(true);
    expect(r.data.selections).toEqual([]);
  });

  it('returns selections with total cost', async () => {
    seed('ProtectionPlanSelections', [
      {
        _id: 'sel-1',
        sessionId: 'sess-123',
        productId: 'prod-sofa',
        productName: 'Classic Futon',
        tier: 'basic',
        price: 30,
        durationYears: 1,
      },
      {
        _id: 'sel-2',
        sessionId: 'sess-123',
        productId: 'prod-chair',
        productName: 'Accent Chair',
        tier: 'premium',
        price: 45,
        durationYears: 5,
      },
    ]);
    const r = await getProtectionPlanSummary('sess-123');
    expect(r.success).toBe(true);
    expect(r.data.selections).toHaveLength(2);
    expect(r.data.totalProtectionCost).toBe(75);
  });

  it('maps planName from PLAN_TIERS', async () => {
    seed('ProtectionPlanSelections', [{
      _id: 'sel-1',
      sessionId: 'sess-123',
      productId: 'prod-sofa',
      productName: 'Sofa',
      tier: 'extended',
      price: 60,
      durationYears: 3,
    }]);
    const r = await getProtectionPlanSummary('sess-123');
    expect(r.data.selections[0].planName).toBe('3-Year Extended Protection');
  });

  it('handles item with no price', async () => {
    seed('ProtectionPlanSelections', [{
      _id: 'sel-noprice',
      sessionId: 'sess-123',
      productId: 'prod-x',
      productName: 'X',
      tier: 'basic',
      durationYears: 1,
      // price missing
    }]);
    const r = await getProtectionPlanSummary('sess-123');
    expect(r.data.selections[0].price).toBe(0);
    expect(r.data.totalProtectionCost).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// giftRegistry.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('giftRegistry — createRegistry', () => {
  beforeEach(() => {
    __setMember(MEMBER);
  });

  it('rejects null data', async () => {
    const r = await createRegistry(null);
    expect(r.success).toBe(false);
  });

  it('rejects non-object data', async () => {
    const r = await createRegistry('string');
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated user', async () => {
    __setMember(null);
    const r = await createRegistry({ title: 'My Registry' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('authenticated');
  });

  it('rejects missing title', async () => {
    const r = await createRegistry({ title: '' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Title');
  });

  it('creates registry with valid data', async () => {
    const r = await createRegistry({
      title: 'Wedding Registry',
      occasion: 'wedding',
      eventDate: '2026-06-15',
      message: 'Thank you for celebrating with us!',
      isPublic: true,
    });
    expect(r.success).toBe(true);
    expect(r.data._id).toBeDefined();
    expect(r.data.slug).toBeDefined();
    expect(r.data.title).toBe('Wedding Registry');
  });

  it('defaults occasion to other if invalid', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftRegistries') inserted = item; });
    await createRegistry({ title: 'Party', occasion: 'rave' });
    expect(inserted.occasion).toBe('other');
  });

  it('generates URL-safe slug', async () => {
    const r = await createRegistry({ title: 'My Special Registry!' });
    expect(r.data.slug).toMatch(/^my-special-registry-[a-z0-9]+$/);
  });

  it('enforces max registries per member', async () => {
    // Seed 10 existing registries
    const existing = Array.from({ length: 10 }, (_, i) => ({
      _id: `reg-${i}`,
      memberId: 'member1',
      title: `Registry ${i}`,
    }));
    seed('GiftRegistries', existing);
    const r = await createRegistry({ title: 'One Too Many' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('10');
  });

  it('accepts all valid occasions', async () => {
    for (const occasion of ['wedding', 'housewarming', 'dorm', 'baby', 'holiday', 'other']) {
      resetData();
      let inserted = null;
      __onInsert((coll, item) => { if (coll === 'GiftRegistries') inserted = item; });
      await createRegistry({ title: `${occasion} registry`, occasion });
      expect(inserted.occasion).toBe(occasion);
    }
  });

  it('handles null eventDate', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftRegistries') inserted = item; });
    await createRegistry({ title: 'No Date' });
    expect(inserted.eventDate).toBeNull();
  });
});

describe('giftRegistry — getMyRegistries', () => {
  beforeEach(() => {
    __setMember(MEMBER);
    seed('GiftRegistries', [
      {
        _id: 'reg-1',
        memberId: 'member1',
        title: 'Wedding',
        slug: 'wedding-abc',
        occasion: 'wedding',
        isPublic: true,
        _createdDate: new Date('2025-06-01'),
      },
    ]);
    seed('GiftRegistryItems', [
      { _id: 'item-1', registryId: 'reg-1', productName: 'Sofa' },
      { _id: 'item-2', registryId: 'reg-1', productName: 'Chair' },
    ]);
  });

  it('rejects unauthenticated', async () => {
    __setMember(null);
    const r = await getMyRegistries();
    expect(r.success).toBe(false);
  });

  it('returns registries with item counts', async () => {
    const r = await getMyRegistries();
    expect(r.success).toBe(true);
    expect(r.data.registries).toHaveLength(1);
    expect(r.data.registries[0].title).toBe('Wedding');
    expect(r.data.registries[0].itemCount).toBe(2);
  });

  it('returns empty for member with no registries', async () => {
    __setMember({ _id: 'member-nobody' });
    const r = await getMyRegistries();
    expect(r.success).toBe(true);
    expect(r.data.registries).toHaveLength(0);
  });
});

describe('giftRegistry — getRegistry', () => {
  beforeEach(() => {
    __setMember(MEMBER);
    seed('GiftRegistries', [{
      _id: 'reg-1',
      memberId: 'member1',
      title: 'Wedding',
      slug: 'wedding-abc',
    }]);
    seed('GiftRegistryItems', [{
      _id: 'item-1',
      registryId: 'reg-1',
      productId: 'prod-sofa',
      productName: 'Sofa',
      productPrice: 499,
      imageUrl: 'https://img.test/sofa.jpg',
      quantity: 2,
      purchasedQuantity: 1,
      purchasedBy: 'Jane',
      priority: 1,
      notes: 'Prefer walnut',
    }]);
  });

  it('rejects invalid ID', async () => {
    const r = await getRegistry('<script>');
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated', async () => {
    __setMember(null);
    const r = await getRegistry('reg-1');
    expect(r.success).toBe(false);
  });

  it('rejects registry owned by another member', async () => {
    __setMember({ _id: 'other-member' });
    const r = await getRegistry('reg-1');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('returns full registry with items', async () => {
    const r = await getRegistry('reg-1');
    expect(r.success).toBe(true);
    expect(r.data.title).toBe('Wedding');
    expect(r.data.items).toHaveLength(1);
    const item = r.data.items[0];
    expect(item.productName).toBe('Sofa');
    expect(item.quantity).toBe(2);
    expect(item.purchasedQuantity).toBe(1);
    expect(item.priority).toBe(1);
    expect(item.notes).toBe('Prefer walnut');
  });

  it('returns nonexistent registry as not found', async () => {
    const r = await getRegistry('reg-nope');
    expect(r.success).toBe(false);
  });
});

describe('giftRegistry — getPublicRegistry', () => {
  beforeEach(() => {
    seed('GiftRegistries', [{
      _id: 'reg-pub',
      memberId: 'member1',
      title: 'Public Wedding',
      slug: 'public-wedding-abc',
      occasion: 'wedding',
      eventDate: new Date('2026-06-15'),
      message: 'Welcome!',
      isPublic: true,
    }]);
    seed('GiftRegistryItems', [{
      _id: 'item-pub-1',
      registryId: 'reg-pub',
      productId: 'prod-sofa',
      productName: 'Sofa',
      productPrice: 499,
      imageUrl: 'https://img.test/sofa.jpg',
      quantity: 2,
      purchasedQuantity: 1,
      purchasedBy: 'Jane',
      priority: 1,
      notes: 'Walnut',
    }]);
  });

  it('rejects null slug', async () => {
    const r = await getPublicRegistry(null);
    expect(r.success).toBe(false);
  });

  it('rejects empty slug', async () => {
    const r = await getPublicRegistry('');
    expect(r.success).toBe(false);
  });

  it('returns not found for nonexistent slug', async () => {
    const r = await getPublicRegistry('no-such-slug');
    expect(r.success).toBe(false);
  });

  it('returns not found for private registry', async () => {
    resetData();
    seed('GiftRegistries', [{
      _id: 'reg-priv',
      memberId: 'member1',
      title: 'Private',
      slug: 'private-slug',
      isPublic: false,
    }]);
    const r = await getPublicRegistry('private-slug');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('returns public registry with items', async () => {
    const r = await getPublicRegistry('public-wedding-abc');
    expect(r.success).toBe(true);
    expect(r.data.title).toBe('Public Wedding');
    expect(r.data.items).toHaveLength(1);
  });

  it('calculates remaining quantity', async () => {
    const r = await getPublicRegistry('public-wedding-abc');
    expect(r.data.items[0].remaining).toBe(1); // qty 2 - purchased 1
  });

  it('does not expose purchasedBy', async () => {
    const r = await getPublicRegistry('public-wedding-abc');
    // Public view should not expose purchasedBy (it's not in the map)
    expect(r.data.items[0].purchasedBy).toBeUndefined();
  });
});

describe('giftRegistry — addRegistryItem', () => {
  beforeEach(() => {
    __setMember(MEMBER);
    seed('GiftRegistries', [{
      _id: 'reg-1',
      memberId: 'member1',
      title: 'Wedding',
    }]);
  });

  it('rejects invalid registryId', async () => {
    const r = await addRegistryItem('<bad>', { productName: 'Sofa' });
    expect(r.success).toBe(false);
  });

  it('rejects null item', async () => {
    const r = await addRegistryItem('reg-1', null);
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated', async () => {
    __setMember(null);
    const r = await addRegistryItem('reg-1', { productName: 'Sofa' });
    expect(r.success).toBe(false);
  });

  it('rejects registry not owned by member', async () => {
    __setMember({ _id: 'other-member' });
    const r = await addRegistryItem('reg-1', { productName: 'Sofa' });
    expect(r.success).toBe(false);
  });

  it('rejects missing productName', async () => {
    const r = await addRegistryItem('reg-1', { productName: '' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Product name');
  });

  it('adds item successfully', async () => {
    const r = await addRegistryItem('reg-1', {
      productId: 'prod-sofa',
      productName: 'Classic Futon',
      productPrice: 499,
      imageUrl: 'https://img.test/sofa.jpg',
      quantity: 2,
      priority: 1,
      notes: 'Prefer walnut',
    });
    expect(r.success).toBe(true);
    expect(r.data._id).toBeDefined();
    expect(r.data.productName).toBe('Classic Futon');
    expect(r.data.quantity).toBe(2);
  });

  it('clamps quantity to 1-10', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftRegistryItems') inserted = item; });
    await addRegistryItem('reg-1', { productName: 'Sofa', quantity: 50 });
    expect(inserted.quantity).toBe(10);
  });

  it('defaults quantity to 1', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftRegistryItems') inserted = item; });
    await addRegistryItem('reg-1', { productName: 'Sofa' });
    expect(inserted.quantity).toBe(1);
  });

  it('defaults priority to 2', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftRegistryItems') inserted = item; });
    await addRegistryItem('reg-1', { productName: 'Sofa' });
    expect(inserted.priority).toBe(2);
  });

  it('rejects invalid priority (falls to default)', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftRegistryItems') inserted = item; });
    await addRegistryItem('reg-1', { productName: 'Sofa', priority: 5 });
    expect(inserted.priority).toBe(2);
  });

  it('enforces max items per registry', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      _id: `item-${i}`,
      registryId: 'reg-1',
      productName: `Product ${i}`,
    }));
    seed('GiftRegistryItems', items);
    const r = await addRegistryItem('reg-1', { productName: 'One More' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('50');
  });

  it('sanitizes notes', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftRegistryItems') inserted = item; });
    await addRegistryItem('reg-1', {
      productName: 'Sofa',
      notes: '<script>alert(1)</script>Walnut',
    });
    expect(inserted.notes).not.toContain('<script>');
  });

  it('handles negative productPrice', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftRegistryItems') inserted = item; });
    await addRegistryItem('reg-1', { productName: 'Sofa', productPrice: -100 });
    expect(inserted.productPrice).toBe(0);
  });
});

describe('giftRegistry — removeRegistryItem', () => {
  beforeEach(() => {
    __setMember(MEMBER);
    seed('GiftRegistries', [{
      _id: 'reg-1',
      memberId: 'member1',
      title: 'Wedding',
    }]);
    seed('GiftRegistryItems', [{
      _id: 'item-1',
      registryId: 'reg-1',
      productName: 'Sofa',
    }]);
  });

  it('rejects invalid registryId', async () => {
    const r = await removeRegistryItem('<bad>', 'item-1');
    expect(r.success).toBe(false);
  });

  it('rejects invalid itemId', async () => {
    const r = await removeRegistryItem('reg-1', '<bad>');
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated', async () => {
    __setMember(null);
    const r = await removeRegistryItem('reg-1', 'item-1');
    expect(r.success).toBe(false);
  });

  it('rejects non-owner', async () => {
    __setMember({ _id: 'other-member' });
    const r = await removeRegistryItem('reg-1', 'item-1');
    expect(r.success).toBe(false);
  });

  it('rejects item not in registry', async () => {
    seed('GiftRegistryItems', [
      { _id: 'item-other', registryId: 'reg-other', productName: 'Other' },
    ]);
    const r = await removeRegistryItem('reg-1', 'item-other');
    expect(r.success).toBe(false);
  });

  it('removes item successfully', async () => {
    let removedId = null;
    __onRemove((coll, id) => { if (coll === 'GiftRegistryItems') removedId = id; });
    const r = await removeRegistryItem('reg-1', 'item-1');
    expect(r.success).toBe(true);
    expect(removedId).toBe('item-1');
  });
});

describe('giftRegistry — markItemPurchased', () => {
  beforeEach(() => {
    seed('GiftRegistryItems', [{
      _id: 'item-mark',
      registryId: 'reg-1',
      productName: 'Sofa',
      quantity: 3,
      purchasedQuantity: 0,
    }]);
  });

  it('rejects invalid itemId', async () => {
    const r = await markItemPurchased('<bad>', { quantity: 1 });
    expect(r.success).toBe(false);
  });

  it('rejects null data', async () => {
    const r = await markItemPurchased('item-mark', null);
    expect(r.success).toBe(false);
  });

  it('rejects nonexistent item', async () => {
    const r = await markItemPurchased('item-nope', { quantity: 1 });
    expect(r.success).toBe(false);
  });

  it('marks one item purchased', async () => {
    const r = await markItemPurchased('item-mark', { buyerName: 'Jane', quantity: 1 });
    expect(r.success).toBe(true);
    expect(r.data.purchasedQuantity).toBe(1);
    expect(r.data.remaining).toBe(2);
  });

  it('marks multiple purchased', async () => {
    const r = await markItemPurchased('item-mark', { buyerName: 'Jane', quantity: 2 });
    expect(r.success).toBe(true);
    expect(r.data.purchasedQuantity).toBe(2);
    expect(r.data.remaining).toBe(1);
  });

  it('caps at remaining quantity', async () => {
    const r = await markItemPurchased('item-mark', { quantity: 10 });
    expect(r.data.purchasedQuantity).toBe(3); // only 3 remaining
    expect(r.data.remaining).toBe(0);
  });

  it('rejects already fully purchased', async () => {
    resetData();
    seed('GiftRegistryItems', [{
      _id: 'item-full',
      registryId: 'reg-1',
      quantity: 2,
      purchasedQuantity: 2,
    }]);
    const r = await markItemPurchased('item-full', { quantity: 1 });
    expect(r.success).toBe(false);
    expect(r.error).toContain('fully purchased');
  });

  it('defaults buyerName to Anonymous', async () => {
    let updated = null;
    __onUpdate((coll, item) => { if (coll === 'GiftRegistryItems') updated = item; });
    await markItemPurchased('item-mark', { quantity: 1 });
    expect(updated.purchasedBy).toBe('Anonymous');
  });

  it('defaults quantity to 1', async () => {
    const r = await markItemPurchased('item-mark', { buyerName: 'X' });
    expect(r.data.purchasedQuantity).toBe(1);
  });
});

describe('giftRegistry — deleteRegistry', () => {
  beforeEach(() => {
    __setMember(MEMBER);
    seed('GiftRegistries', [{
      _id: 'reg-del',
      memberId: 'member1',
      title: 'To Delete',
    }]);
    seed('GiftRegistryItems', [
      { _id: 'item-d1', registryId: 'reg-del', productName: 'Sofa' },
      { _id: 'item-d2', registryId: 'reg-del', productName: 'Chair' },
    ]);
  });

  it('rejects invalid registryId', async () => {
    const r = await deleteRegistry('<bad>');
    expect(r.success).toBe(false);
  });

  it('rejects unauthenticated', async () => {
    __setMember(null);
    const r = await deleteRegistry('reg-del');
    expect(r.success).toBe(false);
  });

  it('rejects non-owner', async () => {
    __setMember({ _id: 'other-member' });
    const r = await deleteRegistry('reg-del');
    expect(r.success).toBe(false);
  });

  it('deletes registry and all items', async () => {
    const removedIds = [];
    __onRemove((coll, id) => { removedIds.push({ coll, id }); });
    const r = await deleteRegistry('reg-del');
    expect(r.success).toBe(true);
    // Should remove 2 items + 1 registry
    expect(removedIds).toHaveLength(3);
    const itemRemoves = removedIds.filter(r => r.coll === 'GiftRegistryItems');
    const regRemoves = removedIds.filter(r => r.coll === 'GiftRegistries');
    expect(itemRemoves).toHaveLength(2);
    expect(regRemoves).toHaveLength(1);
  });

  it('returns not found for nonexistent registry', async () => {
    const r = await deleteRegistry('reg-nope');
    expect(r.success).toBe(false);
  });
});
