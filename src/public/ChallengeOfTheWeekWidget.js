/**
 * @module ChallengeOfTheWeekWidget
 * @description Renders three homepage challenge sections:
 *
 * 1. Community collective challenge (CF-8lj8) — all members share one goal:
 *   #weeklyTitle        — Challenge title (e.g. "Community Challenge: 500 Orders!")
 *   #weeklyDesc         — Challenge description
 *   #weeklyProgress     — Progress text (e.g. "342 / 500")
 *   #weeklyProgressBar  — Progress bar element (width set as percentage)
 *   #weeklyReward       — Reward label (e.g. "Everyone earns 200 pts!")
 *   #weeklyTimer        — Time remaining (e.g. "3d 14h left")
 *   #weeklyContributors — Contributor count (e.g. "127 members contributing")
 *   #weeklyComplete     — Shown when challenge is complete, hidden otherwise
 *   #weeklyContainer    — Outer container (collapsed when no active challenge)
 *   #weeklyError        — Shown on fetch error
 *
 * 2. Featured individual Challenge of the Week (cf-rsr) — member's own progress:
 *   #cotwContainer      — Outer container (collapsed when no active challenge)
 *   #cotwTitle          — Challenge name
 *   #cotwDesc           — Challenge description
 *   #cotwProgressText   — Progress text (e.g. "2 / 5")
 *   #cotwProgressBar    — Progress bar (width as member completion %)
 *   #cotwReward         — Reward label (e.g. "Earn 150 pts!")
 *   #cotwCtaBtn         — CTA button (linked to ctaUrl; hidden when no URL)
 *   #cotwError          — Shown on fetch error
 *
 * 3. CMS-driven Challenge of the Week (cf-1he) — reads from challengeService:
 *   #cotw-section       — Outer section (collapsed on error or no challenge)
 *   #cotw-title         — Challenge title
 *   #cotw-description   — Challenge description
 *   #cotw-points        — Point reward label (e.g. "200 pts")
 *   #cotw-image         — Challenge image (collapsed when no imageUrl)
 *
 * CF-8lj8, cf-rsr, cf-1he
 */

import { getWeeklyChallenge as _defaultGetWeeklyChallenge, getActiveChallengeOfWeek as _defaultGetActiveChallengeOfWeek } from 'backend/gamificationEventReceiver.web';
import { getChallengeOfTheWeek as _defaultGetChallengeOfTheWeek } from 'backend/challengeService.web';

const TIMER_INTERVAL_MS = 60_000;

let _timerInterval;

/**
 * Format time remaining as "Nd Nh left" or "< 1h left".
 * @param {string|Date} expiresAt
 * @returns {string}
 */
function formatTimeRemaining(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return '< 1h left';
}

/**
 * @param {Object}   [opts]
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getWeeklyChallenge]
 * @param {Function} [opts.getActiveChallengeOfWeek]
 * @param {Function} [opts.getChallengeOfTheWeek]
 */
export async function initChallengeOfTheWeekWidget(opts = {}) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  const $w = opts.$w ?? globalThis.$w;
  const getWeeklyChallenge = opts.getWeeklyChallenge ?? _defaultGetWeeklyChallenge;
  const getActiveChallengeOfWeek = opts.getActiveChallengeOfWeek ?? _defaultGetActiveChallengeOfWeek;
  const getChallengeOfTheWeek = opts.getChallengeOfTheWeek ?? _defaultGetChallengeOfTheWeek;

  // Render all sections in parallel
  await Promise.all([
    _renderCommunityChallenge($w, getWeeklyChallenge),
    _renderFeaturedChallenge($w, getActiveChallengeOfWeek),
    _renderChallengeOfTheWeek($w, getChallengeOfTheWeek),
  ]);
}

async function _renderCommunityChallenge($w, getWeeklyChallenge) {

  let challenge;
  try {
    challenge = await getWeeklyChallenge();
  } catch (err) {
    console.error('[ChallengeOfTheWeekWidget] failed to load', err);
    try { $w('#weeklyError').show(); } catch {}
    try { $w('#weeklyContainer').collapse(); } catch {}
    return;
  }

  if (!challenge || challenge.error) {
    if (challenge?.error) {
      try { $w('#weeklyError').show(); } catch {}
    }
    try { $w('#weeklyContainer').collapse(); } catch {}
    return;
  }

  try { $w('#weeklyError').hide(); } catch {}
  try { $w('#weeklyContainer').expand(); } catch {}

  // Title & description
  try { $w('#weeklyTitle').text = challenge.title; } catch {}
  try { $w('#weeklyDesc').text = challenge.description ?? ''; } catch {}

  // Progress
  const current = challenge.currentTotal ?? 0;
  const target = challenge.targetCount || 1; // guard against 0 (division by zero)
  const pct = Math.min(Math.round((current / target) * 100), 100);

  try { $w('#weeklyProgress').text = `${current.toLocaleString()} / ${target.toLocaleString()}`; } catch {}
  try { $w('#weeklyProgressBar').style.width = `${pct}%`; } catch {}

  // Reward
  if (challenge.rewardPoints > 0) {
    try { $w('#weeklyReward').text = `Everyone earns ${challenge.rewardPoints.toLocaleString()} pts!`; } catch {}
  }

  // Contributors
  try {
    $w('#weeklyContributors').text = challenge.contributorCount === 1
      ? '1 member contributing'
      : `${challenge.contributorCount.toLocaleString()} members contributing`;
  } catch {}

  // Complete state
  if (challenge.isComplete) {
    try { $w('#weeklyComplete').show(); } catch {}
    try { $w('#weeklyTimer').text = 'Complete!'; } catch {}
  } else {
    try { $w('#weeklyComplete').hide(); } catch {}

    // Countdown timer
    if (_timerInterval) clearInterval(_timerInterval);
    try { $w('#weeklyTimer').text = formatTimeRemaining(challenge.expiresAt); } catch {}
    _timerInterval = setInterval(() => {
      try { $w('#weeklyTimer').text = formatTimeRemaining(challenge.expiresAt); } catch {}
    }, TIMER_INTERVAL_MS);
  }
}

async function _renderFeaturedChallenge($w, getActiveChallengeOfWeek) {
  let challenge;
  try {
    challenge = await getActiveChallengeOfWeek();
  } catch (err) {
    console.error('[ChallengeOfTheWeekWidget] featured challenge failed to load', err);
    try { $w('#cotwError').show(); } catch {}
    try { $w('#cotwContainer').collapse(); } catch {}
    return;
  }

  if (!challenge) {
    try { $w('#cotwContainer').collapse(); } catch {}
    return;
  }

  try { $w('#cotwError').hide(); } catch {}
  try { $w('#cotwContainer').expand(); } catch {}

  // Title & description
  try { $w('#cotwTitle').text = challenge.title; } catch {}
  try { $w('#cotwDesc').text = challenge.description ?? ''; } catch {}

  // Member progress bar
  const progress = challenge.progressValue ?? 0;
  const target = challenge.targetCount || 1; // guard division by zero
  const pct = Math.min(Math.round((progress / target) * 100), 100);

  try { $w('#cotwProgressText').text = `${progress.toLocaleString()} / ${target.toLocaleString()}`; } catch {}
  try { $w('#cotwProgressBar').style.width = `${pct}%`; } catch {}

  // Reward
  if (challenge.rewardPoints > 0) {
    try { $w('#cotwReward').text = `Earn ${challenge.rewardPoints.toLocaleString()} pts!`; } catch {}
  }

  // CTA button
  if (challenge.ctaUrl) {
    try {
      $w('#cotwCtaBtn').link = challenge.ctaUrl;
      $w('#cotwCtaBtn').show();
    } catch {}
  } else {
    try { $w('#cotwCtaBtn').hide(); } catch {}
  }
}

// ── Challenge of the Week — CMS-driven homepage section (cf-1he) ─────────────

async function _renderChallengeOfTheWeek($w, getChallengeOfTheWeek) {
  let result;
  try {
    result = await getChallengeOfTheWeek();
  } catch (err) {
    console.error('[ChallengeOfTheWeekWidget] getChallengeOfTheWeek failed:', err);
    try { $w('#cotw-section').collapse(); } catch {}
    return;
  }

  if (!result || !result.success || !result.challenge) {
    try { $w('#cotw-section').collapse(); } catch {}
    return;
  }

  const ch = result.challenge;

  try { $w('#cotw-section').expand(); } catch {}
  try { $w('#cotw-title').text = ch.title; } catch {}
  try { $w('#cotw-description').text = ch.description ?? ''; } catch {}
  try { $w('#cotw-points').text = `${ch.pointValue.toLocaleString()} pts`; } catch {}

  if (ch.imageUrl) {
    try { $w('#cotw-image').expand(); } catch {}
    try { $w('#cotw-image').src = ch.imageUrl; } catch {}
  } else {
    try { $w('#cotw-image').collapse(); } catch {}
  }
}
