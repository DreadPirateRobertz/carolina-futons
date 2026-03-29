/**
 * @module chatbotService
 * @description Pre-sale anonymous chatbot — Claude-powered product expert.
 *
 * Available to any visitor (Permissions.Anyone) — no login required.
 * Sessions are keyed by a caller-supplied sessionId (opaque string, e.g. a UUID
 * generated client-side). Conversation history is stored in the ChatSessions CMS
 * collection and expires after 24 hours via a scheduled cleanup.
 *
 * @setup (manual steps required before first use)
 * CMS collections:
 *   ChatSessions (sessionId, sessionHistory, messageCount, createdAt, lastMessageAt)
 *   ChatbotDailyStats (date, sessionCount)
 * Secrets:
 *   CHATBOT_ENABLED — must be exactly the string 'true' to enable; any other value disables
 *   ANTHROPIC_API_KEY (shared with gamificationChatbot)
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';
import {
  buildSystemPrompt,
  buildCatalogSummary,
  findSuggestedProducts,
  MAX_CATALOG_PRODUCTS,
} from 'backend/utils/chatbotContext';

const CHAT_SESSIONS   = 'ChatSessions';
const DAILY_STATS     = 'ChatbotDailyStats';
const CLAUDE_API_URL  = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL    = 'claude-sonnet-4-6';
const CLAUDE_MAX_TOKENS = 400;
const CLAUDE_ANTHROPIC_VERSION = '2023-06-01';

const MAX_MESSAGES_PER_SESSION = 20;
const MAX_SESSIONS_PER_DAY = 100;
const INPUT_CHAR_LIMIT = 500;
const SESSION_HISTORY_MAX_TURNS = 10;

// ---------------------------------------------------------------------------
// Internal helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/** @internal */
export function _trimHistory(history) {
  if (history.length <= SESSION_HISTORY_MAX_TURNS) return history;
  return history.slice(history.length - SESSION_HISTORY_MAX_TURNS);
}

/** @internal */
export function _getTodayUTC() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Call the Claude API and return parsed JSON, or null on non-ok response.
 * Logs the HTTP status and error body on non-ok so operators can diagnose
 * API key issues and rate limits.
 * @internal
 */
export async function _callClaude(messages, systemPrompt, apiKey) {
  const { fetch } = await import('wix-fetch');
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': CLAUDE_ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });
  if (!response.ok) {
    let errBody = '';
    try { errBody = await response.text(); } catch (_) { /* ignore */ }
    console.error(`[chatbotService] Claude API error ${response.status}:`, errBody);
    return null;
  }
  return response.json();
}

/** @internal — fetch up to MAX_CATALOG_PRODUCTS for context */
export async function _fetchProductCatalog() {
  try {
    const { products } = await import('wix-stores-backend');
    const result = await products.queryProducts().limit(MAX_CATALOG_PRODUCTS).find();
    return (result.items || []).map(p => ({
      name: p.name || '',
      price: typeof p.price?.formatted === 'string'
        ? parseFloat(p.price.formatted.replace(/[^0-9.]/g, ''))
        : (typeof p.price === 'number' ? p.price : 0),
      description: p.description || '',
      slug: p.slug || '',
    }));
  } catch (err) {
    console.warn('[chatbotService] product catalog fetch failed — chatbot will respond without product context:', err?.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// webMethod
// ---------------------------------------------------------------------------

/**
 * Send a message to the pre-sale chatbot and receive a reply.
 *
 * @param {string} sessionId   Caller-generated opaque session identifier (UUID format expected).
 * @param {string} userMessage The visitor's message (max 500 chars after sanitization).
 * @returns {Promise<
 *   | { error: string }
 *   | { enabled: false }
 *   | { limitReached: true }
 *   | { reply: string, suggestedProducts: Array<{name:string,slug:string|null,price:number|null}>, messagesRemaining: number }
 * >}
 */
export const sendMessage = webMethod(
  Permissions.Anyone,
  async (sessionId, userMessage) => {
    // 1. Fetch feature flag and API key in parallel; fail fast if either is absent
    let flagEnabled = false;
    let apiKey;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      const [flag, key] = await Promise.all([
        getSecret('CHATBOT_ENABLED'),
        getSecret('ANTHROPIC_API_KEY'),
      ]);
      flagEnabled = flag === 'true';
      apiKey = key;
    } catch (err) {
      console.warn('[chatbotService] secrets fetch failed:', err?.message);
      flagEnabled = false;
    }
    if (!flagEnabled) return { enabled: false };

    // 2. Validate sessionId
    const cleanSessionId = validateId(sessionId, 64);
    if (!cleanSessionId) return { error: 'invalid_session' };

    // 3. Sanitize + validate user message
    const sanitized = sanitize(userMessage, INPUT_CHAR_LIMIT);
    if (!sanitized) return { error: 'invalid_input' };

    // 4. Load or create ChatSessions record
    let sessionRecord = null;
    try {
      const res = await wixData.query(CHAT_SESSIONS)
        .eq('sessionId', cleanSessionId)
        .limit(1)
        .find();
      sessionRecord = res.items[0] || null;
    } catch (err) {
      console.error('[chatbotService] session query failed:', err?.message);
      return { error: 'assistant_unavailable' };
    }

    const now = new Date();
    const todayUTC = _getTodayUTC();

    // 5. Per-session message limit
    if (sessionRecord && (sessionRecord.messageCount || 0) >= MAX_MESSAGES_PER_SESSION) {
      return { limitReached: true };
    }

    // 6. Daily session cap — only checked when creating a brand-new session.
    //    Single query for both the cap check and the increment (avoids race window).
    if (!sessionRecord) {
      let statsRecord = null;
      try {
        const statsRes = await wixData.query(DAILY_STATS)
          .eq('date', todayUTC)
          .limit(1)
          .find();
        statsRecord = statsRes.items[0] || null;
      } catch (err) {
        // Fail open — don't block visitors on DB errors
        console.warn('[chatbotService] daily stats query failed, allowing session:', err?.message);
      }

      if ((statsRecord?.sessionCount ?? 0) >= MAX_SESSIONS_PER_DAY) {
        return { limitReached: true };
      }

      // Increment the stats record we already loaded
      try {
        if (statsRecord) {
          await wixData.update(DAILY_STATS, {
            ...statsRecord,
            sessionCount: (statsRecord.sessionCount || 0) + 1,
          });
        } else {
          await wixData.insert(DAILY_STATS, { date: todayUTC, sessionCount: 1 });
        }
      } catch (err) {
        console.warn('[chatbotService] daily stats write failed:', err?.message);
      }

      sessionRecord = {
        sessionId: cleanSessionId,
        sessionHistory: '[]',
        messageCount: 0,
        createdAt: now,
        lastMessageAt: now,
      };
    }

    // 7. Build product catalog context
    const catalogProducts = await _fetchProductCatalog();
    const catalogSummary = buildCatalogSummary(catalogProducts);
    const systemPrompt = buildSystemPrompt(catalogSummary);

    // 8. Parse stored history and append new user message
    let history = [];
    try {
      history = JSON.parse(sessionRecord.sessionHistory || '[]');
    } catch (_) {
      history = [];
    }
    history.push({ role: 'user', content: sanitized });
    const messagesToSend = _trimHistory(history);

    // 9. Call Claude
    let claudeData = null;
    try {
      claudeData = await _callClaude(messagesToSend, systemPrompt, apiKey);
    } catch (err) {
      console.error('[chatbotService] Claude call threw unexpectedly:', err?.message);
      return { error: 'assistant_unavailable' };
    }
    if (!claudeData) return { error: 'assistant_unavailable' };

    const reply = claudeData.content?.[0]?.text || '';

    // 10. Update history and persist session
    history.push({ role: 'assistant', content: reply });
    const finalHistory = _trimHistory(history);
    const newMessageCount = (sessionRecord.messageCount || 0) + 1;

    const updatedRecord = {
      ...sessionRecord,
      sessionHistory: JSON.stringify(finalHistory),
      messageCount: newMessageCount,
      lastMessageAt: now,
    };

    // 11. CMS write (non-fatal — reply is returned even on failure)
    try {
      if (sessionRecord._id) {
        await wixData.update(CHAT_SESSIONS, updatedRecord);
      } else {
        await wixData.insert(CHAT_SESSIONS, updatedRecord);
      }
    } catch (err) {
      console.error('[chatbotService] session write failed:', err?.message);
    }

    // 12. Product suggestions based on user query
    const suggestedProducts = findSuggestedProducts(catalogProducts, sanitized);

    return {
      reply,
      suggestedProducts,
      messagesRemaining: MAX_MESSAGES_PER_SESSION - newMessageCount,
    };
  }
);
