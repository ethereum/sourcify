#!/bin/bash
./scripts/find_replace.sh

# Install E2E test
git clone https://github.com/sourcifyeth/metacoin-source-verify.git
cd metacoin-source-verify
npm ci

# Test WITH providing address and chain
npm run deploy-with-salt:$CHAIN_NAME || exit 3
cd ..
node scripts/verification-e2e.js $CHAIN_ID || exit 4
