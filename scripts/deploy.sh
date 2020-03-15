#!/bin/bash

# If not staging or master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    export TAG='latest'
    export REPO_PATH='/opt/source-verify/staging/'
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG='stable' 
    export REPO_PATH='/opt/source-verify/production/'
fi

# Do ssh to server
ssh -o "StrictHostKeyChecking no" source-verify@komputing.org "\
mkdir -p $REPO_PATH && \
cd $REPO_PATH && \
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/docker-compose-${TAG}.yaml > docker-compose.yaml && \
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/.env.${TAG} > .env && \
TAG=$TAG docker-compose pull && \
echo $TAG && \
source .env && TAG=$TAG COMPOSE_PROJECT_NAME=source-verify-${TAG} docker-compose up -d && \\
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/scripts/clear-repo.sh > clear-repo.sh && \\
chmod +x clear-repo.sh && ./clear-repo.sh"
