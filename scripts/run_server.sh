#!/bin/sh

echo "Starting server..."
while true; do npm run build && node ./dist/server.js /repository; done
