/**
 * @module roomStaging
 * @description AI Room Staging — composite Carolina Futons products into
 * customer room photos with correct perspective, lighting, and shadows.
 *
 * CF-s22f: NOVEL — AI Room Staging ("See It In Your Room")
 *
 * Flow:
 * 1. Customer uploads a room photo (via Wix media upload or camera)
 * 2. Backend receives room image URL + product ID
 * 3. AI generates a composite image showing the product in the room
 * 4. Result is cached and returned as a Wix media URL
 *
 * @requires wix-web-module
 * @requires wix-secrets-backend
 * @requires wix-fetch
 * @requires wix-media-backend
 *
 * @setup
 * Add these secrets in Wix Dashboard > Secrets Manager:
 * - AI_IMAGE_API_KEY — API key for image generation provider
 * - AI_IMAGE_API_URL — Base URL for image generation API (default: Google Gemini)
 */
import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { mediaManager } from 'wix-media-backend';

const MAX_IMAGE_SIZE_MB = 10;
const STAGING_CACHE_COLLECTION = 'RoomStagingCache';
const DEFAULT_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

/**
 * Build the product description prompt for the AI model.
 * Includes product name, dimensions, materials, and style to guide accurate rendering.
 *
 * @param {Object} product - Product data
 * @returns {string} Product description for prompt
 */
function buildProductPrompt(product) {
  const parts = [product.name || 'futon frame'];
  if (product.description) {
    // Extract key physical descriptors (first 200 chars of description)
    parts.push(product.description.slice(0, 200));
  }
  return parts.join('. ');
}

/**
 * Generate an AI-staged room image with a Carolina Futons product.
 *
 * @param {string} roomImageUrl - URL of the customer's room photo (Wix media or external)
 * @param {string} productId - Wix product ID
 * @param {Object} [options]
 * @param {string} [options.placement='center'] - Where to place furniture: 'center', 'left', 'right', 'replace'
 * @returns {Promise<{success: boolean, stagedImageUrl: string, prompt: string, error?: string}>}
 */
export const generateStagedRoom = webMethod(
  Permissions.Anyone,
  async (roomImageUrl, productId, options = {}) => {
    if (!roomImageUrl || typeof roomImageUrl !== 'string') {
      return { success: false, stagedImageUrl: '', error: 'Room image URL required' };
    }
    if (!productId || typeof productId !== 'string') {
      return { success: false, stagedImageUrl: '', error: 'Product ID required' };
    }

    const { placement = 'center' } = options;

    try {
      // Fetch product data
      const wixData = (await import('wix-data')).default;
      const productResult = await wixData.get('Stores/Products', productId);

      if (!productResult) {
        return { success: false, stagedImageUrl: '', error: 'Product not found' };
      }

      // Get product reference image (main product photo on white background)
      const productImageUrl = productResult.mainMedia || '';
      const productDescription = buildProductPrompt(productResult);

      // Build the staging prompt
      const prompt = [
        'You are an interior design visualization AI.',
        `Take this room photo and naturally place this piece of furniture in it: ${productDescription}.`,
        `Place the furniture ${placement === 'replace' ? 'replacing any existing couch or seating' : `toward the ${placement} of the room`}.`,
        'Match the room\'s lighting, shadows, and perspective exactly.',
        'The furniture should look like it belongs in the room — photorealistic, correct scale.',
        'Do not change the room\'s walls, floor, windows, or other furniture unless replacing.',
        'Output a single photorealistic image.',
      ].join(' ');

      // Call AI image generation API
      const [apiKey, apiUrl] = await Promise.all([
        getSecret('AI_IMAGE_API_KEY'),
        getSecret('AI_IMAGE_API_URL').catch(() => DEFAULT_API_URL),
      ]);

      const response = await fetch(`${apiUrl}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: await fetchImageAsBase64(roomImageUrl) } },
              ...(productImageUrl ? [{
                inlineData: { mimeType: 'image/jpeg', data: await fetchImageAsBase64(productImageUrl) },
              }] : []),
            ],
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 0.4,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('[roomStaging] AI API error:', response.status, errText.slice(0, 200));
        return { success: false, stagedImageUrl: '', error: `AI generation failed (${response.status})` };
      }

      const result = await response.json();

      // Extract generated image from response
      const imageData = extractGeneratedImage(result);
      if (!imageData) {
        return { success: false, stagedImageUrl: '', error: 'No image generated' };
      }

      // Upload to Wix Media Manager for persistent hosting
      const uploadResult = await mediaManager.upload(
        '/room-staging',
        Buffer.from(imageData, 'base64'),
        `staged-${productId}-${Date.now()}.jpg`,
        { mediaOptions: { mimeType: 'image/jpeg' } }
      );

      const stagedImageUrl = uploadResult.fileUrl || '';

      // Cache the result
      try {
        await wixData.insert(STAGING_CACHE_COLLECTION, {
          roomImageUrl,
          productId,
          stagedImageUrl,
          placement,
          _createdDate: new Date(),
        });
      } catch { /* cache insert failed — non-critical */ }

      return { success: true, stagedImageUrl, prompt };
    } catch (err) {
      console.error('[roomStaging] generateStagedRoom failed:', err?.message);
      return { success: false, stagedImageUrl: '', error: err?.message || 'Unknown error' };
    }
  }
);

/**
 * Check if a staged image already exists in cache.
 * Avoids re-generating for the same room + product combo.
 *
 * @param {string} roomImageUrl
 * @param {string} productId
 * @returns {Promise<{cached: boolean, stagedImageUrl: string}>}
 */
export const getCachedStaging = webMethod(
  Permissions.Anyone,
  async (roomImageUrl, productId) => {
    try {
      const wixData = (await import('wix-data')).default;
      const result = await wixData.query(STAGING_CACHE_COLLECTION)
        .eq('roomImageUrl', roomImageUrl)
        .eq('productId', productId)
        .descending('_createdDate')
        .limit(1)
        .find();

      if (result.items.length > 0) {
        return { cached: true, stagedImageUrl: result.items[0].stagedImageUrl };
      }
      return { cached: false, stagedImageUrl: '' };
    } catch {
      return { cached: false, stagedImageUrl: '' };
    }
  }
);

/**
 * Get upload URL for room photos. Client uploads directly to Wix media.
 * Returns a folder path for the upload.
 *
 * @returns {Promise<{uploadFolder: string}>}
 */
export const getRoomUploadConfig = webMethod(
  Permissions.Anyone,
  async () => {
    return { uploadFolder: '/room-staging/uploads' };
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Fetch an image URL and return base64-encoded content.
 * Handles both Wix media URLs and external URLs.
 *
 * @param {string} imageUrl
 * @returns {Promise<string>} Base64-encoded image data
 */
async function fetchImageAsBase64(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

/**
 * Extract the generated image from the AI API response.
 * Supports Gemini-style response format.
 *
 * @param {Object} apiResponse
 * @returns {string|null} Base64-encoded image data, or null
 */
function extractGeneratedImage(apiResponse) {
  try {
    const candidates = apiResponse.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return part.inlineData.data;
        }
      }
    }
  } catch { /* parsing failed */ }
  return null;
}
