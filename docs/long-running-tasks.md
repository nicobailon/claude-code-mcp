# Long-Running Tasks in claude-code-mcp

This guide explains how to use the PID-based long-running task system in claude-code-mcp.

## Overview

The `claude-code-mcp` server now includes support for tasks that take longer than the typical timeout period (which is often just a few seconds in client applications). This enables:

1. Non-blocking command execution that continues after client timeouts
2. PID-based tracking for both active and completed commands
3. The ability to retrieve results even after the initial request completes
4. Tools for listing, monitoring, and terminating long-running processes

## Available Tools

The following new tools have been added to support long-running tasks:

### 1. `execute_command`

Starts a command and returns with a PID rather than waiting for completion.

**Parameters:**
- `command` (string, required): The command to execute
- `timeout_ms` (number, optional): Time to wait for initial output before returning
- `shell` (string, optional): Specify shell to use (defaults to system default)
- `cwd` (string, optional): The working directory for command execution
- `wait` (boolean, optional): Whether to wait for completion (defaults to true)

**Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "Command started with PID 1234\nInitial output:\n[output]\n\nCommand is still running. Use read_output to get more output."
  }],
  "metadata": {
    "pid": 1234,
    "isRunning": true,
    "startTime": "2025-05-20T10:30:00.000Z"
  }
}
```

### 2. `read_output`

Gets any new output since the last call for a specific PID.

**Parameters:**
- `pid` (number, required): Process ID to get output from

**Response for active process:**
```json
{
  "content": [{
    "type": "text",
    "text": "[New output since last read]"
  }],
  "metadata": {
    "pid": 1234,
    "isRunning": true,
    "runtime": 15
  }
}
```

**Response for completed process:**
```json
{
  "content": [{
    "type": "text",
    "text": "Process completed with exit code 0\nRuntime: 25.3s\nFinal output:\n[output]"
  }],
  "metadata": {
    "pid": 1234,
    "isRunning": false
  }
}
```

### 3. `force_terminate`

Stops a running process by PID.

**Parameters:**
- `pid` (number, required): Process ID to terminate

**Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "Successfully initiated termination of session 1234"
  }],
  "metadata": {
    "pid": 1234,
    "isRunning": false
  }
}
```

### 4. `list_sessions`

Lists all active sessions with PIDs and runtimes.

**Parameters:** None

**Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "PID: 1234, Running: Yes, Runtime: 15s\nPID: 5678, Running: Yes, Runtime: 5s"
  }]
}
```

### 5. Enhanced `claude_code`

The `claude_code` tool now accepts an additional parameter:

**New Parameter:**
- `wait` (boolean, optional): Whether to wait for the command to complete. Defaults to `true` for backward compatibility. Set to `false` to run in the background.

## Using the System Effectively

### 1. Starting a Long-Running Task

For tasks that might take a while, use the `wait=false` parameter:

```javascript
claude_code({
  prompt: "Install all npm dependencies and run tests",
  workFolder: "/path/to/project",
  wait: false
})
```

Or use the dedicated tool:

```javascript
execute_command({
  command: "npm install && npm test",
  timeout_ms: 5000, // Wait 5 seconds for initial output
  cwd: "/path/to/project", // Specify working directory
  wait: false
})
```

### 2. Polling for Results

To check on the progress of a running task:

```javascript
read_output({
  pid: 1234
})
```

It's good practice to add some interpretation of the output when showing it to users.

### 3. Managing Active Tasks

To see all running tasks:

```javascript
list_sessions()
```

To stop a running task:

```javascript
force_terminate({
  pid: 1234
})
```

### 4. Best Practices

- Always inform users when starting a long-running task in background mode
- Poll periodically but not too frequently (every few seconds is usually sufficient)
- Offer to terminate tasks that are taking longer than expected
- Store PIDs in your conversation context to track multiple concurrent tasks
- Clean up (terminate) tasks that are no longer needed

## Security Considerations

The `execute_command` tool runs shell commands with the same privileges as the Claude Code MCP server itself. For security reasons:

1. **Command Validation**: By default, commands are validated against an allowlist of permitted commands.
   - Only commands that start with entries in the allowlist will be executed
   - This helps prevent arbitrary code execution exploits

2. **Configuring the Allowlist**:
   - The default allowlist includes common safe commands (ls, git status, npm run, etc.)
   - **Important**: Setting `ALLOWED_COMMANDS` completely replaces the default list - it does not append to it
   - To use custom commands while keeping defaults, explicitly include both in your comma-separated list
   - For unrestricted command execution (USE WITH CAUTION), set `ALLOW_ALL_COMMANDS=true`

3. **Security Implications**:
   - Remember that long-running commands continue to run with the same privileges, even after clients disconnect
   - Extremely long-running sessions (24+ hours) are automatically terminated as a safety measure
   - Always validate user input before passing it to the `execute_command` tool

## Configuration Options

The following environment variables can be used to configure the long-running task system:

| Environment Variable | Default Value | Description |
|----------------------|---------------|-------------|
| `DEFAULT_COMMAND_TIMEOUT` | 30000 | Default timeout (ms) for commands |
| `DEFAULT_CLAUDE_TIMEOUT` | 1800000 | Default timeout (ms) for claude_code (30 min) |
| `MAX_COMPLETED_SESSIONS` | 100 | Maximum number of completed sessions to keep |
| `COMPLETED_SESSION_MAX_AGE_MS` | 3600000 | Time (ms) to keep completed sessions (1 hour) |
| `SIGINT_TIMEOUT_MS` | 1000 | Time (ms) to wait before SIGKILL after SIGINT |
| `CLEANUP_INTERVAL_MS` | 600000 | Time (ms) between cleanup runs (10 min) |
| `MAX_OUTPUT_BUFFER_SIZE` | 1048576 | Maximum size (bytes) of output buffer (1MB) |
| `ALLOWED_COMMANDS` | (see config.ts) | Comma-separated list of allowed commands |
| `ALLOW_ALL_COMMANDS` | false | Set to 'true' to bypass command validation |

## Troubleshooting

### Common Issues and Solutions

1. **Command Not Allowed**
   - **Error**: "Command not allowed for security reasons"
   - **Solution**: Use an allowed command or configure the `ALLOWED_COMMANDS` environment variable

2. **No Session Found**
   - **Error**: "No session found for PID X"
   - **Solution**: The session may have expired. Sessions are cleaned up after 1 hour of inactivity.

3. **Output Truncated**
   - **Issue**: "[Output truncated due to size limits...]" appears in output
   - **Solution**: The output has exceeded the buffer size limit (default 1MB). Increase `MAX_OUTPUT_BUFFER_SIZE` if needed.

4. **Process Never Completes**
   - **Issue**: A long-running task continues indefinitely
   - **Solution**: Use `force_terminate` to stop the process, or wait for the automatic cleanup (24+ hours)

## Session Management Details

- Completed sessions are stored for 1 hour (configurable via `COMPLETED_SESSION_MAX_AGE_MS`)
- A maximum of `MAX_COMPLETED_SESSIONS` (default: 100) completed sessions are kept in memory
- Active sessions are maintained until they complete or are forcefully terminated
- Sessions with excessive output will have their oldest output truncated to prevent memory issues

## Implementation Notes

This system is implemented using:

1. A `TerminalManager` class that tracks processes by PID
2. Separate maps for active and completed sessions
3. Automatic cleanup to prevent memory leaks
4. Graceful termination with SIGINT followed by SIGKILL if needed
5. Buffer size limiting to prevent memory issues with large outputs
6. Command validation to prevent security issues