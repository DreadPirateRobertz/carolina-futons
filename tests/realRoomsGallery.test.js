/**
 * @file realRoomsGallery.test.js
 * @description Tests for Real Rooms Shoppable Gallery backend (CF-v62e).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { withRateLimit } from './helpers/withRateLimit.js';

import {
  submitRoomPhoto,
  getGalleryPhotos,
  getPhotoBySlug,
  approvePhoto,
  _COLLECTION,
  _POINTS_PER_PHOTO,
  _MAX_TAGS_PER_PHOTO,
  _MAX_PHOTOS_PER_MEMBER,
} from '../src/backend/realRoomsGallery.web.js';

beforeEach(() => {
  __reset();
  __setMember({ _id: 'member-1', contactDetails: { firstName: 'Sarah', lastName: 'M' } });
});

// ── Constants ────────────────────────────────────────────────────────

describe('Real Rooms constants', () => {
  it('awards 150 points per approved photo', () => {
    expect(_POINTS_PER_PHOTO).toBe(150);
  });

  it('allows max 8 tags per photo', () => {
    expect(_MAX_TAGS_PER_PHOTO).toBe(8);
  });

  it('allows max 20 photos per member', () => {
    expect(_MAX_PHOTOS_PER_MEMBER).toBe(20);
  });
});

// ── submitRoomPhoto ──────────────────────────────────────────────────

describe('submitRoomPhoto', () => {
  it('submits a photo with tags and location', async () => {
    withRateLimit('RealRoomsRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const result = await submitRoomPhoto({
      imageUrl: 'wix:image://v1/abc123/photo.jpg',
      city: 'Asheville',
      state: 'NC',
      caption: 'Love my new futon!',
      tags: [
        { productId: 'prod-1', productName: 'Kodiak Futon Frame', x: 45, y: 60 },
        { productId: 'prod-2', productName: 'Moonshadow Mattress', x: 55, y: 40 },
      ],
    }, 'member-1');

    expect(result.success).toBe(true);
    expect(result.data.tagCount).toBe(2);
    expect(result.data.status).toBe('pending');
    expect(result.data.slug).toContain('asheville-nc');
    expect(inserted.status).toBe('pending');
    expect(inserted.altText).toContain('Asheville');
    expect(inserted.altText).toContain('Kodiak Futon Frame');
  });

  it('generates SEO alt text from product names and location', async () => {
    withRateLimit('RealRoomsRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    await submitRoomPhoto({
      imageUrl: 'wix:image://v1/xyz/photo.jpg',
      city: 'Portland',
      state: 'OR',
      caption: '',
      tags: [{ productId: 'p1', productName: 'Seattle Frame', x: 50, y: 50 }],
    }, 'member-1');

    expect(inserted.altText).toBe("Seattle Frame in a real customer's home in Portland, OR");
  });

  it('rejects without authentication', async () => {
    const result = await submitRoomPhoto({
      imageUrl: 'url', city: 'X', state: 'NC', caption: '', tags: [],
    }, null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('rejects without image', async () => {
    withRateLimit('RealRoomsRateLimit', { key: 'member-1' });
    const result = await submitRoomPhoto({
      imageUrl: '', city: 'X', state: 'NC', caption: '', tags: [],
    }, 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Photo');
  });

  it('rejects without location', async () => {
    withRateLimit('RealRoomsRateLimit', { key: 'member-1' });
    const result = await submitRoomPhoto({
      imageUrl: 'url', city: '', state: '', caption: '', tags: [],
    }, 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Location');
  });

  it('caps tags at MAX_TAGS_PER_PHOTO', async () => {
    withRateLimit('RealRoomsRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const tags = Array.from({ length: 15 }, (_, i) => ({
      productId: `prod-${i}`, productName: `Product ${i}`, x: i * 5, y: i * 5,
    }));

    await submitRoomPhoto({
      imageUrl: 'url', city: 'Test', state: 'NC', caption: '', tags,
    }, 'member-1');

    const parsedTags = JSON.parse(inserted.tags);
    expect(parsedTags).toHaveLength(8);
  });

  it('clamps tag coordinates to 0-100', async () => {
    withRateLimit('RealRoomsRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    await submitRoomPhoto({
      imageUrl: 'url', city: 'Test', state: 'NC', caption: '',
      tags: [{ productId: 'p1', productName: 'Test', x: -10, y: 150 }],
    }, 'member-1');

    const parsedTags = JSON.parse(inserted.tags);
    expect(parsedTags[0].x).toBe(0);
    expect(parsedTags[0].y).toBe(100);
  });
});

// ── getGalleryPhotos ─────────────────────────────────────────────────

describe('getGalleryPhotos', () => {
  it('returns approved photos sorted by newest', async () => {
    __seed(_COLLECTION, [
      { _id: 'p1', imageUrl: 'url1', city: 'Asheville', state: 'NC', memberName: 'Sarah M.', caption: '', slug: 'slug1', tags: '[]', altText: 'alt1', status: 'approved', createdAt: new Date('2026-03-01') },
      { _id: 'p2', imageUrl: 'url2', city: 'Portland', state: 'OR', memberName: 'Mike T.', caption: 'Great!', slug: 'slug2', tags: '[]', altText: 'alt2', status: 'approved', createdAt: new Date('2026-03-15') },
      { _id: 'p3', imageUrl: 'url3', city: 'Denver', state: 'CO', memberName: 'Lisa K.', caption: '', slug: 'slug3', tags: '[]', altText: 'alt3', status: 'pending', createdAt: new Date('2026-03-20') },
    ]);

    const result = await getGalleryPhotos({ limit: 10 });
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(2); // only approved
  });

  it('filters by state', async () => {
    __seed(_COLLECTION, [
      { _id: 'p1', state: 'NC', status: 'approved', tags: '[]', createdAt: new Date() },
      { _id: 'p2', state: 'OR', status: 'approved', tags: '[]', createdAt: new Date() },
    ]);

    const result = await getGalleryPhotos({ state: 'NC' });
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].state).toBe('NC');
  });

  it('parses JSON tags', async () => {
    const tags = [{ productId: 'p1', productName: 'Frame', x: 50, y: 50 }];
    __seed(_COLLECTION, [
      { _id: 'p1', status: 'approved', tags: JSON.stringify(tags), createdAt: new Date() },
    ]);

    const result = await getGalleryPhotos();
    expect(result.photos[0].tags).toHaveLength(1);
    expect(result.photos[0].tags[0].productId).toBe('p1');
  });

  it('handles empty gallery', async () => {
    const result = await getGalleryPhotos();
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(0);
  });
});

// ── getPhotoBySlug ───────────────────────────────────────────────────

describe('getPhotoBySlug', () => {
  it('returns photo by slug', async () => {
    __seed(_COLLECTION, [{
      _id: 'p1', slug: 'asheville-nc-kodiak-frame-abc123',
      status: 'approved', imageUrl: 'url', city: 'Asheville', state: 'NC',
      tags: '[]', altText: 'alt', memberName: 'Sarah', caption: '',
      createdAt: new Date(),
    }]);

    const result = await getPhotoBySlug('asheville-nc-kodiak-frame-abc123');
    expect(result.success).toBe(true);
    expect(result.photo.city).toBe('Asheville');
  });

  it('returns false for non-existent slug', async () => {
    const result = await getPhotoBySlug('nonexistent-slug');
    expect(result.success).toBe(false);
  });

  it('does not return pending photos', async () => {
    __seed(_COLLECTION, [{
      _id: 'p1', slug: 'test-slug', status: 'pending',
      tags: '[]', createdAt: new Date(),
    }]);

    const result = await getPhotoBySlug('test-slug');
    expect(result.success).toBe(false);
  });
});

// ── approvePhoto ─────────────────────────────────────────────────────

describe('approvePhoto', () => {
  it('approves a pending photo and sets points', async () => {
    __seed(_COLLECTION, [{
      _id: 'photo-pending', memberId: 'member-1', status: 'pending', pointsAwarded: 0,
    }]);

    let updatedItem = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updatedItem = item; });

    const result = await approvePhoto('photo-pending');
    expect(result.success).toBe(true);
    expect(updatedItem.status).toBe('approved');
    expect(updatedItem.pointsAwarded).toBe(150);
  });

  it('rejects approval of non-existent photo', async () => {
    const result = await approvePhoto('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects approval of already-approved photo', async () => {
    __seed(_COLLECTION, [{
      _id: 'photo-approved', memberId: 'member-1', status: 'approved',
    }]);

    const result = await approvePhoto('photo-approved');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already');
  });
});
