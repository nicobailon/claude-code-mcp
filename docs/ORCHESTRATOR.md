# Claude Code Orchestrator Guide

## Overview
The Claude Code Orchestrator enables meta-agent workflows where Claude can plan and execute complex multi-step operations using natural language orchestration.

## Architecture
```
🎭 Orchestrator Env    →    ⚡ claude-code-mcp    →    🏠 Clean Execution
  (Planning)                  (Delegation)              (Task Execution)
```

## Key Features

1. **Natural Language Orchestration**: 
   - Express complex workflows through natural language instructions
   - No artificial parameters or constraints
   - Let Claude's intelligence handle task decomposition

2. **Environment Isolation**: 
   - Orchestrator runs with MCP tools and enhanced capabilities
   - Execution environments run clean without orchestration overhead
   - Prevents recursion loops with clear separation of concerns

3. **Timeout Management**: 
   - Extended timeouts for complex operations (up to 30 minutes)
   - Per-operation timeout customization
   - Default timeouts configurable via environment variables

4. **Intelligent Workflow Planning**: 
   - Automatic multi-step task decomposition
   - Appropriate execution patterns based on task requirements
   - Claude determines optimal execution strategy

5. **Error Recovery and Validation**: 
   - Built-in verification and validation based on instructions
   - Rollback capabilities for failed operations when described
   - Progress tracking and reporting

6. **Recursion Prevention**: 
   - Main environments can't spawn orchestrators
   - Clean delegation boundaries
   - Safe execution environment isolation

## Natural Language Orchestration Patterns

### Sequential Execution
Simply describe your steps in order, and the orchestrator will execute them sequentially:

```
"Please implement user authentication:
1. First, create the authentication service 
2. Then, add the login form components
3. Next, implement the user session management
4. Finally, add proper error handling and validation"
```

### Parallel Execution
Indicate tasks that can be performed in parallel through your description:

```
"Please update the API version across multiple repositories. 
You can work on these updates concurrently since they don't depend on each other:
- Update the version in the backend API
- Update the client libraries
- Update the documentation site"
```

### Conditional Execution
Specify conditions and validation requirements in natural language:

```
"Run the complete test suite and deploy to production ONLY if all tests pass. 
If any tests fail, fix the issues before attempting deployment."
```

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
| `prompt` | string | The orchestration prompt or task instruction (include all orchestration details here) |
| `workFolder` | string | Target directory for operations (required for file operations) |
| `timeout` | number | Custom timeout in milliseconds |

## Best Practices

1. **Natural Language Task Breakdown**
   - Use clear, detailed language to describe complex operations
   - Express workflow patterns directly in your instructions
   - Include specific validation and verification requirements in your prompts

2. **Task Clarity**
   - Break complex operations into smaller, atomic tasks through your descriptions
   - Each task should have clear success criteria explained in natural language
   - Provide specific validation instructions for critical operations

3. **Error Handling**
   - Include recovery strategies for critical tasks in your prompt
   - Describe fallback approaches for error-prone operations
   - Express conditional execution requirements in plain language

4. **Timeout Management**
   - Set appropriate timeouts based on task complexity
   - Allocate more time for operations with external dependencies
   - Consider network latency and service response times

5. **Path and Context Clarity**
   - Always provide absolute paths for file operations
   - Include clear context in your orchestration prompts
   - Specify required environment details

6. **Resource Management**
   - Limit concurrent operations by specifying dependencies in your instructions
   - Request cleanup of temporary resources after task completion
   - Be mindful of system resource usage during execution

## Troubleshooting

### Common Issues

1. **Timeout Errors**
   - Increase the timeout for the specific operation
   - Break down the task into smaller steps in your prompt
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
   - Make your instructions clear and specific
   - Include all necessary context in your prompt
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
- Orchestration processing

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
   - Sensitive operations should include proper verification steps

## Examples

### Complete Development Workflow

```json
{
  "prompt": "For the project at /path/to/my-app:\n1. Create a new feature branch called 'user-profile'\n2. Implement a user profile component with proper validation\n3. Add comprehensive tests for the component\n4. Ensure all tests pass before proceeding\n5. Create a PR with appropriate description\n\nBreak this down into logical steps and validate each step before moving to the next.",
  "workFolder": "/path/to/my-app",
  "timeout": 1200000
}
```

### Cross-Repository Coordination

```json
{
  "prompt": "Update API version from 1.0 to 2.0 across multiple repositories:\n- Backend API definitions\n- Frontend client code\n- Documentation site\n- Integration tests\n\nYou can work on these updates in parallel since they don't depend on each other. After all updates are complete, run integration tests to ensure everything works together properly.",
  "workFolder": "/path/to/project-root",
  "timeout": 900000
}
```

### Infrastructure Setup

```json
{
  "prompt": "Set up a new microservice project following these steps in sequence:\n1. Initialize repository with proper structure\n2. Set up Docker configuration\n3. Create GitHub Actions for CI/CD\n4. Configure linting and testing\n5. Add comprehensive documentation\n\nAfter each step, verify that it works correctly before proceeding to the next step. If any step fails, fix the issues before continuing.",
  "workFolder": "/path/to/new-project",
  "timeout": 1800000
}
```