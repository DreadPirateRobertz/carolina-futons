/**
 * provisionCmsCollections.js — Provisions Wix CMS collections via REST API.
 *
 * Defines the priority CMS collections from MASTER-HOOKUP.md Step 4 with
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

/** All operations restricted to admin. */
const ADMIN_ONLY = { read: 'ADMIN', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' };

/** Public read, admin write. */
const PUBLIC_READ = { read: 'ANYONE', insert: 'ADMIN', update: 'ADMIN', remove: 'ADMIN' };

/**
 * Helper to define a field.
 * @param {string} key - Field key (used in queries)
 * @param {string} displayName - Human-readable field label
 * @param {('TEXT'|'NUMBER'|'DATETIME'|'BOOLEAN'|'IMAGE'|'URL'|'RICH_TEXT'|'TAGS')} type
 * @returns {{ key: string, displayName: string, type: string }}
 */
function field(key, displayName, type) {
  return { key, displayName, type };
}

/**
 * Collection manifest — Phase 1: priority collections per MASTER-HOOKUP.md Step 4.
 * Field schemas derived from backend module data access patterns (*.web.js files).
 * 50+ additional collections are auto-created by backend code on first use (see Step 4 docs).
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
    permissions: ADMIN_ONLY,
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
      field('ctaUrl', 'CTA URL', 'URL'),
      field('ctaText', 'CTA Text', 'TEXT'),
      field('isActive', 'Is Active', 'BOOLEAN'),
    ],
    permissions: PUBLIC_READ,
  },
  {
    id: 'EmailQueue',
    displayName: 'Email Queue',
    fields: [
      field('templateId', 'Template ID', 'TEXT'),
      field('recipientEmail', 'Recipient Email', 'TEXT'),
      field('recipientContactId', 'Recipient Contact ID', 'TEXT'),
      field('variables', 'Variables', 'RICH_TEXT'),
      field('sequenceType', 'Sequence Type', 'TEXT'),
      field('sequenceStep', 'Sequence Step', 'NUMBER'),
      field('checkoutId', 'Checkout ID', 'TEXT'),
      field('status', 'Status', 'TEXT'),
      field('scheduledFor', 'Scheduled For', 'DATETIME'),
      field('sentAt', 'Sent At', 'DATETIME'),
      field('attempt', 'Attempt', 'NUMBER'),
      field('lastError', 'Last Error', 'TEXT'),
      field('abVariant', 'AB Variant', 'TEXT'),
      field('createdAt', 'Created At', 'DATETIME'),
    ],
    permissions: ADMIN_ONLY,
  },
  {
    id: 'Unsubscribes',
    displayName: 'Unsubscribes',
    fields: [
      field('email', 'Email', 'TEXT'),
      field('unsubscribedAt', 'Unsubscribed At', 'DATETIME'),
      field('source', 'Source', 'TEXT'),
    ],
    permissions: { read: 'ADMIN', insert: 'MEMBER', update: 'ADMIN', remove: 'ADMIN' },
  },
  {
    id: 'AbandonedCarts',
    displayName: 'Abandoned Carts',
    fields: [
      field('checkoutId', 'Checkout ID', 'TEXT'),
      field('buyerEmail', 'Buyer Email', 'TEXT'),
      field('buyerName', 'Buyer Name', 'TEXT'),
      field('cartTotal', 'Cart Total', 'NUMBER'),
      field('lineItems', 'Line Items', 'RICH_TEXT'),
      field('abandonedAt', 'Abandoned At', 'DATETIME'),
      field('status', 'Status', 'TEXT'),
      field('recoveryEmailSent', 'Recovery Email Sent', 'BOOLEAN'),
      field('recoveryEmailSentAt', 'Recovery Email Sent At', 'DATETIME'),
    ],
    permissions: ADMIN_ONLY,
  },
  {
    id: 'Fulfillments',
    displayName: 'Fulfillments',
    fields: [
      field('orderId', 'Order ID', 'TEXT'),
      field('orderNumber', 'Order Number', 'TEXT'),
      field('trackingNumber', 'Tracking Number', 'TEXT'),
      field('carrier', 'Carrier', 'TEXT'),
      field('serviceCode', 'Service Code', 'TEXT'),
      field('serviceName', 'Service Name', 'TEXT'),
      field('labelBase64', 'Label Base64', 'TEXT'),
      field('shippingCost', 'Shipping Cost', 'NUMBER'),
      field('status', 'Status', 'TEXT'),
      field('createdDate', 'Created Date', 'DATETIME'),
      field('lastTrackingUpdate', 'Last Tracking Update', 'DATETIME'),
      field('estimatedDelivery', 'Estimated Delivery', 'DATETIME'),
      field('recipientName', 'Recipient Name', 'TEXT'),
      field('recipientCity', 'Recipient City', 'TEXT'),
      field('recipientState', 'Recipient State', 'TEXT'),
    ],
    permissions: ADMIN_ONLY,
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
    permissions: ADMIN_ONLY,
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
    permissions: ADMIN_ONLY,
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
    permissions: PUBLIC_READ,
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
    permissions: PUBLIC_READ,
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
    permissions: PUBLIC_READ,
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
    permissions: ADMIN_ONLY,
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
    permissions: ADMIN_ONLY,
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
    permissions: ADMIN_ONLY,
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
      field('thumbnailUrl', 'Thumbnail URL', 'URL'),
    ],
    permissions: PUBLIC_READ,
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
 * Fetch and parse existing collection IDs from the Wix API.
 * @param {Object} headers - Request headers with auth
 * @returns {Promise<Set<string>>} Set of existing collection IDs
 * @throws {Error} If the API returns a non-OK response or non-JSON body
 */
async function fetchExistingIds(headers) {
  const res = await fetch(COLLECTIONS_API, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '(response body unreadable)');
    throw new Error(`Failed to list collections (${res.status}): ${text}`);
  }

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Wix API returned non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!body || typeof body !== 'object' || !('dataCollections' in body)) {
    const keys = body ? Object.keys(body).join(', ') : 'none';
    throw new Error(`Wix API response missing "dataCollections" key. Response keys: ${keys}`);
  }

  const existing = body.dataCollections || [];
  return new Set(existing.map((c) => c.id));
}

/**
 * Build standard Wix API headers.
 * @param {string} apiKey
 * @param {string} siteId
 * @returns {Object}
 */
function buildHeaders(apiKey, siteId) {
  return {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };
}

/**
 * List existing CMS collections and compare with manifest.
 * @param {{ apiKey: string, siteId: string }} opts
 * @returns {Promise<Array<{ id: string, exists: boolean }>>}
 * @throws {Error} If the Wix API returns a non-OK or non-JSON response
 */
async function getCollectionStatus(opts) {
  const { apiKey, siteId } = opts;
  if (!apiKey || !siteId) {
    throw new Error('getCollectionStatus requires apiKey and siteId');
  }
  const headers = buildHeaders(apiKey, siteId);
  const existingIds = await fetchExistingIds(headers);

  return COLLECTION_MANIFEST.map((entry) => ({
    id: entry.id,
    exists: existingIds.has(entry.id),
  }));
}

/**
 * Provision CMS collections via the Wix Data Collections REST API.
 * Creates collections that don't exist yet. Skips ones that do.
 * Individual creation errors are captured in the results array.
 *
 * @param {{ apiKey: string, siteId: string, dryRun?: boolean }} opts
 * @returns {Promise<{ results: Array<{ id: string, status: string, detail: string }> }>}
 * @throws {Error} If the initial collection listing API call fails
 */
async function provisionCollections(opts) {
  const { apiKey, siteId, dryRun = false } = opts;
  if (!apiKey || !siteId) {
    throw new Error('provisionCollections requires apiKey and siteId');
  }
  const headers = buildHeaders(apiKey, siteId);
  const existingIds = await fetchExistingIds(headers);

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
        const text = await createRes.text().catch(() => '(response body unreadable)');
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
      // Log full error for debugging; include error type in result
      console.error(`Error creating collection ${entry.id}:`, err);
      results.push({
        id: entry.id,
        status: 'ERROR',
        detail: `${err.constructor.name}: ${err.message}`,
      });
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

  const STATUS_ICONS = { ERROR: '✗', EXISTS: '○', CREATED: '✓', WOULD_CREATE: '✓' };

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
        const icon = STATUS_ICONS[r.status] || '?';
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

module.exports = {
  COLLECTION_MANIFEST,
  ADMIN_ONLY,
  PUBLIC_READ,
  validateManifest,
  provisionCollections,
  getCollectionStatus,
  fetchExistingIds,
  buildHeaders,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
  });
}
