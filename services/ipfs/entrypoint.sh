#!/bin/bash

ipfs init
ipfs daemon &

# Start the run once job.
echo "Docker container has been started"

crontab cron.job
cron -f
