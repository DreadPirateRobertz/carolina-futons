// Style Quiz.js - "Find Your Perfect Futon" interactive style quiz
// 5-step quiz flow with progress indicator, personalized product recommendations
// Email gate appears after Q3 (stylePreference) with optional skip; lead captured to CRM.
import { getQuizRecommendations, getQuizOptions, captureQuizLead } from 'backend/styleQuiz.web';
import { getStyleQuizSchema } from 'backend/seoHelpers.web';
import { saveQuizResult, getMyResult } from 'backend/styleQuizService.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers';
import { colors } from 'public/designTokens.js';
import { initPageSeo } from 'public/pageSeo.js';
import { buildGridAlt } from 'public/productPageUtils.js';

// Email gate shown after this step index (0-based). Step 2 = Q3 stylePreference.
const EMAIL_GATE_AFTER_STEP = 2;

const state = {
  step: 0,
  totalSteps: 5,
  answers: {},
  options: null,
  results: null,
  emailCaptured: false, // true once email submitted or skipped
  priorResult: null,   // S4: persisted result from a previous visit
  shareUrl: null,      // S4: share URL after saving
};

const STEPS = [
  { key: 'roomType', title: 'Where will your futon live?', subtitle: 'Pick the room it\u2019s going in' },
  { key: 'primaryUse', title: 'How will you use it most?', subtitle: 'This helps us find the right comfort level' },
  { key: 'stylePreference', title: 'What\u2019s your style?', subtitle: 'We\u2019ll match your aesthetic' },
  { key: 'sizeNeeds', title: 'What size do you need?', subtitle: 'Based on your space and how many sleepers' },
  { key: 'budgetRange', title: 'What\u2019s your budget?', subtitle: 'We have great options at every price point' },
];

$w.onReady(async function () {
  initBackToTop($w);
  initPageSeo('styleQuiz');
  injectQuizSchema();
  trackEvent('page_view', { page: 'style-quiz' });

  // Load quiz options from backend
  try {
    state.options = await getQuizOptions();
  } catch (e) {
    state.options = null;
  }

  // S4: Check for a prior result and show retake UI if found
  try {
    const prior = await getMyResult();
    if (prior && !prior.error) {
      state.priorResult = prior;
      renderPriorResultBanner(prior);
      return; // show banner; initQuiz() called only if member chooses to retake
    }
  } catch (e) {
    // Not a member or lookup failed — show the quiz normally
  }

  initQuiz();
});

// ── SEO: JSON-LD Schema ────────────────────────────────────────────

async function injectQuizSchema() {
  try {
    const { head } = await import('wix-seo-frontend');
    const schemaJson = await getStyleQuizSchema();
    if (schemaJson) {
      head.setStructuredData([JSON.parse(schemaJson)]);
    }
  } catch (e) {
    // Non-critical — page renders without schema
  }
}

// ── Quiz Initialization ────────────────────────────────────────────

function initQuiz() {
  // Hide results section initially
  try { $w('#quizResults').collapse(); } catch (e) {}
  try { $w('#quizLoadingState').collapse(); } catch (e) {}
  try { $w('#quizEmailSection').collapse(); } catch (e) {}

  // Show quiz section
  try { $w('#quizSection').expand(); } catch (e) {}

  trackEvent('quiz_start', {});

  // Wire navigation buttons with keyboard accessibility
  try { makeClickable($w('#quizNextBtn'), () => goNext(), { ariaLabel: 'Next step' }); } catch (e) {}
  try { makeClickable($w('#quizBackBtn'), () => goBack(), { ariaLabel: 'Previous step' }); } catch (e) {}
  try { makeClickable($w('#quizRestartBtn'), () => restartQuiz(), { ariaLabel: 'Restart quiz' }); } catch (e) {}

  // Wire email gate buttons
  try { makeClickable($w('#quizEmailSubmitBtn'), () => submitEmailGate(), { ariaLabel: 'Submit email and continue' }); } catch (e) {}
  try { makeClickable($w('#quizEmailSkipBtn'), () => skipEmailGate(), { ariaLabel: 'Skip and continue' }); } catch (e) {}

  renderStep();
}

// ── Step Rendering ─────────────────────────────────────────────────

function renderStep() {
  const stepInfo = STEPS[state.step];
  if (!stepInfo) return;

  // Update progress
  const progress = Math.round(((state.step + 1) / state.totalSteps) * 100);
  try { $w('#quizProgressBar').value = progress; } catch (e) {}
  try { $w('#quizProgressText').text = `Step ${state.step + 1} of ${state.totalSteps}`; } catch (e) {}

  // Update title and subtitle
  try { $w('#quizStepTitle').text = stepInfo.title; } catch (e) {}
  try { $w('#quizStepSubtitle').text = stepInfo.subtitle; } catch (e) {}

  // Show/hide back button
  try {
    if (state.step === 0) {
      $w('#quizBackBtn').collapse();
    } else {
      $w('#quizBackBtn').expand();
    }
  } catch (e) {}

  // Update next button text
  try {
    $w('#quizNextBtn').label = state.step === state.totalSteps - 1
      ? 'See My Recommendations'
      : 'Next';
  } catch (e) {}

  // S2: disable next button until an option is selected for this step;
  // re-enable immediately if step already has an answer (e.g. navigating back to a completed step).
  // State access is outside the try-catch so a state corruption error surfaces rather than vanishing.
  // Must run before renderOptions() so the initial button state is settled before item-ready handlers fire.
  if (state.answers[stepInfo.key]) {
    try { $w('#quizNextBtn').enable(); } catch (e) {}
  } else {
    try { $w('#quizNextBtn').disable(); } catch (e) {}
  }

  // Render options for this step
  renderOptions(stepInfo.key);

  // Announce for screen readers
  announce($w, `${stepInfo.title}. Step ${state.step + 1} of ${state.totalSteps}`);
}

function renderOptions(key) {
  try {
    const repeater = $w('#quizOptionsRepeater');
    if (!repeater || !state.options) return;

    const optionsMap = {
      roomType: state.options.roomTypes,
      primaryUse: state.options.primaryUses,
      stylePreference: state.options.stylePreferences,
      sizeNeeds: state.options.sizeOptions,
      budgetRange: state.options.budgetRanges,
    };

    const options = optionsMap[key] || [];

    repeater.onItemReady(($item, itemData) => {
      $item('#optionLabel').text = itemData.label;
      try {
        $item('#optionDescription').text = itemData.description || '';
      } catch (e) {}

      // Highlight if already selected
      const isSelected = state.answers[key] === itemData.value;
      try {
        $item('#optionContainer').style.backgroundColor = isSelected ? colors.mountainBlue : colors.white;
      } catch (e) {}
      try {
        $item('#optionLabel').style.color = isSelected ? colors.white : colors.espresso;
      } catch (e) {}

      // ARIA + keyboard accessibility
      try { $item('#optionContainer').accessibility.role = 'radio'; } catch (e) {}
      try { $item('#optionContainer').accessibility.ariaLabel = itemData.label; } catch (e) {}
      try { $item('#optionContainer').accessibility.ariaChecked = isSelected; } catch (e) {}
      try { $item('#optionContainer').accessibility.tabIndex = 0; } catch (e) {}

      // Selection handler (click + keyboard Enter/Space)
      const selectOption = () => {
        state.answers[key] = itemData.value;
        trackEvent('quiz_answer', { step: key, answer: itemData.value });
        try { $w('#quizNextBtn').enable(); } catch (e) {} // S2: answer recorded, allow advancing
        renderOptions(key); // re-render to update selection highlight
      };
      $item('#optionContainer').onClick(selectOption);
      try {
        $item('#optionContainer').onKeyPress((event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            try { event.preventDefault?.(); } catch (e) {}
            selectOption();
          }
        });
      } catch (e) {}
    });

    repeater.data = options.map((opt, i) => ({ ...opt, _id: `opt-${i}` }));
  } catch (e) {}
}

// ── Navigation ─────────────────────────────────────────────────────

function goNext() {
  const stepInfo = STEPS[state.step];

  // Validate — must select an option before proceeding
  if (!state.answers[stepInfo.key]) {
    announce($w, 'Please select an option before continuing');
    try { $w('#quizValidation').text = 'Please select an option'; } catch (e) {}
    try { $w('#quizValidation').expand(); } catch (e) {}
    return;
  }
  try { $w('#quizValidation').collapse(); } catch (e) {}

  // Show email gate after Q3 (step index EMAIL_GATE_AFTER_STEP), once per session
  if (state.step === EMAIL_GATE_AFTER_STEP && !state.emailCaptured) {
    showEmailGate();
    return;
  }

  if (state.step < state.totalSteps - 1) {
    state.step++;
    renderStep();
  } else {
    submitQuiz();
  }
}

function goBack() {
  if (state.step > 0) {
    state.step--;
    renderStep();
  }
}

function restartQuiz() {
  state.step = 0;
  state.answers = {};
  state.results = null;
  state.emailCaptured = false;
  try { $w('#quizResults').collapse(); } catch (e) {}
  try { $w('#quizEmailSection').collapse(); } catch (e) {}
  try { $w('#quizSection').expand(); } catch (e) {}
  renderStep();
  trackEvent('quiz_restart');
}

// ── Email Gate ─────────────────────────────────────────────────────

function showEmailGate() {
  try { $w('#quizSection').collapse(); } catch (e) {}
  try { $w('#quizEmailSection').expand(); } catch (e) {}
  try { $w('#quizEmailInput').value = ''; } catch (e) {}
  try { $w('#quizEmailError').collapse(); } catch (e) {}
  announce($w, 'Almost there! Enter your email to see your personalized recommendations.');
  trackEvent('quiz_email_gate_shown', { step: state.step });
}

async function submitEmailGate() {
  const email = (() => {
    try { return ($w('#quizEmailInput').value || '').trim(); } catch (e) { return ''; }
  })();

  if (!email) {
    try { $w('#quizEmailError').text = 'Please enter your email'; } catch (e) {}
    try { $w('#quizEmailError').expand(); } catch (e) {}
    announce($w, 'Please enter your email address');
    return;
  }

  // Basic client-side format check before hitting the backend
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    try { $w('#quizEmailError').text = 'Please enter a valid email address'; } catch (e) {}
    try { $w('#quizEmailError').expand(); } catch (e) {}
    announce($w, 'Please enter a valid email address');
    return;
  }

  try { $w('#quizEmailError').collapse(); } catch (e) {}
  try { $w('#quizEmailSubmitBtn').disable(); } catch (e) {}

  // Non-blocking CRM capture — quiz continues regardless of outcome
  captureQuizLead(email, {
    roomType: state.answers.roomType,
    primaryUse: state.answers.primaryUse,
    stylePreference: state.answers.stylePreference,
  }).catch(() => {});

  trackEvent('email_captured', { source: 'style_quiz', step: state.step });

  state.emailCaptured = true;
  try { $w('#quizEmailSubmitBtn').enable(); } catch (e) {}
  advanceFromEmailGate();
}

function skipEmailGate() {
  state.emailCaptured = true;
  trackEvent('quiz_email_gate_skipped', { step: state.step });
  advanceFromEmailGate();
}

function advanceFromEmailGate() {
  try { $w('#quizEmailSection').collapse(); } catch (e) {}
  try { $w('#quizSection').expand(); } catch (e) {}
  state.step++;
  renderStep();
}

// ── Submit & Results ───────────────────────────────────────────────

async function submitQuiz() {
  // Show loading state
  try { $w('#quizSection').collapse(); } catch (e) {}
  try { $w('#quizLoadingState').expand(); } catch (e) {}
  try { $w('#quizLoadingText').text = 'Finding your perfect match\u2026'; } catch (e) {}
  announce($w, 'Finding your perfect futon match');

  trackEvent('quiz_submit', { answers: state.answers });

  try {
    const results = await getQuizRecommendations(state.answers);
    state.results = results;
    trackEvent('quiz_complete', { answers: state.answers, resultCount: results ? results.length : 0 });

    try { $w('#quizLoadingState').collapse(); } catch (e) {}

    if (!results || results.length === 0) {
      renderNoResults();
    } else {
      renderResults(results);

      // S4: Persist result and surface share URL for members
      const profile = buildStyleProfile(state.answers);
      saveAndShowShareUrl(state.answers, profile.title);

      // CF-009p: Registration gate for non-logged-in visitors
      import('public/StyleQuizRegistrationGate.js').then(({ initStyleQuizRegistrationGate }) => {
        initStyleQuizRegistrationGate({
          onRegistered: async (memberId) => {
            // Save quiz result for the newly registered member
            saveAndShowShareUrl(state.answers, profile.title);
            // Award 100 bonus points
            try {
              const { receiveGamificationEvent } = await import('backend/gamificationEventReceiver.web');
              await receiveGamificationEvent('gamification_quiz_signup_bonus', {}, memberId);
            } catch (_) {}
            trackEvent('quiz_registration_complete', { source: 'style-quiz' });
          },
        });
      }).catch(() => {});
    }
  } catch (err) {
    console.error('Quiz recommendation error:', err);
    try { $w('#quizLoadingState').collapse(); } catch (e) {}
    renderNoResults();
  }
}

function renderResults(results) {
  try { $w('#quizResults').expand(); } catch (e) {}

  // Style profile header (S4)
  renderStyleProfileHeader(state.answers);

  // Results header
  try {
    $w('#resultsTitle').text = `Your Top ${results.length} Match${results.length !== 1 ? 'es' : ''}`;
  } catch (e) {}
  try {
    $w('#resultsSubtitle').text = 'Based on your preferences, we think you\u2019ll love these';
  } catch (e) {}

  // Results repeater
  try {
    const repeater = $w('#resultsRepeater');
    if (repeater) {
      repeater.onItemReady(($item, itemData) => {
        const { product, score, reason } = itemData;

        try { $item('#resultProductName').text = product.name || 'Futon'; } catch (e) {}
        try { $item('#resultProductPrice').text = product.formattedPrice || `$${(product.price || 0).toFixed(2)}`; } catch (e) {}
        try { $item('#resultMatchReason').text = reason || ''; } catch (e) {}

        // Match score badge
        try {
          const matchLabel = score >= 80 ? 'Top Pick' : score >= 60 ? 'Great Match' : 'Good Option';
          $item('#resultMatchBadge').text = matchLabel;
        } catch (e) {}

        // Product image
        try {
          if (product.mainMedia) {
            $item('#resultProductImage').src = product.mainMedia;
            $item('#resultProductImage').alt = buildGridAlt(product);
          }
        } catch (e) {}

        // View product link
        try {
          $item('#resultViewBtn').onClick(() => {
            trackEvent('quiz_result_click', { productId: product._id, productName: product.name, score });
            trackEvent('recommendation_click', { productId: product._id, productName: product.name, score });
            const slug = product.slug || product._id;
            import('wix-location-frontend').then(loc => loc.to(`/product-page/${slug}`));
          });
        } catch (e) {}

        // ARIA
        try { $item('#resultProductName').accessibility.role = 'heading'; } catch (e) {}
      });

      repeater.data = results.map((r, i) => ({ ...r, _id: `result-${i}` }));
    }
  } catch (e) {}

  // S4: quizProductsRepeater — editor-wired product recommendations repeater
  try {
    const quizProductsRepeater = $w('#quizProductsRepeater');
    if (quizProductsRepeater) {
      quizProductsRepeater.onItemReady(($item, itemData) => {
        const { product, score, reason } = itemData;

        try { $item('#resultProductName').text = product.name || 'Futon'; } catch (e) {}
        try { $item('#resultProductPrice').text = product.formattedPrice || `$${(product.price || 0).toFixed(2)}`; } catch (e) {}
        try { $item('#resultMatchReason').text = reason || ''; } catch (e) {}

        // Match score badge
        try {
          const matchLabel = score >= 80 ? 'Top Pick' : score >= 60 ? 'Great Match' : 'Good Option';
          $item('#resultMatchBadge').text = matchLabel;
        } catch (e) {}

        // Product image
        try {
          if (product.mainMedia) {
            $item('#resultProductImage').src = product.mainMedia;
            $item('#resultProductImage').alt = buildGridAlt(product);
          }
        } catch (e) {}

        // View product link
        try {
          $item('#resultViewBtn').onClick(() => {
            trackEvent('quiz_result_click', { productId: product._id, productName: product.name, score });
            const slug = product.slug || product._id;
            import('wix-location-frontend').then(loc => loc.to(`/product-page/${slug}`));
          });
        } catch (e) {}

        // ARIA
        try { $item('#resultProductName').accessibility.role = 'heading'; } catch (e) {}
      });

      quizProductsRepeater.data = results.map((r, i) => ({ ...r, _id: `result-${i}` }));
    }
  } catch (e) {}

  announce($w, `Found ${results.length} personalized recommendations`);
  trackEvent('quiz_results_shown', { count: results.length });

  // Email capture — wire tracking for the results section email form
  try {
    $w('#emailCaptureBtn').onClick(() => {
      const email = ($w('#emailInput').value || '').trim();
      if (email) {
        trackEvent('email_captured', { source: 'quiz-results' });
      }
    });
  } catch (e) {}
}

// ── Style Profile Header (S4) ───────────────────────────────────────

/**
 * Build a human-readable style profile from quiz answers.
 * Returns { title, description, tags } for display in the results header.
 */
export function buildStyleProfile(answers) {
  const roomLabels = {
    'living-room': 'Living Room',
    'guest-room': 'Guest Room',
    'dorm': 'Dorm / Small Space',
    'office': 'Home Office',
    'bedroom': 'Bedroom',
  };
  const useLabels = {
    'sitting': 'Sitting',
    'sleeping': 'Sleeping',
    'both': 'Sitting & Sleeping',
  };
  const styleLabels = {
    'modern': 'Modern',
    'rustic': 'Rustic',
    'classic': 'Classic',
  };
  const budgetLabels = {
    'under-500': 'Under $500',
    '500-1000': '$500–$1,000',
    '1000-2000': '$1,000–$2,000',
    'over-2000': 'Over $2,000',
  };

  const style = styleLabels[answers.stylePreference] || '';
  const room = roomLabels[answers.roomType] || '';
  const use = useLabels[answers.primaryUse] || '';
  const budget = budgetLabels[answers.budgetRange] || '';

  const title = style && room ? `Your ${style} ${room} Style` : 'Your Style Profile';
  const descParts = [];
  if (style) descParts.push(`${style} aesthetic`);
  if (room) descParts.push(`${room.toLowerCase()}`);
  if (use) descParts.push(`${use.toLowerCase()}`);
  if (budget) descParts.push(`budget: ${budget}`);

  const description = descParts.length > 0
    ? descParts.join(' \u2022 ')
    : 'Personalized to your preferences';

  return { title, description, tags: [style, room, use, budget].filter(Boolean) };
}

function renderStyleProfileHeader(answers) {
  if (!answers || Object.keys(answers).length === 0) return;
  const profile = buildStyleProfile(answers);
  try { $w('#styleProfileTitle').text = profile.title; } catch (e) {}
  try { $w('#styleProfileDescription').text = profile.description; } catch (e) {}
  try { $w('#styleProfileSection').expand(); } catch (e) {}
}

// ── S4: Prior Result Banner ─────────────────────────────────────────

/**
 * Show the "Your Style: [tag]" banner when a member has a prior result.
 * Wires the retake button to dismiss the banner and start the quiz fresh.
 */
function renderPriorResultBanner(prior) {
  try { $w('#quizSection').collapse(); } catch (e) {}
  try { $w('#priorResultBanner').expand(); } catch (e) {}
  try { $w('#priorResultTag').text = prior.resultTag || 'Your Style Profile'; } catch (e) {}

  if (prior.shareUrl) {
    try {
      $w('#priorShareUrl').text = prior.shareUrl;
      $w('#priorCopyLinkBtn').onClick(() => {
        try { navigator.clipboard?.writeText(prior.shareUrl); } catch (e) {}
        try { $w('#priorCopyConfirm').expand(); } catch (e) {}
        trackEvent('quiz_share_copy', { source: 'prior_banner' });
      });
    } catch (e) {}
  }

  try {
    $w('#priorRetakeBtn').onClick(() => {
      try { $w('#priorResultBanner').collapse(); } catch (e) {}
      state.priorResult = null;
      initQuiz();
      trackEvent('quiz_retake');
    });
  } catch (e) {}

  announce($w, `Your style: ${prior.resultTag || 'profile found'}. Take the quiz again to update it.`);
  trackEvent('quiz_prior_result_shown', { resultTag: prior.resultTag });
}

// ── S4: Share URL ───────────────────────────────────────────────────

/**
 * Persist the quiz result and show the shareable URL in the results section.
 */
async function saveAndShowShareUrl(answers, resultTag) {
  try {
    const saved = await saveQuizResult(answers, resultTag);
    if (saved && saved.shareUrl) {
      state.shareUrl = saved.shareUrl;
      try { $w('#shareUrlText').text = saved.shareUrl; } catch (e) {}
      try { $w('#shareSection').expand(); } catch (e) {}
      try {
        $w('#copyShareLinkBtn').onClick(() => {
          try { navigator.clipboard?.writeText(saved.shareUrl); } catch (e) {}
          try { $w('#copyConfirm').expand(); } catch (e) {}
          trackEvent('quiz_share_copy', { source: 'results' });
        });
      } catch (e) {}
      trackEvent('quiz_result_saved', { resultTag });
    }
  } catch (e) {
    // Not a member or save failed — sharing not available, quiz still works
  }
}

function renderNoResults() {
  try { $w('#quizResults').expand(); } catch (e) {}
  try { $w('#resultsTitle').text = 'No exact matches found'; } catch (e) {}
  try {
    $w('#resultsSubtitle').text = 'Try adjusting your preferences, or browse our full collection';
  } catch (e) {}
  try { $w('#resultsBrowseBtn').expand(); } catch (e) {}
  try {
    $w('#resultsBrowseBtn').onClick(() => {
      import('wix-location-frontend').then(loc => loc.to('/shop-main'));
    });
  } catch (e) {}

  announce($w, 'No exact matches found. Browse our full collection.');
}
