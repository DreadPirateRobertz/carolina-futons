# CF-rp7e SPIKE: Wire Inbox + Chat

**Date**: 2026-03-16
**Author**: godfrey
**Status**: Complete

## Executive Summary

Live chat is **fully implemented** in Velo code — 4 modules, ~1,400 lines covering
the chat widget, proactive triggers, canned responses, office hours, and support
ticket fallback. The remaining work is **dashboard configuration** for the Wix AI
Site-Chat and Facebook Messenger integration.

## Existing Code Inventory

### Frontend Modules

| File | Lines | Purpose | Key Functions |
|------|-------|---------|---------------|
| `src/public/LiveChat.js` | 422 | Chat widget UI | `initLiveChat`, `initChatToggle`, `initPreChatForm`, `initMessageInput`, `appendMessage`, `restoreChatHistory`, `getOrCreateSessionId` |
| `src/public/proactiveChatTriggers.js` | 278 | Proactive chat bubbles | `initProactiveTriggers`, `cleanupProactiveTriggers`, `shouldShowTrigger`, `getPageMessage` |

### Backend Services

| File | Lines | Purpose | Key Functions |
|------|-------|---------|---------------|
| `src/backend/liveChat.web.js` | 445 | Chat operations | `getOfficeHoursStatus`, `getCannedResponses`, `matchCannedResponse`, `createSupportTicket`, `getChatContext` |
| `src/backend/liveChatService.web.js` | 297 | Chat persistence | `isOnline`, `sendMessage`, `getChatHistory`, `createSupportTicket` |

### Features Already Built

- **WCAG 2.1 AA**: ARIA live regions, focus traps, keyboard navigation (Escape to close)
- **Canned responses**: 6 categories — shipping, returns, assembly, fabrics, warranty, custom orders
- **Keyword matching**: Auto-detects topics from user messages
- **Office hours**: Mon-Sat schedule (EST timezone), configurable
- **Offline fallback**: Converts to support ticket form when offline
- **Proactive triggers**: 30s delay on product pages, 10s on checkout, impression capping (max 2/session)
- **Session persistence**: `sessionStorage` for session IDs, chat history restoration
- **Member context**: Logged-in members get personalized responses with recent order data
- **Mobile**: Full-screen layout support

### CMS Collections Required

- `ChatMessages` — Chat message persistence
- `SupportTickets` — After-hours ticket queue
- `ChatConfig` — Configurable office hours and canned responses

## Wix Platform Capabilities

### Wix AI Site-Chat (NEW — not in our code)

Wix now offers a native AI chatbot that can be configured via API:

**Widget Settings API** (`/ai-site-chat/widget-settings`):
- Configure chat appearance, behavior, and availability schedule
- Set welcome messages and suggested questions
- Configure contact forms
- Customize avatar and visual elements

**Conversations API** (`/crm/communication/inbox/conversations`):
- AI hours, offline hours, and human agent hours
- Welcome messages per schedule mode
- Contact form configuration
- Suggested questions

**Key decision**: Use Wix AI Site-Chat (dashboard-managed, AI-powered) vs. our custom LiveChat.js (code-managed, keyword-based canned responses).

**Recommendation**: Run both initially:
- Wix AI Site-Chat for general questions (AI-powered, no maintenance needed)
- Custom LiveChat for product-specific conversations with canned responses + member context

### Wix Inbox API

**Conversations** (`/crm/communication/inbox/conversations`):
- Multi-channel: Wix Chat, SMS, Facebook Business Page, custom channels
- Send/receive messages (text, templates, forms)
- Thread conversations by visitor/contact

**Facebook Messenger Integration**:
- Dashboard → Settings → Inbox → Connect Facebook
- Requires Facebook Business Page admin access
- Merges FB Messenger conversations into Wix Inbox

### Chat Settings API

- Enable/disable AI chat for specific forms
- Works with Interactive Form Sessions API

## Gap Analysis

### 1. Wix AI Site-Chat — NOT configured

**Action**: Dashboard → Add Wix AI Chat Assistant app
- Configure office hours to match `liveChat.web.js` schedule
- Set up suggested questions for furniture topics
- Configure contact form for after-hours
- Set brand avatar

**API option**: Use Widget Settings API to configure programmatically:
```
PATCH https://www.wixapis.com/ai-site-chat/v1/widget-settings
```

### 2. Facebook Messenger → Wix Inbox — NOT connected

**Action**: Dashboard → Settings → Inbox → Connect Facebook Messenger
- Requires Facebook Business Page admin access
- Account: `carolinafutons+socials@gmail.com` / `BossBobby2026`
- All FB Messenger conversations will appear in Wix Inbox alongside chat messages

### 3. Availability Schedule — Code exists, needs dashboard sync

**Current code** (`liveChat.web.js`):
- Mon-Thu: 10am-6pm EST
- Fri: 10am-5pm EST
- Sat: 10am-4pm EST
- Sun: Closed

**Action**: Mirror this schedule in Wix AI Site-Chat widget settings

### 4. Auto-responses — Code keyword matching vs AI

**Current**: `matchCannedResponse()` uses keyword matching for 6 categories
**Wix AI**: Uses AI to understand and respond to natural language questions

**Recommendation**: Let Wix AI handle first-line responses. Keep canned responses as fallback for product-specific queries the AI can't answer.

## No Code Changes Needed

All chat infrastructure is production-ready in Velo code. The custom LiveChat widget
will work alongside Wix AI Site-Chat without conflicts since they use different
UI elements and CMS collections.

## Dashboard Actions Required

| Priority | Action | Who |
|----------|--------|-----|
| P1 | Install Wix AI Chat Assistant app | Editor agent |
| P1 | Configure AI chat office hours + suggested questions | Editor agent |
| P1 | Connect Facebook Business Page to Wix Inbox | Editor agent |
| P2 | Set up AI chat welcome messages for different hours | Editor agent |
| P2 | Configure AI chat contact form for after-hours | Editor agent |
| P3 | Tune AI chat knowledge base with CF-specific FAQs | Content team |

## Conclusion

CF-rp7e is a **dashboard configuration task**. The custom live chat system
(4 modules, ~1,400 lines) is complete with canned responses, office hours,
proactive triggers, accessibility, and offline fallback. The remaining work is
enabling Wix AI Site-Chat for AI-powered responses and connecting Facebook
Messenger to Wix Inbox — both dashboard-only operations.
