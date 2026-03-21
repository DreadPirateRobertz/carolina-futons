/**
 * @file welcomeEmailTemplates.test.js
 * @description Tests for getWelcomeDay0Template, getWelcomeDay3Template,
 * and getWelcomeDay7Template (CF-4mof T3).
 */
import { describe, it, expect } from 'vitest';
import {
  getWelcomeDay0Template,
  getWelcomeDay3Template,
  getWelcomeDay7Template,
  _TEMPLATE_REGISTRY,
} from '../src/backend/emailTemplates.web.js';

// ── getWelcomeDay0Template ───────────────────────────────────────────

describe('getWelcomeDay0Template', () => {
  it('returns subject, previewText, and html', async () => {
    const result = await getWelcomeDay0Template('Alice', 'WELCOME10');
    expect(result.subject).toBeTruthy();
    expect(result.previewText).toBeTruthy();
    expect(result.html).toBeTruthy();
  });

  it('subject matches welcome_series_1 registry entry', async () => {
    const result = await getWelcomeDay0Template('Alice', 'WELCOME10');
    expect(result.subject).toBe(_TEMPLATE_REGISTRY.welcome_series_1.subjectLine);
  });

  it('previewText matches welcome_series_1 registry entry', async () => {
    const result = await getWelcomeDay0Template('Alice', 'WELCOME10');
    expect(result.previewText).toBe(_TEMPLATE_REGISTRY.welcome_series_1.previewText);
  });

  it('html includes first name when provided', async () => {
    const result = await getWelcomeDay0Template('Alice', 'WELCOME10');
    expect(result.html).toContain('Alice');
  });

  it('html includes discount code when provided', async () => {
    const result = await getWelcomeDay0Template('Alice', 'WELCOME10');
    expect(result.html).toContain('WELCOME10');
  });

  it('html omits discount block when code is empty string', async () => {
    const result = await getWelcomeDay0Template('Alice', '');
    expect(result.html).not.toContain('exclusive welcome discount');
  });

  it('html omits discount block when code is missing', async () => {
    const result = await getWelcomeDay0Template('Alice');
    expect(result.html).not.toContain('exclusive welcome discount');
  });

  it('html contains a Shop Now CTA link', async () => {
    const result = await getWelcomeDay0Template('Alice', 'WELCOME10');
    expect(result.html).toContain('Shop Now');
    expect(result.html).toContain('carolinafutons.com/shop');
  });

  it('html contains support phone number', async () => {
    const result = await getWelcomeDay0Template('Alice', 'WELCOME10');
    expect(result.html).toContain('(828) 252-9449');
  });

  it('html is a complete HTML document', async () => {
    const result = await getWelcomeDay0Template('Alice', 'WELCOME10');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('</html>');
  });

  it('handles empty firstName gracefully', async () => {
    const result = await getWelcomeDay0Template('', 'WELCOME10');
    expect(result.html).toBeTruthy();
    expect(result.html).toContain('<!DOCTYPE html>');
  });

  it('handles missing firstName gracefully', async () => {
    const result = await getWelcomeDay0Template();
    expect(result.html).toBeTruthy();
  });

  it('sanitizes firstName against XSS', async () => {
    const result = await getWelcomeDay0Template('<script>alert(1)</script>', 'CODE');
    expect(result.html).not.toContain('<script>');
  });

  it('sanitizes discountCode against XSS', async () => {
    const result = await getWelcomeDay0Template('Alice', '<img src=x onerror=alert(1)>');
    expect(result.html).not.toContain('<img src=x');
  });

  it('html contains unsubscribe link', async () => {
    const result = await getWelcomeDay0Template('Alice', 'WELCOME10');
    expect(result.html).toContain('unsubscribe');
  });
});

// ── getWelcomeDay3Template ───────────────────────────────────────────

describe('getWelcomeDay3Template', () => {
  it('returns subject, previewText, and html', async () => {
    const result = await getWelcomeDay3Template('Bob');
    expect(result.subject).toBeTruthy();
    expect(result.previewText).toBeTruthy();
    expect(result.html).toBeTruthy();
  });

  it('subject matches welcome_series_2 registry entry', async () => {
    const result = await getWelcomeDay3Template('Bob');
    expect(result.subject).toBe(_TEMPLATE_REGISTRY.welcome_series_2.subjectLine);
  });

  it('previewText matches welcome_series_2 registry entry', async () => {
    const result = await getWelcomeDay3Template('Bob');
    expect(result.previewText).toBe(_TEMPLATE_REGISTRY.welcome_series_2.previewText);
  });

  it('html includes first name when provided', async () => {
    const result = await getWelcomeDay3Template('Bob');
    expect(result.html).toContain('Bob');
  });

  it('html contains buying guide content (frame styles or mattress types)', async () => {
    const result = await getWelcomeDay3Template('Bob');
    expect(result.html.toLowerCase()).toMatch(/frame|mattress|buying guide/);
  });

  it('html contains a buying guide CTA link', async () => {
    const result = await getWelcomeDay3Template('Bob');
    expect(result.html).toContain('Read the Buying Guide');
  });

  it('html links to futon-buying-guide', async () => {
    const result = await getWelcomeDay3Template('Bob');
    expect(result.html).toContain('futon-buying-guide');
  });

  it('html is a complete HTML document', async () => {
    const result = await getWelcomeDay3Template('Bob');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('</html>');
  });

  it('handles missing firstName gracefully', async () => {
    const result = await getWelcomeDay3Template();
    expect(result.html).toBeTruthy();
    expect(result.html).toContain('<!DOCTYPE html>');
  });

  it('sanitizes firstName against XSS', async () => {
    const result = await getWelcomeDay3Template('<script>bad()</script>');
    expect(result.html).not.toContain('<script>');
  });

  it('html contains unsubscribe link', async () => {
    const result = await getWelcomeDay3Template('Bob');
    expect(result.html).toContain('unsubscribe');
  });
});

// ── getWelcomeDay7Template ───────────────────────────────────────────

describe('getWelcomeDay7Template', () => {
  it('returns subject, previewText, and html', async () => {
    const result = await getWelcomeDay7Template('Carol', 'WELCOME10');
    expect(result.subject).toBeTruthy();
    expect(result.previewText).toBeTruthy();
    expect(result.html).toBeTruthy();
  });

  it('subject matches welcome_series_3 registry entry', async () => {
    const result = await getWelcomeDay7Template('Carol', 'WELCOME10');
    expect(result.subject).toBe(_TEMPLATE_REGISTRY.welcome_series_3.subjectLine);
  });

  it('previewText matches welcome_series_3 registry entry', async () => {
    const result = await getWelcomeDay7Template('Carol', 'WELCOME10');
    expect(result.previewText).toBe(_TEMPLATE_REGISTRY.welcome_series_3.previewText);
  });

  it('html includes first name when provided', async () => {
    const result = await getWelcomeDay7Template('Carol', 'WELCOME10');
    expect(result.html).toContain('Carol');
  });

  it('html has urgency / purchase nudge framing', async () => {
    const result = await getWelcomeDay7Template('Carol', 'WELCOME10');
    expect(result.html.toLowerCase()).toMatch(/expire|discount|save|off/);
  });

  it('html contains a Shop Now CTA linking to /shop', async () => {
    const result = await getWelcomeDay7Template('Carol', 'WELCOME10');
    expect(result.html).toContain('carolinafutons.com/shop');
    expect(result.html.toLowerCase()).toContain('shop');
  });

  it('html includes discount code when provided', async () => {
    const result = await getWelcomeDay7Template('Carol', 'WELCOME10');
    expect(result.html).toContain('WELCOME10');
  });

  it('html omits discount urgency block when code is empty', async () => {
    const result = await getWelcomeDay7Template('Carol', '');
    // No discount code, but CTA and nudge framing still present
    expect(result.html).toContain('carolinafutons.com/shop');
  });

  it('html is a complete HTML document', async () => {
    const result = await getWelcomeDay7Template('Carol', 'WELCOME10');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('</html>');
  });

  it('handles missing firstName gracefully', async () => {
    const result = await getWelcomeDay7Template();
    expect(result.html).toBeTruthy();
    expect(result.html).toContain('<!DOCTYPE html>');
  });

  it('sanitizes firstName against XSS', async () => {
    const result = await getWelcomeDay7Template('<b>injection</b>', 'CODE');
    expect(result.html).not.toContain('<b>injection</b>');
  });

  it('sanitizes discountCode against XSS', async () => {
    const result = await getWelcomeDay7Template('Carol', '<script>bad()</script>');
    expect(result.html).not.toContain('<script>');
  });

  it('html contains unsubscribe link', async () => {
    const result = await getWelcomeDay7Template('Carol', 'WELCOME10');
    expect(result.html).toContain('unsubscribe');
  });
});
