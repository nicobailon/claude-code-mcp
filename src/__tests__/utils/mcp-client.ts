import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Mock MCP client for testing the server
 */
export class MCPTestClient extends EventEmitter {
  private server: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (response: MCPResponse) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = '';
  public stderrOutput = '';
  private serverReady = false;
  private serverReadyResolve?: () => void;
  private serverReadyReject?: (reason?: any) => void;

  constructor(private serverPath: string, private env: Record<string, string> = {}) {
    super();
  }

  async connect(): Promise<void> {
    this.serverReady = false;
    return new Promise((resolve, reject) => {
      this.serverReadyResolve = resolve;
      this.serverReadyReject = reject;

      // Timeout for server readiness
      const readinessTimeout = setTimeout(() => {
        if (!this.serverReady) {
          console.error('MCPTestClient: Server readiness timeout.');
          this.serverReadyReject?.(new Error('Server did not become ready in time'));
        }
      }, 15000); // 15 seconds for server to become ready

      const { dirname, join } = require('path');
      
      // Get the path to the wrapper script relative to this file
      const wrapperPath = join(dirname(__filename), 'test-server-wrapper.js');
      console.log(`MCPTestClient: Using wrapper at ${wrapperPath}`);
      
      // Start the server via the wrapper script
      this.server = spawn('node', [wrapperPath, this.serverPath], {
        env: { ...process.env, ...this.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      console.log(`MCPTestClient: Server process started with PID ${this.server.pid}`);

      this.server.stdout?.on('data', (data) => {
        this.handleData(data.toString());
      });

      this.server.stderr?.on('data', (data) => {
        const output = data.toString();
        this.stderrOutput += output;
        console.error('Server stderr:', output); // Keep this for debugging
        
        // Check if the server has started
        if (output.includes('[TestWrapper] Server started and connected')) {
          console.log('MCPTestClient: Detected server ready message');
          // Once we see this message, try a ping
          setTimeout(() => this.checkServerReady(readinessTimeout), 300);
        }
      });

      this.server.on('error', (error) => {
        console.error('MCPTestClient: Server process error.', error);
        if (!this.serverReady) {
          clearTimeout(readinessTimeout);
          this.serverReadyReject?.(error);
        }
        this.emit('error', error); // Emit for any other listeners
      });

      this.server.on('exit', (code, signal) => {
        console.log(`MCPTestClient: Server process exited with code ${code}, signal ${signal}.`);
        if (!this.serverReady && this.serverReadyReject) { // If exited before ready
            clearTimeout(readinessTimeout);
            this.serverReadyReject(new Error(`Server process exited prematurely with code ${code}, signal ${signal}`));
        }
        // Reset ready state for potential reconnects, though typically a new client instance is made
        this.serverReady = false;
      });
    });
  }
  
  /**
   * Helper method to check if the server is ready by sending a ping
   */
  private checkServerReady(readinessTimeout: NodeJS.Timeout): void {
    console.log('MCPTestClient: Attempting to ping server to check readiness...');
    // Attempt a tool list call to see if the server is responding
    this.sendRequest('tools/list')
      .then(() => {
        console.log('MCPTestClient: Server is ready (received tools/list response)');
        if (!this.serverReady) {
          this.serverReady = true;
          clearTimeout(readinessTimeout);
          this.serverReadyResolve?.();
        }
      })
      .catch(err => {
        console.error('MCPTestClient: Error pinging server:', err);
        // Try again after a short delay
        setTimeout(() => this.checkServerReady(readinessTimeout), 500);
      });
  }

  async disconnect(): Promise<void> {
    // Clean up readiness promise state
    this.serverReadyResolve = undefined;
    this.serverReadyReject = undefined;
    this.serverReady = false; // Reset ready state

    if (this.server) {
      const serverProcess = this.server;
      this.server = null; // Nullify early to prevent race conditions

      return new Promise((resolve) => {
        // Ensure there's a PID to kill
        if (!serverProcess.pid || serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
          console.log(`MCPTestClient: Server process ${serverProcess.pid} already exited or no PID.`);
          resolve();
          return;
        }

        const pid = serverProcess.pid; // Capture pid in case serverProcess becomes unavailable

        // Attempt graceful exit first
        console.log(`MCPTestClient: Sending SIGTERM to server process ${pid}.`);
        serverProcess.kill('SIGTERM');

        const timeout = setTimeout(() => {
          console.warn(`MCPTestClient: Server process ${pid} did not exit gracefully after SIGTERM, sending SIGKILL.`);
          // Check if the process is still running before sending SIGKILL
          try {
            if (serverProcess.pid && serverProcess.exitCode === null && serverProcess.signalCode === null) { // Check if still running
              process.kill(pid, 'SIGKILL'); 
            } else {
              console.log(`MCPTestClient: Process ${pid} already exited before SIGKILL.`);
            }
          } catch (e: any) {
            // Process already exited or error checking, log it
            console.log(`MCPTestClient: Error sending SIGKILL or process ${pid} already exited:`, e.message);
          }
        }, 5000); // 5 seconds to exit gracefully

        serverProcess.on('exit', (code, signal) => {
          clearTimeout(timeout);
          console.log(`MCPTestClient: Server process ${pid} exited with code ${code} and signal ${signal}.`);
          resolve();
        });

        // Handle cases where the process might have already exited by the time 'exit' listener is attached
        if (serverProcess.killed || serverProcess.exitCode !== null) {
          clearTimeout(timeout);
          console.log(`MCPTestClient: Server process ${pid} was already killed or exited when disconnect was processed.`);
          resolve();
        }
      });
    }
    // If no server was set, resolve immediately
    return Promise.resolve();
  }

  private handleData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        if (response.id && this.pendingRequests.has(response.id)) {
          const pending = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        } else {
          this.emit('notification', response);
        }
      } catch (error) {
        console.error('Failed to parse response:', line, error);
      }
    }
  }

  async sendRequest(method: string, params?: any): Promise<any> {
    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.server?.stdin?.write(JSON.stringify(request) + '\n');
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${id} timed out`));
        }
      }, 30000);
    });
  }

  async callTool(name: string, args: any): Promise<any> {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }
    
    return response.result?.content;
  }

  async listTools(): Promise<any> {
    const response = await this.sendRequest('tools/list');
    return response.result?.tools || [];
  }
}