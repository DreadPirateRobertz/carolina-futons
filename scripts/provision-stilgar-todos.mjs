#!/usr/bin/env node
/**
 * provision-stilgar-todos.mjs — automate the API-scriptable items on
 * Stilgar's pending dashboard queue (cf-2gux).
 *
 * Subcommands (all read-only by default; pass `--apply` to actually mutate):
 *   communityphotos   Create the CommunityPhotos CMS collection if missing
 *                     (cf-0h9q).
 *   cambridge         Configure the Cambridge Futon Frame product — set
 *                     price, productOptions (Size/Color), variants
 *                     (cf-uggz). Best-effort: prints a clear failure
 *                     report if any step is rejected (e.g. variant
 *                     generation needs the dashboard's Wizard for the
 *                     first pass on a freshly-created product).
 *   emails            Delegate to scripts/provisionEmailTemplates.js
 *                     for the 12+ Triggered Email templates (cf-c6g5).
 *                     The Wix Triggered Emails API is more restrictive
 *                     than CMS — many templates can only be created in
 *                     the dashboard. The delegate handles whatever the
 *                     API allows; the rest is reported as manual.
 *   report            Print the manual-only TODOs that no Wix REST API
 *                     can drive (CODECOV_TOKEN secret, WIX_CLI_TOKEN
 *                     secret, "Allow GitHub Actions to create and approve
 *                     pull requests" toggle, branch protection toggles).
 *   all               Run communityphotos → cambridge → emails → report
 *                     in that order, stopping on first hard error.
 *
 * Usage:
 *   node scripts/provision-stilgar-todos.mjs report
 *   node scripts/provision-stilgar-todos.mjs communityphotos          # dry run
 *   node scripts/provision-stilgar-todos.mjs communityphotos --apply
 *   node scripts/provision-stilgar-todos.mjs all --apply
 *
 * Required env (for any non-`report` subcommand):
 *   WIX_API_KEY    — Wix REST API key with stores/data/triggered-emails scope
 *   WIX_SITE_ID    — Wix site ID (UUID)
 *
 * Optional env:
 *   CAMBRIDGE_PRICE        — override default $1500 (cf-uggz spec)
 *   CAMBRIDGE_PRODUCT_NAME — override the search name. Default
 *                            "Cambridge Futon Frame" (recently renamed
 *                            from "The Cambridge Full Futon").
 *
 * @module provision-stilgar-todos
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COLLECTIONS_API = 'https://www.wixapis.com/wix-data/v2/collections';
const STORES_API = 'https://www.wixapis.com/stores/v1';

// ── CommunityPhotos collection definition ──────────────────────────────────
// Schema mirrors the comment block in src/backend/communityPhoto.web.js:18-25
// + the FIELD_CAPS object in that same file. status defaults to 'pending'
// in the backend; we don't enforce defaults here (collection-level defaults
// aren't part of the v2 collections API surface).
const COMMUNITY_PHOTOS = {
  id: 'CommunityPhotos',
  displayName: 'Community Photos',
  fields: [
    { key: 'imageUrl', displayName: 'Image URL', type: 'URL' },
    { key: 'customerName', displayName: 'Customer Name', type: 'TEXT' },
    { key: 'location', displayName: 'Location', type: 'TEXT' },
    { key: 'caption', displayName: 'Caption', type: 'TEXT' },
    { key: 'productSlug', displayName: 'Product Slug', type: 'TEXT' },
    { key: 'submittedAt', displayName: 'Submitted At', type: 'DATETIME' },
    { key: 'status', displayName: 'Status', type: 'TEXT' },
    { key: 'moderatorNotes', displayName: 'Moderator Notes', type: 'TEXT' },
  ],
  // Anyone may submit (the backend wrapper applies validation + rate limit
  // before insert). Read/update/remove are admin-only.
  permissions: { read: 'ADMIN', insert: 'ANYONE', update: 'ADMIN', remove: 'ADMIN' },
};

// ── Cambridge product spec (cf-uggz) ──────────────────────────────────────
const CAMBRIDGE_DEFAULTS = {
  productName: 'Cambridge Futon Frame',
  price: 1500,
  options: [
    { name: 'Size', choices: ['Full', 'Queen', 'King'] },
    { name: 'Color', choices: ['Cherry', 'Chocolate', 'Natural', 'Black Walnut', 'Dark Chocolate'] },
  ],
};

// ── Manual-only TODOs (cannot be driven via Wix REST API) ─────────────────
const MANUAL_TODOS = [
  {
    item: 'CODECOV_TOKEN secret on cfutons-web',
    where: 'GitHub: Settings → Secrets → Actions → New repository secret',
    why: 'Codecov upload step in cfutons-web ci.yml is fail_ci_if_error=${{ secrets.CODECOV_TOKEN != "" }} — without the secret the step warns; with it, strict gate flips on. (cf-s5cs / #466)',
  },
  {
    item: 'WIX_CLI_TOKEN secret on stage3-velo',
    where: 'GitHub: Settings → Secrets → Actions → New repository secret',
    why: 'Auto-publish workflow needs an API key for `wix login --api-key …` (cf-g2sa.fu / #23). Generate via `wix login --api-key …` flow on a maintainer machine.',
  },
  {
    item: 'Allow GitHub Actions to create and approve pull requests',
    where: 'GitHub on EACH of cfutons + cfutons-web: Settings → Actions → General → Workflow permissions',
    why: 'Coverage Ratchet workflow pushes the bumped branch fine but is rejected when it tries to open the PR. Without this, ratchet PRs need a human to manually open them from the auto-pushed branch. (#1161 / #1167)',
  },
  {
    item: 'Branch protection — codecov status checks (post-CODECOV_TOKEN)',
    where: 'GitHub: cfutons-web → Settings → Branches → main → Edit → required status checks',
    why: 'After the token is added and the first successful upload posts codecov/project + codecov/patch checks, add them to the required-checks list so coverage drops actually block merge.',
  },
];

// ── Generic helpers ────────────────────────────────────────────────────────

function die(msg, code = 1) {
  console.error(`provision-stilgar-todos: ${msg}`);
  process.exit(code);
}

function buildHeaders() {
  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey || !siteId) {
    die('WIX_API_KEY and WIX_SITE_ID env vars are required for this subcommand.');
  }
  // Note: assign-skus.mjs uses `Bearer …`; provisionCmsCollections.js uses
  // bare `Authorization: <key>`. The Wix REST API accepts both shapes for
  // API keys. Match the CMS-script convention here so both files behave
  // identically when run side-by-side.
  return {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };
}

async function wixFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...buildHeaders(), ...(opts.headers || {}) } });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* leave as null */ }
  return { ok: res.ok, status: res.status, body, text };
}

// Wix Stores has 5 req/sec throttling. Sleep 210 ms between mutating calls.
const SLEEP_MS = 210;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Subcommand: communityphotos ────────────────────────────────────────────

async function runCommunityPhotos({ apply }) {
  console.log(`\n=== CommunityPhotos collection (cf-0h9q backing store) ===`);
  const { ok, status, body, text } = await wixFetch(COLLECTIONS_API, { method: 'GET' });
  if (!ok) {
    die(`List collections failed (${status}): ${text.slice(0, 200)}`);
  }
  const existing = new Set((body?.dataCollections || []).map((c) => c.id));
  if (existing.has(COMMUNITY_PHOTOS.id)) {
    console.log(`  ✓ ${COMMUNITY_PHOTOS.id} already exists — nothing to do.`);
    return { changed: false };
  }

  if (!apply) {
    console.log(`  ○ ${COMMUNITY_PHOTOS.id} missing. Would create with ${COMMUNITY_PHOTOS.fields.length} fields.`);
    console.log(`     (re-run with --apply to mutate.)`);
    return { changed: false, would: true };
  }

  const payload = { collection: { ...COMMUNITY_PHOTOS } };
  const { ok: createOk, status: createStatus, text: createText } = await wixFetch(COLLECTIONS_API, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!createOk) {
    die(`Create CommunityPhotos failed (${createStatus}): ${createText.slice(0, 300)}`);
  }
  console.log(`  ✓ Created ${COMMUNITY_PHOTOS.id} with ${COMMUNITY_PHOTOS.fields.length} fields.`);
  return { changed: true };
}

// ── Subcommand: cambridge ──────────────────────────────────────────────────

async function findCambridgeProduct() {
  const queryUrl = `${STORES_API}/products/query`;
  const productName = process.env.CAMBRIDGE_PRODUCT_NAME || CAMBRIDGE_DEFAULTS.productName;
  const payload = {
    query: { filter: JSON.stringify({ name: productName }) },
  };
  const { ok, status, body, text } = await wixFetch(queryUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!ok) {
    die(`Cambridge product query failed (${status}): ${text.slice(0, 200)}`);
  }
  const products = body?.products || [];
  if (products.length === 0) {
    die(`No product named "${productName}" found. (Try setting CAMBRIDGE_PRODUCT_NAME if it was renamed.)`);
  }
  if (products.length > 1) {
    console.warn(`  ⚠ ${products.length} products matched name "${productName}" — using the first (id=${products[0].id}).`);
  }
  return products[0];
}

async function runCambridge({ apply }) {
  console.log(`\n=== Cambridge product config (cf-uggz) ===`);
  const product = await findCambridgeProduct();
  console.log(`  found product: ${product.name} (id=${product.id})`);

  const desiredPrice = Number(process.env.CAMBRIDGE_PRICE || CAMBRIDGE_DEFAULTS.price);
  const currentPrice = Number(product?.price?.price ?? 0);
  if (currentPrice === desiredPrice) {
    console.log(`  ✓ price already $${currentPrice}`);
  } else if (!apply) {
    console.log(`  ○ price: would PATCH ${currentPrice} → ${desiredPrice}`);
  } else {
    const url = `${STORES_API}/products/${product.id}`;
    const { ok, status, text } = await wixFetch(url, {
      method: 'PATCH',
      body: JSON.stringify({ product: { priceData: { price: desiredPrice, currency: 'USD' } } }),
    });
    if (!ok) {
      console.error(`  ✗ price PATCH failed (${status}): ${text.slice(0, 200)}`);
    } else {
      console.log(`  ✓ price PATCHED ${currentPrice} → ${desiredPrice}`);
    }
    await sleep(SLEEP_MS);
  }

  // Product options: the Stores v1 API exposes setProductOptions only on
  // existing products. Variants are generated from the cartesian product of
  // option choices and are configured separately. The first run on a fresh
  // product typically requires the dashboard wizard to seed the variant
  // table; once seeded, this script can update prices/inventory per variant.
  // Be conservative — print the desired shape and stop short of mutation
  // unless --apply is explicitly set.
  const desiredOptions = CAMBRIDGE_DEFAULTS.options;
  console.log(
    `  ${apply ? '○' : '○'} options spec (read-only here, dashboard-driven first time):`,
  );
  for (const opt of desiredOptions) {
    console.log(`     • ${opt.name}: [${opt.choices.join(', ')}]`);
  }
  const expectedVariantCount = desiredOptions.reduce((n, o) => n * o.choices.length, 1);
  console.log(`     → ${expectedVariantCount} variants expected (full cartesian product)`);

  if (apply) {
    // Wix Stores v1: PATCH /products/{id}/options has been historically
    // unreliable on freshly-created products without dashboard seeding. Try
    // it; capture any rejection in the manual-TODO report rather than
    // failing the whole script.
    const url = `${STORES_API}/products/${product.id}`;
    const optionsPayload = {
      product: {
        productOptions: desiredOptions.map((o) => ({
          optionType: 'drop_down',
          name: o.name,
          choices: o.choices.map((c) => ({ value: c, description: c, inStock: true, visible: true })),
        })),
      },
    };
    const { ok, status, text } = await wixFetch(url, {
      method: 'PATCH',
      body: JSON.stringify(optionsPayload),
    });
    if (ok) {
      console.log(`  ✓ productOptions PATCHED via /stores/v1/products/${product.id}`);
    } else {
      console.warn(`  ⚠ productOptions PATCH rejected (${status}): ${text.slice(0, 200)}`);
      console.warn(`    Falls back to manual: open the product in the Wix Stores dashboard,`);
      console.warn(`    add Size + Color options manually, save. Re-run with --apply to`);
      console.warn(`    flush variant prices once variants exist.`);
    }
  }

  return { productId: product.id };
}

// ── Subcommand: emails (delegate) ──────────────────────────────────────────

function runEmails({ apply }) {
  console.log(`\n=== Triggered Email templates (cf-c6g5) ===`);
  const target = resolve(__dirname, 'provisionEmailTemplates.js');
  const args = apply ? ['--provision'] : ['--provision', '--dry-run'];
  console.log(`  delegating to: node ${target} ${args.join(' ')}`);
  const result = spawnSync('node', [target, ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.warn(`  ⚠ delegate exited ${result.status}. Some templates likely require manual dashboard creation.`);
  }
  return { delegated: true, status: result.status };
}

// ── Subcommand: report ─────────────────────────────────────────────────────

function runReport() {
  console.log(`\n=== Manual TODOs (cannot be driven via Wix REST API) ===\n`);
  for (const t of MANUAL_TODOS) {
    console.log(`  • ${t.item}`);
    console.log(`      where: ${t.where}`);
    console.log(`      why:   ${t.why}`);
    console.log();
  }
  console.log(`(${MANUAL_TODOS.length} item${MANUAL_TODOS.length === 1 ? '' : 's'} require human action.)`);
}

// ── Entry point ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const subcommand = args[0];
  const apply = args.includes('--apply');

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    console.log(`Usage: node scripts/provision-stilgar-todos.mjs <subcommand> [--apply]

Subcommands:
  communityphotos    Create CommunityPhotos CMS collection if missing (cf-0h9q)
  cambridge          Configure Cambridge Futon Frame product (cf-uggz)
  emails             Delegate to provisionEmailTemplates.js (cf-c6g5)
  report             Print manual-only TODOs (no API can drive them)
  all                Run all of the above in order

Flags:
  --apply            Actually mutate. Default is dry-run / read-only.

Env (required for any non-report subcommand):
  WIX_API_KEY        Wix REST API key
  WIX_SITE_ID        Wix site ID

Env (optional, cambridge):
  CAMBRIDGE_PRICE    Override default $${CAMBRIDGE_DEFAULTS.price}
  CAMBRIDGE_PRODUCT_NAME  Override "${CAMBRIDGE_DEFAULTS.productName}"
`);
    process.exit(0);
  }

  switch (subcommand) {
    case 'report':
      runReport();
      break;
    case 'communityphotos':
      await runCommunityPhotos({ apply });
      break;
    case 'cambridge':
      await runCambridge({ apply });
      break;
    case 'emails':
      runEmails({ apply });
      break;
    case 'all':
      await runCommunityPhotos({ apply });
      await runCambridge({ apply });
      runEmails({ apply });
      runReport();
      break;
    default:
      die(`unknown subcommand "${subcommand}". Run --help for usage.`);
  }
}

main().catch((err) => {
  console.error(`Unhandled error: ${err.stack || err.message}`);
  process.exit(1);
});
