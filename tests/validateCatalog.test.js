import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/validate-catalog.js');

describe('validate-catalog.js', () => {
  it('passes on current catalog-MASTER.json', () => {
    const result = execFileSync('node', [SCRIPT], { encoding: 'utf8', cwd: ROOT });
    expect(result).toContain('All checks passed');
  });

  it('detects category consistency across source files', () => {
    const result = execFileSync('node', [SCRIPT], { encoding: 'utf8', cwd: ROOT });
    // Canonical list now lives in src/backend/utils/catalogCategories.js
    expect(result).toContain('Canonical categories');
    expect(result).toContain('futon-frames');
    expect(result).toContain('wall-hugger-frames');
  });

  it('reports product count', () => {
    const result = execFileSync('node', [SCRIPT], { encoding: 'utf8', cwd: ROOT });
    expect(result).toContain('88 products');
  });

  it('canonical VALID_CATEGORIES module exists + each consumer imports from it', () => {
    // cf-dtu6: VALID_CATEGORIES was extracted to a single canonical module.
    // The 3 consumer files must import from it (no shadow constants).
    const canonicalRel = 'src/backend/utils/catalogCategories.js';
    const canonicalPath = path.join(ROOT, canonicalRel);
    expect(fs.existsSync(canonicalPath), `${canonicalRel} should exist`).toBe(true);
    const canonicalSrc = fs.readFileSync(canonicalPath, 'utf8');
    expect(canonicalSrc).toMatch(/export\s+const\s+VALID_CATEGORIES\s*=\s*\[/);

    const consumers = [
      'src/backend/catalogContent.web.js',
      'src/backend/loadCatalogMaster.web.js',
      'src/backend/productVideos.web.js',
    ];
    const importLine = "import { VALID_CATEGORIES } from 'backend/utils/catalogCategories'";
    for (const f of consumers) {
      const full = path.join(ROOT, f);
      expect(fs.existsSync(full), `${f} should exist`).toBe(true);
      const src = fs.readFileSync(full, 'utf8');
      expect(src, `${f} should import from canonical module`).toContain(importLine);
      expect(src, `${f} must not shadow VALID_CATEGORIES locally`).not.toMatch(/const\s+VALID_CATEGORIES\s*=\s*\[/);
    }
  });

  it('all product SKUs in catalog-MASTER.json are unique', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/catalog-MASTER.json'), 'utf8'));
    const skus = catalog.products.map(p => p.sku).filter(Boolean);
    const unique = new Set(skus);
    expect(unique.size).toBe(skus.length);
  });

  it('no product prices exceed 10000', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/catalog-MASTER.json'), 'utf8'));
    const overpriced = catalog.products.filter(p => p.price != null && p.price >= 10000);
    expect(overpriced).toEqual([]);
  });

  it('no product prices are negative or zero', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/catalog-MASTER.json'), 'utf8'));
    const bad = catalog.products.filter(p => p.price != null && p.price <= 0);
    expect(bad).toEqual([]);
  });

  it('all products have required fields', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/catalog-MASTER.json'), 'utf8'));
    const required = ['name', 'slug', 'sku', 'category'];
    const missing = [];
    for (const p of catalog.products) {
      for (const field of required) {
        if (!p[field]) missing.push(`${p.name || 'unnamed'}: missing ${field}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
