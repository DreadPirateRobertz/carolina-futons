# Test Conventions

## Import Paths

All test files live in `tests/` and import source from `src/`. Two patterns are used:

### 1. Relative paths (for dynamic imports)

Page-level tests use dynamic `import()` with relative paths from `tests/` to `src/`:

```js
// CORRECT — relative path within this repo
const { initPage } = await import('../src/pages/Product Page.js');
const { helperFn } = await import('../src/public/someHelper.js');
const { webFn } = await import('../src/backend/service.web.js');

// WRONG — references a sibling repo directory (breaks CI)
const { initPage } = await import('../carolina-futons-stage3-velo/src/pages/Product Page.js');
```

The `../carolina-futons-stage3-velo/` path exists locally when both repos are cloned side by side, but **does not exist in CI**. Never use it.

### 2. Bare specifiers via aliases (for vi.mock and static imports)

`vitest.config.js` defines aliases that map Wix-style bare imports to `src/` paths:

```js
// These resolve via vitest.config.js aliases
vi.mock('public/engagementTracker', () => ({ trackEvent: vi.fn() }));
vi.mock('backend/seoHelpers.web', () => ({ getPageTitle: vi.fn() }));
vi.mock('wix-data', () => ({ /* mock */ }));
```

Wix platform modules (`wix-data`, `wix-fetch`, etc.) resolve to `tests/__mocks__/`.

### Quick reference

| What you're importing | Pattern | Example |
|---|---|---|
| Page under test | `await import('../src/pages/PageName.js')` | `../src/pages/Side Cart Page.js` |
| Public module under test | `await import('../src/public/module.js')` | `../src/public/videoPageHelpers.js` |
| Backend module under test | `await import('../src/backend/module.web.js')` | `../src/backend/promotions.web.js` |
| Mocked dependency (Wix module) | `vi.mock('wix-data', ...)` | Alias in vitest.config.js |
| Mocked dependency (project module) | `vi.mock('public/moduleName', ...)` | Alias in vitest.config.js |
| JSON content | `await import('../content/file.json')` | `../content/faq.json` |

### Adding new aliases

If your test needs a bare specifier that isn't aliased yet, add it to `vitest.config.js` under `resolve.alias`. Always add both forms:

```js
'public/newModule.js': path.resolve(__dirname, 'src/public/newModule.js'),
'public/newModule': path.resolve(__dirname, 'src/public/newModule.js'),
```

## Test Structure

- One test file per source file: `tests/pageName.test.js` for `src/pages/Page Name.js`
- Use `describe`/`it` blocks with descriptive names
- Mock `$w` and Wix platform modules before importing the page under test
- Use `vi.mock()` for module-level mocks, `vi.fn()` for individual function mocks

## CI Compatibility

Tests run in GitHub Actions on Node 20 and 22. The runner has **only this repo** checked out — no sibling directories exist. Any import path that references `../some-other-repo/` will fail with `ERR_MODULE_NOT_FOUND`.
