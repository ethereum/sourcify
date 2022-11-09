#!/bin/bash
./scripts/find_replace.sh

# Install E2E test
git clone https://github.com/sourcifyeth/metacoin-source-verify.git
cd metacoin-source-verify
npm ci

# Publishes sources to IPFS and deploys contracts to Goerli or Sepolia
# Account key and Infura project ID are Circle CI env variable settings.
npm run deploy:$CHAIN_NAME || exit 1

echo "Waiting 2 mins"
# Give monitor a chance to detect and save.
sleep 120
echo "Waited 2 mins"

# Script which verifies repository write
cd ..
for i in `seq 1 20`
do
    # Give monitor a chance to detect and save.
    sleep 30
    # Script which verifies repository write
    echo "Trying ${i} times"
    if (./scripts/monitor_ci.js $CHAIN_ID $CHAIN_NAME); then
        echo "Test contract successfully verified!"
        exit 0
    fi
done

echo "Test contract not verified!"
exit 2
