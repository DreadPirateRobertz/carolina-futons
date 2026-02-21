# Idea Funnel Report — Brainstorm Session #1

**Date:** 2026-02-20
**Role:** Idea Funnel (brainstorm crew worker)
**Scope:** All rigs — cfutons, cfutons_mobile, tradingbot, gastown

---

## Executive Summary

**31 new beads filed** across 4 rigs. Research covered competitor analysis, trading bot innovations, Gas Town improvements, mobile UX trends, SEO/marketing, and cross-project synergies.

| Rig | New Beads | P2 | P3 | P4 |
|-----|-----------|----|----|-----|
| cfutons | 9 | 5 | 4 | 0 |
| cfutons_mobile | 8 | 5 | 3 | 0 |
| tradingbot | 7 | 1 | 5 | 1 |
| gastown | 7 | 0 | 4 | 3 |

---

## Top 10 Ideas (Highest Impact)

### 1. MCP Server for Trading Bot (tb-f2i) — P2, tradingbot
Expose trading bot capabilities via Model Context Protocol so Claude/Gas Town agents can manage trades through conversation. Freqtrade already has a popular MCP server (thousands of downloads). This bridges the trading bot into the Gas Town ecosystem.

### 2. Smart Checkout with BNPL (cm-gmo) — P2, cfutons_mobile
Apple Pay, Google Pay, and Buy Now Pay Later (Affirm/Klarna) at checkout. BNPL increases AOV 20-50% for furniture. Mobile cart abandonment drops from 97% (web) to 20% (native) when friction is minimized.

### 3. Shared Design Tokens (cf-b9o) — P2, cfutons
Shared design token package between web and mobile app. Prevents brand inconsistency as both platforms evolve independently. Builds on existing cf-a9q (extract constants) and cm-330 (mobile tokens).

### 4. SEO Content Hub (cf-uyc) — P2, cfutons
8 pillar blog posts with JSON-LD, FAQ schema, and internal linking. Blog.js is coded and live — content is the missing piece. Targets long-tail keywords like "best futon for guest room 2026."

### 5. Email Marketing Automation (cf-d3u) — P2, cfutons
Welcome series, abandoned cart recovery, post-purchase care. Backend code (emailService, cartRecovery) already built — needs Klaviyo/Wix Automations connection. Email has 4,200% ROI.

### 6. Product Comparison Tool (cf-it6) — P2, cfutons
Side-by-side futon comparison on dimensions, materials, price, fabrics. Reduces decision paralysis for the "Guest Room Upgrader" persona evaluating multiple similar products.

### 7. Price Drop Alerts (cm-qtp) — P2, cfutons_mobile
Push notifications for price drops, back-in-stock, new fabrics. 400% more effective than email. The native app solves what PWA couldn't (iOS push). AI manages notification frequency.

### 8. Style Quiz + Personalized Feed (cm-ke0) — P2, cfutons_mobile
5-question visual quiz generating a persistent "For You" home feed. Wix site already has a style quiz — port it to native and connect to personalization engine. 84% of e-commerce integrating AI personalization.

### 9. ML Product Recommendations (cf-7ik) — P3, cfutons
"You might also like" + "Complete the room" using collaborative filtering and style matching. Cross-project synergy: leverage tradingbot ML pipeline patterns.

### 10. Webhook Notifications for Gas Town (gt-5kz) — P3, gastown
Slack, Discord, email alerts for convoy completions, escalations, agent failures. Relates to existing gt-87f (escalation channels).

---

## All Beads Filed

### cfutons (9 beads)
| ID | Title | Priority |
|----|-------|----------|
| cf-b9o | Shared design token system between web and mobile | P2 |
| cf-it6 | Product comparison tool: side-by-side futon comparison | P2 |
| cf-g94 | Customer photo reviews with verified purchase badges | P2 |
| cf-uyc | SEO content hub: buying guides, comparison articles | P2 |
| cf-d3u | Email marketing automation: welcome, cart, post-purchase | P2 |
| cf-7ik | ML-powered product recommendations engine | P3 |
| cf-y05 | Virtual room planner tool: drag-and-drop layout | P3 |
| cf-vfq | Showroom appointment booking with virtual tour | P3 |
| cf-4es | Referral program with two-sided incentives | P3 |
| cf-9xa | Furniture protection plan upsell at checkout | P3 |
| cf-ugv | Assembly service upsell: TaskRabbit/Handy | P3 |

### cfutons_mobile (8 beads)
| ID | Title | Priority |
|----|-------|----------|
| cm-gmo | Smart checkout: Apple Pay, Google Pay, BNPL | P2 |
| cm-u59 | Fabric swatch visualizer with haptic feedback | P2 |
| cm-qtp | Price drop and back-in-stock push notifications | P2 |
| cm-0au | Offline product catalog with smart sync | P2 |
| cm-ke0 | Style quiz with personalized home feed | P2 |
| cm-zz9 | AR room preview: place futons in your space | P3 |
| cm-mkh | AI shopping assistant: conversational discovery | P3 |
| cm-zu5 | Shoppable room scenes feed (Stories/Reels format) | P3 |
| cm-c48 | Live trading bot dashboard widget | P4 |

### tradingbot (7 beads)
| ID | Title | Priority |
|----|-------|----------|
| tb-f2i | MCP server for AI-driven trade management | P2 |
| tb-acl | Funding rate arbitrage: spot-perpetual hedge | P3 |
| tb-sxl | Kelly criterion position sizing with VaR constraints | P3 |
| tb-dfd | Grid trading strategy for range-bound markets | P3 |
| tb-9z7 | Multi-exchange smart order routing engine | P3 |
| tb-1n6 | REST API for paper trader status (cross-project) | P3 |
| tb-uan | Cross-exchange triangular arbitrage scanner | P4 |

### gastown (7 beads)
| ID | Title | Priority |
|----|-------|----------|
| gt-3bz | Prometheus/OpenTelemetry metrics export | P3 |
| gt-24y | Smart task routing: skill-based agent assignment | P3 |
| gt-4la | Multi-provider cost optimization: model routing | P3 |
| gt-5kz | Webhook notifications: Slack, Discord, email | P3 |
| gt-6da | Federation phase 1: cross-town convoy delegation | P3 |
| gt-a6x | Formula marketplace: share community formulas | P4 |
| gt-0sy | Agent A/B testing: compare model performance | P4 |

---

## Cross-Project Synergies Identified

1. **Trading bot → Mobile app**: tb-1n6 (REST API) enables cm-c48 (trading widget in mobile app)
2. **Trading bot → Website**: tradingbot ML pipeline patterns inform cf-7ik (product recommendations)
3. **Website ↔ Mobile**: cf-b9o (shared design tokens) unifies visual identity across platforms
4. **Gas Town → Trading bot**: tb-f2i (MCP server) lets Gas Town agents manage the trading bot
5. **Gas Town → All rigs**: gt-5kz (webhooks) keeps overseer informed across all projects

---

## Research Sources

- Competitor analysis: Wayfair (AR, room planner), IKEA (TaskRabbit, planning tools), West Elm (design consultation)
- Trading: Freqtrade MCP server, funding rate arbitrage (Gate.io research), Kelly criterion (2026 Medium articles), triangular DEX arbitrage
- Mobile UX: Appbrew 2026 trends, Zolak furniture ecommerce report, eMarketer social commerce projections
- SEO/Marketing: Google Keyword Planner best practices, Klaviyo email ROI benchmarks

---

*Next cycle: deeper research into specific implementation approaches for P2 items, plus competitive monitoring for new features launched by Wayfair/IKEA/West Elm.*
