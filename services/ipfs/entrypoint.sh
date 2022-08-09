#!/bin/bash


if [ ! -f ~/.ipfs/config ]
then
    bash ./init-config.sh
fi

ipfs daemon --enable-pubsub-experiment --enable-namesys-pubsub --enable-gc &

# Wait for the daemon to initialize
echo "Sleeping 30 seconds"
sleep 30
echo "Sleeped 30 seconds"

# Add the whole repo and publish on start
date
echo "Starting ipfs add"
hash=$(ipfs add -Q -r /root/.ipfs/repository/contracts)
echo "Finished ipfs add! New ipfs hash: $hash"
date

# Remove /contracts 
echo "Removing /contracts from MFS"
ipfs files rm -r /contracts
echo "Removed /contracts from MFS"

# cp the repo under MFS
echo "Copying $hash to MFS at /contracts"
ipfs files cp -p /ipfs/$hash /contracts
echo "Copied $hash to MFS at /contracts"
date

# Add manifest and stats to MFS.
echo "Adding manifest and stats"
manifestHash=$(ipfs add -Q /root/.ipfs/repository/manifest.json)
statsHash=$(ipfs add -Q /root/.ipfs/repository/stats.json)
ipfs files cp -p /ipfs/$manifestHash /manifest.json
ipfs files cp -p /ipfs/$statsHash /stats.json
echo "Added manifest: $manifestHash and stats: $statsHash"

rootHash=$(ipfs files stat / --hash)

echo "Publishing rootHash $rootHash under ipns key"
ipfs -D name publish --key=main $rootHash
echo "Published rootHash $rootHash under ipns key"
date

# Start the run once job.
echo "Successfully added and published the repository"

crontab cron.job
cron -f
