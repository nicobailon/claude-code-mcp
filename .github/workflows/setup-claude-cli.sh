#!/bin/bash
# Setup a test Claude CLI for workflow testing

# Create a test bin directory for Claude CLI
mkdir -p /tmp/claude-bin

# Create a simple test Claude CLI script
cat > /tmp/claude-bin/claude << 'EOF'
#!/bin/bash
echo "Test Claude CLI called with: $@"
if [[ "$*" == *"error"* ]]; then
  exit 1
else
  exit 0
fi
EOF

# Make it executable
chmod +x /tmp/claude-bin/claude

# Add to PATH
echo "export PATH=/tmp/claude-bin:$PATH" >> $GITHUB_ENV

# Create the .claude/local directory
mkdir -p ~/.claude/local

# Output the location for debugging
echo "Test Claude CLI created at: /tmp/claude-bin/claude"