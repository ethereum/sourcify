#!/bin/sh

echo "Starting server..."

# Build ts
npm run build

while true; do node ./dist/server.js /repository; done
