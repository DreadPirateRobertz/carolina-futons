/**
 * @file emailFlow.test.js
 * @description cf-uwfw — coverage for queueWelcomeEmail / queueCartRecovery
 * webMethods in src/backend/emailFlow.web.js. The HTTP dispatcher contract
 * is covered separately in queueEmailDispatcher.test.js; this file pins the
 * webMethod-level behaviour (validation, contact resolution, delegation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/emailAutomation.web', () => ({
  triggerWelcomeSequence: vi.fn(),
}));

import { queueWelcomeEmail, queueCartRecovery } from '../src/backend/emailFlow.web.js';
import { __reset, __seedContacts } from './__mocks__/wix-crm-backend.js';
import { triggerWelcomeSequence } from 'backend/emailAutomation.web';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── queueWelcomeEmail ────────────────────────────────────────────────────────

describe('queueWelcomeEmail', () => {
  it('rejects missing payload', async () => {
    const res = await queueWelcomeEmail(undefined);
    expect(res).toEqual({ success: false, error: 'Invalid payload' });
    expect(vi.mocked(triggerWelcomeSequence)).not.toHaveBeenCalled();
  });

  it('rejects payload with wrong type', async () => {
    const res = await queueWelcomeEmail({ type: 'something-else', email: 'a@b.com' });
    expect(res).toEqual({ success: false, error: 'Invalid payload' });
  });

  it('rejects non-object payload', async () => {
    const res = await queueWelcomeEmail('not-an-object');
    expect(res).toEqual({ success: false, error: 'Invalid payload' });
  });

  it('rejects missing email', async () => {
    const res = await queueWelcomeEmail({ type: 'welcome' });
    expect(res).toEqual({ success: false, error: 'Invalid email' });
  });

  it('rejects malformed email', async () => {
    const res = await queueWelcomeEmail({ type: 'welcome', email: 'not-an-email' });
    expect(res).toEqual({ success: false, error: 'Invalid email' });
  });

  it('lowercases + trims email before contact resolution', async () => {
    vi.mocked(triggerWelcomeSequence).mockResolvedValue({ success: true, queued: 3 });
    await queueWelcomeEmail({ type: 'welcome', email: '  ALICE@Example.COM  ' });
    // The mocked appendOrCreateContact stamps a new id; we just assert
    // the trigger was called with the normalized email.
    expect(vi.mocked(triggerWelcomeSequence)).toHaveBeenCalledTimes(1);
    const [, email, firstName] = vi.mocked(triggerWelcomeSequence).mock.calls[0];
    expect(email).toBe('alice@example.com');
    expect(firstName).toBe('');
  });

  it('reuses existing contact when email already in CRM', async () => {
    __seedContacts([
      { _id: 'contact-existing-77', primaryInfo: { email: 'existing@example.com' } },
    ]);
    vi.mocked(triggerWelcomeSequence).mockResolvedValue({ success: true, queued: 3 });
    await queueWelcomeEmail({ type: 'welcome', email: 'existing@example.com' });
    expect(vi.mocked(triggerWelcomeSequence)).toHaveBeenCalledWith('contact-existing-77', 'existing@example.com', '');
  });

  it('returns "Failed to resolve contact" infra error when contact lookup throws', async () => {
    const crm = await import('./__mocks__/wix-crm-backend.js');
    const real = crm.contacts.appendOrCreateContact;
    crm.contacts.appendOrCreateContact = async () => { throw new Error('CRM down'); };
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await queueWelcomeEmail({ type: 'welcome', email: 'good@example.com' });
      expect(res).toEqual({ success: false, error: 'Failed to resolve contact' });
      expect(errSpy).toHaveBeenCalled();
      expect(vi.mocked(triggerWelcomeSequence)).not.toHaveBeenCalled();
    } finally {
      crm.contacts.appendOrCreateContact = real;
      errSpy.mockRestore();
    }
  });

  it('returns "Failed to resolve contact" when CRM yields no contactId', async () => {
    const crm = await import('./__mocks__/wix-crm-backend.js');
    const real = crm.contacts.appendOrCreateContact;
    crm.contacts.appendOrCreateContact = async () => ({ /* no id */ });
    try {
      const res = await queueWelcomeEmail({ type: 'welcome', email: 'good@example.com' });
      expect(res).toEqual({ success: false, error: 'Failed to resolve contact' });
      expect(vi.mocked(triggerWelcomeSequence)).not.toHaveBeenCalled();
    } finally {
      crm.contacts.appendOrCreateContact = real;
    }
  });

  it('forwards triggerWelcomeSequence success envelope verbatim', async () => {
    vi.mocked(triggerWelcomeSequence).mockResolvedValue({ success: true, queued: 3 });
    const res = await queueWelcomeEmail({ type: 'welcome', email: 'happy@example.com' });
    expect(res).toEqual({ success: true, queued: 3 });
  });

  it('forwards triggerWelcomeSequence soft-fail envelope verbatim (unsubscribed/already-queued)', async () => {
    vi.mocked(triggerWelcomeSequence).mockResolvedValue({ success: false, queued: 0 });
    const res = await queueWelcomeEmail({ type: 'welcome', email: 'sad@example.com' });
    expect(res).toEqual({ success: false, queued: 0 });
  });
});

// ── queueCartRecovery ────────────────────────────────────────────────────────

describe('queueCartRecovery', () => {
  const validItems = [{ productId: 'prod-1', quantity: 2 }];

  it('rejects missing payload', async () => {
    const res = await queueCartRecovery(undefined);
    expect(res).toEqual({ success: false, error: 'Invalid payload' });
  });

  it('rejects payload with wrong type', async () => {
    const res = await queueCartRecovery({ type: 'something', items: validItems });
    expect(res).toEqual({ success: false, error: 'Invalid payload' });
  });

  it('rejects non-array items', async () => {
    const res = await queueCartRecovery({ type: 'cart-recovery', items: 'not-array' });
    expect(res).toEqual({ success: false, error: 'items is required' });
  });

  it('rejects empty items array', async () => {
    const res = await queueCartRecovery({ type: 'cart-recovery', items: [] });
    expect(res).toEqual({ success: false, error: 'items is required' });
  });

  it('rejects items with missing productId', async () => {
    const res = await queueCartRecovery({
      type: 'cart-recovery',
      items: [{ quantity: 2 }],
    });
    expect(res).toEqual({ success: false, error: 'Invalid items' });
  });

  it('rejects items with non-positive quantity', async () => {
    const res = await queueCartRecovery({
      type: 'cart-recovery',
      items: [{ productId: 'p1', quantity: 0 }],
    });
    expect(res).toEqual({ success: false, error: 'Invalid items' });
  });

  it('rejects items with non-numeric quantity', async () => {
    const res = await queueCartRecovery({
      type: 'cart-recovery',
      items: [{ productId: 'p1', quantity: 'five' }],
    });
    expect(res).toEqual({ success: false, error: 'Invalid items' });
  });

  it('returns success with acknowledged count on valid payload', async () => {
    const res = await queueCartRecovery({
      type: 'cart-recovery',
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 3 },
      ],
    });
    expect(res.success).toBe(true);
    expect(res.acknowledged).toBe(2);
    expect(typeof res.note).toBe('string');
  });
});
