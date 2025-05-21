import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds
    include: ['src/__tests__/edge-cases.test.ts'],
    environment: 'node',
  },
});