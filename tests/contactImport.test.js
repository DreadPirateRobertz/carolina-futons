/**
 * Tests for contactImport.web.js — bulk contact import via Wix CRM API.
 * TDD: tests written first, implementation follows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seedContacts, contacts } from 'wix-crm-backend';

// We'll import the module under test after creating it
import { importContacts, validateContact, CONTACT_SCHEMA } from 'backend/contactImport.web';

describe('contactImport', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
  });

  describe('CONTACT_SCHEMA', () => {
    it('defines required fields', () => {
      expect(CONTACT_SCHEMA.required).toContain('email');
      expect(CONTACT_SCHEMA.required).toContain('firstName');
    });

    it('defines optional fields', () => {
      expect(CONTACT_SCHEMA.optional).toContain('lastName');
      expect(CONTACT_SCHEMA.optional).toContain('phone');
      expect(CONTACT_SCHEMA.optional).toContain('company');
      expect(CONTACT_SCHEMA.optional).toContain('lifetimeSpend');
      expect(CONTACT_SCHEMA.optional).toContain('loyaltyTier');
    });
  });

  describe('validateContact', () => {
    it('passes for valid contact with required fields', () => {
      const errors = validateContact({ email: 'jane@example.com', firstName: 'Jane' });
      expect(errors).toEqual([]);
    });

    it('passes for valid contact with all fields', () => {
      const errors = validateContact({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '828-555-1234',
        company: 'Acme',
        lifetimeSpend: 500,
        loyaltyTier: 'Silver',
      });
      expect(errors).toEqual([]);
    });

    it('fails for missing email', () => {
      const errors = validateContact({ firstName: 'Jane' });
      expect(errors).toContainEqual(expect.stringContaining('email'));
    });

    it('fails for missing firstName', () => {
      const errors = validateContact({ email: 'jane@example.com' });
      expect(errors).toContainEqual(expect.stringContaining('firstName'));
    });

    it('fails for invalid email format', () => {
      const errors = validateContact({ email: 'not-an-email', firstName: 'Jane' });
      expect(errors).toContainEqual(expect.stringContaining('email'));
    });

    it('fails for empty email string', () => {
      const errors = validateContact({ email: '', firstName: 'Jane' });
      expect(errors).toContainEqual(expect.stringContaining('email'));
    });

    it('fails for non-string email', () => {
      const errors = validateContact({ email: 123, firstName: 'Jane' });
      expect(errors).toContainEqual(expect.stringContaining('email'));
    });

    it('fails for empty firstName', () => {
      const errors = validateContact({ email: 'j@x.com', firstName: '' });
      expect(errors).toContainEqual(expect.stringContaining('firstName'));
    });

    it('accepts valid lifetimeSpend as number', () => {
      const errors = validateContact({ email: 'j@x.com', firstName: 'J', lifetimeSpend: 100 });
      expect(errors).toEqual([]);
    });

    it('rejects negative lifetimeSpend', () => {
      const errors = validateContact({ email: 'j@x.com', firstName: 'J', lifetimeSpend: -1 });
      expect(errors).toContainEqual(expect.stringContaining('lifetimeSpend'));
    });

    it('rejects invalid loyaltyTier', () => {
      const errors = validateContact({ email: 'j@x.com', firstName: 'J', loyaltyTier: 'Diamond' });
      expect(errors).toContainEqual(expect.stringContaining('loyaltyTier'));
    });

    it('accepts valid loyalty tiers', () => {
      for (const tier of ['Bronze', 'Silver', 'Gold', 'Platinum']) {
        const errors = validateContact({ email: 'j@x.com', firstName: 'J', loyaltyTier: tier });
        expect(errors).toEqual([]);
      }
    });
  });

  describe('importContacts', () => {
    const validContacts = [
      { email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith' },
      { email: 'bob@example.com', firstName: 'Bob', phone: '828-555-0001' },
      { email: 'carol@example.com', firstName: 'Carol', company: 'Carolina Futons' },
    ];

    it('returns empty result for empty array', async () => {
      const result = await importContacts([]);
      expect(result).toEqual({
        total: 0,
        created: 0,
        skipped: 0,
        errors: [],
      });
    });

    it('returns error for non-array input', async () => {
      const result = await importContacts(null);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toMatch(/array/i);
    });

    it('creates contacts via appendOrCreateContact', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts(validContacts);
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('returns correct counts on success', async () => {
      const result = await importContacts(validContacts);
      expect(result.total).toBe(3);
      expect(result.created).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('passes correct contact info to CRM API', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '828-555-9999',
      }]);

      const callArg = spy.mock.calls[0][0];
      expect(callArg.emails).toEqual([{ email: 'jane@example.com' }]);
      expect(callArg.name).toEqual({ first: 'Jane', last: 'Doe' });
      expect(callArg.phones).toEqual([{ phone: '828-555-9999' }]);
    });

    it('omits phone when not provided', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{ email: 'j@x.com', firstName: 'J' }]);

      const callArg = spy.mock.calls[0][0];
      expect(callArg.phones).toBeUndefined();
    });

    it('skips duplicate contacts (same email)', async () => {
      __seedContacts([{
        _id: 'existing-1',
        primaryInfo: { email: 'alice@example.com' },
      }]);

      const result = await importContacts([
        { email: 'alice@example.com', firstName: 'Alice' },
        { email: 'bob@example.com', firstName: 'Bob' },
      ]);

      // appendOrCreateContact handles dedup — both calls succeed,
      // but existing contact returns existing ID (counted as skipped)
      expect(result.created + result.skipped).toBe(2);
    });

    it('skips contacts with validation errors', async () => {
      const result = await importContacts([
        { email: 'valid@example.com', firstName: 'Valid' },
        { email: 'no-first-name@example.com' }, // missing firstName
        { email: '', firstName: 'No Email' }, // empty email
      ]);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it('records validation error details', async () => {
      const result = await importContacts([
        { email: 'bad', firstName: 'X' }, // invalid email
      ]);

      expect(result.errors[0]).toMatchObject({
        email: 'bad',
        error: expect.stringContaining('email'),
      });
    });

    it('handles CRM API failures gracefully', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact')
        .mockRejectedValueOnce(new Error('CRM unavailable'));

      const result = await importContacts([
        { email: 'fail@example.com', firstName: 'Fail' },
        { email: 'ok@example.com', firstName: 'Ok' },
      ]);

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        email: 'fail@example.com',
        error: 'CRM unavailable',
      });
      spy.mockRestore();
    });

    it('normalizes email to lowercase', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{ email: 'ALICE@EXAMPLE.COM', firstName: 'Alice' }]);

      const callArg = spy.mock.calls[0][0];
      expect(callArg.emails[0].email).toBe('alice@example.com');
    });

    it('trims whitespace from string fields', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{
        email: '  alice@example.com  ',
        firstName: '  Alice  ',
        lastName: '  Smith  ',
      }]);

      const callArg = spy.mock.calls[0][0];
      expect(callArg.emails[0].email).toBe('alice@example.com');
      expect(callArg.name.first).toBe('Alice');
      expect(callArg.name.last).toBe('Smith');
    });

    it('supports dry run mode', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      const result = await importContacts(validContacts, { dryRun: true });

      expect(spy).not.toHaveBeenCalled();
      expect(result.total).toBe(3);
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.dryRun).toBe(true);
      expect(result.wouldCreate).toBe(3);
    });

    it('dry run still catches validation errors', async () => {
      const result = await importContacts([
        { email: 'good@x.com', firstName: 'G' },
        { email: '', firstName: 'Bad' },
      ], { dryRun: true });

      expect(result.wouldCreate).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('labels imported contacts when label provided', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts(
        [{ email: 'a@x.com', firstName: 'A' }],
        { label: 'Legacy Customer' }
      );

      const callArg = spy.mock.calls[0][0];
      expect(callArg.labelKeys).toContain('Legacy Customer');
    });

    it('does not set labelKeys when no label provided', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{ email: 'a@x.com', firstName: 'A' }]);

      const callArg = spy.mock.calls[0][0];
      expect(callArg.labelKeys).toBeUndefined();
    });

    it('handles large batch (183 contacts)', async () => {
      const largeSet = Array.from({ length: 183 }, (_, i) => ({
        email: `contact${i}@example.com`,
        firstName: `Contact${i}`,
      }));

      const result = await importContacts(largeSet);
      expect(result.total).toBe(183);
      expect(result.created).toBe(183);
      expect(result.errors).toEqual([]);
    });

    it('includes company in contact info', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{
        email: 'a@x.com',
        firstName: 'A',
        company: 'Acme Corp',
      }]);

      const callArg = spy.mock.calls[0][0];
      expect(callArg.company).toBe('Acme Corp');
    });
  });
});
