import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/orchestrator*.test.ts'],
    testTimeout: 60000, // 60 seconds timeout for orchestrator tests
    globals: true,
  },
});