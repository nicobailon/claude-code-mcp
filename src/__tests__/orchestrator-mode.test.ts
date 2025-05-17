import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { server, ClaudeCodeServer } from '../server.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Orchestrator Mode', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let testDir: string;

  beforeEach(() => {
    // Save the original environment variables
    originalEnv = { ...process.env };
    
    // Create temp directory for tests
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-code-test-'));
  });

  afterEach(() => {
    // Restore original environment variables after each test
    process.env = { ...originalEnv };
    
    // Clean up temp directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('isOrchestratorMode detection', () => {
    it('should detect orchestrator mode via CLAUDE_CLI_NAME', () => {
      // Set up environment for orchestrator mode via CLAUDE_CLI_NAME
      process.env.CLAUDE_CLI_NAME = 'claude-orchestrator';
      delete process.env.MCP_ORCHESTRATOR_MODE;
      
      // Create a new server instance to test with the modified environment
      const testServer = new ClaudeCodeServer();
      
      // Verify it's detected as orchestrator mode
      expect(testServer['isOrchestratorMode']()).toBe(true);
    });

    it('should detect orchestrator mode via MCP_ORCHESTRATOR_MODE', () => {
      // Set up environment for orchestrator mode via MCP_ORCHESTRATOR_MODE
      process.env.MCP_ORCHESTRATOR_MODE = 'true';
      process.env.CLAUDE_CLI_NAME = 'claude'; // Normal CLI name
      
      // Create a new server instance to test with the modified environment
      const testServer = new ClaudeCodeServer();
      
      // Verify it's detected as orchestrator mode
      expect(testServer['isOrchestratorMode']()).toBe(true);
    });

    it('should not be in orchestrator mode by default', () => {
      // Set up environment without orchestrator settings
      delete process.env.MCP_ORCHESTRATOR_MODE;
      process.env.CLAUDE_CLI_NAME = 'claude';
      
      // Create a new server instance to test with the modified environment
      const testServer = new ClaudeCodeServer();
      
      // Verify it's not detected as orchestrator mode
      expect(testServer['isOrchestratorMode']()).toBe(false);
    });
  });

  describe('getOrchestratorSystemPrompt', () => {
    it('should return orchestrator system prompt when in orchestrator mode', () => {
      // Enable orchestrator mode
      process.env.MCP_ORCHESTRATOR_MODE = 'true';
      
      // Create a new server instance
      const testServer = new ClaudeCodeServer();
      
      // Get the system prompt
      const systemPrompt = testServer['getOrchestratorSystemPrompt']();
      
      // Verify it includes orchestrator-specific content
      expect(systemPrompt).toContain('[ORCHESTRATOR MODE ACTIVE]');
      expect(systemPrompt).toContain('delegated Claude Code instances');
    });

    it('should return empty string when not in orchestrator mode', () => {
      // Disable orchestrator mode explicitly
      delete process.env.MCP_ORCHESTRATOR_MODE;
      process.env.CLAUDE_CLI_NAME = 'claude';
      
      // Create a new server instance
      const testServer = new ClaudeCodeServer();
      
      // Get the system prompt
      const systemPrompt = testServer['getOrchestratorSystemPrompt']();
      
      // Verify it returns empty string (not in orchestrator mode)
      expect(systemPrompt).toBe('');
    });
  });

  describe('Environment variable handling for child processes', () => {
    it('should modify environment variables correctly in orchestrator mode activated by MCP_ORCHESTRATOR_MODE', () => {
      // Enable orchestrator mode
      process.env.MCP_ORCHESTRATOR_MODE = 'true';
      process.env.CLAUDE_CLI_PATH = '/path/to/claude';
      process.env.CLAUDE_CLI_NAME = 'some-custom-name';
      process.env.MCP_CLAUDE_DEBUG = 'true';
      
      // Create a new server instance
      const testServer = new ClaudeCodeServer();
      
      // Call the method that would spawn child processes
      // We'll check if it's preparing environment variables correctly
      const childEnv = testServer['prepareEnvironmentForChild']();
      
      // Verify environment modifications for child processes
      expect(childEnv.MCP_ORCHESTRATOR_MODE).toBe(undefined); // Should be removed
      expect(childEnv.CLAUDE_CLI_NAME).toBe(undefined); // Should be removed
      expect(childEnv.MCP_CLAUDE_DEBUG).toBe('false'); // Should be set to false
      expect(childEnv.CLAUDE_CLI_PATH).toBe(process.env.CLAUDE_CLI_PATH); // Should be preserved
    });

    it('should modify environment variables correctly in orchestrator mode activated by CLAUDE_CLI_NAME', () => {
      // Enable orchestrator mode via CLAUDE_CLI_NAME containing "orchestrator"
      process.env.CLAUDE_CLI_NAME = 'claude-orchestrator';
      delete process.env.MCP_ORCHESTRATOR_MODE;
      process.env.MCP_CLAUDE_DEBUG = 'true';
      
      // Create a new server instance
      const testServer = new ClaudeCodeServer();
      
      // Call the method that would spawn child processes
      // We'll check if it's preparing environment variables correctly
      const childEnv = testServer['prepareEnvironmentForChild']();
      
      // Verify environment modifications for child processes
      expect(childEnv.CLAUDE_CLI_NAME).toBe(undefined); // Should be removed
      expect(childEnv.MCP_ORCHESTRATOR_MODE).toBe(undefined); // Should be undefined
      expect(childEnv.MCP_CLAUDE_DEBUG).toBe('false'); // Should be set to false
    });

    it('should not modify environment variables when not in orchestrator mode', () => {
      // Disable orchestrator mode
      delete process.env.MCP_ORCHESTRATOR_MODE;
      process.env.CLAUDE_CLI_NAME = 'claude';
      process.env.TEST_VAR = 'test_value';
      process.env.MCP_CLAUDE_DEBUG = 'true';
      
      // Create a new server instance
      const testServer = new ClaudeCodeServer();
      
      // Get child environment
      const childEnv = testServer['prepareEnvironmentForChild']();
      
      // Verify environment is not modified
      expect(childEnv.TEST_VAR).toBe('test_value');
      expect(childEnv.CLAUDE_CLI_NAME).toBe('claude'); // Preserved
      expect(childEnv.MCP_CLAUDE_DEBUG).toBe('true'); // Preserved
      
      // Environment should be essentially passed through
      expect(Object.keys(childEnv).length).toBeGreaterThanOrEqual(Object.keys(process.env).length);
    });
  });

  describe('Tool description and behavior', () => {
    it('should include orchestrator information in tool description when in orchestrator mode', () => {
      // Enable orchestrator mode
      process.env.MCP_ORCHESTRATOR_MODE = 'true';
      
      // Create a new server instance
      const testServer = new ClaudeCodeServer();
      
      // Get the tool handlers
      const handlers = testServer['setupToolHandlers']();
      const claudeCodeTool = handlers.find((h: any) => h.name === 'claude_code');
      
      // Verify tool description includes orchestrator information
      expect(claudeCodeTool?.description).toContain('ORCHESTRATOR MODE ACTIVE');
    });

    it('should not include orchestrator information when not in orchestrator mode', () => {
      // Disable orchestrator mode
      delete process.env.MCP_ORCHESTRATOR_MODE;
      process.env.CLAUDE_CLI_NAME = 'claude';
      
      // Create a new server instance
      const testServer = new ClaudeCodeServer();
      
      // Get the tool handlers
      const handlers = testServer['setupToolHandlers']();
      const claudeCodeTool = handlers.find((h: any) => h.name === 'claude_code');
      
      // Verify tool description doesn't include orchestrator information
      expect(claudeCodeTool?.description).not.toContain('orchestrator');
    });
  });

  describe('Helper method: prepareEnvironmentForChild', () => {
    it('should create a method to prepare environment for child processes', () => {
      // This method should exist on the server instance to support orchestrator mode
      const testServer = new ClaudeCodeServer();
      
      // Verify the method exists
      expect(typeof testServer['prepareEnvironmentForChild']).toBe('function');
    });
  });
});