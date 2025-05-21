import { terminalManager } from '../terminal-manager.js';
import { 
  ExecuteCommandArgsSchema, 
  ReadOutputArgsSchema, 
  ForceTerminateArgsSchema, 
  ListSessionsArgsSchema 
} from './schemas.js';
import { ServerResult } from '../types.js';
import { debugLog } from '../server.js';

export async function executeCommand(args: unknown): Promise<ServerResult> {
  const parsed = ExecuteCommandArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Error: Invalid arguments for execute_command: ${parsed.error}` }],
      isError: true,
    };
  }

  // Note: Command validation logic would go here
  // In a real implementation, we'd want to validate the command is allowed
  // For now we'll just execute anything

  debugLog(`[execute_command] Executing command: ${parsed.data.command}`);
  
  const result = await terminalManager.executeCommand(
    parsed.data.command,
    parsed.data.timeout_ms,
    undefined, // cwd is not provided in this simple implementation
    parsed.data.shell
  );

  // Check for error condition (pid = -1)
  if (result.pid === -1) {
    return {
      content: [{ type: "text", text: result.output }],
      isError: true,
    };
  }

  return {
    content: [{
      type: "text",
      text: `Command started with PID ${result.pid}\nInitial output:\n${result.output}${
        result.isBlocked ? '\n\nCommand is still running. Use read_output to get more output.' : ''
      }`
    }],
    metadata: {
      pid: result.pid,
      isRunning: result.isBlocked,
      startTime: new Date().toISOString()
    }
  };
}

export async function readOutput(args: unknown): Promise<ServerResult> {
  const parsed = ReadOutputArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Error: Invalid arguments for read_output: ${parsed.error}` }],
      isError: true,
    };
  }

  debugLog(`[read_output] Reading output for PID: ${parsed.data.pid}`);
  
  const output = terminalManager.getNewOutput(parsed.data.pid);
  const sessions = terminalManager.listActiveSessions();
  const session = sessions.find(s => s.pid === parsed.data.pid);
  
  // If the session is active
  if (session) {
    return {
      content: [{
        type: "text",
        text: output === null
          ? `No session found for PID ${parsed.data.pid}`
          : output
      }],
      metadata: {
        pid: parsed.data.pid,
        isRunning: true,
        runtime: Math.round(session.runtime / 1000) // Convert to seconds
      }
    };
  } 
  // If it's a completed session (output is not null but not in active sessions)
  else if (output !== null) {
    return {
      content: [{
        type: "text",
        text: output
      }],
      metadata: {
        pid: parsed.data.pid,
        isRunning: false
      }
    };
  }
  // If no session was found at all
  else {
    return {
      content: [{
        type: "text",
        text: `No session found for PID ${parsed.data.pid}`
      }],
      isError: true
    };
  }
}

export async function forceTerminate(args: unknown): Promise<ServerResult> {
  const parsed = ForceTerminateArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Error: Invalid arguments for force_terminate: ${parsed.error}` }],
      isError: true,
    };
  }

  debugLog(`[force_terminate] Terminating PID: ${parsed.data.pid}`);
  
  const success = terminalManager.forceTerminate(parsed.data.pid);
  return {
    content: [{
      type: "text",
      text: success
        ? `Successfully initiated termination of session ${parsed.data.pid}`
        : `No active session found for PID ${parsed.data.pid}`
    }],
    metadata: {
      pid: parsed.data.pid,
      isRunning: false
    }
  };
}

export async function listSessions(): Promise<ServerResult> {
  debugLog(`[list_sessions] Listing active sessions`);
  
  const sessions = terminalManager.listActiveSessions();
  return {
    content: [{
      type: "text",
      text: sessions.length === 0
        ? 'No active sessions'
        : sessions.map(s =>
            `PID: ${s.pid}, Running: ${s.isBlocked ? 'Yes' : 'No'}, Runtime: ${Math.round(s.runtime / 1000)}s`
          ).join('\n')
    }]
  };
}