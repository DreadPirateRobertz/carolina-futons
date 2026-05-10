# Lighthouse baseline — pre-DNS-cutover

**Bead:** cf-z0ht (cf-3qt.8 cutover gate)
**Author:** godfrey · 2026-05-10
**Target:** `https://carolina-futons-web.vercel.app` (Vercel preview, alias of cfw `main`)
**Tool:** chrome-devtools-mcp `lighthouse_audit` (`navigation` mode)
**Viewports:** Desktop 1280×800 · Mobile 390×844

> **Tool scope note:** the `lighthouse_audit` MCP only emits the four
> static categories below. The Performance score and PWA category are
> NOT in this baseline — they require a separate `performance_start_trace`
> run that wasn't part of cf-z0ht's tool budget. File a follow-up bead
> if the cutover gate needs the Performance score locked in too. The
> bead text mentions "Performance | Accessibility | Best Practices | SEO
> | PWA"; this baseline covers Accessibility / Best Practices / SEO /
> Agentic Browsing (the chrome-devtools-mcp set).

## Summary

| Score column | All ≥ 80? | Lowest |
|---|---|---|
| Accessibility | ✅ Yes | 96 (home desktop, kingston PDP both viewports, contact both viewports) |
| Best Practices | ✅ Yes | 81 (every page × every viewport — same root cause, see §4) |
| SEO | ✅ Yes | 92 (kingston PDP both viewports — meta-description gap, see §4) |
| Agentic Browsing | ⚠️ **MIXED** | **67** on home desktop, frames-PLP mobile, contact desktop, kingston PDP desktop |

**No score < 80 on Accessibility / Best Practices / SEO** → these three categories are clear of the cutover-blocker threshold.

**Agentic Browsing dipped to 67 on 4 of 10 audits** — root cause is a missing `llms.txt` (see §4). Per the cf-z0ht spec, anything < 80 is flagged as a cutover blocker. **Decision needed:** is the missing `llms.txt` a real blocker or an aspirational metric? Recommend treating as advisory (not blocking) — it's a brand-new metric and the cutover gate is fundamentally about user-facing health. Logging here so melania/Stilgar can override.

## Per-page scores

### `/` (home)

| Viewport | Accessibility | Best Practices | SEO | Agentic Browsing |
|---|---|---|---|---|
| Desktop | 96 | 81 | 100 | **67** ⚠️ |
| Mobile | 97 | 81 | 100 | 100 |

### `/shop/futon-frames` (PLP)

| Viewport | Accessibility | Best Practices | SEO | Agentic Browsing |
|---|---|---|---|---|
| Desktop | 100 | 81 | 100 | 100 |
| Mobile | 100 | 81 | 100 | **67** ⚠️ |

### `/products/kingston-futon-frame` (PDP)

| Viewport | Accessibility | Best Practices | SEO | Agentic Browsing |
|---|---|---|---|---|
| Desktop | 96 | 81 | 92 | **67** ⚠️ |
| Mobile | 96 | 81 | 92 | 99 |

### `/about`

| Viewport | Accessibility | Best Practices | SEO | Agentic Browsing |
|---|---|---|---|---|
| Desktop | 100 | 81 | 100 | 100 |
| Mobile | 100 | 81 | 100 | 100 |

### `/contact`

| Viewport | Accessibility | Best Practices | SEO | Agentic Browsing |
|---|---|---|---|---|
| Desktop | 97 | 81 | 100 | **67** ⚠️ |
| Mobile | 97 | 81 | 100 | 100 |

## Failed audits — recurring root causes

Audits that scored 0 on at least one (page, viewport) pair, in order of breadth:

| Audit ID | Title | Pages affected | Root cause / fix |
|---|---|---|---|
| `deprecations` | Uses deprecated APIs | **All 10 audits** | **Identified (cf-z0ht.fu1):** Meta Pixel (`connect.facebook.net/en_US/fbevents.js:279`) uses Chrome's deprecated Attribution Reporting API. Third-party — can't be patched from our side. See [chromestatus.com/feature/6320639375966208](https://chromestatus.com/feature/6320639375966208). Mitigation: wait for Facebook to update fbevents.js, or remove the Pixel (loses conversion tracking). Drives the BP=81 ceiling everywhere. |
| `llms-txt` | `llms.txt` is missing or incomplete | 4 audits (mostly desktop) | Add `public/llms.txt` describing the site for LLM crawlers. New SEO/agentic-browsing convention; not user-facing. |
| `color-contrast` | Background and foreground colors do not have a sufficient contrast ratio | home (D+M), kingston PDP (D+M), contact (D+M) | Specific elements fail WCAG AA. Run color-contrast checker against current cfw token palette. Likely `text-cf-blue` on dark backdrops or similar. Pre-existing — drives the 96–97 a11y scores. |
| `meta-description` | Document does not have a meta description | kingston PDP (D+M) only | **Likely false positive (cf-z0ht.fu1):** the PDP DOES set `<meta name="description">` server-side via `generateMetadata` in `src/app/products/[slug]/page.tsx:65`. Verified by curl on the same preview URL — meta is present and reasonable. The Lighthouse 0-score was likely a transient (fixture-mode cold start where `getProductBySlug` returns stub data without a description). Re-run pre-cutover; if it persists, audit fixture data. |
| `heading-order` | Heading elements are not in a sequentially-descending order | kingston PDP (D+M) | A `<h3>` likely follows an `<h1>` without an intermediate `<h2>` (or similar). Reorder PDP heading hierarchy. |
| `label-content-name-mismatch` | Elements with visible text labels do not have matching accessible names | home (D+M only) | An `aria-label` on a button or link disagrees with the visible text. Common with icon-only buttons that have a sublabel. Inspect home header / nav. |
| `cumulative-layout-shift` | Cumulative Layout Shift | kingston PDP mobile (CLS=0.98 — score 0.98 not 0) | Borderline pass; image / hero CLS during initial render. Add explicit `width`/`height` to the PDP hero to lock the slot. |

> Total per-audit timings ranged 6.5 s – 13 s — well below typical Lighthouse runtime variance. No timeouts.

## Cutover-blocker call

| Category | Min score across 10 audits | Cutover threshold (`< 80` = block) | Verdict |
|---|---|---|---|
| Accessibility | 96 | 80 | **PASS** |
| Best Practices | 81 | 80 | **PASS** (tight — one regression and we cross) |
| SEO | 92 | 80 | **PASS** |
| Agentic Browsing | 67 | 80 | **MARGINAL — recommend advisory, not block** |

**Recommendation: do NOT block cutover on these scores.** Best Practices is at 81 (deprecations = single root cause across all pages, almost certainly third-party SDK). Agentic Browsing dips to 67 only because of `llms.txt` which is a new SEO/AI-crawler hint, not user-facing.

**Recommended pre-cutover patches (cheap):**

1. Add `public/llms.txt` (one file, ~50 lines, lifts agentic-browsing across the board).
2. Add PDP `<meta name="description">` template (lifts kingston PDP SEO from 92 → 100).
3. Audit the deprecated-API call (Best Practices ceiling will rise once removed).

These are P3 polish, not P1 blockers.

## Reproducing this baseline

```
# Start chrome-devtools-mcp browser session
# (or use Playwright with @playwright/test + lighthouse, same scoring)

For each URL in [
  /,
  /shop/futon-frames,
  /products/kingston-futon-frame,
  /about,
  /contact,
]:
  navigate to https://carolina-futons-web.vercel.app/<URL>
  resize 1280x800; lighthouse_audit device=desktop mode=navigation
  resize 390x844;  lighthouse_audit device=mobile  mode=navigation

# JSON reports persisted under
#   /var/folders/.../chrome-devtools-mcp-*/report.json
# (parse `audits[*].score` for failed-audit lists)
```

## Linked beads

- **Parent:** cf-3qt.8 (DNS cutover gate)
- **This bead:** cf-z0ht (Lighthouse baseline)
- **Sibling:** cf-x6ph + cf-x0ks (`/api/health` endpoint)
- **Sibling:** cf-3qt.8.31 (UptimeRobot activation — Stilgar gated)
- **Stability window:** cf-3qt.9 (30-day post-cutover review)
