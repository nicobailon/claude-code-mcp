#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve as pathResolve } from 'node:path';
import * as path from 'path';

import { ServerResult } from './types.js';
import { 
  ExecuteCommandArgsSchema, 
  ReadOutputArgsSchema, 
  ForceTerminateArgsSchema, 
  ListSessionsArgsSchema,
  ClaudeCodeArgsSchema
} from './tools/schemas.js';
import { 
  DEFAULT_CLAUDE_TIMEOUT, 
  CLEANUP_INTERVAL_MS 
} from './config.js';
import { terminalManager } from './terminal-manager.js';
import {
  handleExecuteCommand,
  handleReadOutput,
  handleForceTerminate,
  handleListSessions
} from './handlers/terminal-handlers.js';
import { zodToJsonSchema } from './utils/zod-to-json-schema.js';

// Server version - update this when releasing new versions
const SERVER_VERSION = "1.11.0";

// Define debugMode globally using const
const debugMode = process.env.MCP_CLAUDE_DEBUG === 'true';

// Track if this is the first tool use for version printing
let isFirstToolUse = true;

// Capture server startup time when the module loads
const serverStartupTime = new Date().toISOString();

// Dedicated debug logging function
export function debugLog(message?: any, ...optionalParams: any[]): void {
  if (debugMode) {
    console.error(message, ...optionalParams);
  }
}

/**
 * Determine the Claude CLI command/path.
 * 1. Checks for CLAUDE_CLI_NAME environment variable:
 *    - If absolute path, uses it directly
 *    - If relative path, throws error
 *    - If simple name, continues with path resolution
 * 2. Checks for Claude CLI at the local user path: ~/.claude/local/claude.
 * 3. If not found, defaults to the CLI name (or 'claude'), relying on the system's PATH for lookup.
 */
export function findClaudeCli(): string {
  debugLog('[Debug] Attempting to find Claude CLI...');

  // Check for custom CLI name from environment variable
  const customCliName = process.env.CLAUDE_CLI_NAME;
  if (customCliName) {
    debugLog(`[Debug] Using custom Claude CLI name from CLAUDE_CLI_NAME: ${customCliName}`);
    
    // If it's an absolute path, use it directly
    if (path.isAbsolute(customCliName)) {
      debugLog(`[Debug] CLAUDE_CLI_NAME is an absolute path: ${customCliName}`);
      return customCliName;
    }
    
    // If it starts with ~ or ./, reject as relative paths are not allowed
    if (customCliName.startsWith('./') || customCliName.startsWith('../') || customCliName.includes('/')) {
      throw new Error(`Invalid CLAUDE_CLI_NAME: Relative paths are not allowed. Use either a simple name (e.g., 'claude') or an absolute path (e.g., '/tmp/claude-test')`);
    }
  }
  
  const cliName = customCliName || 'claude';

  // Try local install path: ~/.claude/local/claude (using the original name for local installs)
  const userPath = join(homedir(), '.claude', 'local', 'claude');
  debugLog(`[Debug] Checking for Claude CLI at local user path: ${userPath}`);

  if (existsSync(userPath)) {
    debugLog(`[Debug] Found Claude CLI at local user path: ${userPath}. Using this path.`);
    return userPath;
  } else {
    debugLog(`[Debug] Claude CLI not found at local user path: ${userPath}.`);
  }

  // 3. Fallback to CLI name (PATH lookup)
  debugLog(`[Debug] Falling back to "${cliName}" command name, relying on spawn/PATH lookup.`);
  console.warn(`[Warning] Claude CLI not found at ~/.claude/local/claude. Falling back to "${cliName}" in PATH. Ensure it is installed and accessible.`);
  return cliName;
}

// Ensure spawnAsync is defined correctly *before* the class
export async function spawnAsync(command: string, args: string[], options?: { timeout?: number, cwd?: string }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    debugLog(`[Spawn] Running command: ${command} ${args.join(' ')}`);
    const process = spawn(command, args, {
      shell: false, // Reverted to false
      timeout: options?.timeout,
      cwd: options?.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => { stdout += data.toString(); });
    process.stderr.on('data', (data) => {
      stderr += data.toString();
      debugLog(`[Spawn Stderr Chunk] ${data.toString()}`);
    });

    process.on('error', (error: NodeJS.ErrnoException) => {
      debugLog(`[Spawn Error Event] Full error object:`, error);
      let errorMessage = `Spawn error: ${error.message}`;
      if (error.path) {
        errorMessage += ` | Path: ${error.path}`;
      }
      if (error.syscall) {
        errorMessage += ` | Syscall: ${error.syscall}`;
      }
      errorMessage += `\nStderr: ${stderr.trim()}`;
      reject(new Error(errorMessage));
    });

    process.on('close', (code) => {
      debugLog(`[Spawn Close] Exit code: ${code}`);
      debugLog(`[Spawn Stderr Full] ${stderr.trim()}`);
      debugLog(`[Spawn Stdout Full] ${stdout.trim()}`);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}\nStderr: ${stderr.trim()}\nStdout: ${stdout.trim()}`));
      }
    });
  });
}

/**
 * MCP Server for Claude Code
 * Provides a simple MCP tool to run Claude CLI in one-shot mode
 */
export class ClaudeCodeServer {
  private server: Server;
  private claudeCliPath: string; // This now holds either a full path or just 'claude'
  private packageVersion: string; // Add packageVersion property

  constructor() {
    // Use the simplified findClaudeCli function
    this.claudeCliPath = findClaudeCli(); // Removed debugMode argument
    console.error(`[Setup] Using Claude CLI command/path: ${this.claudeCliPath}`);
    this.packageVersion = SERVER_VERSION;

    this.server = new Server(
      {
        name: 'claude_code',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Set up the MCP tool handlers
   */
  private setupToolHandlers(): void {
    // Define available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'claude_code',
          description: `Claude Code Agent: Your versatile multi-modal assistant for code, file, Git, and terminal operations via Claude CLI. Use \`workFolder\` for contextual execution.

• File ops: Create, read, (fuzzy) edit, move, copy, delete, list files, analyze/ocr images, file content analysis
    └─ e.g., "Create /tmp/log.txt with 'system boot'", "Edit main.py to replace 'debug_mode = True' with 'debug_mode = False'", "List files in /src", "Move a specific section somewhere else"

• Code: Generate / analyse / refactor / fix
    └─ e.g. "Generate Python to parse CSV→JSON", "Find bugs in my_script.py"

• Git: Stage ▸ commit ▸ push ▸ tag (any workflow)
    └─ "Commit '/workspace/src/main.java' with 'feat: user auth' to develop."

• Terminal: Run any CLI cmd or open URLs
    └─ "npm run build", "Open https://developer.mozilla.org"

• Web search + summarise content on-the-fly

• Multi-step workflows  (Version bumps, changelog updates, release tagging, etc.)

• GitHub integration  Create PRs, check CI status

• Confused or stuck on an issue? Ask Claude Code for a second opinion, it might surprise you!

**Prompt tips**

1. Be concise, explicit & step-by-step for complex tasks. No need for niceties, this is a tool to get things done.
2. For multi-line text, write it to a temporary file in the project root, use that file, then delete it.
3. If you get a timeout, split the task into smaller steps.
4. **Seeking a second opinion/analysis**: If you're stuck or want advice, you can ask \`claude_code\` to analyze a problem and suggest solutions. Clearly state in your prompt that you are looking for analysis only and no actual file modifications should be made.
5. If workFolder is set to the project path, there is no need to repeat that path in the prompt and you can use relative paths for files.
6. Claude Code is really good at complex multi-step file operations and refactorings and faster than your native edit features.
7. Combine file operations, README updates, and Git commands in a sequence.
8. Claude can do much more, just ask it!

Set wait=false for long-running tasks to avoid timeouts. Use read_output and related tools to monitor progress.
        `,
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'The detailed natural language prompt for Claude to execute.',
              },
              workFolder: {
                type: 'string',
                description: 'Mandatory when using file operations or referencing any file. The working directory for the Claude CLI execution. Must be an absolute path.',
              },
              wait: {
                type: 'boolean',
                description: 'Whether to wait for the command to complete. Defaults to true. Set to false to run in the background.',
                default: true
              }
            },
            required: ['prompt'],
          },
        },
        {
          name: "execute_command",
          description: "Execute a terminal command with timeout. Command will continue running in background if it doesn't complete within timeout.",
          inputSchema: zodToJsonSchema(ExecuteCommandArgsSchema),
        },
        {
          name: "read_output",
          description: "Read new output from a running terminal session.",
          inputSchema: zodToJsonSchema(ReadOutputArgsSchema),
        },
        {
          name: "force_terminate",
          description: "Force terminate a running terminal session.",
          inputSchema: zodToJsonSchema(ForceTerminateArgsSchema),
        },
        {
          name: "list_sessions",
          description: "List all active terminal sessions.",
          inputSchema: zodToJsonSchema(ListSessionsArgsSchema),
        }
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (args, extra) => {
      debugLog('[Debug] Handling CallToolRequest:', args);

      // Correctly access toolName from args.params.name
      const toolName = args.params.name;
      
      // Get tool arguments
      const toolArguments = args.params.arguments;

      try {
        switch (toolName) {
          case 'claude_code':
            return await this.handleClaudeCode(toolArguments);
          case 'execute_command':
            return await handleExecuteCommand(toolArguments);
          case 'read_output':
            return await handleReadOutput(toolArguments);
          case 'force_terminate':
            return await handleForceTerminate(toolArguments);
          case 'list_sessions':
            return await handleListSessions(toolArguments);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool ${toolName} not found`);
        }
      } catch (error: any) {
        debugLog('[Error] Error handling tool request:', error);
        let errorMessage = error.message || 'Unknown error';
        
        if (error.stderr) {
          errorMessage += `\nStderr: ${error.stderr}`;
        }
        if (error.stdout) {
          errorMessage += `\nStdout: ${error.stdout}`;
        }

        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Handle the claude_code tool
   */
  private async handleClaudeCode(args: unknown): Promise<ServerResult> {
    // Parse and validate arguments
    const parsed = ClaudeCodeArgsSchema.safeParse(args);
    if (!parsed.success) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for claude_code: ${parsed.error}`);
    }

    // Extract prompt, workFolder and wait from parsed data
    const { prompt, workFolder, wait = true } = parsed.data;
    
    // Determine the working directory
    let effectiveCwd = homedir(); // Default CWD is user's home directory
    
    // Check if workFolder is provided in the tool arguments
    if (workFolder && typeof workFolder === 'string') {
      const resolvedCwd = pathResolve(workFolder);
      debugLog(`[Debug] Specified workFolder: ${workFolder}, Resolved to: ${resolvedCwd}`);

      // Check if the resolved path exists
      if (existsSync(resolvedCwd)) {
        effectiveCwd = resolvedCwd;
        debugLog(`[Debug] Using workFolder as CWD: ${effectiveCwd}`);
      } else {
        debugLog(`[Warning] Specified workFolder does not exist: ${resolvedCwd}. Using default: ${effectiveCwd}`);
      }
    } else {
      debugLog(`[Debug] No workFolder provided, using default CWD: ${effectiveCwd}`);
    }

    // Print tool info on first use
    if (isFirstToolUse) {
      const versionInfo = `claude_code v${SERVER_VERSION} started at ${serverStartupTime}`;
      console.error(versionInfo);
      isFirstToolUse = false;
    }

    // Build the command for Claude CLI
    const claudeProcessArgs = ['--dangerously-skip-permissions', '-p', prompt];
    debugLog(`[Debug] Invoking Claude CLI: ${this.claudeCliPath} ${claudeProcessArgs.join(' ')}`);
    
    // If wait is true, use the old blocking approach (internally using the new system)
    if (wait) {
      const result = await terminalManager.executeCommand(
        `${this.claudeCliPath} ${claudeProcessArgs.join(' ')}`,
        DEFAULT_CLAUDE_TIMEOUT, // 30 minutes timeout
        effectiveCwd
      );
      
      // If the command completed (not blocked), return the full output
      if (!result.isBlocked) {
        return {
          content: [{ type: "text", text: result.output }],
        };
      }
      
      // If blocked (still running), we need to wait for it to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          const output = terminalManager.getNewOutput(result.pid);
          const isRunning = !!terminalManager.listActiveSessions().find(s => s.pid === result.pid);
          
          // If session is gone or output contains completion message, resolve
          if (!isRunning || (output && output.includes("Process completed with exit code"))) {
            clearInterval(checkInterval);
            resolve({
              content: [{ type: "text", text: output || result.output }],
            });
          }
        }, 1000);
      });
    }
    
    // If wait is false, return immediately with PID and initial output
    const result = await terminalManager.executeCommand(
      `${this.claudeCliPath} ${claudeProcessArgs.join(' ')}`,
      5000, // Short timeout to get initial output
      effectiveCwd
    );
    
    return {
      content: [{
        type: "text",
        text: `Claude Code task started with PID ${result.pid}\nInitial response:\n${result.output}${
          result.isBlocked ? '\n\nThis task is still running. Use read_output to get more output.' : ''
        }`
      }],
      metadata: {
        pid: result.pid,
        isRunning: result.isBlocked,
        startTime: new Date().toISOString()
      }
    };
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    // Revert to original server start logic if listen caused errors
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Claude Code MCP server running on stdio');
    
    // Start a periodic cleanup task for old sessions
    setInterval(() => {
      terminalManager.cleanupOldSessions();
    }, CLEANUP_INTERVAL_MS);
  }
}

// Create and run the server if this is the main module
const server = new ClaudeCodeServer();
server.run().catch(console.error);