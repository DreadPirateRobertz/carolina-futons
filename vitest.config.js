import { defineConfig } from 'vitest/config';
import path from 'path';
import { readdirSync } from 'node:fs';

// Auto-discover Wix platform mock aliases from tests/__mocks__/wix-*.js
function discoverWixMocks(root) {
  const mocksDir = path.resolve(root, 'tests/__mocks__');
  const aliases = {};
  for (const entry of readdirSync(mocksDir)) {
    if (!entry.startsWith('wix-') || !entry.endsWith('.js')) continue;
    const moduleName = entry.replace(/\.js$/, '');
    aliases[moduleName] = path.resolve(mocksDir, entry);
  }
  return aliases;
}

// Auto-discover backend module aliases: 'backend/foo.web' → 'src/backend/foo.web.js'
function discoverBackendAliases(root) {
  const backendDir = path.resolve(root, 'src/backend');
  const aliases = {};
  for (const entry of readdirSync(backendDir, { recursive: true })) {
    if (!entry.endsWith('.js')) continue;
    const rel = entry.replace(/\\/g, '/');
    aliases[`backend/${rel.replace(/\.js$/, '')}`] = path.resolve(backendDir, rel);
  }
  return aliases;
}

// Auto-discover public module aliases: both 'public/Foo.js' and 'public/Foo' → 'src/public/Foo.js'
function discoverPublicAliases(root) {
  const publicDir = path.resolve(root, 'src/public');
  const aliases = {};
  for (const entry of readdirSync(publicDir, { recursive: true })) {
    if (!entry.endsWith('.js')) continue;
    const rel = entry.replace(/\\/g, '/');
    const fullPath = path.resolve(publicDir, rel);
    aliases[`public/${rel}`] = fullPath;
    aliases[`public/${rel.replace(/\.js$/, '')}`] = fullPath;
  }
  return aliases;
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/**/__mocks__/**'],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
      },
    },
  },
  resolve: {
    alias: {
      ...discoverWixMocks(__dirname),
      ...discoverBackendAliases(__dirname),
      ...discoverPublicAliases(__dirname),
    },
  },
});
