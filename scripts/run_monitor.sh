#!/bin/sh

# Build ts
npm run build

while true; do node ./run_monitor.js; done
