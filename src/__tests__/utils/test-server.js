#!/usr/bin/env node

/**
 * Simple test server that stays alive for integration tests
 */

if (!process.env.VITEST) {
  process.exit(1);
}

// Import and run the actual server
import { ClaudeCodeServer } from '../../server.js';

const server = new ClaudeCodeServer();

server.run().then(() => {
  console.error('Test server started');
  // Keep the process alive for testing
  process.stdin.resume();
  
  // Handle shutdown signals
  process.on('SIGINT', async () => {
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    process.exit(0);
  });
}).catch(error => {
  console.error('Failed to start test server:', error);
  process.exit(1);
});