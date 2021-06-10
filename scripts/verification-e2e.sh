#!/bin/bash
#./scripts/find_replace.sh

# Install E2E test
git clone https://github.com/sourcifyeth/metacoin-source-verify.git
cd metacoin-source-verify
npm ci

# Test WITHOUT providing address or chain
# Deploys contracts to Rinkeby
# Account key and Infura project ID are Circle CI env variable settings.
# npm run deploy-with-salt:rinkeby || exit 1
# DEPLOYMENT_ADDRESS=$(truffle networks | grep MetaCoinSalted | sed 's/^.*MetaCoinSalted: \\(.*\\).*$/\\1/')
# cd ..
# node scripts/verification-e2e.js $DEPLOYMENT_ADDRESS || exit 2

# Test WITH providing address and chain
# TODO Temporarily commented
# cd metacoin-source-verify
npm run deploy-with-salt:rinkeby || exit 3
DEPLOYMENT_ADDRESS=$(truffle networks | grep MetaCoinSalted | sed 's/^.*MetaCoinSalted: \\(.*\\).*$/\\1/')
cd ..
node scripts/verification-e2e.js $DEPLOYMENT_ADDRESS 4 || exit 4
