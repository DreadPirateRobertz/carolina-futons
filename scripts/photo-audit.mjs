#!/usr/bin/env node
/**
 * Photo Audit Script (CF-ltuu)
 *
 * Cross-references catalog-MASTER.json product images against live CDN.
 * Produces photo-audit.json with per-product pass/fail and gap report.
 *
 * Usage: node scripts/photo-audit.mjs [--check-urls] [--output path]
 *   --check-urls   HEAD-check each image URL (slow, ~300 requests)
 *   --output       Output path (default: docs/photo-audit.json)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const checkUrls = args.includes('--check-urls');
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : join(process.cwd(), 'docs', 'photo-audit.json');

const catalog = JSON.parse(readFileSync(join(process.cwd(), 'content', 'catalog-MASTER.json'), 'utf8'));
const products = catalog.products;

const MIN_IMAGES = 3;
const IDEAL_IMAGES = 6;

async function checkUrl(url) {
  try {
    const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    return { status: resp.status, ok: resp.ok, size: resp.headers.get('content-length') };
  } catch (e) {
    return { status: 0, ok: false, error: e.message };
  }
}

async function run() {
  const categoryStats = {};
  const productAudits = [];
  const gaps = [];
  let totalImages = 0;
  let totalBroken = 0;
  let totalProducts = products.length;

  for (const product of products) {
    const images = product.images || [];
    const cat = product.category || 'uncategorized';
    totalImages += images.length;

    if (!categoryStats[cat]) {
      categoryStats[cat] = { products: 0, totalImages: 0, gaps: 0, broken: 0 };
    }
    categoryStats[cat].products++;
    categoryStats[cat].totalImages += images.length;

    const audit = {
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      category: cat,
      url: product.url,
      imageCount: images.length,
      meetsMinimum: images.length >= MIN_IMAGES,
      meetsIdeal: images.length >= IDEAL_IMAGES,
      deficit: Math.max(0, MIN_IMAGES - images.length),
      images: [],
    };

    if (checkUrls) {
      for (const imgUrl of images) {
        const result = await checkUrl(imgUrl);
        audit.images.push({
          url: imgUrl,
          status: result.status,
          ok: result.ok,
          sizeBytes: result.size ? parseInt(result.size) : null,
          error: result.error || null,
        });
        if (!result.ok) {
          totalBroken++;
          categoryStats[cat].broken++;
        }
      }
    } else {
      audit.images = images.map(url => ({ url, status: 'unchecked' }));
    }

    if (!audit.meetsMinimum) {
      gaps.push({
        name: product.name,
        slug: product.slug,
        category: cat,
        currentImages: images.length,
        needed: MIN_IMAGES - images.length,
        url: product.url,
      });
      categoryStats[cat].gaps++;
    }

    productAudits.push(audit);
  }

  // Sort gaps by deficit (worst first), then by category
  gaps.sort((a, b) => b.needed - a.needed || a.category.localeCompare(b.category));

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedBy: 'scripts/photo-audit.mjs (CF-ltuu)',
      catalogVersion: catalog.catalogVersion,
      urlsChecked: checkUrls,
      minimumImagesPerProduct: MIN_IMAGES,
      idealImagesPerProduct: IDEAL_IMAGES,
    },
    summary: {
      totalProducts,
      totalImages,
      productsWithGaps: gaps.length,
      productsMeetingMinimum: totalProducts - gaps.length,
      productsMeetingIdeal: productAudits.filter(a => a.meetsIdeal).length,
      averageImagesPerProduct: +(totalImages / totalProducts).toFixed(1),
      totalBrokenUrls: checkUrls ? totalBroken : 'not checked',
      totalImagesNeeded: gaps.reduce((sum, g) => sum + g.needed, 0),
    },
    categoryBreakdown: Object.entries(categoryStats)
      .sort(([, a], [, b]) => (a.totalImages / a.products) - (b.totalImages / b.products))
      .map(([cat, stats]) => ({
        category: cat,
        products: stats.products,
        totalImages: stats.totalImages,
        avgImagesPerProduct: +(stats.totalImages / stats.products).toFixed(1),
        productsWithGaps: stats.gaps,
        brokenUrls: checkUrls ? stats.broken : 'not checked',
      })),
    gaps,
    products: productAudits,
  };

  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  // Console summary
  console.log(`\nPhoto Audit Report (CF-ltuu)`);
  console.log('─'.repeat(60));
  console.log(`Products: ${totalProducts} | Images: ${totalImages} | Avg: ${report.summary.averageImagesPerProduct}/product`);
  console.log(`Meeting min (${MIN_IMAGES}): ${report.summary.productsMeetingMinimum}/${totalProducts} (${Math.round(report.summary.productsMeetingMinimum/totalProducts*100)}%)`);
  console.log(`Meeting ideal (${IDEAL_IMAGES}): ${report.summary.productsMeetingIdeal}/${totalProducts} (${Math.round(report.summary.productsMeetingIdeal/totalProducts*100)}%)`);
  console.log(`Products with gaps: ${gaps.length} | Images needed: ${report.summary.totalImagesNeeded}`);
  if (checkUrls) console.log(`Broken URLs: ${totalBroken}`);

  console.log(`\nCategory breakdown (sorted by avg images, worst first):`);
  for (const cat of report.categoryBreakdown) {
    const bar = '█'.repeat(Math.round(cat.avgImagesPerProduct)) + '░'.repeat(Math.max(0, IDEAL_IMAGES - Math.round(cat.avgImagesPerProduct)));
    console.log(`  ${cat.category.padEnd(25)} ${cat.avgImagesPerProduct.toFixed(1).padStart(4)}/product ${bar}  (${cat.productsWithGaps} gaps)`);
  }

  console.log(`\nTop gaps (need most images):`);
  for (const gap of gaps.slice(0, 15)) {
    console.log(`  ${gap.name.padEnd(35)} ${gap.category.padEnd(20)} ${gap.currentImages} imgs, need +${gap.needed}`);
  }

  console.log(`\nReport written to: ${outputPath}`);
}

run().catch(e => { console.error(e); process.exit(1); });
