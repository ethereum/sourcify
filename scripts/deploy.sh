#!/bin/bash
set -e

# If not staging or master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    export TAG='latest'
    export REPO_PATH='/home/sourcify/staging/'
    # Do ssh to server
    ssh -o "StrictHostKeyChecking no" sourcify@ec2-52-58-207-182.eu-central-1.compute.amazonaws.com "\
    mkdir -p scripts && curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/scripts/setup.sh > scripts/setup.sh && chmod +x scripts/setup.sh && chown $USER:$USER ./scripts/setup.sh && \
    REPO_PATH='${REPO_PATH}' CIRCLE_BRANCH='${CIRCLE_BRANCH}' TAG='${TAG}' ./scripts/setup.sh"
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG='stable' 
    export REPO_PATH='/opt/source-verify/production/'
    # Do ssh to server
    ssh -o "StrictHostKeyChecking no" source-verify@komputing.org "\
    mkdir -p scripts && curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/scripts/setup.sh > scripts/setup.sh && chmod +x scripts/setup.sh && chown $USER:$USER ./scripts/setup.sh && \
    REPO_PATH='${REPO_PATH}' CIRCLE_BRANCH='${CIRCLE_BRANCH}' TAG='${TAG}' ./scripts/setup.sh"
fi


