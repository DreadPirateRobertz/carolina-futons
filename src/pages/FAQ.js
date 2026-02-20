// FAQ.js - Frequently Asked Questions
// Accordion-style FAQ with search filtering, SEO schema markup, and engagement tracking
import { getFaqSchema } from 'backend/seoHelpers.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';

const FAQ_DATA = [
  {
    _id: '1',
    question: 'What is a futon?',
    answer: 'A futon is actually comprised of three separate components: a frame, a futon mattress, and a removable cover. Together they create a versatile piece of furniture that converts from a sofa to a bed.',
  },
  {
    _id: '2',
    question: 'What is the difference between a front-loading futon and a wall hugger?',
    answer: 'Front-loading futons (like Night & Day\'s MoonGlider) fold down from the front, requiring space behind to open into a bed. Wall Hugger futons by Strata Furniture use a patented mechanism that allows conversion without pulling the frame away from the wall — the deck slides forward and down while the back stays in place.',
  },
  {
    _id: '3',
    question: 'What are the advantages of Otis Bed futon mattresses?',
    answer: 'Otis Bed mattresses are hypoallergenic, cottonless, and made with high-density foam (1.8+ lb/cu ft). Unlike cotton futons, they don\'t require regular turning, won\'t develop a permanent crease, and are significantly lighter. They\'re also CertiPUR-US certified and last 10-15 years.',
  },
  {
    _id: '4',
    question: 'What sizes do your futons come in?',
    answer: 'Most of our futon frames and mattresses are available in Full and Queen sizes. Some models may also be available in Twin. Check individual product pages for specific size availability.',
  },
  {
    _id: '5',
    question: 'How does a Murphy Cabinet Bed work?',
    answer: 'Unlike traditional Murphy beds that mount to the wall, our Night & Day Murphy Cabinet Beds are freestanding furniture pieces. The bed folds out of a cabinet in under two minutes — no wall installation required. When closed, it looks like an attractive cabinet.',
  },
  {
    _id: '6',
    question: 'Are KD Frames really made in the USA?',
    answer: 'Yes! KD Frames are manufactured in Athens, Georgia using kiln-dried Tulip Poplar harvested from responsibly managed forests in Virginia. No chemicals are applied in their factory, and the wood is smooth and unfinished so you can stain or paint it to match your decor.',
  },
  {
    _id: '7',
    question: 'Can I visit your showroom?',
    answer: 'We\'d love to see you! Visit us at 824 Locust St, Suite 200, Hendersonville, NC 28792. We\'re open Wednesday through Saturday, 10 AM to 5 PM. Come see over 700 fabric swatches, try out our frames, and feel the difference of an Otis mattress in person.',
  },
  {
    _id: '8',
    question: 'Do you offer fabric swatches?',
    answer: 'Yes! We have over 700 swatches of premium fabric lines available in our showroom for choosing a custom futon cover. Visit us in person to browse the full selection.',
  },
  {
    _id: '9',
    question: 'What is your shipping policy?',
    answer: 'We offer shipping across the United States. Orders over $999 qualify for free shipping. For specific shipping information, delivery timelines, and regional details, please visit our "Getting It Home" page or contact us directly.',
  },
  {
    _id: '10',
    question: 'Do your futon mattresses work with memory foam?',
    answer: 'Our KD Frames platform beds feature 2.8-inch slat spacing specifically designed to properly support Memory Foam and Latex mattresses, keeping body weight evenly distributed. Otis Bed\'s Pulsar model is their dedicated memory foam futon mattress option.',
  },
];

$w.onReady(async function () {
  initBackToTop($w);
  initFaqAccordion();
  initFaqSearch();
  await injectFaqSchema();
  trackEvent('page_view', { page: 'faq' });
});

// ── FAQ Accordion ───────────────────────────────────────────────────

function initFaqAccordion() {
  try {
    const repeater = $w('#faqRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      $item('#faqQuestion').text = itemData.question;
      $item('#faqAnswer').text = itemData.answer;

      // Start collapsed
      $item('#faqAnswer').collapse();
      $item('#faqToggle').text = '+';

      // ARIA for accordion
      try { $item('#faqQuestion').accessibility.ariaLabel = `Toggle answer: ${itemData.question}`; } catch (e) {}
      try { $item('#faqToggle').accessibility.ariaLabel = `Toggle answer: ${itemData.question}`; } catch (e) {}
      try { $item('#faqToggle').accessibility.ariaExpanded = false; } catch (e) {}

      // Toggle on click
      $item('#faqQuestion').onClick(() => {
        toggleFaqItem($item, itemData.question);
      });
      $item('#faqToggle').onClick(() => {
        toggleFaqItem($item, itemData.question);
      });
    });
    repeater.data = FAQ_DATA;
  } catch (e) {}
}

function toggleFaqItem($item, question) {
  try {
    if ($item('#faqAnswer').collapsed) {
      $item('#faqAnswer').expand();
      $item('#faqToggle').text = '\u2212';
      try { $item('#faqToggle').accessibility.ariaExpanded = true; } catch (e) {}
      if (question) trackEvent('faq_expand', { question });
    } else {
      $item('#faqAnswer').collapse();
      $item('#faqToggle').text = '+';
      try { $item('#faqToggle').accessibility.ariaExpanded = false; } catch (e) {}
    }
  } catch (e) {}
}

// ── FAQ Search / Filter ────────────────────────────────────────────
// Lets users filter FAQs by keyword to quickly find answers

function initFaqSearch() {
  try {
    const searchInput = $w('#faqSearchInput');
    if (!searchInput) return;

    try { searchInput.accessibility.ariaLabel = 'Search frequently asked questions'; } catch (e) {}

    let debounceTimer;
    searchInput.onKeyPress(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = searchInput.value?.trim().toLowerCase();
        filterFaqs(query);
      }, 300);
    });
  } catch (e) {}
}

function filterFaqs(query) {
  try {
    const repeater = $w('#faqRepeater');
    if (!repeater) return;

    if (!query) {
      repeater.data = FAQ_DATA;
      try { $w('#faqNoResults').collapse(); } catch (e) {}
      return;
    }

    const filtered = FAQ_DATA.filter(
      f => f.question.toLowerCase().includes(query)
        || f.answer.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      try {
        $w('#faqNoResults').text = `No FAQs match "${query}". Try a different search or contact us!`;
        $w('#faqNoResults').expand();
      } catch (e) {}
    } else {
      try { $w('#faqNoResults').collapse(); } catch (e) {}
    }

    repeater.data = filtered;
    trackEvent('faq_search', { query, resultCount: filtered.length });
  } catch (e) {}
}

// ── FAQ Schema for SEO ──────────────────────────────────────────────

async function injectFaqSchema() {
  try {
    const faqs = FAQ_DATA.map(f => ({
      question: f.question,
      answer: f.answer,
    }));
    const schema = await getFaqSchema(faqs);
    if (schema) {
      $w('#faqSchemaHtml').postMessage(schema);
    }
  } catch (e) {}
}
