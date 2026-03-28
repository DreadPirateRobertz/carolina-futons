/**
 * Tests for roomStaging.web.js — AI Room Staging backend
 * CF-s22f: NOVEL — AI Room Staging
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn((key) => {
    const secrets = {
      AI_IMAGE_API_KEY: 'test-key',
      AI_IMAGE_API_URL: 'https://test-api.example.com/generate',
    };
    return Promise.resolve(secrets[key] || '');
  }),
}));

const mockFetch = vi.fn();
vi.mock('wix-fetch', () => ({
  fetch: (...args) => mockFetch(...args),
}));

vi.mock('wix-media-backend', () => ({
  mediaManager: {
    upload: vi.fn().mockResolvedValue({ fileUrl: 'https://media.wix.com/staged-result.jpg' }),
  },
}));

const mockWixData = {
  get: vi.fn(),
  query: vi.fn(),
  insert: vi.fn().mockResolvedValue({}),
};
mockWixData.query.mockReturnValue({
  eq: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn().mockResolvedValue({ items: [] }),
});
vi.mock('wix-data', () => ({ default: mockWixData }));

import { generateStagedRoom, getCachedStaging, getRoomUploadConfig } from '../src/backend/roomStaging.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockWixData.get.mockResolvedValue({
    _id: 'prod-123',
    name: 'Sedona Queen Futon Frame',
    mainMedia: 'https://cdn.example.com/sedona.jpg',
    description: 'Contemporary hardwood frame with clean modern lines',
  });
  mockWixData.query.mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    find: vi.fn().mockResolvedValue({ items: [] }),
  });
});

describe('generateStagedRoom', () => {
  it('validates required inputs', async () => {
    const noRoom = await generateStagedRoom('', 'prod-123');
    expect(noRoom.success).toBe(false);
    expect(noRoom.error).toContain('Room image URL');

    const noProduct = await generateStagedRoom('https://example.com/room.jpg', '');
    expect(noProduct.success).toBe(false);
    expect(noProduct.error).toContain('Product ID');
  });

  it('calls AI API with room image, product image, and prompt', async () => {
    // Mock image fetch (for base64 conversion)
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }) // room image
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }) // product image
      .mockResolvedValueOnce({ // AI API response
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: { parts: [{ inlineData: { data: 'base64imagedata' } }] },
          }],
        }),
      });

    const result = await generateStagedRoom('https://example.com/room.jpg', 'prod-123');

    expect(result.success).toBe(true);
    expect(result.stagedImageUrl).toBe('https://media.wix.com/staged-result.jpg');
    expect(result.prompt).toContain('Sedona Queen Futon Frame');
  });

  it('returns error when product not found', async () => {
    mockWixData.get.mockResolvedValue(null);

    const result = await generateStagedRoom('https://example.com/room.jpg', 'bad-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Product not found');
  });

  it('returns error when AI API fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error', text: () => Promise.resolve('') });

    const result = await generateStagedRoom('https://example.com/room.jpg', 'prod-123');

    expect(result.success).toBe(false);
    expect(result.error).toContain('AI generation failed');
  });

  it('returns error when no image generated', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: 'no image' }] } }] }),
      });

    const result = await generateStagedRoom('https://example.com/room.jpg', 'prod-123');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No image generated');
  });
});

describe('getCachedStaging', () => {
  it('returns cached=false when no cache exists', async () => {
    const result = await getCachedStaging('https://example.com/room.jpg', 'prod-123');

    expect(result.cached).toBe(false);
    expect(result.stagedImageUrl).toBe('');
  });

  it('returns cached result when available', async () => {
    mockWixData.query.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      descending: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockResolvedValue({
        items: [{ stagedImageUrl: 'https://media.wix.com/cached.jpg' }],
      }),
    });

    const result = await getCachedStaging('https://example.com/room.jpg', 'prod-123');

    expect(result.cached).toBe(true);
    expect(result.stagedImageUrl).toBe('https://media.wix.com/cached.jpg');
  });
});

describe('getRoomUploadConfig', () => {
  it('returns upload folder path', async () => {
    const config = await getRoomUploadConfig();
    expect(config.uploadFolder).toBe('/room-staging/uploads');
  });
});
