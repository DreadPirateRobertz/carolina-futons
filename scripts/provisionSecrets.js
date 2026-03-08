/**
 * provisionSecrets.js — Provisions all required Wix Secrets Manager entries.
 *
 * Defines the 8 secrets from MASTER-HOOKUP.md Step 5 with descriptions and
 * validation. Designed to be run via the wix-velo-mcp `velo_secrets_set` tool
 * or directly against the Wix Secrets REST API.
 *
 * Usage (via wix-velo-mcp):
 *   For each secret, call `velo_secrets_set` with { name, value, description }.
 *
 * Usage (standalone — requires WIX_API_KEY + WIX_SITE_ID env vars):
 *   node scripts/provisionSecrets.js --values secrets.env
 *
 * The secrets.env file format (one per line):
 *   UPS_CLIENT_ID=your_client_id
 *   UPS_CLIENT_SECRET=your_client_secret
 *   UPS_ACCOUNT_NUMBER=your_account_number
 *   UPS_SANDBOX=true
 *   SITE_OWNER_CONTACT_ID=brenda_contact_uuid
 *   WIX_BACKEND_KEY=your_backend_key
 *   WELCOME_DISCOUNT_CODE=WELCOME10
 *   RECOVERY_DISCOUNT_CODE=COMEBACK15
 *
 * @module provisionSecrets
 */

const SECRETS_API_BASE = 'https://www.wixapis.com/secrets/v1/secrets';

/**
 * Secret manifest — all 8 required secrets per MASTER-HOOKUP.md Step 5.
 * Each entry includes the secret name, description for the Secrets Manager,
 * and a validation function.
 */
const SECRET_MANIFEST = [
  {
    name: 'UPS_CLIENT_ID',
    description: 'UPS API OAuth client ID from developer.ups.com',
    required: true,
    validate: (v) => v.length >= 10,
    validationMsg: 'UPS_CLIENT_ID should be at least 10 characters',
  },
  {
    name: 'UPS_CLIENT_SECRET',
    description: 'UPS API OAuth client secret from developer.ups.com',
    required: true,
    validate: (v) => v.length >= 10,
    validationMsg: 'UPS_CLIENT_SECRET should be at least 10 characters',
  },
  {
    name: 'UPS_ACCOUNT_NUMBER',
    description: 'UPS shipper account number for rate lookups',
    required: true,
    validate: (v) => /^[A-Z0-9]{6,}$/i.test(v),
    validationMsg: 'UPS_ACCOUNT_NUMBER should be alphanumeric, 6+ chars',
  },
  {
    name: 'UPS_SANDBOX',
    description: 'Set to "true" for UPS sandbox testing, "false" for production',
    required: true,
    validate: (v) => v === 'true' || v === 'false',
    validationMsg: 'UPS_SANDBOX must be exactly "true" or "false"',
  },
  {
    name: 'SITE_OWNER_CONTACT_ID',
    description: 'Brenda\'s Wix contact UUID — used for owner notifications (emailService, notificationService)',
    required: true,
    validate: (v) => /^[0-9a-f-]{36}$/i.test(v),
    validationMsg: 'SITE_OWNER_CONTACT_ID should be a UUID (36 chars with dashes)',
  },
  {
    name: 'WIX_BACKEND_KEY',
    description: 'Backend API authentication key from Wix Dashboard > Settings > API Keys',
    required: true,
    validate: (v) => v.length >= 20,
    validationMsg: 'WIX_BACKEND_KEY should be at least 20 characters',
  },
  {
    name: 'WELCOME_DISCOUNT_CODE',
    description: 'Welcome email 10% discount code (e.g., WELCOME10) — used by emailAutomation.web.js',
    required: true,
    validate: (v) => /^[A-Z0-9_-]+$/i.test(v) && v.length >= 3,
    validationMsg: 'WELCOME_DISCOUNT_CODE should be alphanumeric, 3+ chars',
  },
  {
    name: 'RECOVERY_DISCOUNT_CODE',
    description: 'Cart recovery incentive code (e.g., COMEBACK15) — used by emailAutomation.web.js',
    required: true,
    validate: (v) => /^[A-Z0-9_-]+$/i.test(v) && v.length >= 3,
    validationMsg: 'RECOVERY_DISCOUNT_CODE should be alphanumeric, 3+ chars',
  },
];

/**
 * Parse a .env-style file into key-value pairs.
 * @param {string} content - File content with KEY=VALUE lines
 * @returns {Record<string, string>}
 */
function parseEnvContent(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    result[key] = val;
  }
  return result;
}

/**
 * Validate all secret values against the manifest.
 * @param {Record<string, string>} values - Secret name→value map
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateSecrets(values) {
  const errors = [];
  const warnings = [];

  for (const entry of SECRET_MANIFEST) {
    const val = values[entry.name];
    if (!val || !val.trim()) {
      if (entry.required) {
        errors.push(`Missing required secret: ${entry.name}`);
      }
      continue;
    }
    if (entry.validate && !entry.validate(val)) {
      warnings.push(`${entry.name}: ${entry.validationMsg}`);
    }
  }

  // Check for unknown keys
  const knownNames = new Set(SECRET_MANIFEST.map((e) => e.name));
  for (const key of Object.keys(values)) {
    if (!knownNames.has(key)) {
      warnings.push(`Unknown secret key: ${key} (not in manifest)`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Provision secrets via the Wix Secrets REST API.
 * @param {Record<string, string>} values - Secret name→value map
 * @param {{ apiKey: string, siteId: string, dryRun?: boolean }} opts
 * @returns {Promise<{ results: Array<{ name: string, status: string, detail: string }> }>}
 */
async function provisionSecrets(values, opts) {
  const { apiKey, siteId, dryRun = false } = opts;
  const headers = {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };

  // List existing secrets
  let existingSecrets = [];
  try {
    const listRes = await fetch(SECRETS_API_BASE, { method: 'GET', headers });
    if (!listRes.ok) {
      const text = await listRes.text();
      throw new Error(`List secrets failed (${listRes.status}): ${text}`);
    }
    const body = await listRes.json();
    existingSecrets = body.secrets || [];
  } catch (err) {
    throw new Error(`Cannot list existing secrets: ${err.message}`);
  }

  const existingByName = new Map(existingSecrets.map((s) => [s.name, s.id]));
  const results = [];

  for (const entry of SECRET_MANIFEST) {
    const val = values[entry.name];
    if (!val || !val.trim()) {
      results.push({ name: entry.name, status: 'SKIPPED', detail: 'No value provided' });
      continue;
    }

    const secret = { name: entry.name, value: val };
    if (entry.description) {
      secret.description = entry.description;
    }

    if (dryRun) {
      const action = existingByName.has(entry.name) ? 'WOULD_UPDATE' : 'WOULD_CREATE';
      results.push({ name: entry.name, status: action, detail: `${action} (dry run)` });
      continue;
    }

    try {
      if (existingByName.has(entry.name)) {
        const id = existingByName.get(entry.name);
        const res = await fetch(`${SECRETS_API_BASE}/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ secret }),
        });
        if (!res.ok) {
          const text = await res.text();
          results.push({ name: entry.name, status: 'ERROR', detail: `Update failed (${res.status}): ${text}` });
        } else {
          results.push({ name: entry.name, status: 'UPDATED', detail: `Updated (id: ${id})` });
        }
      } else {
        const res = await fetch(SECRETS_API_BASE, {
          method: 'POST',
          headers,
          body: JSON.stringify({ secret }),
        });
        if (!res.ok) {
          const text = await res.text();
          results.push({ name: entry.name, status: 'ERROR', detail: `Create failed (${res.status}): ${text}` });
        } else {
          const body = await res.json();
          const newId = body?.secret?.id || 'unknown';
          results.push({ name: entry.name, status: 'CREATED', detail: `Created (id: ${newId})` });
        }
      }
    } catch (err) {
      results.push({ name: entry.name, status: 'ERROR', detail: err.message });
    }
  }

  return { results };
}

/**
 * CLI entry point — reads values from a .env file and provisions secrets.
 */
async function main() {
  const args = process.argv.slice(2);
  const fs = await import('node:fs');

  // Parse CLI flags
  let valuesFile = null;
  let dryRun = false;
  let validateOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--values' && args[i + 1]) {
      valuesFile = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--validate') {
      validateOnly = true;
    } else if (args[i] === '--manifest') {
      // Print manifest for tooling consumption
      console.log(JSON.stringify(SECRET_MANIFEST.map(({ name, description, required }) => ({
        name, description, required,
      })), null, 2));
      process.exit(0);
    } else if (args[i] === '--help') {
      console.log(`Usage: node provisionSecrets.js [options]

Options:
  --values <file>   Path to .env file with secret values
  --dry-run         List what would be created/updated without making changes
  --validate        Validate values without calling the API
  --manifest        Print the secret manifest as JSON
  --help            Show this help

Environment variables (required for API calls):
  WIX_API_KEY       Wix REST API key
  WIX_SITE_ID       Wix site ID

Example:
  node provisionSecrets.js --values secrets.env --dry-run
  node provisionSecrets.js --values secrets.env`);
      process.exit(0);
    }
  }

  if (!valuesFile) {
    console.error('Error: --values <file> is required. Run with --help for usage.');
    process.exit(1);
  }

  // Read values
  let content;
  try {
    content = fs.readFileSync(valuesFile, 'utf-8');
  } catch (err) {
    console.error(`Error reading ${valuesFile}: ${err.message}`);
    process.exit(1);
  }

  const values = parseEnvContent(content);
  console.log(`Loaded ${Object.keys(values).length} values from ${valuesFile}\n`);

  // Validate
  const validation = validateSecrets(values);
  if (validation.errors.length > 0) {
    console.error('Validation errors:');
    for (const e of validation.errors) console.error(`  ✗ ${e}`);
  }
  if (validation.warnings.length > 0) {
    console.warn('Validation warnings:');
    for (const w of validation.warnings) console.warn(`  ⚠ ${w}`);
  }
  if (!validation.valid) {
    console.error('\nFix errors above before provisioning.');
    process.exit(1);
  }
  if (validateOnly) {
    console.log('\nValidation passed. Use --dry-run or remove --validate to provision.');
    process.exit(0);
  }

  // Check API credentials
  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey || !siteId) {
    console.error('Error: WIX_API_KEY and WIX_SITE_ID environment variables are required.');
    console.error('Set them before running, or use --validate for offline validation.');
    process.exit(1);
  }

  // Provision
  console.log(dryRun ? '\n--- DRY RUN ---\n' : '\n--- PROVISIONING ---\n');
  try {
    const { results } = await provisionSecrets(values, { apiKey, siteId, dryRun });
    for (const r of results) {
      const icon = r.status === 'ERROR' ? '✗' : r.status === 'SKIPPED' ? '○' : '✓';
      console.log(`  ${icon} ${r.name}: ${r.detail}`);
    }

    const errors = results.filter((r) => r.status === 'ERROR');
    if (errors.length > 0) {
      console.error(`\n${errors.length} error(s) — see above.`);
      process.exit(1);
    }
    console.log('\nDone.');
  } catch (err) {
    console.error(`\nFatal: ${err.message}`);
    process.exit(1);
  }
}

// Export for programmatic use (e.g., by wix-velo-mcp or tests)
module.exports = { SECRET_MANIFEST, validateSecrets, provisionSecrets, parseEnvContent };

// Run CLI if invoked directly
if (require.main === module) {
  main().catch((err) => {
    console.error(`Unhandled error: ${err.message}`);
    process.exit(1);
  });
}
