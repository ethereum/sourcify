#!/bin/bash
set -e

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    TAG='latest'
    REPO_PATH='/home/gather/staging/'
    SERVER='-J source-verify@komputing.org gather@10.10.42.102'
elif [ "$CIRCLE_BRANCH" == "master" ]; then
    TAG='stable' 
    REPO_PATH='/home/sourcify/production/'
    SERVER='-J source-verify@komputing.org sourcify@10.10.42.7'
else
    echo "Invalid branch $CIRCLE_BRANCH. Check your config.yml"
    exit 1
fi

curl "https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/.circleci/ssh.config" > ~/.ssh/config

ssh $SERVER "\
    mkdir -p scripts && curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/scripts/setup.sh > scripts/setup.sh && chmod +x scripts/setup.sh && chown $USER:$USER ./scripts/setup.sh && \
    REPO_PATH='${REPO_PATH}' CIRCLE_BRANCH='${CIRCLE_BRANCH}' TAG='${TAG}' ./scripts/setup.sh"
