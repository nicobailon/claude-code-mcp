import { vi } from 'vitest';
import { TerminalManager } from '../../terminal-manager.js';
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';

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
  mockSpawn?: ReturnType<typeof vi.fn>
): TerminalManager {
  const spawnFn = mockSpawn || vi.fn();
  
  // Use a simpler approach: directly mock Date constructor in the tests
  vi.spyOn(global, 'Date').mockImplementation(() => new MockDate());
  
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
): void {
  setTimeout(() => {
    mockProcess.stdout.emit('data', outputText);
  }, delayBeforeOutput);
  
  setTimeout(() => {
    mockProcess.emit('exit', exitCode);
  }, delayBeforeExit);
}

/**
 * Helper to simulate a process that will time out
 */
export function setupProcessThatTimesOut(
  mockProcess: MockChildProcess,
  outputText: string,
  delayBeforeOutput: number = 10
): void {
  setTimeout(() => {
    mockProcess.stdout.emit('data', outputText);
  }, delayBeforeOutput);
  // No exit event will be emitted
}