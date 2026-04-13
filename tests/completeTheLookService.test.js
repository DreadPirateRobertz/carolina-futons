/**
 * Tests for CF-cxe: completeTheLookService backend.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __setInsertError, __setUpdateError, __setQueryError, __getInserted, __getUpdated } from './__mocks__/wix-data.js';
import { getCompleteTheLook, createLook, updateLook } from '../src/backend/completeTheLookService.web.js';

const COLLECTION = 'CompleteTheLook';

const sampleItems = [
  { productId: 'rug-01', imageUrl: 'https://img/rug.jpg', name: 'Area Rug', price: 199 },
  { productId: 'lamp-01', imageUrl: 'https://img/lamp.jpg', name: 'Floor Lamp', price: 89 },
];

describe('getCompleteTheLook', () => {
  beforeEach(() => __reset());

  it('returns a look with items when configured', async () => {
    __seed(COLLECTION, [{ _id: 'l1', productId: 'futon-a', roomHeroImage: 'hero.jpg', roomItems: sampleItems }]);
    const look = await getCompleteTheLook('futon-a');
    expect(look).not.toBeNull();
    expect(look.productId).toBe('futon-a');
    expect(look.roomHeroImage).toBe('hero.jpg');
    expect(look.roomItems).toHaveLength(2);
    expect(look.roomItems[0].name).toBe('Area Rug');
  });

  it('returns null when no look configured for product', async () => {
    __seed(COLLECTION, []);
    const look = await getCompleteTheLook('futon-a');
    expect(look).toBeNull();
  });

  it('returns null for invalid productId', async () => {
    __seed(COLLECTION, [{ _id: 'l1', productId: 'ok', roomItems: sampleItems }]);
    expect(await getCompleteTheLook('')).toBeNull();
    expect(await getCompleteTheLook(null)).toBeNull();
    expect(await getCompleteTheLook('has spaces')).toBeNull();
  });

  it('returns null on query error', async () => {
    __setQueryError(COLLECTION, new Error('db down'));
    const look = await getCompleteTheLook('futon-a');
    expect(look).toBeNull();
  });

  it('filters malformed items from roomItems', async () => {
    __seed(COLLECTION, [{
      _id: 'l1', productId: 'futon-a',
      roomItems: [null, {}, { productId: 'valid', name: 'X', price: 10 }, { productId: 'valid2' }],
    }]);
    const look = await getCompleteTheLook('futon-a');
    expect(look.roomItems).toHaveLength(2);
    expect(look.roomItems[0].productId).toBe('valid');
    expect(look.roomItems[1].productId).toBe('valid2');
  });

  it('coerces non-numeric price to 0', async () => {
    __seed(COLLECTION, [{ _id: 'l1', productId: 'futon-a', roomItems: [{ productId: 'p', price: 'bad' }] }]);
    const look = await getCompleteTheLook('futon-a');
    expect(look.roomItems[0].price).toBe(0);
  });

  it('caps roomItems at 12', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ productId: `p${i}`, name: `n${i}`, price: 1 }));
    __seed(COLLECTION, [{ _id: 'l1', productId: 'futon-a', roomItems: many }]);
    const look = await getCompleteTheLook('futon-a');
    expect(look.roomItems).toHaveLength(12);
  });
});

describe('createLook', () => {
  beforeEach(() => __reset());

  it('inserts a look with sanitized items', async () => {
    const res = await createLook({ productId: 'futon-a', roomHeroImage: 'h.jpg', roomItems: sampleItems });
    expect(res.success).toBe(true);
    expect(res.look.productId).toBe('futon-a');
    const inserted = __getInserted(COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].roomItems).toHaveLength(2);
  });

  it('rejects invalid productId', async () => {
    const res = await createLook({ productId: '' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('invalid-productId');
  });

  it('rejects missing input', async () => {
    const res = await createLook(null);
    expect(res.success).toBe(false);
    expect(res.error).toBe('invalid-input');
  });

  it('returns failure on insert error', async () => {
    __setInsertError(COLLECTION, new Error('boom'));
    const res = await createLook({ productId: 'futon-a' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('insert-failed');
  });
});

describe('updateLook', () => {
  beforeEach(() => __reset());

  it('updates an existing look', async () => {
    __seed(COLLECTION, [{ _id: 'l1', productId: 'futon-a', roomItems: [] }]);
    const res = await updateLook({ _id: 'l1', productId: 'futon-a', roomItems: sampleItems });
    expect(res.success).toBe(true);
    const updated = __getUpdated(COLLECTION);
    expect(updated).toHaveLength(1);
    expect(updated[0].roomItems).toHaveLength(2);
  });

  it('rejects missing _id', async () => {
    const res = await updateLook({ productId: 'futon-a' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('invalid-input');
  });

  it('returns failure on update error', async () => {
    __setUpdateError(COLLECTION, new Error('boom'));
    const res = await updateLook({ _id: 'l1', productId: 'futon-a' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('update-failed');
  });
});
