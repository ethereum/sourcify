#!/bin/bash

mkdir -p $REPO_PATH
cd $REPO_PATH

if [[ ! -d source-verify ]]; then
    git clone https://github.com/ethereum/sourcify.git
    cd source-verify
    git checkout ${CIRCLE_BRANCH}
else
    cd source-verify
    git fetch
    git checkout ${CIRCLE_BRANCH}
    git pull origin ${CIRCLE_BRANCH}
    git reset --hard origin/${CIRCLE_BRANCH}
    git pull origin ${CIRCLE_BRANCH}
fi

if [ "${TAG}" == "stable" ]; then
    export COMPOSE_COMMAND="COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml "
else
    export COMPOSE_COMMAND="COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml -f localchain.yaml"
fi

TAG=$TAG ./scripts/find_replace.sh
source ../environments/.env
cd scripts
echo $PWD
./prepare.sh
cd ../environments
echo $PWD
eval ${COMPOSE_COMMAND} pull
echo $PWD
eval ${COMPOSE_COMMAND} up -d
echo $PWD
../scripts/clear-repo.sh
