#!/bin/bash

/usr/local/bin/aws --version
/usr/local/bin/aws configure set aws_access_key_id $AWS_S3_ACCESS_KEY_ID
/usr/local/bin/aws configure set aws_secret_access_key $AWS_S3_SECRET_ACCESS_KEY

date
echo "Syncing AWS at $BUCKET_NAME/$TAG"
/usr/local/bin/aws s3 sync --quiet /app/repository $BUCKET_NAME/$TAG
echo "Sync AWS complete"
date

# Sync to Chainsafe Storage S3
/usr/local/bin/aws configure set aws_access_key_id $CHAINSAFE_S3_ACCESS_KEY_ID
/usr/local/bin/aws configure set aws_secret_access_key $CHAINSAFE_S3_SECRET_ACCESS_KEY
date
echo "Syncing Chainsafe S3 at $BUCKET_NAME"
/usr/local/bin/aws s3 sync --quiet /app/repository $BUCKET_NAME --endpoint-url https://buckets.chainsafe.io
echo "Syncing Chainsafe S3 complete"
date