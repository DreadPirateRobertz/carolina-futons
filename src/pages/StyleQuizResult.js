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
 * Quiz answers are passed via query params (?answers=<base64-encoded-json>)
 * or retrieved from session storage via wix-storage.
 */
import { getQuizRecommendations, getPersonalizedCopy } from 'backend/styleQuiz.web';
import { session } from 'wix-storage';

const ANSWERS_KEY = 'styleQuizAnswers';

/**
 * Initialize the Style Quiz result page.
 * Reads stored quiz answers, fetches recommendations + personalized copy in parallel,
 * and populates page elements.
 *
 * @param {Function} $w - Wix selector function
 */
export async function initStyleQuizResult($w) {
  // Show loading state
  try { $w('#quizLoadingIndicator').show(); } catch (e) {}
  try { $w('#quizResultsSection').collapse(); } catch (e) {}
  try { $w('#quizErrorMsg').hide(); } catch (e) {}

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
    _showError($w, 'Could not load your quiz answers. Please retake the quiz.');
    return;
  }

  // Fetch recommendations and personalized copy in parallel
  let recommendations, personalizedCopy;
  try {
    [recommendations, { copy: personalizedCopy }] = await Promise.all([
      getQuizRecommendations(answers),
      getPersonalizedCopy(answers),
    ]);
  } catch (e) {
    _showError($w, 'Could not load your recommendations. Please try again.');
    return;
  }

  // Hide loading, show results
  try { $w('#quizLoadingIndicator').hide(); } catch (e) {}

  if (!recommendations || recommendations.length === 0) {
    _showError($w, 'No matching products found. Try adjusting your quiz answers.');
    return;
  }

  // Populate personalized copy
  try { $w('#quizPersonalizedCopy').text = personalizedCopy; } catch (e) {}

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
  } catch (e) {}

  // Show results section
  try { $w('#quizResultsSection').expand(); } catch (e) {}
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
  try { $w('#quizLoadingIndicator').hide(); } catch (e) {}
  try { $w('#quizErrorMsg').text = message; } catch (e) {}
  try { $w('#quizErrorMsg').show(); } catch (e) {}
}
