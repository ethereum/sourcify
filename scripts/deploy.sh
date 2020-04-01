#!/bin/bash

# If not staging or master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    export TAG="latest"
    export REPO_PATH='/opt/source-verify/staging/'
    export COMPOSE_COMMAND='source .env && COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f localchain.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml'
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable"; 
    export REPO_PATH='/opt/source-verify/production/'
    export COMPOSE_COMMAND='source .env && COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f localchain.yaml -f monitor.yaml -f s3.yaml -f server.yaml -f ui.yaml'
fi

# Do ssh to server
ssh -o "StrictHostKeyChecking no" source-verify@komputing.org "\
../scripts/setup.sh && \
eval ${COMPOSE_COMMAND} pull && \
eval ${COMPOSE_COMMAND} up -d && \
../scripts/clear-repo.sh"
