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
      'wix-location-frontend': path.resolve(__dirname, 'tests/__mocks__/wix-location-frontend.js'),
      'wix-stores-frontend': path.resolve(__dirname, 'tests/__mocks__/wix-stores-frontend.js'),
      'wix-location': path.resolve(__dirname, 'tests/__mocks__/wix-location.js'),
      'backend/ups-shipping.web': path.resolve(__dirname, 'src/backend/ups-shipping.web.js'),
      'backend/productRecommendations.web': path.resolve(__dirname, 'src/backend/productRecommendations.web.js'),
      'backend/seoHelpers.web': path.resolve(__dirname, 'src/backend/seoHelpers.web.js'),
      'backend/swatchService.web': path.resolve(__dirname, 'src/backend/swatchService.web.js'),
      'public/galleryHelpers.js': path.resolve(__dirname, 'src/public/galleryHelpers.js'),
      'public/galleryHelpers': path.resolve(__dirname, 'src/public/galleryHelpers.js'),
      'public/designTokens.js': path.resolve(__dirname, 'src/public/designTokens.js'),
      'public/designTokens': path.resolve(__dirname, 'src/public/designTokens.js'),
    },
  },
});
