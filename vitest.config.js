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
      'wix-members-backend': path.resolve(__dirname, 'tests/__mocks__/wix-members-backend.js'),
      'backend/ups-shipping.web': path.resolve(__dirname, 'src/backend/ups-shipping.web.js'),
      'backend/productRecommendations.web': path.resolve(__dirname, 'src/backend/productRecommendations.web.js'),
      'backend/seoHelpers.web': path.resolve(__dirname, 'src/backend/seoHelpers.web.js'),
    },
  },
});
