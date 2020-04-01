#!/bin/bash

mkdir -p $REPO_PATH
cd $REPO_PATH

if [[ ! -d source-verify ]]; then
    git clone https://github.com/ethereum/source-verify.git
    cd source-verify
    git checkout ${CIRCLE_BRANCH}
else
    cd source-verify
    git checkout ${CIRCLE_BRANCH}
    git reset --hard origin/${CIRCLE_BRANCH}
fi

if [ "${TAG}" == "stable" ]; then
    export COMPOSE_COMMAND="COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml -f localchain.yaml "
else
    export COMPOSE_COMMAND="COMPOSE_PROJECT_NAME=${TAG}_source-verify docker-compose -f ipfs.yaml -f monitor.yaml -f repository.yaml -f s3.yaml -f server.yaml -f ui.yaml"
fi

TAG=$TAG ACCESS_KEY=$ACCESS_KEY SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY ./scripts/find_replace.sh
source environments/.env
echo $PWD
DATABASE_PATH=$DATABASE_PATH REPOSITORY_PATH=$REPOSITORY_PATH ./scripts/prepare.sh
echo $PWD 
eval ${COMPOSE_COMMAND} pull
echo $PWD
eval ${COMPOSE_COMMAND} up -d
echo $PWD
../scripts/clear-repo.sh
