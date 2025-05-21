import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds
    include: ['src/__tests__/terminal-manager.test.ts'],
    environment: 'node',
  },
});