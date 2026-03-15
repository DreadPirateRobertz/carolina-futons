import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks – declared BEFORE any page import                           */
/* ------------------------------------------------------------------ */

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn(() => Promise.resolve('{}')),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
}));

vi.mock('public/AboutIllustrations.js', () => ({
  initAboutIllustrations: vi.fn(),
}));

vi.mock('public/aboutContactHelpers.js', () => ({
  getBrandStory: vi.fn(() => [{ heading: 'H1', body: 'B1', imageAlt: 'Alt1' }]),
  getTeamMembers: vi.fn(() => [{ name: 'Alice', role: 'Manager', bio: 'Bio' }]),
  getShowroomDetails: vi.fn(() => ({
    address: '824 Locust St',
    phone: '(828) 252-9449',
    features: ['Free parking'],
    directionsUrl: 'https://maps.google.com',
  })),
  formatBusinessHours: vi.fn(() => ({ todayStatus: 'Open until 6pm' })),
  getSocialProofSnippets: vi.fn(() => [{ quote: 'Great!', author: 'Bob', rating: 5 }]),
}));

vi.mock('wix-location-frontend', () => ({ to: vi.fn() }));
vi.mock('wix-window-frontend', () => ({ openUrl: vi.fn() }));

/* ------------------------------------------------------------------ */
/*  $w mock                                                           */
/* ------------------------------------------------------------------ */

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

/* ------------------------------------------------------------------ */
/*  Import mock references + page                                     */
/* ------------------------------------------------------------------ */

let getBusinessSchema;
let initPageSeo;
let trackEvent;
let initBackToTop;
let makeClickable;
let initAboutIllustrations;
let getBrandStory, getTeamMembers, getShowroomDetails, formatBusinessHours, getSocialProofSnippets;

beforeAll(async () => {
  ({ getBusinessSchema } = await import('backend/seoHelpers.web'));
  ({ initPageSeo } = await import('public/pageSeo.js'));
  ({ trackEvent } = await import('public/engagementTracker'));
  ({ initBackToTop } = await import('public/mobileHelpers'));
  ({ makeClickable } = await import('public/a11yHelpers.js'));
  ({ initAboutIllustrations } = await import('public/AboutIllustrations.js'));
  ({ getBrandStory, getTeamMembers, getShowroomDetails, formatBusinessHours, getSocialProofSnippets } =
    await import('public/aboutContactHelpers.js'));
  await import('../src/pages/About.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  getBusinessSchema.mockReturnValue(Promise.resolve('{}'));
  getBrandStory.mockReturnValue([{ heading: 'H1', body: 'B1', imageAlt: 'Alt1' }]);
  getTeamMembers.mockReturnValue([{ name: 'Alice', role: 'Manager', bio: 'Bio' }]);
  getShowroomDetails.mockReturnValue({
    address: '824 Locust St',
    phone: '(828) 252-9449',
    features: ['Free parking'],
    directionsUrl: 'https://maps.google.com',
  });
  formatBusinessHours.mockReturnValue({ todayStatus: 'Open until 6pm' });
  getSocialProofSnippets.mockReturnValue([{ quote: 'Great!', author: 'Bob', rating: 5 }]);
});

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('About Page', () => {
  /* 1 — initPageSeo */
  describe('SEO initialization', () => {
    it('calls initPageSeo with "about"', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('about');
    });
  });

  /* 2 — trackEvent */
  describe('analytics', () => {
    it('tracks page_view event with page: "about"', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'about' });
    });
  });

  /* 3 — initBackToTop */
  describe('mobile helpers', () => {
    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });
  });

  /* 4 — page heading */
  describe('page heading', () => {
    it('sets #aboutTitle to "Our Story"', async () => {
      await onReadyHandler();
      expect(getEl('#aboutTitle').text).toBe('Our Story');
    });

    it('sets #aboutSubtitle with expected text', async () => {
      await onReadyHandler();
      expect(getEl('#aboutSubtitle').text).toContain('Family-owned since 1991');
    });
  });

  /* 5 — brand story repeater */
  describe('brand story', () => {
    it('sets #brandStoryRepeater data from getBrandStory', async () => {
      await onReadyHandler();
      const repeater = getEl('#brandStoryRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0]).toMatchObject({ heading: 'H1', body: 'B1', imageAlt: 'Alt1' });
      expect(repeater.data[0]._id).toBe('story-0');
    });

    it('sets #brandStoryRepeater ARIA label', async () => {
      await onReadyHandler();
      expect(getEl('#brandStoryRepeater').accessibility.ariaLabel).toBe('Our brand story');
    });

    it('onItemReady sets #storyHeading, #storyBody, and #storyImage alt', async () => {
      await onReadyHandler();
      const repeater = getEl('#brandStoryRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, { heading: 'H1', body: 'B1', imageAlt: 'Alt1' });

      expect(itemElements.get('#storyHeading').text).toBe('H1');
      expect(itemElements.get('#storyBody').text).toBe('B1');
      expect(itemElements.get('#storyImage').alt).toBe('Alt1');
    });
  });

  /* 6 — team repeater */
  describe('team section', () => {
    it('sets #teamRepeater data from getTeamMembers', async () => {
      await onReadyHandler();
      const repeater = getEl('#teamRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0]).toMatchObject({ name: 'Alice', role: 'Manager', bio: 'Bio' });
      expect(repeater.data[0]._id).toBe('team-0');
    });

    it('onItemReady sets #teamName, #teamRole, #teamBio', async () => {
      await onReadyHandler();
      const repeater = getEl('#teamRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, { name: 'Alice', role: 'Manager', bio: 'Bio' });

      expect(itemElements.get('#teamName').text).toBe('Alice');
      expect(itemElements.get('#teamRole').text).toBe('Manager');
      expect(itemElements.get('#teamBio').text).toBe('Bio');
    });
  });

  /* 7 — team gallery */
  describe('team photo gallery', () => {
    it('sets #teamGallery ARIA label', async () => {
      await onReadyHandler();
      expect(getEl('#teamGallery').accessibility.ariaLabel).toBe('Team photo gallery');
    });
  });

  /* 8 — timeline repeater */
  describe('timeline', () => {
    it('sets #timelineRepeater data with 4 milestones', async () => {
      await onReadyHandler();
      const repeater = getEl('#timelineRepeater');
      expect(repeater.data).toHaveLength(4);
      expect(repeater.data.map(m => m.year)).toEqual(['1991', '2000s', '2021', 'Today']);
    });

    it('sets #timelineRepeater ARIA label and role', async () => {
      await onReadyHandler();
      const repeater = getEl('#timelineRepeater');
      expect(repeater.accessibility.ariaLabel).toBe('Business history timeline');
      expect(repeater.accessibility.role).toBe('list');
    });

    it('onItemReady sets #timelineYear, #timelineTitle, #timelineDesc', async () => {
      await onReadyHandler();
      const repeater = getEl('#timelineRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, { year: '1991', title: "Sims' Futon Gallery Opens", description: 'A founding story.' });

      expect(itemElements.get('#timelineYear').text).toBe('1991');
      expect(itemElements.get('#timelineTitle').text).toBe("Sims' Futon Gallery Opens");
      expect(itemElements.get('#timelineDesc').text).toBe('A founding story.');
    });
  });

  /* 9 — showroom info */
  describe('showroom info', () => {
    it('sets #aboutAddress and #aboutPhone from getShowroomDetails', async () => {
      await onReadyHandler();
      expect(getEl('#aboutAddress').text).toBe('824 Locust St');
      expect(getEl('#aboutPhone').text).toBe('(828) 252-9449');
    });

    it('sets #aboutTodayHours from formatBusinessHours', async () => {
      await onReadyHandler();
      expect(getEl('#aboutTodayHours').text).toBe('Open until 6pm');
    });
  });

  /* 10 — testimonials repeater */
  describe('social proof', () => {
    it('sets #aboutTestimonials data from getSocialProofSnippets', async () => {
      await onReadyHandler();
      const repeater = getEl('#aboutTestimonials');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0]).toMatchObject({ quote: 'Great!', author: 'Bob', rating: 5 });
      expect(repeater.data[0]._id).toBe('testimonial-0');
    });

    it('sets #aboutTestimonials ARIA label', async () => {
      await onReadyHandler();
      expect(getEl('#aboutTestimonials').accessibility.ariaLabel).toBe('Customer testimonials');
    });

    it('onItemReady sets #testimonialQuote, #testimonialAuthor, #testimonialStars', async () => {
      await onReadyHandler();
      const repeater = getEl('#aboutTestimonials');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      onItemReadyCb($item, { quote: 'Great!', author: 'Bob', rating: 5 });

      expect(itemElements.get('#testimonialQuote').text).toBe('"Great!"');
      expect(itemElements.get('#testimonialAuthor').text).toBe('— Bob');
      expect(itemElements.get('#testimonialStars').text).toBe('★★★★★');
    });
  });

  /* 11 — visit CTA */
  describe('visit CTA', () => {
    it('sets #aboutVisitTitle and #aboutVisitBody text', async () => {
      await onReadyHandler();
      expect(getEl('#aboutVisitTitle').text).toBe('Visit Our Showroom');
      expect(getEl('#aboutVisitBody').text).toContain('Come see our furniture in person');
    });

    it('sets #aboutVisitBtn label', async () => {
      await onReadyHandler();
      expect(getEl('#aboutVisitBtn').label).toBe('Get Directions');
    });

    it('sets #aboutBookBtn label', async () => {
      await onReadyHandler();
      expect(getEl('#aboutBookBtn').label).toBe('Book a Visit');
    });

    it('registers onClick on #aboutVisitBtn', async () => {
      await onReadyHandler();
      expect(getEl('#aboutVisitBtn').onClick).toHaveBeenCalled();
    });

    it('registers onClick on #aboutBookBtn', async () => {
      await onReadyHandler();
      expect(getEl('#aboutBookBtn').onClick).toHaveBeenCalled();
    });
  });

  /* 12 — schema injection */
  describe('local schema injection', () => {
    it('calls getBusinessSchema and posts result to #aboutSchemaHtml', async () => {
      getBusinessSchema.mockReturnValue(Promise.resolve('{"@type":"LocalBusiness"}'));
      await onReadyHandler();
      expect(getBusinessSchema).toHaveBeenCalled();
      expect(getEl('#aboutSchemaHtml').postMessage).toHaveBeenCalledWith('{"@type":"LocalBusiness"}');
    });

    it('does not post to #aboutSchemaHtml when schema is falsy', async () => {
      getBusinessSchema.mockReturnValue(Promise.resolve(null));
      await onReadyHandler();
      expect(getEl('#aboutSchemaHtml').postMessage).not.toHaveBeenCalled();
    });
  });
});
