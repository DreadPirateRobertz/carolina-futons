/**
 * leaderboard-http.js — POST /_functions/getLeaderboard
 *
 * Extracted from http-functions.js to work around a vitest SSR-transform
 * module-truncation issue (functions past ~60 KB in http-functions.js are
 * invisible to vitest). The function is re-exported from http-functions.js
 * so Wix routing is unchanged.
 *
 * Mobile LeaderboardScreen calls this endpoint via wixClient.post().
 * Bead: cfutons_mobile-rm5
 */

import { ok, serverError, badRequest, unauthorized } from 'wix-http-functions';
import { currentMember } from 'wix-members-backend';
import wixData from 'wix-data';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (obj) => JSON.stringify(obj);

/**
 * POST /_functions/getLeaderboard
 *
 * Body: { period?: 'allTime' | 'weekly', limit?: number (1–50, default 20) }
 *
 * Returns: { entries: LeaderboardEntry[], currentUserRank: number | null }
 * where LeaderboardEntry = { memberId, displayName, points, tier, rank }
 */
export async function post_getLeaderboard(request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  let member;
  try {
    member = await currentMember.getMember();
  } catch (err) {
    return serverError({ body: json({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
  if (!member) {
    return unauthorized({ body: json({ error: 'Authentication required' }), headers: JSON_HEADERS });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(request.body || '{}');
  } catch (_) {
    body = {};
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const period = body.period ?? 'allTime';
  const rawLimit = body.limit !== undefined ? Number(body.limit) : 20;

  if (!['allTime', 'weekly'].includes(period)) {
    return badRequest({
      body: json({ error: 'Invalid period — must be allTime or weekly' }),
      headers: JSON_HEADERS,
    });
  }
  if (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > 50) {
    return badRequest({
      body: json({ error: 'limit must be between 1 and 50' }),
      headers: JSON_HEADERS,
    });
  }
  const limit = Math.floor(rawLimit);

  // ── Query ─────────────────────────────────────────────────────────────────
  try {
    const result = await wixData
      .query('MemberPoints')
      .eq('leaderboardOptIn', true)
      .descending('totalPoints')
      .limit(limit)
      .find({ suppressAuth: true });

    const memberId = member._id;
    let currentUserRank = null;

    const entries = result.items.map((item, idx) => {
      const rank = idx + 1;
      if (item.memberId === memberId) currentUserRank = rank;
      return {
        memberId: item.memberId,
        displayName: item.displayName ?? null,
        points: item.totalPoints ?? 0,
        tier: item.tier ?? null,
        rank,
      };
    });

    return ok({ body: json({ entries, currentUserRank }), headers: JSON_HEADERS });
  } catch (err) {
    return serverError({ body: json({ error: 'Internal server error' }), headers: JSON_HEADERS });
  }
}
