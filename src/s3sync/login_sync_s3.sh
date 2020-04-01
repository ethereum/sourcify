#!/bin/bash

source /app/.env
/usr/local/bin/aws --version
/usr/local/bin/aws configure set aws_access_key_id $ACCESS_KEY
/usr/local/bin/aws configure set aws_secret_access_key $SECRET_ACCESS_KEY
/usr/local/bin/aws s3 sync /app/repository $BUCKET_NAME_STAGING
