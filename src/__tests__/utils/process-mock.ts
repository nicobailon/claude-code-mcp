import { EventEmitter } from 'events';
import { vi } from 'vitest';
import { ChildProcess } from 'child_process';
import { MockChildProcess } from './terminal-test-helpers.js';

/**
 * Creates and returns a factory for mock processes with enhanced testing capabilities
 */
export function createProcessMockFactory() {
  let pidCounter = 1000;
  
  /**
   * Creates a mock process with auto-incremented PID
   */
  function createProcess(customPid?: number): ChildProcess {
    const pid = customPid || ++pidCounter;
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = new EventEmitter();
    proc.stdio = [proc.stdin, proc.stdout, proc.stderr, null, null];
    proc.pid = pid;
    proc.killed = false;
    proc.connected = true;
    proc.kill = vi.fn().mockImplementation((signal?: string) => {
      proc.killed = true;
      // Schedule the exit event to simulate process termination
      setTimeout(() => {
        proc.emit('exit', signal === 'SIGKILL' ? 9 : 0);
        proc.emit('close', signal === 'SIGKILL' ? 9 : 0);
      }, 5);
      return true;
    });
    return proc;
  }
  
  /**
   * Creates a mock spawn function that returns predetermined processes
   * @param processes Map of command strings to processes
   */
  function createMockSpawnFn(processes: Map<string, ChildProcess> = new Map()) {
    return vi.fn().mockImplementation((command: string) => {
      // If we have a predefined process for this command, return it
      if (processes.has(command)) {
        return processes.get(command)!;
      }
      
      // Otherwise create a new process
      const proc = createProcess();
      processes.set(command, proc);
      return proc;
    });
  }
  
  /**
   * Simulates standard output from a process
   */
  function simulateStdout(process: ChildProcess, output: string, delay: number = 10): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        process.stdout?.emit('data', output);
        resolve();
      }, delay);
    });
  }
  
  /**
   * Simulates error output from a process
   */
  function simulateStderr(process: ChildProcess, output: string, delay: number = 10): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        process.stderr?.emit('data', output);
        resolve();
      }, delay);
    });
  }
  
  /**
   * Simulates process completion
   */
  function simulateExit(process: ChildProcess, exitCode: number = 0, delay: number = 20): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        process.emit('exit', exitCode);
        process.emit('close', exitCode);
        resolve();
      }, delay);
    });
  }
  
  /**
   * Simulates process error
   */
  function simulateError(process: ChildProcess, error: Error | string, delay: number = 10): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        if (typeof error === 'string') {
          error = new Error(error);
        }
        process.emit('error', error);
        resolve();
      }, delay);
    });
  }
  
  /**
   * Simulates a complete process lifecycle with output and exit
   */
  function simulateProcessLifecycle(
    process: ChildProcess,
    options: {
      stdout?: string,
      stderr?: string,
      exitCode?: number,
      stdoutDelay?: number,
      stderrDelay?: number,
      exitDelay?: number
    } = {}
  ): Promise<void> {
    const {
      stdout = '',
      stderr = '',
      exitCode = 0,
      stdoutDelay = 10,
      stderrDelay = 15,
      exitDelay = 20
    } = options;
    
    return new Promise(async resolve => {
      const promises = [];
      
      if (stdout) {
        promises.push(simulateStdout(process, stdout, stdoutDelay));
      }
      
      if (stderr) {
        promises.push(simulateStderr(process, stderr, stderrDelay));
      }
      
      await Promise.all(promises);
      await simulateExit(process, exitCode, exitDelay);
      resolve();
    });
  }
  
  return {
    createProcess,
    createMockSpawnFn,
    simulateStdout,
    simulateStderr,
    simulateExit,
    simulateError,
    simulateProcessLifecycle
  };
}

// Export a default factory instance for convenience
export const processMockFactory = createProcessMockFactory();