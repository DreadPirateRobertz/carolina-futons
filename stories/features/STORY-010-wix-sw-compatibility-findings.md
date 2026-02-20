# STORY-010 Wix Velo Service Worker Compatibility: Research Findings

## Summary
Deep research into whether Wix Velo supports custom service workers served via `/_functions/` path. The answer: **it worked in 2021-2022 but appears broken since August 2023**. No confirmed working implementation since then. Recommendation: **pivot to PWA-lite** (manifest-only, no service worker).

## Evidence Timeline

| Date | Event | Status |
|------|-------|--------|
| Jun 2021 | prashanthbhaskaran posts working PWA via `/_functions/` SW | WORKING |
| Jul 2022 | sheetalpbhatia confirms `Service-Worker-Allowed: /` header fixes scope | WORKING |
| Oct 2022 | Pushpad publishes definitive `/_functions/` SW guide | WORKING |
| Aug 2023 | davidbrowwn reports "Wix no longer allows this type of configuration" | BROKEN |
| Aug 2023 | Wix Thunderbolt clientWorker.js 404 errors appear | PLATFORM CHANGE |
| Nov 2024 | sheetalpbhatia points to Wix App Market PWA app as new solution | WORKAROUND |
| Jan 2025 | PageHudson cannot register SW. Wix rep suggests Twilio, not `/_functions/` | BROKEN |

## Key Findings

### 1. Content-Type Override Problem
Wix has a documented history of overriding HTTP function `Content-Type` headers to `application/json`. If `application/javascript` is overridden, the browser rejects SW registration (MIME type check fails). Premium sites appeared to bypass this override during 2021-2023 but no post-2023 confirmation exists.

### 2. No Official Support
- Zero Wix changelog entries about service worker support (2022-2026)
- Wix's official position: "Currently it is not possible to convert your site to a Progressive Web Application" (support article, still live)
- Wix representative (Feb 2025) did not mention `/_functions/` as viable

### 3. Scope Conflict Risk
Browser spec allows one active SW per scope. Wix's Thunderbolt engine uses a `clientWorker` bundle. If Wix ever registers a platform-level SW at scope `/`, it silently overrides custom SWs.

### 4. Third-Party Assessments
- **Progressier**: "With Wix, it's not possible to add a service worker to your PWA."
- **Pushpad**: Documented working approach in Oct 2022, but no recent updates
- **Wix App Market PWA app**: Third-party app exists but limited control

## Risk Assessment: HIGH

1. Depends on undocumented behavior (Content-Type passthrough on premium)
2. No official Wix support or documentation
3. Appears broken since mid-2023, no post-2023 confirmed success
4. Wix can change HTTP function proxy behavior at any time without notice
5. Cloudflare Workers proxy is more robust but adds infrastructure complexity

## Recommendation: Pivot to PWA-Lite

**Keep what works:**
- `get_manifest` endpoint (JSON content-type works reliably on Wix)
- `<link rel="manifest">` in site header custom code (Wix allows `<link>` tags in header)
- Install prompt detection in page code (beforeinstallprompt event)
- Standalone display mode detection

**Drop what's unreliable:**
- `get_serviceWorker` endpoint — keep the code but don't register it in production
- Offline caching via service worker — not viable on Wix
- Push notifications via SW — use third-party service (OneSignal, Pushpad) instead

**PWA-Lite delivers:**
- "Add to Home Screen" prompt on Android (manifest is sufficient)
- Standalone app-like experience (fullscreen, no browser chrome)
- Theme color integration with OS
- App metadata (name, icons, description)
- iOS Safari "Add to Home Screen" (reads manifest natively since iOS 16.4)

## Acceptance Criteria
- [ ] Update `get_serviceWorker` with a comment noting it's experimental/unsupported
- [ ] Remove SW registration from masterPage.js integration plan
- [ ] Add manifest link instructions for Wix Dashboard custom code
- [ ] Update STORY-009 status to reflect PWA-lite pivot
- [ ] Document the Cloudflare Workers approach as a future fallback option

## Estimate
- Size: XS (documentation + minor code comments)
- Priority: P0 (blocks PWA Phase 2 planning)
- Dependencies: STORY-009 Phase 1 (done)
