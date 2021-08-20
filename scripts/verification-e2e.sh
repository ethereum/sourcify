#!/bin/bash
./scripts/find_replace.sh

# Install E2E test
git clone https://github.com/sourcifyeth/metacoin-source-verify.git
cd metacoin-source-verify
npm ci
cd ..

declare -A chains=([3]=ropsten [4]=rinkeby [5]=goerli)
declare -A errors

for id in "${!chains[@]}"; do
    cd metacoin-source-verify
    CHAIN_NAME=${chains[$id]}
    npm run deploy-with-salt:$CHAIN_NAME || errors[$CHAIN_NAME]="failed deployment"
    cd ..
    node scripts/verification-e2e.js $id || errors[$CHAIN_NAME]="failed verification"
done

if [ ${#errors[@]} -eq 0 ]; then
    echo "All chains successfully tested"
else
    for id in "${!chains[@]}"; do
        CHAIN_NAME=${chains[$id]}
        ERROR=${errors[$CHAIN_NAME]}
        if [ -n "$ERROR" ]; then
            echo "$CHAIN_NAME: $ERROR"
        else
            echo "$CHAIN_NAME: success"
        fi
    done
    exit 1
fi
