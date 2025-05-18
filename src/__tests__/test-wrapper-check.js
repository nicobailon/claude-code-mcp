#!/usr/bin/env node
/**
 * This is a test script to verify our wrapper can start the server correctly.
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get current script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the server
const serverPath = join(__dirname, '..', '..', 'dist', 'server.js');
console.log(`Server path: ${serverPath}`);

// Path to the wrapper
const wrapperPath = join(__dirname, 'utils', 'test-server-wrapper.js');
console.log(`Wrapper path: ${wrapperPath}`);

// Run the wrapper
const wrapper = spawn('node', [wrapperPath, serverPath], {
  stdio: 'inherit' // Show output directly in the console
});

// Wait for the wrapper to exit
wrapper.on('exit', (code, signal) => {
  console.log(`Wrapper exited with code ${code}, signal ${signal}`);
  process.exit(code || 0);
});

// Handle keyboard interrupt
process.on('SIGINT', () => {
  console.log('Received SIGINT, terminating wrapper');
  wrapper.kill('SIGINT');
});