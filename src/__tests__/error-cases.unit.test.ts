import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { spawnAsync, findClaudeCli } from '../server.js';

// Mock child_process globally before any imports
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

// Mock fs globally 
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

// Mock os globally
vi.mock('node:os', () => ({
  homedir: vi.fn()
}));

describe('Error Handling Unit Tests', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Process Spawn Error Cases', () => {
    it('should handle spawn ENOENT error', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = vi.mocked(spawn);
      
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      
      // Add the on methods to streams
      mockProcess.stdout.on = vi.fn().mockReturnThis();
      mockProcess.stderr.on = vi.fn().mockReturnThis();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const promise = spawnAsync('nonexistent-command', []);
      
      // Simulate ENOENT error
      setTimeout(() => {
        const error = new Error('spawn ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        error.path = 'nonexistent-command';
        error.syscall = 'spawn';
        mockProcess.emit('error', error);
      }, 10);
      
      await expect(promise).rejects.toThrowError(/Spawn error:.*spawn ENOENT.*nonexistent-command/);
    });

    it('should handle generic spawn errors', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = vi.mocked(spawn);
      
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      
      // Add the on methods to streams
      mockProcess.stdout.on = vi.fn().mockReturnThis();
      mockProcess.stderr.on = vi.fn().mockReturnThis();
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const promise = spawnAsync('test', []);
      
      // Simulate generic error
      setTimeout(() => {
        mockProcess.emit('error', new Error('Generic spawn error'));
      }, 10);
      
      await expect(promise).rejects.toThrow('Generic spawn error');
    });

    it('should accumulate stderr output before error', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = vi.mocked(spawn);
      
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      
      let stderrHandler: ((data: any) => void) | undefined;
      
      // Add the on methods to streams
      mockProcess.stdout.on = vi.fn().mockReturnThis();
      mockProcess.stderr.on = vi.fn((event: string, handler: (data: any) => void) => {
        if (event === 'data') {
          stderrHandler = handler;
        }
        return mockProcess.stderr;
      });
      
      mockSpawn.mockReturnValue(mockProcess);
      
      const promise = spawnAsync('test', []);
      
      // Simulate stderr data then error
      setTimeout(() => {
        stderrHandler?.('error line 1\n');
        stderrHandler?.('error line 2\n');
        mockProcess.emit('error', new Error('Command failed'));
      }, 10);
      
      await expect(promise).rejects.toThrow('error line 1\nerror line 2');
    });
  });

  describe('CLI Path Handling', () => {
    it('should handle CLI path not found gracefully', async () => {
      const { existsSync } = await import('node:fs');
      const { homedir } = await import('node:os');
      const mockExistsSync = vi.mocked(existsSync);
      const mockHomedir = vi.mocked(homedir);
      
      // Mock no CLI found anywhere
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(false);
      
      const result = findClaudeCli();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Claude CLI not found')
      );
    });

    it('should handle undefined homedir() gracefully', async () => {
      const { homedir } = await import('node:os');
      const mockHomedir = vi.mocked(homedir);
      
      // Mock homedir to return undefined
      mockHomedir.mockReturnValue(undefined as unknown as string);
      
      const result = findClaudeCli();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('home directory was not available')
      );
    });
  });
});