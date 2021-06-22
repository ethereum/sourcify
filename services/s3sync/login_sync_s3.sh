#!/bin/bash

/usr/local/bin/aws --version
/usr/local/bin/aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
/usr/local/bin/aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY
/usr/local/bin/aws s3 sync /app/repository $BUCKET_NAME
