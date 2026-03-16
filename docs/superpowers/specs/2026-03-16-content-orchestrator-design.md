# Content Orchestrator Engine — Design Spec (Phase 1)

**Date**: 2026-03-16
**Author**: godfrey (based on melania's pipeline spec)
**Bead**: CF-483q
**Status**: APPROVED (autonomous — spec-driven from melania's design)

---

## Overview

Two new backend modules that wire existing content generation modules into an automated pipeline:
1. `contentOrchestrator.web.js` — event-driven coordinator
2. `contentScheduler.web.js` — queue-based scheduler

## Architecture Decision: Wix Events API + Cron

Based on codebase exploration, the existing pattern is:
- **Wix Events API** for triggers (`wixEcom_onOrderCreated` in emailAutomation.web.js)
- **HTTP function cron endpoints** for scheduled processing (`processEmailQueue`)
- **CMS collections** for queue state

The orchestrator follows this same pattern.

## Module 1: contentOrchestrator.web.js

### Event Handlers (Wix Events API)

```
onCatalogImport(event) → schedules: newsletter, social_story, catalog_sync
onPriceUpdate(event)   → schedules: social_story (price drop), catalog_sync
onBackInStock(event)   → schedules: newsletter, social_story, catalog_sync
```

### Admin WebMethods

```
triggerManualOrchestration(eventType, productData, options?) → {success, scheduled[]}
getOrchestrationHistory(limit?) → {success, events[]}
getOrchestrationConfig() → {success, config}
updateOrchestrationConfig(config) → {success}
```

### Actual Dependency API Mappings

| Spec Function | Actual API | Module |
|---|---|---|
| buildProductBlock | `queuePromotionalEmail(templateId, recipients, vars)` | emailTemplates |
| getNewArrivalsSection | `getTemplatesBySequence('new_arrival')` | emailTemplates |
| buildProductSpotlight | `buildTemplateData('new_arrival', data)` | socialStoryHelpers |
| buildSeasonalPromo | `buildTemplateData('weekend_visit', data)` | socialStoryHelpers |
| postStory | `postStory({imageUrl, caption, dryRun})` | socialStoryService |
| buildCatalogBatch | `buildCapiEvent(eventName, data)` + `getEnhancedCatalogFields(product)` | facebookCatalog |
| syncCatalogBatch | `validateCatalogProduct(product)` + `generatePinContent(product)` | pinterestCatalogSync |

### Idempotency

Each orchestration event gets a deterministic ID: `${eventType}-${productId}-${dateKey}`.
Before scheduling, query ContentSchedule for existing entries with same `createdBy` ID.

### Dry-Run Mode

Pass `dryRun: true` to `triggerManualOrchestration`. Returns what would be scheduled without CMS writes or downstream calls.

## Module 2: contentScheduler.web.js

### Cron Endpoint

```
processContentSchedule() → {processed, failed, skipped}
```

Called via HTTP function with `X-Cron-Secret` header auth (same pattern as processEmailQueue).

### Queue Processing Rules

1. Query `ContentSchedule` where `status=pending` AND `scheduledAt <= now`
2. Sort by priority: back_in_stock(1) > price_drop(2) > new_arrival(3) > seasonal(4)
3. Dedup check: no same productId+contentType within 7 days
4. Rate limit check: `checkTokenHealth()` for social, respect send windows for email
5. Execute action, update status to `sent` or `failed`

### Admin WebMethods

```
getScheduleQueue(filters?) → {success, items[]}
cancelScheduledItem(itemId) → {success}
getScheduleStats(days?) → {success, stats}
```

### CMS Collection: ContentSchedule

| Field | Type | Index |
|---|---|---|
| contentType | Text | Y |
| platform | Text | Y |
| productId | Text | Y |
| productName | Text | N |
| scheduledAt | Date | Y |
| status | Text | Y |
| priority | Number | N |
| eventType | Text | N |
| createdBy | Text | Y |
| payload | Text (JSON) | N |
| processedAt | Date | N |
| error | Text | N |

## Design Constraints

- **Idempotent**: deterministic event IDs prevent duplicates
- **Configurable**: OrchestrationConfig CMS collection with enable/disable per action
- **Dry-run**: no side effects when `dryRun=true`
- **Rate-limit aware**: checks token health and rate limits before execution
- **Send windows**: 8am-8pm EST for email (from emailAutomation pattern)

## Success Criteria

1. Manual orchestration trigger creates correct schedule entries
2. Cron processing executes scheduled items in priority order
3. Dedup prevents same product featured within 7 days
4. Dry-run returns planned actions without executing
5. All functions have ≥80% test coverage
