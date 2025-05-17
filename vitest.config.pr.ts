import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/orchestrator.test.ts'],
    globals: true,
    testTimeout: 60000,
  },
});