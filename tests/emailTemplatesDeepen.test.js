import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

import { __seed, __reset, __onInsert } from './__mocks__/wix-data.js';
import {
  getTemplatesBySequence, getTemplate, getTemplateIndex,
  resolveSubjectLine, validateTemplateVariables,
  getTemplatePerformance, queuePromotionalEmail, _TEMPLATE_REGISTRY,
} from '../src/backend/emailTemplates.web.js';

beforeEach(() => {
  __reset();
  __seed('EmailQueue', []);
  __seed('Unsubscribes', []);
});

// ── _TEMPLATE_REGISTRY structure ──────────────────────────────────

describe('_TEMPLATE_REGISTRY structure', () => {
  it('contains welcome_series_1 with correct fields', () => {
    const t = _TEMPLATE_REGISTRY.welcome_series_1;
    expect(t).toBeDefined();
    expect(t.id).toBe('welcome_series_1');
    expect(t.sequence).toBe('welcome');
    expect(t.step).toBe(1);
    expect(t.category).toBe('onboarding');
    expect(t.variables).toEqual(expect.arrayContaining(['firstName', 'discountCode', 'email']));
    expect(t.subjectLine).toContain('Welcome');
  });

  it('contains promotional_sale as marketing category', () => {
    const t = _TEMPLATE_REGISTRY.promotional_sale;
    expect(t.category).toBe('marketing');
    expect(t.sequence).toBe('promotional');
    expect(t.variables).toContain('saleName');
    expect(t.variables).toContain('discountPercent');
  });

  it('contains cart_recovery sequence with 3 steps', () => {
    const cart = Object.values(_TEMPLATE_REGISTRY).filter(t => t.sequence === 'cart_recovery');
    expect(cart).toHaveLength(3);
    expect(cart.map(t => t.step).sort()).toEqual([1, 2, 3]);
  });

  it('every template has required fields', () => {
    for (const t of Object.values(_TEMPLATE_REGISTRY)) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.sequence).toBeTruthy();
      expect(typeof t.step).toBe('number');
      expect(t.subjectLine).toBeTruthy();
      expect(Array.isArray(t.variables)).toBe(true);
      expect(t.category).toBeTruthy();
    }
  });
});

// ── getTemplatesBySequence ────────────────────────────────────────

describe('getTemplatesBySequence', () => {
  it('returns welcome templates sorted by step', async () => {
    const result = await getTemplatesBySequence('welcome');
    expect(result).toHaveLength(5);
    expect(result.map(t => t.step)).toEqual([1, 2, 3, 4, 5]);
    expect(result[0].id).toBe('welcome_series_1');
    expect(result[3].id).toBe('welcome_series_4');
    expect(result[4].id).toBe('welcome_series_5');
  });

  it('returns empty array for unknown sequence', async () => {
    const result = await getTemplatesBySequence('nonexistent_sequence');
    expect(result).toEqual([]);
  });

  it('sanitizes input (strips HTML)', async () => {
    const result = await getTemplatesBySequence('<script>welcome</script>');
    // sanitize strips tags -> "welcome"
    expect(result).toHaveLength(5);
  });
});

// ── getTemplate ───────────────────────────────────────────────────

describe('getTemplate', () => {
  it('returns template by ID', async () => {
    const t = await getTemplate('cart_recovery_2');
    expect(t).not.toBeNull();
    expect(t.id).toBe('cart_recovery_2');
    expect(t.sequence).toBe('cart_recovery');
  });

  it('returns null for unknown template', async () => {
    const t = await getTemplate('does_not_exist');
    expect(t).toBeNull();
  });

  it('sanitizes templateId', async () => {
    const t = await getTemplate('<b>welcome_series_1</b>');
    // sanitize strips tags -> "welcome_series_1"
    expect(t).not.toBeNull();
    expect(t.id).toBe('welcome_series_1');
  });
});

// ── getTemplateIndex ──────────────────────────────────────────────

describe('getTemplateIndex', () => {
  it('groups all templates by sequence', async () => {
    const index = await getTemplateIndex();
    expect(index.welcome).toEqual(expect.arrayContaining([
      'welcome_series_1', 'welcome_series_2', 'welcome_series_3',
    ]));
    expect(index.cart_recovery).toHaveLength(3);
    expect(index.post_purchase).toHaveLength(5);
    expect(index.promotional).toHaveLength(3);
    expect(index.reengagement).toHaveLength(3);
  });

  it('returns correct structure with all known sequences', async () => {
    const index = await getTemplateIndex();
    const keys = Object.keys(index).sort();
    expect(keys).toEqual(['cart_recovery', 'contact', 'post_purchase', 'promotional', 'reengagement', 'transactional', 'welcome']);
  });
});

// ── resolveSubjectLine ────────────────────────────────────────────

describe('resolveSubjectLine', () => {
  it('replaces multiple variables in one subject', async () => {
    const result = await resolveSubjectLine('promotional_sale', {
      saleName: 'Summer Blowout',
      discountPercent: '40',
    });
    expect(result).toBe('Summer Blowout at Carolina Futons — up to 40% off');
  });

  it('returns empty string for unknown templateId', async () => {
    const result = await resolveSubjectLine('no_such_template', { foo: 'bar' });
    expect(result).toBe('');
  });

  it('leaves unreplaced placeholders when variable missing', async () => {
    const result = await resolveSubjectLine('promotional_sale', {
      saleName: 'Flash Sale',
      // discountPercent omitted
    });
    expect(result).toContain('{discountPercent}');
    expect(result).toContain('Flash Sale');
  });

  it('replaces {firstName} in post-purchase subject', async () => {
    const result = await resolveSubjectLine('post_purchase_1', { firstName: 'Dana' });
    expect(result).toContain('Dana');
    expect(result).not.toContain('{firstName}');
  });

  it('handles variable value with special regex chars', async () => {
    const result = await resolveSubjectLine('promotional_new_arrival', {
      productName: 'Frame (20x30) $199',
    });
    expect(result).toContain('Frame (20x30) $199');
  });
});

// ── validateTemplateVariables ─────────────────────────────────────

describe('validateTemplateVariables', () => {
  it('returns valid when all variables present', async () => {
    const result = await validateTemplateVariables('welcome_series_1', {
      firstName: 'Alice',
      discountCode: 'SAVE10',
      email: 'alice@example.com',
    });
    expect(result).toEqual({ valid: true, missing: [] });
  });

  it('returns Template not found for unknown templateId', async () => {
    const result = await validateTemplateVariables('fake_template', {});
    expect(result).toEqual({ valid: false, missing: ['Template not found'] });
  });

  it('returns all missing variables', async () => {
    const result = await validateTemplateVariables('welcome_series_1', {});
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(['firstName', 'discountCode', 'email']));
    expect(result.missing).toHaveLength(3);
  });

  it('treats value 0 as present', async () => {
    const result = await validateTemplateVariables('promotional_sale', {
      firstName: 'Bob',
      saleName: 'Test',
      discountPercent: 0,
      startDate: 'Jan 1',
      endDate: 'Jan 5',
      promoCode: 'X',
      email: 'bob@test.com',
    });
    expect(result).toEqual({ valid: true, missing: [] });
  });

  it('treats empty string as missing', async () => {
    const result = await validateTemplateVariables('welcome_series_2', {
      firstName: '',
      email: 'a@b.com',
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('firstName');
  });
});

// ── getTemplatePerformance ────────────────────────────────────────

describe('getTemplatePerformance', () => {
  it('counts by status', async () => {
    __seed('EmailQueue', [
      { templateId: 'welcome_series_1', status: 'sent', createdAt: new Date() },
      { templateId: 'welcome_series_1', status: 'sent', createdAt: new Date() },
      { templateId: 'welcome_series_1', status: 'failed', createdAt: new Date() },
      { templateId: 'welcome_series_1', status: 'pending', createdAt: new Date() },
    ]);
    const stats = await getTemplatePerformance('welcome_series_1');
    expect(stats).toEqual({ sent: 2, failed: 1, cancelled: 0, pending: 1 });
  });

  it('ignores unknown statuses', async () => {
    __seed('EmailQueue', [
      { templateId: 'welcome_series_1', status: 'sent', createdAt: new Date() },
      { templateId: 'welcome_series_1', status: 'bounced', createdAt: new Date() },
    ]);
    const stats = await getTemplatePerformance('welcome_series_1');
    expect(stats).toEqual({ sent: 1, failed: 0, cancelled: 0, pending: 0 });
  });

  it('returns zeros when no matching records', async () => {
    const stats = await getTemplatePerformance('welcome_series_1');
    expect(stats).toEqual({ sent: 0, failed: 0, cancelled: 0, pending: 0 });
  });

  it('respects days lookback window', async () => {
    const recent = new Date();
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    __seed('EmailQueue', [
      { templateId: 'welcome_series_1', status: 'sent', createdAt: recent },
      { templateId: 'welcome_series_1', status: 'sent', createdAt: old },
    ]);
    const stats7 = await getTemplatePerformance('welcome_series_1', 7);
    expect(stats7.sent).toBe(1);

    const stats90 = await getTemplatePerformance('welcome_series_1', 90);
    expect(stats90.sent).toBe(2);
  });
});

// ── queuePromotionalEmail ─────────────────────────────────────────

describe('queuePromotionalEmail', () => {
  it('rejects non-marketing category template', async () => {
    const result = await queuePromotionalEmail('welcome_series_1', [
      { email: 'a@b.com', contactId: 'c1', firstName: 'A' },
    ], {});
    expect(result).toEqual({ success: false, queued: 0, skipped: 0 });
  });

  it('rejects unknown template', async () => {
    const result = await queuePromotionalEmail('no_template', [], {});
    expect(result).toEqual({ success: false, queued: 0, skipped: 0 });
  });

  it('queues valid recipients', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push(item));

    const result = await queuePromotionalEmail('promotional_sale', [
      { email: 'alice@test.com', contactId: 'c1', firstName: 'Alice' },
      { email: 'bob@test.com', contactId: 'c2', firstName: 'Bob' },
    ], { saleName: 'Spring Sale', discountPercent: '25' });

    expect(result).toEqual({ success: true, queued: 2, skipped: 0 });
    expect(inserted).toHaveLength(2);
    expect(inserted[0].templateId).toBe('promotional_sale');
    expect(inserted[0].status).toBe('pending');
  });

  it('skips unsubscribed recipients (sequenceType = all)', async () => {
    __seed('Unsubscribes', [
      { email: 'unsub@test.com', sequenceType: 'all' },
    ]);

    const result = await queuePromotionalEmail('promotional_sale', [
      { email: 'unsub@test.com', contactId: 'c1', firstName: 'Unsub' },
      { email: 'ok@test.com', contactId: 'c2', firstName: 'Ok' },
    ], {});

    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('skips unsubscribed recipients (sequenceType = promotional)', async () => {
    __seed('Unsubscribes', [
      { email: 'promo-unsub@test.com', sequenceType: 'promotional' },
    ]);

    const result = await queuePromotionalEmail('promotional_sale', [
      { email: 'promo-unsub@test.com', contactId: 'c1', firstName: 'X' },
    ], {});

    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips empty emails', async () => {
    const result = await queuePromotionalEmail('promotional_sale', [
      { email: '', contactId: 'c1', firstName: 'NoEmail' },
      { email: 'valid@test.com', contactId: 'c2', firstName: 'Valid' },
    ], {});

    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('merges campaignVariables with recipient firstName', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push(item));

    await queuePromotionalEmail('promotional_sale', [
      { email: 'test@test.com', contactId: 'c1', firstName: 'Zara' },
    ], { saleName: 'Big Sale', discountPercent: '30' });

    expect(inserted[0].variables.saleName).toBe('Big Sale');
    expect(inserted[0].variables.discountPercent).toBe('30');
    expect(inserted[0].variables.firstName).toBe('Zara');
    expect(inserted[0].variables.email).toBe('test@test.com');
  });

  it('sanitizes all inputs (email lowercased, names trimmed)', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push(item));

    await queuePromotionalEmail('promotional_sale', [
      { email: 'UPPER@TEST.COM', contactId: 'c1', firstName: '  Spaced  ' },
    ], {});

    expect(inserted[0].recipientEmail).toBe('upper@test.com');
    expect(inserted[0].variables.firstName).toBe('Spaced');
  });

  it('returns correct queued/skipped counts with mixed recipients', async () => {
    __seed('Unsubscribes', [
      { email: 'unsub@test.com', sequenceType: 'all' },
    ]);

    const result = await queuePromotionalEmail('promotional_sale', [
      { email: 'good@test.com', contactId: 'c1', firstName: 'Good' },
      { email: '', contactId: 'c2', firstName: 'Empty' },
      { email: 'unsub@test.com', contactId: 'c3', firstName: 'Unsub' },
      { email: 'also-good@test.com', contactId: 'c4', firstName: 'Also' },
    ], {});

    expect(result).toEqual({ success: true, queued: 2, skipped: 2 });
  });

  it('handles null recipients gracefully', async () => {
    const result = await queuePromotionalEmail('promotional_sale', null, {});
    expect(result).toEqual({ success: true, queued: 0, skipped: 0 });
  });
});
