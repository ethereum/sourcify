#!/bin/bash

ipfs init
ipfs daemon &

source /app/.env

ipfs key import main /app/ipfs-${TAG}.key 

# Start the run once job.
echo "Docker container has been started"

crontab cron.job
cron -f
