import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert } from './__mocks__/wix-data.js';
import {
  queuePromotionalEmail,
} from '../src/backend/emailTemplates.web.js';

beforeEach(() => {
  __seed('EmailQueue', []);
  __seed('Unsubscribes', []);
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
