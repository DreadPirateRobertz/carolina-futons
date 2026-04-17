/**
 * seedCf3qtCollections.js — Seeds the cf-3qt Phase 4/5 CMS collections
 * (Landings, PressMentions, PressKitAssets, ComparisonFeatures) with initial
 * content via the Wix Data Items REST API. Idempotent: skips rows whose
 * unique-key value already exists (slug / articleUrl / fileUrl / featureKey).
 *
 * Seed counts (target from melania 2026-04-17):
 *   Landings:           2 rows   (spring-sale, winback)
 *   PressMentions:      3 rows   (placeholder outreach entries — melania
 *                                 replaces with real placements as they land)
 *   PressKitAssets:     1 row    (primary logo — godfrey replaces URL once
 *                                 the final SVG is in the Wix media library)
 *   ComparisonFeatures: 20 rows  (feature-matrix rows for /compare)
 *
 * Usage (requires WIX_API_KEY + WIX_SITE_ID env vars):
 *   node scripts/seedCf3qtCollections.js --status
 *   node scripts/seedCf3qtCollections.js --seed --dry-run
 *   node scripts/seedCf3qtCollections.js --seed
 *   node scripts/seedCf3qtCollections.js --manifest
 *
 * @module seedCf3qtCollections
 */

const ITEMS_API = 'https://www.wixapis.com/wix-data/v2/items';
const QUERY_API = 'https://www.wixapis.com/wix-data/v2/items/query';

/**
 * Landings seed rows — two launch-critical landing pages.
 * spring-sale copy is a placeholder pending radahn's pull from the current
 * Wix Studio Sale page. winback copy is a minimal stub matching the UTM
 * default contract. The /press page ships with its Landings row added
 * via Wix CMS UI once outreach content solidifies (see CMS-COLLECTION-AUDIT §5).
 */
const LANDINGS_SEED = [
  {
    slug: 'spring-sale',
    title: 'Spring Sale',
    headline: 'Spring Sale — Save on Every Futon',
    subheadline: 'Limited-time pricing on our most-loved frames and mattresses.',
    heroImageUrl: 'https://static.wixstatic.com/media/placeholder-spring-sale.jpg',
    ctaPrimaryLabel: 'Shop the sale',
    ctaPrimaryHref: '/category/sale',
    ctaSecondaryLabel: 'See new arrivals',
    ctaSecondaryHref: '/category/new',
    bodyMdx: '<!-- TODO(radahn): port hero/body copy from current Wix Studio Sale page -->',
    utmDefaults: 'utm_source=landing&utm_medium=onsite&utm_campaign=spring-sale',
    seoDescription: 'Carolina Futons spring sale — solid wood futon frames and mattresses at seasonal pricing.',
    ogImageUrl: 'https://static.wixstatic.com/media/placeholder-spring-sale-og.jpg',
  },
  {
    slug: 'winback',
    title: 'Welcome Back',
    headline: "We've missed you",
    subheadline: 'Exclusive pricing for returning customers.',
    heroImageUrl: 'https://static.wixstatic.com/media/placeholder-winback.jpg',
    ctaPrimaryLabel: 'Claim your offer',
    ctaPrimaryHref: '/category/all',
    ctaSecondaryLabel: 'Browse new arrivals',
    ctaSecondaryHref: '/category/new',
    bodyMdx: '<!-- TODO(melania/strategy): port winback copy from klaviyo-migration-spike.md once approved -->',
    utmDefaults: 'utm_source=email&utm_medium=winback&utm_campaign=re-engagement',
    seoDescription: 'A welcome-back offer from Carolina Futons for returning customers.',
    ogImageUrl: 'https://static.wixstatic.com/media/placeholder-winback-og.jpg',
  },
];

/**
 * PressMentions seed rows — placeholder outreach entries so the /press page
 * can render a non-empty list on launch. melania replaces each row with real
 * placements as outreach lands (see media-research.json). The `featured`
 * flag and `sortOrder` let the page highlight the most recent/impactful.
 */
const PRESS_MENTIONS_SEED = [
  {
    outlet: 'Southern Living',
    outletLogoUrl: 'https://static.wixstatic.com/media/placeholder-southern-living-logo.svg',
    articleTitle: 'Hand-built in the Blue Ridge: Carolina Futons turns 30',
    articleUrl: 'https://carolinafutons.com/press/placeholder/southern-living-30th',
    publishedDate: '2026-03-01T00:00:00.000Z',
    excerpt: 'TODO(melania): replace with real excerpt once the Southern Living piece runs.',
    category: 'feature',
    featured: true,
    sortOrder: 10,
  },
  {
    outlet: 'Asheville Citizen Times',
    outletLogoUrl: 'https://static.wixstatic.com/media/placeholder-asheville-citizen-logo.svg',
    articleTitle: 'Local makers spotlight: Carolina Futons',
    articleUrl: 'https://carolinafutons.com/press/placeholder/asheville-citizen-local-makers',
    publishedDate: '2026-02-15T00:00:00.000Z',
    excerpt: 'TODO(melania): replace with real excerpt once the local makers feature publishes.',
    category: 'local',
    featured: false,
    sortOrder: 20,
  },
  {
    outlet: 'Apartment Therapy',
    outletLogoUrl: 'https://static.wixstatic.com/media/placeholder-apartment-therapy-logo.svg',
    articleTitle: 'The best solid-wood futons for small spaces',
    articleUrl: 'https://carolinafutons.com/press/placeholder/apartment-therapy-roundup',
    publishedDate: '2026-01-20T00:00:00.000Z',
    excerpt: 'TODO(melania): replace with real excerpt once Apartment Therapy publishes the roundup.',
    category: 'roundup',
    featured: false,
    sortOrder: 30,
  },
];

/**
 * PressKitAssets seed rows — minimum-viable: the primary logo so /press
 * can render a downloadable press kit section on launch. godfrey replaces
 * `fileUrl` with the real SVG URL once the final asset is uploaded to the
 * Wix media library. Additional assets (product shots, fact sheet PDF)
 * are added via Wix CMS UI as they land.
 */
const PRESS_KIT_ASSETS_SEED = [
  {
    name: 'Carolina Futons Logo (SVG)',
    description: 'Primary wordmark logo in scalable vector format. Use on light backgrounds.',
    fileUrl: 'https://static.wixstatic.com/media/placeholder-cf-logo.svg',
    fileType: 'image/svg+xml',
    fileSizeBytes: 0,
    category: 'logo',
    sortOrder: 10,
  },
];

/**
 * ComparisonFeatures seed rows — feature matrix for `/compare`.
 * Values is stored as rich-text so the page can render Yes/No markers or
 * nested spec rows per product. Initial rows mirror the core differentiators
 * on the current Wix Studio Compare page.
 */
const COMPARISON_FEATURES_SEED = [
  {
    featureKey: 'frame_material',
    label: 'Frame material',
    description: 'What the futon frame is built from.',
    category: 'build',
    sortOrder: 10,
    values: 'Solid North American hardwood (oak, cherry, maple) — no MDF or particleboard.',
  },
  {
    featureKey: 'frame_joinery',
    label: 'Joinery',
    description: 'How the frame pieces are joined.',
    category: 'build',
    sortOrder: 20,
    values: 'Mortise-and-tenon plus through-bolt construction — no staples or glue-only joints.',
  },
  {
    featureKey: 'finish',
    label: 'Finish options',
    description: 'Available wood-stain finishes.',
    category: 'build',
    sortOrder: 30,
    values: '6 hand-rubbed stain finishes: Natural, Honey, Walnut, Espresso, Whitewash, Black.',
  },
  {
    featureKey: 'customization',
    label: 'Customization',
    description: 'Per-order configuration options.',
    category: 'build',
    sortOrder: 40,
    values: 'Queen, Full, Twin, Loveseat sizes · drawer base add-on · arm-style choice.',
  },
  {
    featureKey: 'cushion',
    label: 'Cushion / mattress',
    description: 'Mattress construction options.',
    category: 'comfort',
    sortOrder: 50,
    values: 'Cotton + foam core, innerspring, or memory-foam top — multiple firmness levels.',
  },
  {
    featureKey: 'firmness',
    label: 'Firmness levels',
    description: 'Number of firmness options per mattress type.',
    category: 'comfort',
    sortOrder: 60,
    values: '3 firmness levels per mattress line (Soft, Medium, Firm) — try in-showroom.',
  },
  {
    featureKey: 'convert_action',
    label: 'Sit-to-sleep conversion',
    description: 'How the frame converts between couch and bed.',
    category: 'comfort',
    sortOrder: 70,
    values: 'One-hand trifold conversion — no tools, no latches to release.',
  },
  {
    featureKey: 'covers',
    label: 'Covers',
    description: 'Removable / washable cover options.',
    category: 'comfort',
    sortOrder: 80,
    values: 'Removable zippered covers in 40+ fabrics · machine-washable cotton canvas line.',
  },
  {
    featureKey: 'assembly',
    label: 'Assembly',
    description: 'How the futon arrives and what setup is required.',
    category: 'logistics',
    sortOrder: 90,
    values: 'Ships flat-packed · 20–40 min assembly · only a Phillips screwdriver required.',
  },
  {
    featureKey: 'packaging',
    label: 'Packaging',
    description: 'Shipping-box weight and footprint.',
    category: 'logistics',
    sortOrder: 100,
    values: '2-box shipment (frame + mattress) · avg 72 lb combined · fits through 30" doorways.',
  },
  {
    featureKey: 'delivery',
    label: 'Delivery',
    description: 'Shipping and local-delivery options.',
    category: 'logistics',
    sortOrder: 110,
    values: 'Free UPS ground in the continental US · local delivery within NC pickup zone · Hendersonville showroom pickup.',
  },
  {
    featureKey: 'lead_time',
    label: 'Lead time',
    description: 'Build + ship turnaround.',
    category: 'logistics',
    sortOrder: 120,
    values: 'Stocked frames ship in 3–5 business days · custom finishes 2–3 weeks.',
  },
  {
    featureKey: 'warranty_frame',
    label: 'Frame warranty',
    description: 'Frame-only warranty coverage.',
    category: 'policy',
    sortOrder: 130,
    values: '10-year limited warranty against defects in materials and workmanship.',
  },
  {
    featureKey: 'warranty_mattress',
    label: 'Mattress warranty',
    description: 'Mattress-only warranty coverage.',
    category: 'policy',
    sortOrder: 140,
    values: '5-year limited warranty on cotton-core and innerspring mattresses.',
  },
  {
    featureKey: 'returns',
    label: 'Returns',
    description: 'Return and trial policy.',
    category: 'policy',
    sortOrder: 150,
    values: '30-day in-home trial · prepaid return label if unsatisfied.',
  },
  {
    featureKey: 'price_range',
    label: 'Price range',
    description: 'Typical frame + mattress bundle pricing.',
    category: 'policy',
    sortOrder: 160,
    values: '$499–$1,899 depending on size, wood, and mattress choice. CF+ members save an additional 10%.',
  },
  {
    featureKey: 'financing',
    label: 'Financing',
    description: 'Buy-now-pay-later options at checkout.',
    category: 'policy',
    sortOrder: 170,
    values: 'Affirm and Afterpay available at checkout · 0% APR for qualified buyers.',
  },
  {
    featureKey: 'made_in_usa',
    label: 'Made in USA',
    description: 'Where the frame and mattress are produced.',
    category: 'origin',
    sortOrder: 180,
    values: 'Every frame and cotton-core mattress is built in Hendersonville, NC.',
  },
  {
    featureKey: 'materials_sourcing',
    label: 'Materials sourcing',
    description: 'Where raw materials are sourced from.',
    category: 'origin',
    sortOrder: 190,
    values: 'Hardwood from Appalachian hardwood belt · US-grown organic cotton for mattress cores.',
  },
  {
    featureKey: 'eco',
    label: 'Sustainability',
    description: 'Environmental certifications and practices.',
    category: 'origin',
    sortOrder: 200,
    values: 'Low-VOC finishes · CARB Phase-2 compliant · take-back program for old futons within NC.',
  },
];

/**
 * Seed manifest — maps each collection to its rows and the unique key used
 * for idempotent checks.
 */
const SEED_MANIFEST = [
  { collection: 'Landings',           uniqueKey: 'slug',       rows: LANDINGS_SEED },
  { collection: 'PressMentions',      uniqueKey: 'articleUrl', rows: PRESS_MENTIONS_SEED },
  { collection: 'PressKitAssets',     uniqueKey: 'fileUrl',    rows: PRESS_KIT_ASSETS_SEED },
  { collection: 'ComparisonFeatures', uniqueKey: 'featureKey', rows: COMPARISON_FEATURES_SEED },
];

function buildHeaders(apiKey, siteId) {
  return {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch the set of unique-key values already present in a collection.
 *
 * @param {{ collection: string, uniqueKey: string, headers: object }} opts
 * @returns {Promise<Set<string>>}
 */
async function fetchExistingKeys({ collection, uniqueKey, headers }) {
  const res = await fetch(QUERY_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ dataCollectionId: collection, query: { paging: { limit: 1000 } } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '(response body unreadable)');
    throw new Error(`Failed to query ${collection} (${res.status}): ${text}`);
  }
  const body = await res.json();
  const items = Array.isArray(body?.dataItems) ? body.dataItems : [];
  return new Set(
    items
      .map((item) => item?.data?.[uniqueKey])
      .filter((v) => typeof v === 'string' && v.length > 0),
  );
}

/**
 * Report which seed rows are already present vs. pending.
 *
 * @param {{ apiKey: string, siteId: string }} opts
 * @returns {Promise<Array<{ collection: string, uniqueKey: string, rowKey: string, exists: boolean }>>}
 */
async function getSeedStatus(opts) {
  const { apiKey, siteId } = opts;
  if (!apiKey || !siteId) {
    throw new Error('getSeedStatus requires apiKey and siteId');
  }
  const headers = buildHeaders(apiKey, siteId);

  const report = [];
  for (const { collection, uniqueKey, rows } of SEED_MANIFEST) {
    const existing = await fetchExistingKeys({ collection, uniqueKey, headers });
    for (const row of rows) {
      report.push({
        collection,
        uniqueKey,
        rowKey: row[uniqueKey],
        exists: existing.has(row[uniqueKey]),
      });
    }
  }
  return report;
}

/**
 * Insert the seed rows for each collection, skipping rows whose unique-key
 * value already exists. Individual insert errors are captured in the results
 * array so one bad row does not halt the rest.
 *
 * @param {{ apiKey: string, siteId: string, dryRun?: boolean }} opts
 * @returns {Promise<{ results: Array<{ collection: string, rowKey: string, status: string, detail: string }> }>}
 */
async function seedCollections(opts) {
  const { apiKey, siteId, dryRun = false } = opts;
  if (!apiKey || !siteId) {
    throw new Error('seedCollections requires apiKey and siteId');
  }
  const headers = buildHeaders(apiKey, siteId);

  const results = [];

  for (const { collection, uniqueKey, rows } of SEED_MANIFEST) {
    const existing = await fetchExistingKeys({ collection, uniqueKey, headers });

    for (const row of rows) {
      const rowKey = row[uniqueKey];

      if (existing.has(rowKey)) {
        results.push({ collection, rowKey, status: 'EXISTS', detail: 'Row already seeded' });
        continue;
      }

      if (dryRun) {
        results.push({ collection, rowKey, status: 'WOULD_INSERT', detail: 'Would insert (dry run)' });
        continue;
      }

      try {
        const createRes = await fetch(ITEMS_API, {
          method: 'POST',
          headers,
          body: JSON.stringify({ dataCollectionId: collection, dataItem: { data: row } }),
        });
        if (!createRes.ok) {
          const text = await createRes.text().catch(() => '(response body unreadable)');
          results.push({ collection, rowKey, status: 'ERROR', detail: `Insert failed (${createRes.status}): ${text}` });
        } else {
          results.push({ collection, rowKey, status: 'INSERTED', detail: 'Inserted successfully' });
        }
      } catch (err) {
        console.error(`Error inserting ${collection}/${rowKey}:`, err);
        results.push({
          collection,
          rowKey,
          status: 'ERROR',
          detail: `${err.constructor.name}: ${err.message}`,
        });
      }
    }
  }

  return { results };
}

async function main() {
  const args = process.argv.slice(2);
  let mode = null;
  let dryRun = false;

  for (const arg of args) {
    if (arg === '--status') mode = 'status';
    else if (arg === '--seed') mode = 'seed';
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--manifest') mode = 'manifest';
    else if (arg === '--help') {
      console.log(`Usage: node seedCf3qtCollections.js [options]

Options:
  --status      Check which seed rows are already present
  --seed        Insert missing seed rows via Wix Data Items API
  --dry-run     Show what would be inserted without making changes
  --manifest    Print seed manifest as JSON
  --help        Show this help

Environment variables (required for API calls):
  WIX_API_KEY   Wix REST API key
  WIX_SITE_ID   Wix site ID

Example:
  node seedCf3qtCollections.js --status
  node seedCf3qtCollections.js --seed --dry-run
  node seedCf3qtCollections.js --seed`);
      process.exit(0);
    }
  }

  if (mode === 'manifest') {
    console.log(JSON.stringify(SEED_MANIFEST, null, 2));
    process.exit(0);
  }

  if (!mode) {
    console.error('Error: specify --status, --seed, or --manifest. Use --help for usage.');
    process.exit(1);
  }

  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey || !siteId) {
    console.error('Error: WIX_API_KEY and WIX_SITE_ID environment variables are required.');
    process.exit(1);
  }

  const STATUS_ICONS = { ERROR: '✗', EXISTS: '○', INSERTED: '✓', WOULD_INSERT: '✓' };

  if (mode === 'status') {
    try {
      const status = await getSeedStatus({ apiKey, siteId });
      console.log('\ncf-3qt Seed Row Status:\n');
      for (const s of status) {
        const icon = s.exists ? '✓' : '○';
        console.log(`  ${icon} ${s.collection}/${s.rowKey}`);
      }
      const existCount = status.filter((s) => s.exists).length;
      console.log(`\n${existCount}/${status.length} seed rows present.\n`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  } else if (mode === 'seed') {
    console.log(dryRun ? '\n--- DRY RUN ---\n' : '\n--- SEEDING ---\n');
    try {
      const { results } = await seedCollections({ apiKey, siteId, dryRun });
      for (const r of results) {
        const icon = STATUS_ICONS[r.status] || '?';
        console.log(`  ${icon} ${r.collection}/${r.rowKey}: ${r.detail}`);
      }
      const errors = results.filter((r) => r.status === 'ERROR');
      if (errors.length > 0) {
        console.error(`\n${errors.length} error(s) — see above.`);
        process.exit(1);
      }
      console.log('\nDone.');
    } catch (err) {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    }
  }
}

module.exports = {
  SEED_MANIFEST,
  LANDINGS_SEED,
  PRESS_MENTIONS_SEED,
  PRESS_KIT_ASSETS_SEED,
  COMPARISON_FEATURES_SEED,
  buildHeaders,
  fetchExistingKeys,
  getSeedStatus,
  seedCollections,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
  });
}
