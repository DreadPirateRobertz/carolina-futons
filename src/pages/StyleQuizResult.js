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

const ANSWERS_KEY = 'styleQuizAnswers';

/** Safely run a Wix element operation, swallowing missing-element errors. */
function safeEl($w, selector, fn) {
  try { fn($w(selector)); } catch (_) {}
}

/**
 * Initialize the Style Quiz result page.
 * Reads stored quiz answers, fetches recommendations + personalized copy in parallel,
 * and populates page elements.
 *
 * @param {Function} $w - Wix selector function
 */
export async function initStyleQuizResult($w) {
  // Show loading state
  safeEl($w, '#quizLoadingIndicator', el => el.show());
  safeEl($w, '#quizResultsSection', el => el.collapse());
  safeEl($w, '#quizErrorMsg', el => el.hide());

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
  safeEl($w, '#quizLoadingIndicator', el => el.hide());

  if (!recommendations || recommendations.length === 0) {
    _showError($w, 'No matching products found. Try adjusting your quiz answers.');
    return;
  }

  // Populate personalized copy
  safeEl($w, '#quizPersonalizedCopy', el => { el.text = personalizedCopy; });

  // Populate recommendations repeater
  safeEl($w, '#quizRepeater', el => {
    el.data = recommendations.map(r => ({
      _id: r.product._id,
      name: r.product.name,
      price: r.product.formattedPrice,
      image: r.product.mainMedia,
      slug: r.product.slug,
      reason: r.reason,
      score: r.score,
    }));
  });

  // Show results section
  safeEl($w, '#quizResultsSection', el => el.expand());
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
  safeEl($w, '#quizLoadingIndicator', el => el.hide());
  safeEl($w, '#quizErrorMsg', el => { el.text = message; });
  safeEl($w, '#quizErrorMsg', el => el.show());
}
