#!/bin/sh

echo "Starting server..."
while true; do node ./server.js /repository; done
