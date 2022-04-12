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
hash=$(ipfs add -Q -r --fscache --nocopy /root/.ipfs/repository/contracts)
echo "Finished ipfs add! New ipfs hash: $hash"
date

# As manifest.json frequently changes, it is not possible to add whole /repository with Filestore (i.e. --nocopy).
# Just add&pin repository/contracts and link the folders full_match, partial_match manually under the MFS (Mutable File System) directory /contracts.
echo "Linking under /contracts"
# rm old CIDs from MFS path
ipfs files rm -r /contracts/full_match
ipfs files rm -r /contracts/partial_match
# Link new CIDs
ipfs files cp -p /ipfs/$hash/full_match /contracts/
ipfs files cp -p /ipfs/$hash/partial_match /contracts/

# Add manifest and stats to ipfs (without Filestore)
manifestHash=$(ipfs add -Q /root/.ipfs/repository/manifest.json)
statsHash=$(ipfs add -Q /root/.ipfs/repository/stats.json)
# rm old CIDs from MFS path
ipfs files rm /manifest.json
ipfs files rm /stats.json
# Link
ipfs files cp -p /ipfs/$manifestHash /manifest.json
ipfs files cp -p /ipfs/$statsHash /stats.json

# Get the root hash
rootHash=$(ipfs files stat / | head -n 1)

echo "Publishing hash under ipns key"
ipfs -D name publish --key=main $rootHash
echo "Published hash under ipns key"
date