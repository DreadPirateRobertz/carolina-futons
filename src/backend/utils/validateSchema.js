/**
 * @file validateSchema.js
 * @description Declarative schema validation for anonymous endpoint inputs.
 *
 * Validates data objects against a schema definition, returning descriptive
 * errors without exposing schema internals to callers.
 *
 * Schema format:
 *   { fieldName: { type, required, maxLength, allowedValues, pattern, min, max, label } }
 *
 * @example
 *   const errors = validateSchema(data, {
 *     email: { type: 'string', required: true, maxLength: 254, label: 'Email' },
 *     phone: { type: 'string', maxLength: 20, label: 'Phone' },
 *     quantity: { type: 'number', min: 1, max: 100, label: 'Quantity' },
 *     tier: { type: 'string', allowedValues: ['basic', 'extended', 'premium'], label: 'Tier' },
 *   });
 *   if (errors.length > 0) return { success: false, error: errors[0] };
 */

/**
 * Validate a data object against a schema definition.
 *
 * @param {Object} data - Input data to validate
 * @param {Object} schema - Schema definition
 * @returns {string[]} Array of user-facing error messages (empty = valid)
 */
export function validateSchema(data, schema) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Request data is required.'];
  }

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const label = rules.label || field;

    // Required check
    if (rules.required) {
      if (value === undefined || value === null || value === '') {
        errors.push(`${label} is required.`);
        continue;
      }
    }

    // Skip optional fields that are absent
    if (value === undefined || value === null || value === '') continue;

    // Type check
    if (rules.type) {
      const actualType = typeof value;
      if (rules.type === 'string' && actualType !== 'string') {
        errors.push(`${label} must be text.`);
        continue;
      }
      if (rules.type === 'number' && (actualType !== 'number' || Number.isNaN(value))) {
        errors.push(`${label} must be a number.`);
        continue;
      }
      if (rules.type === 'boolean' && actualType !== 'boolean') {
        errors.push(`${label} must be true or false.`);
        continue;
      }
    }

    // String-specific checks
    if (typeof value === 'string') {
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push(`${label} is too long (max ${rules.maxLength} characters).`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${label} format is invalid.`);
      }
    }

    // Number-specific checks
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${label} must be at least ${rules.min}.`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${label} must be at most ${rules.max}.`);
      }
    }

    // Allowed values check
    if (rules.allowedValues && !rules.allowedValues.includes(value)) {
      errors.push(`${label} is not a valid option.`);
    }
  }

  return errors;
}
