#!/bin/bash
set -e
# Script to run tests on new chain support requests.
# Runs for branches i.e. pull requests that are named add-chain-{chainId}

# from https://stackoverflow.com/questions/55839004/circleci-regex-filtering-match-within-string

# if CIRCLE_PR_NUMBER is NOT set (meaning it is not a PR
# from a forked repository), then CIRCLE_BRANCH will
# contain the real branch name
if [ -z "${CIRCLE_PR_NUMBER}" ]; then
    REAL_BRANCH_NAME="${CIRCLE_BRANCH}"

# if CIRCLE_PR_NUMBER is set, then we need to use it
# to fetch the real branch name
else
    REAL_BRANCH_NAME=$(curl -s https://api.github.com/repos/"${CIRCLE_PROJECT_USERNAME}"/"${CIRCLE_PROJECT_REPONAME}"/pulls/"${CIRCLE_PR_NUMBER}" | jq -r '.head.ref')
fi

echo "Real branch name: ${REAL_BRANCH_NAME}"
# Put add-chain-111-222-333 into NEW_CHAIN_ID=111,222,333. Also works for add-chains-... with "s"
# Made with ChatGPT
NEW_CHAIN_ID=$(echo "${REAL_BRANCH_NAME}" | awk -F'add-chains?-' '{print $2}' | awk 'BEGIN {FS="-"; OFS=","} {$1=$1; print $0}')

if [ -z "${NEW_CHAIN_ID}" ]; then
    echo 'Not saving NEW_CHAIN_ID since its not a new chain PR.'

# if it is a new chain PR, persist NEW_CHAIN_ID for the next CircleCI steps
else
    echo "Saving NEW_CHAIN_ID=${NEW_CHAIN_ID}"
    echo BASH_ENV=$BASH_ENV
    echo "export NEW_CHAIN_ID=${NEW_CHAIN_ID}" >>"$BASH_ENV"
fi
