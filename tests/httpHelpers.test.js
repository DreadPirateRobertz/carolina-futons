import { describe, it, expect } from 'vitest';
import {
  timingSafeEqual,
  decodeHtmlEntities,
  stripHtmlSafe,
  escapeXml,
} from '../src/backend/utils/httpHelpers.js';

// ── timingSafeEqual ─────────────────────────────────────────────────

describe('timingSafeEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('secret123', 'secret123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(timingSafeEqual('secret123', 'secret124')).toBe(false);
  });

  it('returns false for different length strings', () => {
    expect(timingSafeEqual('short', 'longer-string')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(timingSafeEqual('', 'notempty')).toBe(false);
  });

  it('returns true for both empty', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('returns false for non-string inputs', () => {
    expect(timingSafeEqual(null, 'test')).toBe(false);
    expect(timingSafeEqual('test', undefined)).toBe(false);
    expect(timingSafeEqual(123, 123)).toBe(false);
    expect(timingSafeEqual(null, null)).toBe(false);
  });

  it('handles unicode strings', () => {
    expect(timingSafeEqual('café', 'café')).toBe(true);
    expect(timingSafeEqual('café', 'cafe')).toBe(false);
  });
});

// ── decodeHtmlEntities ──────────────────────────────────────────────

describe('decodeHtmlEntities', () => {
  it('decodes numeric entities', () => {
    expect(decodeHtmlEntities('&#60;script&#62;')).toBe('<script>');
  });

  it('decodes hex entities', () => {
    expect(decodeHtmlEntities('&#x3c;script&#x3e;')).toBe('<script>');
  });

  it('decodes named entities', () => {
    expect(decodeHtmlEntities('&lt;div&gt;&amp;&quot;&apos;')).toBe('<div>&"\'');
  });

  it('decodes &#039; apostrophe variant', () => {
    expect(decodeHtmlEntities("it&#039;s")).toBe("it's");
  });

  it('returns empty string for falsy input', () => {
    expect(decodeHtmlEntities('')).toBe('');
    expect(decodeHtmlEntities(null)).toBe('');
    expect(decodeHtmlEntities(undefined)).toBe('');
  });

  it('passes through plain text unchanged', () => {
    expect(decodeHtmlEntities('Hello World')).toBe('Hello World');
  });

  it('handles mixed entities and plain text', () => {
    expect(decodeHtmlEntities('Price: &lt;$500 &amp; free shipping')).toBe('Price: <$500 & free shipping');
  });
});

// ── stripHtmlSafe ───────────────────────────────────────────────────

describe('stripHtmlSafe', () => {
  it('strips simple HTML tags', () => {
    expect(stripHtmlSafe('<p>Hello</p>')).toBe('Hello');
  });

  it('strips nested tags', () => {
    expect(stripHtmlSafe('<div><b>Bold</b> text</div>')).toBe('Bold text');
  });

  it('strips entity-encoded tags (double-encoded XSS defense)', () => {
    expect(stripHtmlSafe('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('alert(1)');
  });

  it('returns empty string for falsy input', () => {
    expect(stripHtmlSafe('')).toBe('');
    expect(stripHtmlSafe(null)).toBe('');
    expect(stripHtmlSafe(undefined)).toBe('');
  });

  it('handles mixed content', () => {
    const input = '<p>Solid hardwood &amp; certified foam</p>';
    expect(stripHtmlSafe(input)).toBe('Solid hardwood & certified foam');
  });

  it('handles self-closing tags', () => {
    expect(stripHtmlSafe('Line 1<br/>Line 2')).toBe('Line 1Line 2');
  });
});

// ── escapeXml ───────────────────────────────────────────────────────

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('A & B')).toBe('A &amp; B');
  });

  it('escapes angle brackets', () => {
    expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeXml('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  it('escapes apostrophes', () => {
    expect(escapeXml("it's")).toBe("it&apos;s");
  });

  it('escapes all special chars together', () => {
    expect(escapeXml('<a href="url">A & B\'s</a>')).toBe(
      '&lt;a href=&quot;url&quot;&gt;A &amp; B&apos;s&lt;/a&gt;'
    );
  });

  it('returns empty string for falsy input', () => {
    expect(escapeXml('')).toBe('');
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
  });

  it('passes through safe text unchanged', () => {
    expect(escapeXml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles product descriptions with special chars', () => {
    expect(escapeXml('8" Futon Mattress — Full & Queen')).toBe(
      '8&quot; Futon Mattress — Full &amp; Queen'
    );
  });
});
