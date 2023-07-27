#!/bin/bash


if [ ! -f /root/.ipfs/config ]
then
    echo "No config found. Initializing..."
    bash ./init-config.sh
fi


ipfs daemon --enable-pubsub-experiment --enable-namesys-pubsub &

# Wait for the daemon to initialize
echo "Sleeping 30 seconds"
sleep 30
echo "Sleeped 30 seconds"

if [ -z "$DEBUG" ]
then
    date
    echo "Starting ipfs add"
    hash=$(ipfs add -Q -r /repository/contracts)
    echo "Finished ipfs add! New ipfs hash: $hash"
    date

    # Remove the old /contracts in MFS
    echo "Removing /contracts from MFS"
    ipfs files rm -r /contracts
    echo "Removed /contracts from MFS"

    # cp the repo under MFS
    echo "Copying $hash to MFS at /contracts"
    ipfs files cp -p /ipfs/$hash /contracts
    echo "Copied $hash to MFS at /contracts"
fi


bash ./publish.sh

# Write the TAG var to /etc/environment so that the crontab can pick up the variable
echo "TAG=$TAG" > /etc/environment

if [ -z "$DEBUG" ]
then
    crontab cron.job
    cron -f
fi

tail -f /dev/null
