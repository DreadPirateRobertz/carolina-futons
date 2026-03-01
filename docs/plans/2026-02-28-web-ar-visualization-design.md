# CF-5rfj: Web AR Product Visualization

## Summary

Add 3D product visualization to the cfutons web product page using Google's `<model-viewer>` web component. Reuses the mobile AR model catalog (13 products, GLB+USDZ). iOS gets AR Quick Look automatically via USDZ. Lazy-loaded — zero page load impact.

## Architecture

### Approach: Wix HtmlComponent (`$w('#productARViewer')`)

The `<model-viewer>` web component runs inside a Wix HTML embed element. The product page sends model data via `postMessage`. This is Wix's intended pattern for custom HTML/JS.

### New Files

1. **`src/public/models3d.js`** — 3D model catalog (ported from mobile `models3d.ts`)
   - Maps productId to GLB/USDZ URLs + real-world dimensions
   - Pure data module, no platform dependencies
   - Functions: `getModel3DForProduct(productId)`, `hasARModel(productId)`

2. **`src/public/arSupport.js`** — Web AR capability detection (adapted from mobile `arSupport.ts`)
   - Detects `<model-viewer>` custom element support
   - Checks WebXR availability (future), iOS Quick Look eligibility
   - Product category eligibility (futons, frames, murphy-beds + in-stock)
   - Functions: `checkWebARSupport()`, `isProductAREnabled(product)`

3. **`src/public/ProductARViewer.js`** — Main viewer module
   - `initProductARViewer($w, state)` — follows existing product page init pattern
   - Sends model data to HtmlComponent via `postMessage`
   - Shows/hides "View in Room" button based on arSupport + model availability
   - Returns `{ destroy() }` cleanup function for SPA navigation
   - Lazy loads `<model-viewer>` script only on interaction (200KB saved on page load)

4. **Tests** (TDD — written first)
   - `tests/public/models3d.test.js`
   - `tests/public/arSupport.test.js`
   - `tests/public/ProductARViewer.test.js`

5. **Product Page.js integration** — Add to feature init chain after gallery

### Data Flow

```
Product Page loads
  → arSupport.checkWebARSupport() + arSupport.isProductAREnabled(product)
  → if capable + has model: show "View in Room" button
  → user clicks button
  → ProductARViewer.init() sends postMessage to HtmlComponent:
      { type: 'loadModel', glbUrl, usdzUrl, title, dimensions }
  → HtmlComponent renders <model-viewer> with:
      src=glbUrl, ios-src=usdzUrl, ar, ar-modes="webxr scene-viewer quick-look"
  → iOS Safari: tapping AR button opens USDZ in Quick Look automatically
  → Android Chrome: tapping AR button opens Scene Viewer
  → Desktop: 3D preview with orbit controls
```

### HtmlComponent Internal HTML

```html
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
<model-viewer
  ar
  ar-modes="webxr scene-viewer quick-look"
  camera-controls
  touch-action="pan-y"
  auto-rotate
  shadow-intensity="1"
  style="width:100%;height:100%;background:#2A2018">
  <button slot="ar-button">View in your room</button>
</model-viewer>
<script>
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'loadModel') {
      const mv = document.querySelector('model-viewer');
      mv.src = e.data.glbUrl;
      mv.setAttribute('ios-src', e.data.usdzUrl);
      mv.alt = e.data.title;
    }
  });
</script>
```

## Key Decisions

- **Lazy load**: model-viewer script loads only when user interacts. Zero impact on LCP/FID.
- **Graceful degradation**: AR is non-critical. Any failure hides the button silently.
- **iOS USDZ**: Handled natively by `<model-viewer>` via `ios-src` attribute.
- **No WebXR V1**: Optional future. V1 = 3D preview + native AR on mobile browsers.
- **Design tokens**: "View in Room" button uses `sunsetCoral` CTA color, `Source Sans 3` font.

## Test Coverage

| Module | Tests |
|--------|-------|
| models3d | Catalog lookup by productId, missing product returns undefined, URL structure validation, hasARModel boolean |
| arSupport | Web capability detection, product eligibility by category, out-of-stock excluded, unknown category excluded |
| ProductARViewer | Init/destroy lifecycle, postMessage contract shape, model not found hides viewer, AR unsupported hides button, cleanup removes listeners |

## Shared from Mobile

Source files in `cfutons_mobile/crew/dallas/src/`:
- `data/models3d.ts` → `src/public/models3d.js` (strip TypeScript, keep data+functions)
- `services/arSupport.ts` → `src/public/arSupport.js` (web-only subset)
- `components/ModelViewerWeb.tsx` → reference for HtmlComponent HTML (pattern reuse)
