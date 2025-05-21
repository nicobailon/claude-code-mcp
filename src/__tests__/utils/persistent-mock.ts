import { ClaudeMock } from './claude-mock.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let sharedMock: ClaudeMock | null = null;

export async function getSharedMock(): Promise<ClaudeMock> {
  if (!sharedMock) {
    sharedMock = new ClaudeMock('claudeMocked');
  }
  
  // Always ensure mock exists
  const mockPath = join('/tmp', 'claude-code-test-mock', 'claudeMocked');
  if (!existsSync(mockPath)) {
    console.error(`[DEBUG] Mock not found at ${mockPath}, creating it...`);
    await sharedMock.setup();
  } else {
    console.error(`[DEBUG] Mock already exists at ${mockPath}`);
  }
  
  return sharedMock;
}

export async function cleanupSharedMock(): Promise<void> {
  if (sharedMock) {
    await sharedMock.cleanup();
    sharedMock = null;
  }
  
  // Add an extra safeguard to clean up any orphaned processes
  try {
    const { execSync } = await import('node:child_process');
    // Gracefully terminate any mock processes still running
    execSync('pkill -f "claude-code-test-mock/claudeMocked"', { stdio: 'ignore' });
  } catch (error) {
    // It's okay if no processes were found to kill
  }
}