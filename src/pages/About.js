// About.js - "Our Story" Page
// Brand story, team section, business timeline, social proof,
// and trust-building content with local SEO signals
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { initPageSeo } from 'public/pageSeo.js';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { makeClickable } from 'public/a11yHelpers.js';
import {
  getBrandStory,
  getTeamMembers,
  getShowroomDetails,
  formatBusinessHours,
  getSocialProofSnippets,
} from 'public/aboutContactHelpers.js';

$w.onReady(async function () {
  initBackToTop($w);
  initPageHeading();
  initBrandStory();
  initTeamSection();
  initPhotoGallery();
  initTimeline();
  initShowroomInfo();
  initSocialProof();
  initVisitCta();
  initFaqLink();
  await injectLocalSchema();
  initPageSeo('about');
  trackEvent('page_view', { page: 'about' });
});

// ── Page Heading ────────────────────────────────────────────────────

function initPageHeading() {
  try { $w('#aboutTitle').text = 'Our Story'; } catch (e) {}
  try { $w('#aboutSubtitle').text = 'Family-owned since 1991. Hendersonville\'s home for handcrafted futons, Murphy beds, and quality furniture.'; } catch (e) {}
}

// ── Brand Story ─────────────────────────────────────────────────────
// Rich storytelling sections with headings, body copy, and image alt text

function initBrandStory() {
  try {
    const storyRepeater = $w('#brandStoryRepeater');
    if (!storyRepeater) return;

    const story = getBrandStory();
    try { storyRepeater.accessibility.ariaLabel = 'Our brand story'; } catch (e) {}
    storyRepeater.onItemReady(($item, itemData) => {
      try { $item('#storyHeading').text = itemData.heading; } catch (e) {}
      try { $item('#storyBody').text = itemData.body; } catch (e) {}
      try { $item('#storyImage').alt = itemData.imageAlt; } catch (e) {}
    });
    storyRepeater.data = story.map((s, i) => ({ ...s, _id: `story-${i}` }));
  } catch (e) {}
}

// ── Team Section ────────────────────────────────────────────────────

function initTeamSection() {
  try {
    const teamRepeater = $w('#teamRepeater');
    if (!teamRepeater) return;

    const members = getTeamMembers();
    try { teamRepeater.accessibility.ariaLabel = 'Our team'; } catch (e) {}
    teamRepeater.onItemReady(($item, itemData) => {
      try { $item('#teamName').text = itemData.name; } catch (e) {}
      try { $item('#teamRole').text = itemData.role; } catch (e) {}
      try { $item('#teamBio').text = itemData.bio; } catch (e) {}
    });
    teamRepeater.data = members.map((m, i) => ({ ...m, _id: `team-${i}` }));
  } catch (e) {}
}

// ── Polaroid Photo Gallery ──────────────────────────────────────────
// Team/family photos in tilted polaroid-style frames

function initPhotoGallery() {
  try {
    const gallery = $w('#teamGallery');
    if (!gallery) return;

    try { gallery.accessibility.ariaLabel = 'Team photo gallery'; } catch (e) {}
    gallery.onItemReady(($item, itemData) => {
      $item('#polaroidImage').alt = itemData.title || 'The Carolina Futons team in Hendersonville, NC';

      if (itemData.description) {
        try {
          $item('#polaroidCaption').text = itemData.description;
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// ── Business Timeline ───────────────────────────────────────────────

function initTimeline() {
  const milestones = [
    { year: '1991', title: "Sims' Futon Gallery Opens", description: 'Richard and Liz Sims open their doors in Hendersonville, NC, bringing quality futon furniture to the Carolinas.' },
    { year: '2000s', title: 'Largest Selection in the Carolinas', description: 'The store grows to carry the widest range of futon frames, mattresses, and convertible furniture in the region.' },
    { year: '2021', title: 'A New Chapter Begins', description: 'Brenda and Howard Deal take the helm, continuing the same principles of honesty, fair pricing, and outstanding service.' },
    { year: 'Today', title: 'Carolina Futons', description: 'Now featuring Murphy Cabinet Beds, platform beds, and a curated selection of quality furniture — all from our Hendersonville showroom.' },
  ];

  try {
    const repeater = $w('#timelineRepeater');
    if (!repeater) return;

    try { repeater.accessibility.role = 'list'; } catch (e) {}
    try { repeater.accessibility.ariaLabel = 'Business history timeline'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      $item('#timelineYear').text = itemData.year;
      $item('#timelineTitle').text = itemData.title;
      $item('#timelineDesc').text = itemData.description;
      try { $item('#timelineYear').accessibility.ariaLabel = `${itemData.year}: ${itemData.title}`; } catch (e) {}
    });
    repeater.data = milestones.map((m, i) => ({ ...m, _id: String(i) }));
  } catch (e) {}
}

// ── Showroom Info ───────────────────────────────────────────────────

function initShowroomInfo() {
  try {
    const details = getShowroomDetails();
    const hours = formatBusinessHours();

    try { $w('#aboutAddress').text = details.address; } catch (e) {}
    try { $w('#aboutPhone').text = details.phone; } catch (e) {}
    try { $w('#aboutTodayHours').text = hours.todayStatus; } catch (e) {}

    // Showroom features
    try {
      const featRepeater = $w('#showroomFeatures');
      if (featRepeater) {
        featRepeater.onItemReady(($item, itemData) => {
          try { $item('#featureText').text = itemData.text; } catch (e) {}
        });
        featRepeater.data = details.features.map((f, i) => ({ _id: `feat-${i}`, text: f }));
      }
    } catch (e) {}

    // Directions button
    try {
      const dirBtn = $w('#aboutDirectionsBtn');
      if (dirBtn) {
        makeClickable(dirBtn, () => {
          import('wix-window-frontend').then(({ openUrl }) => openUrl(details.directionsUrl));
        }, { ariaLabel: 'Get directions to our showroom' });
      }
    } catch (e) {}
  } catch (e) {}
}

// ── Social Proof ────────────────────────────────────────────────────

function initSocialProof() {
  try {
    const repeater = $w('#aboutTestimonials');
    if (!repeater) return;

    const snippets = getSocialProofSnippets();
    try { repeater.accessibility.ariaLabel = 'Customer testimonials'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#testimonialQuote').text = `"${itemData.quote}"`; } catch (e) {}
      try { $item('#testimonialAuthor').text = `— ${itemData.author}`; } catch (e) {}
      try { $item('#testimonialStars').text = '★'.repeat(itemData.rating) + '☆'.repeat(5 - itemData.rating); } catch (e) {}
    });
    repeater.data = snippets.map((s, i) => ({ ...s, _id: `testimonial-${i}` }));
  } catch (e) {}
}

// ── Visit CTA ───────────────────────────────────────────────────────

function initVisitCta() {
  try { $w('#aboutVisitTitle').text = 'Visit Our Showroom'; } catch (e) {}
  try { $w('#aboutVisitBody').text = 'Come see our furniture in person. Every piece on our floor is ready to sit on, sleep on, and experience firsthand. Browse over 700 fabric swatches and get free expert advice — no pressure, just honest guidance.'; } catch (e) {}
  try {
    const visitBtn = $w('#aboutVisitBtn');
    if (visitBtn) {
      visitBtn.label = 'Get Directions';
      visitBtn.onClick(() => {
        import('wix-window-frontend').then(({ openUrl }) => openUrl('https://maps.google.com/?q=824+Locust+St+Ste+200+Hendersonville+NC+28792'));
      });
      try { visitBtn.accessibility.ariaLabel = 'Get directions to Carolina Futons showroom'; } catch (e) {}
    }
  } catch (e) {}
  try {
    const bookBtn = $w('#aboutBookBtn');
    if (bookBtn) {
      bookBtn.label = 'Book a Visit';
      bookBtn.onClick(() => {
        import('wix-location-frontend').then(({ to }) => to('/contact'));
      });
      try { bookBtn.accessibility.ariaLabel = 'Book a showroom visit'; } catch (e) {}
    }
  } catch (e) {}
}

// ── FAQ Link ────────────────────────────────────────────────────────

function initFaqLink() {
  try {
    const faqLink = $w('#aboutFaqLink');
    if (!faqLink) return;

    makeClickable(faqLink, () => {
      import('wix-location-frontend').then(({ to }) => to('/faq'));
    }, { ariaLabel: 'Visit our frequently asked questions page', role: 'link' });
  } catch (e) {}
}

// ── Local Business Schema ───────────────────────────────────────────

async function injectLocalSchema() {
  try {
    const schema = await getBusinessSchema();
    if (schema) {
      $w('#aboutSchemaHtml').postMessage(schema);
    }
  } catch (e) {}
}
