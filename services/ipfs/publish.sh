#!/bin/bash
# Avoid cron job ipfs command not found.
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Update the contract stats.
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

# Update the new manifest and stats in MFS.
manifestHash=$(ipfs add -Q /root/.ipfs/repository/manifest.json)
statsHash=$(ipfs add -Q /root/.ipfs/repository/stats.json)
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
date