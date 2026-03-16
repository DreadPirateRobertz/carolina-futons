# Wix App Gap Report: Live vs Staging

**Generated**: 2026-03-16
**Live site**: carolinafutons.com (16b31c24-caf2-4249-b752-1b3be4bda9b9)
**Staging site**: STAGING_SITE (3af610bf-06fb-410d-a406-c1258fa84372)

## Summary

| Metric | Count |
|--------|-------|
| Live site apps | 83 |
| Staging site apps | 64 |
| Apps on both | 49 |
| Only on live (missing from staging) | 34 |
| Only on staging (not on live) | 15 |

## Critical Gaps: Missing from Staging

These apps are installed on the live site but **not on staging**. They should be installed on staging to ensure feature parity during development.

### eCommerce (8 apps)

| App | Impact |
|-----|--------|
| **Wix eCommerce** | Core e-commerce engine — checkout, orders, payments |
| **Wix Shipping** | Shipping rate calculation and label generation |
| **Wix Accept Payments** | Payment processing integration |
| **Wix Mini Cart** | Floating cart widget |
| **Wix Order Page** | Order confirmation/tracking page |
| **Wix Thank You Page** | Post-purchase confirmation |
| **Wix Related Products** | Cross-sell recommendations |
| **Wix Gift Cards** | Gift card purchase and redemption |

### Marketing & SEO (4 apps)

| App | Impact |
|-----|--------|
| **Wix SEO Tools** | Meta tags, structured data, sitemap |
| **Wix Email Marketing** | Email campaigns and automation |
| **Wix AI Text Creator** | AI-powered content generation |
| **Wix Promote** | Marketing campaign management |

### Customer Engagement (4 apps)

| App | Impact |
|-----|--------|
| **Wix Chat** | Live chat widget |
| **Wix Inbox** | Unified messaging center |
| **Wix Comments** | Product/page commenting |
| **Wix Social** | Social sharing features |

### Analytics & Performance (2 apps)

| App | Impact |
|-----|--------|
| **Wix Analytics** | Site traffic and conversion analytics |
| **Wix Site Speed** | Performance monitoring |

### Infrastructure & Admin (16 apps)

| App | Impact |
|-----|--------|
| Wix CRM | Customer relationship management |
| Wix Business Manager | Business operations dashboard |
| Wix Data | Data collections management |
| Wix Dev Mode | Developer tools access |
| Wix API Keys | API key management |
| Wix Notifications | Push/email notifications |
| Wix Multilingual | Multi-language support |
| Wix Pricing Plans | Subscription/membership plans |
| Wix Challenges | Gamification features |
| Wix Branded App | Mobile app branding |
| Wix Go | Mobile management app |
| Wix Accordion | UI component |
| Wix Anchor | Page navigation component |
| Wix Lightbox | Modal/popup component |
| Wix Pop Ups | Marketing popups |
| Wix Sidebar | Sidebar navigation component |

## Staging-Only Apps (15 unknown IDs)

These apps are on staging but not on live. They are unidentified (not in the known apps registry). These may be development/testing tools, deprecated apps, or newly installed apps that haven't been deployed to live yet.

| App ID | Notes |
|--------|-------|
| 13d21c63-b5ec-5912-8397-c3a5ddb27a97 | Unknown |
| 14bcded7-0066-7c35-14d7-466cb3f09103 | Unknown |
| 14c92d28-031e-7910-c9a8-a670011e062d | Unknown |
| 14f25924-5664-31b2-9568-f9c5ed98c9b1 | Unknown |
| 14f25dc5-6af3-5420-9568-f9c5ed98c9b1 | Unknown |
| 225dd912-7dea-4738-8688-4b8c6955ffc2 | Unknown |
| 49a4ef91-9d6e-43ff-94de-88cb5481cdf5 | Unknown |
| 6b4d4894-c6be-4ecc-bf59-9eb4d10b9210 | Unknown |
| 7efa9936-86f7-44c6-880b-7bae4e044a3d | Unknown |
| a0c68605-c2e7-4c8d-9ea1-767f9770e087 | Unknown |
| a97c0203-062a-4dd5-97cf-a90f9800a13a | Unknown |
| b4f8769a-a44e-4da3-931f-403feb5611c6 | Unknown |
| b976560c-3122-4351-878f-453f337b7245 | Unknown |
| d5886160-f847-4d05-9e85-db765b7ce07e | Unknown |
| df892fe9-626f-44c9-a328-e29f93880b38 | Unknown |

## Apps on Both Sites (49 apps)

These apps are installed on both live and staging — no action needed:

Wix Stores, Wix Blog, Wix Bookings, Wix Site Members, Wix Forum, Wix Forms, Wix Video, Wix Events, Wix Music, Wix Instagram Feed, Wix Pro Gallery, Wix File Share, Wix Hotels, Wix Site Search, Wix Contacts, Wix Table Reservations, Wix Loyalty Program, Wix Automations, Wix Payments, Wix Owner App, Wix Coupons, Wix Get Subscribers, Wix Members Area, Wix Dashboard, Wix Triggers, Velo by Wix, Wix Ascend, Wix CMS, Wix Language Menu, Wix Blocks, Wix Accessibility Wizard, Wix Favicon, Wix Photo Albums, Wix Site Properties, Wix Rich Content, Wix Add to Cart Button, Wix REST API, Wix Code, Wix Product Widget, Wix Social Media Icons, Wix Workflows, HTML Embed (Custom Code), Wix Point of Sale, Wix Tasks, Wix Product Page, Wix Back in Stock, Wix Category Page, Wix Cart, Wix Checkout

## Recommendations

1. **Priority 1**: Install the 8 missing eCommerce apps on staging — these directly affect checkout flow and purchase functionality
2. **Priority 2**: Install SEO Tools and Analytics — needed to validate SEO and performance work
3. **Priority 3**: Install Chat, Inbox, and Social — needed to test customer engagement features
4. **Investigate**: Identify the 15 unknown staging-only apps — they may be dev tools or deprecated apps that should be removed
