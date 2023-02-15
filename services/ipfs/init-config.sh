ipfs init --profile=badgerds
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
ipfs config --json Experimental.AcceleratedDHTClient true

# Allow WebUI to be accesible from host
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json Addresses.API '["/ip4/0.0.0.0/tcp/5001"]'

if [ -z "$DEBUG" ]
then
  # Add remote pinning services
  ipfs pin remote service add estuary https://api.estuary.tech/pinning $ESTUARY_PINNING_SECRET
  ipfs pin remote service add web3.storage https://api.web3.storage/ $WEB3_STORAGE_PINNING_SECRET

  ipfs key import main /sourcify/ipfs-${TAG}.key 
fi