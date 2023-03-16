#!/bin/bash

/usr/local/bin/aws --version
/usr/local/bin/aws configure set aws_access_key_id $AWS_S3_ACCESS_KEY_ID
/usr/local/bin/aws configure set aws_secret_access_key $AWS_S3_SECRET_ACCESS_KEY
/usr/local/bin/aws configure set s3.max_concurrent_requests 10

echo "$(date) Syncing AWS at $BUCKET_NAME/$TAG"
/usr/local/bin/aws s3 sync --quiet /app/repository $BUCKET_NAME/$TAG
echo "$(date) Sync AWS complete"

# Sync to Chainsafe Storage S3
# /usr/local/bin/aws configure set aws_access_key_id $CHAINSAFE_S3_ACCESS_KEY_ID
# /usr/local/bin/aws configure set aws_secret_access_key $CHAINSAFE_S3_SECRET_ACCESS_KEY
# /usr/local/bin/aws configure set s3.max_concurrent_requests 2 # Chainsafe Storage S3 concurrency is limited

# echo "$(date) Syncing Chainsafe S3 at $BUCKET_NAME"
# /usr/local/bin/aws s3 sync /app/repository $BUCKET_NAME/$TAG --endpoint-url https://buckets.chainsafe.io > "/app/logs/s3sync-chainsafe-$(date '+%Y-%m-%dZ%H:%M').log" 2>&1
# echo "$(date) Syncing Chainsafe S3 complete"
