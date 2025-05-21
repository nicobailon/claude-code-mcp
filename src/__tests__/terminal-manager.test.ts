import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalManager } from '../terminal-manager';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

// Mock debugLog function
vi.mock('../server', () => ({
  debugLog: vi.fn()
}));

describe('TerminalManager', () => {
  let terminalManager: TerminalManager;
  let mockProcess: any;
  
  beforeEach(() => {
    terminalManager = new TerminalManager();
    
    // Create a mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.pid = 1234;
    mockProcess.kill = vi.fn();
    
    // Mock spawn to return our mock process
    vi.mocked(spawn).mockReturnValue(mockProcess as any);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should execute a command and return result after timeout', async () => {
    // Start command execution
    const resultPromise = terminalManager.executeCommand('test-command', 100);
    
    // Simulate some output
    mockProcess.stdout.emit('data', 'test output');
    
    // Wait for timeout
    const result = await resultPromise;
    
    expect(result).toEqual({
      pid: 1234,
      output: 'test output',
      isBlocked: true
    });
  });
  
  it('should mark command as completed when process exits', async () => {
    // Start command execution
    const resultPromise = terminalManager.executeCommand('test-command', 1000);
    
    // Simulate some output
    mockProcess.stdout.emit('data', 'test output');
    
    // Simulate process exit
    mockProcess.emit('exit', 0);
    
    // Get result
    const result = await resultPromise;
    
    expect(result).toEqual({
      pid: 1234,
      output: 'test output',
      isBlocked: false
    });
  });
  
  it('should get new output from running session', async () => {
    // Start command execution
    await terminalManager.executeCommand('test-command', 100);
    
    // Add more output after initial execution
    mockProcess.stdout.emit('data', 'more output');
    
    // Get new output
    const output = terminalManager.getNewOutput(1234);
    
    expect(output).toBe('more output');
  });
  
  it('should terminate process when requested', async () => {
    // Start command execution
    await terminalManager.executeCommand('test-command', 100);
    
    // Force terminate
    const success = terminalManager.forceTerminate(1234);
    
    expect(success).toBe(true);
    expect(mockProcess.kill).toHaveBeenCalledWith('SIGINT');
  });
  
  it('should list active sessions', async () => {
    // Start command execution
    await terminalManager.executeCommand('test-command', 100);
    
    // List sessions
    const sessions = terminalManager.listActiveSessions();
    
    expect(sessions.length).toBe(1);
    expect(sessions[0].pid).toBe(1234);
  });
  
  it('should handle completed sessions correctly', async () => {
    // Start command execution
    const resultPromise = terminalManager.executeCommand('test-command', 1000);
    
    // Simulate some output
    mockProcess.stdout.emit('data', 'test output');
    
    // Simulate process exit
    mockProcess.emit('exit', 0);
    
    // Wait for command to complete
    await resultPromise;
    
    // Get output from completed session
    const output = terminalManager.getNewOutput(1234);
    
    // Should contain completion message
    expect(output).toContain('Process completed with exit code 0');
    expect(output).toContain('Runtime:');
    expect(output).toContain('test output');
  });
});