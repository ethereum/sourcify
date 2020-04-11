#!/bin/bash


# Install E2E test
git clone https://github.com/cgewecke/metacoin-source-verify.git
cd metacoin-source-verify
npm install

# Publishes sources to IPFS (via Infura) and deploys contracts to Goerli
# Account key and Infura project ID are Circle CI env variable settings.
npm run deploy:goerli

# Give monitor a chance to detect and save.
sleep 145

# Script which verifies repository write
cd ..
./scripts/monitor_ci.js
