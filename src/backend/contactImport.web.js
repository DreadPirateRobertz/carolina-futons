/**
 * @module contactImport
 * @description Bulk contact import via Wix CRM API.
 * Imports contacts from a JSON array using appendOrCreateContact
 * (handles deduplication by email). Supports dry-run mode and
 * optional label assignment.
 *
 * @requires wix-web-module
 * @requires wix-crm-backend
 */
import { Permissions, webMethod } from 'wix-web-module';
import { contacts } from 'wix-crm-backend';

const VALID_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Schema describing expected contact fields.
 */
export const CONTACT_SCHEMA = {
  required: ['email', 'firstName'],
  optional: ['lastName', 'phone', 'company', 'lifetimeSpend', 'loyaltyTier'],
};

/**
 * Validate a single contact record.
 * @param {Object} contact - Contact data to validate.
 * @returns {string[]} Array of error messages (empty if valid).
 */
export function validateContact(contact) {
  const errors = [];

  if (typeof contact.email !== 'string' || !contact.email.trim()) {
    errors.push('Missing required field: email');
  } else if (!EMAIL_RE.test(contact.email.trim())) {
    errors.push('Invalid email format');
  }

  if (typeof contact.firstName !== 'string' || !contact.firstName.trim()) {
    errors.push('Missing required field: firstName');
  }

  if (contact.lifetimeSpend !== undefined && contact.lifetimeSpend !== null) {
    if (typeof contact.lifetimeSpend !== 'number' || contact.lifetimeSpend < 0) {
      errors.push('lifetimeSpend must be a non-negative number');
    }
  }

  if (contact.loyaltyTier !== undefined && contact.loyaltyTier !== null) {
    if (!VALID_TIERS.includes(contact.loyaltyTier)) {
      errors.push(`Invalid loyaltyTier: must be one of ${VALID_TIERS.join(', ')}`);
    }
  }

  return errors;
}

/**
 * Build a Wix CRM contact info object from import data.
 * @param {Object} contact - Validated contact record.
 * @param {Object} [options] - Import options.
 * @param {string} [options.label] - Label to assign to imported contacts.
 * @returns {Object} Wix CRM contact info for appendOrCreateContact.
 */
function buildContactInfo(contact, options = {}) {
  const email = contact.email.trim().toLowerCase();
  const info = {
    emails: [{ email }],
    name: {
      first: contact.firstName.trim(),
      ...(contact.lastName ? { last: contact.lastName.trim() } : {}),
    },
  };

  if (contact.phone) {
    info.phones = [{ phone: contact.phone.trim() }];
  }

  if (contact.company) {
    info.company = contact.company.trim();
  }

  if (options.label) {
    info.labelKeys = [options.label];
  }

  return info;
}

/**
 * Import contacts from a JSON array into Wix CRM.
 * Uses appendOrCreateContact for deduplication (existing emails are skipped).
 *
 * @function importContacts
 * @param {Array<Object>} contactData - Array of contact records.
 * @param {Object} [options] - Import options.
 * @param {boolean} [options.dryRun=false] - Validate only, don't create contacts.
 * @param {string} [options.label] - Label to assign to all imported contacts.
 * @returns {Promise<{total: number, created: number, skipped: number, errors: Array, dryRun?: boolean, wouldCreate?: number}>}
 * @permission Admin — only site admins can bulk-import contacts.
 */
export const importContacts = webMethod(
  Permissions.Admin,
  async (contactData, options = {}) => {
    if (!Array.isArray(contactData)) {
      return { total: 0, created: 0, skipped: 0, errors: [{ error: 'Input must be an array' }] };
    }

    if (contactData.length === 0) {
      return { total: 0, created: 0, skipped: 0, errors: [] };
    }

    const result = {
      total: contactData.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    if (options.dryRun) {
      result.dryRun = true;
      result.wouldCreate = 0;
    }

    for (const contact of contactData) {
      const validationErrors = validateContact(contact);
      if (validationErrors.length > 0) {
        result.skipped++;
        result.errors.push({
          email: contact.email || '(missing)',
          error: validationErrors.join('; '),
        });
        continue;
      }

      if (options.dryRun) {
        result.wouldCreate++;
        continue;
      }

      try {
        const info = buildContactInfo(contact, options);
        await contacts.appendOrCreateContact(info);
        result.created++;
      } catch (err) {
        result.errors.push({
          email: contact.email,
          error: err.message,
        });
      }
    }

    return result;
  }
);
