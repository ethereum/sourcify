#!/bin/sh

echo "Starting monitor..."
while true; do node ./monitor.js /repository/; done
