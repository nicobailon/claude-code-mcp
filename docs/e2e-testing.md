# End-to-End Testing for Claude Code MCP

This document explains how to run and maintain the end-to-end tests for the Claude Code MCP server.

## Overview

The e2e tests are designed to validate the Claude Code MCP server's functionality in real-world scenarios. Since the Claude CLI requires authentication and isn't easily installable in automated environments, the tests use a mock Claude CLI for automated testing and provide optional integration tests for local development.

## Test Structure

The e2e tests are organized into several files:

- `src/__tests__/e2e.test.ts` - Main e2e test suite with mock Claude CLI
- `src/__tests__/edge-cases.test.ts` - Edge case and error handling tests
- `src/__tests__/utils/mcp-client.ts` - Mock MCP client for testing
- `src/__tests__/utils/claude-mock.ts` - Mock Claude CLI implementation

## Running Tests

### Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run all tests (unit + e2e)
npm test

# Run only e2e tests with mocks
npm run test:e2e

# Run unit tests only
npm run test:unit
```

### Local Integration Testing

When Claude CLI is installed locally, you can run the full integration tests:

```bash
# Run all tests including integration tests
npm run test:e2e:local
```

The integration tests are marked with `.skip()` by default and will only run when you have Claude CLI installed and authenticated.

## Test Scenarios

### Basic Operations
- Tool registration and discovery
- Simple prompt execution
- Error handling
- Default working directory behavior
- Long-running task execution and management

### Working Directory Handling
- Custom working directory support
- Non-existent directory handling
- Permission errors

### Edge Cases
- Input validation (missing/invalid parameters)
- Special characters in prompts
- Concurrent request handling
- Large prompt handling
- Path traversal prevention
- Long-running task timeout behavior
- PID tracking and retrieval

### Integration Tests (Local Only)
- File creation with real Claude CLI
- Git operations
- Complex multi-step workflows

## Mock Claude CLI

The tests use a mock Claude CLI that simulates basic Claude behavior. The mock:

1. Creates a fake executable at `~/.claude/local/claude`
2. Responds to basic commands based on prompt patterns
3. Simulates errors for testing error handling

The mock is automatically set up before tests run and cleaned up afterwards.

## Writing New Tests

When adding new e2e tests:

1. Use the `MCPTestClient` for communicating with the server
2. Set up test directories in `beforeEach` and clean up in `afterEach`
3. Use descriptive test names that explain the scenario
4. Add appropriate assertions for both success and failure cases
5. For long-running task tests, use the `wait` parameter and check PID responses

Examples:

```typescript
// Testing standard synchronous behavior
it('should handle complex file operations', async () => {
  const response = await client.callTool('claude_code', {
    prompt: 'Create multiple files and organize them',
    workFolder: testDir,
    wait: true  // Default, but shown for clarity
  });

  expect(response).toBeTruthy();
  // Add specific assertions about the result
});

// Testing long-running task behavior
it('should start a long-running task and return PID', async () => {
  const response = await client.callTool('claude_code', {
    prompt: 'Run a task that takes a long time',
    workFolder: testDir,
    wait: false  // Run in background mode
  });

  // Check for PID in metadata
  expect(response.metadata).toBeDefined();
  expect(response.metadata.pid).toBeGreaterThan(0);
  expect(response.metadata.isRunning).toBe(true);
  
  // Check for initial output
  expect(response.content[0].text).toContain('started with PID');
});
```

## Debugging Tests

To debug e2e tests:

1. Enable debug mode by setting `MCP_CLAUDE_DEBUG=true`
2. Add console.log statements in test code
3. Use the VSCode debugger with the test runner
4. Check server stderr output for debug logs

## CI/CD Considerations

The e2e tests are designed to run in CI environments without Claude CLI:

- Mock tests run automatically in CI
- Integration tests are skipped unless explicitly enabled
- Tests use temporary directories to avoid conflicts
- All tests clean up after themselves

## Common Issues

### Tests Timing Out
- Increase timeout in `vitest.config.e2e.ts` or use the specialized configs (e.g., `vitest.config.edge.ts`)
- Check if the mock Claude CLI is set up correctly
- Verify the server is building properly
- For long-running tasks, ensure mocks properly simulate process events

### Mock Not Found
- Ensure the mock setup runs in `beforeAll`
- Check file permissions on the mock executable
- Verify the mock path matches the server's expectations

### Hung Mock Processes
Sometimes mock processes from tests may not terminate properly, leading to high CPU usage. To detect and fix this:

```bash
# Check for and interactively clean up mock processes
./scripts/cleanup-test-mocks.sh

# Force cleanup without prompting
./scripts/cleanup-test-mocks.sh --force
```

If you notice high CPU usage after running tests, this script can help identify and terminate any leftover mock processes.

### Integration Tests Failing
- Ensure Claude CLI is installed and authenticated
- Check that you're running the local test command
- Verify Claude CLI is accessible in your PATH

## Future Improvements

- Add performance benchmarking tests
- Implement stress testing scenarios
- Add tests for specific Claude Code features
- Create visual regression tests for output formatting
- Enhance long-running task testing with better mocking
- Add comprehensive test coverage for terminal management
- Implement test factories for consistent mock creation

## Testing Long-Running Tasks

The long-running tasks feature requires special testing considerations:

### Mock Implementation

To test long-running tasks effectively, we use a custom mock approach for the terminal manager:

```typescript
// Example mock setup for terminal manager
vi.mock('../terminal-manager.js', () => ({
  terminalManager: {
    executeCommand: vi.fn().mockImplementation(async (command, timeout) => {
      // Return a "blocked" result for testing
      return {
        pid: 1234,
        output: 'Initial mock output',
        isBlocked: true
      };
    }),
    getNewOutput: vi.fn().mockReturnValue('New mock output'),
    forceTerminate: vi.fn().mockReturnValue(true),
    listActiveSessions: vi.fn().mockReturnValue([{
      pid: 1234,
      isBlocked: true,
      runtime: 5000
    }])
  }
}));
```

### Testing the Full Workflow

To test the complete long-running task workflow:

1. Start a task with `wait=false`
2. Capture the PID from the response metadata
3. Call `read_output` with the PID to get updated output
4. Call `list_sessions` to verify the task is listed
5. Optionally call `force_terminate` to stop the task

```typescript
it('should support complete long-running task workflow', async () => {
  // 1. Start task
  const startResult = await client.callTool('claude_code', {
    prompt: 'run a long task',
    wait: false
  });
  
  const pid = startResult.metadata.pid;
  
  // 2. Poll for updates
  const outputResult = await client.callTool('read_output', { pid });
  expect(outputResult.content[0].text).toContain('New mock output');
  
  // 3. List sessions
  const sessionsResult = await client.callTool('list_sessions', {});
  expect(sessionsResult.content[0].text).toContain(String(pid));
  
  // 4. Terminate
  await client.callTool('force_terminate', { pid });
});
```

See `TEST_MIGRATION_NEXT_STEPS.md` for more detailed guidance on improving the test suite for long-running tasks.