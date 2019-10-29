#!/bin/sh

echo "Starting up..."
node ./server.js /repository &
while true; do node ./monitor.js /repository/; done
