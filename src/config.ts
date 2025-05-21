export const DEFAULT_COMMAND_TIMEOUT = 30000; // 30 seconds
export const DEFAULT_CLAUDE_TIMEOUT = 1800000; // 30 minutes
export const MAX_COMPLETED_SESSIONS = 100; // Maximum number of completed sessions to keep in memory
export const COMPLETED_SESSION_MAX_AGE_MS = 3600000; // 1 hour in milliseconds
export const SIGINT_TIMEOUT_MS = 1000; // Time to wait before escalating to SIGKILL
export const CLEANUP_INTERVAL_MS = 600000; // 10 minutes in milliseconds
export const MAX_OUTPUT_BUFFER_SIZE = 1024 * 1024; // 1MB max output buffer size

// Environment variables for configuration override
export function getEnvConfig() {
  return {
    DEFAULT_COMMAND_TIMEOUT: parseInt(process.env.DEFAULT_COMMAND_TIMEOUT || '30000'),
    DEFAULT_CLAUDE_TIMEOUT: parseInt(process.env.DEFAULT_CLAUDE_TIMEOUT || '1800000'),
    MAX_COMPLETED_SESSIONS: parseInt(process.env.MAX_COMPLETED_SESSIONS || '100'),
    COMPLETED_SESSION_MAX_AGE_MS: parseInt(process.env.COMPLETED_SESSION_MAX_AGE_MS || '3600000'),
    SIGINT_TIMEOUT_MS: parseInt(process.env.SIGINT_TIMEOUT_MS || '1000'),
    CLEANUP_INTERVAL_MS: parseInt(process.env.CLEANUP_INTERVAL_MS || '600000'),
    MAX_OUTPUT_BUFFER_SIZE: parseInt(process.env.MAX_OUTPUT_BUFFER_SIZE || String(1024 * 1024))
  };
}

// Default allowed commands for execute_command tool
// This is a security feature to prevent arbitrary command execution
export const DEFAULT_ALLOWED_COMMANDS = [
  // Basic system commands
  'ls', 'dir', 'pwd', 'echo', 'date', 'time',
  // File operations (read-only)
  'cat', 'head', 'tail', 'less', 'more', 'grep', 'find',
  // Git operations
  'git status', 'git log', 'git diff', 'git show', 'git ls-files', 'git branch',
  // Node.js commands
  'node', 'npm list', 'npm run', 'npm test', 'npm ci',
  // Process info
  'ps', 'top', 'htop', 'free', 'df'
];

// Command validation function
export function isCommandAllowed(command: string): boolean {
  // If ALLOW_ALL_COMMANDS is set in env, bypass the check
  if (process.env.ALLOW_ALL_COMMANDS === 'true') {
    return true;
  }
  
  // Get allowed commands from environment or use defaults
  const allowedCommands = process.env.ALLOWED_COMMANDS ? 
    process.env.ALLOWED_COMMANDS.split(',').map(cmd => cmd.trim()) : 
    DEFAULT_ALLOWED_COMMANDS;
  
  // Check if the command starts with any of the allowed commands
  return allowedCommands.some(allowedCmd => 
    command.trim().startsWith(allowedCmd)
  );
}

// Create a simple config manager
export interface ConfigManagerInterface {
  getConfig: () => Promise<Config>;
}

export interface Config {
  defaultShell: string | boolean;
}

// Simple config manager implementation
class ConfigManager implements ConfigManagerInterface {
  async getConfig(): Promise<Config> {
    return {
      defaultShell: true
    };
  }
}

export const configManager = new ConfigManager();