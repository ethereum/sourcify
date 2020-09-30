#!/bin/bash
./scripts/find_replace.sh

# Install E2E test
git clone https://github.com/cgewecke/metacoin-source-verify.git
cd metacoin-source-verify
yarn

# Publishes sources to IPFS (via Infura) and deploys contracts to Goerli
# Account key and Infura project ID are Circle CI env variable settings.
npm run deploy:goerli || exit 1

# Give monitor a chance to detect and save.
sleep 300

# Script which verifies repository write
cd ..
for i in `seq 1 10`
do
    # Give monitor a chance to detect and save.
    sleep 30
    # Script which verifies repository write
    result=$(./scripts/monitor_ci.js)
    if [[ $result != *"Error"* ]]; then
        echo $result
        break
    fi
done
