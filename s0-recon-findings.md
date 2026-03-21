# CF-q3sm: S0 Recon Findings — documentServices API

**Date**: 2026-03-21
**Status**: COMPLETE — all APIs confirmed working

---

## Key Discovery: No postMessage Needed

`documentServices` is directly accessible and **writable** from within the `preview-frame` JavaScript context. The Hookup Assistant does NOT need to intercept/reverse-engineer postMessage payloads.

---

## Confirmed APIs

### Access Point
```javascript
// In preview-frame (editor.wix.com/html/editor/web/renderer/render/document/...)
const ds = window.documentServices;
```

### Read Nickname
```javascript
const nick = ds.components.code.getNickname(compRef);
// Returns: string (e.g., "heroTitle", "footerEmailSubmit")
```

### Write Nickname ✅ WORKS
```javascript
ds.components.code.setNickname(compRef, 'newNickname');
// No return value needed. Allow ~200ms before reading back.
await new Promise(r => setTimeout(r, 200));
const confirmed = ds.components.code.getNickname(compRef);
```

### Validate Nickname
```javascript
const result = ds.components.code.validateNickname(compRef, 'heroTitle');
// Returns one of: "VALID" | "ALREADY_EXISTS" | "TOO_SHORT" | "TOO_LONG" | "INVALID_NAME"
```

**Validation Rules:**
- `INVALID_NAME` — underscores, spaces, special chars not allowed
- `ALREADY_EXISTS` — nickname already assigned to another component on this site
- `TOO_SHORT` — minimum length enforced (very short, even "a" passes)
- `TOO_LONG` — maximum length enforced
- camelCase alphanumeric works: `heroTitle`, `footerEmailSubmit`, `box1`, `btn2`

### Get All Components on a Page
```javascript
const all = ds.components.getAllComponents({ id: 'c1dmp', type: 'Page' });
// Returns array of compRef objects: [{ id: 'comp-xyz', ... }, ...]
// Home page 'c1dmp' has 73 components
```

### Check Hidden/Collapsed Capability
```javascript
const canHide = ds.components.is.hiddenable(compRef);     // boolean
const canCollapse = ds.components.is.collapsible(compRef); // boolean
```

### Get All Hidden Components
```javascript
const hidden = ds.components.transformations.getAllHiddenComponents({ id: 'c1dmp', type: 'Page' });
// Returns array of hidden compRefs
```

---

## Bulk Rename Script (Browser Console)

Run this in browser console while on the `preview-frame` context (use DevTools → select `preview-frame` from frame selector):

```javascript
(async () => {
  const ds = window.documentServices;

  // Page IDs — Wix internal page IDs
  const PAGE_IDS = {
    home:    'c1dmp',
    // Add others as needed from EDITOR_HOOKUP_GUIDE
  };

  // Target nickname map: { currentNick: 'newNick' } OR by component type
  const RENAME_MAP = {
    // Home page elements — from EDITOR_HOOKUP_GUIDE
    // Add your mappings here
  };

  async function renameAll(pageId, renameMap) {
    const all = ds.components.getAllComponents({ id: pageId, type: 'Page' });
    const results = [];

    for (const compRef of all) {
      const current = ds.components.code.getNickname(compRef);
      const target = renameMap[current];
      if (!target) continue;

      const validation = ds.components.code.validateNickname(compRef, target);
      if (validation !== 'VALID') {
        results.push({ from: current, to: target, status: 'SKIP:' + validation, id: compRef.id });
        continue;
      }

      ds.components.code.setNickname(compRef, target);
      await new Promise(r => setTimeout(r, 150));
      const confirmed = ds.components.code.getNickname(compRef);
      results.push({
        from: current, to: target,
        status: confirmed === target ? 'OK' : 'FAIL',
        id: compRef.id
      });
    }

    console.table(results);
    return results;
  }

  // Run
  return await renameAll(PAGE_IDS.home, RENAME_MAP);
})();
```

---

## Hookup Assistant Architecture Implication

**Original assumption**: Hookup Assistant needs to intercept postMessage payloads from Properties & Events panel.

**Actual finding**: `documentServices` is directly callable from preview-frame. The Hookup Assistant can:

1. **Option A (fastest)**: Browser console bookmarklet — inject script directly, call setNickname in bulk. No Wix CLI app needed. Can rename all 745 elements programmatically.

2. **Option B (Wix CLI add-on)**: From `editorReady()` callback, `editorSDK.components.code.setNickname()` provides the same API. Full UI panel for guided renaming.

3. **Option C (current Hookup Assistant)**: Dashboard plugin communicates to editor via Wix SDK — still valid but more complex than Option A.

**Recommendation for Stilgar**: Run Option A (bookmarklet/console script) immediately to bulk-rename all elements per EDITOR_HOOKUP_GUIDE. This saves days vs waiting for Option B/C to be built.

---

## All Page IDs (30 pages)

| Page Title | Wix Internal ID | URI |
|------------|-----------------|-----|
| **Home** | **c1dmp** | /home |
| **Product Page** | **ve2z7** | /product-page |
| **Category Page** | **u0gn0** | /category-page |
| **Cart Page** | **mqi5m** | /cart-page |
| **Checkout** | **psuom** | /checkout |
| **Search Results** | **evr2j** | /search |
| **FAQ** | **s2c5g** | /faq |
| **About** | **gar3e** | /about |
| **Contact** | **k14wx** | /contact |
| **Shipping Policy** | **ype8c** | /shipping-policy |
| Blog | kkbdq | /blog |
| Post | naud5 | /post |
| Style Quiz | nwjfa | /blank-1 |
| Admin Returns | qoc25 | /blank |
| Member Page | f00pg | /members-area |
| Members | ws9sh | /members |
| Thank You | msuhj | /thank-you |
| Thank You Page | dk9x8 | /thank-you-page |
| Plans & Pricing | aggpq | /plans-pricing |
| Paywall | w6yh4 | /paywall |
| Privacy Policy | pcvmd | /privacy-policy |
| Refund Policy | jmwgj | /refund-policy |
| Terms & Conditions | z0xvf | /terms-and-conditions |
| Accessibility Statement | di5bl | /accessibility-statement |
| Booking Calendar | nd1mx | /booking-calendar |
| Book Online | u3ysd | /book-online |
| Booking Form | xr7ty | /booking-form |
| Service Page | n31or | /service-page |
| Plan Customization | jxteg | /plan-customization |
| File Share | dvpe7 | /file-share |

**Bold** = CF pages requiring element hookup per EDITOR_HOOKUP_GUIDE

## Component Count

| Page | Wix ID | Component Count |
|------|--------|-----------------|
| Home | c1dmp  | 73              |
| Others | varies | TBD (run getAllComponents per page) |

---

## Already-Named Elements (Home Page — partial)

Some elements already have CF nicknames from previous sessions:
- `footerContactInfo` ✅
- `footerEmailSubmit` ✅
- `footerNewsletterTitle` ✅
- `footerNewsletterSubtitle` ✅

Template/auto-generated names still present:
- `vectorImage8`, `expandableMenu1`, `menuContainer1`, `line10`, `box30-34`, `text19-23`, etc.

---

## Next Steps (unblocked by this recon)

1. **Write bulk rename script** for each page using EDITOR_HOOKUP_GUIDE as source of truth
2. **Get all page IDs** — run `ds.page.getPageList()` or similar to get all 19 page IDs
3. **Run in browser** — Stilgar can paste console script, rename all elements in one session
4. Continue Hookup Assistant development for ongoing/future use (CF-wth8 epic)
