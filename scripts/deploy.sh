#!/bin/bash
set -e

# If not staging or master branch are existing
export TAG="$CIRCLE_BRANCH"

if [ "$CIRCLE_BRANCH" == "staging" ]; then 
    export TAG="latest"
    export REPO_PATH='/opt/source-verify/staging/source-verify/'
    export COMPOSE_COMMAND='source .env && COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f localchain.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml'
fi

if [ "$CIRCLE_BRANCH" == "master" ]; then
    export TAG="stable"; 
    export REPO_PATH='/opt/source-verify/production/source-verify/'
    export COMPOSE_COMMAND='source .env && COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f localchain.yaml -f monitor.yaml -f s3.yaml -f server.yaml -f ui.yaml'
fi

echo $TAG
# Do ssh to server
ssh -o "StrictHostKeyChecking no" source-verify@komputing.org "\
mkdir -p $REPO_PATH && \
cd $REPO_PATH && \
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/environments ./environments && \
eval ${COMPOSE_COMMAND} pull && \
echo $TAG && \
eval ${COMPOSE_COMMAND} up -d \
curl https://raw.githubusercontent.com/ethereum/source-verify/${CIRCLE_BRANCH}/scripts/clear-repo.sh > clear-repo.sh && \\
chmod +x clear-repo.sh && ./clear-repo.sh"
