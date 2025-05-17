import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MCPTestClient } from './utils/mcp-client.js';

// Skip these tests by default since they depend on an actual Claude CLI installation
// These tests demonstrate how orchestrator mode would be tested in a real environment
describe.skip('Orchestrator Mode Integration Tests', () => {
  let client: MCPTestClient;
  let testDir: string;
  const serverPath = 'dist/server.js';

  beforeEach(async () => {
    // Create a temporary directory for test files
    testDir = mkdtempSync(join(tmpdir(), 'claude-code-orchestrator-test-'));
    
    // Initialize MCP client with orchestrator mode enabled
    client = new MCPTestClient(serverPath, {
      MCP_CLAUDE_DEBUG: 'true',
      MCP_ORCHESTRATOR_MODE: 'true'
    });
    
    await client.connect();
  });

  afterEach(async () => {
    // Disconnect client
    await client.disconnect();
    
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('Orchestrator Tool Registration', () => {
    it('should register claude_code tool with orchestrator mode text', async () => {
      const tools = await client.listTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: 'claude_code',
        description: expect.stringContaining('[ORCHESTRATOR MODE ACTIVE]'),
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: expect.stringContaining('natural language prompt'),
            },
            workFolder: {
              type: 'string',
              description: expect.stringContaining('working directory'),
            },
          },
          required: ['prompt'],
        },
      });
      
      // Verify specific orchestrator mode instructions are included
      expect(tools[0].description).toContain('You can break down complex tasks');
      expect(tools[0].description).toContain('You have extended timeouts');
      expect(tools[0].description).toContain('Focus on task decomposition');
    });
  });

  describe('Orchestrator Task Execution', () => {
    it('should execute a task with extended timeout', async () => {
      // Create a test file to process
      const testFilePath = join(testDir, 'test-data.txt');
      writeFileSync(testFilePath, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
      
      // This test specifically tests if a longer-running task completes successfully
      // with the extended timeout provided by orchestrator mode
      const response = await client.callTool('claude_code', {
        prompt: `Create a summary of the file ${testFilePath} and then create a new file 
                called ${join(testDir, 'summary.txt')} with that summary.`,
        workFolder: testDir,
      });

      expect(response).toBeTruthy();
      expect(existsSync(join(testDir, 'summary.txt'))).toBe(true);
    });

    it('should support task decomposition format', async () => {
      // Testing if the tool supports the delegated task format in orchestrator mode
      const response = await client.callTool('claude_code', {
        prompt: `Your work folder is ${testDir}
                Create a file called delegated-task.txt with the content "This was created by a delegated task."`,
        workFolder: testDir,
      });

      expect(response).toBeTruthy();
      expect(existsSync(join(testDir, 'delegated-task.txt'))).toBe(true);
    });
  });

  describe('Orchestrator Environment Isolation', () => {
    it('should not affect the parent environment with changes', async () => {
      // Create a nested task that modifies an environment variable
      // We'll verify the parent environment wasn't affected
      
      // First, set a test variable
      process.env.TEST_VARIABLE = 'original_value';
      
      // Run a task that should attempt to modify it in the child process
      const response = await client.callTool('claude_code', {
        prompt: `Run a command to set TEST_VARIABLE=changed_value and then echo the value.`,
        workFolder: testDir,
      });

      expect(response).toBeTruthy();
      // The parent environment variable should be unchanged
      expect(process.env.TEST_VARIABLE).toBe('original_value');
    });
  });
});