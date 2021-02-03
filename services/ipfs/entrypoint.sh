#!/bin/bash

ipfs init --profile server
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

source /app/.env

ipfs key import main /app/ipfs-${TAG}.key 

ipfs daemon &

# Start the run once job.
echo "Docker container has been started"

crontab cron.job
cron -f
