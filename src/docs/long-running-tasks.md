# Long-Running Task System for Claude Code

Claude Code now supports long-running tasks that can continue executing even after the initial client timeout. This document explains how to use this feature effectively.

## Basic Commands

1. **Start a Long-Running Task**:
   ```
   claude_code(prompt="your prompt here", wait=false)
   ```
   or
   ```
   execute_command(command="your command here", wait=false)
   ```
   This returns a PID and initial output, then continues in the background.

2. **Check Task Progress**:
   ```
   read_output(pid=1234)
   ```
   Returns any new output since the last check and status information.

3. **Terminate a Task**:
   ```
   force_terminate(pid=1234)
   ```
   Stops a running task.

4. **List Active Tasks**:
   ```
   list_sessions()
   ```
   Shows all running tasks with PIDs, status, and runtime.

## Usage Pattern

For tasks that may take longer than a few seconds:

1. **Start the task in the background**:
   ```
   I'll run this command in the background so we can track its progress.
   
   [execute_command with wait=false]
   
   The command is now running with PID [X]. Let me check its progress periodically.
   ```

2. **Poll for updates**:
   ```
   Let me check on the status of our command:
   
   [read_output]
   
   [Provide interpretation of current output]
   ```

3. **Handle completion**:
   ```
   Great! The command has completed. Here are the results:
   
   [Show final output]
   ```

## Tips

- For simple, quick commands, you can still use the blocking approach (wait=true)
- If a task is taking too long, offer the user the option to terminate it
- When checking progress, interpret partial results to keep the user informed
- If you lose track of a PID, use list_sessions() to recover it
- You can set a custom timeout with timeout_ms parameter (in milliseconds)
- By default, completed session information is kept for 1 hour

## Security Considerations

The `execute_command` tool runs commands with the same privileges as the Claude Code MCP server. For security reasons:

1. All commands are validated against an allowlist of permitted commands
2. To add custom commands to the allowlist, set the `ALLOWED_COMMANDS` environment variable as a comma-separated list
3. For unrestricted command execution (USE WITH CAUTION), set `ALLOW_ALL_COMMANDS=true`

Remember that any long-running commands will continue to run with the same privileges, even after the user disconnects.