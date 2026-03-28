<<<<<<< HEAD
/**
 * StyleQuizResult.js — Style Quiz result page controller.
 * Loads quiz recommendations and personalized copy from stored quiz answers,
 * then populates the result page elements.
 *
 * Elements:
 *   #quizPersonalizedCopy   — Text element for the personalized recommendation blurb
 *   #quizRepeater          — Repeater displaying top product recommendations
 *   #quizResultsSection    — Container section (collapsed until results load)
 *   #quizLoadingIndicator  — Shown while fetching results
 *   #quizErrorMsg          — Shown on fetch failure
 *
 * Quiz answers are stored by the quiz page via storeQuizAnswers() and retrieved
 * here from session storage (key: 'styleQuizAnswers').
 */
import { getQuizRecommendations, getPersonalizedCopy } from 'backend/styleQuiz.web';
import { session } from 'wix-storage';
import { safeCall, safeCollapse, safeExpand, safeText } from 'public/safeInit';

const ANSWERS_KEY = 'styleQuizAnswers';

$w.onReady(async function () {
  await initStyleQuizResult($w);
});

/**
 * Initialize the Style Quiz result page.
 * Reads stored quiz answers, fetches recommendations + personalized copy in parallel,
 * and populates page elements.
 *
 * @param {Function} $w - Wix selector function
 */
export async function initStyleQuizResult($w) {
  // Show loading state
  safeCall(() => $w('#quizLoadingIndicator').show());
  safeCollapse($w, '#quizResultsSection');
  safeCall(() => $w('#quizErrorMsg').hide());

  // Retrieve stored answers
  const rawAnswers = session.getItem(ANSWERS_KEY);
  if (!rawAnswers) {
    _showError($w, 'Your quiz answers were not found. Please retake the quiz.');
    return;
  }

  let answers;
  try {
    answers = JSON.parse(rawAnswers);
  } catch (e) {
    console.error('[StyleQuizResult] Failed to parse stored quiz answers:', e, '| Raw value length:', rawAnswers?.length);
    _showError($w, 'Could not load your quiz answers. Please retake the quiz.');
    return;
  }

  // Fetch recommendations and personalized copy in parallel.
  // Use allSettled so a copy failure degrades gracefully without blocking recommendations.
  const [recResult, copyResult] = await Promise.allSettled([
    getQuizRecommendations(answers),
    getPersonalizedCopy(answers),
  ]);

  if (recResult.status === 'rejected') {
    console.error('[StyleQuizResult] getQuizRecommendations failed:', recResult.reason);
    _showError($w, 'Could not load your recommendations. Please try again.');
    return;
  }

  const recommendations = recResult.value;
  const personalizedCopy = copyResult.status === 'fulfilled' ? copyResult.value?.copy : '';

  if (copyResult.status === 'rejected') {
    console.error('[StyleQuizResult] getPersonalizedCopy failed:', copyResult.reason);
  }

  // Hide loading
  safeCall(() => $w('#quizLoadingIndicator').hide());

  if (!recommendations || recommendations.length === 0) {
    _showError($w, 'No matching products found. Try adjusting your quiz answers.');
    return;
  }

  // Populate personalized copy
  safeText($w, '#quizPersonalizedCopy', personalizedCopy || '');

  // Populate recommendations repeater
  try {
    $w('#quizRepeater').data = recommendations.map(r => ({
      _id: r.product._id,
      name: r.product.name,
      price: r.product.formattedPrice,
      image: r.product.mainMedia,
      slug: r.product.slug,
      reason: r.reason,
      score: r.score,
    }));
  } catch (e) {
    console.error('[StyleQuizResult] Failed to populate repeater:', e);
    _showError($w, 'Could not display recommendations. Please try refreshing the page.');
    return;
  }

  // Show results section
  safeExpand($w, '#quizResultsSection');
}

/**
 * Store quiz answers in session storage before navigating to the result page.
 * Call this from the quiz page when the user completes the quiz.
 *
 * @param {Object} answers - Quiz answers object
 */
export function storeQuizAnswers(answers) {
  session.setItem(ANSWERS_KEY, JSON.stringify(answers));
}

/**
 * Clear stored quiz answers (e.g. when restarting the quiz).
 */
export function clearQuizAnswers() {
  session.removeItem(ANSWERS_KEY);
}

function _showError($w, message) {
  safeCall(() => $w('#quizLoadingIndicator').hide());
  try {
    $w('#quizErrorMsg').text = message;
    $w('#quizErrorMsg').show();
  } catch (e) {
    console.error('[StyleQuizResult] Could not display error message to user:', e, '| Message was:', message);
  }
=======
// StyleQuizResult.js — /style-quiz/result/[shareId]
// Displays a shared Style Quiz result publicly. Sets OG meta tags for social sharing.
import { getSharedResult } from 'backend/styleQuizService.web';
import { initPageSeo } from 'public/pageSeo.js';
import wixLocationFrontend from 'wix-location-frontend';

const OG_IMAGE_BY_STYLE = {
  'modern':  'https://static.wixstatic.com/media/quiz-og-modern.jpg',
  'rustic':  'https://static.wixstatic.com/media/quiz-og-rustic.jpg',
  'classic': 'https://static.wixstatic.com/media/quiz-og-classic.jpg',
};
const DEFAULT_OG_IMAGE = 'https://static.wixstatic.com/media/quiz-og-default.jpg';

$w.onReady(async function () {
  initPageSeo('styleQuizResult');

  const shareId = getShareIdFromUrl();
  if (!shareId) {
    renderNotFound();
    return;
  }

  showLoading(true);

  try {
    const result = await getSharedResult(shareId);

    showLoading(false);

    if (!result || result.error) {
      renderNotFound();
      return;
    }

    renderResult(result);
    applyOgMeta(result);
  } catch (err) {
    console.error('[StyleQuizResult] load error:', err);
    showLoading(false);
    renderNotFound();
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function getShareIdFromUrl() {
  try {
    // wixLocationFrontend.path is SSR-safe; window.location is not
    const path = wixLocationFrontend.path;
    const parts = path.filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

function showLoading(visible) {
  try {
    if (visible) {
      $w('#resultLoading').expand();
      $w('#resultContent').collapse();
    } else {
      $w('#resultLoading').collapse();
    }
  } catch (e) {}
}

function renderResult(result) {
  try { $w('#resultContent').expand(); } catch (e) {}
  try { $w('#resultTag').text = result.resultTag || 'Your Style Profile'; } catch (e) {}

  if (result.answers) {
    try {
      const answers = result.answers;
      const descParts = [];
      if (answers.stylePreference) descParts.push(capitalize(answers.stylePreference));
      if (answers.roomType) descParts.push(formatRoomType(answers.roomType));
      if (answers.primaryUse) descParts.push(formatUse(answers.primaryUse));
      if (answers.sizeNeeds) descParts.push(capitalize(answers.sizeNeeds));
      $w('#resultDescription').text = descParts.join(' • ') || 'A personalised futon style profile';
    } catch (e) {}
  }

  if (result.completedAt) {
    try {
      const date = new Date(result.completedAt);
      $w('#resultDate').text = `Taken ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    } catch (e) {}
  }

  try {
    $w('#resultShopBtn').onClick(() => {
      import('wix-location-frontend').then(loc => loc.to('/shop-main'));
    });
  } catch (e) {}

  try {
    $w('#resultTakeQuizBtn').onClick(() => {
      import('wix-location-frontend').then(loc => loc.to('/style-quiz'));
    });
  } catch (e) {}
}

function applyOgMeta(result) {
  const tag = result.resultTag || 'My Futon Style';
  const style = result.answers?.stylePreference || '';
  const ogImage = OG_IMAGE_BY_STYLE[style] || DEFAULT_OG_IMAGE;

  try { $w('#ogTitle').text = tag; } catch (e) {}
  try { $w('#ogDescription').text = `Check out my personalised futon recommendation from Carolina Futons: ${tag}`; } catch (e) {}
  try { $w('#ogImage').src = ogImage; } catch (e) {}
}

function renderNotFound() {
  try { $w('#resultContent').collapse(); } catch (e) {}
  try { $w('#resultNotFound').expand(); } catch (e) {}
  try {
    $w('#notFoundBtn').onClick(() => {
      import('wix-location-frontend').then(loc => loc.to('/style-quiz'));
    });
  } catch (e) {}
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatRoomType(roomType) {
  const labels = {
    'living-room': 'Living Room',
    'guest-room': 'Guest Room',
    'dorm': 'Dorm',
    'office': 'Home Office',
    'bedroom': 'Bedroom',
  };
  return labels[roomType] || roomType;
}

function formatUse(use) {
  const labels = {
    'sitting': 'Sitting',
    'sleeping': 'Sleeping',
    'both': 'Sitting & Sleeping',
  };
  return labels[use] || use;
>>>>>>> origin/feat/CF-4qca.1-quiz-persistence-sharing
}
