#!/usr/bin/env node
/**
 * Download hi-res product images from Night & Day Furniture dealer Image Bank.
 * Maps image bank folders to catalog-MASTER.json slugs and downloads all images.
 *
 * Usage: ND_USER=nightimage ND_PASS=bankpass2 node scripts/download-nd-images.mjs [--dry-run]
 *   Or source secrets.env first: source scripts/secrets.env && node scripts/download-nd-images.mjs
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { ND_USER, ND_PASS } = process.env;
if (!ND_USER || !ND_PASS) {
  console.error('FATAL: Set ND_USER and ND_PASS environment variables.');
  console.error('  Example: ND_USER=nightimage ND_PASS=bankpass2 node scripts/download-nd-images.mjs');
  process.exit(1);
}
const AUTH = Buffer.from(`${ND_USER}:${ND_PASS}`).toString('base64');
const BASE = 'https://imagebank.nightanddayfurniture.com/dealer';
const DRY_RUN = process.argv.includes('--dry-run');

// Image bank folder IDs mapped to catalog slug names
const FOLDER_MAP = {
  459: 'albany',
  458: 'autumn',
  460: 'eureka',
  461: 'fuji',
  462: 'key-west',
  463: 'kingston',
  468: 'sunrise',
  467: 'solstice-1',
  469: 'trinity',
  471: 'venice',
  472: 'winchester',
  473: 'winter',
};

// Extra folders to scan for additional product images
const EXTRA_FOLDERS = {
  104: '_daybeds',
  694: '_sofa-sleepers',
};

const OUTPUT_DIR = join(ROOT, 'content', 'nd-images');

async function fetchAuth(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${AUTH}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

/** Parse image bank folder page, return array of {id, filename} */
function parseImages(html) {
  const images = [];
  const re = /href="serve\.cgi\?id=(\d+)"[^>]*>([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    images.push({ id: m[1], filename: m[2].trim() });
  }
  return images;
}

/** Download a single image by serve.cgi ID */
async function downloadImage(id, filename, outDir) {
  const outPath = join(outDir, filename);
  if (existsSync(outPath)) {
    console.log(`  SKIP (exists): ${filename}`);
    return { filename, status: 'skipped' };
  }
  if (DRY_RUN) {
    console.log(`  DRY-RUN: would download ${filename} (id=${id})`);
    return { filename, status: 'dry-run' };
  }

  const res = await fetchAuth(`${BASE}/serve.cgi?id=${id}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  const sizeMB = (buf.length / 1024 / 1024).toFixed(2);
  console.log(`  DOWNLOADED: ${filename} (${sizeMB} MB)`);
  return { filename, status: 'downloaded', size: buf.length };
}

async function processFolderPage(folderId) {
  const res = await fetchAuth(`${BASE}/imagebank.cgi?selected=${folderId}`);
  const html = await res.text();
  return parseImages(html);
}

async function main() {
  console.log(`Night & Day Image Bank Downloader${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log('='.repeat(50));

  // Load catalog for cross-reference
  const catalog = JSON.parse(readFileSync(join(ROOT, 'crew/godfrey/content/catalog-MASTER.json'), 'utf8'));
  const frames = catalog.products.filter(p => p.name?.includes('Futon Frame'));
  console.log(`Catalog: ${frames.length} frame products\n`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const report = { downloaded: 0, skipped: 0, errors: 0, folders: {} };

  // Process matched futon folders
  for (const [folderId, slug] of Object.entries(FOLDER_MAP)) {
    const product = frames.find(p => p.slug === slug);
    const productName = product ? product.name : `(no catalog match: ${slug})`;
    console.log(`\n[${slug}] ${productName} (folder ${folderId})`);

    const folderDir = join(OUTPUT_DIR, slug);
    mkdirSync(folderDir, { recursive: true });

    try {
      const images = await processFolderPage(folderId);
      console.log(`  Found ${images.length} images`);
      report.folders[slug] = { productName, imageCount: images.length, images: [] };

      for (const img of images) {
        try {
          const result = await downloadImage(img.id, img.filename, folderDir);
          report.folders[slug].images.push(result);
          if (result.status === 'downloaded') report.downloaded++;
          else if (result.status === 'skipped') report.skipped++;
        } catch (err) {
          console.error(`  ERROR downloading ${img.filename}: ${err.message}`);
          report.errors++;
        }
      }
    } catch (err) {
      console.error(`  ERROR fetching folder: ${err.message}`);
      report.errors++;
    }

    // Rate limit between folders
    await new Promise(r => setTimeout(r, 500));
  }

  // Check extra folders for unmapped products
  console.log('\n\nScanning extra folders for additional matches...');
  for (const [folderId, label] of Object.entries(EXTRA_FOLDERS)) {
    console.log(`\n[${label}] (folder ${folderId})`);
    try {
      const res = await fetchAuth(`${BASE}/imagebank.cgi?selected=${folderId}`);
      const html = await res.text();
      const subfolderRe = /href="imagebank\.cgi\?selected=(\d+)"[^>]*>([^<]+)/g;
      let m;
      const subfolders = [];
      while ((m = subfolderRe.exec(html))) {
        const name = m[2].trim().replace(/<\/?b>/g, '');
        if (name && !name.includes('Collection') && name !== label) {
          subfolders.push({ id: m[1], name });
        }
      }
      console.log(`  Subfolders: ${subfolders.map(s => s.name).join(', ') || 'none'}`);

      const directImages = parseImages(html);
      if (directImages.length > 0) {
        console.log(`  Direct images: ${directImages.length}`);
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  // Find catalog frames with NO image bank folder
  const mappedSlugs = new Set(Object.values(FOLDER_MAP));
  const unmapped = frames.filter(p => !mappedSlugs.has(p.slug));
  console.log(`\n\n${'='.repeat(50)}`);
  console.log('UNMAPPED CATALOG FRAMES (no image bank folder):');
  for (const p of unmapped) {
    console.log(`  - ${p.name} (${p.slug}) — ${p.images?.length || 0} existing Wix images`);
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('SUMMARY');
  console.log(`  Folders processed: ${Object.keys(report.folders).length}`);
  console.log(`  Images downloaded: ${report.downloaded}`);
  console.log(`  Images skipped:    ${report.skipped}`);
  console.log(`  Errors:            ${report.errors}`);

  // Write report JSON
  const reportPath = join(OUTPUT_DIR, 'download-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${reportPath}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
