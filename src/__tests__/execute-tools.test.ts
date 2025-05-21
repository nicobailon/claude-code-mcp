import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeCommand, readOutput, forceTerminate, listSessions } from '../tools/execute';
import { terminalManager } from '../terminal-manager';

// Mock the terminal manager
vi.mock('../terminal-manager', () => ({
  terminalManager: {
    executeCommand: vi.fn(),
    getNewOutput: vi.fn(),
    forceTerminate: vi.fn(),
    listActiveSessions: vi.fn()
  }
}));

// Mock the debugLog function
vi.mock('../server', () => ({
  debugLog: vi.fn()
}));

describe('Execute tools', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('executeCommand', () => {
    it('should handle successful command execution', async () => {
      // Setup the mock
      vi.mocked(terminalManager.executeCommand).mockResolvedValue({
        pid: 1234,
        output: 'test output',
        isBlocked: true
      });

      // Call the function
      const result = await executeCommand({
        command: 'test command',
        timeout_ms: 1000
      });

      // Verify the result
      expect(result).toEqual({
        content: [{ 
          type: 'text', 
          text: 'Command started with PID 1234\nInitial output:\ntest output\n\nCommand is still running. Use read_output to get more output.' 
        }],
        metadata: {
          pid: 1234,
          isRunning: true,
          startTime: expect.any(String)
        }
      });

      // Verify the mock was called correctly
      expect(terminalManager.executeCommand).toHaveBeenCalledWith(
        'test command',
        1000,
        undefined,
        undefined
      );
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
        command: 'invalid command'
      });

      // Verify the result
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Command failed' }],
        isError: true
      });
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
      const result = await listSessions();

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
      const result = await listSessions();

      // Verify the result
      expect(result).toEqual({
        content: [{ type: 'text', text: 'No active sessions' }]
      });
    });
  });
});