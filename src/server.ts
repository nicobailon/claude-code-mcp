#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type ServerResult,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve as pathResolve } from 'node:path';
import * as path from 'path';
import { readFileSync } from 'node:fs';

// Server version - update this when releasing new versions
const SERVER_VERSION = "1.10.12";

// Define global mode variables
const debugMode = process.env.MCP_CLAUDE_DEBUG === 'true';
const isOrchestratorMode = process.env.CLAUDE_ORCHESTRATOR_MODE === 'true' || 
                          !!process.env.BASH_MAX_TIMEOUT_MS;

const getOrchestratorSystemPrompt = (): string => {
  if (!isOrchestratorMode) return '';
  return `
[ORCHESTRATOR MODE ACTIVE]

You are a Claude Code Orchestrator with meta-agent capabilities:

🎭 ORCHESTRATION CAPABILITIES:
• Intelligent workflow planning and breakdown of complex tasks
• Natural language understanding of multi-step operations
• Extended timeout support for demanding operations
• Cross-directory and multi-repo coordination

⚡ WORKFLOW PATTERNS:
• When given complex instructions, break down into logical steps
• For larger tasks, create a plan before execution
• Include validation steps after critical operations
• Provide clear progress updates throughout execution

🛠️ BEST PRACTICES:
• Break complex tasks into atomic, executable steps
• Validate results after significant operations
• Plan error recovery for critical workflows
• Keep the user informed of progress and completion
• Use natural language to express complex instructions

Remember to maintain clear context about the task's state and progress.
`;
};

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

/**
 * Interface for Claude Code tool arguments
 */
interface ClaudeCodeArgs {
  prompt: string;
  workFolder?: string;
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
        name: isOrchestratorMode ? 'claude_code_orchestrator' : 'claude_code',
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {
            orchestration: isOrchestratorMode ? {
              multiStep: true,
              timeoutManagement: true,
              workflowPlanning: true,
              metaAgentCapable: true
            } : undefined
          },
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
          description: `Claude Code ${isOrchestratorMode ? 'Orchestrator' : 'Agent'}: ${isOrchestratorMode ? 'Meta-agent for complex multi-step workflows.' : 'Your versatile multi-modal assistant for code, file, Git, and terminal operations via Claude CLI.'} Use \`workFolder\` for contextual execution.

${isOrchestratorMode ? `🎭 ORCHESTRATION CAPABILITIES:
• Intelligent workflow planning and task decomposition
• Adaptive execution of complex operations
• Extended timeout support for demanding tasks (up to 30 minutes)
• Cross-directory and multi-repo operations
• Natural language driven orchestration

⚡ WORKFLOW PATTERNS:
• File operations: Create → Test → Commit → Deploy
• Feature development: Setup → Code → Test → Review → Merge
• Infrastructure: Provision → Configure → Validate → Monitor
• Bug fixes: Reproduce → Fix → Test → Verify → Document

🛠️ PARAMETERS:
• workFolder: Target directory (required for file operations)
• timeout: Custom timeout in milliseconds

**Best Practices:**
1. Always specify workFolder for file operations
2. Use clear, detailed natural language to describe complex tasks
3. Include validation and error handling in your instructions
4. Describe desired verification steps in your prompt
5. Express your orchestration needs in natural language
` : `• File ops: Create, read, (fuzzy) edit, move, copy, delete, list files, analyze/ocr images, file content analysis
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
8. Claude can do much more, just ask it!`}

Example: ${isOrchestratorMode ? '"Plan and execute: Create an authentication system with user registration, login endpoints, and JWT validation. Run tests, commit changes, and create a PR for review."' : '"Create a new React component, write tests, update the docs."'}
        `,
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'The orchestration prompt or specific task instruction.',
              },
              workFolder: {
                type: 'string',
                description: 'Target directory for operations. Mandatory for file/git operations. Must be an absolute path.',
              },
              timeout: {
                type: 'number',
                description: 'Custom timeout in milliseconds for this operation. Optional.',
              }
            },
            required: ['prompt'],
          },
        }
      ],
    }));

    // Handle tool calls
    const executionTimeoutMs = 1800000; // 30 minutes timeout

    this.server.setRequestHandler(CallToolRequestSchema, async (args, call): Promise<ServerResult> => {
      debugLog('[Debug] Handling CallToolRequest:', args);

      // Correctly access toolName from args.params.name
      const toolName = args.params.name;
      if (toolName !== 'claude_code') {
        // ErrorCode.ToolNotFound should be ErrorCode.MethodNotFound as per SDK for tools
        throw new McpError(ErrorCode.MethodNotFound, `Tool ${toolName} not found`);
      }

      // Robustly access prompt from args.params.arguments
      const toolArguments = args.params.arguments;
      let prompt: string;

      if (
        toolArguments &&
        typeof toolArguments === 'object' &&
        'prompt' in toolArguments &&
        typeof toolArguments.prompt === 'string'
      ) {
        prompt = toolArguments.prompt;
      } else {
        throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid required parameter: prompt (must be an object with a string "prompt" property) for claude_code tool');
      }

      // Extract parameters
      const { 
        workFolder, 
        timeout: customTimeout
      } = toolArguments;

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

      // Construct enhanced prompt
      let enhancedPrompt = prompt;

      // Print tool info on first use
      if (isFirstToolUse) {
        const versionInfo = `claude_code v${SERVER_VERSION} started at ${serverStartupTime}`;
        console.error(versionInfo);
        isFirstToolUse = false;
      }

      // Add orchestrator system prompt if in orchestrator mode
      if (isOrchestratorMode) {
        enhancedPrompt = getOrchestratorSystemPrompt() + '\n\n' + enhancedPrompt;
      }

      // No additional orchestration directives - using natural language

      // Use custom timeout or environment default
      const executionTimeout: number = (customTimeout as number) || 
        parseInt(process.env.BASH_MAX_TIMEOUT_MS || '1800000');

      try {
        debugLog(`[Debug] Attempting to execute Claude CLI with prompt: "${enhancedPrompt}" in CWD: "${effectiveCwd}"`);

        const claudeProcessArgs = ['--dangerously-skip-permissions', '-p', enhancedPrompt];
        debugLog(`[Debug] Invoking Claude CLI: ${this.claudeCliPath} ${claudeProcessArgs.join(' ')}`);

        const { stdout, stderr } = await spawnAsync(
          this.claudeCliPath, // Run the Claude CLI directly
          claudeProcessArgs, // Pass the arguments
          { timeout: executionTimeout, cwd: effectiveCwd }
        );

        debugLog('[Debug] Claude CLI stdout:', stdout.trim());
        if (stderr) {
          debugLog('[Debug] Claude CLI stderr:', stderr.trim());
        }

        // Return stdout content, even if there was stderr, as claude-cli might output main result to stdout.
        return { content: [{ type: 'text', text: stdout }] };

      } catch (error: any) {
        debugLog('[Error] Error executing Claude CLI:', error);
        let errorMessage = error.message || 'Unknown error';
        // Attempt to include stderr and stdout from the error object if spawnAsync attached them
        if (error.stderr) {
          errorMessage += `\nStderr: ${error.stderr}`;
        }
        if (error.stdout) {
          errorMessage += `\nStdout: ${error.stdout}`;
        }

        if (error.signal === 'SIGTERM' || (error.message && error.message.includes('ETIMEDOUT')) || (error.code === 'ETIMEDOUT')) {
          // Reverting to InternalError due to lint issues, but with a specific timeout message.
          throw new McpError(ErrorCode.InternalError, `Claude CLI command timed out after ${executionTimeout / 1000}s. Details: ${errorMessage}`);
        }
        // ErrorCode.ToolCallFailed should be ErrorCode.InternalError or a more specific execution error if available
        throw new McpError(ErrorCode.InternalError, `Claude CLI execution failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    // Revert to original server start logic if listen caused errors
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Claude Code MCP server running on stdio');
  }
}

// Create and run the server if this is the main module
const server = new ClaudeCodeServer();
server.run().catch(console.error);