/**
 * provisionCmsCollections.js — Provisions Wix CMS collections via REST API.
 *
 * Defines the 16 priority CMS collections from MASTER-HOOKUP.md Step 4 with
 * their field schemas, types, and permissions. Can list existing collections,
 * create missing ones via the Wix Data Collections REST API, or generate a
 * status report.
 *
 * Usage (standalone — requires WIX_API_KEY + WIX_SITE_ID env vars):
 *   node scripts/provisionCmsCollections.js --status
 *   node scripts/provisionCmsCollections.js --provision --dry-run
 *   node scripts/provisionCmsCollections.js --provision
 *   node scripts/provisionCmsCollections.js --manifest
 *
 * @module provisionCmsCollections
 */

const COLLECTIONS_API = 'https://www.wixapis.com/wix-data/v2/collections';

const VALID_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATETIME', 'BOOLEAN', 'IMAGE', 'URL', 'RICH_TEXT', 'TAGS'];
const VALID_PERMISSIONS = ['ADMIN', 'MEMBER', 'ANYONE'];

/**
 * Helper to define a field.
 * @param {string} key
 * @param {string} displayName
 * @param {string} type
 * @returns {{ key: string, displayName: string, type: string }}
 */
function field(key, displayName, type) {
  return { key, displayName, type };
}

/**
 * Collection manifest — all 16 required collections per MASTER-HOOKUP.md Step 4.
 * Field schemas derived from backend module usage analysis.
 */
const COLLECTION_MANIFEST = [
  {
    id: 'ContactSubmissions',
    displayName: 'Contact Submissions',
    fields: [
      field('email', 'Email', 'TEXT'),
      field('name', 'Name', 'TEXT'),
      field('phone', 'Phone', 'TEXT'),
      field('subject', 'Subject', 'TEXT'),
      field('message', 'Message', 'RICH_TEXT'),
      field('submittedAt', 'Submitted At', 'DATETIME'),
      field('status', 'Status', 'TEXT'),
      field('source', 'Source', 'TEXT'),
      field('notes', 'Notes', 'TEXT'),
      field('productId', 'Product ID', 'TEXT'),
      field('productName', 'Product Name', 'TEXT'),
    ],
    permissions: { read: 'ADMIN', insert: 'ANYONE', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'ProductAnalytics',
    displayName: 'Product Analytics',
    fields: [
      field('productId', 'Product ID', 'TEXT'),
      field('productName', 'Product Name', 'TEXT'),
      field('category', 'Category', 'TEXT'),
      field('viewCount', 'View Count', 'NUMBER'),
      field('lastViewed', 'Last Viewed', 'DATETIME'),
      field('addToCartCount', 'Add to Cart Count', 'NUMBER'),
      field('purchaseCount', 'Purchase Count', 'NUMBER'),
    ],
    permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'Promotions',
    displayName: 'Promotions',
    fields: [
      field('title', 'Title', 'TEXT'),
      field('subtitle', 'Subtitle', 'TEXT'),
      field('theme', 'Theme', 'TEXT'),
      field('heroImage', 'Hero Image', 'IMAGE'),
      field('startDate', 'Start Date', 'DATETIME'),
      field('endDate', 'End Date', 'DATETIME'),
      field('discountCode', 'Discount Code', 'TEXT'),
      field('discountPercent', 'Discount Percent', 'NUMBER'),
      field('ctaUrl', 'CTA URL', 'TEXT'),
      field('ctaText', 'CTA Text', 'TEXT'),
      field('isActive', 'Is Active', 'BOOLEAN'),
    ],
    permissions: { read: 'ANYONE', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'EmailQueue',
    displayName: 'Email Queue',
    fields: [
      field('recipientEmail', 'Recipient Email', 'TEXT'),
      field('recipientName', 'Recipient Name', 'TEXT'),
      field('sequenceType', 'Sequence Type', 'TEXT'),
      field('step', 'Step', 'NUMBER'),
      field('status', 'Status', 'TEXT'),
      field('scheduledFor', 'Scheduled For', 'DATETIME'),
      field('sentAt', 'Sent At', 'DATETIME'),
      field('templateId', 'Template ID', 'TEXT'),
      field('variables', 'Variables', 'RICH_TEXT'),
      field('openedAt', 'Opened At', 'DATETIME'),
      field('clickedAt', 'Clicked At', 'DATETIME'),
      field('errorMessage', 'Error Message', 'TEXT'),
      field('retryCount', 'Retry Count', 'NUMBER'),
      field('lastRetryAt', 'Last Retry At', 'DATETIME'),
    ],
    permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'Unsubscribes',
    displayName: 'Unsubscribes',
    fields: [
      field('email', 'Email', 'TEXT'),
      field('unsubscribedAt', 'Unsubscribed At', 'DATETIME'),
      field('source', 'Source', 'TEXT'),
    ],
    permissions: { read: 'ADMIN', insert: 'ANYONE', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'AbandonedCarts',
    displayName: 'Abandoned Carts',
    fields: [
      field('checkoutId', 'Checkout ID', 'TEXT'),
      field('buyerEmail', 'Buyer Email', 'TEXT'),
      field('cartTotal', 'Cart Total', 'NUMBER'),
      field('abandonedAt', 'Abandoned At', 'DATETIME'),
      field('status', 'Status', 'TEXT'),
      field('recoveryEmailSent', 'Recovery Email Sent', 'BOOLEAN'),
      field('lastEmailSent', 'Last Email Sent', 'DATETIME'),
    ],
    permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'Fulfillments',
    displayName: 'Fulfillments',
    fields: [
      field('orderId', 'Order ID', 'TEXT'),
      field('trackingNumber', 'Tracking Number', 'TEXT'),
      field('carrier', 'Carrier', 'TEXT'),
      field('serviceType', 'Service Type', 'TEXT'),
      field('labelUrl', 'Label URL', 'TEXT'),
      field('labelCreatedDate', 'Label Created Date', 'DATETIME'),
      field('estimatedDelivery', 'Estimated Delivery', 'DATETIME'),
      field('status', 'Status', 'TEXT'),
      field('lastStatusUpdate', 'Last Status Update', 'DATETIME'),
      field('shipFromAddress', 'Ship From Address', 'TEXT'),
      field('shipToAddress', 'Ship To Address', 'TEXT'),
      field('packageWeight', 'Package Weight', 'TEXT'),
      field('packageDimensions', 'Package Dimensions', 'TEXT'),
    ],
    permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'GiftCards',
    displayName: 'Gift Cards',
    fields: [
      field('code', 'Code', 'TEXT'),
      field('balance', 'Balance', 'NUMBER'),
      field('originalBalance', 'Original Balance', 'NUMBER'),
      field('purchaserEmail', 'Purchaser Email', 'TEXT'),
      field('recipientEmail', 'Recipient Email', 'TEXT'),
      field('status', 'Status', 'TEXT'),
      field('expirationDate', 'Expiration Date', 'DATETIME'),
      field('createdDate', 'Created Date', 'DATETIME'),
    ],
    permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'DeliverySchedule',
    displayName: 'Delivery Schedule',
    fields: [
      field('orderId', 'Order ID', 'TEXT'),
      field('date', 'Date', 'DATETIME'),
      field('timeWindow', 'Time Window', 'TEXT'),
      field('type', 'Type', 'TEXT'),
      field('status', 'Status', 'TEXT'),
      field('customerName', 'Customer Name', 'TEXT'),
      field('address', 'Address', 'TEXT'),
    ],
    permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'AssemblyGuides',
    displayName: 'Assembly Guides',
    fields: [
      field('sku', 'SKU', 'TEXT'),
      field('title', 'Title', 'TEXT'),
      field('instructions', 'Instructions', 'RICH_TEXT'),
      field('videoUrl', 'Video URL', 'URL'),
      field('difficulty', 'Difficulty', 'TEXT'),
      field('estimatedTime', 'Estimated Time', 'TEXT'),
      field('category', 'Category', 'TEXT'),
    ],
    permissions: { read: 'ANYONE', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'FabricSwatches',
    displayName: 'Fabric Swatches',
    fields: [
      field('swatchId', 'Swatch ID', 'TEXT'),
      field('swatchName', 'Swatch Name', 'TEXT'),
      field('swatchImage', 'Swatch Image', 'IMAGE'),
      field('colorFamily', 'Color Family', 'TEXT'),
      field('colorHex', 'Color Hex', 'TEXT'),
      field('material', 'Material', 'TEXT'),
      field('careInstructions', 'Care Instructions', 'TEXT'),
      field('availableForProducts', 'Available For Products', 'TAGS'),
      field('sortOrder', 'Sort Order', 'NUMBER'),
    ],
    permissions: { read: 'ANYONE', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'ProductBundles',
    displayName: 'Product Bundles',
    fields: [
      field('bundleId', 'Bundle ID', 'TEXT'),
      field('bundleName', 'Bundle Name', 'TEXT'),
      field('primaryProductId', 'Primary Product ID', 'TEXT'),
      field('bundledProductIds', 'Bundled Product IDs', 'TEXT'),
      field('discountPercent', 'Discount Percent', 'NUMBER'),
      field('isActive', 'Is Active', 'BOOLEAN'),
    ],
    permissions: { read: 'ANYONE', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'CustomerEngagement',
    displayName: 'Customer Engagement',
    fields: [
      field('memberId', 'Member ID', 'TEXT'),
      field('eventType', 'Event Type', 'TEXT'),
      field('eventData', 'Event Data', 'TEXT'),
      field('timestamp', 'Timestamp', 'DATETIME'),
      field('source', 'Source', 'TEXT'),
      field('productId', 'Product ID', 'TEXT'),
    ],
    permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'ReviewRequests',
    displayName: 'Review Requests',
    fields: [
      field('orderId', 'Order ID', 'TEXT'),
      field('buyerEmail', 'Buyer Email', 'TEXT'),
      field('productId', 'Product ID', 'TEXT'),
      field('scheduledDate', 'Scheduled Date', 'DATETIME'),
      field('sentAt', 'Sent At', 'DATETIME'),
      field('status', 'Status', 'TEXT'),
    ],
    permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'ReferralCodes',
    displayName: 'Referral Codes',
    fields: [
      field('code', 'Code', 'TEXT'),
      field('memberId', 'Member ID', 'TEXT'),
      field('referrerCredit', 'Referrer Credit', 'NUMBER'),
      field('friendDiscount', 'Friend Discount', 'NUMBER'),
      field('usedBy', 'Used By', 'TEXT'),
      field('usedAt', 'Used At', 'DATETIME'),
      field('status', 'Status', 'TEXT'),
    ],
    permissions: { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'Videos',
    displayName: 'Videos',
    fields: [
      field('title', 'Title', 'TEXT'),
      field('url', 'URL', 'URL'),
      field('productId', 'Product ID', 'TEXT'),
      field('category', 'Category', 'TEXT'),
      field('viewCount', 'View Count', 'NUMBER'),
      field('isFeatured', 'Is Featured', 'BOOLEAN'),
      field('thumbnailUrl', 'Thumbnail URL', 'TEXT'),
    ],
    permissions: { read: 'ANYONE', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' },
  },
];

/**
 * Validate an array of collection definitions.
 * @param {Array<Object>} collections - Collection definitions to validate
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateManifest(collections) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();

  for (let i = 0; i < collections.length; i++) {
    const c = collections[i];
    const label = c.id || `index ${i}`;

    if (!c.id) {
      errors.push(`Collection at index ${i}: missing id`);
      continue;
    }

    if (seenIds.has(c.id)) {
      errors.push(`Duplicate collection id: ${c.id}`);
    }
    seenIds.add(c.id);

    if (!c.displayName) {
      warnings.push(`Collection ${label}: missing displayName`);
    }

    if (!c.permissions) {
      errors.push(`Collection ${label}: missing permissions`);
    } else {
      for (const perm of ['read', 'insert', 'update', 'remove']) {
        if (!VALID_PERMISSIONS.includes(c.permissions[perm])) {
          errors.push(`Collection ${label}: invalid permission ${perm}=${c.permissions[perm]}`);
        }
      }
    }

    if (!Array.isArray(c.fields) || c.fields.length === 0) {
      errors.push(`Collection ${label}: no fields defined`);
      continue;
    }

    const seenKeys = new Set();
    for (const f of c.fields) {
      if (!f.key) {
        errors.push(`Collection ${label}: field missing key`);
        continue;
      }

      if (seenKeys.has(f.key)) {
        errors.push(`Collection ${label}: Duplicate field key '${f.key}'`);
      }
      seenKeys.add(f.key);

      if (!VALID_FIELD_TYPES.includes(f.type)) {
        errors.push(`Collection ${label}: field '${f.key}' has invalid type '${f.type}'`);
      }

      if (!f.displayName) {
        warnings.push(`Collection ${label}: field '${f.key}' missing displayName`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * List existing CMS collections and compare with manifest.
 * @param {{ apiKey: string, siteId: string }} opts
 * @returns {Promise<Array<{ id: string, exists: boolean }>>}
 */
async function getCollectionStatus(opts) {
  const { apiKey, siteId } = opts;
  const headers = {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };

  const res = await fetch(COLLECTIONS_API, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list collections (${res.status}): ${text}`);
  }

  const body = await res.json();
  const existing = body.dataCollections || [];
  const existingIds = new Set(existing.map((c) => c.id));

  return COLLECTION_MANIFEST.map((entry) => ({
    id: entry.id,
    exists: existingIds.has(entry.id),
  }));
}

/**
 * Provision CMS collections via the Wix Data Collections REST API.
 * Creates collections that don't exist yet. Skips ones that do.
 *
 * @param {{ apiKey: string, siteId: string, dryRun?: boolean }} opts
 * @returns {Promise<{ results: Array<{ id: string, status: string, detail: string }> }>}
 */
async function provisionCollections(opts) {
  const { apiKey, siteId, dryRun = false } = opts;
  const headers = {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };

  const listRes = await fetch(COLLECTIONS_API, { method: 'GET', headers });
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Failed to list collections (${listRes.status}): ${text}`);
  }

  const body = await listRes.json();
  const existing = body.dataCollections || [];
  const existingIds = new Set(existing.map((c) => c.id));

  const results = [];

  for (const entry of COLLECTION_MANIFEST) {
    if (existingIds.has(entry.id)) {
      results.push({
        id: entry.id,
        status: 'EXISTS',
        detail: 'Already exists',
      });
      continue;
    }

    if (dryRun) {
      results.push({
        id: entry.id,
        status: 'WOULD_CREATE',
        detail: 'Would create (dry run)',
      });
      continue;
    }

    try {
      const payload = {
        collection: {
          id: entry.id,
          displayName: entry.displayName,
          fields: entry.fields,
          permissions: entry.permissions,
        },
      };

      const createRes = await fetch(COLLECTIONS_API, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        results.push({
          id: entry.id,
          status: 'ERROR',
          detail: `Create failed (${createRes.status}): ${text}`,
        });
      } else {
        results.push({
          id: entry.id,
          status: 'CREATED',
          detail: 'Created successfully',
        });
      }
    } catch (err) {
      results.push({
        id: entry.id,
        status: 'ERROR',
        detail: err.message,
      });
    }
  }

  return { results };
}

/**
 * CLI entry point.
 */
async function main() {
  const args = process.argv.slice(2);
  let mode = null;
  let dryRun = false;

  for (const arg of args) {
    if (arg === '--status') mode = 'status';
    else if (arg === '--provision') mode = 'provision';
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--manifest') mode = 'manifest';
    else if (arg === '--help') {
      console.log(`Usage: node provisionCmsCollections.js [options]

Options:
  --status      Check which collections exist in Wix
  --provision   Create missing collections via Wix API
  --dry-run     Show what would be created without making changes
  --manifest    Print collection manifest as JSON
  --help        Show this help

Environment variables (required for API calls):
  WIX_API_KEY   Wix REST API key
  WIX_SITE_ID   Wix site ID

Example:
  node provisionCmsCollections.js --status
  node provisionCmsCollections.js --provision --dry-run
  node provisionCmsCollections.js --provision`);
      process.exit(0);
    }
  }

  if (mode === 'manifest') {
    console.log(JSON.stringify(COLLECTION_MANIFEST, null, 2));
    process.exit(0);
  }

  const validation = validateManifest(COLLECTION_MANIFEST);
  if (!validation.valid) {
    console.error('Manifest validation errors:');
    for (const e of validation.errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  if (!mode) {
    console.error('Error: specify --status, --provision, or --manifest. Use --help for usage.');
    process.exit(1);
  }

  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey || !siteId) {
    console.error('Error: WIX_API_KEY and WIX_SITE_ID environment variables are required.');
    process.exit(1);
  }

  if (mode === 'status') {
    try {
      const status = await getCollectionStatus({ apiKey, siteId });
      console.log('\nCMS Collection Status:\n');
      for (const s of status) {
        const icon = s.exists ? '✓' : '○';
        console.log(`  ${icon} ${s.id}`);
      }
      const existCount = status.filter((s) => s.exists).length;
      console.log(`\n${existCount}/${status.length} collections configured.\n`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  } else if (mode === 'provision') {
    console.log(dryRun ? '\n--- DRY RUN ---\n' : '\n--- PROVISIONING ---\n');
    try {
      const { results } = await provisionCollections({ apiKey, siteId, dryRun });
      for (const r of results) {
        const icon = r.status === 'ERROR' ? '✗' : r.status === 'EXISTS' ? '○' : '✓';
        console.log(`  ${icon} ${r.id}: ${r.detail}`);
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

module.exports = { COLLECTION_MANIFEST, validateManifest, provisionCollections, getCollectionStatus };

if (require.main === module) {
  main().catch((err) => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
  });
}
