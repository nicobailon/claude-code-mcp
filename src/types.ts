import { ChildProcess } from 'child_process';

export interface TerminalSession {
  pid: number;
  process: ChildProcess | any; // Allow any for testing
  lastOutput: string;
  isBlocked: boolean;
  startTime: Date;
}

export interface CompletedSession {
  pid: number;
  output: string;
  exitCode: number | null;
  startTime: Date;
  endTime: Date;
}

export interface ActiveSession {
  pid: number;
  isBlocked: boolean;
  runtime: number; // milliseconds
}

export interface CommandExecutionResult {
  pid: number;
  output: string;
  isBlocked: boolean;
}

// Define ServerResult interface
export interface ServerResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
  metadata?: {
    [key: string]: any;
    pid?: number;
    isRunning?: boolean;
    startTime?: string;
    exitCode?: number;
    runtime?: number;
  };
  [key: string]: any; // Allow additional properties expected by MCP
}