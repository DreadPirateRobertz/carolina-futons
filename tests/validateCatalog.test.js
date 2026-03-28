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
    // Should list canonical categories from catalogImport.web.js
    expect(result).toContain('Canonical categories');
    expect(result).toContain('futon-frames');
    expect(result).toContain('wall-hugger-frames');
  });

  it('reports product count', () => {
    const result = execFileSync('node', [SCRIPT], { encoding: 'utf8', cwd: ROOT });
    expect(result).toContain('88 products');
  });

  it('lists all source files with VALID_CATEGORIES', () => {
    // The script checks these files — verify they all exist
    const files = [
      'src/backend/catalogImport.web.js',
      'src/backend/catalogContent.web.js',
      'src/backend/loadCatalogMaster.web.js',
      'src/backend/productVideos.web.js',
    ];
    for (const f of files) {
      const full = path.join(ROOT, f);
      expect(fs.existsSync(full), `${f} should exist`).toBe(true);
      const src = fs.readFileSync(full, 'utf8');
      expect(src).toContain('VALID_CATEGORIES');
    }
  });

  it('all VALID_CATEGORIES arrays match the canonical set', () => {
    // Parse each file's VALID_CATEGORIES and compare
    const files = [
      'src/backend/catalogImport.web.js',
      'src/backend/catalogContent.web.js',
      'src/backend/loadCatalogMaster.web.js',
      'src/backend/productVideos.web.js',
    ];
    const sets = files.map(f => {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const match = src.match(/VALID_CATEGORIES\s*=\s*\[([\s\S]*?)\]/);
      expect(match, `Could not parse VALID_CATEGORIES from ${f}`).not.toBeNull();
      const items = match[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
      return { file: f, categories: items.sort() };
    });

    const canonical = sets[0]; // catalogImport is canonical
    for (let i = 1; i < sets.length; i++) {
      expect(sets[i].categories, `${sets[i].file} should match ${canonical.file}`).toEqual(canonical.categories);
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
