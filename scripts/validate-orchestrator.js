#!/usr/bin/env node
// Script to validate orchestrator features
const fs = require('fs');
const path = require('path');

console.log('🎭 Validating Orchestrator Implementation...');

// Check for orchestrator mode detection
const serverPath = path.join(__dirname, '../dist/server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

const checks = [
  {
    name: 'Orchestrator mode detection',
    test: () => serverContent.includes('CLAUDE_ORCHESTRATOR_MODE')
  },
  {
    name: 'Enhanced tool description',
    test: () => serverContent.includes('Orchestrator') && serverContent.includes('meta-agent')
  },
  {
    name: 'Extended input schema',
    test: () => serverContent.includes('orchestrationMode') && serverContent.includes('verificationSteps')
  },
  {
    name: 'Timeout management',
    test: () => serverContent.includes('customTimeout') && serverContent.includes('BASH_MAX_TIMEOUT_MS')
  }
];

let passed = 0;
checks.forEach(({ name, test }) => {
  const result = test();
  console.log(`${result ? '✅' : '❌'} ${name}`);
  if (result) passed++;
});

console.log(`\nValidation complete: ${passed}/${checks.length} checks passed`);
process.exit(passed === checks.length ? 0 : 1);