#!/bin/bash
# Script to run tests on new chain support requests.
# Runs for branches i.e. pull requests that are named add-chain-{chainId}

# from https://stackoverflow.com/questions/55839004/circleci-regex-filtering-match-within-string 

NEW_CHAIN_REGEX='.*(add|update)-chain-(\d+)'

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
NEW_CHAIN_ID="$(echo "${REAL_BRANCH_NAME}" | sed -n "s/^.*add-chain-\([0-9]\+\).*$/\1/p")"

# if the ticket number regex does not match, then it's not 
# a feature branch, and we shouldn't upload to JIRA.
if [ -z "${NEW_CHAIN_ID}" ]; then
    echo 'Not testing since its not a new chain PR.'

# if it is a new chain PR, test it
else
    NEW_CHAIN_ID=${NEW_CHAIN_ID} npm run test:chains
fi