import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeCommand, readOutput, forceTerminate, listSessions } from '../tools/execute.js';
import { terminalManager } from '../terminal-manager.js';
import { CommandExecutionResult, ActiveSession } from '../types.js';

// Mock the terminal manager with proper types
vi.mock('../terminal-manager.js', () => ({
  terminalManager: {
    executeCommand: vi.fn(),
    getNewOutput: vi.fn(),
    forceTerminate: vi.fn(),
    listActiveSessions: vi.fn()
  }
}));

// Mock the debugLog function
vi.mock('../server.js', () => ({
  debugLog: vi.fn()
}));

// Mock the isCommandAllowed function to allow all commands in tests
vi.mock('../config.js', () => ({
  isCommandAllowed: vi.fn().mockReturnValue(true),
  configManager: {
    getConfig: vi.fn().mockResolvedValue({ defaultShell: true })
  }
}));

describe('Execute tools', () => {
  // Common metadata/content expectations to test across tools
  const expectPid = (result: any, pid: number) => {
    if (result.isError) {
      // Skip PID check for error results
      return;
    }
    expect(result.metadata).toBeDefined();
    expect(result.metadata.pid).toBe(pid);
  };
  
  const expectIsRunning = (result: any, isRunning: boolean) => {
    if (result.isError) {
      // Skip isRunning check for error results
      return;
    }
    expect(result.metadata).toBeDefined();
    expect(result.metadata.isRunning).toBe(isRunning);
  };
  
  const expectTextContent = (result: any, textPattern: string | RegExp) => {
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    if (typeof textPattern === 'string') {
      expect(result.content[0].text).toContain(textPattern);
    } else {
      expect(result.content[0].text).toMatch(textPattern);
    }
  };
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('executeCommand', () => {
    it('should check command allowed status first', async () => {
      // This test verifies that the isCommandAllowed function is called
      
      // Call the function
      const result = await executeCommand({
        command: 'test command',
        timeout_ms: 1000,
        wait: true
      });
      
      // Verify the security check result (command not allowed)
      expect(result.isError).toBe(true);
      expectTextContent(result, 'Command not allowed for security reasons');
      
      // Verify terminalManager.executeCommand wasn't called
      expect(terminalManager.executeCommand).not.toHaveBeenCalled();
    });

    it('should handle error during command execution', async () => {
      // Setup the mock to return an error condition
      vi.mocked(terminalManager.executeCommand).mockResolvedValue({
        pid: -1,
        output: 'Error: Command failed',
        isBlocked: false
      });

      // Call the function
      const result = await executeCommand({
        command: 'invalid command',
        wait: true
      });

      // Use more flexible verification
      expect(result.isError).toBe(true);
      expectTextContent(result, 'Error');
    });
  });

  describe('readOutput', () => {
    it('should read output from an active session', async () => {
      // Setup the mocks
      vi.mocked(terminalManager.getNewOutput).mockReturnValue('new output');
      vi.mocked(terminalManager.listActiveSessions).mockReturnValue([
        { pid: 1234, isBlocked: true, runtime: 5000 }
      ]);

      // Call the function
      const result = await readOutput({
        pid: 1234
      });

      // Verify the result
      expect(result).toEqual({
        content: [{ type: 'text', text: 'new output' }],
        metadata: {
          pid: 1234,
          isRunning: true,
          runtime: 5
        }
      });

      // Verify the mock was called correctly
      expect(terminalManager.getNewOutput).toHaveBeenCalledWith(1234);
    });

    it('should handle a completed session', async () => {
      // Setup the mocks
      vi.mocked(terminalManager.getNewOutput).mockReturnValue('Process completed with exit code 0\nRuntime: 10s\nFinal output:\noutput');
      vi.mocked(terminalManager.listActiveSessions).mockReturnValue([]);

      // Call the function
      const result = await readOutput({
        pid: 1234
      });

      // Verify the result
      expect(result).toEqual({
        content: [{ 
          type: 'text', 
          text: 'Process completed with exit code 0\nRuntime: 10s\nFinal output:\noutput' 
        }],
        metadata: {
          pid: 1234,
          isRunning: false
        }
      });
    });

    it('should handle non-existent session', async () => {
      // Setup the mocks
      vi.mocked(terminalManager.getNewOutput).mockReturnValue(null);
      vi.mocked(terminalManager.listActiveSessions).mockReturnValue([]);

      // Call the function
      const result = await readOutput({
        pid: 9999
      });

      // Verify the result
      expect(result).toEqual({
        content: [{ type: 'text', text: 'No session found for PID 9999' }],
        isError: true
      });
    });
  });

  describe('forceTerminate', () => {
    it('should terminate a running process', async () => {
      // Setup the mock
      vi.mocked(terminalManager.forceTerminate).mockReturnValue(true);

      // Call the function
      const result = await forceTerminate({
        pid: 1234
      });

      // Verify the result
      expect(result).toEqual({
        content: [{ 
          type: 'text', 
          text: 'Successfully initiated termination of session 1234' 
        }],
        metadata: {
          pid: 1234,
          isRunning: false
        }
      });

      // Verify the mock was called correctly
      expect(terminalManager.forceTerminate).toHaveBeenCalledWith(1234);
    });

    it('should handle non-existent process', async () => {
      // Setup the mock
      vi.mocked(terminalManager.forceTerminate).mockReturnValue(false);

      // Call the function
      const result = await forceTerminate({
        pid: 9999
      });

      // Verify the result
      expect(result).toEqual({
        content: [{ 
          type: 'text', 
          text: 'No active session found for PID 9999' 
        }],
        metadata: {
          pid: 9999,
          isRunning: false
        }
      });
    });
  });

  describe('listSessions', () => {
    it('should list active sessions', async () => {
      // Setup the mock
      vi.mocked(terminalManager.listActiveSessions).mockReturnValue([
        { pid: 1234, isBlocked: true, runtime: 5000 },
        { pid: 5678, isBlocked: false, runtime: 10000 }
      ]);

      // Call the function
      const result = await listSessions({});

      // Verify the result
      expect(result).toEqual({
        content: [{ 
          type: 'text', 
          text: 'PID: 1234, Running: Yes, Runtime: 5s\nPID: 5678, Running: No, Runtime: 10s' 
        }]
      });
    });

    it('should handle no active sessions', async () => {
      // Setup the mock
      vi.mocked(terminalManager.listActiveSessions).mockReturnValue([]);

      // Call the function
      const result = await listSessions({});

      // Verify the result
      expect(result).toEqual({
        content: [{ type: 'text', text: 'No active sessions' }]
      });
    });
  });
});