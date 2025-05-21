import { ClaudeMock } from './claude-mock.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach } from 'vitest';

// Store mapping of test IDs to mocks for isolation in parallel execution
const mockInstances = new Map<string, ClaudeMock>();
let defaultMock: ClaudeMock | null = null;

/**
 * Get an isolated mock instance for a specific test
 * This helps prevent race conditions in parallel test execution
 */
export async function getIsolatedMock(testId?: string): Promise<ClaudeMock> {
  // Generate a unique ID if none provided
  const mockId = testId || randomUUID();
  
  // Create a new mock if one doesn't exist for this test ID
  if (!mockInstances.has(mockId)) {
    // Create a unique binary name based on the test ID
    const binaryName = `claude-mock-${mockId.substring(0, 8)}`;
    const mock = new ClaudeMock(binaryName);
    mockInstances.set(mockId, mock);
    
    // Set up the mock
    await mock.setup();
    
    // Register a cleanup function to run when the test is done
    if (typeof afterEach === 'function') {
      afterEach(async () => {
        const testMock = mockInstances.get(mockId);
        if (testMock) {
          await testMock.cleanup();
          mockInstances.delete(mockId);
        }
      });
    }
  }
  
  return mockInstances.get(mockId)!;
}

/**
 * Get the shared mock instance (legacy method)
 * Use getIsolatedMock for new tests to prevent race conditions
 */
export async function getSharedMock(): Promise<ClaudeMock> {
  if (!defaultMock) {
    defaultMock = new ClaudeMock('claudeMocked');
  }
  
  // Always ensure mock exists
  const mockPath = join('/tmp', 'claude-code-test-mock', 'claudeMocked');
  if (!existsSync(mockPath)) {
    console.log(`[DEBUG] Shared mock not found at ${mockPath}, creating it...`);
    await defaultMock.setup();
  } else {
    console.log(`[DEBUG] Shared mock already exists at ${mockPath}`);
  }
  
  // Add warning about race conditions with shared mock
  console.log('[WARNING] Using shared mock may cause race conditions in parallel tests. Consider using getIsolatedMock instead.');
  
  return defaultMock;
}

/**
 * Clean up all mock instances
 */
export async function cleanupSharedMock(): Promise<void> {
  // Clean up the default mock
  if (defaultMock) {
    await defaultMock.cleanup();
    defaultMock = null;
  }
  
  // Clean up all isolated mocks
  const cleanupPromises = Array.from(mockInstances.values()).map(mock => mock.cleanup());
  await Promise.all(cleanupPromises);
  mockInstances.clear();
}