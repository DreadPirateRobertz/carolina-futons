import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  getBrandStory,
  getTeamMembers,
  getShowroomDetails,
  validateContactFields,
  formatBusinessHours,
  getSocialProofSnippets,
} from '../../src/public/aboutContactHelpers.js';

// ── getBrandStory ─────────────────────────────────────────────────────

describe('getBrandStory', () => {
  it('returns array of story sections', () => {
    const story = getBrandStory();
    expect(Array.isArray(story)).toBe(true);
    expect(story.length).toBeGreaterThanOrEqual(3);
  });

  it('each section has heading, body, and imageAlt', () => {
    const story = getBrandStory();
    for (const section of story) {
      expect(section).toHaveProperty('heading');
      expect(section).toHaveProperty('body');
      expect(section).toHaveProperty('imageAlt');
      expect(typeof section.heading).toBe('string');
      expect(typeof section.body).toBe('string');
      expect(typeof section.imageAlt).toBe('string');
      expect(section.heading.length).toBeGreaterThan(0);
      expect(section.body.length).toBeGreaterThan(0);
    }
  });

  it('first section covers founding story (1991)', () => {
    const story = getBrandStory();
    const first = story[0];
    expect(first.body).toMatch(/1991/);
  });

  it('includes a section about the new ownership', () => {
    const story = getBrandStory();
    const ownership = story.find(s => s.body.match(/Brenda|Deal/));
    expect(ownership).toBeTruthy();
  });

  it('includes a section about the showroom/local presence', () => {
    const story = getBrandStory();
    const local = story.find(s => s.body.match(/Hendersonville|showroom/i));
    expect(local).toBeTruthy();
  });
});

// ── getTeamMembers ────────────────────────────────────────────────────

describe('getTeamMembers', () => {
  it('returns array of team members', () => {
    const team = getTeamMembers();
    expect(Array.isArray(team)).toBe(true);
    expect(team.length).toBeGreaterThanOrEqual(1);
  });

  it('each member has name, role, and bio', () => {
    const team = getTeamMembers();
    for (const member of team) {
      expect(member).toHaveProperty('name');
      expect(member).toHaveProperty('role');
      expect(member).toHaveProperty('bio');
      expect(typeof member.name).toBe('string');
      expect(typeof member.role).toBe('string');
      expect(typeof member.bio).toBe('string');
      expect(member.name.length).toBeGreaterThan(0);
    }
  });

  it('includes Brenda as owner', () => {
    const team = getTeamMembers();
    const brenda = team.find(m => m.name.match(/Brenda/i));
    expect(brenda).toBeTruthy();
    expect(brenda.role).toMatch(/owner/i);
  });
});

// ── getShowroomDetails ────────────────────────────────────────────────

describe('getShowroomDetails', () => {
  it('returns object with address, phone, hours, and features', () => {
    const details = getShowroomDetails();
    expect(details).toHaveProperty('address');
    expect(details).toHaveProperty('phone');
    expect(details).toHaveProperty('hours');
    expect(details).toHaveProperty('features');
  });

  it('address includes Hendersonville NC', () => {
    const details = getShowroomDetails();
    expect(details.address).toMatch(/Hendersonville/);
    expect(details.address).toMatch(/NC/);
  });

  it('phone is formatted with area code', () => {
    const details = getShowroomDetails();
    expect(details.phone).toMatch(/\(\d{3}\)\s?\d{3}-\d{4}/);
  });

  it('hours is array of day/time entries', () => {
    const details = getShowroomDetails();
    expect(Array.isArray(details.hours)).toBe(true);
    expect(details.hours.length).toBeGreaterThan(0);
    for (const entry of details.hours) {
      expect(entry).toHaveProperty('day');
      expect(entry).toHaveProperty('time');
    }
  });

  it('features lists showroom amenities', () => {
    const details = getShowroomDetails();
    expect(Array.isArray(details.features)).toBe(true);
    expect(details.features.length).toBeGreaterThanOrEqual(3);
    for (const feature of details.features) {
      expect(typeof feature).toBe('string');
      expect(feature.length).toBeGreaterThan(0);
    }
  });

  it('includes directions URL', () => {
    const details = getShowroomDetails();
    expect(details).toHaveProperty('directionsUrl');
    expect(details.directionsUrl).toMatch(/^https:\/\//);
  });

  it('includes tel link for phone', () => {
    const details = getShowroomDetails();
    expect(details).toHaveProperty('telLink');
    expect(details.telLink).toMatch(/^tel:\+1/);
  });
});

// ── validateContactFields ─────────────────────────────────────────────

describe('validateContactFields', () => {
  it('returns valid for correct fields', () => {
    const result = validateContactFields({
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello, I have a question about futons.',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('requires name', () => {
    const result = validateContactFields({
      name: '',
      email: 'john@example.com',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'name' })
    );
  });

  it('requires email', () => {
    const result = validateContactFields({
      name: 'John',
      email: '',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'email' })
    );
  });

  it('rejects invalid email format', () => {
    const result = validateContactFields({
      name: 'John',
      email: 'not-an-email',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'email', message: expect.stringMatching(/email/i) })
    );
  });

  it('requires message', () => {
    const result = validateContactFields({
      name: 'John',
      email: 'john@example.com',
      message: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'message' })
    );
  });

  it('rejects message over 5000 characters', () => {
    const result = validateContactFields({
      name: 'John',
      email: 'john@example.com',
      message: 'x'.repeat(5001),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'message', message: expect.stringMatching(/5,?000/i) })
    );
  });

  it('accepts valid phone format', () => {
    const result = validateContactFields({
      name: 'John',
      email: 'john@example.com',
      message: 'Hello',
      phone: '(828) 555-1234',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects phone with letters', () => {
    const result = validateContactFields({
      name: 'John',
      email: 'john@example.com',
      message: 'Hello',
      phone: 'call me maybe',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'phone' })
    );
  });

  it('allows empty phone (optional field)', () => {
    const result = validateContactFields({
      name: 'John',
      email: 'john@example.com',
      message: 'Hello',
      phone: '',
    });
    expect(result.valid).toBe(true);
  });

  it('trims whitespace from all fields', () => {
    const result = validateContactFields({
      name: '  John  ',
      email: '  john@example.com  ',
      message: '  Hello  ',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects name over 200 characters', () => {
    const result = validateContactFields({
      name: 'A'.repeat(201),
      email: 'john@example.com',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'name' })
    );
  });

  it('handles null/undefined fields gracefully', () => {
    const result = validateContactFields({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects XSS in name field', () => {
    const result = validateContactFields({
      name: '<script>alert("xss")</script>',
      email: 'john@example.com',
      message: 'Hello',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'name', message: expect.stringMatching(/invalid/i) })
    );
  });
});

// ── formatBusinessHours ──────────────────────────────────────────────

describe('formatBusinessHours', () => {
  it('returns object with schedule and todayStatus', () => {
    const result = formatBusinessHours();
    expect(result).toHaveProperty('schedule');
    expect(result).toHaveProperty('todayStatus');
    expect(typeof result.todayStatus).toBe('string');
  });

  it('schedule covers all 7 days', () => {
    const result = formatBusinessHours();
    expect(result.schedule).toHaveLength(7);
  });

  it('Wed-Sat shows open hours', () => {
    const result = formatBusinessHours();
    const wed = result.schedule.find(d => d.day === 'Wednesday');
    const sat = result.schedule.find(d => d.day === 'Saturday');
    expect(wed.time).toMatch(/10.*5/);
    expect(sat.time).toMatch(/10.*5/);
  });

  it('Sun-Tue shows Closed', () => {
    const result = formatBusinessHours();
    const sun = result.schedule.find(d => d.day === 'Sunday');
    const mon = result.schedule.find(d => d.day === 'Monday');
    const tue = result.schedule.find(d => d.day === 'Tuesday');
    expect(sun.time).toBe('Closed');
    expect(mon.time).toBe('Closed');
    expect(tue.time).toBe('Closed');
  });

  it('returns isOpen boolean for a given day', () => {
    // Wednesday = open
    const wed = formatBusinessHours(3); // 0=Sun, 3=Wed
    expect(wed.isOpen).toBe(true);

    // Monday = closed
    const mon = formatBusinessHours(1);
    expect(mon.isOpen).toBe(false);
  });

  it('todayStatus reflects open/closed for given day', () => {
    const wed = formatBusinessHours(3);
    expect(wed.todayStatus).toMatch(/open/i);

    const mon = formatBusinessHours(1);
    expect(mon.todayStatus).toMatch(/closed/i);
  });
});

// ── getSocialProofSnippets ───────────────────────────────────────────

describe('getSocialProofSnippets', () => {
  it('returns array of testimonial snippets', () => {
    const snippets = getSocialProofSnippets();
    expect(Array.isArray(snippets)).toBe(true);
    expect(snippets.length).toBeGreaterThanOrEqual(3);
  });

  it('each snippet has quote, author, and rating', () => {
    const snippets = getSocialProofSnippets();
    for (const snippet of snippets) {
      expect(snippet).toHaveProperty('quote');
      expect(snippet).toHaveProperty('author');
      expect(snippet).toHaveProperty('rating');
      expect(typeof snippet.quote).toBe('string');
      expect(typeof snippet.author).toBe('string');
      expect(typeof snippet.rating).toBe('number');
      expect(snippet.quote.length).toBeGreaterThan(0);
      expect(snippet.rating).toBeGreaterThanOrEqual(1);
      expect(snippet.rating).toBeLessThanOrEqual(5);
    }
  });

  it('all snippets have 4 or 5 star ratings', () => {
    const snippets = getSocialProofSnippets();
    for (const snippet of snippets) {
      expect(snippet.rating).toBeGreaterThanOrEqual(4);
    }
  });

  it('snippets are concise (under 200 chars)', () => {
    const snippets = getSocialProofSnippets();
    for (const snippet of snippets) {
      expect(snippet.quote.length).toBeLessThanOrEqual(200);
    }
  });
});
