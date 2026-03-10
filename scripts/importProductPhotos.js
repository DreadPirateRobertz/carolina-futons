/**
 * importProductPhotos.js — Bulk import product photos to Wix Media Manager via REST API.
 *
 * Reads docs/product-image-manifest.json, creates folder structure, and imports
 * all product images in batches of 100 (Wix API limit).
 *
 * Usage:
 *   WIX_BACKEND_KEY=IST.xxx WIX_SITE_ID=xxx node scripts/importProductPhotos.js [--dry-run]
 *
 * Or load from secrets.env:
 *   source scripts/secrets.env && WIX_SITE_ID=49cd75b0-... node scripts/importProductPhotos.js
 *
 * @module importProductPhotos
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WIX_MEDIA_API = 'https://www.wixapis.com/site-media/v1';
const BATCH_SIZE = 100;

const MIME_MAP = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

/**
 * Load the product image manifest JSON.
 * @param {string} [manifestPath] - Override path to manifest file.
 * @returns {Array<Object>} Parsed manifest array.
 */
export function loadManifest(manifestPath) {
  const path = manifestPath || resolve(__dirname, '..', 'docs', 'product-image-manifest.json');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw);
}

/**
 * Extract unique folder paths from manifest entries.
 * @param {Array<Object>} manifest
 * @returns {string[]} Sorted unique folder paths.
 */
export function extractUniqueFolders(manifest) {
  const folders = new Set();
  for (const item of manifest) {
    if (item.folder) {
      folders.add(item.folder);
    }
  }
  return [...folders].sort();
}

/**
 * Infer MIME type from a wixstatic URL.
 * Handles two URL formats:
 *   - /media/hash_id.ext/v1/fit/... (current manifest format)
 *   - /media/hash~mv2.ext/v1/fit/... (legacy Wix format)
 * Falls back to image/jpeg if extension cannot be determined.
 * @param {string} url
 * @returns {string} MIME type string.
 */
export function inferMimeType(url) {
  // Primary: match /media/hash.ext/ pattern (e.g., e04e89_cf15.jpg/v1/...)
  const mediaMatch = url.match(/\/media\/[^/]+\.(\w+)\//);
  if (mediaMatch) {
    return MIME_MAP[mediaMatch[1].toLowerCase()] || 'image/jpeg';
  }
  // Legacy: match ~mv2.ext pattern
  const mv2Match = url.match(/~mv2\.(\w+)/);
  if (mv2Match) {
    return MIME_MAP[mv2Match[1].toLowerCase()] || 'image/jpeg';
  }
  // Last resort: file extension at end of URL
  const extMatch = url.match(/\.(\w+)(?:\?|$)/);
  if (extMatch) {
    return MIME_MAP[extMatch[1].toLowerCase()] || 'image/jpeg';
  }
  return 'image/jpeg';
}

/**
 * Build import request objects from manifest and folder ID map.
 * @param {Array<Object>} manifest
 * @param {Object<string, string>} folderIds - Map of folder path → Wix folder ID.
 * @returns {Array<Object>} Import request objects for the Wix API.
 */
export function buildImportRequests(manifest, folderIds) {
  const requests = [];
  for (const product of manifest) {
    if (!product.images || !product.images.length) continue;
    const parentFolderId = folderIds[product.folder] || 'media-root';
    if (!folderIds[product.folder] && product.folder) {
      console.warn(`Warning: No folder ID for "${product.folder}" — images will go to media-root`);
    }
    const slug = product.slug || String(product.name || 'product').toLowerCase().replace(/\s+/g, '-');
    for (let idx = 0; idx < product.images.length; idx++) {
      requests.push({
        url: product.images[idx],
        displayName: `${slug}-${idx + 1}`,
        mimeType: inferMimeType(product.images[idx]),
        mediaType: 'IMAGE',
        parentFolderId,
      });
    }
  }
  return requests;
}

/**
 * Split an array into chunks of a given size.
 * @param {Array} arr
 * @param {number} size
 * @returns {Array<Array>}
 */
export function chunkArray(arr, size) {
  if (!arr.length) return [];
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Read API config from environment variables.
 * @returns {{ apiKey: string, siteId: string }}
 */
export function getConfig() {
  const apiKey = process.env.WIX_BACKEND_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey) throw new Error('Missing required env var: WIX_BACKEND_KEY');
  if (!siteId) throw new Error('Missing required env var: WIX_SITE_ID');
  return { apiKey, siteId };
}

/**
 * Create a folder in Wix Media Manager.
 * @param {string} displayName
 * @param {string} parentFolderId
 * @param {{ apiKey: string, siteId: string }} config
 * @returns {Promise<Object>} Created folder object.
 */
export async function createFolder(displayName, parentFolderId, config) {
  const res = await fetch(`${WIX_MEDIA_API}/folders`, {
    method: 'POST',
    headers: {
      Authorization: config.apiKey,
      'wix-site-id': config.siteId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName, parentFolderId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create folder "${displayName}" failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.folder;
}

/**
 * Bulk import files via Wix REST API.
 * @param {Array<Object>} importFileRequests - Max 100 items.
 * @param {{ apiKey: string, siteId: string }} config
 * @returns {Promise<Object>} Bulk import response.
 */
export async function bulkImportFiles(importFileRequests, config) {
  if (importFileRequests.length > BATCH_SIZE) {
    throw new Error(`Batch size exceeds ${BATCH_SIZE} items (got ${importFileRequests.length})`);
  }

  const res = await fetch(`${WIX_MEDIA_API}/bulk/files/import-v2`, {
    method: 'POST',
    headers: {
      Authorization: config.apiKey,
      'wix-site-id': config.siteId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ importFileRequests }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bulk import failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Create the /products root folder and all category sub-folders.
 * @param {string[]} folderPaths - e.g. ['/products/futon-frames', '/products/mattresses']
 * @param {{ apiKey: string, siteId: string }} config
 * @returns {Promise<Object<string, string>>} Map of folder path → Wix folder ID.
 */
export async function ensureFolderStructure(folderPaths, config) {
  if (!folderPaths.length) return {};

  // Create root "products" folder
  const rootFolder = await createFolder('products', 'media-root', config);
  const rootId = rootFolder.id;

  // Create each category sub-folder (continue on individual failures)
  const folderIds = {};
  const folderErrors = [];
  for (const path of folderPaths) {
    const categoryName = path.split('/').pop();
    try {
      const folder = await createFolder(categoryName, rootId, config);
      folderIds[path] = folder.id;
    } catch (err) {
      console.error(`Failed to create folder "${categoryName}": ${err.message}`);
      folderErrors.push({ path, error: err.message });
    }
  }

  if (folderErrors.length) {
    console.warn(`${folderErrors.length} folder(s) failed — their images will go to media-root`);
  }

  return folderIds;
}

/**
 * Run the full import: create folders, batch-import all images.
 * @param {Array<Object>} manifest
 * @param {{ apiKey: string, siteId: string }} config
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<Object>} Summary of the import.
 */
export async function runImport(manifest, config, options = {}) {
  const { dryRun = false } = options;
  const folderPaths = extractUniqueFolders(manifest);
  const totalImages = manifest.reduce((sum, p) => sum + (p.images ? p.images.length : 0), 0);

  if (dryRun) {
    return {
      dryRun: true,
      totalImages,
      folders: folderPaths,
      batches: Math.ceil(totalImages / BATCH_SIZE),
    };
  }

  // Create folder structure
  const folderIds = await ensureFolderStructure(folderPaths, config);

  // Build and batch import requests
  const requests = buildImportRequests(manifest, folderIds);
  const batches = chunkArray(requests, BATCH_SIZE);

  let totalSuccess = 0;
  let totalFailed = 0;
  const failures = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Importing batch ${i + 1}/${batches.length} (${batch.length} images)...`);

    try {
      const result = await bulkImportFiles(batch, config);

      totalSuccess += result.bulkActionMetadata?.totalSuccesses || 0;
      totalFailed += result.bulkActionMetadata?.totalFailures || 0;

      // Track individual failures
      for (const r of result.results || []) {
        if (!r.itemMetadata?.success) {
          failures.push({
            index: r.itemMetadata?.originalIndex,
            error: r.itemMetadata?.error,
            url: batch[r.itemMetadata?.originalIndex]?.url,
          });
        }
      }
    } catch (err) {
      console.error(`Batch ${i + 1} failed: ${err.message}`);
      totalFailed += batch.length;
      for (const item of batch) {
        failures.push({ url: item.url, error: { description: err.message } });
      }
    }
  }

  return {
    totalImages,
    totalSuccess,
    totalFailed,
    batches: batches.length,
    failures,
  };
}

// CLI entry point
const isCLI = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isCLI) {
  const dryRun = process.argv.includes('--dry-run');

  try {
    const config = getConfig();
    const manifest = loadManifest();
    console.log(`Loaded manifest: ${manifest.length} products`);

    const result = await runImport(manifest, config, { dryRun });

    if (dryRun) {
      console.log('\n=== DRY RUN ===');
      console.log(`Total images: ${result.totalImages}`);
      console.log(`Folders to create: ${result.folders.length}`);
      console.log(`Batches needed: ${result.batches}`);
      console.log('Folders:', result.folders);
    } else {
      console.log('\n=== IMPORT COMPLETE ===');
      console.log(`Total images: ${result.totalImages}`);
      console.log(`Succeeded: ${result.totalSuccess}`);
      console.log(`Failed: ${result.totalFailed}`);
      console.log(`Batches: ${result.batches}`);
      if (result.failures.length) {
        console.log('\nFailures:');
        for (const f of result.failures) {
          console.log(`  - ${f.url}: ${f.error?.description || 'unknown error'}`);
        }
      }
    }
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  }
}
