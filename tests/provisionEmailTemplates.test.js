/**
 * Tests for provisionEmailTemplates.js — Wix Triggered Email template provisioning.
 *
 * Covers: manifest structure, validateTemplates, provisionTemplates (create,
 * update, dry-run, API errors, skip existing), cross-reference with
 * emailTemplates.web.js TEMPLATE_REGISTRY.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  TEMPLATE_MANIFEST,
  validateTemplates,
  provisionTemplates,
  getTemplateStatus,
} = await import('../scripts/provisionEmailTemplates.js');

import { _TEMPLATE_REGISTRY } from '../src/backend/emailTemplates.web.js';

// ── TEMPLATE_MANIFEST ────────────────────────────────────────────────

describe('TEMPLATE_MANIFEST', () => {
  it('contains all 16 templates (12 Step 8 + 4 additional backend templates)', () => {
    expect(TEMPLATE_MANIFEST).toHaveLength(16);
  });

  it('has all P0 templates (contact_form_submission, new_order_notification)', () => {
    const ids = TEMPLATE_MANIFEST.map((t) => t.templateId);
    expect(ids).toContain('contact_form_submission');
    expect(ids).toContain('new_order_notification');
  });

  it('has all P1 welcome series templates', () => {
    const ids = TEMPLATE_MANIFEST.map((t) => t.templateId);
    expect(ids).toContain('welcome_series_1');
    expect(ids).toContain('welcome_series_2');
    expect(ids).toContain('welcome_series_3');
  });

  it('has all P2 post-purchase templates', () => {
    const ids = TEMPLATE_MANIFEST.map((t) => t.templateId);
    expect(ids).toContain('post_purchase_1');
    expect(ids).toContain('post_purchase_2');
    expect(ids).toContain('post_purchase_3');
  });

  it('has all P3 cart recovery templates', () => {
    const ids = TEMPLATE_MANIFEST.map((t) => t.templateId);
    expect(ids).toContain('cart_recovery_1');
    expect(ids).toContain('cart_recovery_2');
    expect(ids).toContain('cart_recovery_3');
  });

  it('has swatch_confirmation template', () => {
    const ids = TEMPLATE_MANIFEST.map((t) => t.templateId);
    expect(ids).toContain('swatch_confirmation');
  });

  it('has gift card email templates', () => {
    const ids = TEMPLATE_MANIFEST.map((t) => t.templateId);
    expect(ids).toContain('gift_card_purchase_confirmation');
    expect(ids).toContain('gift_card_received');
  });

  it('has notification alert templates', () => {
    const ids = TEMPLATE_MANIFEST.map((t) => t.templateId);
    expect(ids).toContain('price_drop_alert');
    expect(ids).toContain('back_in_stock_alert');
  });

  it('has unique template IDs', () => {
    const ids = TEMPLATE_MANIFEST.map((t) => t.templateId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has required fields', () => {
    for (const entry of TEMPLATE_MANIFEST) {
      expect(entry.templateId).toBeTruthy();
      expect(typeof entry.templateId).toBe('string');
      expect(typeof entry.subject).toBe('string');
      expect(entry.subject.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.variables)).toBe(true);
      expect(entry.variables.length).toBeGreaterThan(0);
      expect(typeof entry.priority).toBe('number');
      expect(entry.priority).toBeGreaterThanOrEqual(0);
      expect(entry.priority).toBeLessThanOrEqual(4);
      expect(typeof entry.description).toBe('string');
    }
  });

  it('template variables match EMAIL-TEMPLATES.md specs', () => {
    const contactForm = TEMPLATE_MANIFEST.find((t) => t.templateId === 'contact_form_submission');
    expect(contactForm.variables).toContain('customerName');
    expect(contactForm.variables).toContain('customerEmail');
    expect(contactForm.variables).toContain('subject');
    expect(contactForm.variables).toContain('message');

    const orderNotif = TEMPLATE_MANIFEST.find((t) => t.templateId === 'new_order_notification');
    expect(orderNotif.variables).toContain('orderNumber');
    expect(orderNotif.variables).toContain('customerName');
    expect(orderNotif.variables).toContain('total');
    expect(orderNotif.variables).toContain('itemCount');
  });

  it('welcome_series_1 includes discountCode variable', () => {
    const ws1 = TEMPLATE_MANIFEST.find((t) => t.templateId === 'welcome_series_1');
    expect(ws1.variables).toContain('discountCode');
    expect(ws1.variables).toContain('firstName');
  });

  it('cart_recovery_3 includes discountCode variable', () => {
    const cr3 = TEMPLATE_MANIFEST.find((t) => t.templateId === 'cart_recovery_3');
    expect(cr3.variables).toContain('discountCode');
    expect(cr3.variables).toContain('buyerName');
    expect(cr3.variables).toContain('cartTotal');
  });

  it('swatch_confirmation has required variables', () => {
    const sc = TEMPLATE_MANIFEST.find((t) => t.templateId === 'swatch_confirmation');
    expect(sc.variables).toContain('customerName');
    expect(sc.variables).toContain('productName');
    expect(sc.variables).toContain('swatchList');
    expect(sc.variables).toContain('estimatedArrival');
  });
});

// ── Cross-reference with TEMPLATE_REGISTRY ──────────────────────────

describe('TEMPLATE_MANIFEST ↔ TEMPLATE_REGISTRY cross-reference', () => {
  const registryIds = Object.keys(_TEMPLATE_REGISTRY);

  it('all sequence-managed manifest templates exist in TEMPLATE_REGISTRY', () => {
    // These templates are NOT in the registry — they're used directly in backend services
    const directUseTemplates = [
      'contact_form_submission', 'new_order_notification', 'swatch_confirmation',
      'gift_card_purchase_confirmation', 'gift_card_received',
      'price_drop_alert', 'back_in_stock_alert',
    ];
    const registryManaged = TEMPLATE_MANIFEST.filter(
      (t) => !directUseTemplates.includes(t.templateId)
    );
    for (const entry of registryManaged) {
      expect(registryIds).toContain(entry.templateId);
    }
  });

  it('manifest subject lines are consistent with TEMPLATE_REGISTRY', () => {
    for (const entry of TEMPLATE_MANIFEST) {
      const regEntry = _TEMPLATE_REGISTRY[entry.templateId];
      if (!regEntry) continue; // skip non-registry templates
      // Subject lines should match (registry uses subjectLine, manifest uses subject)
      expect(entry.subject).toBe(regEntry.subjectLine);
    }
  });
});

// ── Backend template ID coverage ─────────────────────────────────────
// Every template ID hardcoded in backend emailContact() calls must be in the manifest.

describe('All backend template IDs are in TEMPLATE_MANIFEST', () => {
  const manifestIds = TEMPLATE_MANIFEST.map((t) => t.templateId);

  // Template IDs used directly in emailService.web.js
  it('covers emailService templates (contact_form_submission, swatch_confirmation, new_order_notification)', () => {
    expect(manifestIds).toContain('contact_form_submission');
    expect(manifestIds).toContain('swatch_confirmation');
    expect(manifestIds).toContain('new_order_notification');
  });

  // Template IDs used in giftCards.web.js
  it('covers gift card email templates (gift_card_purchase_confirmation, gift_card_received)', () => {
    expect(manifestIds).toContain('gift_card_purchase_confirmation');
    expect(manifestIds).toContain('gift_card_received');
  });

  // Template IDs used in notificationService.web.js
  it('covers notification alert templates (price_drop_alert, back_in_stock_alert)', () => {
    expect(manifestIds).toContain('price_drop_alert');
    expect(manifestIds).toContain('back_in_stock_alert');
  });

  // Template IDs used by emailAutomation.web.js via SEQUENCES
  it('covers all emailAutomation SEQUENCES template IDs', () => {
    // welcome: welcome_series_1, welcome_series_2, welcome_series_3
    expect(manifestIds).toContain('welcome_series_1');
    expect(manifestIds).toContain('welcome_series_2');
    expect(manifestIds).toContain('welcome_series_3');
    // cart_recovery: cart_recovery_1, cart_recovery_2, cart_recovery_3
    expect(manifestIds).toContain('cart_recovery_1');
    expect(manifestIds).toContain('cart_recovery_2');
    expect(manifestIds).toContain('cart_recovery_3');
    // post_purchase: post_purchase_1, post_purchase_2, post_purchase_3
    expect(manifestIds).toContain('post_purchase_1');
    expect(manifestIds).toContain('post_purchase_2');
    expect(manifestIds).toContain('post_purchase_3');
  });

  it('manifest variables match backend emailContact() call variables', () => {
    // gift_card_purchase_confirmation
    const gcPurchase = TEMPLATE_MANIFEST.find((t) => t.templateId === 'gift_card_purchase_confirmation');
    expect(gcPurchase.variables).toContain('code');
    expect(gcPurchase.variables).toContain('amount');
    expect(gcPurchase.variables).toContain('recipientEmail');
    expect(gcPurchase.variables).toContain('recipientName');
    expect(gcPurchase.variables).toContain('expirationDate');

    // gift_card_received
    const gcReceived = TEMPLATE_MANIFEST.find((t) => t.templateId === 'gift_card_received');
    expect(gcReceived.variables).toContain('code');
    expect(gcReceived.variables).toContain('amount');
    expect(gcReceived.variables).toContain('recipientName');
    expect(gcReceived.variables).toContain('message');
    expect(gcReceived.variables).toContain('purchaserEmail');
    expect(gcReceived.variables).toContain('expirationDate');

    // price_drop_alert
    const priceDrop = TEMPLATE_MANIFEST.find((t) => t.templateId === 'price_drop_alert');
    expect(priceDrop.variables).toContain('productName');
    expect(priceDrop.variables).toContain('previousPrice');
    expect(priceDrop.variables).toContain('currentPrice');
    expect(priceDrop.variables).toContain('savings');
    expect(priceDrop.variables).toContain('productUrl');
    expect(priceDrop.variables).toContain('productImage');

    // back_in_stock_alert
    const backInStock = TEMPLATE_MANIFEST.find((t) => t.templateId === 'back_in_stock_alert');
    expect(backInStock.variables).toContain('productName');
    expect(backInStock.variables).toContain('productUrl');
    expect(backInStock.variables).toContain('productImage');
  });
});

// ── validateTemplates ────────────────────────────────────────────────

describe('validateTemplates', () => {
  it('returns valid for the full manifest', () => {
    const result = validateTemplates(TEMPLATE_MANIFEST);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors on duplicate template IDs', () => {
    const dupes = [
      ...TEMPLATE_MANIFEST,
      { templateId: 'welcome_series_1', subject: 'Dupe', variables: ['x'], priority: 1, description: 'd' },
    ];
    const result = validateTemplates(dupes);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('errors on template missing templateId', () => {
    const bad = [{ subject: 'No ID', variables: ['x'], priority: 1, description: 'd' }];
    const result = validateTemplates(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('templateId'))).toBe(true);
  });

  it('errors on template missing subject', () => {
    const bad = [{ templateId: 'test', variables: ['x'], priority: 1, description: 'd' }];
    const result = validateTemplates(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('subject'))).toBe(true);
  });

  it('errors on template with empty variables', () => {
    const bad = [{ templateId: 'test', subject: 'Test', variables: [], priority: 1, description: 'd' }];
    const result = validateTemplates(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('variables'))).toBe(true);
  });

  it('warns on templateId not matching snake_case convention', () => {
    const templates = [{ templateId: 'camelCase', subject: 'Test', variables: ['x'], priority: 1, description: 'd' }];
    const result = validateTemplates(templates);
    expect(result.warnings.some((w) => w.includes('snake_case'))).toBe(true);
  });
});

// ── getTemplateStatus ────────────────────────────────────────────────

describe('getTemplateStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns status for each template (all missing)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ templates: [] }),
    });

    const status = await getTemplateStatus({
      apiKey: 'test-key',
      siteId: 'test-site',
    });

    expect(status).toHaveLength(16);
    expect(status.every((s) => s.exists === false)).toBe(true);
  });

  it('marks templates as existing when found in API response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        templates: [
          { id: 'tmpl-1', name: 'welcome_series_1' },
          { id: 'tmpl-2', name: 'contact_form_submission' },
        ],
      }),
    });

    const status = await getTemplateStatus({
      apiKey: 'test-key',
      siteId: 'test-site',
    });

    const ws1 = status.find((s) => s.templateId === 'welcome_series_1');
    const cf = status.find((s) => s.templateId === 'contact_form_submission');
    const ws2 = status.find((s) => s.templateId === 'welcome_series_2');

    expect(ws1.exists).toBe(true);
    expect(cf.exists).toBe(true);
    expect(ws2.exists).toBe(false);
  });

  it('throws on API failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(
      getTemplateStatus({ apiKey: 'bad-key', siteId: 'test-site' })
    ).rejects.toThrow(/Failed to list/);
  });

  it('sends correct authorization headers', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ templates: [] }),
    });

    await getTemplateStatus({ apiKey: 'my-key', siteId: 'my-site' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('my-key');
    expect(opts.headers['wix-site-id']).toBe('my-site');
  });

  it('handles network errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('Network timeout'));

    await expect(
      getTemplateStatus({ apiKey: 'key', siteId: 'site' })
    ).rejects.toThrow(/Network timeout/);
  });
});

// ── provisionTemplates ───────────────────────────────────────────────

describe('provisionTemplates', () => {
  const opts = { apiKey: 'test-key', siteId: 'test-site' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates all 16 templates when none exist', async () => {
    // List returns empty
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ templates: [] }),
    });
    // 12 create calls
    for (let i = 0; i < 16; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ template: { id: `new-${i}` } }),
      });
    }

    const { results } = await provisionTemplates(opts);
    expect(results).toHaveLength(16);
    expect(results.every((r) => r.status === 'CREATED')).toBe(true);
    // 1 list + 16 creates = 17 calls
    expect(fetch).toHaveBeenCalledTimes(17);
  });

  it('skips existing templates', async () => {
    // List returns 3 existing
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        templates: [
          { id: 'tmpl-1', name: 'welcome_series_1' },
          { id: 'tmpl-2', name: 'welcome_series_2' },
          { id: 'tmpl-3', name: 'welcome_series_3' },
        ],
      }),
    });
    // 9 create calls for the rest
    for (let i = 0; i < 9; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ template: { id: `new-${i}` } }),
      });
    }

    const { results } = await provisionTemplates(opts);
    const created = results.filter((r) => r.status === 'CREATED');
    const skipped = results.filter((r) => r.status === 'EXISTS');
    expect(created).toHaveLength(9);
    expect(skipped).toHaveLength(3);
  });

  it('dry run does not make create calls', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ templates: [] }),
    });

    const { results } = await provisionTemplates({ ...opts, dryRun: true });
    expect(results).toHaveLength(16);
    expect(results.every((r) => r.status === 'WOULD_CREATE')).toBe(true);
    // Only the list call
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports API errors per-template without aborting', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ templates: [] }),
    });
    // First create fails
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });
    // Rest succeed
    for (let i = 1; i < 16; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ template: { id: `new-${i}` } }),
      });
    }

    const { results } = await provisionTemplates(opts);
    const errors = results.filter((r) => r.status === 'ERROR');
    const created = results.filter((r) => r.status === 'CREATED');
    expect(errors).toHaveLength(1);
    expect(errors[0].detail).toContain('403');
    expect(created).toHaveLength(15);
  });

  it('throws if listing templates fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(provisionTemplates(opts)).rejects.toThrow(/Failed to list/);
  });

  it('sends template data in create request body', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ templates: [] }),
    });
    for (let i = 0; i < 16; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ template: { id: `new-${i}` } }),
      });
    }

    await provisionTemplates(opts);

    // Check first create call (index 1, since index 0 is list)
    const createCall = fetch.mock.calls[1];
    expect(createCall[1].method).toBe('POST');
    const body = JSON.parse(createCall[1].body);
    expect(body).toHaveProperty('template');
    expect(body.template).toHaveProperty('name');
    expect(body.template).toHaveProperty('subject');
    expect(body.template).toHaveProperty('variables');
  });

  it('handles fetch throwing during create', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ templates: [] }),
    });
    fetch.mockRejectedValueOnce(new Error('Connection reset'));
    for (let i = 1; i < 16; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ template: { id: `new-${i}` } }),
      });
    }

    const { results } = await provisionTemplates(opts);
    const errors = results.filter((r) => r.status === 'ERROR');
    expect(errors).toHaveLength(1);
    expect(errors[0].detail).toContain('Connection reset');
  });

  it('prioritizes P0 templates first in results', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ templates: [] }),
    });
    for (let i = 0; i < 16; i++) {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ template: { id: `new-${i}` } }),
      });
    }

    const { results } = await provisionTemplates(opts);
    // P0 templates should come first
    const p0Indices = results
      .map((r, i) => ({ ...r, idx: i }))
      .filter((r) => r.priority === 0)
      .map((r) => r.idx);
    const p1Indices = results
      .map((r, i) => ({ ...r, idx: i }))
      .filter((r) => r.priority === 1)
      .map((r) => r.idx);

    if (p0Indices.length > 0 && p1Indices.length > 0) {
      expect(Math.max(...p0Indices)).toBeLessThan(Math.min(...p1Indices));
    }
  });
});
