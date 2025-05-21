import { spawn, ChildProcess } from 'child_process';
import { DEFAULT_COMMAND_TIMEOUT } from './config.js';
import { configManager } from './config.js';
import { TerminalSession, CompletedSession, CommandExecutionResult, ActiveSession } from './types.js';
import { debugLog } from './server.js';

export class TerminalManager {
  private sessions: Map<number, TerminalSession> = new Map();
  private completedSessions: Map<number, CompletedSession> = new Map();
  
  async executeCommand(
    command: string, 
    timeoutMs: number = DEFAULT_COMMAND_TIMEOUT, 
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
      }
    }
    
    const spawnOptions = { 
      shell: shellToUse,
      cwd
    };
    
    debugLog(`[TerminalManager] Executing command: ${command} with timeout ${timeoutMs}ms`);
    const process = spawn(command, [], spawnOptions);
    let output = '';
    
    // Ensure process.pid is defined before proceeding
    if (!process.pid) {
      // Return a consistent error object instead of throwing
      return {
        pid: -1,  // Use -1 to indicate an error state
        output: 'Error: Failed to get process ID. The command could not be executed.',
        isBlocked: false
      };
    }
    
    const session: TerminalSession = {
      pid: process.pid,
      process,
      lastOutput: '',
      isBlocked: false,
      startTime: new Date()
    };
    
    this.sessions.set(process.pid, session);
    debugLog(`[TerminalManager] Created new session with PID: ${process.pid}`);

    return new Promise((resolve) => {
      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        session.lastOutput += text;
        debugLog(`[TerminalManager] PID ${process.pid} stdout: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      });

      process.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        session.lastOutput += text;
        debugLog(`[TerminalManager] PID ${process.pid} stderr: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      });

      const timeoutHandler = setTimeout(() => {
        session.isBlocked = true;
        debugLog(`[TerminalManager] Command timeout of ${timeoutMs}ms reached for PID ${process.pid}`);
        resolve({
          pid: process.pid!,
          output,
          isBlocked: true
        });
      }, timeoutMs);

      process.on('exit', (code) => {
        clearTimeout(timeoutHandler);
        debugLog(`[TerminalManager] Process exited with code ${code} for PID ${process.pid}`);
        
        if (process.pid) {
          // Store completed session before removing active session
          this.completedSessions.set(process.pid, {
            pid: process.pid,
            output: output + session.lastOutput, // Combine all output
            exitCode: code,
            startTime: session.startTime,
            endTime: new Date()
          });
          
          // Keep only last 100 completed sessions
          if (this.completedSessions.size > 100) {
            const oldestKey = Array.from(this.completedSessions.keys())[0];
            this.completedSessions.delete(oldestKey);
          }
          
          this.sessions.delete(process.pid);
        }
        
        resolve({
          pid: process.pid!,
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
      
      setTimeout(() => {
        if (this.sessions.has(pid)) {
          debugLog(`[TerminalManager] Process still running after SIGINT, sending SIGKILL to PID ${pid}`);
          session.process.kill('SIGKILL');
        }
      }, 1000);
      
      return true;
    } catch (error) {
      debugLog(`[TerminalManager] Error terminating PID ${pid}:`, error);
      return false;
    }
  }

  listActiveSessions(): ActiveSession[] {
    const now = new Date();
    const sessions = Array.from(this.sessions.values()).map(session => ({
      pid: session.pid,
      isBlocked: session.isBlocked,
      runtime: now.getTime() - session.startTime.getTime()
    }));
    
    debugLog(`[TerminalManager] Listed ${sessions.length} active sessions`);
    return sessions;
  }
  
  cleanupOldSessions(maxAgeMs: number = 3600000): void { // Default 1 hour
    const now = new Date();
    
    // Clean up completed sessions older than maxAgeMs
    for (const [pid, session] of this.completedSessions.entries()) {
      const age = now.getTime() - session.endTime.getTime();
      if (age > maxAgeMs) {
        this.completedSessions.delete(pid);
        debugLog(`[TerminalManager] Cleaned up completed session PID ${pid}, age: ${(age/1000).toFixed(0)}s`);
      }
    }
  }
}

export const terminalManager = new TerminalManager();