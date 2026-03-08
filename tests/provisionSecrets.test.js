/**
 * Tests for provisionSecrets.js — Wix Secrets Manager provisioning script.
 *
 * Covers: manifest structure, parseEnvContent, validateSecrets (happy path,
 * missing values, invalid values, unknown keys), provisionSecrets (create,
 * update, dry-run, API errors, missing values skip).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  SECRET_MANIFEST,
  validateSecrets,
  provisionSecrets,
  parseEnvContent,
} = await import('../scripts/provisionSecrets.js');

// ── SECRET_MANIFEST ──────────────────────────────────────────────────

describe('SECRET_MANIFEST', () => {
  it('contains exactly 8 secrets', () => {
    expect(SECRET_MANIFEST).toHaveLength(8);
  });

  it('has all required MASTER-HOOKUP.md Step 5 secret names', () => {
    const names = SECRET_MANIFEST.map((s) => s.name);
    expect(names).toContain('UPS_CLIENT_ID');
    expect(names).toContain('UPS_CLIENT_SECRET');
    expect(names).toContain('UPS_ACCOUNT_NUMBER');
    expect(names).toContain('UPS_SANDBOX');
    expect(names).toContain('SITE_OWNER_CONTACT_ID');
    expect(names).toContain('WIX_BACKEND_KEY');
    expect(names).toContain('WELCOME_DISCOUNT_CODE');
    expect(names).toContain('RECOVERY_DISCOUNT_CODE');
  });

  it('every entry has name, description, required, and validate', () => {
    for (const entry of SECRET_MANIFEST) {
      expect(entry.name).toBeTruthy();
      expect(typeof entry.description).toBe('string');
      expect(entry.required).toBe(true);
      expect(typeof entry.validate).toBe('function');
      expect(typeof entry.validationMsg).toBe('string');
    }
  });

  it('has unique names', () => {
    const names = SECRET_MANIFEST.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ── parseEnvContent ──────────────────────────────────────────────────

describe('parseEnvContent', () => {
  it('parses KEY=VALUE lines', () => {
    const result = parseEnvContent('FOO=bar\nBAZ=qux');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores comments and blank lines', () => {
    const result = parseEnvContent('# comment\n\nFOO=bar\n  # another\n');
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('handles values with equals signs', () => {
    const result = parseEnvContent('KEY=val=ue=extra');
    expect(result).toEqual({ KEY: 'val=ue=extra' });
  });

  it('trims whitespace around keys and values', () => {
    const result = parseEnvContent('  KEY  =  value  ');
    expect(result).toEqual({ KEY: 'value' });
  });

  it('returns empty object for empty input', () => {
    expect(parseEnvContent('')).toEqual({});
  });

  it('skips lines without equals sign', () => {
    const result = parseEnvContent('NOEQUALS\nKEY=val');
    expect(result).toEqual({ KEY: 'val' });
  });
});

// ── validateSecrets ──────────────────────────────────────────────────

describe('validateSecrets', () => {
  const validValues = {
    UPS_CLIENT_ID: 'abcdef1234567890',
    UPS_CLIENT_SECRET: 'secret1234567890',
    UPS_ACCOUNT_NUMBER: 'ABC123',
    UPS_SANDBOX: 'true',
    SITE_OWNER_CONTACT_ID: '12345678-1234-1234-1234-123456789abc',
    WIX_BACKEND_KEY: 'IST.abcdefghij1234567890abcdefghij',
    WELCOME_DISCOUNT_CODE: 'WELCOME10',
    RECOVERY_DISCOUNT_CODE: 'COMEBACK15',
  };

  it('passes with all valid values', () => {
    const result = validateSecrets(validValues);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on missing required secrets', () => {
    const result = validateSecrets({});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(8);
    for (const err of result.errors) {
      expect(err).toMatch(/Missing required secret/);
    }
  });

  it('errors on empty string values', () => {
    const result = validateSecrets({ UPS_CLIENT_ID: '', UPS_CLIENT_SECRET: '  ' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(8);
  });

  it('warns on invalid UPS_SANDBOX value', () => {
    const result = validateSecrets({ ...validValues, UPS_SANDBOX: 'yes' });
    expect(result.valid).toBe(true); // warnings don't block
    expect(result.warnings.some((w) => w.includes('UPS_SANDBOX'))).toBe(true);
  });

  it('warns on invalid SITE_OWNER_CONTACT_ID format', () => {
    const result = validateSecrets({ ...validValues, SITE_OWNER_CONTACT_ID: 'not-a-uuid' });
    expect(result.warnings.some((w) => w.includes('SITE_OWNER_CONTACT_ID'))).toBe(true);
  });

  it('warns on short UPS_CLIENT_ID', () => {
    const result = validateSecrets({ ...validValues, UPS_CLIENT_ID: 'short' });
    expect(result.warnings.some((w) => w.includes('UPS_CLIENT_ID'))).toBe(true);
  });

  it('warns on unknown keys', () => {
    const result = validateSecrets({ ...validValues, UNKNOWN_SECRET: 'value' });
    expect(result.warnings.some((w) => w.includes('Unknown secret key'))).toBe(true);
  });

  it('warns on invalid discount code format', () => {
    const result = validateSecrets({ ...validValues, WELCOME_DISCOUNT_CODE: 'a b' });
    expect(result.warnings.some((w) => w.includes('WELCOME_DISCOUNT_CODE'))).toBe(true);
  });

  it('warns on short WIX_BACKEND_KEY', () => {
    const result = validateSecrets({ ...validValues, WIX_BACKEND_KEY: 'short' });
    expect(result.warnings.some((w) => w.includes('WIX_BACKEND_KEY'))).toBe(true);
  });
});

// ── provisionSecrets ─────────────────────────────────────────────────

describe('provisionSecrets', () => {
  const validValues = {
    UPS_CLIENT_ID: 'abcdef1234567890',
    UPS_CLIENT_SECRET: 'secret1234567890',
    UPS_ACCOUNT_NUMBER: 'ABC123',
    UPS_SANDBOX: 'true',
    SITE_OWNER_CONTACT_ID: '12345678-1234-1234-1234-123456789abc',
    WIX_BACKEND_KEY: 'IST.abcdefghij1234567890abcdefghij',
    WELCOME_DISCOUNT_CODE: 'WELCOME10',
    RECOVERY_DISCOUNT_CODE: 'COMEBACK15',
  };

  const opts = { apiKey: 'test-key', siteId: 'test-site' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates all 8 secrets when none exist', async () => {
    // List returns empty
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secrets: [] }),
    });
    // 8 create calls
    for (let i = 0; i < 8; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ secret: { id: `new-${i}` } }),
      });
    }

    const { results } = await provisionSecrets(validValues, opts);
    expect(results).toHaveLength(8);
    expect(results.every((r) => r.status === 'CREATED')).toBe(true);
    // 1 list + 8 creates = 9 calls
    expect(fetch).toHaveBeenCalledTimes(9);
  });

  it('updates existing secrets', async () => {
    // List returns all 8 as existing
    const existing = SECRET_MANIFEST.map((s, i) => ({ id: `exist-${i}`, name: s.name }));
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secrets: existing }),
    });
    // 8 update calls
    for (let i = 0; i < 8; i++) {
      fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    }

    const { results } = await provisionSecrets(validValues, opts);
    expect(results).toHaveLength(8);
    expect(results.every((r) => r.status === 'UPDATED')).toBe(true);
  });

  it('dry run does not make create/update calls', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secrets: [] }),
    });

    const { results } = await provisionSecrets(validValues, { ...opts, dryRun: true });
    expect(results).toHaveLength(8);
    expect(results.every((r) => r.status === 'WOULD_CREATE')).toBe(true);
    // Only the list call
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('skips secrets with no value provided', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secrets: [] }),
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secret: { id: 'new-1' } }),
    });

    const { results } = await provisionSecrets({ UPS_CLIENT_ID: 'abcdef1234567890' }, opts);
    const created = results.filter((r) => r.status === 'CREATED');
    const skipped = results.filter((r) => r.status === 'SKIPPED');
    expect(created).toHaveLength(1);
    expect(skipped).toHaveLength(7);
  });

  it('reports API errors per-secret without aborting', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secrets: [] }),
    });
    // First create fails
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });
    // Rest succeed
    for (let i = 1; i < 8; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ secret: { id: `new-${i}` } }),
      });
    }

    const { results } = await provisionSecrets(validValues, opts);
    const errors = results.filter((r) => r.status === 'ERROR');
    const created = results.filter((r) => r.status === 'CREATED');
    expect(errors).toHaveLength(1);
    expect(errors[0].detail).toContain('403');
    expect(created).toHaveLength(7);
  });

  it('throws if listing secrets fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(provisionSecrets(validValues, opts)).rejects.toThrow(/Cannot list existing secrets/);
  });

  it('throws on network error during list', async () => {
    fetch.mockRejectedValueOnce(new Error('Network failure'));

    await expect(provisionSecrets(validValues, opts)).rejects.toThrow(/Network failure/);
  });

  it('sends correct headers with API key and site ID', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secrets: [] }),
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secret: { id: 'new-1' } }),
    });

    await provisionSecrets({ UPS_CLIENT_ID: 'abcdef1234567890' }, opts);

    const listCall = fetch.mock.calls[0];
    expect(listCall[1].headers.Authorization).toBe('test-key');
    expect(listCall[1].headers['wix-site-id']).toBe('test-site');
  });

  it('handles fetch throwing during create', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ secrets: [] }),
    });
    fetch.mockRejectedValueOnce(new Error('Connection reset'));
    // Rest succeed
    for (let i = 1; i < 8; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ secret: { id: `new-${i}` } }),
      });
    }

    const { results } = await provisionSecrets(validValues, opts);
    const errors = results.filter((r) => r.status === 'ERROR');
    expect(errors).toHaveLength(1);
    expect(errors[0].detail).toContain('Connection reset');
  });
});
