import { beforeEach, describe, expect, it, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { EventEmitter } from 'node:events';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Mock dependencies
vi.mock('node:child_process');
vi.mock('node:fs');
vi.mock('node:os');

const mockSpawn = vi.mocked(spawn);
const mockExistsSync = vi.mocked(existsSync);
const mockHomedir = vi.mocked(homedir);

describe('Orchestrator Mode', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Save the original environment variables
    originalEnv = { ...process.env };
    
    // Mock console.error to suppress output during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Set up default mocks
    mockHomedir.mockReturnValue('/home/user');
    mockExistsSync.mockReturnValue(true);
    
    // Clear any module cache
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment variables after each test
    process.env = { ...originalEnv };
    
    // Restore console
    consoleErrorSpy.mockRestore();
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('isOrchestratorMode detection', () => {
    it('should detect orchestrator mode via CLAUDE_CLI_NAME', async () => {
      // Set up environment for orchestrator mode via CLAUDE_CLI_NAME
      process.env.CLAUDE_CLI_NAME = 'claude-orchestrator';
      delete process.env.MCP_ORCHESTRATOR_MODE;
      
      // Import the server to check the mode (it's a global constant)
      const { ClaudeCodeServer, isOrchestratorMode } = await import('../server.js');
      
      // The mode should be detected globally
      expect(isOrchestratorMode).toBe(true);
    });

    it('should detect orchestrator mode via MCP_ORCHESTRATOR_MODE', async () => {
      // Set up environment for orchestrator mode via MCP_ORCHESTRATOR_MODE
      process.env.MCP_ORCHESTRATOR_MODE = 'true';
      process.env.CLAUDE_CLI_NAME = 'claude'; // Normal CLI name
      
      // Import the server to check the mode
      const { ClaudeCodeServer, isOrchestratorMode } = await import('../server.js');
      
      // The mode should be detected globally
      expect(isOrchestratorMode).toBe(true);
    });

    it('should not be in orchestrator mode by default', async () => {
      // Set up environment without orchestrator settings
      delete process.env.MCP_ORCHESTRATOR_MODE;
      process.env.CLAUDE_CLI_NAME = 'claude';
      
      // Import the server to check the mode
      const { ClaudeCodeServer, isOrchestratorMode } = await import('../server.js');
      
      // The mode should NOT be detected globally
      expect(isOrchestratorMode).toBe(false);
    });
  });

  describe('Environment variable handling for child processes', () => {
    it('should modify environment variables correctly in orchestrator mode', async () => {
      // Enable orchestrator mode
      process.env.MCP_ORCHESTRATOR_MODE = 'true';
      process.env.CLAUDE_CLI_NAME = 'some-custom-name';
      process.env.MCP_CLAUDE_DEBUG = 'true';
      
      // Mock Server to capture handler
      let callToolHandler: any = null;
      vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
        Server: vi.fn().mockImplementation(() => ({
          setRequestHandler: vi.fn((schema, handler) => {
            if (schema === CallToolRequestSchema) {
              callToolHandler = handler;
            }
          }),
          connect: vi.fn(),
          close: vi.fn(),
          onerror: null
        }))
      }));
      
      // Import the server after mocking
      const { ClaudeCodeServer } = await import('../server.js');
      
      // Create instance
      const server = new ClaudeCodeServer();
      
      // Create a mock process for spawn
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.stdout.on = vi.fn();
      mockProcess.stderr.on = vi.fn();
      
      // Setup spawn to return our mock and capture the environment
      let capturedEnv: NodeJS.ProcessEnv | undefined;
      mockSpawn.mockImplementation((command, args, options) => {
        capturedEnv = options?.env;
        
        // Simulate successful execution
        setTimeout(() => {
          mockProcess.emit('close', 0);
        }, 10);
        
        return mockProcess;
      });
      
      // Call the tool handler to trigger spawn
      if (!callToolHandler) {
        throw new Error('callToolHandler was not set by the mock');
      }
      
      await callToolHandler({
        params: {
          name: 'claude_code',
          arguments: {
            prompt: 'test',
            workFolder: '/tmp'
          }
        }
      });
      
      // Verify environment modifications for child processes
      expect(capturedEnv?.MCP_ORCHESTRATOR_MODE).toBeUndefined();
      expect(capturedEnv?.CLAUDE_CLI_NAME).toBeUndefined();
      expect(capturedEnv?.MCP_CLAUDE_DEBUG).toBe('false');
    });

    it('should not modify environment variables when not in orchestrator mode', async () => {
      // Disable orchestrator mode
      delete process.env.MCP_ORCHESTRATOR_MODE;
      process.env.CLAUDE_CLI_NAME = 'claude';
      process.env.TEST_VAR = 'test_value';
      process.env.MCP_CLAUDE_DEBUG = 'true';
      
      // Mock Server to capture handler
      let callToolHandler: any = null;
      vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
        Server: vi.fn().mockImplementation(() => ({
          setRequestHandler: vi.fn((schema, handler) => {
            if (schema === CallToolRequestSchema) {
              callToolHandler = handler;
            }
          }),
          connect: vi.fn(),
          close: vi.fn(),
          onerror: null
        }))
      }));
      
      // Import the server after mocking
      const { ClaudeCodeServer } = await import('../server.js');
      
      // Create instance
      const server = new ClaudeCodeServer();
      
      // Create a mock process for spawn
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.stdout.on = vi.fn();
      mockProcess.stderr.on = vi.fn();
      
      // Setup spawn to return our mock and capture the environment
      let capturedEnv: NodeJS.ProcessEnv | undefined;
      mockSpawn.mockImplementation((command, args, options) => {
        capturedEnv = options?.env;
        
        // Simulate successful execution
        setTimeout(() => {
          mockProcess.emit('close', 0);
        }, 10);
        
        return mockProcess;
      });
      
      // Call the tool handler to trigger spawn
      if (!callToolHandler) {
        throw new Error('callToolHandler was not set by the mock');
      }
      
      await callToolHandler({
        params: {
          name: 'claude_code',
          arguments: {
            prompt: 'test',
            workFolder: '/tmp'
          }
        }
      });
      
      // Verify environment is not modified
      expect(capturedEnv?.TEST_VAR).toBe('test_value');
      expect(capturedEnv?.CLAUDE_CLI_NAME).toBe('claude');
      expect(capturedEnv?.MCP_CLAUDE_DEBUG).toBe('true');
    });
  });

  describe('Tool description in orchestrator mode', () => {
    it('should include orchestrator information in tool description when in orchestrator mode', async () => {
      // Enable orchestrator mode
      process.env.MCP_ORCHESTRATOR_MODE = 'true';
      
      // Mock Server to capture the tool description
      let toolDescription: string | undefined;
      let toolsHandlerPromise: Promise<any> | null = null;
      vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
        Server: vi.fn().mockImplementation(() => ({
          setRequestHandler: vi.fn((schema, handler) => {
            if (schema === ListToolsRequestSchema) {
              // Call the handler to get the tool description
              toolsHandlerPromise = handler().then((result: any) => {
                toolDescription = result.tools[0].description;
                return result;
              });
            }
          }),
          connect: vi.fn(),
          close: vi.fn(),
          onerror: null
        }))
      }));
      
      // Import the server after mocking
      const { ClaudeCodeServer } = await import('../server.js');
      
      // Create instance
      const server = new ClaudeCodeServer();
      
      // Wait for the handler to complete
      if (toolsHandlerPromise) {
        await toolsHandlerPromise;
      }
      
      // Verify tool description includes orchestrator information
      expect(toolDescription).toBeDefined();
      expect(toolDescription).toContain('[ORCHESTRATOR MODE ACTIVE]');
      expect(toolDescription).toContain('delegated Claude Code instances');
    });

    it('should not include orchestrator information when not in orchestrator mode', async () => {
      // Disable orchestrator mode
      delete process.env.MCP_ORCHESTRATOR_MODE;
      process.env.CLAUDE_CLI_NAME = 'claude';
      
      // Mock Server to capture the tool description
      let toolDescription: string | undefined;
      let toolsHandlerPromise: Promise<any> | null = null;
      vi.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
        Server: vi.fn().mockImplementation(() => ({
          setRequestHandler: vi.fn((schema, handler) => {
            if (schema === ListToolsRequestSchema) {
              // Call the handler to get the tool description
              toolsHandlerPromise = handler().then((result: any) => {
                toolDescription = result.tools[0].description;
                return result;
              });
            }
          }),
          connect: vi.fn(),
          close: vi.fn(),
          onerror: null
        }))
      }));
      
      // Import the server after mocking
      const { ClaudeCodeServer } = await import('../server.js');
      
      // Create instance
      const server = new ClaudeCodeServer();
      
      // Wait for the handler to complete
      if (toolsHandlerPromise) {
        await toolsHandlerPromise;
      }
      
      // Verify tool description doesn't include orchestrator information
      expect(toolDescription).toBeDefined();
      expect(toolDescription).not.toContain('ORCHESTRATOR MODE ACTIVE');
    });
  });
});