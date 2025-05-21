#!/bin/bash
# Cleanup script for terminating stuck test mock processes
# Usage: ./scripts/cleanup-test-mocks.sh [--force]

force_flag=""
if [ "$1" == "--force" ]; then
  force_flag="--force"
fi

# Function to print colored output
print_colored() {
  local color="$1"
  local text="$2"
  
  case "$color" in
    "red") echo -e "\033[0;31m$text\033[0m" ;;
    "green") echo -e "\033[0;32m$text\033[0m" ;;
    "yellow") echo -e "\033[0;33m$text\033[0m" ;;
    "blue") echo -e "\033[0;34m$text\033[0m" ;;
    *) echo "$text" ;;
  esac
}

print_colored "blue" "=== Claude Code Test Mock Process Manager ==="
print_colored "blue" "Checking for any leftover test mock processes..."

# Check for mock processes
mock_processes=$(ps aux | grep "claude-code-test-mock/claudeMocked" | grep -v grep)

if [ -z "$mock_processes" ]; then
  print_colored "green" "No mock processes found. All clean!"
  exit 0
fi

# Count the processes
process_count=$(echo "$mock_processes" | wc -l)
print_colored "yellow" "Found $process_count mock processes that might be stuck:"
echo "$mock_processes"

# If not force mode, ask for confirmation
if [ "$force_flag" != "--force" ]; then
  read -p "Do you want to terminate these processes? (y/n): " confirm
  if [ "$confirm" != "y" ]; then
    print_colored "yellow" "Aborted. No processes were terminated."
    exit 0
  fi
fi

# Kill the processes
print_colored "yellow" "Terminating mock processes..."
pkill -f "claude-code-test-mock/claudeMocked"

# Verify termination
sleep 1
remaining_procs=$(ps aux | grep "claude-code-test-mock/claudeMocked" | grep -v grep)

if [ -z "$remaining_procs" ]; then
  print_colored "green" "✓ All mock processes have been terminated successfully."
else
  print_colored "red" "Warning: Some processes could not be terminated. Using SIGKILL..."
  pkill -9 -f "claude-code-test-mock/claudeMocked"
  
  sleep 1
  still_remaining=$(ps aux | grep "claude-code-test-mock/claudeMocked" | grep -v grep)
  
  if [ -z "$still_remaining" ]; then
    print_colored "green" "✓ All mock processes have been terminated successfully with SIGKILL."
  else
    print_colored "red" "Error: Failed to terminate all processes. Manual intervention required."
    echo "$still_remaining"
    exit 1
  fi
fi

print_colored "blue" "=== Cleanup Complete ==="