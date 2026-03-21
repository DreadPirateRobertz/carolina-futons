/**
 * @file communityGalleryService.test.js
 * @description Tests for CF-n2gh Community Gallery backend service.
 *
 * Covers:
 *  - sanitizeGalleryFilename: safe filenames, path traversal, URL injection, extensions
 *  - stripUrlsFromCaption: http/ftp/bare domains/emails stripped
 *  - validateDeepLinkRoute: allowlist enforcement, unknown routes, disallowed params
 *  - getGalleryPhotos: filter by roomType, pagination, approved-only, empty state
 *  - getGalleryRoomTypes: returns all room types with labels
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeGalleryFilename,
  stripUrlsFromCaption,
  validateDeepLinkRoute,
  getGalleryPhotos,
  getGalleryRoomTypes,
  GALLERY_ROOM_TYPES,
} from '../src/backend/communityGalleryService.web.js';

// ── wix-data mock ─────────────────────────────────────────────────────────

const mockQueryResult = { items: [], totalCount: 0 };
const mockQuery = {
  hasSome: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  find: vi.fn(async () => mockQueryResult),
};

vi.mock('wix-data', () => ({
  default: { query: vi.fn(() => mockQuery) },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: vi.fn((val, _max) => String(val).slice(0, _max)),
  validateId: vi.fn(v => v),
}));

function makePhoto(overrides = {}) {
  return {
    _id: 'p1',
    photoUrl: 'https://cdn.example.com/photo.jpg',
    photoCaption: 'Nice setup',
    memberName: 'Alice',
    roomType: 'bedroom',
    productId: 'prod-1',
    productName: 'Futon A',
    productSlug: 'futon-a',
    rating: 5,
    submittedAt: new Date('2025-01-01'),
    status: 'approved',
    ...overrides,
  };
}

function setMockItems(items, totalCount) {
  mockQueryResult.items = items;
  mockQueryResult.totalCount = totalCount ?? items.length;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.find.mockImplementation(async () => ({
    items: mockQueryResult.items,
    totalCount: mockQueryResult.totalCount,
  }));
  setMockItems([], 0);
});

// ═══════════════════════════════════════════════════════════════════
// sanitizeGalleryFilename
// ═══════════════════════════════════════════════════════════════════

describe('sanitizeGalleryFilename', () => {
  it('accepts a clean jpg filename', () => {
    const result = sanitizeGalleryFilename('photo.jpg');
    expect(result.safe).toBe(true);
    expect(result.filename).toBe('photo.jpg');
  });

  it('accepts alphanumeric with hyphens and underscores', () => {
    const result = sanitizeGalleryFilename('my-photo_2024.png');
    expect(result.safe).toBe(true);
    expect(result.filename).toBe('my-photo_2024.png');
  });

  it('rejects empty string', () => {
    expect(sanitizeGalleryFilename('').safe).toBe(false);
  });

  it('rejects non-string', () => {
    expect(sanitizeGalleryFilename(null).safe).toBe(false);
    expect(sanitizeGalleryFilename(42).safe).toBe(false);
  });

  it('rejects http URL embedded in filename', () => {
    expect(sanitizeGalleryFilename('https://evil.com/x.jpg').safe).toBe(false);
  });

  it('rejects ftp URL embedded in filename', () => {
    expect(sanitizeGalleryFilename('ftp://host/file.jpg').safe).toBe(false);
  });

  it('rejects path traversal with forward slash', () => {
    expect(sanitizeGalleryFilename('../../etc/passwd').safe).toBe(false);
  });

  it('rejects path traversal with backslash', () => {
    expect(sanitizeGalleryFilename('..\\evil.jpg').safe).toBe(false);
  });

  it('rejects no extension', () => {
    expect(sanitizeGalleryFilename('noextension').safe).toBe(false);
  });

  it('rejects multiple dots', () => {
    expect(sanitizeGalleryFilename('photo.evil.jpg').safe).toBe(false);
  });

  it('rejects leading dot', () => {
    expect(sanitizeGalleryFilename('.hidden.jpg').safe).toBe(false);
  });

  it('rejects disallowed extension', () => {
    expect(sanitizeGalleryFilename('shell.php').safe).toBe(false);
    expect(sanitizeGalleryFilename('script.js').safe).toBe(false);
  });

  it('accepts all allowed image extensions', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']) {
      expect(sanitizeGalleryFilename(`photo.${ext}`).safe).toBe(true);
    }
  });

  it('accepts uppercase extensions (case-insensitive)', () => {
    expect(sanitizeGalleryFilename('photo.JPG').safe).toBe(true);
  });

  it('strips special characters from filename', () => {
    const result = sanitizeGalleryFilename('photo (1)!@#.jpg');
    expect(result.safe).toBe(true);
    expect(result.filename).toBe('photo1.jpg');
  });
});

// ═══════════════════════════════════════════════════════════════════
// stripUrlsFromCaption
// ═══════════════════════════════════════════════════════════════════

describe('stripUrlsFromCaption', () => {
  it('returns empty string for non-string input', () => {
    expect(stripUrlsFromCaption(null)).toBe('');
    expect(stripUrlsFromCaption(42)).toBe('');
  });

  it('strips https URLs', () => {
    expect(stripUrlsFromCaption('Visit https://evil.com now')).not.toContain('https://');
  });

  it('strips http URLs', () => {
    expect(stripUrlsFromCaption('Go to http://spam.com today')).not.toContain('http://');
  });

  it('strips ftp URLs', () => {
    expect(stripUrlsFromCaption('ftp://files.example.com/x')).not.toContain('ftp://');
  });

  it('strips bare domain patterns', () => {
    const result = stripUrlsFromCaption('Check evil.com for details');
    expect(result).not.toContain('evil.com');
  });

  it('strips email addresses', () => {
    const result = stripUrlsFromCaption('Email me at spam@evil.com please');
    expect(result).not.toContain('@');
  });

  it('preserves normal text without URLs', () => {
    const caption = 'Love my new bedroom setup!';
    expect(stripUrlsFromCaption(caption)).toBe(caption);
  });

  it('truncates to 200 characters', () => {
    const long = 'A'.repeat(300);
    expect(stripUrlsFromCaption(long).length).toBeLessThanOrEqual(200);
  });

  it('collapses extra whitespace left by removed patterns', () => {
    const result = stripUrlsFromCaption('Nice https://evil.com setup');
    expect(result).not.toMatch(/\s{2,}/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// validateDeepLinkRoute
// ═══════════════════════════════════════════════════════════════════

describe('validateDeepLinkRoute', () => {
  it('accepts /gallery with allowed params', () => {
    const result = validateDeepLinkRoute('/gallery', { roomType: 'bedroom', page: '2' });
    expect(result.valid).toBe(true);
    expect(result.route).toBe('/gallery');
  });

  it('accepts /gallery with no params', () => {
    const result = validateDeepLinkRoute('/gallery');
    expect(result.valid).toBe(true);
  });

  it('accepts /gallery/photo with id param', () => {
    const result = validateDeepLinkRoute('/gallery/photo', { id: 'abc123' });
    expect(result.valid).toBe(true);
    expect(result.route).toBe('/gallery/photo');
  });

  it('accepts /product-page with slug param', () => {
    const result = validateDeepLinkRoute('/product-page', { slug: 'futon-a' });
    expect(result.valid).toBe(true);
  });

  it('rejects unknown route', () => {
    const result = validateDeepLinkRoute('/admin/delete');
    expect(result.valid).toBe(false);
    expect(result.route).toBe('/gallery');
    expect(result.params).toEqual({});
  });

  it('rejects non-string route', () => {
    expect(validateDeepLinkRoute(null).valid).toBe(false);
    expect(validateDeepLinkRoute(42).valid).toBe(false);
  });

  it('rejects disallowed param name for /gallery', () => {
    const result = validateDeepLinkRoute('/gallery', { roomType: 'bedroom', evil: 'payload' });
    expect(result.valid).toBe(false);
    expect(result.route).toBe('/gallery');
  });

  it('rejects disallowed param for /gallery/photo', () => {
    const result = validateDeepLinkRoute('/gallery/photo', { id: 'abc', extra: 'bad' });
    expect(result.valid).toBe(false);
  });

  it('returns safe fallback on rejection', () => {
    const result = validateDeepLinkRoute('/unknown');
    expect(result.route).toBe('/gallery');
    expect(result.params).toEqual({});
  });

  it('sanitizes param values', () => {
    const result = validateDeepLinkRoute('/gallery', { roomType: 'bedroom' });
    expect(result.params.roomType).toBe('bedroom');
  });
});

// ═══════════════════════════════════════════════════════════════════
// getGalleryPhotos
// ═══════════════════════════════════════════════════════════════════

describe('getGalleryPhotos', () => {
  it('returns success:true with photos array on happy path', async () => {
    setMockItems([makePhoto()], 1);
    const result = await getGalleryPhotos(null, 1, 12);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.photos)).toBe(true);
    expect(result.photos.length).toBe(1);
  });

  it('maps photo fields correctly', async () => {
    setMockItems([makePhoto({ memberName: 'Bob', photoCaption: 'Cool room' })], 1);
    const result = await getGalleryPhotos(null, 1, 12);
    const photo = result.photos[0];
    expect(photo.id).toBe('p1');
    expect(photo.customerName).toBe('Bob');
    expect(photo.photoCaption).toBe('Cool room');
    expect(photo.roomType).toBe('bedroom');
    expect(photo.isFeatured).toBe(false);
  });

  it('marks featured photos correctly', async () => {
    setMockItems([makePhoto({ status: 'featured' })], 1);
    const result = await getGalleryPhotos(null, 1, 12);
    expect(result.photos[0].isFeatured).toBe(true);
  });

  it('returns empty photos array and success:true when no results', async () => {
    setMockItems([], 0);
    const result = await getGalleryPhotos(null, 1, 12);
    expect(result.success).toBe(true);
    expect(result.photos).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(0);
  });

  it('filters by roomType when specified', async () => {
    setMockItems([makePhoto({ roomType: 'office' })], 1);
    await getGalleryPhotos('office', 1, 12);
    expect(mockQuery.eq).toHaveBeenCalledWith('roomType', 'office');
  });

  it('does not filter by roomType when roomType is null', async () => {
    await getGalleryPhotos(null, 1, 12);
    expect(mockQuery.eq).not.toHaveBeenCalled();
  });

  it('does not filter by roomType when roomType is "all"', async () => {
    await getGalleryPhotos('all', 1, 12);
    expect(mockQuery.eq).not.toHaveBeenCalled();
  });

  it('returns error for invalid roomType', async () => {
    const result = await getGalleryPhotos('invalid-room', 1, 12);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/room type/i);
  });

  it('queries hasSome on approved statuses', async () => {
    await getGalleryPhotos(null, 1, 12);
    expect(mockQuery.hasSome).toHaveBeenCalledWith('status', expect.arrayContaining(['approved', 'featured']));
  });

  it('computes hasMore correctly when more items exist', async () => {
    setMockItems([makePhoto()], 20);
    const result = await getGalleryPhotos(null, 1, 12);
    expect(result.hasMore).toBe(true);
  });

  it('computes hasMore:false when all items fit on page', async () => {
    setMockItems([makePhoto()], 1);
    const result = await getGalleryPhotos(null, 1, 12);
    expect(result.hasMore).toBe(false);
  });

  it('paginates: page 2 skips page-size items', async () => {
    await getGalleryPhotos(null, 2, 12);
    expect(mockQuery.skip).toHaveBeenCalledWith(12);
  });

  it('clamps limit to max 48', async () => {
    await getGalleryPhotos(null, 1, 100);
    expect(mockQuery.limit).toHaveBeenCalledWith(48);
  });

  it('clamps limit minimum to 1', async () => {
    await getGalleryPhotos(null, 1, 0);
    expect(mockQuery.limit).toHaveBeenCalledWith(1);
  });

  it('strips URLs from photoCaption in output', async () => {
    setMockItems([makePhoto({ photoCaption: 'Check https://evil.com out' })], 1);
    const result = await getGalleryPhotos(null, 1, 12);
    expect(result.photos[0].photoCaption).not.toContain('https://');
  });

  it('returns success:false on database error', async () => {
    mockQuery.find.mockRejectedValueOnce(new Error('DB error'));
    const result = await getGalleryPhotos(null, 1, 12);
    expect(result.success).toBe(false);
    expect(result.photos).toEqual([]);
  });

  it('sorts descending by submittedAt', async () => {
    await getGalleryPhotos(null, 1, 12);
    expect(mockQuery.descending).toHaveBeenCalledWith('submittedAt');
  });

  it('returns page number in response', async () => {
    const result = await getGalleryPhotos(null, 3, 12);
    expect(result.page).toBe(3);
  });

  it('handles customerName from customerName field when memberName absent', async () => {
    setMockItems([makePhoto({ memberName: undefined, customerName: 'Carol' })], 1);
    const result = await getGalleryPhotos(null, 1, 12);
    expect(result.photos[0].customerName).toBe('Carol');
  });

  it('falls back to "Customer" when both name fields absent', async () => {
    setMockItems([makePhoto({ memberName: undefined, customerName: undefined })], 1);
    const result = await getGalleryPhotos(null, 1, 12);
    expect(result.photos[0].customerName).toBe('Customer');
  });
});

// ═══════════════════════════════════════════════════════════════════
// getGalleryRoomTypes
// ═══════════════════════════════════════════════════════════════════

describe('getGalleryRoomTypes', () => {
  it('returns success:true', async () => {
    const result = await getGalleryRoomTypes();
    expect(result.success).toBe(true);
  });

  it('returns all room types', async () => {
    const result = await getGalleryRoomTypes();
    expect(result.roomTypes.length).toBe(GALLERY_ROOM_TYPES.length);
  });

  it('each room type has slug and label', async () => {
    const result = await getGalleryRoomTypes();
    for (const rt of result.roomTypes) {
      expect(rt).toHaveProperty('slug');
      expect(rt).toHaveProperty('label');
      expect(typeof rt.slug).toBe('string');
      expect(typeof rt.label).toBe('string');
    }
  });

  it('slugs match GALLERY_ROOM_TYPES', async () => {
    const result = await getGalleryRoomTypes();
    const slugs = result.roomTypes.map(rt => rt.slug);
    expect(slugs).toEqual(GALLERY_ROOM_TYPES);
  });

  it('living-room has human-readable label', async () => {
    const result = await getGalleryRoomTypes();
    const livingRoom = result.roomTypes.find(rt => rt.slug === 'living-room');
    expect(livingRoom).toBeDefined();
    expect(livingRoom.label).toMatch(/living room/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GALLERY_ROOM_TYPES export
// ═══════════════════════════════════════════════════════════════════

describe('GALLERY_ROOM_TYPES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(GALLERY_ROOM_TYPES)).toBe(true);
    expect(GALLERY_ROOM_TYPES.length).toBeGreaterThan(0);
  });

  it('includes expected room types', () => {
    expect(GALLERY_ROOM_TYPES).toContain('living-room');
    expect(GALLERY_ROOM_TYPES).toContain('bedroom');
    expect(GALLERY_ROOM_TYPES).toContain('office');
  });
});
