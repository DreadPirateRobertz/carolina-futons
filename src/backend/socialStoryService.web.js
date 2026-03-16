/**
 * @module socialStoryService
 * @description Backend service for Meta Graph API story posting.
 * Handles image upload, story creation, token management, and retry logic.
 * Designed for CI-triggered posting via scheduled GitHub Actions workflow.
 */

import { webMethod, Permissions } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { sanitize } from 'backend/utils/sanitize';

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Post a story image to Instagram/Facebook via Meta Graph API.
 * @param {Object} params
 * @param {string} params.imageUrl - Public URL of the story image (must be accessible to Meta)
 * @param {string} params.caption - Story caption text
 * @param {string} params.storyType - Story type for logging
 * @param {boolean} [params.dryRun=false] - If true, validate payload without posting
 * @returns {Promise<{success: boolean, storyId?: string, error?: string, dryRun?: boolean}>}
 */
export const postStory = webMethod(
  Permissions.Admin,
  async ({ imageUrl, caption, storyType, dryRun = false }) => {
    if (!imageUrl) return { success: false, error: 'imageUrl is required' };

    const sanitizedCaption = caption ? sanitize(String(caption), 2200) : '';

    let pageId, accessToken;
    try {
      pageId = await getSecret('META_PAGE_ID');
      accessToken = await getSecret('META_PAGE_ACCESS_TOKEN');
    } catch (err) {
      return { success: false, error: 'Failed to retrieve Meta API credentials from Wix Secrets' };
    }

    if (!pageId || !accessToken) {
      return { success: false, error: 'META_PAGE_ID or META_PAGE_ACCESS_TOKEN not configured' };
    }

    const payload = {
      url: imageUrl,
      caption: sanitizedCaption,
      published: true,
    };

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        payload: { ...payload, endpoint: `/${pageId}/photo_stories` },
      };
    }

    const endpoint = `${META_GRAPH_BASE}/${pageId}/photo_stories`;
    return postWithRetry(endpoint, accessToken, payload, storyType);
  }
);

/**
 * Check Meta Graph API token validity and page access.
 * @returns {Promise<{valid: boolean, expiresAt?: string, error?: string}>}
 */
export const checkTokenHealth = webMethod(
  Permissions.Admin,
  async () => {
    let accessToken;
    try {
      accessToken = await getSecret('META_PAGE_ACCESS_TOKEN');
    } catch {
      return { valid: false, error: 'Cannot retrieve META_PAGE_ACCESS_TOKEN' };
    }

    if (!accessToken) {
      return { valid: false, error: 'META_PAGE_ACCESS_TOKEN is empty' };
    }

    try {
      const debugUrl = `${META_GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(accessToken)}`;
      const response = await fetch(debugUrl, { method: 'GET' });
      const body = await response.json();

      if (body.data && body.data.is_valid) {
        const expiresAt = body.data.expires_at
          ? new Date(body.data.expires_at * 1000).toISOString()
          : 'never';
        return { valid: true, expiresAt };
      }
      return { valid: false, error: body.data?.error?.message || 'Token is invalid' };
    } catch (err) {
      return { valid: false, error: `Token check failed: ${err.message}` };
    }
  }
);

/**
 * Get posting schedule status — what stories are scheduled for today.
 * Pure function, no side effects.
 * @param {string} [dateStr] - ISO date string (defaults to today)
 * @returns {{date: string, dayOfWeek: number, scheduledTypes: string[]}}
 */
export const getScheduleStatus = webMethod(
  Permissions.Anyone,
  async (dateStr) => {
    const SCHEDULE = {
      0: [],              // Sunday
      1: ['did_you_know'],
      2: ['care_tip'],
      3: ['new_arrival'],
      4: ['did_you_know'],
      5: ['weekend_visit'],
      6: ['customer_spotlight'],
    };

    const d = dateStr ? new Date(dateStr) : new Date();
    return {
      date: d.toISOString().slice(0, 10),
      dayOfWeek: d.getDay(),
      scheduledTypes: [...(SCHEDULE[d.getDay()] || [])],
    };
  }
);

// ── Internal helpers ─────────────────────────────────────────────────

async function postWithRetry(endpoint, accessToken, payload, storyType, attempt = 1) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json();

    if (response.ok && body.id) {
      return { success: true, storyId: body.id };
    }

    const errorMsg = body.error?.message || `HTTP ${response.status}`;
    const isRateLimited = response.status === 429;
    const isServerError = response.status >= 500;

    if ((isRateLimited || isServerError) && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
      return postWithRetry(endpoint, accessToken, payload, storyType, attempt + 1);
    }

    return { success: false, error: errorMsg, status: response.status };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
      return postWithRetry(endpoint, accessToken, payload, storyType, attempt + 1);
    }
    return { success: false, error: `Network error: ${err.message}` };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
