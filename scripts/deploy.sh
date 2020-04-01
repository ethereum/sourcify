#!/bin/bash

# If not staging or master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    export TAG='latest'
    export REPO_PATH='/opt/source-verify/staging/'
    export COMPOSE_COMMAND='COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f localchain.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml'
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG='stable' 
    export REPO_PATH='/opt/source-verify/production/'
    export COMPOSE_COMMAND='COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f localchain.yaml -f monitor.yaml -f s3.yaml -f server.yaml -f ui.yaml'
fi

# Do ssh to server
ssh -o "StrictHostKeyChecking no" source-verify@komputing.org "\
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/scripts/setup.sh > setup.sh && chmod +x setup.sh && ls -al && \
REPO_PATH=$REPO_PATH CIRCLE_BRANCH=$CIRCLE_BRANCH TAG=$TAG ACCESS_KEY=$ACCESS_KEY SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY COMPOSE_COMMAND=$COMPOSE_COMMAND ./setup.sh"
