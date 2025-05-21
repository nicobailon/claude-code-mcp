import { ChildProcess } from 'child_process';

export interface TerminalSession {
  pid: number;
  process: ChildProcess;
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

// Extend the ServerResult interface to include optional metadata
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
}