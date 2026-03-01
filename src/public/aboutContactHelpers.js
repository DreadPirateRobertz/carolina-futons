// aboutContactHelpers.js — Testable helpers for About and Contact pages
// Brand story, team data, showroom details, form validation, social proof

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s().+-]+$/;
const HTML_TAG_RE = /<[^>]*>/;

// ── Brand Story ──────────────────────────────────────────────────────

export function getBrandStory() {
  return [
    {
      heading: 'Founded in 1991',
      body: 'Carolina Futons began as Sims\' Futon Gallery in 1991, when Richard and Liz Sims opened their doors in Hendersonville, NC. For three decades, they built a reputation for honest pricing, expert knowledge, and the largest futon selection in the Carolinas.',
      imageAlt: 'The original Sims\' Futon Gallery storefront in Hendersonville, NC',
    },
    {
      heading: 'A New Chapter',
      body: 'In 2021, Brenda and Howard Deal took the helm — carrying forward the same principles that made the store a community staple. With fresh energy and deep respect for the legacy, they expanded the collection to include Murphy Cabinet Beds, platform beds, and curated home furnishings.',
      imageAlt: 'Brenda and Howard Deal, owners of Carolina Futons',
    },
    {
      heading: 'Your Local Showroom',
      body: 'Visit our Hendersonville showroom to try before you buy. Every piece on our floor is ready to sit on, sleep on, and experience firsthand. Our team will help you find the perfect fit for your space — no pressure, just honest guidance from people who know furniture.',
      imageAlt: 'Inside the Carolina Futons showroom in Hendersonville, NC',
    },
    {
      heading: 'Quality You Can Trust',
      body: 'We stand behind every piece we sell. From solid hardwood frames to premium mattresses, we source furniture built to last. Our white-glove delivery team handles setup so you can enjoy your new furniture from day one.',
      imageAlt: 'Handcrafted futon frame detail showing solid hardwood construction',
    },
  ];
}

// ── Team Members ─────────────────────────────────────────────────────

export function getTeamMembers() {
  return [
    {
      name: 'Brenda Deal',
      role: 'Owner & Furniture Expert',
      bio: 'Brenda brings 30+ years of home furnishing expertise and a passion for helping customers find exactly the right piece for their space.',
    },
    {
      name: 'Howard Deal',
      role: 'Owner & Operations',
      bio: 'Howard manages logistics, delivery, and ensures every customer\'s experience is seamless from purchase to setup.',
    },
  ];
}

// ── Showroom Details ─────────────────────────────────────────────────

export function getShowroomDetails() {
  return {
    address: '824 Locust St, Ste 200\nHendersonville, NC 28792',
    phone: '(828) 252-9449',
    telLink: 'tel:+18282529449',
    directionsUrl: 'https://maps.google.com/?q=824+Locust+St+Ste+200+Hendersonville+NC+28792',
    hours: [
      { day: 'Wednesday', time: '10:00 AM - 5:00 PM' },
      { day: 'Thursday', time: '10:00 AM - 5:00 PM' },
      { day: 'Friday', time: '10:00 AM - 5:00 PM' },
      { day: 'Saturday', time: '10:00 AM - 5:00 PM' },
    ],
    features: [
      'Try before you buy — every piece on display',
      'Free design consultations',
      'White-glove local delivery & setup',
      'Financing available with monthly payments',
      'Free swatches shipped nationwide',
    ],
  };
}

// ── Contact Form Validation ──────────────────────────────────────────

export function validateContactFields(fields = {}) {
  const errors = [];
  const name = (fields.name || '').trim();
  const email = (fields.email || '').trim();
  const message = (fields.message || '').trim();
  const phone = (fields.phone || '').trim();

  // Name validation
  if (!name) {
    errors.push({ field: 'name', message: 'Please enter your name' });
  } else if (name.length > 200) {
    errors.push({ field: 'name', message: 'Name must be under 200 characters' });
  } else if (HTML_TAG_RE.test(name)) {
    errors.push({ field: 'name', message: 'Name contains invalid characters' });
  }

  // Email validation
  if (!email) {
    errors.push({ field: 'email', message: 'Please enter your email address' });
  } else if (!EMAIL_RE.test(email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  }

  // Message validation
  if (!message) {
    errors.push({ field: 'message', message: 'Please enter your message' });
  } else if (message.length > 5000) {
    errors.push({ field: 'message', message: 'Message must be under 5,000 characters' });
  }

  // Phone validation (optional, but if provided must be valid)
  if (phone && !PHONE_RE.test(phone)) {
    errors.push({ field: 'phone', message: 'Please enter a valid phone number' });
  }

  return { valid: errors.length === 0, errors };
}

// ── Business Hours ───────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const OPEN_DAYS = new Set([3, 4, 5, 6]); // Wed=3, Thu=4, Fri=5, Sat=6

export function formatBusinessHours(dayOfWeek) {
  const today = dayOfWeek !== undefined ? dayOfWeek : new Date().getDay();
  const isOpen = OPEN_DAYS.has(today);

  const schedule = DAYS.map((day, i) => ({
    day,
    time: OPEN_DAYS.has(i) ? '10:00 AM - 5:00 PM' : 'Closed',
  }));

  const todayStatus = isOpen
    ? 'Open today: 10:00 AM - 5:00 PM'
    : 'Closed today — open Wednesday through Saturday';

  return { schedule, todayStatus, isOpen };
}

// ── Social Proof Snippets ────────────────────────────────────────────

export function getSocialProofSnippets() {
  return [
    {
      quote: 'Best furniture shopping experience we\'ve had. Brenda helped us find the perfect futon for our guest room.',
      author: 'Sarah M., Asheville',
      rating: 5,
    },
    {
      quote: 'The white-glove delivery was incredible. They set everything up and even took the packaging.',
      author: 'James R., Greenville',
      rating: 5,
    },
    {
      quote: 'We\'ve been buying from this store since the Sims days. Quality hasn\'t changed — still the best.',
      author: 'Linda K., Hendersonville',
      rating: 5,
    },
    {
      quote: 'Found a Murphy bed that fits perfectly in our mountain cabin. Great selection and fair prices.',
      author: 'Tom & Karen W., Brevard',
      rating: 4,
    },
  ];
}
