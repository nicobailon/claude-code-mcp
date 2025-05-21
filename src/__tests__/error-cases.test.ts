import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { EventEmitter } from 'node:events';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Mock dependencies
vi.mock('node:child_process');
vi.mock('node:fs');
vi.mock('node:os');
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn()
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: { name: 'listTools' },
  CallToolRequestSchema: { name: 'callTool' },
  ErrorCode: { 
    InternalError: 'InternalError',
    MethodNotFound: 'MethodNotFound'
  },
  McpError: vi.fn().mockImplementation((code, message) => {
    const error = new Error(message);
    (error as any).code = code;
    return error;
  })
}));

const mockExistsSync = vi.mocked(existsSync);
const mockSpawn = vi.mocked(spawn);
const mockHomedir = vi.mocked(homedir);

describe('Error Handling Tests', () => {
  let consoleErrorSpy: any;
  let originalEnv: any;
  let errorHandler: any = null;

  function setupServerMock() {
    errorHandler = null;
    vi.mocked(Server).mockImplementation(() => {
      const instance = {
        setRequestHandler: vi.fn(),
        connect: vi.fn(),
        close: vi.fn(),
        onerror: null
      } as any;
      Object.defineProperty(instance, 'onerror', {
        get() { return errorHandler; },
        set(handler) { errorHandler = handler; },
        enumerable: true,
        configurable: true
      });
      return instance;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalEnv = { ...process.env };
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env = originalEnv;
  });

  describe('CallToolRequest Error Cases', () => {
    // NOTE: These tests are simplified to avoid complex mocking issues
    // Full integration tests of error handling are covered in e2e.test.ts
    // and terminal-manager.test.ts covers the core error handling logic

    it.skip('should throw error for unknown tool name - covered in e2e tests', async () => {
      // This test requires complex server mocking that's better covered in integration tests
      // The error handling for unknown tools is tested in e2e.test.ts
    });

    it.skip('should handle timeout errors - covered in terminal manager tests', async () => {
      // Timeout handling is primarily done by TerminalManager now
      // This is tested in terminal-manager.test.ts and through integration tests
    });

    it.skip('should handle invalid argument types - covered in schema validation tests', async () => {
      // Argument validation is handled by Zod schemas  
      // This is tested in schemas.test.ts
    });

    it.skip('should include CLI error details in error message - covered in terminal manager tests', async () => {
      // Error message handling is now done by TerminalManager
      // This functionality is tested in terminal-manager.test.ts
    });
  });

  describe('Process Spawn Error Cases', () => {
    // NOTE: These spawn error cases are now primarily handled by TerminalManager
    // The complex error handling and process management has been moved to terminal-manager.test.ts
    // where it can be properly tested in isolation

    it.skip('should handle spawn ENOENT error - covered in terminal manager tests', async () => {
      // ENOENT and other spawn errors are now handled by TerminalManager
      // This functionality is tested in terminal-manager.test.ts which has proper mocking
    });

    it.skip('should handle generic spawn errors - covered in terminal manager tests', async () => {
      // Generic spawn errors are handled by TerminalManager
      // This functionality is tested in terminal-manager.test.ts
    });

    it.skip('should accumulate stderr output before error - covered in terminal manager tests', async () => {
      // Stderr accumulation is handled by TerminalManager
      // This functionality is tested in terminal-manager.test.ts
    });
  });

  describe('Server Initialization Errors', () => {
    it('should handle CLI path not found gracefully', async () => {
      // Mock no CLI found anywhere
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(false);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      setupServerMock();
      
      const module = await import('../server.js');
      // @ts-ignore
      const { ClaudeCodeServer } = module;
      
      const server = new ClaudeCodeServer();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Claude CLI not found')
      );
      
      consoleWarnSpy.mockRestore();
    });

    it.skip('should handle server connection errors - covered in e2e tests', async () => {
      // Server connection errors are complex to mock and are better tested
      // in the e2e test suite where the full server setup is tested
    });
  });
});