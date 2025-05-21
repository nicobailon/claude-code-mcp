import { spawn, ChildProcess } from 'child_process';
import { 
  DEFAULT_COMMAND_TIMEOUT, 
  MAX_COMPLETED_SESSIONS, 
  COMPLETED_SESSION_MAX_AGE_MS,
  SIGINT_TIMEOUT_MS,
  MAX_OUTPUT_BUFFER_SIZE,
  getEnvConfig
} from './config.js';
import { configManager } from './config.js';
import { TerminalSession, CompletedSession, CommandExecutionResult, ActiveSession } from './types.js';
import { debugLog } from './server.js';

export class TerminalManager {
  // Make these protected instead of private for better testability
  protected sessions: Map<number, TerminalSession>;
  protected completedSessions: Map<number, CompletedSession>;
  protected config: ReturnType<typeof getEnvConfig>;
  
  // Add constructor with dependency injection for better testing
  constructor(
    protected spawnFn = spawn,
    protected dateConstructor: DateConstructor = Date
  ) {
    this.sessions = new Map();
    this.completedSessions = new Map();
    this.config = getEnvConfig();
  }
  
  // Expose methods for testing
  public _getActiveSessions(): Map<number, TerminalSession> {
    return this.sessions;
  }
  
  public _getCompletedSessions(): Map<number, CompletedSession> {
    return this.completedSessions;
  }
  
  /**
   * Limits the size of a buffer string to prevent memory issues
   * @param buffer The string buffer to limit
   * @param maxSize Maximum size in bytes/chars
   * @returns Truncated buffer with warning if needed
   */
  protected limitBufferSize(buffer: string, maxSize: number = this.config.MAX_OUTPUT_BUFFER_SIZE): string {
    if (buffer.length <= maxSize) {
      return buffer;
    }
    
    // Keep the last portion of the buffer that fits within maxSize, minus space for the warning
    const warningMessage = "\n\n[Output truncated due to size limits. Oldest output has been discarded.]\n\n";
    const truncatedSize = maxSize - warningMessage.length;
    
    // Return the truncated buffer with a warning message
    return warningMessage + buffer.substring(buffer.length - truncatedSize);
  }
  
  async executeCommand(
    command: string, 
    timeoutMs: number = this.config.DEFAULT_COMMAND_TIMEOUT, 
    cwd?: string,
    shell?: string
  ): Promise<CommandExecutionResult> {
    // Get the shell from config if not specified
    let shellToUse: string | boolean | undefined = shell;
    if (!shellToUse) {
      try {
        const config = await configManager.getConfig();
        shellToUse = config.defaultShell || true;
      } catch (error) {
        // If there's an error getting the config, fall back to default
        shellToUse = true;
        debugLog(`[TerminalManager] Warning: Failed to get shell config, falling back to default shell`);
      }
    }
    
    // Create environment variable options based on orchestrator mode
    // Use type annotation to avoid TypeScript errors
    const envVars: NodeJS.ProcessEnv = { ...process.env };
    
    if (envVars.MCP_ORCHESTRATOR_MODE === 'true' || envVars.CLAUDE_CLI_NAME === 'claude-orchestrator') {
      // In orchestrator mode, clear certain environment variables to prevent loops
      envVars.CLAUDE_CLI_ORCHESTRATOR_PASSTHROUGH = 'false';
      envVars.MCP_CLAUDE_DEBUG = 'false';
      // Clear orchestrator-specific variables
      delete envVars.MCP_ORCHESTRATOR_MODE;
      delete envVars.CLAUDE_CLI_NAME;
    }
    
    // Use type annotation to avoid TypeScript errors
    const spawnOptions: any = { 
      shell: shellToUse,
      cwd,
      env: envVars
    };
    
    debugLog(`[TerminalManager] Executing command: ${command} with timeout ${timeoutMs}ms`);
    const childProcess = this.spawnFn(command, [], spawnOptions);
    let output = '';
    
    // Ensure childProcess.pid is defined before proceeding
    if (!childProcess.pid) {
      // Return a consistent error object instead of throwing
      return {
        pid: -1,  // Use -1 to indicate an error state
        output: 'Error: Failed to get process ID. The command could not be executed.',
        isBlocked: false
      };
    }
    
    const session: TerminalSession = {
      pid: childProcess.pid,
      process: childProcess,
      lastOutput: '',
      isBlocked: false,
      startTime: new this.dateConstructor()
    };
    
    this.sessions.set(childProcess.pid, session);
    debugLog(`[TerminalManager] Created new session with PID: ${childProcess.pid}`);

    return new Promise((resolve) => {
      childProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString('utf8'); // Explicitly set encoding
        output += text;
        // Apply buffer size limiting to prevent memory issues
        session.lastOutput = this.limitBufferSize(session.lastOutput + text);
        debugLog(`[TerminalManager] PID ${childProcess.pid} stdout: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      });

      childProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString('utf8'); // Explicitly set encoding
        output += text;
        // Apply buffer size limiting to prevent memory issues
        session.lastOutput = this.limitBufferSize(session.lastOutput + text);
        debugLog(`[TerminalManager] PID ${childProcess.pid} stderr: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      });

      const timeoutHandler = setTimeout(() => {
        session.isBlocked = true;
        debugLog(`[TerminalManager] Command timeout of ${timeoutMs}ms reached for PID ${childProcess.pid}`);
        resolve({
          pid: childProcess.pid!,
          output,
          isBlocked: true
        });
      }, timeoutMs);

      childProcess.on('exit', (code: number | null) => {
        clearTimeout(timeoutHandler);
        debugLog(`[TerminalManager] Process exited with code ${code} for PID ${childProcess.pid}`);
        
        if (childProcess.pid) {
          // Store completed session before removing active session
          // Limit the final output size
          const finalOutput = this.limitBufferSize(output + session.lastOutput);
          
          this.completedSessions.set(childProcess.pid, {
            pid: childProcess.pid,
            output: finalOutput,
            exitCode: code,
            startTime: session.startTime,
            endTime: new this.dateConstructor()
          });
          
          // Keep only the configured maximum number of completed sessions
          if (this.completedSessions.size > this.config.MAX_COMPLETED_SESSIONS) {
            // Find the oldest session by end time
            let oldestKey = -1;
            let oldestTime = Number.MAX_SAFE_INTEGER;
            
            for (const [pid, session] of this.completedSessions.entries()) {
              if (session.endTime.getTime() < oldestTime) {
                oldestTime = session.endTime.getTime();
                oldestKey = pid;
              }
            }
            
            if (oldestKey !== -1) {
              this.completedSessions.delete(oldestKey);
              debugLog(`[TerminalManager] Deleted oldest completed session PID ${oldestKey}`);
            }
          }
          
          this.sessions.delete(childProcess.pid);
        }
        
        resolve({
          pid: childProcess.pid!,
          output,
          isBlocked: false
        });
      });
    });
  }

  getNewOutput(pid: number): string | null {
    // First check active sessions
    const session = this.sessions.get(pid);
    if (session) {
      const output = session.lastOutput;
      session.lastOutput = '';
      debugLog(`[TerminalManager] Retrieved new output for active session PID ${pid}, length: ${output.length}`);
      return output || 'No new output available';
    }

    // Then check completed sessions
    const completedSession = this.completedSessions.get(pid);
    if (completedSession) {
      // Format completion message with exit code and runtime
      const runtime = (completedSession.endTime.getTime() - completedSession.startTime.getTime()) / 1000;
      debugLog(`[TerminalManager] Retrieved completed session PID ${pid}, runtime: ${runtime}s, exit code: ${completedSession.exitCode}`);
      return `Process completed with exit code ${completedSession.exitCode}\nRuntime: ${runtime.toFixed(1)}s\nFinal output:\n${completedSession.output}`;
    }

    debugLog(`[TerminalManager] No session found for PID ${pid}`);
    return null;
  }

  forceTerminate(pid: number): boolean {
    const session = this.sessions.get(pid);
    if (!session) {
      debugLog(`[TerminalManager] Cannot terminate: No active session found for PID ${pid}`);
      return false;
    }

    try {
      debugLog(`[TerminalManager] Sending SIGINT to PID ${pid}`);
      session.process.kill('SIGINT');
      
      // Use configurable timeout before sending SIGKILL
      setTimeout(() => {
        if (this.sessions.has(pid)) {
          debugLog(`[TerminalManager] Process still running after SIGINT, sending SIGKILL to PID ${pid}`);
          session.process.kill('SIGKILL');
        }
      }, this.config.SIGINT_TIMEOUT_MS);
      
      return true;
    } catch (error) {
      debugLog(`[TerminalManager] Error terminating PID ${pid}:`, error);
      return false;
    }
  }

  listActiveSessions(): ActiveSession[] {
    const now = new this.dateConstructor();
    const sessions = Array.from(this.sessions.values()).map(session => ({
      pid: session.pid,
      isBlocked: session.isBlocked,
      runtime: now.getTime() - session.startTime.getTime()
    }));
    
    debugLog(`[TerminalManager] Listed ${sessions.length} active sessions`);
    return sessions;
  }
  
  cleanupOldSessions(maxAgeMs: number = this.config.COMPLETED_SESSION_MAX_AGE_MS): void {
    const now = new this.dateConstructor();
    
    // Clean up completed sessions older than maxAgeMs
    for (const [pid, session] of this.completedSessions.entries()) {
      const age = now.getTime() - session.endTime.getTime();
      if (age > maxAgeMs) {
        this.completedSessions.delete(pid);
        debugLog(`[TerminalManager] Cleaned up completed session PID ${pid}, age: ${(age/1000).toFixed(0)}s`);
      }
    }
    
    // Check for and terminate any extremely long-running active sessions (24 hours+)
    const maxActiveSessionAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    for (const [pid, session] of this.sessions.entries()) {
      const age = now.getTime() - session.startTime.getTime();
      if (age > maxActiveSessionAge) {
        debugLog(`[TerminalManager] Force terminating long-running session PID ${pid}, age: ${(age/1000/60/60).toFixed(1)} hours`);
        this.forceTerminate(pid);
      }
    }
  }
}

export const terminalManager = new TerminalManager();