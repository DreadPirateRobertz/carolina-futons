# CMS Import Scripts

Backend web modules for importing scraped product data into Wix CMS collections.

## Expected Scrape JSON Format

Melania's scrape produces a JSON file per collection. Place them in `scripts/data/`
before running imports. See `importConfig.js` for the expected shapes.

## Modules

| Module | Collection | Notes |
|--------|-----------|-------|
| `cmsImport.web.js` | All | Orchestrator — calls per-collection importers |
| `importProducts.js` | Stores/Products | Uses wix-stores-backend SDK |
| `importSwatches.js` | FabricSwatches | Bulk insert with dedup on swatchId |
| `importAssemblyGuides.js` | AssemblyGuides | Dedup on sku |
| `importBundles.js` | ProductBundles | Dedup on bundleId |
| `importVideos.js` | Videos | Dedup on title+videoUrl |
| `importConfig.js` | — | Shared constants, validation, batch helper |

## Usage

After deploying, call from any admin page:

```js
import { runImport } from 'backend/cmsImport.web';
const result = await runImport('FabricSwatches', jsonArray);
```

Or import all at once:

```js
import { runFullImport } from 'backend/cmsImport.web';
const results = await runFullImport(scrapePayload);
```
