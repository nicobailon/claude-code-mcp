import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MCPTestClient } from './utils/mcp-client.js';
import { getSharedMock } from './utils/persistent-mock.js';

describe('Version Print on First Use', () => {
  let client: MCPTestClient;
  let testDir: string;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const serverPath = 'dist/server.js';

  beforeEach(async () => {
    // Create a temporary directory for test files
    testDir = mkdtempSync(join(tmpdir(), 'claude-code-test-'));
    
    // Spy on console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Disconnect client if it exists
    if (client) {
      await client.disconnect();
    }
    
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
    
    // Restore console.error spy
    consoleErrorSpy.mockRestore();
  });

  it('should print version and startup time only on first use', async () => {
    // Use isolated mock for this test to avoid race conditions with other tests
    const { getIsolatedMock } = await import('./utils/persistent-mock.js');
    const testMock = await getIsolatedMock('version-print-test');
    
    // Add response for the echo commands used in this test
    testMock.addResponse('echo "test 1"', 'Test output 1');
    testMock.addResponse('echo "test 2"', 'Test output 2');
    testMock.addResponse('echo "test 3"', 'Test output 3');
    
    // Update client to use the isolated mock
    client = new MCPTestClient(serverPath, {
      CLAUDE_CLI_NAME: testMock.mockPath,
    });
    
    await client.connect();
    
    // First tool call
    await client.callTool('claude_code', {
      prompt: 'echo "test 1"',
      workFolder: testDir,
    });
    
    // Find the version print in the console.error calls
    const findVersionCall = (calls: any[][]) => {
      return calls.find(call => {
        const str = call[1] || call[0] as string; // message might be first or second param
        return typeof str === 'string' && str.includes('claude_code v') && str.includes('started at');
      });
    };
    
    // Check that version was printed on first use
    const versionCall = findVersionCall(consoleErrorSpy.mock.calls);
    expect(versionCall).toBeDefined();
    expect(versionCall![1]).toMatch(/claude_code v[0-9]+\.[0-9]+\.[0-9]+ started at \d{4}-\d{2}-\d{2}T/);
    
    // Clear the spy but keep the spy active
    consoleErrorSpy.mockClear();
    
    // Second tool call
    await client.callTool('claude_code', {
      prompt: 'echo "test 2"',
      workFolder: testDir,
    });
    
    // Check that version was NOT printed on second use
    const secondVersionCall = findVersionCall(consoleErrorSpy.mock.calls);
    expect(secondVersionCall).toBeUndefined();
    
    // Third tool call
    await client.callTool('claude_code', {
      prompt: 'echo "test 3"',
      workFolder: testDir,
    });
    
    // Should still not have been called with version print
    const thirdVersionCall = findVersionCall(consoleErrorSpy.mock.calls);
    expect(thirdVersionCall).toBeUndefined();
  });

  it('should include orchestrator mode indicator in version print when in orchestrator mode', async () => {
    // Use isolated mock for this test to avoid race conditions with other tests
    const { getIsolatedMock } = await import('./utils/persistent-mock.js');
    const testMock = await getIsolatedMock('version-print-orchestrator-test');
    
    // Add response for the command used in this test
    testMock.addResponse('echo "orchestrator test"', 'Orchestrator test output');
    
    // Create a new client with orchestrator mode using our isolated mock
    const orchestratorClient = new MCPTestClient(serverPath, {
      CLAUDE_CLI_NAME: testMock.mockPath,
      MCP_ORCHESTRATOR_MODE: 'true'
    });
    
    // Clear previous console output
    consoleErrorSpy.mockClear();
    
    // Connect the orchestrator client
    await orchestratorClient.connect();
    
    // First tool call with orchestrator mode
    await orchestratorClient.callTool('claude_code', {
      prompt: 'echo "orchestrator test"',
      workFolder: testDir,
    });
    
    // Find the version print in the console.error calls
    const findOrchestratorVersionCall = (calls: any[][]) => {
      return calls.find(call => {
        const str = call[1] || call[0] as string;
        return typeof str === 'string' && 
               str.includes('claude_code v') && 
               str.includes('started at') &&
               str.includes('[ORCHESTRATOR MODE]');
      });
    };
    
    // Check that version was printed with orchestrator mode indicator
    const versionCall = findOrchestratorVersionCall(consoleErrorSpy.mock.calls);
    expect(versionCall).toBeDefined();
    expect(versionCall![1]).toMatch(/claude_code v[0-9]+\.[0-9]+\.[0-9]+ started at \d{4}-\d{2}-\d{2}T.* \[ORCHESTRATOR MODE\]/);
    
    // Cleanup
    await orchestratorClient.disconnect();
  });
});