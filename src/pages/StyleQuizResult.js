// StyleQuizResult.js — /style-quiz/result/[shareId]
// Displays a shared Style Quiz result publicly. Sets OG meta tags for social sharing.
import { getSharedResult } from 'backend/styleQuizService.web';
import { initPageSeo } from 'public/pageSeo.js';

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
    // Wix dynamic page: share ID is the last path segment
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
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
}
