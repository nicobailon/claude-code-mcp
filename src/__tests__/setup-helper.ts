import { vi } from 'vitest';

// A simple and safe mock for path functions that doesn't rely on spread
function createPathMock() {
  return {
    join: vi.fn((...args: string[]) => args.join('/')),
    resolve: vi.fn((path: string) => path),
    isAbsolute: vi.fn((path: string) => path.startsWith('/')),
    dirname: vi.fn((path: string) => {
      const lastSlash = path.lastIndexOf('/');
      return lastSlash === -1 ? '.' : path.substring(0, lastSlash);
    })
  };
}

// A safe mock for the Server class
function createServerMock() {
  return {
    Server: vi.fn().mockImplementation(() => ({
      setRequestHandler: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      onerror: undefined
    }))
  };
}

// A safe mock for MCP error types
function createMcpErrorMock() {
  return {
    ListToolsRequestSchema: { name: 'listTools' },
    CallToolRequestSchema: { name: 'callTool' },
    ErrorCode: { 
      InternalError: 'InternalError',
      MethodNotFound: 'MethodNotFound'
    },
    McpError: vi.fn((code: string, message: string) => {
      const error = new Error(message);
      Object.defineProperty(error, 'code', { value: code });
      return error;
    })
  };
}

// Helper for setting up mocks consistently in tests
export function setupServerMocks(): void {
  // Apply mocks with safe implementations (no spreads or imports)
  vi.mock('path', () => createPathMock());
  vi.mock('@modelcontextprotocol/sdk/server/index.js', () => createServerMock());
  vi.mock('@modelcontextprotocol/sdk/types.js', () => createMcpErrorMock());
  
  // Clear any orchestrator-related environment variables
  if ('CLAUDE_CLI_NAME' in process.env) {
    delete process.env.CLAUDE_CLI_NAME;
  }
  if ('MCP_ORCHESTRATOR_MODE' in process.env) {
    delete process.env.MCP_ORCHESTRATOR_MODE;
  }
}

// Helper to create a mock for server.js
export function createServerJsMock() {
  return {
    // Basic functions
    debugLog: vi.fn(),
    findClaudeCli: vi.fn().mockReturnValue('/mock/claude'),
    spawnAsync: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    
    // Mock ClaudeCodeServer class
    ClaudeCodeServer: class MockServer {
      server: any;
      constructor() {
        this.server = { 
          setRequestHandler: vi.fn(),
          _requestHandlers: new Map()
        };
      }
      setupToolHandlers(): void {} 
      run(): Promise<void> { return Promise.resolve(); }
    }
  };
}

// Helper to prevent server instantiation
export function preventServerInstantiation(): void {
  vi.mock('../server.js', () => createServerJsMock());
}