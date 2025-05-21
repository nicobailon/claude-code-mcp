import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { EventEmitter } from 'node:events';

// Mock dependencies
vi.mock('node:child_process');
vi.mock('node:fs');
vi.mock('node:os');

// Mock package.json
vi.mock('../../package.json', () => ({
  default: { version: '1.0.0-test' }
}));

// Mock terminal manager to avoid side effects
vi.mock('../terminal-manager.js', () => ({
  terminalManager: {
    cleanupOldSessions: vi.fn(),
  }
}));

// Mock MCP server to avoid automatic instantiation
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
    onerror: null
  }))
}));

// Re-import after mocks
const mockExistsSync = vi.mocked(existsSync);
const mockSpawn = vi.mocked(spawn);
const mockHomedir = vi.mocked(homedir);

describe('Server Unit Tests', () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let originalEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    originalEnv = { ...process.env };
    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    process.env = originalEnv;
  });

  describe('debugLog function', () => {
    it('should log when debug mode is enabled', async () => {
      // Set debug mode
      process.env.MCP_CLAUDE_DEBUG = 'true';
      
      // Clear the spy before importing to avoid auto-init messages
      consoleErrorSpy.mockClear();
      
      // Reset modules to pick up env change
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { debugLog } = module;
      
      // Clear again after import to remove auto-init messages
      consoleErrorSpy.mockClear();
      
      debugLog('Test message');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Test message');
    });

    it('should not log when debug mode is disabled', async () => {
      // Ensure debug mode is off
      delete process.env.MCP_CLAUDE_DEBUG;
      
      // Clear the spy before importing to avoid auto-init messages
      consoleErrorSpy.mockClear();
      
      // Reset modules to pick up env change
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { debugLog } = module;
      
      // Clear again after import to remove auto-init messages
      consoleErrorSpy.mockClear();
      
      debugLog('Test message');
      
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('findClaudeCli function', () => {
    it('should return local path when it exists', async () => {
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockImplementation((path) => 
        path === '/home/user/.claude/local/claude'
      );
      
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { findClaudeCli } = module;
      
      const result = findClaudeCli();
      expect(result).toBe('/home/user/.claude/local/claude');
    });

    it('should fallback to PATH when local does not exist', async () => {
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(false);
      
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { findClaudeCli } = module;
      
      const result = findClaudeCli();
      expect(result).toBe('claude');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Claude CLI not found')
      );
    });

    it('should use custom name from CLAUDE_CLI_NAME', async () => {
      process.env.CLAUDE_CLI_NAME = 'custom-claude';
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(false);
      
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { findClaudeCli } = module;
      
      const result = findClaudeCli();
      expect(result).toBe('custom-claude');
    });

    it('should use absolute path from CLAUDE_CLI_NAME', async () => {
      process.env.CLAUDE_CLI_NAME = '/usr/local/bin/claude';
      
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { findClaudeCli } = module;
      
      const result = findClaudeCli();
      expect(result).toBe('/usr/local/bin/claude');
    });

    it('should throw error for relative paths in CLAUDE_CLI_NAME', async () => {
      // Mock the home directory first to avoid server instantiation issues
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(false);
      
      process.env.CLAUDE_CLI_NAME = './claude';
      
      try {
        vi.resetModules();
        // Import will fail with the expected error due to server auto-instantiation
        await import('../server.js');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid CLAUDE_CLI_NAME');
      }
    });

    it('should throw error for paths with ../ in CLAUDE_CLI_NAME', async () => {
      // Mock the home directory first to avoid server instantiation issues
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(false);
      
      process.env.CLAUDE_CLI_NAME = '../claude';
      
      try {
        vi.resetModules();
        // Import will fail with the expected error due to server auto-instantiation
        await import('../server.js');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid CLAUDE_CLI_NAME');
      }
    });
  });

  describe('spawnAsync function', () => {
    let mockProcess: any;
    
    beforeEach(() => {
      // Create a mock process
      mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.pid = 12345;
      mockSpawn.mockReturnValue(mockProcess);
    });

    it('should execute command successfully', async () => {
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { spawnAsync } = module;
      
      const promise = spawnAsync('echo', ['hello']);
      
      // Simulate successful execution
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'hello\n');
        mockProcess.emit('close', 0);
      }, 1);
      
      const result = await promise;
      expect(result.stdout).toBe('hello\n');
      expect(result.stderr).toBe('');
    });

    it('should handle command failure', async () => {
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { spawnAsync } = module;
      
      const promise = spawnAsync('false', []);
      
      // Simulate command failure
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'command failed\n');
        mockProcess.emit('close', 1);
      }, 1);
      
      await expect(promise).rejects.toThrow('Command failed with exit code 1');
    });

    it('should handle spawn error', async () => {
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { spawnAsync } = module;
      
      const promise = spawnAsync('nonexistent', []);
      
      // Simulate spawn error
      setTimeout(() => {
        const error: any = new Error('spawn ENOENT');
        error.code = 'ENOENT';
        error.path = 'nonexistent';
        error.syscall = 'spawn';
        mockProcess.emit('error', error);
      }, 1);
      
      await expect(promise).rejects.toThrow('Spawn error');
    });

    it('should use provided cwd option', async () => {
      vi.resetModules();
      const module = await import('../server.js');
      // @ts-ignore
      const { spawnAsync } = module;
      
      const promise = spawnAsync('pwd', [], { cwd: '/tmp' });
      
      // Simulate successful execution
      setTimeout(() => {
        mockProcess.stdout.emit('data', '/tmp\n');
        mockProcess.emit('close', 0);
      }, 1);
      
      await promise;
      
      // Verify spawn was called with correct cwd
      expect(mockSpawn).toHaveBeenCalledWith('pwd', [], expect.objectContaining({
        cwd: '/tmp'
      }));
    });
  });

  describe('ClaudeCodeServer class', () => {
    // NOTE: Most server class tests are covered in e2e.test.ts due to complex mocking requirements
    // The server automatically instantiates at module load, making unit testing challenging
    
    it.skip('should handle SIGINT - covered in integration tests', async () => {
      // SIGINT handling is tested in the full integration test suite
      // Complex to test in isolation due to process signal handling
    });
  });

  describe('Tool handler implementation', () => {
    // NOTE: Tool registration and request handling is thoroughly tested in e2e.test.ts
    // These tests would require complex mocking of the MCP server infrastructure
    
    it.skip('should handle ListToolsRequest - covered in e2e tests', async () => {
      // Tool listing is tested in e2e.test.ts where the actual server is running
    });

    it.skip('should handle CallToolRequest - covered in e2e and execute-tools tests', async () => {
      // Tool execution is tested in execute-tools.test.ts and e2e.test.ts
      // Complex to mock the full MCP request/response cycle in unit tests
    });
  });
});