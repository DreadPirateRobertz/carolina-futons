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

  it('contains post-purchase templates (3 steps)', () => {
    const pp = Object.values(_TEMPLATE_REGISTRY).filter(t => t.sequence === 'post_purchase');
    expect(pp).toHaveLength(3);
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
});

// ── resolveSubjectLine ──────────────────────────────────────────────

describe('resolveSubjectLine', () => {
  it('substitutes variables in subject line', async () => {
    const subject = await resolveSubjectLine('post_purchase_1', { firstName: 'Jane' });
    expect(subject).toBe('Thank you for your order, Jane!');
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
});
