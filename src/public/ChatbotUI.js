/**
 * @module ChatbotUI
 * @description Pure functions for the Gamification Chatbot UI.
 *
 * No direct Wix API calls — all side effects are handled by the page module
 * (Member Page.js) which calls these functions and applies the returned state
 * to Wix elements (#chatbotPanel, #chatbotInput, #chatbotSendBtn,
 * #chatbotResponseArea, #chatbotLimitDisplay).
 *
 * Phase 3 — companion to gamificationChatbot.web.js.
 */

const ERROR_MESSAGES = {
  auth_required:          'Sign in to use the style assistant.',
  assistant_unavailable:  'The assistant is temporarily unavailable. Please try again shortly.',
  rate_limit_exceeded:    'Too many requests — please wait a moment before trying again.',
  invalid_input:          'Please enter a message before sending.',
};

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/**
 * Formats a sessionHistory array into a display string for #chatbotResponseArea.
 * Each turn is rendered as "[role] content", joined with newlines.
 * The page module is responsible for writing this string to the Wix element.
 *
 * @param {Array<{role: string, content: string}>|null|undefined} history
 * @returns {string}
 */
export function formatThread(history) {
  if (!Array.isArray(history) || history.length === 0) return '';
  return history.map(turn => `[${turn.role}] ${turn.content}`).join('\n');
}

/**
 * Returns the limit indicator string for #chatbotLimitDisplay.
 * Negative or non-integer values are clamped to the nearest non-negative integer.
 * @param {number} remaining
 * @returns {string}  e.g. "3 messages remaining today" or "0 messages remaining today"
 */
export function formatLimitDisplay(remaining) {
  const n = Math.max(0, Math.floor(remaining));
  const word = n === 1 ? 'message' : 'messages';
  return `${n} ${word} remaining today`;
}

/**
 * State object when the chatbot feature flag is disabled.
 * @returns {{ chatbotPanel: string, chatbotComingSoon: string, inputDisabled: boolean }}
 */
export function buildComingSoonState() {
  return {
    chatbotPanel: 'hidden',
    chatbotComingSoon: 'visible',
    inputDisabled: true,
  };
}

/**
 * State object when the member has exhausted their daily quota.
 * @param {'messages'|'tokens'} limitType
 * @returns {{ inputDisabled: boolean, sendDisabled: boolean, limitText: string }}
 */
export function buildLimitReachedState(limitType) {
  void limitType; // both types share the same copy for now
  return {
    inputDisabled: true,
    sendDisabled: true,
    limitText: 'Daily limit reached — resets at midnight ET.',
  };
}

/**
 * State object for an error condition.
 * sendDisabled is always false so the member can retry after resolving the issue.
 *
 * @param {string} errorCode
 * @returns {{ errorText: string, sendDisabled: boolean }}
 */
export function buildErrorState(errorCode) {
  return {
    errorText: ERROR_MESSAGES[errorCode] ?? GENERIC_ERROR,
    sendDisabled: false,
  };
}

/**
 * State object while a Claude response is in flight.
 * @returns {{ sendDisabled: boolean, loadingVisible: boolean }}
 */
export function buildLoadingState() {
  return { sendDisabled: true, loadingVisible: true };
}

/**
 * State object when the chatbot is idle and ready for input.
 * @param {string} [limitDisplay]
 * @returns {{ sendDisabled: boolean, loadingVisible: boolean, limitDisplay?: string }}
 */
export function buildReadyState(limitDisplay) {
  const state = { sendDisabled: false, loadingVisible: false };
  if (limitDisplay !== undefined) state.limitDisplay = limitDisplay;
  return state;
}

/**
 * Returns true if animations should be skipped.
 * The page module passes the result of window.matchMedia('(prefers-reduced-motion: reduce)').matches
 * so this module stays testable without a browser environment.
 *
 * @param {boolean|null|undefined} prefersReducedMotion
 * @returns {boolean}
 */
export function shouldSkipAnimation(prefersReducedMotion) {
  return prefersReducedMotion === true;
}
