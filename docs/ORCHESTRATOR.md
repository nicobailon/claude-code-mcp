# Claude Code Orchestrator Guide

## Overview
The Claude Code Orchestrator enables meta-agent workflows where Claude can plan and execute complex multi-step operations by delegating tasks to clean Claude Code instances.

## Architecture
```
🎭 Orchestrator Env    →    ⚡ claude-code-mcp    →    🏠 Clean Execution
  (Planning)                  (Delegation)              (Task Execution)
```

## Key Features

1. **Environment Isolation**: 
   - Orchestrator runs with MCP tools and enhanced capabilities
   - Execution environments run clean without orchestration overhead
   - Prevents recursion loops with clear separation of concerns

2. **Timeout Management**: 
   - Extended timeouts for complex operations (up to 30 minutes)
   - Per-operation timeout customization
   - Default timeouts configurable via environment variables

3. **Workflow Planning**: 
   - Multi-step task decomposition
   - Sequential and parallel execution patterns
   - Conditional execution based on operation success

4. **Error Recovery**: 
   - Built-in verification and validation
   - Rollback capabilities for failed operations
   - Progress tracking and reporting

5. **Recursion Prevention**: 
   - Main environments can't spawn orchestrators
   - Clean delegation boundaries
   - Safe execution environment isolation

## Usage Patterns

### Sequential Execution (Default)
```
"orchestrationMode": "sequential"
```
Tasks are executed one after another, with each task depending on the success of the previous task. This is the default mode and is suitable for most workflows.

Example:
```json
{
  "prompt": "Setup new React project, add TypeScript support, and create basic components",
  "workFolder": "/path/to/project",
  "orchestrationMode": "sequential"
}
```

### Parallel Execution
```
"orchestrationMode": "parallel"
```
Tasks that don't depend on each other are executed simultaneously. This is useful for operations that can be performed independently, such as working with multiple repositories or running tests across different services.

Example:
```json
{
  "prompt": "Update the API version in both frontend and backend repositories",
  "workFolder": "/path/to/main-project",
  "orchestrationMode": "parallel"
}
```

### Conditional Execution
```
"orchestrationMode": "conditional"
```
Tasks are executed based on conditions and validation checks. This is useful for workflows where certain steps should only be executed if previous steps meet specific criteria.

Example:
```json
{
  "prompt": "Run tests and deploy to production only if all tests pass",
  "workFolder": "/path/to/project",
  "orchestrationMode": "conditional",
  "verificationSteps": true
}
```

## Verification and Validation

For critical operations, you can enable automatic verification steps:

```json
{
  "prompt": "Database migration for production",
  "workFolder": "/path/to/project",
  "verificationSteps": true
}
```

When enabled, the orchestrator will:
1. Execute small test operations before major changes
2. Validate results after each major step
3. Include rollback steps in the execution plan
4. Perform additional safety checks

## Delegation Format

When the orchestrator needs to break down complex tasks into smaller steps, it follows this delegation format:

```
Your work folder is /absolute/path/to/project

[Atomic task with clear success criteria]
```

Each delegated task:
- Runs in a clean environment without orchestration tools
- Is self-contained with clear success criteria
- Returns well-defined results to the orchestrator
- Is executed with appropriate permissions

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_ORCHESTRATOR_MODE` | Enables orchestrator mode | `false` |
| `BASH_MAX_TIMEOUT_MS` | Maximum timeout for operations | `1800000` (30 minutes) |
| `BASH_DEFAULT_TIMEOUT_MS` | Default timeout for operations | `300000` (5 minutes) |

### Tool Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | The orchestration prompt or task instruction |
| `workFolder` | string | Target directory for operations (required for file operations) |
| `orchestrationMode` | string | Execution pattern: `sequential`, `parallel`, or `conditional` |
| `timeout` | number | Custom timeout in milliseconds |
| `verificationSteps` | boolean | Enable validation after major operations |

## Best Practices

1. **Atomic Tasks**
   - Break complex operations into smaller, atomic tasks
   - Each task should have clear success criteria
   - Provide specific validation steps for critical operations

2. **Error Handling**
   - Include recovery strategies for critical tasks
   - Define fallback approaches for error-prone operations
   - Use conditional execution for risky operations

3. **Timeout Management**
   - Set appropriate timeouts based on task complexity
   - Allocate more time for operations with external dependencies
   - Consider network latency and service response times

4. **Path and Context Clarity**
   - Always provide absolute paths for file operations
   - Include clear context in delegation prompts
   - Specify required environment details

5. **Resource Management**
   - Limit parallel operations to prevent resource contention
   - Clean up temporary resources after task completion
   - Be mindful of system resource usage during execution

## Troubleshooting

### Common Issues

1. **Timeout Errors**
   - Increase the timeout for the specific operation
   - Break down the task into smaller steps
   - Check for external dependencies that might cause delays

2. **File Operation Failures**
   - Verify the workFolder path is correct and accessible
   - Check file permissions and ownership
   - Ensure the path exists before attempting operations

3. **Environment Isolation Problems**
   - Verify orchestrator mode is properly enabled
   - Check for environment variable conflicts
   - Ensure clean delegation boundaries

4. **Task Delegation Errors**
   - Make delegation prompts clear and specific
   - Include all necessary context for the delegated task
   - Specify success criteria clearly

### Logs and Debugging

To enable debug logs:

```bash
export MCP_CLAUDE_DEBUG=true
```

This will provide detailed information about:
- Task delegation and execution
- Command timeouts and failures
- Environment setup and configuration
- Orchestration directives processing

## Security Considerations

1. **Permission Model**
   - The orchestrator still respects the same permission model as regular Claude Code
   - No additional permissions are granted beyond what Claude Code normally has
   - All operations run with the user's permissions

2. **Environment Isolation**
   - Each delegated task runs in an isolated environment
   - The orchestrator cannot interfere with running delegated tasks
   - Clean separation between planning and execution contexts

3. **Resource Limits**
   - Hard timeouts prevent indefinite execution
   - Resource-intensive operations should be broken down
   - Sequential execution is recommended for sensitive operations

## Examples

### Complete Development Workflow

```json
{
  "prompt": "For the project at /path/to/my-app:\n1. Create a new feature branch called 'user-profile'\n2. Implement a user profile component\n3. Add tests for the component\n4. Create a PR with appropriate description",
  "workFolder": "/path/to/my-app",
  "orchestrationMode": "sequential",
  "verificationSteps": true
}
```

### Cross-Repository Coordination

```json
{
  "prompt": "Update API version from 1.0 to 2.0 in:\n- Backend API definitions\n- Frontend client code\n- Documentation site\n- Integration tests\nEnsure all changes are compatible.",
  "workFolder": "/path/to/project-root",
  "orchestrationMode": "sequential"
}
```

### Infrastructure Setup

```json
{
  "prompt": "Set up a new microservice project:\n1. Initialize repository with proper structure\n2. Set up Docker configuration\n3. Create GitHub Actions for CI/CD\n4. Configure linting and testing\n5. Add comprehensive documentation",
  "workFolder": "/path/to/new-project",
  "timeout": 900000
}
```