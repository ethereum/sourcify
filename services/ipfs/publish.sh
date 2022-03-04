#!/bin/bash
# Avoid cron job ipfs command not found.
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

date
echo "Started find in repository for stats"
REPOSITORY_PATH=/root/.ipfs/repository
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

echo "Finished find in repo for stats"
echo $OUTPUT > $REPOSITORY_PATH/stats.json

date
echo "Starting ipfs add"
hash=$(ipfs add -Q -r --fscache --nocopy /root/.ipfs/repository)
echo "Finished ipfs add! New ipfs hash: $hash"
date
echo "Publishing hash under ipns key"
ipfs -D name publish --key=main $hash
echo "Published hash under ipns key"
date