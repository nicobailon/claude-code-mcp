import { terminalManager } from '../terminal-manager.js';
import { 
  ExecuteCommandArgsSchema, 
  ReadOutputArgsSchema, 
  ForceTerminateArgsSchema, 
  ListSessionsArgsSchema 
} from './schemas.js';
import { ServerResult } from '../types.js';
import { debugLog } from '../server.js';
import { isCommandAllowed } from '../config.js';
import { z } from 'zod';

// Define types based on schema outputs for better type safety
type ExecuteCommandArgs = z.infer<typeof ExecuteCommandArgsSchema>;
type ReadOutputArgs = z.infer<typeof ReadOutputArgsSchema>;
type ForceTerminateArgs = z.infer<typeof ForceTerminateArgsSchema>;
type ListSessionsArgs = z.infer<typeof ListSessionsArgsSchema>;

export async function executeCommand(args: ExecuteCommandArgs): Promise<ServerResult> {
  // Command validation - security check
  if (!isCommandAllowed(args.command)) {
    return {
      content: [{ 
        type: "text", 
        text: `Error: Command not allowed for security reasons: '${args.command}'\n\nPlease use only allowed commands. Contact the administrator to add commands to the allowlist if needed.` 
      }],
      isError: true,
    };
  }

  debugLog(`[execute_command] Executing command: ${args.command}`);
  
  const result = await terminalManager.executeCommand(
    args.command,
    args.timeout_ms,
    args.cwd,
    args.shell
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
        result.isBlocked ? '\n\nCommand is still running. Use `read_output` to get more output.' : ''
      }`
    }],
    metadata: {
      pid: result.pid,
      isRunning: result.isBlocked,
      startTime: new Date().toISOString()
    }
  };
}

export async function readOutput(args: ReadOutputArgs): Promise<ServerResult> {
  debugLog(`[read_output] Reading output for PID: ${args.pid}`);
  
  const output = terminalManager.getNewOutput(args.pid);
  const sessions = terminalManager.listActiveSessions();
  const session = sessions.find(s => s.pid === args.pid);
  
  // If the session is active
  if (session) {
    return {
      content: [{
        type: "text",
        text: output === null
          ? `No session found for PID ${args.pid}`
          : output
      }],
      metadata: {
        pid: args.pid,
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
        pid: args.pid,
        isRunning: false
      }
    };
  }
  // If no session was found at all
  else {
    return {
      content: [{
        type: "text",
        text: `No session found for PID ${args.pid}`
      }],
      isError: true
    };
  }
}

export async function forceTerminate(args: ForceTerminateArgs): Promise<ServerResult> {
  debugLog(`[force_terminate] Terminating PID: ${args.pid}`);
  
  const success = terminalManager.forceTerminate(args.pid);
  return {
    content: [{
      type: "text",
      text: success
        ? `Successfully initiated termination of session ${args.pid}`
        : `No active session found for PID ${args.pid}`
    }],
    metadata: {
      pid: args.pid,
      isRunning: false
    }
  };
}

export async function listSessions(_args: ListSessionsArgs): Promise<ServerResult> {
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