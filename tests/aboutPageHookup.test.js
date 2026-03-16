/**
 * Tests for pages/About.js
 * Covers: page init, heading, brand story repeater, team section,
 * photo gallery, timeline, showroom info, social proof, visit CTA,
 * FAQ link, local business schema injection.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    html: '',
    value: '',
    label: '',
    src: '',
    alt: '',
    link: '',
    target: '',
    data: [],
    collapsed: false,
    style: { color: '' },
    accessibility: { ariaLabel: '', role: '', tabIndex: -1 },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    postMessage: vi.fn(),
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

// ── Mock Data ───────────────────────────────────────────────────────

const mockBrandStory = [
  { heading: 'From Humble Beginnings', body: 'In 1991, Richard and Liz Sims opened...', imageAlt: 'The original Hendersonville storefront in 1991' },
  { heading: 'A Family Tradition', body: 'For over 30 years...', imageAlt: 'The Deal family at Carolina Futons showroom' },
  { heading: 'Quality You Can Feel', body: 'We believe furniture should be...', imageAlt: 'Handcrafted futon frame in our workshop' },
];

const mockTeamMembers = [
  { name: 'Brenda Deal', role: 'Owner', bio: 'Brenda brings 20 years of retail experience.' },
  { name: 'Howard Deal', role: 'Owner', bio: 'Howard handles operations and customer service.' },
];

const mockShowroomDetails = {
  address: '824 Locust St, Suite 200, Hendersonville, NC 28792',
  phone: '(828) 252-9449',
  directionsUrl: 'https://maps.google.com/?q=824+Locust+St+Ste+200+Hendersonville+NC+28792',
  features: ['Free fabric swatches', 'Try before you buy', 'Expert guidance'],
};

const mockBusinessHours = {
  todayStatus: 'Open today: 10 AM – 5 PM',
};

const mockSocialProof = [
  { quote: 'Best furniture store in WNC!', author: 'Sarah M.', rating: 5 },
  { quote: 'Wonderful service and quality.', author: 'John D.', rating: 4 },
];

// ── Mock Dependencies ───────────────────────────────────────────────

const trackEvent = vi.fn();
vi.mock('public/engagementTracker', () => ({
  trackEvent: (...args) => trackEvent(...args),
}));

vi.mock('public/mobileHelpers', () => ({ initBackToTop: vi.fn() }));

const makeClickable = vi.fn();
vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: (...args) => makeClickable(...args),
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));

const getBusinessSchema = vi.fn().mockResolvedValue('{"@type":"LocalBusiness","name":"Carolina Futons"}');
vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: (...args) => getBusinessSchema(...args),
}));

vi.mock('public/aboutContactHelpers.js', () => ({
  getBrandStory: vi.fn(() => mockBrandStory),
  getTeamMembers: vi.fn(() => mockTeamMembers),
  getShowroomDetails: vi.fn(() => mockShowroomDetails),
  formatBusinessHours: vi.fn(() => mockBusinessHours),
  getSocialProofSnippets: vi.fn(() => mockSocialProof),
}));

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

// ── Import Page ─────────────────────────────────────────────────────

describe('About Page', () => {
  beforeAll(async () => {
    await import('../src/pages/About.js');
  });

  beforeEach(() => {
    elements.clear();
    trackEvent.mockClear();
    makeClickable.mockClear();
    getBusinessSchema.mockClear();
    getBusinessSchema.mockResolvedValue('{"@type":"LocalBusiness","name":"Carolina Futons"}');
  });

  // ── Page Init ───────────────────────────────────────────────────

  describe('page initialization', () => {
    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'about' });
    });

    it('sets page title to Our Story', async () => {
      await onReadyHandler();
      expect(getEl('#aboutTitle').text).toBe('Our Story');
    });

    it('sets subtitle with Hendersonville mention', async () => {
      await onReadyHandler();
      expect(getEl('#aboutSubtitle').text).toContain('Hendersonville');
      expect(getEl('#aboutSubtitle').text).toContain('1991');
    });
  });

  // ── Brand Story ─────────────────────────────────────────────────

  describe('brand story', () => {
    it('populates brand story repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#brandStoryRepeater');
      expect(repeater.data).toHaveLength(3);
      expect(repeater.data[0]._id).toBe('story-0');
    });

    it('sets ARIA label on brand story repeater', async () => {
      await onReadyHandler();
      expect(getEl('#brandStoryRepeater').accessibility.ariaLabel).toContain('brand story');
    });

    it('registers onItemReady on brand story repeater', async () => {
      await onReadyHandler();
      expect(getEl('#brandStoryRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets heading, body, and image alt', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#brandStoryRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '', alt: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, mockBrandStory[0]);
      expect(itemEls['#storyHeading'].text).toBe('From Humble Beginnings');
      expect(itemEls['#storyBody'].text).toContain('1991');
      expect(itemEls['#storyImage'].alt).toContain('Hendersonville');
    });
  });

  // ── Team Section ────────────────────────────────────────────────

  describe('team section', () => {
    it('populates team repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#teamRepeater');
      expect(repeater.data).toHaveLength(2);
      expect(repeater.data[0]._id).toBe('team-0');
    });

    it('sets ARIA label on team repeater', async () => {
      await onReadyHandler();
      expect(getEl('#teamRepeater').accessibility.ariaLabel).toContain('team');
    });

    it('onItemReady sets name, role, and bio', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#teamRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, mockTeamMembers[0]);
      expect(itemEls['#teamName'].text).toBe('Brenda Deal');
      expect(itemEls['#teamRole'].text).toBe('Owner');
      expect(itemEls['#teamBio'].text).toContain('20 years');
    });
  });

  // ── Photo Gallery ───────────────────────────────────────────────

  describe('photo gallery', () => {
    it('sets ARIA label on team gallery', async () => {
      await onReadyHandler();
      expect(getEl('#teamGallery').accessibility.ariaLabel).toContain('photo gallery');
    });

    it('registers onItemReady on gallery', async () => {
      await onReadyHandler();
      expect(getEl('#teamGallery').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets alt text on polaroid image', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#teamGallery').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { alt: '', text: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, { title: 'Team picnic 2024', description: 'Annual team outing' });
      expect(itemEls['#polaroidImage'].alt).toBe('Team picnic 2024');
      expect(itemEls['#polaroidCaption'].text).toBe('Annual team outing');
    });

    it('onItemReady uses default alt when title is missing', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#teamGallery').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { alt: '', text: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, { title: '', description: null });
      expect(itemEls['#polaroidImage'].alt).toContain('Carolina Futons team');
    });
  });

  // ── Timeline ────────────────────────────────────────────────────

  describe('timeline', () => {
    it('populates timeline repeater with 4 milestones', async () => {
      await onReadyHandler();
      const repeater = getEl('#timelineRepeater');
      expect(repeater.data).toHaveLength(4);
      expect(repeater.data[0].year).toBe('1991');
      expect(repeater.data[3].year).toBe('Today');
    });

    it('sets ARIA role=list and label on timeline repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#timelineRepeater');
      expect(repeater.accessibility.role).toBe('list');
      expect(repeater.accessibility.ariaLabel).toContain('timeline');
    });

    it('onItemReady sets year, title, and description', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#timelineRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '', accessibility: { ariaLabel: '' } };
        return itemEls[sel];
      };

      itemReadyCb($item, { year: '1991', title: "Sims' Futon Gallery Opens", description: 'Richard and Liz...' });
      expect(itemEls['#timelineYear'].text).toBe('1991');
      expect(itemEls['#timelineTitle'].text).toContain('Futon Gallery');
      expect(itemEls['#timelineDesc'].text).toContain('Richard');
    });

    it('onItemReady sets ARIA label on year element', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#timelineRepeater').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '', accessibility: { ariaLabel: '' } };
        return itemEls[sel];
      };

      itemReadyCb($item, { year: '2021', title: 'A New Chapter Begins', description: 'Desc' });
      expect(itemEls['#timelineYear'].accessibility.ariaLabel).toContain('2021');
      expect(itemEls['#timelineYear'].accessibility.ariaLabel).toContain('New Chapter');
    });
  });

  // ── Showroom Info ───────────────────────────────────────────────

  describe('showroom info', () => {
    it('sets address text', async () => {
      await onReadyHandler();
      expect(getEl('#aboutAddress').text).toBe('824 Locust St, Suite 200, Hendersonville, NC 28792');
    });

    it('sets phone text', async () => {
      await onReadyHandler();
      expect(getEl('#aboutPhone').text).toBe('(828) 252-9449');
    });

    it('sets today hours status', async () => {
      await onReadyHandler();
      expect(getEl('#aboutTodayHours').text).toContain('Open today');
    });

    it('populates showroom features repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#showroomFeatures');
      expect(repeater.data).toHaveLength(3);
      expect(repeater.data[0].text).toBe('Free fabric swatches');
    });

    it('onItemReady sets feature text', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#showroomFeatures').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, { _id: 'feat-0', text: 'Free fabric swatches' });
      expect(itemEls['#featureText'].text).toBe('Free fabric swatches');
    });

    it('uses makeClickable on directions button', async () => {
      await onReadyHandler();
      const dirCalls = makeClickable.mock.calls.filter(
        call => call[0] === getEl('#aboutDirectionsBtn')
      );
      expect(dirCalls.length).toBeGreaterThanOrEqual(1);
      expect(dirCalls[0][2]).toEqual(expect.objectContaining({
        ariaLabel: 'Get directions to our showroom',
      }));
    });

    it('directions button click opens Google Maps', async () => {
      const wixWindow = await import('wix-window-frontend');
      wixWindow.openUrl.mockClear();

      await onReadyHandler();
      const dirCall = makeClickable.mock.calls.find(
        call => call[0] === getEl('#aboutDirectionsBtn')
      );
      dirCall[1](); // invoke click handler
      await new Promise(r => setTimeout(r, 50));

      expect(wixWindow.openUrl).toHaveBeenCalledWith(
        expect.stringContaining('maps.google.com')
      );
    });
  });

  // ── Social Proof ────────────────────────────────────────────────

  describe('social proof', () => {
    it('populates testimonials repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#aboutTestimonials');
      expect(repeater.data).toHaveLength(2);
    });

    it('sets ARIA label on testimonials repeater', async () => {
      await onReadyHandler();
      expect(getEl('#aboutTestimonials').accessibility.ariaLabel).toContain('testimonials');
    });

    it('onItemReady sets quote with quotation marks', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#aboutTestimonials').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, mockSocialProof[0]);
      expect(itemEls['#testimonialQuote'].text).toBe('"Best furniture store in WNC!"');
      expect(itemEls['#testimonialAuthor'].text).toBe('— Sarah M.');
    });

    it('onItemReady renders star rating with filled and empty stars', async () => {
      await onReadyHandler();
      const itemReadyCb = getEl('#aboutTestimonials').onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, mockSocialProof[1]); // rating: 4
      expect(itemEls['#testimonialStars'].text).toBe('★★★★☆');
    });
  });

  // ── Visit CTA ───────────────────────────────────────────────────

  describe('visit CTA', () => {
    it('sets visit section title', async () => {
      await onReadyHandler();
      expect(getEl('#aboutVisitTitle').text).toBe('Visit Our Showroom');
    });

    it('sets visit body with swatch and guidance info', async () => {
      await onReadyHandler();
      expect(getEl('#aboutVisitBody').text).toContain('700 fabric swatches');
    });

    it('sets visit button label and ARIA', async () => {
      await onReadyHandler();
      expect(getEl('#aboutVisitBtn').label).toBe('Get Directions');
      expect(getEl('#aboutVisitBtn').accessibility.ariaLabel).toContain('Carolina Futons showroom');
    });

    it('visit button click opens Google Maps directions', async () => {
      const wixWindow = await import('wix-window-frontend');
      wixWindow.openUrl.mockClear();

      await onReadyHandler();
      const clickHandler = getEl('#aboutVisitBtn').onClick.mock.calls[0][0];
      clickHandler();
      await new Promise(r => setTimeout(r, 50));

      expect(wixWindow.openUrl).toHaveBeenCalledWith(
        expect.stringContaining('Hendersonville')
      );
    });

    it('sets book button label and ARIA', async () => {
      await onReadyHandler();
      expect(getEl('#aboutBookBtn').label).toBe('Book a Visit');
      expect(getEl('#aboutBookBtn').accessibility.ariaLabel).toContain('Book a showroom visit');
    });

    it('book button click navigates to /contact', async () => {
      const wixLocation = await import('wix-location-frontend');
      wixLocation.to.mockClear();

      await onReadyHandler();
      const clickHandler = getEl('#aboutBookBtn').onClick.mock.calls[0][0];
      clickHandler();
      await new Promise(r => setTimeout(r, 50));

      expect(wixLocation.to).toHaveBeenCalledWith('/contact');
    });
  });

  // ── FAQ Link ────────────────────────────────────────────────────

  describe('FAQ link', () => {
    it('uses makeClickable on FAQ link element', async () => {
      await onReadyHandler();
      const faqCalls = makeClickable.mock.calls.filter(
        call => call[0] === getEl('#aboutFaqLink')
      );
      expect(faqCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('FAQ link has correct ARIA attributes', async () => {
      await onReadyHandler();
      const faqCall = makeClickable.mock.calls.find(
        call => call[0] === getEl('#aboutFaqLink')
      );
      expect(faqCall[2]).toEqual(expect.objectContaining({
        ariaLabel: expect.stringContaining('frequently asked questions'),
        role: 'link',
      }));
    });

    it('FAQ link click navigates to /faq', async () => {
      const wixLocation = await import('wix-location-frontend');
      wixLocation.to.mockClear();

      await onReadyHandler();
      const faqCall = makeClickable.mock.calls.find(
        call => call[0] === getEl('#aboutFaqLink')
      );
      faqCall[1](); // invoke click handler
      await new Promise(r => setTimeout(r, 50));

      expect(wixLocation.to).toHaveBeenCalledWith('/faq');
    });
  });

  // ── Local Business Schema ───────────────────────────────────────

  describe('local business schema', () => {
    it('injects schema into aboutSchemaHtml element', async () => {
      await onReadyHandler();
      expect(getEl('#aboutSchemaHtml').postMessage).toHaveBeenCalledWith(
        '{"@type":"LocalBusiness","name":"Carolina Futons"}'
      );
    });

    it('does not inject schema when getBusinessSchema returns null', async () => {
      getBusinessSchema.mockResolvedValueOnce(null);
      await onReadyHandler();
      expect(getEl('#aboutSchemaHtml').postMessage).not.toHaveBeenCalled();
    });

    it('does not throw when getBusinessSchema rejects', async () => {
      getBusinessSchema.mockRejectedValueOnce(new Error('Network error'));
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });

  // ── Error Resilience ────────────────────────────────────────────

  describe('error resilience', () => {
    it('does not throw when brand story repeater is missing', async () => {
      const original = globalThis.$w;
      globalThis.$w = Object.assign(
        (sel) => {
          if (sel === '#brandStoryRepeater') return null;
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      await expect(onReadyHandler()).resolves.not.toThrow();
      globalThis.$w = original;
    });

    it('does not throw when timeline repeater is missing', async () => {
      const original = globalThis.$w;
      globalThis.$w = Object.assign(
        (sel) => {
          if (sel === '#timelineRepeater') return null;
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      await expect(onReadyHandler()).resolves.not.toThrow();
      globalThis.$w = original;
    });
  });
});
