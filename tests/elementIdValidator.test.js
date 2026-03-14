/**
 * Tests for public/elementIdValidator.js
 * Pure function tests — no mocking needed.
 */
import { describe, it, expect } from 'vitest';
import {
  extractElementIds,
  validateElementId,
  validatePageIds,
} from '../src/public/elementIdValidator.js';

// ── extractElementIds ──────────────────────────────────────────────────

describe('extractElementIds', () => {
  it('extracts $w single-quoted IDs', () => {
    const source = `$w('#myButton').onClick(() => {});`;
    expect(extractElementIds(source)).toEqual(['myButton']);
  });

  it('extracts $w double-quoted IDs', () => {
    const source = `$w("#myText").text = 'hello';`;
    expect(extractElementIds(source)).toEqual(['myText']);
  });

  it('extracts multiple unique IDs', () => {
    const source = `
      $w('#header').show();
      $w('#footer').hide();
      $w('#header').text = 'test';
    `;
    const ids = extractElementIds(source);
    expect(ids).toContain('header');
    expect(ids).toContain('footer');
    expect(ids).toHaveLength(2); // deduped
  });

  it('extracts elementId config pattern', () => {
    const source = `const config = { elementId: '#saleRepeater' };`;
    expect(extractElementIds(source)).toEqual(['saleRepeater']);
  });

  it('extracts IDs with underscores (for validation to catch)', () => {
    const source = `$w('#my_element').show();`;
    expect(extractElementIds(source)).toEqual(['my_element']);
  });

  it('returns empty array for non-string input', () => {
    expect(extractElementIds(null)).toEqual([]);
    expect(extractElementIds(undefined)).toEqual([]);
    expect(extractElementIds(123)).toEqual([]);
  });

  it('returns empty array for source with no $w calls', () => {
    const source = `const x = 5; console.log('hello');`;
    expect(extractElementIds(source)).toEqual([]);
  });

  it('handles mixed patterns in same source', () => {
    const source = `
      $w('#productName').text = name;
      const opts = { elementId: '#priceDisplay' };
    `;
    const ids = extractElementIds(source);
    expect(ids).toContain('productName');
    expect(ids).toContain('priceDisplay');
  });
});

// ── validateElementId ──────────────────────────────────────────────────

describe('validateElementId', () => {
  it('accepts valid camelCase ID', () => {
    expect(validateElementId('productName')).toEqual({ valid: true });
  });

  it('accepts valid PascalCase ID', () => {
    expect(validateElementId('ProductCard')).toEqual({ valid: true });
  });

  it('accepts single letter', () => {
    expect(validateElementId('x')).toEqual({ valid: true });
  });

  it('accepts letters followed by numbers', () => {
    expect(validateElementId('section2')).toEqual({ valid: true });
  });

  it('rejects empty string', () => {
    const result = validateElementId('');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty');
  });

  it('rejects null/undefined', () => {
    expect(validateElementId(null).valid).toBe(false);
    expect(validateElementId(undefined).valid).toBe(false);
  });

  it('rejects ID with # prefix', () => {
    const result = validateElementId('#myButton');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('#');
  });

  it('rejects ID starting with number', () => {
    const result = validateElementId('1stButton');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('start with a letter');
  });

  it('rejects ID with underscores', () => {
    const result = validateElementId('my_element');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('alphanumeric');
  });

  it('rejects ID with hyphens', () => {
    const result = validateElementId('my-element');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('alphanumeric');
  });

  it('rejects ID with spaces', () => {
    const result = validateElementId('my element');
    expect(result.valid).toBe(false);
  });
});

// ── validatePageIds ────────────────────────────────────────────────────

describe('validatePageIds', () => {
  it('returns valid for page with all valid IDs', () => {
    const source = `
      $w('#headerTitle').text = 'Hello';
      $w('#mainButton').onClick(() => {});
    `;
    const result = validatePageIds(source, 'Home.js');
    expect(result.valid).toBe(true);
    expect(result.pageName).toBe('Home.js');
    expect(result.totalIds).toBe(2);
    expect(result.invalidIds).toHaveLength(0);
  });

  it('reports invalid IDs', () => {
    const source = `
      $w('#good_id').show();
      $w('#1bad').hide();
    `;
    const result = validatePageIds(source, 'Broken.js');
    expect(result.valid).toBe(false);
    expect(result.invalidIds.length).toBeGreaterThan(0);
    expect(result.invalidIds.some(i => i.id === 'good_id')).toBe(true);
  });

  it('returns valid for source with no IDs', () => {
    const result = validatePageIds('const x = 1;', 'Empty.js');
    expect(result.valid).toBe(true);
    expect(result.totalIds).toBe(0);
  });

  it('counts total IDs correctly (deduped)', () => {
    const source = `
      $w('#btn').show();
      $w('#btn').hide();
      $w('#label').text = '';
    `;
    const result = validatePageIds(source, 'Page.js');
    expect(result.totalIds).toBe(2);
  });
});
