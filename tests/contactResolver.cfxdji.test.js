/**
 * @file contactResolver.cfxdji.test.js
 * @description cf-xdji — resolveContactId(email, firstName?) helper that
 * wraps contacts.appendOrCreateContact. Closes the F1 (welcome series for
 * anonymous + member-self-trigger) and F7 (swatch confirmation for new
 * visitors) silent failures from the cf-icww email audit by giving every
 * EmailQueue producer a single source of truth for upserting CRM contacts.
 *
 * Verifies:
 *   - New email → calls appendOrCreateContact with { emails, name? } and
 *     returns { contactId, created: true }
 *   - Existing email (identityType: 'CONTACT') → returns { contactId,
 *     created: false } and reuses the existing contact's id
 *   - Missing/invalid email → null (no Wix call)
 *   - firstName sanitised + trimmed; whitespace-only firstName omitted
 *   - Wix throws → null (logged with the email; never throws upstream)
 *   - Wix returns no contactId → null + warn logged
 *   - Both webMethod export AND _resolveContactIdInternal export work
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __seedContacts,
  __reset as resetCrm,
  contacts,
} from './__mocks__/wix-crm-backend.js';

import {
  resolveContactId,
  _resolveContactIdInternal,
} from '../src/backend/contacts/contactResolver.web.js';

beforeEach(() => {
  resetCrm();
  vi.restoreAllMocks();
});

describe('cf-xdji · resolveContactId — happy path', () => {
  it('creates a new contact and returns the contactId for a fresh email', async () => {
    const contactId = await resolveContactId('new-shopper@example.com');
    expect(typeof contactId).toBe('string');
    expect(contactId).toMatch(/^contact-/); // mock-generated id shape
  });

  it('returns the existing contactId when a contact already exists for the email', async () => {
    __seedContacts([
      { _id: 'contact-existing-9', primaryInfo: { email: 'existing@example.com' } },
    ]);
    const contactId = await resolveContactId('existing@example.com');
    expect(contactId).toBe('contact-existing-9');
  });

  it('lowercases + trims the email before passing to appendOrCreateContact', async () => {
    const spy = vi.spyOn(contacts, 'appendOrCreateContact');
    await resolveContactId('  Shopper@Example.COM  ');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        emails: [{ email: 'shopper@example.com' }],
      }),
    );
  });

  it('forwards firstName when provided and omits the name field when absent', async () => {
    const spy = vi.spyOn(contacts, 'appendOrCreateContact');
    await resolveContactId('shopper@example.com', 'Asha');
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        emails: [{ email: 'shopper@example.com' }],
        name: { first: 'Asha' },
      }),
    );

    spy.mockClear();
    await resolveContactId('other@example.com');
    const callArg = spy.mock.calls[0][0];
    expect(callArg.name).toBeUndefined();
  });

  it('drops whitespace-only firstName so empty names do not pollute the contact', async () => {
    const spy = vi.spyOn(contacts, 'appendOrCreateContact');
    await resolveContactId('shopper@example.com', '   ');
    const callArg = spy.mock.calls[0][0];
    expect(callArg.name).toBeUndefined();
  });
});

describe('cf-xdji · resolveContactId — validation', () => {
  it('returns null for empty email', async () => {
    expect(await resolveContactId('')).toBeNull();
  });

  it('returns null for null/undefined email', async () => {
    expect(await resolveContactId(null)).toBeNull();
    expect(await resolveContactId(undefined)).toBeNull();
  });

  it('returns null for non-string email', async () => {
    expect(await resolveContactId(42)).toBeNull();
    expect(await resolveContactId({})).toBeNull();
  });

  it('returns null for malformed email (no @, no dot)', async () => {
    expect(await resolveContactId('notanemail')).toBeNull();
    expect(await resolveContactId('foo@')).toBeNull();
    expect(await resolveContactId('@bar.com')).toBeNull();
  });

  it('does not call appendOrCreateContact when the email fails validation', async () => {
    const spy = vi.spyOn(contacts, 'appendOrCreateContact');
    await resolveContactId('not-valid');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('cf-xdji · resolveContactId — failure modes', () => {
  it('returns null when appendOrCreateContact throws', async () => {
    vi.spyOn(contacts, 'appendOrCreateContact').mockRejectedValue(new Error('CRM unavailable'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await resolveContactId('shopper@example.com');
    expect(result).toBeNull();
    // Logged with the email + 'failed' substring so support can correlate
    // a queue-side "no contact ID for recipient" with the upstream cause.
    const logged = consoleErr.mock.calls.flat().map(String).join('\n');
    expect(logged).toContain('shopper@example.com');
    expect(logged).toContain('appendOrCreateContact failed');
    consoleErr.mockRestore();
  });

  it('returns null when appendOrCreateContact resolves with no contactId', async () => {
    vi.spyOn(contacts, 'appendOrCreateContact').mockResolvedValue({});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await resolveContactId('shopper@example.com');
    expect(result).toBeNull();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('returned no contactId'),
      expect.anything(),
    );
    consoleWarn.mockRestore();
  });
});

describe('cf-xdji · _resolveContactIdInternal — backend-to-backend bypass', () => {
  it('returns a contactId string for a fresh email — same contract as webMethod wrapper', async () => {
    const contactId = await _resolveContactIdInternal('helper-direct@example.com', 'Direct');
    expect(typeof contactId).toBe('string');
    expect(contactId.length).toBeGreaterThan(0);
  });

  it('honours the same validation guards', async () => {
    expect(await _resolveContactIdInternal('')).toBeNull();
    expect(await _resolveContactIdInternal('not-an-email')).toBeNull();
  });
});
