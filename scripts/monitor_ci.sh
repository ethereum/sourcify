#!/bin/bash
./scripts/find_replace.sh

# Install E2E test
git clone https://github.com/sourcifyeth/metacoin-source-verify.git
cd metacoin-source-verify
npm ci

# Publishes sources to IPFS (via Infura) and deploys contracts to Goerli
# Account key and Infura project ID are Circle CI env variable settings.
CHAIN_IDS=""
npm run deploy:ropsten && CHAIN_IDS+=" 3" || echo "Failed deployment to Ropsten"
npm run deploy:rinkeby && CHAIN_IDS+=" 4" || echo "Failed deployment to Rinkeby"
npm run deploy:goerli  && CHAIN_IDS+=" 5" || echo "Failed deployment to Goerli"

if [ -z "$CHAIN_IDS" ]; then
    echo "Failed to deploy to any of the chains"
    exit 0
fi

# Give monitor a chance to detect and save.
sleep 300

# Script which verifies repository write
cd ..
for i in `seq 1 10`
do
    echo "Starting attempt $i"
    # Give monitor a chance to detect and save.
    sleep 30
    # Script which verifies repository write
    if (./scripts/monitor_ci.js $CHAIN_IDS); then
        echo "Test contract successfully verified!"
        exit 1
    fi
    echo "Finished attempt $i"
done

echo "Test contract not verified!"
exit 2
