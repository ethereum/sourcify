#!/bin/sh

# Build ts
npm run build

# Wait until server is launched before running monitor
if [ -n "$TESTING" ]; then
  echo "Sleeping for 30s while localchain launches..."
  sleep 30
fi

node ./scripts/run_monitor.js
