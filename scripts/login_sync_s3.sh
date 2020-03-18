source .env
aws configure set aws_access_key_id $ACCESS_KEY
aws configure set aws_secret_access_key $SECRET_ACCESS_KEY
aws s3 sync $REPOSITORY_PATH $BUCKET_NAME_STAGING
