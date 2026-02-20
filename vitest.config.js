import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  },
  resolve: {
    alias: {
      'wix-web-module': path.resolve(__dirname, 'tests/__mocks__/wix-web-module.js'),
      'wix-data': path.resolve(__dirname, 'tests/__mocks__/wix-data.js'),
      'wix-crm-backend': path.resolve(__dirname, 'tests/__mocks__/wix-crm-backend.js'),
      'wix-secrets-backend': path.resolve(__dirname, 'tests/__mocks__/wix-secrets-backend.js'),
      'wix-fetch': path.resolve(__dirname, 'tests/__mocks__/wix-fetch.js'),
      'backend/ups-shipping.web': path.resolve(__dirname, 'src/backend/ups-shipping.web.js'),
    },
  },
});
