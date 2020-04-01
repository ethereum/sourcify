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
mkdir -p $REPO_PATH && \
cd $REPO_PATH && \
git clone https://github.com/ethereum/source-verify.git && \
git checkout ${CIRCLE_BRANCH} && \
git reset --hard origin/${CIRCLE_BRANCH} && \
./scripts/find_replace.sh && \
cd source-verify/environments && \
eval ${COMPOSE_COMMAND} pull && \
eval ${COMPOSE_COMMAND} up -d && \
../scripts/clear-repo.sh"
