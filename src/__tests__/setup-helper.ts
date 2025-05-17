import { vi } from 'vitest';

// Helper for setting up mocks consistently in tests
export function setupServerMocks() {
  // Mock path.isAbsolute
  vi.mock('path', () => {
    return {
      join: vi.fn((...parts) => parts.join('/')),
      resolve: vi.fn((p) => p),
      isAbsolute: vi.fn((p: string) => p.startsWith('/')),
      dirname: vi.fn((p) => p.substring(0, p.lastIndexOf('/'))),
    };
  });
  
  // Mock @modelcontextprotocol/sdk/server/index.js
  vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
    Server: vi.fn().mockImplementation(() => ({
      setRequestHandler: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      onerror: undefined,
    })),
  }));
  
  // Mock @modelcontextprotocol/sdk/types.js
  vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
    ListToolsRequestSchema: { name: 'listTools' },
    CallToolRequestSchema: { name: 'callTool' },
    ErrorCode: { 
      InternalError: 'InternalError',
      MethodNotFound: 'MethodNotFound'
    },
    McpError: vi.fn().mockImplementation((code, message) => {
      const error = new Error(message);
      (error as any).code = code;
      return error;
    }),
  }));
  
  // Clear any orchestrator-related environment variables
  delete process.env.CLAUDE_CLI_NAME;
  delete process.env.MCP_ORCHESTRATOR_MODE;
}

// Helper to prevent server instantiation
export function preventServerInstantiation() {
  // Replace ClaudeCodeServer with a function that doesn't actually create a server
  vi.mock('../server.js', () => {
    // Create a mock module with only the needed parts
    const mockModule = {
      debugLog: vi.fn(),
      findClaudeCli: vi.fn(() => '/mock/claude'),
      spawnAsync: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
      ClaudeCodeServer: class MockClaudeCodeServer {
        server: any;
        constructor() {
          this.server = { setRequestHandler: vi.fn() };
        }
        setupToolHandlers() {} // No-op
        run() { return Promise.resolve(); }
      }
    };
    return mockModule;
  });
}