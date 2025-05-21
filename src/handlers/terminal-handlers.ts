import { 
  executeCommand, 
  readOutput, 
  forceTerminate, 
  listSessions 
} from '../tools/execute.js';

import { 
  ExecuteCommandArgsSchema,
  ReadOutputArgsSchema,
  ForceTerminateArgsSchema,
  ListSessionsArgsSchema
} from '../tools/schemas.js';

import { ServerResult } from '../types.js';

/**
 * Handle execute_command command
 */
export async function handleExecuteCommand(args: unknown): Promise<ServerResult> {
  const parsed = ExecuteCommandArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Error: Invalid arguments for execute_command: ${parsed.error}` }],
      isError: true,
    };
  }
  return executeCommand(parsed.data);
}

/**
 * Handle read_output command
 */
export async function handleReadOutput(args: unknown): Promise<ServerResult> {
  const parsed = ReadOutputArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Error: Invalid arguments for read_output: ${parsed.error}` }],
      isError: true,
    };
  }
  return readOutput(parsed.data);
}

/**
 * Handle force_terminate command
 */
export async function handleForceTerminate(args: unknown): Promise<ServerResult> {
  const parsed = ForceTerminateArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Error: Invalid arguments for force_terminate: ${parsed.error}` }],
      isError: true,
    };
  }
  return forceTerminate(parsed.data);
}

/**
 * Handle list_sessions command
 */
export async function handleListSessions(args: unknown): Promise<ServerResult> {
  const parsed = ListSessionsArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Error: Invalid arguments for list_sessions: ${parsed.error}` }],
      isError: true,
    };
  }
  return listSessions();
}