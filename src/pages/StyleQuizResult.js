/**
 * StyleQuizResult.js — Style Quiz result page controller.
 * Loads quiz recommendations and personalized copy from stored quiz answers,
 * then populates the result page elements. Also runs the Futon Sommelier
 * recommendation engine if lifestyle answers are present, and shows the
 * registration gate for non-members.
 *
 * Elements (style quiz):
 *   #quizPersonalizedCopy   — Text element for the personalized recommendation blurb
 *   #quizRepeater          — Repeater displaying top product recommendations
 *   #quizResultsSection    — Container section (collapsed until results load)
 *   #quizLoadingIndicator  — Shown while fetching results
 *   #quizErrorMsg          — Shown on fetch failure
 *
 * Elements (sommelier):
 *   #sommelierSection          — Container for sommelier results (collapsed if no answers)
 *   #sommelierPersonalizedCopy — Text element for sommelier reasoning
 *   #sommelierRecommendations  — Repeater for sommelier product cards
 *
 * Elements (registration gate):
 *   #quizRegistrationGate — Container (collapsed by default, expanded for visitors)
 *   #quizRegCta           — "Create Free Account" button
 *   #quizRegDismiss       — "No thanks" dismiss link
 *
 * Quiz answers are stored by the quiz page via storeQuizAnswers() and retrieved
 * here from session storage (key: 'styleQuizAnswers').
 * Sommelier answers are stored via storeSommelierAnswers() (key: 'sommelierAnswers').
 */
import { getQuizRecommendations, getPersonalizedCopy } from 'backend/styleQuiz.web';
import { getRecommendation } from 'backend/futonSommelier.web';
import { initStyleQuizRegistrationGate } from 'public/StyleQuizRegistrationGate';
import { session } from 'wix-storage';
import { safeCall, safeCollapse, safeExpand, safeText } from 'public/safeInit';

const ANSWERS_KEY = 'styleQuizAnswers';
const SOMMELIER_ANSWERS_KEY = 'sommelierAnswers';
const SOMMELIER_SESSION_KEY = 'sommelierSessionKey';

$w.onReady(async function () {
  // Start registration gate check concurrently — does not block result loading
  initStyleQuizRegistrationGate({ $w }).catch(e =>
    console.error('[StyleQuizResult] Registration gate error:', e)
  );
  await initStyleQuizResult($w);
  await initSommelierSection($w);
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

/**
 * Store sommelier lifestyle answers in session storage.
 * Call this from the sommelier intake page when the user completes the questionnaire.
 *
 * @param {Object} answers - Lifestyle factor answers keyed by factor ID
 */
export function storeSommelierAnswers(answers) {
  try {
    session.setItem(SOMMELIER_ANSWERS_KEY, JSON.stringify(answers));
  } catch (e) {
    console.error('[StyleQuizResult] Failed to store sommelier answers:', e);
  }
}

/**
 * Clear stored sommelier answers (e.g. when starting a new questionnaire).
 */
export function clearSommelierAnswers() {
  session.removeItem(SOMMELIER_ANSWERS_KEY);
  session.removeItem(SOMMELIER_SESSION_KEY);
}

/**
 * Initialize the Futon Sommelier section of the result page.
 * Reads stored lifestyle answers, calls the sommelier backend, and populates
 * the sommelier recommendation elements. Silently skips if no answers are stored.
 *
 * @param {Function} $w - Wix selector function
 */
export async function initSommelierSection($w) {
  const rawAnswers = session.getItem(SOMMELIER_ANSWERS_KEY);
  if (!rawAnswers) return; // No sommelier answers — section stays hidden

  let answers;
  try {
    answers = JSON.parse(rawAnswers);
  } catch (e) {
    console.error('[StyleQuizResult] Failed to parse sommelier answers:', e, '| Raw value length:', rawAnswers?.length);
    return;
  }

  const sessionKey = session.getItem(SOMMELIER_SESSION_KEY) || '';

  let result;
  try {
    result = await getRecommendation(answers, sessionKey);
  } catch (e) {
    console.error('[StyleQuizResult] getRecommendation failed:', e, '| sessionKey:', sessionKey);
    return;
  }

  if (!result.success) {
    console.error('[StyleQuizResult] Sommelier backend error:', result.error);
    return;
  }

  if (!result.recommendations?.length) {
    console.warn('[StyleQuizResult] Sommelier returned empty recommendations | answerKeys:', Object.keys(answers));
    return;
  }

  // Cache the session key so repeat loads use the cached result
  if (result.sessionKey) {
    session.setItem(SOMMELIER_SESSION_KEY, result.sessionKey);
  }

  safeText($w, '#sommelierPersonalizedCopy', result.reasoning || '');

  try {
    $w('#sommelierRecommendations').data = result.recommendations.map(r => ({
      _id: r.productId,
      name: r.name,
      price: r.price != null ? `$${Number(r.price).toFixed(2)}` : '',
      image: r.image || '',
      slug: r.slug || '',
      matchReasons: (r.matchReasons || []).join(', '),
    }));
  } catch (e) {
    console.error('[StyleQuizResult] Failed to populate sommelier repeater:', e,
      '| First rec shape:', result.recommendations[0] ? Object.keys(result.recommendations[0]) : 'empty');
    return;
  }

  safeExpand($w, '#sommelierSection');
}

function _showError($w, message) {
  safeCall(() => $w('#quizLoadingIndicator').hide());
  try {
    $w('#quizErrorMsg').text = message;
    $w('#quizErrorMsg').show();
  } catch (e) {
    console.error('[StyleQuizResult] Could not display error message to user:', e, '| Message was:', message);
  }
}
