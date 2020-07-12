#!/bin/bash
set -e
source ./environments/.env # You can also use some other environment

path="./synced"
logPath="."

mkdir -p $path

aws s3 sync $BUCKET_NAME/repository $path

echo "Full matches" >> $logPath/reformat.log
echo "########################################"  >> $logPath/reformat.log
mkdir -p $path/contracts/full_match
cp -urv $path/contract/. $path/contracts/full_match/ >> $logPath/reformat.log

echo "Partial matches" >> $logPath/reformat.log
echo "########################################"  >> $logPath/reformat.log
mkdir -p $path/contracts/partial_match
cp -urv $path/partial_matches/. $path/contracts/partial_match/ >> $logPath/reformat.log

aws s3 sync $path $BUCKET_NAME/repository
