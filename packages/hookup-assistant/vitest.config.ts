/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx', // entry-point boilerplate: ReactDOM.createRoot render call only
      ],
      thresholds: {
        statements: 62,
        branches: 59,
        functions: 62,
        lines: 62,
      },
    },
  },
});
