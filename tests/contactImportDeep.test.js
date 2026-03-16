/**
 * Deep coverage tests for contactImport.web.js — validation edge cases,
 * batch error handling, field normalization, and boundary conditions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, contacts } from 'wix-crm-backend';
import { importContacts, validateContact } from 'backend/contactImport.web';

describe('contactImport deep coverage', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
  });

  // ── validateContact edge cases ───────────────────────────────────

  describe('validateContact — edge cases', () => {
    it('rejects whitespace-only firstName', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: '   ' });
      expect(errors).toContainEqual(expect.stringContaining('firstName'));
    });

    it('rejects whitespace-only email', () => {
      const errors = validateContact({ email: '   ', firstName: 'Jane' });
      expect(errors).toContainEqual(expect.stringContaining('email'));
    });

    it('rejects non-string firstName (number)', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 42 });
      expect(errors).toContainEqual(expect.stringContaining('firstName'));
    });

    it('rejects non-string firstName (null)', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: null });
      expect(errors).toContainEqual(expect.stringContaining('firstName'));
    });

    it('accepts lifetimeSpend of 0', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', lifetimeSpend: 0 });
      expect(errors).toEqual([]);
    });

    it('rejects lifetimeSpend as string', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', lifetimeSpend: '500' });
      expect(errors).toContainEqual(expect.stringContaining('lifetimeSpend'));
    });

    it('accepts lifetimeSpend as NaN (typeof NaN is number, NaN < 0 is false)', () => {
      // This is a known gap — NaN passes the typeof + < 0 guard
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', lifetimeSpend: NaN });
      expect(errors).toEqual([]);
    });

    it('accepts lifetimeSpend as Infinity (positive number, >= 0)', () => {
      // typeof Infinity === 'number' && Infinity >= 0 → passes
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', lifetimeSpend: Infinity });
      expect(errors).toEqual([]);
    });

    it('rejects lifetimeSpend as -Infinity', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', lifetimeSpend: -Infinity });
      expect(errors).toContainEqual(expect.stringContaining('lifetimeSpend'));
    });

    it('accepts decimal lifetimeSpend', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', lifetimeSpend: 123.45 });
      expect(errors).toEqual([]);
    });

    it('rejects case-insensitive loyaltyTier (GOLD)', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', loyaltyTier: 'GOLD' });
      expect(errors).toContainEqual(expect.stringContaining('loyaltyTier'));
    });

    it('rejects case-insensitive loyaltyTier (gold)', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', loyaltyTier: 'gold' });
      expect(errors).toContainEqual(expect.stringContaining('loyaltyTier'));
    });

    it('rejects whitespace-padded loyaltyTier', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', loyaltyTier: ' Gold ' });
      expect(errors).toContainEqual(expect.stringContaining('loyaltyTier'));
    });

    it('skips loyaltyTier validation when null', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', loyaltyTier: null });
      expect(errors).toEqual([]);
    });

    it('skips loyaltyTier validation when undefined', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', loyaltyTier: undefined });
      expect(errors).toEqual([]);
    });

    it('skips lifetimeSpend validation when null', () => {
      const errors = validateContact({ email: 'a@b.com', firstName: 'J', lifetimeSpend: null });
      expect(errors).toEqual([]);
    });

    it('can return multiple errors at once', () => {
      const errors = validateContact({ email: '', firstName: '', lifetimeSpend: -1, loyaltyTier: 'Diamond' });
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });

    it('reports missing email as "(missing)" in error context', async () => {
      const result = await importContacts([{ firstName: 'NoEmail' }]);
      expect(result.errors[0].email).toBe('(missing)');
    });
  });

  // ── importContacts edge cases ────────────────────────────────────

  describe('importContacts — input validation', () => {
    it('returns error for string input', async () => {
      const result = await importContacts('not-an-array');
      expect(result.errors[0].error).toMatch(/array/i);
    });

    it('returns error for number input', async () => {
      const result = await importContacts(42);
      expect(result.errors[0].error).toMatch(/array/i);
    });

    it('returns error for object input', async () => {
      const result = await importContacts({ email: 'a@b.com', firstName: 'J' });
      expect(result.errors[0].error).toMatch(/array/i);
    });

    it('returns error for undefined input', async () => {
      const result = await importContacts(undefined);
      expect(result.errors[0].error).toMatch(/array/i);
    });
  });

  describe('importContacts — mixed batch handling', () => {
    it('handles batch with validation errors + API errors', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact')
        .mockResolvedValueOnce({}) // first valid → success
        .mockRejectedValueOnce(new Error('Timeout')); // second valid → API error

      const batch = [
        { email: 'good@test.com', firstName: 'Good' },
        { email: 'bad-email', firstName: 'Bad' }, // validation error
        { email: 'timeout@test.com', firstName: 'Timeout' }, // API error
      ];

      const result = await importContacts(batch);
      expect(result.total).toBe(3);
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1); // validation failure
      expect(result.errors).toHaveLength(2); // validation + API
      spy.mockRestore();
    });

    it('handles all-invalid batch', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      const batch = [
        { email: '', firstName: '' },
        { email: 'nope', firstName: '' },
        { firstName: 'NoEmail' },
      ];

      const result = await importContacts(batch);
      expect(result.total).toBe(3);
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(3);
      expect(result.errors).toHaveLength(3);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('importContacts — field normalization', () => {
    it('trims phone field', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{ email: 'a@b.com', firstName: 'A', phone: '  828-555-0000  ' }]);
      expect(spy.mock.calls[0][0].phones[0].phone).toBe('828-555-0000');
    });

    it('trims company field', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{ email: 'a@b.com', firstName: 'A', company: '  Acme Corp  ' }]);
      expect(spy.mock.calls[0][0].company).toBe('Acme Corp');
    });

    it('omits company when not provided', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{ email: 'a@b.com', firstName: 'A' }]);
      expect(spy.mock.calls[0][0].company).toBeUndefined();
    });

    it('omits lastName from name object when not provided', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{ email: 'a@b.com', firstName: 'A' }]);
      expect(spy.mock.calls[0][0].name).toEqual({ first: 'A' });
      expect(spy.mock.calls[0][0].name.last).toBeUndefined();
    });

    it('normalizes mixed-case email to lowercase', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      await importContacts([{ email: 'User@EXAMPLE.COM', firstName: 'U' }]);
      expect(spy.mock.calls[0][0].emails[0].email).toBe('user@example.com');
    });
  });

  describe('importContacts — dryRun edge cases', () => {
    it('dryRun skips API even with label', async () => {
      const spy = vi.spyOn(contacts, 'appendOrCreateContact');
      const result = await importContacts(
        [{ email: 'a@b.com', firstName: 'A' }],
        { dryRun: true, label: 'Test Label' }
      );
      expect(spy).not.toHaveBeenCalled();
      expect(result.dryRun).toBe(true);
      expect(result.wouldCreate).toBe(1);
    });

    it('dryRun with all-invalid contacts reports zero wouldCreate', async () => {
      const result = await importContacts(
        [{ email: '', firstName: '' }],
        { dryRun: true }
      );
      expect(result.wouldCreate).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });
});
