# Phase 3 — Claude Gamification Chatbot Spec
**Date:** 2026-03-22
**Status:** Approved — autonomous crew consensus
**Parent spec:** `2026-03-22-gamification-system-design.md`
**Phase:** 3 of 7

---

## Overview

A member-authenticated AI assistant embedded in the Carolina Futons site, powered by `claude-sonnet-4-6`. The chatbot gives members a conversational interface for product discovery, order support, and account actions — earning the interaction layer that the gamification tiers unlock. It ships behind a feature flag in Wix Secrets Manager so Stilgar controls the exact moment it goes live.

The chatbot is intentionally separate from `styleConsultant.web.js`. That module is anonymous-session and vision-focused. This module is member-auth-gated, conversation-history-backed, and transactional. They share the same Claude model, the same `ANTHROPIC_API_KEY` secret, and the same `wix-fetch` / `wix-secrets-backend` pattern — but they are different backend files with different CMS collections and different rate limit semantics.

---

## Placement & Visual Design

- **Web placement:** Inside `#loyaltySection` on the Member Page, or a dedicated `#chatbotSection` if the loyalty section becomes too dense. Decision deferred to editor hookup — use `#chatbotSection` as the canonical nickname.
- **Mobile placement:** Modal overlay (not inline) per dallas's input. The modal slides up from the bottom on tap of a persistent floating chat button. The same `chatWithAssistant` webMethod is called — no separate mobile endpoint.
- **Visual weight:** Contained card with a header bar ("Your Carolina Futons Assistant"), message thread area, input field, send button, and limit indicator at the top of the card.
- **Reduced motion:** `useReducedMotion` respected — response text appears instantly with no fade/type animation.
- **Loading state:** Bear loading animation (`loading-bear-nSFUgnPuv6`) shown while waiting for Claude response.

---

## Feature Flag

The feature is controlled by a secret named `GAMIFICATION_CHATBOT_ENABLED` in Wix Secrets Manager.

| Secret value | Behavior |
|---|---|
| Absent or empty string | `chatWithAssistant` returns `{ enabled: false }` immediately — no Claude call, no CMS read |
| `'true'` (exact string) | Feature is live |
| Any other value | Treated as absent — returns `{ enabled: false }` |

Frontend behavior when `enabled: false`: show a "Coming Soon" placeholder in `#chatbotPanel` with no input controls visible. This prevents members from seeing a broken UI if the flag is toggled off mid-session.

The flag check is the first operation inside `chatWithAssistant`, before auth, rate limit, or CMS access. This keeps the disabled path maximally cheap.

---

## Authentication

Member authentication is required. Anonymous visitors cannot call `chatWithAssistant`. The webMethod uses `Permissions.Member` (not `Permissions.Anyone`).

If a non-authenticated request reaches the method: return `{ error: 'auth_required' }` with HTTP 401. The frontend must check auth state before rendering the input controls and display a "Sign in to chat" prompt for logged-out visitors.

`memberId` is read server-side from the authenticated Wix session — it is **never** trusted from the client. The `memberId` parameter in the method signature is a convenience for the frontend to confirm whose session it is showing; the server always re-derives it from auth context.

---

## Rate Limits

All limits are per-member, enforced server-side against `ChatbotSessions` CMS.

| Limit | Value | Reset cadence |
|---|---|---|
| Daily messages | 20 per member | ET midnight |
| Daily tokens | 4,000 per member (input + output combined) | ET midnight |
| Per-message input | 1,500 tokens max (hard truncation before API call) | Per request |
| Hourly call rate | 20 calls/hr | Sliding window (existing project-wide pattern from PRs #605–#610) |

**Token counting:** Input token budget is estimated before the API call using a conservative character-to-token ratio (4 chars ≈ 1 token). This is an estimate — the exact token count is read from Claude's `usage` response field and written to `ChatbotSessions.dailyTokensUsed` after each call. The pre-call estimate is used only to reject requests that would clearly exceed the budget without making an API call.

**Daily reset:** Compare `ChatbotSessions.dailyResetDate` (ET date string, e.g. `"2026-03-22"`) to today's ET date on every call. If they differ, reset `dailyTokensUsed`, `dailyMessageCount`, and `dailyResetDate` before proceeding.

---

## CMS Schema Changes

### `ChatbotSessions` (new collection — separate from `StyleConsultantSessions`)

| Field | Type | Notes |
|---|---|---|
| `memberId` | Text | Indexed — member auth required (not anonymous) |
| `dailyTokensUsed` | Number | Reset daily (ET midnight) |
| `dailyResetDate` | Text | ET date string e.g. `"2026-03-22"` |
| `sessionHistory` | Text | JSON array of last 10 turns — `[{ role, content }, ...]` |
| `dailyMessageCount` | Number | Reset daily — rate limit gate |
| `lastMessageAt` | DateTime | UTC timestamp of last message |

**Indexes:** Add an index on `memberId` for O(1) per-member lookup.

**Collection permissions:** Backend read/write only. No direct client access.

**Session history format:** Each entry in the JSON array is `{ "role": "user" | "assistant", "content": "<text>" }`. On each call: load existing array → append user turn → trim to 10 total turns (drop oldest pairs first, keeping whole user+assistant pairs where possible) → call Claude with the trimmed array → append assistant turn → trim again to 10 → save. The 10-turn cap keeps `sessionHistory` text field size bounded and limits token carry-in per call.

> **Note:** Parent spec `2026-03-22-gamification-system-design.md` lists a 4-field `ChatbotSessions` schema. This spec supersedes that definition — implementers use the 6-field version above (adds `dailyMessageCount` and `lastMessageAt`). The parent spec's table is a draft; this spec is authoritative for Phase 3 implementation.

---

## Tool Scope

The chatbot has a defined, sandboxed set of capabilities. All tool actions run server-side only. The client never knows which tool was invoked — it receives only the final reply text.

### Read-only tools

| Tool | Description |
|---|---|
| Product catalog search | Query `Stores/Products` by keyword, category, price range. Returns name, price, image URL, product page URL. Max 5 results per query. |
| Sizing guide | Return static content from a `ChatbotKnowledge` CMS collection (see below) for the `sizing` topic key. |
| Care instructions | Return static content from `ChatbotKnowledge` for the `care` topic key. |
| FAQ | Return static content from `ChatbotKnowledge` for the `faq` topic key. |
| Return policy | Return static content from `ChatbotKnowledge` for the `returns` topic key. |
| Style guide | Return static content from `ChatbotKnowledge` for the `style_guide` topic key. |

### Soft-write tools (member only)

| Tool | Description |
|---|---|
| Add to wishlist | Call `wix-stores-backend` to add a product to the authenticated member's wishlist. Confirms success or failure in reply. |
| Save style preference | Upsert a `styleTag` value to `MemberPoints` or a dedicated `MemberPreferences` field. Confirm to member. |
| Start swatch request | Insert a row into the existing swatch request collection (same flow as manual swatch request). Confirm tracking reference in reply. |

### Transactional tools

| Tool | Description |
|---|---|
| Order status lookup | Query `Stores/Orders` for orders belonging to the authenticated `memberId` only. Returns last 3 orders with status and tracking info. Scope is hard-enforced server-side — never queries another member's orders. |
| Return request initiation | Insert a return request row into the existing returns collection for the authenticated member's order. Validates that the `orderId` belongs to this member before proceeding. |
| Apply promo code | Call the existing `applyPromoCode` backend function (CF-lk0c pattern) for the authenticated member's active cart. Returns success/failure to Claude for inclusion in reply. |

**Sandbox invariants (non-negotiable):**
- No write access to `Stores/Products`, pricing, or inventory — ever.
- No access to another member's orders, wishlist, or profile data.
- No ability to create, modify, or cancel orders.
- All tool calls are logged to `sessionHistory` as assistant turn metadata (internal — not shown to member).

### `ChatbotKnowledge` CMS Collection (new — dashboard-editable)

| Field | Type | Notes |
|---|---|---|
| `topicKey` | Text | Indexed. Enum: `sizing`, `care`, `faq`, `returns`, `style_guide` |
| `content` | Text | Markdown/plain text — Claude will reference this verbatim |
| `updatedAt` | DateTime | For cache invalidation reference |
| `active` | Boolean | Toggle topics on/off without deleting rows |

Stilgar edits knowledge base content from the Wix Dashboard without any code changes. Claude receives the raw `content` value as a tool result and incorporates it into its reply.

---

## Backend — `gamificationChatbot.web.js`

New file: `src/backend/gamificationChatbot.web.js`

**Do NOT add to `styleConsultant.web.js`.** These are separate features with different auth models, rate limit strategies, and session semantics.

### System Prompt

```
You are the Carolina Futons Assistant — a friendly, knowledgeable helper for carolinafutons.com,
a family-owned furniture store in Hendersonville, NC specializing in futons, murphy cabinet beds,
platform beds, and mattresses.

You help members find the right furniture, understand care and sizing, check their orders,
and manage their account. You are warm, direct, and concise. You do not make up product details —
if you don't know something, say so and offer to help find it.

You have access to tools: product search, knowledge base lookup, wishlist management,
order status, return requests, and promo code application.
Always use tools to retrieve current information rather than relying on your training data
for product details, pricing, or policies.

You never share another member's data. You never modify products, pricing, or inventory.
Keep replies under 200 words unless the member asks for detail.
```

### `chatWithAssistant(message, memberId)` webMethod

**Permissions:** `Permissions.Member`

**Signature:** `chatWithAssistant(message: string, memberId: string)`

**Returns:**
```js
{
  reply: string,
  dailyMessagesRemaining: number,
  dailyTokensRemaining: number,
  sessionHistory: Array<{ role: string, content: string }>
}
```

Or one of the error/status shapes from the Error Handling table below.

### Flow

1. **Feature flag check** — load `GAMIFICATION_CHATBOT_ENABLED` from `wix-secrets-backend`. If absent, empty, or not `'true'`: return `{ enabled: false }` immediately. No further work.

2. **Auth** — confirm member is authenticated server-side. Re-derive `memberId` from Wix auth context. If not authenticated: return `{ error: 'auth_required' }` (HTTP 401).

3. **Rate limit — hourly call rate** — check sliding window (20 calls/hr per member). If exceeded: return `{ error: 'rate_limit_exceeded', retryAfterMs }`.

4. **Input validation** — sanitize `message`. Reject empty or whitespace-only input. Hard-truncate to 1,500 tokens before passing to Claude (estimate: 6,000 chars → 1,500 tokens). Return `{ error: 'invalid_input' }` if empty after sanitize.

5. **Load `ChatbotSessions` record** — query by `memberId`. CMS query failure throws and is caught at step 10 (returns `assistant_unavailable`).

6. **Daily reset check** — compare `dailyResetDate` to today's ET date. If different: reset `dailyTokensUsed = 0`, `dailyMessageCount = 0`, `dailyResetDate = todayET`. This write happens before the eligibility check.

7. **Daily message limit check** — if `dailyMessageCount >= 20`: return `{ limitReached: true, type: 'messages' }`.

8. **Daily token limit check** — estimate input tokens from sanitized message + session history carry-in. If `dailyTokensUsed + estimate > 4000`: return `{ limitReached: true, type: 'tokens' }`.

9. **Build Claude messages array** — load `sessionHistory` JSON from CMS record (default `[]` for new member). Append new user turn. Trim to 10 turns. Pass trimmed array to Claude as `messages`.

10. **Tool resolution** — before calling Claude, scan the message for tool-triggering intents (product search, order lookup, etc.) and resolve tool results from Wix Data / Wix Stores backend. Pass tool results as additional context in the user message or as a prefixed assistant context block. *(Wix Velo does not support Claude's native tool-use API format — tool calls are implemented as structured prompt injection, not as the Anthropic tools API schema.)*

11. **Claude API call** — call `https://api.anthropic.com/v1/messages` via `wix-fetch`. Model: `claude-sonnet-4-6`. Max output tokens: 600. System prompt as above. Messages array from step 9. Load `ANTHROPIC_API_KEY` from `wix-secrets-backend`. On non-OK response: return `{ error: 'assistant_unavailable' }` — never surface API error details to client.

12. **Token accounting** — read `usage.input_tokens + usage.output_tokens` from Claude response. Add to `dailyTokensUsed`.

13. **Session history update** — append assistant reply turn to history array. Trim to 10 turns. Serialize to JSON.

14. **CMS write** — upsert `ChatbotSessions` record: updated `sessionHistory`, incremented `dailyMessageCount`, updated `dailyTokensUsed`, updated `dailyResetDate`, updated `lastMessageAt = now()`. CMS write failure is non-fatal — log error but return the reply to the member anyway. Rate limit state may be transiently stale on write failure; this is acceptable.

15. **Return** — `{ reply, dailyMessagesRemaining, dailyTokensRemaining, sessionHistory }` where `dailyMessagesRemaining = 20 - newDailyMessageCount` and `dailyTokensRemaining = 4000 - newDailyTokensUsed`.

### Token Budget Architecture

```
Per-call input budget:   1,500 tokens (hard truncation of user message)
Daily input+output cap:  4,000 tokens per member
Output max per call:       600 tokens (max_tokens in Claude API call)
History carry-in:        Up to ~10 turns × ~150 tokens avg = ~1,500 tokens
```

The daily 4,000-token cap means a member can have roughly 3–5 substantive exchanges per day on the free tier before hitting the limit. This is intentional — the limit is designed to prevent abuse while giving genuine shoppers enough headroom for a full buying decision conversation.

---

## Frontend Module — `ChatbotUI.js`

New file: `src/public/ChatbotUI.js`

### Editor Elements

All elements live inside `#chatbotSection` (new section) or `#loyaltySection` (if space allows):

| Nickname | Element type | Role |
|---|---|---|
| `#chatbotPanel` | Box | Outer container — hidden when `enabled: false` |
| `#chatbotInput` | TextInput | Member types their message here |
| `#chatbotSendBtn` | Button | Submit message |
| `#chatbotResponseArea` | Text / RichText | Displays conversation thread |
| `#chatbotLimitDisplay` | Text | Shows "N messages remaining today" |
| `#chatbotComingSoon` | Text | Shown when `enabled: false` — "Coming Soon" copy |
| `#chatbotLoadingBear` | Lottie | `loading-bear-nSFUgnPuv6` — shown while awaiting reply |

### Responsibilities

- On page load: call `getChatbotEnabled()` to determine feature flag state. If `enabled: false`: hide `#chatbotPanel`, show `#chatbotComingSoon`.
- Render conversation thread in `#chatbotResponseArea` — user messages right-aligned, assistant messages left-aligned. New messages appended to bottom. Thread scrolls to latest on each reply.
- On send: disable `#chatbotSendBtn` + show `#chatbotLoadingBear` while waiting. Re-enable on response.
- Update `#chatbotLimitDisplay` after each response with `dailyMessagesRemaining` from the webMethod return.
- When `limitReached: true` response received: disable input + send button, update `#chatbotLimitDisplay` to "Daily limit reached — resets at midnight ET".
- Reduced motion: skip fade/type animations on response text. Bear loading animation is still shown (it is informational, not decorative).

> **`getChatbotEnabled()` webMethod (required):** This is a separate, lightweight webMethod that reads only the `GAMIFICATION_CHATBOT_ENABLED` secret and returns `{ enabled: boolean }`. It does NOT create a `ChatbotSessions` record. Calling `chatWithAssistant` with an empty message to check flag state is explicitly forbidden — it would create a CMS record and consume a daily message slot. The `getChatbotEnabled()` webMethod must be added to the DoD checklist. Rate limit: 20/hr (matches the chatbot session rate limit).

### Mobile (dallas integration)

- `ChatbotUI.js` is shared — the same module handles both web inline and mobile modal contexts.
- On mobile: `#chatbotPanel` is rendered inside a modal overlay (slide-up sheet). The floating chat button (outside the loyalty section) triggers the modal open. Dallas's rig handles the modal container and the floating button element; this spec owns the contents (`#chatbotPanel` and children).
- The `chatWithAssistant` webMethod call is identical regardless of surface.

### Accessibility

- `#chatbotResponseArea` has an `aria-live="polite"` region so screen readers announce new assistant replies.
- `#chatbotSendBtn` disabled state clearly labelled when limit is reached.
- `#chatbotInput` has a visible label (not placeholder-only).
- `useReducedMotion` check suppresses type-effect animations on assistant replies.

---

## Error Handling

| Scenario | Backend returns | Frontend behavior |
|---|---|---|
| Feature flag off | `{ enabled: false }` | Hide `#chatbotPanel`, show `#chatbotComingSoon` — "Coming Soon" |
| Member not authenticated | `{ error: 'auth_required' }` (HTTP 401) | Show "Sign in to chat" prompt — do not render input controls |
| Daily message limit hit | `{ limitReached: true, type: 'messages' }` | Disable input + send, update `#chatbotLimitDisplay` to "Daily limit reached — resets at midnight ET" |
| Daily token limit hit | `{ limitReached: true, type: 'tokens' }` | Same as message limit — disable input, show limit copy |
| Hourly rate limit hit | `{ error: 'rate_limit_exceeded', retryAfterMs }` | Show "Too many requests — please wait a moment" with optional countdown |
| Claude API error | `{ error: 'assistant_unavailable' }` | Show inline error in `#chatbotResponseArea`: "The assistant is temporarily unavailable. Please try again." — do not surface API details |
| Empty/invalid input | `{ error: 'invalid_input' }` | Show inline validation: "Please enter a message." |
| CMS lookup failure | `{ error: 'assistant_unavailable' }` | Same as Claude API error — single user-facing error message |
| Network failure (client) | No response / timeout | Show "Connection error. Please check your network and try again." — keep conversation thread intact in memory |

---

## `gamificationEventReceiver` Changes

Per the parent spec architecture table, Phase 3 adds **no new events** to `gamificationEventReceiver.web.js`. The chatbot has its own session layer (`ChatbotSessions`) and does not write to the gamification event pipeline. Chatbot interactions intentionally do not earn gamification points — this keeps the incentive model clean (points are earned through buying behaviors, not through asking questions).

If a future design decision changes this (e.g., "earn 5 pts for first chatbot interaction per day"), that will require a Phase 4+ amendment and a bead to extend the receiver. Do not add chatbot events speculatively.

---

## Secrets Manager

| Secret name | Status | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Already exists | Shared with `styleConsultant.web.js` — do not duplicate |
| `GAMIFICATION_CHATBOT_ENABLED` | New — create before deploy | Set to `'true'` to enable. Absent = disabled. Stilgar controls this. |

---

## Definition of Done

- [ ] `ChatbotSessions` CMS collection created in Wix Dashboard (6-field schema above)
- [ ] `ChatbotKnowledge` CMS collection created in Wix Dashboard — populate at minimum: `sizing`, `care`, `faq`, `returns`, `style_guide` topic keys
- [ ] `GAMIFICATION_CHATBOT_ENABLED` secret created in Wix Secrets Manager (set to empty string initially — feature off)
- [ ] `src/backend/gamificationChatbot.web.js` created — `getChatbotEnabled()` webMethod (reads flag only, no CMS record, rate-limited 20/hr), `chatWithAssistant` webMethod (feature flag check, auth, rate limits, session history load/trim/save, tool resolution, Claude API call, token accounting, CMS upsert)
- [ ] Feature flag returns `{ enabled: false }` immediately when secret absent/empty — verified by test
- [ ] Daily reset logic verified by test (date boundary crossing resets counts)
- [ ] Daily message limit (20) enforced server-side — verified by test
- [ ] Daily token limit (4,000) enforced server-side — verified by test
- [ ] Per-message input hard-truncated at 1,500 tokens before API call — verified by test
- [ ] Hourly rate limit (20 calls/hr, sliding window) enforced — verified by test
- [ ] `memberId` always derived from server-side auth context, not client parameter — verified by test
- [ ] Order lookup scope-checked: only returns orders belonging to the authenticated `memberId` — verified by test
- [ ] Return request initiation validates `orderId` ownership before inserting — verified by test
- [ ] Claude API errors return `{ error: 'assistant_unavailable' }` — no API details leaked — verified by test
- [ ] `sessionHistory` trimmed to 10 turns max before each Claude call — verified by test
- [ ] CMS write failure is non-fatal: reply still returned to member, error logged — verified by test
- [ ] `src/public/ChatbotUI.js` created — feature flag check, conversation thread render, limit display, loading state, reduced-motion fallback
- [ ] `#chatbotPanel` hidden and `#chatbotComingSoon` shown when `enabled: false`
- [ ] Input controls disabled when daily limit reached
- [ ] `aria-live` region on `#chatbotResponseArea` for screen reader support
- [ ] Mobile modal integration documented in PR — coordinate with dallas on modal container ownership
- [ ] Tests: flag check, auth guard, daily reset, message limit, token limit, hourly rate limit, session history trim, order scope guard, error masking, CMS write failure path
- [ ] **EDITOR_HOOKUP_GUIDE.html updated** (new element nicknames: `#chatbotSection`, `#chatbotPanel`, `#chatbotInput`, `#chatbotSendBtn`, `#chatbotResponseArea`, `#chatbotLimitDisplay`, `#chatbotComingSoon`, `#chatbotLoadingBear`; new CMS collections: `ChatbotSessions`, `ChatbotKnowledge`)
- [ ] **EDITOR-HOOKUP-GUIDE.md updated** (sync with HTML)
