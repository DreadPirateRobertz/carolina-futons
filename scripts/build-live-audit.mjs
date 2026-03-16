#!/usr/bin/env node
// build-live-audit.mjs — Parse Wix API responses into live-site-audit.json
import { readFileSync, writeFileSync } from 'fs';

const PRODUCTS_FILE = process.argv[2];
const COLLECTIONS_FILE = process.argv[3];
const APPS_FILE = process.argv[4];
const OUTPUT = process.argv[5] || 'content/live-site-audit.json';

// Known Wix app IDs → human-readable names
const KNOWN_APPS = {
  '1380b703-ce81-ff05-f115-39571d94dfcd': 'Wix Stores',
  '14cc59bc-f0b7-15b8-e1c7-89ce41d0e0c9': 'Wix Blog',
  '14dbef06-cc42-5583-32a7-3abd44da4908': 'Wix Bookings',
  '14dbefd2-01b4-fb61-32a7-3abd44da4908': 'Wix Chat',
  '14ce28f7-7eb0-3745-22f8-074b0e2401fb': 'Wix Site Members',
  '14cffd81-5215-0a7f-22f8-074b0e2401fb': 'Wix Forum',
  '14ce1214-b278-a7e4-1373-00cebd1bef7c': 'Wix Pricing Plans',
  '141fbfae-511e-6817-c9f0-48993a7547d1': 'Wix Forms',
  '135c3d92-0fea-1f9d-2ba5-2a1dfb04297e': 'Wix Video',
  '1484cb44-49cd-5b39-9681-75188ab429de': 'Wix Events',
  '150ae7ee-c74a-eecd-d3d7-2112895b988a': 'Wix Music',
  '14271d6f-ba62-d045-549b-ab972ae1f70e': 'Wix SEO Tools',
  '1505b775-e885-eb1b-b665-1e485d9bf90e': 'Wix Instagram Feed',
  '14bca956-e09f-f4d6-14d7-466cb3f09103': 'Wix Pro Gallery',
  '13ee94c1-b635-8505-3391-97919052c16f': 'Wix File Share',
  '14b89688-9b25-5214-d1cb-a3fb9683618b': 'Wix Hotels',
  '139ef4fa-c108-8f9a-c7be-d5f492a2c939': 'Wix Site Search',
  '1537b24e-29d1-6d8f-b8e1-d6860f2f70b9': 'Wix Multilingual',
  '146c0d71-352e-4464-9a03-2e868aabe7b9': 'Wix Contacts',
  '13aa9735-aa50-4bdb-877c-0bb46804bd71': 'Wix Analytics',
  '1480c568-5cbd-9392-5604-1148f5faffa0': 'Wix Table Reservations',
  '140eb9f1-b164-4640-915a-f3afb8d114a2': 'Wix Data',
  '14d7032a-0a65-5270-cca7-30f599708fed': 'Wix Loyalty Program',
  'e593b0bd-b783-45b8-97c2-873d42aacaf4': 'Wix Automations',
  'e3118e0a-b1c1-4e1d-b67d-ddf0cb92309b': 'Wix Inbox',
  '8725b255-2aa2-4a53-b76d-7d3c363aaeea': 'Wix Email Marketing',
  'f4d83b06-b408-4f3b-afd4-de8db311d7d8': 'Wix Payments',
  '399a2612-a042-4fb7-aeff-ed331c7d1c39': 'Wix eCommerce',
  '2bef2abe-7abe-43da-889c-53c1500a328c': 'Wix Shipping',
  'd70b68e2-8d77-4e0c-9c00-c292d6e0025e': 'Wix Owner App',
  'eb377299-86b4-4a86-a1b5-774a2d1d374b': 'Wix Coupons',
  '50d8c12f-715e-41ad-be25-d0f61375dbee': 'Wix Get Subscribers',
  'fc9314bc-a317-4a2b-a9d4-5ad21cc57856': 'Wix Members Area',
  '3ee93544-967e-407e-85c7-69a4aab05217': 'Wix CRM',
  '4aebd0cb-fbdb-4da7-b5d1-d05660a30172': 'Wix Dashboard',
  '307ba931-689c-4b55-bb1d-6a382bad9222': 'Wix Triggers',
  'deadbeef-c8e7-4177-b99a-0084c0924fae': 'Velo by Wix',
  'edd04d8e-3c81-46d7-b176-39b076fe7bbd': 'Wix Notifications',
  '251a12da-ff5c-4f20-a7b0-4fc8a9eb3cf4': 'Wix Ascend',
  'd80111c5-a0f4-47a8-b63a-65b54d774a27': 'Wix Dev Mode',
  '4b10fcce-732d-4be3-9d46-801d271acda9': 'Wix CMS',
  '1503ddb9-1dc0-4ae4-bcc9-cbf47b94a476': 'Wix Social',
  '14e12b04-943e-fd32-456d-70b1820a2ff2': 'Wix Language Menu',
  'a88e3d6b-3bd0-4fd8-a5e4-ba204fd7b214': 'Wix Challenges',
  '969262e4-c158-4692-8193-a5f335524bff': 'Wix Blocks',
  '45c44b27-ca7b-4891-8c0d-1747d588b835': 'Wix Accessibility Wizard',
  'cf06bdf3-5bab-4f20-b165-97fb723dac6a': 'Wix AI Text Creator',
  '35aec784-bbec-4e6e-abcb-d3d724af52cf': 'Wix Favicon',
  '6580b7e9-4031-4a62-a0a5-8e2fa92e8e18': 'Wix Photo Albums',
  '3e9885e0-57be-460d-9d6d-b1de852cf343': 'Wix Pop Ups',
  'cfb50983-8afe-41d6-8c2b-d11b453b339f': 'Wix Anchor',
  '138afa6d-d5b7-4e10-bf87-c8c2e83df82d': 'Wix Site Properties',
  '57d13128-4a4c-494b-80b3-a6fb2e28018d': 'Wix Rich Content',
  '44562f1b-17ec-4907-b242-b76ac06e707a': 'Wix Mini Cart',
  '78640cbb-be47-45f8-b6de-8ed97287872c': 'Wix Product Widget',
  '2fb6d5de-10e5-405c-8726-cf97cfae84cd': 'Wix Promote',
  'e81d3ca5-7ca5-4188-bfac-f4997a34065e': 'Wix Comments',
  '7479d596-137c-4fa3-89cd-d7091042ba61': 'Wix Social Media Icons',
  '70fcd45c-78df-44c0-ab2a-9d2be2350239': 'Wix Workflows',
  'HtmlAnywhere': 'HTML Embed (Custom Code)',
  'd6708a0e-5b2a-458e-8cfe-bdca240aa2ce': 'Wix Branded App',
  'ad836327-80ba-4b72-8c9e-6c273a555d5c': 'Wix Go',
  '215238eb-22a5-4c36-9e7b-e7c08025e04e': 'Wix Point of Sale',
  '94bc563b-675f-41ad-a2a6-5494f211c47b': 'Wix Gift Cards',
  '36c09775-5ced-4ae9-9ba9-0c3119fbd7c1': 'Wix Site Speed',
  'e4b5f1bc-c77a-4319-a60d-a46acb17f6fc': 'Wix Business Manager',
  '2f70e2b4-ff36-472e-bdb9-ce393b13669e': 'Wix Tasks',
  '74bff718-5977-47f2-9e5f-a9fd0047fd1f': 'Wix Product Page',
  '28bbdbd0-ce7f-4674-b133-f03cf4db2349': 'Wix API Keys',
  '9bead16f-1c73-4cda-b6c4-28cff46988db': 'Wix REST API',
  '7516f85b-0868-4c23-9fcb-cea7784243df': 'Wix Code',
  'bd2e09f8-e902-4c27-b535-a4e896cc4ac9': 'Wix Accept Payments',
  '446ac100-e83d-4a06-b1ac-edb4595ca2c1': 'Wix Thank You Page',
  'f123e8f1-4350-4c9b-b269-04adfadda977': 'Wix Cart',
  '8ea9df15-9ff6-4acf-bbb8-8d3a69ae5841': 'Wix Checkout',
  '8d8ba777-9a97-4f63-88da-3d21f7914863': 'Wix Order Page',
  '1973457f-c021-4da5-941f-58444ff761d4': 'Wix Back in Stock',
  'a322993b-2c74-426f-bbb8-444db73d0d1b': 'Wix Related Products',
  'ea2821fc-7d97-40a9-9f75-772f29178430': 'Wix Category Page',
  '55cd9036-36bb-480b-8ddc-afda3cb2eb8d': 'Wix Add to Cart Button',
  '9f7cfe1c-222c-450f-a21d-cc406008890b': 'Wix Sidebar',
  '7bdf8746-da2b-4c2b-a597-e4ef8b8c74b4': 'Wix Lightbox',
  'eec3496e-44a8-45ac-9581-868a67345be8': 'Wix Accordion',
};

function parseApiResponse(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    // Check if it's the wrapper format: [{type, text: "Wix Site API call successful: {...}"}]
    if (Array.isArray(parsed) && parsed[0]?.text) {
      const text = parsed[0].text;
      const jsonStart = text.indexOf('{');
      return JSON.parse(text.substring(jsonStart));
    }
    return parsed;
  } catch (e) {
    console.error(`Error parsing ${filePath}:`, e.message);
    process.exit(1);
  }
}

// ── Parse all data ──────────────────────────────────────────────────

const productsData = parseApiResponse(PRODUCTS_FILE);
const collectionsData = JSON.parse(readFileSync(COLLECTIONS_FILE, 'utf8'));
const appsData = JSON.parse(readFileSync(APPS_FILE, 'utf8'));

// ── Process products ────────────────────────────────────────────────

const products = productsData.products.map(p => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  visible: p.visible,
  productType: p.productType,
  sku: p.sku || '',
  price: p.price?.formatted?.price || `$${p.price?.price || 0}`,
  numericPrice: Number(p.price?.price) || 0,
  discountedPrice: p.price?.formatted?.discountedPrice || null,
  ribbon: p.ribbon || '',
  inStock: p.stock?.inStock || false,
  inventoryStatus: p.stock?.inventoryStatus || 'UNKNOWN',
  collectionIds: p.collectionIds || [],
  numImages: p.media?.items?.length || 0,
  mainImage: p.media?.mainMedia?.image?.url || null,
  options: (p.productOptions || []).map(o => ({
    name: o.name,
    choices: (o.choices || []).map(c => c.description || c.value),
  })),
  numVariants: (p.variants || []).length,
  additionalInfoSections: (p.additionalInfoSections || []).map(s => s.title),
}));

// ── Process collections ──────────────────────────────────────────────

const collections = collectionsData.collections.map(c => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  visible: c.visible,
}));

// Map products to collections
const collectionMap = {};
for (const col of collections) {
  collectionMap[col.id] = {
    ...col,
    products: products.filter(p => p.collectionIds.includes(col.id)).map(p => p.name),
    productCount: products.filter(p => p.collectionIds.includes(col.id)).length,
  };
}

// ── Process apps ─────────────────────────────────────────────────────

const seenApps = new Set();
const apps = appsData.appInstances
  .filter(a => {
    if (seenApps.has(a.appDefId)) return false;
    seenApps.add(a.appDefId);
    return true;
  })
  .map(a => ({
    appDefId: a.appDefId,
    name: KNOWN_APPS[a.appDefId] || `Unknown (${a.appDefId})`,
    enabled: a.enabled,
    version: a.version || null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ── Build audit ─────────────────────────────────────────────────────

const audit = {
  meta: {
    generatedAt: new Date().toISOString(),
    siteId: '16b31c24-caf2-4249-b752-1b3be4bda9b9',
    siteName: 'Carolina Futons',
    source: 'Wix REST API (read-only)',
    totalProducts: products.length,
    totalCollections: collections.length,
    totalInstalledApps: apps.length,
  },
  products: products.sort((a, b) => a.name.localeCompare(b.name)),
  collections: Object.values(collectionMap).sort((a, b) => a.name.localeCompare(b.name)),
  installedApps: apps,
  summary: {
    visibleProducts: products.filter(p => p.visible).length,
    hiddenProducts: products.filter(p => !p.visible).length,
    inStockProducts: products.filter(p => p.inStock).length,
    outOfStockProducts: products.filter(p => !p.inStock).length,
    productsWithNoImages: products.filter(p => p.numImages === 0).map(p => p.name),
    productsWithOneImage: products.filter(p => p.numImages === 1).map(p => p.name),
    callForPriceProducts: products.filter(p => p.numericPrice <= 1).map(p => ({ name: p.name, price: p.numericPrice })),
    discountedProducts: products.filter(p => p.discountedPrice && p.discountedPrice !== p.price).map(p => ({ name: p.name, price: p.price, discounted: p.discountedPrice })),
    emptyCollections: Object.values(collectionMap).filter(c => c.productCount === 0).map(c => c.name),
    collectionsWithProducts: Object.values(collectionMap).filter(c => c.productCount > 0).map(c => ({ name: c.name, count: c.productCount })),
    knownApps: apps.filter(a => !a.name.startsWith('Unknown')).map(a => a.name),
    unknownApps: apps.filter(a => a.name.startsWith('Unknown')).length,
  },
};

writeFileSync(OUTPUT, JSON.stringify(audit, null, 2));
console.log(`✓ Audit written to ${OUTPUT}`);
console.log(`  Products: ${audit.meta.totalProducts}`);
console.log(`  Collections: ${audit.meta.totalCollections}`);
console.log(`  Installed Apps: ${audit.meta.totalInstalledApps} (${audit.summary.knownApps.length} identified)`);
console.log(`  Visible: ${audit.summary.visibleProducts}, Hidden: ${audit.summary.hiddenProducts}`);
console.log(`  In stock: ${audit.summary.inStockProducts}, Out of stock: ${audit.summary.outOfStockProducts}`);
console.log(`  No images: ${audit.summary.productsWithNoImages.length}`);
console.log(`  1 image: ${audit.summary.productsWithOneImage.length}`);
console.log(`  Call-for-price: ${audit.summary.callForPriceProducts.length}`);
console.log(`  Discounted: ${audit.summary.discountedProducts.length}`);
console.log(`  Empty collections: ${audit.summary.emptyCollections.length}`);
