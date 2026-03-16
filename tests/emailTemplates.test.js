import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert } from './__mocks__/wix-data.js';
import {
  getTemplatesBySequence,
  getTemplate,
  getTemplateIndex,
  resolveSubjectLine,
  validateTemplateVariables,
  getTemplatePerformance,
  queuePromotionalEmail,
  _TEMPLATE_REGISTRY,
} from '../src/backend/emailTemplates.web.js';

beforeEach(() => {
  __seed('EmailQueue', []);
  __seed('Unsubscribes', []);
});

// ── Template Registry ───────────────────────────────────────────────

describe('_TEMPLATE_REGISTRY', () => {
  it('contains welcome series templates (3 steps)', () => {
    const welcome = Object.values(_TEMPLATE_REGISTRY).filter(t => t.sequence === 'welcome');
    expect(welcome).toHaveLength(3);
    expect(welcome.map(t => t.step)).toEqual([1, 2, 3]);
  });

  it('contains cart recovery templates (3 steps)', () => {
    const cart = Object.values(_TEMPLATE_REGISTRY).filter(t => t.sequence === 'cart_recovery');
    expect(cart).toHaveLength(3);
  });

  it('contains post-purchase templates (3 steps) with day 3/7/30 focus', () => {
    const pp = Object.values(_TEMPLATE_REGISTRY).filter(t => t.sequence === 'post_purchase');
    expect(pp).toHaveLength(3);
    const sorted = pp.sort((a, b) => a.step - b.step);

    // Step 1 (Day 3): Assembly follow-up
    expect(sorted[0].name).toContain('Assembly');
    expect(sorted[0].subjectLine).toMatch(/assembly|setup/i);
    expect(sorted[0].variables).toContain('assemblyGuideUrl');

    // Step 2 (Day 7): Review solicitation
    expect(sorted[1].name).toContain('Review');
    expect(sorted[1].subjectLine).toMatch(/review|enjoying/i);
    expect(sorted[1].variables).toContain('reviewUrl');

    // Step 3 (Day 30): Care guide + upsell (unchanged)
    expect(sorted[2].name).toContain('Care');
  });

  it('contains promotional templates', () => {
    const promo = Object.values(_TEMPLATE_REGISTRY).filter(t => t.sequence === 'promotional');
    expect(promo.length).toBeGreaterThanOrEqual(2);
  });

  it('contains reengagement template', () => {
    const re = Object.values(_TEMPLATE_REGISTRY).filter(t => t.sequence === 'reengagement');
    expect(re).toHaveLength(1);
  });

  it('every template has required fields', () => {
    for (const template of Object.values(_TEMPLATE_REGISTRY)) {
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('sequence');
      expect(template).toHaveProperty('step');
      expect(template).toHaveProperty('subjectLine');
      expect(template).toHaveProperty('previewText');
      expect(template).toHaveProperty('variables');
      expect(template).toHaveProperty('category');
      expect(Array.isArray(template.variables)).toBe(true);
    }
  });

  it('every template includes email in its variables', () => {
    for (const template of Object.values(_TEMPLATE_REGISTRY)) {
      expect(template.variables).toContain('email');
    }
  });

  it('has unique template IDs', () => {
    const ids = Object.keys(_TEMPLATE_REGISTRY);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('template ID matches registry key', () => {
    for (const [key, template] of Object.entries(_TEMPLATE_REGISTRY)) {
      expect(template.id).toBe(key);
    }
  });

  it('every template has non-empty subjectLine and previewText', () => {
    for (const template of Object.values(_TEMPLATE_REGISTRY)) {
      expect(template.subjectLine.length).toBeGreaterThan(5);
      expect(template.previewText.length).toBeGreaterThan(5);
    }
  });

  it('category is one of the valid types', () => {
    const validCategories = ['onboarding', 'recovery', 'transactional', 'marketing'];
    for (const template of Object.values(_TEMPLATE_REGISTRY)) {
      expect(validCategories).toContain(template.category);
    }
  });

  it('step is a positive integer', () => {
    for (const template of Object.values(_TEMPLATE_REGISTRY)) {
      expect(template.step).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(template.step)).toBe(true);
    }
  });

  it('variables arrays contain only strings', () => {
    for (const template of Object.values(_TEMPLATE_REGISTRY)) {
      for (const v of template.variables) {
        expect(typeof v).toBe('string');
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── getTemplatesBySequence ──────────────────────────────────────────

describe('getTemplatesBySequence', () => {
  it('returns welcome templates sorted by step', async () => {
    const templates = await getTemplatesBySequence('welcome');
    expect(templates).toHaveLength(3);
    expect(templates[0].step).toBe(1);
    expect(templates[2].step).toBe(3);
  });

  it('returns cart_recovery templates', async () => {
    const templates = await getTemplatesBySequence('cart_recovery');
    expect(templates).toHaveLength(3);
    expect(templates[0].sequence).toBe('cart_recovery');
  });

  it('returns empty array for unknown sequence', async () => {
    const templates = await getTemplatesBySequence('nonexistent');
    expect(templates).toEqual([]);
  });

  it('sanitizes input', async () => {
    const templates = await getTemplatesBySequence('<script>alert("xss")</script>');
    expect(templates).toEqual([]);
  });

  it('returns post_purchase templates', async () => {
    const templates = await getTemplatesBySequence('post_purchase');
    expect(templates).toHaveLength(3);
    expect(templates.every(t => t.sequence === 'post_purchase')).toBe(true);
  });

  it('returns promotional templates', async () => {
    const templates = await getTemplatesBySequence('promotional');
    expect(templates.length).toBeGreaterThanOrEqual(3);
  });

  it('returns reengagement templates', async () => {
    const templates = await getTemplatesBySequence('reengagement');
    expect(templates).toHaveLength(1);
  });

  it('returns empty for null input', async () => {
    const templates = await getTemplatesBySequence(null);
    expect(templates).toEqual([]);
  });

  it('returns empty for undefined input', async () => {
    const templates = await getTemplatesBySequence(undefined);
    expect(templates).toEqual([]);
  });
});

// ── getTemplate ─────────────────────────────────────────────────────

describe('getTemplate', () => {
  it('returns template by ID', async () => {
    const template = await getTemplate('welcome_series_1');
    expect(template).not.toBeNull();
    expect(template.id).toBe('welcome_series_1');
    expect(template.sequence).toBe('welcome');
  });

  it('returns null for unknown template', async () => {
    const template = await getTemplate('nonexistent');
    expect(template).toBeNull();
  });

  it('returns null for empty string', async () => {
    const template = await getTemplate('');
    expect(template).toBeNull();
  });

  it('returns null for null input', async () => {
    const template = await getTemplate(null);
    expect(template).toBeNull();
  });

  it('returns cart recovery template', async () => {
    const template = await getTemplate('cart_recovery_1');
    expect(template).not.toBeNull();
    expect(template.category).toBe('recovery');
  });

  it('returns promotional template', async () => {
    const template = await getTemplate('promotional_sale');
    expect(template).not.toBeNull();
    expect(template.category).toBe('marketing');
  });
});

// ── getTemplateIndex ────────────────────────────────────────────────

describe('getTemplateIndex', () => {
  it('returns grouped template IDs', async () => {
    const index = await getTemplateIndex();
    expect(index).toHaveProperty('welcome');
    expect(index).toHaveProperty('cart_recovery');
    expect(index).toHaveProperty('post_purchase');
    expect(index).toHaveProperty('promotional');
    expect(index).toHaveProperty('reengagement');
  });

  it('welcome has 3 template IDs', async () => {
    const index = await getTemplateIndex();
    expect(index.welcome).toHaveLength(3);
  });

  it('cart_recovery has 3 template IDs', async () => {
    const index = await getTemplateIndex();
    expect(index.cart_recovery).toHaveLength(3);
  });

  it('post_purchase has 3 template IDs', async () => {
    const index = await getTemplateIndex();
    expect(index.post_purchase).toHaveLength(3);
  });

  it('all IDs in index exist in registry', async () => {
    const index = await getTemplateIndex();
    for (const ids of Object.values(index)) {
      for (const id of ids) {
        expect(_TEMPLATE_REGISTRY[id]).toBeDefined();
      }
    }
  });
});

// ── resolveSubjectLine ──────────────────────────────────────────────

describe('resolveSubjectLine', () => {
  it('substitutes variables in subject line', async () => {
    const subject = await resolveSubjectLine('post_purchase_1', { firstName: 'Jane' });
    expect(subject).toContain('Jane');
    expect(subject).toMatch(/setup|assembly/i);
  });

  it('substitutes multiple variables', async () => {
    const subject = await resolveSubjectLine('promotional_sale', {
      saleName: 'Spring Sale',
      discountPercent: '25',
    });
    expect(subject).toContain('Spring Sale');
    expect(subject).toContain('25');
  });

  it('returns empty string for unknown template', async () => {
    const subject = await resolveSubjectLine('nonexistent', {});
    expect(subject).toBe('');
  });

  it('leaves unreplaced placeholders when variables missing', async () => {
    const subject = await resolveSubjectLine('post_purchase_1', {});
    expect(subject).toContain('{firstName}');
  });

  it('sanitizes variable values', async () => {
    const subject = await resolveSubjectLine('post_purchase_1', {
      firstName: '<script>alert("xss")</script>Jane',
    });
    expect(subject).not.toContain('<script>');
    expect(subject).toContain('Jane');
  });

  it('handles null variables object', async () => {
    const subject = await resolveSubjectLine('post_purchase_1');
    // Should not throw, unreplaced vars remain
    expect(subject).toContain('{firstName}');
  });

  it('resolves new_arrival subject line', async () => {
    const subject = await resolveSubjectLine('promotional_new_arrival', {
      productName: 'Oak Platform Bed',
    });
    expect(subject).toContain('Oak Platform Bed');
  });

  it('resolves seasonal subject line', async () => {
    const subject = await resolveSubjectLine('promotional_seasonal', {
      seasonName: 'Fall',
    });
    expect(subject).toContain('Fall');
  });

  it('resolves reengagement subject line', async () => {
    const subject = await resolveSubjectLine('reengagement_1', {
      firstName: 'Sam',
    });
    expect(subject).toContain('Sam');
  });

  it('handles numeric variable value', async () => {
    const subject = await resolveSubjectLine('promotional_sale', {
      saleName: 'Test',
      discountPercent: 30,
    });
    expect(subject).toContain('30');
  });
});

// ── validateTemplateVariables ───────────────────────────────────────

describe('validateTemplateVariables', () => {
  it('returns valid when all variables present', async () => {
    const result = await validateTemplateVariables('welcome_series_1', {
      firstName: 'Jane',
      discountCode: 'WELCOME10',
      email: 'jane@example.com',
    });
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('returns missing variables', async () => {
    const result = await validateTemplateVariables('welcome_series_1', {
      firstName: 'Jane',
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('discountCode');
    expect(result.missing).toContain('email');
  });

  it('returns invalid for unknown template', async () => {
    const result = await validateTemplateVariables('nonexistent', {});
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('Template not found');
  });

  it('treats 0 as a valid value', async () => {
    const result = await validateTemplateVariables('promotional_sale', {
      firstName: 'Jane',
      saleName: 'Test',
      discountPercent: 0,
      startDate: 'now',
      endDate: 'later',
      promoCode: 'CODE',
      email: 'j@e.com',
    });
    expect(result.valid).toBe(true);
  });

  it('treats empty string as missing', async () => {
    const result = await validateTemplateVariables('welcome_series_1', {
      firstName: '',
      discountCode: 'CODE',
      email: 'j@e.com',
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('firstName');
  });

  it('validates cart recovery variables', async () => {
    const result = await validateTemplateVariables('cart_recovery_1', {
      buyerName: 'Jane',
      cartTotal: '$299',
      itemSummary: 'Oak Futon',
      checkoutId: 'ck-1',
      email: 'j@e.com',
    });
    expect(result.valid).toBe(true);
  });

  it('reports all missing variables for post_purchase', async () => {
    const result = await validateTemplateVariables('post_purchase_1', {});
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('firstName');
    expect(result.missing).toContain('orderNumber');
    expect(result.missing).toContain('assemblyGuideUrl');
    expect(result.missing).toContain('email');
  });

  it('handles null variables argument', async () => {
    const result = await validateTemplateVariables('welcome_series_1');
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});

// ── getTemplatePerformance ──────────────────────────────────────────

describe('getTemplatePerformance', () => {
  it('returns counts by status', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', templateId: 'welcome_series_1', status: 'sent', createdAt: new Date() },
      { _id: 'eq-2', templateId: 'welcome_series_1', status: 'sent', createdAt: new Date() },
      { _id: 'eq-3', templateId: 'welcome_series_1', status: 'failed', createdAt: new Date() },
      { _id: 'eq-4', templateId: 'welcome_series_1', status: 'pending', createdAt: new Date() },
    ]);

    const stats = await getTemplatePerformance('welcome_series_1');
    expect(stats.sent).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.cancelled).toBe(0);
  });

  it('returns zeros for template with no data', async () => {
    const stats = await getTemplatePerformance('cart_recovery_1');
    expect(stats).toEqual({ sent: 0, failed: 0, cancelled: 0, pending: 0 });
  });

  it('counts cancelled status', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', templateId: 'cart_recovery_1', status: 'cancelled', createdAt: new Date() },
      { _id: 'eq-2', templateId: 'cart_recovery_1', status: 'cancelled', createdAt: new Date() },
    ]);

    const stats = await getTemplatePerformance('cart_recovery_1');
    expect(stats.cancelled).toBe(2);
  });

  it('ignores unknown status values', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', templateId: 'welcome_series_1', status: 'bounced', createdAt: new Date() },
      { _id: 'eq-2', templateId: 'welcome_series_1', status: 'sent', createdAt: new Date() },
    ]);

    const stats = await getTemplatePerformance('welcome_series_1');
    expect(stats.sent).toBe(1);
    // 'bounced' is not a tracked status, should not affect counts
  });

  it('only counts records for the specified template', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', templateId: 'welcome_series_1', status: 'sent', createdAt: new Date() },
      { _id: 'eq-2', templateId: 'cart_recovery_1', status: 'sent', createdAt: new Date() },
    ]);

    const stats = await getTemplatePerformance('welcome_series_1');
    expect(stats.sent).toBe(1);
  });

  it('returns all four status keys in response', async () => {
    const stats = await getTemplatePerformance('welcome_series_1');
    expect(stats).toHaveProperty('sent');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('cancelled');
    expect(stats).toHaveProperty('pending');
  });
});

// ── queuePromotionalEmail ───────────────────────────────────────────

describe('queuePromotionalEmail', () => {
  it('queues emails for valid recipients', async () => {
    const inserted = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserted.push(item); });

    const result = await queuePromotionalEmail('promotional_sale', [
      { email: 'a@test.com', contactId: 'c1', firstName: 'Alice' },
      { email: 'b@test.com', contactId: 'c2', firstName: 'Bob' },
    ], { saleName: 'Spring Sale', discountPercent: '20' });

    expect(result.success).toBe(true);
    expect(result.queued).toBe(2);
    expect(result.skipped).toBe(0);
    expect(inserted).toHaveLength(2);
    expect(inserted[0].templateId).toBe('promotional_sale');
    expect(inserted[0].variables.saleName).toBe('Spring Sale');
  });

  it('skips recipients without email', async () => {
    const result = await queuePromotionalEmail('promotional_sale', [
      { email: '', contactId: 'c1', firstName: 'Alice' },
      { email: 'b@test.com', contactId: 'c2', firstName: 'Bob' },
    ], {});

    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('skips unsubscribed recipients', async () => {
    __seed('Unsubscribes', [
      { _id: 'u1', email: 'a@test.com', sequenceType: 'all' },
    ]);

    const result = await queuePromotionalEmail('promotional_sale', [
      { email: 'a@test.com', contactId: 'c1', firstName: 'Alice' },
    ], {});

    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('rejects non-marketing templates', async () => {
    const result = await queuePromotionalEmail('welcome_series_1', [
      { email: 'a@test.com', contactId: 'c1', firstName: 'Alice' },
    ], {});

    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('handles null recipients array', async () => {
    const result = await queuePromotionalEmail('promotional_sale', null, {});
    expect(result.success).toBe(true);
    expect(result.queued).toBe(0);
  });

  it('handles empty recipients array', async () => {
    const result = await queuePromotionalEmail('promotional_sale', [], {});
    expect(result.success).toBe(true);
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('skips promotional-unsubscribed recipients', async () => {
    __seed('Unsubscribes', [
      { _id: 'u1', email: 'a@test.com', sequenceType: 'promotional' },
    ]);

    const result = await queuePromotionalEmail('promotional_sale', [
      { email: 'a@test.com', contactId: 'c1', firstName: 'Alice' },
    ], {});

    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('rejects unknown template ID', async () => {
    const result = await queuePromotionalEmail('nonexistent_template', [
      { email: 'a@test.com', contactId: 'c1', firstName: 'Alice' },
    ], {});

    expect(result.success).toBe(false);
  });

  it('lowercases email addresses', async () => {
    const inserted = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserted.push(item); });

    await queuePromotionalEmail('promotional_sale', [
      { email: 'Alice@Test.COM', contactId: 'c1', firstName: 'Alice' },
    ], { saleName: 'Test' });

    expect(inserted[0].recipientEmail).toBe('alice@test.com');
  });

  it('sets correct queue fields on inserted record', async () => {
    const inserted = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserted.push(item); });

    await queuePromotionalEmail('promotional_sale', [
      { email: 'a@test.com', contactId: 'c1', firstName: 'Alice' },
    ], { saleName: 'Spring Sale' });

    expect(inserted[0].status).toBe('pending');
    expect(inserted[0].sequenceType).toBe('promotional');
    expect(inserted[0].sequenceStep).toBe(1);
    expect(inserted[0].attempt).toBe(0);
    expect(inserted[0].sentAt).toBeNull();
    expect(inserted[0].abVariant).toBeNull();
  });

  it('merges campaign variables with recipient data', async () => {
    const inserted = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserted.push(item); });

    await queuePromotionalEmail('promotional_sale', [
      { email: 'a@test.com', contactId: 'c1', firstName: 'Alice' },
    ], { saleName: 'Fall Sale', discountPercent: '15' });

    expect(inserted[0].variables.saleName).toBe('Fall Sale');
    expect(inserted[0].variables.discountPercent).toBe('15');
    expect(inserted[0].variables.firstName).toBe('Alice');
    expect(inserted[0].variables.email).toBe('a@test.com');
  });

  it('works with new_arrival template', async () => {
    const result = await queuePromotionalEmail('promotional_new_arrival', [
      { email: 'a@test.com', contactId: 'c1', firstName: 'Alice' },
    ], { productName: 'Oak Bed' });

    expect(result.success).toBe(true);
    expect(result.queued).toBe(1);
  });

  it('works with seasonal template', async () => {
    const result = await queuePromotionalEmail('promotional_seasonal', [
      { email: 'a@test.com', contactId: 'c1', firstName: 'Alice' },
    ], { seasonName: 'Summer' });

    expect(result.success).toBe(true);
    expect(result.queued).toBe(1);
  });
});
