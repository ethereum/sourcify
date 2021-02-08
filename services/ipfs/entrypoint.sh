#!/bin/bash

ipfs init --profile server

source /app/.env

ipfs key import main /app/ipfs-${TAG}.key 

ipfs daemon &

# Start the run once job.
echo "Docker container has been started"

crontab cron.job
cron -f
