/**
 * seedCf3qtCollections.js — Seeds the cf-3qt Phase 4/5 CMS collections
 * (Landings, ComparisonFeatures) with initial content via the Wix Data Items
 * REST API. Idempotent: skips rows that already exist (keyed on `slug` for
 * Landings, `featureKey` for ComparisonFeatures).
 *
 * PressMentions and PressKitAssets are intentionally NOT seeded here:
 *   - PressMentions → empty on launch (melania owns outreach placements)
 *   - PressKitAssets → godfrey owns asset provisioning (logos, fact sheet)
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
 * Landings seed rows — three launch-critical landing pages.
 * spring-sale copy is a placeholder pending radahn's pull from the current
 * Wix Studio Sale page. winback copy is a minimal stub matching the UTM
 * default contract. press copy is fresh + matches the roadmap treatment
 * documented in docs/cf-3qt/CMS-COLLECTION-AUDIT.md §5.
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
  {
    slug: 'press',
    title: 'Press',
    headline: 'Carolina Futons in the News',
    subheadline: 'Media mentions, company milestones, and a downloadable press kit.',
    heroImageUrl: 'https://static.wixstatic.com/media/placeholder-press-hero.jpg',
    ctaPrimaryLabel: 'Contact press@carolinafutons.com',
    ctaPrimaryHref: 'mailto:press@carolinafutons.com',
    ctaSecondaryLabel: 'Download press kit',
    ctaSecondaryHref: '#press-kit',
    bodyMdx: 'Carolina Futons has been hand-building solid wood futon frames in Hendersonville, NC since 1994. For interview requests, product samples, or high-resolution imagery, please reach out via the contact above.',
    utmDefaults: 'utm_source=press&utm_medium=onsite&utm_campaign=press-page',
    seoDescription: 'Carolina Futons press page — media contact, company background, and press kit downloads.',
    ogImageUrl: 'https://static.wixstatic.com/media/placeholder-press-og.jpg',
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
    featureKey: 'cushion',
    label: 'Cushion / mattress',
    description: 'Mattress construction options.',
    category: 'comfort',
    sortOrder: 20,
    values: 'Cotton + foam core, innerspring, or memory-foam top — multiple firmness options.',
  },
  {
    featureKey: 'warranty',
    label: 'Warranty',
    description: 'Frame and mattress warranty coverage.',
    category: 'policy',
    sortOrder: 30,
    values: '10-year frame warranty · 5-year mattress warranty.',
  },
  {
    featureKey: 'assembly',
    label: 'Assembly',
    description: 'How the futon arrives and what setup is required.',
    category: 'logistics',
    sortOrder: 40,
    values: 'Ships flat-packed · 20–40 min assembly · only a Phillips screwdriver required.',
  },
  {
    featureKey: 'delivery',
    label: 'Delivery',
    description: 'Shipping and local-delivery options.',
    category: 'logistics',
    sortOrder: 50,
    values: 'Free UPS ground in the continental US · local delivery within NC pickup zone · Hendersonville showroom pickup.',
  },
  {
    featureKey: 'made_in_usa',
    label: 'Made in USA',
    description: 'Where the frame and mattress are produced.',
    category: 'origin',
    sortOrder: 60,
    values: 'Every frame and cotton-core mattress is built in Hendersonville, NC.',
  },
  {
    featureKey: 'customization',
    label: 'Customization',
    description: 'Finish and configuration options.',
    category: 'build',
    sortOrder: 70,
    values: '6 stain finishes · queen, full, and loveseat sizes · optional drawer/storage base.',
  },
  {
    featureKey: 'price_range',
    label: 'Price range',
    description: 'Typical frame + mattress bundle pricing.',
    category: 'policy',
    sortOrder: 80,
    values: '$499–$1,899 depending on size, wood, and mattress choice. CF+ members save an additional 10%.',
  },
];

/**
 * Seed manifest — maps each collection to its rows and the unique key used
 * for idempotent checks.
 */
const SEED_MANIFEST = [
  { collection: 'Landings',           uniqueKey: 'slug',       rows: LANDINGS_SEED },
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
