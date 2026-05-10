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
