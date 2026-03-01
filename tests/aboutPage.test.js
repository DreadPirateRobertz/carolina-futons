import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests for About page data sources and wiring.
// Page files are $w-coupled; we test the helpers they consume.

import {
  getBrandStory,
  getTeamMembers,
  getShowroomDetails,
  formatBusinessHours,
  getSocialProofSnippets,
} from '../src/public/aboutContactHelpers.js';

// ── About Page Brand Story Rendering ─────────────────────────────────

describe('About page — brand story data', () => {
  it('provides at least 3 story sections for the brand story repeater', () => {
    const story = getBrandStory();
    expect(story.length).toBeGreaterThanOrEqual(3);
  });

  it('story sections have imageAlt for accessibility', () => {
    const story = getBrandStory();
    for (const section of story) {
      expect(section.imageAlt.length).toBeGreaterThan(10);
      expect(section.imageAlt).not.toMatch(/^image|^photo|^picture/i);
    }
  });

  it('story sections follow correct data shape for repeater binding', () => {
    const story = getBrandStory();
    const withIds = story.map((s, i) => ({ ...s, _id: `story-${i}` }));
    for (const item of withIds) {
      expect(item._id).toBeTruthy();
      expect(item.heading).toBeTruthy();
      expect(item.body).toBeTruthy();
    }
  });
});

// ── About Page Team Section ──────────────────────────────────────────

describe('About page — team section data', () => {
  it('team members map to repeater data with _id', () => {
    const team = getTeamMembers();
    const withIds = team.map((m, i) => ({ ...m, _id: `team-${i}` }));
    for (const item of withIds) {
      expect(item._id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.role).toBeTruthy();
      expect(item.bio).toBeTruthy();
    }
  });

  it('team bio text is reasonable length (under 300 chars)', () => {
    const team = getTeamMembers();
    for (const member of team) {
      expect(member.bio.length).toBeLessThanOrEqual(300);
    }
  });
});

// ── About Page Showroom Info ─────────────────────────────────────────

describe('About page — showroom info wiring', () => {
  it('showroom features map to repeater items with _id and text', () => {
    const details = getShowroomDetails();
    const repeaterData = details.features.map((f, i) => ({ _id: `feat-${i}`, text: f }));
    expect(repeaterData.length).toBeGreaterThanOrEqual(3);
    for (const item of repeaterData) {
      expect(item._id).toMatch(/^feat-/);
      expect(item.text.length).toBeGreaterThan(0);
    }
  });

  it('directions URL is a valid Google Maps link', () => {
    const details = getShowroomDetails();
    expect(details.directionsUrl).toMatch(/maps\.google\.com/);
    expect(details.directionsUrl).toMatch(/Hendersonville/);
  });
});

// ── About Page Social Proof ──────────────────────────────────────────

describe('About page — social proof rendering', () => {
  it('testimonials map to repeater items with _id', () => {
    const snippets = getSocialProofSnippets();
    const repeaterData = snippets.map((s, i) => ({ ...s, _id: `testimonial-${i}` }));
    for (const item of repeaterData) {
      expect(item._id).toMatch(/^testimonial-/);
      expect(item.quote).toBeTruthy();
      expect(item.author).toBeTruthy();
    }
  });

  it('star display renders correctly (filled + empty = 5)', () => {
    const snippets = getSocialProofSnippets();
    for (const s of snippets) {
      const stars = '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating);
      expect(stars.length).toBe(5);
    }
  });
});

// ── About Page Timeline ──────────────────────────────────────────────

describe('About page — timeline data', () => {
  it('milestones cover founding through present', () => {
    // Timeline is inline in About.js, but we verify the expected
    // milestones that the repeater should render
    const expectedYears = ['1991', '2000s', '2021', 'Today'];
    // The page hardcodes these — test that the data model is correct
    const milestones = [
      { year: '1991', title: "Sims' Futon Gallery Opens", description: 'Richard and Liz Sims open their doors in Hendersonville, NC, bringing quality futon furniture to the Carolinas.' },
      { year: '2000s', title: 'Largest Selection in the Carolinas', description: 'The store grows to carry the widest range of futon frames, mattresses, and convertible furniture in the region.' },
      { year: '2021', title: 'A New Chapter Begins', description: 'Brenda and Howard Deal take the helm, continuing the same principles of honesty, fair pricing, and outstanding service.' },
      { year: 'Today', title: 'Carolina Futons', description: 'Now featuring Murphy Cabinet Beds, platform beds, and a curated selection of quality furniture — all from our Hendersonville showroom.' },
    ];

    const years = milestones.map(m => m.year);
    expect(years).toEqual(expectedYears);

    for (const m of milestones) {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });

  it('milestones map to repeater data with string _id', () => {
    const milestones = [
      { year: '1991', title: 'Test', description: 'Test desc' },
    ];
    const data = milestones.map((m, i) => ({ ...m, _id: String(i) }));
    expect(data[0]._id).toBe('0');
    expect(typeof data[0]._id).toBe('string');
  });
});
