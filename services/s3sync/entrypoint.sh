#!/bin/bash

# Start the run once job.
echo "Docker container has been started"

# Setup a cron schedule.
echo "0 3 * * * AWS_S3_ACCESS_KEY_ID=$AWS_S3_ACCESS_KEY_ID AWS_S3_SECRET_ACCESS_KEY=$AWS_S3_SECRET_ACCESS_KEY CHAINSAFE_S3_ACCESS_KEY_ID=$CHAINSAFE_S3_ACCESS_KEY_ID CHAINSAFE_S3_SECRET_ACCESS_KEY=$CHAINSAFE_S3_SECRET_ACCESS_KEY BUCKET_NAME=$BUCKET_NAME TAG=$TAG /app/login_sync_s3.sh >> /var/log/cron.log 2>&1
# This extra line makes it a valid cron" > scheduler.txt

mkdir /app/logs

crontab scheduler.txt
cron -f
