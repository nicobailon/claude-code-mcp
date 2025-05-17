import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/__tests__/e2e.test.ts', 'src/__tests__/edge-cases.test.ts', 'src/__tests__/orchestrator*.test.ts'],
    globals: true,
    testTimeout: 10000,
  },
});