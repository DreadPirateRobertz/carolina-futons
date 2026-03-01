# CF-5ggk: Live Chat Widget Refinement

## Status
The live chat widget is already built (bead cf-7t5). This bead covers refinements per melania's design brief and missing frontend test coverage.

## What Exists
- `src/public/LiveChat.js` — frontend widget (toggle, panel, pre-chat, messages, offline tickets)
- `src/backend/liveChatService.web.js` — isOnline, canned responses, sendMessage, getChatHistory, createSupportTicket
- `src/backend/liveChat.web.js` — office hours, matchCannedResponse, getChatContext
- `src/public/proactiveChatTriggers.js` — proactive nudges with session capping
- `masterPage.js` lines 53-62 — async load with 2s delay
- 123 backend/utility tests passing

## Changes

### 1. Proactive Trigger Refinements (proactiveChatTriggers.js)
- Update product page delay from 10s to 30s per melania's brief
- Update product online message to "Need help choosing? Chat with us!"
- Keep checkout delays unchanged (15s)

### 2. ARIA Enhancement (LiveChat.js)
- Add `role="complementary"` to `#chatWidget` container on init

### 3. Frontend Tests (NEW: tests/LiveChat.test.js)
Coverage per melania's requirements:
- Widget render (toggle visible, panel hidden initially)
- Online/offline status display
- After-hours fallback (support ticket creation)
- Proactive trigger timing (30s delay)
- ARIA attributes (toggle label, close label, send label, message input label, complementary role)
- Keyboard navigation (Escape closes panel, Enter sends message)
- Pre-chat form validation
- SPA cleanup on navigation

## Non-Code (Wix Studio Editor)
Design token colors (mountainBlue bubble, espresso header, etc.) are applied in the Wix Studio editor, not in code.
