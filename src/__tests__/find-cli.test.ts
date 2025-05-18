import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'path';

// Mock dependencies
vi.mock('node:fs');
vi.mock('node:os');
vi.mock('path');

const mockExistsSync = vi.mocked(existsSync);
const mockHomedir = vi.mocked(homedir);
const mockPath = vi.mocked(path);

// Import the module under test
import { findClaudeCli } from '../server.js';

describe('findClaudeCli Function', () => {
  let consoleWarnSpy: any;
  let originalEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    originalEnv = { ...process.env };
    process.env = { ...originalEnv };

    // Set up default path mock behavior
    mockPath.isAbsolute = vi.fn().mockImplementation((p: string) => p.startsWith('/'));
    mockPath.join = vi.fn().mockImplementation((...segments: string[]) => segments.join('/'));
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    process.env = originalEnv;
  });

  it('should handle undefined homedir() gracefully', () => {
    // Mock homedir() returning undefined
    mockHomedir.mockReturnValue(undefined);
    
    // This should not throw an error
    const cliPath = findClaudeCli();
    
    // Should fall back to 'claude' in PATH
    expect(cliPath).toBe('claude');
    
    // Should warn about falling back
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('home directory was not available')
    );
  });

  it('should use custom CLI name from environment variable', () => {
    mockHomedir.mockReturnValue('/home/user');
    mockExistsSync.mockReturnValue(false);
    process.env.CLAUDE_CLI_NAME = 'custom-claude';
    
    const cliPath = findClaudeCli();
    
    expect(cliPath).toBe('custom-claude');
  });

  it('should use absolute path from CLAUDE_CLI_NAME', () => {
    process.env.CLAUDE_CLI_NAME = '/absolute/path/to/claude';
    mockPath.isAbsolute.mockReturnValue(true);
    
    const cliPath = findClaudeCli();
    
    expect(cliPath).toBe('/absolute/path/to/claude');
  });

  it('should throw error for relative paths in CLAUDE_CLI_NAME', () => {
    process.env.CLAUDE_CLI_NAME = './relative/path/to/claude';
    
    expect(() => findClaudeCli()).toThrow(/Relative paths are not allowed/);
  });

  it('should use local user path when it exists', () => {
    mockHomedir.mockReturnValue('/home/user');
    mockExistsSync.mockReturnValue(true);
    mockPath.join.mockReturnValue('/home/user/.claude/local/claude');
    
    const cliPath = findClaudeCli();
    
    expect(cliPath).toBe('/home/user/.claude/local/claude');
    expect(mockExistsSync).toHaveBeenCalledWith('/home/user/.claude/local/claude');
  });
});