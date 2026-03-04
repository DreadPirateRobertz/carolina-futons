// Style Quiz.js - "Find Your Perfect Futon" interactive style quiz
// 5-step quiz flow with progress indicator, personalized product recommendations
import { getQuizRecommendations, getQuizOptions } from 'backend/styleQuiz.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers';
import { colors } from 'public/designTokens.js';

const state = {
  step: 0,
  totalSteps: 5,
  answers: {},
  options: null,
  results: null,
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
  trackEvent('page_view', { page: 'style-quiz' });

  // Load quiz options from backend
  try {
    state.options = await getQuizOptions();
  } catch (e) {
    state.options = null;
  }

  initQuiz();
});

// ── Quiz Initialization ────────────────────────────────────────────

function initQuiz() {
  // Hide results section initially
  try { $w('#quizResults').collapse(); } catch (e) {}
  try { $w('#quizLoadingState').collapse(); } catch (e) {}

  // Show quiz section
  try { $w('#quizSection').expand(); } catch (e) {}

  // Wire navigation buttons with keyboard accessibility
  try { makeClickable($w('#quizNextBtn'), () => goNext(), { ariaLabel: 'Next step' }); } catch (e) {}
  try { makeClickable($w('#quizBackBtn'), () => goBack(), { ariaLabel: 'Previous step' }); } catch (e) {}
  try { makeClickable($w('#quizRestartBtn'), () => restartQuiz(), { ariaLabel: 'Restart quiz' }); } catch (e) {}

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
  try { $w('#quizResults').collapse(); } catch (e) {}
  try { $w('#quizSection').expand(); } catch (e) {}
  renderStep();
  trackEvent('quiz_restart');
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

    try { $w('#quizLoadingState').collapse(); } catch (e) {}

    if (!results || results.length === 0) {
      renderNoResults();
    } else {
      renderResults(results);
    }
  } catch (err) {
    console.error('Quiz recommendation error:', err);
    try { $w('#quizLoadingState').collapse(); } catch (e) {}
    renderNoResults();
  }
}

function renderResults(results) {
  try { $w('#quizResults').expand(); } catch (e) {}

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
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      const { product, score, reason } = itemData;

      $item('#resultProductName').text = product.name || 'Futon';
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

    repeater.data = results.map((r, i) => ({
      ...r,
      _id: `result-${i}`,
    }));
  } catch (e) {}

  announce($w, `Found ${results.length} personalized recommendations`);
  trackEvent('quiz_results_shown', { count: results.length });
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
