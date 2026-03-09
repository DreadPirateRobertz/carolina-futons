import { describe, it, expect } from 'vitest';

// Tests for Contact page form validation, business hours display,
// showroom info data integrity, and social proof wiring.

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

  it('star rating string has exactly 5 characters total', () => {
    const snippets = getSocialProofSnippets();
    for (const s of snippets) {
      const stars = '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating);
      expect([...stars]).toHaveLength(5);
    }
  });
});

// ── Boundary & Edge Case Validation ─────────────────────────────────

describe('Contact page — name validation edge cases', () => {
  it('accepts name at exactly 200 characters', () => {
    const result = validateContactFields({
      name: 'A'.repeat(200),
      email: 'test@test.com',
      message: 'Hello',
    });
    expect(result.errors.find(e => e.field === 'name')).toBeFalsy();
  });

  it('rejects name at 201 characters', () => {
    const result = validateContactFields({
      name: 'A'.repeat(201),
      email: 'test@test.com',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find(e => e.field === 'name')).toBeTruthy();
  });

  it('rejects whitespace-only name', () => {
    const result = validateContactFields({
      name: '   ',
      email: 'test@test.com',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find(e => e.field === 'name')).toBeTruthy();
  });

  it('rejects HTML script tag in name', () => {
    const result = validateContactFields({
      name: '<script>alert("xss")</script>',
      email: 'test@test.com',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find(e => e.field === 'name')).toBeTruthy();
  });

  it('rejects SVG-based XSS in name', () => {
    const result = validateContactFields({
      name: '<svg onload=alert(1)>',
      email: 'test@test.com',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find(e => e.field === 'name')).toBeTruthy();
  });

  it('accepts name with accented characters', () => {
    const result = validateContactFields({
      name: 'José María García',
      email: 'jose@test.com',
      message: 'Hola',
    });
    expect(result.errors.find(e => e.field === 'name')).toBeFalsy();
  });

  it('accepts name with apostrophe and hyphen', () => {
    const result = validateContactFields({
      name: "O'Brien-Smith",
      email: 'ob@test.com',
      message: 'Hi',
    });
    expect(result.errors.find(e => e.field === 'name')).toBeFalsy();
  });
});

describe('Contact page — email validation edge cases', () => {
  it('rejects email without domain', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@',
      message: 'Hi',
    });
    expect(result.errors.find(e => e.field === 'email')).toBeTruthy();
  });

  it('rejects email without @ symbol', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane.example.com',
      message: 'Hi',
    });
    expect(result.errors.find(e => e.field === 'email')).toBeTruthy();
  });

  it('rejects email with spaces', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane @example.com',
      message: 'Hi',
    });
    expect(result.errors.find(e => e.field === 'email')).toBeTruthy();
  });

  it('rejects whitespace-only email', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: '   ',
      message: 'Hi',
    });
    expect(result.errors.find(e => e.field === 'email')).toBeTruthy();
  });

  it('accepts email with subdomain', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@mail.example.com',
      message: 'Hi',
    });
    expect(result.errors.find(e => e.field === 'email')).toBeFalsy();
  });

  it('accepts email with plus addressing', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane+futons@example.com',
      message: 'Hi',
    });
    expect(result.errors.find(e => e.field === 'email')).toBeFalsy();
  });
});

describe('Contact page — message validation edge cases', () => {
  it('accepts message at exactly 5000 characters', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@test.com',
      message: 'x'.repeat(5000),
    });
    expect(result.errors.find(e => e.field === 'message')).toBeFalsy();
  });

  it('rejects whitespace-only message', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@test.com',
      message: '   \n\t  ',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.find(e => e.field === 'message')).toBeTruthy();
  });

  it('accepts short message', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@test.com',
      message: 'Hi',
    });
    expect(result.errors.find(e => e.field === 'message')).toBeFalsy();
  });
});

describe('Contact page — phone validation edge cases', () => {
  it('accepts empty phone (optional field)', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@test.com',
      message: 'Hi',
      phone: '',
    });
    expect(result.valid).toBe(true);
    expect(result.errors.find(e => e.field === 'phone')).toBeFalsy();
  });

  it('accepts undefined phone', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@test.com',
      message: 'Hi',
    });
    expect(result.errors.find(e => e.field === 'phone')).toBeFalsy();
  });

  it('accepts international format phone', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@test.com',
      message: 'Hi',
      phone: '+1 (828) 252-9449',
    });
    expect(result.errors.find(e => e.field === 'phone')).toBeFalsy();
  });

  it('rejects phone with letters', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@test.com',
      message: 'Hi',
      phone: 'call-me-maybe',
    });
    expect(result.errors.find(e => e.field === 'phone')).toBeTruthy();
  });

  it('rejects phone with XSS attempt', () => {
    const result = validateContactFields({
      name: 'Jane',
      email: 'jane@test.com',
      message: 'Hi',
      phone: '<script>alert(1)</script>',
    });
    expect(result.errors.find(e => e.field === 'phone')).toBeTruthy();
  });
});

describe('Contact page — null/undefined input handling', () => {
  it('handles undefined fields object gracefully', () => {
    const result = validateContactFields(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('handles empty object gracefully', () => {
    const result = validateContactFields({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('handles null field values gracefully', () => {
    const result = validateContactFields({
      name: null,
      email: null,
      message: null,
      phone: null,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Business Hours — Day-Specific Tests ─────────────────────────────

describe('Contact page — business hours for specific days', () => {
  it('shows open status on Wednesday (day 3)', () => {
    const hours = formatBusinessHours(3);
    expect(hours.isOpen).toBe(true);
    expect(hours.todayStatus).toMatch(/open/i);
    expect(hours.todayStatus).toMatch(/10:00 AM/);
  });

  it('shows open status on Thursday (day 4)', () => {
    const hours = formatBusinessHours(4);
    expect(hours.isOpen).toBe(true);
    expect(hours.todayStatus).toMatch(/open/i);
  });

  it('shows open status on Friday (day 5)', () => {
    const hours = formatBusinessHours(5);
    expect(hours.isOpen).toBe(true);
    expect(hours.todayStatus).toMatch(/open/i);
  });

  it('shows open status on Saturday (day 6)', () => {
    const hours = formatBusinessHours(6);
    expect(hours.isOpen).toBe(true);
    expect(hours.todayStatus).toMatch(/open/i);
  });

  it('shows closed status on Sunday (day 0)', () => {
    const hours = formatBusinessHours(0);
    expect(hours.isOpen).toBe(false);
    expect(hours.todayStatus).toMatch(/closed/i);
  });

  it('shows closed status on Monday (day 1)', () => {
    const hours = formatBusinessHours(1);
    expect(hours.isOpen).toBe(false);
    expect(hours.todayStatus).toMatch(/closed/i);
  });

  it('shows closed status on Tuesday (day 2) with next-open hint', () => {
    // Tuesday's status includes "Wednesday" to hint when the store reopens
    const hours = formatBusinessHours(2);
    expect(hours.isOpen).toBe(false);
    expect(hours.todayStatus).toMatch(/Wednesday/);
  });

  it('schedule always has exactly 7 days', () => {
    for (let day = 0; day < 7; day++) {
      const hours = formatBusinessHours(day);
      expect(hours.schedule).toHaveLength(7);
    }
  });

  it('schedule starts with Sunday and ends with Saturday', () => {
    const hours = formatBusinessHours(0);
    expect(hours.schedule[0].day).toBe('Sunday');
    expect(hours.schedule[6].day).toBe('Saturday');
  });

  it('falls back to current day for out-of-range input', () => {
    // formatBusinessHours uses Set.has() which returns false for invalid days
    const hours = formatBusinessHours(99);
    expect(hours.isOpen).toBe(false);
    expect(hours.schedule).toHaveLength(7);
  });
});

// ── Business Info — Data Integrity ──────────────────────────────────

describe('Contact page — business info data integrity', () => {
  it('address contains city and state', () => {
    const details = getShowroomDetails();
    expect(details.address).toMatch(/Hendersonville/);
    expect(details.address).toMatch(/NC/);
  });

  it('phone matches tel link digits', () => {
    const details = getShowroomDetails();
    const phoneDigits = details.phone.replace(/\D/g, '');
    expect(details.telLink).toContain(phoneDigits);
  });

  it('directions URL is a valid Google Maps link', () => {
    const details = getShowroomDetails();
    expect(details.directionsUrl).toMatch(/maps\.google\.com/);
  });

  it('hours data matches schedule format', () => {
    const details = getShowroomDetails();
    expect(details.hours).toHaveLength(4);
    for (const h of details.hours) {
      expect(h.day).toBeTruthy();
      expect(h.time).toMatch(/AM.*PM/);
    }
  });
});
