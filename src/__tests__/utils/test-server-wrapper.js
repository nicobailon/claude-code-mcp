#!/usr/bin/env node
/**
 * This is a wrapper script to run the server in test mode.
 * It loads the server module, runs it, and ensures it stays running.
 */

// Enable detailed debugging
process.env.MCP_CLAUDE_DEBUG = 'true';

// Get the server path from command line arguments
const serverPath = process.argv[2];
console.error(`[TestWrapper] Starting with server path: ${serverPath}`);

// Add basic error handling for uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
  console.error('[TestWrapper] UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[TestWrapper] UNHANDLED REJECTION:', reason);
});

// This is a simple delay function for async/await
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  try {
    // Absolute resolve path for server
    import('path').then(async (path) => {
      const absoluteServerPath = path.resolve(serverPath);
      console.error(`[TestWrapper] Absolute server path: ${absoluteServerPath}`);
      console.error(`[TestWrapper] Current working directory: ${process.cwd()}`);
      console.error(`[TestWrapper] NODE_PATH: ${process.env.NODE_PATH}`);
      console.error(`[TestWrapper] Trying server module import...`);
      
      try {
        // Dynamic import for ESM
        const serverModule = await import(absoluteServerPath);
        console.error(`[TestWrapper] Server module imported, keys: ${Object.keys(serverModule)}`);
        
        // Find either 'server' or 'ClaudeCodeServer' in the module
        let server;
        if (serverModule.server) {
          server = serverModule.server;
          console.error('[TestWrapper] Found server instance in module');
        } else if (serverModule.ClaudeCodeServer) {
          // Create a new instance if we have the class
          console.error('[TestWrapper] Found ClaudeCodeServer class, creating instance');
          server = new serverModule.ClaudeCodeServer();
        } else {
          console.error('[TestWrapper] ERROR: neither server nor ClaudeCodeServer found in module');
          console.error('[TestWrapper] Available exports:', Object.keys(serverModule));
          process.exit(1);
        }
        console.error(`[TestWrapper] Server object type: ${typeof server}`);
        console.error(`[TestWrapper] Server properties: ${Object.keys(server)}`);
        
        // Check if run method exists
        if (typeof server.run !== 'function') {
          console.error('[TestWrapper] ERROR: server.run is not a function');
          process.exit(1);
        }
        
        console.error('[TestWrapper] Starting server...');
        await server.run();
        console.error('[TestWrapper] Server started and connected.');

        // Keep the process running until terminated
        process.stdin.resume();
        
        process.on('SIGINT', async () => {
          console.error('[TestWrapper] Received SIGINT, shutting down...');
          try {
            if (server.server && typeof server.server.close === 'function') {
              await server.server.close();
            }
          } catch (err) {
            console.error('[TestWrapper] Error during shutdown:', err);
          }
          process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
          console.error('[TestWrapper] Received SIGTERM, shutting down...');
          try {
            if (server.server && typeof server.server.close === 'function') {
              await server.server.close();
            }
          } catch (err) {
            console.error('[TestWrapper] Error during shutdown:', err);
          }
          process.exit(0);
        });
      } catch (err) {
        console.error('[TestWrapper] Error importing or running server:', err);
        console.error('[TestWrapper] Error stack:', err.stack);
        process.exit(1);
      }
    }).catch(err => {
      console.error('[TestWrapper] Error importing path module:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('[TestWrapper] Error in main try block:', err);
    console.error('[TestWrapper] Error stack:', err.stack);
    process.exit(1);
  }
}

// Run main function
main().catch(err => {
  console.error('[TestWrapper] Uncaught error in main:', err);
  console.error('[TestWrapper] Error stack:', err.stack);
  process.exit(1);
});