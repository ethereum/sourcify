#!/bin/bash
set -e

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    TAG='latest'
    REPO_PATH='/home/gather/staging/'
    # SERVER='sourcify@ec2-52-58-207-182.eu-central-1.compute.amazonaws.com'
    SERVER='-J source-verify@komputing.org gather@10.10.42.102'
    curl "https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/.circleci/ssh.config" > ~/.ssh/config
elif [ "$CIRCLE_BRANCH" == "master" ]; then
    TAG='stable' 
    REPO_PATH='/opt/source-verify/production/'
    SERVER='source-verify@komputing.org'
else
    echo "Invalid branch $CIRCLE_BRANCH. Check your config.yml"
    exit 1
fi

ssh -o "StrictHostKeyChecking no" $SERVER "\
    mkdir -p scripts && curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/scripts/setup.sh > scripts/setup.sh && chmod +x scripts/setup.sh && chown $USER:$USER ./scripts/setup.sh && \
    REPO_PATH='${REPO_PATH}' CIRCLE_BRANCH='${CIRCLE_BRANCH}' TAG='${TAG}' ./scripts/setup.sh"
