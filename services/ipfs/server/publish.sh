#!/bin/bash
# Avoid cron job ipfs command not found.
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Update the contract stats.
date
echo "Started find in repository for stats"
REPOSITORY_PATH="/repository"
CHAINS=$(find $REPOSITORY_PATH/contracts/full_match/ -mindepth 1 -maxdepth 1 -type d | rev | cut -d "/" -f1 | rev)

OUTPUT="{ "
for chainId in ${CHAINS}; do
   OUTPUT="$OUTPUT  \"$chainId\": {"
   OUTPUT="$OUTPUT    \"full_match\": $(find $REPOSITORY_PATH/contracts/full_match/$chainId/ -mindepth 1 -maxdepth 1 -type d | wc -l),"
   OUTPUT="$OUTPUT    \"partial_match\": $(find $REPOSITORY_PATH/contracts/partial_match/$chainId/ -mindepth 1 -maxdepth 1 -type d | wc -l)"
   
   if [[ $chainId == $(echo $CHAINS | rev | cut -d " " -f1 | rev) ]]
    then
        OUTPUT="$OUTPUT  }"
    else
        OUTPUT="$OUTPUT  },"
    fi
        
done
OUTPUT="$OUTPUT}"

echo "Finished find in repo for stats"
echo $OUTPUT > $REPOSITORY_PATH/stats.json
date

# Update the new manifest and stats in MFS.
manifestHash=$(ipfs add -Q /repository/manifest.json)
statsHash=$(ipfs add -Q /repository/stats.json)
# rm old files from MFS 
ipfs files rm /manifest.json
ipfs files rm /stats.json
# add new manifest and stats
ipfs files cp -p /ipfs/$manifestHash /manifest.json
ipfs files cp -p /ipfs/$statsHash /stats.json

# Publish the new root hash
rootHash=$(ipfs files stat / | head -n 1)

echo "Publishing rootHash $rootHash under ipns key"
ipfs -D name publish --key=main $rootHash
echo "Published rootHash $rootHash under ipns key"

timestamp=$(date -u +"%Y-%m-%dT%H:%MZ")
pinName=sourcify-$TAG-$timestamp

if [ -z "$DEBUG" ]
then
    echo "Pinning to remote services"
    ipfs pin remote add --service=estuary $rootHash --background --name=$pinName
    ipfs pin remote add --service=web3.storage $rootHash --background --name=$pinName
    echo "Pinned to remote services (running in background)"
fi