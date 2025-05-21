import { vi } from 'vitest';
import { TerminalManager } from '../../terminal-manager.js';
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { TerminalSession, CompletedSession, CommandExecutionResult } from '../../types.js';

/**
 * Interface for our mock process that combines EventEmitter with child process properties
 */
export interface MockChildProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  pid: number;
  kill: (signal?: string) => boolean;
}

/**
 * Create a mock process with the given PID
 */
export function createMockProcess(pid: number): MockChildProcess {
  const proc = new EventEmitter() as MockChildProcess;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.pid = pid;
  proc.kill = vi.fn().mockReturnValue(true);
  return proc;
}

/**
 * Mock date constructor that returns fixed timestamps
 */
export class MockDate extends Date {
  private static currentTime: number = new Date('2025-05-20T12:00:00Z').getTime();
  
  constructor() {
    super(MockDate.currentTime);
  }
  
  static advanceTime(milliseconds: number): void {
    MockDate.currentTime += milliseconds;
  }
  
  static reset(): void {
    MockDate.currentTime = new Date('2025-05-20T12:00:00Z').getTime();
  }
  
  // Add missing Date.prototype methods to satisfy DateConstructor
  static toString(): string {
    return new Date(MockDate.currentTime).toString();
  }
  
  static now(): number {
    return MockDate.currentTime;
  }
}

/**
 * Create a testable terminal manager with mocked dependencies
 */
export function createTestableTerminalManager(
  mockSpawn?: ReturnType<typeof vi.fn>,
  useMockDate: boolean = true
): TerminalManager {
  const spawnFn = mockSpawn || vi.fn();
  
  if (useMockDate) {
    // Use a simpler approach: directly mock Date constructor in the tests
    vi.spyOn(global, 'Date').mockImplementation(() => new MockDate());
  }
  
  return new TerminalManager(spawnFn);
}

/**
 * Helper to simulate a process that emits output and eventually exits
 */
export function setupProcessWithOutputAndExit(
  mockProcess: MockChildProcess,
  outputText: string,
  exitCode: number = 0,
  delayBeforeOutput: number = 10,
  delayBeforeExit: number = 20
): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      mockProcess.stdout.emit('data', outputText);
    }, delayBeforeOutput);
    
    setTimeout(() => {
      mockProcess.emit('exit', exitCode);
      mockProcess.emit('close', exitCode);
      resolve();
    }, delayBeforeExit);
  });
}

/**
 * Helper to simulate a process that will time out
 */
export function setupProcessThatTimesOut(
  mockProcess: MockChildProcess,
  outputText: string,
  delayBeforeOutput: number = 10
): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      mockProcess.stdout.emit('data', outputText);
      resolve();
    }, delayBeforeOutput);
    // No exit event will be emitted
  });
}

/**
 * Helper to simulate a process that emits an error
 */
export function setupProcessWithError(
  mockProcess: MockChildProcess,
  errorMessage: string = 'Command failed',
  errorCode: string = 'ENOENT',
  delay: number = 10
): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const error = new Error(errorMessage) as any;
      error.code = errorCode;
      mockProcess.emit('error', error);
      resolve();
    }, delay);
  });
}

/**
 * Add a mock active session directly to the terminal manager for testing
 */
export function addMockActiveSession(
  terminalManager: TerminalManager,
  sessionData: Partial<TerminalSession> & { pid: number }
): void {
  const sessions = terminalManager._getActiveSessions();
  const mockProcess = createMockProcess(sessionData.pid);
  
  sessions.set(sessionData.pid, {
    pid: sessionData.pid,
    process: sessionData.process || mockProcess,
    lastOutput: sessionData.lastOutput || '',
    isBlocked: sessionData.isBlocked ?? false,
    startTime: sessionData.startTime || new Date()
  });
}

/**
 * Add a mock completed session directly to the terminal manager for testing
 */
export function addMockCompletedSession(
  terminalManager: TerminalManager,
  sessionData: Partial<CompletedSession> & { pid: number }
): void {
  const completedSessions = terminalManager._getCompletedSessions();
  
  completedSessions.set(sessionData.pid, {
    pid: sessionData.pid,
    output: sessionData.output || 'completed output',
    exitCode: sessionData.exitCode ?? 0,
    startTime: sessionData.startTime || new Date(Date.now() - 1000),
    endTime: sessionData.endTime || new Date()
  });
}

/**
 * Helper function to create a CommandExecutionResult object
 */
export function createCommandExecutionResult(
  options: Partial<CommandExecutionResult> & { pid: number }
): CommandExecutionResult {
  return {
    pid: options.pid,
    output: options.output || 'test output',
    isBlocked: options.isBlocked ?? false
  };
}

/**
 * Set up a mock terminal manager with all methods mocked for test isolation
 */
export function setupMockedTerminalManager() {
  return {
    executeCommand: vi.fn(),
    getNewOutput: vi.fn(),
    forceTerminate: vi.fn(),
    listActiveSessions: vi.fn(),
    cleanupOldSessions: vi.fn()
  };
}