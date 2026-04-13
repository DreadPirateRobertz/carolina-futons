/**
 * ReviewsCarousel.js — Auto-advancing customer review carousel for the homepage.
 * Rotates through the most recent approved reviews with prev/next controls,
 * dot indicators, and a "Read more / Show less" expand toggle.
 *
 * Required Wix Studio elements:
 *   #reviewCarouselSection   Box    — outer wrapper (collapsed when no reviews)
 *   #reviewCarouselName      Text   — reviewer display name
 *   #reviewCarouselRating    Text   — star rating string (e.g. "★★★★☆")
 *   #reviewCarouselProduct   Text   — product name
 *   #reviewCarouselBody      Text   — review body (truncated to 120 chars)
 *   #reviewCarouselExpand    Button — "Read more" / "Show less" toggle
 *   #reviewCarouselPrev      Button — previous review
 *   #reviewCarouselNext      Button — next review
 *   #reviewCarouselDots      Text   — dot indicators (e.g. "● ○ ○")
 *
 * CF-796
 */
import { getFeaturedReviews } from 'backend/reviewsService.web';

// ── Constants ─────────────────────────────────────────────────────────────────

// Why: 5 s matches the engagement-benchmark interval established in CF-796 —
// short enough to keep attention but long enough to read a review. (CF-796)
const AUTO_ADVANCE_MS = 5000;

// Why: 120 chars keeps the teaser under two lines on mobile at base font size.
// Users who want more can click "Read more". (CF-796)
const TRUNCATE_LEN = 120;

const DOT_FILLED = '\u25CF'; // ●
const DOT_EMPTY  = '\u25CB'; // ○

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a star rating string from a numeric score (1–5).
 * @param {number|null} rating
 * @returns {string}
 */
function buildStars(rating) {
  if (typeof rating !== 'number') return '';
  const n = Math.round(Math.min(5, Math.max(0, rating)));
  return '\u2605'.repeat(n) + '\u2606'.repeat(5 - n);
}

/**
 * Truncate a string to maxLen characters, appending an ellipsis if truncated.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (!str) return '';
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Build a dot indicator string for the given index and total.
 * @param {number} index   Current slide index (0-based)
 * @param {number} total
 * @returns {string}  e.g. "● ○ ○" for index 0 of 3
 */
function buildDots(index, total) {
  return Array.from({ length: total }, (_, i) =>
    i === index ? DOT_FILLED : DOT_EMPTY
  ).join(' ');
}

// ── Module init ───────────────────────────────────────────────────────────────

/**
 * Initialize the reviews carousel.
 * Fetches up to 10 approved reviews, renders the first one, and starts the
 * auto-advance timer.  Pauses when the cursor enters the carousel.
 *
 * @param {Function} $w  Wix selector
 * @returns {Promise<{destroy: Function}>}
 */
export async function initReviewsCarousel($w) {
  let index    = 0;
  let expanded = false;
  let paused   = false;
  let timerId  = null;
  let reviews  = [];

  function collapse() {
    try { $w('#reviewCarouselSection').collapse(); } catch (err) {
      console.error('[ReviewsCarousel] collapse error:', err.message);
    }
  }

  // ── Fetch reviews ───────────────────────────────────────────────────────────

  let result;
  try {
    result = await getFeaturedReviews({ limit: 10 });
  } catch (err) {
    console.error('[ReviewsCarousel] fetch error:', err.message);
    collapse();
    return { destroy() {} };
  }

  if (!result.success || !result.reviews?.length) {
    collapse();
    return { destroy() {} };
  }

  reviews = result.reviews;

  // ── Render helpers ──────────────────────────────────────────────────────────

  function render() {
    const r = reviews[index];
    if (!r) return;

    try { $w('#reviewCarouselName').text    = r.authorName || 'Customer'; } catch (_) {}
    try { $w('#reviewCarouselRating').text  = buildStars(r.rating);       } catch (_) {}
    try { $w('#reviewCarouselProduct').text = r.productName || '';        } catch (_) {}
    try {
      $w('#reviewCarouselBody').text = expanded
        ? (r.body || '')
        : truncate(r.body || '', TRUNCATE_LEN);
    } catch (_) {}
    try {
      $w('#reviewCarouselExpand').label = expanded ? 'Show less' : 'Read more';
      // Hide expand button when body fits within truncation limit
      const bodyLen = (r.body || '').length;
      if (bodyLen <= TRUNCATE_LEN) {
        $w('#reviewCarouselExpand').hide();
      } else {
        $w('#reviewCarouselExpand').show();
      }
    } catch (_) {}
    try { $w('#reviewCarouselDots').text = buildDots(index, reviews.length); } catch (_) {}
  }

  function advance() {
    index    = (index + 1) % reviews.length;
    expanded = false;
    render();
  }

  function retreat() {
    index    = (index - 1 + reviews.length) % reviews.length;
    expanded = false;
    render();
  }

  function startTimer() {
    if (timerId !== null) return;
    timerId = setInterval(() => {
      if (!paused) advance();
    }, AUTO_ADVANCE_MS);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  // ── Wire controls ───────────────────────────────────────────────────────────

  try { $w('#reviewCarouselPrev').onClick(() => { retreat(); }); } catch (_) {}
  try { $w('#reviewCarouselNext').onClick(() => { advance(); }); } catch (_) {}
  try {
    $w('#reviewCarouselExpand').onClick(() => {
      expanded = !expanded;
      render();
    });
  } catch (_) {}

  // Pause on hover — resume when cursor leaves
  try {
    $w('#reviewCarouselSection').onMouseIn(() => { paused = true;  });
    $w('#reviewCarouselSection').onMouseOut(() => { paused = false; });
  } catch (_) {}

  // ── Expand section & initial render ────────────────────────────────────────

  try { $w('#reviewCarouselSection').expand(); } catch (_) {}
  render();
  startTimer();

  return {
    destroy() {
      stopTimer();
    },
  };
}
