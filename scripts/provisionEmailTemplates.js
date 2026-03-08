/**
 * provisionEmailTemplates.js — Provisions Wix Triggered Email templates.
 *
 * Defines the 12 email templates from MASTER-HOOKUP.md Step 8 with their
 * template IDs, subject lines, merge variables, and priority levels.
 * Can list existing templates, create missing ones via the Wix REST API,
 * or generate a status report.
 *
 * Usage (standalone — requires WIX_API_KEY + WIX_SITE_ID env vars):
 *   node scripts/provisionEmailTemplates.js --status
 *   node scripts/provisionEmailTemplates.js --provision --dry-run
 *   node scripts/provisionEmailTemplates.js --provision
 *   node scripts/provisionEmailTemplates.js --manifest
 *
 * @module provisionEmailTemplates
 */

const TRIGGERED_EMAILS_API = 'https://www.wixapis.com/triggered-emails/v2/templates';

/**
 * Template manifest — all 12 required templates per MASTER-HOOKUP.md Step 8.
 * Ordered by priority (P0 first).
 */
const TEMPLATE_MANIFEST = [
  // P0 — Required for basic operation
  {
    templateId: 'contact_form_submission',
    subject: 'New Contact Form: {subject}',
    variables: ['customerName', 'customerEmail', 'customerPhone', 'subject', 'message', 'submittedAt'],
    priority: 0,
    description: 'Forwards contact form submissions to store owner. Also handles swatch requests.',
  },
  {
    templateId: 'new_order_notification',
    subject: 'New Order #{orderNumber}',
    variables: ['orderNumber', 'customerName', 'total', 'itemCount'],
    priority: 0,
    description: 'Notifies store owner of new orders.',
  },

  // P1 — Welcome series (fires on member signup)
  {
    templateId: 'welcome_series_1',
    subject: 'Welcome to Carolina Futons — here\'s 10% off your first order',
    variables: ['firstName', 'discountCode', 'email'],
    priority: 1,
    description: 'Welcome email with brand story and 10% discount code.',
  },
  {
    templateId: 'welcome_series_2',
    subject: 'How to choose the perfect futon for your space',
    variables: ['firstName', 'email'],
    priority: 1,
    description: 'Buying guide email sent 72 hours after signup.',
  },
  {
    templateId: 'welcome_series_3',
    subject: 'See why customers love Carolina Futons',
    variables: ['firstName', 'email'],
    priority: 1,
    description: 'Social proof email sent 7 days after signup.',
  },

  // P2 — Post-purchase and swatch confirmation
  {
    templateId: 'swatch_confirmation',
    subject: 'Your Free Swatches Are On Their Way!',
    variables: ['customerName', 'productName', 'swatchList', 'estimatedArrival'],
    priority: 2,
    description: 'Confirms free swatch request to customer.',
  },
  {
    templateId: 'post_purchase_1',
    subject: 'How\'s setup going, {firstName}? Need help with assembly?',
    variables: ['firstName', 'orderNumber', 'total', 'productNames', 'assemblyGuideUrl', 'email'],
    priority: 2,
    description: 'Day 3 post-purchase: assembly follow-up with guide link.',
  },
  {
    templateId: 'post_purchase_2',
    subject: 'Enjoying your new furniture, {firstName}? Leave a review!',
    variables: ['firstName', 'orderNumber', 'productNames', 'reviewUrl', 'email'],
    priority: 2,
    description: 'Day 7 post-purchase: review solicitation.',
  },
  {
    templateId: 'post_purchase_3',
    subject: 'Keep your furniture looking great — care tips inside',
    variables: ['firstName', 'orderNumber', 'productNames', 'email'],
    priority: 2,
    description: 'Day 30 post-purchase: care guide and accessory upsell.',
  },

  // P3 — Cart recovery (requires scheduled job)
  {
    templateId: 'cart_recovery_1',
    subject: 'You left something behind at Carolina Futons',
    variables: ['buyerName', 'cartTotal', 'itemSummary', 'checkoutId', 'email'],
    priority: 3,
    description: '1-hour abandoned cart reminder.',
  },
  {
    templateId: 'cart_recovery_2',
    subject: 'Your saved items are popular — don\'t miss out',
    variables: ['buyerName', 'cartTotal', 'itemSummary', 'checkoutId', 'email'],
    priority: 3,
    description: '24-hour cart recovery with social proof.',
  },
  {
    templateId: 'cart_recovery_3',
    subject: 'Last chance: Save on your Carolina Futons cart',
    variables: ['buyerName', 'cartTotal', 'itemSummary', 'discountCode', 'checkoutId', 'email'],
    priority: 3,
    description: '72-hour cart recovery with discount incentive.',
  },
].sort((a, b) => a.priority - b.priority);


/**
 * Validate an array of template definitions.
 * @param {Array<Object>} templates - Template definitions to validate
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateTemplates(templates) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const label = t.templateId || `index ${i}`;

    if (!t.templateId) {
      errors.push(`Template at index ${i}: missing templateId`);
      continue;
    }

    if (seenIds.has(t.templateId)) {
      errors.push(`Duplicate templateId: ${t.templateId}`);
    }
    seenIds.add(t.templateId);

    if (!t.subject) {
      errors.push(`Template ${label}: missing subject`);
    }

    if (!Array.isArray(t.variables) || t.variables.length === 0) {
      errors.push(`Template ${label}: variables must be a non-empty array`);
    }

    if (!/^[a-z][a-z0-9_]*$/.test(t.templateId)) {
      warnings.push(`Template ${label}: templateId should follow snake_case convention`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * List existing triggered email templates and compare with manifest.
 * @param {{ apiKey: string, siteId: string }} opts
 * @returns {Promise<Array<{ templateId: string, exists: boolean, wixId?: string, priority: number }>>}
 */
async function getTemplateStatus(opts) {
  const { apiKey, siteId } = opts;
  const headers = {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };

  const res = await fetch(TRIGGERED_EMAILS_API, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list templates (${res.status}): ${text}`);
  }

  const body = await res.json();
  const existing = body.templates || [];
  const existingByName = new Map(existing.map((t) => [t.name, t.id]));

  return TEMPLATE_MANIFEST.map((entry) => ({
    templateId: entry.templateId,
    exists: existingByName.has(entry.templateId),
    wixId: existingByName.get(entry.templateId) || null,
    priority: entry.priority,
  }));
}

/**
 * Provision triggered email templates via the Wix REST API.
 * Creates templates that don't exist yet. Skips ones that do.
 *
 * @param {{ apiKey: string, siteId: string, dryRun?: boolean }} opts
 * @returns {Promise<{ results: Array<{ templateId: string, status: string, detail: string, priority: number }> }>}
 */
async function provisionTemplates(opts) {
  const { apiKey, siteId, dryRun = false } = opts;
  const headers = {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };

  // List existing templates
  const listRes = await fetch(TRIGGERED_EMAILS_API, { method: 'GET', headers });
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Failed to list templates (${listRes.status}): ${text}`);
  }

  const body = await listRes.json();
  const existing = body.templates || [];
  const existingByName = new Map(existing.map((t) => [t.name, t.id]));

  const results = [];

  for (const entry of TEMPLATE_MANIFEST) {
    if (existingByName.has(entry.templateId)) {
      results.push({
        templateId: entry.templateId,
        status: 'EXISTS',
        detail: `Already exists (id: ${existingByName.get(entry.templateId)})`,
        priority: entry.priority,
      });
      continue;
    }

    if (dryRun) {
      results.push({
        templateId: entry.templateId,
        status: 'WOULD_CREATE',
        detail: 'Would create (dry run)',
        priority: entry.priority,
      });
      continue;
    }

    try {
      const templatePayload = {
        template: {
          name: entry.templateId,
          subject: entry.subject,
          variables: entry.variables.map((v) => ({ name: v })),
          description: entry.description,
        },
      };

      const createRes = await fetch(TRIGGERED_EMAILS_API, {
        method: 'POST',
        headers,
        body: JSON.stringify(templatePayload),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        results.push({
          templateId: entry.templateId,
          status: 'ERROR',
          detail: `Create failed (${createRes.status}): ${text}`,
          priority: entry.priority,
        });
      } else {
        const createBody = await createRes.json();
        const newId = createBody?.template?.id || 'unknown';
        results.push({
          templateId: entry.templateId,
          status: 'CREATED',
          detail: `Created (id: ${newId})`,
          priority: entry.priority,
        });
      }
    } catch (err) {
      results.push({
        templateId: entry.templateId,
        status: 'ERROR',
        detail: err.message,
        priority: entry.priority,
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
      console.log(`Usage: node provisionEmailTemplates.js [options]

Options:
  --status      Check which templates exist in Wix
  --provision   Create missing templates via Wix API
  --dry-run     Show what would be created without making changes
  --manifest    Print template manifest as JSON
  --help        Show this help

Environment variables (required for API calls):
  WIX_API_KEY   Wix REST API key
  WIX_SITE_ID   Wix site ID

Example:
  node provisionEmailTemplates.js --status
  node provisionEmailTemplates.js --provision --dry-run
  node provisionEmailTemplates.js --provision`);
      process.exit(0);
    }
  }

  if (mode === 'manifest') {
    console.log(JSON.stringify(TEMPLATE_MANIFEST, null, 2));
    process.exit(0);
  }

  // Validate manifest
  const validation = validateTemplates(TEMPLATE_MANIFEST);
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
      const status = await getTemplateStatus({ apiKey, siteId });
      console.log('\nEmail Template Status:\n');
      const priorityLabels = { 0: 'P0', 1: 'P1', 2: 'P2', 3: 'P3' };
      for (const s of status) {
        const icon = s.exists ? '✓' : '○';
        const label = priorityLabels[s.priority] || `P${s.priority}`;
        console.log(`  ${icon} [${label}] ${s.templateId}${s.wixId ? ` (${s.wixId})` : ''}`);
      }
      const existing = status.filter((s) => s.exists).length;
      console.log(`\n${existing}/${status.length} templates configured.\n`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  } else if (mode === 'provision') {
    console.log(dryRun ? '\n--- DRY RUN ---\n' : '\n--- PROVISIONING ---\n');
    try {
      const { results } = await provisionTemplates({ apiKey, siteId, dryRun });
      for (const r of results) {
        const icon = r.status === 'ERROR' ? '✗' : r.status === 'EXISTS' ? '○' : '✓';
        console.log(`  ${icon} ${r.templateId}: ${r.detail}`);
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

// Export for programmatic use and tests
module.exports = { TEMPLATE_MANIFEST, validateTemplates, provisionTemplates, getTemplateStatus };

// Run CLI if invoked directly
if (require.main === module) {
  main().catch((err) => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
  });
}
