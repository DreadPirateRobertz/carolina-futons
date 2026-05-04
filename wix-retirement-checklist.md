# Wix Studio Retirement Checklist — cf-3qt.9.2

**Author:** morgott  
**Date:** 2026-05-04  
**Scope:** Staging site (halworker85 / My Site) — documentation only, no production changes  
**Related:** `retirement-plan.md` covers the production carolinafutons.com unpublish (cf-3qt.9.1)

---

## Site Identity

| Field | Value |
|---|---|
| Wix account | **halworker85** — display name "Hal Worker", Role: Owner |
| Account subdomain | `chrisdealglass.wixstudio.com` |
| Site name | **My Site 5** (originally "My Site") |
| Wix subdomain URL | `https://chrisdealglass.wixstudio.com/my-site` |
| **metaSiteId** | **`3af610bf`** |
| Wix dashboard | `manage.wix.com/dashboard/3af610bf/home` |
| Site status (as of 2026-05-04) | Published (confirmed by `wix-publish-dialog.png`) |

> The `metaSiteId` is required for any Wix Headless API calls, Velo HTTP function
> calls targeting this site, and for support tickets. Record it here as the
> permanent identifier — it does not change even if the site is renamed.

---

## Wix Sites List — Account Overview

Two sites exist under halworker85:

| Site name | URL | Purpose |
|---|---|---|
| **STAGING_SITE** | `https://chrisdealglass....` | Carolina Futons staging — mirrors production Velo/CMS |
| **My Site 5** | `https://chrisdealglass....` | Development sandbox — halworker85 test site |

Both are under the same Hal Worker owner account (`HW` badge in Wix Studio header).
`STAGING_SITE` has the Carolina Futons product catalog wired; `My Site 5` is a bare
development scaffold with no custom domain.

Screenshot reference: `wix-sites-list.png`

---

## Unpublish Flow — Step by Step

> This documents the UI path for **My Site 5** (metaSiteId `3af610bf`).  
> For the **production carolinafutons.com** unpublish, see `retirement-plan.md §1`.

### Path A — From the Wix Dashboard (recommended)

1. Navigate to `https://manage.wix.com/dashboard/3af610bf/home`  
   *(or: wix.com → Sites → click "My Site 5" → opens site dashboard)*
2. In the left sidebar, click **Site & Mobile App** to expand the section.
3. Click **Site Actions** (or look for the **⋯** menu on the site card in the Sites list).
4. Select **Unpublish Site**.
5. Wix displays a confirmation dialog: _"Your site will be taken offline. Visitors will see a 'Site is not published' page."_ — click **Unpublish**.
6. The site status indicator changes from **Published** (green) to **Unpublished**.
7. Verify by navigating to `https://chrisdealglass.wixstudio.com/my-site` — should show the Wix "coming soon" or "not published" page.

### Path B — From the Wix Studio Editor

1. Open the site in the Wix Studio editor.
2. Top bar → click the **Publish ▾** dropdown button (blue button, top-right area).
3. In the dropdown, select **Unpublish**.
4. Confirm in the dialog.

### Rollback

If unpublish causes unexpected Wix Stores / Velo API issues:  
**Dashboard → Site Actions → Publish Site** (or editor **Publish** button).  
The Wix subdomain URL restores immediately — no DNS changes needed.

---

## Premium Plan — Current State + Downgrade Options

### STAGING_SITE

The STAGING_SITE dashboard (`wix-headless-settings.png`) shows an **Upgrade** button
in the top header bar, indicating it is on a **free or Lite plan**. It does not need a
downgrade — it can simply be unpublished or left as-is.

### My Site 5 (this checklist's scope)

The "My Site 5" site was last seen published as a bare Studio scaffold. It is likely on
a **free Wix plan** (no custom domain, Wix subdomain only). No subscription downgrade
is needed before unpublishing a free-plan site.

### Production carolinafutons.com (for completeness)

See `retirement-plan.md §3` for the full downgrade evaluation. Summary:

| Plan | ~Monthly | Wix Stores | Velo | Rendering |
|---|---|---|---|---|
| **Wix Headless** (recommended) | ~$13 | ✅ API | ✅ | ❌ (not needed) |
| Business Unlimited (assumed current) | ~$25 | ✅ | ✅ | ✅ (unused after retirement) |
| **Estimated savings** | **~$12/mo (~$144/yr)** | | | |

Downgrade path: Wix Dashboard → **Billing & Subscriptions** → select the active plan →
**Change Plan** → select **Wix Headless**. Requires Stilgar approval first (see
`retirement-plan.md §4`).

---

## Screenshots on File

These screenshots in `crew/melania/` document the Wix Studio UI state as of the
audit date:

| File | Contents |
|---|---|
| `wix-sites-list.png` | halworker85 Sites list — STAGING_SITE + My Site 5 |
| `wix-publish-dialog.png` | Post-publish "Congratulations" dialog (editor, My Site, subdomain URL visible) |
| `wix-headless-settings.png` | STAGING_SITE dashboard Settings page (shows Upgrade CTA → free/Lite plan) |
| `wix-home.png` | Old Wix-rendered carolinafutons.com home (pre-migration baseline) |
| `wix-studio-sites.png` | Sites list duplicate view (same as wix-sites-list.png, slightly different state) |
| `wix-headless-clients-list.png` | Wix Headless API clients list (API key config) |
| `wix-headless-cf-web-client-config.png` | cfw Headless client configuration |
| `wix-headless-settings-account.png` | Account-level Headless settings |
| `wix-settings-headless-search.png` | Settings search result for "headless" |
| `wix-dashboard-login-success.png` | Login confirmation |

---

## Checklist — When Ready to Execute

*For My Site 5 (metaSiteId 3af610bf) only. Not gated on Stilgar approval — this is a
staging/dev site with no production traffic.*

- [ ] Confirm `My Site 5` has no active integrations that depend on its published state
- [ ] Confirm no Velo backend functions in `My Site 5` receive production webhooks
- [ ] Log in to halworker85 account at wix.com
- [ ] Navigate to My Site 5 dashboard via Sites list
- [ ] Execute **Unpublish** (Path A above)
- [ ] Verify `chrisdealglass.wixstudio.com/my-site` returns "not published" page
- [ ] Record timestamp in Execution Log below

---

## Execution Log

| Date | Action | Executed by | Notes |
|---|---|---|---|
| — | My Site 5 unpublished | — | — |
