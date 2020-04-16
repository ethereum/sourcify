#!/bin/bash

cd ..
mkdir files
cd files
wget https://staging-source-verify.s3.eu-central-1.amazonaws.com/codedb.zip
unzip codedb.zip codedb.txt
