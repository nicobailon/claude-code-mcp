import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

/**
 * Create a helper Claude CLI in PATH for tests 
 * This helps avoid the warnings that Claude CLI is not found
 */
export function ensureTestClaude(): string {
  // Create a directory in the test temp folder that's in PATH
  const testBinDir = path.join('/tmp', 'claude-code-test-bin');
  if (!fs.existsSync(testBinDir)) {
    fs.mkdirSync(testBinDir, { recursive: true });
  }

  // Create a simple claudeTest script
  const claudeScriptPath = path.join(testBinDir, 'claude');
  
  // Only create if it doesn't exist
  if (!fs.existsSync(claudeScriptPath)) {
    const script = `#!/bin/bash
echo "Test Claude CLI executed successfully"
exit 0
`;
    fs.writeFileSync(claudeScriptPath, script);
    fs.chmodSync(claudeScriptPath, 0o755);
  }

  // Add to PATH
  if (!process.env.PATH?.includes(testBinDir)) {
    process.env.PATH = `${testBinDir}:${process.env.PATH}`;
  }

  // Ensure ~/.claude/local/ directory exists for tests
  const localClaudeDir = path.join(homedir(), '.claude', 'local');
  if (!fs.existsSync(localClaudeDir)) {
    fs.mkdirSync(localClaudeDir, { recursive: true });
  }

  return claudeScriptPath;
}