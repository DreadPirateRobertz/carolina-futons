/**
 * @module gamificationChatbot
 * @description Phase 3 Gamification Chatbot — member-authenticated Claude assistant.
 *
 * Separate from styleConsultant.web.js: member-auth-gated, conversation-history-backed,
 * transactional. Shares ANTHROPIC_API_KEY and wix-fetch pattern.
 *
 * @setup (see Task 6 for manual steps)
 * CMS: ChatbotSessions (memberId, dailyTokensUsed, dailyResetDate, sessionHistory,
 *                        dailyMessageCount, lastMessageAt, hourlyCallCount, hourlyWindowStart)
 * Secrets: GAMIFICATION_CHATBOT_ENABLED ('true' to enable), ANTHROPIC_API_KEY (existing)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { getTodayET } from 'backend/utils/dateUtils';

const CHATBOT_SESSIONS = 'ChatbotSessions';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_MAX_TOKENS = 600;
const CLAUDE_ANTHROPIC_VERSION = '2023-06-01';

const DAILY_MESSAGE_LIMIT = 20;
const DAILY_TOKEN_LIMIT = 4000;
const INPUT_CHAR_LIMIT = 6000;       // ~1500 tokens at 4 chars/token
const SESSION_HISTORY_MAX_TURNS = 10;
const HOURLY_CALL_LIMIT = 20;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;

// Chars-to-tokens estimate: 4 chars ≈ 1 token (conservative)
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function trimHistory(history) {
  if (history.length <= SESSION_HISTORY_MAX_TURNS) return history;
  const excess = history.length - SESSION_HISTORY_MAX_TURNS;
  return history.slice(excess);
}

const SYSTEM_PROMPT = `You are the Carolina Futons Assistant — a friendly, knowledgeable helper \
for carolinafutons.com, a family-owned furniture store in Hendersonville, NC specializing in \
futons, murphy cabinet beds, platform beds, and mattresses.

You help members find the right furniture, understand care and sizing, check their orders, \
and manage their account. You are warm, direct, and concise. You do not make up product details — \
if you don't know something, say so and offer to help find it.

You have access to tools: product search, knowledge base lookup, wishlist management, \
order status, return requests, and promo code application. \
Always use tools to retrieve current information rather than relying on your training data \
for product details, pricing, or policies.

You never share another member's data. You never modify products, pricing, or inventory. \
Keep replies under 200 words unless the member asks for detail.`;

export async function callClaude(messages, apiKey) {
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
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!response.ok) return null;
  return response.json();
}

// Export for testing only — underscore prefix signals internal use
export { callClaude as _callClaude };

/**
 * Return the initial chat greeting for any visitor (no auth required).
 * Shows the assistant widget on the PDP for cold visitors and members alike.
 * The message is contextualised with the current product name when provided.
 *
 * @param {{ productName?: string, productId?: string }} [context]
 * @returns {Promise<{ enabled: false } | { enabled: true, greeting: string }>}
 */
export const getChatGreeting = webMethod(
  Permissions.Anyone,
  async (context = {}) => {
    let flagEnabled = false;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      const flag = await getSecret('GAMIFICATION_CHATBOT_ENABLED');
      flagEnabled = flag === 'true';
    } catch (err) {
      console.warn('[gamificationChatbot] getChatGreeting: flag fetch failed, defaulting to disabled:', err?.message);
      flagEnabled = false;
    }
    if (!flagEnabled) return { enabled: false };

    const name = context?.productName;
    const productName = (typeof name === 'string' && name.trim()) ? name.trim() : null;
    const greeting = productName
      ? `Hi! I'm the Carolina Futons Assistant. Ask me anything about ${productName} — sizing, materials, delivery, or how to earn points on your purchase.`
      : "Hi! I'm the Carolina Futons Assistant. Ask me about any product — sizing, materials, delivery, or how to earn rewards on your purchase.";
    return { enabled: true, greeting };
  }
);

export const chatWithAssistant = webMethod(
  Permissions.SiteMember,
  async (message, _clientMemberId) => {
    // 1. Feature flag
    let flagEnabled = false;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      const flag = await getSecret('GAMIFICATION_CHATBOT_ENABLED');
      flagEnabled = flag === 'true';
    } catch (_) {
      flagEnabled = false;
    }
    if (!flagEnabled) return { enabled: false };

    // 2. Auth — derive memberId from server-side context only
    const member = await currentMember.getMember();
    if (!member || !member._id) return { error: 'auth_required' };
    const memberId = member._id;

    // 3. Input validation + truncation
    const sanitized = (typeof message === 'string' ? message : '').trim();
    if (!sanitized) return { error: 'invalid_input' };
    const truncated = sanitized.slice(0, INPUT_CHAR_LIMIT);

    // 4. Load or create ChatbotSessions record
    let sessionRecord = null;
    try {
      const res = await wixData.query(CHATBOT_SESSIONS)
        .eq('memberId', memberId)
        .limit(1)
        .find();
      sessionRecord = res.items[0] || null;
    } catch (_err) {
      return { error: 'assistant_unavailable' };
    }

    const now = new Date();
    const todayET = getTodayET();

    if (!sessionRecord) {
      sessionRecord = {
        memberId,
        dailyTokensUsed: 0,
        dailyResetDate: todayET,
        sessionHistory: '[]',
        dailyMessageCount: 0,
        lastMessageAt: now,
        hourlyCallCount: 0,
        hourlyWindowStart: now,
      };
    }

    // 5. Daily reset check
    if (sessionRecord.dailyResetDate !== todayET) {
      sessionRecord.dailyTokensUsed = 0;
      sessionRecord.dailyMessageCount = 0;
      sessionRecord.dailyResetDate = todayET;
    }

    // 6. Daily message limit
    if (sessionRecord.dailyMessageCount >= DAILY_MESSAGE_LIMIT) {
      return { limitReached: true, type: 'messages' };
    }

    // 7. Daily token estimate check
    const inputEstimate = estimateTokens(truncated);
    if (sessionRecord.dailyTokensUsed + inputEstimate > DAILY_TOKEN_LIMIT) {
      return { limitReached: true, type: 'tokens' };
    }

    // 8. Hourly rate limit (sliding window)
    const windowStart = sessionRecord.hourlyWindowStart
      ? new Date(sessionRecord.hourlyWindowStart)
      : now;
    const windowAge = now.getTime() - windowStart.getTime();
    if (windowAge > HOURLY_WINDOW_MS) {
      sessionRecord.hourlyCallCount = 0;
      sessionRecord.hourlyWindowStart = now;
    }
    if ((sessionRecord.hourlyCallCount || 0) >= HOURLY_CALL_LIMIT) {
      const retryAfterMs = HOURLY_WINDOW_MS - windowAge;
      return { error: 'rate_limit_exceeded', retryAfterMs };
    }

    // 9. Load session history and build messages array
    let history = [];
    try {
      history = JSON.parse(sessionRecord.sessionHistory || '[]');
    } catch (_) {
      history = [];
    }
    history = trimHistory(history);
    history.push({ role: 'user', content: truncated });
    const messagesToSend = trimHistory(history);

    // 10. Claude API call
    let apiKey;
    try {
      const { getSecret } = await import('wix-secrets-backend');
      apiKey = await getSecret('ANTHROPIC_API_KEY');
    } catch (_) {
      return { error: 'assistant_unavailable' };
    }

    let claudeData = null;
    try {
      claudeData = await callClaude(messagesToSend, apiKey);
    } catch (_) {
      return { error: 'assistant_unavailable' };
    }
    if (!claudeData) return { error: 'assistant_unavailable' };

    const reply = claudeData.content?.[0]?.text || '';
    const tokensUsed = (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0);

    // 11. Update history
    history.push({ role: 'assistant', content: reply });
    const finalHistory = trimHistory(history);

    // 12. Build updated session record
    const newMessageCount = (sessionRecord.dailyMessageCount || 0) + 1;
    const newTokensUsed = (sessionRecord.dailyTokensUsed || 0) + tokensUsed;
    const updatedRecord = {
      ...sessionRecord,
      sessionHistory: JSON.stringify(finalHistory),
      dailyMessageCount: newMessageCount,
      dailyTokensUsed: newTokensUsed,
      dailyResetDate: todayET,
      lastMessageAt: now,
      hourlyCallCount: (sessionRecord.hourlyCallCount || 0) + 1,
      hourlyWindowStart: sessionRecord.hourlyWindowStart || now,
    };

    // 13. CMS write (non-fatal — reply is returned even on failure)
    try {
      if (sessionRecord._id) {
        await wixData.update(CHATBOT_SESSIONS, updatedRecord);
      } else {
        await wixData.insert(CHATBOT_SESSIONS, updatedRecord);
      }
    } catch (err) {
      console.error('[gamificationChatbot] CMS write failed:', err);
      // Non-fatal — fall through and return reply
    }

    // 14. Return
    return {
      reply,
      dailyMessagesRemaining: DAILY_MESSAGE_LIMIT - newMessageCount,
      dailyTokensRemaining: DAILY_TOKEN_LIMIT - newTokensUsed,
      sessionHistory: finalHistory,
    };
  }
);
