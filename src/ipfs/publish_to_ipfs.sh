#!/bin/bash
source /app/.env
export PATH=~$PATH:/usr/local/bin:/usr/local/openjdk-11/bin:/usr/bin
export JAVA_HOME=/usr/local/openjdk-11/

hash=$(ipfs add -Q -r /app/repository)
echo $hash
curl -X POST "https://ipfs.komputing.org/api/v0/pin/add?arg=$hash&recursive=true"
ipfs name publish $hash

/app/source_verify_ens_updater/bin/source_verify_ens_updater $IPFS_SECRET /app/repository
