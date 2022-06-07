#!/bin/bash
set -e

mkdir -p $REPO_PATH
cd $REPO_PATH

if [[ ! -d sourcify ]]; then
    git clone https://github.com/ethereum/sourcify.git sourcify
    cd sourcify
    git checkout ${CIRCLE_BRANCH}
else
    cd sourcify
    git fetch
    git checkout ${CIRCLE_BRANCH}
    git reset --hard origin/${CIRCLE_BRANCH}
fi

if [ "${TAG}" == "stable" ]; then
    COMPOSE_COMMAND="COMPOSE_PROJECT_NAME=${TAG} docker-compose -f ipfs.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml -f ui-legacy.yaml"
elif [ "${TAG}" == "latest" ]; then
    COMPOSE_COMMAND="COMPOSE_PROJECT_NAME=${TAG} docker-compose -f ipfs.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml"
else
    COMPOSE_COMMAND="COMPOSE_PROJECT_NAME=${TAG} docker-compose -f ipfs.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml -f localchain.yaml"
fi

TAG=$TAG ./scripts/find_replace.sh
source ./environments/.env
./scripts/prepare.sh
cd environments
docker image prune -f
eval ${COMPOSE_COMMAND} pull
eval COMPOSE_HTTP_TIMEOUT=1200 ${COMPOSE_COMMAND} up -d
