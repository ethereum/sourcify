#!/bin/bash

ipfs init
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

## Build announced address config according to https://docs.ipfs.io/how-to/configure-node/#addresses. Need to announce the public and local IPs in swarm manually since docker does not know these IPs.
ANNOUNCED_ADDRESSES='['
if test -n "$PUBLIC_IP"
then 
  ANNOUNCED_ADDRESSES=''$ANNOUNCED_ADDRESSES'"/ip4/'$PUBLIC_IP'/tcp/'$IPFS_LIBP2P_EXTERNAL_PORT'","/ip4/'$PUBLIC_IP'/udp/'$IPFS_LIBP2P_EXTERNAL_PORT'/quic"'
fi 

if test -n "$LOCAL_IP"
then
  if test -n "$PUBLIC_IP" # Add comma if there are addresses in the array already
  then 
    ANNOUNCED_ADDRESSES=$ANNOUNCED_ADDRESSES','
  fi
  ANNOUNCED_ADDRESSES=''$ANNOUNCED_ADDRESSES'"/ip4/'$LOCAL_IP'/tcp/'$IPFS_LIBP2P_EXTERNAL_PORT'","/ip4/'$LOCAL_IP'/udp/'$IPFS_LIBP2P_EXTERNAL_PORT'/quic"'
fi

ANNOUNCED_ADDRESSES=$ANNOUNCED_ADDRESSES']'

ipfs config Addresses.Announce $ANNOUNCED_ADDRESSES --json
ipfs config --json Reprovider.Strategy '"pinned"'
ipfs config --json Experimental.AcceleratedDHTClient true

source /app/.env

ipfs key import main /app/ipfs-${TAG}.key 

ipfs daemon --enable-pubsub-experiment --enable-namesys-pubsub &

# Start the run once job.
echo "Docker container has been started"

crontab cron.job
cron -f
