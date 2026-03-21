/**
 * Tests for CF-bf47: Visual search spike — image → style tags → mock products.
 * Covers: isValidImageUrl, extractStyleTags, callVisionAPI, getMockProducts,
 * analyzeRoomPhoto (happy path, error paths, key missing, API errors).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';
import { __setSecrets, __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import {
  isValidImageUrl,
  extractStyleTags,
  callVisionAPI,
  getMockProducts,
  analyzeRoomPhoto,
  STYLE_TAGS,
} from '../src/backend/visualSearch.web.js';

const TEST_IMAGE_URL = 'https://example.com/room.jpg';
const TEST_API_KEY = 'test-vision-key-xyz';

function makeLabel(description, score = 0.9) {
  return { description, score, topicality: score };
}

function makeVisionResponse(labels) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { responses: [{ labelAnnotations: labels }] };
    },
  };
}

beforeEach(() => {
  resetFetch();
  resetSecrets();
  __setSecrets({ GOOGLE_VISION_API_KEY: TEST_API_KEY });
});

// ── isValidImageUrl ──────────────────────────────────────────────

describe('isValidImageUrl', () => {
  it('accepts http URL', () => {
    expect(isValidImageUrl('http://example.com/photo.jpg')).toBe(true);
  });

  it('accepts https URL', () => {
    expect(isValidImageUrl('https://example.com/photo.jpg')).toBe(true);
  });

  it('accepts Wix media URL', () => {
    expect(isValidImageUrl('https://static.wixstatic.com/media/abc123.jpg')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidImageUrl('')).toBe(false);
  });

  it('rejects non-string', () => {
    expect(isValidImageUrl(null)).toBe(false);
    expect(isValidImageUrl(42)).toBe(false);
  });

  it('rejects URLs without http/https', () => {
    expect(isValidImageUrl('ftp://example.com/photo.jpg')).toBe(false);
    expect(isValidImageUrl('data:image/jpeg;base64,/9j/4...')).toBe(false);
  });

  it('rejects URLs exceeding 2000 chars', () => {
    expect(isValidImageUrl('https://example.com/' + 'a'.repeat(2000))).toBe(false);
  });
});

// ── extractStyleTags ─────────────────────────────────────────────

describe('extractStyleTags', () => {
  it('returns empty array for empty labels', () => {
    expect(extractStyleTags([])).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(extractStyleTags(null)).toEqual([]);
  });

  it('maps "wood" label to rustic', () => {
    expect(extractStyleTags([makeLabel('wood')])).toContain('rustic');
  });

  it('maps "modern" label to modern', () => {
    expect(extractStyleTags([makeLabel('modern')])).toContain('modern');
  });

  it('maps "metal" to industrial', () => {
    expect(extractStyleTags([makeLabel('metal')])).toContain('industrial');
  });

  it('maps "vintage" to mid-century', () => {
    expect(extractStyleTags([makeLabel('vintage')])).toContain('mid-century');
  });

  it('maps "coastal" to coastal', () => {
    expect(extractStyleTags([makeLabel('coastal')])).toContain('coastal');
  });

  it('deduplicates tags when multiple labels map to same style', () => {
    const tags = extractStyleTags([makeLabel('wood'), makeLabel('rustic'), makeLabel('natural')]);
    const rusticCount = tags.filter(t => t === 'rustic').length;
    expect(rusticCount).toBe(1);
  });

  it('returns multiple distinct styles from mixed labels', () => {
    const tags = extractStyleTags([makeLabel('wood'), makeLabel('modern'), makeLabel('coastal')]);
    expect(tags).toContain('rustic');
    expect(tags).toContain('modern');
    expect(tags).toContain('coastal');
  });

  it('ignores unknown labels', () => {
    const tags = extractStyleTags([makeLabel('elephant'), makeLabel('sky'), makeLabel('cloud')]);
    expect(tags).toHaveLength(0);
  });

  it('is case-insensitive for label descriptions', () => {
    const tags = extractStyleTags([{ description: 'WOOD', score: 0.9 }]);
    expect(tags).toContain('rustic');
  });

  it('all returned tags are from STYLE_TAGS list', () => {
    const labels = STYLE_TAGS.map(tag => makeLabel(tag));
    const tags = extractStyleTags(labels);
    for (const t of tags) {
      expect(STYLE_TAGS).toContain(t);
    }
  });
});

// ── callVisionAPI ────────────────────────────────────────────────

describe('callVisionAPI', () => {
  it('calls Vision API with image URL and returns labels', async () => {
    const mockLabels = [makeLabel('wood'), makeLabel('modern')];
    __setHandler(() => makeVisionResponse(mockLabels));
    const labels = await callVisionAPI(TEST_IMAGE_URL, TEST_API_KEY);
    expect(labels).toHaveLength(2);
    expect(labels[0].description).toBe('wood');
  });

  it('returns empty array when response has no labelAnnotations', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async json() { return { responses: [{}] }; },
    }));
    const labels = await callVisionAPI(TEST_IMAGE_URL, TEST_API_KEY);
    expect(labels).toEqual([]);
  });

  it('throws vision_auth_error on 403', async () => {
    __setHandler(() => ({ ok: false, status: 403 }));
    await expect(callVisionAPI(TEST_IMAGE_URL, TEST_API_KEY)).rejects.toThrow('vision_auth_error');
  });

  it('throws vision_rate_limited on 429', async () => {
    __setHandler(() => ({ ok: false, status: 429 }));
    await expect(callVisionAPI(TEST_IMAGE_URL, TEST_API_KEY)).rejects.toThrow('vision_rate_limited');
  });

  it('throws vision_bad_request on 400', async () => {
    __setHandler(() => ({ ok: false, status: 400 }));
    await expect(callVisionAPI(TEST_IMAGE_URL, TEST_API_KEY)).rejects.toThrow('vision_bad_request');
  });

  it('throws generic error for other status codes', async () => {
    __setHandler(() => ({ ok: false, status: 500 }));
    await expect(callVisionAPI(TEST_IMAGE_URL, TEST_API_KEY)).rejects.toThrow('vision_api_error_500');
  });
});

// ── getMockProducts ──────────────────────────────────────────────

describe('getMockProducts', () => {
  it('returns empty array for empty tags', () => {
    expect(getMockProducts([])).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(getMockProducts(null)).toEqual([]);
  });

  it('returns products for "rustic" style', () => {
    const products = getMockProducts(['rustic']);
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].matchedStyle).toBe('rustic');
  });

  it('returns products for "modern" style', () => {
    const products = getMockProducts(['modern']);
    expect(products.length).toBeGreaterThan(0);
  });

  it('returns at most 5 products', () => {
    const products = getMockProducts(STYLE_TAGS);
    expect(products.length).toBeLessThanOrEqual(5);
  });

  it('does not return duplicate products', () => {
    const products = getMockProducts(['rustic', 'modern', 'coastal']);
    const ids = products.map(p => p._id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('returns empty for unknown style', () => {
    expect(getMockProducts(['unknown-style-xyz'])).toEqual([]);
  });

  it('each product has required fields', () => {
    const products = getMockProducts(['modern']);
    for (const p of products) {
      expect(p).toHaveProperty('_id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('slug');
      expect(p).toHaveProperty('price');
      expect(p).toHaveProperty('matchedStyle');
    }
  });
});

// ── analyzeRoomPhoto ─────────────────────────────────────────────

describe('analyzeRoomPhoto', () => {
  it('returns success with tags and products for valid image', async () => {
    __setHandler(() => makeVisionResponse([makeLabel('wood'), makeLabel('rustic')]));
    const result = await analyzeRoomPhoto(TEST_IMAGE_URL);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags).toContain('rustic');
    expect(Array.isArray(result.products)).toBe(true);
    expect(result.provider).toBe('google_vision');
  });

  it('includes labelCount in successful response', async () => {
    __setHandler(() => makeVisionResponse([makeLabel('wood'), makeLabel('modern'), makeLabel('coastal')]));
    const result = await analyzeRoomPhoto(TEST_IMAGE_URL);
    expect(result.success).toBe(true);
    expect(result.labelCount).toBe(3);
  });

  it('returns error for invalid image URL', async () => {
    const result = await analyzeRoomPhoto('not-a-url');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_image_url');
    expect(result.tags).toHaveLength(0);
  });

  it('returns error for empty imageUrl', async () => {
    const result = await analyzeRoomPhoto('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_image_url');
  });

  it('returns error when Vision API key is not configured', async () => {
    resetSecrets();
    const result = await analyzeRoomPhoto(TEST_IMAGE_URL);
    expect(result.success).toBe(false);
    expect(result.error).toBe('no_vision_key');
  });

  it('returns success with empty tags when no labels match style map', async () => {
    __setHandler(() => makeVisionResponse([makeLabel('elephant'), makeLabel('sky')]));
    const result = await analyzeRoomPhoto(TEST_IMAGE_URL);
    expect(result.success).toBe(true);
    expect(result.tags).toHaveLength(0);
    expect(result.products).toHaveLength(0);
  });

  it('returns vision_auth_error when API returns 403', async () => {
    __setHandler(() => ({ ok: false, status: 403 }));
    const result = await analyzeRoomPhoto(TEST_IMAGE_URL);
    expect(result.success).toBe(false);
    expect(result.error).toBe('vision_auth_error');
  });

  it('returns vision_rate_limited when API returns 429', async () => {
    __setHandler(() => ({ ok: false, status: 429 }));
    const result = await analyzeRoomPhoto(TEST_IMAGE_URL);
    expect(result.success).toBe(false);
    expect(result.error).toBe('vision_rate_limited');
  });

  it('returns analysis_failed for unexpected errors', async () => {
    __setHandler(() => { throw new Error('network_timeout'); });
    const result = await analyzeRoomPhoto(TEST_IMAGE_URL);
    expect(result.success).toBe(false);
    expect(result.error).toBe('analysis_failed');
  });

  it('handles null imageUrl gracefully', async () => {
    const result = await analyzeRoomPhoto(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_image_url');
  });
});
