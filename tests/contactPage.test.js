import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests for Contact page form validation, appointment booking validation,
// business hours display, and social proof wiring.

import {
  validateContactFields,
  getShowroomDetails,
  formatBusinessHours,
  getSocialProofSnippets,
} from '../src/public/aboutContactHelpers.js';

// ── Contact Form Validation (Page Wiring) ────────────────────────────

describe('Contact page — form validation wiring', () => {
  it('validates a complete valid submission', () => {
    const result = validateContactFields({
      name: 'Jane Smith',
      email: 'jane@example.com',
      message: 'I want to learn about your Murphy beds.',
      phone: '(828) 555-0100',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects submission with missing name', () => {
    const result = validateContactFields({
      name: '',
      email: 'jane@example.com',
      message: 'Question about hours',
    });
    expect(result.valid).toBe(false);
    const nameError = result.errors.find(e => e.field === 'name');
    expect(nameError).toBeTruthy();
  });

  it('rejects submission with invalid email', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'not-valid',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    const emailError = result.errors.find(e => e.field === 'email');
    expect(emailError).toBeTruthy();
    expect(emailError.message).toMatch(/email/i);
  });

  it('rejects submission with missing message', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@example.com',
      message: '',
    });
    expect(result.valid).toBe(false);
    const msgError = result.errors.find(e => e.field === 'message');
    expect(msgError).toBeTruthy();
  });

  it('returns all errors when multiple fields invalid', () => {
    const result = validateContactFields({
      name: '',
      email: '',
      message: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    const fields = result.errors.map(e => e.field);
    expect(fields).toContain('name');
    expect(fields).toContain('email');
    expect(fields).toContain('message');
  });

  it('maps validation errors to field-specific error elements', () => {
    const errorMap = {
      name: '#contactNameError',
      email: '#contactEmailError',
      message: '#contactMessageError',
      phone: '#contactPhoneError',
    };

    const result = validateContactFields({
      name: '',
      email: 'bad',
      message: '',
      phone: 'abc',
    });

    for (const err of result.errors) {
      expect(errorMap[err.field]).toBeTruthy();
    }
  });

  it('rejects script injection in name', () => {
    const result = validateContactFields({
      name: '<img src=x onerror=alert(1)>',
      email: 'test@test.com',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find(e => e.field === 'name')).toBeTruthy();
  });

  it('rejects extremely long message', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@test.com',
      message: 'x'.repeat(5001),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find(e => e.field === 'message').message).toMatch(/5,?000/);
  });
});

// ── Appointment Booking Validation ───────────────────────────────────

describe('Contact page — appointment email validation', () => {
  it('validates appointment email via validateContactFields', () => {
    // Contact.js uses validateContactFields with placeholder message
    // to check email validity for appointment booking
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@example.com',
      message: 'placeholder',
    });
    expect(result.valid).toBe(true);
    expect(result.errors.some(e => e.field === 'email')).toBe(false);
  });

  it('catches invalid appointment email', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'not-an-email',
      message: 'placeholder',
    });
    expect(result.errors.some(e => e.field === 'email')).toBe(true);
  });

  it('catches empty appointment email', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: '',
      message: 'placeholder',
    });
    expect(result.errors.some(e => e.field === 'email')).toBe(true);
  });
});

// ── Business Hours Display ──────────────────────────────────────────

describe('Contact page — business hours display', () => {
  it('provides today status text for display', () => {
    const hours = formatBusinessHours();
    expect(typeof hours.todayStatus).toBe('string');
    expect(hours.todayStatus.length).toBeGreaterThan(0);
  });

  it('schedule maps to hours repeater data with _id', () => {
    const hours = formatBusinessHours();
    const repeaterData = hours.schedule.map((h, i) => ({ ...h, _id: `hr-${i}` }));
    expect(repeaterData).toHaveLength(7);
    for (const item of repeaterData) {
      expect(item._id).toMatch(/^hr-/);
      expect(item.day).toBeTruthy();
      expect(item.time).toBeTruthy();
    }
  });

  it('open days show hours, closed days show Closed', () => {
    const hours = formatBusinessHours();
    for (const entry of hours.schedule) {
      if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(entry.day)) {
        expect(entry.time).toMatch(/AM.*PM/);
      } else {
        expect(entry.time).toBe('Closed');
      }
    }
  });
});

// ── Contact Page Business Info ──────────────────────────────────────

describe('Contact page — business info display', () => {
  it('showroom details provide tel link for click-to-call', () => {
    const details = getShowroomDetails();
    expect(details.telLink).toBe('tel:+18282529449');
  });

  it('showroom features map to feature list repeater', () => {
    const details = getShowroomDetails();
    const repeaterData = details.features.map((f, i) => ({ _id: `cf-${i}`, text: f }));
    expect(repeaterData.length).toBeGreaterThanOrEqual(3);
    for (const item of repeaterData) {
      expect(item.text.length).toBeGreaterThan(0);
    }
  });
});

// ── Contact Page Social Proof ───────────────────────────────────────

describe('Contact page — social proof', () => {
  it('testimonials map to contact testimonials repeater', () => {
    const snippets = getSocialProofSnippets();
    const repeaterData = snippets.map((s, i) => ({ ...s, _id: `ct-${i}` }));
    for (const item of repeaterData) {
      expect(item._id).toMatch(/^ct-/);
      expect(item.quote).toBeTruthy();
      expect(item.author).toBeTruthy();
      expect(item.rating).toBeGreaterThanOrEqual(4);
    }
  });

  it('quoted text is formatted with quotation marks for display', () => {
    const snippets = getSocialProofSnippets();
    for (const s of snippets) {
      const formatted = `"${s.quote}"`;
      expect(formatted).toMatch(/^"/);
      expect(formatted).toMatch(/"$/);
    }
  });

  it('author is formatted with em dash prefix for display', () => {
    const snippets = getSocialProofSnippets();
    for (const s of snippets) {
      const formatted = `— ${s.author}`;
      expect(formatted).toMatch(/^—/);
    }
  });
});
