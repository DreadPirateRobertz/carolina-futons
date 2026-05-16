/**
 * cf-44qt sibling — testimonialService.web.js observability cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));

import {
  __reset as resetData,
  __setQueryError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — testimonialService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getFeaturedTestimonials wires logError on Testimonials query throw', async () => {
    __setQueryError('Testimonials', new Error('wixData failure'));
    const mod = await import('../src/backend/testimonialService.web.js');
    await mod.getFeaturedTestimonials();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/testimonialService/);
    expect(allTags).toMatch(/getFeaturedTestimonials/);
  });

  it('getTestimonialsByCategory wires logError on Testimonials query throw', async () => {
    __setQueryError('Testimonials', new Error('wixData failure'));
    const mod = await import('../src/backend/testimonialService.web.js');
    await mod.getTestimonialsByCategory('futons');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/testimonialService/);
    expect(allTags).toMatch(/getTestimonialsByCategory/);
  });

  it('getMyTestimonials wires logError on Testimonials query throw', async () => {
    __setQueryError('Testimonials', new Error('wixData failure'));
    const mod = await import('../src/backend/testimonialService.web.js');
    await mod.getMyTestimonials();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/testimonialService/);
    expect(allTags).toMatch(/getMyTestimonials/);
  });

  it('getPendingTestimonials wires logError on Testimonials query throw', async () => {
    __setQueryError('Testimonials', new Error('wixData failure'));
    const mod = await import('../src/backend/testimonialService.web.js');
    await mod.getPendingTestimonials();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/testimonialService/);
    expect(allTags).toMatch(/getPendingTestimonials/);
  });
});
