#!/bin/bash

export PATH=~$PATH:/usr/local/bin:/usr/local/openjdk-11/bin:/usr/bin
export JAVA_HOME=/usr/local/openjdk-11/

REPOSITORY_PATH=/app/repository
CHAINS=$(find $REPOSITORY_PATH/contracts/full_match/ -mindepth 1 -maxdepth 1 -type d | rev | cut --delimiter=/ -f1 | rev)

OUTPUT="{ "
for chainId in ${CHAINS}; do
   OUTPUT+="  \"$chainId\": {"
   OUTPUT+="    \"full_match\": $(find $REPOSITORY_PATH/contracts/full_match/$chainId/ -mindepth 1 -maxdepth 1 -type d | wc -l),"
   OUTPUT+="    \"partial_match\": $(find $REPOSITORY_PATH/contracts/partial_match/$chainId/ -mindepth 1 -maxdepth 1 -type d | wc -l)"
   
   if [[ $chainId == $(echo $CHAINS | rev | cut --delimiter=" " -f1 | rev) ]]
    then
        OUTPUT+="  }"
    else
        OUTPUT+="  },"
    fi
        
done
OUTPUT+="}"

echo $OUTPUT > $REPOSITORY_PATH/stats.json

hash=$(ipfs add -Q -r /app/repository)
echo "Update successful! New ipfs hash: $hash"
# curl -X POST "https://ipfs.komputing.org/api/v0/pin/add?arg=$hash"
ipfs repo gc --quiet
echo "Garbage collection done"
ipfs -D name publish --key=main $hash
echo "Published hash under ipns key"
# ENS updater
# /app/source_verify_ens_updater/bin/source_verify_ens_updater /app/repository
