import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalManager } from '../terminal-manager.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import type { TerminalSession, CompletedSession } from '../types.js';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

// Mock debugLog function
vi.mock('../server.js', () => ({
  debugLog: vi.fn()
}));

describe('TerminalManager', () => {
  let terminalManager: TerminalManager;
  let mockSpawn: ReturnType<typeof vi.fn>;
  let mockProcess: any;
  let fixedDate: Date;
  let mockDate: any;
  
  beforeEach(() => {
    // Fixed date for tests
    fixedDate = new Date('2025-05-20T12:00:00Z');
    
    // Simple Date mock
    mockDate = function() {
      return fixedDate;
    };
    mockDate.now = () => fixedDate.getTime();
    
    // Create a mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.pid = 1234;
    mockProcess.kill = vi.fn().mockReturnValue(true);
    
    // Mock spawn function
    mockSpawn = vi.fn().mockReturnValue(mockProcess);
    
    // Create terminal manager with dependencies injected
    terminalManager = new TerminalManager(mockSpawn, mockDate as any);
    
    // Mock setTimeout to execute callback immediately and return a unique timer id
    vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return (Math.random() * 10000) as any;
    });
    
    // Make clearTimeout do nothing
    vi.spyOn(global, 'clearTimeout').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });
  
  // Helper function to create fixed future date
  function futureDate(addMs: number): Date {
    return new Date(fixedDate.getTime() + addMs);
  }
  
  describe('executeCommand', () => {
    it('returns error for process without pid', async () => {
      // Process without PID
      const noPidProcess = { ...mockProcess, pid: undefined };
      mockSpawn.mockReturnValueOnce(noPidProcess);
      
      // Execute command
      const result = await terminalManager.executeCommand('test-cmd');
      
      // Verify correct error response
      expect(result).toEqual({
        pid: -1,
        output: 'Error: Failed to get process ID. The command could not be executed.',
        isBlocked: false
      });
    });
    
    it('executes a command until timeout', async () => {
      // Execute command that will be interrupted by timeout
      const result = await terminalManager.executeCommand('test-cmd');
      
      // Test command and options
      expect(mockSpawn).toHaveBeenCalledWith(
        'test-cmd', 
        [], 
        expect.objectContaining({ shell: true })
      );
      
      // Verify timeout result (isBlocked should be true)
      expect(result.pid).toBe(1234);
      expect(result.isBlocked).toBe(true);
    });
  });
  
  describe('getNewOutput', () => {
    it('returns output from active session', () => {
      // Create a session directly
      const sessions = terminalManager['sessions'] as Map<number, TerminalSession>;
      sessions.set(1234, {
        pid: 1234,
        process: mockProcess,
        lastOutput: 'test output',
        isBlocked: false,
        startTime: fixedDate
      });
      
      // Get output
      const output = terminalManager.getNewOutput(1234);
      
      // Verify output was returned and cleared
      expect(output).toBe('test output');
      expect(sessions.get(1234)?.lastOutput).toBe('');
    });
    
    it('returns formatted output from completed session', () => {
      // Create a completed session
      const completedSessions = terminalManager['completedSessions'] as Map<number, CompletedSession>;
      const startTime = new Date(fixedDate.getTime() - 5 * 60 * 1000); // 5 minutes earlier
      
      completedSessions.set(1234, {
        pid: 1234,
        output: 'final output',
        exitCode: 0,
        startTime: startTime,
        endTime: fixedDate
      });
      
      // Get output
      const output = terminalManager.getNewOutput(1234);
      
      // Verify formatted output
      expect(output).toContain('Process completed with exit code 0');
      expect(output).toContain('Runtime: 300.0s');
      expect(output).toContain('final output');
    });
    
    it('returns null for non-existent pid', () => {
      const output = terminalManager.getNewOutput(9999);
      expect(output).toBeNull();
    });
  });
  
  describe('forceTerminate', () => {
    it('returns false for non-existent pid', () => {
      const result = terminalManager.forceTerminate(9999);
      expect(result).toBe(false);
    });
    
    it('sends SIGINT to process', () => {
      // Create a session directly
      const sessions = terminalManager['sessions'] as Map<number, TerminalSession>;
      sessions.set(1234, {
        pid: 1234,
        process: mockProcess,
        lastOutput: '',
        isBlocked: false,
        startTime: fixedDate
      });
      
      // Force terminate
      const result = terminalManager.forceTerminate(1234);
      
      // Verify SIGINT was sent
      expect(result).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGINT');
    });
  });
  
  describe('listActiveSessions', () => {
    it('returns empty array when no sessions exist', () => {
      const result = terminalManager.listActiveSessions();
      expect(result).toEqual([]);
    });
    
    it('returns active sessions with runtime', () => {
      // Create a session that started 1 minute ago
      const sessions = terminalManager['sessions'] as Map<number, TerminalSession>;
      sessions.set(1234, {
        pid: 1234,
        process: mockProcess,
        lastOutput: '',
        isBlocked: false,
        startTime: new Date(fixedDate.getTime() - 60000) // 1 minute ago
      });
      
      // List sessions
      const result = terminalManager.listActiveSessions();
      
      // Verify session info
      expect(result).toEqual([{
        pid: 1234,
        isBlocked: false,
        runtime: 60000  // 1 minute in milliseconds
      }]);
    });
  });
  
  describe('cleanupOldSessions', () => {
    it('removes sessions older than max age', () => {
      // Access sessions map directly
      const completedSessions = terminalManager['completedSessions'] as Map<number, CompletedSession>;
      
      // Create old session (2 hours old)
      const oldTime = new Date(fixedDate.getTime() - 2 * 60 * 60 * 1000);
      completedSessions.set(1111, {
        pid: 1111,
        output: 'old',
        exitCode: 0,
        startTime: oldTime,
        endTime: oldTime
      });
      
      // Create recent session
      completedSessions.set(2222, {
        pid: 2222,
        output: 'recent',
        exitCode: 0,
        startTime: fixedDate,
        endTime: fixedDate
      });
      
      // Run cleanup with 1 hour max age
      terminalManager.cleanupOldSessions(60 * 60 * 1000);
      
      // Verify old session removed, new one kept
      expect(completedSessions.has(1111)).toBe(false);
      expect(completedSessions.has(2222)).toBe(true);
    });
  });
});