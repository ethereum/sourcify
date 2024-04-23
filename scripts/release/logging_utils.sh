#!/bin/bash

# Define color codes
RED='\033[0;31m'
NC='\033[0m' # No Color
YELLOW='\033[0;33m'

# Function to print error message and exit
error_exit() {
  echo ""
  echo -e "${RED}$1${NC}"
  exit 1
}

warn() {
  echo ""
  echo -e "${YELLOW}$1${NC}"
}

prompt_execute_or_skip() {
  local operation=$1
  local function_to_execute=$2

  echo ""
  echo "Next: $operation. Continue (default: Y), or skip (N)?"
  read user_input
  if [[ $user_input == [nN] || $user_input == [nN][oO] ]]; then
    echo "Skipping $operation as per user request."
  else
    "$function_to_execute" "${@:3}" # Pass all additional arguments to the function
    echo "Success: $operation"
    echo ""
  fi
}
