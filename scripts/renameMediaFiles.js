/**
 * renameMediaFiles.js — Fix Media Manager displayNames to match product slugs.
 *
 * When importProductPhotos.js ran, Wix used the URL terminal filename (/file.jpg)
 * instead of the provided displayName. This script:
 *   1. Lists all files in Media Manager (with pagination)
 *   2. Matches each file URL hash to product-image-manifest.json
 *   3. Updates displayName via Wix Media API
 *
 * Usage:
 *   source scripts/secrets.env && node scripts/renameMediaFiles.js [--dry-run]
 *
 * Required env vars:
 *   WIX_BACKEND_KEY  — API key (IST.xxx from secrets.env)
 *   WIX_SITE_ID      — Staging site ID (49cd75b0-92f1-4978-93e2-f5b5da531142)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WIX_MEDIA_API = 'https://www.wixapis.com/site-media/v1';
const STAGING_SITE_ID = '49cd75b0-92f1-4978-93e2-f5b5da531142';

function getConfig() {
  const apiKey = process.env.WIX_BACKEND_KEY;
  const siteId = process.env.WIX_SITE_ID || STAGING_SITE_ID;
  if (!apiKey) throw new Error('Missing required env var: WIX_BACKEND_KEY');
  return { apiKey, siteId };
}

/**
 * Extract the Wix media hash from a wixstatic CDN URL.
 * Handles both formats:
 *   e04e89_cf15142c~mv2.jpg  → cf15142c...
 *   e04e89_cf15142c.jpg/v1/  → cf15142c...
 */
function extractHash(url) {
  // Format: /media/prefix_hash~mv2.ext
  const mv2Match = url.match(/\/media\/[^/]+_([a-f0-9]+)~mv2/);
  if (mv2Match) return mv2Match[1];
  // Format: /media/prefix_hash.ext/v1/
  const dotMatch = url.match(/\/media\/[^/]+_([a-f0-9]+)\.\w+\//);
  if (dotMatch) return dotMatch[1];
  return null;
}

/**
 * Build a map of hash → intended displayName from the product image manifest.
 */
function buildHashMap(manifest) {
  const map = new Map();
  for (const product of manifest) {
    if (!product.images) continue;
    const slug = product.slug || String(product.name || 'product').toLowerCase().replace(/\s+/g, '-');
    for (let idx = 0; idx < product.images.length; idx++) {
      const hash = extractHash(product.images[idx]);
      if (hash) {
        map.set(hash, `${slug}-${idx + 1}`);
      }
    }
  }
  return map;
}

/**
 * Update a single file's displayName via Wix Media API.
 * Tries PATCH first; falls back to PUT if PATCH returns 405.
 */

async function updateFileDisplayName(fileId, displayName, config) {
  for (const method of ['PATCH', 'PUT']) {
    const body = method === 'PATCH'
      ? { file: { displayName }, fieldMask: { paths: ['displayName'] } }
      : { displayName };

    const res = await fetch(`${WIX_MEDIA_API}/files/${fileId}`, {
      method,
      headers: {
        Authorization: config.apiKey,
        'wix-site-id': config.siteId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 405) continue; // try next method
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Update file ${fileId} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return res.json();
  }
  throw new Error(`No working HTTP method for update on ${fileId}`);
}

/**
 * Build rename tasks directly from manifest (no listing needed).
 * The imported files on staging share the same wixMediaId as the source CDN URL hash.
 * Format: e04e89_<hash>~mv2.<ext>
 */
function buildRenameTasksFromManifest(manifest) {
  const tasks = [];
  for (const product of manifest) {
    if (!product.images) continue;
    const slug = product.slug || String(product.name || 'product').toLowerCase().replace(/\s+/g, '-');
    for (let idx = 0; idx < product.images.length; idx++) {
      const url = product.images[idx];
      // Extract the wixstatic file ID from URL: /media/<fileId>/v1/...
      const match = url.match(/\/media\/([^/]+)\//);
      if (!match) continue;
      const fileId = match[1]; // e.g. e04e89_cf15142c61714ecfad7852522e0a98e4~mv2.jpg
      const intended = `${slug}-${idx + 1}`;
      tasks.push({ fileId, intended, sourceUrl: url });
    }
  }
  return tasks;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const config = getConfig();

  // Load manifest
  const manifestPath = resolve(__dirname, '..', 'docs', 'product-image-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const tasks = buildRenameTasksFromManifest(manifest);
  console.log(`Manifest loaded: ${manifest.length} products, ${tasks.length} files to rename`);

  if (dryRun) {
    console.log('\n=== DRY RUN — no changes made ===');
    for (const t of tasks.slice(0, 20)) {
      console.log(`  ${t.fileId} → "${t.intended}"`);
    }
    if (tasks.length > 20) console.log(`  ... and ${tasks.length - 20} more`);
    return;
  }

  let success = 0;
  let failed = 0;
  const failures = [];

  for (const t of tasks) {
    try {
      await updateFileDisplayName(t.fileId, t.intended, config);
      console.log(`  ✓ ${t.fileId} → "${t.intended}"`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${t.fileId}: ${err.message}`);
      failures.push({ ...t, error: err.message });
      failed++;
    }
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\n=== RENAME COMPLETE ===`);
  console.log(`Success: ${success}`);
  console.log(`Failed:  ${failed}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ${f.fileId}: ${f.error}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
