#!/bin/bash
./scripts/find_replace.sh

# Install E2E test
git clone https://github.com/sourcifyeth/metacoin-source-verify.git
cd metacoin-source-verify
npm ci

# Publishes sources to IPFS (via Infura) and deploys contracts to Goerli
# Account key and Infura project ID are Circle CI env variable settings.
npm run deploy:rinkeby || exit 1

# Give monitor a chance to detect and save.
sleep 300

# Script which verifies repository write
cd ..
for i in `seq 1 10`
do
    # Give monitor a chance to detect and save.
    sleep 30
    # Script which verifies repository write
    if (./scripts/monitor_ci.js); then
        echo "Test contract successfully verified!"
        exit 0
    fi
done

echo "Test contract not verified!"
exit 2
